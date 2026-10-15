import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { installRecovery } from '../public/recovery.js';
import { createWorkspaceBackup, parseWorkspaceBackup, MAX_BACKUP_BYTES } from '../public/workspace.js';
import { appPage } from '../src/pages.js';

const current = { source: { profile: 'personal', notes: 'Fictional current notes.', audience: 'Writers', purpose: 'Keep a draft' }, draft: { title: 'Current fictional article', body: 'Current article stays here.', excerpt: '', description: '', slug: 'current', questions: ['Current review question'] } };
const incoming = { source: { profile: 'guide', notes: 'Fictional PREVIEW_ONLY notes 日本語.', audience: 'Fictional readers', purpose: 'A saved example' }, draft: { title: 'Saved fictional article', body: 'Saved PREVIEW_ONLY article.\n\n<script>Literal text</script>', excerpt: 'Saved excerpt', description: 'Saved description', slug: 'saved', questions: ['Saved PREVIEW_ONLY question'] } };
const serialized = value => createWorkspaceBackup(value.source, value.draft);
const buffer = text => new TextEncoder().encode(text).buffer;
class Control {
  constructor() { this.value = ''; this.checked = false; this.disabled = false; this.hidden = false; this.open = false; this.textContent = ''; this.childNodes = []; this.events = new Map(); this.attributes = {}; }
  addEventListener(type, action) { this.events.set(type, action); }
  fire(type = 'click') { return this.events.get(type)?.(); }
  append(...nodes) { this.childNodes.push(...nodes); }
  replaceChildren(...nodes) { this.childNodes = nodes; }
  focus() { this.focused = true; }
}
async function withUI(run) {
  const previous = { document: globalThis.document, confirm: globalThis.confirm }, nodes = new Map(), $ = id => { if (!nodes.has(id)) nodes.set(id, new Control()); return nodes.get(id); };
  let value = structuredClone(current), busy = false, decision = () => true, checkpointFailure = false, approved = true, confirms = 0, reads = 0, workChanges = 0;
  const applied = [], downloads = [], messages = [], transitions = [];
  globalThis.document = { getElementById: $, createElement: () => new Control() };
  globalThis.confirm = () => { confirms++; return decision(); };
  const ui = installRecovery({ capture: () => structuredClone(value), hasWork: () => Boolean(value.source.notes || value.draft?.body), isBusy: () => busy,
    report: message => messages.push(message), workChanged: () => { workChanges++; }, busyChanged: () => transitions.push(ui.reading()), download: (...args) => downloads.push(args),
    restore: target => { if (checkpointFailure) throw new Error('Checkpoint refused'); applied.push(structuredClone(target)); value = { source: target.source, draft: target.draft }; approved = false; ui.clear(); }
  });
  const file = (text = serialized(incoming), name = 'fictional-backup.json') => ({ name, size: buffer(text).byteLength, arrayBuffer: async () => { reads++; return buffer(text); } });
  const choose = async selected => { $('restore-backup').files = selected ? [selected] : []; await $('restore-backup').fire('change'); };
  try { await run({ $, ui, choose, file, applied, downloads, messages, transitions, state: () => ({ value, busy, approved, confirms, reads, workChanges }), edit: text => { value.draft.body = text; }, busy: flag => { busy = flag; ui.update(); }, decision: fn => { decision = fn; }, fail: flag => { checkpointFailure = flag; } }); }
  finally { Object.assign(globalThis, previous); }
}
test('Selecting a validated backup stages a focused summary without restoring or revealing private inspection text', () => withUI(async ({ $, ui, choose, file, applied, state, transitions }) => {
  await choose(file());
  assert.equal(applied.length, 0); assert.deepEqual(state().value, current); assert.equal(state().confirms, 0); assert.equal(state().approved, true);
  assert.equal(ui.pending(), true); assert.equal(ui.reading(), false); assert.deepEqual(transitions, [true, false]);
  assert.equal($('restore-preview').hidden, false); assert.equal($('restore-preview-heading').focused, true);
  assert.match($('restore-preview-summary').textContent, /fictional-backup.json.*Saved fictional article/);
  assert.equal($('restore-preview-contents').open, false); assert.equal($('restore-preview-body').value, ''); assert.equal($('restore-preview-notes').value, '');
  assert.equal($('apply-restore-backup').disabled, false); assert.equal($('backup-controls').disabled, false);
}));
test('Opening inspection shows inert saved fields and closing or cancelling purges every displayed private value', () => withUI(async ({ $, ui, choose, file, state, messages }) => {
  await choose(file()); $('restore-preview-contents').open = true; $('restore-preview-contents').fire('toggle');
  assert.equal($('restore-preview-body').value, incoming.draft.body); assert.equal($('restore-preview-notes').value, incoming.source.notes);
  assert.deepEqual($('restore-preview-questions').childNodes.map(node => node.textContent), incoming.draft.questions);
  assert.ok($('restore-preview-details').childNodes.some(node => node.textContent === incoming.draft.excerpt));
  $('restore-preview-contents').open = false; $('restore-preview-contents').fire('toggle');
  assert.equal($('restore-preview-body').value, ''); assert.equal($('restore-preview-notes').value, ''); assert.equal($('restore-preview-questions').childNodes.length, 0); assert.equal($('restore-preview-details').childNodes.length, 0);
  $('cancel-restore-backup').fire(); assert.equal(ui.pending(), false); assert.equal($('restore-preview').hidden, true); assert.equal($('apply-restore-backup').disabled, true);
  assert.equal($('restore-preview-summary').textContent, ''); assert.equal($('restore-backup').focused, true); assert.deepEqual(state().value, current);
  assert.match(messages.at(-1), /cancelled.*unchanged/); assert.equal($('backup-status').textContent, messages.at(-1));
}));
test('Restoration is a separate confirmed action; cancellation retains the preview and success clears approval and preview', () => withUI(async ({ $, choose, file, decision, state, applied, ui }) => {
  await choose(file()); decision(() => false); $('apply-restore-backup').fire();
  assert.equal(state().confirms, 1); assert.equal(applied.length, 0); assert.deepEqual(state().value, current); assert.equal(ui.pending(), true);
  decision(() => true); $('backup-private-ok').checked = true; $('apply-restore-backup').fire();
  assert.equal(state().confirms, 2); assert.equal(applied.length, 1); assert.deepEqual(state().value, incoming); assert.equal(state().approved, false);
  assert.equal(ui.pending(), false); assert.equal($('backup-private-ok').checked, false); assert.equal($('save-backup').disabled, true); assert.equal($('restore-preview').hidden, true);
  assert.equal($('restore-preview-body').value, ''); assert.match($('backup-status').textContent, /Workspace restored locally/);
}));
test('Checkpoint refusal preserves current writing and the reviewed file for an explicit retry', () => withUI(async ({ $, choose, file, fail, state, applied, ui }) => {
  await choose(file()); fail(true); $('apply-restore-backup').fire();
  assert.equal(applied.length, 0); assert.deepEqual(state().value, current); assert.equal(state().approved, true); assert.equal(ui.pending(), true);
  assert.match($('backup-status').textContent, /Checkpoint refused/); assert.equal($('apply-restore-backup').disabled, false);
  fail(false); $('apply-restore-backup').fire(); assert.equal(applied.length, 1); assert.deepEqual(state().value, incoming);
}));
test('Invalid, oversized and malformed UTF-8 files cannot retain an earlier actionable preview or replace writing', () => withUI(async ({ $, choose, file, state, applied, ui }) => {
  const invalid = [file('{broken'), file(JSON.stringify({ format: 'drafttopage-workspace', version: 2 })), file(serialized(incoming).replace('"version": 1', '"version": 1, "password": "extra"')),
    { name: 'oversized.json', size: MAX_BACKUP_BYTES + 1, arrayBuffer: () => { throw new Error('Must not read oversized file'); } },
    { name: 'invalid-utf8.json', size: 2, arrayBuffer: async () => new Uint8Array([0xc3, 0x28]).buffer },
    { name: 'wrong-size.json', size: 1, arrayBuffer: async () => new Uint8Array(MAX_BACKUP_BYTES + 1).buffer }];
  for (const selected of invalid) {
    await choose(file()); await choose(selected); assert.equal(ui.pending(), false); assert.equal($('restore-preview').hidden, true); assert.equal($('apply-restore-backup').disabled, true);
    $('apply-restore-backup').fire(); assert.equal(applied.length, 0); assert.deepEqual(state().value, current); assert.equal(state().confirms, 0);
  }
}));
test('Clearing during a pending file read discards its eventual result and releases busy controls', () => withUI(async ({ $, choose, ui, state, edit, applied, transitions }) => {
  let finish;
  const request = choose({ name: 'delayed.json', size: 100, arrayBuffer: () => new Promise(resolve => { finish = resolve; }) });
  assert.equal(ui.reading(), true); assert.equal(ui.pending(), true); assert.equal($('backup-controls').disabled, true);
  ui.clear(); edit('New current writing.'); finish(buffer(serialized(incoming))); await request;
  assert.equal(ui.reading(), false); assert.equal(ui.pending(), false); assert.equal($('restore-preview').hidden, true); assert.equal($('backup-status').textContent, '');
  assert.equal(state().value.draft.body, 'New current writing.'); assert.equal(applied.length, 0); assert.deepEqual(transitions, [true, false]);
}));
test('Busy operations block file reads, downloads, restore and cancellation without losing the preview', () => withUI(async ({ $, ui, choose, file, busy, state, applied, downloads }) => {
  busy(true); await choose(file()); assert.equal(state().reads, 0); busy(false); await choose(file());
  $('backup-private-ok').checked = true; busy(true); $('save-backup').fire(); $('apply-restore-backup').fire(); $('cancel-restore-backup').fire();
  assert.equal(applied.length, 0); assert.equal(downloads.length, 0); assert.equal(ui.pending(), true);
  busy(false); assert.equal($('apply-restore-backup').disabled, false); assert.equal($('save-backup').disabled, false);
}));
test('Downloading during a pending restore saves only current writing, with existing private-data acknowledgement', () => withUI(async ({ $, ui, choose, file, downloads, messages }) => {
  await choose(file()); $('save-backup').fire(); assert.equal(downloads.length, 0);
  $('backup-private-ok').checked = true; $('backup-private-ok').fire('change'); $('save-backup').fire();
  assert.equal(downloads.length, 1); const [content, name] = downloads[0];
  assert.deepEqual(parseWorkspaceBackup(content), { format: 'drafttopage-workspace', version: 1, ...current });
  assert.doesNotMatch(content, /PREVIEW_ONLY/); assert.match(name, /^drafttopage-private-workspace-.*\.json$/); assert.equal(ui.pending(), true);
  assert.match(messages.at(-1), /pending restore preview is excluded/);
}));
test('Notes-only backups explicitly warn that restoring clears article fields', () => withUI(async ({ $, choose, file, state }) => {
  const notesOnly = { source: incoming.source, draft: null }; await choose(file(serialized(notesOnly)));
  assert.match($('restore-preview-summary').textContent, /no article.*clears the current article fields/);
  $('apply-restore-backup').fire(); assert.deepEqual(state().value, notesOnly);
}));
test('Changes during replacement confirmation cannot overwrite newer writing', () => withUI(async ({ $, choose, file, decision, edit, state, applied, ui }) => {
  await choose(file()); decision(() => { edit('Changed during confirmation.'); return true; }); $('apply-restore-backup').fire();
  assert.equal(applied.length, 0); assert.equal(state().value.draft.body, 'Changed during confirmation.'); assert.equal(ui.pending(), true);
  assert.match($('backup-status').textContent, /Nothing was restored/);
}));
test('Cancelling a file picker preserves the staged backup and selecting it again resets private inspection', () => withUI(async ({ $, choose, file, ui }) => {
  const selected = file(); await choose(selected); await choose(null); assert.equal(ui.pending(), true);
  $('restore-preview-contents').open = true; $('restore-preview-contents').fire('toggle'); assert.ok($('restore-preview-body').value);
  await choose(selected); assert.equal($('restore-preview-contents').open, false); assert.equal($('restore-preview-body').value, ''); assert.equal(ui.pending(), true);
}));
test('Public and private workspaces share one hidden, labelled backup preview with optional private inspection', async () => {
  const pages = [...await Promise.all(['write','word-to-wordpress','google-docs-to-wordpress'].map(route => readFile('public/' + route + '/index.html', 'utf8'))), appPage];
  const count = Number(execFileSync('python3', ['-c', String.raw`
import sys,json
from html.parser import HTMLParser
class P(HTMLParser):
 def __init__(self):super().__init__();self.stack=[];self.ids={}
 def handle_starttag(self,t,a):
  a=dict(a)
  if 'id' in a:
   assert a['id'] not in self.ids
   self.ids[a['id']]={'attrs':a,'ancestors':[n[1].get('id') for n in self.stack]}
  if t not in 'area base br col embed hr img input link meta param source track wbr'.split():self.stack.append((t,a))
 def handle_endtag(self,t):assert self.stack[-1][0]==t;self.stack.pop()
pages=json.load(sys.stdin)
for page in pages:
 p=P();p.feed(page);assert not p.stack
 assert 'hidden' in p.ids['restore-preview']['attrs']
 assert p.ids['restore-preview-heading']['attrs']['tabindex']=='-1'
 assert 'open' not in p.ids['restore-preview-contents']['attrs']
 assert p.ids['backup-status']['attrs']['aria-live']=='off'
 for key in ['restore-preview-body','restore-preview-notes']:
  assert 'readonly' in p.ids[key]['attrs'] and 'restore-preview-contents' in p.ids[key]['ancestors']
 assert 'disabled' in p.ids['apply-restore-backup']['attrs']
 assert 'backup-controls' in p.ids['apply-restore-backup']['ancestors']
 assert 'restore-preview-contents' not in p.ids['apply-restore-backup']['ancestors']
print(len(pages))
`], { input: JSON.stringify(pages), encoding: 'utf8' }));
  assert.equal(count, 4);
});
