import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { copyEditableTable, emptyEditableTable, tableEditTarget, newTableTarget, recheckTableTarget, editableTableMarkdown, changeEditableTable, planTableEdit } from '../public/table-editing.js';
import { markdownTableRanges } from '../public/markdown-table.js';
import { installTableEditor } from '../public/table-editor-controls.js';
import { createWordPressArticle } from '../public/wordpress-export.js';
import { createHTMLSource } from '../public/html-export.js';
import { createWordDocument } from '../public/word-export.js';
import { createWorkspaceBackup, parseWorkspaceBackup } from '../public/workspace.js';
import { createCheckpointHistory } from '../public/revisions.js';

const source='| Step | Plan |\n| :--- | ---: |\n| Welcome | **Share** a short introduction |\n| Read | Take turns |';
const article=()=> '日本語 😀 opening.\n\n'+source+'\n\nThe ending.';
const model=()=>({head:['Step','Plan'],align:['left','right'],rows:[['Welcome','**Share** a short introduction'],['Read','Take turns']]});

test('Table serialization preserves inline Markdown, Unicode, literal pipes, alignment and parser round trips',()=>{
  const value={head:['日本語 😀','Plan | notes'],align:['center',null],rows:[['**Keep** and [guide](https://example.com/a?x=1&y=2)','<svg> stays text'],['Back\\\\slash','Literal | pipe']]};
  const before=JSON.stringify(value),markdown=editableTableMarkdown(value),parsed=markdownTableRanges(markdown)[0];
  assert.equal(parsed.supported,true);assert.deepEqual(copyEditableTable(parsed.table),value);assert.ok(markdown.includes('Plan \\| notes'));assert.equal(JSON.stringify(value),before);
  const trimmed=editableTableMarkdown({...value,head:['  Name  ','Plan'],rows:[['  A  ',' B ']]});assert.deepEqual(copyEditableTable(markdownTableRanges(trimmed)[0].table).rows,[['A','B']]);
});
test('Cell, model, dimension and round-trip limits reject atomically without truncation or invented headers',()=>{
  for(const value of [null,{}, {...model(),align:['left']},{...model(),align:['justify',null]},{...model(),rows:[['short']]},{...model(),rows:Array(101).fill(['A','B'])},{head:Array(13).fill('H'),align:Array(13).fill(null),rows:[]}])assert.throws(()=>copyEditableTable(value));
  for(const text of ['x'.repeat(2001),'a\nb','a\rb','a\0b','a\u2028b',null])assert.throws(()=>editableTableMarkdown({...model(),rows:[[text,'B']]}));
  assert.throws(()=>editableTableMarkdown(emptyEditableTable()),/header/);
  assert.throws(()=>editableTableMarkdown({...model(),rows:[['one\\|pipe','B']]}),/round-trip/);
  assert.ok(editableTableMarkdown({...model(),rows:[['x'.repeat(2000),'B']]}));
  assert.throws(()=>editableTableMarkdown(model(),'\r'));
});
test('Exact source replacement retains all surrounding UTF-16 and CRLF characters and preserves original no-ops',()=>{
  for(const newline of ['\n','\r\n']){
    const body=article().replaceAll('\n',newline),start=body.indexOf('| Step'),target=tableEditTarget(body,start+3),before=JSON.stringify(target),cells=copyEditableTable(target.table);
    assert.equal(body.slice(target.start,target.end),target.before);assert.equal(target.before.endsWith('\r'),false);
    const noop=planTableEdit(target,cells,body);assert.equal(noop.changed,false);assert.equal(noop.body,body);
    cells.rows[1][1]='Read together';const plan=planTableEdit(target,cells,body);
    assert.equal(plan.body,body.slice(0,target.start)+plan.replacement+body.slice(target.end));assert.ok(plan.body.endsWith(newline+newline+'The ending.'));
    assert.equal(plan.body.slice(plan.selectionStart,plan.selectionEnd),plan.markdown);assert.equal(JSON.stringify(target),before);
    assert.deepEqual(copyEditableTable(markdownTableRanges(plan.body)[0].table).rows[1],['Read','Read together']);
  }
});
test('Unsupported tables, fenced code, invalid selections, null bodies and split CRLF/surrogates are rejected',()=>{
  for(const body of ['| H | H |\n| --- | --- |\n| A |','| H |\n| - |\n| A |','~~~\n'+source+'\n~~~'])assert.throws(()=>tableEditTarget(body,body.indexOf('|')));
  for(const [body,start,end] of [['😀',1,1],['a\r\nb',2,2],[article(),-1,2],[article(),0,60001],[article(),0.5,2],[article(),5,3]])assert.throws(()=>tableEditTarget(body,start,end));
  for(const body of [null,'x'.repeat(60001),'x\0y'])assert.throws(()=>newTableTarget(body));
  const large='| H |\n| --- |\n| '+'x'.repeat(2001)+' |';assert.throws(()=>tableEditTarget(large,0),/2,000/);
});
test('New tables append with bounded paragraph separation after headings, lists, closed code, blank or empty writing',()=>{
  for(const body of ['', 'Opening.', '# Heading','- Item','~~~\ncode\n~~~','Opening.\n\n','Opening.\r\n']){
    const target=newTableTarget(body),plan=planTableEdit(target,model(),body);
    assert.ok(plan.body.startsWith(body));assert.equal(markdownTableRanges(plan.body).filter(x=>x.supported).length,1);assert.equal(plan.body.slice(plan.selectionStart,plan.selectionEnd),plan.markdown);
  }
  assert.throws(()=>newTableTarget('~~~\ncode'),/Close/);
  assert.throws(()=>planTableEdit(newTableTarget('a'.repeat(59999)),model(),'a'.repeat(59999)),/60,000/);
  const big={head:Array(12).fill('H'),align:Array(12).fill(null),rows:Array.from({length:100},()=>Array(12).fill('x'.repeat(2000)))};assert.throws(()=>editableTableMarkdown(big),/60,000/);
});
test('Shape operations are immutable, keep every unrelated cell/alignment, and enforce minimum and maximum dimensions',()=>{
  const value=model(),before=JSON.stringify(value),row=changeEditableTable(value,'insert-row',1);assert.deepEqual(row.rows,[value.rows[0],['',''],value.rows[1]]);
  assert.deepEqual(changeEditableTable(row,'remove-row',1),value);
  const column=changeEditableTable(value,'insert-column',1);assert.deepEqual(column.head,['Step','','Plan']);assert.deepEqual(column.align,['left',null,'right']);assert.deepEqual(column.rows[1],['Read','','Take turns']);assert.deepEqual(changeEditableTable(column,'remove-column',1),value);assert.equal(JSON.stringify(value),before);
  assert.throws(()=>changeEditableTable({head:['H'],align:[null],rows:[]},'remove-column',0),/at least one/);
  assert.throws(()=>changeEditableTable({...value,rows:Array(100).fill(['A','B'])},'insert-row',0),/100/);
  assert.throws(()=>changeEditableTable({head:Array(12).fill('H'),align:Array(12).fill(null),rows:[]},'insert-column',0),/12/);
  for(const [action,index] of [['other',0],['remove-row',50],['insert-row',-1],['insert-column',2.5]])assert.throws(()=>changeEditableTable(value,action,index));
});
test('Stale targets require an explicit chosen location; rechecking repeated identical tables keeps the chosen occurrence',()=>{
  const body=article(),target=tableEditTarget(body,body.indexOf('| Step')),cells=model();cells.rows[0][0]='Prepared edit';
  const changed='New intro.\n\n'+body+'\n\n'+source;assert.throws(()=>planTableEdit(target,cells,changed),/article changed/);
  const second=changed.lastIndexOf('| Step'),rechecked=recheckTableTarget(target,changed,second),plan=planTableEdit(rechecked,cells,changed);
  assert.ok(plan.body.slice(0,second).includes(source));assert.equal(markdownTableRanges(plan.body)[1].table.rows[0][0],'Prepared edit');
  const altered=body.replace('Take turns','Different cells');assert.throws(()=>recheckTableTarget(target,altered,altered.indexOf('| Step')),/different source/);
  const next=newTableTarget(body),newBody=body+' More prose.';assert.equal(recheckTableTarget(next,newBody).start,newBody.length);
});
test('Table removal affects only the complete original source and ignores invalid pending cells',()=>{
  const body=article(),target=tableEditTarget(body,body.indexOf('| Step')),plan=planTableEdit(target,null,body,'remove');
  assert.equal(plan.body,body.slice(0,target.start)+body.slice(target.end));assert.equal(plan.replacement,'');assert.equal(markdownTableRanges(plan.body).length,0);
  assert.throws(()=>planTableEdit(newTableTarget(''),model(),'','remove'),/existing/);assert.throws(()=>planTableEdit(target,model(),body,'all'));
});
test('Independent HTML and Word parsing verifies native table structure, headers, alignment and escaped content',()=>{
  const value=model();value.head[1]='Plan | notes';value.rows[0][1]='<svg> & **Share**';const draft={title:'Fictional',excerpt:'',description:'',slug:'',questions:['PRIVATE_REVIEW'],body:editableTableMarkdown(value)};
  for(const html of [createWordPressArticle(draft).html,createHTMLSource(draft)]){
    const result=JSON.parse(execFileSync('python3',['-c',String.raw`
import sys,json
from html.parser import HTMLParser
class Parser(HTMLParser):
 def __init__(self):super().__init__();self.tags=[];self.headers=[];self.text=[]
 def handle_starttag(self,tag,attrs):
  self.tags.append(tag)
  if tag=='th':self.headers.append(dict(attrs))
 def handle_data(self,text):self.text.append(text)
p=Parser();p.feed(sys.stdin.read());assert 'svg' not in p.tags
print(json.dumps({'headers':p.headers,'rows':p.tags.count('tr'),'text':''.join(p.text)}))
`],{input:html,encoding:'utf8'}));
    assert.equal(result.headers.length,2);assert.equal(result.rows,3);assert.ok(result.headers.every(x=>x.scope==='col'));assert.ok(result.text.includes('Plan | notes'));assert.ok(result.text.includes('<svg> & Share'));assert.doesNotMatch(html,/PRIVATE_REVIEW/);
  }
  const parsed=JSON.parse(execFileSync('python3',['-c',String.raw`
import sys,io,zipfile,json,xml.etree.ElementTree as E
w={'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
with zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())) as z:
 d=E.fromstring(z.read('word/document.xml'))
 print(json.dumps({'tables':len(d.findall('.//w:tbl',w)),'rows':len(d.findall('.//w:tr',w)),'headers':len(d.findall('.//w:tblHeader',w)),'text':''.join(d.itertext())}))
`],{input:createWordDocument(draft),encoding:'utf8'}));assert.equal(parsed.tables,1);assert.equal(parsed.rows,3);assert.equal(parsed.headers,1);assert.ok(parsed.text.includes('Plan | notes'));
});

class Node {
  constructor(tag,registry){this.tag=tag;this.registry=registry;this.children=[];this.events=new Map();this.dataset={};this.value='';this.open=false;this.disabled=false;this.hidden=false;this.checked=false;this.selectionStart=0;this.selectionEnd=0;this._id='';this._text='';}
  set id(value){this._id=value;this.registry.set(value,this);}get id(){return this._id;}
  set textContent(value){this._text=String(value);this.children=[];}get textContent(){return this._text+this.children.map(x=>x.textContent).join('');}
  addEventListener(type,fn){if(!this.events.has(type))this.events.set(type,[]);this.events.get(type).push(fn);}fire(type,event={}){for(const fn of this.events.get(type)||[])fn(event);}
  append(...nodes){this.children.push(...nodes);}
  replaceChildren(...nodes){const remove=node=>{for(const child of node.children)remove(child);if(node.id&&this.registry.get(node.id)===node)this.registry.delete(node.id);};for(const child of this.children)remove(child);this.children=nodes;if(this.tag==='select')this.value=nodes[0]?.value||'';}
  querySelectorAll(selector){const tags=selector.split(',');return this.children.flatMap(x=>[...(tags.includes(x.tag)?[x]:[]),...x.querySelectorAll(selector)]);}
  setAttribute(name,value){this[name]=value;}focus(){this.focused=true;}setSelectionRange(start,end){this.selectionStart=start;this.selectionEnd=end;}
}
function controls(run,{open=true,ancestorOpen=true}={}){
  const prior=globalThis.document,map=new Map(),$=id=>{if(!map.has(id)){const node=new Node(id==='table-select'?'select':'',map);node.id=id;}return map.get(id);};globalThis.document={getElementById:$,createElement:tag=>new Node(tag,map)};
  const workspace={source:{profile:'personal',audience:'',purpose:'',notes:'PRIVATE_SOURCE'},draft:{title:'Fictional',excerpt:'',description:'',slug:'',questions:['PRIVATE_REVIEW'],body:article()}};
  let busy=false,approval=true,linked=true,checkpointFailure=false,applies=0,confirmation=true,report='',workChanges=0,renders=0,renderFailure=false,inspections=0,inspectionFailure=false;
  const history=createCheckpointHistory();$('body').value=workspace.draft.body;
  $('table-editor-panel').open=open;$('table-editor-panel').parentElement=$('tools');$('tools').tagName='DETAILS';$('tools').open=ancestorOpen;
  const ui=installTableEditor({getBody:()=>$('body').value,inspect:body=>{inspections++;if(inspectionFailure)throw Error('Inspection unavailable.');return markdownTableRanges(body);},isBusy:()=>busy,workChanged:()=>{workChanges++;},report:text=>{report=text;},confirmAction:()=>confirmation,reveal:()=>{},render:(node,title,body)=>{if(renderFailure)throw Error('Preview unavailable.');renders++;const child=new Node('table',map);child.textContent=body;node.replaceChildren(child);},apply:(plan,label)=>{if(checkpointFailure)throw Error('Checkpoint failed.');history.save(workspace,label);workspace.draft.body=plan.body;$('body').value=plan.body;approval=false;linked=false;applies++;ui.refresh();}});
  const prepare=()=>{$('table-open-selected').fire('click');$('table-cell-1-1').value='Read together';$('table-cell-1-1').fire('input');$('table-preview-change').fire('click');};
  const button=text=>$('table-grid').querySelectorAll('button').find(x=>x.textContent===text);
  try{run({$,ui,map,button,workspace,history,prepare,approval:()=>approval,linked:()=>linked,applies:()=>applies,report:()=>report,workChanges:()=>workChanges,renders:()=>renders,inspections:()=>inspections,failInspect:value=>{inspectionFailure=value;},busy:value=>{busy=value;ui.refresh();},failCheckpoint:()=>{checkpointFailure=true;},failRender:()=>{renderFailure=true;},confirm:value=>{confirmation=value;}});}finally{globalThis.document=prior;}
}
test('Closed inventory never inspects until opened and caches only the unchanged current article',()=>controls(({$,ui,inspections,approval,applies})=>{
  assert.equal(inspections(),0);assert.equal($('table-select').children.length,0);assert.match($('table-list-status').textContent,/Open table editing/);
  ui.refresh();$('body').value+='\n\n'+source;ui.refresh();assert.equal(inspections(),0);
  $('table-editor-panel').open=true;$('table-editor-panel').fire('toggle');assert.equal(inspections(),1);assert.equal($('table-select').children.length,2);
  $('table-select').value='1';const second=$('table-select').children[1];ui.refresh();assert.equal(inspections(),1);
  $('table-editor-panel').open=false;$('table-editor-panel').fire('toggle');assert.equal($('table-open-selected').disabled,true);$('table-open-selected').fire('click');assert.equal(ui.hasWork(),false);
  $('table-editor-panel').open=true;$('table-editor-panel').fire('toggle');assert.equal(inspections(),1);assert.equal($('table-select').value,'1');assert.equal($('table-select').children[1],second);
  assert.equal(approval(),true);assert.equal(applies(),0);
},{open:false}));
test('Containing disclosures defer inspection and purge obsolete choices before opening current source',()=>controls(({$,ui,inspections})=>{
  assert.equal(inspections(),0);$('table-editor-panel').fire('toggle');assert.equal(inspections(),0);
  $('tools').open=true;$('tools').fire('toggle');assert.equal(inspections(),1);assert.equal($('table-select').children.length,1);
  $('tools').open=false;$('tools').fire('toggle');$('body').value='No tables now.';ui.refresh();assert.equal(inspections(),1);assert.equal($('table-select').children.length,0);assert.equal($('table-select').value,'');
  $('table-editor-panel').open=false;$('table-editor-panel').fire('toggle');$('tools').open=true;$('tools').fire('toggle');assert.equal(inspections(),1);
  $('table-editor-panel').open=true;$('table-editor-panel').fire('toggle');assert.equal(inspections(),2);assert.equal($('table-select').children.length,0);
},{ancestorOpen:false}));
test('Hidden source changes keep prepared cells but clear preview and require the exact chosen occurrence',()=>controls(({$,ui,prepare,inspections,applies,approval})=>{
  prepare();const cell=$('table-cell-1-1'),count=inspections();$('table-editor-panel').open=false;$('table-editor-panel').fire('toggle');
  const current='New intro.\n\n'+$('body').value+'\n\n'+source;$('body').value=current;ui.refresh();assert.equal(inspections(),count);assert.equal($('table-select').children.length,0);assert.equal($('table-after').value,'');assert.equal($('table-apply').disabled,true);assert.equal(cell.value,'Read together');
  $('table-open-selected').fire('click');$('table-apply').fire('click');assert.equal(applies(),0);assert.equal(approval(),true);
  $('table-editor-panel').open=true;$('table-editor-panel').fire('toggle');assert.equal(inspections(),count+1);assert.equal($('table-cell-1-1'),cell);$('table-select').value='1';$('table-recheck').fire('click');assert.equal($('table-apply').disabled,true);
  $('table-preview-change').fire('click');$('table-apply').fire('click');assert.equal(applies(),1);assert.equal(markdownTableRanges($('body').value)[0].table.rows[1][1],'Take turns');assert.equal(markdownTableRanges($('body').value)[1].table.rows[1][1],'Read together');
}));
test('Lazy inventory retains the forty-choice bound and later-table cursor fallback',()=>controls(({$,ui,inspections,approval,applies})=>{
  $('body').value=Array(45).fill(source).join('\n\n');ui.refresh();assert.equal(inspections(),0);
  $('table-editor-panel').open=true;$('table-editor-panel').fire('toggle');assert.equal(inspections(),1);assert.equal($('table-select').children.length,40);assert.match($('table-list-status').textContent,/45 recognized.*first 40/);
  const last=$('body').value.lastIndexOf('| Step');$('body').setSelectionRange(last,last);$('table-use-cursor').fire('click');assert.equal(ui.hasWork(),true);assert.match($('table-target-status').textContent,/line 221/);assert.equal(approval(),true);assert.equal(applies(),0);
},{open:false}));
test('Failed visible inspection and changed hidden bodies cannot expose an earlier list',()=>controls(({$,ui,inspections,failInspect})=>{
  assert.equal($('table-select').children.length,1);$('table-editor-panel').open=false;$('table-editor-panel').fire('toggle');$('body').value+=' Changed.';ui.refresh();failInspect(true);
  $('table-editor-panel').open=true;$('table-editor-panel').fire('toggle');assert.equal($('table-select').children.length,0);assert.equal($('table-open-selected').disabled,true);const count=inspections();ui.refresh();assert.equal(inspections(),count);
  failInspect(false);$('body').value=article();ui.refresh();assert.equal($('table-select').children.length,1);
}));
test('Preparation and toggles keep article/approval; apply checkpoints first and clears approval/image mode',()=>controls(({$,ui,prepare,workspace,history,approval,linked,applies})=>{
  const before=workspace.draft.body;prepare();assert.equal(ui.hasWork(),true);assert.equal($('table-apply').disabled,false);assert.equal(approval(),true);assert.equal(linked(),true);assert.equal(workspace.draft.body,before);
  $('table-editor-panel').open=false;$('table-editor-panel').fire('toggle');assert.equal($('table-after').value,'');assert.equal($('table-reading-preview').children.length,0);assert.equal(ui.hasWork(),true);
  $('table-preview-change').fire('click');$('table-apply').fire('click');assert.equal(applies(),1);assert.equal(approval(),false);assert.equal(linked(),false);assert.equal(history.read(history.list()[0].id).draft.body,before);assert.equal(ui.hasWork(),false);assert.equal($('table-grid').children.length,0);
}));
test('A cell edit keeps the current input node and caret; exact no-ops avoid checkpoints and keep approval',()=>controls(({$,ui,approval,applies})=>{
  $('table-open-selected').fire('click');const input=$('table-cell-0-0');input.value='New welcome';input.setSelectionRange(3,3);input.fire('input');assert.equal($('table-cell-0-0'),input);assert.equal(input.selectionStart,3);
  ui.clear();$('table-open-selected').fire('click');$('table-preview-change').fire('click');$('table-apply').fire('click');assert.equal(applies(),0);assert.equal(approval(),true);
}));
test('Stale body edits clear previews and explicit selected-table rechecks retain all prepared cells',()=>controls(({$,ui,prepare,applies})=>{
  prepare();$('body').value='Added intro.\n\n'+$('body').value;ui.refresh();assert.equal($('table-apply').disabled,true);assert.equal($('table-after').value,'');assert.equal($('table-cell-1-1').value,'Read together');$('table-apply').fire('click');assert.equal(applies(),0);
  $('table-recheck').fire('click');assert.equal($('table-preview-change').disabled,false);assert.equal($('table-apply').disabled,true);assert.equal($('table-cell-1-1').value,'Read together');$('table-preview-change').fire('click');$('table-apply').fire('click');assert.equal(applies(),1);assert.ok($('body').value.startsWith('Added intro.'));assert.ok($('body').value.includes('Read together'));
}));
test('An altered selected table cannot rebind pending cells and a new-table end recheck never replaces prose',()=>controls(({$,ui,prepare,applies})=>{
  prepare();$('body').value=$('body').value.replace('Take turns','Another value');ui.refresh();$('table-recheck').fire('click');assert.equal($('table-apply').disabled,true);assert.equal($('table-cell-1-1').value,'Read together');
  ui.clear();$('table-create').fire('click');$('table-head-0').value='Name';$('table-head-0').fire('input');$('table-head-1').value='Plan';$('table-head-1').fire('input');const before=$('body').value+' More prose.';$('body').value=before;ui.refresh();$('table-recheck').fire('click');$('table-preview-change').fire('click');$('table-apply').fire('click');assert.equal(applies(),1);assert.ok($('body').value.startsWith(before));assert.equal(markdownTableRanges($('body').value).length,2);
}));
test('Row paging keeps unshown edits and only ten data rows are mounted; source buttons from old grids cannot mutate new rows',()=>controls(({$,ui,button})=>{
  const large={head:['Name'],align:[null],rows:Array.from({length:12},(_,i)=>['Row '+i])};$('body').value=editableTableMarkdown(large);ui.refresh();$('table-open-selected').fire('click');assert.equal($('table-grid').querySelectorAll('textarea').length,11);
  const oldInput=$('table-cell-0-0'),oldButton=button('Remove row 1');oldInput.value='Kept edit';oldInput.fire('input');$('table-next-page').fire('click');assert.equal($('table-grid').querySelectorAll('textarea').length,3);
  oldInput.value='Stale edit';oldInput.fire('input');oldButton.fire('click');$('table-previous-page').fire('click');assert.equal($('table-cell-0-0').value,'Kept edit');$('table-preview-change').fire('click');assert.equal(markdownTableRanges($('table-after').value)[0].table.rows.length,12);
}));
test('Removing populated preparation rows/columns confirms, cancellation keeps cells, and shape edits keep article untouched',()=>controls(({$,button,workspace,confirm,approval})=>{
  const before=workspace.draft.body;$('table-open-selected').fire('click');confirm(false);button('Remove row 1').fire('click');assert.equal($('table-cell-0-0').value,'Welcome');button('Remove column 1').fire('click');assert.equal($('table-head-0').value,'Step');
  confirm(true);button('Remove row 1').fire('click');assert.equal($('table-cell-0-0').value,'Read');button('Insert column after 1').fire('click');assert.equal($('table-head-1').value,'');assert.equal($('table-head-2').value,'Plan');assert.equal(workspace.draft.body,before);assert.equal(approval(),true);
}));
test('Busy actions, failed checkpoints and failed rendering keep prepared cells and article state',()=>controls(({$,ui,prepare,workspace,busy,failCheckpoint,failRender,applies,approval,report})=>{
  prepare();const before=workspace.draft.body;busy(true);for(const id of ['table-apply','table-discard','table-create','table-add-row','table-recheck'])$(id).fire('click');assert.equal(applies(),0);assert.equal(ui.hasWork(),true);busy(false);
  failCheckpoint();$('table-apply').fire('click');assert.equal(applies(),0);assert.equal(workspace.draft.body,before);assert.equal(approval(),true);assert.match(report(),/Checkpoint/);assert.equal($('table-cell-1-1').value,'Read together');
  failRender();$('table-preview-change').fire('click');assert.equal($('table-apply').disabled,true);assert.equal($('table-reading-preview').children.length,0);assert.match(report(),/Preview unavailable/);
}));
test('Header validation and oversized paste reject in full; discard clears preparation while preserving approval',()=>controls(({$,ui,workspace,approval})=>{
  const before=workspace.draft.body;$('table-create').fire('click');$('table-preview-change').fire('click');assert.equal($('table-apply').disabled,true);
  const input=$('table-head-0');input.value='Name';input.fire('input');let rejected=false;input.fire('paste',{clipboardData:{getData:()=> 'x'.repeat(2001)},preventDefault:()=>{rejected=true;}});assert.equal(rejected,true);assert.equal(input.value,'Name');
  $('table-discard').fire('click');assert.equal(ui.hasWork(),false);assert.equal($('table-grid').children.length,0);assert.equal(workspace.draft.body,before);assert.equal(approval(),true);
}));
test('Removing the original table ignores pending cell edits and preserves surrounding article source',()=>controls(({$,prepare,workspace,applies})=>{
  const before=workspace.draft.body,target=tableEditTarget(before,before.indexOf('| Step'));prepare();$('table-preview-remove').fire('click');assert.equal($('table-after').value,'');assert.equal($('table-apply').textContent,'Apply table removal');$('table-apply').fire('click');assert.equal(applies(),1);assert.equal(workspace.draft.body,before.slice(0,target.start)+before.slice(target.end));
}));
test('Unchanged v1 backups exclude pending cells and keep applied tables in the existing body field',()=>controls(({$,prepare,workspace})=>{
  prepare();const pending=parseWorkspaceBackup(createWorkspaceBackup(workspace.source,workspace.draft));assert.equal(pending.version,1);assert.ok(!pending.draft.body.includes('Read together'));
  $('table-apply').fire('click');const applied=parseWorkspaceBackup(createWorkspaceBackup(workspace.source,workspace.draft));assert.ok(applied.draft.body.includes('Read together'));assert.deepEqual(Object.keys(applied.draft),['title','excerpt','description','slug','body','questions']);assert.equal(applied.source.notes,'PRIVATE_SOURCE');
}));
test('All five generated workspaces include labeled table controls and accessible table guidance',async()=>{
  for(const route of ['write','markdown-to-wordpress','word-to-wordpress','markdown-to-html','markdown-to-word']){const html=await readFile('public/'+route+'/index.html','utf8');for(const id of ['start-table-editor','table-editor-panel','table-select','table-grid','table-reading-preview','table-before','table-after','table-editor-status'])assert.ok(html.includes('id="'+id+'"'));assert.match(html,/for="table-select"/);assert.match(html,/id="table-editor-status"[^>]*role="status"/);assert.match(html,/aria-describedby="table-cell-help"/);}
  const help=await readFile('public/help/local-workspace/index.html','utf8');assert.match(help,/id="table-editor"/);assert.match(help,/Unsaved cells/);
});
