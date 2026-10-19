import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Validator-only evidence. No browser, user account or WordPress site is opened.
test('Compound WordPress checks reject semantic damage after save or reopen', () => {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const report = JSON.parse(execFileSync('python3', ['tests/wordpress_compound_negative.py'], {
    cwd: root, encoding: 'utf8', timeout: 45000, maxBuffer: 1024 * 1024
  }));
  assert.equal(report.result, 'PASS');
  assert.equal(report.positiveCount, 5);
  assert.equal(report.negativeCount, 27);
  assert.deepEqual(report.errors, []);
  assert.equal(new Set(report.negative).size, 27);
  for (const name of ['store-bullets', 'store-implicit-bullets', 'raw-lost-header',
    'rendered-heading-boundary', 'raw-merged-cell', 'duplicate-id']) {
    assert.ok(report.negative.includes(name), name);
  }
  const runner = readFileSync(new URL('../scripts/wordpress_roundtrip.py', import.meta.url), 'utf8');
  assert.match(runner, /check_compound_post\(post, case\)/);
  assert.match(runner, /check_compound_blocks\(blocks, case\)/);
  assert.match(runner, /check_post\(reopened, case/);
});
