import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { reviewExport, exportReviewText, exportTitleHandling, EXPORT_REVIEW_LIMIT } from '../public/export-review.js';
import { reviewWordPress } from '../public/wordpress-review.js';
import { installExportReview } from '../public/export-review-controls.js';
import { createHTMLSource } from '../public/html-export.js';
import { wordDocumentParts } from '../public/word-export.js';
import { createWorkspaceBackup } from '../public/workspace.js';

const draft = body => ({ title: 'Fictional title', body, excerpt: '', description: '', slug: 'fictional-title', questions: ['PRIVATE_REVIEW_MARKER'] });
const findingsBody = '# Fictional title\n\nTODO: finish this paragraph.\n\n![Picture](https://example.com/picture.png)\n\n[Relative](/local)\n\n~~Changed~~\n\n<div>Literal source</div>\n\n- [x] A task\n\n[ref]: https://example.com/source\n\n[Read][ref]\n\n---';

test('Word and HTML checks disclose their actual unsupported formatting and preserve source', () => {
  const value = draft(findingsBody), before = structuredClone(value);
  for (const destination of ['word', 'html']) {
    const review = reviewExport(value, { destination });
    for (const kind of ['placeholder','image','link','strike','html','task-list','reference']) assert.ok(review.findings.some(item => item.kind === kind), destination + ': ' + kind);
    assert.ok(!review.findings.some(item => item.kind === 'separator'));
    assert.ok(review.findings.every((item, i, all) => !i || all[i - 1].start <= item.start));
    assert.ok(review.findings.every(item => item.start >= 0 && item.end <= value.body.length));
    assert.ok(review.findings.every(item => !item.message.includes('WordPress')));
  }
  assert.deepEqual(value, before);
});

test('Heading and repeated-title findings follow Word versus HTML and the actual title option', () => {
  const value = draft('# Fictional title\n\nA finished paragraph.');
  const word = reviewExport(value, { destination: 'word' }), html = reviewExport(value, { destination: 'html' });
  assert.deepEqual(word.findings, []); assert.deepEqual(html.findings.map(item => item.kind), ['title-level']);
  assert.deepEqual(reviewExport(value, { destination: 'word', includeTitle: true }).findings.map(item => item.kind), ['title']);
  assert.deepEqual(reviewExport(value, { destination: 'html', includeTitle: true }).findings.map(item => item.kind).sort(), ['title','title-level']);
  const xml = new Map(wordDocumentParts(value).map(part => [part.name,part.content])).get('word/document.xml');
  assert.match(xml, /w:pStyle w:val="Heading1"/); assert.match(createHTMLSource(value), /<h2>Fictional title<\/h2>/);
  assert.match(exportTitleHandling({ destination: 'word' }), /title field is omitted/); assert.match(exportTitleHandling({ destination: 'word', includeTitle: true }), /Title paragraph/);
  assert.match(exportTitleHandling({ destination: 'html', includeTitle: true }), /included as an H1/);
});

test('Images stay text for Word and HTML while the existing WordPress opt-in keeps its behavior', () => {
  const value = draft('![Picture](https://example.com/picture.png)');
  assert.equal(reviewExport(value, { destination: 'word' }).findings.filter(item => item.kind === 'image').length, 1);
  assert.equal(reviewExport(value, { destination: 'html' }).findings.filter(item => item.kind === 'image').length, 1);
  assert.equal(reviewWordPress(value, { includeLinkedImages: true }).findings.length, 0);
  assert.deepEqual(reviewWordPress(value), reviewExport(value, { destination: 'wordpress' }));
  assert.throws(() => reviewExport(value, { destination: 'html', includeLinkedImages: true }), /only for WordPress/);
});

test('Code, escaped syntax and URL contents do not trigger unsupported-format findings', () => {
  const body = '## Code example\n\n`~~text~~ <div> [ref]: - [x]`\n\n[Resource](https://example.com/a?x=~~text~~)\n\n\\~~literal\\~~ and \\[link][ref]\n\n```html\n<div>HTML</div>\n![Picture](https://example.com/a)\nTODO\n```';
  for (const destination of ['word','html']) assert.deepEqual(reviewExport(draft(body), { destination }).findings, []);
});

test('Unicode and CRLF findings retain exact UTF-16 source positions, including duplicate passages', () => {
  const body = 'Café 🐈\r\n\r\n~~First~~\r\n\r\n~~First~~\r\n\r\n| A | B |\r\n| --- | --- |\r\n| x | y | extra |';
  for (const destination of ['word','html']) {
    const review = reviewExport(draft(body), { destination }), strikes = review.findings.filter(item => item.kind === 'strike');
    assert.deepEqual(strikes.map(item => item.line), [3,5]);
    assert.deepEqual(strikes.map(item => body.slice(item.start,item.end)), ['~~First~~','~~First~~']);
    assert.notEqual(strikes[0].start,strikes[1].start); assert.ok(review.findings.some(item => item.kind === 'table'));
  }
});

test('Reports are bounded, deterministic, destination-aware and exclude private workspace fields', () => {
  const value = draft(Array(100).fill('<div>literal</div>').join('\n\n')), before = structuredClone(value);
  for (const destination of ['word','html']) {
    const review = reviewExport(value, { destination }); assert.equal(review.totalFindings, 100); assert.equal(review.findings.length, EXPORT_REVIEW_LIMIT); assert.equal(review.truncated, true);
    const text = exportReviewText(value, { destination }); assert.equal(text, exportReviewText(value, { destination })); assert.match(text, /first 40 findings/); assert.doesNotMatch(text, /PRIVATE_REVIEW_MARKER|PRIVATE_SOURCE_MARKER/);
    assert.match(exportReviewText(draft('A completed paragraph.'), { destination }), /does not certify/);
  }
  assert.deepEqual(value, before);
  for (const body of ['', ' ', 'x'.repeat(60001), null, 'a\u0000b']) assert.throws(() => reviewExport(draft(body), { destination: 'word' }));
  assert.throws(() => reviewExport(draft('Text'), { destination: 'markdown' }), /Choose/);
  assert.throws(() => reviewExport(draft('Text'), { destination: 'word', includeTitle: 'yes' }), /Choose/);
  const backup = createWorkspaceBackup({ profile:'guide',audience:'',purpose:'',notes:'PRIVATE_SOURCE_MARKER' }, draft('Article.'));
  assert.doesNotMatch(backup, /export-format-review|findings|includeTitle|totalFindings/);
});

class Node {
  constructor() { this.value = ''; this.checked = false; this.open = false; this.children = []; this.events = {}; this.attrs = {}; this.textContent = ''; }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; }
  addEventListener(name, fn) { this.events[name] = fn; }
  fire(name = 'click') { return this.events[name]?.(); }
  setAttribute(name, value) { this.attrs[name] = value; }
  setSelectionRange(start, end) { this.selection = [start,end]; }
  focus() { this.focused = true; }
}
async function withUI(run) {
  const previous = { document: globalThis.document, navigator: Object.getOwnPropertyDescriptor(globalThis,'navigator') }, nodes = new Map();
  const $ = id => { if (!nodes.has(id)) nodes.set(id,new Node()); return nodes.get(id); };
  const state = { value:draft('A normal paragraph.\r\n\r\n~~Inspect this~~'), busy:false, messages:[], downloads:[], copied:'', revealed:0, moves:0, clipboard:async text => { state.copied=text; } };
  globalThis.document = { getElementById:$, createElement:() => new Node() };
  Object.defineProperty(globalThis,'navigator',{ configurable:true, value:{ clipboard:{writeText:text => state.clipboard(text)} } });
  $('publishing-destination').value = 'word'; $('export-format-review').open = true; $('reviewed').checked = true;
  const ui = installExportReview({ getDraft:() => state.value, isBusy:() => state.busy, report:text => state.messages.push(text), reveal:() => state.revealed++, move:node => { node.focus(); state.moves++; }, download:(...args) => state.downloads.push(args) });
  try { ui.update(); await run({ $, state, ui }); }
  finally { globalThis.document=previous.document; if(previous.navigator)Object.defineProperty(globalThis,'navigator',previous.navigator);else delete globalThis.navigator; }
}

test('Inspecting a current finding selects its exact passage and preserves writing and approval', async () => withUI(async ({ $, state, ui }) => {
  const before = structuredClone(state.value), button = $('export-format-findings').children[0].children[1];
  ui.update(); assert.equal($('export-format-findings').children[0].children[1],button); button.fire();
  assert.deepEqual($('body').selection,[23,39]); assert.equal(state.value.body.slice(...$('body').selection),'~~Inspect this~~');
  assert.deepEqual(state.value,before); assert.equal($('reviewed').checked,true); assert.ok($('body').focused); assert.equal(state.revealed,1);
}));

test('Stale findings and destination or title-option changes cannot select outdated offsets', async () => withUI(async ({ $, state, ui }) => {
  const oldButton = $('export-format-findings').children[0].children[1]; state.value.body = 'An edited paragraph.'; oldButton.fire();
  assert.equal($('body').selection,undefined); assert.match(state.messages.at(-1),/options changed/); assert.equal($('export-format-findings').children.length,0);
  state.value = draft('# Fictional title\n\nA paragraph.'); $('word-include-title').checked = true; ui.update();
  const titleButton = $('export-format-findings').children[0].children[1]; $('word-include-title').checked = false; titleButton.fire(); assert.equal($('body').selection,undefined);
  $('publishing-destination').value = 'html'; ui.update(); const htmlButton = $('export-format-findings').children[0].children[1]; $('publishing-destination').value = 'markdown'; htmlButton.fire();
  assert.equal($('body').selection,undefined); assert.equal($('export-format-review').hidden,true); assert.equal($('export-review-text').value,'');
}));

test('Busy state blocks finding actions, copies and downloads without affecting writing', async () => withUI(async ({ $, state, ui }) => {
  const oldButton = $('export-format-findings').children[0].children[1]; state.busy=true; ui.update(); oldButton.fire();
  await $('copy-export-review').fire(); $('download-export-review').fire();
  assert.equal($('body').selection,undefined); assert.equal(state.copied,''); assert.equal(state.downloads.length,0); assert.equal($('copy-export-review').disabled,true); assert.equal($('reviewed').checked,true);
  state.busy=false; ui.update(); assert.equal($('export-format-findings').children.length,1);
}));

test('Copying and downloading use current destination options without requiring article approval', async () => withUI(async ({ $, state, ui }) => {
  $('reviewed').checked=false; await $('copy-export-review').fire(); assert.match(state.copied,/Word document formatting review/);
  $('publishing-destination').value='html'; $('html-include-title').checked=true; ui.update(); $('download-export-review').fire();
  assert.equal(state.downloads.length,1); const [text,name,mime]=state.downloads[0];
  assert.match(text,/HTML source formatting review/); assert.match(text,/included as an H1/); assert.equal(name,'drafttopage-html-formatting-review.txt'); assert.equal(mime,'text/plain;charset=utf-8');
  assert.doesNotMatch(text,/PRIVATE_REVIEW_MARKER/); assert.equal($('reviewed').checked,false);
}));

test('Denied clipboard exposes a current read-only fallback, and hidden or reset reports are purged', async () => withUI(async ({ $, state, ui }) => {
  state.clipboard=async () => { throw new Error('Denied'); }; await $('copy-export-review').fire();
  assert.equal($('export-review-text-panel').open,true); assert.ok($('export-review-text').focused); assert.match($('export-review-text').value,/Strike-through/);
  state.value.body='A clean current paragraph.'; ui.update(); assert.doesNotMatch($('export-review-text').value,/Strike-through/); assert.match($('export-review-text').value,/does not certify/);
  $('export-format-review').open=false; ui.update(); assert.equal($('export-review-text').value,''); assert.equal($('export-format-findings').children.length,0);
  $('export-format-review').open=true; ui.update(); ui.reset(); assert.equal($('export-review-text').value,''); assert.equal($('export-format-findings').children.length,0); assert.equal($('export-format-status').textContent,'');
}));

test('Edits while clipboard permission is pending are reported as a previous-version copy', async () => withUI(async ({ $, state }) => {
  let resolve; state.clipboard = () => new Promise(done => { resolve=done; }); const copying=$('copy-export-review').fire();
  state.value.body='Changed while waiting.'; resolve(); await copying; assert.match(state.messages.at(-1),/earlier export/);
}));

test('Empty or invalid articles clear findings and report text instead of retaining a stale review', async () => withUI(async ({ $, state, ui }) => {
  $('export-review-text-panel').open=true; ui.update(); assert.ok($('export-review-text').value.length);
  for(const body of ['', 'bad\u0000text']) { state.value.body=body; ui.update(); assert.equal($('export-format-findings').children.length,0); assert.equal($('export-review-text').value,''); assert.equal($('copy-export-review').disabled,true); }
}));

test('Generated workspaces expose one accessible review with responsive controls and no persistent state', async () => {
  for(const route of ['write','word-to-wordpress','word-to-markdown','html-to-markdown','google-docs-to-wordpress','markdown-to-wordpress','markdown-to-html','markdown-to-word']) {
    const html=await readFile('public/'+route+'/index.html','utf8');
    for(const id of ['export-format-review','export-title-handling','export-format-status','export-format-findings','copy-export-review','download-export-review','export-review-text']) assert.equal(html.split('id="'+id+'"').length,2);
    assert.match(html,/id="export-review-text"[^>]*readonly/); assert.match(html,/id="export-format-review"[^>]*hidden/); assert.ok(html.indexOf('id="export-format-review"')<html.indexOf('id="word-handoff"'));
  }
  for(const file of ['public/export-review.js','public/export-review-controls.js']) assert.doesNotMatch(await readFile(file,'utf8'),/fetch\s*\(|XMLHttpRequest|localStorage|sessionStorage|indexedDB|innerHTML|outerHTML/);
  assert.match(await readFile('public/desk.css','utf8'),/\.export-format-review button\{[^}]*white-space:normal[^}]*min-height:2\.75rem/);
});
