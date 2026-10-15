import test from 'node:test';
import assert from 'node:assert/strict';
import { installPublishingExports } from '../public/export-controls.js';
import { QUICK_SAMPLE } from '../public/quick-sample.js';

class Control {
  constructor() { this.value = ''; this.checked = false; this.open = false; this.hidden = false; this.disabled = false; this.textContent = ''; this.attributes = {}; this.events = new Map(); }
  addEventListener(type, action) { this.events.set(type, action); }
  fire(type) { return this.events.get(type)?.(); }
  setAttribute(name, value) { this.attributes[name] = value; }
  replaceChildren() {}
  append() {}
}
async function withControls(run) {
  const previousDocument = globalThis.document, previousNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const nodes = new Map(), $ = id => { if (!nodes.has(id)) nodes.set(id, new Control()); return nodes.get(id); };
  let draft = { ...QUICK_SAMPLE }, images = false;
  const messages = [], writes = [];
  globalThis.document = { getElementById: $, createElement: () => new Control(), createTextNode: text => ({ textContent: text }) };
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { clipboard: { writeText: async text => { writes.push(text); } } } });
  try {
    const ui = installPublishingExports({ getDraft: () => draft, getWordPressOptions: () => ({ includeLinkedImages: images }), approved: () => { if (!$('reviewed').checked) throw new Error('Review first.'); }, changed: () => { $('reviewed').checked = false; ui.update(); }, report: message => messages.push(message) });
    $('reviewed').checked = true; ui.update();
    await run({ $, ui, messages, writes, draft: () => draft, edit: next => { draft = { ...draft, ...next }; }, images: value => { images = value; } });
  } finally {
    globalThis.document = previousDocument;
    if (previousNavigator) Object.defineProperty(globalThis, 'navigator', previousNavigator); else delete globalThis.navigator;
  }
}
for (const button of ['copy-wordpress', 'copy-wordpress-title']) test('Pending ' + button + ' gives local feedback and excludes overlapping body and title writes', () => withControls(async ({ $, messages, writes, draft }) => {
  let finish;
  navigator.clipboard.writeText = text => { writes.push(text); return new Promise(resolve => { finish = resolve; }); };
  const before = JSON.stringify(draft()), request = $(button).fire('click');
  assert.equal(writes.length, 1);
  assert.match($('wordpress-action-status').textContent, /Copying.*Wait for confirmation/);
  assert.equal($('wordpress-action-status').textContent, messages.at(-1));
  assert.equal($('wordpress-actions').attributes['aria-busy'], 'true');
  assert.equal($('copy-wordpress').disabled, true); assert.equal($('copy-wordpress-title').disabled, true);
  assert.equal($('download-wordpress').disabled, false);
  await $('copy-wordpress').fire('click'); await $('copy-wordpress-title').fire('click'); assert.equal(writes.length, 1);
  finish(); await request;
  assert.equal($('wordpress-actions').attributes['aria-busy'], 'false');
  assert.equal($('copy-wordpress').disabled, false); assert.equal($('copy-wordpress-title').disabled, false);
  assert.match($('wordpress-action-status').textContent, button === 'copy-wordpress' ? /WordPress blocks copied/ : /Title copied separately/);
  assert.equal($('wordpress-action-status').textContent, messages.at(-1));
  assert.equal(JSON.stringify(draft()), before); assert.equal($('reviewed').checked, true);
}));
test('Rejected and unavailable clipboard requests leave a visible fallback and release both copy controls', () => withControls(async ({ $, messages }) => {
  for (const button of ['copy-wordpress', 'copy-wordpress-title']) {
    for (const unavailable of [false, true]) {
      navigator.clipboard = unavailable ? undefined : { writeText: async () => { throw new Error('Permission denied'); } };
      await $(button).fire('click');
      assert.match($('wordpress-action-status').textContent, button === 'copy-wordpress' ? /Download the blocks/ : /copy it manually/);
      assert.equal($('wordpress-action-status').textContent, messages.at(-1));
      assert.equal($('wordpress-actions').attributes['aria-busy'], 'false');
      assert.equal($('copy-wordpress').disabled, false); assert.equal($('copy-wordpress-title').disabled, false);
    }
  }
  navigator.clipboard = { writeText: async () => {} }; await $('copy-wordpress').fire('click');
  assert.match($('wordpress-action-status').textContent, /WordPress blocks copied/);
}));
test('Changes during copying clear pending feedback and keep stale outcomes visible only in the current format', () => withControls(async ({ $, ui, edit, messages, draft }) => {
  let finish;
  navigator.clipboard.writeText = () => new Promise(resolve => { finish = resolve; });
  let request = $('copy-wordpress').fire('click');
  edit({ body: 'A changed fictional article.' }); $('reviewed').checked = false; ui.update();
  assert.equal($('wordpress-action-status').textContent, '');
  finish(); await request;
  assert.match($('wordpress-action-status').textContent, /earlier article version/);
  assert.equal($('copy-wordpress').disabled, true);
  $('reviewed').checked = true; ui.update(); request = $('copy-wordpress').fire('click');
  $('publishing-destination').value = 'html'; await $('publishing-destination').fire('change');
  finish(); await request;
  assert.match(messages.at(-1), /earlier article version/); assert.equal($('wordpress-action-status').textContent, '');
  assert.equal($('wordpress-primary-actions').hidden, true); assert.equal(draft().body, 'A changed fictional article.');
}));
test('Old copy confirmation clears on content, approval, image choices, destination and workspace reset', () => withControls(async ({ $, ui, edit, images }) => {
  const changes = [() => edit({ body: 'New fictional body.' }), () => edit({ title: 'New fictional title' }), () => { $('reviewed').checked = false; }, () => images(true), () => { $('publishing-destination').value = 'html'; }, () => ui.reset()];
  for (const change of changes) {
    $('publishing-destination').value = 'wordpress'; $('reviewed').checked = true; ui.update();
    await $('copy-wordpress').fire('click'); assert.match($('wordpress-action-status').textContent, /WordPress blocks copied/);
    change(); ui.update(); assert.equal($('wordpress-action-status').textContent, '');
  }
}));
