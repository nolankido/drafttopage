import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { focusWorkflowTarget, measureWorkflow, installWorkflowNavigation } from '../public/workflow-navigation.js';

class Node {
  constructor(id, tagName = 'DIV', parent = null) { this.id=id;this.tagName=tagName;this.parentElement=parent;this.attrs={};this.dataset={};this.value='';this.checked=false;this.open=false;this.hidden=false;this.disabled=false;this.textContent='';this.events={};this.moves=[];this.focuses=[];this.style={setProperty:(key,value)=>{this.attrs[key]=value;}}; }
  addEventListener(name,fn) { (this.events[name] ||= []).push(fn); }
  fire(name='click') { for(const fn of this.events[name] || [])fn(); }
  setAttribute(name,value) { this.attrs[name]=value; }
  removeAttribute(name) { delete this.attrs[name]; }
  hasAttribute(name) { return Object.hasOwn(this.attrs,name); }
  focus(options) { this.focuses.push(options); }
  scrollIntoView(options) { this.moves.push(options); }
  getBoundingClientRect() { return {height:93.4}; }
}
function withUI(run, source='text') {
  const original={document:globalThis.document,window:globalThis.window,style:globalThis.getComputedStyle,observer:globalThis.ResizeObserver};
  const nodes=new Map(), main=new Node('main','MAIN'), $=id=>{if(!nodes.has(id))nodes.set(id,new Node(id,'DIV',main));return nodes.get(id);};
  const first=source==='word'?'start-word-file':source==='copied'?'start-copied-paste':'start-draft';
  $('workflow-steps').querySelector=()=>$(first);
  $('body').tagName='TEXTAREA';$('title').tagName='INPUT';$('publishing-destination').tagName='SELECT';$('publishing-destination').value='wordpress';
  $('preview-panel').tagName='DETAILS';$('article-preview').parentElement=$('preview-panel');$('article-preview').setAttribute('tabindex','0');
  $('import-panel').tagName='DETAILS';$('import-preview-heading').parentElement=$('import-panel');$('import-file').parentElement=$('import-panel');$('import-text').parentElement=$('import-panel');
  const events={}, moves=[];let pending={},busy=false,previewed=0,message='',position='sticky';
  globalThis.document={getElementById:$};globalThis.window={addEventListener:(name,fn)=>{events[name]=fn;}};
  globalThis.getComputedStyle=()=>({position});globalThis.ResizeObserver=undefined;
  const ui=installWorkflowNavigation({getDraft:()=>({title:$('title').value,body:$('body').value}),getImportState:()=>pending,isBusy:()=>busy,refreshPreview:()=>{previewed++;},report:text=>{message=text;},move:(target,options)=>{moves.push([target.id,options.anchor.id]);return focusWorkflowTarget(target,options);}});
  try{return run({$,ui,moves,main,first,previewed:()=>previewed,message:()=>message,setPending:value=>{pending=value;},setBusy:value=>{busy=value;},setPosition:value=>{position=value;},resize:()=>events.resize()});}
  finally{globalThis.document=original.document;globalThis.window=original.window;globalThis.getComputedStyle=original.style;globalThis.ResizeObserver=original.observer;}
}

test('Empty workspaces point to the correct input without approving, opening a picker, or exporting',()=>{
  for(const source of ['text','word','copied'])withUI(({$,ui,moves})=>{
    assert.equal($('workflow-steps').dataset.step,'bring');assert.equal($('review-current-article').hidden,true);assert.equal($('continue-to-export').hidden,true);
    ui.handoff();assert.equal(moves.at(-1)[0],source==='word'?'import-file':source==='copied'?'import-text':'body');
    assert.equal($('reviewed').checked,false);assert.equal($('body').value,'');assert.equal($('publishing-destination').value,'wordpress');
  },source);
});

test('Writing, reviewing, and choosing export move focus and scroll without changing data or approval',()=>withUI(({$,ui,moves,previewed})=>{
  $('title').value='Fictional title';$('body').value='An article to keep exactly.';ui.update();
  assert.equal($('workflow-steps').dataset.step,'review');assert.equal($('review-current-article').hidden,false);assert.equal($('continue-to-export').hidden,false);
  const before=[$('title').value,$('body').value,$('reviewed').checked,$('publishing-destination').value];
  $('review-current-article').fire();assert.equal(previewed(),1);assert.equal($('preview-panel').open,true);assert.deepEqual(moves.at(-1),['article-preview','conversion-heading']);
  $('continue-to-export').fire();assert.equal($('workflow-steps').dataset.step,'export');assert.deepEqual(moves.at(-1),['publishing-destination','export-heading']);
  assert.deepEqual([$('title').value,$('body').value,$('reviewed').checked,$('publishing-destination').value],before);
}));

test('Approval highlights export, return to preview preserves it, and edited writing returns to review',()=>withUI(({$,ui})=>{
  $('body').value='First article';ui.update();$('reviewed').checked=true;ui.update();
  assert.equal($('workflow-steps').dataset.step,'export');
  ui.review();assert.equal($('workflow-steps').dataset.step,'review');assert.equal($('reviewed').checked,true);
  $('reviewed').checked=false;$('body').value='Changed article';ui.update();assert.equal($('workflow-steps').dataset.step,'review');
  $('body').value='';ui.update();assert.equal($('workflow-steps').dataset.step,'bring');
}));

test('An unapplied import takes precedence over the existing article and cannot be skipped by navigation',()=>withUI(({$,ui,moves,setPending,previewed})=>{
  $('body').value='Keep existing article';$('reviewed').checked=true;ui.update();setPending({pending:true,staged:true});ui.update();
  assert.equal($('workflow-steps').dataset.step,'bring');assert.equal($('continue-to-export').hidden,true);assert.equal($('review-current-article').textContent,'Review pending import');
  ui.handoff();assert.deepEqual(moves.at(-1),['import-preview-heading','import-preview-heading']);assert.equal($('import-panel').open,true);assert.equal(previewed(),0);
  assert.equal($('body').value,'Keep existing article');assert.equal($('reviewed').checked,true);
  setPending({});ui.update();assert.equal($('continue-to-export').hidden,false);
},'word'));

test('Unpreviewed or failed imports return to source, and applying fresh writing resumes its review',()=>{
  for(const source of ['word','copied'])withUI(({$,ui,moves,setPending})=>{
    $('body').value='Original';ui.update();setPending({pending:true,staged:false});ui.update();ui.review();
    assert.equal(moves.at(-1)[0],source==='word'?'import-file':'import-text');
    setPending({});$('body').value='Imported body';$('reviewed').checked=false;ui.update();
    assert.equal($('workflow-steps').dataset.step,'review');assert.equal($('continue-to-export').hidden,false);
  },source);
});

test('File-operation busy state disables every navigation path and ignores programmatic clicks',()=>withUI(({$,ui,first,moves,previewed,setBusy})=>{
  $('body').value='Existing';ui.update();setBusy(true);ui.update();
  for(const id of [first,'start-review','start-handoff','review-current-article','continue-to-export']){assert.equal($(id).disabled,true);$(id).fire();}
  ui.select('export');
  assert.equal(moves.length,0);assert.equal(previewed(),0);assert.equal($('reviewed').checked,false);
  setBusy(false);ui.update();assert.equal($('start-handoff').disabled,false);assert.equal($('body').value,'Existing');assert.equal($('workflow-steps').dataset.step,'review');
}));

test('Destination changes update continuation and accessible labels while keeping manual approval intact',()=>withUI(({$,ui})=>{
  $('body').value='An article';$('reviewed').checked=true;ui.update();
  for(const [value,label] of [['wordpress','WordPress'],['word','Word'],['html','HTML source'],['other','another export']]){
    $('publishing-destination').value=value;ui.update();assert.equal($('continue-to-export').textContent,'Continue to '+label);
    assert.match($('start-handoff').attrs['aria-label'],/export/i);assert.equal($('reviewed').checked,true);
  }
}));

test('Measured sticky offsets and nested disclosures make explicit targets reachable without changing selection',()=>withUI(({$,main,ui,setPosition,resize})=>{
  const outer=new Node('outer','DETAILS',main),inner=new Node('inner','DETAILS',outer),target=new Node('target','TEXTAREA',inner);
  target.value='Writing';target.selectionStart=2;target.selectionEnd=5;
  assert.equal(focusWorkflowTarget(target,{bar:$('workflow-steps')}),true);
  assert.equal(outer.open,true);assert.equal(inner.open,true);assert.deepEqual(target.focuses,[{preventScroll:true}]);
  assert.deepEqual(target.moves,[{block:'start',inline:'nearest',behavior:'auto'}]);assert.equal(main.attrs['--workflow-offset'],'114px');
  assert.deepEqual([target.value,target.selectionStart,target.selectionEnd],['Writing',2,5]);
  setPosition('static');resize();assert.equal(main.attrs['--workflow-offset'],'20px');
  assert.equal(focusWorkflowTarget(null),false);measureWorkflow(null);
}));

test('Every workspace has a single compact step bar and reachable continuation controls in reading order',async()=>{
  const routes=['write','word-to-wordpress','google-docs-to-wordpress','markdown-to-wordpress','markdown-to-html','markdown-to-word'];
  const pages=Object.fromEntries(await Promise.all(routes.map(async route=>[route,await readFile('public/'+route+'/index.html','utf8')])));
  const result=JSON.parse(execFileSync('python3',['-c',String.raw`
import sys,json
from html.parser import HTMLParser
class P(HTMLParser):
 def __init__(self):super().__init__();self.stack=[];self.ids={};self.order=[]
 def handle_starttag(self,t,a):
  a=dict(a)
  if 'id' in a:
   assert a['id'] not in self.ids
   self.ids[a['id']]={'attrs':a,'parents':[v[1].get('id') for v in self.stack],'parentTag':self.stack[-1][0]};self.order.append(a['id'])
  if t not in 'area base br col embed hr img input link meta param source track wbr'.split():self.stack.append((t,a))
 def handle_endtag(self,t):assert self.stack[-1][0]==t;self.stack.pop()
out=[]
for route,html in json.load(sys.stdin).items():
 p=P();p.feed(html);assert not p.stack
 assert p.ids['workflow-steps']['parentTag']=='main'
 assert p.order.index('workflow-steps')<p.order.index('import-panel')<p.order.index('body')
 first='start-word-file' if route=='word-to-wordpress' else 'start-copied-paste' if route=='google-docs-to-wordpress' else 'start-draft'
 for key in [first,'start-review','start-handoff']:assert 'workflow-steps' in p.ids[key]['parents']
 assert p.ids[first]['attrs']['aria-current']=='step'
 for key in ['review-current-article','continue-to-export']:
  assert 'editing-tools' not in p.ids[key]['parents']
  assert 'hidden' in p.ids[key]['attrs']
 assert p.order.index('article-preview')<p.order.index('continue-to-export')<p.order.index('exports')
 assert p.ids['workflow-steps']['attrs']['aria-describedby']=='workflow-status'
 assert 'aria-live' not in p.ids['workflow-status']['attrs']
 out.append(route)
print(json.dumps(out))
`],{input:JSON.stringify(pages),encoding:'utf8'}));
  assert.deepEqual(result,routes);
  const css=await readFile('public/desk.css','utf8');assert.match(css,/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);assert.match(css,/@media\(max-height:560px\)\{\.workflow-steps\{position:static\}\}/);
});
