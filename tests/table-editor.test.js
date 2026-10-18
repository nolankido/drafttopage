import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { TABLE_CONTEXT_CELL_LIMIT, TABLE_CONTEXT_COLUMNS, tableChoiceLabel, tableChoiceContext, copyEditableTable, emptyEditableTable, tableEditTarget, newTableTarget, recheckTableTarget, editableTableMarkdown, changeEditableTable, planTableEdit } from '../public/table-editing.js';
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

test('Current table choice snippets identify headers, first row and nearby text without mutating source',()=>{
  const body='Fictional morning plan.\n\n| Time | Plan |\n| --- | --- |\n| Morning | Coffee |\n\nFictional evening plan.\n\n| Time | Plan |\n| --- | --- |\n| Evening | Tea |';
  const ranges=markdownTableRanges(body),before=JSON.stringify(ranges);
  assert.equal(tableChoiceLabel(ranges[0],0),'Table 1 on line 3 · 2 columns, 1 row · Time');
  assert.match(tableChoiceContext(body,ranges[0]),/Headers: Time \| Plan\. First data row: Morning \| Coffee\./);
  assert.match(tableChoiceContext(body,ranges[1]),/First data row: Evening \| Tea\./);
  assert.match(tableChoiceContext(body,ranges[1]),/Before:.*Fictional evening plan/);
  assert.equal(JSON.stringify(ranges),before);assert.equal(TABLE_CONTEXT_CELL_LIMIT,48);assert.equal(TABLE_CONTEXT_COLUMNS,3);
});
test('Choice snippets bound Unicode cells, columns, rows, context and unsupported reasons without interpreting markup',()=>{
  const table={head:['😀'.repeat(500),'<img src=x onerror=bad()>','Third','HIDDEN_FOURTH_HEADER'],align:[null,null,null,null],rows:[['🚀'.repeat(500),'[literal](https://example.test/)','Third cell','HIDDEN_FOURTH_CELL'],['HIDDEN_SECOND_ROW','','','']]};
  const body='Before.\n\n'+editableTableMarkdown(table)+'\n\nAfter.',range=markdownTableRanges(body)[0],text=tableChoiceContext(body,range);
  assert.ok(text.includes('😀'.repeat(48)+'…'));assert.ok(text.includes('<img src=x onerror=bad()>'));assert.ok(text.includes('[literal](https://example.test/)'));
  assert.match(text,/first three columns/);assert.doesNotMatch(text,/HIDDEN_/);assert.ok(Array.from(text).length<650);assert.equal(text.isWellFormed(),true);
  const unsupported='| Head | Note |\n| - | --- |\n| One | Two |',bad=markdownTableRanges(unsupported)[0];
  assert.match(tableChoiceLabel(bad,0),/source editing needed.*Head/);assert.match(tableChoiceContext(unsupported,bad),/Source editing needed: Use at least three dashes/);
  const maximum={...range,supported:false,reason:'Reason '.repeat(100),table:{...range.table,head:Array(4).fill('😀'.repeat(100)),rows:[Array(4).fill('🚀'.repeat(100))]}};
  assert.ok(Array.from(tableChoiceContext(body,maximum)).length<720);
});
test('Choice context respects CRLF bounds and surrounding astral characters, header-only tables and invalid ranges',()=>{
  for(const newline of ['\n','\r\n']){
    const body='😀'.repeat(75)+newline+source.replaceAll('\n',newline)+newline+'😀'.repeat(75),range=markdownTableRanges(body)[0];
    const text=tableChoiceContext(body,range);assert.equal(text.isWellFormed(),true);assert.ok(text.includes('Before:')&&text.includes('After:'));
  }
  const body='| Name |\n| --- |',range=markdownTableRanges(body)[0];assert.match(tableChoiceLabel(range,0),/1 column, 0 rows/);assert.match(tableChoiceContext(body,range),/No data rows/);
  for(const bad of [null,{...range,start:-1},{...range,end:body.length+1},{...range,start:0.5},{...range,end:-1}])assert.throws(()=>tableChoiceContext(body,bad));
  assert.throws(()=>tableChoiceContext('x'.repeat(60001),range),/60,000/);assert.throws(()=>tableChoiceContext('x\0y',range),/null/);
});

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
  set textContent(value){this.textWrites=(this.textWrites||0)+1;this._text=String(value);this.children=[];}get textContent(){return this._text+this.children.map(x=>x.textContent).join('');}
  addEventListener(type,fn){if(!this.events.has(type))this.events.set(type,[]);this.events.get(type).push(fn);}fire(type,event={}){for(const fn of this.events.get(type)||[])fn(event);}
  append(...nodes){this.children.push(...nodes);}
  replaceChildren(...nodes){const remove=node=>{for(const child of node.children)remove(child);if(node.id&&this.registry.get(node.id)===node)this.registry.delete(node.id);};for(const child of this.children)remove(child);this.children=nodes;if(this.tag==='select')this.value=nodes[0]?.value||'';}
  querySelectorAll(selector){const tags=selector.split(',');return this.children.flatMap(x=>[...(tags.includes(x.tag)?[x]:[]),...x.querySelectorAll(selector)]);}
  setAttribute(name,value){this[name]=value;}focus(){this.focused=true;}setSelectionRange(start,end){this.selectionStart=start;this.selectionEnd=end;}
}
function controls(run,{open=true,ancestorOpen=true}={}){
  const prior=globalThis.document,map=new Map(),$=id=>{if(!map.has(id)){const node=new Node(['table-select','table-row-selected','table-row-destination'].includes(id)?'select':'',map);node.id=id;}return map.get(id);};globalThis.document={getElementById:$,createElement:tag=>new Node(tag,map)};
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
test('Changing a list choice updates source context without retargeting preparation, preview or approval',()=>controls(({$,ui,prepare,approval,applies,history,confirm})=>{
  $('body').value=article()+'\n\n'+source.replace('Welcome','Evening');ui.refresh();prepare();const preview=$('table-after').value;
  $('table-select').value='1';$('table-select').fire('change');assert.match($('table-choice-context').textContent,/First data row: Evening/);assert.equal($('table-cell-1-1').value,'Read together');assert.equal($('table-after').value,preview);assert.match($('table-target-status').textContent,/line 3/);
  assert.equal(approval(),true);assert.equal(applies(),0);assert.equal(history.list().length,0);
  confirm(false);$('table-open-selected').fire('click');assert.equal($('table-cell-1-1').value,'Read together');
  confirm(true);$('table-open-selected').fire('click');assert.equal($('table-cell-0-0').value,'Evening');assert.equal($('table-after').value,'');assert.equal(approval(),true);assert.equal(applies(),0);
}));
test('Closed or obsolete table choices purge snippets without inspection and opening restores current selected context',()=>controls(({$,ui,inspections,approval})=>{
  assert.equal($('table-choice-context').hidden,true);assert.equal($('table-choice-context').textContent,'');assert.equal(inspections(),0);
  $('table-editor-panel').open=true;$('table-editor-panel').fire('toggle');assert.match($('table-choice-context').textContent,/Headers: Step \| Plan/);
  const count=inspections();$('table-editor-panel').open=false;$('table-editor-panel').fire('toggle');assert.equal($('table-choice-context').hidden,true);assert.equal($('table-choice-context').textContent,'');
  $('body').value=article().replace('Welcome','Current only');ui.refresh();assert.equal(inspections(),count);assert.equal($('table-choice-context').textContent,'');
  $('table-editor-panel').open=true;$('table-editor-panel').fire('toggle');assert.match($('table-choice-context').textContent,/Current only/);assert.equal(inspections(),count+1);assert.equal(approval(),true);
},{open:false}));
test('A selection event before body refresh cannot display old snippets or alter prepared cells',()=>controls(({$,ui,prepare,report,approval,applies})=>{
  prepare();$('body').value=article().replace('Welcome','Current article');$('table-select').fire('change');
  assert.match(report(),/article changed/);assert.match($('table-choice-context').textContent,/Current article/);assert.doesNotMatch($('table-choice-context').textContent,/Welcome/);assert.equal($('table-cell-1-1').value,'Read together');assert.equal($('table-after').value,'');assert.equal($('table-apply').disabled,true);assert.equal(approval(),true);assert.equal(applies(),0);
  $('body').value='No tables.';ui.refresh();assert.equal($('table-choice-context').hidden,true);assert.equal($('table-choice-context').textContent,'');
}));
test('Unchanged context nodes survive preparation and unrelated refreshes without new parsing or text replacement',()=>controls(({$,ui,prepare,inspections,busy})=>{
  const context=$('table-choice-context'),writes=context.textWrites,count=inspections();ui.refresh();busy(true);busy(false);assert.equal(context.textWrites,writes);assert.equal(inspections(),count);
  prepare();assert.equal(context.textWrites,writes);assert.equal(inspections(),count);
  $('table-editor-panel').open=false;$('table-editor-panel').fire('toggle');assert.equal(context.textContent,'');const cleared=context.textWrites;ui.refresh();assert.equal(context.textWrites,cleared);
  $('table-editor-panel').open=true;$('table-editor-panel').fire('toggle');assert.equal(context.textWrites,cleared+1);assert.equal(inspections(),count);
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

test('Direct row reordering is immutable, preserves every cell, and enforces both source and destination bounds',()=>{
  const value={head:['Name','Detail'],align:['left','right'],rows:Array.from({length:21},(_,i)=>['Row '+(i+1),'Cell '+(i+1)+' 😀'])};
  const original=JSON.stringify(value),last=changeEditableTable(value,'move-row',0,20);
  assert.deepEqual(last.rows.at(-1),value.rows[0]);
  assert.deepEqual(last.rows[0],value.rows[1]);
  assert.deepEqual(last.rows.slice(0,-1),value.rows.slice(1));
  assert.deepEqual(changeEditableTable(last,'move-row',20,0),value);
  assert.deepEqual(changeEditableTable(value,'move-row',7,7),value);
  assert.notEqual(changeEditableTable(value,'move-row',7,7),value);
  assert.equal(JSON.stringify(value),original);
  for(const [from,to] of [[-1,0],[21,1],[0,-1],[0,21],[0,0.5],[0,NaN],[0,null],[0,undefined],['0',0]]){
    assert.throws(()=>changeEditableTable(value,'move-row',from,to),/valid|position|current|row/i);
  }
});

test('Reordering through the plan preserves exact adjacent Unicode and CRLF prose, alignment, and a clean rollback',()=>{
  for(const newline of ['\n','\r\n']){
    const body='前書き 😀'+newline+newline+editableTableMarkdown({
      head:['Step','Notes'],align:['center','right'],rows:[['One','**first**'],['Two','[link](https://example.com)'],['Three','literal | pipe']]
    },newline)+newline+newline+'After 😀';
    // Choose a table whose contents are in the supported subset and preserve the exact source.
    const range=markdownTableRanges(body)[0],target=tableEditTarget(body,range.start),before=target.before;
    const prepared=changeEditableTable(target.table,'move-row',0,2);
    assert.deepEqual(prepared.rows.map(row=>row[0]),['Two','Three','One']);
    const plan=planTableEdit(target,prepared,body);
    assert.equal(plan.body.slice(0,target.start),body.slice(0,target.start));
    assert.equal(plan.body.slice(plan.selectionEnd),body.slice(target.end));
    assert.equal(plan.body.slice(plan.selectionStart,plan.selectionEnd),plan.markdown);
    assert.deepEqual(markdownTableRanges(plan.body)[0].table.rows.map(row=>row[0]),['Two','Three','One']);
    assert.deepEqual(changeEditableTable(prepared,'move-row',2,0),target.table);
    assert.equal(planTableEdit(target,target.table,body).replacement,before);
  }
});

test('Row arrangement provides insert-before-first, insert-after, adjacent moves and a checkpointed apply',()=>controls(({$,ui,workspace,history,approval,applies})=>{
  const original=workspace.draft.body;
  $('table-open-selected').fire('click');
  assert.equal($('table-row-selected').value,'0');
  assert.equal($('table-row-arrange-status').textContent.includes('Selected row 1 of 2'),true);
  assert.equal($('table-move-up').disabled,true);
  assert.equal($('table-move-down').disabled,false);
  $('table-insert-before').fire('click');
  assert.equal($('table-cell-0-0').value,'');
  assert.equal($('table-cell-1-0').value,'Welcome');
  assert.equal($('table-cell-2-0').value,'Read');
  $('table-cell-0-0').value='First';$('table-cell-0-0').fire('input');
  $('table-cell-0-1').value='New intro';$('table-cell-0-1').fire('input');
  assert.equal($('table-row-selected').value,'0');
  $('table-move-down').fire('click');
  assert.equal($('table-row-selected').value,'1');
  assert.equal($('table-cell-0-0').value,'Welcome');
  assert.equal($('table-cell-1-0').value,'First');
  $('table-insert-after').fire('click');
  assert.equal($('table-row-selected').value,'2');
  $('table-cell-2-0').value='Inserted';$('table-cell-2-0').fire('input');
  assert.equal($('table-cell-3-0').value,'Read');
  assert.equal(workspace.draft.body,original);
  assert.equal(approval(),true);
  assert.equal(history.list().length,0);
  $('table-preview-change').fire('click');
  assert.deepEqual(markdownTableRanges($('table-after').value)[0].table.rows.map(row=>row[0]),['Welcome','First','Inserted','Read']);
  $('table-apply').fire('click');
  assert.equal(applies(),1);
  assert.equal(approval(),false);
  assert.equal(history.read(history.list()[0].id).draft.body,original);
  assert.deepEqual(markdownTableRanges($('body').value)[0].table.rows.map(row=>row[0]),['Welcome','First','Inserted','Read']);
}));

test('Move directly across the ten-row boundary follows the exact selected row, and old-grid actions cannot mutate it',()=>controls(({$,ui,button,approval,applies})=>{
  const rows=Array.from({length:24},(_,index)=>['Row '+(index+1),'Value '+(index+1)]);
  $('body').value=editableTableMarkdown({head:['Name','Note'],align:[null,'right'],rows});
  ui.refresh();$('table-open-selected').fire('click');
  const oldButton=button('Remove row 1'),oldInput=$('table-cell-0-0');
  $('table-row-destination').value='22';$('table-row-destination').fire('change');
  assert.equal($('table-move-to').disabled,false);
  $('table-move-to').fire('click');
  assert.equal($('table-row-selected').value,'22');
  assert.equal($('table-row-destination').value,'22');
  assert.equal($('table-cell-22-0').value,'Row 1');
  assert.equal($('table-cell-22-0').focused,true);
  assert.match($('table-page-status').textContent,/Rows 21 to 24 of 24/);
  assert.equal($('table-grid').querySelectorAll('textarea').length,10);
  oldInput.value='Obsolete value';oldInput.fire('input');oldButton.fire('click');
  assert.equal($('table-cell-22-0').value,'Row 1');
  $('table-preview-change').fire('click');
  assert.deepEqual(markdownTableRanges($('table-after').value)[0].table.rows.map(row=>row[0]).slice(19,24),
    ['Row 21','Row 22','Row 23','Row 1','Row 24']);
  assert.equal(applies(),0);assert.equal(approval(),true);
  $('table-row-selected').value='22';$('table-row-selected').fire('change');
  $('table-row-destination').value='0';$('table-row-destination').fire('change');
  $('table-move-to').fire('click');
  assert.equal($('table-cell-0-0').value,'Row 1');
  assert.match($('table-page-status').textContent,/Rows 1 to 10 of 24/);
}));

test('Selecting positions and same-row moves are review-safe no-ops; real row movement invalidates the preview',()=>controls(({$,ui,approval,applies})=>{
  $('table-open-selected').fire('click');$('table-preview-change').fire('click');
  const preview=$('table-after').value;assert.equal($('table-apply').disabled,false);
  $('table-row-selected').value='1';$('table-row-selected').fire('change');
  assert.equal($('table-after').value,preview);assert.equal($('table-apply').disabled,false);
  assert.equal($('table-move-to').disabled,true);
  $('table-move-to').fire('click');
  assert.equal($('table-after').value,preview);
  $('table-row-destination').value='0';$('table-row-destination').fire('change');
  assert.equal($('table-move-to').disabled,false);
  $('table-move-to').fire('click');
  assert.equal($('table-after').value,'');
  assert.equal($('table-apply').disabled,true);
  assert.equal($('table-cell-0-0').value,'Read');
  assert.equal(approval(),true);assert.equal(applies(),0);
}));

test('Maximum-size and header-only tables gate row arrangement and preserve source until apply',()=>controls(({$,ui,busy,approval,applies})=>{
  $('body').value='| Name |\n| --- |';ui.refresh();$('table-open-selected').fire('click');
  assert.equal($('table-row-selected').disabled,true);
  assert.equal($('table-insert-before').disabled,true);
  assert.equal($('table-move-to').disabled,true);
  assert.equal($('table-add-row').disabled,false);
  $('table-add-row').fire('click');
  assert.equal($('table-row-selected').value,'0');
  assert.equal($('table-move-up').disabled,true);
  ui.clear();
  const rows=Array.from({length:100},(_,index)=>['Row '+(index+1)]);
  $('body').value=editableTableMarkdown({head:['Name'],align:[null],rows});
  ui.refresh();$('table-open-selected').fire('click');
  assert.equal($('table-add-row').disabled,true);
  assert.equal($('table-insert-before').disabled,true);
  assert.equal($('table-insert-after').disabled,true);
  $('table-row-selected').value='99';$('table-row-selected').fire('change');
  assert.equal($('table-move-down').disabled,true);
  assert.equal($('table-move-up').disabled,false);
  busy(true);for(const id of ['table-move-up','table-move-to','table-row-selected','table-insert-before'])assert.equal($(id).disabled,true);
  $('table-move-up').fire('click');busy(false);
  assert.equal($('table-cell-99-0').value,'Row 100');
  $('table-move-up').fire('click');
  assert.equal($('table-cell-98-0').value,'Row 100');
  assert.equal(applies(),0);assert.equal(approval(),true);
}));

test('Prepared reordering survives stale article recheck and failed checkpoint without mutating writing or backup shape',()=>controls(({$,ui,workspace,history,failCheckpoint,approval,applies})=>{
  $('table-open-selected').fire('click');$('table-move-down').fire('click');
  assert.equal($('table-cell-1-0').value,'Welcome');
  const backup=createWorkspaceBackup(workspace.source,workspace.draft);
  const base=workspace.draft.body;
  assert.equal(parseWorkspaceBackup(backup).draft.body,base);
  const changed='New fictional lead.\n\n'+base;
  workspace.draft.body=changed;$('body').value=changed;ui.refresh();
  $('table-preview-change').fire('click');assert.equal($('table-apply').disabled,true);
  $('table-recheck').fire('click');assert.equal($('table-cell-1-0').value,'Welcome');
  $('table-preview-change').fire('click');assert.equal($('table-apply').disabled,false);
  failCheckpoint();$('table-apply').fire('click');
  assert.equal(applies(),0);assert.equal(approval(),true);
  assert.equal($('body').value,changed);
  assert.equal($('table-cell-1-0').value,'Welcome');
  assert.equal(history.list().length,0);
}));

test('All eight generated workspaces include labeled table controls and accessible table guidance',async()=>{
  for(const route of ['write','markdown-to-wordpress','word-to-wordpress','word-to-markdown','google-docs-to-wordpress','html-to-markdown','markdown-to-html','markdown-to-word']){const html=await readFile('public/'+route+'/index.html','utf8');for(const id of ['start-table-editor','table-editor-panel','table-select','table-choice-help','table-choice-context','table-row-arrange','table-row-selected','table-row-destination','table-insert-before','table-insert-after','table-move-up','table-move-down','table-move-to','table-row-arrange-status','table-grid','table-reading-preview','table-before','table-after','table-editor-status'])assert.ok(html.includes('id="'+id+'"'));assert.match(html,/for="table-select"/);assert.match(html,/id="table-editor-status"[^>]*role="status"/);assert.match(html,/aria-describedby="table-cell-help"/);assert.match(html,/id="table-select"[^>]*aria-describedby="table-list-status table-choice-help table-choice-context"/);assert.match(html,/Choosing a list item keeps prepared cells and writing/);assert.match(html,/for="table-row-selected"/);assert.match(html,/for="table-row-destination"/);assert.match(html,/aria-describedby="table-row-arrange-help table-row-arrange-status"/);}
  const help=await readFile('public/help/local-workspace/index.html','utf8');assert.match(help,/id="table-editor"/);assert.match(help,/Unsaved cells/);assert.match(help,/Insert or reorder data rows/);
});
