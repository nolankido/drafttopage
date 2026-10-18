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
  '<!doctype html><html><main data-release="'+label+'"><h1>Fictional article</h1>'+
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
