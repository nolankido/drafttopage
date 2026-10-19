import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// These controls execute the verifier, not Word, a browser or WordPress.
test('Compound verifier rejects duplicate IDs, unresolved headings and unexpected marks', () => {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const report = JSON.parse(execFileSync('python3', ['tests/word_semantics_negative.py'], {
    cwd: root, encoding: 'utf8', timeout: 45000, maxBuffer: 1024 * 1024
  }));
  assert.equal(report.result, 'PASS');
  assert.equal(report.positiveCount, 9);
  assert.equal(report.negativeCount, 32);
  assert.equal(report.expectedPositiveCount, 9);
  assert.equal(report.expectedNegativeCount, 32);
  assert.deepEqual(report.errors, []);
  assert.equal(new Set(report.negative.map(item => item.name)).size, 32);
  for (const name of ['duplicate-numId', 'duplicate-abstractNumId', 'missing-styles-part',
    'heading-outline-body-text', 'all-exports-unintended-em', 'all-exports-unintended-code'])
    assert.ok(report.negative.some(item => item.name === name), name);
  assert.ok(report.positive.includes('inherited-heading-level'));
});
