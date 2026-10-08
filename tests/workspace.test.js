import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_BACKUP_BYTES, createWorkspaceBackup, parseWorkspaceBackup, validateDraft } from '../public/workspace.js';
import { createMarkdown } from '../public/markdown.js';
import { appPage } from '../src/pages.js';
const source = { profile: 'update', notes: 'Original notes about a fictional desk.', audience: 'Readers', purpose: 'Share a modest update' };
const draft = { title: 'My draft', excerpt: 'An excerpt', description: 'A description', slug: 'my-draft', body: 'A short draft.', questions: ['Is this accurate?'] };
const fixture = () => JSON.parse(createWorkspaceBackup(source, draft));
test('Workspace backup round-trips notes, edited fields, and questions without approval or credentials', () => {
  const value = parseWorkspaceBackup(createWorkspaceBackup(source, draft));
  assert.deepEqual(value.source, source); assert.deepEqual(value.draft, draft);
  assert.deepEqual(Object.keys(value), ['format', 'version', 'source', 'draft']);
  for (const name of ['password', 'cookie', 'apiKey', 'consent', 'reviewed']) assert.ok(!JSON.stringify(value).includes(`"${name}"`));
});
test('Incomplete notes and unfinished article fields can be backed up without passing publication checks', () => {
  const empty = { ...source, notes: '', audience: '', purpose: '' };
  assert.equal(parseWorkspaceBackup(createWorkspaceBackup(empty)).draft, null);
  const partial = { ...draft, title: '', slug: 'Not ready yet', body: '' };
  assert.deepEqual(parseWorkspaceBackup(createWorkspaceBackup(empty, partial)).draft, partial);
  assert.throws(() => createMarkdown(partial));
});
test('Unicode, quotes, and hostile-looking markup round-trip strictly as text', () => {
  const notes = { ...source, notes: '日本語 "quotes"\n<script>bad()</script> 😀' };
  const article = { ...draft, title: '<img src=x onerror=bad()>', questions: ['<svg onload=bad()>'] };
  const value = parseWorkspaceBackup(createWorkspaceBackup(notes, article));
  assert.deepEqual(value.source, notes); assert.deepEqual(value.draft, article);
});
const mutations = {
  'future version': v => { v.version = 2; },
  'wrong format': v => { v.format = 'other'; },
  'unexpected approval': v => { v.reviewed = true; },
  'unexpected source secret': v => { v.source.password = 'not-a-secret-test'; },
  'unexpected draft field': v => { v.draft.html = '<script>'; },
  'missing notes': v => { delete v.source.notes; },
  'missing question list': v => { delete v.draft.questions; },
  'array source': v => { v.source = []; },
  'null source': v => { v.source = null; },
  'invalid profile': v => { v.source.profile = '__proto__'; },
  'oversized notes': v => { v.source.notes = 'x'.repeat(8001); },
  'oversized audience': v => { v.source.audience = 'x'.repeat(161); },
  'oversized purpose': v => { v.source.purpose = 'x'.repeat(241); },
  'oversized title': v => { v.draft.title = 'x'.repeat(161); },
  'oversized body': v => { v.draft.body = 'x'.repeat(12001); },
  'object instead of text': v => { v.draft.body = {}; },
  'NUL in notes': v => { v.source.notes = '\u0000'; },
  'too many questions': v => { v.draft.questions = Array(13).fill('Question'); },
  'oversized question': v => { v.draft.questions = ['x'.repeat(501)]; },
  'non-string question': v => { v.draft.questions = [null]; }
};
for (const [name, mutate] of Object.entries(mutations)) test(`Reject backup: ${name}`, () => {
  const value = fixture(); mutate(value); assert.throws(() => parseWorkspaceBackup(JSON.stringify(value)));
});
for (const invalid of ['{broken', 'null', '[]', '42', '"text"']) test(`Reject malformed backup ${invalid}`, () => assert.throws(() => parseWorkspaceBackup(invalid)));
test('Byte limits apply to decoded UTF-8 size, not just character count', () => {
  assert.throws(() => parseWorkspaceBackup(' '.repeat(MAX_BACKUP_BYTES + 1)));
  assert.throws(() => parseWorkspaceBackup('😀'.repeat(MAX_BACKUP_BYTES / 3)));
});
test('Prototype keys are rejected, never merged into application objects', () => {
  const raw = createWorkspaceBackup(source, draft).replace('"version": 1', '"version": 1, "__proto__": {"polluted": true}');
  assert.throws(() => parseWorkspaceBackup(raw)); assert.equal({}.polluted, undefined);
});
test('Validation returns detached structures so callers cannot mutate original state', () => {
  const original = fixture(); const restored = parseWorkspaceBackup(JSON.stringify(original));
  restored.draft.questions.push('New'); restored.source.notes = 'Changed';
  assert.equal(original.draft.questions.length, 1); assert.equal(original.source.notes, source.notes);
  const cloned = validateDraft(draft); cloned.questions.length = 0; assert.equal(draft.questions.length, 1);
});
test('Publication exports still omit notes and review questions', () => {
  const result = createMarkdown(parseWorkspaceBackup(createWorkspaceBackup(source, draft)).draft);
  assert.ok(result.includes('draft: true')); assert.ok(!result.includes(source.notes)); assert.ok(!result.includes(draft.questions[0]));
});
test('Profile guidance has a programmatic association and polite announcements', () => {
  assert.match(appPage, /<select[^>]*id="profile"[^>]*aria-describedby="profile-help"/);
  assert.match(appPage, /id="profile-help"[^>]*aria-live="polite"[^>]*aria-atomic="true"/);
  assert.match(appPage, /id="notes"[^>]*aria-describedby="notes-help note-count"/);
  assert.match(appPage, /id="restore-backup"[^>]*type="file"/);
});
