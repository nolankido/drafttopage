import test from 'node:test';
import assert from 'node:assert/strict';
import { createBrowserRecovery, createBrowserCopy, parseBrowserCopy, installBrowserRecovery, recoveryStatusText, RECOVERY_KEY } from '../public/browser-recovery.js';
import { readFile } from 'node:fs/promises';

const stamp = '2026-10-15T18:00:00.000Z';
const writing = () => ({ source: { profile: 'personal', audience: '', purpose: '', notes: 'Fictional private source.' }, draft: { title: 'An article', excerpt: '', description: '', slug: '', body: '## A heading\n\nAn article.', questions: ['Fictional private review.'] } });
function environment(initial = null) {
  const records = new Map(initial === null ? [] : [[RECOVERY_KEY, initial]]);
  let holder = false, writes = 0, blocked = false, full = false, removeBlocked = false;
  const storage = { getItem: key => { if (blocked) throw new Error('Storage blocked'); return records.get(key) ?? null; }, setItem: (key, value) => { if (full) throw new Error('Storage full'); records.set(key, value); writes++; }, removeItem: key => { if (removeBlocked) throw new Error('Removal blocked'); records.delete(key); } };
  const locks = { request: async (name, options, action) => {
    await Promise.resolve();
    if (holder) return action(null);
    holder = true;
    try { return await action({ name }); } finally { holder = false; }
  } };
  return { storage, locks, records, writes: () => writes, blocked: value => { blocked = value; }, full: value => { full = value; }, removeBlocked: value => { removeBlocked = value; } };
}
function setup(env = environment(), overrides = {}) {
  let workspace = writing(), restores = 0, confirmed = true, busy = false, timer = null;
  const control = createBrowserRecovery({ storage: () => env.storage, locks: () => env.locks, capture: () => structuredClone(workspace), restore: value => { workspace = structuredClone(value); restores++; }, hasWork: () => Boolean(workspace.draft?.body), confirm: () => confirmed, isBusy: () => busy, now: () => stamp, setTimer: callback => { timer = callback; return 1; }, clearTimer: () => { timer = null; }, ...overrides });
  return { control, env, capture: () => structuredClone(workspace), edit: body => { workspace.draft.body = body; }, replace: value => { workspace = value; }, restores: () => restores, confirm: value => { confirmed = value; }, busy: value => { busy = value; }, scheduled: () => timer !== null, tick: () => { const callback = timer; timer = null; callback?.(); } };
}
test('Browser recovery is off and never writes or restores until explicitly started', () => {
  const x = setup(); x.control.state(); x.control.schedule(); x.control.flush();
  assert.equal(x.control.state().enabled, false); assert.equal(x.env.writes(), 0); assert.equal(x.restores(), 0);
});
test('The bounded copy preserves workspace writing while rejecting approval and extra fields', () => {
  const input = { ...writing(), reviewed: true, clipboardSource: '<p>temporary</p>', history: ['temporary'] };
  const content = createBrowserCopy(input, stamp), restored = parseBrowserCopy(content);
  assert.deepEqual(restored.workspace.source, input.source); assert.deepEqual(restored.workspace.draft, input.draft);
  assert.doesNotMatch(content, /reviewed|clipboardSource|history|temporary/);
  for (const mutate of [v => { v.reviewed = true; }, v => { v.version = 2; }, v => { v.workspace.draft.reviewed = true; }, v => { v.savedAt = 'yesterday'; }, v => { v.workspace.source.notes = 'x'.repeat(8001); }]) {
    const v = JSON.parse(content); mutate(v); assert.throws(() => parseBrowserCopy(JSON.stringify(v)));
  }
  for (const bad of ['null', '[]', '{broken', 'x'.repeat(524289), '😀'.repeat(140000)]) assert.throws(() => parseBrowserCopy(bad));
});
test('Starting saves current writing and coalesces later edits without saving approval', async () => {
  const x = setup(); assert.equal(await x.control.start(), true);
  x.edit('First edit'); x.control.schedule(); x.edit('Latest edit'); x.control.schedule();
  assert.equal(x.env.writes(), 1); assert.equal(x.control.state().saving, true);
  x.tick(); assert.equal(x.env.writes(), 2); assert.equal(parseBrowserCopy(x.env.records.get(RECOVERY_KEY)).workspace.draft.body, 'Latest edit');
  x.control.schedule(); x.tick(); assert.equal(x.env.writes(), 2); x.control.dispose();
});
test('A new workspace cannot overwrite an existing browser copy', async () => {
  const original = createBrowserCopy(writing(), stamp), x = setup(environment(original)); x.edit('Different writing');
  assert.equal(await x.control.start(), false); assert.equal(x.env.records.get(RECOVERY_KEY), original); assert.equal(x.capture().draft.body, 'Different writing');
});
test('Returning offers the copy without applying it and requires a deliberate restore', async () => {
  const saved = writing(), x = setup(environment(createBrowserCopy(saved, stamp))); x.edit('Unsaved current article');
  assert.equal(x.control.state().available, true); assert.equal(x.restores(), 0);
  x.confirm(false); assert.equal(await x.control.resume(x.control.inspect()), false); assert.equal(x.capture().draft.body, 'Unsaved current article');
  x.confirm(true); assert.equal(await x.control.resume(x.control.inspect()), true); assert.deepEqual(x.capture().draft, saved.draft); assert.equal(x.restores(), 1); x.control.dispose();
});
test('A failed restore checkpoint preserves open writing and the stored copy', async () => {
  const raw = createBrowserCopy(writing(), stamp), x = setup(environment(raw), { restore: () => { throw new Error('Checkpoint unavailable'); } }); x.edit('Keep current');
  assert.equal(await x.control.resume(x.control.inspect()), false); assert.equal(x.capture().draft.body, 'Keep current'); assert.equal(x.env.records.get(RECOVERY_KEY), raw); assert.equal(x.control.state().enabled, false);
});
test('Changes while requesting the lock invalidate a prepared restore', async () => {
  const x = setup(environment(createBrowserCopy(writing(), stamp))); const pending = x.control.resume(x.control.inspect()); x.edit('Changed during request');
  assert.equal(await pending, false); assert.equal(x.restores(), 0); assert.equal(x.capture().draft.body, 'Changed during request');
});
test('Two tabs cannot restore, overwrite, or remove the active writer copy', async () => {
  const env = environment(), a = setup(env), b = setup(env);
  assert.equal(await a.control.start(), true); const original = env.records.get(RECOVERY_KEY);
  b.edit('Second tab'); assert.equal(await b.control.resume(b.control.inspect()), false); assert.equal(await b.control.forget(), false); assert.equal(await b.control.removeForClear(), false);
  assert.equal(env.records.get(RECOVERY_KEY), original); assert.equal(b.capture().draft.body, 'Second tab');
  a.control.pause(); await Promise.resolve(); await Promise.resolve();
  assert.equal(await b.control.resume(b.control.inspect()), true); b.control.dispose();
});
test('Pausing flushes the latest edit, retains the copy, and disables further writes', async () => {
  const x = setup(); await x.control.start(); x.edit('Latest before pause'); x.control.schedule(); x.control.pause();
  assert.equal(parseBrowserCopy(x.env.records.get(RECOVERY_KEY)).workspace.draft.body, 'Latest before pause');
  x.edit('Later unsaved'); x.control.schedule(); x.tick(); assert.equal(x.control.state().enabled, false); assert.equal(x.env.writes(), 2);
});
test('Page disposal flushes pending writing but does not automatically resume on return', async () => {
  const x = setup(); await x.control.start(); x.edit('Before leaving'); x.control.schedule(); x.control.dispose();
  assert.equal(parseBrowserCopy(x.env.records.get(RECOVERY_KEY)).workspace.draft.body, 'Before leaving');
  x.control.refresh(); assert.equal(x.control.state().enabled, false); assert.equal(x.control.state().available, true);
});
test('Pausing after a storage failure retains the warning instead of implying the latest edit was saved', async () => {
  const x = setup(); await x.control.start(); const original = x.env.records.get(RECOVERY_KEY);
  x.edit('Unsaved newest article'); x.env.full(true);
  assert.equal(x.control.pause(), false);
  assert.equal(x.control.state().enabled, false);
  assert.equal(x.env.records.get(RECOVERY_KEY), original);
  assert.equal(x.capture().draft.body, 'Unsaved newest article');
  assert.match(x.control.state().message, /Storage full/);
  assert.match(x.control.state().message, /without confirming the latest changes were saved/);
  assert.doesNotMatch(x.control.state().message, /^Browser saving paused/);
});
test('Pausing during a busy operation does not imply its deferred edit was saved or leave a timer running', async () => {
  const x = setup(); await x.control.start(); const original = x.env.records.get(RECOVERY_KEY);
  x.edit('Busy newest article'); x.busy(true);
  assert.equal(x.control.pause(), false); x.busy(false); x.tick();
  assert.equal(x.env.records.get(RECOVERY_KEY), original);
  assert.equal(x.env.writes(), 1);
  assert.equal(x.control.state().enabled, false);
  assert.match(x.control.state().message, /download a private backup/);
});
test('Leaving during a pending lock request cancels that save instead of starting a hidden writer', async () => {
  const x = setup(); const pending = x.control.start(); x.control.dispose();
  assert.equal(await pending, false); assert.equal(x.env.writes(), 0); assert.equal(x.control.state().enabled, false); assert.equal(x.control.busy(), false);
});
test('A busy file operation defers saves until the current workspace can be captured', async () => {
  const x = setup(); await x.control.start(); x.edit('Latest article'); x.busy(true); x.control.schedule(); x.tick();
  assert.equal(x.env.writes(), 1); x.busy(false); x.tick(); assert.equal(parseBrowserCopy(x.env.records.get(RECOVERY_KEY)).workspace.draft.body, 'Latest article'); x.control.dispose();
});
test('Pending import preparation does not prevent timer or explicit saves of current writing', async () => {
  let pendingImport = false, reading = false;
  const x = setup(environment(), { isBusy: () => pendingImport || reading, isSaveBlocked: () => reading });
  assert.equal(await x.control.start(), true);
  pendingImport = true;
  const latest = { ...writing(), draft: { ...writing().draft, body: 'Latest article before insertion.\r\n\r\nKeep the ending 🙂\n', questions: ['Updated private question.'] }, pendingImport: { body: 'UNAPPLIED IMPORT' } };
  x.replace(latest); x.control.schedule();
  assert.equal(x.control.state().saveState, 'saving');
  x.tick();
  let saved = parseBrowserCopy(x.env.records.get(RECOVERY_KEY)).workspace;
  assert.deepEqual(saved.source, latest.source); assert.deepEqual(saved.draft, latest.draft);
  assert.doesNotMatch(x.env.records.get(RECOVERY_KEY), /UNAPPLIED IMPORT|pendingImport/);
  assert.equal(x.control.state().saveState, 'saved');
  x.edit('An additional exact edit before the pending import.\n');
  assert.equal(x.control.flush(), true);
  saved = parseBrowserCopy(x.env.records.get(RECOVERY_KEY)).workspace;
  assert.equal(saved.draft.body, x.capture().draft.body);
  assert.equal(x.env.writes(), 3);
  assert.equal(await x.control.forget(), false);
  assert.equal(x.control.state().enabled, true);
  x.control.dispose();
});
for (const leave of ['pause', 'dispose']) test('Pending import current writing survives ' + leave + ' and deliberate restore', async () => {
  let pendingImport = false;
  const env = environment(), x = setup(env, { isBusy: () => pendingImport, isSaveBlocked: () => false });
  await x.control.start(); pendingImport = true;
  const latest = 'The exact latest article survives leaving.\r\nFinal line 🪴\n';
  x.edit(latest); x.control.schedule();
  x.control[leave]();
  assert.equal(parseBrowserCopy(env.records.get(RECOVERY_KEY)).workspace.draft.body, latest);
  assert.equal(x.control.state().enabled, false); assert.equal(x.scheduled(), false);
  const writes = env.writes(); x.tick(); assert.equal(env.writes(), writes);
  await Promise.resolve(); await Promise.resolve();
  let newImportPending = true;
  const returned = setup(env, { isBusy: () => newImportPending, isSaveBlocked: () => false });
  const inspection = returned.control.inspect();
  assert.equal(await returned.control.start(), false);
  assert.equal(await returned.control.resume(inspection), false);
  assert.equal(await returned.control.forget(), false);
  assert.equal(returned.restores(), 0);
  newImportPending = false;
  assert.equal(await returned.control.resume(inspection), true);
  assert.equal(returned.capture().draft.body, latest);
  assert.equal(returned.control.state().saveState, 'saved');
  returned.control.dispose();
});
test('Explicit active-read deferral keeps the old copy until a safe flush and reports waiting', async () => {
  let reading = false;
  const x = setup(environment(), { isBusy: () => reading, isSaveBlocked: () => reading });
  await x.control.start(); const old = x.env.records.get(RECOVERY_KEY);
  reading = true; x.edit('Current edit while a selected file is being read.'); x.control.schedule();
  assert.equal(x.control.state().saveState, 'blocked');
  assert.match(recoveryStatusText(x.control.state()), /not saved yet/);
  assert.equal(x.control.flush(), false); assert.equal(x.env.records.get(RECOVERY_KEY), old);
  reading = false; x.tick();
  assert.equal(parseBrowserCopy(x.env.records.get(RECOVERY_KEY)).workspace.draft.body, x.capture().draft.body);
  assert.equal(x.control.state().saveState, 'saved'); x.control.dispose();
});
test('A save blocked during acquisition cannot leave a writer running without its lock', async () => {
  const env = environment(), x = setup(env, { isSaveBlocked: () => true });
  assert.equal(await x.control.start(), false);
  assert.equal(x.control.state().enabled, false); assert.equal(x.scheduled(), false);
  assert.equal(env.writes(), 0);
  await Promise.resolve(); await Promise.resolve();
  const other = setup(env); assert.equal(await other.control.start(), true);
  x.tick(); assert.equal(env.writes(), 1); other.control.dispose();
});
test('Saving while an import is pending retains exclusive ownership against another tab', async () => {
  let pendingImport = false;
  const env = environment(), first = setup(env, { isBusy: () => pendingImport, isSaveBlocked: () => false }), second = setup(env);
  await first.control.start(); pendingImport = true;
  first.edit('First tab latest writing, before its pending import.'); first.control.schedule(); first.tick();
  const latest = env.records.get(RECOVERY_KEY);
  second.edit('Separate writing in another tab.');
  assert.equal(await second.control.resume(second.control.inspect()), false);
  assert.equal(await second.control.forget(), false);
  assert.equal(await second.control.removeForClear(), false);
  assert.equal(env.records.get(RECOVERY_KEY), latest);
  assert.equal(first.control.state().enabled, true);
  assert.equal(first.control.pause(), true);
  await Promise.resolve(); await Promise.resolve();
  assert.equal(await second.control.resume(second.control.inspect()), true);
  assert.equal(second.capture().draft.body, first.capture().draft.body); second.control.dispose();
});
test('Returning to the saved text cancels pending saving without another write', async () => {
  const x = setup(); await x.control.start(); const original = x.capture().draft.body;
  x.edit('A temporary edit.'); x.control.schedule();
  assert.equal(x.control.state().saveState, 'saving');
  x.edit(original); x.control.schedule();
  assert.equal(x.control.state().saveState, 'saved'); assert.equal(x.scheduled(), false);
  x.tick(); assert.equal(x.env.writes(), 1); x.control.dispose();
});
test('Compact recovery text separates saved current writing from an old copy, pending changes, and errors', async () => {
  const base = { supported: true, savedAt: stamp, available: true, pending: false, error: '' };
  assert.equal(recoveryStatusText({ ...base, saveState: 'saved' }, () => 'the verified time'), 'Current writing saved in this browser at the verified time.');
  assert.match(recoveryStatusText({ ...base, saveState: 'off' }), /Saving is off.*current changes may be unsaved/);
  assert.match(recoveryStatusText({ ...base, saveState: 'saving' }), /^Saving changes/);
  assert.match(recoveryStatusText({ ...base, saveState: 'blocked' }), /not saved yet/);
  assert.match(recoveryStatusText({ ...base, saveState: 'off', pending: true }), /Preparing/);
  assert.match(recoveryStatusText({ ...base, saveState: 'off', supported: false }), /unavailable/);
  for (const state of [{ ...base, saveState: 'error' }, { ...base, saveState: 'saved', error: 'Storage blocked' }]) {
    assert.match(recoveryStatusText(state), /needs attention/);
    assert.doesNotMatch(recoveryStatusText(state), /Current writing saved|verified time/);
  }
  const x = setup(); await x.control.start(); x.env.full(true); x.edit('Latest writing not retained by full storage.'); x.control.schedule(); x.tick();
  assert.equal(x.control.state().savedAt, stamp); assert.equal(x.control.state().saveState, 'error');
  x.env.full(false); x.control.refresh();
  assert.equal(x.control.state().saveState, 'error');
  assert.doesNotMatch(recoveryStatusText(x.control.state()), /Current writing saved/);
  x.control.dispose();
});
test('A changed external copy cannot be presented as current saved writing even before its storage event', async () => {
  const x = setup(); await x.control.start();
  x.env.records.set(RECOVERY_KEY, createBrowserCopy({ ...writing(), draft: { ...writing().draft, body: 'An external copy.' } }, stamp));
  assert.equal(x.control.state().saveState, 'error');
  assert.match(x.control.state().error, /changed outside this tab/);
  assert.doesNotMatch(recoveryStatusText(x.control.state()), /Current writing saved/);
  x.control.externalChange();
  assert.equal(x.control.state().enabled, false); assert.equal(x.control.state().saveState, 'error');
  assert.equal(parseBrowserCopy(x.env.records.get(RECOVERY_KEY)).workspace.draft.body, 'An external copy.');
  x.control.dispose();
});
test('Storage-full failures stop saving and keep the last good copy', async () => {
  const x = setup(); await x.control.start(); const original = x.env.records.get(RECOVERY_KEY); x.env.full(true); x.edit('Unsaved due to quota'); x.control.schedule(); x.tick();
  assert.equal(x.control.state().enabled, false); assert.equal(x.env.records.get(RECOVERY_KEY), original); assert.equal(x.capture().draft.body, 'Unsaved due to quota'); assert.match(x.control.state().message, /Saving is off/);
});
test('Blocked storage and unsupported locks leave the writing usable without persistence', async () => {
  const a = setup(); a.env.blocked(true); assert.match(a.control.state().error, /unavailable/); assert.equal(await a.control.start(), false); assert.equal(a.env.writes(), 0);
  const b = setup(environment(), { locks: () => undefined }); assert.equal(b.control.state().supported, false); assert.equal(await b.control.start(), false); assert.equal(b.env.writes(), 0);
  const c = setup(environment(), { locks: () => { throw new Error('Browser policy'); } }); assert.equal(c.control.state().supported, false); assert.equal(await c.control.start(), false); assert.equal(c.env.writes(), 0);
});
test('Corrupt recovery is preserved until explicit removal and never restored', async () => {
  const x = setup(environment('{broken')); assert.equal(x.control.state().valid, false); assert.throws(() => x.control.inspect()); assert.equal(await x.control.resume(), false); assert.equal(x.restores(), 0);
  x.confirm(false); assert.equal(await x.control.forget(), false); assert.equal(x.env.records.get(RECOVERY_KEY), '{broken');
  x.confirm(true); assert.equal(await x.control.forget(), true); assert.equal(x.env.records.has(RECOVERY_KEY), false);
});
test('An external storage change stops autosaving instead of resurrecting or overwriting a copy', async () => {
  const x = setup(); await x.control.start(); x.env.records.delete(RECOVERY_KEY); x.control.externalChange(); x.edit('Keep only in tab'); x.control.schedule(); x.tick();
  assert.equal(x.env.records.has(RECOVERY_KEY), false); assert.equal(x.control.state().enabled, false);
});
test('Even a missed storage event cannot cause the next write to overwrite changed data', async () => {
  const x = setup(); await x.control.start(); const other = createBrowserCopy({ ...writing(), draft: { ...writing().draft, body: 'External copy' } }, stamp); x.env.records.set(RECOVERY_KEY, other);
  x.edit('Current tab'); assert.equal(x.control.flush(), false); assert.equal(x.env.records.get(RECOVERY_KEY), other); assert.equal(x.control.state().enabled, false);
});
test('Removing an active browser copy keeps open writing and cannot resurrect it on typing', async () => {
  const x = setup(); await x.control.start(); const before = x.capture(); assert.equal(await x.control.forget(), true);
  assert.deepEqual(x.capture(), before); x.edit('Still editing'); x.control.schedule(); x.tick(); assert.equal(x.env.records.has(RECOVERY_KEY), false);
});
test('Failed removal retains writing and reports that clearing could not complete', async () => {
  const x = setup(); await x.control.start(); x.env.removeBlocked(true); const before = x.capture();
  assert.equal(await x.control.removeForClear(), false); assert.deepEqual(x.capture(), before); assert.equal(x.env.records.has(RECOVERY_KEY), true);
});
test('Confirmed desk clearing removes a paused copy without starting a writer', async () => {
  const x = setup(environment(createBrowserCopy(writing(), stamp))); assert.equal(await x.control.removeForClear(), true);
  assert.equal(x.control.state().enabled, false); assert.equal(x.env.records.has(RECOVERY_KEY), false);
});
test('Invalid editing fields stop saving and preserve the previous valid copy', async () => {
  const x = setup(); await x.control.start(); const raw = x.env.records.get(RECOVERY_KEY); x.edit('x'.repeat(60001)); x.control.schedule();
  assert.equal(x.control.state().enabled, false); assert.equal(x.env.records.get(RECOVERY_KEY), raw);
});
test('Recovery wiring is public-only, consent-gated, and restricted to one audited storage module', async () => {
  const [module, desk, page, pilot, privacy] = await Promise.all(['public/browser-recovery.js','public/desk.js','public/write/index.html','src/pages.js','public/privacy/index.html'].map(p => readFile(p, 'utf8')));
  assert.doesNotMatch(module, /fetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|innerHTML|sessionStorage|indexedDB/);
  assert.match(module, /if \(\$\('browser-recovery-consent'\)\.checked\) return controller\.start/);
  assert.match(module, /ifAvailable: true/); assert.doesNotMatch(module, /steal:/);
  assert.match(desk, /revisions\.captureBefore\('Before browser recovery restore'\)/);
  assert.match(page, /browser-recovery-consent/); assert.doesNotMatch(pilot, /browser-recovery\.js/);
  assert.match(privacy, /off by default/); assert.match(privacy, /unencrypted/); assert.match(privacy, /Anyone using that browser profile/);
});
test('Recovery UI reports both pending transitions so the surrounding editor unlocks after restore', async () => {
  const env = environment(createBrowserCopy(writing(), stamp)), states = [], controls = new Map();
  const node = () => ({ replaceChildren() {}, value: '', hidden: false, disabled: false, checked: false, open: false, textContent: '', addEventListener() {} });
  const oldDocument = globalThis.document, oldWindow = globalThis.window, oldNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  globalThis.document = { getElementById: id => { if (!controls.has(id)) controls.set(id, node()); return controls.get(id); }, addEventListener() {} };
  globalThis.window = { localStorage: env.storage, confirm: () => true, addEventListener() {} };
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { locks: env.locks } });
  let workspace = writing();
  try {
    const control = installBrowserRecovery({ capture: () => workspace, restore: value => { workspace = value; }, hasWork: () => false, stateChanged: pending => states.push(pending) });
    assert.equal(await control.resume(control.inspect()), true); assert.deepEqual(states, [false, true, false]);
    control.flush(); assert.deepEqual(states, [false, true, false]); assert.equal(controls.get('browser-recovery-pause').hidden, false);
    control.dispose();
  } finally {
    globalThis.document = oldDocument; globalThis.window = oldWindow;
    if (oldNavigator) Object.defineProperty(globalThis, 'navigator', oldNavigator); else delete globalThis.navigator;
  }
});

test('Article save options reveals a usable recovery action without saving, restoring, or repeating status text', async () => {
  const env = environment(), controls = new Map();
  const oldDocument = globalThis.document, oldWindow = globalThis.window, oldNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  let workspace = writing(), pendingImport = false, reading = false, timer = null;
  const makeNode = id => {
    let content = '';
    return { id, value: '', checked: false, disabled: id === 'article-save-options', hidden: false, open: false, parentElement: null, tagName: id === 'browser-recovery-panel' ? 'DETAILS' : 'BUTTON', events: new Map(), textWrites: 0,
      get textContent() { return content; }, set textContent(value) { content = value; this.textWrites++; },
      replaceChildren() {}, addEventListener(type, listener) { if (!this.events.has(type)) this.events.set(type, []); this.events.get(type).push(listener); },
      focus() { globalThis.document.activeElement = this; },
      click() { for (const listener of this.events.get('click') || []) listener({ currentTarget: this }); }
    };
  };
  const $ = id => { if (!controls.has(id)) controls.set(id, makeNode(id)); return controls.get(id); };
  globalThis.document = { getElementById: $, addEventListener() {}, removeEventListener() {}, activeElement: null };
  globalThis.window = { localStorage: env.storage, confirm: () => true, addEventListener() {}, removeEventListener() {} };
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { locks: env.locks } });
  const outer = { tagName: 'DETAILS', open: false, parentElement: null };
  $('browser-recovery-panel').parentElement = outer; $('reviewed').checked = true;
  let controller;
  try {
    controller = installBrowserRecovery({ capture: () => structuredClone(workspace), restore: value => { workspace = value; }, hasWork: () => true,
      isBusy: () => pendingImport || reading, isSaveBlocked: () => reading, now: () => stamp,
      setTimer: callback => { timer = callback; return 1; }, clearTimer: () => { timer = null; } });
    assert.equal($('article-save-options').disabled, false);
    const original = JSON.stringify(workspace);
    $('article-save-options').click();
    assert.equal($('browser-recovery-panel').open, true); assert.equal(outer.open, true);
    assert.equal(document.activeElement, $('browser-recovery-consent'));
    assert.equal(env.writes(), 0); assert.equal(JSON.stringify(workspace), original); assert.equal($('reviewed').checked, true);
    assert.equal(await controller.start(), true);
    $('article-save-options').click(); assert.equal(document.activeElement, $('browser-recovery-now')); assert.equal(env.writes(), 1);
    assert.match($('article-save-status').textContent, /Current writing saved/);
    const liveWrites = $('browser-recovery-status').textWrites, compactWrites = $('article-save-status').textWrites;
    controller.refresh(); controller.refresh();
    assert.equal($('browser-recovery-status').textWrites, liveWrites); assert.equal($('article-save-status').textWrites, compactWrites);
    pendingImport = true; workspace.draft.body = 'Current writing changes while importing.'; controller.schedule();
    assert.equal($('browser-recovery-now').disabled, false); assert.equal($('browser-recovery-forget').disabled, true);
    assert.match($('article-save-status').textContent, /^Saving changes/);
    reading = true; controller.refresh();
    assert.equal($('browser-recovery-now').disabled, true); assert.match($('article-save-status').textContent, /not saved yet/);
    $('article-save-options').click(); assert.equal(document.activeElement, $('browser-recovery-summary'));
    reading = false; const callback = timer; timer = null; callback();
    assert.equal(parseBrowserCopy(env.records.get(RECOVERY_KEY)).workspace.draft.body, workspace.draft.body);
    pendingImport = false; controller.pause();
    assert.match($('article-save-status').textContent, /^Saving is off/);
    $('article-save-options').click(); assert.equal(document.activeElement, $('browser-recovery-inspect'));
    assert.equal($('reviewed').checked, true); assert.equal(workspace.draft.body, 'Current writing changes while importing.');
  } finally {
    controller?.dispose(); globalThis.document = oldDocument; globalThis.window = oldWindow;
    if (oldNavigator) Object.defineProperty(globalThis, 'navigator', oldNavigator); else delete globalThis.navigator;
  }
});

test('Paused-copy inspection stays read-only with staged or raw pending imports and waits for active file reads', async () => {
  const env = environment(), controls = new Map();
  const oldDocument = globalThis.document, oldWindow = globalThis.window, oldNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  let workspace = writing(), stagedImport = null, rawImport = '', reading = false, captures = 0, restores = 0, confirmations = 0;
  workspace.draft.body = 'Saved article\r\n\r\nExact café and 😀 text.\n';
  const savedWorkspace = structuredClone(workspace);
  const makeNode = id => ({ id, value: '', checked: false, disabled: false, hidden: false, open: false, parentElement: null,
    tagName: id === 'browser-recovery-panel' ? 'DETAILS' : 'BUTTON', textContent: '', children: [], events: new Map(),
    replaceChildren(...children) { this.children = children; },
    addEventListener(type, listener) { if (!this.events.has(type)) this.events.set(type, []); this.events.get(type).push(listener); },
    focus() { globalThis.document.activeElement = this; },
    dispatch(type) { return Promise.all((this.events.get(type) || []).map(listener => listener({ currentTarget: this }))); },
    // Invoke registered handlers even when disabled to check their own guards.
    click() { return this.dispatch('click'); }
  });
  const $ = id => { if (!controls.has(id)) controls.set(id, makeNode(id)); return controls.get(id); };
  globalThis.document = { getElementById: $, createElement: makeNode, addEventListener() {}, removeEventListener() {}, activeElement: null };
  globalThis.window = { localStorage: env.storage, confirm: () => { confirmations++; return true; }, addEventListener() {} };
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { locks: env.locks } });
  let controller;
  try {
    controller = installBrowserRecovery({ capture: () => { captures++; return structuredClone(workspace); }, restore: value => { restores++; workspace = value; }, hasWork: () => true,
      isBusy: () => reading || Boolean(stagedImport || rawImport), isSaveBlocked: () => reading, now: () => stamp });
    assert.equal(await controller.start(), true); assert.equal(controller.pause(), true);
    const savedRaw = env.records.get(RECOVERY_KEY), writes = env.writes();
    workspace.draft.body = 'Current article\r\n\r\nKeep naïve and 🧭 text exactly.\n';
    workspace.source.notes = 'Current fictional source with a different note.\r\n';
    workspace.draft.questions = ['A current question with a "quote".', 'Keep this\nline break.'];
    $('reviewed').checked = true;
    const original = JSON.stringify(workspace);
    for (const preparation of ['staged', 'raw']) {
      stagedImport = preparation === 'staged' ? { body: 'Unapplied staged preparation.' } : null;
      rawImport = preparation === 'raw' ? '<p>Unapplied raw preparation.</p>' : '';
      const pendingBefore = JSON.stringify({ stagedImport, rawImport });
      controller.refresh();
      assert.equal($('browser-recovery-inspect').hidden, false);
      assert.equal($('browser-recovery-inspect').disabled, false, preparation + ' preparation allows comparison');
      await $('browser-recovery-inspect').click();
      assert.equal($('browser-recovery-preview').hidden, false);
      assert.equal(document.activeElement, $('browser-recovery-preview-heading'));
      for (const [field, current, saved] of [
        ['body', workspace.draft.body, savedWorkspace.draft.body],
        ['notes', workspace.source.notes, savedWorkspace.source.notes],
        ['questions', JSON.stringify(workspace.draft.questions, null, 2), JSON.stringify(savedWorkspace.draft.questions, null, 2)]
      ]) {
        assert.ok($('browser-recovery-fields').children.some(option => option.value === field));
        $('browser-recovery-fields').value = field; await $('browser-recovery-fields').dispatch('change');
        assert.equal($('browser-recovery-current').value, current);
        assert.equal($('browser-recovery-saved').value, saved);
      }
      assert.match($('browser-recovery-comparison').textContent, /Fields to replace:/);
      $('browser-recovery-consent').checked = true; $('browser-recovery-reviewed').checked = true; controller.refresh();
      for (const action of ['start', 'restore', 'forget']) {
        assert.equal($('browser-recovery-' + action).disabled, true);
        assert.deepEqual(await $('browser-recovery-' + action).click(), [false], action + ' remains guarded');
      }
      assert.equal(JSON.stringify(workspace), original); assert.equal($('reviewed').checked, true);
      assert.equal(JSON.stringify({ stagedImport, rawImport }), pendingBefore);
      assert.equal(env.records.get(RECOVERY_KEY), savedRaw); assert.equal(env.writes(), writes);
      assert.equal(controller.state().enabled, false); assert.equal(restores, 0); assert.equal(confirmations, 0);
    }
    reading = true;
    $('browser-recovery-panel').open = false; await $('browser-recovery-panel').dispatch('toggle');
    assert.equal($('browser-recovery-inspect').disabled, true);
    const capturesBefore = captures;
    await $('browser-recovery-inspect').click();
    assert.equal(captures, capturesBefore); assert.equal($('browser-recovery-preview').hidden, true);
    assert.equal($('browser-recovery-current').value, ''); assert.equal($('browser-recovery-saved').value, '');
    reading = false; controller.refresh();
    assert.equal($('browser-recovery-inspect').disabled, false); await $('browser-recovery-inspect').click();
    assert.equal($('browser-recovery-current').value, workspace.draft.body);
    assert.equal($('browser-recovery-saved').value, savedWorkspace.draft.body);
    assert.equal(JSON.stringify(workspace), original); assert.equal(env.records.get(RECOVERY_KEY), savedRaw);
    assert.equal(env.writes(), writes); assert.equal(restores, 0); assert.equal(confirmations, 0);
  } finally {
    controller?.dispose(); globalThis.document = oldDocument; globalThis.window = oldWindow;
    if (oldNavigator) Object.defineProperty(globalThis, 'navigator', oldNavigator); else delete globalThis.navigator;
  }
});

test('Restoring requires the exact inspected copy and current workspace, including missed storage changes', async () => {
  const x = setup(environment(createBrowserCopy(writing(), stamp)));
  assert.equal(await x.control.resume(), false);
  const inspected = x.control.inspect(); x.edit('Changed after inspection');
  assert.equal(await x.control.resume(inspected), false); assert.equal(x.restores(), 0);
  const next = x.control.inspect();
  x.env.records.set(RECOVERY_KEY, createBrowserCopy({ ...writing(), draft: { ...writing().draft, body: 'Other tab copy' } }, stamp));
  assert.equal(await x.control.resume(next), false); assert.equal(x.restores(), 0);
  assert.equal(x.capture().draft.body, 'Changed after inspection');
});
