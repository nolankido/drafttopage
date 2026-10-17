// TEMPORARY test-only Cloudflare preview hook. NEVER MERGE THIS FILE.
// Explicit manual validation commit: source feature files remain identical to PR #116.
import './build-content.mjs';
import { spawnSync } from 'node:child_process';
import { readdirSync, writeFileSync } from 'node:fs';
const tests = readdirSync('tests').filter(name => name.endsWith('.test.js')).sort().map(name => 'tests/' + name);
const steps = [
  ['focused', ['--test', 'tests/active-review-reuse.test.js']],
  ['all-node', ['--test', ...tests]],
  ['static', ['scripts/check.mjs']]
];
const results = [];
for (const [name,args] of steps) {
  const started = Date.now();
  const run = spawnSync(process.execPath,args,{encoding:'utf8',maxBuffer:12_000_000,timeout:420000});
  const passed = !run.error && run.status === 0;
  results.push({name,result:passed?'PASS':'FAIL',exit:run.status,seconds:Math.round((Date.now()-started)/1000)});
  console.log('Temporary manual acceptance '+name+': '+(passed?'PASS':'FAIL'));
  if (!passed) {
    const details = String(run.stdout||'')+'\n'+String(run.stderr||'');
    console.error(details.slice(-11000));
    throw new Error('Temporary review validation failed: '+name);
  }
}
writeFileSync('public/_dtp_review_probe_20261016.json',JSON.stringify({scope:'Fictional offline temporary test build only; not production',source:'diagnostic temporary hook',results},null,2));
