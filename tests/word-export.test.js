import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createWordDocument, wordDocumentParts, wordDocumentIssues, WORD_MIME } from '../public/word-export.js';
import { createZip, createWordZip, WORD_PART_NAMES } from '../public/zip.js';
import { installWordDocument } from '../public/word-controls.js';
import { QUICK_SAMPLE } from '../public/quick-sample.js';

function inspect(bytes) {
  return JSON.parse(execFileSync('python3', ['-c', String.raw`
import sys,io,json,zipfile,posixpath,xml.etree.ElementTree as E
z=zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())); assert z.testzip() is None
expected=['[Content_Types].xml','_rels/.rels','word/document.xml','word/_rels/document.xml.rels','word/styles.xml','word/numbering.xml']
assert z.namelist()==expected
for info in z.infolist():
 assert info.compress_type==0 and info.flag_bits&0x800 and info.date_time==(1980,1,1,0,0,0)
 E.fromstring(z.read(info.filename))
w='{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'; r='{http://schemas.openxmlformats.org/officeDocument/2006/relationships}'
d=E.fromstring(z.read('word/document.xml')); nums=E.fromstring(z.read('word/numbering.xml')); styles=E.fromstring(z.read('word/styles.xml'))
rels=E.fromstring(z.read('word/_rels/document.xml.rels')); links=[]
for rel in rels:
 if rel.get('TargetMode')=='External':
  assert rel.get('Type').endswith('/hyperlink') and rel.get('Target').startswith(('http://','https://'));links.append(rel.get('Target'))
 else: assert posixpath.normpath('word/'+rel.get('Target')) in expected
root=E.fromstring(z.read('_rels/.rels'));assert len(root)==1 and root[0].get('Target')=='word/document.xml'
ct=E.fromstring(z.read('[Content_Types].xml'));assert len(ct)==5
assert not d.findall('.//'+w+'fldChar') and not d.findall('.//'+w+'drawing') and not d.findall('.//'+w+'object')
ids={n.get(w+'numId') for n in nums.findall(w+'num')}
for n in d.findall('.//'+w+'numId'):assert n.get(w+'val') in ids
print(json.dumps({'names':z.namelist(),'texts':[x.text or '' for x in d.findall('.//'+w+'t')],'styles':[x.get(w+'val') for x in d.findall('.//'+w+'pStyle')],'levels':[x.get(w+'val') for x in d.findall('.//'+w+'ilvl')],'starts':[x.get(w+'val') for x in nums.findall('.//'+w+'startOverride')],'hyperlinks':links,'tables':len(d.findall('.//'+w+'tbl')),'headers':len(d.findall('.//'+w+'tblHeader')),'breaks':len(d.findall('.//'+w+'br')),'tabs':len(d.findall('.//'+w+'tab')),'bold':len(d.findall('.//'+w+'b')),'italic':len(d.findall('.//'+w+'i')),'widths':[[int(c.get(w+'w')) for c in grid] for grid in d.findall('.//'+w+'tblGrid')],'unsafeXML':False}))
`], { input: bytes, encoding: 'utf8', maxBuffer: 1024 * 1024 }));
}
test('Word output is deterministic, independently readable, and restricted to six safe package parts', () => {
  const bytes = createWordDocument(QUICK_SAMPLE);
  assert.deepEqual(bytes, createWordDocument(QUICK_SAMPLE));
  const parsed = inspect(bytes); assert.deepEqual(parsed.names, WORD_PART_NAMES);
  assert.ok(parsed.tables); assert.ok(parsed.levels.includes('2')); assert.equal(parsed.unsafeXML, false);
  assert.equal(WORD_MIME, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
});
test('Body-only Word needs no metadata, and title inclusion is explicit with native Title style', () => {
  const draft = { body: '# Body heading\n\nAn article.', title: 'Optional title' };
  assert.equal(Object.keys(wordDocumentIssues({ body: draft.body })).length, 0);
  const without = inspect(createWordDocument(draft)), withTitle = inspect(createWordDocument(draft, { includeTitle: true }));
  assert.ok(!without.texts.includes('Optional title')); assert.ok(withTitle.texts.includes('Optional title'));
  assert.equal(withTitle.styles[0], 'Title'); assert.ok(withTitle.styles.includes('Heading1'));
  assert.throws(() => createWordDocument({ body: 'Article' }, { includeTitle: true }), /title/);
  assert.throws(() => createWordDocument(draft, { includeTitle: 'false' }), /Choose whether/);
});
test('Headings, emphasis, quotes, code, authored line breaks, tabs, and Unicode become document content', () => {
  const draft = { body: '## Café notes\n\nA **bold** and *quiet* idea.\nNext line 😀.\n\n> A quoted thought\n\n```\n  code\tvalue\nKeep <script> literal\n```' };
  const parsed = inspect(createWordDocument(draft));
  assert.ok(parsed.styles.includes('Heading2')); assert.ok(parsed.styles.includes('Quote')); assert.ok(parsed.styles.includes('Code'));
  assert.equal(parsed.bold, 1); assert.equal(parsed.italic, 1); assert.equal(parsed.breaks, 2); assert.equal(parsed.tabs, 1);
  assert.ok(parsed.texts.includes('Keep <script> literal')); assert.ok(parsed.texts.join('').includes('😀'));
});
test('Links are deduplicated safe relationships; unsafe URLs and HTML remain editable text', () => {
  const parsed = inspect(createWordDocument({ body: '[One](https://example.com/?a=1&b=2) [Two](https://example.com/?a=1&b=2)\n\n[Unsafe](javascript:bad()) [Relative](/page) ![Image](https://example.com/a.png)\n\n<script>literal()</script>\n\n\\*literal stars\\*' }));
  assert.deepEqual(parsed.hyperlinks, ['https://example.com/?a=1&b=2']);
  assert.ok(parsed.texts.join('').includes('[Unsafe](javascript:bad())')); assert.ok(parsed.texts.join('').includes('<script>literal()</script>'));
  assert.ok(parsed.texts.join('').includes('*literal stars*'));
});
test('Native numbering retains nesting, zero and non-one starts, and resumes the parent after children', () => {
  const parsed = inspect(createWordDocument({ body: '4. Parent\n  7. Child\n  8. Next child\n5. Next parent\n\n0. A new sequence\n1. Continues\n\n- Bullet\n  9. Numbered child' }));
  assert.deepEqual(parsed.starts, ['4', '7', '0', '9']);
  assert.deepEqual(parsed.levels, ['0', '1', '1', '0', '0', '0', '0', '1']);
  assert.deepEqual(parsed.texts, ['Parent', 'Child', 'Next child', 'Next parent', 'A new sequence', 'Continues', 'Bullet', 'Numbered child']);
});
test('Tables have repeating headers, alignment, bounded content-based widths, and literal escaped pipes', () => {
  const parsed = inspect(createWordDocument({ body: '| ID | Explanation |\n| ---: | :--- |\n| 2 | A longer phrase with a literal \\| pipe |' }));
  assert.equal(parsed.tables, 1); assert.equal(parsed.headers, 1); assert.equal(parsed.widths[0].reduce((a, b) => a + b), 9360);
  assert.ok(parsed.widths[0][1] > parsed.widths[0][0]); assert.ok(parsed.texts.includes('A longer phrase with a literal | pipe'));
  const xml = wordDocumentParts({ body: '| A | B |\n| :---: | ---: |\n| One | 2 |' }).find(x => x.name === 'word/document.xml').content;
  assert.match(xml, /w:jc w:val="center"/); assert.match(xml, /w:jc w:val="right"/); assert.doesNotMatch(xml, /w:trHeight/);
});
test('Malformed lists and tables stay whole as text rather than acquiring misleading document structure', () => {
  for (const body of ['4. Parent\n   - Wrong indent\n5. KEEP ENDING', '| A | B |\n| --- | --- |\n| KEEP ENDING |']) {
    const parsed = inspect(createWordDocument({ body })); assert.equal(parsed.tables, 0); assert.equal(parsed.levels.length, 0); assert.ok(parsed.texts.join('').includes('KEEP ENDING'));
  }
});
test('Private fields, metadata, author identity, history, and authentication never enter Word package parts', () => {
  const draft = { body: 'A public fictional article.', title: 'Separate title', excerpt: 'PRIVATE EXCERPT', description: 'PRIVATE DESCRIPTION', slug: 'private-filename', source: { notes: 'PRIVATE SOURCE' }, questions: ['PRIVATE QUESTION'], author: 'PRIVATE AUTHOR', history: ['PRIVATE HISTORY'], password: 'PRIVATE AUTH' };
  const before = JSON.stringify(draft), parts = wordDocumentParts(draft);
  for (const file of parts) { assert.doesNotMatch(file.content, /PRIVATE|private-filename|Separate title/); assert.doesNotMatch(file.name, /docProps|vba|media|embedding/); }
  assert.equal(JSON.stringify(draft), before); assert.ok(inspect(createWordDocument(draft, { includeTitle: true })).texts.includes('Separate title'));
});
test('Word validation rejects invalid XML and incomplete Unicode without changing the current draft', () => {
  for (const body of ['', 'x'.repeat(60001), 'Bad\u0000text', 'Bad\u000btext', 'Bad\ufffftext', 'Bad\ud800text']) {
    const draft = { body }; assert.throws(() => createWordDocument(draft)); assert.equal(draft.body, body);
  }
  assert.ok(createWordDocument({ body: 'x'.repeat(60000) }).length < 4 * 1024 * 1024);
  assert.ok(createWordDocument({ body: 'Valid', title: '\ud800' }).length);
  assert.throws(() => createWordDocument({ body: 'Valid', title: '\ud800' }, { includeTitle: true }));
});
test('Word packaging cannot broaden publishing ZIP names or add executable, arbitrary, duplicate, or missing parts', () => {
  const parts = wordDocumentParts({ body: 'A document' });
  assert.throws(() => createZip(parts));
  for (const replacement of ['word/vbaProject.bin', '../document.xml', 'word/other.xml', 'word/Document.xml', 'word/../document.xml']) assert.throws(() => createWordZip(parts.map((part, i) => i === 2 ? { ...part, name: replacement } : part)));
  assert.throws(() => createWordZip(parts.slice(1))); assert.throws(() => createWordZip([...parts.slice(1), parts[1]]));
  assert.throws(() => createWordZip(parts.map((part, i) => i === 2 ? { ...part, content: 'x'.repeat(4 * 1024 * 1024) } : part)), /4 MiB/);
});

class Control {
  constructor() { this.value = ''; this.checked = false; this.hidden = false; this.disabled = false; this.textContent = ''; this.events = new Map(); }
  addEventListener(type, fn) { this.events.set(type, fn); }
  fire(type = 'click') { return this.events.get(type)?.(); }
}
async function withControls(run) {
  const prior = globalThis.document;
  const nodes = new Map(), $ = id => { if (!nodes.has(id)) nodes.set(id, new Control()); return nodes.get(id); };
  let draft = { body: 'A document', title: '' }, busy = false, message = '', approvalCalls = 0;
  globalThis.document = { getElementById: $ };
  $('publishing-destination').value = 'word';
  const ui = installWordDocument({ getDraft: () => draft, approved: () => { approvalCalls++; if (!$('reviewed').checked) throw new Error('Review first'); }, changed: () => { $('reviewed').checked = false; ui.update(); }, report: text => { message = text; }, isBusy: () => busy });
  try { await run({ $, ui, setDraft: value => { draft = value; ui.update(); }, busy: value => { busy = value; ui.update(); }, message: () => message, approvalCalls: () => approvalCalls }); }
  finally { globalThis.document = prior; }
}
test('Word controls enforce review, current title choice, body readiness, and busy state', () => withControls(async ({ $, ui, setDraft, busy, message }) => {
  ui.update(); assert.equal($('word-handoff').hidden, false); assert.equal($('download-word').disabled, true);
  await $('download-word').fire(); assert.match(message(), /Review first/);
  $('reviewed').checked = true; ui.update(); assert.equal($('download-word').disabled, false);
  $('word-include-title').checked = true; $('word-include-title').fire('change'); assert.equal($('reviewed').checked, false); assert.equal($('download-word').disabled, true);
  setDraft({ body: 'A document', title: 'A title' }); $('reviewed').checked = true; ui.update(); assert.equal($('download-word').disabled, false);
  busy(true); assert.equal($('download-word').disabled, true); busy(false);
  setDraft({ body: 'Bad\u000btext', title: 'A title' }); assert.equal($('download-word').disabled, true); assert.match($('word-readiness').textContent, /unsupported XML/);
}));
test('Inactive and reset Word controls purge readiness and cannot download through a hidden handoff', () => withControls(async ({ $, ui, approvalCalls }) => {
  $('reviewed').checked = true; ui.update(); $('publishing-destination').value = 'wordpress'; ui.update();
  assert.equal($('word-handoff').hidden, true); assert.equal($('word-readiness').textContent, ''); assert.equal($('download-word').disabled, true);
  await $('download-word').fire(); assert.equal(approvalCalls(), 0);
  $('word-include-title').checked = true; ui.reset(); assert.equal($('word-include-title').checked, false);
}));
test('Word route keeps the full shared workspace, canonical navigation, discovery, and explicit data-use copy', async () => {
  const [writer, word, home, sitemap, privacy, release] = await Promise.all(['write/index.html', 'markdown-to-word/index.html', 'index.html', 'sitemap.xml', 'privacy/index.html', 'release.json'].map(path => readFile('public/' + path, 'utf8')));
  const ids = html => Array.from(html.matchAll(/\bid="([^"]+)"/g), match => match[1]);
  for (const id of ids(writer)) assert.ok(ids(word).includes(id), id);
  assert.equal(new Set(ids(word)).size, ids(word).length);
  assert.match(word, /data-workspace="word"/); assert.match(word, /href="https:\/\/drafttopage.com\/markdown-to-word\/"/);
  assert.match(word, /href="\/markdown-to-word\/" aria-current="page">Markdown to Word/);
  assert.match(home, /href="\/markdown-to-word\/"/); assert.equal((sitemap.match(/<loc>https:\/\/drafttopage.com\/markdown-to-word\/<\/loc>/g) || []).length, 1);
  assert.doesNotMatch(word, /Direct .docx import is not supported/); assert.match(word, /select a plain .docx file up to 8 MiB/); assert.match(word, /not a Word pagination preview/);
  assert.match(privacy, /No author metadata, source images, macros/); assert.equal(JSON.parse(release).wordDocumentExport, true); assert.equal(JSON.parse(release).markdownWordTool, true);
});
