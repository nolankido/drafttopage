import test from 'node:test';
import assert from 'node:assert/strict';
import { articleSections, moveArticleSection } from '../public/article-sections.js';
import { installDraftReview } from '../public/review-controls.js';
import { createCheckpointHistory } from '../public/revisions.js';

test('Section ranges include descendants and move only beside adjacent same-level siblings', () => {
  const body = 'Intro.\n\n## A\nA text.\n### A1\nOne.\n### A2\nTwo.\n## B\nB text.\n#### B1\nDeep.\n# Last\nEnd.';
  const { sections } = articleSections(body);
  assert.deepEqual(sections.map(s => [s.text, s.parent, s.up, s.down]), [
    ['A', null, null, 3], ['A1', 0, null, 2], ['A2', 0, 1, null], ['B', null, 0, null], ['B1', 3, null, null], ['Last', null, null, null]
  ]);
  assert.equal(body.slice(sections[0].start, sections[0].sectionEnd), '## A\nA text.\n### A1\nOne.\n### A2\nTwo.\n');
  const plan = moveArticleSection(body, sections[3].start, 'up');
  assert.equal(plan.body, 'Intro.\n\n## B\nB text.\n#### B1\nDeep.\n## A\nA text.\n### A1\nOne.\n### A2\nTwo.\n# Last\nEnd.');
  assert.equal(plan.body.slice(plan.selectionStart, plan.selectionEnd), '## B');
  assert.throws(() => moveArticleSection(body, sections[4].start, 'up'), /same level/);
});
test('Moving a subsection keeps the enclosing section and its other writing in place', () => {
  const body = '## Parent\nOpening.\n\n### First\nOne.\n#### Detail\nNested.\n\n### Second\nTwo.\n\n## Other\nEnd.';
  const plan = moveArticleSection(body, body.indexOf('### First'), 'down');
  assert.equal(plan.body, '## Parent\nOpening.\n\n### Second\nTwo.\n\n### First\nOne.\n#### Detail\nNested.\n\n## Other\nEnd.');
  assert.equal(plan.body.slice(plan.selectionStart, plan.selectionEnd), '### First');
  assert.equal(moveArticleSection(plan.body, plan.selectionStart, 'up').body, body);
});
test('Final sections without a newline do not merge headings or change article length', () => {
  for (const tail of ['', '\n', '\n\n', '\r\n']) {
    const body = 'Preamble 😀.\n\n## Café\nFirst.\n\n## 結果\nLast.' + tail;
    const plan = moveArticleSection(body, body.indexOf('## 結果'), 'up');
    assert.equal(plan.body, 'Preamble 😀.\n\n## 結果\nLast.\n\n## Café\nFirst.' + tail);
    assert.equal(plan.body.length, body.length);
    assert.equal(moveArticleSection(plan.body, plan.selectionStart, 'down').body, body);
  }
});
test('CRLF, mixed newline slots, empty headings, and exact selected source remain supported', () => {
  const body = 'Opening.\r\n\r\n## Café\r\nFirst.\r\n\n## \n';
  const plan = moveArticleSection(body, body.indexOf('## \n'), 'up');
  assert.equal(plan.body, 'Opening.\r\n\r\n## \r\n\n## Café\r\nFirst.\n');
  assert.equal(plan.body.slice(plan.selectionStart, plan.selectionEnd), '## \r');
  assert.equal(moveArticleSection(plan.body, plan.selectionStart, 'down').body, body);
});
test('Code headings stay within their section and unfinished fences block all moves', () => {
  const body = '## A\n``` md\n## Fake\n~~~\n```\n\n## B\nEnd.';
  assert.deepEqual(articleSections(body).sections.map(s => s.text), ['A', 'B']);
  const plan = moveArticleSection(body, 0, 'down');
  assert.equal(plan.body, '## B\nEnd.\n\n## A\n``` md\n## Fake\n~~~\n```');
  assert.equal(articleSections(plan.body).sections.length, 2);
  const broken = '## A\nA.\n## B\n~~~\nUnfinished.';
  assert.equal(articleSections(broken).movable, false);
  assert.throws(() => moveArticleSection(broken, 0, 'down'), /unfinished code fence/);
});
test('Stale positions, invalid directions, and oversized inputs reject before producing writing', () => {
  const body = '## A\nOne.\n## B\nTwo.';
  for (const [start, direction] of [[-1, 'up'], [2, 'down'], [0.5, 'down'], [0, 'sideways']]) assert.throws(() => moveArticleSection(body, start, direction));
  assert.throws(() => moveArticleSection('a'.repeat(60001), 0, 'down'));
  assert.throws(() => articleSections(null));
  assert.equal(articleSections('No headings.').sections.length, 0);
  const maximum = '## A\n' + 'x'.repeat(59985) + '\n## B\nEnd.';
  assert.equal(maximum.length, 60000);
  assert.equal(moveArticleSection(maximum, 0, 'down').body.length, 60000);
});
test('Every eligible move reverses without losing arbitrary bounded section writing', () => {
  for (let count = 2; count <= 12; count++) {
    const body = 'Intro.\r\n\r\n' + Array.from({ length: count }, (_, i) => '## Section ' + i + '\nLiteral <img> 😀 ' + 'word '.repeat(i) + '\n### Detail\n`code`').join('\n\n') + (count % 2 ? '\n' : '');
    for (const section of articleSections(body).sections) for (const direction of ['up', 'down']) {
      if (section[direction] === null) continue;
      const moved = moveArticleSection(body, section.start, direction);
      assert.equal(moved.body.length, body.length);
      assert.equal(articleSections(moved.body).sections.length, count * 2);
      assert.equal(moveArticleSection(moved.body, moved.selectionStart, direction === 'up' ? 'down' : 'up').body, body);
    }
  }
});

// Event contract checks, without claiming actual browser rendering.
function withReview(run) {
  class Control {
    constructor(tag = '') { this.tag = tag; this.listeners = {}; this.children = []; this.dataset = {}; this.attributes = {}; this.value = ''; }
    addEventListener(name, callback) { (this.listeners[name] ||= []).push(callback); }
    append(...children) { for (const child of children) { child.parent = this; this.children.push(child); } }
    replaceChildren(...children) { this.children = []; this.append(...children); }
    setAttribute(name, value) { this.attributes[name] = value; }
    focus() { this.focused = true; }
    setSelectionRange(start, end) { this.selectionStart = start; this.selectionEnd = end; }
    scrollIntoView() {}
    closest(tag) { return this.tag === tag ? this : this.parent?.closest(tag); }
    querySelectorAll(selector) {
      const all = this.children.flatMap(c => [c, ...c.querySelectorAll(selector)]);
      if (selector === '.review-jump') return all.filter(c => c.className?.includes('review-jump'));
      const direction = /data-section-move="(\w+)"/.exec(selector)?.[1], start = /data-heading-start="(\d+)"/.exec(selector)?.[1];
      return all.filter(c => c.dataset.sectionMove && (!direction || c.dataset.sectionMove === direction) && (!start || c.dataset.headingStart === start));
    }
    querySelector(selector) { return this.querySelectorAll(selector)[0]; }
    fire(name = 'click') { for (const callback of this.listeners[name] || []) callback(); }
    click() { this.fire(); }
  }
  const original = globalThis.document, elements = new Map();
  const $ = id => { if (!elements.has(id)) elements.set(id, new Control()); return elements.get(id); };
  globalThis.document = { getElementById: $, createElement: tag => new Control(tag) };
  let busy = false, failed = false, approved = true, message = '', revealed = 0;
  const history = createCheckpointHistory(), source = { profile: 'personal', notes: 'Private fictional source.', audience: '', purpose: '' };
  const draft = () => ({ title: '', excerpt: '', description: '', slug: '', body: $('body').value, questions: ['Private question?'] });
  $('body').value = '## First\nTODO\n\n## Second\nDone.'; $('draft-check-panel').open = true;
  try {
    const ui = installDraftReview({ getDraft: draft, isBusy: () => busy, report: text => { message = text; }, reveal: () => { revealed++; }, applySectionMove: (plan, label) => {
      if (failed) throw new Error('Checkpoint unavailable.');
      history.save({ source, draft: draft() }, label); $('body').value = plan.body; approved = false; ui.refresh();
    } });
    ui.refresh();
    run({ $, ui, history, approved: () => approved, message: () => message, revealed: () => revealed, setBusy: value => { busy = value; ui.refresh(); }, setFailure: value => { failed = value; } });
  } finally { globalThis.document = original; }
}
test('Outline move checkpoints private writing, clears approval/findings, and restores keyboard focus', () => withReview(({ $, ui, history, approved }) => {
  $('run-checks').fire(); assert.equal($('draft-findings').children.length, 1);
  const before = $('body').value;
  $('article-outline').querySelector('[data-section-move="down"][data-heading-start="0"]').fire();
  assert.equal($('body').value, '## Second\nDone.\n\n## First\nTODO');
  assert.equal(approved(), false); assert.equal($('draft-findings').children.length, 0); assert.equal($('copy-checks').disabled, true);
  const checkpoint = history.read(history.list()[0].id);
  assert.equal(checkpoint.draft.body, before); assert.equal(checkpoint.source.notes, 'Private fictional source.'); assert.deepEqual(checkpoint.draft.questions, ['Private question?']);
  assert.equal($('article-outline').children[1].querySelector('.review-jump').focused, true);
  ui.refresh();
}));
test('Busy reads, failed checkpoints and stale button events leave current writing and approval alone', () => withReview(({ $, history, approved, setBusy, setFailure, message }) => {
  const button = $('article-outline').querySelector('[data-section-move="down"][data-heading-start="0"]'), before = $('body').value;
  setBusy(true); assert.equal(button.disabled, true); button.fire(); assert.equal(history.list().length, 0);
  setBusy(false); setFailure(true); button.fire(); assert.match(message(), /Checkpoint unavailable/); assert.equal($('body').value, before); assert.equal(approved(), true);
  setFailure(false); $('body').value += ' Changed.'; button.fire(); assert.match(message(), /article changed/); assert.equal(history.list().length, 0); assert.equal(approved(), true);
}));
test('Outline navigation reveals exact text without mutation and clear purges a closed outline', () => withReview(({ $, ui, history, approved, revealed }) => {
  const jump = $('article-outline').children[1].querySelector('.review-jump'); jump.fire();
  assert.equal($('body').value.slice($('body').selectionStart, $('body').selectionEnd), '## Second');
  assert.equal(revealed(), 1); assert.equal(history.list().length, 0); assert.equal(approved(), true);
  $('draft-check-panel').open = false; $('body').value = ''; ui.refresh();
  assert.equal($('article-outline').children.length, 0);
}));
test('Moves outside the visible forty headings and unfinished fences stay disabled', () => withReview(({ $, ui }) => {
  $('body').value = Array.from({ length: 41 }, (_, i) => '## Section ' + i + '\nText.').join('\n'); ui.refresh();
  assert.equal($('article-outline').children.length, 40);
  assert.equal($('article-outline').children[39].querySelector('[data-section-move="down"]').disabled, true);
  $('body').value = '## One\nText.\n## Two\n~~~\nOpen'; ui.refresh();
  assert.ok($('article-outline').querySelectorAll('[data-section-move]').every(control => control.disabled));
}));
