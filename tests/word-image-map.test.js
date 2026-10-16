import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseWordImageMap, WORD_IMAGE_MAP_LIMIT } from '../public/word-image-map.js';
import { installWordImageMap } from '../public/word-image-map-controls.js';
import { describeWordImagePlaceholders, imageEditTarget } from '../public/image-editing.js';
import { prepareWordImageKit } from '../public/word-image-kit.js';
import { imageFixture } from './word-image-fixtures.js';
import { python } from './docx-fixtures.js';

const fixture = () => ({ format: 'drafttopage-word-images-v1', placementScope: 'This selected Word import before later edits or insertion into another article.', images: [{ name:'word-image-001.png', bytes:81, width:2, height:3, placeholders:['[Word image 1]','[Word image 3]'] }], placements: [
  { placeholder:'[Word image 1]', filename:'word-image-001.png', alt:'Fictional original alt', altTruncated:false, note:'Original image file.' },
  { placeholder:'[Word image 2]', filename:'', alt:'', altTruncated:false, note:'Not recovered.' },
  { placeholder:'[Word image 3]', filename:'word-image-001.png', alt:'Repeated image, different purpose', altTruncated:true, note:'Original image file.' }
] });
const encoded = value => new TextEncoder().encode(JSON.stringify(value));

test('Original Word labels and duplicate occurrences remain identifiable after earlier replacements', () => {
  const body = 'Earlier image replaced.\n\n日本語 😀 before \\[Word image 12\\] after.\r\n\r\n[Word image 3]\n\nCombined [Word image 12] ending.\n\n[Image or object omitted from Word document]';
  const rows = describeWordImagePlaceholders(body);
  assert.deepEqual(rows.map(({label,occurrence,count,line})=>({label,occurrence,count,line})), [
    {label:'[Word image 12]',occurrence:1,count:2,line:3}, {label:'[Word image 3]',occurrence:1,count:1,line:5},
    {label:'[Word image 12]',occurrence:2,count:2,line:7}, {label:'[Image or object omitted from Word document]',occurrence:1,count:1,line:9}
  ]);
  assert.equal(rows[0].context,'日本語 😀 before \\[Word image 12\\] after.');
  assert.equal(body.slice(rows[2].start,rows[2].end),'[Word image 12]');
  const long=describeWordImagePlaceholders('😀'.repeat(100)+'[Word image 7]'+'😀'.repeat(100))[0];
  assert.equal(Array.from(long.context).length,104); assert.doesNotMatch(long.context,/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/);
});
test('Existing actual image packages parse without changing their format or deduplicated filenames', async () => {
  const {bytes,candidate}=imageFixture({ids:['one','one']});
  const kit=await prepareWordImageKit(bytes,candidate);
  const raw=python('import sys,json,io,zipfile\nz=zipfile.ZipFile(io.BytesIO(bytes(json.load(sys.stdin))))\nprint(json.dumps(z.read("image-map.json").decode("utf-8")))',Array.from(kit.bytes));
  const map=parseWordImageMap(raw); assert.equal(map.placements.length,2);
  assert.equal(map.placements[1].filename,'word-image-001.png');assert.equal(map.placements[1].alt,'Fictional image 2');
  assert.match(map.scope,/before later edits/);
});
test('Map parsing preserves inert Unicode, missing files, empty alt and shortened-alt warnings', () => {
  const value=fixture();value.placements[0].alt='<img src=x> 日本語 😀';
  const result=parseWordImageMap(encoded(value));assert.equal(result.placements[0].alt,value.placements[0].alt);
  assert.equal(result.placements[1].filename,'');assert.equal(result.placements[1].alt,'');assert.equal(result.placements[2].altTruncated,true);
  value.placements[0].alt='Changed';assert.notEqual(result.placements[0].alt,'Changed');
});
test('Malformed, oversized and non-UTF-8 maps reject in full', () => {
  for(const raw of [null,{},'not json','{}','\0',new Uint8Array([0xff]),' '.repeat(WORD_IMAGE_MAP_LIMIT+1),'日'.repeat(WORD_IMAGE_MAP_LIMIT/2),new Uint8Array(WORD_IMAGE_MAP_LIMIT+1)])assert.throws(()=>parseWordImageMap(raw),/intact image-map/);
});
test('Unknown fields, unsafe names, duplicate or inconsistent mappings and invalid budgets reject', () => {
  const changes=[
    v=>v.format='other', v=>v.sourceNotes='PRIVATE', v=>v.images[0].name='../image.png', v=>v.placements[0].filename='https://example.com/image.png',
    v=>v.placements[0].filename='word-image-009.png',v=>v.placements.push({...v.placements[0]}),v=>v.images.push({...v.images[0]}),
    v=>v.images[0].placeholders.push('[Word image 2]'),v=>v.images[0].placeholders.pop(),v=>v.images[0].placeholders[1]='[Word image 201]',
    v=>v.images[0].width=30000,v=>v.images[0].height=0,v=>v.images[0].width=1.5,v=>v.images[0].bytes=4*1024*1024+1,
    v=>v.placements[0].alt='x'.repeat(501),v=>v.placements[0].alt='a\nb',v=>v.placements[0].altTruncated='yes',v=>v.placements[0].note='\0',
    v=>v.placementScope='',v=>v.images=[],v=>v.placements=[],v=>v.images[0].content='binary',v=>v.placements[0].caption='invented'
  ];
  for(const change of changes){const value=fixture();change(value);assert.throws(()=>parseWordImageMap(JSON.stringify(value)),/intact image-map/);}
});

class Control {
  constructor(){this.value='';this.checked=false;this.disabled=false;this.hidden=false;this.children=[];this.events=new Map();}
  addEventListener(type,fn){this.events.set(type,fn);}
  async fire(type){await this.events.get(type)?.();}
  replaceChildren(...items){this.children=items;this.value=items[0]?.value||'';}
}
async function controls(run){
  const prior=globalThis.document,map=new Map(),$=id=>{if(!map.has(id))map.set(id,new Control());return map.get(id);};
  globalThis.document={getElementById:$,createElement:()=>new Control()};
  let body='Before [Word image 1] after.',target=null,busy=false,work=0,alt='Pending alt',url='https://example.com/current.jpg',allow=true,reads=0,reader=null;
  const ui=installWordImageMap({getTarget:()=>target,getBody:()=>body,isBusy:()=>busy,workChanged:()=>work++,useAlt:value=>{if(!allow)return false;alt=value;return true;},read:async file=>{reads++;return reader?reader(file):encoded(fixture()).buffer;}});
  const load=async(value=fixture(),size=100)=>{$('image-map-file').files=[{size}];reader=async()=>encoded(value).buffer;await $('image-map-file').fire('change');};
  const choose=()=>{target=imageEditTarget(body,body.indexOf('[Word image 1]'),body.indexOf('[Word image 1]')+14);ui.refresh();};
  try{await run({$,ui,load,choose,alt:()=>alt,url:()=>url,work:()=>work,reads:()=>reads,setBusy:value=>{busy=value;ui.refresh();},setBody:value=>{body=value;ui.refresh();},allow:value=>{allow=value;},readWith:fn=>{reader=fn;}});}finally{globalThis.document=prior;}
}
test('Opening and inspecting a map never mutates image details; matching requires explicit comparison',()=>controls(async({$,ui,load,choose,alt,url})=>{
  await load();assert.equal($('image-map-review').hidden,false);assert.equal(alt(),'Pending alt');assert.equal(url(),'https://example.com/current.jpg');
  assert.equal($('image-map-use-alt').disabled,true);choose();assert.equal($('image-map-confirm').disabled,false);assert.equal($('image-map-use-alt').disabled,true);
  await $('image-map-use-alt').fire('click');assert.equal(alt(),'Pending alt');
  $('image-map-confirm').checked=true;await $('image-map-confirm').fire('change');await $('image-map-use-alt').fire('click');
  assert.equal(alt(),'Fictional original alt');assert.equal(url(),'https://example.com/current.jpg');assert.equal($('image-map-confirm').checked,false);assert.equal(ui.hasWork(),true);
}));
test('Unmatched entries, absent files, empty alt and changed article invalidate comparison',()=>controls(async({$,load,choose,setBody,alt})=>{
  await load();choose();$('image-map-confirm').checked=true;await $('image-map-confirm').fire('change');
  setBody('Changed [Word image 1] after.');assert.equal($('image-map-confirm').checked,false);assert.equal($('image-map-use-alt').disabled,true);
  choose();$('image-map-entry').value='[Word image 2]';await $('image-map-entry').fire('change');assert.equal($('image-map-alt').value,'');assert.match($('image-map-file-note').textContent,/NOT RECOVERED/);assert.equal($('image-map-confirm').disabled,true);
  $('image-map-entry').value='[Word image 3]';await $('image-map-entry').fire('change');assert.match($('image-map-file-note').textContent,/shortened/);assert.equal($('image-map-use-alt').disabled,true);assert.equal(alt(),'Pending alt');
}));
test('Busy and cancelled reuse keep all details; clearing purges the map only',()=>controls(async({$,ui,load,choose,setBusy,allow,alt,url})=>{
  await load();choose();$('image-map-confirm').checked=true;await $('image-map-confirm').fire('change');setBusy(true);await $('image-map-use-alt').fire('click');assert.equal(alt(),'Pending alt');
  setBusy(false);allow(false);await $('image-map-use-alt').fire('click');assert.equal(alt(),'Pending alt');
  await $('image-map-clear').fire('click');assert.equal(ui.hasWork(),false);assert.equal($('image-map-alt').value,'');assert.equal($('image-map-scope').textContent,'');assert.equal($('image-map-entry').children.length,0);assert.equal(alt(),'Pending alt');assert.equal(url(),'https://example.com/current.jpg');
}));
test('File size, malformed maps, rejected reads and cancelled in-flight reads preserve writing',()=>controls(async({$,ui,load,reads,readWith,alt})=>{
  await load(fixture(),WORD_IMAGE_MAP_LIMIT+1);assert.equal(reads(),0);assert.match($('image-map-status').textContent,/512 KiB/);
  await load({});assert.equal($('image-map-review').hidden,true);assert.equal(ui.hasWork(),false);
  let finish;readWith(()=>new Promise(resolve=>{finish=resolve;}));$('image-map-file').files=[{size:100}];const pending=$('image-map-file').fire('change');
  assert.equal(ui.hasWork(),true);ui.clear();finish(encoded(fixture()).buffer);await pending;assert.equal(ui.hasWork(),false);assert.equal($('image-map-review').hidden,true);assert.equal($('image-map-alt').value,'');
  readWith(()=>Promise.reject(Error('Read failed.')));$('image-map-file').files=[{size:100}];await $('image-map-file').fire('change');assert.equal(ui.hasWork(),false);assert.equal(alt(),'Pending alt');assert.match($('image-map-status').textContent,/Read failed/);
}));
test('Map UI is local and explicit, and has no added persistence, image rendering or network access',async()=>{
  const html=await readFile('scripts/image-editor.html.inc','utf8');
  for(const id of ['image-map-file','image-map-entry','image-map-alt','image-map-confirm','image-map-use-alt','image-placeholder-context','image-target-context'])assert.match(html,new RegExp('id="'+id+'"'));
  assert.match(html,/excluded from backups, browser recovery, collections, and exports/);assert.match(html,/metadata and areas hidden by Word cropping/);
  for(const path of ['public/word-image-map.js','public/word-image-map-controls.js'])assert.doesNotMatch(await readFile(path,'utf8'),/fetch\(|XMLHttpRequest|localStorage|sessionStorage|innerHTML|createObjectURL|console\./);
});
