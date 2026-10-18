import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { createWordPressArticle } from '../public/wordpress-export.js';

export const configuration = JSON.parse(readFileSync(new URL('../tests/fixtures/wordpress-roundtrip.json', import.meta.url)));
export const privateMarkers = ['PRIVATE_ROUNDTRIP_SOURCE_3391', 'PRIVATE_ROUNDTRIP_REVIEW_3391'];
export function roundTripCases() {
  return configuration.cases.map(item => {
    const title = 'Fictional acceptance: ' + item.id;
    const draft = { title, body: item.formattedBody || item.body, questions: [privateMarkers[1]], source: { notes: privateMarkers[0] } };
    return { ...item, title, ...((item.file || item.sourceFixture) ? {} : { html: createWordPressArticle(draft, { includeLinkedImages: item.includeLinkedImages === true }).html }) };
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.stdout.write(JSON.stringify({ ...configuration, cases: roundTripCases(), privateMarkers }));
}
