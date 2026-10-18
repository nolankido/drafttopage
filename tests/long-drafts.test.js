import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { ARTICLE_BODY_LIMIT, MAX_IMPORT_BYTES, MAX_BACKUP_BYTES, MAX_ZIP_BYTES, MAX_CHECKPOINT_BYTES } from '../public/writing-limits.js';
import { parseArticleImport } from '../public/article-import.js';
import { createWorkspaceBackup, parseWorkspaceBackup } from '../public/workspace.js';
import { createCheckpointHistory } from '../public/revisions.js';
import { compareArticleLines } from '../public/revision-diff.js';
import { articleSections, moveArticleSection } from '../public/article-sections.js';
import { findArticleMatches, replaceArticleMatch } from '../public/article-search.js';
import { formatMarkdown } from '../public/editing.js';
import { createMarkdown } from '../public/markdown.js';
import { createReadingPage, createFormattedArticle } from '../public/html-export.js';
import { createPublishingKit } from '../public/publishing-kit.js';
import { createWordPressArticle } from '../public/wordpress-export.js';
import { createWordPressKit, wordPressKitFiles } from '../public/wordpress-kit.js';
import { reviewWordPress } from '../public/wordpress-review.js';
import { pastedTextFits, installPasteGuard } from '../public/paste-guard.js';

const source = { profile: 'guide', notes: 'PRIVATE FICTIONAL SOURCE', audience: '', purpose: '' };
const draft = body => ({ title: 'Fictional long guide', excerpt: 'Fictional excerpt', description: 'Fictional description', slug: 'fictional-long-guide', body, questions: ['PRIVATE FICTIONAL QUESTION'] });
const ending = '\n\n## Last section\nKEEP THE ENTIRE ENDING';
const body = '## First section\n' + '界'.repeat(ARTICLE_BODY_LIMIT - 17 - ending.length) + ending;

test('Maximum-length Unicode article survives import, version-1 backup, and recovery intact', () => {
  assert.equal(body.length, ARTICLE_BODY_LIMIT);
  assert.equal(parseArticleImport(body).draft.body, body);
  assert.equal(parseArticleImport(JSON.stringify(draft(body))).draft.body, body);
  const backup = createWorkspaceBackup(source, draft(body));
  assert.ok(new TextEncoder().encode(backup).byteLength < MAX_BACKUP_BYTES);
  const restored = parseWorkspaceBackup(backup);
  assert.equal(restored.version, 1); assert.equal(restored.draft.body, body);
  const history = createCheckpointHistory(), saved = history.save(restored);
  assert.equal(history.read(saved.id).draft.body, body);
  assert.equal(history.download(saved.id), backup);
  assert.deepEqual(compareArticleLines(body, body).groups.map(group => group.text), [body]);
});
test('JSON escaping and maximum private fields fit within the backup and checkpoint budgets', () => {
  const value = draft('\u0001'.repeat(ARTICLE_BODY_LIMIT));
  value.title = '\u0001'.repeat(160); value.excerpt = '\u0001'.repeat(300); value.description = '\u0001'.repeat(160);
  value.questions = Array(12).fill('\u0001'.repeat(500));
  const privateSource = { profile: 'guide', notes: '\u0001'.repeat(8000), audience: '\u0001'.repeat(160), purpose: '\u0001'.repeat(240) };
  const content = createWorkspaceBackup(privateSource, value);
  assert.ok(new TextEncoder().encode(content).byteLength < MAX_BACKUP_BYTES);
  assert.equal(parseWorkspaceBackup(content).draft.body, value.body);
  const history = createCheckpointHistory(); let last;
  for (let i = 0; i < 6; i++) { value.body = '\u0001'.repeat(ARTICLE_BODY_LIMIT - 1) + i; last = history.save({ source: privateSource, draft: value }); }
  assert.ok(history.list().length >= 1 && history.list().length < 5);
  assert.ok(history.list().reduce((sum, item) => sum + item.bytes, 0) <= MAX_CHECKPOINT_BYTES);
  assert.equal(history.read(last.id).draft.body, value.body);
});
test('Long-article navigation, replacement, formatting, and section moves retain the final passage', () => {
  const match = findArticleMatches(body, 'ENTIRE')[0];
  const replaced = replaceArticleMatch(body, 'ENTIRE', 'WHOLE!', 0);
  assert.equal(replaced.body.length, ARTICLE_BODY_LIMIT); assert.ok(replaced.body.endsWith('KEEP THE WHOLE! ENDING'));
  assert.equal(match.start, body.indexOf('ENTIRE'));
  assert.throws(() => formatMarkdown(body, match.start, match.end, 'bold'), /60,000/);
  assert.throws(() => replaceArticleMatch(body, 'ENTIRE', 'EVERY PART OF THE', 0), /60,000/);
  const sections = articleSections(body).sections;
  const moved = moveArticleSection(body, sections[1].start, 'up');
  assert.equal(moved.body.length, body.length); assert.ok(moved.body.startsWith('## Last section'));
  assert.equal(moveArticleSection(moved.body, moved.selectionStart, 'down').body, body);
});
test('All article handoffs retain the maximum-length ending and omit private source and questions', () => {
  const value = draft(body), formatted = createFormattedArticle(value);
  const strings = [createMarkdown(value), createReadingPage(value), formatted.html, formatted.text, createWordPressArticle(value).html];
  const files = wordPressKitFiles(value).files;
  assert.equal(files.find(file => file.name === 'article-body.md').content, body);
  for (const result of strings) assert.ok(result.includes('KEEP THE ENTIRE ENDING'));
  for (const content of [...strings, ...files.map(file => file.content)]) {
    assert.ok(!content.includes(source.notes)); assert.ok(!content.includes(value.questions[0]));
  }
  for (const kit of [createPublishingKit(value), createWordPressKit(value)]) assert.ok(kit.bytes.length < MAX_ZIP_BYTES);
  assert.ok(createWordPressKit(value).bytes.length > 512 * 1024, 'Unicode fixture exercises the old ZIP ceiling');
});
test('An independent ZIP reader validates every byte and CRC of a long Unicode WordPress kit', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'drafttopage-long-kit-'));
  try {
    const value = draft(body), kit = createWordPressKit(value), files = wordPressKitFiles(value).files;
    await writeFile(join(folder, 'kit.zip'), kit.bytes);
    await writeFile(join(folder, 'expected.json'), JSON.stringify(Object.fromEntries(files.map(file => [file.name, file.content]))));
    execFileSync('python3', ['-c', "import json,sys,zipfile; from pathlib import Path; p=Path(sys.argv[1]); expected=json.loads((p/'expected.json').read_text()); z=zipfile.ZipFile(p/'kit.zip'); assert z.testzip() is None; assert z.namelist()==list(expected); assert all(z.read(name)==content.encode('utf-8') for name,content in expected.items())", folder]);
  } finally { await rm(folder, { recursive: true, force: true }); }
});
test('Long malformed syntax remains inert and supported review patterns still get findings', () => {
  for (const marker of ['[', '<', '{']) {
    const text = marker.repeat(ARTICLE_BODY_LIMIT), value = draft(text);
    assert.equal(createFormattedArticle(value).text, text);
    assert.equal(reviewWordPress(value).totalFindings, 0);
    assert.ok(!createWordPressArticle(value).html.includes('<script>'));
  }
  const checked = reviewWordPress(draft('[label][reference]\n\n{{missing fact}}\n\n<script>fictional()</script>'));
  for (const kind of ['reference', 'placeholder', 'html']) assert.ok(checked.findings.some(item => item.kind === kind));
});
test('The editor and import box expose matching limits and accessible paste feedback', async () => {
  for (const route of ['write', 'markdown-to-wordpress']) {
    const html = await readFile('public/' + route + '/index.html', 'utf8');
    assert.match(html, new RegExp('id="body"[^>]*maxlength="' + ARTICLE_BODY_LIMIT + '"'));
    assert.match(html, /aria-describedby="body-help body-count body-error body-paste-status"/);
    assert.match(html, /id="desk-status"[^>]*role="status"/);
    assert.match(html, /id="body-paste-status"[^>]*class="field-error small"/);
    assert.doesNotMatch(html, /id="body-paste-status"[^>]*(?:aria-live|role="status")/);
    assert.match(html, new RegExp('id="import-text"[^>]*maxlength="' + MAX_IMPORT_BYTES + '"'));
    assert.match(html, /id="import-paste-status"[^>]*class="field-error small"/);
    assert.doesNotMatch(html, /id="import-paste-status"[^>]*(?:aria-live|role="status")/);
  }
});
test('Paste calculation accounts for replacement, browser newline normalization, Unicode, and UTF-8 bytes', () => {
  assert.equal(pastedTextFits('old', 0, 3, 'x'.repeat(ARTICLE_BODY_LIMIT), ARTICLE_BODY_LIMIT), true);
  assert.equal(pastedTextFits('old', 3, 3, 'x'.repeat(ARTICLE_BODY_LIMIT), ARTICLE_BODY_LIMIT), false);
  assert.equal(pastedTextFits('', 0, 0, 'a\r\nb\rc', 5), true);
  assert.equal(pastedTextFits('', 0, 0, '😀', 2), true);
  assert.equal(pastedTextFits('', 0, 0, '😀', 1), false);
  assert.equal(pastedTextFits('', 0, 0, '界'.repeat(5), 10, 14), false);
  assert.equal(pastedTextFits('界', 0, 1, '界'.repeat(5), 10, 15), true);
  assert.equal(pastedTextFits('', 0, 0, 'a\u0000b', 10), false);
  for (const selection of [[-1, 0], [2, 1], [0, 4], [0.5, 1]]) assert.equal(pastedTextFits('old', ...selection, 'new', 10), false);
});
function guard(value = 'Original draft', limit = ARTICLE_BODY_LIMIT, maxBytes) {
  const listeners = {}, element = { value, selectionStart: 0, selectionEnd: value.length, addEventListener: (name, callback) => { listeners[name] = callback; } };
  let message = '';
  const ui = installPasteGuard({ element, limit, maxBytes, label: 'The article', report: text => { message = text; } });
  const fire = (text, extra = {}) => {
    let prevented = false;
    const event = { clipboardData: { getData: type => { assert.equal(type, 'text/plain'); return text; } }, preventDefault: () => { prevented = true; }, ...extra };
    listeners.paste(event);
    return prevented;
  };
  return { element, fire, listeners, ui, message: () => message };
}
test('Oversized paste is rejected as a whole without changing text or selection', () => {
  const fixture = guard();
  assert.equal(fixture.fire('x'.repeat(ARTICLE_BODY_LIMIT + 1)), true);
  assert.equal(fixture.element.value, 'Original draft'); assert.equal(fixture.element.selectionStart, 0); assert.equal(fixture.element.selectionEnd, 14);
  assert.match(fixture.message(), /60,000/); assert.match(fixture.message(), /Current text is unchanged/);
  fixture.element.selectionStart = fixture.element.selectionEnd;
  assert.equal(fixture.fire('x'.repeat(ARTICLE_BODY_LIMIT)), true);
});
test('Accepted paste uses native editing, and feedback clears on the next valid paste or edit', () => {
  const fixture = guard(); fixture.fire('x'.repeat(ARTICLE_BODY_LIMIT + 1));
  assert.equal(fixture.fire('x'.repeat(ARTICLE_BODY_LIMIT)), false);
  assert.equal(fixture.element.value, 'Original draft', 'Controller leaves insertion and undo to the browser'); assert.equal(fixture.message(), '');
  fixture.fire('x'.repeat(ARTICLE_BODY_LIMIT + 1)); fixture.listeners.input(); assert.equal(fixture.message(), '');
  fixture.fire('x'.repeat(ARTICLE_BODY_LIMIT + 1)); fixture.ui.clear(); assert.equal(fixture.message(), '');
});
test('Missing, unreadable, null, and image-only clipboard content is rejected without mutation', () => {
  const fixture = guard();
  for (const data of [null, { getData: () => { throw new Error('Unavailable'); } }, { getData: () => '' }, { getData: () => 'a\u0000b' }]) assert.equal(fixture.fire('', { clipboardData: data }), true);
  assert.equal(fixture.element.value, 'Original draft');
  const importFixture = guard('', 10, 14);
  assert.equal(importFixture.fire('界'.repeat(5)), true); assert.match(importFixture.message(), /UTF-8/);
});
test('Cancelable paste, drop, and bulk beforeinput are bounded while ordinary keys use native editing', () => {
  const fixture = guard();
  for (const inputType of ['insertFromPaste', 'insertFromDrop', 'insertText']) {
    let prevented = false;
    fixture.listeners.beforeinput({ inputType, cancelable: true, data: 'x'.repeat(ARTICLE_BODY_LIMIT + 1), preventDefault: () => { prevented = true; } });
    assert.equal(prevented, true); assert.equal(fixture.element.value, 'Original draft');
  }
  let prevented = false;
  fixture.listeners.beforeinput({ inputType: 'insertText', cancelable: true, data: 'x', preventDefault: () => { prevented = true; } });
  assert.equal(prevented, false);
});
