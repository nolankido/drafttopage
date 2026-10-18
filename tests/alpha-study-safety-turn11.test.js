import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { summarizeSessions, validateSession, ALPHA_ADDITIONAL_SAFETY_FLAGS } from '../scripts/alpha-study.mjs';

const blank=()=>JSON.parse(readFileSync(new URL('../docs/alpha/session-record-template.json',import.meta.url),'utf8'));
const observed=(id=1,qualified=true)=>{
  const r=blank();
  Object.assign(r,{status:'OBSERVED',session_id:'P'+String(id).padStart(2,'0'),
    release_commit:'a'.repeat(40),session_date:'2026-10-17',
    evidence_type:'HUMAN_OBSERVATION',participant_qualified:qualified,consent_to_record_outcomes:true,
    article_ending_retained:true,private_material_in_export:false,unrecoverable_writing_loss:false,
    unintended_persistence:false,unintended_publication:false,unexpected_external_request:false,
    wordpress_save_reopen_attempted:true,wordpress_native_blocks_editable:true,
    title_handling_understood:true,approval_understood:true,manual_publishing_understood:true});
  r.tasks=r.tasks.map(({id})=>({id,status:id==='T6'?'NOT_RUN':'PASS_UNAIDED',
    elapsed_seconds:id==='T6'?null:150,procedural_hints:id==='T6'?null:0}));
  return r;
};
test('All six stop conditions are represented by explicit observed incident counters',()=>{
  assert.deepEqual(ALPHA_ADDITIONAL_SAFETY_FLAGS,[
    'unintended_persistence','unintended_publication','unexpected_external_request'
  ]);
  const baseline=Array.from({length:10},(_,i)=>observed(i+1));
  assert.equal(summarizeSessions(baseline).expansion_decision,'OWNER_REVIEW_REQUIRED');
  for(const flag of ALPHA_ADDITIONAL_SAFETY_FLAGS){
    const samples=structuredClone(baseline);
    samples[4][flag]=true;
    const s=summarizeSessions(samples);
    assert.equal(s.expansion_decision,'STOP_FOR_SAFETY',flag);
    assert.equal(s.critical_incidents_all_human_observations[flag],1,flag);
    assert.equal(s.releases[0].safety[flag],1,flag);
    assert.equal(s.releases[0].targets.safety,'BLOCKED',flag);
  }
});
test('A single unqualified real human incident blocks cohort expansion',()=>{
  const records=Array.from({length:10},(_,i)=>observed(i+1));
  for(const flag of ALPHA_ADDITIONAL_SAFETY_FLAGS){
    const observedOther=observed(11,false);
    observedOther[flag]=true;
    const report=summarizeSessions([...records,observedOther]);
    assert.equal(report.expansion_decision,'STOP_FOR_SAFETY',flag);
    assert.equal(report.qualified_human_observations,10);
    assert.equal(report.critical_incidents_all_human_observations[flag],1);
  }
});
test('Missing safety outcomes are not counted as proof of absence',()=>{
  const records=Array.from({length:10},(_,i)=>observed(i+1));
  for(const flag of ALPHA_ADDITIONAL_SAFETY_FLAGS){
    const run=structuredClone(records);
    run[2][flag]=null;
    const report=summarizeSessions(run);
    assert.equal(report.expansion_decision,'HOLD_SAFETY_CHECKS_INCOMPLETE',flag);
    assert.equal(report.missing_safety_checks_all_human_observations,1);
    assert.equal(report.releases[0].targets.safety,'PENDING');
  }
});
test('Earlier v2 private records lacking new keys remain readable but fail safe',()=>{
  const older=observed(1);
  for(const flag of ALPHA_ADDITIONAL_SAFETY_FLAGS) delete older[flag];
  assert.doesNotThrow(()=>validateSession(older));
  const reports=summarizeSessions(Array.from({length:10},(_,i)=>{
    const r=structuredClone(older);r.session_id='P'+String(i+1).padStart(2,'0');return r;
  }));
  assert.equal(reports.expansion_decision,'HOLD_SAFETY_CHECKS_INCOMPLETE');
  assert.equal(reports.missing_safety_checks_all_human_observations,10);
  assert.equal(reports.releases[0].targets.safety,'PENDING');
});
test('Safety flags reject arbitrary text and unrun incidents',()=>{
  for(const flag of ALPHA_ADDITIONAL_SAFETY_FLAGS){
    for(const bad of ['PRIVATE_PERSONAL_ARTICLE','false',1,{},[],NaN]){
      const record=observed();record[flag]=bad;
      assert.throws(()=>validateSession(record),/observations/);
    }
    const unrun=blank();unrun[flag]=true;
    assert.throws(()=>validateSession(unrun),/unrun/);
  }
});
test('Synthetic fixtures never create human safety outcomes',()=>{
  const fake=observed();fake.evidence_type='SYNTHETIC';fake.unintended_publication=true;
  const report=summarizeSessions([fake]);
  assert.equal(report.human_observations,0);
  assert.equal(report.study_status,'NOT_RUN');
  assert.equal(report.expansion_decision,'WAIT_FOR_QUALIFIED_SESSIONS');
  assert.equal(report.critical_incidents_all_human_observations.unintended_publication,0);
});
test('Unfinished WordPress and first conversion keep owner review blocked',()=>{
  const rec=Array.from({length:10},(_,i)=>observed(i+1));
  for(const record of rec)record.tasks[0]={id:'T1',status:'NOT_RUN',elapsed_seconds:null,procedural_hints:null};
  assert.equal(summarizeSessions(rec).expansion_decision,'HOLD_PRODUCT_TARGETS_OR_UNVERIFIED_DESTINATION');
  for(const record of rec)record.tasks[0]={id:'T1',status:'PASS_UNAIDED',elapsed_seconds:120,procedural_hints:0};
  for(const record of rec){record.wordpress_save_reopen_attempted=false;record.wordpress_native_blocks_editable=null;}
  assert.equal(summarizeSessions(rec).expansion_decision,'HOLD_PRODUCT_TARGETS_OR_UNVERIFIED_DESTINATION');
});
