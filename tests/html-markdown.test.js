import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { HTML_SOURCE_SAMPLE } from '../public/html-source-sample.js';
import { previewBlocks } from '../public/preview.js';
import { createArticleMarkdown } from '../public/article-markdown.js';
import { writingPages } from '../scripts/writing-pages.mjs';

test('HTML conversion sample uses native supported structures and deterministic Markdown', () => {
  assert.match(HTML_SOURCE_SAMPLE.html, /<h1>A fictional garden plan<\/h1>/); assert.match(HTML_SOURCE_SAMPLE.html, /<ol start="4">/);
  assert.match(HTML_SOURCE_SAMPLE.markdown, /^# A fictional garden plan/);
  assert.deepEqual(previewBlocks(HTML_SOURCE_SAMPLE.markdown).map(b=>b.type), ['h3','p','h4','ol','hr','table','p']);
  assert.match(HTML_SOURCE_SAMPLE.markdown, /\[source link\]\(https:\/\/example.com\/garden\)/);
  assert.match(HTML_SOURCE_SAMPLE.markdown, /Replace it with your own writing\\\./);
  assert.equal(createArticleMarkdown({body:HTML_SOURCE_SAMPLE.markdown}),HTML_SOURCE_SAMPLE.markdown+'\n');
});

test('Dedicated HTML-to-Markdown page opens the shared source importer and exposes the complete workflow', async () => {
  const page=await readFile('public/html-to-markdown/index.html','utf8');
  assert.match(page, /data-workspace="html-to-markdown"/);assert.match(page, /<details id="import-panel"[^>]* open>/);
  assert.match(page, /<option value="html-source" selected>/);assert.match(page, /<h1>HTML to Markdown converter<\/h1>/);
  for(const id of ['start-html-source','import-text','preview-import','import-reading-preview','import-body-preview','import-changes-ok','apply-import','markdown-include-title','copy-article-markdown','download-article-markdown','markdown-source-panel','body','editing-tools','workflow-steps'])assert.equal(page.split('id="'+id+'"').length,2,id);
  assert.ok(page.indexOf('id="import-panel"')<page.indexOf('id="article-heading"'));
  const desk=await readFile('public/desk.js','utf8');assert.match(desk,/const markdownTool = wordMarkdownTool \|\| htmlMarkdownTool/);assert.match(desk,/defaultDestination: markdownTool \? 'markdown'/);
  assert.equal(writingPages.find(p=>p.route==='/html-to-markdown/').script,'/desk.js');
});

test('New converter is linked, self-canonical, indexed, and honest about its limits', async () => {
  const page=await readFile('public/html-to-markdown/index.html','utf8');
  assert.match(page, /rel="canonical" href="https:\/\/drafttopage.com\/html-to-markdown\/"/);assert.match(page,/href="\/html-to-markdown\/" aria-current="page"/);
  assert.match(await readFile('public/sitemap.xml','utf8'),/<loc>https:\/\/drafttopage.com\/html-to-markdown\/<\/loc>/);
  assert.match(await readFile('public/index.html','utf8'),/href="\/html-to-markdown\/"/);
  for(const phrase of ['No URL is fetched','512 KiB','60,000','relative','Images become text placeholders','no autosave','in development','not full CommonMark'])assert.ok(page.toLowerCase().includes(phrase.toLowerCase()),phrase);
  assert.match(page,/&lt;h1&gt;A fictional garden plan&lt;\/h1&gt;/);assert.doesNotMatch(page,/<h1>A fictional garden plan<\/h1>|\u2014/);
  assert.match(await readFile('public/markdown-to-html/index.html','utf8'),/href="\/html-to-markdown\/"/);
});
