import test from 'node:test';
import assert from 'node:assert/strict';
import { reviewExport, exportReviewText, formattingActionLabel } from '../public/export-review.js';
import { wordPressReviewText } from '../public/wordpress-review.js';
import { createWordPressArticle } from '../public/wordpress-export.js';
import { installExportReview } from '../public/export-review-controls.js';
import { installWordPressHandoff } from '../public/wordpress-handoff-controls.js';

const draft = body => ({title:'Fictional article',body,excerpt:'',description:'',slug:'',questions:['PRIVATE_REVIEW_962'],source:'PRIVATE_SOURCE_962'});
const unresolved = review => review.findings.filter(item=>item.kind==='word-image');

test('Unresolved original and legacy Word image labels get exact Unicode/CRLF positions in all destinations',()=>{
  const body='日本語 😀 before \\[Word image 12\\] after.\r\n\r\nRepeated [Word image 12].\r\n\r\n[Image or object omitted from Word document]';
  for(const destination of ['wordpress','word','html']){
    const found=unresolved(reviewExport(draft(body),{destination}));
    assert.deepEqual(found.map(item=>item.line),[1,3,5]);
    assert.deepEqual(found.map(item=>body.slice(item.start,item.end)),['\\[Word image 12\\]','[Word image 12]','[Image or object omitted from Word document]']);
    assert.notEqual(found[0].start,found[1].start);assert.ok(found.every(item=>item.message.includes('possible Word image placeholder')));
  }
});
test('Word placeholder detection protects fenced/inline code, links, image labels and URLs',()=>{
  const body='```\n[Word image 1]\n```\n\n`[Word image 2]`\n\n[Word image 3](https://example.com/report)\n\n![Word image 4](https://example.com/photo.png)\n\n[Read report](https://example.com/[Word-image-5])';
  for(const destination of ['wordpress','word','html'])assert.deepEqual(unresolved(reviewExport(draft(body),{destination})),[]);
});
test('Placeholder findings do not invent recovered images, embed bytes, rewrite writing or grant linked-image consent',()=>{
  const value=draft('[Word image 9]'),before=structuredClone(value);
  for(const destination of ['wordpress','word','html']){
    const review=reviewExport(value,{destination});assert.equal(unresolved(review).length,1);
    if(destination!=='wordpress')assert.match(review.findings[0].message,/Image Markdown also stays text/);
  }
  for(const includeLinkedImages of [false,true]){const article=createWordPressArticle(value,{includeLinkedImages});assert.equal(article.imageCount,0);assert.doesNotMatch(article.html,/wp:image|<img/);assert.match(article.html,/Word image 9/);}
  assert.deepEqual(value,before);
});
test('Word image findings respect the shared bound and complete total across repeated occurrences',()=>{
  const value=draft(Array(100).fill('[Word image 7]').join('\n\n'));
  const review=reviewExport(value);assert.equal(review.totalFindings,100);assert.equal(review.findings.length,40);assert.equal(review.truncated,true);
  assert.ok(review.findings.every((item,index)=>item.line===index*2+1));
});
test('Separate review reports include unresolved-image instructions and exclude private fields',()=>{
  const value=draft('Before.\n\n[Word image 2]');
  for(const destination of ['word','html']){const text=exportReviewText(value,{destination});assert.match(text,/Line 3: This possible Word image placeholder/);assert.doesNotMatch(text,/PRIVATE_REVIEW_962|PRIVATE_SOURCE_962/);}
  const text=wordPressReviewText(value);assert.match(text,/choose linked Image blocks separately/);assert.doesNotMatch(text,/PRIVATE_REVIEW_962|PRIVATE_SOURCE_962/);
});
test('Only findings with deliberate existing preparation controls have a suggested action',()=>{
  for(const kind of ['word-image','image','image-alt','reference'])assert.ok(formattingActionLabel({kind}));
  for(const kind of ['strike','table','list','html','title','fence','placeholder','unknown'])assert.equal(formattingActionLabel({kind}),'');
});

class Node {
  constructor(){this.value='';this.checked=false;this.open=false;this.children=[];this.events={};this.textContent='';this.attrs={};}
  append(...nodes){this.children.push(...nodes);}
  replaceChildren(...nodes){this.children=nodes;}
  addEventListener(name,fn){this.events[name]=fn;}
  fire(){return this.events.click?.();}
  setAttribute(name,value){this.attrs[name]=value;}
  setSelectionRange(start,end){this.selection=[start,end];}
  focus(){this.focused=true;}
}
async function controls(destination,run,{open=true}={}){
  const previous=globalThis.document,nodes=new Map(),$=id=>{if(!nodes.has(id))nodes.set(id,new Node());return nodes.get(id);};
  globalThis.document={getElementById:$,createElement:()=>new Node()};
  const state={draft:draft('Before [Word image 2] after.'),busy:false,linked:false,opened:[],messages:[],result:()=>true};
  $('publishing-destination').value=destination;$('wordpress-review-panel').open=true;$('export-format-review').open=true;$('reviewed').checked=true;
  const options={getDraft:()=>state.draft,isBusy:()=>state.busy,report:message=>state.messages.push(message),reveal:()=>{},move:node=>node.focus(),approved:()=>{},getWordPressOptions:()=>({includeLinkedImages:state.linked}),openFinding:open?item=>{state.opened.push({...item});return state.result(item);}:null};
  const ui=destination==='wordpress'?installWordPressHandoff(options):installExportReview(options);
  const list=()=>$(destination==='wordpress'?'wordpress-findings':'export-format-findings');
  try{ui.update();await run({$,state,ui,list,action:()=>list().children[0].children[2]});}finally{globalThis.document=previous;}
}
test('Current WordPress, Word and HTML findings open deliberate preparation without changing writing or approval',async()=>{
  for(const destination of ['wordpress','word','html'])await controls(destination,({$,state,ui,list,action})=>{
    const before=structuredClone(state.draft),button=action();assert.match(button.textContent,/Prepare this Word image/);
    ui.update();assert.equal(action(),button);button.fire();assert.equal(state.opened.length,1);
    assert.equal(state.draft.body.slice(state.opened[0].start,state.opened[0].end),'[Word image 2]');assert.deepEqual(state.draft,before);assert.equal($('reviewed').checked,true);assert.equal(state.linked,false);
    state.draft=draft('Read [article][report].\n\n[report]: https://example.com/report');ui.update();
    const row=list().children.find(item=>item.children[2]?.textContent==='Review reference-link conversion');assert.ok(row);row.children[2].fire();assert.equal(state.opened.at(-1).kind,'reference');
  });
});
test('Saved action buttons reject changed article, title, destination, and Word/HTML title handling',async()=>{
  for(const destination of ['wordpress','word','html'])await controls(destination,({$,state,ui,action})=>{
    let old=action();state.draft.body='Changed body.';old.fire();assert.equal(state.opened.length,0);assert.equal($('body').selection,undefined);
    state.draft=draft('[Word image 2]');ui.update();old=action();state.draft.title='Changed title';old.fire();assert.equal(state.opened.length,0);
    ui.update();old=action();$('publishing-destination').value='markdown';old.fire();assert.equal(state.opened.length,0);
    if(destination!=='wordpress'){$('publishing-destination').value=destination;ui.update();old=action();$(destination==='word'?'word-include-title':'html-include-title').checked=true;old.fire();assert.equal(state.opened.length,0);}
  });
});
test('Changed WordPress linked-image options invalidate saved actions before opening a tool',()=>controls('wordpress',({state,ui,action})=>{
  const old=action();state.linked=true;old.fire();assert.equal(state.opened.length,0);assert.match(state.messages.at(-1),/article changed/);ui.update();action().fire();assert.equal(state.opened.length,1);
}));
test('Busy operations block tool actions without selecting old text or changing approval',async()=>{
  for(const destination of ['wordpress','word','html'])await controls(destination,({$,state,ui,action})=>{
    const old=action();state.busy=true;ui.update();old.fire();assert.equal(state.opened.length,0);assert.equal($('body').selection,undefined);assert.equal($('reviewed').checked,true);
  });
});
test('Unavailable, unsupported and failed preparation controls retain exact manual source inspection',async()=>{
  for(const destination of ['wordpress','word','html'])await controls(destination,({$,state,action})=>{
    for(const result of [()=>false,()=>{throw Error('Unavailable');}]){state.result=result;action().fire();assert.equal(state.draft.body.slice(...$('body').selection),'[Word image 2]');assert.match(state.messages.at(-1),/exact source is selected/);assert.equal($('reviewed').checked,true);}
  });
});
test('A failed callback that changes the source cannot select or claim an outdated passage',async()=>{
  for(const destination of ['wordpress','word','html'])await controls(destination,({$,state,action})=>{
    state.result=()=>{state.draft.body='Changed during control opening.';return false;};action().fire();assert.equal($('body').selection,undefined);assert.match(state.messages.at(-1),/changed/);assert.doesNotMatch(state.messages.at(-1),/exact source is selected/);
  });
});
test('Cached pages without a tool callback retain ordinary exact inspection and no inert action',()=>controls('wordpress',({$,list})=>{
  assert.equal(list().children[0].children.length,2);list().children[0].children[1].fire();assert.deepEqual($('body').selection,[7,21]);
},{open:false}));
