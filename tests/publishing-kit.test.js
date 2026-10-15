import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { createFormattedArticle, createReadingPage } from '../public/html-export.js';
import { publishingKitFiles, createPublishingKit } from '../public/publishing-kit.js';
import { crc32, createZip, MAX_ZIP_BYTES } from '../public/zip.js';
import { articleWordCount, analyzeDraft } from '../public/draft-review.js';

const draft = { title: 'A fictional update 日本語', body: '## A change\n\n**Bold** and *uncertain*.\n\n- One\n- Two\n\n[A resource](https://example.test/)\n\n`code`', excerpt: 'An unfinished experiment.', description: 'An uncertain outcome.', slug: 'fictional-update', questions: ['PRIVATE QUESTION SENTINEL'], source: { notes: 'PRIVATE SOURCE SENTINEL' }, password: 'PRIVATE AUTH SENTINEL' };
test('Formatted copy works without page metadata or a title by default', () => {
  const article = createFormattedArticle({ body: draft.body });
  assert.match(article.html, /<h2>A change<\/h2>/); assert.match(article.html, /<strong>Bold<\/strong>/);
  assert.match(article.html, /<li>One<\/li>/); assert.match(article.html, /rel="noopener noreferrer"/);
  assert.match(article.text, /A resource \(https:\/\/example.test\/\)/); assert.ok(!article.text.includes('**'));
  assert.ok(!article.html.includes('<h1>'));
  assert.throws(() => createFormattedArticle({ body: '' }));
  assert.throws(() => createFormattedArticle({ body: 'Body' }, { includeTitle: true }));
});
test('Formatted title is an explicit choice and all private fields are excluded', () => {
  const copy = createFormattedArticle(draft, { includeTitle: true });
  assert.match(copy.html, /^<h1>A fictional update 日本語<\/h1>/);
  assert.ok(copy.text.startsWith(draft.title + '\n\n'));
  assert.match(createReadingPage(draft), new RegExp('<article>' + copy.html.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '</article>'));
  for (const text of Object.values(copy)) assert.doesNotMatch(text, /PRIVATE .* SENTINEL|password|questions/);
});
test('Clipboard HTML keeps hostile source, labels, and unsafe URLs inert', () => {
  const copy = createFormattedArticle({ title: '<img src=x onerror=bad()>', body: '<script>bad()</script>\n\n[<svg onload=bad()>](https://example.test/?a=1&b=2)\n\n[bad](javascript:bad())\n\n![img](https://example.test/i.png)' }, { includeTitle: true });
  assert.doesNotMatch(copy.html, /<script|<img|<svg|href="javascript|<iframe|<style/);
  assert.match(copy.html, /&lt;script&gt;/); assert.match(copy.html, /a=1&amp;b=2/);
});
test('A partial publishing kit lists omissions and preserves the original fields', () => {
  const partial = { title: 'An article', body: 'A reviewed paragraph.', excerpt: '', description: '', slug: 'INVALID path' };
  const before = JSON.stringify(partial), kit = publishingKitFiles(partial);
  assert.equal(kit.filename, 'an-article-publishing-kit.zip');
  assert.deepEqual(kit.files.map(f => f.name), ['article-body.md','reading-page.html','page-details.json','README.txt']);
  assert.match(kit.notices.join(' '), /excerpt, description, slug/);
  const details = JSON.parse(kit.files.find(f => f.name === 'page-details.json').content);
  assert.equal(details.excerpt, ''); assert.equal(details.slug, 'an-article');
  assert.equal(JSON.stringify(partial), before);
});
test('A complete kit follows the explicit Markdown title choice', () => {
  const page = publishingKitFiles(draft).files.find(f => f.name === 'page.md').content;
  const document = publishingKitFiles(draft, { includeTitleHeading: true }).files.find(f => f.name === 'page.md').content;
  assert.match(page, /draft: true/); assert.ok(!page.includes('\n# ' + draft.title));
  assert.ok(document.includes('\n# ' + draft.title));
  for (const file of publishingKitFiles(draft).files) assert.doesNotMatch(file.content, /PRIVATE .* SENTINEL/);
});
test('Kit fields and filename bounds reject invalid values before archiving', () => {
  for (const change of [{ title: '' },{ body: '' },{ body: 'a'.repeat(60001) },{ excerpt: 'a'.repeat(301) },{ description: null },{ slug: 'a'.repeat(81) },{ body: 'hidden\u0000text' }]) assert.throws(() => createPublishingKit({ ...draft, ...change }));
});
test('ZIP CRC values match known vectors and unsafe entries never become paths', () => {
  assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926);
  assert.equal(crc32(new Uint8Array()), 0);
  for (const name of ['../escape.txt','/absolute.md','a/b.md','C:drive.txt','a\\b.txt','file..txt','nul.txt','payload.exe','hidden\u0000.txt','日本語.md']) assert.throws(() => createZip([{ name, content: 'data' }]));
  assert.throws(() => createZip([{ name: 'a.txt', content: 'one' },{ name: 'A.txt', content: 'two' }]));
  assert.throws(() => createZip([])); assert.throws(() => createZip(Array.from({ length: 9 },(_, i) => ({ name: i + '.txt', content: '' }))));
  assert.throws(() => createZip([{ name: 'a.txt', content: new Uint8Array() }]));
  assert.throws(() => createZip([{ name: 'a.txt', content: 'a'.repeat(MAX_ZIP_BYTES) }]));
  assert.throws(() => createZip([{ name: 'a.txt', content: '界'.repeat(MAX_ZIP_BYTES / 2) }]));
});
test('An independent ZIP reader verifies CRCs, Unicode, archive structure, and exact file bytes', () => {
  const root = mkdtempSync(join(tmpdir(), 'dtp-kit-'));
  try {
    const kit = createPublishingKit(draft), file = join(root, 'publishing-kit.zip');
    writeFileSync(file, kit.bytes);
    const decoded = JSON.parse(execFileSync('python3', ['-c', 'import json,sys,zipfile\nwith zipfile.ZipFile(sys.argv[1]) as z:\n assert z.testzip() is None\n assert all(i.compress_type == zipfile.ZIP_STORED and i.flag_bits & 0x800 and i.date_time == (1980,1,1,0,0,0) for i in z.infolist())\n print(json.dumps({n:z.read(n).decode("utf-8") for n in z.namelist()}))', file], { encoding: 'utf8' }));
    assert.deepEqual(decoded, Object.fromEntries(publishingKitFiles(draft).files.map(f => [f.name,f.content])));
    assert.deepEqual([...kit.bytes], [...createPublishingKit(draft).bytes]);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
test('Editor and draft review share the same approximate word count', () => {
  for (const body of [draft.body, '## 日本語\r\n\r\nOne `code words` and ![image words](https://example.test/).\n\n~~~\nignored words\n~~~', '']) assert.equal(articleWordCount(body), analyzeDraft({ body }).words);
});
