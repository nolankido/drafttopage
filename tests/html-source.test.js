import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHTMLSource, createFormattedArticle } from '../public/html-export.js';
import { installHTMLSource } from '../public/html-source-controls.js';
import { HTML_CONVERSION_EXAMPLE, HTML_TOOL_GUIDE } from '../scripts/html-tool-guide.mjs';
import { escapeHTML } from '../scripts/site-shell.mjs';
import { QUICK_SAMPLE } from '../public/quick-sample.js';

test('Body-only HTML source requires no metadata and has no document or WordPress wrapper', () => {
  const source = createHTMLSource({ body: '## A useful heading\n\nA **clear** paragraph.' });
  assert.equal(source, '<h2>A useful heading</h2>\n<p>A <strong>clear</strong> paragraph.</p>\n');
  assert.doesNotMatch(source, /<!doctype|<html|<head|<body|wp:|<h1/);
  assert.throws(() => createHTMLSource({ body: '' }));
  assert.throws(() => createHTMLSource({ body: 'Valid' }, { includeTitle: 'false' }));
});
test('Title inclusion is explicit, escaped, and keeps body H1 headings at H2', () => {
  const draft = { title: '<script>Fictional title</script>', body: '# Body heading\n\nArticle.', notes: 'PRIVATE SOURCE', questions: ['PRIVATE QUESTION'], description: 'PRIVATE METADATA' };
  const without = createHTMLSource(draft), withTitle = createHTMLSource(draft, { includeTitle: true });
  assert.ok(!without.includes('Fictional title'));
  assert.match(withTitle, /^<h1>&lt;script&gt;Fictional title&lt;\/script&gt;<\/h1>/);
  assert.match(withTitle, /<h2>Body heading<\/h2>/); assert.equal((withTitle.match(/<h1>/g) || []).length, 1);
  assert.doesNotMatch(withTitle, /PRIVATE|<script>/);
  assert.throws(() => createHTMLSource({ body: 'Body.' }, { includeTitle: true }));
});
test('Portable HTML preserves paragraph and quote breaks while code keeps exact newlines', () => {
  const body = 'First line.\r\nSecond line.\n\n> First quote\n> Second quote\n\n```\nline one\nline two\n```';
  const source = createHTMLSource({ body });
  assert.match(source, /<p>First line\.<br>Second line\.<\/p>/);
  assert.match(source, /<blockquote>First quote<br>Second quote<\/blockquote>/);
  assert.match(source, /<pre style="white-space:pre-wrap;overflow-wrap:anywhere"><code>line one\nline two<\/code><\/pre>/);
  assert.equal(createFormattedArticle({ body }).html.includes('<br>'), false, 'Existing formatted/reading output is preserved');
});
test('Tables carry scoped headers, fixed alignment, and a keyboard-accessible overflow region', () => {
  const source = createHTMLSource({ body: '| Left | Center | Right |\n| --- | :---: | ---: |\n| One | Two | Three |' });
  assert.match(source, /role="region"[^>]*tabindex="0" style="max-width:100%;overflow-x:auto"/);
  assert.match(source, /<th scope="col" style="text-align:left">Left<\/th>/);
  for (const alignment of ['center', 'right']) assert.ok(source.includes('style="text-align:' + alignment + '"'));
  assert.equal((source.match(/scope="col"/g) || []).length, 3);
});
test('Nested lists preserve numbering and rejected table/list source stays complete', () => {
  const body = '4. Parent\n  7) Child\n  8) Next child\n5. Next parent';
  const source = createHTMLSource({ body });
  assert.match(source, /<ol start="4">/); assert.match(source, /<ol start="7">/); assert.equal((source.match(/<li>/g) || []).length, 4);
  for (const invalid of ['| A | B |\n| --- | --- |\n| LAST CELL |', '4. Parent\n   - Bad indent\n5. KEEP ENDING']) {
    const literal = createHTMLSource({ body: invalid });
    assert.ok(literal.includes('LAST CELL') || literal.includes('KEEP ENDING'));
    assert.doesNotMatch(literal, /<table|<ol|<ul/);
  }
});
test('Hostile HTML, block comments, images, and unsafe links remain data in source', () => {
  const source = createHTMLSource({ body: '<script src="https://example.test/bad.js">bad()</script>\n\n<!-- wp:html --><iframe src=x></iframe>\n\n![image](https://example.test/image.jpg)\n\n[bad](javascript:bad())\n\n[safe](https://example.test/?a=1&b=2)' });
  assert.doesNotMatch(source, /<script|<iframe|<img|<!-- wp|href="javascript/);
  assert.match(source, /&lt;script/); assert.match(source, /&lt;!-- wp:html/);
  assert.match(source, /href="https:\/\/example.test\/\?a=1&amp;b=2" target="_blank" rel="noopener noreferrer"/);
});
test('Full-length Unicode source retains its final passage and still rejects overflow', () => {
  const tail = 'KEEP THE ENTIRE ENDING';
  const body = '界'.repeat(60000 - tail.length) + tail;
  assert.ok(createHTMLSource({ body }).endsWith(tail + '</p>\n'));
  assert.throws(() => createHTMLSource({ body: body + 'x' }));
});
test('The HTML route reuses every workspace control and selects a distinct, discoverable entry', async () => {
  const [writer, html, home, sitemap, release] = await Promise.all(['write/index.html', 'markdown-to-html/index.html', 'index.html', 'sitemap.xml', 'release.json'].map(path => readFile('public/' + path, 'utf8')));
  const ids = value => [...value.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(ids(html)).size, ids(html).length);
  for (const id of ids(writer)) assert.ok(ids(html).includes(id), id);
  assert.match(html, /data-workspace="html"/); assert.match(html, /<details id="preview-panel" open>/);
  assert.match(html, /<title>Free Markdown to HTML Converter \| Draft to Page<\/title>/);
  assert.match(html, /rel="canonical" href="https:\/\/drafttopage.com\/markdown-to-html\/"/);
  assert.match(html, /href="\/markdown-to-html\/" aria-current="page">Markdown to HTML/);
  assert.match(home, /href="\/markdown-to-html\/">Markdown to HTML/);
  assert.equal((sitemap.match(/<loc>https:\/\/drafttopage.com\/markdown-to-html\/<\/loc>/g) || []).length, 1);
  assert.equal(JSON.parse(release).markdownHTMLTool, true); assert.equal(JSON.parse(release).htmlSource, true);
  assert.doesNotMatch(html, /<iframe|<img\b|src="https?:|name="robots" content="noindex"/);
});
test('The educational HTML example matches actual conversion and stays escaped', () => {
  const source = createHTMLSource({ body: HTML_CONVERSION_EXAMPLE });
  assert.ok(HTML_TOOL_GUIDE.includes('<code>' + escapeHTML(source) + '</code>'));
  assert.ok(!HTML_TOOL_GUIDE.includes(source));
  assert.doesNotMatch(HTML_TOOL_GUIDE, /\u2014|<script\b|<img\b/);
  for (const text of ['60,000', '512 KiB', 'off by default', 'HTML source field', 'limited Markdown subset', 'strip styling', 'No images', 'publish yourself']) assert.ok(HTML_TOOL_GUIDE.includes(text), text);
});

function withControls(run) {
  class Control {
    constructor() { this.value = ''; this.checked = false; this.open = true; this.listeners = {}; }
    addEventListener(name, callback) { this.listeners[name] = callback; }
    async fire(name = 'click') { return this.listeners[name]?.(); }
  }
  const priorDocument = globalThis.document, priorNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const nodes = new Map(), $ = id => { if (!nodes.has(id)) nodes.set(id, new Control()); return nodes.get(id); };
  globalThis.document = { getElementById: $ };
  let draft = { ...QUICK_SAMPLE }, busy = false, message = '', copied = '', blocked = false;
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { clipboard: { writeText: async text => { if (blocked) throw new Error('Clipboard denied'); copied = text; } } } });
  $('publishing-destination').value = 'html';
  const ui = installHTMLSource({ getDraft: () => draft, approved: () => { if (!$('reviewed').checked) throw new Error('Review first'); }, changed: () => { $('reviewed').checked = false; ui.update(); }, report: text => { message = text; }, isBusy: () => busy });
  return Promise.resolve().then(() => run({ $, ui, setDraft: value => { draft = value; ui.update(); }, busy: value => { busy = value; ui.update(); }, blockClipboard: () => { blocked = true; }, copied: () => copied, message: () => message })).finally(() => {
    globalThis.document = priorDocument;
    if (priorNavigator) Object.defineProperty(globalThis, 'navigator', priorNavigator); else delete globalThis.navigator;
  });
}
test('HTML handoff requires approval, copies exact source, and changing title handling clears output', () => withControls(async ({ $, ui, copied }) => {
  ui.update(); assert.equal($('copy-html-source').disabled, true); assert.equal($('html-source-preview').value, '');
  await $('copy-html-source').fire(); assert.equal(copied(), '');
  $('reviewed').checked = true; ui.update();
  assert.equal($('copy-html-source').disabled, false); assert.equal($('html-source-preview').value, createHTMLSource(QUICK_SAMPLE));
  await $('copy-html-source').fire(); assert.equal(copied(), createHTMLSource(QUICK_SAMPLE));
  $('html-include-title').checked = true; await $('html-include-title').fire('change');
  assert.equal($('reviewed').checked, false); assert.equal($('html-source-preview').value, '');
  $('reviewed').checked = true; ui.update(); assert.match($('html-source-preview').value, /^<h1>/);
}));
test('Hidden, collapsed, edited, busy, invalid, and reset states purge source and enforce current readiness', () => withControls(async ({ $, ui, setDraft, busy }) => {
  $('reviewed').checked = true; ui.update(); assert.ok($('html-source-preview').value);
  $('html-source-code-panel').open = false; await $('html-source-code-panel').fire('toggle'); assert.equal($('html-source-preview').value, '');
  assert.equal($('copy-html-source').disabled, false);
  $('html-source-code-panel').open = true; ui.update(); assert.ok($('html-source-preview').value);
  $('publishing-destination').value = 'wordpress'; ui.update(); assert.equal($('html-source-handoff').hidden, true); assert.equal($('html-source-preview').value, '');
  $('publishing-destination').value = 'html'; ui.update(); busy(true); assert.equal($('html-source-preview').value, ''); assert.equal($('download-html-source').disabled, true);
  busy(false); $('reviewed').checked = false; setDraft({ body: 'Changed article' }); assert.equal($('html-source-preview').value, '');
  $('reviewed').checked = true; ui.update(); assert.ok($('html-source-preview').value.includes('Changed article'));
  $('html-include-title').checked = true; ui.update(); assert.equal($('copy-html-source').disabled, true); assert.equal($('html-source-preview').value, '');
  ui.reset(); assert.equal($('html-include-title').checked, false); assert.equal($('html-source-preview').value, '');
}));
test('Clipboard rejection retains approved code and offers manual copying or download', () => withControls(async ({ $, ui, blockClipboard, message }) => {
  $('reviewed').checked = true; ui.update(); const source = $('html-source-preview').value;
  blockClipboard(); await $('copy-html-source').fire();
  assert.match(message(), /copy it manually/); assert.equal($('html-source-preview').value, source); assert.equal($('reviewed').checked, true);
}));
