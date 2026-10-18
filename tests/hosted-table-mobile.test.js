import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, existsSync, rmSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TABLE_ROW_LAYOUT_KEYS } from '../scripts/release-browser-contract.mjs';

const executable = fileURLToPath(new URL('../scripts/hosted_table_mobile.py', import.meta.url));
const source = readFileSync(executable, 'utf8');

test('Standalone hosted 320/390px browser smoke validates its own origin and measured layout contracts offline',()=>{
  const outcome = spawnSync('python3', [executable, '--self-test'], { encoding:'utf8' });
  assert.equal(outcome.status,0,outcome.stderr);
  const report = JSON.parse(outcome.stdout);
  assert.equal(report.selfTest,'PASS');
  assert.equal(report.realBrowser,'NOT_RUN');
  assert.deepEqual(report.actualWidths,[]);
  assert.equal(report.format,'drafttopage-hosted-table-mobile-smoke');
  for(const key of TABLE_ROW_LAYOUT_KEYS)assert.ok(source.includes("'"+key+"'"),'missing viewport key '+key);
  for(const term of ['set_viewport_size','scrollWidth','textClipped','table-cell-12-0','table-preview-change','table-apply','checkpoint-select'])
    assert.ok(source.includes(term),'missing meaningful real-browser assertion '+term);
});

test('Hosted mobile smoke rejects unrelated origins and never emits success evidence on validation failure',()=>{
  const temp=mkdtempSync(join(tmpdir(),'drafttopage-hosted-mobile-'));
  try{
    const output=join(temp,'must-not-exist.json');
    const rejected=spawnSync('python3', [executable,'--origin','https://example.com','--output',output],{encoding:'utf8'});
    assert.notEqual(rejected.status,0);
    assert.match(rejected.stderr,/Draft to Page HTTPS origin/);
    assert.equal(existsSync(output),false);
    const help=execFileSync('python3',[executable,'--help'],{encoding:'utf8'});
    assert.match(help,/--self-test/);
    assert.match(help,/--origin/);
    // Real running and human-alpha proof are explicitly distinct.
    assert.match(source,/sourceBound.*False/);
    assert.match(source,/physicalMobile.*NOT_RUN/);
    assert.match(source,/alphaReady.*False/);
  }finally{rmSync(temp,{recursive:true,force:true});}
});
