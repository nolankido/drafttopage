import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectProduction,PRODUCTION_ORIGIN,PRODUCTION_PATHS } from '../scripts/production-smoke.mjs';
const LABEL='alpha-release-turn9-20261017';
const CSP="default-src 'self'; script-src 'self'; connect-src 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'none'";
const headers = type => ({
  get(name){return {'content-security-policy':CSP,'x-content-type-options':'nosniff','content-type':type}[name.toLowerCase()]||null;}
});
const body=(path,label=LABEL)=>path.endsWith('.json')?JSON.stringify({release:label,publicPages:26}):
  path.endsWith('.js')?path.endsWith('preview-render-queue.js')?'export function createPreviewRenderQueue(){}':'export function installPreviewNavigation(){}':
  '<!doctype html><html><main data-release="'+label+'">'+
  (path==='/word-to-wordpress/'?'<header class="desk-intro" data-workspace="word-to-wordpress"></header><input id="import-file"><textarea id="body"></textarea>':
   path==='/google-docs-to-wordpress/'?'<header class="desk-intro" data-workspace="google-docs"></header><textarea id="import-text"></textarea><textarea id="body"></textarea>':
   path==='/markdown-to-wordpress/'?'<header class="desk-intro" data-workspace="wordpress"></header><textarea id="body"></textarea>':'')+
  '<h1>Fictional article</h1>'+
  (path==='/help/alpha-support/'?'<select id="alpha-diagnostic-converter"></select>':'')+'</main></html>';
function mock({override,throws}={}){
  const requests=[];
  const fetcher=async(url,opts)=>{
    requests.push({url,opts});
    const path=url.slice(PRODUCTION_ORIGIN.length);
    if(path===throws)throw new Error('SECRET_TOKEN_DO_NOT_LOG');
    const kind=path.endsWith('.json')?'application/json':path.endsWith('.js')?'text/javascript':'text/html; charset=utf-8';
    const response={ok:true,status:200,headers:headers(kind),text:async()=>body(path)};
    return override?.(path,response)??response;
  };
  return {fetcher,requests};
}
test('Seven fixed public routes pass with safe GET requests and matching release marker',async()=>{
  const {fetcher,requests}=mock();
  const output=await inspectProduction({expectedRelease:LABEL,fetcher});
  assert.equal(output.result,'PASS');
  assert.deepEqual(requests.map(x=>x.url),PRODUCTION_PATHS.map(x=>PRODUCTION_ORIGIN+x));
  for(const {opts} of requests){
    assert.equal(opts.method,'GET');assert.equal(opts.redirect,'error');
    assert.equal(opts.credentials,'omit');assert.equal(opts.cache,'no-store');
  }
  assert.doesNotMatch(JSON.stringify(output),/SECRET_TOKEN|draft body|cookie/);
});
test('Missing route, bad CSP, MIME, stale release or missing UI cannot pass',async()=>{
  const mutations=[
    (path,res)=>path==='/word-to-wordpress/'?{...res,ok:false,status:404}:res,
    (path,res)=>path==='/word-to-wordpress/'?{...res,text:async()=>body(path,'alpha-release-old')}:res,
    (path,res)=>path==='/release.json'?{...res,text:async()=>body(path,'alpha-release-old')}:res,
    (path,res)=>path==='/help/alpha-support/'?{...res,text:async()=>body('/word-to-wordpress/')}:res,
    (path,res)=>path==='/preview-render-queue.js'?{...res,text:async()=>''}:res,
    (path,res)=>path==='/markdown-to-wordpress/'?{...res,headers:{get:()=>null}}:res
  ];
  for(const override of mutations){
    const output=await inspectProduction({expectedRelease:LABEL,fetcher:mock({override}).fetcher});
    assert.equal(output.result,'FAIL');assert.ok(output.routes.some(x=>x.result==='FAIL'));
  }
});
test('Network failures are sanitized and never reported as complete success',async()=>{
  const output=await inspectProduction({expectedRelease:LABEL,fetcher:mock({throws:'/google-docs-to-wordpress/'}).fetcher});
  assert.equal(output.result,'FAIL');
  assert.equal(output.routes.find(x=>x.path==='/google-docs-to-wordpress/').result,'FAIL');
  assert.doesNotMatch(JSON.stringify(output),/SECRET_TOKEN_DO_NOT_LOG/);
});
test('Malformed or absent release labels fail before making any HTTP request',async()=>{
  for(const label of [null,'',123,'html-relative-links-20261016','<script>alert(1)</script>']){
    let count=0;
    await assert.rejects(inspectProduction({expectedRelease:label,fetcher:()=>{count++;}}),/release label/);
    assert.equal(count,0);
  }
});

test('Broken preview-navigation export or unsupported JavaScript MIME cannot pass',async()=>{
  const mutations=[
    (path,res)=>path==='/preview-navigation.js'?{...res,text:async()=>''}:res,
    (path,res)=>path==='/preview-navigation.js'?{...res,text:async()=> '// installPreviewNavigation is mentioned, but not exported'}:res,
    (path,res)=>path==='/preview-navigation.js'?{...res,headers:headers('application/notjavascript')}:res,
    (path,res)=>path==='/preview-render-queue.js'?{...res,headers:headers('text/other-javascript')}:res
  ];
  for(const override of mutations){
    const result=await inspectProduction({expectedRelease:LABEL,fetcher:mock({override}).fetcher});
    assert.equal(result.result,'FAIL');
    assert.ok(result.routes.some(x=>x.path.endsWith('.js')&&x.result==='FAIL'));
  }
});
test('Unsafe earlier duplicate CSP directives invalidate nominally safe response',async()=>{
  for(const value of [
    "default-src 'self'; connect-src *; connect-src 'none'; script-src 'self'; object-src 'none'; frame-ancestors 'none'",
    "script-src https:; script-src 'self'; connect-src 'none'; object-src 'none'; frame-ancestors 'none'",
    "default-src 'self'; object-src data:; connect-src 'none'; script-src 'self'; object-src 'none'; frame-ancestors 'none'"
  ]){
    const out=await inspectProduction({expectedRelease:LABEL,fetcher:mock({override:(path,res)=>path==='/word-to-wordpress/'?{
      ...res,headers:{get:key=>key.toLowerCase()==='content-security-policy'?value:res.headers.get(key)}
    }:res}).fetcher});
    assert.equal(out.result,'FAIL');
    assert.equal(out.routes.find(x=>x.path==='/word-to-wordpress/').result,'FAIL');
  }
});
test('Wrong converter served under another route, even with valid main and label, is rejected',async()=>{
  for(const route of ['/word-to-wordpress/','/google-docs-to-wordpress/','/markdown-to-wordpress/']){
    const out=await inspectProduction({expectedRelease:LABEL,fetcher:mock({override:(path,res)=>path===route?{
      ...res,text:async()=>body('/markdown-to-wordpress/')}:res}).fetcher});
    if(route==='/markdown-to-wordpress/'){
      // A Word tool substituted for Markdown also fails with a correct release marker.
      const replaced=await inspectProduction({expectedRelease:LABEL,fetcher:mock({override:(path,res)=>path===route?{
        ...res,text:async()=>body('/word-to-wordpress/')}:res}).fetcher});
      assert.equal(replaced.result,'FAIL');continue;
    }
    assert.equal(out.result,'FAIL',route);
    assert.equal(out.routes.find(x=>x.path===route).result,'FAIL');
  }
});
test('Preflight error overwrites stale PASS receipt with explicit FAIL and cannot make network calls',async()=>{
  const {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync}=await import('node:fs');
  const {tmpdir}=await import('node:os');
  const {join,resolve}=await import('node:path');
  const {spawnSync}=await import('node:child_process');
  const {fileURLToPath}=await import('node:url');
  const root=mkdtempSync(join(tmpdir(),'drafttopage-prod-smoke-'));
  try{
    mkdirSync(join(root,'test-results'));
    writeFileSync(join(root,'test-results','production-smoke.json'),JSON.stringify({result:'PASS',source:'STALE'}));
    const script=fileURLToPath(new URL('../scripts/production-smoke.mjs',import.meta.url));
    // Missing public/release.json is a preflight failure before network requests.
    const run=spawnSync(process.execPath,[script],{cwd:root,encoding:'utf8'});
    assert.equal(run.status,1);
    const receipt=JSON.parse(readFileSync(join(root,'test-results','production-smoke.json'),'utf8'));
    assert.equal(receipt.result,'FAIL');
    assert.equal(receipt.routes.length,0);
    assert.doesNotMatch(JSON.stringify(receipt)+run.stderr+run.stdout,/STALE|SECRET_TOKEN/);
  }finally{rmSync(root,{recursive:true,force:true});}
});
