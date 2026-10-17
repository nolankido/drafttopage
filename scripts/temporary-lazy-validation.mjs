// TEMPORARY Cloudflare branch validation. NEVER MERGE.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const steps=[];
const baseEnv={...process.env,DTP_LAZY_VALIDATION_CHILD:'1',NODE_USE_ENV_PROXY:'1',
  npm_config_audit:'false',npm_config_fund:'false'};
const perform=(name,exe,args,timeout=240000,more={})=>{
  const start=Date.now();
  const result=spawnSync(exe,args,{timeout,encoding:'utf8',maxBuffer:25000000,
    stdio:['ignore','pipe','pipe'],env:{...baseEnv,...more}});
  const pass=!result.error&&result.status===0;
  steps.push({name,result:pass?'PASS':'FAIL',seconds:Math.round((Date.now()-start)/1000)});
  console.log('Temporary export validation '+name+': '+(pass?'PASS':'FAIL'));
  if(!pass){
    const tail=(String(result.stdout||'')+'\n'+String(result.stderr||'')).slice(-3000)
      .replace(/(Bearer|token|password|key)\s*[:=]\s*\S+/gi,'$1=[redacted]');
    console.error(tail);
    throw Error(name+' failed: '+tail.slice(-950));
  }
};
const out='public/_dtp_lazy_export_probe_20261016.json';
try {
  perform('Focused controller regression',process.execPath,['--test','tests/export-lazy-build.test.js'],90000);
  perform('Python source syntax','python3',['-m','py_compile','scripts/temporary-lazy-ab.py'],60000);
  perform('Pin disposable WordPress runner','npm',['install','--no-save','--no-package-lock','--no-audit','--no-fund','@wp-playground/cli@3.1.58'],240000);
  const python='/tmp/dtp-lazy-acceptance-py/bin/python';
  perform('Create isolated Python venv','python3',['-m','venv','/tmp/dtp-lazy-acceptance-py'],60000);
  perform('Pinned Python Playwright',python,['-m','pip','install','--disable-pip-version-check','playwright==1.57.0'],180000);
  perform('Pinned Chromium',python,['-m','playwright','install','chromium'],240000);
  const root='/tmp/dtp-lazy-chromium-libs';
  const packages=['libatk1.0-0t64','libatk-bridge2.0-0t64','libatspi2.0-0t64',
    'libxcomposite1','libxdamage1','libxfixes3','libxrandr2','libxkbcommon0','libasound2t64','libxi6'];
  const command='set -eu; mkdir -p '+root+'/lists/partial '+root+'/archives/partial '+root+'/pkgs '+root+'/extracted; '+
    'apt-get update -o APT::Sandbox::User="" -o Dir::State::lists='+root+'/lists -o Dir::Cache::archives='+root+'/archives -o APT::Get::List-Cleanup=0; '+
    'cd '+root+'/pkgs; apt-get download -o APT::Sandbox::User="" -o Dir::State::lists='+root+'/lists '+packages.join(' ')+'; '+
    'for f in *.deb; do dpkg-deb -x "$f" '+root+'/extracted; done';
  perform('Rootless Chromium dependencies','sh',['-c',command],180000);
  const ld=root+'/extracted/usr/lib/x86_64-linux-gnu:'+root+'/extracted/lib/x86_64-linux-gnu'+
    (process.env.LD_LIBRARY_PATH?':'+process.env.LD_LIBRARY_PATH:'');
  const extraEnv={LD_LIBRARY_PATH:ld,DRAFTTOPAGE_WORDPRESS_CLI:resolve('node_modules/@wp-playground/cli/cli.js'),
    DRAFTTOPAGE_BROWSER_PYTHON:python};
  if(!existsSync(extraEnv.DRAFTTOPAGE_WORDPRESS_CLI))throw Error('Pinned WordPress CLI file missing');
  perform('Complete browser, WordPress and source gate',process.execPath,['scripts/verify-release.mjs'],1200000,extraEnv);
  perform('Independent WordPress receipt',process.execPath,['scripts/verify-wordpress-receipt.mjs'],60000,extraEnv);
  perform('Serial source-bound ABBA typing',python,['scripts/temporary-lazy-ab.py'],1200000,{LD_LIBRARY_PATH:ld});
  const release=JSON.parse(readFileSync('test-results/release-results.json','utf8'));
  const browser=JSON.parse(readFileSync('test-results/browser-results.json','utf8'));
  const wordpress=JSON.parse(readFileSync('test-results/wordpress-results.json','utf8'));
  const timing=JSON.parse(readFileSync('test-results/lazy-export-ab.json','utf8'));
  if(release.result!=='PASS'||browser.result!=='PASS'||wordpress.result!=='PASS'||
    wordpress.mediaLibrary?.result!=='PASS'||wordpress.cases?.length!==13||
    timing.result!=='PASS'||timing.runs?.length!==16||timing.summary?.length!==4||
    timing.publicUnchanged!==true||timing.errors?.length)throw Error('Acceptance report insufficient');
  writeFileSync(out,JSON.stringify({
    result:'PASS',scope:'Synthetic local test fixtures. NOT hosted WordPress, real authors or device field INP.',
    featureHead:'c3d0c8b68f87e26d144bbe0fad46e0efa12098e7',
    stages:steps,release:{head:release.head,sourceSha256:release.sourceSha256,
      steps:release.steps.map(({name,result})=>({name,result}))},
    browser:{checks:browser.checks.length,layoutChecks:Object.keys(browser.layout).length,
      errors:browser.errors.length,unexpectedRequests:browser.unexpected_requests.length},
    wordpress:{version:wordpress.environment?.wordpress,cases:wordpress.cases.length,
      passed:wordpress.cases.filter(x=>x.result==='PASS').length,mediaResult:wordpress.mediaLibrary.result,
      uploads:wordpress.mediaLibrary.uploads.length,placements:wordpress.mediaLibrary.placements.length},
    benchmark:timing
  },null,2));
  console.log('Complete isolated acceptance and ABBA PASS. NEVER MERGE THIS HOOK.');
}catch(error){
  writeFileSync(out,JSON.stringify({result:'FAIL',scope:'Temporary diagnostic only',
    error:String(error.message||error).slice(0,1100),stages:steps},null,2));
  console.error('Isolated validation FAILED. NEVER MERGE THIS HOOK.');
}
