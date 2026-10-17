import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const blobs = [
 ['draft-review.js','f9fb7ec6cc3f613e2a3a938da115f5f913dbdf80'],
 ['export-review.js','8d72c3b37e81b2039547a236baa49205ae3247bc'],
 ['wordpress-images.js','d18a3f96fb695eacd7f2c879c2ebc5fc036635fb']
];
test('Before-116 sources are exact historical Git blobs', () => {
 for (const [name, wanted] of blobs) {
  const bytes=readFileSync('tests/fixtures/review-ab-before-116/'+name);
  const got=createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex');
  assert.equal(got,wanted,name);
 }
});
test('Comparison runs paired isolated browser controls without production build changes',()=>{
 const source=readFileSync('scripts/review_ab_benchmark.py','utf8');
 assert.match(source,/"before","after","after","before"/);
 assert.match(source,/unexpectedRequests/);
 assert.match(source,/publicUnchanged/);
 assert.equal(readFileSync('scripts/build-site.mjs','utf8'),
  "// All public pages use a shared shell and a deterministic local build.\nimport './build-content.mjs';\n");
});
