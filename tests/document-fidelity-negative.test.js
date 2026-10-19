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
  assert.equal(report.positiveCount, 19);
  assert.equal(report.negativeCount, 64);
  assert.equal(report.expectedPositiveCount, 19);
  assert.equal(report.expectedNegativeCount, 64);
  assert.deepEqual(report.errors, []);
  assert.equal(new Set(report.negative.map(item => item.name)).size, 64);
  for (const name of ['word-disabled-or-invalid-header-false', 'word-duplicate-header-flags',
    'html-reversed-numbering', 'wordpress-item-value-override', 'word-numbering-relation-missing',
    'word-numbering-type-missing', 'word-vertical-merge', 'word-missing-list-label']) {
    assert.ok(report.negative.some(item => item.name === name), name);
  }
});
