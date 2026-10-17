// TEMPORARY native preview validation. NEVER MERGE THIS FILE OR ITS BUILD HOOK.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
const stages=[];
const env={...process.env,DTP_MANIFEST_CHILD:'1',NODE_USE_ENV_PROXY:'1',npm_config_audit:'false',npm_config_fund:'false'};
const perform=(name,exe,args,timeout=240000,extra={})=>{
 const start=Date.now();
 const run=spawnSync(exe,args,{encoding:'utf8',timeout,maxBuffer:25000000,stdio:['ignore','pipe','pipe'],env:{...env,...extra}});
 const pass=!run.error&&run.status===0;
 stages.push({name,result:pass?'PASS':'FAIL',seconds:Math.round((Date.now()-start)/1000)});
 console.log('Isolated manifest validation '+name+': '+(pass?'PASS':'FAIL'));
 if(!pass){
  const tail=(String(run.stdout||'')+'\n'+String(run.stderr||'')).slice(-5000).replace(/(Bearer|token|password|key)\s*[:=]\s*\S+/gi,'$1=[redacted]');
  console.error(tail);throw Error(name+' failed: '+tail.slice(-2200));
 }
 return run;
};
const output='public/_dtp_kit_manifest_probe_20261016.json';
try{
 perform('Focused manifest contract tests',process.execPath,['--test','tests/kit-manifests.test.js'],120000);
 perform('Study syntax','python3',['-m','py_compile','scripts/temporary-manifest-study.py'],60000);
 perform('Pin disposable WordPress','npm',['install','--no-save','--no-package-lock','--no-audit','--no-fund','@wp-playground/cli@3.1.58'],240000);
 const python='/tmp/dtp-manifest-py/bin/python';
 perform('Isolated Python environment','python3',['-m','venv','/tmp/dtp-manifest-py'],60000);
 perform('Pin Playwright',python,['-m','pip','install','--disable-pip-version-check','playwright==1.57.0'],180000);
 perform('Pin Chromium',python,['-m','playwright','install','chromium'],240000);
 const root='/tmp/dtp-manifest-libs';
 const packages=['libatk1.0-0t64','libatk-bridge2.0-0t64','libatspi2.0-0t64','libxcomposite1','libxdamage1','libxfixes3','libxrandr2','libxkbcommon0','libasound2t64','libxi6'];
 const command='set -eu; mkdir -p '+root+'/lists/partial '+root+'/archives/partial '+root+'/pkgs '+root+'/extracted; '+
  'apt-get update -o APT::Sandbox::User="" -o Dir::State::lists='+root+'/lists -o Dir::Cache::archives='+root+'/archives -o APT::Get::List-Cleanup=0; '+
  'cd '+root+'/pkgs; apt-get download -o APT::Sandbox::User="" -o Dir::State::lists='+root+'/lists '+packages.join(' ')+'; '+
  'for f in *.deb; do dpkg-deb -x "$f" '+root+'/extracted; done';
 perform('Rootless Chromium libraries','sh',['-c',command],180000);
 const loader=root+'/extracted/usr/lib/x86_64-linux-gnu:'+root+'/extracted/lib/x86_64-linux-gnu'+(process.env.LD_LIBRARY_PATH?':'+process.env.LD_LIBRARY_PATH:'');
 const local={LD_LIBRARY_PATH:loader,DRAFTTOPAGE_BROWSER_PYTHON:python,DRAFTTOPAGE_WORDPRESS_CLI:resolve('node_modules/@wp-playground/cli/cli.js')};
 if(!existsSync(local.DRAFTTOPAGE_WORDPRESS_CLI))throw Error('Pinned CLI missing');
 const complete=perform('Full source-bound release gate',process.execPath,['scripts/verify-release.mjs'],1200000,local);
 perform('Independent WordPress receipt',process.execPath,['scripts/verify-wordpress-receipt.mjs'],60000,local);
 perform('Mechanism checks, separate CPU profiles and ABBA timing',python,['scripts/temporary-manifest-study.py'],1200000,{LD_LIBRARY_PATH:loader});
 const release=JSON.parse(readFileSync('test-results/release-results.json','utf8'));
 const browser=JSON.parse(readFileSync('test-results/browser-results.json','utf8'));
 const wordpress=JSON.parse(readFileSync('test-results/wordpress-results.json','utf8'));
 const study=JSON.parse(readFileSync('test-results/kit-manifest-study.json','utf8'));
 if(release.result!=='PASS'||release.steps.some(s=>s.result!=='PASS')||browser.result!=='PASS'||browser.errors.length||browser.unexpected_requests.length||wordpress.result!=='PASS'||wordpress.cases.length!==13||wordpress.cases.some(c=>c.result!=='PASS')||wordpress.mediaLibrary?.result!=='PASS'||study.result!=='PASS'||study.publicUnchanged!==true||study.runs.length!==20||study.profiles.length!==2||study.mechanism.length!==2||study.errors.length)throw Error('Incomplete source-bound evidence');
 const counts=[...String(complete.stdout||'').matchAll(/^# tests (\d+)$/gm)];
 writeFileSync(output,JSON.stringify({
  result:'PASS',scope:'Synthetic local fixtures, not real authors, hosted WordPress, physical devices or field INP',
  featureHead:'9e9829fbe69eb74903d837279a2b6066f3f77465',stages,
  release:{head:release.head,sourceSha256:release.sourceSha256,steps:release.steps.map(({name,result})=>({name,result})),nodeTests:counts.length?Number(counts.at(-1)[1]):null},
  browser:{checks:browser.checks.length,layoutChecks:Object.keys(browser.layout).length,errors:browser.errors.length,unexpectedRequests:browser.unexpected_requests.length,documents:browser.document_benchmark},
  wordpress:{version:wordpress.environment.wordpress,cases:wordpress.cases.length,passed:wordpress.cases.filter(c=>c.result==='PASS').length,mediaResult:wordpress.mediaLibrary.result,uploads:wordpress.mediaLibrary.uploads.length,placements:wordpress.mediaLibrary.placements.length},study
 },null,2));
 console.log('Complete manifest validation PASS. Never merge this hook.');
}catch(error){
 const partial=existsSync('test-results/kit-manifest-study.json')?JSON.parse(readFileSync('test-results/kit-manifest-study.json','utf8')):null;
 writeFileSync(output,JSON.stringify({result:'FAIL',scope:'Temporary synthetic diagnostics only',stages,error:String(error.message||error).slice(0,2500),partialStudy:partial?{result:partial.result,errors:partial.errors,mechanism:partial.mechanism,profiles:partial.profiles,runs:partial.runs,publicUnchanged:partial.publicUnchanged}:null},null,2));
 console.error('Manifest validation FAILED; do not mistake native build success for test success.');
}
