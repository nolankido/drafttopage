// ONE-TIME Cloudflare native preview probe. NEVER MERGE THIS FILE OR BUILD HOOK.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const statuses=[];
const env={...process.env,DTP_AB_VALIDATION_CHILD:'1',NODE_USE_ENV_PROXY:'1',
  npm_config_audit:'false',npm_config_fund:'false'};
const reportPath='public/_dtp_review_ab_probe_20261016.json';
const perform=(label,command,args,timeout=300000,extraEnv={})=>{
  const start=Date.now();
  const run=spawnSync(command,args,{encoding:'utf8',timeout,maxBuffer:20000000,
    env:{...env,...extraEnv},stdio:['ignore','pipe','pipe']});
  const good=!run.error&&run.status===0;
  const log=String(run.stdout||'')+'\n'+String(run.stderr||'');
  const entry={label,result:good?'PASS':'FAIL',seconds:Math.round((Date.now()-start)/1000)};
  statuses.push(entry);
  console.log('Isolated ABBA validation '+label+': '+entry.result);
  if(!good){
    const tail=log.slice(-3000).replace(/(Bearer|token|password|key)\s*[:=]\s*\S+/gi,'$1=[redacted]');
    console.error(tail);
    throw new Error(label+' failed: '+tail.slice(-750));
  }
  return run;
};
try {
  const tests=readdirSync('tests').filter(name=>name.endsWith('.test.js')).sort().map(name=>'tests/'+name);
  perform('Node regression suite',process.execPath,['--test',...tests],300000);
  perform('Static checks',process.execPath,['scripts/check.mjs'],60000);
  perform('Python syntax','python3',['-m','py_compile','scripts/review_ab_benchmark.py'],60000);
  const python='/tmp/dtp-review-ab-venv/bin/python';
  perform('Create isolated Python venv','python3',['-m','venv','/tmp/dtp-review-ab-venv'],60000);
  perform('Pinned Python Playwright',python,['-m','pip','install','--disable-pip-version-check','playwright==1.57.0'],180000);
  perform('Pinned Chromium',python,['-m','playwright','install','chromium'],240000);
  const root='/tmp/dtp-review-ab-chromium-libs';
  const pkgs=['libatk1.0-0t64','libatk-bridge2.0-0t64','libatspi2.0-0t64',
    'libxcomposite1','libxdamage1','libxfixes3','libxrandr2','libxkbcommon0','libasound2t64','libxi6'];
  const command='set -eu; mkdir -p '+root+'/lists/partial '+root+'/archives/partial '+root+'/pkgs '+root+'/extracted; '+
    'apt-get update -o APT::Sandbox::User="" -o Dir::State::lists='+root+'/lists -o Dir::Cache::archives='+root+'/archives -o APT::Get::List-Cleanup=0; '+
    'cd '+root+'/pkgs; apt-get download -o APT::Sandbox::User="" -o Dir::State::lists='+root+'/lists '+pkgs.join(' ')+'; '+
    'for f in *.deb; do dpkg-deb -x "$f" '+root+'/extracted; done';
  perform('Rootless Chromium libraries','sh',['-c',command],180000);
  const loader=root+'/extracted/usr/lib/x86_64-linux-gnu:'+root+'/extracted/lib/x86_64-linux-gnu'+
    (process.env.LD_LIBRARY_PATH?':'+process.env.LD_LIBRARY_PATH:'');
  perform('Controlled ABBA browser benchmark',python,
    ['scripts/review_ab_benchmark.py','--samples','31'],1500000,{LD_LIBRARY_PATH:loader});
  const evidence=JSON.parse(readFileSync('test-results/review-ab-performance.json','utf8'));
  if(evidence.result!=='PASS'||evidence.runs.length!==20||
      evidence.summary.length!==5||evidence.publicUnchanged!==true||
      evidence.candidateCommit!=='642affa77efbe46f5158341f15816d1c0b5f4512'||
      evidence.baselineCommit!=='4338b5e2629c7764a8382cfe52fefaf8db27b08c'||
      evidence.errors?.length) throw new Error('ABBA report incomplete or source binding mismatch');
  writeFileSync(reportPath,JSON.stringify({
    result:'PASS',scope:'Synthetic offline browser only; no real-writer, device or field INP claim',
    releaseFeatureSha:'80bc78292eaacb44b993e8792e16cdd505f9aec6',
    steps:statuses,report:evidence
  },null,2));
  console.log('Source-bound isolated ABBA diagnostic PASS. DO NOT MERGE THE HOOK.');
} catch(error) {
  writeFileSync(reportPath,JSON.stringify({
    result:'FAIL',scope:'Temporary isolated diagnostic ONLY',steps:statuses,
    error:String(error.message||error).slice(0,1400)
  },null,2));
  console.error('Isolated ABBA diagnostic FAILED. DO NOT MERGE THE HOOK.');
}
