import test from 'node:test';
import assert from 'node:assert/strict';
import { articleStructure, articleWordCount, createArticleWordCounter, WORD_COUNT_CACHE_LIMIT } from '../public/draft-review.js';
import { EXAMPLES } from '../public/content-data.js';

const fixtures = [
  '', 'One ordinary paragraph.', 'One\r\nline, café 日本語 😀 2026 and can’t-stop.',
  '## Heading ##\n\nPlain **bold** *italic* ~~old wording~~ with `code words`.\n\n[Label](https://example.test/url) and ![image alt](https://example.test/x.png).',
  'Before\n\n```\nnot counted words\n```\n\nAfter.',
  'First line\n===\n\n***\n\nLast word.',
  '4. Parent\n  7. Child\n5. Next\n\n> A quoted phrase.\n\n| A | B |\n| --- | --- |\n| One | Two |',
  String.raw`Escaped \*marks\* and \~\~literal\~\~.`,
  '---\n\n~~~open\nnot counted until closed',
  ...EXAMPLES.map(item => item.draft.body)
];

test('Cached counts exactly match the unchanged stateless definition across semantic edits', () => {
  const count = createArticleWordCounter();
  for (const body of [...fixtures, ...fixtures.toReversed(), '', 'After clearing.']) assert.equal(count(body), articleWordCount(body), body);
  for (const body of ['same words\n\nsame words', '```\nsame words\n\nsame words\n```', 'same words\n===\n\nsame words', '# same words\n\nsame words', 'same words\n\n```\nsame words', 'same words\n\n```\nsame words\n```\n\nsame words']) assert.equal(count(body), articleWordCount(body), body);
});

test('Unchanged body skips all parsing; changed body re-reads structure and reuses only identical inline text', () => {
  let structures = 0, inlines = 0;
  const count = createArticleWordCounter({ readStructure: body => { structures++; return articleStructure(body); }, countInline: text => { inlines++; return text.trim().split(/\s+/).length; } });
  assert.equal(count('First paragraph\n\nSecond paragraph'), 4); assert.equal(structures, 1); assert.equal(inlines, 2);
  assert.equal(count(['First paragraph', 'Second paragraph'].join('\n\n')), 4); assert.equal(structures, 1); assert.equal(inlines, 2);
  assert.equal(count('First paragraph\n\nSecond revised paragraph'), 5); assert.equal(structures, 2); assert.equal(inlines, 3);
  assert.equal(count('First paragraph\n\nFirst paragraph\n\nSecond revised paragraph'), 7); assert.equal(structures, 3); assert.equal(inlines, 3);
  assert.equal(count('```\nFirst paragraph\n\nSecond revised paragraph\n```'), 0); assert.equal(structures, 4); assert.equal(inlines, 3);
  assert.equal(count('First paragraph'), 2); assert.equal(structures, 5); assert.equal(inlines, 4);
});

test('Cache entries are current-only, capped and recomputed beyond the cap without dropping words', () => {
  let calls = 0;
  const count = createArticleWordCounter({ countInline: text => { calls++; return articleWordCount(text); } });
  assert.equal(WORD_COUNT_CACHE_LIMIT, 512);
  const body = Array.from({ length: WORD_COUNT_CACHE_LIMIT + 3 }, (_, i) => 'Paragraph' + i).join('\n\n');
  assert.equal(count(body), WORD_COUNT_CACHE_LIMIT + 3); assert.equal(calls, WORD_COUNT_CACHE_LIMIT + 3);
  const before = calls;
  assert.equal(count(body + '\n\nAnother'), WORD_COUNT_CACHE_LIMIT + 4); assert.equal(calls - before, 4);
  count('Only current words'); const replaced = calls;
  assert.equal(count('Paragraph0'), 1); assert.equal(calls, replaced + 1);
});

test('Empty/reset purges derived text, and separate workspaces never share a cache', () => {
  let calls = 0;
  const options = { countInline: text => { calls++; return articleWordCount(text); } };
  const first = createArticleWordCounter(options), second = createArticleWordCounter(options);
  assert.equal(first('Private fictional phrase'), 3); assert.equal(calls, 1);
  assert.equal(second('Private fictional phrase'), 3); assert.equal(calls, 2);
  assert.equal(first(''), 0); assert.equal(first(''), 0);
  assert.equal(first('Private fictional phrase'), 3); assert.equal(calls, 3);
});

test('Validation and failed computations never publish a partial cached total', () => {
  let fail = false;
  const count = createArticleWordCounter({ countInline: text => { if (fail && text === 'Later phrase') throw Error('Fixture count failed'); return articleWordCount(text); } });
  assert.equal(count('Earlier phrase'), 2);
  fail = true; assert.throws(() => count('New phrase\n\nLater phrase'), /Fixture/);
  assert.equal(count('Earlier phrase'), 2);
  fail = false; assert.equal(count('New phrase\n\nLater phrase'), 4);
  for (const value of [null, undefined, 4, {}, 'x'.repeat(60001)]) assert.throws(() => count(value), /60,000/);
  assert.equal(count('x'.repeat(60000)), articleWordCount('x'.repeat(60000)));
});

test('Zero-word punctuation and opaque inline/code contexts remain exact cached values', () => {
  const count = createArticleWordCounter();
  for (const body of ['***', '***\n\n***', '`code only`', '`code only`\n\n***', '![](https://example.test/x.png)', '😀\n\n😀', '[**A label**](https://example.test/) and ~~two words~~', 'a\u0000b', '~~~\nignored\n~~~\n\nVisible']) assert.equal(count(body), articleWordCount(body), body);
});

test('A changing near-limit single paragraph remains exact even when its inline parse cannot be reused', () => {
  const count = createArticleWordCounter(), body = 'word '.repeat(11999) + 'end';
  for (const suffix of ['', 'x', 'xx', '', '']) assert.equal(count(body + suffix), articleWordCount(body + suffix));
});

test('Thousands of deterministic editing states preserve the stateless result exactly', () => {
  const count = createArticleWordCounter();
  let state = 20261016;
  const next = () => state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
  const chunks = [...fixtures, '**new** words', '\n\n', '### A heading\n', '```\n', '~~~\n', '---\n', '\r\n', '~~mark~~', '`opaque`', '😀 日本語', '[label](https://example.test/)', '\\*literal\\*'];
  for (let i = 0; i < 3000; i++) {
    let body = Array.from({ length: 1 + next() % 8 }, () => chunks[next() % chunks.length]).join('');
    if (i % 3 === 0) body = body.slice(0, next() % (body.length + 1));
    assert.equal(count(body), articleWordCount(body), 'Editing state ' + i);
    assert.equal(count(body), articleWordCount(body), 'Repeated state ' + i);
  }
});
