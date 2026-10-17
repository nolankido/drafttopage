import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { summarizeWordImageHandoff, wordImageDecisionReady, wordImageDecisionStatus, wordImageAfterApply } from '../public/word-image-handoff.js';
const c = { kind: 'Word document', wordImages: [{index:1},{index:2},{index:3}], draft:{body:'Text [Word image 1] [Word image 2] [Word image 3]'} };
const kit = { bytes:new Uint8Array([80,75,3,4]), images:[{name:'word-image-001.png'}], placements:[{placeholder:'[Word image 1]',filename:'word-image-001.png'},{placeholder:'[Word image 2]',filename:'word-image-001.png'},{placeholder:'[Word image 3]',filename:''}], skipped:[{placeholder:'[Word image 3]'}] };
test('No image positions introduces no extra import step',()=>{
  assert.equal(wordImageDecisionReady({wordImages:[]},'',null,false,false),true);
  assert.equal(wordImageDecisionReady({kind:'Markdown article'},'',null,false,false),true);
});
test('Word images fail closed until a deliberate choice and an acknowledged saved package',()=>{
  for(const [choice,k,requested,confirmed] of [['',kit,true,true],['kit',null,true,true],['kit',kit,false,true],['kit',kit,true,false]]) assert.equal(wordImageDecisionReady(c,choice,k,requested,confirmed),false);
  assert.equal(wordImageDecisionReady(c,'kit',kit,true,true),true);
  assert.equal(wordImageDecisionReady(c,'placeholders',null,false,false),true);
  assert.equal(wordImageDecisionReady(c,'placeholders',kit,false,false),true);
  assert.equal(wordImageDecisionReady(c,'other',kit,true,true),false);
});
test('Recovery counts reflect repeated placements and missing images without claiming publication',()=>{
  assert.match(summarizeWordImageHandoff(c,null),/3 numbered image\/object position/);
  const report=summarizeWordImageHandoff(c,kit);
  assert.match(report,/1 distinct file/);
  assert.match(report,/2 placement\(s\) mapped/);
  assert.match(report,/1 unresolved/);
  assert.match(report,/1 repeated placement/);
  assert.doesNotMatch(report,/PRIVATE|saved|uploaded|published/);
});
test('Download request is explicitly not proof of a saved archive',()=>{
  assert.match(wordImageDecisionStatus(c,'kit',kit,true,false),/not verified as saved/);
  assert.match(wordImageDecisionStatus(c,'kit',kit,true,true),/cannot verify/);
  assert.match(wordImageDecisionStatus(c,'kit',{...kit,bytes:null},true,true),/No supported image files/);
  assert.match(wordImageDecisionStatus(c,'placeholders',null,false,false),/manually later/);
  assert.match(wordImageAfterApply(c,'kit',kit),/1 unresolved placement/);
  assert.match(wordImageAfterApply(c,'placeholders',null),/3 Word image\/object placeholder/);
});
test('Generated import UI retains Word metadata and deliberate acknowledgement plus status',async()=>{
  const panel=await readFile(new URL('../scripts/import-panel.html.inc',import.meta.url),'utf8');
  const controller=await readFile(new URL('../public/import-controls.js',import.meta.url),'utf8');
  const at=s=>{const i=panel.indexOf(s);assert.ok(i>=0,s);return i;};
  assert.ok(at('id="word-image-decision"')<at('id="prepare-word-images"'));
  assert.ok(at('id="word-image-saved-ok"')<at('id="apply-import"'));
  for(const id of ['word-image-choice-kit','word-image-choice-placeholders','word-image-counts','word-image-decision-status','word-image-saved-ok','word-image-metadata-ok'])assert.match(panel,new RegExp('id="'+id+'"'));
  assert.match(controller,/wordImageDecisionReady\(candidate,/);
  assert.match(controller,/imageDownloadRequested = true/);
  assert.match(controller,/imageDownloadRequested = false/);
  assert.match(controller,/clearWordImages\(true\)/);
  assert.match(controller,/wordImageAfterApply\(candidate,/);
  assert.match(panel,/Download before importing|download, verify the saved ZIP|request download/i);
  assert.match(panel,/does not read the values, remove metadata, or guarantee/);
});
