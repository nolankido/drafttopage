import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { evaluateAlphaRelease, examineAlphaRelease, ALPHA_REQUIRED_STEPS, ALPHA_REAL_WORLD_GATES } from '../scripts/alpha-release-gate.mjs';
const template=JSON.parse(readFileSync(new URL('../docs/alpha/alpha-release-record-template.json',import.meta.url),'utf8'));
const HEAD='a'.repeat(40),OLD='b'.repeat(40),SOURCE='c'.repeat(64),VERSION='12345678-1234-1234-1234-123456789abc';
const local={result:'PASS',head:HEAD,sourceSha256:SOURCE,
  steps:ALPHA_REQUIRED_STEPS.map(name=>({name,result:'PASS'})),browser:{scope:'full',checks:42,layoutChecks:5},
  wordpress:{result:'PASS'}};
function complete(){
  const a=structuredClone(template);
  a.release_commit=HEAD;a.source_sha256=SOURCE;
  a.deployment={commit:HEAD,version_id:VERSION,status:'SUCCESS',production_verified:true};
  a.rollback={commit:OLD,version_id:VERSION,manual_recovery_checked:true};
  for(const name of ALPHA_REAL_WORLD_GATES)a.acceptance[name]={status:'OBSERVED_PASS',commit:HEAD,evidence_type:'HUMAN_OBSERVATION',evidence_ref:'OWNER_OBS_'+name.toUpperCase()};
  return a;
}
const args=(a=complete(),report=local)=>({currentHead:HEAD,sourceSha256:SOURCE,branch:'main',clean:true,local:report,attestation:a});
test('Blank release template and missing run proof always block invitation',()=>{
  const result=evaluateAlphaRelease(args(template,null));
  assert.equal(result.result,'BLOCKED');assert.ok(result.blockers.includes('fresh_complete_local_validation_required'));
  assert.ok(result.blockers.includes('production_version_and_live_verification_required'));
  assert.ok(result.blockers.includes('unverified_word_source'));
  assert.ok(result.blockers.includes('unverified_private_support'));
});
test('Only full pinned, clean, independently recorded requirements reach owner decision',()=>{
  const r=evaluateAlphaRelease(args());assert.equal(r.result,'READY_FOR_OWNER_INVITATION_DECISION');assert.deepEqual(r.blockers,[]);
  assert.equal(r.evidence_type,'LOCAL_VALIDATION_AND_OWNER_RECORDED_OBSERVATIONS');
});
test('Stale head, changed source, branch or uncommitted checkout blocks even with passing old report',()=>{
  for(const extra of [{branch:'old'},{clean:false},{currentHead:OLD},{sourceSha256:'d'.repeat(64)}]){
    const v=evaluateAlphaRelease({...args(),...extra});assert.equal(v.result,'BLOCKED');
  }
});
test('Alpha promotion requires the independent source-bound WordPress receipt even when the WordPress model passes',()=>{
  const prior={...local,steps:local.steps.filter(step=>step.name!=='wordpress receipt')};
  const result=evaluateAlphaRelease(args(complete(),prior));
  assert.equal(result.result,'BLOCKED');
  assert.ok(result.blockers.includes('fresh_complete_local_validation_required'));
  for(const removed of ['wordpress', 'browser', 'source snapshot']){
    const missing={...local,steps:local.steps.filter(step=>step.name!==removed)};
    assert.ok(evaluateAlphaRelease(args(complete(),missing)).blockers.includes('fresh_complete_local_validation_required'));
  }
});

test('Partial browser or WordPress run is never mistaken for complete validation',()=>{
  for(const modified of [{browser:{scope:'desk-only',checks:1,layoutChecks:3}},
    {wordpress:{result:'NOT_RUN'}},{steps:local.steps.filter(x=>x.name!=='browser')},{result:'FAIL'},{head:OLD}]){
    const v=evaluateAlphaRelease(args(complete(),{...local,...modified}));
    assert.equal(v.result,'BLOCKED');
  }
});
test('Production proof and last known good rollback are distinct required pins',()=>{
  for(const edit of [
    a=>a.deployment.production_verified=false,
    a=>a.deployment.version_id='not-a-version',
    a=>a.rollback.commit=HEAD,
    a=>a.rollback.version_id=null,
    a=>a.rollback.manual_recovery_checked=false]){
    const record=complete();edit(record);
    assert.equal(evaluateAlphaRelease(args(record)).result,'BLOCKED');
  }
});
test('Every physical/source/support observation is required for the current release commit',()=>{
  for(const name of ALPHA_REAL_WORLD_GATES){
    for(const change of [x=>x.status='NOT_RUN',x=>x.commit=OLD,x=>x.evidence_type='SYNTHETIC',x=>x.evidence_ref='private contact@example.com']){
      const a=complete();change(a.acceptance[name]);
      const r=evaluateAlphaRelease(args(a));assert.equal(r.result,'BLOCKED');assert.ok(r.blockers.includes('unverified_'+name));
    }
  }
});
test('CLI gate has no deployment, network, environment or content-bearing action',()=>{
  const src=readFileSync(new URL('../scripts/alpha-release-gate.mjs',import.meta.url),'utf8');
  assert.doesNotMatch(src,/fetch\(|XMLHttpRequest|sendBeacon|cloudflare.*api|deploy\s*\(/i);
  assert.match(src,/test-results\/alpha-release-decision\.json/);
  assert.match(src,/--untracked-files=normal/);
  assert.match(src,/sourceDigest/);
});
test('CLI evaluator treats stale or absent local proof as blocked without creating it',()=>{
  const fixture = { '/virtual/package.json':JSON.stringify({name:'drafttopage'}) };
  const seen=[];
  const r=examineAlphaRelease({root:'/virtual',
    read:p=>{seen.push(p); if(p in fixture)return fixture[p];throw new Error('missing')},
    git:args=>args.includes('HEAD')?HEAD:args.includes('--show-current')?'main':'',
    snapshot:()=>SOURCE});
  assert.equal(r.result,'BLOCKED');assert.ok(r.blockers.includes('fresh_complete_local_validation_required'));
  assert.ok(seen.some(p=>p.endsWith('release-results.json')));
});
