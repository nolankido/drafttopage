// A deterministic, fictional multi-image DOCX for isolated local WordPress acceptance.
// Importing test fixtures does not touch public articles or customer data.
import { imageFixture, PNG, JPEG } from '../tests/word-image-fixtures.js';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

export function wordpressMediaFixture() {
  const fixture = imageFixture({
    ids: ['one', 'two', 'one'],
    media: { 'word/media/one.png': PNG, 'word/media/two.jpg': JPEG },
    relations: [['one', 'media/one.png', ''], ['two', 'media/two.jpg', '']]
  });
  return {
    kind: 'fictional-multi-image-word',
    docxBase64: Buffer.from(fixture.bytes).toString('base64'),
    originals: [
      { filename: 'word-image-001.png', mime: 'image/png', sourcePart: 'word/media/one.png', data: Buffer.from(PNG).toString('base64') },
      { filename: 'word-image-002.jpg', mime: 'image/jpeg', sourcePart: 'word/media/two.jpg', data: Buffer.from(JPEG).toString('base64') }
    ],
    occurrences: [
      { placeholder: '[Word image 1]', filename: 'word-image-001.png', alt: 'Fictional image 1' },
      { placeholder: '[Word image 2]', filename: 'word-image-002.jpg', alt: 'Fictional image 2' },
      { placeholder: '[Word image 3]', filename: 'word-image-001.png', alt: 'Fictional image 3' }
    ]
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.stdout.write(JSON.stringify(wordpressMediaFixture()) + '\n');
}
