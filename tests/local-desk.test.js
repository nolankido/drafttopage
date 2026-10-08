import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { previewBlocks, suggestFilename } from '../public/preview.js';
import { createWorkspaceBackup, parseWorkspaceBackup, MAX_BACKUP_BYTES } from '../public/workspace.js';
import { createMarkdown } from '../public/markdown.js';
import { extendSite, RELEASE } from '../scripts/extend-site.mjs';
import { appPage } from '../src/pages.js';
const source = { profile: 'personal', notes: 'Fictional working notes.', audience: 'Readers', purpose: 'Explain' };
const draft = { title: 'A draft', excerpt: 'An excerpt', description: 'Description', slug: 'a-draft', body: 'Article body.', questions: ['Is it accurate?'] };
test('A partial article can be backed up before it can be exported', () => {
  const partial = { ...draft, title: '', slug: 'Not ready yet', body: '' };
  const restored = parseWorkspaceBackup(createWorkspaceBackup(source, partial));
  assert.deepEqual(restored.draft, partial); assert.throws(() => createMarkdown(partial));
});
test('Backups preserve notes and questions but article exports exclude them', () => {
  const restored = parseWorkspaceBackup(createWorkspaceBackup(source, draft));
  assert.deepEqual(restored, { format: 'drafttopage-workspace', version: 1, source, draft });
  const md = createMarkdown(restored.draft);
  assert.ok(!md.includes(source.notes)); assert.ok(!md.includes(draft.questions[0]));
  assert.match(md, /draft: true/);
});
const badChanges = {
  version: x => { x.version = 2; },
  format: x => { x.format = 'other'; },
  extraApproval: x => { x.reviewed = true; },
  unexpectedSource: x => { x.source.cookie = 'fixture'; },
  extraDraftKey: x => { x.draft.html = 'ignored?'; },
  missingField: x => { delete x.source.notes; },
  array: x => { x.source = []; },
  profile: x => { x.source.profile = '__proto__'; },
  notes: x => { x.source.notes = 'x'.repeat(8001); },
  title: x => { x.draft.title = 'x'.repeat(161); },
  body: x => { x.draft.body = 'x'.repeat(12001); },
  questions: x => { x.draft.questions = Array(13).fill('q'); },
  questionType: x => { x.draft.questions = [false]; },
  nul: x => { x.source.notes = '\u0000'; }
};
for (const [name, mutate] of Object.entries(badChanges)) test(`Reject malformed workspace: ${name}`, () => {
  const x = JSON.parse(createWorkspaceBackup(source, draft)); mutate(x);
  assert.throws(() => parseWorkspaceBackup(JSON.stringify(x)));
});
for (const content of ['{broken', 'null', '[]', '42', '"text"']) test(`Reject invalid JSON shape ${content}`, () => assert.throws(() => parseWorkspaceBackup(content)));
test('Imported prototype keys cannot change object prototypes', () => {
  const text = createWorkspaceBackup(source, draft).replace('"version": 1', '"version": 1, "__proto__": {"polluted": true}');
  assert.throws(() => parseWorkspaceBackup(text)); assert.equal({}.polluted, undefined);
});
test('Backup size is bounded in UTF-8 bytes', () => {
  assert.throws(() => parseWorkspaceBackup('x'.repeat(MAX_BACKUP_BYTES + 1)));
  assert.throws(() => parseWorkspaceBackup('😀'.repeat(MAX_BACKUP_BYTES / 3)));
});
test('Unicode and hostile-looking strings are kept as data', () => {
  const s = { ...source, notes: '日本語 😀 <script>bad()</script>' };
  const d = { ...draft, title: '<img src=x onerror=bad()>', questions: ['<svg onload=bad()>'] };
  const value = parseWorkspaceBackup(createWorkspaceBackup(s, d));
  assert.deepEqual(value.source, s); assert.deepEqual(value.draft, d);
});
test('No approvals or authentication fields are serialized', () => {
  const text = createWorkspaceBackup(source, draft);
  for (const key of ['password', 'cookie', 'apiKey', 'reviewed', 'consent']) assert.ok(!text.includes(`"${key}":`));
});
test('Basic preview represents only inert paragraph/heading/list blocks', () => {
  assert.deepEqual(previewBlocks('## Heading\n\nA paragraph.\n\n- One\n- Two\n\n1. Step'), [
    { type: 'h4', text: 'Heading' }, { type: 'p', text: 'A paragraph.' },
    { type: 'ul', items: ['One', 'Two'] }, { type: 'ol', items: ['Step'] }
  ]);
  for (const value of ['<script>bad()</script>', '![img](https://example.com/a.png)', '[click](javascript:bad())']) assert.deepEqual(previewBlocks(value), [{ type: 'p', text: value }]);
  assert.throws(() => previewBlocks('x'.repeat(12001))); assert.throws(() => previewBlocks({}));
});
test('Filename helper produces safe bounded names, including empty and non-ASCII input', () => {
  for (const name of ['Café project', '../Outside', '日本語', '', 'a'.repeat(200), '<script>x</script>']) {
    const slug = suggestFilename(name); assert.match(slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/); assert.ok(slug.length <= 80);
  }
  assert.equal(suggestFilename('Café project'), 'cafe-project');
});
test('Local feature modules cannot upload or execute imported HTML', async () => {
  for (const file of ['desk.js', 'workspace.js', 'recovery.js', 'preview.js', 'download.js']) {
    const js = await readFile(`public/${file}`, 'utf8');
    assert.doesNotMatch(js, /\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|innerHTML|outerHTML|insertAdjacentHTML|eval\(|localStorage|sessionStorage|indexedDB/);
  }
});
test('Pilot uses shared recovery markup and accessible profile guidance', () => {
  assert.match(appPage, /id="restore-backup"[^>]*type="file"/);
  assert.match(appPage, /id="profile"[^>]*aria-describedby="profile-help"/);
  assert.match(appPage, /id="profile-help"[^>]*aria-live="polite"[^>]*aria-atomic="true"/);
  assert.match(appPage, /aria-describedby="notes-help note-count"/);
});
test('Site extension is deterministic and retains existing pages while adding the shared navigation', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dtp-build-'));
  try {
    await writeFile(join(root, 'index.html'), '<header class="site-header wrap"><nav aria-label="Main navigation"></nav></header><main data-release="old"><h1>Original</h1><section class="section wrap status"></section></main><footer class="site-footer wrap">Footer</footer>');
    await writeFile(join(root, 'sitemap.xml'), '<urlset><url><loc>https://drafttopage.com/</loc></url></urlset>');
    await extendSite(root);
    const paths = ['index.html', 'write/index.html', 'help/local-workspace/index.html', 'sitemap.xml', 'release.json'];
    const first = await Promise.all(paths.map(path => readFile(join(root, path), 'utf8')));
    await extendSite(root);
    const second = await Promise.all(paths.map(path => readFile(join(root, path), 'utf8')));
    assert.deepEqual(first, second);
    assert.match(first[0], /<h1>Original<\/h1>/); assert.equal((first[0].match(/data-local-desk-nav/g) || []).length, 1);
    assert.equal((first[0].match(/id="writing-options"/g) || []).length, 1);
    assert.match(first[1], /aria-current="page"/); assert.equal((first[3].match(/<url>/g) || []).length, 3);
    assert.equal(JSON.parse(first[4]).release, RELEASE);
  } finally { await rm(root, { recursive: true, force: true }); }
});
