import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { articleLinks, articleLinkNotes, linkEditTarget, linkMarkdown, planLinkEdit } from '../public/link-editing.js';
import { installLinkEditor } from '../public/link-editor-controls.js';
import { inlineParts } from '../public/preview.js';
import { createWordPressArticle } from '../public/wordpress-export.js';
import { createHTMLSource, createReadingPage } from '../public/html-export.js';
import { createWordDocument } from '../public/word-export.js';
import { createWorkspaceBackup, parseWorkspaceBackup } from '../public/workspace.js';
import { createCheckpointHistory } from '../public/revisions.js';

const fields = { label: 'Fictional [reading group]', url: 'https://example.com/reading_(1)?a=1&b=2' };
const original = '[Original resource](https://example.com/original)';
const planAt = (body, start, end, value = fields, mode = 'edit') => planLinkEdit(linkEditTarget(body,start,end),value,body,mode);

test('Generated links retain authored URLs and render literal Unicode, brackets, backslashes, and Markdown punctuation',()=>{
  for(const label of ['日本語 😀','A [label] and \\ slash','**bold** `code` # <svg> & "quotes"', 'a'.repeat(300)]){
    const source=linkMarkdown({...fields,label}), parts=inlineParts(source);
    assert.equal(parts.length,1);assert.equal(parts[0].type,'a');assert.equal(parts[0].text,label);assert.equal(articleLinks(source)[0].url,fields.url);
  }
  const authored='HTTPS://EXAMPLE.COM/Path?A=1';assert.ok(linkMarkdown({...fields,url:authored}).endsWith(']('+authored+')'));
  assert.ok(linkMarkdown({...fields,url:'http://example.com/'}));
});
test('Malformed, credentialed, multiline, unsafe, unbalanced, empty and oversized fields reject without repair',()=>{
  for(const url of ['javascript:bad()','data:text/html,x','//example.com/a','/relative','https://u:p@example.com/a','https://exam\rple.com/a','https://exam\nple.com/a','https://example.com/a b','https://example.com/"title"','https://example.com/a)','https://example.com/a(','https://example.com/'+'a'.repeat(2048),null])assert.throws(()=>linkMarkdown({...fields,url}),undefined,String(url));
  for(const label of ['', ' ', 'x'.repeat(301),'a\nb','a\rb','a\tb','a\0b','a\u2028b',null,[]])assert.throws(()=>linkMarkdown({...fields,label}));
});
test('Raw link inventory preserves CRLF/UTF-16 offsets, identifies unsafe and table references, and excludes code/images',()=>{
  const body='日本語 😀\r\n\r\n## '+original+'\r\n\r\n- '+original+'\r\n\r\n![image](https://example.com/image.jpg)\r\n\r\n`'+original+'`\r\n\r\n~~~\r\n'+original+'\r\n~~~\r\n\r\n| Resource |\r\n| --- |\r\n| '+original+' |\r\n\r\n[Unsafe](javascript:bad())';
  const links=articleLinks(body);assert.equal(links.length,4);assert.equal(links.filter(x=>x.inTable).length,1);assert.equal(links.filter(x=>x.href).length,3);
  for(const link of links){assert.ok(body.slice(link.start,link.end).startsWith('['));assert.equal(link.line,body.slice(0,link.start).split('\n').length);}
  assert.equal(articleLinks('A plain https://example.com/ and [reference][id]').length,0);
});
test('Selected text and cursor insertion preserve every surrounding source character, including Word-escaped prose',()=>{
  const body='日本語 😀 A resource\\. remains.\r\n\r\nThe ending.',start=body.indexOf('resource'),end=start+'resource\\.'.length;
  const target=linkEditTarget(body,start,end);assert.equal(target.label,'resource.');const plan=planLinkEdit(target,fields,body);
  assert.equal(plan.body,body.slice(0,start)+plan.replacement+body.slice(end));assert.equal(plan.body.slice(plan.selectionStart,plan.selectionEnd),plan.replacement);
  assert.equal(articleLinks(plan.body)[0].label,fields.label);
  const inserted=planAt('A  paragraph.',2,2);assert.equal(inserted.body,'A '+inserted.replacement+' paragraph.');assert.ok(planAt('',0,0).changed);
});
test('A cursor expands exactly one existing link, repeated references stay distinct, and no-ops preserve authored syntax',()=>{
  const body=original+' and '+original,start=body.lastIndexOf(original),target=linkEditTarget(body,start+3,start+3);
  assert.equal(target.start,start);assert.equal(target.end,start+original.length);
  const plan=planLinkEdit(target,fields,body);assert.ok(plan.body.startsWith(original+' and '));assert.equal(articleLinks(plan.body)[1].label,fields.label);
  const noop=planLinkEdit(target,{label:target.label,url:target.url},body);assert.equal(noop.changed,false);assert.equal(noop.body,body);
});
test('Unlink retains the original literal label, ignores pending edits, permits unsafe URLs, and protects adjacent/nested syntax',()=>{
  const source='[**literal** \\[brackets\\] <b>](javascript:bad())', target=linkEditTarget(source,2,2);
  const plan=planLinkEdit(target,{label:'Changed pending label',url:'https://example.com/new'},source,'remove');
  assert.equal(articleLinks(plan.body).length,0);assert.equal(inlineParts(plan.body).map(x=>x.text).join(''),'**literal** [brackets] <b>');assert.ok(inlineParts(plan.body).every(x=>x.type==='text'));
  assert.ok(planAt(original+original,0,original.length,{},'remove').body.endsWith(original));
  const nested='['+original+'](https://example.com/outer)';assert.throws(()=>planAt(nested,1,1+original.length,{},'remove'),/Surrounding Markdown/);
  assert.throws(()=>planAt('Plain words',0,5,{},'remove'),/existing link/);
});
test('Headings, lists and quotes allow ordinary text while markers, tables, code, images and partial formatting reject',()=>{
  for(const body of ['## Heading text','- List text','> Quote text']){const start=body.indexOf('text');assert.ok(planAt(body,start,start+4).changed);}
  for(const [body,start,end] of [['😀',1,1],['a\r\nb',2,2],['text',-1,1],['text',0,5],['text',0.2,2],['text',3,2],['One\nTwo',0,7],['## Heading',0,2],['- List',0,1],['> Quote',0,1],['    indented',4,8],['<p>source</p>',3,9],['~~~\ncode\n~~~',4,8],['**bold**',2,6],['**bold**',0,8],['`code`',0,6],['![alt](https://example.com/a)',0,28],['A | B\n--- | ---\nC | D',0,1],['\\',1,1]])assert.throws(()=>planAt(body,start,end),undefined,JSON.stringify([body,start,end]));
  assert.throws(()=>planAt(original,1,5),/complete|plain/i);
});
test('Stale snapshots, invalid modes, null characters and total overflow leave the original immutable',()=>{
  const body=original+' and '+original,target=linkEditTarget(body,0,original.length),before=JSON.stringify(target);
  assert.throws(()=>planLinkEdit(target,fields,body+' more'),/article changed/);assert.equal(JSON.stringify(target),before);
  assert.throws(()=>planLinkEdit(target,fields,body,'replace-all'));
  assert.throws(()=>planAt('a'.repeat(60000),60000,60000),/60,000/);
  for(const value of [null,'a\0b','a'.repeat(60001)])assert.throws(()=>articleLinks(value));
  assert.throws(()=>linkEditTarget('a'.repeat(301),0,301),/limits/);
});
test('All recognized links appear in text review notes without visiting destinations',()=>{
  const body=Array.from({length:45},(_,i)=>'[Resource '+i+'](https://example.com/'+i+')').join('\n\n');
  const notes=articleLinkNotes(body);assert.match(notes,/45 recognized/);assert.ok(notes.includes('Resource 44'));assert.match(notes,/No URLs were visited/);
});
test('Independent HTML parsing verifies link attributes and literal labels across article exports, with Word relationships preserved',()=>{
  const draft={title:'Fictional',excerpt:'',description:'',slug:'',body:linkMarkdown({...fields,label:'<svg> [literal] & "label"'}),questions:['PRIVATE_REVIEW']};
  for(const html of [createWordPressArticle(draft).html,createHTMLSource(draft),createReadingPage(draft)]){
    const parsed=JSON.parse(execFileSync('python3',['-c',String.raw`
import sys,json
from html.parser import HTMLParser
class Parser(HTMLParser):
 def __init__(self):super().__init__();self.links=[];self.tags=[];self.text=[]
 def handle_starttag(self,tag,attrs):
  self.tags.append(tag)
  if tag=='a':self.links.append(dict(attrs))
 def handle_data(self,data):self.text.append(data)
p=Parser();p.feed(sys.stdin.read());assert 'svg' not in p.tags
print(json.dumps({'links':p.links,'text':''.join(p.text)}))
`],{input:html,encoding:'utf8'}));
    assert.equal(parsed.links[0].href,fields.url);assert.ok(parsed.text.includes('<svg> [literal] & "label"'));assert.doesNotMatch(html,/PRIVATE_REVIEW/);
  }
  const word=new TextDecoder().decode(createWordDocument(draft));assert.ok(word.includes('relationships/hyperlink'));assert.ok(word.includes('TargetMode="External"'));
});

class Control {
  constructor(tag=''){this.tag=tag;this.value='';this.checked=false;this.open=false;this.disabled=false;this.hidden=false;this.children=[];this.events=new Map();this.selectionStart=0;this.selectionEnd=0;}
  addEventListener(type,fn){if(!this.events.has(type))this.events.set(type,[]);this.events.get(type).push(fn);}
  fire(type,event={}){for(const fn of this.events.get(type)||[])fn(event);}
  append(...nodes){this.children.push(...nodes);}
  replaceChildren(...nodes){this.children=nodes;}
  querySelectorAll(tag){return this.children.flatMap(x=>[...(x.tag===tag?[x]:[]),...x.querySelectorAll(tag)]);}
  focus(){this.focused=true;}
  setSelectionRange(start,end){this.selectionStart=start;this.selectionEnd=end;}
}
function controls(run){
  const prior=globalThis.document,map=new Map(),$=id=>{if(!map.has(id))map.set(id,new Control());return map.get(id);};globalThis.document={getElementById:$,createElement:tag=>new Control(tag)};
  const workspace={source:{profile:'personal',audience:'',purpose:'',notes:'PRIVATE_SOURCE'},draft:{title:'Fictional',excerpt:'',description:'',slug:'',questions:['PRIVATE_REVIEW'],body:'A resource remains. '+original}};
  let busy=false,approval=true,linked=true,checkpointFailure=false,applies=0,confirmation=true,report='',download=null,workChanges=0,inspections=0,reads=0;
  const history=createCheckpointHistory();$('body').value=workspace.draft.body;
  const ui=installLinkEditor({getBody:()=>{reads++;return $('body').value;},inspect:body=>{inspections++;return articleLinks(body);},isBusy:()=>busy,workChanged:()=>{workChanges++;},report:text=>{report=text;},confirmAction:()=>confirmation,reveal:()=>{},download:(...args)=>{download=args;},apply:(plan,label)=>{if(checkpointFailure)throw Error('Checkpoint failed.');history.save(workspace,label);workspace.draft.body=plan.body;$('body').value=plan.body;approval=false;linked=false;applies++;ui.refresh();}});
  const prepare=()=>{$('body').setSelectionRange(2,10);$('link-use-selection').fire('click');$('link-label').value=fields.label;$('link-label').fire('input');$('link-url').value=fields.url;$('link-url').fire('input');$('link-preview').fire('click');};
  try{run({$,ui,workspace,history,prepare,inspections:()=>inspections,reads:()=>reads,approval:()=>approval,linked:()=>linked,applies:()=>applies,report:()=>report,download:()=>download,workChanges:()=>workChanges,busy:value=>{busy=value;ui.refresh();},failCheckpoint:()=>{checkpointFailure=true;},confirm:value=>{confirmation=value;}});}finally{globalThis.document=prior;}
}
test('Closed inventory never scans article links while preparation still becomes stale',()=>controls(({$,ui,prepare,inspections,approval,applies})=>{
  assert.equal(inspections(),0);
  for(let i=0;i<4;i++){$('body').value+=' revised';ui.refresh();}
  assert.equal(inspections(),0);assert.equal($('download-link-notes').disabled,true);
  prepare();assert.equal($('link-apply').disabled,false);assert.equal(inspections(),0);
  $('body').value+=' new source';ui.refresh();
  assert.equal($('link-after').value,'');assert.equal($('link-apply').disabled,true);assert.equal(ui.hasWork(),true);
  $('link-apply').fire('click');assert.equal(applies(),0);assert.equal(approval(),true);assert.equal(inspections(),0);
}));
test('Inventory opens on current Unicode/CRLF source, caches visible scans and purges on either close',()=>controls(({$,ui,inspections,approval})=>{
  $('body').value='😀 Intro\r\n\r\n[新しい](https://example.com/current)';
  $('article-link-list-panel').open=true;$('article-link-list-panel').fire('toggle');assert.equal(inspections(),0);
  $('link-editor-panel').open=true;$('link-editor-panel').fire('toggle');assert.equal(inspections(),1);
  assert.match($('article-link-status').textContent,/1 recognized/);assert.equal($('article-link-list').children.length,1);
  ui.refresh();assert.equal(inspections(),1);
  $('link-editor-panel').open=false;$('link-editor-panel').fire('toggle');assert.equal(inspections(),1);assert.equal($('article-link-list').children.length,0);assert.equal($('download-link-notes').disabled,true);assert.doesNotMatch($('article-link-status').textContent,/recognized/);
  $('body').value+='\r\n[Another](https://example.com/other)';ui.refresh();assert.equal(inspections(),1);
  $('link-editor-panel').open=true;$('link-editor-panel').fire('toggle');assert.equal(inspections(),2);assert.equal($('article-link-list').children.length,2);
  $('article-link-list-panel').open=false;$('article-link-list-panel').fire('toggle');ui.refresh();assert.equal(inspections(),2);assert.equal($('article-link-list').children.length,0);assert.equal(approval(),true);
}));
test('Hidden notes and detached inventory events cannot read source, reopen editing or replace pending details',()=>controls(({$,ui,inspections,reads,download,approval,workChanges})=>{
  $('link-editor-panel').open=true;$('article-link-list-panel').open=true;ui.refresh();
  const old=$('article-link-list').querySelectorAll('button')[0];
  $('article-link-list-panel').open=false;$('article-link-list-panel').fire('toggle');
  const beforeReads=reads(),beforeWork=workChanges(),beforeScans=inspections();
  old.fire('click');$('download-link-notes').fire('click');
  assert.equal(reads(),beforeReads);assert.equal(inspections(),beforeScans);assert.equal(workChanges(),beforeWork);assert.equal(ui.hasWork(),false);assert.equal(download(),null);assert.equal(approval(),true);
  $('article-link-list-panel').open=true;$('article-link-list-panel').fire('toggle');
  const reopenedReads=reads();old.fire('click');assert.equal(reads(),reopenedReads);assert.equal(ui.hasWork(),false);
  const current=$('article-link-list').querySelectorAll('button')[0];current.fire('click');assert.equal(ui.hasWork(),true);assert.equal($('link-label').value,'Original resource');
}));
test('Changing source behind visible inventory rebuilds current links and rejects its detached previous row',()=>controls(({$,ui,inspections,applies,approval})=>{
  $('link-editor-panel').open=true;$('article-link-list-panel').open=true;ui.refresh();const old=$('article-link-list').querySelectorAll('button')[0];
  $('body').value='😀\r\n[Current](https://example.com/new)';ui.refresh();assert.equal(inspections(),2);
  old.fire('click');assert.equal(ui.hasWork(),false);
  $('article-link-list').querySelectorAll('button')[0].fire('click');assert.equal($('link-label').value,'Current');assert.equal($('link-url').value,'https://example.com/new');
  assert.match($('link-target-status').textContent,/line 2/);assert.equal(applies(),0);assert.equal(approval(),true);
}));
test('Closed containing disclosures skip inventory scans and stale rows even with both inner panels open',()=>controls(({$,ui,inspections,approval})=>{
  const parent=$('link-editor-panel').parentElement=new Control();parent.tagName='DETAILS';parent.open=false;
  $('link-editor-panel').open=true;$('article-link-list-panel').open=true;ui.refresh();assert.equal(inspections(),0);
  parent.open=true;ui.refresh();assert.equal(inspections(),1);const old=$('article-link-list').querySelectorAll('button')[0];
  parent.open=false;ui.refresh();assert.equal(inspections(),1);assert.equal($('article-link-list').children.length,0);assert.equal($('download-link-notes').disabled,true);
  old.fire('click');assert.equal(ui.hasWork(),false);assert.equal(approval(),true);
  $('body').value='[Current](https://example.com/current)';ui.refresh();assert.equal(inspections(),1);
  parent.open=true;ui.refresh();assert.equal(inspections(),2);assert.match($('article-link-list').children[0].children[0].textContent,/Current/);
}));
test('Inspection failures and hidden error state cannot retain old links or enable notes',()=>controls(({$,ui,inspections,approval})=>{
  $('link-editor-panel').open=true;$('article-link-list-panel').open=true;ui.refresh();assert.equal(inspections(),1);
  $('body').value='x'.repeat(60001);ui.refresh();assert.equal(inspections(),2);assert.equal($('article-link-list').children.length,0);assert.equal($('download-link-notes').disabled,true);assert.match($('article-link-status').textContent,/60,000/);
  $('article-link-list-panel').open=false;$('article-link-list-panel').fire('toggle');assert.doesNotMatch($('article-link-status').textContent,/60,000/);
  $('body').value=original;ui.refresh();assert.equal(inspections(),2);
  $('article-link-list-panel').open=true;$('article-link-list-panel').fire('toggle');assert.equal(inspections(),3);assert.equal($('article-link-list').children.length,1);assert.equal($('download-link-notes').disabled,false);assert.equal(approval(),true);
}));
test('Preparation and view toggles keep approval; apply checkpoints exact writing before clearing approval and image mode',()=>controls(({$,ui,prepare,workspace,history,approval,linked,applies})=>{
  const before=workspace.draft.body;prepare();assert.equal(ui.hasWork(),true);assert.equal(approval(),true);assert.equal($('link-apply').disabled,false);assert.equal(workspace.draft.body,before);
  $('link-editor-panel').open=false;$('link-editor-panel').fire('toggle');assert.equal($('link-after').value,'');assert.equal(ui.hasWork(),true);assert.equal(approval(),true);
  $('link-preview').fire('click');$('link-apply').fire('click');assert.equal(applies(),1);assert.equal(approval(),false);assert.equal(linked(),false);assert.equal(ui.hasWork(),false);assert.equal(history.read(history.list()[0].id).draft.body,before);assert.equal($('link-before').value,'');assert.equal($('link-url').value,'');
}));
test('Body edits invalidate pending locations and previews without rebinding repeated passages',()=>controls(({$,ui,prepare,applies})=>{
  prepare();$('body').value='resource resource';ui.refresh();assert.equal($('link-after').value,'');assert.equal($('link-apply').disabled,true);$('link-apply').fire('click');assert.equal(applies(),0);
  $('body').setSelectionRange(9,17);$('link-use-selection').fire('click');$('link-preview').fire('click');$('link-apply').fire('click');assert.equal(applies(),1);assert.ok($('body').value.startsWith('resource '));
}));
test('Busy actions, checkpoint failure, changed details and unsafe URLs retain pending work and article state',()=>controls(({$,ui,prepare,workspace,busy,applies,approval,failCheckpoint,report})=>{
  prepare();const before=workspace.draft.body;busy(true);for(const id of ['link-apply','link-discard','link-use-selection','link-preview-remove'])$(id).fire('click');assert.equal(applies(),0);assert.equal(ui.hasWork(),true);busy(false);
  $('link-label').value='A revised label';$('link-label').fire('input');$('link-apply').fire('click');assert.match(report(),/Preview/);assert.equal(applies(),0);
  $('link-preview').fire('click');failCheckpoint();$('link-apply').fire('click');assert.equal(applies(),0);assert.equal(workspace.draft.body,before);assert.equal(approval(),true);assert.equal(ui.hasWork(),true);assert.match(report(),/Checkpoint/);
  $('link-url').value='https://exam\nple.com/';$('link-url').fire('input');$('link-preview').fire('click');assert.equal($('link-apply').disabled,true);assert.equal($('link-url').value,'https://exam\nple.com/');
}));
test('Existing link selection confirms replacing pending details, no-ops keep approval, and removal preserves original text',()=>controls(({$,ui,prepare,confirm,approval,applies})=>{
  prepare();const body=$('body').value,start=body.indexOf(original);confirm(false);assert.equal(ui.editLink(start,start+original.length),false);assert.equal($('link-label').value,fields.label);
  confirm(true);assert.equal(ui.editLink(start,start+original.length),true);$('link-preview').fire('click');$('link-apply').fire('click');assert.equal(applies(),0);assert.equal(approval(),true);
  ui.editLink(start,start+original.length);$('link-label').value='Pending label';$('link-label').fire('input');$('link-preview-remove').fire('click');assert.equal(inlineParts($('link-after').value)[0].text,'Original resource');$('link-apply').fire('click');assert.equal(applies(),1);assert.ok($('body').value.endsWith('Original resource'));
}));
test('Inventory stays text-only, limits rendering to forty, purges hidden content, and downloads all current links',()=>controls(({$,ui,download,approval})=>{
  $('body').value=Array.from({length:45},(_,i)=>'[Resource '+i+'](https://example.com/'+i+')').join('\n\n');$('link-editor-panel').open=true;$('article-link-list-panel').open=true;ui.refresh();assert.equal($('article-link-list').children.length,40);assert.equal($('article-link-list').querySelectorAll('a').length,0);
  $('download-link-notes').fire('click');assert.match(download()[0],/Resource 44/);assert.doesNotMatch(download()[0],/PRIVATE_SOURCE|PRIVATE_REVIEW/);assert.equal(approval(),true);
  $('article-link-list-panel').open=false;$('article-link-list-panel').fire('toggle');assert.equal($('article-link-list').children.length,0);
}));
test('Oversized paste rejection and discard preserve writing and approval while erasing only preparation',()=>controls(({$,ui,prepare,workspace,approval,workChanges})=>{
  prepare();for(const [id,limit] of [['link-label',300],['link-url',2048]]){const before=$(id).value;let rejected=false;$(id).fire('paste',{clipboardData:{getData:()=> 'x'.repeat(limit+1)},preventDefault:()=>{rejected=true;}});assert.equal(rejected,true);assert.equal($(id).value,before);}
  const before=workspace.draft.body;$('link-discard').fire('click');assert.equal(ui.hasWork(),false);assert.equal(workspace.draft.body,before);assert.equal(approval(),true);assert.ok(workChanges()>0);
}));
test('Old inventory buttons never retarget changed writing and busy downloads do not read article links',()=>controls(({$,ui,busy,download,report})=>{
  $('link-editor-panel').open=true;$('article-link-list-panel').open=true;ui.refresh();const old=$('article-link-list').querySelectorAll('button')[0];
  $('body').value='A wholly different article.';old.fire('click');assert.equal(ui.hasWork(),false);assert.match(report(),/article changed/);
  $('body').value=original;ui.refresh();busy(true);$('download-link-notes').fire('click');assert.equal(download(),null);busy(false);$('download-link-notes').fire('click');assert.match(download()[0],/Original resource/);
}));
test('A table link falls back to its exact source range without replacing pending fields or dropping cells',()=>controls(({$,ui,prepare,applies})=>{
  prepare();const pending=$('link-label').value;const body='| Resource |\n| --- |\n| '+original+' |';$('body').value=body;$('link-editor-panel').open=true;$('article-link-list-panel').open=true;ui.refresh();
  $('article-link-list').querySelectorAll('button')[0].fire('click');assert.equal($('link-label').value,pending);assert.equal($('body').value,body);assert.equal(body.slice($('body').selectionStart,$('body').selectionEnd),original);assert.equal(applies(),0);
}));
test('Existing v1 backups exclude pending fields and retain applied Markdown without adding schema keys',()=>controls(({$,prepare,workspace})=>{
  prepare();const pending=parseWorkspaceBackup(createWorkspaceBackup(workspace.source,workspace.draft));assert.ok(!JSON.stringify(pending).includes(fields.url));assert.equal(pending.version,1);
  $('link-apply').fire('click');const applied=parseWorkspaceBackup(createWorkspaceBackup(workspace.source,workspace.draft));assert.ok(applied.draft.body.includes(fields.url));assert.deepEqual(Object.keys(applied.draft),['title','excerpt','description','slug','body','questions']);assert.equal(applied.source.notes,'PRIVATE_SOURCE');
}));
test('All five workspaces include labeled link controls, safe optional load, and full replacement guards',async()=>{
  for(const route of ['write','markdown-to-wordpress','word-to-wordpress','markdown-to-html','markdown-to-word']){const html=await readFile('public/'+route+'/index.html','utf8');for(const id of ['start-link-editor','link-editor-panel','link-label','link-url','link-before','link-after','article-link-list','link-editor-status'])assert.ok(html.includes('id="'+id+'"'));assert.match(html,/<textarea id="link-url"/);assert.match(html,/for="link-label"/);assert.match(html,/id="link-editor-status"[^>]*role="status"/);}
  const desk=await readFile('public/desk.js','utf8');assert.match(desk,/loadEditingTool\(\(\) => import\('\.\/link-editor-controls.js'\)/);assert.match(desk,/hasUnsavedPreparation:.*linkEditor\?\.hasWork/);assert.equal((desk.match(/linkEditor\?\.clear\(\)/g)||[]).length,2);assert.match(desk,/Link editor could not load/);
});
