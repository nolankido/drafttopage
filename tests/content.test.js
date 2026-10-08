import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ARTICLE_TYPES, TEMPLATES, EXAMPLES } from '../public/content-data.js';
import { createMarkdown } from '../public/markdown.js';
import { appPage, unavailablePage } from '../src/pages.js';
const publicPages = ['index.html', 'examples/index.html', 'templates/index.html', 'demo/index.html', 'write/index.html', 'help/local-workspace/index.html', 'getting-started/index.html', 'help/index.html', 'help/markdown-export/index.html', 'access/index.html', 'guides/source-notes/index.html', 'guides/review/index.html', 'privacy/index.html', '404.html'];
test('Six public templates use exactly the three existing article types', () => {
  assert.equal(TEMPLATES.length, 6); assert.equal(new Set(TEMPLATES.map(t => t.id)).size, 6);
  for (const t of TEMPLATES) { assert.ok(ARTICLE_TYPES[t.profile]); assert.ok(t.outline.length >= 30 && t.outline.length <= 8000); assert.ok(t.caution); assert.ok(t.example); }
});
for (const example of EXAMPLES) test(`Example ${example.id} and its export remain synchronized and clearly fictional`, async () => {
  assert.match(example.notes, /Fictional example/); assert.ok(ARTICLE_TYPES[example.profile]);
  const output = createMarkdown(example.draft);
  assert.equal(await readFile(`public/samples/${example.id}.md`, 'utf8'), output);
  assert.match(output, /draft: true/); assert.ok(!output.includes(example.notes));
  for (const q of example.draft.questions) assert.ok(!output.includes(q));
});
for (const path of publicPages) test(`Public page ${path} has a unique title, description, canonical, navigation, and one h1`, async () => {
  const html = await readFile(`public/${path}`, 'utf8');
  assert.equal((html.match(/<h1\b/g) || []).length, 1);
  assert.match(html, /<title>[^<]+\| Draft to Page<\/title>/); assert.match(html, /name="description" content="[^"]+"/);
  assert.match(html, /rel="canonical"/); assert.match(html, /aria-label="Main navigation"/);
  assert.match(html, /data-release="local-desk-20261008"/);
  assert.doesNotMatch(html, /\u2014|<iframe|<script[^>]+src="https?:/);
  assert.doesNotMatch(html, /id="draft-form"|id="login-form"/);
});
test('Public demo never calls an AI endpoint or pretends to produce model output', async () => {
  const js = await readFile('public/resources.js', 'utf8'); const html = await readFile('public/demo/index.html', 'utf8');
  assert.doesNotMatch(js, /fetch\(|XMLHttpRequest|sendBeacon|WebSocket|\/api\//);
  assert.match(html, /prewritten fictional/i); assert.match(html, /does not generate writing/i);
  assert.match(html, /id="demo-download"[^>]*disabled/); assert.match(html, /No autosave/);
});
test('Template outlines remain accessible without JavaScript', async () => {
  const html = await readFile('public/templates/index.html', 'utf8');
  assert.equal((html.match(/<textarea /g) || []).length, 6); assert.match(html, /copy it manually/);
});
test('Every public page title and description is unique', async () => {
  const html = await Promise.all(publicPages.map(p => readFile(`public/${p}`, 'utf8')));
  for (const pattern of [/<title>(.*?)<\/title>/, /name="description" content="([^"]+)"/]) assert.equal(new Set(html.map(h => h.match(pattern)[1])).size, publicPages.length);
});
test('Sitemap omits protected and error routes', async () => {
  const map = await readFile('public/sitemap.xml', 'utf8');
  assert.equal((map.match(/<url>/g) || []).length, 13); assert.doesNotMatch(map, /\/pilot|\/api\/|404\.html/);
});
test('Pilot guides open in new tabs, terminology is accurate, and activation stays separate', () => {
  assert.match(appPage, /for="profile">Article type/); assert.doesNotMatch(appPage, /for="profile">Website profile/);
  assert.match(appPage, /id="reconnect"/); assert.match(appPage, /No autosave/); assert.match(appPage, /id="copy-questions"/);
  assert.match(unavailablePage, /not activated/); assert.match(unavailablePage, /\/demo\//);
  for (const [, tag] of appPage.matchAll(/(<a [^>]*href="\/(?:help|getting-started|guides|privacy)[^"]*"[^>]*>)/g)) assert.match(tag, /target="_blank"/);
});
test('Browser generation validates an entire response before replacing previous work', async () => {
  const js = await readFile('public/pilot.js', 'utf8');
  assert.ok(js.indexOf('createMarkdown(data.draft)') < js.indexOf('$(`#${id}`).value = data.draft[id]'));
  assert.match(js, /Fill in the outline with your own facts/); assert.match(js, /response.status === 401/);
  assert.match(js, /No automatic retry/); assert.doesNotMatch(js, /localStorage|sessionStorage|innerHTML/);
});
test('Exports preserve edited values and block malformed filenames', () => {
  const draft = { ...EXAMPLES[0].draft, title: 'Edited example title' };
  assert.match(createMarkdown(draft), /Edited example title/);
  assert.throws(() => createMarkdown({ ...draft, slug: '../../file' }));
  assert.throws(() => createMarkdown({ ...draft, body: '' }));
});
