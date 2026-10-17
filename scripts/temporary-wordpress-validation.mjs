// Disposable, manually initiated validation through Cloudflare's existing Preview build.
// This file and the hook importing it must never be merged into main.
import { spawnSync, execFileSync } from 'node:child_process';
import { appendFileSync, existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const steps=[];
const preview='public/_dtp-wordpress-probe-20261016.html';
try {
  appendFileSync('.git/info/exclude','\npublic/_dtp-wordpress-probe-20261016.html\n');
} catch (error) {
  steps.push({label:'exclude_preview_report_from_source_hash',result:'FAIL',message:error.message.slice(0,250)});
}
function save() {
  const payload={scope:'Temporary fictional local WordPress acceptance, not production/hosted WordPress',steps};
  const escaped=JSON.stringify(payload,null,2).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
  writeFileSync(preview,'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex,nofollow"><title>WordPress local validation</title></head><body><main><h1>Pinned WordPress acceptance</h1><pre>'+escaped+'</pre></main></body></html>');
}
function run(label,cmd,args,timeout=240000,env=process.env) {
  const started=Date.now();
  const result=spawnSync(cmd,args,{encoding:'utf8',timeout,maxBuffer:3_000_000,
    env:{...env,npm_config_audit:'false',npm_config_fund:'false'}});
  const state=result.error?.code==='ETIMEDOUT'?'TIMEOUT':result.error||result.status!==0?'FAIL':'PASS';
  const tail=String((result.stdout||'')+'\n'+(result.stderr||'')).split('\n').slice(-9).join('\n').slice(-1400)
    .replace(/(Bearer|token|password|key)\s*[:=]\s*\S+/gi,'$1=[redacted]');
  steps.push({label,result:state,seconds:Math.round((Date.now()-started)/1000),
    exitCode:result.status,errorCode:result.error?.code||null,logTail:state==='PASS'?'':tail});
  console.log('Temporary acceptance '+label+': '+state);
  save();
  return state==='PASS';
}
save();
const offline=run('focused_wordpress_receipt_tests',process.execPath,
  ['--test','tests/wordpress-receipt.test.js','tests/wordpress-roundtrip.test.js'],240000);
const staticCheck=run('site_static_checks',process.execPath,['scripts/check.mjs'],60000);
if (offline && staticCheck) {
 if (run('playground_cli_install','npm',['install','--no-save','--no-package-lock','--no-audit','--no-fund','@wp-playground/cli@3.1.58'],240000)) {
  if (run('python_venv','python3',['-m','venv','/tmp/dtp-wordpress-pyenv'],60000)) {
    const py='/tmp/dtp-wordpress-pyenv/bin/python';
    if (run('python_playwright_pinned',py,['-m','pip','install','--disable-pip-version-check','playwright==1.57.0'],170000)
      && run('chromium_browser_install',py,['-m','playwright','install','chromium'],220000)) {
      const root='/tmp/dtp-wordpress-libs';
      const pkg=['libatk1.0-0t64','libatk-bridge2.0-0t64','libatspi2.0-0t64',
        'libxcomposite1','libxdamage1','libxfixes3','libxrandr2','libxkbcommon0','libasound2t64','libxi6'];
      const script='set -eu; mkdir -p '+root+'/lists/partial '+root+'/archives/partial '+root+'/pkgs '+root+'/extracted; '+
        'apt-get update -o APT::Sandbox::User="" -o Dir::State::lists='+root+'/lists -o Dir::Cache::archives='+root+'/archives -o APT::Get::List-Cleanup=0; '+
        'cd '+root+'/pkgs; apt-get download -o APT::Sandbox::User="" -o Dir::State::lists='+root+'/lists '+pkg.join(' ')+'; '+
        'for f in *.deb; do dpkg-deb -x "$f" '+root+'/extracted; done';
      if (run('nonroot_chromium_dependencies','sh',['-c',script],180000)) {
        const libs=root+'/extracted/usr/lib/x86_64-linux-gnu:'+root+'/extracted/lib/x86_64-linux-gnu';
        const cli=resolve('node_modules/@wp-playground/cli/cli.js');
        const env={...process.env,LD_LIBRARY_PATH:libs+(process.env.LD_LIBRARY_PATH?':'+process.env.LD_LIBRARY_PATH:''),
          DRAFTTOPAGE_WORDPRESS_CLI:cli};
        if(!existsSync(cli)) {
          steps.push({label:'playground_cli_binary',result:'FAIL',message:'Pinned CLI file absent'});save();
        } else {
          const good=run('real_local_wordpress_and_media',py,['scripts/wordpress_roundtrip.py'],700000,env);
          if (existsSync('test-results/wordpress-results.json')) {
            try {
              const e=JSON.parse(readFileSync('test-results/wordpress-results.json','utf8'));
              steps.push({label:'actual_wordpress_report',result:e.result||'UNKNOWN',
                cases:(e.cases||[]).filter(x=>x.result==='PASS').length,
                totalCases:(e.cases||[]).length,mediaResult:e.mediaLibrary?.result||'NOT_RUN',
                wordpress:e.environment?.wordpress||null,sourceUnchanged:e.sourceUnchanged??null,
                error:String(e.error||'').slice(0,900)});
            } catch(error){steps.push({label:'actual_wordpress_report',result:'UNREADABLE'});}
            save();
          }
          if(good) run('git_bound_wordpress_receipt',process.execPath,['scripts/verify-wordpress-receipt.mjs'],40000,env);
        }
      }
    }
  }
 }
}
console.log('Temporary acceptance probe finished. No production files or accounts were changed.');
