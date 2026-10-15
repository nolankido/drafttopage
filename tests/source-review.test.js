import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { REVIEW_DECISIONS, createSourceReviewNote, parseSourceReviewNote, locateReviewedPassage, planSourceReviewNote } from '../public/source-review.js';
import { installSourceReview } from '../public/source-review-controls.js';
import { createWorkspaceBackup, parseWorkspaceBackup } from '../public/workspace.js';
import { createCheckpointHistory } from '../public/revisions.js';
import { createDraftCollection, parseDraftCollection } from '../public/draft-collection.js';
import { createMarkdown } from '../public/markdown.js';
import { createReadingPage } from '../public/html-export.js';
import { createWordPressArticle } from '../public/wordpress-export.js';

const passage = 'The fictional workshop had 18 participants.';
const fixture = () => ({ passage, source: 'Fictional register, page 2', evidence: '18 attendees, excluding two hosts.', decision: 'Supported by this source' });
const workspace = () => ({ source: { profile: 'update', notes: 'PRIVATE: 18 attendees, excluding two hosts.', audience: 'Readers', purpose: 'Explain' }, draft: { title: 'Fictional workshop', excerpt: 'A test summary.', description: 'Fictional demonstration.', slug: 'fictional-workshop', body: '## Attendance\n\n' + passage, questions: ['An ordinary review question'] } });

test('Canonical reviews retain exact Unicode, newlines, quotes, and literal markup within ordinary notes', () => {
  const value = { ...fixture(), passage: 'Line one\r\n"日本語" <script>x</script> 😀', source: '  Register  ', evidence: ' Evidence\nwith a second line. ' };
  const note = createSourceReviewNote(value);
  assert.deepEqual(parseSourceReviewNote(note), { ...value, source: 'Register', evidence: 'Evidence\nwith a second line.' });
  assert.equal(note.split('\n').length, 5); assert.ok(note.length <= 500);
  assert.equal(parseSourceReviewNote('An ordinary question'), null);
  for (const changed of [note + '\n', note.replace('Passage review', 'Other'), note.replace('Source: ', 'URL: '), note.replace('Decision: Supported by this source', 'Decision: Certified'), note.replace('Passage: "', 'Passage: null "')]) assert.equal(parseSourceReviewNote(changed), null);
});
test('Decisions require evidence for resolved judgments and a source for support', () => {
  assert.equal(REVIEW_DECISIONS.length, 4);
  assert.ok(createSourceReviewNote({ ...fixture(), source: '', evidence: '', decision: 'Needs checking' }));
  for (const decision of REVIEW_DECISIONS.slice(1)) assert.throws(() => createSourceReviewNote({ ...fixture(), decision, evidence: ' ' }), /evidence|Explain/i);
  assert.throws(() => createSourceReviewNote({ ...fixture(), source: '' }), /reference/);
  assert.ok(createSourceReviewNote({ ...fixture(), decision: 'Needs revision', source: '' }));
});
test('Field, total, key, enum, and null-character limits reject without truncation', () => {
  for (const value of [null, [], {}, { ...fixture(), approval: true }, { ...fixture(), decision: '__proto__' }, { ...fixture(), passage: ' ' }, { ...fixture(), passage: 'x'.repeat(241) }, { ...fixture(), source: 'x'.repeat(161) }, { ...fixture(), evidence: 'x'.repeat(241) }]) assert.throws(() => createSourceReviewNote(value));
  for (const key of ['passage','source','evidence']) for (const value of ['x\0y', null, [], 4]) assert.throws(() => createSourceReviewNote({ ...fixture(), [key]: value }));
  const oversized = { ...fixture(), passage: 'x'.repeat(240), source: 's'.repeat(160), evidence: 'e'.repeat(240) };
  const before = JSON.stringify(oversized); assert.throws(() => createSourceReviewNote(oversized), /500.*Shorten/); assert.equal(JSON.stringify(oversized), before);
  assert.throws(() => createSourceReviewNote({ ...fixture(), passage: '\\'.repeat(240) }), /500/);
});
test('Passage location uses exact UTF-16 offsets and refuses ambiguous, overlapping, missing, and oversized input', () => {
  assert.deepEqual(locateReviewedPassage('😀\r\n' + passage, passage), { state: 'unique', start: 4, end: 4 + passage.length, line: 2 });
  assert.deepEqual(locateReviewedPassage(passage + passage, passage), { state: 'multiple' });
  assert.deepEqual(locateReviewedPassage('aaa', 'aa'), { state: 'multiple' });
  assert.deepEqual(locateReviewedPassage('Different', passage), { state: 'missing' });
  assert.deepEqual(locateReviewedPassage(' '.repeat(60001), ' '), { state: 'missing' });
  assert.deepEqual(locateReviewedPassage(passage.toUpperCase(), passage), { state: 'missing' });
});
test('Note planning preserves ordinary notes, checks identity, and rejects full, malformed, and duplicate lists atomically', () => {
  const note = createSourceReviewNote(fixture()), list = ['Ordinary question'];
  assert.deepEqual(planSourceReviewNote(list, note), [...list, note]); assert.deepEqual(list, ['Ordinary question']);
  assert.throws(() => planSourceReviewNote(Array(12).fill('q'), note), /12/);
  assert.throws(() => planSourceReviewNote([note], note), /already/);
  for (const questions of [[true], ['x'.repeat(501)], ['x\0'], Array(13).fill('q'), null]) assert.throws(() => planSourceReviewNote(questions, note));
  for (const editing of [{ index: -1, original: note }, { index: 0.5, original: note }, { index: 1, original: note }, { index: 0, original: 'Old value' }]) assert.throws(() => planSourceReviewNote([note], note, editing), /changed|removed/);
  assert.deepEqual(planSourceReviewNote([note], note, { index: 0, original: note }), [note]);
});
test('Existing v1 backup, checkpoint, and collection formats keep reviews, while article exports exclude them', () => {
  const value = workspace(), note = createSourceReviewNote(fixture()); value.draft.questions.push(note);
  const restored = parseWorkspaceBackup(createWorkspaceBackup(value.source, value.draft));
  assert.equal(restored.version, 1); assert.deepEqual(restored.draft.questions, value.draft.questions);
  const history = createCheckpointHistory(); const { id } = history.save(value); assert.equal(history.read(id).draft.questions[1], note);
  const collection = parseDraftCollection(createDraftCollection({ format: 'drafttopage-collection', version: 1, entries: [{ name: 'Article', workspace: restored }] }));
  assert.equal(collection.entries[0].workspace.draft.questions[1], note);
  for (const content of [createMarkdown(value.draft), createReadingPage(value.draft), createWordPressArticle(value.draft).html]) {
    assert.ok(content.includes('participants')); for (const secret of ['Fictional register', 'excluding two hosts', 'Passage review', 'ordinary review question']) assert.ok(!content.includes(secret));
  }
});

class Control {
  constructor(tag = '') { this.tag = tag; this.value = ''; this.checked = false; this.open = false; this.disabled = false; this.children = []; this.dataset = {}; this.events = new Map(); this.selectionStart = 0; this.selectionEnd = 0; this.focused = false; }
  addEventListener(event, callback) { if (!this.events.has(event)) this.events.set(event, []); this.events.get(event).push(callback); }
  fire(event, value = {}) { for (const fn of this.events.get(event) || []) fn(value); }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; }
  querySelectorAll(tag) { return this.children.flatMap(node => [...(node.tag === tag ? [node] : []), ...node.querySelectorAll(tag)]); }
  focus() { this.focused = true; }
  setSelectionRange(start, end) { this.selectionStart = start; this.selectionEnd = end; }
}
function controls(run) {
  const prior = globalThis.document, fields = new Map(), $ = id => { if (!fields.has(id)) fields.set(id, new Control()); return fields.get(id); };
  globalThis.document = { getElementById: $, createElement: tag => new Control(tag) };
  $('review-decision').value = 'Needs checking';
  let current = workspace(), busy = false, approval = true, applyCount = 0, checkpointFailure = false, confirmation = true, lastReport = '', reveals = 0;
  const history = createCheckpointHistory(); $('body').value = current.draft.body;
  const ui = installSourceReview({ getWorkspace: () => current, isBusy: () => busy, workChanged: () => {}, report: message => { lastReport = message; }, confirmAction: () => confirmation, reveal: () => { reveals++; }, applyNotes: (notes, label) => { if (checkpointFailure) throw new Error('Invalid current writing prevents checkpoint.'); history.save(current, label); current.draft.questions = notes; approval = false; applyCount++; ui.refresh(); } });
  const prepare = (value = fixture()) => {
    for (const [key, id] of Object.entries({ passage: 'review-passage', source: 'review-source-reference', evidence: 'review-evidence', decision: 'review-decision' })) { $(id).value = value[key]; $(id).fire(key === 'decision' ? 'change' : 'input'); }
  };
  try { run({ $, ui, current, history, prepare, busy: value => { busy = value; ui.refresh(); }, failCheckpoint: () => { checkpointFailure = true; }, confirm: value => { confirmation = value; }, approval: () => approval, approve: () => { approval = true; }, applies: () => applyCount, report: () => lastReport, reveals: () => reveals }); }
  finally { globalThis.document = prior; }
}
test('Preparing and discarding preserve writing and approval; save checkpoints before mutation and clears approval', () => controls(({ $, ui, current, history, prepare, approval, applies }) => {
  const before = JSON.stringify(current); prepare(); assert.equal(ui.hasWork(), true); assert.equal($('save-source-review').disabled, false); assert.equal(approval(), true); assert.equal(JSON.stringify(current), before);
  $('cancel-source-review').fire('click'); assert.equal(ui.hasWork(), false); assert.equal(approval(), true); assert.equal(JSON.stringify(current), before);
  prepare(); $('save-source-review').fire('click'); assert.equal(applies(), 1); assert.equal(approval(), false); assert.equal(ui.hasWork(), false); assert.equal(current.draft.questions.length, 2); assert.equal(parseSourceReviewNote(current.draft.questions[1]).passage, passage);
  assert.deepEqual(history.read(history.list()[0].id).draft.questions, ['An ordinary review question']);
}));
test('Pending article and source edits block saving until an explicit current-writing recheck', () => controls(({ $, ui, current, prepare, applies }) => {
  prepare(); current.source.notes += ' Corrected source.'; ui.refresh(); assert.equal($('save-source-review').disabled, true); assert.equal($('refresh-source-review').disabled, false); $('save-source-review').fire('click'); assert.equal(applies(), 0);
  $('refresh-source-review').fire('click'); assert.equal($('save-source-review').disabled, false);
  current.draft.body += '\nAnother sentence.'; ui.refresh(); $('save-source-review').fire('click'); assert.equal(applies(), 0);
  $('refresh-source-review').fire('click'); $('save-source-review').fire('click'); assert.equal(applies(), 1);
}));
test('Missing and repeated saved passages disclose their state and never select a guessed location', () => controls(({ $, ui, current, prepare, reveals }) => {
  prepare(); $('save-source-review').fire('click');
  let buttons = $('source-review-records').querySelectorAll('button'); buttons[0].fire('click'); assert.equal(reveals(), 1); assert.equal($('body').selectionStart, current.draft.body.indexOf(passage));
  current.draft.body += passage; ui.refresh(); buttons = $('source-review-records').querySelectorAll('button'); assert.equal(buttons[0].disabled, true); buttons[0].fire('click'); assert.equal(reveals(), 1);
  current.draft.body = 'Rewritten completely.'; ui.refresh(); buttons = $('source-review-records').querySelectorAll('button'); assert.equal(buttons[0].disabled, true); buttons[0].fire('click'); assert.equal(reveals(), 1);
}));
test('Editing saves in place and keeps other notes; a no-op keeps approval and avoids a new checkpoint', () => controls(({ $, current, prepare, applies, approve, approval }) => {
  prepare(); $('save-source-review').fire('click'); approve(); $('source-review-records').querySelectorAll('button')[1].fire('click');
  assert.equal($('save-source-review').textContent, 'Update private review note'); $('save-source-review').fire('click'); assert.equal(applies(), 1); assert.equal(approval(), true);
  $('review-evidence').value = 'Source counts 18 guests.'; $('review-evidence').fire('input'); $('save-source-review').fire('click');
  assert.equal(applies(), 2); assert.equal(current.draft.questions.length, 2); assert.equal(current.draft.questions[0], 'An ordinary review question'); assert.equal(parseSourceReviewNote(current.draft.questions[1]).evidence, 'Source counts 18 guests.');
}));
test('External edits or removal invalidate the pending record identity before mutation', () => controls(({ $, ui, current, prepare, applies, report }) => {
  prepare(); $('save-source-review').fire('click'); $('source-review-records').querySelectorAll('button')[1].fire('click'); current.draft.questions.shift(); ui.refresh();
  $('save-source-review').fire('click'); assert.equal(applies(), 1); assert.match(report(), /changed|removed/); assert.equal(current.draft.questions.length, 1);
}));
test('Checkpoint failure, busy actions, and full note lists preserve all pending work and saved writing', () => controls(({ $, ui, current, prepare, applies, approval, busy, failCheckpoint, report }) => {
  prepare(); const pending = $('review-evidence').value; busy(true);
  for (const id of ['save-source-review','cancel-source-review','refresh-source-review','pin-review-passage','pin-review-evidence']) $(id).fire('click');
  assert.equal(applies(), 0); assert.equal($('review-evidence').value, pending); assert.equal(approval(), true);
  busy(false); current.draft.questions = Array(12).fill('Question'); ui.refresh(); $('save-source-review').fire('click'); assert.equal(applies(), 0); assert.match(report(), /12/);
  current.draft.questions = ['Original']; failCheckpoint(); $('save-source-review').fire('click'); assert.equal(applies(), 0); assert.deepEqual(current.draft.questions, ['Original']); assert.equal(ui.hasWork(), true); assert.equal(approval(), true); assert.match(report(), /checkpoint/);
}));
test('Pinning is exact, rejects oversized selections in full, and confirms replacement of pending work', () => controls(({ $, current, prepare, confirm, approval }) => {
  $('body').setSelectionRange(current.draft.body.indexOf(passage), current.draft.body.length); $('pin-review-passage').fire('click'); assert.equal($('review-passage').value, passage); assert.equal($('source-review-panel').open, true);
  prepare(); confirm(false); $('pin-review-passage').fire('click'); assert.equal($('review-evidence').value, fixture().evidence);
  confirm(true); $('body').value = 'x'.repeat(241); $('body').setSelectionRange(0, 241); $('pin-review-passage').fire('click'); assert.equal($('review-passage').value, passage); assert.equal($('review-evidence').value, fixture().evidence); assert.equal(approval(), true);
}));
test('Source excerpts stay literal, oversized pastes are rejected, and closing clears the comparison mirror', () => controls(({ $, ui, current, prepare }) => {
  $('source-review-panel').open = true; $('source-review-panel').fire('toggle'); assert.equal($('review-source-notes').value, current.source.notes);
  $('review-source-notes').setSelectionRange(9, 21); $('pin-review-evidence').fire('click'); assert.equal($('review-evidence').value, current.source.notes.slice(9, 21));
  prepare(); let rejected = false; $('review-evidence').fire('paste', { clipboardData: { getData: () => 'x'.repeat(241) }, preventDefault: () => { rejected = true; } }); assert.equal(rejected, true); assert.equal($('review-evidence').value, fixture().evidence);
  $('source-review-panel').open = false; $('source-review-panel').fire('toggle'); assert.equal($('review-source-notes').value, ''); assert.equal(ui.hasWork(), true);
  current.draft.questions = []; current.source.notes = ''; ui.clear(); assert.equal(ui.hasWork(), false); assert.equal($('source-review-records').children.length, 0); assert.equal($('review-passage').value, ''); assert.equal($('review-evidence').value, '');
}));
test('All four generated workspaces include the accessible review and safe optional-load fallback', async () => {
  for (const route of ['write','markdown-to-wordpress','markdown-to-html','markdown-to-word']) {
    const html = await readFile('public/' + route + '/index.html', 'utf8');
    for (const id of ['source-review-panel','review-passage','review-source-notes','review-source-reference','review-evidence','review-decision','source-review-status','source-review-records']) assert.match(html, new RegExp('id="' + id + '"'));
    assert.match(html, /for="review-source-reference"/); assert.match(html, /id="source-review-status"[^>]*role="status"/);
  }
  const desk = await readFile('public/desk.js', 'utf8');
  assert.match(desk, /loadEditingTool\(\(\) => import\('\.\/source-review-controls\.js'\)/);
  assert.match(desk, /revisions.captureBefore\(label\); questions = \[\.\.\.notes\]/);
  assert.match(desk, /Passage review could not load/);
});
