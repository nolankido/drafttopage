// TEMPORARY isolated acceptance and timing; never merge into production.
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const stages=[];
const env={...process.env,DTP_PREVIEW_REUSE_CHILD:'1',NODE_USE_ENV_PROXY:'1',npm_config_audit:'false',npm_config_fund:'false'};
const perform=(name,exe,args,timeout=240000,extra={})=>{
 const start=Date.now(),run=spawnSync(exe,args,{encoding:'utf8',timeout,maxBuffer:30000000,stdio:['ignore','pipe','pipe'],env:{...env,...extra}});
 const pass=!run.error&&run.status===0;
 stages.push({name,result:pass?'PASS':'FAIL',seconds:Math.round((Date.now()-start)/1000)});
 console.log(name+': '+(pass?'PASS':'FAIL'));
 if(!pass){const tail=(String(run.stdout||'')+'\n'+String(run.stderr||'')).slice(-6000).replace(/(Bearer|token|password|key)\s*[:=]\s*\S+/gi,'$1=[redacted]');console.error(tail);throw Error(name+' failed: '+tail.slice(-2400));}
};
const read=name=>JSON.parse(readFileSync('test-results/'+name,'utf8'));
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const page=(name,value)=>{const text=JSON.stringify(value),dir='public/preview-reuse-receipt/'+name;mkdirSync(dir,{recursive:true});writeFileSync(dir+'/index.html','<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex,nofollow"><title>'+esc(text)+'</title></head><body><h1>Isolated preview validation</h1><pre>'+esc(text)+'</pre></body></html>');};
let report;
try{
 perform('Focused Node contracts',process.execPath,['--test','tests/export-preview-reuse.test.js'],120000);
 perform('Browser and timing syntax','python3',['-m','py_compile','scripts/export_preview_reuse_browser.py','scripts/temporary-preview-reuse-ab.py'],60000);
 perform('Pin disposable WordPress','npm',['install','--no-save','--no-package-lock','--no-audit','--no-fund','@wp-playground/cli@3.1.58'],240000);
 const python='/tmp/dtp-preview-reuse-py/bin/python';
 perform('Isolated Python','python3',['-m','venv','/tmp/dtp-preview-reuse-py'],60000);
 perform('Pin Playwright',python,['-m','pip','install','--disable-pip-version-check','playwright==1.57.0'],180000);
 perform('Pin Chromium',python,['-m','playwright','install','chromium'],240000);
 const root='/tmp/dtp-preview-reuse-libs';
 const packages=['libatk1.0-0t64','libatk-bridge2.0-0t64','libatspi2.0-0t64','libxcomposite1','libxdamage1','libxfixes3','libxrandr2','libxkbcommon0','libasound2t64','libxi6'];
 const command='set -eu; mkdir -p '+root+'/lists/partial '+root+'/archives/partial '+root+'/pkgs '+root+'/extracted; '+'apt-get update -o APT::Sandbox::User="" -o Dir::State::lists='+root+'/lists -o Dir::Cache::archives='+root+'/archives -o APT::Get::List-Cleanup=0; '+'cd '+root+'/pkgs; apt-get download -o APT::Sandbox::User="" -o Dir::State::lists='+root+'/lists '+packages.join(' ')+'; '+'for f in *.deb; do dpkg-deb -x "$f" '+root+'/extracted; done';
 perform('Rootless Chromium libraries','sh',['-c',command],180000);
 const loader=root+'/extracted/usr/lib/x86_64-linux-gnu:'+root+'/extracted/lib/x86_64-linux-gnu'+(process.env.LD_LIBRARY_PATH?':'+process.env.LD_LIBRARY_PATH:'');
 const local={LD_LIBRARY_PATH:loader,DRAFTTOPAGE_BROWSER_PYTHON:python,DRAFTTOPAGE_WORDPRESS_CLI:resolve('node_modules/@wp-playground/cli/cli.js')};
 if(!existsSync(local.DRAFTTOPAGE_WORDPRESS_CLI))throw Error('Pinned CLI missing');
 perform('Real DOM parity and native input',python,['scripts/export_preview_reuse_browser.py'],240000,local);
 perform('Complete source-bound release',process.execPath,['scripts/verify-release.mjs'],1200000,local);
 perform('Independent WordPress receipt',process.execPath,['scripts/verify-wordpress-receipt.mjs'],60000,local);
 perform('Unprofiled unique-article ABBA',python,['scripts/temporary-preview-reuse-ab.py'],1200000,{LD_LIBRARY_PATH:loader});
 const release=read('release-results.json'),browser=read('browser-results.json'),wordpress=read('wordpress-results.json'),focused=read('export-preview-reuse-browser.json'),timing=read('preview-reuse-ab.json');
 if(release.result!=='PASS'||release.steps.some(s=>s.result!=='PASS')||browser.result!=='PASS'||browser.errors.length||browser.unexpected_requests.length||wordpress.result!=='PASS'||wordpress.cases.length!==13||wordpress.cases.some(c=>c.result!=='PASS')||wordpress.mediaLibrary?.result!=='PASS'||focused.result!=='PASS'||focused.publicUnchanged!==true||focused.errors.length||focused.unexpectedRequests.length||timing.result!=='PASS'||timing.runs.length!==20||timing.publicUnchanged!==true||timing.errors.length)throw Error('Incomplete source-bound evidence');
 report={result:'PASS',scope:'Synthetic offline fixtures; not real-author, physical-device, hosted WordPress or field INP',featureHead:'2f1dba61ef781f0b4e7444d2fa07a1b98788df1f',stages,release:{head:release.head,sourceSha256:release.sourceSha256,steps:release.steps.map(({name,result})=>({name,result}))},browser:{checks:browser.checks.length,layoutChecks:Object.keys(browser.layout).length,errors:browser.errors.length,unexpectedRequests:browser.unexpected_requests.length,documents:browser.document_benchmark},wordpress:{version:wordpress.environment.wordpress,cases:wordpress.cases.length,passed:wordpress.cases.filter(c=>c.result==='PASS').length,mediaResult:wordpress.mediaLibrary.result,uploads:wordpress.mediaLibrary.uploads.length,placements:wordpress.mediaLibrary.placements.length},focused,timing};
}catch(error){report={result:'FAIL',featureHead:'2f1dba61ef781f0b4e7444d2fa07a1b98788df1f',scope:'Temporary test-only diagnostics',stages,error:String(error.message||error),focused:existsSync('test-results/export-preview-reuse-browser.json')?read('export-preview-reuse-browser.json'):null};}
const raw=Buffer.from(JSON.stringify(report,null,2)+'\n'),sha256=createHash('sha256').update(raw).digest('hex');
writeFileSync('public/_dtp_preview_reuse_20261017.json',raw);
page('index',{result:report.result,featureHead:report.featureHead,diagnostic:report.release?.head,bytes:raw.length,sha256,error:report.error?report.error.slice(-500):null});
for(const [i,stage] of stages.entries())page('stage-'+i,stage);
if(report.result==='PASS'){
 page('release',report.release);page('browser',report.browser);page('wordpress',report.wordpress);
 page('parity',report.focused.parity);page('native',report.focused.nativeInput);page('focus-status',{result:report.focused.result,publicUnchanged:report.focused.publicUnchanged,errors:report.focused.errors,unexpectedRequests:report.focused.unexpectedRequests,closedReopenAndInvalidClear:report.focused.closedReopenAndInvalidClear,layout:report.focused.layout});
 report.timing.summary.forEach((value,index)=>page('timing-'+index,value));
 page('timing-status',{result:report.timing.result,runs:report.timing.runs.length,samplesPerRun:report.timing.samplesPerRun,uniqueBlocks:report.timing.uniqueBlocks,publicUnchanged:report.timing.publicUnchanged,errors:report.timing.errors});
}else {page('failure',{result:report.result,error:report.error});page('focused-failure',report.focused);}
console.log('Explicit preview validation '+report.result+'; a native build success is not a test PASS.');
