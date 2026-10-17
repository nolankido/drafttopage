import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sourceDigest, verifyWordPressReceipt } from '../scripts/verify-wordpress-receipt.mjs';

function repoFixture(run) {
  const root = mkdtempSync(join(tmpdir(), 'drafttopage-wp-receipt-'));
  const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  try {
    git(['init', '-q']);
    mkdirSync(join(root, 'test-results'));
    mkdirSync(join(root, 'tests/fixtures'), { recursive: true });
    writeFileSync(join(root, '.gitignore'), 'test-results/\n');
    writeFileSync(join(root, 'README.md'), 'Fictional article source.\n');
    git(['add', '.gitignore', 'README.md']);
    git(['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'Synthetic source']);
    return run({ root, git });
  } finally { rmSync(root, { force: true, recursive: true }); }
}

function independentlyHash(files) {
  const digest = createHash('sha256');
  for (const [name, contents] of Object.entries(files).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) {
    digest.update(name + '\0'); digest.update(contents); digest.update('\0');
  }
  return digest.digest('hex');
}

test('Receipt digest matches independent tracked, untracked, and deleted-source hashing', () => repoFixture(({ root }) => {
  assert.equal(sourceDigest(root), independentlyHash({ '.gitignore': 'test-results/\n', 'README.md': 'Fictional article source.\n' }));
  writeFileSync(join(root, 'extra.txt'), 'Unicode 日本語 💡');
  assert.equal(sourceDigest(root), independentlyHash({
    '.gitignore': 'test-results/\n', 'README.md': 'Fictional article source.\n', 'extra.txt': 'Unicode 日本語 💡'
  }));
  rmSync(join(root, 'README.md'));
  assert.equal(sourceDigest(root), independentlyHash({
    '.gitignore': 'test-results/\n', 'README.md': '[deleted]', 'extra.txt': 'Unicode 日本語 💡'
  }));
  // Fixture report output is ignored; it must never masquerade as input code.
  writeFileSync(join(root, 'test-results/wordpress-results.json'), '{"result":"PASS"}');
  assert.equal(sourceDigest(root), independentlyHash({
    '.gitignore': 'test-results/\n', 'README.md': '[deleted]', 'extra.txt': 'Unicode 日本語 💡'
  }));
}));

test('Receipt fails closed for missing, stale, or incomplete local WordPress evidence', () => repoFixture(({ root, git }) => {
  assert.throws(() => verifyWordPressReceipt({ root }), /No readable WordPress acceptance result/);
  const path = join(root, 'test-results/wordpress-results.json');
  writeFileSync(path, JSON.stringify({ head: '0'.repeat(40), result: 'PASS' }));
  assert.throws(() => verifyWordPressReceipt({ root }), /Stale WordPress acceptance/);
  mkdirSync(join(root, 'tests/fixtures'), { recursive: true });
  writeFileSync(join(root, 'tests/fixtures/wordpress-roundtrip.json'), '{"cases":[],"mediaLibraryFixture":{}}');
  writeFileSync(path, JSON.stringify({ head: git(['rev-parse', 'HEAD']), result: 'PASS' }));
  assert.throws(() => verifyWordPressReceipt({ root }), /WordPress evidence/);
  writeFileSync(path, '{not-json');
  assert.throws(() => verifyWordPressReceipt({ root }), /No readable WordPress acceptance result/);
}));

test('The receipt check is an explicit manual script, never part of site build or automated Actions', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(pkg.scripts['verify:wordpress:receipt'], 'node scripts/verify-wordpress-receipt.mjs');
  const build = readFileSync(new URL('../scripts/build-site.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(build, /playground|wordpress_roundtrip|verify-wordpress-receipt/);
});
