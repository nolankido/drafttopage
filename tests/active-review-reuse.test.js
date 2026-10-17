import test from 'node:test';
import assert from 'node:assert/strict';
import { articleStructure, analyzeDraft } from '../public/draft-review.js';
import { analyzeWordPressImages } from '../public/wordpress-images.js';
import { reviewExport } from '../public/export-review.js';
import { reviewExport as baselineReviewExport } from './fixtures/review-export-before-reuse.js';

const PARTS = [
  'A fictional ordinary paragraph with enough words to demonstrate a safe editing flow.',
  '## Example heading\n\nThe conclusion is uncertain; review the source.',
  '日本語 😀 and café.\r\n\r\nThe end of this section.',
  'A supported [link](https://example.test/path?a=1&b=2) and \\![escaped](https://example.test/never.png).',
  '![Relevant fictional chart](https://example.test/chart.png)',
  'Inline ![Not standalone](https://example.test/image.jpg) in a paragraph.',
  '![Unsafe](http://example.test/image.png)',
  '1. First\n  - Nested\n2. Second',
  '| Name | Value |\n| --- | ---: |\n| Fictional | 42 |',
  '| Name | Value |\n| --- | --- |\n| Fictional | 42 | EXTRA |',
  '~~~html\n![Ignored](https://example.test/never.png)\nTODO and <img>\n~~~',
  'TODO: inspect the source. [Word image 2] ~~incomplete~~~',
  '> Quoted passage\n> ## Nested heading',
  'An underlined heading\n===\n\nThen ordinary text.'
];
const choices = [
  { destination: 'wordpress', includeLinkedImages: false },
  { destination: 'wordpress', includeLinkedImages: true },
  { destination: 'word', includeTitle: true },
  { destination: 'word', includeTitle: false },
  { destination: 'html', includeTitle: false },
  { destination: 'html', includeTitle: true }
];
function compare(body, index) {
  const draft = { title: 'Fictional review ' + index, body };
  const structure = articleStructure(body);
  assert.deepEqual(analyzeDraft(draft, { imageFindings: false, structure }),
    analyzeDraft(draft, { imageFindings: false }), 'draft review parity for ' + index);
  assert.deepEqual(analyzeWordPressImages(body, { structure }), analyzeWordPressImages(body),
    'image scan parity for ' + index);
  for (const options of choices) assert.deepEqual(reviewExport(draft, options),
    baselineReviewExport(draft, options), 'destination parity for ' + index + ' / ' + options.destination + ' / ' + JSON.stringify(options));
}
test('Single current-body structural pass retains export findings and exact positions', () => {
  for (let index = 0; index < PARTS.length; index++) compare(PARTS[index], index);
  for (let index = 0; index < 75; index++) {
    const pieces = [];
    for (let j = 0; j < 6; j++) pieces.push(PARTS[(index * 7 + j * 11) % PARTS.length]);
    compare(pieces.join(index % 2 ? '\n\n' : '\r\n\r\n'), index + 100);
  }
});
test('Near-limit source and repeated text retain all warnings in every destination', () => {
  const ordinary = ('Fictional source sentence.\n\n').repeat(2400).slice(0, 58500) + ' END';
  const rich = ('## Review\n\nOne [source](https://example.test/) and ![chart](https://example.test/pic.png).\n\n').repeat(650).slice(0, 58500) + ' END';
  compare(ordinary, 900); compare(rich, 901);
});
test('Image-free articles skip the image structure walk, while malformed inputs still fail', () => {
  const poison = { [Symbol.iterator]() { throw new Error('An image-free article must not walk supplied structure'); } };
  assert.deepEqual(analyzeWordPressImages('A paragraph without a Markdown image.\n\nAnother passage.', { structure: poison }), []);
  assert.deepEqual(analyzeWordPressImages('A literal \\![escaped](https://example.test/p.png)'), []);
  assert.throws(() => analyzeWordPressImages('a'.repeat(60001)), /60,000/);
  assert.throws(() => analyzeWordPressImages('A null character\u0000'), /null characters/);
  assert.throws(() => analyzeWordPressImages(null), /60,000/);
  assert.deepEqual(analyzeWordPressImages('![Valid](https://example.test/a.png)'),
    analyzeWordPressImages('![Valid](https://example.test/a.png)', { structure: articleStructure('![Valid](https://example.test/a.png)') }));
});
