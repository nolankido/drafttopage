// Explicit, read-only local preflight for manual release qualification.
// No downloads, installs, deployments, prompts or external account requests.
import { readFileSync, statSync } from 'node:fs';
import { resolve, isAbsolute } from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const browserProbe = String.raw`
import os, shutil
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    binary = os.environ.get('CHROMIUM_EXECUTABLE') or shutil.which('chromium') or shutil.which('chromium-browser')
    options = {'headless': True, 'args': ['--no-sandbox', '--disable-dev-shm-usage']}
    if binary: options['executable_path'] = binary
    browser = p.chromium.launch(**options)
    print(browser.version)
    browser.close()
`;

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
  } else {
    add('Git commit', 'BLOCKED', 'No verified repository checkout.');
    add('Clean checkout', 'BLOCKED', 'No verified repository checkout.');
  }
  const python = command(env.DRAFTTOPAGE_BROWSER_PYTHON || 'python3', ['-c', browserProbe]);
  add('Playwright Chromium', python.ok ? 'PASS' : 'BLOCKED', python.ok ?
    'Chromium ' + python.stdout : 'Install Python Playwright and a launchable Chromium in the local environment; no browser was started successfully.');
  const cli = env.DRAFTTOPAGE_WORDPRESS_CLI;
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
