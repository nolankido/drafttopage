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
    execFileSync('git', ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--no-gpg-sign', '--quiet', '-m', 'Fixture baseline'], { cwd: root });
    writeFileSync(join(root, 'test-results', 'browser-results.json'), '{"result":"PASS"}');
    return run(root);
  } finally { rmSync(root, { recursive: true, force: true }); }
}
const goodEvidence = { result: 'PASS', scope: 'full', checks: ['fictional fixture'], errors: [], unexpected_requests: [], layout: { 'fixture-320': false } };

test('Strict local release fails closed before any build if WordPress CLI is absent', () => fixture(root => {
  let calls = 0;
  const result = verifyRelease({ root, env: {}, requireWordPress: true, run: () => { calls++; return {status:0}; } });
  assert.equal(result.result, 'FAIL');
  assert.equal(calls, 0);
  assert.deepEqual(result.steps, []);
  assert.equal(result.wordpress.result, 'NOT_RUN');
  assert.match(result.error, /requires DRAFTTOPAGE_WORDPRESS_CLI/);
  assert.equal(existsSync(join(root, 'test-results', 'browser-results.json')), false);
  const saved = JSON.parse(readFileSync(join(root, 'test-results', 'release-results.json'), 'utf8'));
  assert.equal(saved.result, 'FAIL');
  assert.equal(saved.scope.includes('required independent WordPress receipt'), true);
}));

test('Strict release rejects absent real WordPress evidence even when the child exits zero', () => fixture(root => {
  // This fixture deliberately lacks a complete WordPress receipt. We verify
  // that a missing or invalid WordPress acceptance cannot result in success.
  let calls = 0;
  const cli = join(root, 'test-results', 'existing-playground-cli.js');
  writeFileSync(cli, '// Fictional installed CLI fixture; never executed.\n');
  const env = { DRAFTTOPAGE_WORDPRESS_CLI: cli };
  const result = verifyRelease({ root, env, requireWordPress: true, run: () => {
    calls++;
    if (calls === 4) writeFileSync(join(root, 'test-results/browser-results.json'), JSON.stringify(goodEvidence));
    return { status: 0 };
  } });
  assert.equal(result.result, 'FAIL');
  assert.ok(calls >= 5);
  assert.match(result.error, /ENOENT|wordpress failed|WordPress evidence/i);
}));

test('WordPress-qualified release rejects invalid CLI paths before any test or build', () => fixture(root => {
  const invalid = ['relative/playground.js', root, join(root, 'missing-playground.js')];
  for (const cli of invalid) {
    let calls = 0;
    const result = verifyRelease({ root, env: { DRAFTTOPAGE_WORDPRESS_CLI: cli }, requireWordPress: true,
      run: () => { calls++; return { status: 0 }; } });
    assert.equal(result.result, 'FAIL');
    assert.equal(calls, 0);
    assert.deepEqual(result.steps, []);
    assert.match(result.error, /existing absolute local file/);
    assert.equal(existsSync(join(root, 'test-results/browser-results.json')), false);
  }
  // Legacy release with a CLI is also WordPress-qualified and must reject an invalid path.
  let legacyCalls = 0;
  const legacy = verifyRelease({ root, env: { DRAFTTOPAGE_WORDPRESS_CLI: 'relative/playground.js' },
    run: () => { legacyCalls++; return { status: 0 }; } });
  assert.equal(legacy.result, 'FAIL'); assert.equal(legacyCalls, 0);
}));

test('Dirty worktrees cannot produce a release receipt, including tracked, staged and untracked files', () => {
  for (const prepare of [
    root => writeFileSync(join(root, 'tests/fixture.test.js'), '// modified source\n'),
    root => { writeFileSync(join(root, 'tests/fixture.test.js'), '// staged edit\n'); execFileSync('git', ['add', 'tests/fixture.test.js'], {cwd:root}); },
    root => writeFileSync(join(root, 'UNTRACKED_SOURCE.md'), 'unsaved article source\n')
  ]) fixture(root => {
    prepare(root);
    let calls = 0;
    const result = verifyRelease({ root, env: {}, run: () => { calls++; return {status:0}; } });
    assert.equal(result.result, 'FAIL'); assert.equal(calls, 0);
    assert.deepEqual(result.steps, []);
    assert.match(result.error, /requires a clean Git checkout/);
    const saved = JSON.parse(readFileSync(join(root, 'test-results', 'release-results.json'), 'utf8'));
    assert.equal(saved.result, 'FAIL');
    assert.equal(existsSync(join(root, 'test-results/browser-results.json')), false);
  });
});

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

test('Git assume-unchanged and skip-worktree flags cannot hide changed source from the release gate', () => {
  for (const flag of ['--assume-unchanged', '--skip-worktree']) fixture(root => {
    execFileSync('git', ['update-index', flag, 'tests/fixture.test.js'], { cwd: root });
    writeFileSync(join(root, 'tests/fixture.test.js'), '// Tracked source was changed, but Git status may hide it.\n');
    const expectedFlag = flag === '--assume-unchanged' ? 'h ' : 'S ';
    const index = execFileSync('git', ['ls-files', '-v', '-z'], {cwd:root, encoding:'utf8'});
    assert.ok(index.includes(expectedFlag + 'tests/fixture.test.js'));
    let calls = 0;
    const result = verifyRelease({ root, env: {}, run: () => { calls++; return {status:0}; } });
    assert.equal(result.result, 'FAIL');
    assert.equal(calls, 0);
    assert.deepEqual(result.steps, []);
    assert.match(result.error, /assume-unchanged and skip-worktree/);
    assert.equal(existsSync(join(root, 'test-results/browser-results.json')), false);
  });
});

test('Untracked source created during validation invalidates the same running receipt', () => fixture(root => {
  let calls = 0;
  const result = verifyRelease({ root, env: {}, run: () => {
    if (++calls === 4) {
      writeFileSync(join(root, 'test-results/browser-results.json'), JSON.stringify(goodEvidence));
      writeFileSync(join(root, 'UNTRACKED_AFTER_START.md'), 'new source added during validation\n');
    }
    return { status: 0 };
  } });
  assert.equal(result.result, 'FAIL');
  assert.equal(result.steps.at(-1).name, 'source snapshot');
  assert.match(result.error, /commit or source changed during validation/);
}));

test('Moving Git HEAD during validation invalidates an otherwise green source digest', () => fixture(root => {
  let calls = 0;
  const result = verifyRelease({ root, env: {}, run: () => {
    if (++calls === 4) {
      writeFileSync(join(root, 'test-results', 'browser-results.json'), JSON.stringify(goodEvidence));
      execFileSync('git', ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid',
        'commit', '--no-gpg-sign', '--allow-empty', '--quiet', '-m', 'Commit moved while checking'], { cwd: root });
    }
    return { status: 0 };
  } });
  assert.equal(result.result, 'FAIL');
  assert.match(result.error, /commit or source changed during validation/);
  assert.equal(result.steps.at(-1).name, 'source snapshot');
}));
