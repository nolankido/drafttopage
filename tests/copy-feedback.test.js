import test from 'node:test';
import assert from 'node:assert/strict';
import { installPublishingExports } from '../public/export-controls.js';
import { QUICK_SAMPLE } from '../public/quick-sample.js';
import { readFile } from 'node:fs/promises';
const WORDPRESS_COPIES = ['copy-wordpress', 'copy-wordpress-title', 'copy-wordpress-excerpt', 'copy-wordpress-slug', 'copy-wordpress-description'];

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
  let draft = { ...QUICK_SAMPLE }, images = false, busy = false;
  const messages = [], writes = [];
  globalThis.document = { getElementById: $, createElement: () => new Control(), createTextNode: text => ({ textContent: text }) };
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { clipboard: { writeText: async text => { writes.push(text); } } } });
  try {
    const ui = installPublishingExports({ getDraft: () => draft, getWordPressOptions: () => ({ includeLinkedImages: images }), approved: () => { if (!$('reviewed').checked) throw new Error('Review first.'); }, changed: () => { $('reviewed').checked = false; ui.update(); }, report: message => messages.push(message), isBusy: () => busy });
    $('reviewed').checked = true; ui.update();
    await run({ $, ui, messages, writes, draft: () => draft, edit: next => { draft = { ...draft, ...next }; }, images: value => { images = value; }, busy: value => { busy = value; ui.update(); } });
  } finally {
    globalThis.document = previousDocument;
    if (previousNavigator) Object.defineProperty(globalThis, 'navigator', previousNavigator); else delete globalThis.navigator;
  }
}
for (const button of WORDPRESS_COPIES) test('Pending ' + button + ' gives local feedback and excludes overlapping WordPress copies', () => withControls(async ({ $, messages, writes, draft }) => {
  let finish;
  navigator.clipboard.writeText = text => { writes.push(text); return new Promise(resolve => { finish = resolve; }); };
  const before = JSON.stringify(draft()), request = $(button).fire('click');
  assert.equal(writes.length, 1);
  assert.match($('wordpress-action-status').textContent, /Copying.*Wait for confirmation/);
  assert.equal($('wordpress-action-status').textContent, messages.at(-1));
  assert.equal($('wordpress-actions').attributes['aria-busy'], 'true');
  assert.equal($('copy-wordpress').disabled, true); assert.equal($('copy-wordpress-title').disabled, true);
  assert.equal($('download-wordpress').disabled, false);
  for (const other of WORDPRESS_COPIES) { assert.equal($(other).disabled, true); await $(other).fire('click'); }
  assert.equal(writes.length, 1); assert.equal($('download-wordpress-kit').disabled, false);
  assert.equal($('wordpress-field-actions').attributes['aria-busy'], 'true');
  finish(); await request;
  assert.equal($('wordpress-actions').attributes['aria-busy'], 'false');
  assert.equal($('copy-wordpress').disabled, false); assert.equal($('copy-wordpress-title').disabled, false);
  assert.match($('wordpress-action-status').textContent, button === 'copy-wordpress' ? /WordPress blocks copied/ : button === 'copy-wordpress-title' ? /Title copied separately/ : /copied separately/);
  assert.equal($('wordpress-action-status').textContent, messages.at(-1));
  assert.equal(JSON.stringify(draft()), before); assert.equal($('reviewed').checked, true);
  assert.equal($('wordpress-fields-action-status').textContent, messages.at(-1));
  assert.equal($('wordpress-field-actions').attributes['aria-busy'], 'false');
  for (const other of WORDPRESS_COPIES) assert.equal($(other).disabled, false);
}));
test('Rejected and unavailable clipboard requests leave a visible fallback and release both copy controls', () => withControls(async ({ $, messages }) => {
  for (const button of WORDPRESS_COPIES) {
    for (const unavailable of [false, true]) {
      navigator.clipboard = unavailable ? undefined : { writeText: async () => { throw new Error('Permission denied'); } };
      await $(button).fire('click');
      assert.match($('wordpress-action-status').textContent, button === 'copy-wordpress' ? /Download the blocks/ : /copy it manually/);
      assert.equal($('wordpress-action-status').textContent, messages.at(-1));
      assert.equal($('wordpress-actions').attributes['aria-busy'], 'false');
      assert.equal($('copy-wordpress').disabled, false); assert.equal($('copy-wordpress-title').disabled, false);
      for (const other of WORDPRESS_COPIES) assert.equal($(other).disabled, false);
      assert.equal($('wordpress-fields-action-status').textContent, messages.at(-1));
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
  const changes = [() => edit({ body: 'New fictional body.' }), () => edit({ title: 'New fictional title' }), () => edit({ excerpt: 'New fictional excerpt' }), () => edit({ slug: 'new-fictional-slug' }), () => edit({ description: 'New fictional description' }), () => { $('reviewed').checked = false; }, () => images(true), () => { $('publishing-destination').value = 'html'; }, () => ui.reset()];
  for (const change of changes) {
    $('publishing-destination').value = 'wordpress'; $('reviewed').checked = true; ui.update();
    await $('copy-wordpress').fire('click'); assert.match($('wordpress-action-status').textContent, /WordPress blocks copied/);
    change(); ui.update(); assert.equal($('wordpress-action-status').textContent, ''); assert.equal($('wordpress-fields-action-status').textContent, '');
  }
}));

for (const key of ['excerpt', 'slug', 'description']) test('Pending ' + key + ' copy warns after edits and permits an explicit fresh copy', () => withControls(async ({ $, ui, edit, messages, writes, draft }) => {
  let finish;
  navigator.clipboard.writeText = text => { writes.push(text); return new Promise(resolve => { finish = resolve; }); };
  const original = draft()[key], request = $('copy-wordpress-' + key).fire('click');
  assert.equal(writes.at(-1), original.trim());
  edit({ [key]: key === 'slug' ? 'revised-fictional-slug' : 'Revised fictional ' + key }); $('reviewed').checked = false; ui.update();
  assert.equal($('wordpress-fields-action-status').textContent, '');
  finish(); await request;
  assert.match(messages.at(-1), new RegExp('earlier ' + key + ' was copied.*Review and copy the current value'));
  assert.equal($('wordpress-fields-action-status').textContent, messages.at(-1)); assert.equal($('copy-wordpress-' + key).disabled, true);
  $('reviewed').checked = true; navigator.clipboard.writeText = async text => { writes.push(text); }; ui.update();
  await $('copy-wordpress-' + key).fire('click'); assert.equal(writes.at(-1), draft()[key].trim()); assert.match(messages.at(-1), /copied separately/);
}));

test('Field copies refuse hidden destinations, file-operation busy state, unreviewed writing and invalid optional fields', () => withControls(async ({ $, ui, writes, edit, busy }) => {
  busy(true); for (const id of WORDPRESS_COPIES) { assert.equal($(id).disabled, true); await $(id).fire('click'); } assert.equal(writes.length, 0);
  busy(false); $('publishing-destination').value = 'html'; ui.update();
  for (const key of ['excerpt', 'slug', 'description']) await $('copy-wordpress-' + key).fire('click'); assert.equal(writes.length, 0);
  $('publishing-destination').value = 'wordpress'; $('reviewed').checked = false; ui.update();
  for (const key of ['excerpt', 'slug', 'description']) await $('copy-wordpress-' + key).fire('click'); assert.equal(writes.length, 0);
  $('reviewed').checked = true; edit({ excerpt: '', slug: '../invalid', description: 'x'.repeat(161) }); ui.update();
  for (const key of ['excerpt', 'slug', 'description']) { assert.equal($('copy-wordpress-' + key).disabled, true); await $('copy-wordpress-' + key).fire('click'); } assert.equal(writes.length, 0);
  assert.equal($('copy-wordpress').disabled, false); assert.equal($('wordpress-field-actions').attributes['aria-busy'], 'false');
}));

test('Destination changes and workspace reset retain the outstanding copy lock and never show stale field success', () => withControls(async ({ $, ui, messages, writes }) => {
  let finish;
  navigator.clipboard.writeText = text => { writes.push(text); return new Promise(resolve => { finish = resolve; }); };
  let request = $('copy-wordpress-excerpt').fire('click');
  $('publishing-destination').value = 'html'; await $('publishing-destination').fire('change'); finish(); await request;
  assert.match(messages.at(-1), /earlier excerpt/); assert.equal($('wordpress-fields-action-status').textContent, '');
  $('publishing-destination').value = 'wordpress'; $('reviewed').checked = true; ui.update(); request = $('copy-wordpress-description').fire('click');
  ui.reset(); $('reviewed').checked = false; ui.update();
  assert.equal($('wordpress-fields-action-status').textContent, ''); assert.equal($('wordpress-field-actions').attributes['aria-busy'], 'true');
  for (const id of WORDPRESS_COPIES) await $(id).fire('click'); assert.equal(writes.length, 2);
  finish(); await request; assert.match(messages.at(-1), /earlier description/); assert.equal($('wordpress-field-actions').attributes['aria-busy'], 'false');
}));

test('All public workspaces keep optional-field feedback beside its copies with one existing live announcement', async () => {
  for (const route of ['write', 'word-to-wordpress', 'google-docs-to-wordpress', 'markdown-to-wordpress', 'markdown-to-html', 'markdown-to-word']) {
    const html = await readFile('public/' + route + '/index.html', 'utf8');
    assert.match(html, /id="wordpress-field-actions"[^>]*aria-busy="false"/);
    const group = html.slice(html.indexOf('id="wordpress-field-actions"'), html.indexOf('</div>', html.indexOf('id="wordpress-field-actions"')));
    for (const key of ['excerpt', 'slug', 'description']) assert.ok(group.includes('id="copy-wordpress-' + key + '"'));
    assert.match(group, /id="wordpress-fields-action-status"[^>]*aria-live="off"/);
  }
});
