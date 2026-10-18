// Temporary, diagnostic-only Cloudflare preview probe. Never merge into main.
// Captures only synthetic public test names and bounded statistics; no raw logs.
import { readdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';

const files = readdirSync('tests').filter(name => name.endsWith('.test.js')).sort().map(name => 'tests/' + name);
const started = performance.now();
let run;
try {
  run = spawnSync(process.execPath,
    ['--test', '--test-reporter=tap', '--test-concurrency=4', ...files],
    { shell: false, encoding: 'utf8', maxBuffer: 48 * 1024 * 1024, timeout: 480000, env: process.env });
} catch {
  run = { status: null, stdout: '', stderr: '', error: new Error('runner unavailable') };
}
const output = String(run.stdout || '');
const stderr = String(run.stderr || '');
const metric = name => {
  const matches = [...output.matchAll(new RegExp('^# ' + name + '\\s+(\\d+)\\s*$', 'gm'))];
  return matches.length ? Number(matches.at(-1)[1]) : null;
};
const failedTestNames = [...output.matchAll(/^not ok \d+ - ([^\r\n]+)$/gm)]
  .map(item => item[1].replace(/[^a-zA-Z0-9 _.,\/()'":-]/g, '').slice(0, 100))
  .slice(0, 35);
const safeLines = value => value.split(/\r?\n/)
  .filter(line => /^(?:TAP version|# (?:tests|pass|fail|cancelled|duration_ms)|not ok |Error:|node:|Could not|Unknown option)/.test(line))
  .slice(0, 18)
  .map(line => line.replace(/[a-zA-Z0-9_./=-]{28,}/g, '[redacted]').slice(0, 125));
const categories = {
  missingModule: /MODULE_NOT_FOUND|ERR_MODULE_NOT_FOUND|Cannot find module/.test(output + stderr),
  missingPython: /python3.*ENOENT|python3.*not found/i.test(output + stderr),
  missingPlaywright: /No module named.*playwright|Cannot find.*playwright/i.test(output + stderr),
  killed: /SIGKILL|SIGTERM|process.*killed/i.test(output + stderr),
  testFailure: /ERR_TEST_FAILURE|test failed/.test(output + stderr)
};
const failureDetails=[];
let current=null;
for(const line of output.split(/\r?\n/)){
  if(/^not ok \d+ - /.test(line)){
    current={name:line.slice(line.indexOf(' - ')+3).replace(/[^a-zA-Z0-9 _.,()'":/-]/g,'').slice(0,95)};
    failureDetails.push(current);
  } else if(current){
    const match=/^  (error|code|location|actual|expected|operator|failureType):\s*(.*)$/.exec(line);
    if(match){
      const key=match[1];
      let value=match[2].replace(/[^a-zA-Z0-9 _.,()'":\/-]/g,'').slice(0,150);
      if(key==='location'){
        const found=value.match(/([A-Za-z0-9._-]+\.test\.js):(\d+)/);
        value=found?found[0]:'test-location';
      }
      current[key]=value;
    }
    if(/^\s{2}\.\.\.\s*$/.test(line))current=null;
  }
}
const evidence = {
  format: 'drafttopage-temporary-node-probe',
  version: 2,
  scope: 'Feature-preview synthetic Node regression; not a public release gate or browser/WordPress acceptance',
  testFileCount: files.length,
  nodeVersion: process.version,
  result: run.status === 0 && !run.error ? 'PASS' : 'FAIL',
  exitCode: run.status ?? null,
  errorClass: run.error ? run.error.code === 'ETIMEDOUT' ? 'TIMEOUT' : 'RUNNER_ERROR' : null,
  testCount: metric('tests'),
  passed: metric('pass'),
  failed: metric('fail'),
  cancelled: metric('cancelled'),
  skipped: metric('skipped'),
  durationSeconds: Math.round((performance.now() - started) / 1000),
  stdoutBytes: output.length,
  stderrBytes: stderr.length,
  failedTestNames,
  failureDetails:failureDetails.slice(0,30),
  categories,
  sanitizedLines: [...safeLines(output), ...safeLines(stderr)].slice(0, 25),
  stdoutSha256: createHash('sha256').update(output).digest('hex')
};
writeFileSync('public/turn14-node-probe.json', JSON.stringify(evidence, null, 2) + '\n');
// Intentionally do not fail the preview build. The result field is authoritative.
console.log('Temporary Node test probe:', evidence.result, evidence.testCount, 'cases,', evidence.failed, 'failed');
