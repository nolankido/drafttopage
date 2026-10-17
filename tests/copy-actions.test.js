import test from 'node:test';
import assert from 'node:assert/strict';
import { createCopyActions } from '../public/copy-actions.js';
import { installPublishingExports } from '../public/export-controls.js';
import { QUICK_SAMPLE } from '../public/quick-sample.js';

function model() {
  let signature = 'first', done, reject, writes = 0, changed = 0;
  const messages = [], copies = createCopyActions({ snapshot: () => signature, report: text => messages.push(text), changed: () => changed++ });
  const task = { destination: 'wordpress', label: 'WordPress blocks', success: 'Copied current.', fallback: 'Download or manually copy.', write: () => {
    writes++; return new Promise((resolve, fail) => { done = resolve; reject = fail; });
  } };
  return { copies, task, messages, edit: value => { signature = value; }, done: () => done(), reject: () => reject(new Error('PRIVATE_ERROR_DETAILS')), writes: () => writes, changes: () => changed };
}
test('A copy starts synchronously in the user action and excludes every overlapping copy until settlement', async () => {
  const x = model(); assert.equal(x.writes(), 0); x.copies.state();
  const first = x.copies.run(x.task); assert.equal(x.writes(), 1); assert.equal(x.copies.state().pending, true);
  for (let i = 0; i < 6; i++) assert.equal(await x.copies.run({ ...x.task, destination: 'html' }), false);
  assert.equal(x.writes(), 1); assert.match(x.messages.at(-1), /Wait for confirmation/);
  x.done(); assert.equal(await first, true); assert.equal(x.copies.state().pending, false); assert.equal(x.copies.state().outcome, 'success');
});
test('Observed edits invalidate a pending copy even if writing later returns to its original value', async () => {
  const x = model(), first = x.copies.run(x.task);
  x.edit('changed'); x.copies.state(); x.edit('first'); x.copies.state();
  x.done(); assert.equal(await first, false); assert.equal(x.copies.state().outcome, 'stale'); assert.match(x.messages.at(-1), /earlier export/);
});
test('Missed refreshes still identify changed writing at completion and clear old feedback on the next edit', async () => {
  const x = model(), first = x.copies.run(x.task); x.edit('new'); x.done();
  assert.equal(await first, false); assert.match(x.messages.at(-1), /earlier export/);
  x.edit('newer'); assert.equal(x.copies.state().feedback, ''); assert.equal(x.copies.state().outcome, 'idle');
});
test('Denied, unavailable, and synchronously throwing clipboard calls release the lock without exposing error details', async () => {
  const x = model(), first = x.copies.run(x.task); x.reject();
  assert.equal(await first, false); assert.equal(x.copies.state().outcome, 'failure'); assert.equal(x.messages.at(-1), x.task.fallback);
  assert.equal(await x.copies.run({ ...x.task, write: () => { throw new Error('PRIVATE_ERROR_DETAILS'); } }), false);
  assert.equal(x.copies.state().pending, false); assert.doesNotMatch(x.messages.join('\n'), /PRIVATE_ERROR_DETAILS/);
  assert.equal(await x.copies.run({ ...x.task, write: () => Promise.resolve() }), true);
});
test('A failure after a destination or review change identifies the earlier request', async () => {
  const x = model(), first = x.copies.run(x.task); x.edit('new destination'); x.reject();
  assert.equal(await first, false); assert.equal(x.copies.state().outcome, 'stale'); assert.match(x.messages.at(-1), /earlier copy request failed/);
});
test('Download feedback does not cancel or unlock the pending browser write', async () => {
  const x = model(), first = x.copies.run(x.task);
  x.copies.notice('Download requested; check the saved file.', 'wordpress');
  assert.equal(x.copies.state().pending, true); assert.equal(await x.copies.run(x.task), false); assert.equal(x.writes(), 1);
  x.done(); await first; assert.equal(x.copies.state().feedback, 'Copied current.');
});

class Control {
  constructor() { this.value = ''; this.checked = false; this.open = false; this.hidden = false; this.disabled = false; this.textContent = ''; this.attributes = {}; this.events = new Map(); this.children = []; }
  get disabled() { return this._disabled; }
  set disabled(value) {
    this._disabled = value;
    // Match the native browser behavior that exposed the keyboard focus bug.
    if (value && globalThis.document?.activeElement === this) globalThis.document.activeElement = globalThis.document.body;
  }
  focus() { if (!this.disabled) globalThis.document.activeElement = this; }
  addEventListener(type, action) { this.events.set(type, action); }
  fire(type = 'click') { return this.events.get(type)?.(); }
  setAttribute(name, value) { this.attributes[name] = value; }
  replaceChildren(...items) { this.children = items; }
  append(...items) { this.children.push(...items); }
}
const copyButtons = ['copy-wordpress', 'copy-wordpress-title', 'copy-wordpress-excerpt', 'copy-wordpress-slug', 'copy-wordpress-description', 'copy-html-source', 'copy-article-markdown', 'copy-formatted', 'copy', 'copy-body', 'copy-brief', 'copy-questions'];
async function withUI(run) {
  const previousDocument = globalThis.document, previousNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const nodes = new Map(), $ = id => { if (!nodes.has(id)) nodes.set(id, new Control()); return nodes.get(id); };
  let draft = { ...QUICK_SAMPLE, questions: ['PRIVATE_REVIEW_SENTINEL'] }, busy = false;
  const writes = [], messages = [];
  const body = new Control();
  globalThis.document = { body, activeElement: body, getElementById: $, createElement: () => new Control(), createTextNode: text => ({ textContent: text }) };
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { clipboard: { writeText: async text => { writes.push(text); } } } });
  try {
    const ui = installPublishingExports({ getDraft: () => draft, getCopySnapshot: () => ({ draft, source: 'PRIVATE_SOURCE_SENTINEL' }), approved: () => { if (!$('reviewed').checked) throw new Error('Review first'); }, changed: () => { $('reviewed').checked = false; ui.update(); }, report: text => messages.push(text), isBusy: () => busy });
    $('reviewed').checked = true; ui.update();
    await run({ $, ui, writes, messages, edit: values => { draft = { ...draft, ...values }; }, busy: value => { busy = value; ui.update(); } });
  } finally {
    globalThis.document = previousDocument;
    if (previousNavigator) Object.defineProperty(globalThis, 'navigator', previousNavigator); else delete globalThis.navigator;
  }
}
for (const id of ['copy-wordpress', 'copy-wordpress-title', 'copy-wordpress-excerpt', 'copy-wordpress-slug', 'copy-wordpress-description']) {
  test('Pending ' + id + ' locks every publishing copy while keeping downloads available and feedback nearby', () => withUI(async ({ $, ui, writes, messages }) => {
    let finish; navigator.clipboard.writeText = text => { writes.push(text); return new Promise(resolve => { finish = resolve; }); };
    const first = $(id).fire(); assert.equal(writes.length, 1);
    assert.equal($('wordpress-instructions').open, false);
    for (const button of copyButtons) {
      assert.equal($(button).disabled || $(button).attributes['aria-disabled'] === 'true', true, button);
    }
    for (const button of ['copy-wordpress', 'copy-wordpress-title', 'copy-wordpress-excerpt']) await $(button).fire();
    assert.equal(writes.length, 1); assert.equal($('download-wordpress').disabled, false); assert.equal($('download-wordpress-kit').disabled, false);
    assert.equal($('wordpress-actions').attributes['aria-busy'], 'true'); assert.equal($('wordpress-field-actions').attributes['aria-busy'], 'true');
    assert.match($('wordpress-action-status').textContent, /Wait for confirmation/);
    finish(); await first; assert.equal($('wordpress-actions').attributes['aria-busy'], 'false');
    assert.equal($('copy-wordpress').disabled, false); assert.equal($('wordpress-action-status').textContent, messages.at(-1));
    assert.equal($('wordpress-fields-action-status').textContent, messages.at(-1)); assert.match(messages.at(-1), /copied/);
    assert.equal($('wordpress-instructions').open, id === 'copy-wordpress');
    if (id === 'copy-wordpress') {
      assert.match(messages.at(-1), /new, empty WordPress draft.*empty paragraph below the title in Visual editor/);
      assert.match(messages.at(-1), /paste normally with Ctrl\+V or Command\+V/);
      assert.match(messages.at(-1), /save as a draft, then close and reopen/);
      assert.doesNotMatch(messages.at(-1), /Code editor/);
    }
    assert.doesNotMatch(writes.join('\n'), /PRIVATE_(?:SOURCE|REVIEW)_SENTINEL/); assert.equal($('reviewed').checked, true);
    ui.update(); assert.equal($('wordpress-action-status').textContent, messages.at(-1));
  }));
}
test('A pending WordPress copy retains keyboard focus while locked, then announces success or failure without moving focus', async () => {
  for (const fails of [false, true]) await withUI(async ({ $, writes }) => {
    let finish, reject;
    navigator.clipboard.writeText = text => { writes.push(text); return new Promise((resolve, fail) => { finish = resolve; reject = fail; }); };
    const button = $('copy-wordpress'); button.focus();
    const pending = button.fire();
    assert.equal(document.activeElement, button);
    assert.equal(button.disabled, false);
    assert.equal(button.attributes['aria-disabled'], 'true');
    await button.fire(); await button.fire();
    assert.equal(writes.length, 1);
    assert.equal($('wordpress-instructions').open, false);
    if (fails) reject(new Error('Permission denied')); else finish();
    await pending;
    assert.equal(document.activeElement, button);
    assert.equal(button.attributes['aria-disabled'], 'false');
    assert.equal($('wordpress-instructions').open, !fails);
    assert.match($('wordpress-action-status').textContent, fails ? /Download the blocks/ : /WordPress blocks copied/);
  });
});
test('Completing a WordPress copy preserves later user focus and keeps changed writing unapproved', async () => {
  for (const edits of [false, true]) await withUI(async ({ $, ui, edit }) => {
    let finish;
    navigator.clipboard.writeText = () => new Promise(resolve => { finish = resolve; });
    const button = $('copy-wordpress'); button.focus();
    const pending = button.fire();
    const next = $(edits ? 'body' : 'download-wordpress'); next.focus();
    if (edits) { edit({ body: 'Changed while clipboard permission was pending.' }); $('reviewed').checked = false; ui.update(); }
    finish(); await pending;
    assert.equal(document.activeElement, next);
    assert.equal(button.disabled, edits);
    assert.equal(button.attributes['aria-disabled'], String(edits));
    assert.equal($('reviewed').checked, !edits);
    assert.equal($('wordpress-instructions').open, !edits);
  });
});
test('A WordPress request cannot overlap a later HTML or Markdown copy, and stale feedback stays out of the new destination', () => withUI(async ({ $, ui, writes, messages }) => {
  let finish; navigator.clipboard.writeText = text => { writes.push(text); return new Promise(resolve => { finish = resolve; }); };
  const first = $('copy-wordpress').fire();
  for (const destination of ['html', 'markdown']) {
    $('publishing-destination').value = destination; $('publishing-destination').fire('change'); $('reviewed').checked = true; ui.update();
    assert.equal($(destination === 'html' ? 'copy-html-source' : 'copy-article-markdown').disabled, true);
    assert.equal($(destination === 'html' ? 'download-html-source' : 'download-article-markdown').disabled, false);
    await $(destination === 'html' ? 'copy-html-source' : 'copy-article-markdown').fire();
  }
  assert.equal(writes.length, 1); finish(); await first;
  assert.match(messages.at(-1), /earlier export/); assert.equal($('wordpress-action-status').textContent, ''); assert.equal($('markdown-action-status').textContent, '');
  assert.equal($('wordpress-instructions').open, false);
  assert.equal($('copy-article-markdown').disabled, false);
}));
test('Permission failures show a nearby fallback, clear on editing, and do not disable downloads', () => withUI(async ({ $, ui, messages, edit }) => {
  navigator.clipboard.writeText = async () => { throw new Error('PRIVATE_ERROR_DETAILS'); };
  await $('copy-wordpress').fire(); assert.match($('wordpress-action-status').textContent, /Download the blocks/);
  assert.equal($('copy-wordpress').disabled, false); assert.equal($('download-wordpress').disabled, false);
  assert.equal($('wordpress-instructions').open, false);
  assert.doesNotMatch($('wordpress-action-status').textContent, /WordPress blocks copied/);
  assert.doesNotMatch(messages.join('\n'), /PRIVATE_ERROR_DETAILS/);
  edit({ body: 'An updated article.' }); $('reviewed').checked = false; ui.update();
  assert.equal($('wordpress-action-status').textContent, ''); assert.equal($('copy-wordpress').disabled, true);
}));
