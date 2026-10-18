// Temporary preview-only validation probe. Never merge while this probe
// replaces a fail-closed build gate. Publishes no raw test output or test data.
import { readdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
const files=readdirSync('tests').filter(s=>s.endsWith('.test.js')).sort().map(s=>'tests/'+s);
const start=performance.now();
let result;
try {
  result=spawnSync(process.execPath,['--test','--test-reporter=tap','--test-concurrency=4',...files],{
    shell:false,encoding:'utf8',maxBuffer:48*1024*1024,
    timeout:480000,env:process.env
  });
}catch{ result={status:null,stdout:'',stderr:'',error:new Error('runner unavailable')}; }
const output=String(result.stdout||'');
const err=String(result.stderr||'');
const marker=n=>{const m=output.match(new RegExp('^# '+n+' (\\d+)\\s*);return m?Number(m[1]):null;};
const failedNames=[...output.matchAll(/^not ok \d+ - ([^\r\n]+)$/gm)]
  .map(x=>x[1].replace(/[^a-zA-Z0-9 _.,\/()'":-]/g,'').slice(0,100))
  .slice(0,35);
const errorClass=result.error ? result.error.code === 'ETIMEDOUT' ? 'TIMEOUT' : 'RUNNER_ERROR' : null;
const categoryFlags=Object.fromEntries([
  ['module_missing',/MODULE_NOT_FOUND|ERR_MODULE_NOT_FOUND|Cannot find module/.test(output+err)],
  ['python_missing',/python3.*ENOENT|python3.*not found/i.test(output+err)],
  ['playwright_missing',/No module named.*playwright|Cannot find.*playwright/i.test(output+err)],
  ['signal_failure',/SIGKILL|SIGTERM|process.*killed/i.test(output+err)],
  ['node_runner_error',/ERR_TEST_FAILURE|test failed/.test(output+err)]
]);
const safeSample=value=>value.split(/\r?\n/).filter(line=>
   /^(?:TAP version|# (?:tests|pass|fail|cancelled|duration_ms)|not ok |Error:|node:|Could not|Unknown option)/.test(line))
  .slice(0,18).map(line=>line.replace(/[a-zA-Z0-9_./=-]{28,}/g,'[redacted]').slice(0,125));
const summary={
  format:'drafttopage-preview-node-probe',version:1,
  scope:'Feature preview synthetic Node regression suite; not production or full browser/WordPress acceptance',
  testFileCount:files.length,nodeVersion:process.version,
  status:result.status===0&&!result.error?'PASS':'FAIL',
  runnerExitCode:result.status??null,runnerErrorClass:errorClass,
  testCount:marker('tests'),passed:marker('pass'),failed:marker('fail'),
  cancelled:marker('cancelled'),skipped:marker('skipped'),
  durationSeconds:Math.round((performance.now()-start)/1000),
  failedTestNames:failedNames,
  stderrBytes:err.length, stdoutBytes:output.length,
  categoryFlags, diagnosticLines:safeSample(output).concat(safeSample(err)).slice(0,25),
  stdoutHash:createHash('sha256').update(output).digest('hex')
};
writeFileSync('public/turn14-node-probe.json',JSON.stringify(summary,null,2)+'\n');
// Probe is intentionally diagnostic-only: fail details would otherwise block
// preview publication. Its report, not the Cloudflare check, is authoritative.
console.log('Turn 14 diagnostic suite completed:',summary.status,summary.testCount,'tests,',summary.failed,'failed');
,'m'));return m?Number(m[1]):null;};
const failedNames=[...output.matchAll(/^not ok \d+ - ([^\r\n]+)$/gm)]
  .map(x=>x[1].replace(/[^a-zA-Z0-9 _.,\/()'":-]/g,'').slice(0,100))
  .slice(0,35);
const errorClass=result.error ? result.error.code === 'ETIMEDOUT' ? 'TIMEOUT' : 'RUNNER_ERROR' : null;
const summary={
  format:'drafttopage-preview-node-probe',version:1,
  scope:'Feature preview synthetic Node regression suite; not production or full browser/WordPress acceptance',
  testFileCount:files.length,nodeVersion:process.version,
  status:result.status===0&&!result.error?'PASS':'FAIL',
  runnerExitCode:result.status??null,runnerErrorClass:errorClass,
  testCount:marker('tests'),passed:marker('pass'),failed:marker('fail'),
  cancelled:marker('cancelled'),skipped:marker('skipped'),
  durationSeconds:Math.round((performance.now()-start)/1000),
  failedTestNames:failedNames,
  stdoutHash:createHash('sha256').update(output).digest('hex')
};
writeFileSync('public/turn14-node-probe.json',JSON.stringify(summary,null,2)+'\n');
// Probe is intentionally diagnostic-only: fail details would otherwise block
// preview publication. Its report, not the Cloudflare check, is authoritative.
console.log('Turn 14 diagnostic suite completed:',summary.status,summary.testCount,'tests,',summary.failed,'failed');
