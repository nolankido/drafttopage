import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Synthetic verifier controls, not a real source-app or WordPress acceptance run.
test('Independent export verifier accepts valid variants and rejects structural damage', () => {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const output = execFileSync('python3', ['tests/document_fidelity_negative.py'], {
    cwd: root, encoding: 'utf8', timeout: 45000, maxBuffer: 1024 * 1024
  });
  const report = JSON.parse(output);
  assert.equal(report.result, 'PASS');
  assert.equal(report.positiveCount, 12);
  assert.equal(report.negativeCount, 26);
  assert.equal(report.expectedPositiveCount, 12);
  assert.equal(report.expectedNegativeCount, 26);
  assert.deepEqual(report.errors, []);
  assert.equal(new Set(report.negative.map(item => item.name)).size, 26);
  assert.ok(report.negative.some(item => item.name === 'word-disabled-or-invalid-header-false'));
  assert.ok(report.negative.some(item => item.name === 'word-duplicate-header-flags'));
});
