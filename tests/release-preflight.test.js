import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { checkReleasePreflight, parseBrowserProbe } from '../scripts/release-preflight.mjs';

function browserReport({ loopback = false, blocked = null, code = 'BROWSER_POLICY_BLOCK' } = {}) {
  const notRun = () => ({ result: 'NOT_RUN', code: 'NOT_RUN' });
  const pagePass = () => ({ result: 'PASS', code: 'OK', moduleExecuted: true, secureContext: true, requestsMatched: true });
  const data = {
    format: 'drafttopage-browser-preflight', version: 1, result: blocked ? 'BLOCKED' : 'PASS',
    browserVersion: blocked === 'launch' ? null : '144.0.0',
    checks: {
      launch: { result: 'PASS', code: 'OK' }, routedPage: pagePass(),
      loopbackPage: loopback ? pagePass() : notRun()
    }
  };
  if (blocked) {
    data.checks[blocked] = { result: 'BLOCKED', code };
    if (blocked === 'launch') data.checks.routedPage = notRun();
    if (blocked !== 'loopbackPage') data.checks.loopbackPage = notRun();
  }
  return { status: blocked ? 1 : 0, stdout: JSON.stringify(data) };
}

function fixture(testCase) {
  const dir = mkdtempSync(join(tmpdir(), 'drafttopage-preflight-'));
  try { writeFileSync(join(dir, 'package.json'), '{"name":"drafttopage"}');
    return testCase(dir);
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
function mockRuns({ dirty = false, chromium = true, head = 'a'.repeat(40), indexFlag = 'H' } = {}) {
  const calls = [];
  const run = (tool, args, options) => {
    calls.push({ tool, args });
    assert.equal(options.shell, false);
    if (tool === 'git' && args[0] === 'rev-parse') return { status: 0, stdout: head };
    if (tool === 'git' && args[0] === 'status') return { status: 0, stdout: dirty ? ' M scripts/source.js\n' : '' };
    if (tool === 'git' && args[0] === 'ls-files') return { status: 0, stdout: indexFlag + ' tests/fixture.test.js\0' };
    if (tool === 'python3') {
      assert.match(args[0], /[\\/]scripts[\\/]browser-preflight\.py$/);
      assert.equal(options.timeout, 30000);
      assert.equal(options.maxBuffer, 16384);
      return browserReport({ loopback: args.includes('--loopback'), blocked: chromium ? null : 'launch', code: 'CHROMIUM_LAUNCH_FAILED' });
    }
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
test('Preflight blocks assume-unchanged and skip-worktree flags even if ordinary Git status is clean', () => fixture(root => {
  for (const indexFlag of ['h', 'S', 's']) {
    const result = checkReleasePreflight({
      root, run: mockRuns({ indexFlag }).run, env: {}, nodeVersion: '22.16.0'
    });
    assert.equal(result.result, 'BLOCKED');
    assert.equal(result.checks.find(check => check.name === 'Clean checkout')?.result, 'PASS');
    assert.equal(result.checks.find(check => check.name === 'Complete Git index')?.result, 'BLOCKED');
  }
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

test('Launch-only evidence is not sufficient browser capability proof', () => fixture(root => {
  const calls = mockRuns();
  const result = checkReleasePreflight({
    root, env: {}, nodeVersion: '22.16.0',
    run: (tool, args, options) => tool === 'python3'
      ? { status: 0, stdout: '144.0.7559.96', stderr: 'PRIVATE_MACHINE_PATH' }
      : calls.run(tool, args, options)
  });
  assert.equal(result.result, 'BLOCKED');
  assert.equal(result.checks.find(x => x.name === 'Playwright Chromium').result, 'BLOCKED');
  assert.equal(result.checks.find(x => x.name === 'Routed browser navigation').result, 'NOT_RUN');
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE_MACHINE_PATH/);
}));

test('A real policy-block report keeps launch success separate from blocked navigation', () => fixture(root => {
  const calls = mockRuns();
  const result = checkReleasePreflight({
    root, env: {}, nodeVersion: '22.16.0',
    run: (tool, args, options) => tool === 'python3'
      ? { ...browserReport({ blocked: 'routedPage' }), stderr: 'SECRET_LOCAL_PATH' }
      : calls.run(tool, args, options)
  });
  assert.equal(result.result, 'BLOCKED');
  assert.equal(result.checks.find(x => x.name === 'Playwright Chromium').result, 'PASS');
  const navigation = result.checks.find(x => x.name === 'Routed browser navigation');
  assert.equal(navigation.result, 'BLOCKED');
  assert.match(navigation.detail, /Browser policy blocks/);
  assert.match(navigation.detail, /do not disable administrator policy/);
  assert.doesNotMatch(JSON.stringify(result), /SECRET_LOCAL_PATH|Install Python/);
}));

test('Configured WordPress also requires loopback browser capability', () => fixture(root => {
  const calls = mockRuns();
  const result = checkReleasePreflight({
    root, env: { DRAFTTOPAGE_WORDPRESS_CLI: '/existing/cli.js' }, exists: () => true,
    nodeVersion: '22.16.0',
    run: (tool, args, options) => {
      if (tool !== 'python3') return calls.run(tool, args, options);
      assert.ok(args.includes('--loopback'));
      return browserReport({ loopback: true, blocked: 'loopbackPage' });
    }
  });
  assert.equal(result.result, 'BLOCKED');
  assert.equal(result.checks.find(x => x.name === 'Routed browser navigation').result, 'PASS');
  assert.equal(result.checks.find(x => x.name === 'Local WordPress browser navigation').result, 'BLOCKED');
  assert.equal(result.checks.at(-1).result, 'PASS', 'An existing CLI must not hide blocked local HTTP');
}));

test('Probe output accepts only consistent navigation evidence and matching exit status', () => {
  assert.equal(parseBrowserProbe(browserReport()).result, 'PASS');
  assert.equal(parseBrowserProbe(browserReport({ loopback: true }), true).result, 'PASS');
  assert.equal(parseBrowserProbe(browserReport({ blocked: 'launch', code: 'PLAYWRIGHT_UNAVAILABLE' })).result, 'BLOCKED');
  assert.equal(parseBrowserProbe(browserReport({ blocked: 'routedPage' })).result, 'BLOCKED');
  assert.equal(parseBrowserProbe(browserReport({ loopback: true, blocked: 'loopbackPage' }), true).result, 'BLOCKED');
  assert.equal(parseBrowserProbe(browserReport(), true), null);
  assert.equal(parseBrowserProbe(browserReport({ loopback: true }), false), null);
  for (const mutation of [
    x => { x.format = 'other'; },
    x => { x.version = 99; },
    x => { x.result = 'BLOCKED'; },
    x => { x.browserVersion = 'private path with arbitrary text'; },
    x => { delete x.checks.routedPage; },
    x => { x.checks.routedPage.moduleExecuted = false; },
    x => { x.checks.routedPage.secureContext = false; },
    x => { x.checks.routedPage.requestsMatched = false; },
    x => { x.checks.routedPage.code = 'NOT_RUN'; },
    x => { x.checks.launch.result = 'NOT_RUN'; x.checks.launch.code = 'NOT_RUN'; },
    x => { x.checks.extra = {}; }
  ]) {
    const response = browserReport();
    const data = JSON.parse(response.stdout);
    mutation(data); response.stdout = JSON.stringify(data);
    assert.equal(parseBrowserProbe(response), null);
  }
  for (const response of [
    { ...browserReport(), status: 1 },
    { ...browserReport({ blocked: 'routedPage' }), status: 0 },
    { ...browserReport(), error: new Error('PRIVATE ERROR') },
    { ...browserReport(), signal: 'SIGTERM' },
    { status: 0, stdout: 'not json' },
    { status: 0, stdout: ' '.repeat(16385) },
    { status: 0, stdout: '{}' },
    null
  ]) assert.equal(parseBrowserProbe(response), null);
});

test('Unknown and injected failure messages never become preflight details', () => fixture(root => {
  const run = (tool, args, options) => {
    if (tool === 'python3') {
      const response = browserReport({ blocked: 'routedPage', code: 'SECRET_PROVIDER_CREDENTIAL' });
      return response;
    }
    return mockRuns().run(tool, args, options);
  };
  const result = checkReleasePreflight({ root, run, env: {}, nodeVersion: '22.16.0' });
  assert.equal(result.result, 'BLOCKED');
  assert.doesNotMatch(JSON.stringify(result), /SECRET_PROVIDER_CREDENTIAL/);
}));

test('Python diagnostic keeps fixed local resources and redacts failure details without launching a browser', () => {
  const source = fileURLToPath(new URL('../scripts/browser-preflight.py', import.meta.url));
  const output = execFileSync('python3', ['-c', String.raw`
import ast,json,runpy,sys
from pathlib import Path
source=Path(sys.argv[1])
ast.parse(source.read_text(encoding='utf-8'))
module=runpy.run_path(str(source),run_name='browser_preflight_unit')
class TimeoutError(Exception):pass
classify=module['failure_code']
assert classify(Exception('SECRET net::ERR_BLOCKED_BY_ADMINISTRATOR'),'routedPage')=='BROWSER_POLICY_BLOCK'
assert classify(TimeoutError('SECRET'),'routedPage')=='BROWSER_TIMEOUT'
assert classify(ImportError('SECRET'),'launch')=='PLAYWRIGHT_UNAVAILABLE'
assert classify(Exception('SECRET'),'launch')=='CHROMIUM_LAUNCH_FAILED'
assert classify(Exception('SECRET'),'routedPage')=='BROWSER_PROBE_FAILED'
for path in ['/','/../secret','/__preflight__/probe.js?token=SECRET','https://example.com/']:
 assert module['payload'](path) is None
assert module['payload'](module['PAGE_PATH'])[0].startswith('text/html')
assert module['payload'](module['MODULE_PATH'])[0].startswith('text/javascript')
assert b'type="module"' in module['HTML']
assert b'export const marker' in module['MODULE']
assert module['step']()=={'result':'NOT_RUN','code':'NOT_RUN'}
print(json.dumps({'syntax':'PASS','redaction':'PASS','resources':'PASS','browserStarted':False}))
`, source], { encoding: 'utf8', timeout: 10000, maxBuffer: 16384 });
  assert.deepEqual(JSON.parse(output), {
    syntax: 'PASS', redaction: 'PASS', resources: 'PASS', browserStarted: false
  });
});
