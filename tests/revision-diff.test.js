import test from 'node:test';
import assert from 'node:assert/strict';
import { compareArticleLines, MAX_DIFF_CELLS, DIFF_GROUP_LIMIT, previewArticleChange } from '../public/revision-diff.js';
import { installRevisionDiff } from '../public/revision-diff-controls.js';

const reconstruct = (result, excluded) => result.groups.filter(group => group.kind !== excluded).map(group => group.text).join('');
test('Line comparison identifies edits while retaining unchanged headings and exact line numbers', () => {
  const saved = '## Update\n\nOriginal passage.\n\nKeep this.\n', current = '## Update\n\nRevised passage.\nNew detail.\n\nKeep this.\n';
  const result = compareArticleLines(saved, current);
  assert.deepEqual(result.groups.filter(group => group.kind !== 'same'), [
    { kind: 'removed', savedLine: 3, currentLine: 3, text: 'Original passage.\n', lineCount: 1 },
    { kind: 'added', savedLine: 4, currentLine: 3, text: 'Revised passage.\nNew detail.\n', lineCount: 2 }
  ]);
  assert.deepEqual([result.added, result.removed, result.unchanged, result.coarse], [2, 1, 4, false]);
  assert.equal(reconstruct(result, 'added'), saved); assert.equal(reconstruct(result, 'removed'), current);
});
test('Empty bodies, insertion, deletion, whitespace and final newlines remain exact', () => {
  for (const [saved, current] of [['', ''], ['', '\n'], ['\n\n', ''], ['One\nTwo', 'One\n'], ['One', 'One\n'], ['  \n\t', '\n\t\n'], ['One\r\n', 'One\n']]) {
    const result = compareArticleLines(saved, current);
    assert.equal(reconstruct(result, 'added'), saved); assert.equal(reconstruct(result, 'removed'), current);
    assert.equal(result.added + result.removed === 0, saved === current);
    assert.equal(result.coarse, false);
  }
  assert.equal(compareArticleLines('One\r\n', 'One\n').unchanged, 0);
});
test('Unicode, repeated lines and hostile-looking markup are compared as unchanged data', () => {
  const saved = 'Same\nSame\n😀 Café\n<script>fictional()</script>\n', current = 'Same\nNew\nSame\n😀 Café\n<script>fictional()</script>\n';
  const result = compareArticleLines(saved, current);
  assert.equal(result.added, 1); assert.equal(result.removed, 0);
  assert.equal(result.groups.find(group => group.kind === 'added').text, 'New\n');
  assert.equal(reconstruct(result, 'added'), saved); assert.equal(reconstruct(result, 'removed'), current);
});
test('Large changed regions use a bounded, explicitly coarse plan and still retain exact writing', () => {
  assert.equal(MAX_DIFF_CELLS, 160000);
  const saved = 'Opening.\n' + 'a\n'.repeat(4000) + 'End.', current = 'Opening.\n' + 'b\n'.repeat(4000) + 'End.';
  const result = compareArticleLines(saved, current);
  assert.equal(result.coarse, true); assert.equal(result.added, 4000); assert.equal(result.removed, 4000); assert.equal(result.unchanged, 2);
  assert.equal(result.groups.length, 4);
  assert.equal(reconstruct(result, 'added'), saved); assert.equal(reconstruct(result, 'removed'), current);
  // Thousands of unchanged lines are trimmed before the bounded alignment.
  const mostlySame = 'same\n'.repeat(2300);
  assert.equal(compareArticleLines(mostlySame + 'Before', mostlySame + 'After').coarse, false);
  assert.equal(compareArticleLines('a'.repeat(60000), 'b'.repeat(60000)).groups.length, 2);
});
test('Many independent edit scenarios reconstruct both versions and count line tokens exactly', () => {
  for (let seed = 0; seed < 100; seed++) {
    const saved = Array.from({ length: 18 }, (_, i) => ['One\n', '\n', '😀\r\n', '<img>\n', 'Same\n'][(seed + i * 3) % 5]).join('') + 'Tail';
    const current = saved.split('\n').filter((_, i) => (i + seed) % 5 !== 0).map((line, i) => i === seed % 10 ? 'Changed' : line).join('\n') + (seed % 2 ? '\n' : '');
    const result = compareArticleLines(saved, current);
    assert.equal(reconstruct(result, 'added'), saved); assert.equal(reconstruct(result, 'removed'), current);
    const count = text => (text.match(/[^\n]*\n|[^\n]+$/g) || []).length;
    assert.equal(result.removed + result.unchanged, count(saved)); assert.equal(result.added + result.unchanged, count(current));
  }
});
test('Invalid text rejects before allocating comparison state', () => {
  for (const value of [null, {}, 'x'.repeat(60001), 'Bad\u0000text']) {
    assert.throws(() => compareArticleLines(value, 'Valid'));
    assert.throws(() => compareArticleLines('Valid', value));
  }
});
test('Long previews cap line and character counts without splitting Unicode pairs or changing the source', () => {
  const many = 'Line.\n'.repeat(100), dense = 'x'.repeat(799) + '😀tail';
  assert.deepEqual(previewArticleChange(many), { text: 'Line.\n'.repeat(8), truncated: true });
  assert.deepEqual(previewArticleChange(dense), { text: 'x'.repeat(799), truncated: true });
  assert.deepEqual(previewArticleChange('Short.\n'), { text: 'Short.\n', truncated: false });
  assert.equal(previewArticleChange('x'.repeat(60000)).text.length, 800);
  assert.equal(many.length, 600); assert.throws(() => previewArticleChange(null));
});
test('Small repeated-line alignments agree with an independent exhaustive subsequence oracle', () => {
  for (let seed = 0; seed < 32; seed++) {
    const a = Array.from({ length: 5 }, (_, i) => seed & (1 << i) ? 'A\n' : 'B\n');
    const b = Array.from({ length: 5 }, (_, i) => (seed * 7 + 3) & (1 << i) ? 'A\n' : 'B\n');
    let longest = 0;
    for (let subset = 0; subset < 32; subset++) {
      const candidate = a.filter((_, i) => subset & (1 << i)); let position = 0;
      for (const token of b) if (candidate[position] === token) position++;
      if (position === candidate.length) longest = Math.max(longest, candidate.length);
    }
    const result = compareArticleLines(a.join(''), b.join(''));
    assert.equal(result.unchanged, longest); assert.equal(result.added, 5 - longest); assert.equal(result.removed, 5 - longest);
  }
});

// Event-bearing DOM contract fixture, not a browser layout/accessibility audit.
function withChanges(run) {
  class Control {
    constructor(tag = '') { this.tag = tag; this.children = []; this.listeners = {}; this.open = false; this.textContent = ''; }
    addEventListener(event, fn) { (this.listeners[event] ||= []).push(fn); }
    append(...children) { this.children.push(...children); }
    replaceChildren(...children) { this.children = children; }
    fire(event = 'toggle') { for (const fn of this.listeners[event] || []) fn(); }
  }
  const previous = globalThis.document, nodes = new Map();
  const $ = id => { if (!nodes.has(id)) nodes.set(id, new Control()); return nodes.get(id); };
  globalThis.document = { getElementById: $, createElement: tag => new Control(tag) };
  let pair = { saved: '## Heading\n\nBefore.', current: '## Heading\n\nAfter.' }, comparisons = 0, fail = false;
  try {
    const ui = installRevisionDiff({ getComparison: () => pair, compare: (a, b) => { comparisons++; if (fail) throw new Error('Fixture comparison failure.'); return compareArticleLines(a, b); } });
    run({ $, ui, comparisons: () => comparisons, setPair: value => { pair = value; ui.refresh(); }, setFailure: value => { fail = value; } });
  } finally { globalThis.document = previous; }
}
test('Comparison waits for opened panels, refreshes edited text, and leaves unchanged nodes intact', () => withChanges(({ $, ui, comparisons, setPair }) => {
  assert.equal(comparisons(), 0); assert.equal($('article-diff-groups').children.length, 0);
  $('article-diff-panel').open = true; $('article-diff-panel').fire(); assert.equal(comparisons(), 0);
  $('checkpoint-panel').open = true; $('checkpoint-panel').fire(); assert.equal(comparisons(), 1);
  const first = $('article-diff-groups').children[0]; ui.refresh(); assert.equal(comparisons(), 1); assert.equal($('article-diff-groups').children[0], first);
  setPair({ saved: 'Saved.', current: 'Current.' }); assert.equal(comparisons(), 2);
  assert.equal($('article-diff-groups').children[1].children[1].textContent, 'Current.');
  $('article-diff-panel').open = false; setPair({ saved: 'Next saved.', current: 'Next current.' });
  assert.equal($('article-diff-groups').children.length, 0); assert.equal(comparisons(), 2);
  $('article-diff-panel').open = true; $('article-diff-panel').fire(); assert.equal(comparisons(), 3);
}));
test('Checkpoint selection, matching bodies and clear/invalid state replace or purge old comparison data', () => withChanges(({ $, setPair }) => {
  $('checkpoint-panel').open = $('article-diff-panel').open = true; $('article-diff-panel').fire();
  setPair({ saved: 'Another checkpoint.', current: 'Current text.' });
  assert.equal($('article-diff-groups').children[0].children[1].textContent, 'Another checkpoint.');
  setPair({ saved: 'Matching.', current: 'Matching.' }); assert.equal($('article-diff-groups').children.length, 0); assert.match($('article-diff-status').textContent, /match exactly/);
  setPair(null); assert.equal($('article-diff-groups').children.length, 0); assert.match($('article-diff-status').textContent, /Save a checkpoint/);
}));
test('Markup stays literal, groups have explicit added/removed labels and newline-only edits are explained', () => withChanges(({ $, setPair }) => {
  $('checkpoint-panel').open = $('article-diff-panel').open = true;
  setPair({ saved: '<script>fictional()</script>\n', current: '<img src=x>\n\n' });
  const items = $('article-diff-groups').children;
  assert.equal(items[0].children[1].tag, 'pre'); assert.equal(items[0].children[1].textContent, '<script>fictional()</script>\n');
  assert.match(items[0].children[0].textContent, /Removed from saved article/); assert.match(items[1].children[0].textContent, /Added in current article/);
  setPair({ saved: '\n', current: '' }); assert.match($('article-diff-groups').children[0].children[0].textContent, /whitespace only/);
  setPair({ saved: 'One\r\n', current: 'One' });
  assert.match($('article-diff-groups').children[0].children[2].textContent, /CRLF/);
  assert.match($('article-diff-groups').children[1].children[2].textContent, /No final line break/);
}));
test('Visible group limits and coarse processing are disclosed while underlying article text stays complete', () => withChanges(({ $, setPair }) => {
  $('checkpoint-panel').open = $('article-diff-panel').open = true;
  const saved = Array.from({ length: 80 }, (_, i) => 'Keep ' + i + '\nBefore\n').join(''), current = saved.replaceAll('Before', 'After');
  setPair({ saved, current }); assert.equal($('article-diff-groups').children.length, DIFF_GROUP_LIMIT);
  assert.match($('article-diff-status').textContent, /first 40 change groups/);
  setPair({ saved: 'a\n'.repeat(4000), current: 'b\n'.repeat(4000) });
  assert.match($('article-diff-status').textContent, /Large changed region grouped/);
  const group = $('article-diff-groups').children[0];
  assert.equal(group.children[1].textContent, 'a\n'.repeat(8));
  assert.equal(group.children[3].tag, 'details'); assert.equal(group.children[3].open, false);
  assert.equal(group.children[3].children[1].textContent, 'a\n'.repeat(4000));
  setPair(null); assert.equal($('article-diff-groups').children.length, 0);
}));
test('Comparison errors preserve the read-only fallback and refresh can recover', () => withChanges(({ $, ui, setFailure }) => {
  $('checkpoint-panel').open = $('article-diff-panel').open = true; setFailure(true); ui.refresh();
  assert.equal($('article-diff-groups').children.length, 0); assert.match($('article-diff-status').textContent, /complete saved\/current fields/);
  setFailure(false); ui.refresh(); assert.equal($('article-diff-groups').children.length, 2);
}));
