import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { installRecovery } from '../public/recovery.js';
import { createWorkspaceBackup, MAX_BACKUP_BYTES } from '../public/workspace.js';
import { createCheckpointHistory } from '../public/revisions.js';
import { createReadingPage } from '../public/html-export.js';

const fixture = (body = 'Current article.') => ({
  source: { profile: 'guide', audience: 'Current readers', purpose: 'Explain the example', notes: 'CURRENT_PRIVATE_NOTES' },
  draft: { title: 'Current title', excerpt: 'Current excerpt', description: 'Current description', slug: 'current-title', body, questions: ['CURRENT_PRIVATE_REVIEW'] }
});
class Node {
  constructor(tag = 'div') { this.tagName = tag.toUpperCase(); this.value = ''; this.checked = false; this.hidden = false; this.disabled = false; this.children = []; this.events = {}; this.attrs = {}; this.text = ''; this.parentElement = null; }
  append(...nodes) { for (const node of nodes) this.children.push(...(node.tagName === 'FRAGMENT' ? node.children : [node])); }
  replaceChildren(...nodes) { this.children = []; this.append(...nodes); if (this.tagName === 'SELECT') this.value = String(this.children[0]?.value || ''); }
  addEventListener(event, fn) { this.events[event] = fn; }
  fire(event = 'click') { return this.events[event]?.(); }
  hasAttribute(name) { return Object.hasOwn(this.attrs, name); }
  setAttribute(name, value) { this.attrs[name] = value; }
  focus() { this.focused = true; }
  scrollIntoView() { this.scrolled = true; }
  set textContent(text) { this.text = text; this.children = []; }
  get textContent() { return this.text + this.children.map(node => node.textContent).join(''); }
}
async function withUI(run) {
  const old = { document: globalThis.document, confirm: globalThis.confirm }, nodes = new Map();
  const $ = id => { if (!nodes.has(id)) nodes.set(id, new Node(id === 'restore-field' ? 'select' : 'div')); return nodes.get(id); };
  const state = { current: fixture(), approved: true, accepted: true, busy: false, importing: false, restores: 0, confirmations: 0, warnings: 0, busyUpdates: 0, messages: [], failCheckpoint: false };
  const history = createCheckpointHistory();
  globalThis.document = { getElementById: $, createElement: tag => new Node(tag), createDocumentFragment: () => new Node('fragment'), createTextNode: text => { const node = new Node('text'); node.textContent = text; return node; } };
  globalThis.confirm = () => { state.confirmations++; return state.accepted; };
  let ui;
  try {
    ui = installRecovery({
      capture: () => state.current, hasWork: () => true, isBusy: () => state.busy, hasPendingImport: () => state.importing,
      workChanged: () => state.warnings++, busyChanged: () => state.busyUpdates++, report: text => state.messages.push(text),
      restore: value => {
        if (state.failCheckpoint) throw new Error('Checkpoint refused. Current writing is unchanged.');
        const checkpoint = history.save(state.current, 'Before workspace restore');
        // Exercise the real desk's synchronous clear and refresh order.
        ui.clear(); state.current = value; state.approved = false; state.restores++; ui.update(); return { checkpointed: Boolean(checkpoint.id), evicted: checkpoint.evicted };
      }
    });
    const choose = async (value, override = {}) => {
      const content = typeof value === 'string' ? value : createWorkspaceBackup(value.source, value.draft);
      $('restore-backup').files = [{ name: 'fictional-backup.json', size: new TextEncoder().encode(content).length, text: async () => content, ...override }];
      await $('restore-backup').fire('change');
    };
    const acknowledge = () => { $('restore-reviewed').checked = true; $('restore-reviewed').fire('change'); };
    await run({ $, state, ui, history, choose, acknowledge });
  } finally { globalThis.document = old.document; globalThis.confirm = old.confirm; }
}

test('Selecting a private backup stages all fields without changing current work, approval or history', async () => withUI(async ({ $, state, ui, history, choose }) => {
  const before = structuredClone(state.current), target = fixture('BACKUP_ARTICLE_END'); target.source.notes = 'BACKUP_PRIVATE_NOTES'; target.draft.questions = ['BACKUP_PRIVATE_REVIEW']; target.draft.excerpt = '';
  await choose(target);
  assert.deepEqual(state.current, before); assert.equal(state.approved, true); assert.equal(state.confirmations, 0); assert.equal(history.list().length, 0);
  assert.equal(ui.pending(), true); assert.equal($('restore-preview').hidden, false); assert.equal($('apply-restore').disabled, true);
  assert.equal($('restore-current').value, before.draft.body); assert.equal($('restore-proposed').value, target.draft.body);
  assert.equal($('restore-field').children.length, 10); assert.match($('restore-summary').textContent, /Fields that will become empty: Excerpt/);
  $('restore-field').value = 'notes'; $('restore-field').fire('change'); assert.equal($('restore-proposed').value, 'BACKUP_PRIVATE_NOTES');
  $('restore-field').value = 'questions'; $('restore-field').fire('change'); assert.match($('restore-proposed').value, /BACKUP_PRIVATE_REVIEW/);
  assert.ok($('restore-preview-heading').focused && $('restore-preview-heading').scrolled); assert.ok(state.warnings > 0);
  assert.doesNotMatch(createReadingPage(state.current.draft), /BACKUP_ARTICLE|BACKUP_PRIVATE/);
}));

test('Applying requires current acknowledgement, supports cancellation, and checkpoints before replacement', async () => withUI(async ({ $, state, ui, history, choose, acknowledge }) => {
  const original = structuredClone(state.current), target = fixture('Restored body.'); target.source.notes = '';
  await choose(target); $('apply-restore').fire(); assert.equal(state.restores, 0);
  acknowledge(); assert.equal($('apply-restore').disabled, false); ui.update(); assert.equal($('restore-reviewed').checked, true);
  state.accepted = false; $('apply-restore').fire(); assert.deepEqual(state.current, original); assert.equal(ui.pending(), true); assert.equal($('restore-reviewed').checked, false);
  state.accepted = true; acknowledge(); $('apply-restore').fire();
  assert.deepEqual(state.current.source, target.source); assert.deepEqual(state.current.draft, target.draft); assert.equal(state.approved, false); assert.equal(state.restores, 1);
  assert.deepEqual(history.read(history.list()[0].id).draft, original.draft); assert.equal(history.read(history.list()[0].id).source.notes, original.source.notes);
  assert.equal(ui.pending(), false); assert.equal($('restore-preview').hidden, true); assert.equal($('restore-proposed').value, ''); assert.equal($('restore-current').value, '');
  assert.equal($('restore-article-preview').children.length, 0); assert.match($('restore-status').textContent, /Reviewed backup restored locally/);
}));

test('Editing any source field invalidates approval and refreshes the exact comparison, including at apply time', async () => withUI(async ({ $, state, ui, choose, acknowledge }) => {
  await choose(fixture('Backup.')); acknowledge();
  state.current.source.notes = 'Changed since preview 🐈\r\nENDING'; ui.update();
  assert.equal($('restore-reviewed').checked, false); assert.equal($('apply-restore').disabled, true); assert.match($('restore-status').textContent, /Current writing changed/);
  $('restore-field').value = 'notes'; $('restore-field').fire('change'); assert.equal($('restore-current').value, state.current.source.notes);
  acknowledge(); state.current.draft.title = 'Changed without a refresh'; $('apply-restore').fire();
  assert.equal(state.restores, 0); assert.equal($('restore-reviewed').checked, false); assert.equal(state.approved, true);
}));

test('Invalid or oversized files discard stale previews and leave all existing writing intact', async () => withUI(async ({ $, state, ui, choose, acknowledge }) => {
  const before = structuredClone(state.current);
  for (const invalid of ['{broken', '{"format":"drafttopage-workspace","version":99}', JSON.stringify({ ...fixture(), format: 'drafttopage-workspace', version: 1, extra: true })]) {
    await choose(fixture('Earlier candidate')); acknowledge(); await choose(invalid);
    assert.equal(ui.pending(), false); assert.equal($('restore-preview').hidden, true); assert.equal($('restore-proposed').value, ''); assert.equal($('restore-article-preview').children.length, 0);
  }
  let read = false; await choose('{}', { size: MAX_BACKUP_BYTES + 1, text: async () => { read = true; return '{}'; } });
  assert.equal(read, false); assert.match($('restore-status').textContent, /512 KiB/); assert.deepEqual(state.current, before); assert.equal(state.approved, true); assert.equal(state.restores, 0);
}));

test('Busy operations and unfinished article imports cannot apply a staged backup', async () => withUI(async ({ $, state, ui, choose, acknowledge }) => {
  await choose(fixture('Backup.')); acknowledge(); state.busy = true; ui.update(); $('apply-restore').fire();
  assert.equal($('backup-controls').disabled, true); assert.equal(state.restores, 0);
  state.busy = false; state.importing = true; ui.update(); acknowledge(); $('apply-restore').fire();
  assert.equal(state.restores, 0); assert.match($('restore-status').textContent, /import is unfinished/);
  state.importing = false; ui.update(); assert.equal($('restore-reviewed').checked, false); assert.match($('restore-status').textContent, /finished or cleared/);
  acknowledge(); assert.equal($('apply-restore').disabled, false);
}));

test('A failed checkpoint preserves the current workspace, approval and staged file for retry', async () => withUI(async ({ $, state, ui, history, choose, acknowledge }) => {
  const before = structuredClone(state.current); await choose(fixture('Backup.')); acknowledge(); state.failCheckpoint = true; $('apply-restore').fire();
  assert.deepEqual(state.current, before); assert.equal(state.approved, true); assert.equal(ui.pending(), true); assert.equal(history.list().length, 0); assert.match($('restore-status').textContent, /Checkpoint refused/);
  state.failCheckpoint = false; $('apply-restore').fire(); assert.equal(state.restores, 1); assert.equal(history.list().length, 1);
}));

test('Matching files are no-ops and discarding a preview purges its private text without changing writing', async () => withUI(async ({ $, state, ui, history, choose, acknowledge }) => {
  await choose(state.current); acknowledge(); $('apply-restore').fire(); assert.equal(state.restores, 0); assert.equal(history.list().length, 0); assert.match($('restore-summary').textContent, /matches your current writing/);
  await choose(fixture('PRIVATE_CANDIDATE')); $('discard-restore').fire();
  assert.equal(ui.pending(), false); assert.equal($('restore-field').children.length, 0); assert.equal($('restore-proposed').value, ''); assert.equal($('restore-file-name').textContent, ''); assert.equal($('restore-article-preview').children.length, 0);
  assert.equal(state.approved, true); assert.equal($('restore-backup').focused, true);
}));

test('Clearing during an asynchronous read prevents a late file result from restoring a discarded preview', async () => withUI(async ({ $, state, ui, choose }) => {
  let resolve; const delayed = new Promise(done => { resolve = done; });
  const read = choose('{}', { text: () => delayed }); assert.equal(ui.reading(), true); assert.equal($('backup-controls').disabled, true);
  ui.clear(); resolve(createWorkspaceBackup(fixture('LATE_PRIVATE_TEXT').source, fixture('LATE_PRIVATE_TEXT').draft)); await read;
  assert.equal(ui.reading(), false); assert.equal(ui.pending(), false); assert.equal($('restore-preview').hidden, true); assert.equal($('restore-article-preview').children.length, 0); assert.equal(state.restores, 0);
}));

test('Invalid current fields block comparison and replacement until corrected', async () => withUI(async ({ $, state, ui, choose, acknowledge }) => {
  await choose(fixture('Backup.')); state.current.source.notes = 'Invalid\u0000text'; ui.update(); acknowledge(); $('apply-restore').fire();
  assert.equal(state.restores, 0); assert.equal(ui.pending(), true); assert.equal($('restore-current').value, ''); assert.match($('restore-status').textContent, /Correct the current writing/);
  state.current.source.notes = 'Corrected'; ui.update(); assert.equal($('restore-reviewed').checked, false); acknowledge(); assert.equal($('apply-restore').disabled, false);
}));

test('Source-only backups explicitly show cleared article fields and keep script and image text inert', async () => withUI(async ({ $, state, choose, acknowledge }) => {
  await choose({ source: fixture().source, draft: null }); assert.match($('restore-summary').textContent, /Fields that will become empty:.*Article body/);
  acknowledge(); $('apply-restore').fire(); assert.equal(state.current.draft, null);
  const target = fixture('<script>fictional()</script>\n\n![PRIVATE_IMAGE](https://example.com/a.png)\n\n[Safe](https://example.com/source)');
  target.draft.title = '<img src=x onerror=fictional()>'; await choose(target, { name: '<script>filename</script>.json' });
  const all = node => [node, ...node.children.flatMap(all)]; const rendered = all($('restore-article-preview'));
  assert.ok(!rendered.some(node => ['SCRIPT', 'IMG', 'IFRAME'].includes(node.tagName))); assert.equal(rendered.filter(node => node.tagName === 'A').length, 1);
  assert.match($('restore-article-preview').textContent, /<script>fictional\(\)<\/script>/); assert.equal($('restore-file-name').textContent, 'Selected file: <script>filename</script>.json');
}));

test('Review notes with embedded numbered lines retain distinct list boundaries', async () => withUI(async ({ $, state, choose, acknowledge }) => {
  state.current.draft.questions = ['First', 'Second'];
  const target = structuredClone(state.current); target.draft.questions = ['First\n\n2. Second'];
  await choose(target); assert.match($('restore-summary').textContent, /Review notes/);
  $('restore-field').value = 'questions'; $('restore-field').fire('change');
  assert.deepEqual(JSON.parse($('restore-current').value), ['First', 'Second']); assert.deepEqual(JSON.parse($('restore-proposed').value), target.draft.questions);
  acknowledge(); $('apply-restore').fire(); assert.deepEqual(state.current.draft.questions, target.draft.questions);
}));

test('All public desks and the inactive pilot share the accessible staged restore without new storage or schemas', async () => {
  for (const route of ['write', 'word-to-wordpress', 'word-to-markdown', 'google-docs-to-wordpress', 'markdown-to-wordpress', 'markdown-to-html', 'markdown-to-word']) {
    const html = await readFile('public/' + route + '/index.html', 'utf8');
    for (const id of ['workspace-files', 'restore-preview', 'restore-field', 'restore-current', 'restore-proposed', 'restore-reviewed', 'apply-restore', 'discard-restore', 'restore-status']) assert.equal(html.split('id="' + id + '"').length, 2);
    assert.match(html, /id="restore-preview"[^>]*hidden/); assert.match(html, /id="apply-restore"[^>]*disabled/);
    assert.match(html, /id="restore-status"[^>]*role="status"/);
  }
  const controller = await readFile('public/recovery.js', 'utf8'); assert.doesNotMatch(controller, /fetch\s*\(|XMLHttpRequest|localStorage|sessionStorage|indexedDB|innerHTML|outerHTML/);
  const desk = await readFile('public/desk.js', 'utf8'); assert.match(desk, /revisions\.captureBefore\('Before workspace restore'\); fill\(value\)/);
  assert.match(desk, /recovery\?\.update\(\)/); assert.match(desk, /Boolean\(recovery\?\.pending\(\)\)/);
  const pilot = await readFile('public/pilot.js', 'utf8'); assert.match(pilot, /recovery\.clear\(\)/); assert.match(pilot, /recovery\?\.pending\(\)/);
});
