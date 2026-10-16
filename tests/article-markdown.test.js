import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createArticleMarkdown } from '../public/article-markdown.js';
import { installMarkdownHandoff } from '../public/markdown-handoff-controls.js';
import { createFormattedArticle } from '../public/html-export.js';
import { inlineParts } from '../public/inline-render.js';
import { readDocxXML } from '../public/docx-archive.js';
import { parseArticleImport } from '../public/article-import.js';
import { convert, python } from './docx-fixtures.js';
import { createPublishingProfile, parsePublishingProfile } from '../public/publishing-profile.js';
import { WORD_MARKDOWN_SAMPLE, WORD_MARKDOWN_GUIDE } from '../scripts/word-markdown-tool.mjs';
import { escapeHTML } from '../scripts/site-shell.mjs';

test('Article Markdown keeps exact authored text and line endings without exporting other fields', () => {
  const body = '  Opening text.  \r\n\r\n```html\r\n<script>literal source</script>\r\n```\r\n\r\n![image](https://example.com/image.png)\r\n\r\nKEEP THE END  \r\n';
  const draft = { body, title: 'EXCLUDED TITLE', excerpt: 'PRIVATE EXCERPT', description: 'PRIVATE DESCRIPTION', slug: 'private-slug', notes: 'PRIVATE SOURCE', questions: ['PRIVATE QUESTION'] };
  assert.equal(createArticleMarkdown(draft), body);
  assert.equal(createArticleMarkdown({ body: '界 😀' }), '界 😀\n');
  assert.doesNotMatch(createArticleMarkdown(draft), /PRIVATE|EXCLUDED|draft:|title:/);
});

test('Optional titles remain literal headings, are omitted when unavailable, and never remove authored headings', () => {
  const title = '[Link](https://example.com/) &amp; **bold** <img>\r\nNext #';
  const text = createArticleMarkdown({ title, body: '# Existing title\n\nBody' }, { includeTitle: true });
  const heading = text.split('\n')[0];
  assert.ok(heading.startsWith('# '));
  assert.deepEqual(inlineParts(heading.slice(2)), [{ type: 'text', text: title.replace(/[\r\n]/g, ' ').trim() }]);
  assert.ok(text.endsWith('# Existing title\n\nBody\n'));
  for (const draft of [{ body: 'Body' }, { body: 'Body', title: '' }, { body: 'Body', title: '   ' }]) assert.equal(createArticleMarkdown(draft, { includeTitle: true }), 'Body\n');
  assert.equal(createArticleMarkdown({ title: null, body: 'Body' }), 'Body\n', 'Unused title fields do not block body-only output');
});

test('Export rejects malformed and oversized input in full while retaining the 60,000-character ending', () => {
  const tail = 'KEEP THE ENTIRE ENDING', body = '界'.repeat(60000 - tail.length) + tail;
  assert.ok(createArticleMarkdown({ body }).endsWith(tail + '\n'));
  for (const body of ['', '  ', null, 'x'.repeat(60001), 'bad\u0000text']) assert.throws(() => createArticleMarkdown({ body }));
  for (const title of [null, 5, 'x'.repeat(161), 'bad\u0000title']) assert.throws(() => createArticleMarkdown({ body: 'Body', title }, { includeTitle: true }));
  assert.throws(() => createArticleMarkdown({ body: 'Body' }, { includeTitle: 'false' }));
});

test('The downloadable Word sample imports and exports equivalent headings, lists, links, and table content', async () => {
  const bytes = new Uint8Array(await readFile('public/samples/word-to-markdown.docx'));
  const imported = parseArticleImport(convert(Object.fromEntries(await readDocxXML(bytes))).markdown).draft;
  assert.equal(imported.title, WORD_MARKDOWN_SAMPLE.title);
  // Word's heading and table-header styles explicitly carry bold. Their
  // redundant strong wrapper has the same visible meaning in this sample.
  const normalHeaders = html => html.replace(/<(h[1-6]|th)([^>]*)><strong>([^<]*)<\/strong><\/\1>/g, '<$1$2>$3</$1>');
  assert.equal(normalHeaders(createFormattedArticle(imported, { includeTitle: true }).html), createFormattedArticle(WORD_MARKDOWN_SAMPLE, { includeTitle: true }).html);
  const output = createArticleMarkdown(imported, { includeTitle: true });
  assert.match(output, /^# A small publishing plan\n\n## \*\*Before publishing\*\*/);
  assert.match(output, /\*\*clear structure\*\*/);
  assert.match(output, /\[source links\]\(https:\/\/example.com\/\)/);
  assert.match(output, /\| Publish \| Planned \|/);
  assert.equal(await readFile('public/samples/word-to-markdown.md', 'utf8'), createArticleMarkdown(WORD_MARKDOWN_SAMPLE, { includeTitle: true }));
  assert.ok(WORD_MARKDOWN_GUIDE.includes('<code>' + escapeHTML(createArticleMarkdown(WORD_MARKDOWN_SAMPLE, { includeTitle: true })) + '</code>'));
});

test('An independent ZIP reader validates the public sample document and its absence of private metadata', async () => {
  const report = python('import sys,json,io,zipfile,xml.etree.ElementTree as E\nz=zipfile.ZipFile(io.BytesIO(bytes(json.load(sys.stdin))))\nassert z.testzip() is None\nfor n in z.namelist(): E.fromstring(z.read(n))\nprint(json.dumps({"names":z.namelist(),"document":z.read("word/document.xml").decode()}))', Array.from(await readFile('public/samples/word-to-markdown.docx')));
  assert.ok(report.names.includes('[Content_Types].xml'));
  assert.ok(report.names.every(name => !/docProps|media|vba|comments|footnotes/.test(name)));
  assert.match(report.document, /A small publishing plan/);
  assert.doesNotMatch(report.document, /PRIVATE|author|password|credential/);
});

class Control {
  constructor() { this.value = ''; this.checked = false; this.open = false; this.listeners = {}; }
  addEventListener(event, fn) { this.listeners[event] = fn; }
  async fire(event = 'click') { return this.listeners[event]?.(); }
}
async function withControls(run, defaultIncludeTitle = false) {
  const prior = globalThis.document, priorNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const nodes = new Map(), $ = id => { if (!nodes.has(id)) nodes.set(id, new Control()); return nodes.get(id); };
  globalThis.document = { getElementById: $ };
  let draft = { ...WORD_MARKDOWN_SAMPLE }, busy = false, blocked = false, copied = '', downloaded = null, message = '', changes = 0;
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { clipboard: { writeText: async value => { if (blocked) throw new Error('Clipboard denied'); copied = value; } } } });
  $('publishing-destination').value = 'markdown'; $('export-format').value = 'page'; $('markdown-source-panel').open = true;
  const ui = installMarkdownHandoff({ getDraft: () => draft, defaultIncludeTitle, approved: () => { if (!$('reviewed').checked) throw new Error('Review first'); }, changed: () => { changes++; $('reviewed').checked = false; ui.update(); }, isBusy: () => busy, report: text => { message = text; }, download: (...args) => { downloaded = args; } });
  try { await run({ $, ui, setDraft: value => { draft = value; ui.update(); }, busy: value => { busy = value; ui.update(); }, blocked: () => { blocked = true; }, copied: () => copied, downloaded: () => downloaded, message: () => message, changes: () => changes }); }
  finally { globalThis.document = prior; if (priorNavigator) Object.defineProperty(globalThis, 'navigator', priorNavigator); else delete globalThis.navigator; }
}

test('Copy and download require approval and export the current article without metadata fields', () => withControls(async ({ $, ui, copied, downloaded, setDraft }) => {
  ui.update();
  assert.equal($('copy-article-markdown').disabled, true); assert.equal($('article-markdown-preview').value, '');
  await $('copy-article-markdown').fire(); await $('download-article-markdown').fire();
  assert.equal(copied(), ''); assert.equal(downloaded(), null);
  setDraft({ body: 'Current **article**', title: '', excerpt: '', description: '', slug: '', questions: ['PRIVATE'] });
  $('reviewed').checked = true; ui.update();
  await $('copy-article-markdown').fire(); await $('download-article-markdown').fire();
  assert.equal(copied(), 'Current **article**\n'); assert.equal(downloaded()[0], copied());
  assert.match(downloaded()[1], /^[a-z0-9-]+\.md$/); assert.equal(downloaded()[2], 'text/markdown;charset=utf-8');
  assert.equal($('article-markdown-preview').value, copied());
}));

test('Shared title handling follows profile choices, clears approval on change, and resets route defaults', () => withControls(async ({ $, ui, changes, setDraft }) => {
  assert.equal($('export-format').value, 'document');
  $('reviewed').checked = true; ui.update();
  assert.equal($('markdown-include-title').checked, true); assert.ok($('article-markdown-preview').value.startsWith('# '));
  $('markdown-include-title').checked = false; await $('markdown-include-title').fire('change');
  assert.equal(changes(), 1); assert.equal($('export-format').value, 'page'); assert.equal($('reviewed').checked, false); assert.equal($('article-markdown-preview').value, '');
  $('export-format').value = 'document'; ui.update(); assert.equal($('markdown-include-title').checked, true);
  setDraft({ body: 'No title' }); $('reviewed').checked = true; ui.update();
  assert.equal($('copy-article-markdown').disabled, false); assert.match($('article-markdown-readiness').textContent, /No separate title/);
  ui.reset(); assert.equal($('article-markdown-preview').value, ''); assert.equal($('export-format').value, 'document');
}, true));

test('Hidden, collapsed, unapproved, busy, invalid, and reset states purge prepared output', () => withControls(async ({ $, ui, busy, setDraft, copied, downloaded }) => {
  $('reviewed').checked = true; ui.update(); assert.ok($('article-markdown-preview').value);
  $('markdown-source-panel').open = false; await $('markdown-source-panel').fire('toggle'); assert.equal($('article-markdown-preview').value, ''); assert.equal($('copy-article-markdown').disabled, false);
  $('markdown-source-panel').open = true; ui.update();
  $('publishing-destination').value = 'html'; ui.update(); assert.equal($('markdown-handoff').hidden, true); assert.equal($('article-markdown-preview').value, '');
  await $('copy-article-markdown').fire(); await $('download-article-markdown').fire(); assert.equal(copied(), ''); assert.equal(downloaded(), null);
  $('publishing-destination').value = 'markdown'; ui.update(); busy(true);
  await $('copy-article-markdown').fire(); await $('download-article-markdown').fire(); assert.equal(copied(), ''); assert.equal(downloaded(), null); assert.equal($('article-markdown-preview').value, '');
  $('markdown-include-title').checked = true; await $('markdown-include-title').fire('change'); assert.equal($('export-format').value, 'page');
  busy(false); $('reviewed').checked = false; ui.update(); assert.equal($('article-markdown-preview').value, '');
  $('reviewed').checked = true; setDraft({ body: '' }); assert.equal($('download-article-markdown').disabled, true); assert.equal($('article-markdown-preview').value, '');
  ui.reset(); assert.equal($('markdown-include-title').checked, false); assert.equal($('export-format').value, 'page');
}));

test('Clipboard failure preserves approved text and offers a manual copy and download fallback', () => withControls(async ({ $, ui, blocked, message }) => {
  $('reviewed').checked = true; ui.update(); const before = $('article-markdown-preview').value;
  blocked(); await $('copy-article-markdown').fire();
  assert.match(message(), /copy it manually/); assert.equal($('article-markdown-preview').value, before); assert.equal($('reviewed').checked, true);
}));

test('Publishing profiles retain the Markdown destination and shared title preference without new schema fields', () => {
  for (const markdownTitle of ['page', 'document']) {
    const value = { format: 'drafttopage-publishing-profile', version: 1, name: 'Markdown articles', preferences: { destination: 'markdown', formattedTitle: false, htmlTitle: false, wordTitle: false, markdownTitle }, checklist: ['Inspect the final Markdown'] };
    assert.deepEqual(parsePublishingProfile(createPublishingProfile(value)), value);
  }
});

test('The Word-to-Markdown route is discoverable and keeps the shared import, editing, recovery, and export controls', async () => {
  const [writer, html, home, sitemap, release] = await Promise.all(['write/index.html', 'word-to-markdown/index.html', 'index.html', 'sitemap.xml', 'release.json'].map(path => readFile('public/' + path, 'utf8')));
  const ids = value => [...value.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(ids(html)).size, ids(html).length);
  for (const id of ids(writer).filter(id => id !== 'start-draft')) assert.ok(ids(html).includes(id), id);
  assert.match(html, /data-workspace="word-to-markdown"/);
  assert.match(html, /<details id="import-panel" class="import-panel" open>/); assert.match(html, /<details id="preview-panel" open>/); assert.match(html, /<details id="markdown-source-panel" open>/);
  assert.match(html, /<title>Free Word to Markdown Converter \| Draft to Page<\/title>/);
  assert.match(html, /rel="canonical" href="https:\/\/drafttopage.com\/word-to-markdown\/"/);
  assert.match(html, /href="\/word-to-markdown\/" aria-current="page">Word to Markdown/); assert.match(home, /href="\/word-to-markdown\/">Word to Markdown/);
  assert.equal((sitemap.match(/<loc>https:\/\/drafttopage.com\/word-to-markdown\/<\/loc>/g) || []).length, 1);
  for (const key of ['wordMarkdownTool', 'articleMarkdownExport', 'downloadableWordSample']) assert.equal(JSON.parse(release)[key], true);
  assert.doesNotMatch(html, /<iframe|<img\b|src="https?:|name="robots" content="noindex"|\u2014/);
  assert.ok(html.indexOf('id="copy-article-markdown"') < html.indexOf('id="additional-exports"'));
});
