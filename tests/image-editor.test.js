import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { imageEditTarget, imageMarkdown, planImageEdit, wordImagePlaceholders } from '../public/image-editing.js';
import { installImageEditor } from '../public/image-editor-controls.js';
import { inlineTokens, decodeMarkdownEscapes } from '../public/markdown-inline.js';
import { analyzeWordPressImages } from '../public/wordpress-images.js';
import { createWordPressArticle } from '../public/wordpress-export.js';
import { createCheckpointHistory } from '../public/revisions.js';
import { createWorkspaceBackup, parseWorkspaceBackup } from '../public/workspace.js';

const fields = { url: 'https://example.com/photo_(1).jpg?a=1&b=2', alt: 'Fictional workshop participants' };
const placeholder = '\\[Image or object omitted from Word document\\]';
const planAt = (body, start, end, value = fields) => planImageEdit(imageEditTarget(body, start, end), value, body);

test('Image details round-trip Unicode and literal Markdown punctuation without loading a URL', () => {
  for (const alt of ['日本語 😀', 'A [bracket] and \\ slash', '* _ ` ! > < & "']) {
    const markdown = imageMarkdown({ ...fields, alt }), tokens = inlineTokens(markdown);
    assert.equal(tokens.length, 1); assert.equal(tokens[0].type, 'image'); assert.equal(decodeMarkdownEscapes(tokens[0].text), alt);
    const result = createWordPressArticle({ body: markdown }, { includeLinkedImages: true });
    assert.equal(result.imageCount, 1); assert.doesNotMatch(result.html, /<script|<svg/);
  }
  assert.equal(imageMarkdown({ ...fields, url: 'HTTPS://EXAMPLE.COM/p.jpg' }), '![Fictional workshop participants](HTTPS://EXAMPLE.COM/p.jpg)');
  assert.equal(decodeMarkdownEscapes(inlineTokens('[A \\[label\\]](https://example.com/)')[0].text), 'A [label]');
  assert.equal(inlineTokens('[nested [label]](https://example.com/)')[0].type, 'text');
});
test('Empty alt text requires an explicit decorative decision, with no silently discarded text', () => {
  assert.match(imageMarkdown({ ...fields, alt: '', decorative: true }), /^!\[\]/);
  for (const value of [{ alt: '' }, { alt: ' ' }, { decorative: true }, { decorative: 'true' }, { decorative: null }]) assert.throws(() => imageMarkdown({ ...fields, ...value }));
});
test('Unsafe, malformed, multiline, oversized, and unbalanced URL or alternative text rejects in full', () => {
  for (const url of ['http://example.com/a','https://u:p@example.com/a','https://example.com/a b','https://exam\rple.com/a','https://exam\nple.com/a','https://example.com/a)','https://example.com/a(','data:image/png,x','/a','https://example.com/"x','https://example.com/' + 'a'.repeat(2048),null]) assert.throws(() => imageMarkdown({ ...fields, url }), undefined, String(url));
  for (const alt of ['a\nb','a\rb','a\0b','a\tb','x'.repeat(501),null,[]]) assert.throws(() => imageMarkdown({ ...fields, alt }));
  assert.ok(imageMarkdown({ ...fields, alt: 'a'.repeat(500) }));
});
test('Insertion and inline Word placeholder replacement preserve exact surrounding prose and UTF-16 offsets', () => {
  const body = '日本語 😀 before ' + placeholder + ' after.\r\n\r\n## Next\r\n\r\nThe ending.';
  const start = body.indexOf(placeholder), end = start + placeholder.length, plan = planAt(body, start, end);
  assert.equal(plan.body, body.slice(0, start) + '\r\n\r\n' + plan.markdown + '\r\n\r\n' + body.slice(end));
  assert.equal(plan.before, placeholder); assert.equal(plan.body.slice(plan.selectionStart, plan.selectionEnd), plan.markdown);
  assert.equal(analyzeWordPressImages(plan.body)[0].eligible, true);
  assert.equal(createWordPressArticle({ body: plan.body }, { includeLinkedImages: true }).imageCount, 1);
  assert.deepEqual(wordImagePlaceholders(body), [{ start, end, line: 1 }]);
  assert.equal(wordImagePlaceholders('[Image or object omitted from Word document]').length, 1);
});
test('Article start, end, blank lines, and existing paragraph breaks create standalone images without rewriting source', () => {
  for (const [body, position] of [['',0],['Text.',0],['Text.',5],['# Heading',9],['- List item',11],['~~~\ncode\n~~~',12],['Before.\n\nAfter.',8],['Before.\n\n',9]]) {
    const plan = planAt(body, position, position);
    assert.equal(plan.body.slice(0, position), body.slice(0, position)); assert.ok(plan.body.endsWith(body.slice(position)));
    assert.equal(analyzeWordPressImages(plan.body).filter(item => item.eligible).length, 1);
  }
  const original = imageMarkdown(fields), body = 'Before.\n\n' + original + '\n\nAfter.', start = body.indexOf(original);
  assert.equal(planAt(body, start, start + original.length).changed, false);
});
test('Invalid selections, split CRLF/surrogates, partial formatted tokens, and complex block contexts reject', () => {
  for (const [body,start,end] of [['😀',1,1],['a\r\nb',2,2],['text',-1,2],['text',2,1],['text',0,5],['text',0.5,2],['# Heading',2,4],['- List text',2,6],['> Quote',2,4],['A | B\n--- | ---\n1 | 2',0,1],['    Code',4,6],['~~~\ncode\n~~~',4,8],['<div>literal</div>',5,12],['**bold**',3,4],['One\n\nTwo',1,7]]) assert.throws(() => planAt(body,start,end), undefined, JSON.stringify([body,start,end]));
  assert.throws(() => planAt('~~~\ncode',8,8), /Close/);
  assert.ok(planAt('**bold**',0,8).changed);
});
test('Stale targets and total-body overflow reject atomically, including repeated text', () => {
  const body = 'Repeat Repeat', target = imageEditTarget(body,0,6);
  assert.throws(() => planImageEdit(target,fields,body + ' Repeat'), /article changed/);
  assert.throws(() => planAt('a'.repeat(60000),60000,60000), /60,000/);
  for (const body of ['x'.repeat(60001),'x\0y',null]) assert.throws(() => wordImagePlaceholders(body));
});

class Control {
  constructor() { this.value='';this.checked=false;this.disabled=false;this.open=false;this.hidden=false;this.children=[];this.events=new Map();this.selectionStart=0;this.selectionEnd=0; }
  addEventListener(type,fn) { if(!this.events.has(type))this.events.set(type,[]);this.events.get(type).push(fn); }
  fire(type,event={}) { for(const fn of this.events.get(type)||[])fn(event); }
  replaceChildren(...nodes) { this.children=nodes; if(nodes.length)this.value=nodes[0].value; }
  focus() { this.focused=true; }
  setSelectionRange(start,end) { this.selectionStart=start;this.selectionEnd=end; }
}
function controls(run) {
  const prior=globalThis.document, map=new Map(), $=id=>{if(!map.has(id))map.set(id,new Control());return map.get(id);};
  globalThis.document={getElementById:$,createElement:()=>new Control()};
  let busy=false, approval=true, linked=true, checkpointFailure=false, applies=0, confirmation=true, report='', workChanges=0;
  const workspace={source:{profile:'personal',audience:'',purpose:'',notes:'PRIVATE_SOURCE'},draft:{title:'Fictional',excerpt:'',description:'',slug:'',questions:['PRIVATE_REVIEW'],body:'Before '+placeholder+' after.'}};
  const history=createCheckpointHistory(); $('body').value=workspace.draft.body;
  const ui=installImageEditor({getBody:()=>$('body').value,isBusy:()=>busy,workChanged:()=>{workChanges++;},report:text=>{report=text;},confirmAction:()=>confirmation,reveal:()=>{},apply:(plan,label)=>{
    if(checkpointFailure)throw Error('Checkpoint failed.');history.save(workspace,label);workspace.draft.body=plan.body;$('body').value=plan.body;approval=false;linked=false;applies++;ui.refresh();
  }});
  const prepare=()=>{$('image-use-placeholder').fire('click');for(const [key,id] of [['url','image-url'],['alt','image-alt']]){$(id).value=fields[key];$(id).fire('input');}$('image-preview').fire('click');};
  try {run({$,ui,prepare,workspace,history,approve:()=>{approval=true;},approval:()=>approval,linked:()=>linked,applies:()=>applies,workChanges:()=>workChanges,report:()=>report,busy:value=>{busy=value;ui.refresh();},failCheckpoint:()=>{checkpointFailure=true;},confirm:value=>{confirmation=value;}});}
  finally {globalThis.document=prior;}
}
test('Preparation, preview, panel toggles, and discard preserve article and approval; application checkpoints before mutation',()=>controls(({$,ui,prepare,workspace,history,approval,linked,applies})=>{
  const before=workspace.draft.body;prepare();assert.equal(ui.hasWork(),true);assert.equal(approval(),true);assert.equal(linked(),true);assert.equal($('image-apply').disabled,false);assert.equal(workspace.draft.body,before);
  $('image-editor-panel').open=false;$('image-editor-panel').fire('toggle');assert.equal($('image-after').value,'');assert.equal($('image-apply').disabled,true);assert.equal(ui.hasWork(),true);
  $('image-preview').fire('click');$('image-apply').fire('click');assert.equal(applies(),1);assert.equal(ui.hasWork(),false);assert.equal(approval(),false);assert.equal(linked(),false);assert.equal(history.read(history.list()[0].id).draft.body,before);
  assert.equal($('image-url').value,'');assert.equal($('image-alt').value,'');assert.equal($('image-before').value,'');assert.equal($('image-placeholder-choices').hidden,true);
}));
test('Article changes clear previews and cannot retarget repeated or missing passages until a fresh selection',()=>controls(({$,ui,prepare,applies})=>{
  prepare();$('body').value='Repeat Repeat';ui.refresh();assert.equal($('image-apply').disabled,true);assert.equal($('image-after').value,'');$('image-apply').fire('click');assert.equal(applies(),0);
  $('body').setSelectionRange(7,13);$('image-use-selection').fire('click');$('image-preview').fire('click');$('image-apply').fire('click');assert.equal(applies(),1);assert.ok($('body').value.startsWith('Repeat '));
}));
test('Busy, failed checkpoint, invalid fields, and changed details preserve preparation and writing',()=>controls(({$,ui,prepare,workspace,busy,failCheckpoint,applies,approval,report})=>{
  prepare();const before=workspace.draft.body;busy(true);for(const id of ['image-apply','image-discard','image-at-end','image-use-placeholder'])$(id).fire('click');assert.equal(applies(),0);assert.equal(ui.hasWork(),true);busy(false);
  $('image-alt').value='Changed description';$('image-alt').fire('input');$('image-apply').fire('click');assert.equal(applies(),0);assert.match(report(),/Preview/);
  $('image-preview').fire('click');failCheckpoint();$('image-apply').fire('click');assert.equal(applies(),0);assert.equal(workspace.draft.body,before);assert.equal(approval(),true);assert.equal(ui.hasWork(),true);assert.match(report(),/Checkpoint/);
  $('image-url').value='https://exam\nple.com/a.jpg';$('image-url').fire('input');$('image-preview').fire('click');assert.equal($('image-apply').disabled,true);assert.equal($('image-url').value,'https://exam\nple.com/a.jpg');
}));
test('Editing existing images confirms replacing pending details, requires decorative choice, and skips no-op checkpoints',()=>controls(({$,ui,prepare,confirm,approval,applies})=>{
  prepare();const image=imageMarkdown(fields);$('body').value=image;ui.clear();assert.equal(ui.editImage(0,image.length),true);$('image-preview').fire('click');$('image-apply').fire('click');assert.equal(applies(),0);assert.equal(approval(),true);
  $('image-url').value='https://example.com/pending.jpg';$('image-url').fire('input');confirm(false);assert.equal(ui.editImage(0,image.length),false);assert.equal($('image-url').value,'https://example.com/pending.jpg');
  confirm(true);assert.equal(ui.editImage(0,image.length),true);assert.equal($('image-url').value,fields.url);
  const empty='![](https://example.com/a.jpg)';$('body').value=empty;ui.clear();ui.editImage(0,empty.length);$('image-preview').fire('click');assert.equal($('image-apply').disabled,true);$('image-decorative').checked=true;$('image-decorative').fire('change');$('image-preview').fire('click');assert.equal($('image-apply').disabled,false);
}));
test('Oversized pastes reject in full; clear and discard erase preparation and retain writing and approval',()=>controls(({$,ui,prepare,workspace,approval,workChanges})=>{
  prepare();for(const [id,limit] of [['image-url',2048],['image-alt',500]]){const before=$(id).value;let rejected=false;$(id).fire('paste',{clipboardData:{getData:()=> 'x'.repeat(limit+1)},preventDefault:()=>{rejected=true;}});assert.equal(rejected,true);assert.equal($(id).value,before);}
  const before=workspace.draft.body;$('image-discard').fire('click');assert.equal(ui.hasWork(),false);assert.equal(workspace.draft.body,before);assert.equal(approval(),true);assert.ok(workChanges()>0);
}));
test('Pending preparation stays out of unchanged v1 backups and applied image Markdown uses existing article fields',()=>controls(({$,prepare,workspace})=>{
  prepare();const pending=parseWorkspaceBackup(createWorkspaceBackup(workspace.source,workspace.draft));assert.equal(pending.version,1);assert.ok(!JSON.stringify(pending).includes(fields.url));
  $('image-apply').fire('click');const applied=parseWorkspaceBackup(createWorkspaceBackup(workspace.source,workspace.draft));assert.ok(applied.draft.body.includes(fields.url));assert.deepEqual(applied.draft.questions,['PRIVATE_REVIEW']);assert.equal(applied.source.notes,'PRIVATE_SOURCE');
}));
test('All five workspaces provide accessible image controls, local optional load, and reset/replacement guards',async()=>{
  for(const route of ['write','markdown-to-wordpress','word-to-wordpress','markdown-to-html','markdown-to-word']){
    const html=await readFile('public/'+route+'/index.html','utf8');for(const id of ['image-editor-panel','image-url','image-alt','image-decorative','image-before','image-after','image-editor-status','image-placeholder-select'])assert.ok(html.includes('id="'+id+'"'));
    assert.match(html,/<textarea id="image-url"/);assert.match(html,/for="image-alt"/);assert.match(html,/id="image-editor-status"[^>]*role="status"/);
  }
  const desk=await readFile('public/desk.js','utf8');assert.match(desk,/loadEditingTool\(\(\) => import\('\.\/image-editor-controls.js'\)/);assert.match(desk,/revisions.captureBefore\(label\);\s*\$\('body'\).value = plan.body/);assert.match(desk,/hasUnsavedPreparation:.*imageEditor\?\.hasWork/);assert.equal((desk.match(/imageEditor\?\.clear\(\)/g)||[]).length,2);assert.match(desk,/Image editor could not load/);
});
