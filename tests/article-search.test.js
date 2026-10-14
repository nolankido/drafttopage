import test from 'node:test';
import assert from 'node:assert/strict';
import { findArticleMatches, navigateArticleMatch, replaceArticleMatch, previewArticleReplacements } from '../public/article-search.js';
import { installArticleSearch } from '../public/search-controls.js';
import { createCheckpointHistory } from '../public/revisions.js';

test('Find treats all pattern punctuation literally and returns exact Unicode textarea offsets', () => {
  for (const query of ['[a]', 'a.b', '$&', '\\', '(foo)', '*+?^${}|[]']) {
    const body = '😀 prefix ' + query + ' suffix';
    const matches = findArticleMatches(body, query);
    assert.deepEqual(matches, [{ start: 10, end: 10 + query.length, text: query }]);
    assert.equal(body.slice(matches[0].start, matches[0].end), query);
  }
  assert.deepEqual(findArticleMatches('😀 X 😀', '😀').map(match => [match.start, match.end]), [[0, 2], [5, 7]]);
});
test('Case matching keeps original text and positions, with deliberate exact-case support', () => {
  const body = 'Foo foo FOO café CAFÉ';
  assert.deepEqual(findArticleMatches(body, 'foo').map(match => match.text), ['Foo', 'foo', 'FOO']);
  assert.deepEqual(findArticleMatches(body, 'foo', { matchCase: true }).map(match => match.start), [4]);
  assert.deepEqual(findArticleMatches(body, 'café').map(match => match.text), ['café', 'CAFÉ']);
  assert.equal(findArticleMatches('İx ix', 'ix')[0].start, 3); // No lowercasing that expands source offsets.
});
test('Substring matches never overlap and empty queries cannot perform replacement', () => {
  assert.deepEqual(findArticleMatches('aaaa', 'aa').map(match => [match.start, match.end]), [[0, 2], [2, 4]]);
  assert.deepEqual(findArticleMatches('article', ''), []);
  assert.equal(previewArticleReplacements('article', '', 'other').body, 'article');
  assert.throws(() => replaceArticleMatch('article', '', 'other', 0));
});
test('Next and previous use the actual selection and wrap at both ends', () => {
  const matches = findArticleMatches('foo x foo y foo', 'foo');
  assert.equal(navigateArticleMatch(matches, 0, 0), 0);
  assert.equal(navigateArticleMatch(matches, 0, 3), 1);
  assert.equal(navigateArticleMatch(matches, 12, 15), 0);
  assert.equal(navigateArticleMatch(matches, 0, 3, -1), 2);
  assert.equal(navigateArticleMatch(matches, 8, 8, -1), 0);
  assert.equal(navigateArticleMatch([], 0, 0), -1);
});
test('Single replacement changes only the selected occurrence and never expands dollar substitutions', () => {
  assert.deepEqual(replaceArticleMatch('foo and foo', 'foo', '$&\n$1', 1), { body: 'foo and $&\n$1', selectionStart: 8, selectionEnd: 13, changedCount: 1 });
  assert.equal(replaceArticleMatch('foo and foo', 'foo', '', 0).body, ' and foo');
  assert.equal(replaceArticleMatch('foo', 'foo', 'foo', 0).changedCount, 0);
  assert.throws(() => replaceArticleMatch('foo', 'foo', 'x', -1));
  assert.throws(() => replaceArticleMatch('foo', 'foo', 'x', 1));
});
test('Bulk preview counts actual changes and caps inert examples without limiting the applied article', () => {
  const plan = previewArticleReplacements('foo FOO Foo', 'foo', 'foo');
  assert.equal(plan.matchCount, 3); assert.equal(plan.changedCount, 2); assert.equal(plan.body, 'foo foo foo');
  const many = previewArticleReplacements(Array(100).fill('old').join('\n'), 'old', '<script>fictional()</script>');
  assert.equal(many.changedCount, 100); assert.equal(many.examples.length, 5);
  assert.equal(many.body.split('\n').length, 100); assert.ok(many.examples[0].after.includes('<script>'));
});
test('Bounds and malformed input reject mutations before returning a replacement article', () => {
  for (const [body, query, replacement] of [['x'.repeat(12001), 'x', 'y'], ['body', 'x'.repeat(201), 'y'], ['body', 'body', 'y'.repeat(501)], ['bad\u0000body', 'body', 'y'], ['body', '\u0000', 'y'], ['body', 'body', '\u0000']]) assert.throws(() => previewArticleReplacements(body, query, replacement));
  assert.throws(() => findArticleMatches('body', 'body', { matchCase: 'yes' }));
  assert.throws(() => previewArticleReplacements('x'.repeat(12000), 'x', 'xx'), /exceed 12,000/);
  assert.equal(previewArticleReplacements('x'.repeat(12000), 'x', '').changedCount, 12000);
  assert.equal(previewArticleReplacements('x'.repeat(12000), 'x', '').body, '');
  assert.equal(previewArticleReplacements('x'.repeat(11999), 'x', 'x').body.length, 11999);
});
test('Exact-case bulk output matches an independent split/join reference across bounded literal scenarios', () => {
  const words = ['a', 'Aa', '[]', '$&', '😀', '\\', 'a.b', '(x)'];
  for (let index = 0; index < 100; index++) {
    const body = Array.from({ length: 15 }, (_, offset) => words[(index + offset * 3) % words.length]).join(' / ');
    const query = words[index % words.length], replacement = words[(index + 2) % words.length];
    assert.equal(previewArticleReplacements(body, query, replacement, { matchCase: true }).body, body.split(query).join(replacement));
  }
});

// Controller contract tests, with event-bearing controls. These do not assert browser rendering.
function fakeControls() {
  class Control {
    constructor() { this.value = ''; this.checked = false; this.listeners = {}; this.children = []; this.selectionStart = 0; this.selectionEnd = 0; }
    addEventListener(name, callback) { (this.listeners[name] ||= []).push(callback); }
    replaceChildren(...children) { this.children = children; }
    append(...children) { this.children.push(...children); }
    focus() { this.focused = true; }
    setSelectionRange(start, end) { this.selectionStart = start; this.selectionEnd = end; }
    fire(name = 'click', event = {}) { for (const callback of this.listeners[name] || []) callback(event); }
  }
  const elements = new Map();
  const document = { getElementById: id => { if (!elements.has(id)) elements.set(id, new Control()); return elements.get(id); }, createElement: () => new Control() };
  return { document, get: document.getElementById };
}
function withEditor(run) {
  const original = { document: globalThis.document, confirm: globalThis.confirm, getComputedStyle: globalThis.getComputedStyle };
  const fake = fakeControls(), $ = fake.get; let approved = true, busy = false, accepted = false, failure = false, message = '';
  const history = createCheckpointHistory();
  globalThis.document = fake.document; globalThis.confirm = () => accepted; globalThis.getComputedStyle = () => ({ lineHeight: '24px' });
  $('body').value = 'foo and FOO and foo';
  const source = { profile: 'personal', notes: 'Private fictional source.', audience: '', purpose: '' };
  const draft = () => ({ title: 'Fictional search', excerpt: '', description: '', slug: '', body: $('body').value, questions: ['Private fictional question?'] });
  try {
    const ui = installArticleSearch({ isBusy: () => busy, report: text => { message = text; }, apply: (plan, label) => {
      if (failure) throw new Error('Checkpoint unavailable. Current writing is unchanged.');
      history.save({ source, draft: draft() }, label);
      $('body').value = plan.body; $('body').setSelectionRange(plan.selectionStart, plan.selectionEnd); approved = false;
    } });
    run({ $, ui, history, approved: () => approved, message: () => message, setAccepted: value => { accepted = value; }, setBusy: value => { busy = value; }, setFailure: value => { failure = value; } });
  } finally { Object.assign(globalThis, original); }
}
test('Controller finds and navigates without clearing approval, then checkpoints a single replacement', () => withEditor(({ $, ui, history, approved }) => {
  $('start-find').fire(); assert.equal($('find-panel').open, true); assert.ok($('find-text').focused);
  $('find-text').value = 'foo'; $('find-text').fire('input'); $('find-next').fire();
  assert.equal($('body').selectionStart, 0); assert.equal($('body').selectionEnd, 3); assert.equal(approved(), true);
  $('find-next').fire(); assert.equal($('body').selectionStart, 8);
  $('replace-text').value = '$&'; $('replace-text').fire('input'); $('replace-match').fire();
  assert.equal($('body').value, 'foo and $& and foo'); assert.equal(approved(), false);
  assert.equal(history.read(history.list()[0].id).draft.body, 'foo and FOO and foo');
  assert.equal(history.read(history.list()[0].id).source.notes, 'Private fictional source.');
  assert.deepEqual(history.read(history.list()[0].id).draft.questions, ['Private fictional question?']);
  ui.refresh();
}));
test('Bulk preview preserves approval, cancellation preserves writing, and confirmed apply retains the original', () => withEditor(({ $, history, approved, setAccepted, message }) => {
  $('find-text').value = 'foo'; $('find-text').fire('input'); $('replace-text').value = 'bar'; $('replace-text').fire('input');
  $('preview-replace-all').fire(); assert.equal($('replace-preview').hidden, false); assert.equal(approved(), true);
  assert.equal($('replace-examples').children.length, 3); assert.equal(history.list().length, 0);
  $('apply-replace-all').fire(); assert.match(message(), /cancelled/); assert.equal($('body').value, 'foo and FOO and foo'); assert.equal(approved(), true);
  setAccepted(true); $('apply-replace-all').fire(); assert.equal($('body').value, 'bar and bar and bar'); assert.equal(approved(), false);
  assert.equal(history.read(history.list()[0].id).draft.body, 'foo and FOO and foo');
  assert.equal($('replace-preview').hidden, true); assert.equal($('replace-examples').children.length, 0);
}));
test('Article, query, case, and replacement edits invalidate a bulk preview before any forced apply', () => withEditor(({ $, ui, setAccepted, history }) => {
  setAccepted(true);
  for (const change of [() => { $('body').value += '!'; ui.refresh(); }, () => { $('find-text').value = 'FOO'; $('find-text').fire('input'); }, () => { $('find-case').checked = true; $('find-case').fire('change'); }, () => { $('replace-text').value = 'new'; $('replace-text').fire('input'); }]) {
    $('find-text').value = 'foo'; $('find-case').checked = false; $('replace-text').value = 'bar'; ui.refresh(); $('preview-replace-all').fire();
    change(); const unchanged = $('body').value; $('apply-replace-all').fire();
    assert.equal($('replace-preview').hidden, true); assert.equal($('body').value, unchanged); assert.equal(history.list().length, 0);
  }
}));
test('Changed selections, busy imports, oversized replacements and checkpoint failures cannot replace writing', () => withEditor(({ $, ui, approved, setAccepted, setBusy, setFailure, message, history }) => {
  $('find-text').value = 'foo'; $('replace-text').value = 'bar'; ui.refresh(); $('find-next').fire();
  $('body').setSelectionRange(1, 2); $('body').fire('select'); $('replace-match').fire(); assert.equal(history.list().length, 0);
  setBusy(true); ui.refresh(); assert.equal($('preview-replace-all').disabled, true); $('preview-replace-all').fire(); assert.equal(history.list().length, 0);
  setBusy(false); $('body').value = 'x'.repeat(12000); $('find-text').value = 'x'; $('replace-text').value = 'xx'; ui.refresh(); $('preview-replace-all').fire();
  assert.match(message(), /exceed 12,000/); assert.equal($('body').value.length, 12000); assert.equal(approved(), true);
  $('body').value = 'foo'; $('find-text').value = 'foo'; $('replace-text').value = 'bar'; ui.refresh(); $('preview-replace-all').fire();
  setFailure(true); setAccepted(true); $('apply-replace-all').fire(); assert.match(message(), /Checkpoint unavailable/); assert.equal($('body').value, 'foo'); assert.equal(approved(), true);
}));
test('Keyboard navigation ignores IME composition and clearing removes query, replacement and preview text', () => withEditor(({ $, ui, approved }) => {
  $('find-text').value = 'foo'; $('find-text').fire('input'); let prevented = false;
  $('find-text').fire('keydown', { key: 'Enter', isComposing: true, preventDefault() { prevented = true; } }); assert.equal(prevented, false);
  $('find-text').fire('keydown', { key: 'Enter', isComposing: false, preventDefault() { prevented = true; } }); assert.equal(prevented, true); assert.equal($('body').selectionStart, 0);
  $('replace-text').value = 'bar'; $('replace-text').fire('input'); $('preview-replace-all').fire();
  ui.clear(); assert.equal($('find-text').value, ''); assert.equal($('replace-text').value, ''); assert.equal($('find-case').checked, false);
  assert.equal($('replace-preview').hidden, true); assert.equal($('replace-examples').children.length, 0); assert.equal(approved(), true);
}));
