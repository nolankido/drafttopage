import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
test('Import review shows findings before optional exact source and retains consent/destination controls', async () => {
  const html = await readFile(new URL('../scripts/import-panel.html.inc', import.meta.url), 'utf8');
  const at = value => { const index = html.indexOf(value); assert.ok(index >= 0, value + ' exists'); return index; };
  assert.ok(at('id="import-summary"') < at('id="import-findings-status"'));
  assert.ok(at('id="import-findings-status"') < at('id="import-reading-details"'));
  assert.ok(at('id="import-reading-details"') < at('id="import-source-details"'));
  assert.match(html, /<details id="import-reading-details" open>/);
  assert.match(html, /<details id="import-source-details">/);
  assert.match(html, /id="import-body-preview"[^>]+readonly/);
  assert.match(html, /id="import-unmapped-ok"[^>]*type="checkbox"/);
  assert.match(html, /id="import-changes-ok"[^>]*type="checkbox"/);
  assert.match(html, /id="apply-import-and-continue"[^>]*disabled/);
  assert.match(html, /id="import-completion"[^>]*hidden/);
});
test('Import review resets disclosures on a new conversion and keeps separate export approval', async () => {
  const code = await readFile(new URL('../public/import-controls.js', import.meta.url), 'utf8');
  assert.match(code, /'import-reading-details'\)\.open = true/);
  assert.match(code, /'import-source-details'\)\.open = false/);
  assert.match(code, /summarizeImportFindings\(candidate\)/);
  assert.match(code, /guidanceForImportWarning\(text\)/);
  assert.match(code, /continueToExport: continueAfterImport/);
  assert.match(code, /approval still required/);
});