import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { planReferenceLinks, hasReferenceLinks } from '../public/reference-links.js';
import { installReferenceLinks } from '../public/reference-link-controls.js';
import { articleLinks } from '../public/link-editing.js';
import { createFormattedArticle, createReadingPage } from '../public/html-export.js';
import { createWordPressArticle } from '../public/wordpress-export.js';
import { wordDocumentParts } from '../public/word-export.js';
import { createArticleMarkdown } from '../public/article-markdown.js';
import { createWorkspaceBackup } from '../public/workspace.js';

test('Full, collapsed and shortcut references expand independently with normalized ASCII identifiers and formatted labels',()=>{
  const body='## A [**source**][Doc  One]\n\n[doc one][] and [DOC\tONE].\n\n[doc one]: <https://example.com/source>\n';
  const plan=planReferenceLinks(body);
  assert.equal(plan.body,'## A [**source**](https://example.com/source)\n\n[doc one](https://example.com/source) and [DOC\tONE](https://example.com/source).\n\n');
  assert.equal(plan.converted,3);assert.equal(plan.removed,1);assert.equal(plan.unresolvedCount,0);assert.equal(plan.original,body);
  assert.deepEqual(plan.examples.map(v=>v.line),[1,3,3]);assert.equal(articleLinks(plan.body).length,3);
});

test('Source edits retain exact Unicode, CRLF, whitespace, unrelated definitions and the last character',()=>{
  const body='Café 🐈\r\n\r\nA [label][x].\r\n\r\n[x]: https://example.com/\r\n[unused]: https://example.org/\r\n\r\nENDING';
  const plan=planReferenceLinks(body);
  assert.equal(plan.body,'Café 🐈\r\n\r\nA [label](https://example.com/).\r\n\r\n[unused]: https://example.org/\r\n\r\nENDING');
  assert.equal(plan.keptDefinitions,1);assert.equal(plan.removed,1);
  const keep=planReferenceLinks(body,{removeDefinitions:false});assert.equal(keep.removed,0);assert.ok(keep.body.includes('[x]: https://example.com/\r\n'));
});

test('Definitions shared with images, code, escaped syntax or unsupported positions stay intact',()=>{
  const examples=['![Picture][x]','`[x]`','```md\n[x]\n```','    [x]','A <span title="[x]">literal</span>','\\[x]'];
  for(const remaining of examples){
    const body='[Read][x]\n\n'+remaining+'\n\n[x]: https://example.com/';
    const plan=planReferenceLinks(body);assert.equal(plan.converted,1);assert.equal(plan.removed,0);assert.ok(plan.body.endsWith('[x]: https://example.com/'));assert.ok(plan.body.includes(remaining));
  }
});

test('Unsafe, missing, duplicate, titled, multiline, non-ASCII and container definitions never become active links',()=>{
  const cases=[
    '[Read][x]\n\n[x]: javascript:alert(1)', '[Read][x]\n\n[x]: https://u:p@example.com/',
    '[Read][x]\n\n[x]: /relative', '[Read][x]\n\n[x]: https://example.com/ "Title"',
    '[Read][x]\n\n[x]:\nhttps://example.com/', '[Read][x]\n\n[x]: https://example.com/\n[X]: https://example.org/',
    '[Read][café]\n\n[café]: https://example.com/', '[Read][x]\n\n> [x]: https://example.com/',
    '[Read][x]\n\nOther prose\n[x]: https://example.com/', '[Read][x]\n\n[x]: https://example.com/a b'
  ];
  for(const body of cases){const plan=planReferenceLinks(body);assert.equal(plan.body,body);assert.equal(plan.changed,false);assert.equal(plan.converted,0);assert.ok(plan.unresolvedCount>0);}
  assert.equal(planReferenceLinks('[ordinary brackets]').body,'[ordinary brackets]');
});

test('Existing inline links, fenced code, reference images, footnotes, nested labels and code labels remain protected',()=>{
  const body='[Keep](https://example.org/[x])\n\n[Read][x]\n\n![alt][x]\n\n[outer [inner]][x]\n\n[^foot]\n\n[^foot]: Footnote text.\n\n```\n[code][x]\n```\n\n[x]: https://example.com/';
  const plan=planReferenceLinks(body);assert.equal(plan.converted,1);assert.equal(plan.removed,0);
  for(const kept of ['[Keep](https://example.org/[x])','![alt][x]','[outer [inner]][x]','[^foot]: Footnote text.','[code][x]'])assert.ok(plan.body.includes(kept));
  assert.equal(planReferenceLinks('[`code`][x]\n\n[x]: https://example.com/').converted,1);
  assert.throws(()=>planReferenceLinks('[multiline\nlabel][x]\n\n[x]: https://example.com/'),/Multiline|multiline/);
  assert.throws(()=>planReferenceLinks('[Read][unclosed\n\n[x]: https://example.com/'),/unclosed/);
  assert.throws(()=>planReferenceLinks('[Read][x]\n\n<div>\n\n[x]: https://example.com/\n\n</div>'),/Source HTML blocks/);
  assert.throws(()=>planReferenceLinks('[broken](destination [x]\n\n[x]: https://example.com/'),/malformed inline link/);
});

test('URL parentheses and pipes remain safe in tables, headings, quotations and nested lists',()=>{
  const body='## [Heading][x]\n\n> [Quote][x]\n\n- [Parent][x]\n  - [Child][x]\n\n| Source |\n| --- |\n| [Cell][x] |\n\n[x]: https://example.com/a_(b)?q=a|b';
  const plan=planReferenceLinks(body), draft={title:'Example',body:plan.body};
  assert.equal(plan.converted,5);assert.equal(plan.removed,1);assert.ok(plan.body.includes('https://example.com/a_%28b%29?q=a%7Cb'));
  const html=createFormattedArticle(draft).html;assert.equal((html.match(/<a /g)||[]).length,5);assert.match(html,/<table>/);assert.match(html,/<blockquote>/);assert.match(html,/<li>/);
});

test('Exact count and output bounds reject excess before replacement and preserve complete endings',()=>{
  const definitions=Array.from({length:200},(_,i)=>'[r'+i+']: https://e.co/').join('\n');
  assert.equal(planReferenceLinks(definitions).keptDefinitions,200);assert.throws(()=>planReferenceLinks(definitions+'\n[extra]: https://e.co/'),/200/);
  const uses=Array.from({length:1000},()=> '[x][r]').join(' ')+'\n\n[r]: https://e.co/';
  assert.equal(planReferenceLinks(uses).converted,1000);assert.throws(()=>planReferenceLinks('[x][r] '+uses),/1,000/);
  const before='[x][r]\n\n[r]: https://e.co/\n\n',after='[x](https://e.co/)\n\n[r]: https://e.co/\n\n';
  const padding='a'.repeat(60000-after.length-6)+'ENDING';
  assert.equal(planReferenceLinks(before+padding,{removeDefinitions:false}).body.length,60000);
  assert.throws(()=>planReferenceLinks(before+padding+'!',{removeDefinitions:false}),/60,000/);
  assert.throws(()=>planReferenceLinks('x'.repeat(60001)),/60,000/);assert.throws(()=>planReferenceLinks('x\0y'),/null/);
  assert.throws(()=>planReferenceLinks('x',{removeDefinitions:'yes'}),/Choose/);
});

test('Expanded article links reach every existing export and private fields remain excluded',()=>{
  const plan=planReferenceLinks('A [**source**][x].\n\n[x]: https://example.com/source');
  const draft={title:'Fictional title',body:plan.body,excerpt:'',description:'',slug:'example',questions:['PRIVATE_REVIEW']};
  for(const output of [createFormattedArticle(draft).html,createReadingPage(draft),createWordPressArticle(draft).html]){assert.match(output,/href="https:\/\/example.com\/source"/);assert.doesNotMatch(output,/PRIVATE_REVIEW|reference-ack|reference-after/);}
  const parts=new Map(wordDocumentParts(draft).map(part=>[part.name,part.content]));assert.match(parts.get('word/_rels/document.xml.rels'),/https:\/\/example.com\/source/);assert.match(parts.get('word/document.xml'),/<w:hyperlink/);
  assert.equal(createArticleMarkdown(draft),plan.body);
  const backup=createWorkspaceBackup({profile:'personal',audience:'',purpose:'',notes:'PRIVATE_SOURCE'},draft);assert.match(backup,/PRIVATE_SOURCE/);assert.doesNotMatch(backup,/removeDefinitions|unresolvedCount|reference-ack/);
});

class Node {
  constructor(tag='div'){this.tagName=tag.toUpperCase();this.children=[];this.events={};this.attrs={};this.value='';this.checked=false;this.hidden=false;this.disabled=false;this.text='';}
  append(...nodes){for(const node of nodes)this.children.push(...(node.tagName==='FRAGMENT'?node.children:[node]));}
  replaceChildren(...nodes){this.children=[];this.append(...nodes);}
  addEventListener(name,fn){(this.events[name]||=[]).push(fn);}
  fire(name='click'){for(const fn of this.events[name]||[])fn();}
  setAttribute(name,value){this.attrs[name]=value;}
  set textContent(value){this.text=value;this.children=[];}
  get textContent(){return this.text+this.children.map(node=>node.textContent).join('');}
}
function withUI(run){
  const original=globalThis.document,nodes=new Map(),$=id=>{if(!nodes.has(id))nodes.set(id,new Node());return nodes.get(id);};
  globalThis.document={getElementById:$,createElement:tag=>new Node(tag),createDocumentFragment:()=>new Node('fragment'),createTextNode:text=>{const node=new Node('text');node.textContent=text;return node;}};
  $('body').value='A [source][x].\n\n[x]: https://example.com/';$('reference-remove-definitions').checked=true;$('reviewed').checked=true;
  let busy=false,pending=false,fail=false,applied=0,returned=0,message='';const checkpoints=[];
  let ui;
  ui=installReferenceLinks({getBody:()=>$('body').value,getTitle:()=>'Fictional title',isBusy:()=>busy,hasPendingImport:()=>pending,report:text=>{message=text;},apply:(body,label)=>{if(fail)throw new Error('Checkpoint unavailable');checkpoints.push($('body').value);$('body').value=body;$('reviewed').checked=false;applied++;ui.refresh();},onApplied:()=>{returned++;}});
  try{return run({$,ui,checkpoints,applied:()=>applied,returned:()=>returned,message:()=>message,setBusy:v=>{busy=v;},setPending:v=>{pending=v;},setFail:v=>{fail=v;}});}finally{globalThis.document=original;}
}

test('Preparation stays staged, acknowledgement gates apply, and apply checkpoints only the original article',()=>withUI(({$,ui,checkpoints,applied,returned})=>{
  const before=$('body').value;$('reference-prepare').fire();assert.equal($('body').value,before);assert.equal($('reviewed').checked,true);assert.equal($('reference-apply').disabled,true);
  assert.match($('reference-after').value,/\[source\]\(https:\/\/example.com\/\)/);assert.equal($('reference-result').hidden,false);
  $('reference-apply').fire();assert.equal(applied(),0);
  $('reference-ack').checked=true;$('reference-ack').fire('change');assert.equal($('reference-apply').disabled,false);$('reference-apply').fire();
  assert.equal(applied(),1);assert.deepEqual(checkpoints,[before]);assert.equal($('reviewed').checked,false);assert.equal(returned(),1);assert.equal($('reference-after').value,'');assert.equal($('reference-ack').checked,false);assert.equal($('reference-result').hidden,true);assert.equal($('reference-links-panel').hidden,true);assert.match($('reference-status').textContent,/Conversion applied/);
}));

test('Article edits, option changes, pending imports and file reads prevent stale conversion',()=>withUI(({$,ui,applied,setBusy,setPending})=>{
  $('reference-prepare').fire();$('reference-ack').checked=true;$('body').value+='\nChanged.';$('reference-apply').fire();assert.equal(applied(),0);assert.equal($('reference-after').value,'');
  $('reference-prepare').fire();$('reference-ack').checked=true;$('reference-remove-definitions').checked=false;$('reference-remove-definitions').fire('change');assert.equal($('reference-after').value,'');assert.equal($('reference-apply').disabled,true);
  for(const setBlocked of [setBusy,setPending]){ $('reference-prepare').fire();$('reference-ack').checked=true;setBlocked(true);ui.refresh();assert.equal($('reference-apply').disabled,true);assert.equal($('reference-prepare').disabled,true);$('reference-apply').fire();assert.equal(applied(),0);setBlocked(false);ui.refresh();}
}));

test('Discard, failed checkpoint, no-op preparation and full reset preserve the right state',()=>withUI(({$,ui,applied,setFail,message})=>{
  const before=$('body').value;$('reference-prepare').fire();$('reference-discard').fire();assert.equal($('body').value,before);assert.equal($('reviewed').checked,true);assert.equal($('reference-after').value,'');
  $('reference-prepare').fire();$('reference-ack').checked=true;setFail(true);$('reference-apply').fire();assert.equal(applied(),0);assert.equal($('body').value,before);assert.equal($('reviewed').checked,true);assert.match(message(),/Checkpoint unavailable/);assert.notEqual($('reference-after').value,'');
  ui.clear();ui.refresh();assert.equal($('reference-ack').checked,false);assert.equal($('reference-after').value,'');assert.equal($('reference-remove-definitions').checked,true);
  $('body').value='[x]: /unsupported';ui.refresh();$('reference-prepare').fire();assert.equal($('reference-apply').disabled,true);assert.equal($('reviewed').checked,true);
}));

test('Every public workspace includes one discoverable, labeled preparation flow and accurate guidance',async()=>{
  for(const route of ['write','word-to-wordpress','word-to-markdown','html-to-markdown','google-docs-to-wordpress','markdown-to-wordpress','markdown-to-html','markdown-to-word']){
    const html=await readFile('public/'+route+'/index.html','utf8');
    for(const id of ['reference-links-panel','reference-prepare','reference-after','reference-ack','reference-apply'])assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1);
    assert.ok(html.indexOf('id="reference-links-panel"')<html.indexOf('id="exports"'));assert.match(html,/aria-label="Reading preview of proposed reference conversion"/);assert.match(html,/for="reference-after"/);assert.match(html,/id="reference-links-panel"[^>]*hidden/);
  }
  const help=await readFile('public/help/draft-checks/index.html','utf8');assert.match(help,/id="reference-links"/);assert.match(help,/not a full CommonMark implementation/);assert.match(help,/1,000 reference uses/);
  assert.equal(hasReferenceLinks('[x][ref]'),true);assert.equal(hasReferenceLinks('[ref]: https://example.com/'),true);assert.equal(hasReferenceLinks('No references.'),false);
});
