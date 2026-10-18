import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { checkReleasePreflight } from '../scripts/release-preflight.mjs';

function fixture(testCase) {
  const dir = mkdtempSync(join(tmpdir(), 'drafttopage-preflight-'));
  try { writeFileSync(join(dir, 'package.json'), '{"name":"drafttopage"}');
    return testCase(dir);
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
function mockRuns({ dirty = false, chromium = true, head = 'a'.repeat(40) } = {}) {
  const calls = [];
  const run = (tool, args, options) => {
    calls.push({ tool, args });
    assert.equal(options.shell, false);
    if (tool === 'git' && args[0] === 'rev-parse') return { status: 0, stdout: head };
    if (tool === 'git' && args[0] === 'status') return { status: 0, stdout: dirty ? ' M scripts/source.js\n' : '' };
    if (tool === 'python3') return { status: chromium ? 0 : 1, stdout: chromium ? '130.0.0' : '' };
    return { status: 1 };
  };
  return { run, calls };
}
test('Complete preflight requires a configured local WordPress CLI without attempting installs', () => fixture(root => {
  const { run, calls } = mockRuns();
  const result = checkReleasePreflight({ root, run, env: {}, nodeVersion: '22.16.0', requireWordPress: true });
  assert.equal(result.result, 'BLOCKED');
  assert.equal(result.checks.at(-1).name, 'Local WordPress Playground CLI');
  assert.equal(result.checks.at(-1).result, 'BLOCKED');
  assert.equal(calls.filter(x => x.tool === 'python3').length, 1);
  assert.equal(calls.some(x => x.tool === 'npm' || x.tool === 'curl'), false);
}));
test('Browser-only preflight marks missing WordPress explicitly NOT_RUN', () => fixture(root => {
  const { run } = mockRuns();
  const result = checkReleasePreflight({ root, run, env: {}, nodeVersion: '24.1.0' });
  assert.equal(result.result, 'PASS');
  assert.equal(result.checks.at(-1).result, 'NOT_RUN');
}));
test('Configured strict local preflight verifies the already-installed file without copying it', () => fixture(root => {
  const cli = join(root, 'existing-cli.js');
  writeFileSync(cli, '/* fictional installed Playground entry point */');
  const { run } = mockRuns();
  const result = checkReleasePreflight({ root, run, env: { DRAFTTOPAGE_WORDPRESS_CLI: cli }, nodeVersion: '22.16.0', requireWordPress: true });
  assert.equal(result.result, 'PASS');
  assert.equal(result.checks.at(-1).result, 'PASS');
}));
test('Preflight fails closed for dirty worktrees, missing Git, absent Chromium and old Node', () => fixture(root => {
  for (const scenario of [
    { run: mockRuns({ dirty: true }).run, nodeVersion: '22.0.0' },
    { run: mockRuns({ head: 'not-a-commit' }).run, nodeVersion: '22.0.0' },
    { run: mockRuns({ chromium: false }).run, nodeVersion: '22.0.0' },
    { run: mockRuns().run, nodeVersion: '20.0.0' }
  ]) {
    const result = checkReleasePreflight({ root, env: {}, ...scenario });
    assert.equal(result.result, 'BLOCKED');
  }
}));
test('Preflight rejects foreign checkout and will not leak local writing content', () => fixture(root => {
  writeFileSync(join(root, 'package.json'), '{"name":"unrelated"}');
  const { run, calls } = mockRuns();
  const result = checkReleasePreflight({ root, run, env: {}, nodeVersion: '22.1.0' });
  assert.equal(result.result, 'BLOCKED');
  assert.equal(calls.some(x => x.tool === 'git'), false);
}));
