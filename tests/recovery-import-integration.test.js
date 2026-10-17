import test from 'node:test';
import assert from 'node:assert/strict';
import { installArticleImport } from '../public/import-controls.js';
import { createBrowserRecovery, parseBrowserCopy, RECOVERY_KEY } from '../public/browser-recovery.js';

const stamp = '2026-10-17T20:08:43.000Z';
const initialWorkspace = () => ({
  source: { profile: 'guide', audience: 'Fictional readers', purpose: 'Review a fictional article', notes: 'CURRENT_PRIVATE_NOTES' },
  draft: { title: 'Current article', excerpt: 'Current excerpt', description: 'Current description', slug: 'current-article', body: 'Current article.\r\n\r\nCURRENT_END', questions: ['CURRENT_PRIVATE_QUESTION'] }
});

// The importer uses real parsing and state transitions. Only browser DOM,
// storage, lock ownership and timers are represented by controlled test objects.
class Control {
  constructor(name = 'div') {
    this.nodeType = 1; this.localName = name; this.childNodes = [];
    this.value = ''; this.checked = false; this.hidden = false; this.disabled = false;
    this.selectionStart = 0; this.selectionEnd = 0; this.events = new Map();
  }
  addEventListener(type, callback) {
    if (!this.events.has(type)) this.events.set(type, []);
    this.events.get(type).push(callback);
  }
  async fire(type = 'click') {
    for (const callback of this.events.get(type) || []) await callback({ type, currentTarget: this });
  }
  dispatchEvent(event) { for (const callback of this.events.get(event.type) || []) callback(event); return true; }
  append(...nodes) { this.childNodes.push(...nodes); }
  replaceChildren(...nodes) { this.childNodes = nodes; }
  setAttribute() {}
  focus() {}
  select() { this.selectionStart = 0; this.selectionEnd = this.value.length; }
}

async function withIntegration(run) {
  const previous = { document: globalThis.document, confirm: globalThis.confirm }, nodes = new Map();
  const $ = id => { if (!nodes.has(id)) nodes.set(id, new Control()); return nodes.get(id); };
  globalThis.document = {
    getElementById: $, createElement: name => new Control(name),
    createDocumentFragment: () => new Control('fragment'),
    createTextNode: text => ({ nodeType: 3, nodeValue: text })
  };
  globalThis.confirm = () => true;
  const records = new Map();
  let current = initialWorkspace(), recovery = null, holder = false, timer = null, writes = 0, restores = 0, applied = 0;
  const capture = () => structuredClone(current);
  const syncBody = () => { $('body').value = current.draft.body; };
  syncBody(); $('import-format').value = 'markdown';
  const importer = installArticleImport({
    hasArticle: () => true,
    isBusy: () => Boolean(recovery?.busy()),
    busyChanged: () => recovery?.refresh(),
    report: () => {},
    apply: draft => { applied++; current.draft = structuredClone(draft); syncBody(); }
  });
  recovery = createBrowserRecovery({
    storage: () => ({
      getItem: key => records.get(key) ?? null,
      setItem: (key, value) => { records.set(key, value); writes++; },
      removeItem: key => records.delete(key)
    }),
    locks: () => ({ request: async (name, options, action) => {
      await Promise.resolve();
      if (holder) return action(null);
      holder = true;
      try { return await action({ name }); } finally { holder = false; }
    } }),
    capture,
    hasWork: () => Boolean(current.draft.body),
    confirm: () => true,
    // These callbacks deliberately use the real importer, not independent flags.
    isBusy: () => importer.reading() || importer.pending(),
    isSaveBlocked: () => importer.reading(),
    restore: value => {
      restores++; current = { source: structuredClone(value.source), draft: structuredClone(value.draft) };
      syncBody(); importer.clear();
    },
    changed: () => importer.updateBusy(),
    now: () => stamp,
    setTimer: callback => { timer = callback; return 1; },
    clearTimer: () => { timer = null; }
  });
  const rawInput = async text => { $('import-text').value = text; await $('import-text').fire('input'); };
  const stage = async text => { await rawInput(text); await $('preview-import').fire(); };
  const edit = (body, notes) => { current.draft.body = body; current.source.notes = notes; syncBody(); recovery.schedule(); };
  const tick = () => {
    assert.equal(typeof timer, 'function', 'a current-workspace save should be scheduled');
    const callback = timer; timer = null; callback();
  };
  try {
    await run({ $, importer, recovery, capture, rawInput, stage, edit, tick,
      raw: () => records.get(RECOVERY_KEY), writes: () => writes, restores: () => restores,
      applied: () => applied, hasTimer: () => timer !== null });
  } finally {
    recovery.dispose();
    Object.assign(globalThis, previous);
  }
}

function assertSavedCurrent(context, expected = context.capture()) {
  const raw = context.raw(), saved = parseBrowserCopy(raw).workspace;
  assert.deepEqual(saved, { format: 'drafttopage-workspace', version: 1, ...expected });
  assert.doesNotMatch(raw, /STAGED_IMPORT_ONLY|RAW_IMPORT_ONLY|FILE_IMPORT_ONLY/);
}

test('A staged import stays pending while scheduled and page-close recovery save the current article and notes', () => withIntegration(async context => {
  const { $, importer, recovery, stage, edit, tick, capture } = context;
  assert.equal(await recovery.start(), true);
  const initial = capture();
  await stage('# Pending article\n\nSTAGED_IMPORT_ONLY');
  assert.equal(importer.pending(), true); assert.equal(importer.staged(), true); assert.equal(importer.reading(), false);
  assert.deepEqual(capture(), initial); assert.match($('import-body-preview').value, /STAGED_IMPORT_ONLY/);

  edit('Current edit.\r\n\r\nLATEST_END 😀', 'Current private notes after staging.');
  tick();
  assertSavedCurrent(context);
  assert.equal(importer.pending(), true); assert.equal(context.applied(), 0);

  edit('Final current article before page close.\n\nFINAL_END', 'Final private notes before page close.');
  assert.equal(context.hasTimer(), true);
  recovery.dispose();
  assertSavedCurrent(context);
  assert.equal(context.hasTimer(), false); assert.equal(recovery.state().enabled, false);
  assert.equal(importer.pending(), true); assert.match($('import-body-preview').value, /STAGED_IMPORT_ONLY/);
  assert.equal(context.applied(), 0);
}));

test('Unpreviewed import text does not block flush or pause, while start and restore keep their pending-import safeguards', () => withIntegration(async context => {
  const { $, importer, recovery, rawInput, edit, capture } = context;
  assert.equal(await recovery.start(), true);
  await rawInput('RAW_IMPORT_ONLY');
  assert.equal(importer.pending(), true); assert.equal(importer.staged(), false); assert.equal(importer.reading(), false);

  edit('Current writing after raw input.', 'Current notes after raw input.');
  assert.equal(recovery.flush(), true);
  assertSavedCurrent(context);
  edit('Current writing before pause.', 'Current notes before pause.');
  assert.equal(recovery.pause(), true);
  const savedCurrent = capture(), savedRaw = context.raw();
  assertSavedCurrent(context, savedCurrent); assert.equal(context.hasTimer(), false);

  edit('Keep this unsaved current article until a reviewed restore.', 'Keep these unsaved current notes.');
  const beforeRestore = capture(), inspected = recovery.inspect();
  assert.equal(await recovery.start(), false);
  assert.equal(await recovery.resume(inspected), false);
  assert.equal(context.restores(), 0); assert.deepEqual(capture(), beforeRestore);
  assert.equal(context.raw(), savedRaw); assert.equal(importer.pending(), true);
  assert.equal($('import-text').value, 'RAW_IMPORT_ONLY');

  await $('cancel-import').fire();
  assert.equal(importer.pending(), false);
  assert.equal(await recovery.resume(inspected), true);
  assert.equal(context.restores(), 1); assert.deepEqual(capture(), savedCurrent);
  assertSavedCurrent(context, savedCurrent); assert.equal(context.applied(), 0);
}));

test('An actual asynchronous importer file read defers saving, then its unapplied preview permits the current-workspace save', () => withIntegration(async context => {
  const { $, importer, recovery, edit, tick, capture } = context;
  assert.equal(await recovery.start(), true);
  const original = context.raw(), originalWrites = context.writes();
  const bytes = new TextEncoder().encode('# Pending file\n\nFILE_IMPORT_ONLY');
  let finishRead;
  const pendingBytes = new Promise(resolve => { finishRead = () => resolve(bytes.buffer); });
  $('import-file').files = [{ name: 'fictional-pending.md', size: bytes.length, arrayBuffer: () => pendingBytes }];
  const reading = $('import-file').fire('change');
  try {
    assert.equal(importer.reading(), true);
    edit('Current article edited during the file read.', 'Current notes edited during the file read.');
    tick();
    assert.equal(context.raw(), original); assert.equal(context.writes(), originalWrites);
    assert.equal(context.hasTimer(), true);
  } finally {
    finishRead(); await reading;
  }
  const expected = capture();
  assert.equal(importer.reading(), false); assert.equal(importer.pending(), true); assert.equal(importer.staged(), true);
  assert.match($('import-body-preview').value, /FILE_IMPORT_ONLY/);
  tick();
  assertSavedCurrent(context, expected);
  assert.equal(context.writes(), originalWrites + 1); assert.equal(importer.pending(), true);
  assert.equal(context.applied(), 0); assert.equal(context.restores(), 0);
}));
