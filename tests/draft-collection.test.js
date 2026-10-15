import test from 'node:test';
import assert from 'node:assert/strict';
import { createDraftCollectionState, createDraftCollection, parseDraftCollection, validateDraftCollection, MAX_COLLECTION_BYTES, MAX_COLLECTION_ENTRIES, suggestedArticleName } from '../public/draft-collection.js';
import { installDraftCollection } from '../public/draft-collection-controls.js';
import { createWorkspaceBackup, parseWorkspaceBackup } from '../public/workspace.js';
import { createWordDocument } from '../public/word-export.js';

const workspace = (body = 'Fictional article') => ({ format: 'drafttopage-workspace', version: 1, source: { profile: 'update', notes: 'PRIVATE source notes', audience: 'PRIVATE audience', purpose: 'PRIVATE purpose' }, draft: { title: 'Fictional article title', excerpt: '', description: '', slug: '', body, questions: ['PRIVATE review question'] } });
const file = () => ({ format: 'drafttopage-collection', version: 1, entries: [{ name: 'First article', workspace: workspace('First\r\n\narticle\n') }, { name: 'Second article', workspace: workspace('Second article') }] });
test('Collection file round trip preserves exact writing and the unchanged private workspace contract', () => {
  const value = file(), text = createDraftCollection(value), parsed = parseDraftCollection(text);
  assert.deepEqual(parsed, value);
  for (const entry of parsed.entries) assert.deepEqual(parseWorkspaceBackup(createWorkspaceBackup(entry.workspace.source, entry.workspace.draft)), entry.workspace);
  parsed.entries[0].workspace.source.notes = 'Changed clone'; parsed.entries[1].workspace.draft.questions.push('Changed question');
  assert.equal(value.entries[0].workspace.source.notes, 'PRIVATE source notes'); assert.equal(value.entries[1].workspace.draft.questions.length, 1);
  assert.deepEqual(Object.keys(JSON.parse(text)), ['format', 'version', 'entries']);
  assert.ok(!/"(?:approval|reviewed|history|undo|preferences|consent|password|created)":/.test(text));
});
test('Collections strictly reject unknown fields, unsupported schemas, profiles, backups and malformed entries', () => {
  for (const value of [null, [], {}, { ...file(), version: 2 }, { ...file(), format: 'drafttopage-publishing-profile' }, { ...file(), history: [] }, { ...file(), entries: [] }, { ...file(), entries: 'article' }, workspace(), JSON.parse('{"__proto__":{}}')]) assert.throws(() => validateDraftCollection(value));
  for (const entry of [{ name: 'a', workspace: workspace(), approved: true }, { name: 'a', workspace: { ...workspace(), password: 'no' } }, { name: 'a', workspace: { ...workspace(), draft: { ...workspace().draft, checklist: [] } } }, { name: '', workspace: workspace() }, { name: 'a'.repeat(81), workspace: workspace() }, { name: 'a\nb', workspace: workspace() }]) assert.throws(() => validateDraftCollection({ ...file(), entries: [entry] }));
  assert.throws(() => parseDraftCollection('{'), /valid JSON/);
});
test('Count and byte bounds reject entire operations without evicting saved articles or their undo', () => {
  const state = createDraftCollectionState();
  for (let i = 0; i < MAX_COLLECTION_ENTRIES; i++) state.add(workspace('Article ' + i));
  const before = state.download(); assert.throws(() => state.add(workspace('Ninth')), /eight/); assert.equal(state.download(), before);
  assert.throws(() => parseDraftCollection('😀'.repeat(MAX_COLLECTION_BYTES / 4 + 1)), /2 MiB/);
  const dense = createDraftCollectionState(), large = workspace('\u0001'.repeat(60000)); large.source.notes = '\u0001'.repeat(8000);
  for (let i = 0; i < 5; i++) dense.add(large, String(i));
  const old = dense.download(); assert.throws(() => dense.add(large, 'Too large'), /2 MiB/); assert.equal(dense.download(), old); assert.ok(dense.canUndo());
  assert.throws(() => validateDraftCollection({ ...file(), entries: Array(9).fill(file().entries[0]) }), /eight/);
});
test('Invalid current work and empty writing cannot replace valid saved work', () => {
  const state = createDraftCollectionState(); state.add(workspace()); const before = state.download();
  const bad = workspace('x'.repeat(60001)); assert.throws(() => state.update(0, bad)); assert.throws(() => state.add(bad));
  const empty = { source: { profile: 'personal', notes: '', audience: '', purpose: '' }, draft: null };
  assert.throws(() => state.add(empty), /Add article/); assert.throws(() => state.update(0, empty), /Add article/); assert.equal(state.download(), before);
  for (const index of [-1, NaN, 0.5, '0', 10]) assert.throws(() => state.read(index));
});
test('Add, update, rename, remove and collection replacement have one immutable undo state', () => {
  const state = createDraftCollectionState(), original = workspace('First'); state.add(original, 'A'); original.draft.body = 'Mutated input'; assert.equal(state.read(0).draft.body, 'First');
  const read = state.read(0); read.source.notes = 'Mutated returned value'; assert.equal(state.read(0).source.notes, 'PRIVATE source notes');
  state.update(0, workspace('Updated'), 'B'); state.undo(); assert.equal(state.read(0).draft.body, 'First'); assert.equal(state.list()[0].name, 'A'); assert.equal(state.canUndo(), false);
  state.rename(0, 'Renamed'); state.undo(); assert.equal(state.list()[0].name, 'A');
  state.remove(0); assert.equal(state.list().length, 0); assert.equal(state.hasWriting(), true); state.undo(); assert.equal(state.read(0).draft.body, 'First');
  state.load(file()); state.undo(); assert.equal(state.list().length, 1); assert.equal(state.read(0).draft.body, 'First');
  state.remove(0); state.clear(); assert.equal(state.canUndo(), false); assert.equal(state.undo(), false); assert.equal(state.hasWriting(), false); assert.throws(() => state.read(0));
});
test('No-op updates do not discard undo, and saved snapshots never change with editor edits', () => {
  const state = createDraftCollectionState(), value = workspace('First'); state.add(value, 'A'); state.add(workspace('Second'), 'B'); state.remove(1);
  const revision = state.revision(); state.update(0, value, 'A'); assert.equal(state.revision(), revision); state.undo(); assert.equal(state.list().length, 2);
  value.draft.body = 'Edited after saving'; assert.equal(state.read(0).draft.body, 'First'); assert.equal(state.matches(0, value), false);
});
test('Names remain inert data and suggested Unicode labels fit without splitting a character', () => {
  const state = createDraftCollectionState(); state.add(workspace(), '<script>literal label</script>'); assert.equal(parseDraftCollection(state.download()).entries[0].name, '<script>literal label</script>');
  const value = workspace(); value.draft.title = '😀'.repeat(80); const name = suggestedArticleName(value); assert.equal(name.length, 80); assert.equal([...name].length, 40);
});
test('Article exports use only the chosen current article and cannot acquire other collection entries', () => {
  const state = createDraftCollectionState(); state.add(workspace('SAVED_PRIVATE_OTHER_ARTICLE')); state.add(workspace('Current public article'));
  const bytes = createWordDocument(state.read(1).draft);
  const text = new TextDecoder().decode(bytes); assert.ok(text.includes('Current public article')); assert.ok(!text.includes('SAVED_PRIVATE_OTHER_ARTICLE')); assert.ok(!text.includes('PRIVATE source notes'));
});

class Control {
  constructor() { this.value = ''; this.checked = false; this.open = false; this.disabled = false; this.hidden = false; this.textContent = ''; this.children = []; this.events = new Map(); }
  addEventListener(type, fn) { if (!this.events.has(type)) this.events.set(type, []); this.events.get(type).push(fn); }
  async fire(type) { for (const fn of this.events.get(type) || []) await fn(); }
  replaceChildren(...nodes) { this.children = nodes; }
}
async function controls(run) {
  const prior = globalThis.document, elements = new Map(), $ = id => { if (!elements.has(id)) elements.set(id, new Control()); return elements.get(id); };
  globalThis.document = { getElementById: $, createElement: () => new Control() };
  let current = workspace('Current editor'), busy = false, accepted = true, openFailure = false, pendingPreparation = false, opens = 0, downloaded = null;
  const previousWriting = [];
  const ui = installDraftCollection({ capture: () => current, hasUnsavedPreparation: () => pendingPreparation, isBusy: () => busy, workChanged: () => {}, report: () => {}, confirmAction: () => accepted, download: (...args) => { downloaded = args; }, openWorkspace: value => { if (openFailure) throw new Error('Checkpoint unavailable. Writing kept.'); previousWriting.push(current); current = value; $('reviewed').checked = false; opens++; } });
  const load = async (value = file(), size) => { const content = typeof value === 'string' ? value : JSON.stringify(value); $('load-draft-collection').files = [{ size: size ?? new TextEncoder().encode(content).byteLength, text: async () => content }]; await $('load-draft-collection').fire('change'); };
  try { await run({ $, ui, load, current: () => current, setCurrent: value => { current = value; ui.update(); }, accepted: value => { accepted = value; }, busy: value => { busy = value; ui.update(); }, failOpen: value => { openFailure = value; }, pendingPreparation: value => { pendingPreparation = value; }, opens: () => opens, previousWriting, downloaded: () => downloaded }); }
  finally { globalThis.document = prior; }
}
test('Adding and updating entries preserves current writing and approval, and only explicit updates reach downloads', () => controls(async ({ $, ui, current, setCurrent, downloaded }) => {
  $('reviewed').checked = true; const before = JSON.stringify(current()); await $('add-to-draft-collection').fire('click');
  assert.equal(JSON.stringify(current()), before); assert.equal($('reviewed').checked, true); assert.equal($('download-draft-collection').disabled, true);
  setCurrent(workspace('Unsaved editor change')); $('draft-collection-private-ok').checked = true; await $('download-draft-collection').fire('click');
  assert.equal(parseDraftCollection(downloaded()[0]).entries[0].workspace.draft.body, 'Current editor');
  await $('update-draft-collection-entry').fire('click'); assert.equal($('draft-collection-private-ok').checked, false); $('draft-collection-private-ok').checked = true; await $('download-draft-collection').fire('click');
  assert.equal(parseDraftCollection(downloaded()[0]).entries[0].workspace.draft.body, 'Unsaved editor change'); assert.equal($('reviewed').checked, true);
  await $('undo-draft-collection').fire('click'); ui.update(); assert.match($('draft-collection-selected-status').textContent, /differs/);
}));
test('File preview and cancellation change neither editor, existing collection, nor approval', () => controls(async ({ $, load, current, opens }) => {
  await $('add-to-draft-collection').fire('click'); const before = JSON.stringify(current()); $('reviewed').checked = true;
  await load(); assert.equal($('draft-collection-file-preview').hidden, false); assert.equal($('draft-collection-file-entries').children.length, 2); assert.match($('draft-collection-count').textContent, /^1 \/ 8/);
  await $('cancel-draft-collection').fire('click'); assert.equal($('draft-collection-file-preview').hidden, true); assert.equal($('draft-collection-file-entries').children.length, 0);
  assert.equal(JSON.stringify(current()), before); assert.equal($('reviewed').checked, true); assert.equal(opens(), 0);
}));
test('Loading a collection replaces only saved entries, can be cancelled, and is recoverable with undo', () => controls(async ({ $, load, current, accepted }) => {
  await $('add-to-draft-collection').fire('click'); const before = JSON.stringify(current()); $('reviewed').checked = true;
  await load(); accepted(false); await $('apply-draft-collection').fire('click'); assert.match($('draft-collection-count').textContent, /^1 \/ 8/); assert.equal($('draft-collection-file-preview').hidden, false);
  accepted(true); await $('apply-draft-collection').fire('click'); assert.match($('draft-collection-count').textContent, /^2 \/ 8/); assert.equal(JSON.stringify(current()), before); assert.equal($('reviewed').checked, true);
  await $('undo-draft-collection').fire('click'); assert.match($('draft-collection-count').textContent, /^1 \/ 8/); assert.equal(JSON.stringify(current()), before);
}));
test('Opening is separate, supports cancellation, and delegates checkpoint protection before replacing editor work', () => controls(async ({ $, load, accepted, current, opens, previousWriting, failOpen }) => {
  await load(); await $('apply-draft-collection').fire('click'); const before = JSON.stringify(current()); $('reviewed').checked = true;
  accepted(false); await $('open-draft-collection-entry').fire('click'); assert.equal(opens(), 0); assert.equal($('reviewed').checked, true);
  accepted(true); failOpen(true); await $('open-draft-collection-entry').fire('click'); assert.equal(JSON.stringify(current()), before); assert.equal(opens(), 0); assert.match($('draft-collection-status').textContent, /Checkpoint unavailable/);
  failOpen(false); await $('open-draft-collection-entry').fire('click'); assert.equal(opens(), 1); assert.equal(current().draft.body, 'First\r\n\narticle\n'); assert.equal(JSON.stringify(previousWriting[0]), before); assert.equal($('reviewed').checked, false);
  assert.match($('draft-collection-count').textContent, /^2 \/ 8/);
}));
test('Invalid current fields block opening while retaining saved-entry download and all writing', () => controls(async ({ $, ui, load, setCurrent, current, downloaded, opens }) => {
  await load(); await $('apply-draft-collection').fire('click'); setCurrent(workspace('x'.repeat(60001))); const before = JSON.stringify(current());
  assert.equal($('open-draft-collection-entry').disabled, true); await $('open-draft-collection-entry').fire('click'); assert.equal(opens(), 0); assert.equal(JSON.stringify(current()), before);
  $('draft-collection-private-ok').checked = true; ui.update(); assert.equal($('download-draft-collection').disabled, false); await $('download-draft-collection').fire('click'); assert.equal(parseDraftCollection(downloaded()[0]).entries.length, 2);
}));
test('Hidden inspection content purges on close, selection change reads the right article, and removal has undo', () => controls(async ({ $, ui, load }) => {
  await load(); await $('apply-draft-collection').fire('click'); assert.equal($('draft-collection-saved-preview').value, '');
  $('draft-collection-inspection').open = true; await $('draft-collection-inspection').fire('toggle'); assert.equal(parseWorkspaceBackup($('draft-collection-saved-preview').value).draft.body, 'First\r\n\narticle\n');
  $('draft-collection-select').value = '1'; await $('draft-collection-select').fire('change'); assert.equal(parseWorkspaceBackup($('draft-collection-saved-preview').value).draft.body, 'Second article');
  $('draft-collection-inspection').open = false; await $('draft-collection-inspection').fire('toggle'); assert.equal($('draft-collection-saved-preview').value, '');
  await $('remove-draft-collection-entry').fire('click'); assert.match($('draft-collection-count').textContent, /^1 \/ 8/); await $('undo-draft-collection').fire('click'); ui.update(); assert.match($('draft-collection-count').textContent, /^2 \/ 8/);
}));
test('Rejected replacement files purge pending preview while retaining the collection and approval', () => controls(async ({ $, load }) => {
  await load(); await $('apply-draft-collection').fire('click'); $('reviewed').checked = true;
  await load(); const invalid = file(); invalid.entries[1].workspace.draft.body = 'x'.repeat(60001); await load(invalid);
  assert.equal($('draft-collection-file-preview').hidden, true); assert.equal($('draft-collection-file-entries').children.length, 0); assert.equal($('apply-draft-collection').disabled, true); assert.match($('draft-collection-count').textContent, /^2 \/ 8/); assert.equal($('reviewed').checked, true);
  let read = false; $('load-draft-collection').files = [{ size: MAX_COLLECTION_BYTES + 1, text: async () => { read = true; return '{}'; } }]; await $('load-draft-collection').fire('change'); assert.equal(read, false);
}));
test('Busy guards preserve state and clear invalidates late file reads and all collection undo', () => controls(async ({ $, ui, busy, load, opens, downloaded }) => {
  await load(); await $('apply-draft-collection').fire('click'); busy(true); $('draft-collection-private-ok').checked = true;
  for (const id of ['add-to-draft-collection','update-draft-collection-entry','remove-draft-collection-entry','open-draft-collection-entry','download-draft-collection','undo-draft-collection']) await $(id).fire('click');
  assert.match($('draft-collection-count').textContent, /^2 \/ 8/); assert.equal(opens(), 0); assert.equal(downloaded(), null); busy(false);
  let resolve; $('load-draft-collection').files = [{ size: 100, text: () => new Promise(done => { resolve = done; }) }]; const pending = $('load-draft-collection').fire('change'); ui.clear(); resolve(JSON.stringify(file())); await pending;
  assert.equal(ui.hasWork(), false); assert.equal($('draft-collection-file-preview').hidden, true); assert.equal($('draft-collection-saved-preview').value, ''); assert.equal($('undo-draft-collection').disabled, true); assert.match($('draft-collection-count').textContent, /^0 \/ 8/);
}));

test('Opening a collection article asks before discarding unsaved review preparation even in an empty editor', () => controls(async ({ $, load, accepted, setCurrent, pendingPreparation, opens }) => {
  await load(); await $('apply-draft-collection').fire('click');
  setCurrent({ source: { profile: 'personal', notes: '', audience: '', purpose: '' }, draft: null });
  pendingPreparation(true); accepted(false); await $('open-draft-collection-entry').fire('click'); assert.equal(opens(), 0); assert.match($('draft-collection-status').textContent, /cancelled/);
  accepted(true); await $('open-draft-collection-entry').fire('click'); assert.equal(opens(), 1);
}));
