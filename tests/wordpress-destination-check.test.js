import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { wordpressDestinationExpectations, destinationSummary, destinationStatus, WORDPRESS_DESTINATION_STEPS } from '../public/wordpress-destination-check.js';
import { installWordPressDestinationCheck } from '../public/wordpress-destination-controls.js';
import { validateHostedWordPressEvidence, HOSTED_WORDPRESS_STEPS } from '../scripts/validate-hosted-wordpress-evidence.mjs';

const template = JSON.parse(readFileSync(new URL('../docs/alpha/hosted-wordpress-record-template.json',import.meta.url),'utf8'));
test('WordPress local expectations distinguish body blocks from title and optional fields',()=>{
  const draft={ title:'Fictional post', body:'## Section\n\nA [safe link](https://example.com/).\n\n4. Alpha\n5. Beta\n\n| Item | Count |\n| --- | --- |\n| A | 2 |\n\nEND_UNIQUE_4827', excerpt:'Brief.', slug:'fictional-post', description:''};
  const result=wordpressDestinationExpectations(draft);
  assert.equal(result.titleProvided,true);
  assert.equal(result.headings,1); assert.equal(result.lists,1); assert.equal(result.tables,1); assert.equal(result.links,1);
  assert.deepEqual(result.optionalFields,['excerpt','slug']);
  assert.equal(result.sourceEnding,'END_UNIQUE_4827');
  assert.match(destinationSummary(result),/separate WordPress title field/);
  assert.doesNotMatch(destinationSummary(result),/Brief\.|fictional-post|END_UNIQUE/);
});
test('Destination expectation ending uses bounded current writing and no private notes',()=>{
  const result=wordpressDestinationExpectations({title:'A',body:'A long paragraph\n\n'+'😀'.repeat(100),questions:['PRIVATE_QUESTIONS'],notes:'PRIVATE_NOTES'});
  assert.equal(Array.from(result.sourceEnding).length,90);
  assert.equal(result.endingTruncated,true);
  assert.doesNotMatch(destinationSummary(result),/PRIVATE/);
  assert.match(destinationStatus(7),/not independent destination acceptance/);
  assert.match(destinationStatus(1),/cannot observe WordPress/);
});
class Node {
  constructor(){ this.value='';this.checked=false;this.disabled=false;this.textContent='';this.open=true;this.listeners=new Map(); }
  addEventListener(name,fn){ this.listeners.set(name,fn); }
  fire(name='change'){this.listeners.get(name)?.();}
}
test('Manual WordPress receipt resets on changed article, changed destination and approval',()=>{
  const map=new Map(), $=id=>{if(!map.has(id))map.set(id,new Node());return map.get(id)};
  const draft={title:'Test',body:'Body\n\nENDING_1',excerpt:'',slug:'',description:''};
  $('publishing-destination').value='wordpress'; $('reviewed').checked=true;
  const ctl=installWordPressDestinationCheck({$,getDraft:()=>draft,getWordPressOptions:()=>({includeLinkedImages:false}),isBusy:()=>false});
  ctl.update();
  for(const id of WORDPRESS_DESTINATION_STEPS) assert.equal($('wp-destination-'+id).disabled,false);
  $('wp-destination-saved-draft').checked=true; $('wp-destination-saved-draft').fire();
  assert.match($('wordpress-destination-status').textContent,/1 of 7/);
  draft.body='Body\n\nENDING_2';ctl.update();
  assert.equal($('wp-destination-saved-draft').checked,false);
  assert.equal($('wordpress-destination-ending').textContent.includes('ENDING_2'),true);
  $('wp-destination-reopened-draft').checked=true;
  $('reviewed').checked=false;ctl.update();
  assert.equal($('wp-destination-reopened-draft').checked,false);
  assert.equal($('wp-destination-paste').disabled,true);
  $('reviewed').checked=true;ctl.update();
  $('wp-destination-title').checked=true;
  $('publishing-destination').value='word';ctl.update();assert.equal($('wp-destination-title').checked,false);
  assert.equal($('wordpress-destination-expectations').textContent,'');
});
test('Hosted WordPress template cannot be reported as success',()=>{
  assert.equal(validateHostedWordPressEvidence(template).result,'NOT_RUN');
  assert.equal(HOSTED_WORDPRESS_STEPS.length,19);
});
test('Hosted destination validator distinguishes observed failure, omission, and self-report',()=>{
  const observed=structuredClone(template);
  Object.assign(observed,{status:'OBSERVED',evidence_type:'HUMAN_OBSERVATION',observed_at:'2026-10-17T12:00:00Z',release_commit:'f'.repeat(40),paste_mode:'code-editor-fallback',post_status:'draft',source_transport:'copy-button'});
  Object.assign(observed.environment,{wordpress_version:'6.8.3',browser_family_and_version:'FictionalBrowser 1',editor_role:'editor',plugins_affecting_editor:'none observed'});
  Object.assign(observed.expected_counts,{web_links:0,list_groups:1,tables:0,linked_images:0,optional_fields:0});
  for(const id of HOSTED_WORDPRESS_STEPS)observed.observed[id]=true;
  for(const key of ['web_links_correct','table_headers_correct','images_and_alt_text_correct','optional_fields_checked'])observed.observed[key]='NOT_APPLICABLE';
  assert.equal(validateHostedWordPressEvidence(observed).result,'OBSERVED_MANUAL_PASS');
  observed.observed.saved_second_edit=null;
  assert.equal(validateHostedWordPressEvidence(observed).result,'INCOMPLETE');
  observed.observed.saved_second_edit=false;
  assert.equal(validateHostedWordPressEvidence(observed).result,'OBSERVED_FAIL');
  observed.observed.saved_second_edit=true;
  observed.observed.list_starts_and_nesting_correct='NOT_APPLICABLE';
  assert.equal(validateHostedWordPressEvidence(observed).result,'INCOMPLETE');
  observed.observed.list_starts_and_nesting_correct=true;
  observed.source_transport='downloaded-block-file';
  observed.download_requested=true;
  assert.equal(validateHostedWordPressEvidence(observed).result,'INCOMPLETE');
  observed.download_saved_and_opened=true;
  assert.equal(validateHostedWordPressEvidence(observed).result,'OBSERVED_MANUAL_PASS');
});
test('Public hosted checklist is present, manual and backed by help guidance',()=>{
  const html=readFileSync(new URL('../scripts/writing-desk.html',import.meta.url),'utf8');
  const help=readFileSync(new URL('../scripts/publishing-handoff-help.html.inc',import.meta.url),'utf8');
  for(const id of WORDPRESS_DESTINATION_STEPS) assert.match(html,new RegExp('id="wp-destination-'+id+'"'));
  assert.match(html,/id="wordpress-destination-status"[^>]*role="status"/);
  assert.match(html,/cannot see your destination/);
  assert.match(help,/id="hosted-wordpress-acceptance"/);
  assert.match(help,/save the draft again/i);
});
