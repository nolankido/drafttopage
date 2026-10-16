import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

// A deliberately invoked local gate. It never installs tools, starts Actions,
// deploys, activates the pilot, or retries a failed check.
export function verifyRelease({ root = process.cwd(), run = spawnSync, env = process.env } = {}) {
  root = resolve(root);
  if (JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')).name !== 'drafttopage') throw new Error('Run from the Draft to Page repository.');
  const out = resolve(root, 'test-results');
  mkdirSync(out, { recursive: true });
  const resultFile = resolve(out, 'release-results.json'), browserFile = resolve(out, 'browser-results.json');
  // An old green report must never survive a failed or unavailable browser run.
  rmSync(browserFile, { force: true });
  const report = { result: 'RUNNING', startedAt: new Date().toISOString(), scope: 'local models, static checks, and routed browser fixtures', steps: [] };
  const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  const sourceDigest = () => {
    try {
      const paths = git(['ls-files', '-z', '--cached', '--others', '--exclude-standard']).split('\0').filter(Boolean).sort();
      const hash = createHash('sha256');
      for (const path of paths) {
        hash.update(path + '\0');
        try { hash.update(readFileSync(resolve(root, path))); } catch (error) { if (error.code !== 'ENOENT') throw error; hash.update('[deleted]'); }
        hash.update('\0');
      }
      return hash.digest('hex');
    } catch { return null; }
  };
  try { report.head = git(['rev-parse', 'HEAD']).trim(); } catch { report.head = null; }
  report.sourceSha256 = sourceDigest();
  const save = () => writeFileSync(resultFile, JSON.stringify(report, null, 2) + '\n');
  save();
  const tests = readdirSync(resolve(root, 'tests')).filter(name => name.endsWith('.test.js')).sort().map(name => 'tests/' + name);
  const steps = [
    ['build', process.execPath, ['scripts/build-site.mjs']],
    ['tests', process.execPath, ['--test', ...tests]],
    ['static', process.execPath, ['scripts/check.mjs']],
    ['browser', env.DRAFTTOPAGE_BROWSER_PYTHON || 'python3', ['scripts/browser-smoke.py']]
  ];
  try {
    if (!tests.length) throw new Error('No regression tests were found.');
    for (const [name, command, args] of steps) {
      const entry = { name, result: 'RUNNING' }; report.steps.push(entry); save();
      const outcome = run(command, args, { cwd: root, env, stdio: 'inherit', shell: false });
      if (outcome.error || outcome.status !== 0) {
        entry.result = 'FAIL'; entry.exitCode = outcome.status;
        throw new Error(name + ' failed' + (outcome.error ? ': ' + outcome.error.message : '.'));
      }
      if (name === 'browser') {
        const evidence = JSON.parse(readFileSync(browserFile, 'utf8'));
        if (evidence.result !== 'PASS' || evidence.scope !== 'full' || !Array.isArray(evidence.checks) || !evidence.checks.length ||
            !Array.isArray(evidence.errors) || evidence.errors.length || !Array.isArray(evidence.unexpected_requests) || evidence.unexpected_requests.length ||
            !evidence.layout || !Object.keys(evidence.layout).length || Object.values(evidence.layout).some(Boolean)) {
          entry.result = 'FAIL'; throw new Error('Browser evidence is incomplete or contains failures.');
        }
        report.browser = { scope: evidence.scope, checks: evidence.checks.length, layoutChecks: Object.keys(evidence.layout).length };
      }
      entry.result = 'PASS'; save();
    }
    if (report.sourceSha256) {
      const matches = report.sourceSha256 === sourceDigest();
      report.steps.push({ name: 'source snapshot', result: matches ? 'PASS' : 'FAIL' });
      if (!matches) throw new Error('Repository source changed during validation. Run the complete gate again against stable source.');
    }
    report.result = 'PASS';
  } catch (error) {
    const running = report.steps.find(step => step.result === 'RUNNING');
    if (running) running.result = 'FAIL';
    report.result = 'FAIL'; report.error = error.message;
  }
  report.completedAt = new Date().toISOString(); save();
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const report = verifyRelease();
  console.log('Local release validation: ' + report.result + '. See test-results/release-results.json.');
  if (report.result !== 'PASS') { console.error(report.error); process.exitCode = 1; }
}
