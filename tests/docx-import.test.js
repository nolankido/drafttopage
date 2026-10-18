import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { inspectDocxArchive, readDocxXML, MAX_DOCX_BYTES } from '../public/docx-archive.js';
import { parseWordXML, wordTreesToMarkdown, WORD_NS } from '../public/docx-import.js';
import { createWordDocument } from '../public/word-export.js';
import { createWordPressArticle } from '../public/wordpress-export.js';
import { parseArticleImport } from '../public/article-import.js';
import { installArticleImport } from '../public/import-controls.js';
import { crc32 } from '../public/zip.js';
import { imageFixture } from './word-image-fixtures.js';
import { notesFixture, note as wordNote, ref as noteReference } from './word-note-fixtures.js';
import { commentFixture } from './word-comment-fixtures.js';
import { revisionFixture, proposedBody, previousBody } from './word-revision-fixtures.js';

import { W, R, xml, run, para, word, fixture, python, zip, trees, create, convert, numbering, item } from './docx-fixtures.js';

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
test('Word style bold and italic toggles cancel inherited formatting, direct runs remain absolute', () => {
  const styles = word('styles', [
    '<w:style w:styleId="BoldBase"><w:rPr><w:b/><w:i/></w:rPr></w:style>',
    '<w:style w:styleId="PlainChild"><w:basedOn w:val="BoldBase"/><w:rPr><w:b/><w:i/></w:rPr></w:style>',
    '<w:style w:styleId="ToggleBack"><w:basedOn w:val="PlainChild"/><w:rPr><w:b/><w:i/></w:rPr></w:style>',
    '<w:style w:styleId="RunOff"><w:rPr><w:b w:val="0"/><w:i w:val="0"/></w:rPr></w:style>',
    '<w:style w:styleId="RunOn"><w:rPr><w:b/><w:i/></w:rPr></w:style>'
  ].join(''));
  const body = '<w:p><w:pPr><w:pStyle w:val="PlainChild"/></w:pPr>'
    + run('plain') + run(' bold', '<w:rStyle w:val="RunOn"/>')
    + run(' direct', '<w:rStyle w:val="RunOn"/><w:b w:val="0"/><w:i w:val="0"/>')
    + '</w:p>'
    + para('formatted', '<w:pStyle w:val="ToggleBack"/>')
    + '<w:p><w:pPr><w:pStyle w:val="BoldBase"/></w:pPr>' + run('normal', '<w:rStyle w:val="RunOn"/>') + run(' explicit bold', '<w:b/>') + '</w:p>';
  const result = convert(fixture(body, { 'word/styles.xml': styles }));
  assert.equal(result.markdown, 'plain ***bold*** direct\n\n***formatted***\n\nnormal ***explicit bold***');
});
test('Word document defaults are absolute and a second inherited bold style cancels the first', () => {
  const styles = word('styles',
    '<w:docDefaults><w:rPrDefault><w:rPr><w:b/><w:i/></w:rPr></w:rPrDefault></w:docDefaults>'
    + '<w:style w:styleId="Cancel"><w:rPr><w:b/><w:i/></w:rPr></w:style>'
    + '<w:style w:styleId="Restore"><w:basedOn w:val="Cancel"/><w:rPr><w:b/><w:i/></w:rPr></w:style>');
  const result = convert(fixture(
    para('not bold', '<w:pStyle w:val="Cancel"/>') + para('bold again', '<w:pStyle w:val="Restore"/>'),
    { 'word/styles.xml': styles }));
  assert.equal(result.markdown, 'not bold\n\n***bold again***');
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
  assert.match(result.markdown, /Word image 1/); assert.match(result.warnings.join(' '), /No image or external resource/);
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

async function withUI(run, options = {}) {
  const prior = { document: globalThis.document, DOMParser: globalThis.DOMParser, confirm: globalThis.confirm };
  const nodes = new Map(); let approved = false, busy = false, fail = false, message = ''; const applied = [], intents = [];
  function control(name = 'div') {
    const node = Object.assign(create(name), { tagName: name.toUpperCase(), parentElement: null, value: '', checked: false, disabled: false, hidden: false, textContent: '', events: new Map(), selectionStart: 0, selectionEnd: 0 });
    if (name === 'details') node.open = false;
    node.addEventListener = (type, fn) => { if (!node.events.has(type)) node.events.set(type, []); node.events.get(type).push(fn); };
    node.fire = async (type = 'click') => { for (const fn of node.events.get(type) || []) await fn({ type }); };
    node.replaceChildren = (...children) => { node.childNodes = []; node.append(...children); };
    node.focus = () => { node.focused = true; }; node.select = () => {};
    node.click = () => { node.clicked = (node.clicked || 0) + 1; if (node.failClick) throw new Error('Picker blocked'); };
    return node;
  }
  const tags = {
    'import-panel': 'details', 'import-fields': 'fieldset', 'import-file': 'input', 'import-file-status': 'p',
    'word-import-alternatives': 'details', 'import-text': 'textarea', 'import-format': 'select',
    'import-advanced-options': 'details', 'import-first-row-headers': 'input',
    'import-word-options': 'section', 'import-word-revisions': 'select',
    'import-preview': 'section', 'import-preview-heading': 'h2', 'import-reading-details': 'details',
    'import-reading-preview': 'div'
  };
  const $ = id => { if (!nodes.has(id)) nodes.set(id, control(tags[id] || 'div')); return nodes.get(id); };
  // The Word route puts its file control directly in the import fieldset and
  // copied-writing controls inside an additional disclosure. Shortcuts must
  // open these real ancestor paths before focusing or clicking the control.
  for (const [id, parentId] of [
    ['import-fields', 'import-panel'], ['import-file', 'import-fields'], ['import-file-status', 'import-fields'],
    ['word-import-alternatives', 'import-fields'], ['import-text', 'word-import-alternatives'], ['import-format', 'word-import-alternatives'],
    ['import-advanced-options', 'import-fields'], ['import-first-row-headers', 'import-advanced-options'],
    ['import-word-options', 'import-fields'], ['import-word-revisions', 'import-word-options'],
    ['import-preview', 'import-panel'], ['import-preview-heading', 'import-preview'],
    ['import-reading-details', 'import-preview'], ['import-reading-preview', 'import-reading-details']
  ]) {
    $(id).parentElement = $(parentId); $(parentId).append($(id));
  }
  globalThis.document = { getElementById: $, createElement: control, createDocumentFragment: () => control(), createTextNode: nodeValue => ({ nodeType: 3, nodeValue, childNodes: [] }) };
  globalThis.DOMParser = class { parseFromString(source) { return { documentElement: trees({ x: source }).get('x'), getElementsByTagName: () => [] }; } };
  globalThis.confirm = () => approved;
  $('import-format').value = 'auto';
  const ui = installArticleImport({ hasArticle: () => true, isBusy: () => busy, busyChanged: () => {}, report: text => { message = text; }, apply: (draft, intent) => { if (fail) throw new Error('Checkpoint refused'); applied.push(draft); intents.push(intent); }, ...options });
  const file = async bytes => { $('import-file').files = [{ name: 'fictional.docx', size: bytes.length, arrayBuffer: async () => bytes.buffer }]; await $('import-file').fire('change'); };
  try { await run({ $, ui, applied, intents, file, message: () => message, confirm: value => { approved = value; }, busy: value => { busy = value; }, fail: value => { fail = value; } }); }
  finally { Object.assign(globalThis, prior); }
}
for (const [action, continueToExport] of [['apply-import', false], ['apply-import-and-continue', true]]) {
  test('Word ' + (continueToExport ? 'continuation' : 'editing') + ' preserves review gates and failed imports, then clears retained source before any continuation', async () => {
    const continued = []; let readState;
    const expected = { title: '', excerpt: '', description: '', slug: 'fictional', body: 'Fictional writing', questions: [] };
    await withUI(async ({ $, ui, applied, intents, file, confirm, fail, busy, message }) => {
      readState = () => ({ pending: ui.pending(), text: $('import-text').value, status: $('import-file-status').textContent, preview: $('import-body-preview').value, wordOptionsHidden: $('import-word-options').hidden, applied: structuredClone(applied) });
      await file(zip()); assert.equal($('import-preview').hidden, false); assert.match($('import-summary').textContent, /Word document/);
      assert.equal($('import-text').value, ''); assert.equal($(action).disabled, true); assert.equal(applied.length, 0);
      assert.equal($('apply-import-and-continue').hidden, false); assert.equal($('import-continue-help').hidden, false);
      await $(action).fire(); assert.equal(applied.length, 0); assert.deepEqual(continued, []);
      $('import-changes-ok').checked = true; await $('import-changes-ok').fire('change'); assert.equal($(action).disabled, false);
      busy(true); ui.updateBusy(); assert.equal($(action).disabled, true); await $(action).fire(); assert.equal(applied.length, 0); assert.deepEqual(continued, []);
      busy(false); ui.updateBusy(); assert.equal($(action).disabled, false);
      await $(action).fire(); assert.match(message(), /cancelled/); assert.equal(ui.pending(), true);
      assert.equal($('import-body-preview').value, expected.body); assert.equal($('import-changes-ok').checked, true); assert.deepEqual(continued, []);
      confirm(true); fail(true); await $(action).fire(); assert.match(message(), /Checkpoint refused/); assert.equal(ui.pending(), true);
      assert.equal($('import-body-preview').value, expected.body); assert.equal($('import-preview').hidden, false); assert.equal(applied.length, 0); assert.deepEqual(continued, []);
      fail(false); await $(action).fire(); assert.deepEqual(applied, [expected]); assert.deepEqual(intents, [{ continueToExport }]);
      assert.equal(ui.pending(), false); assert.equal($('import-file-status').textContent, ''); assert.equal($('import-reading-preview').childNodes.length, 0);
      assert.deepEqual(continued, continueToExport ? [{ pending: false, text: '', status: '', preview: '', wordOptionsHidden: true, applied: [expected] }] : []);
      await $(action).fire(); assert.equal(applied.length, 1); assert.equal(continued.length, Number(continueToExport));
    }, { continueToExport: () => continued.push(readState()) });
  });
}

test('Word notes remain staged with their conversion notices until acknowledgement and deliberate apply', () => withUI(async ({ $, ui, applied, file, confirm }) => {
  $('body').value = 'CURRENT ARTICLE';
  await file(zip(notesFixture()));
  assert.equal($('body').value, 'CURRENT ARTICLE'); assert.equal(applied.length, 0);
  assert.match($('import-body-preview').value, /Word footnote 1/); assert.match($('import-body-preview').value, /A source note/);
  const warnings = $('import-warnings').childNodes.map(node => node.textContent).join(' ');
  assert.match(warnings, /included in article exports/); assert.equal($('apply-import').disabled, true);
  await $('apply-import').fire(); assert.equal(applied.length, 0);
  $('import-changes-ok').checked = true; await $('import-changes-ok').fire('change'); confirm(true);
  await $('apply-import').fire(); assert.equal(applied.length, 1); assert.match(applied[0].body, /Imported Word footnotes/);
  assert.equal(ui.pending(), false); assert.equal($('import-body-preview').value, '');
}));

test('Word comment inclusion requires deliberate selection and renewed import acknowledgement, then purges temporary feedback', () => withUI(async ({ $, ui, applied, file, confirm }) => {
  await file(zip(commentFixture()));
  assert.equal($('word-comment-handoff').hidden,false);
  assert.equal($('word-comment-list').childNodes.length,0);
  $('import-changes-ok').checked=true;await $('import-changes-ok').fire('change');
  await $('prepare-word-comments').fire();
  assert.equal($('import-changes-ok').checked,false);assert.equal($('apply-import').disabled,true);
  assert.equal($('word-comment-list').childNodes.length,1);assert.doesNotMatch($('import-body-preview').value,/PRIVATE_COMMENT/);
  assert.match($('import-summary').textContent,/0 review question/);
  $('word-comments-include').checked=true;await $('word-comments-include').fire('change');
  assert.match($('import-summary').textContent,/1 review question/);await $('apply-import').fire();assert.equal(applied.length,0);
  $('import-changes-ok').checked=true;await $('import-changes-ok').fire('change');confirm(true);await $('apply-import').fire();
  assert.deepEqual(applied[0].questions,['Word comment ID 7\nPRIVATE_COMMENT: Check the source.']);
  assert.equal(applied[0].body,'Fictional article');assert.equal(ui.pending(),false);
  assert.equal($('word-comment-list').childNodes.length,0);assert.equal($('word-comments-include').checked,false);assert.equal($('word-comment-guidance').textContent,'');
}));

test('An unresolved Word note cannot replace current writing or leave a previously valid preview applicable', () => withUI(async ({ $, ui, applied, file, message }) => {
  $('body').value = 'CURRENT ARTICLE'; $('reviewed').checked = true;
  await file(zip(notesFixture()));
  const broken = notesFixture('<w:p>' + noteReference('footnote', 99) + '</w:p>', wordNote(7, para('An unrelated note')));
  await file(zip(broken));
  assert.equal($('body').value, 'CURRENT ARTICLE'); assert.equal($('reviewed').checked, true);
  assert.equal($('apply-import').disabled, true); assert.equal($('import-body-preview').value, '');
  assert.match(message(), /Unsupported Word notes/); await $('apply-import').fire(); assert.equal(applied.length, 0);
  assert.equal(ui.staged(), false);
}));

test('Explicit image preparation gates downloads, keeps import approval and purges files after apply', async () => {
  const downloads=[]; let calls=0;
  const prepared={bytes:new Uint8Array([1,2,3]),filename:'drafttopage-word-images.zip',images:[{name:'word-image-001.png',width:2,height:3,bytes:77,placeholders:['[Word image 1]']}],skipped:[]};
  await withUI(async ({$,ui,file,confirm,applied})=>{
    await file(imageFixture().bytes); assert.equal($('word-image-handoff').hidden,false); assert.equal(calls,0);
    $('import-changes-ok').checked=true; await $('import-changes-ok').fire('change');
    await $('download-word-images').fire(); assert.equal(downloads.length,0);
    await $('prepare-word-images').fire(); assert.equal(calls,1); assert.equal($('word-image-kit-review').hidden,false);
    assert.equal($('import-changes-ok').checked,true); assert.equal($('apply-import').disabled,true); assert.equal($('download-word-images').disabled,true);
    $('word-image-choice-kit').checked=true; await $('word-image-choice-kit').fire('change');
    assert.equal($('apply-import').disabled,true);
    await $('download-word-images').fire(); assert.equal(downloads.length,0);
    $('word-image-private-ok').checked=true; await $('word-image-private-ok').fire('change');
    await $('download-word-images').fire(); assert.equal(downloads.length,1); assert.equal(downloads[0][1],prepared.filename);
    assert.equal($('apply-import').disabled,true,'Download request alone cannot permit the import.');
    $('word-image-saved-ok').checked=true;await $('word-image-saved-ok').fire('change');
    assert.equal($('apply-import').disabled,false,'Confirmed saved ZIP now permits importing after review.');
    confirm(true); await $('apply-import').fire(); assert.equal(applied.length,1); assert.match(applied[0].body,/Word image 1/); assert.doesNotMatch(JSON.stringify(applied[0]),/image\/png|Uint8Array|wordImages|image-map/);
    assert.equal(ui.pending(),false); assert.equal($('word-image-handoff').hidden,true); assert.equal($('word-image-kit-files').childNodes.length,0); assert.equal($('word-image-private-ok').checked,false);
    await $('download-word-images').fire(); assert.equal(downloads.length,1);
  },{prepareImages:async()=>{calls++;return prepared;},download:(...args)=>downloads.push(args)});
});

test('An image preparation failure or discard leaves the import usable and current writing unchanged', async () => {
  let failing=true;
  await withUI(async ({$,ui,file,applied,message})=>{
    await file(imageFixture().bytes); const before=$('import-body-preview').value;
    $('import-changes-ok').checked=true; await $('import-changes-ok').fire('change');
    await $('prepare-word-images').fire(); assert.match(message(),/Image read failed/); assert.equal(ui.pending(),true); assert.equal(ui.reading(),false); assert.equal($('apply-import').disabled,true); assert.equal($('import-body-preview').value,before);
    $('word-image-choice-placeholders').checked=true; await $('word-image-choice-placeholders').fire('change');
    assert.equal($('apply-import').disabled,false,'Deliberate placeholder path remains usable after image recovery failure.');
    failing=false; await $('prepare-word-images').fire(); assert.equal($('word-image-kit-review').hidden,false); await $('discard-word-images').fire();
    assert.equal($('word-image-kit-review').hidden,true); assert.equal($('word-image-kit-files').childNodes.length,0); assert.equal($('import-body-preview').value,before); assert.equal($('import-changes-ok').checked,true); assert.equal(applied.length,0);
  },{prepareImages:async()=>{if(failing)throw new Error('Image read failed');return {bytes:new Uint8Array([1]),filename:'images.zip',images:[],skipped:[]};}});
});

test('Image preparation blocks conflicting operations and never installs a result for an obsolete preview', async () => {
  let finish;
  await withUI(async ({$,ui,file})=>{
    await file(imageFixture().bytes);
    const pending=$('prepare-word-images').fire(); assert.equal(ui.reading(),true); assert.equal($('apply-import').disabled,true); assert.equal($('cancel-import').disabled,true);
    // A programmatic source replacement must also invalidate an in-flight result.
    $('import-text').value='Replacement source'; await $('import-text').fire('input');
    finish({bytes:new Uint8Array([1]),filename:'old.zip',images:[],skipped:[]}); await pending;
    assert.equal(ui.reading(),false); assert.equal($('word-image-kit-review').hidden,true); assert.equal($('download-word-images').disabled,true); assert.equal($('import-body-preview').value,'');
  },{prepareImages:()=>new Promise(resolve=>{finish=resolve;})});
});
test('Word insertion uses retained conversion and exact append preview while keeping its acknowledgement gate', async () => {
  const inserted = [];
  await withUI(async ({ $, file, applied, ui }) => {
    $('body').value = 'Existing article.'; ui.openInsertion(); await file(zip());
    await $('preview-insertion').fire(); assert.equal($('import-insertion-after').value, '\n\nFictional writing');
    assert.equal($('apply-import').disabled, true); await $('apply-import').fire(); assert.equal(inserted.length, 0);
    $('import-changes-ok').checked = true; await $('import-changes-ok').fire('change'); assert.equal($('apply-import').disabled, false);
    await $('apply-import').fire(); assert.equal(inserted.length, 1); assert.equal(inserted[0].body, 'Existing article.\n\nFictional writing'); assert.equal(applied.length, 0); assert.equal(ui.pending(), false);
  }, { applyInsertion: plan => inserted.push(plan) });
});
test('An unmarked Word table can be previewed again from retained bytes; changes clear acknowledgement', () => withUI(async ({ $, ui, applied, file, confirm, message }) => {
  await file(zip(fixture(table(false)))); assert.match(message(), /no explicit header/); assert.equal(ui.pending(), true); assert.equal(applied.length, 0);
  assert.match($('import-file-status').textContent, /no explicit header/);
  assert.equal($('import-file-status').textContent, message()); assert.equal($('import-advanced-options').open, true);
  $('import-first-row-headers').checked = true; await $('import-first-row-headers').fire('change'); await $('preview-import').fire();
  assert.equal($('import-preview').hidden, false); assert.equal($('apply-import').disabled, true);
  assert.doesNotMatch($('import-file-status').textContent, /no explicit header/);
  assert.match($('import-file-status').textContent, /Preview ready for fictional\.docx/);
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
  assert.match($('import-file-status').textContent, /no larger than 8 MiB/);
  await file(zip()); $('import-text').value = 'Other article'; await $('import-text').fire('input');
  assert.equal($('import-file-status').textContent, ''); await $('preview-import').fire(); assert.match($('import-summary').textContent, /Markdown article/);
}));
test('Rejected Word bytes can be explicitly cleared without applying or replacing writing', () => withUI(async ({ $, ui, applied, file, message }) => {
  await file(zip(fixture('<w:ins>' + para('Unresolved change') + '</w:ins>')));
  assert.match(message(), /tracked changes/); assert.equal(ui.pending(), true); assert.equal($('import-preview').hidden, true);
  assert.match($('import-file-status').textContent, /tracked changes/); assert.equal($('import-file-status').textContent, message());
  assert.equal($('cancel-import').disabled, false); await $('cancel-import').fire();
  assert.equal(ui.pending(), false); assert.equal($('import-file-status').textContent, ''); assert.equal(applied.length, 0);
}));
test('Word revision choices require re-preview and fresh acknowledgement without replacing existing writing', () => withUI(async ({ $, ui, applied, file, confirm, message, fail }) => {
  $('body').value = 'CURRENT ARTICLE'; $('reviewed').checked = true;
  await file(zip(revisionFixture()));
  assert.match(message(), /Unresolved tracked changes/); assert.equal($('import-word-options').hidden, false); assert.equal($('import-word-revisions').value, 'require-clean');
  assert.equal($('body').value, 'CURRENT ARTICLE'); assert.equal($('reviewed').checked, true); assert.equal(ui.pending(), true);
  $('import-word-revisions').value = 'proposed'; await $('import-word-revisions').fire('change'); await $('preview-import').fire();
  assert.equal($('import-body-preview').value, proposedBody); assert.match($('word-revision-summary').textContent, /Proposed text selected/); assert.equal($('apply-import').disabled, true);
  assert.match($('import-changes-label').textContent, /proposed text version/);
  $('import-changes-ok').checked = true; await $('import-changes-ok').fire('change');
  $('import-word-revisions').value = 'previous'; await $('import-word-revisions').fire('change');
  assert.equal($('import-preview').hidden, true); assert.equal($('import-changes-ok').checked, false); await $('apply-import').fire(); assert.equal(applied.length, 0);
  await $('preview-import').fire(); assert.equal($('import-body-preview').value, previousBody); assert.match($('import-changes-label').textContent, /previous text version/);
  $('import-changes-ok').checked = true; await $('import-changes-ok').fire('change'); await $('apply-import').fire(); assert.equal(applied.length, 0); assert.match(message(), /cancelled/);
  confirm(true); fail(true); await $('apply-import').fire(); assert.equal(applied.length, 0); assert.match(message(), /Checkpoint refused/); assert.equal(ui.pending(), true);
  fail(false); await $('apply-import').fire(); assert.equal(applied[0].body, previousBody); assert.equal(ui.pending(), false);
  assert.equal($('import-word-revisions').value, 'require-clean'); assert.equal($('import-word-options').hidden, true); assert.equal($('word-revision-summary').textContent, '');
}));
for (const [action, continueToExport] of [['apply-import', false], ['apply-import-and-continue', true]]) {
  test('Word ' + (continueToExport ? 'continuation' : 'editing') + ' rechecks revision and table choices and requires review of the current text version', async () => {
    let continued = 0;
    await withUI(async ({ $, applied, intents, file, confirm }) => {
      await file(zip(revisionFixture())); $('import-word-revisions').value = 'proposed'; await $('preview-import').fire();
      assert.equal($('import-body-preview').value, proposedBody);
      $('import-changes-ok').checked = true; await $('import-changes-ok').fire('change'); confirm(true);
      $('import-word-revisions').value = 'previous'; await $(action).fire(); assert.equal(applied.length, 0); assert.equal(continued, 0);
      $('import-word-revisions').value = 'proposed'; $('import-first-row-headers').checked = true;
      await $(action).fire(); assert.equal(applied.length, 0); assert.equal(continued, 0);
      $('import-first-row-headers').checked = false; $('import-word-revisions').value = 'previous'; await $('import-word-revisions').fire('change');
      assert.equal($('import-preview').hidden, true); assert.equal($('import-changes-ok').checked, false);
      await $('preview-import').fire(); assert.equal($('import-body-preview').value, previousBody);
      await $(action).fire(); assert.equal(applied.length, 0); assert.equal(continued, 0);
      $('import-changes-ok').checked = true; await $('import-changes-ok').fire('change'); await $(action).fire();
      assert.equal(applied.length, 1); assert.equal(applied[0].body, previousBody); assert.deepEqual(intents, [{ continueToExport }]); assert.equal(continued, Number(continueToExport));
      await file(zip(revisionFixture())); assert.equal($('import-word-revisions').value, 'require-clean'); assert.equal($('import-preview').hidden, true); assert.equal($('import-changes-ok').checked, false);
    }, { continueToExport: () => { continued++; } });
  });
}
test('Word conversion ignores asynchronous results for changed versions or discarded source bytes', () => withUI(async ({ $, ui, applied, file, message }) => {
  await file(zip(revisionFixture()));
  const Parser = globalThis.DOMParser;
  for (const mutate of [() => { $('import-word-revisions').value = 'previous'; }, () => ui.clear()]) {
    if (!ui.pending()) await file(zip(revisionFixture()));
    $('import-word-revisions').value = 'proposed'; let changed = false;
    globalThis.DOMParser = class extends Parser { parseFromString(source) { const result = super.parseFromString(source); if (!changed) { changed = true; mutate(); } return result; } };
    await $('preview-import').fire(); globalThis.DOMParser = Parser;
    assert.equal($('import-preview').hidden, true); assert.equal($('import-body-preview').value, ''); assert.equal(applied.length, 0); assert.match(message(), /changed while reading/);
  }
}));
test('Opening or cancelling the Word picker preserves an acknowledged preview and its chosen format', () => withUI(async ({ $, ui, file, applied, busy, message }) => {
  await file(zip()); $('import-changes-ok').checked = true; await $('import-changes-ok').fire('change');
  const original = $('import-body-preview').value;
  ui.openWordFile(); assert.equal($('import-file').clicked, 1); assert.equal($('import-panel').open, true);
  assert.equal($('import-format').value, 'auto'); assert.equal($('import-body-preview').value, original);
  assert.equal($('import-changes-ok').checked, true); assert.equal($('apply-import').disabled, false); assert.equal(applied.length, 0);
  $('import-file').files = []; await $('import-file').fire('change');
  assert.equal($('import-preview').hidden, false); assert.equal($('import-body-preview').value, original); assert.equal($('import-changes-ok').checked, true);
  busy(true); ui.updateBusy(); assert.equal($('start-word-file').disabled, true); ui.openWordFile(); assert.equal($('import-file').clicked, 1);
  busy(false); ui.updateBusy(); assert.equal($('start-word-file').disabled, false);
  $('import-file').failClick = true; ui.openWordFile(); assert.equal($('import-file').focused, true); assert.match(message(), /file control/); assert.equal($('import-body-preview').value, original);
}));
test('File-first preview focuses its review heading and formatted import opens the alternate-source disclosure', () => withUI(async ({ $, ui, file, applied }) => {
  await file(zip()); assert.equal($('import-preview-heading').focused, true); assert.equal(applied.length, 0);
  ui.openFormatted(); assert.equal($('word-import-alternatives').open, true); assert.equal($('import-format').value, 'html'); assert.equal($('import-text').focused, true);
}, { focusPreview: true }));
test('The Word launch and continuation actions stay disabled while selected file bytes are being read', async () => {
  let continued = 0;
  await withUI(async ({ $, ui, applied }) => {
    const bytes = zip(); let complete;
    $('import-file').files = [{ name: 'fictional.docx', size: bytes.length, arrayBuffer: () => new Promise(resolve => { complete = resolve; }) }];
    const pending = $('import-file').fire('change');
    assert.equal(ui.reading(), true); assert.equal($('start-word-file').disabled, true); ui.openWordFile(); assert.equal($('import-file').clicked, undefined);
    assert.equal($('apply-import-and-continue').disabled, true); await $('apply-import-and-continue').fire(); assert.equal(applied.length, 0); assert.equal(continued, 0);
    complete(bytes.buffer); await pending; assert.equal(ui.reading(), false); assert.equal($('start-word-file').disabled, false);
    assert.equal($('apply-import-and-continue').disabled, true); await $('apply-import-and-continue').fire(); assert.equal(applied.length, 0); assert.equal(continued, 0);
  }, { continueToExport: () => { continued++; } });
});
test('All shared desks offer local Word import with explicit acknowledgement and unchanged private formats', async () => {
  for (const route of ['write', 'markdown-to-wordpress', 'word-to-wordpress', 'markdown-to-html', 'markdown-to-word']) {
    const page = await readFile('public/' + route + '/index.html', 'utf8');
    assert.match(page, /accept="\.docx,/); assert.match(page, /id="import-file-status"/); assert.match(page, /8 MiB/); assert.match(page, /id="import-changes-ok"/); assert.doesNotMatch(page, /Direct .docx import is not supported/);
  }
  const release = JSON.parse(await readFile('public/release.json', 'utf8')); assert.equal(release.wordDocumentImport, true);
  const source = await readFile('public/docx-import.js', 'utf8'); assert.doesNotMatch(source, /\bfetch\s*\(|innerHTML|localStorage|sessionStorage|indexedDB/);
});

test('Authored combined Word article preserves styled text, links, list, table and final sentence', async () => {
  const { readFileSync } = await import('node:fs');
  const authored = JSON.parse(readFileSync(new URL('./fixtures/documents/authored-cases.json', import.meta.url), 'utf8'));
  const spec = authored.cases.find(item => item.id === 'authored-compound-docx-article');
  const W = WORD_NS, R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const num = word('numbering',
    '<w:abstractNum w:abstractNumId="0">' +
    [0,1].map(i => '<w:lvl w:ilvl="' + i + '"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%' + (i + 1) + '."/></w:lvl>').join('') +
    '</w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>');
  const rels = '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="numbering" Type="' + R + '/numbering" Target="numbering.xml"/>' +
    '<Relationship Id="source1" Type="' + R + '/hyperlink" Target="https://example.com/solar-editorial?stage=review" TargetMode="External"/>' +
    '</Relationships>';
  const result = convert(fixture(spec.source, { 'word/numbering.xml': num, 'word/_rels/document.xml.rels': rels }));
  const imported = parseArticleImport(result.markdown);
  assert.equal(imported.draft.title, spec.expect.title);
  assert.match(imported.draft.body, /regular checks/);
  assert.match(imported.draft.body, /日本語/);
  assert.match(result.markdown, /\[fictional reference\]\(https:\/\/example\.com\/solar-editorial\?stage=review\)/);
  assert.match(imported.draft.body, /harbor 924\\\./);
  assert.match(result.markdown, /1\. Check the inverter/);
  const html = createWordPressArticle(imported.draft).html;
  assert.match(html, /<strong>regular checks<\/strong>/);
  assert.match(html, /fictional reference/);
  assert.match(html, /<th[^>]*>Metric<\/th>/);
  assert.match(html, /harbor 924\./);
});
