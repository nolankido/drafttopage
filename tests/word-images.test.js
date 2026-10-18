import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { inspectDocxArchive, readDocxXML, readDocxImagePart } from '../public/docx-archive.js';
import { prepareWordImageKit, wordImageDimensions } from '../public/word-image-kit.js';
import { createZip, createWordImageZip, crc32 } from '../public/zip.js';
import { wordImagePlaceholders } from '../public/image-editing.js';
import { python, para } from './docx-fixtures.js';
import { PNG, JPEG, imageRun, imageFixture } from './word-image-fixtures.js';

const unzip = bytes => python('import sys,json,io,zipfile\nz=zipfile.ZipFile(io.BytesIO(bytes(json.load(sys.stdin))))\nassert z.testzip() is None\nprint(json.dumps({n:list(z.read(n)) for n in z.namelist()}))', Array.from(bytes));
const decode = value => new TextDecoder().decode(new Uint8Array(value));

test('Word image ZIP preserves original PNG/JPEG bytes, numbered positions and per-position alt text', async () => {
  const { bytes, candidate } = imageFixture({ ids:['one','two','one'], media:{'word/media/one.png':PNG,'word/media/two.jpg':JPEG,'word/media/unreferenced.png':PNG}, relations:[['one','media/one.png',''],['two','media/two.jpg','Internal']] });
  const before = JSON.stringify(candidate);
  const result = await prepareWordImageKit(bytes,candidate), output = unzip(result.bytes);
  assert.deepEqual(Object.keys(output), ['word-image-001.png','word-image-002.jpg','article-body.md','image-map.json','README.txt']);
  assert.deepEqual(output['word-image-001.png'],Array.from(PNG)); assert.deepEqual(output['word-image-002.jpg'],Array.from(JPEG));
  assert.deepEqual(result.images.map(({width,height})=>({width,height})),[{width:2,height:3},{width:2,height:3}]);
  const map = JSON.parse(decode(output['image-map.json']));
  assert.equal(result.placementMap, decode(output['image-map.json']), 'same-tab map must match the packaged map byte-for-byte');
  assert.equal(map.placements.length,3); assert.equal(map.placements[2].filename,'word-image-001.png'); assert.equal(map.placements[2].alt,'Fictional image 3');
  assert.deepEqual(wordImagePlaceholders(candidate.draft.body).length,3);
  assert.equal(decode(output['article-body.md']),candidate.draft.body.trim()+'\n');
  assert.match(decode(output['README.txt']),/Word cropping/); assert.match(decode(output['README.txt']),/not later article edits/);
  assert.equal(JSON.stringify(candidate),before);
});

test('Ordinary text import never reads embedded image bytes, even if their checksum is damaged', async () => {
  const {bytes,candidate}=imageFixture(); const damaged=bytes.slice(), entry=inspectDocxArchive(damaged).entries.find(e=>e.name==='word/media/one.png'); damaged[entry.start]^=1;
  assert.ok((await readDocxXML(damaged)).has('word/document.xml'));
  const kit=await prepareWordImageKit(damaged,candidate); assert.equal(kit.bytes,null); assert.equal(kit.images.length,0); assert.match(kit.skipped[0].note,/damaged/);
  await assert.rejects(readDocxImagePart(bytes,'word/embeddings/file.png'),/Only embedded/);
});

test('Unsupported formats, external or missing relationships and traversal targets stay placeholders', async () => {
  for(const [target,mode] of [['https://example.com/private.png','External'],['../media/one.png',''],['media/file.svg',''],['media/missing.png','']]){
    const {bytes,candidate}=imageFixture({relations:[['one',target,mode]]});
    const result=await prepareWordImageKit(bytes,candidate); assert.equal(result.bytes,null); assert.equal(result.skipped.length,1); assert.equal(candidate.wordImages[0].placeholder,'[Word image 1]');
  }
  const mismatch=imageFixture({defaults:'<Default Extension="png" ContentType="image/jpeg"/>'});
  assert.match(mismatch.candidate.wordImages[0].reason,/do not agree/);
});

test('Hidden runs and unreferenced media are excluded; visible Word alt text is bounded', async () => {
  const hidden=imageFixture({body:para('Visible prose')+'<w:p>'+imageRun('one','PRIVATE_ALT',true)+'</w:p>',media:{'word/media/one.png':PNG}});
  assert.equal(hidden.candidate.wordImages.length,0); assert.doesNotMatch(hidden.candidate.draft.body,/Word image|PRIVATE_ALT/);
  const alt=imageFixture({body:para('Visible prose')+'<w:p>'+imageRun('one','A'.repeat(600))+'</w:p>'});
  assert.equal(alt.candidate.wordImages[0].alt.length,500); assert.equal(alt.candidate.wordImages[0].altTruncated,true);
  const kit=await prepareWordImageKit(alt.bytes,alt.candidate); assert.equal(kit.placements[0].altTruncated,true);
});

test('Each corrupt or mismatched image is skipped while other images and article text remain usable', async () => {
  const {bytes,candidate}=imageFixture({ids:['one','bad'],relations:[['one','media/one.png',''],['bad','media/bad.png','']],media:{'word/media/one.png':PNG,'word/media/bad.png':JPEG}});
  const result=await prepareWordImageKit(bytes,candidate); assert.equal(result.images.length,1); assert.equal(result.skipped.length,1); assert.match(result.skipped[0].note,/recognized PNG/); assert.ok(result.bytes);
});

test('Image signatures, truncated structure, excessive dimensions and unsupported types are rejected', () => {
  assert.deepEqual(wordImageDimensions(PNG,'image/png'),{width:2,height:3}); assert.deepEqual(wordImageDimensions(JPEG,'image/jpeg'),{width:2,height:3});
  for(const bytes of [PNG.subarray(0,30),new Uint8Array([...PNG,0]),JPEG]) assert.throws(()=>wordImageDimensions(bytes,'image/png'));
  for(const bytes of [JPEG.subarray(0,JPEG.length-2),PNG]) assert.throws(()=>wordImageDimensions(bytes,'image/jpeg'));
  const big=PNG.slice(); new DataView(big.buffer).setUint32(16,30000); assert.throws(()=>wordImageDimensions(big,'image/png'),/dimensions/);
  assert.throws(()=>wordImageDimensions(PNG,'image/svg+xml'),/Only PNG/);
});

test('Image recovery caps files and bytes while reusing repeated references', async () => {
  const relations=Array.from({length:41},(_,i)=>['r'+i,'media/i'+i+'.png','']);
  const {bytes,candidate}=imageFixture({ids:relations.map(v=>v[0]),relations,media:Object.fromEntries(relations.map((r)=>['word/'+r[1],PNG]))});
  const result=await prepareWordImageKit(bytes,candidate); assert.equal(result.images.length,40); assert.equal(result.skipped.length,1); assert.match(result.skipped[0].note,/first 40/);
  const large=new Uint8Array(4*1024*1024+1);
  const oversized=imageFixture({media:{'word/media/one.png':large}}); const skipped=await prepareWordImageKit(oversized.bytes,oversized.candidate); assert.match(skipped.skipped[0].note,/4 MiB/);
});

test('The combined image budget stops further extraction without rejecting the article', async () => {
  const content=new Uint8Array(3_200_000), tag=new TextEncoder().encode('tEXt'), chunk=new Uint8Array(content.length+12), view=new DataView(chunk.buffer);
  view.setUint32(0,content.length);chunk.set(tag,4);chunk.set(content,8);view.setUint32(chunk.length-4,crc32(chunk.subarray(4,chunk.length-4)));
  const padded=new Uint8Array(PNG.length+chunk.length);padded.set(PNG.subarray(0,PNG.length-12));padded.set(chunk,PNG.length-12);padded.set(PNG.subarray(PNG.length-12),PNG.length-12+chunk.length);
  const relations=Array.from({length:4},(_,i)=>['r'+i,'media/image'+i+'.png','']);
  const {bytes,candidate}=imageFixture({ids:relations.map(r=>r[0]),relations,media:Object.fromEntries(relations.map(r=>['word/'+r[1],padded]))});
  const result=await prepareWordImageKit(bytes,candidate);assert.equal(result.images.length,3);assert.equal(result.skipped.length,1);assert.match(result.skipped[0].note,/12 MiB combined/);
});

test('Publishing ZIPs remain text-only and image ZIPs reject unsafe names or missing placement files', () => {
  assert.throws(()=>createZip([{name:'picture.png',content:PNG}]));
  const text=[{name:'article-body.md',content:'Article'},{name:'image-map.json',content:'{}'},{name:'README.txt',content:'Instructions'}];
  for(const name of ['../picture.png','word-image-001.svg','word-image-001.exe','word-image-001.png.html'])assert.throws(()=>createWordImageZip([...text,{name,content:PNG}]));
  assert.throws(()=>createWordImageZip([{name:'word-image-001.png',content:PNG}]));
  assert.throws(()=>createWordImageZip([...text,{name:'word-image-001.png',content:'not binary'}]));
});

test('Numbered Word placeholders work with the existing guided image editor and old backups', () => {
  const body='Before \\[Word image 1\\] after.\n\n[Word image 200]\n\n\\[Image or object omitted from Word document\\]';
  const positions=wordImagePlaceholders(body); assert.equal(positions.length,3); assert.equal(body.slice(positions[0].start,positions[0].end),'\\[Word image 1\\]');
});

test('Image preparation stays explicit and outside article apply approval and imported draft fields', async () => {
  const html=await readFile('public/word-to-wordpress/index.html','utf8');
  assert.match(html,/id="word-image-handoff"[^>]*hidden/); assert.match(html,/Download before importing/); assert.match(html,/possible metadata and areas hidden by Word cropping/);
  const script=await readFile('public/word-image-kit.js','utf8'); assert.doesNotMatch(script,/fetch\(|XMLHttpRequest|createObjectURL|createElement|innerHTML|localStorage|sessionStorage/);
  const privacy=await readFile('public/privacy/index.html','utf8');
  assert.match(privacy,/Explicit Word image recovery/); assert.match(privacy,/Original images can include metadata and areas hidden by Word cropping/);
  assert.doesNotMatch(privacy,/never extracts image or embedded-file bytes/);
  const release=JSON.parse(await readFile('public/release.json','utf8'));
  assert.equal(release.wordImageRecovery,true); assert.equal(release.wordImagePlacementKit,true);
});
