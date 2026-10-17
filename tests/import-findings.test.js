import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeImportFindings, guidanceForImportWarning } from '../public/import-findings.js';
test('Import summary gives truthful no-warning and affected warning counts', () => {
  assert.match(summarizeImportFindings({warnings: [], unmapped: [], wordImages: []}), /No conversion notes/);
  const result = summarizeImportFindings({warnings:['Changed heading', 'Image omitted'], unmapped:[{key:'layout'}], wordImages:[{}]});
  assert.match(result,/2 conversion note/); assert.match(result,/1 unmapped page field/);
  assert.match(result,/1 numbered image/); assert.match(result,/does not verify facts/);
});
test('Warning guidance differentiates heading, table, image, link, field, revision, and fallback', () => {
  assert.match(guidanceForImportWarning('Heading differs'),/first heading/);
  assert.match(guidanceForImportWarning('Table header'),/first row/);
  assert.match(guidanceForImportWarning('Image omitted'),/Word images/);
  assert.match(guidanceForImportWarning('Relative link'),/page URL/);
  assert.match(guidanceForImportWarning('Unmapped field'),/unmapped fields/);
  assert.match(guidanceForImportWarning('Tracked revisions'),/Switch versions/);
  assert.match(guidanceForImportWarning('Other warning'),/Compare this change/);
});
test('Import helper handles empty candidates and does not echo document text', () => {
  assert.match(summarizeImportFindings(null),/No conversion notes/);
  assert.doesNotMatch(summarizeImportFindings({ warnings:['PRIVATE BODY'], unmapped: []}),/PRIVATE BODY/);
  assert.match(guidanceForImportWarning(null),/Compare this change/);
});