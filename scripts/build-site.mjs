// TEMPORARY validation-only Cloudflare preview hook. NEVER MERGE THIS FILE.
import './build-content.mjs';
if (process.env.DTP_MANUAL_VALIDATION_CHILD !== '1') {
  const { spawnSync } = await import('node:child_process');
  const { existsSync, readFileSync, writeFileSync } = await import('node:fs');
  const { resolve } = await import('node:path');
  const statuses = [];
  const env = { ...process.env, NODE_USE_ENV_PROXY:'1', DTP_MANUAL_VALIDATION_CHILD:'1',
    npm_config_audit:'false', npm_config_fund:'false' };
  const perform = (label,cmd,args,timeout=240000,extraEnv={}) => {
    const started = Date.now();
    const run = spawnSync(cmd,args,{encoding:'utf8',timeout,maxBuffer:12_000_000,
      env:{...env,...extraEnv},stdio:['ignore','pipe','pipe']});
    const good = !run.error && run.status === 0;
    const detail = String(run.stdout||'')+'\\n'+String(run.stderr||'');
    const safeTail = detail.slice(-1800).replace(/(Bearer|token|password|key)\\s*[:=]\\s*\\S+/gi,'$1=[redacted]');
    statuses.push({label,result:good?'PASS':'FAIL',seconds:Math.round((Date.now()-started)/1000),
      exit:run.status,errorCode:run.error?.code||null, ...(good?{}:{logTail:safeTail})});
    console.log('Manual isolated acceptance '+label+': '+(good?'PASS':'FAIL'));
    if (!good) {
      const raw = String(run.stdout||'')+'\n'+String(run.stderr||'');
      console.error(raw.slice(-8000).replace(/(Bearer|token|password|key)\s*[:=]\s*\S+/gi,'$1=[redacted]'));
      throw new Error('Manual isolated acceptance failed: '+label);
    }
    return run;
  };
  try {
  perform('pin-playground-cli','npm',['install','--no-save','--no-package-lock','--no-audit','--no-fund','@wp-playground/cli@3.1.58'],240000);
  const python='/tmp/dtp-review-acceptance-py/bin/python';
  perform('create-python-venv','python3',['-m','venv','/tmp/dtp-review-acceptance-py'],60000);
  perform('pin-python-playwright',python,['-m','pip','install','--disable-pip-version-check','playwright==1.57.0'],180000);
  perform('pin-chromium',python,['-m','playwright','install','chromium'],240000);
  const root='/tmp/dtp-review-chromium-libs';
  const pkgs=['libatk1.0-0t64','libatk-bridge2.0-0t64','libatspi2.0-0t64',
    'libxcomposite1','libxdamage1','libxfixes3','libxrandr2','libxkbcommon0','libasound2t64','libxi6'];
  const cmd='set -eu; mkdir -p '+root+'/lists/partial '+root+'/archives/partial '+root+'/pkgs '+root+'/extracted; '+
    'apt-get update -o APT::Sandbox::User="" -o Dir::State::lists='+root+'/lists -o Dir::Cache::archives='+root+'/archives -o APT::Get::List-Cleanup=0; '+
    'cd '+root+'/pkgs; apt-get download -o APT::Sandbox::User="" -o Dir::State::lists='+root+'/lists '+pkgs.join(' ')+'; '+
    'for f in *.deb; do dpkg-deb -x "$f" '+root+'/extracted; done';
  perform('rootless-chromium-dependencies','sh',['-c',cmd],180000);
  const cli=resolve('node_modules/@wp-playground/cli/cli.js');
  if (!existsSync(cli)) throw new Error('The pinned Playground CLI file is absent.');
  const acceptanceEnv={LD_LIBRARY_PATH:root+'/extracted/usr/lib/x86_64-linux-gnu:'+root+'/extracted/lib/x86_64-linux-gnu'+(process.env.LD_LIBRARY_PATH?':'+process.env.LD_LIBRARY_PATH:''),
    DRAFTTOPAGE_WORDPRESS_CLI:cli,DRAFTTOPAGE_BROWSER_PYTHON:python};
  perform('complete-source-bound-release',process.execPath,['scripts/verify-release.mjs'],1200000,acceptanceEnv);
  perform('independent-wordpress-receipt',process.execPath,['scripts/verify-wordpress-receipt.mjs'],60000,acceptanceEnv);
  const release=JSON.parse(readFileSync('test-results/release-results.json','utf8'));
  const browser=JSON.parse(readFileSync('test-results/browser-results.json','utf8'));
  const wordpress=JSON.parse(readFileSync('test-results/wordpress-results.json','utf8'));
  if (release.result!=='PASS'||browser.result!=='PASS'||wordpress.result!=='PASS'||wordpress.mediaLibrary?.result!=='PASS')
    throw new Error('Unexpected evidence result after successful tool exits.');
  writeFileSync('public/_dtp_review_probe_20261016.json', JSON.stringify({
    scope:'Temporary fictional acceptance only; no production WordPress or real-author data',
    result:'PASS',head:release.head,sourceSha256:release.sourceSha256,
    releaseSteps:release.steps.map(({name,result})=>({name,result})),
    browser:{checks:browser.checks?.length,layoutChecks:Object.keys(browser.layout||{}).length,
      errors:browser.errors?.length,unexpectedRequests:browser.unexpected_requests?.length},
    documents:browser.document_benchmark||null,
    wordpress:{version:wordpress.environment?.wordpress,
      cases:wordpress.cases?.length,passedCases:wordpress.cases?.filter(x=>x.result==='PASS').length,
      mediaResult:wordpress.mediaLibrary?.result,uploads:wordpress.mediaLibrary?.uploads?.length,
      imageBlocks:wordpress.mediaLibrary?.placements?.length,sourceUnchanged:wordpress.sourceUnchanged},
    stages:statuses.map(({label,result,seconds})=>({label,result,seconds}))
  },null,2));
  console.log('Temporary isolated acceptance PASS; never merge this hook.');
  } catch (error) {
    writeFileSync('public/_dtp_review_probe_20261016.json',JSON.stringify({
      scope:'Temporary fictional manual test only, NEVER production',result:'FAIL',
      error:String(error.message||error).slice(0,250),stages:statuses
    },null,2));
    console.error('Temporary acceptance FAILED; see synthetic report. Never merge this hook.');
  }
}
