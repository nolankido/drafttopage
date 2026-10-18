import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { verifyRelease } from '../scripts/verify-release.mjs';

function fixture(run) {
  const root = mkdtempSync(join(tmpdir(), 'drafttopage-release-'));
  try {
    mkdirSync(join(root, 'tests')); mkdirSync(join(root, 'test-results'));
    writeFileSync(join(root, 'package.json'), '{"name":"drafttopage"}');
    writeFileSync(join(root, 'tests', 'fixture.test.js'), '');
    writeFileSync(join(root, '.gitignore'), 'test-results/\n');
    execFileSync('git', ['init', '--quiet'], { cwd: root });
    execFileSync('git', ['add', '.gitignore', 'package.json', 'tests'], { cwd: root });
    execFileSync('git', ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--quiet', '-m', 'Fixture baseline'], { cwd: root });
    writeFileSync(join(root, 'test-results', 'browser-results.json'), '{"result":"PASS"}');
    return run(root);
  } finally { rmSync(root, { recursive: true, force: true }); }
}
const goodEvidence = { result: 'PASS', scope: 'full', checks: ['fictional fixture'], errors: [], unexpected_requests: [], layout: { 'fixture-320': false } };

test('The manual release gate rejects stale browser evidence and stops after a failed model check', () => fixture(root => {
  const calls = [];
  const result = verifyRelease({ root, env: {}, run: (command, args) => {
    calls.push(args); assert.equal(existsSync(join(root, 'test-results', 'browser-results.json')), false);
    return { status: calls.length === 2 ? 1 : 0 };
  } });
  assert.equal(result.result, 'FAIL'); assert.equal(calls.length, 2);
  assert.deepEqual(result.steps.map(step => step.result), ['PASS', 'FAIL']);
  assert.equal(JSON.parse(readFileSync(join(root, 'test-results', 'release-results.json'))).result, 'FAIL');
}));

test('An unavailable browser command or absent, partial, overflowing or erroneous evidence cannot pass', () => {
  for (const evidence of [null, { ...goodEvidence, scope: 'desk-only' }, { ...goodEvidence, checks: [] }, { ...goodEvidence, layout: {} }, { ...goodEvidence, layout: { narrow: true } }, { ...goodEvidence, errors: ['fixture error'] }, { ...goodEvidence, unexpected_requests: ['https://example.invalid/'] }]) fixture(root => {
    let calls = 0;
    const result = verifyRelease({ root, env: {}, run: () => { if (++calls === 4 && evidence) writeFileSync(join(root, 'test-results', 'browser-results.json'), JSON.stringify(evidence)); return { status: 0 }; } });
    assert.equal(result.result, 'FAIL'); assert.equal(result.steps[3].result, 'FAIL');
  });
  fixture(root => {
    let calls = 0;
    const result = verifyRelease({ root, env: {}, run: () => ++calls === 4 ? { status: null, error: new Error('Browser tools unavailable') } : { status: 0 } });
    assert.equal(result.result, 'FAIL'); assert.match(result.error, /Browser tools unavailable/);
  });
});

test('Fresh complete browser evidence passes after all commands and a supplied Python path remains one argument', () => fixture(root => {
  const calls = [], python = '/a path with spaces/python';
  const result = verifyRelease({ root, env: { DRAFTTOPAGE_BROWSER_PYTHON: python }, run: (command, args, options) => {
    calls.push({ command, args }); assert.equal(options.shell, false);
    if (calls.length === 4) writeFileSync(join(root, 'test-results', 'browser-results.json'), JSON.stringify(goodEvidence));
    return { status: 0 };
  } });
  assert.equal(result.result, 'PASS'); assert.equal(calls[3].command, python);
  assert.deepEqual(calls[3].args, ['scripts/browser-smoke.py']);
  assert.deepEqual(result.browser, { scope: 'full', checks: 1, layoutChecks: 1 });
}));


test('Source changes during a run invalidate otherwise complete passing evidence', () => fixture(root => {
  let calls = 0;
  const result = verifyRelease({ root, env: {}, run: () => {
    if (++calls === 4) {
      writeFileSync(join(root, 'test-results', 'browser-results.json'), JSON.stringify(goodEvidence));
      writeFileSync(join(root, 'tests', 'fixture.test.js'), '// Changed during validation\n');
    }
    return { status: 0 };
  } });
  assert.equal(result.result, 'FAIL'); assert.match(result.error, /commit or source changed during validation/);
  assert.equal(result.steps.at(-1).name, 'source snapshot'); assert.equal(result.steps.at(-1).result, 'FAIL');
}));

test('A checkout without Git metadata cannot produce a green release receipt', () => fixture(root => {
  rmSync(join(root, '.git'), { recursive: true, force: true });
  let called = 0;
  const result = verifyRelease({ root, env: {}, run: () => { called++; return { status: 0 }; } });
  assert.equal(result.result, 'FAIL');
  assert.equal(called, 0);
  assert.match(result.error, /requires a Git commit and a complete source fingerprint/);
  assert.equal(existsSync(join(root, 'test-results', 'browser-results.json')), false);
  assert.equal(JSON.parse(readFileSync(join(root, 'test-results', 'release-results.json'))).result, 'FAIL');
}));

test('Moving Git HEAD during validation invalidates an otherwise green source digest', () => fixture(root => {
  let calls = 0;
  const result = verifyRelease({ root, env: {}, run: () => {
    if (++calls === 4) {
      writeFileSync(join(root, 'test-results', 'browser-results.json'), JSON.stringify(goodEvidence));
      execFileSync('git', ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid',
        'commit', '--allow-empty', '--quiet', '-m', 'Commit moved while checking'], { cwd: root });
    }
    return { status: 0 };
  } });
  assert.equal(result.result, 'FAIL');
  assert.match(result.error, /commit or source changed during validation/);
  assert.equal(result.steps.at(-1).name, 'source snapshot');
}));
