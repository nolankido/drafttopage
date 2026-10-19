// Explicit, read-only local preflight for manual release qualification.
// No downloads, installs, deployments, prompts or external account requests.
import { readFileSync, statSync } from 'node:fs';
import { resolve, isAbsolute } from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';

const probePath = fileURLToPath(new URL('./browser-preflight.py', import.meta.url));
const PROBE_CODES = new Set([
  'BROWSER_POLICY_BLOCK', 'BROWSER_TIMEOUT', 'PLAYWRIGHT_UNAVAILABLE',
  'CHROMIUM_LAUNCH_FAILED', 'BROWSER_PROBE_FAILED'
]);

// A version string is launch evidence only. Require the structured proof from
// actual navigation/module execution, with a matching process exit status.
export function parseBrowserProbe(response, requireLoopback = false) {
  try {
    if (!response || response.error || response.signal ||
        ![0, 1].includes(response.status) || typeof response.stdout !== 'string' ||
        response.stdout.length > 16384) return null;
    const data = JSON.parse(response.stdout);
    if (data?.format !== 'drafttopage-browser-preflight' || data.version !== 1 ||
        !['PASS', 'BLOCKED'].includes(data.result) || !data.checks ||
        Object.keys(data.checks).sort().join(',') !== 'launch,loopbackPage,routedPage') return null;
    const { launch, routedPage, loopbackPage } = data.checks;
    for (const [name, step] of Object.entries(data.checks)) {
      if (!step || !['PASS', 'BLOCKED', 'NOT_RUN'].includes(step.result)) return null;
      if (step.result === 'PASS' && (step.code !== 'OK' ||
          name !== 'launch' && (step.moduleExecuted !== true ||
            step.secureContext !== true || step.requestsMatched !== true))) return null;
      if (step.result === 'BLOCKED' && !PROBE_CODES.has(step.code)) return null;
      if (step.result === 'NOT_RUN' && step.code !== 'NOT_RUN') return null;
    }
    if (launch.result === 'NOT_RUN') return null;
    if (launch.result === 'PASS') {
      if (typeof data.browserVersion !== 'string' ||
          !/^[0-9]{1,4}(?:\.[0-9]{1,10}){1,4}$/.test(data.browserVersion) ||
          routedPage.result === 'NOT_RUN') return null;
    } else if (data.browserVersion !== null || routedPage.result !== 'NOT_RUN' ||
               loopbackPage.result !== 'NOT_RUN') return null;
    if (!requireLoopback && loopbackPage.result !== 'NOT_RUN') return null;
    if (routedPage.result !== 'PASS' && loopbackPage.result !== 'NOT_RUN') return null;
    if (requireLoopback && routedPage.result === 'PASS' && loopbackPage.result === 'NOT_RUN') return null;
    const passed = launch.result === 'PASS' && routedPage.result === 'PASS' &&
      (!requireLoopback || loopbackPage.result === 'PASS');
    if (data.result !== (passed ? 'PASS' : 'BLOCKED') || response.status !== (passed ? 0 : 1)) return null;
    return data;
  } catch { return null; }
}

function browserDetail(step, stage, version) {
  if (!step) return 'No usable browser capability report. Page navigation and application acceptance are unverified.';
  if (step.result === 'PASS') return stage === 'launch'
    ? 'Chromium ' + version + ' started. Navigation is checked separately.'
    : stage === 'routedPage'
      ? 'Synthetic routed HTTPS page and ES module executed. This is not an application journey.'
      : 'Ephemeral localhost page and ES module executed. WordPress itself was not started.';
  if (step.result === 'NOT_RUN') return 'Not attempted; no successful navigation is claimed.';
  if (step.code === 'BROWSER_POLICY_BLOCK')
    return 'Browser policy blocks page navigation. Use an environment where local browser tests are permitted; do not disable administrator policy. Application acceptance was not run.';
  if (step.code === 'PLAYWRIGHT_UNAVAILABLE')
    return 'Python Playwright is unavailable. No browser test ran and no software was installed.';
  if (step.code === 'CHROMIUM_LAUNCH_FAILED')
    return 'Chromium could not start. Configure an already-installed browser and rerun preflight.';
  if (step.code === 'BROWSER_TIMEOUT')
    return 'The bounded browser probe timed out. No successful navigation is certified.';
  return 'Browser capability check failed. Application and WordPress acceptance remain unverified.';
}


export function checkReleasePreflight({
  root = process.cwd(), env = process.env, run = spawnSync,
  nodeVersion = process.versions.node, exists = path => {
    try { return statSync(path).isFile(); } catch { return false; }
  }, requireWordPress = false
} = {}) {
  root = resolve(root);
  const checks = [];
  const add = (name, result, detail) => checks.push({ name, result, detail });
  let project = false;
  try { project = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')).name === 'drafttopage'; }
  catch { /* This is a fail-closed, read-only diagnostic. */ }
  add('repository', project ? 'PASS' : 'BLOCKED', project ? 'Draft to Page source.' : 'Open a Draft to Page repository checkout, not the live website or an archive.');
  const major = Number(nodeVersion.split('.')[0]);
  add('Node.js', major >= 22 ? 'PASS' : 'BLOCKED', major >= 22 ? 'Node ' + nodeVersion : 'Install Node 22 or newer before checking a release.');
  const command = (tool, args) => {
    try { const response = run(tool, args, { cwd: root, env, encoding: 'utf8', shell: false, timeout: 30000 });
      return response && response.status === 0 ? { ok: true, stdout: String(response.stdout || '').trim() } : { ok: false };
    } catch { return { ok: false }; }
  };
  if (project) {
    const head = command('git', ['rev-parse', 'HEAD']);
    const validHead = head.ok && /^[a-f0-9]{40}$/.test(head.stdout);
    add('Git commit', validHead ? 'PASS' : 'BLOCKED', validHead ? head.stdout : 'Release qualification needs a real local Git commit.');
    const dirty = command('git', ['status', '--porcelain', '--untracked-files=normal']);
    add('Clean checkout', dirty.ok && dirty.stdout === '' ? 'PASS' : 'BLOCKED',
      dirty.ok ? dirty.stdout === '' ? 'Tracked and untracked source files are clean.' : 'Commit or discard source changes before qualification.' : 'Cannot inspect local Git status.');
    const index = command('git', ['ls-files', '-v', '-z']);
    const completeIndex = index.ok && !index.stdout.split('\0').some(entry => /^[hSs] /.test(entry));
    add('Complete Git index', completeIndex ? 'PASS' : 'BLOCKED', completeIndex ?
      'No assume-unchanged or skip-worktree flags hide tracked source.' :
      'Remove assume-unchanged or skip-worktree flags, or use a fresh complete checkout.');
  } else {
    add('Git commit', 'BLOCKED', 'No verified repository checkout.');
    add('Clean checkout', 'BLOCKED', 'No verified repository checkout.');
    add('Complete Git index', 'BLOCKED', 'No verified repository checkout.');
  }
  const cli = env.DRAFTTOPAGE_WORDPRESS_CLI;
  const requireLoopback = requireWordPress || Boolean(cli);
  let browser = null;
  try {
    // Resolve the trusted probe beside this script, never a foreign root's file.
    const response = run(env.DRAFTTOPAGE_BROWSER_PYTHON || 'python3',
      [probePath, ...(requireLoopback ? ['--loopback'] : [])],
      { cwd: root, env, encoding: 'utf8', shell: false, timeout: 30000, maxBuffer: 16384 });
    browser = parseBrowserProbe(response, requireLoopback);
  } catch { /* Never print raw provider errors, machine paths or stderr. */ }
  const stages = [
    ['Playwright Chromium', 'launch'],
    ['Routed browser navigation', 'routedPage'],
    ['Local WordPress browser navigation', 'loopbackPage']
  ];
  for (const [name, stage] of stages) {
    const check = browser?.checks[stage];
    add(name, check?.result || (stage === 'launch' ? 'BLOCKED' : 'NOT_RUN'),
      browserDetail(check, stage, browser?.browserVersion));
  }
  const validCli = typeof cli === 'string' && isAbsolute(cli) && exists(cli);
  add('Local WordPress Playground CLI', validCli ? 'PASS' : requireWordPress ? 'BLOCKED' : 'NOT_RUN',
    validCli ? 'Configured at an existing absolute local path.' : requireWordPress ?
    'Set DRAFTTOPAGE_WORDPRESS_CLI to an installed Playground CLI file using an absolute path.' :
    'Optional for browser-only development checks; required for a full release.');
  const blocked = checks.some(check => check.result === 'BLOCKED');
  return { result: blocked ? 'BLOCKED' : 'PASS', scope: requireWordPress ? 'full WordPress qualification' : 'browser development qualification', checks };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const result = checkReleasePreflight({ requireWordPress: process.argv.includes('--require-wordpress') });
  for (const check of result.checks) console.log(check.result.padEnd(8) + ' ' + check.name + ': ' + check.detail);
  console.log('Local release preflight: ' + result.result);
  if (result.result !== 'PASS') process.exitCode = 1;
}
