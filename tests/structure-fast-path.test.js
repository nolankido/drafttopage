import test from 'node:test';
import assert from 'node:assert/strict';
import { articleStructure, articleWordCount, createArticleWordCounter, analyzeDraft } from '../public/draft-review.js';
import { previewPassages } from '../public/preview.js';
import { inlineTokens, inlineVisibleText } from '../public/markdown-inline.js';
import { setextLevel, thematicBreak } from '../public/markdown-block-syntax.js';
import { baselineArticleStructure } from './fixtures/article-structure-20261016.js';

const baselineWords = body => baselineArticleStructure(body).reduce((total, block) => total + (block.kind === 'code' ? 0 : (inlineVisibleText(inlineTokens(block.text)).match(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu) || []).length), 0);
function checked(body, expectedCalls) {
  let calls = 0;
  const result = articleStructure(body, { readPassages: value => { calls++; assert.equal(value, body); return previewPassages(value); } });
  assert.deepEqual(result, baselineArticleStructure(body), body.slice(0, 120));
  if (expectedCalls !== undefined) assert.equal(calls, expectedCalls, body.slice(0, 120));
  return result;
}

test('Ordinary structure avoids semantic preview scans without changing any returned block', () => {
  for (const body of ['', 'One paragraph.', '日本語 😀\r\n\r\n## Café\r\nWords.',
    '## Heading\nA **marked** passage.\n\n- One\n- Two',
    '| Name | Note |\n| --- | --- |\n| Fictional | Uncertain |',
    '```js\nconst value = 2;\n```\n\nEnding.', '> A quote.\n> Next.',
    '\\--- stays literal\n\n[link](https://example.test/a_(b))',
    '    ===\n    ---\n\t***\n___suffix', 'prefix\r---\nnext']) checked(body, 0);
});

test('Every possible semantic candidate keeps one full scan, including protected containers and internal CR', () => {
  for (const candidate of ['=', '-', '---', '___', '***', ' * * * ', '  -\t- -', '   ====\t', '-\r-\r-', '=\r=']) {
    for (const body of [candidate, 'Heading\n'+candidate, '```\n'+candidate+'\n```',
      '- Item\n'+candidate+'\n- Next', '> Quote\n'+candidate, '| H |\n| --- |\n| Cell |\n'+candidate]) checked(body, 1);
  }
  checked('Plain\n\nSecond', 0);checked('Title\r\n===\r\n\r\nTail', 1);
});

test('Generated marker and container boundaries match the frozen unconditional reader exactly', () => {
  let cases = 0;
  for (const indent of ['', ' ', '   ', '    ', '\t']) for (const marker of ['-', '=', '*', '_', '-_', '*-']) {
    for (const count of [0, 1, 2, 3, 5]) for (const ending of ['', ' ', '\t', 'x', '\r', '\r\r']) {
      const line = indent+marker.repeat(count)+ending;
      for (const body of ['Fictional 日本語 😀\n'+line+'\nTail.', '```\n'+line+'\n```', '- Item\n'+line+'\n- Next']) {
        const eligible=body.split('\n').some(value=>{const line=value.replaceAll('\r','');return setextLevel(line)||thematicBreak(line);});
        checked(body,eligible?1:0);cases++;
      }
    }
  }
  assert.equal(cases, 2700);
});

test('Ten thousand deterministic mixed-source edits preserve structure, counts and cache results', () => {
  const pieces = ['', 'Ordinary paragraph.', '\n', '\r\n', '日本語 😀 café', '# Heading', '## Next ##',
    '===', '---', '***', ' _ _ _ ', '    ---', '\t===', '```', '~~~~ js', '~~~',
    '- First\n  - Nested\n- Next', '2. Item\n3. Next', '> Quote\n> Continued',
    '| Head | Note |\n| --- | --- |\n| A | B |', '[**Label**](https://example.test/a_(b))',
    '\\---', 'TODO text and `code words`', 'a\rb', '-\r-\r-', '<div>', '[x]: https://example.test/'];
  let seed = 104729;
  const next = size => { seed = (Math.imul(seed, 1664525)+1013904223)>>>0; return seed%size; };
  const count = createArticleWordCounter();
  for (let i = 0; i < 10000; i++) {
    let body = '';
    for (let j = 0, size = next(12); j < size; j++) body += (j ? ['\n', '\n\n', '\r\n'][next(3)] : '')+pieces[next(pieces.length)];
    checked(body);
    const expected = baselineWords(body);
    assert.equal(articleWordCount(body), expected);assert.equal(count(body), expected);assert.equal(count(body), expected);
  }
});

test('Near-limit ordinary, distinct rich, candidate and single-paragraph articles retain exact output', () => {
  const rich = '## Heading\n\nA **marked** passage and [label](https://example.test/).\n\n- One\n- Two\n\n| H | N |\n| --- | --- |\n| A | B |\n\n';
  const distinct = Array.from({length:500}, (_,i) => 'Fictional '+i+' **marked** paragraph.').join('\n\n');
  for (const body of ['a'.repeat(60000), (rich.repeat(Math.floor(60000/rich.length))).trim(), distinct,
    'Heading\n===\n\n'+'x'.repeat(59985), '```\n---\n'+ 'x'.repeat(59992)]) {
    assert.ok(body.length<=60000);checked(body);
    assert.equal(articleWordCount(body), baselineWords(body));
  }
});

test('Semantic fallback changes remain synchronous and preserve headings, findings and original offsets', () => {
  const bodies = ['日本語 😀\r\n\r\nHeading\r\n===\r\nTODO passage.\r\n\r\n***\r\nTail.',
    'Heading\n\n---\nTail.', '```\nHeading\n===\n---\n```\n\n## Real\nBody.'];
  for (const body of bodies) {
    checked(body);const review=analyzeDraft({body});
    for (const heading of review.headings) assert.ok(body.slice(heading.start,heading.end).includes(heading.text));
    assert.equal(review.words, baselineWords(body));
    for (const finding of review.findings) assert.ok(finding.start>=0 && finding.end<=body.length);
  }
  const count=createArticleWordCounter();
  for (const body of ['Title\nplain', 'Title\n===', 'Title\n\n---', '```\nTitle\n===', '', 'Title\nplain']) assert.equal(count(body),baselineWords(body));
});

test('Invalid input rejects before any passage reader runs and a failed fallback cannot return partial structure', () => {
  let calls=0;const readPassages=()=>{calls++;throw Error('Diagnostic reader failed.');};
  for (const body of [null, undefined, {}, 'x'.repeat(60001)]) assert.throws(()=>articleStructure(body,{readPassages}),/60,000/);
  assert.equal(calls,0);assert.throws(()=>articleStructure('Title\n===',{readPassages}),/Diagnostic reader failed/);assert.equal(calls,1);
  assert.deepEqual(articleStructure('Plain',{readPassages}),baselineArticleStructure('Plain'));assert.equal(calls,1);
});
