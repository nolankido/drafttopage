import test from 'node:test';
import assert from 'node:assert/strict';
import { createCheckpointHistory, compareWorkspaces, MAX_CHECKPOINTS, MAX_CHECKPOINT_BYTES } from '../public/revisions.js';
import { createWorkspaceBackup, parseWorkspaceBackup } from '../public/workspace.js';
import { createMarkdown } from '../public/markdown.js';
import { installRevisions } from '../public/revision-controls.js';

const fixture = body => ({ source: { profile: 'update', notes: 'Fictional private source.', audience: 'Readers', purpose: 'Explain' }, draft: { title: 'Fictional version', excerpt: 'Summary', description: 'Description', slug: 'fictional-version', body, questions: ['Fictional private question?'] } });
test('Checkpoints preserve incomplete writing and return independent validated copies', () => {
  const history = createCheckpointHistory(), value = fixture('First'); value.draft.slug = 'unfinished filename';
  const { id } = history.save(value, 'Before rewriting');
  value.source.notes = 'Changed source'; value.draft.questions.push('Changed question');
  const saved = history.read(id); assert.equal(saved.source.notes, 'Fictional private source.'); assert.equal(saved.draft.questions.length, 1);
  saved.draft.body = 'Changed copy'; assert.equal(history.read(id).draft.body, 'First');
  assert.deepEqual(parseWorkspaceBackup(history.download(id)), history.read(id));
});
test('Empty work is ignored, consecutive identical checkpoints deduplicate, and invalid saves preserve history', () => {
  const history = createCheckpointHistory();
  assert.equal(history.save({ source: { profile: 'personal', notes: '', audience: '', purpose: '' }, draft: null }).empty, true);
  const value = fixture('First'), result = history.save(value);
  assert.equal(history.save(value, 'Same work').id, result.id); assert.equal(history.save(value).duplicate, true);
  for (const bad of [fixture('x'.repeat(60001)), { ...value, source: { ...value.source, notes: '\u0000' } }]) assert.throws(() => history.save(bad));
  assert.throws(() => history.save(fixture('Second'), 'x'.repeat(81)));
  assert.equal(history.list().length, 1); assert.equal(history.read(result.id).draft.body, 'First');
});
test('Count and UTF-8 bounds evict oldest versions while retaining the newest', () => {
  const history = createCheckpointHistory(); let first;
  for (let i = 0; i < 8; i++) { const result = history.save(fixture('Version ' + i)); first ??= result.id; }
  assert.equal(history.list().length, MAX_CHECKPOINTS); assert.throws(() => history.read(first));
  assert.equal(history.read(history.list().at(-1).id).draft.body, 'Version 7');
  const dense = createCheckpointHistory();
  for (let i = 0; i < 6; i++) {
    const value = fixture('\u0001'.repeat(60000)); value.source.notes = '\u0001'.repeat(8000); value.draft.questions = Array(12).fill('漢'.repeat(499) + i);
    dense.save(value);
  }
  assert.ok(dense.list().reduce((sum, item) => sum + item.bytes, 0) <= MAX_CHECKPOINT_BYTES);
  assert.ok(dense.list().length < MAX_CHECKPOINTS);
});
test('Private checkpoint download keeps the exact version-1 format and article exports exclude history and source', () => {
  const history = createCheckpointHistory(), value = fixture('Article text.');
  const { id } = history.save(value, 'Fictional checkpoint label');
  assert.equal(history.download(id), createWorkspaceBackup(value.source, value.draft));
  for (const key of ['label', 'created', 'history', 'reviewed', 'consent', 'password']) assert.ok(!history.download(id).includes('"' + key + '":'));
  const article = createMarkdown(history.read(id).draft);
  for (const text of [value.source.notes, value.draft.questions[0], 'Fictional checkpoint label']) assert.ok(!article.includes(text));
  history.clear(); assert.equal(history.hasWriting(), false); assert.deepEqual(history.list(), []); assert.throws(() => history.download(id));
});
test('Comparison covers source, article metadata, body and question text without inventing a line diff', () => {
  const saved = fixture('Before\n\n<script>fictional()</script>'), current = fixture('After\n\n<script>fictional()</script>');
  current.source.notes = 'Changed source'; current.draft.questions = ['Changed question']; current.draft.title = 'New title';
  const comparison = compareWorkspaces(saved, current);
  assert.deepEqual(comparison.filter(field => field.changed).map(field => field.id), ['notes', 'title', 'body', 'questions']);
  assert.equal(comparison.find(field => field.id === 'body').saved, saved.draft.body);
  assert.equal(compareWorkspaces(saved, saved).some(field => field.changed), false);
  assert.ok(compareWorkspaces(saved, { source: saved.source, draft: null }).find(field => field.id === 'body').changed);
});

// Controller contract tests use minimal event-bearing controls, not a rendering/browser substitute.
function controls() {
  class Control {
    constructor() { this.value = ''; this.checked = false; this.children = []; this.listeners = {}; }
    addEventListener(name, callback) { this.listeners[name] = callback; }
    replaceChildren(...children) { this.children = children; this.value = String(children[0]?.value ?? ''); }
    fire(name = 'click') { this.listeners[name]?.(); }
  }
  const elements = new Map();
  return { elements, document: { getElementById: id => { if (!elements.has(id)) elements.set(id, new Control()); return elements.get(id); }, createElement: () => new Control() } };
}
test('Controller saves without changing approval, compares edits, cancels safely, and retains the displaced version for redo', () => {
  const previous = { document: globalThis.document, confirm: globalThis.confirm }, fake = controls();
  globalThis.document = fake.document; let accepted = false; globalThis.confirm = () => accepted;
  let current = fixture('Before'), approved = true, busy = false, message = '', warningUpdates = 0;
  try {
    const ui = installRevisions({ capture: () => current, restore: value => { current = value; approved = false; }, isBusy: () => busy, workChanged: () => warningUpdates++, report: text => { message = text; } });
    const $ = id => fake.document.getElementById(id);
    $('save-checkpoint').fire(); const original = $('checkpoint-select').value;
    assert.ok(ui.hasWriting()); assert.equal(approved, true); assert.ok(warningUpdates > 0);
    current = fixture('After'); ui.update(); assert.equal($('checkpoint-saved').value, 'Before'); assert.equal($('checkpoint-current').value, 'After');
    assert.deepEqual(ui.articleComparison(), { saved: 'Before', current: 'After' });
    const independent = ui.articleComparison(); independent.saved = 'Changed copy'; assert.equal(ui.articleComparison().saved, 'Before');
    $('checkpoint-private-ok').checked = true; $('checkpoint-private-ok').fire('change'); assert.equal($('download-checkpoint').disabled, false);
    $('restore-checkpoint').fire(); assert.equal(current.draft.body, 'After'); assert.equal(approved, true); assert.match(message, /cancelled/);
    accepted = true; $('restore-checkpoint').fire(); assert.equal(current.draft.body, 'Before'); assert.equal(approved, false);
    assert.equal($('checkpoint-private-ok').checked, false); assert.notEqual($('checkpoint-select').value, original);
    $('restore-checkpoint').fire(); assert.equal(current.draft.body, 'After');
    busy = true; ui.update(); assert.equal($('save-checkpoint').disabled, true); assert.equal($('restore-checkpoint').disabled, true);
    $('restore-checkpoint').fire(); assert.equal(current.draft.body, 'After');
    busy = false; ui.clear(); assert.equal(ui.hasWriting(), false); assert.equal($('checkpoint-comparison').hidden, true);
    assert.equal($('checkpoint-saved').value, ''); assert.equal($('checkpoint-current').value, '');
    assert.equal($('checkpoint-field').children.length, 0);
    assert.equal(ui.articleComparison(), null);
  } finally { globalThis.document = previous.document; globalThis.confirm = previous.confirm; }
});
test('Controller captures before replacement and blocks loss when current writing cannot be checkpointed', () => {
  const previous = globalThis.document, fake = controls(); globalThis.document = fake.document;
  let current = fixture('Original');
  try {
    const ui = installRevisions({ capture: () => current, restore: () => {}, isBusy: () => false, workChanged: () => {}, report: () => {} });
    ui.captureBefore('Before import'); current = fixture('Replacement'); ui.update();
    assert.equal(fake.document.getElementById('checkpoint-saved').value, 'Original');
    current.draft.body = 'x'.repeat(60001); assert.throws(() => ui.captureBefore('Before another import'));
    assert.equal(fake.document.getElementById('checkpoint-saved').value, 'Original');
    ui.update(); assert.equal(ui.articleComparison(), null);
  } finally { globalThis.document = previous; }
});
test('Restoring the oldest full-history checkpoint remains safe when retaining current writing evicts that target', () => {
  const previous = { document: globalThis.document, confirm: globalThis.confirm }, fake = controls();
  globalThis.document = fake.document; globalThis.confirm = () => true;
  let current = fixture('Version 0');
  try {
    const ui = installRevisions({ capture: () => current, restore: value => { current = value; }, isBusy: () => false, workChanged: () => {}, report: () => {} });
    const $ = id => fake.document.getElementById(id);
    for (let i = 0; i < MAX_CHECKPOINTS; i++) { current = fixture('Version ' + i); $('save-checkpoint').fire(); }
    const oldest = $('checkpoint-select').children.at(-1).value;
    current = fixture('Displaced sixth version'); ui.update();
    $('checkpoint-select').value = oldest; $('checkpoint-select').fire('change'); $('restore-checkpoint').fire();
    assert.equal(current.draft.body, 'Version 0');
    assert.equal($('checkpoint-select').children.some(option => option.value === oldest), false);
    $('restore-checkpoint').fire(); assert.equal(current.draft.body, 'Displaced sixth version');
  } finally { globalThis.document = previous.document; globalThis.confirm = previous.confirm; }
});
