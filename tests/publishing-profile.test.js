import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_PROFILE_BYTES, validatePublishingProfile, createPublishingProfile, parsePublishingProfile, checklistFromText } from '../public/publishing-profile.js';
import { installPublishingProfiles } from '../public/publishing-profile-controls.js';
import { createWorkspaceBackup } from '../public/workspace.js';

const fixture = () => ({ format: 'drafttopage-publishing-profile', version: 1, name: 'Weekly website', preferences: { destination: 'html', formattedTitle: false, htmlTitle: true, wordTitle: false, markdownTitle: 'document' }, checklist: ['Compare names with source notes', 'Preview the final page'] });
test('Portable profile round trip contains choices and reminders only, with fresh allowlisted objects', () => {
  const original = fixture(), content = createPublishingProfile(original), parsed = parsePublishingProfile(content);
  assert.deepEqual(parsed, original); parsed.preferences.htmlTitle = false; parsed.checklist.push('Another reminder');
  assert.equal(original.preferences.htmlTitle, true); assert.equal(original.checklist.length, 2);
  assert.deepEqual(Object.keys(JSON.parse(content)), ['format', 'version', 'name', 'preferences', 'checklist']);
  assert.deepEqual(Object.keys(JSON.parse(content).preferences), ['destination', 'formattedTitle', 'htmlTitle', 'wordTitle', 'markdownTitle']);
});
test('Profiles reject unsupported versions, writing, unknown keys and prototype-shaped input', () => {
  const values = [null, [], {}, { ...fixture(), version: 2 }, { ...fixture(), body: 'Article' }, { ...fixture(), approval: true }, { ...fixture(), format: 'drafttopage-workspace' }, JSON.parse('{"__proto__":{}}')];
  for (const value of values) assert.throws(() => validatePublishingProfile(value));
  for (const key of ['source', 'title', 'notes', 'questions', '__proto__']) {
    const value = fixture(); Object.defineProperty(value.preferences, key, { value: 'writing', enumerable: true }); assert.throws(() => validatePublishingProfile(value));
  }
});
test('Profile choices are strict typed enums, including prototype names and coercible arrays', () => {
  for (const destination of ['__proto__', 'constructor', 'https://example.com', null, ['word'], {}]) assert.throws(() => validatePublishingProfile({ ...fixture(), preferences: { ...fixture().preferences, destination } }));
  for (const key of ['formattedTitle', 'htmlTitle', 'wordTitle']) for (const value of ['false', 0, null, []]) assert.throws(() => validatePublishingProfile({ ...fixture(), preferences: { ...fixture().preferences, [key]: value } }));
  for (const markdownTitle of [true, 'yes', null, ['page']]) assert.throws(() => validatePublishingProfile({ ...fixture(), preferences: { ...fixture().preferences, markdownTitle } }));
});
test('Bounded profile names and checklists allow literal markup without executable interpretation', () => {
  const value = { ...fixture(), name: '<img src=x>', checklist: ['<script>literal text</script>', 'x'.repeat(160)] };
  assert.deepEqual(parsePublishingProfile(createPublishingProfile(value)), value);
  for (const name of ['', ' ', 'x'.repeat(81), 'line\nbreak', 'null\0value']) assert.throws(() => validatePublishingProfile({ ...fixture(), name }));
  for (const checklist of [[''], ['a', ' a '], ['a\nb'], ['a\0b'], ['x'.repeat(161)], Array.from({ length: 9 }, (_, i) => String(i)), 'a']) assert.throws(() => validatePublishingProfile({ ...fixture(), checklist }));
  assert.deepEqual(checklistFromText('  Compare dates  \n\nPreview page\n'), ['Compare dates', 'Preview page']);
  assert.deepEqual(checklistFromText(''), []);
  assert.throws(() => checklistFromText('a'.repeat(1288)));
});
test('Profile reading bounds UTF-8 bytes before JSON parsing and distinguishes workspace backups', () => {
  assert.throws(() => parsePublishingProfile('😀'.repeat(MAX_PROFILE_BYTES / 4 + 1)), /16 KiB/);
  assert.throws(() => parsePublishingProfile('{'), /valid JSON/);
  const backup = createWorkspaceBackup({ profile: 'personal', notes: '', audience: '', purpose: '' }, null);
  assert.throws(() => parsePublishingProfile(backup), /profile/);
});

class Control {
  constructor(tag = '') { this.tag = tag; this.value = ''; this.checked = false; this.open = false; this.hidden = false; this.disabled = false; this.textContent = ''; this.children = []; this.attrs = {}; this.events = new Map(); }
  addEventListener(event, fn) { if (!this.events.has(event)) this.events.set(event, []); this.events.get(event).push(fn); }
  async fire(event) { for (const fn of this.events.get(event) || []) await fn(); }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; }
  setAttribute(key, value) { this.attrs[key] = value; }
  removeAttribute(key) { delete this.attrs[key]; }
  querySelectorAll(tag) { return this.children.flatMap(node => [...(node.tag === tag ? [node] : []), ...node.querySelectorAll(tag)]); }
}
async function controls(run) {
  const prior = globalThis.document, fields = new Map(), $ = id => { if (!fields.has(id)) fields.set(id, new Control()); return fields.get(id); };
  globalThis.document = { getElementById: $, createElement: tag => new Control(tag) };
  const workspace = { source: { profile: 'personal', notes: 'PRIVATE source', audience: 'PRIVATE audience', purpose: 'PRIVATE purpose' }, draft: { title: 'PRIVATE title', body: 'PRIVATE body', excerpt: 'PRIVATE excerpt', description: 'PRIVATE description', slug: 'private-slug', questions: ['PRIVATE question'] } };
  $('publishing-destination').value = 'word'; $('export-format').value = 'page';
  let busy = false, resetImageCalls = 0, changedCalls = 0, downloaded = null, lastReport = '';
  const ui = installPublishingProfiles({ getWorkspace: () => workspace, resetLinkedImages: () => { resetImageCalls++; $('wordpress-linked-images').checked = false; }, changed: () => { changedCalls++; $('reviewed').checked = false; ui.update(); }, workChanged: () => {}, isBusy: () => busy, report: text => { lastReport = text; }, download: (...args) => { downloaded = args; } });
  const load = async (content = createPublishingProfile(fixture()), size = new TextEncoder().encode(content).byteLength) => { $('load-publishing-profile').files = [{ size, text: async () => content }]; await $('load-publishing-profile').fire('change'); };
  try { await run({ $, ui, workspace, load, busy: value => { busy = value; ui.update(); }, imageResets: () => resetImageCalls, changes: () => changedCalls, downloaded: () => downloaded, report: () => lastReport }); }
  finally { globalThis.document = prior; }
}
test('Profile preview and cancellation leave all writing, choices, and approval untouched', () => controls(async ({ $, workspace, load, changes }) => {
  const before = JSON.stringify(workspace); $('reviewed').checked = true; await load();
  assert.equal($('publishing-profile-preview').hidden, false); assert.equal($('publishing-profile-preview-name').textContent, 'Weekly website');
  assert.equal($('publishing-destination').value, 'word'); assert.equal($('reviewed').checked, true); assert.equal(changes(), 0);
  await $('cancel-publishing-profile').fire('click'); assert.equal($('publishing-profile-preview').hidden, true); assert.equal($('publishing-profile-preview-name').textContent, ''); assert.equal($('publishing-profile-preview-choices').children.length, 0); assert.equal($('apply-publishing-profile').disabled, true);
  assert.equal(JSON.stringify(workspace), before); assert.equal($('reviewed').checked, true);
}));
test('Apply replaces export choices only, clears approval, and starts reminders unchecked', () => controls(async ({ $, ui, workspace, load, changes }) => {
  const before = JSON.stringify(workspace); $('reviewed').checked = true; await load(); await $('apply-publishing-profile').fire('click');
  assert.equal(JSON.stringify(workspace), before); assert.equal($('publishing-destination').value, 'html'); assert.equal($('html-include-title').checked, true); assert.equal($('export-format').value, 'document');
  assert.equal($('reviewed').checked, false); assert.equal(changes(), 1); assert.equal($('publishing-checklist').hidden, false);
  const items = $('publishing-checklist-items').querySelectorAll('input'); assert.equal(items.length, 2); assert.ok(items.every(input => !input.checked));
  items[0].checked = true; await items[0].fire('change'); assert.match($('publishing-checklist-status').textContent, /1 \/ 2/); assert.equal($('reviewed').checked, false);
  $('reviewed').checked = true; ui.update(); assert.equal(items[0].checked, true); assert.equal($('reviewed').checked, true);
}));
test('Writing, source, and export-choice changes reset checklist ticks; view updates preserve them', () => controls(async ({ $, ui, workspace, load }) => {
  await load(); await $('apply-publishing-profile').fire('click');
  for (const mutate of [() => { workspace.draft.body += '!'; }, () => { workspace.source.notes += '!'; }, () => { $('word-include-title').checked = true; }, () => { workspace.draft.questions.push('Another question'); }]) {
    let input = $('publishing-checklist-items').querySelectorAll('input')[0]; input.checked = true; await input.fire('change'); ui.update(); assert.match($('publishing-checklist-status').textContent, /1 \/ 2/);
    mutate(); ui.update(); assert.ok($('publishing-checklist-items').querySelectorAll('input').every(x => !x.checked)); assert.match($('publishing-checklist-status').textContent, /0 \/ 2/);
  }
}));
test('Downloaded profile has current preferences and reminders but no workspace content or completion', () => controls(async ({ $, load, downloaded }) => {
  await load(); await $('apply-publishing-profile').fire('click'); let input = $('publishing-checklist-items').querySelectorAll('input')[0]; input.checked = true; await input.fire('change');
  $('word-include-title').checked = true; await $('download-publishing-profile').fire('click');
  const [content, filename, mime] = downloaded(); assert.equal(filename, 'weekly-website-publishing-profile.json'); assert.match(mime, /json/); assert.ok(!content.includes('PRIVATE')); assert.ok(!/ticks|reviewed|questions|body|source/.test(content.replace('source notes', '')));
  const value = parsePublishingProfile(content); assert.equal(value.preferences.wordTitle, true); assert.deepEqual(value.checklist, fixture().checklist);
}));
test('Invalid replacement and oversized files purge pending preview while keeping the active profile and writing', () => controls(async ({ $, load, workspace }) => {
  await load(); await $('apply-publishing-profile').fire('click'); const before = JSON.stringify(workspace); $('reviewed').checked = true;
  await load(); await load('{broken'); assert.equal($('publishing-profile-preview').hidden, true); assert.equal($('apply-publishing-profile').disabled, true); assert.equal($('publishing-profile-name').value, 'Weekly website');
  let read = false; $('load-publishing-profile').files = [{ size: MAX_PROFILE_BYTES + 1, text: async () => { read = true; return '{}'; } }]; await $('load-publishing-profile').fire('change'); assert.equal(read, false);
  assert.equal(JSON.stringify(workspace), before); assert.equal($('reviewed').checked, true); assert.equal($('publishing-destination').value, 'html');
}));
test('Reset cancels an in-flight profile read so restore/clear cannot resurrect stale reminders', () => controls(async ({ $, ui }) => {
  let resolve; $('load-publishing-profile').files = [{ size: 100, text: () => new Promise(done => { resolve = done; }) }];
  const pending = $('load-publishing-profile').fire('change'); assert.equal(ui.hasWork(), true); ui.reset(); resolve(createPublishingProfile(fixture())); await pending;
  assert.equal($('publishing-profile-preview').hidden, true); assert.equal($('publishing-profile-name').value, ''); assert.equal($('publishing-profile-checks').value, ''); assert.equal($('publishing-checklist').hidden, true); assert.equal(ui.hasWork(), false);
  await $('apply-publishing-profile').fire('click'); assert.equal($('publishing-destination').value, 'word');
}));
test('Busy workspace blocks profile application and download without discarding the staged file', () => controls(async ({ $, load, busy, downloaded }) => {
  await load(); busy(true); await $('apply-publishing-profile').fire('click'); await $('download-publishing-profile').fire('click'); assert.equal(downloaded(), null); assert.equal($('publishing-destination').value, 'word'); assert.equal($('publishing-profile-preview').hidden, false);
  busy(false); await $('apply-publishing-profile').fire('click'); assert.equal($('publishing-destination').value, 'html');
}));
test('Other-editor profiles reveal their actions and invalid edited reminders cannot silently reuse old ticks', () => controls(async ({ $, load }) => {
  const value = fixture(); value.preferences.destination = 'other'; await load(createPublishingProfile(value)); await $('apply-publishing-profile').fire('click'); assert.equal($('additional-exports').open, true);
  $('publishing-profile-checks').value = 'Duplicate\nDuplicate'; await $('publishing-profile-checks').fire('input'); assert.equal($('publishing-checklist').hidden, true); assert.equal($('download-publishing-profile').disabled, true); assert.match($('publishing-profile-error').textContent, /distinct/);
  $('publishing-profile-checks').value = 'A fresh reminder'; await $('publishing-profile-checks').fire('input'); assert.equal($('publishing-checklist-items').querySelectorAll('input').length, 1); assert.equal($('publishing-checklist-items').querySelectorAll('input')[0].checked, false);
}));

test('Applying or clearing profiles resets image selection and temporary ticks track image choice without adding file keys', () => controls(async ({ $, ui, load, imageResets, downloaded }) => {
  $('wordpress-linked-images').checked = true; await load(); await $('apply-publishing-profile').fire('click'); assert.equal($('wordpress-linked-images').checked, false); assert.equal(imageResets(), 1);
  const tick = $('publishing-checklist-items').querySelectorAll('input')[0]; tick.checked = true; await tick.fire('change');
  $('wordpress-linked-images').checked = true; ui.update(); assert.ok($('publishing-checklist-items').querySelectorAll('input').every(x => !x.checked));
  await $('download-publishing-profile').fire('click'); assert.deepEqual(Object.keys(parsePublishingProfile(downloaded()[0]).preferences), ['destination','formattedTitle','htmlTitle','wordTitle','markdownTitle']);
  await $('clear-publishing-profile').fire('click'); assert.equal($('wordpress-linked-images').checked, false); assert.equal(imageResets(), 2);
}));
