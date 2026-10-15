import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { inspectDocxArchive, readDocxXML, MAX_DOCX_BYTES } from '../public/docx-archive.js';
import { parseWordXML, wordTreesToMarkdown, WORD_NS } from '../public/docx-import.js';
import { createWordDocument } from '../public/word-export.js';
import { createWordPressArticle } from '../public/wordpress-export.js';
import { parseArticleImport } from '../public/article-import.js';
import { installArticleImport } from '../public/import-controls.js';
import { crc32 } from '../public/zip.js';

const W = WORD_NS, R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const xml = body => '<w:document xmlns:w="' + W + '" xmlns:r="' + R + '"><w:body>' + body + '</w:body></w:document>';
const run = (text, props = '') => '<w:r>' + (props ? '<w:rPr>' + props + '</w:rPr>' : '') + '<w:t>' + text + '</w:t></w:r>';
const para = (text, props = '') => '<w:p>' + (props ? '<w:pPr>' + props + '</w:pPr>' : '') + run(text) + '</w:p>';
const word = (tag, body) => '<w:' + tag + ' xmlns:w="' + W + '">' + body + '</w:' + tag + '>';
function fixture(body = para('Fictional writing'), more = {}) {
  const result = {
    '[Content_Types].xml': '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    '_rels/.rels': '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="main" Type="' + R + '/officeDocument" Target="word/document.xml"/></Relationships>',
    'word/document.xml': xml(body), ...more
  };
  if (!Object.hasOwn(more, 'word/_rels/document.xml.rels') && ['styles', 'numbering'].some(n => Object.hasOwn(more, 'word/' + n + '.xml'))) result['word/_rels/document.xml.rels'] = '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + ['styles', 'numbering'].filter(n => Object.hasOwn(more, 'word/' + n + '.xml')).map(n => '<Relationship Id="' + n + '" Type="' + R + '/' + n + '" Target="' + n + '.xml"/>').join('') + '</Relationships>';
  return result;
}
function python(code, input) {
  const result = spawnSync('python3', ['-c', code], { input: JSON.stringify(input), encoding: 'utf8', maxBuffer: 24 * 1024 * 1024 });
  assert.equal(result.status, 0, result.stderr); return JSON.parse(result.stdout);
}
function zip(parts = fixture(), stored = false) {
  return new Uint8Array(python('import sys,json,io,zipfile\nv=json.load(sys.stdin); b=io.BytesIO()\nwith zipfile.ZipFile(b,"w",compression=zipfile.ZIP_STORED if v["stored"] else zipfile.ZIP_DEFLATED) as z:\n for n,c in v["parts"].items(): z.writestr(n,c)\nprint(json.dumps(list(b.getvalue())))', { parts, stored }));
}
// Independent XML parser supplies namespace-aware trees for pure conversion tests.
function trees(parts) {
  const raw = python('import sys,json,xml.etree.ElementTree as E\ndef node(n):\n ns,name=n.tag[1:].split("}") if n.tag.startswith("{") else ("",n.tag)\n return {"ns":ns,"name":name,"attrs":n.attrib,"text":n.text or "","children":[{"node":node(c),"tail":c.tail or ""} for c in n]}\nprint(json.dumps({k:node(E.fromstring(v)) for k,v in json.load(sys.stdin).items()}))', parts);
  const text = value => ({ nodeType: 3, nodeValue: value, get textContent() { return value; }, childNodes: [] });
  function adapt(v) {
    const childNodes = [text(v.text)];
    for (const c of v.children) childNodes.push(adapt(c.node), text(c.tail));
    return { nodeType: 1, namespaceURI: v.ns, localName: v.name, childNodes,
      getAttribute: key => v.attrs[key] ?? null,
      getAttributeNS: (ns, key) => v.attrs['{' + ns + '}' + key] ?? null,
      get textContent() { return childNodes.map(n => n.textContent).join(''); } };
  }
  return new Map(Object.entries(raw).map(([key, value]) => [key, adapt(value)]));
}
function create(name) {
  const attrs = {}, node = { nodeType: 1, localName: name, childNodes: [],
    setAttribute: (key, value) => { attrs[key] = value; }, getAttribute: key => attrs[key] ?? null, hasAttribute: key => Object.hasOwn(attrs, key),
    append(...nodes) { node.childNodes.push(...nodes.map(n => typeof n === 'string' ? { nodeType: 3, nodeValue: n, childNodes: [] } : n)); } };
  return node;
}
const convert = (parts, options) => wordTreesToMarkdown(trees(parts), options, create);
const numbering = (format = 'decimal', extra = '') => word('numbering', '<w:abstractNum w:abstractNumId="0">' + [0, 1, 2, 3, 4, 5].map(i => '<w:lvl w:ilvl="' + i + '"><w:start w:val="4"/><w:numFmt w:val="' + format + '"/><w:lvlText w:val="%' + (i + 1) + '."/>' + extra + '</w:lvl>').join('') + '</w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>');
const item = (text, level = 0) => para(text, '<w:numPr><w:ilvl w:val="' + level + '"/><w:numId w:val="1"/></w:numPr>');

test('Stored and deflated Word packages read only the exact known XML parts', async () => {
  const parts = fixture(undefined, { 'word/media/picture.png': 'NOT XML OR A RESOURCE REQUEST', 'docProps/core.xml': 'PRIVATE_METADATA_SENTINEL' });
  for (const stored of [true, false]) {
    const archive = zip(parts, stored), read = await readDocxXML(archive);
    assert.deepEqual(Object.fromEntries(read), fixture()); assert.equal(inspectDocxArchive(archive).entries.length, 5);
    assert.equal([...read.values()].join('').includes('PRIVATE_METADATA_SENTINEL'), false);
  }
});
test('Archive signatures, traversal, duplicate names, encryption, methods, offsets and ZIP64 fail closed', () => {
  for (const name of ['../bad', '/bad', 'word/../bad', 'word\\bad', 'word/%62ad', 'word//bad']) assert.throws(() => inspectDocxArchive(zip(fixture(undefined, { [name]: '' }))));
  assert.throws(() => inspectDocxArchive(zip(fixture(undefined, { 'WORD/DOCUMENT.XML': 'duplicate' }))));
  assert.throws(() => inspectDocxArchive(zip(fixture(undefined, { 'word/vbaProject.bin': 'macro' }))), /Macro/);
  const original = zip(fixture(), true), entries = inspectDocxArchive(original).entries;
  const directory = new DataView(original.buffer).getUint32(original.length - 6, true);
  for (const [at, value, width] of [[0, 0, 4], [directory + 8, 1, 2], [directory + 10, 99, 2], [directory + 42, 1, 4], [directory + 24, 0xffffffff, 4], [original.length - 18, 1, 2]]) {
    const bad = original.slice(), v = new DataView(bad.buffer); width === 2 ? v.setUint16(at, value, true) : v.setUint32(at, value, true);
    assert.throws(() => inspectDocxArchive(bad));
  }
  assert.ok(entries.every(e => e.stop > e.offset));
});
test('Archive byte, expansion, entry, XML-part, and checksum bounds are enforced', async () => {
  assert.throws(() => inspectDocxArchive(new Uint8Array(MAX_DOCX_BYTES + 1)), /8 MiB/);
  assert.throws(() => inspectDocxArchive(zip(fixture('x'.repeat(2 * 1024 * 1024)))), /2 MiB/);
  assert.throws(() => inspectDocxArchive(zip(fixture(undefined, Object.fromEntries(Array.from({ length: 254 }, (_, i) => ['word/file' + i, '']))))));
  const original = zip(fixture(), true), directory = new DataView(original.buffer).getUint32(original.length - 6, true);
  const oversized = original.slice(), dv = new DataView(oversized.buffer); dv.setUint32(directory + 24, 33 * 1024 * 1024, true); dv.setUint16(directory + 10, 8, true);
  assert.throws(() => inspectDocxArchive(oversized), /32 MiB/);
  const corrupt = original.slice(); corrupt[inspectDocxArchive(corrupt).entries[2].start] ^= 1;
  await assert.rejects(readDocxXML(corrupt), /damaged/);
});
test('Actual deflate output cannot exceed a forged declared XML size', async () => {
  const bytes = zip(fixture(para('A'.repeat(100000)))), entries = inspectDocxArchive(bytes).entries;
  const target = entries[2], v = new DataView(bytes.buffer), directory = v.getUint32(bytes.length - 6, true);
  let p = directory; for (let i = 0; i < 2; i++) p += 46 + v.getUint16(p + 28, true) + v.getUint16(p + 30, true) + v.getUint16(p + 32, true);
  v.setUint32(p + 24, 1, true); v.setUint32(target.offset + 22, 1, true);
  await assert.rejects(readDocxXML(bytes), /damaged/);
});
test('Streaming ZIP data descriptors and archive comments are handled without including descriptor bytes in XML', async () => {
  const bytes = new Uint8Array(python('import sys,json,io,zipfile\nclass Sink(io.BytesIO):\n def seek(self,*a): raise OSError("not seekable")\nb=Sink()\nwith zipfile.ZipFile(b,"w",compression=zipfile.ZIP_DEFLATED) as z:\n for n,c in json.load(sys.stdin).items(): z.writestr(n,c)\n z.comment=b"Fictional archive comment"\nprint(json.dumps(list(b.getvalue())))', fixture()));
  assert.equal(new DataView(bytes.buffer).getUint16(6, true) & 8, 8);
  assert.deepEqual(Object.fromEntries(await readDocxXML(bytes)), fixture());
  await assert.rejects(readDocxXML(bytes.subarray(0, bytes.length - 1)), /damaged/);
});
test('DOCTYPE, entities, invalid UTF-8, and control characters never reach XML parsing', async () => {
  for (const body of ['<!DOCTYPE document [<!ENTITY x "text">]>', '<!ENTITY x SYSTEM "https://example.com/">', 'bad\u0000text']) await assert.rejects(readDocxXML(zip(fixture(body))), /damaged/);
  for (const source of ['<!DOCTYPE x>', '<!ENTITY x>', 'bad\u0000text', 'x'.repeat(2097153)]) assert.throws(() => parseWordXML(source), /Unsupported Word XML/);
  const bytes = zip(fixture(), true), entry = inspectDocxArchive(bytes).entries[0], view = new DataView(bytes.buffer);
  bytes[entry.start] = 0xff;
  const crc = crc32(bytes.subarray(entry.start, entry.start + entry.length)), directory = view.getUint32(bytes.length - 6, true);
  view.setUint32(entry.offset + 14, crc, true); view.setUint32(directory + 16, crc, true);
  await assert.rejects(readDocxXML(bytes), /UTF-8/);
});
test('Paragraphs, heading styles, emphasis, escaped punctuation, tabs and breaks convert inertly', () => {
  const styles = word('styles', '<w:style w:styleId="Heading2"><w:pPr><w:outlineLvl w:val="1"/></w:pPr></w:style>');
  const parts = fixture(para('A title', '<w:outlineLvl w:val="0"/>') + para('A section', '<w:pStyle w:val="Heading2"/>') + '<w:p>' + run('bold', '<w:b/>') + run(' and ') + run('italic', '<w:i/>') + run(' &lt;img src="https://example.com/x"&gt; [literal]') + '<w:r><w:tab/><w:br/>' + '<w:t>End.</w:t></w:r></w:p>', { 'word/styles.xml': styles });
  const result = convert(parts), imported = parseArticleImport(result.markdown);
  assert.equal(imported.draft.title, 'A title'); assert.match(imported.draft.body, /^## A section/);
  assert.match(result.markdown, /\*\*bold\*\* and \*italic\*/);
  const html = createWordPressArticle(imported.draft).html;
  assert.match(html, /&lt;img src=/); assert.doesNotMatch(html, /<img/); assert.match(result.warnings.join(' '), /Tabs/);
});
test('Inherited paragraph/run styles and explicit off values respect hidden text', () => {
  const styles = word('styles', '<w:style w:styleId="Base"><w:rPr><w:b/></w:rPr></w:style><w:style w:styleId="Child"><w:basedOn w:val="Base"/></w:style><w:style w:styleId="Hidden"><w:rPr><w:vanish/></w:rPr></w:style>');
  const result = convert(fixture('<w:p><w:pPr><w:pStyle w:val="Child"/></w:pPr>' + run('bold') + run(' plain', '<w:b w:val="0"/>') + run('PRIVATE_HIDDEN', '<w:rStyle w:val="Hidden"/>') + '</w:p>', { 'word/styles.xml': styles }));
  assert.equal(result.markdown, '**bold** plain'); assert.match(result.warnings.join(' '), /hidden text/);
  const cyclic = styles.replace('<w:style w:styleId="Base">', '<w:style w:styleId="Base"><w:basedOn w:val="Child"/>');
  assert.throws(() => convert(fixture(para('body', '<w:pStyle w:val="Child"/>'), { 'word/styles.xml': cyclic })), /Cyclic/);
});
test('External web links survive while unsafe/internal links retain only labels', () => {
  const rels = '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + [['safe', 'https://example.com/a?x=1&amp;y=2'], ['unsafe', 'javascript:alert(1)']].map(([id, url]) => '<Relationship Id="' + id + '" Type="' + R + '/hyperlink" TargetMode="External" Target="' + url + '"/>').join('') + '</Relationships>';
  const body = '<w:p>' + ['safe', 'unsafe', 'missing'].map(id => '<w:hyperlink r:id="' + id + '">' + run(id) + '</w:hyperlink>').join('') + '</w:p>';
  const result = convert(fixture(body, { 'word/_rels/document.xml.rels': rels }));
  assert.match(result.markdown, /\[safe\]\(https:\/\/example.com\/a\?x=1&y=2\)/); assert.doesNotMatch(result.markdown, /javascript/); assert.match(result.markdown, /unsafemissing/);
});
test('Nested decimal lists preserve starts, parent restarts, and continuation across prose', () => {
  const result = convert(fixture(item('First') + item('Child', 1) + item('Second') + para('Interlude') + item('Third'), { 'word/numbering.xml': numbering() }));
  assert.equal(result.markdown, '4. First\n  4. Child\n5. Second\n\nInterlude\n\n6. Third');
  assert.match(createWordPressArticle({ body: result.markdown }).html, /<ol[^>]* start="6"/);
  assert.equal(convert(fixture(item('Bullet'), { 'word/numbering.xml': numbering('bullet') })).markdown, '- Bullet');
});
test('Lettered/custom lists, missing levels, deep lists, and unsupported restarts are rejected', () => {
  for (const [body, num] of [[item('x'), numbering('lowerLetter')], [item('x', 1), numbering()], [item('x', 6), numbering()], [item('x'), numbering('decimal', '<w:lvlRestart w:val="0"/>')], [item('x'), numbering().replace('%1.', '%1)')]]) assert.throws(() => convert(fixture(body, { 'word/numbering.xml': num })), /lists|list|numbering/i);
});
const cell = (text, prop = '') => '<w:tc>' + (prop ? '<w:tcPr>' + prop + '</w:tcPr>' : '') + para(text) + '</w:tc>';
const table = header => '<w:tbl><w:tr>' + (header ? '<w:trPr><w:tblHeader/></w:trPr>' : '') + cell('Name') + cell('Value') + '</w:tr><w:tr>' + cell('A') + cell('2') + '</w:tr></w:tbl>';
test('Marked table headers work; unmarked headers require an explicit choice', () => {
  assert.match(convert(fixture(table(true))).markdown, /\| Name \| Value \|\n\| --- \| --- \|\n\| A \| 2 \|/);
  assert.throws(() => convert(fixture(table(false))), /no explicit header/);
  assert.match(convert(fixture(table(false)), { firstRowHeaders: true }).warnings.join(' '), /explicit choice/);
  for (const bad of [table(true).replace(cell('A'), cell('A', '<w:gridSpan w:val="2"/>')), table(true).replace(cell('A'), cell('A', '<w:vMerge/>')), table(true).replace(cell('2'), ''), table(true).replace(para('A'), table(true))]) assert.throws(() => convert(fixture(bad)), /Merged|same|Nested/);
});
test('Images become visible placeholders; critical unsupported content and tracked changes reject', () => {
  const result = convert(fixture('<w:p>' + run('Before ') + '<w:r><w:drawing/></w:r>' + run(' after') + '</w:p>'));
  assert.match(result.markdown, /Image or object omitted/); assert.match(result.warnings.join(' '), /No image or external resource/);
  for (const content of ['<w:ins>' + run('x') + '</w:ins>', '<w:r><w:rPr><w:rPrChange/></w:rPr><w:t>x</w:t></w:r>', '<w:r><w:footnoteReference w:id="2"/></w:r>', '<w:r><w:fldChar w:fldCharType="begin"/></w:r>', '<w:sdt/>', '<m:oMath xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"/>']) assert.throws(() => convert(fixture('<w:p>' + content + '</w:p>')), /tracked changes|Fields|Unsupported|non-text/);
});
test('Main-part/type confusion, duplicate relationships and alternate linked parts reject', () => {
  const base = fixture();
  for (const parts of [{ ...base, '[Content_Types].xml': base['[Content_Types].xml'].replace('wordprocessingml.document.main', 'wordprocessingml.template.main') }, { ...base, '_rels/.rels': base['_rels/.rels'].replace('Target="word/document.xml"', 'Target="https://example.com/" TargetMode="External"') }, { ...base, 'word/_rels/document.xml.rels': '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="x" Type="' + R + '/styles" Target="elsewhere.xml"/></Relationships>' }]) assert.throws(() => convert(parts), /plain|main part|styles parts/);
});
test('A generated Word file round-trips supported article structure without workspace fields', async () => {
  const original = { title: 'Fictional title', body: '## A section\n\nSome **bold** and *italic* text.\n\n4. First\n  - Nested\n5. Second\n\n| Name | Value |\n| --- | --- |\n| A | 2 |', questions: ['PRIVATE_REVIEW'], excerpt: 'PRIVATE_METADATA' };
  const read = await readDocxXML(createWordDocument(original, { includeTitle: true }));
  const converted = convert(Object.fromEntries(read));
  const imported = parseArticleImport(converted.markdown);
  assert.equal(imported.draft.title, original.title);
  const html = createWordPressArticle(imported.draft).html;
  for (const match of [/<h2[^>]*><strong>A section<\/strong><\/h2>/, /<strong>bold<\/strong>/, /<em>italic<\/em>/, /<ol[^>]* start="4"/, /<th[^>]*><strong>Name<\/strong><\/th>/]) assert.match(html, match);
  assert.doesNotMatch(converted.markdown, /PRIVATE_/);
});

async function withUI(run) {
  const prior = { document: globalThis.document, DOMParser: globalThis.DOMParser, confirm: globalThis.confirm };
  const nodes = new Map(); let approved = false, busy = false, fail = false, message = ''; const applied = [];
  function control(name = 'div') {
    const node = Object.assign(create(name), { value: '', checked: false, disabled: false, hidden: false, textContent: '', events: new Map(), selectionStart: 0, selectionEnd: 0 });
    node.addEventListener = (type, fn) => { if (!node.events.has(type)) node.events.set(type, []); node.events.get(type).push(fn); };
    node.fire = async (type = 'click') => { for (const fn of node.events.get(type) || []) await fn({ type }); };
    node.replaceChildren = (...children) => { node.childNodes = []; node.append(...children); };
    node.focus = () => {}; node.select = () => {};
    return node;
  }
  const $ = id => { if (!nodes.has(id)) nodes.set(id, control()); return nodes.get(id); };
  globalThis.document = { getElementById: $, createElement: control, createDocumentFragment: () => control(), createTextNode: nodeValue => ({ nodeType: 3, nodeValue, childNodes: [] }) };
  globalThis.DOMParser = class { parseFromString(source) { return { documentElement: trees({ x: source }).get('x'), getElementsByTagName: () => [] }; } };
  globalThis.confirm = () => approved;
  $('import-format').value = 'auto';
  const ui = installArticleImport({ hasArticle: () => true, isBusy: () => busy, busyChanged: () => {}, report: text => { message = text; }, apply: draft => { if (fail) throw new Error('Checkpoint refused'); applied.push(draft); } });
  const file = async bytes => { $('import-file').files = [{ name: 'fictional.docx', size: bytes.length, arrayBuffer: async () => bytes.buffer }]; await $('import-file').fire('change'); };
  try { await run({ $, ui, applied, file, message: () => message, confirm: value => { approved = value; }, busy: value => { busy = value; }, fail: value => { fail = value; } }); }
  finally { Object.assign(globalThis, prior); }
}
test('Word file selection stages only, acknowledgement gates apply, cancellation and checkpoint failure retain the preview', () => withUI(async ({ $, ui, applied, file, confirm, fail, message }) => {
  await file(zip()); assert.equal($('import-preview').hidden, false); assert.match($('import-summary').textContent, /Word document/);
  assert.equal($('import-text').value, ''); assert.equal($('apply-import').disabled, true); assert.equal(applied.length, 0);
  await $('apply-import').fire(); assert.equal(applied.length, 0);
  $('import-changes-ok').checked = true; await $('import-changes-ok').fire('change'); assert.equal($('apply-import').disabled, false);
  await $('apply-import').fire(); assert.match(message(), /cancelled/); assert.equal(ui.pending(), true);
  confirm(true); fail(true); await $('apply-import').fire(); assert.match(message(), /Checkpoint refused/); assert.equal(ui.pending(), true);
  fail(false); await $('apply-import').fire(); assert.equal(applied.length, 1); assert.equal(applied[0].body, 'Fictional writing');
  assert.equal(ui.pending(), false); assert.equal($('import-file-status').textContent, ''); assert.equal($('import-reading-preview').childNodes.length, 0);
}));
test('An unmarked Word table can be previewed again from retained bytes; changes clear acknowledgement', () => withUI(async ({ $, ui, applied, file, confirm, message }) => {
  await file(zip(fixture(table(false)))); assert.match(message(), /no explicit header/); assert.equal(ui.pending(), true); assert.equal(applied.length, 0);
  $('import-first-row-headers').checked = true; await $('import-first-row-headers').fire('change'); await $('preview-import').fire();
  assert.equal($('import-preview').hidden, false); assert.equal($('apply-import').disabled, true);
  $('import-changes-ok').checked = true; await $('import-changes-ok').fire('change');
  $('import-first-row-headers').checked = false; await $('import-first-row-headers').fire('change');
  assert.equal($('import-changes-ok').checked, false); assert.equal($('import-preview').hidden, true);
  await $('cancel-import').fire(); assert.equal(ui.pending(), false); assert.equal($('import-file-status').textContent, '');
  confirm(true); await $('apply-import').fire(); assert.equal(applied.length, 0);
}));
test('Busy and oversized Word reads cannot replace writing; changing text purges a pending Word file', () => withUI(async ({ $, ui, applied, file, busy }) => {
  busy(true); await file(zip()); assert.equal(ui.pending(), false); assert.equal(applied.length, 0);
  busy(false); let read = false;
  $('import-file').files = [{ name: 'large.docx', size: MAX_DOCX_BYTES + 1, arrayBuffer: async () => { read = true; } }];
  await $('import-file').fire('change'); assert.equal(read, false); assert.equal(ui.pending(), false);
  await file(zip()); $('import-text').value = 'Other article'; await $('import-text').fire('input');
  assert.equal($('import-file-status').textContent, ''); await $('preview-import').fire(); assert.match($('import-summary').textContent, /Markdown article/);
}));
test('All shared desks offer local Word import with explicit acknowledgement and unchanged private formats', async () => {
  for (const route of ['write', 'markdown-to-wordpress', 'markdown-to-html', 'markdown-to-word']) {
    const page = await readFile('public/' + route + '/index.html', 'utf8');
    assert.match(page, /accept="\.docx,/); assert.match(page, /id="import-file-status"/); assert.match(page, /8 MiB/); assert.match(page, /id="import-changes-ok"/); assert.doesNotMatch(page, /Direct .docx import is not supported/);
  }
  const release = JSON.parse(await readFile('public/release.json', 'utf8')); assert.equal(release.wordDocumentImport, true);
  const source = await readFile('public/docx-import.js', 'utf8'); assert.doesNotMatch(source, /\bfetch\s*\(|innerHTML|localStorage|sessionStorage|indexedDB/);
});
