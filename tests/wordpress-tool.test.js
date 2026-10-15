import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { CONVERSION_EXAMPLE, WORDPRESS_TOOL_GUIDE } from '../scripts/wordpress-tool-guide.mjs';
import { createWordPressArticle } from '../public/wordpress-export.js';
import { escapeHTML } from '../scripts/site-shell.mjs';

test('The converter entry page preserves every shared workspace control without duplicate IDs', async () => {
  const [writer, tool] = await Promise.all(['write', 'markdown-to-wordpress'].map(route => readFile(`public/${route}/index.html`, 'utf8')));
  const ids = html => [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  const toolIds = ids(tool);
  assert.equal(new Set(toolIds).size, toolIds.length);
  for (const id of ids(writer)) assert.ok(toolIds.includes(id), `Missing shared workspace control ${id}`);
  assert.match(tool, /data-workspace="wordpress"/);
  assert.match(tool, /<details id="preview-panel" open>/);
  assert.match(tool, /<script type="module" src="\/desk.js">/);
  for (const id of ['copy-wordpress', 'download-wordpress-kit', 'reviewed', 'save-backup', 'restore-backup']) assert.ok(toolIds.includes(id));
  assert.doesNotMatch(tool, /id="login-form"|id="draft-form"|<iframe|src="https?:/);
});

test('The acquisition route is self-canonical, discoverable, and indexed in the generated sitemap', async () => {
  const [tool, home, map, release] = await Promise.all(['markdown-to-wordpress/index.html', 'index.html', 'sitemap.xml', 'release.json'].map(path => readFile(`public/${path}`, 'utf8')));
  assert.match(tool, /<title>Free Markdown to WordPress Converter \| Draft to Page<\/title>/);
  assert.match(tool, /rel="canonical" href="https:\/\/drafttopage.com\/markdown-to-wordpress\/"/);
  assert.match(tool, /href="\/markdown-to-wordpress\/" aria-current="page">WordPress tool/);
  assert.match(home, /href="\/markdown-to-wordpress\/#draft"/);
  assert.match(home, /href="\/markdown-to-wordpress\/#sample"/);
  assert.equal((map.match(/<loc>https:\/\/drafttopage.com\/markdown-to-wordpress\/<\/loc>/g) || []).length, 1);
  assert.equal(JSON.parse(release).wordpressConverterTool, true);
  assert.doesNotMatch(tool, /name="robots" content="noindex"/);
});

test('The educational example matches actual conversion and renders its block markup as inert text', () => {
  assert.match(CONVERSION_EXAMPLE, /fictional sample article/);
  const blockSource = createWordPressArticle({ body: CONVERSION_EXAMPLE }).html;
  assert.match(blockSource, /<!-- wp:heading -->/);
  assert.ok(WORDPRESS_TOOL_GUIDE.includes('<code>' + escapeHTML(CONVERSION_EXAMPLE) + '</code>'));
  assert.ok(WORDPRESS_TOOL_GUIDE.includes('<code>' + escapeHTML(blockSource) + '</code>'));
  assert.ok(!WORDPRESS_TOOL_GUIDE.includes(blockSource));
  assert.equal((WORDPRESS_TOOL_GUIDE.match(/<h1\b/g) || []).length, 0);
});

test('The guide discloses conversion, storage, and manual publishing limits', () => {
  for (const pattern of [/60,000/, /512 KiB/, /limited subset/, /Numbered lists preserve their first value/, /Standalone HTTPS images/, /Other images, embeds/, /no autosave/, /six-file ZIP/, /Optional fields can remain empty/, /current handoff findings/, /publish the post in your own WordPress editor/]) assert.match(WORDPRESS_TOOL_GUIDE, pattern);
  assert.doesNotMatch(WORDPRESS_TOOL_GUIDE, /\u2014|<img\b|<script\b/);
});

test('Data-use copy accurately distinguishes exported WordPress findings from private review notes', async () => {
  const privacy = await readFile('public/privacy/index.html', 'utf8');
  assert.match(privacy, /WordPress kit also includes local article-derived handoff findings/);
  assert.doesNotMatch(privacy, /private review questions, check results, and authentication fields are excluded/);
});
