import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { plannedAlphaSlots } from '../scripts/alpha-session-plan.mjs';
import { summarizeSessions, validateSession, ISSUE_CATEGORIES, prioritizeAlphaIssues } from '../scripts/alpha-study.mjs';

const blank=()=>JSON.parse(readFileSync(new URL('../docs/alpha/session-record-template.json',import.meta.url),'utf8'));
const task=(id,value='PASS_UNAIDED',seconds=180,hints=0)=>({id,status:value,elapsed_seconds:seconds,procedural_hints:hints});
function observed(index,source='WORD',release='a'.repeat(40)) {
  const record=blank();
  Object.assign(record,{status:'OBSERVED',session_id:'P'+String(index).padStart(2,'0'),
    release_commit:release,session_date:'2026-10-17',source_cohort:source,
    evidence_type:'HUMAN_OBSERVATION',participant_qualified:true,consent_to_record_outcomes:true,
    unrecoverable_writing_loss:false,private_material_in_export:false,article_ending_retained:true,
    wordpress_save_reopen_attempted:true,wordpress_native_blocks_editable:true,
    title_handling_understood:true,approval_understood:true,manual_publishing_understood:true});
  record.tasks=record.tasks.map(({id})=>task(id));
  record.tasks[5]=task('T6','NOT_RUN',null,null);
  record.issue_categories=[];
  return record;
}
test('Unassigned plan is NOT_RUN with 5/3/2 sources and balanced paired order',()=>{
  const plan=plannedAlphaSlots();
  assert.equal(plan.status,'NOT_RUN'); assert.equal(plan.invited,0);assert.equal(plan.contacted,0);
  assert.equal(plan.slots.length,10);
  assert.deepEqual(plan.source_targets,{WORD:5,GOOGLE_DOCS:3,MARKDOWN:2});
  assert.deepEqual(plan.planned_order,{USUAL_FIRST:5,DRAFTTOPAGE_FIRST:5});
  for(const [key,count] of Object.entries(plan.source_targets)) assert.equal(plan.slots.filter(slot=>slot.source_target===key).length,count);
  assert.ok(plan.slots.every(slot=>slot.status==='UNASSIGNED'&&slot.participant_qualified===null));
});
test('Cohort proportions count actual recorded app categories and never reveal source names',()=>{
  const rec=[...Array.from({length:5},(_,i)=>observed(i+1,'WORD')),
    ...Array.from({length:3},(_,i)=>observed(i+6,'GOOGLE_DOCS')),
    ...Array.from({length:2},(_,i)=>observed(i+9,'MARKDOWN'))];
  assert.deepEqual(summarizeSessions(rec).actual_qualified_source_mix,{WORD:5,GOOGLE_DOCS:3,MARKDOWN:2,OTHER_OR_UNRECORDED:0});
  rec[0].source_cohort='PRIVATE_PERSONAL_SOURCE';
  const result=JSON.stringify(summarizeSessions(rec));
  assert.doesNotMatch(result,/PRIVATE_PERSONAL_SOURCE/);
  assert.equal(summarizeSessions(rec).releases[0].actual_source_mix.OTHER_OR_UNRECORDED,1);
});
test('Observed friction categories are sorted by affected participants without free text',()=>{
  const rec=Array.from({length:10},(_,i)=>observed(i+1));
  rec[0].issue_categories=['HANDOFF','PREVIEW'];
  rec[1].issue_categories=['HANDOFF'];
  rec[2].issue_categories=['FIDELITY','HANDOFF'];
  rec[3].issue_categories=['FIDELITY'];
  rec[0].issue_summaries=['PRIVATE_ISSUE_PERSON_NOT_FOR_OUTPUT'];
  const result=summarizeSessions(rec);
  assert.deepEqual(result.releases[0].issue_priority.slice(0,2),[
    {category:'HANDOFF',affected_sessions:3},{category:'FIDELITY',affected_sessions:2}
  ]);
  assert.equal(result.releases[0].issue_category_counts.PREVIEW,1);
  assert.doesNotMatch(JSON.stringify(result),/PRIVATE_ISSUE_PERSON_NOT_FOR_OUTPUT|P01/);
  assert.deepEqual(prioritizeAlphaIssues(Object.fromEntries(ISSUE_CATEGORIES.map(k=>[k,0]))),[]);
});
test('Freeform and duplicate issue-category attempts fail closed',()=>{
  for(const tags of [['PRIVATE_NAME'],['HANDOFF','HANDOFF'],['HANDOFF',null],['a'.repeat(500)],Array(7).fill('OTHER'),null,{},'HANDOFF']){
    const record=observed(1);record.issue_categories=tags;
    assert.throws(()=>validateSession(record));
  }
  const untouched=blank();untouched.issue_categories=['HANDOFF'];
  assert.throws(()=>validateSession(untouched),/unrun/);
  const previous=observed(1);delete previous.issue_categories;
  assert.doesNotThrow(()=>validateSession(previous));
});
test('Unqualified human incident blocks expansion for all cohorts',()=>{
  const rec=Array.from({length:10},(_,i)=>observed(i+1));
  const person=observed(11);person.participant_qualified=false;person.unrecoverable_writing_loss=true;
  const result=summarizeSessions([...rec,person]);
  assert.equal(result.qualified_human_observations,10);
  assert.equal(result.expansion_decision,'STOP_FOR_SAFETY');
  assert.equal(result.critical_incidents_all_human_observations.writing_loss,1);
});
test('Missing safety check holds invitations, despite otherwise passing outcomes',()=>{
  const rec=Array.from({length:10},(_,i)=>observed(i+1));
  rec[3].private_material_in_export=null;
  const result=summarizeSessions(rec);
  assert.equal(result.expansion_decision,'HOLD_SAFETY_CHECKS_INCOMPLETE');
  assert.equal(result.missing_safety_checks_all_human_observations,1);
});
test('Separate five-person release cohorts cannot pool into a ten-person alpha result',()=>{
  const rec=Array.from({length:10},(_,i)=>observed(i+1,'WORD',i<5?'a'.repeat(40):'b'.repeat(40)));
  const result=summarizeSessions(rec);
  assert.equal(result.study_status,'PARTIAL');
  assert.equal(result.expansion_decision,'HOLD_NO_SINGLE_RELEASE_COHORT');
  assert.deepEqual(result.releases.map(x=>x.qualified_observed),[5,5]);
});
test('Ten unrun placeholders yield zero outcomes and no priority claims',()=>{
  const result=summarizeSessions(Array.from({length:10},()=>blank()));
  assert.equal(result.study_status,'NOT_RUN');
  assert.equal(result.expansion_decision,'WAIT_FOR_QUALIFIED_SESSIONS');
  assert.equal(result.human_observations,0);
  assert.deepEqual(result.issue_priority_qualified,[]);
  assert.deepEqual(result.releases,[]);
});
