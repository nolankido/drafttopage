import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as alpha from '../public/browser-recovery.js';
import { createWorkspaceBackup, parseWorkspaceBackup } from '../public/workspace.js';
import { createCheckpointHistory } from '../public/revisions.js';

// Explicit local candidate only. Storage, locks and user decisions are model substitutes.
const root = resolve(process.env.DRAFTTOPAGE_COMPAT_ROOT || fileURLToPath(new URL('../', import.meta.url)));
assert.equal(JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')).name, 'drafttopage');
const candidate = await import(pathToFileURL(resolve(root, 'public/browser-recovery.js')).href);
const stamp = '2026-10-16T09:00:00.000Z', clone = value => structuredClone(value);
const saved = () => ({ source: { profile: 'guide', audience: 'Fictional readers', purpose: 'A compatibility exercise', notes: 'PRIVATE_RECOVERY_9142: café 日本語 😀.' }, draft: { title: 'Fictional recovery article', excerpt: '', description: '', slug: 'fictional-recovery', body: 'Keep ALPHA_END_9142 and the final paragraph.', questions: ['PRIVATE_QUESTION_9142'] } });
const canonical = value => parseWorkspaceBackup(createWorkspaceBackup(value.source, value.draft));
const settle = () => new Promise(resolve => setImmediate(resolve));

function environment() {
  const records = new Map(), held = new Set(); let full = false, writes = 0;
  const storage = { getItem: key => records.get(key) ?? null,
    setItem: (key, value) => { if (full) throw new Error('Fictional storage-full failure'); records.set(key, value); writes++; },
    removeItem: key => records.delete(key) };
  const locks = { request: async (name, options, action) => {
    assert.equal(name, alpha.RECOVERY_LOCK); assert.equal(options.ifAvailable, true);
    await Promise.resolve(); if (held.has(name)) return action(null);
    held.add(name); try { return await action({ name }); } finally { held.delete(name); }
  } };
  return { records, storage, locks, full: value => { full = value; }, writes: () => writes };
}
function session(api, env, initial) {
  let writing = clone(initial), approved = true, confirmed = true, timer = null;
  const history = createCheckpointHistory({ now: () => stamp });
  const control = api.createBrowserRecovery({ storage: () => env.storage, locks: () => env.locks,
    capture: () => ({ ...clone(writing), approved, pendingImport: 'PRIVATE_PENDING_9142' }),
    restore: value => { history.save(writing, 'Before cross-version restore'); writing = { source: clone(value.source), draft: clone(value.draft) }; approved = false; },
    hasWork: () => true, confirm: () => confirmed, now: () => stamp,
    setTimer: callback => { timer = callback; return 1; }, clearTimer: () => { timer = null; }
  });
  return { control, history, capture: () => clone(writing), approved: () => approved,
    edit: value => { writing.draft.body = value; approved = false; }, decision: value => { confirmed = value; },
    review: () => control.inspect?.(), tick: () => { const action = timer; timer = null; action?.(); } };
}

test('Recovery portability: the version-1 envelope and origin-scoped lock agree, without transient approval or imports', () => {
  assert.equal(candidate.RECOVERY_KEY, alpha.RECOVERY_KEY); assert.equal(candidate.RECOVERY_LOCK, alpha.RECOVERY_LOCK);
  for (const [from, to] of [[alpha, candidate], [candidate, alpha]]) {
    const input = { ...saved(), approved: true, pendingImport: 'PRIVATE_PENDING_9142', exportChoice: 'PRIVATE_CHOICE_9142' };
    const raw = from.createBrowserCopy(input, stamp), record = to.parseBrowserCopy(raw);
    assert.deepEqual(record, { savedAt: stamp, workspace: canonical(input) });
    assert.equal(to.createBrowserCopy(record.workspace, record.savedAt), raw);
    assert.doesNotMatch(raw, /approved|PRIVATE_PENDING_9142|PRIVATE_CHOICE_9142/);
    assert.match(raw, /PRIVATE_RECOVERY_9142/); assert.match(raw, /PRIVATE_QUESTION_9142/);
    for (const altered of [{ ...JSON.parse(raw), version: 2 }, { ...JSON.parse(raw), approved: true }]) assert.throws(() => to.parseBrowserCopy(JSON.stringify(altered)));
  }
});

for (const [name, writerAPI, readerAPI] of [['alpha to candidate', alpha, candidate], ['candidate to alpha', candidate, alpha]]) {
  test('Recovery portability: protected handoff, cancellation, checkpoint and deletion, ' + name, async () => {
    const env = environment(), original = saved(), other = saved(); other.draft.body = 'Different unsaved fictional writing.';
    const first = session(writerAPI, env, original), second = session(readerAPI, env, other);
    try {
      first.control.schedule(); second.control.schedule(); assert.equal(env.writes(), 0);
      assert.equal(await first.control.start(), true); const raw = env.records.get(alpha.RECOVERY_KEY);
      assert.equal(second.control.state().enabled, false); assert.deepEqual(second.capture(), other);
      assert.equal(await second.control.resume(second.review()), false);
      assert.equal(await second.control.forget(), false); assert.equal(await second.control.removeForClear(), false);
      assert.equal(env.records.get(alpha.RECOVERY_KEY), raw); assert.deepEqual(second.capture(), other);
      assert.equal(first.control.pause(), true); await settle();
      second.decision(false); assert.equal(await second.control.resume(second.review()), false);
      assert.deepEqual(second.capture(), other); assert.equal(env.records.get(alpha.RECOVERY_KEY), raw);
      second.decision(true); assert.equal(await second.control.resume(second.review()), true);
      assert.deepEqual(canonical(second.capture()), canonical(original)); assert.equal(second.approved(), false);
      assert.deepEqual(second.history.read(second.history.list()[0].id), canonical(other));
      assert.equal(await second.control.forget(), true); assert.equal(env.records.get(alpha.RECOVERY_KEY), undefined);
      assert.deepEqual(canonical(second.capture()), canonical(original));
      second.edit('New unsaved writing after deliberate removal.'); second.control.schedule(); second.tick();
      first.control.refresh(); first.control.schedule();
      assert.equal(env.records.get(alpha.RECOVERY_KEY), undefined); assert.equal(second.control.state().enabled, false);
    } finally { first.control.dispose(); second.control.dispose(); await settle(); }
  });

  test('Recovery portability: a full-storage failure after handoff retains the earlier copy and newest file backup, ' + name, async () => {
    const env = environment(), first = session(writerAPI, env, saved()), second = session(readerAPI, env, saved());
    try {
      assert.equal(await first.control.start(), true); const raw = env.records.get(alpha.RECOVERY_KEY);
      first.control.pause(); await settle(); assert.equal(await second.control.resume(second.review()), true);
      second.edit('Latest fictional article ends with LATEST_END_9142.'); env.full(true);
      assert.equal(second.control.pause(), false); assert.equal(second.control.state().enabled, false);
      assert.equal(env.records.get(alpha.RECOVERY_KEY), raw);
      assert.deepEqual(writerAPI.parseBrowserCopy(raw).workspace, canonical(saved()));
      assert.match(second.control.state().message, /without confirming the latest changes were saved/);
      const newest = canonical(second.capture()); assert.match(newest.draft.body, /LATEST_END_9142\.$/);
      assert.equal(writerAPI.parseBrowserCopy(raw).workspace.draft.body, saved().draft.body);
    } finally { env.full(false); first.control.dispose(); second.control.dispose(); await settle(); }
  });
}

test('Recovery portability: changed open writing during lock acquisition rejects restoration on both models', async () => {
  for (const api of [alpha, candidate]) {
    const env = environment(), raw = alpha.createBrowserCopy(saved(), stamp); env.records.set(alpha.RECOVERY_KEY, raw);
    const current = saved(); current.draft.body = 'Current fictional article before inspection.';
    const writer = session(api, env, current);
    try {
      const pending = writer.control.resume(writer.review()); writer.edit('Changed while the restore lock was pending.');
      assert.equal(await pending, false); assert.equal(writer.history.list().length, 0);
      assert.equal(writer.capture().draft.body, 'Changed while the restore lock was pending.');
      assert.equal(env.records.get(alpha.RECOVERY_KEY), raw); assert.equal(writer.control.state().enabled, false);
    } finally { writer.control.dispose(); await settle(); }
  }
});
