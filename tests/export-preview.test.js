import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { prepareExportPreview, renderExportPreview } from '../public/export-preview.js';
import { installExportPreview } from '../public/export-preview-controls.js';
import { renderPreview, renderPreviewBlock } from '../public/preview.js';
import { createHTMLSource } from '../public/html-export.js';
import { createWordDocument, wordDocumentParts } from '../public/word-export.js';
import { createWordPressArticle } from '../public/wordpress-export.js';
import { createArticleMarkdown } from '../public/article-markdown.js';
import { createWorkspaceBackup } from '../public/workspace.js';

const fixture = (body = '# Body heading\n\nA **formatted** paragraph with a [source](https://example.com/source).\n\nENDING') => ({ title: 'Separate title', body, excerpt: '', description: '', slug: '', questions: ['PRIVATE_REVIEW_MARKER'] });
const source = { profile:'guide',audience:'PRIVATE_AUDIENCE',purpose:'PRIVATE_PURPOSE',notes:'PRIVATE_SOURCE_MARKER' };

class Node {
  constructor(tag='div') { this.tagName=tag.toUpperCase(); this.children=[];this.attrs={};this.events={};this.value='';this.checked=false;this.open=false;this.text=''; }
  append(...nodes) { for(const node of nodes)this.children.push(...(node.tagName==='FRAGMENT'?node.children:[node])); }
  replaceChildren(...nodes) { this.children=[];this.append(...nodes); }
  addEventListener(name,fn) { this.events[name]=fn; }
  fire(name='toggle') { return this.events[name]?.(); }
  setAttribute(name,value) { this.attrs[name]=value; }
  set textContent(value) { this.text=value;this.children=[]; }
  get textContent() { return this.text+this.children.map(node=>node.textContent).join(''); }
}
const descend = node => [node,...node.children.flatMap(descend)];
async function withDOM(run) {
  const previous=globalThis.document,nodes=new Map(),$=id=>{if(!nodes.has(id))nodes.set(id,new Node());return nodes.get(id);};
  globalThis.document={getElementById:$,createElement:tag=>new Node(tag),createDocumentFragment:()=>new Node('fragment'),createTextNode:text=>{const node=new Node('text');node.textContent=text;return node;}};
  try { await run({ $, nodes }); } finally { globalThis.document=previous; }
}

test('Word preview follows its actual title inclusion and native heading levels',()=>{
  const draft=fixture(),before=structuredClone(draft);
  const omitted=prepareExportPreview(draft,{destination:'word'}),included=prepareExportPreview(draft,{destination:'word',includeTitle:true});
  assert.equal(omitted.title,'');assert.equal(included.title,'Separate title');assert.equal(omitted.blocks[0].exportLevel,1);assert.match(omitted.titleHandling,/title field is omitted/);
  const xml=new Map(wordDocumentParts(draft,{includeTitle:true}).map(part=>[part.name,part.content])).get('word/document.xml');
  assert.match(xml,/w:pStyle w:val="Title"/);assert.match(xml,/w:pStyle w:val="Heading1"/);assert.deepEqual(draft,before);
});

test('HTML preview normalizes body H1 independently of the separate title, as the exporter does',()=>{
  const draft=fixture(),model=prepareExportPreview(draft,{destination:'html',includeTitle:true});
  assert.equal(model.blocks[0].exportLevel,2);assert.equal(model.blocks[0].type,'h4');assert.equal(model.title,'Separate title');
  const html=createHTMLSource(draft,{includeTitle:true});assert.match(html,/<h1>Separate title<\/h1>/);assert.match(html,/<h2>Body heading<\/h2>/);
  assert.equal(prepareExportPreview(draft,{destination:'html'}).title,'');assert.doesNotMatch(createHTMLSource(draft),/<h1>/);
});

test('WordPress preview uses the same linked image eligibility and body-only content as copied blocks',()=>{
  const draft=fixture('![A picture](https://example.com/picture.png)\n\nInline ![Other](https://example.com/other.png) stays literal.');
  const literal=prepareExportPreview(draft,{destination:'wordpress'}),linked=prepareExportPreview(draft,{destination:'wordpress',includeLinkedImages:true});
  assert.equal(literal.imageCount,0);assert.equal(linked.title,'');assert.equal(linked.imageCount,1);assert.equal(linked.blocks[0].type,'linked-image');
  assert.equal(linked.blocks[0].url,'https://example.com/picture.png');assert.equal(linked.blocks[0].alt,'A picture');
  const article=createWordPressArticle(draft,{includeLinkedImages:true});assert.equal(article.imageCount,linked.imageCount);assert.equal(article.blockCount,linked.blocks.length);assert.equal((article.html.match(/<img /g)||[]).length,1);
  assert.match(linked.limit,/No image is requested here/);assert.match(literal.blocks[1].text,/Inline !\[Other\]/);
});

test('Markdown preview is the exact generated source, including escaped titles, Unicode, CRLF and final newline',()=>{
  const draft=fixture('Café 🐈\r\n\r\n<script>literal()</script>\r\n\r\nENDING');draft.title='A *literal* [title]\ncontinued';
  const model=prepareExportPreview(draft,{destination:'markdown',includeTitle:true});
  assert.equal(model.kind,'source');assert.equal(model.source,createArticleMarkdown(draft,{includeTitle:true}));assert.ok(model.source.includes(draft.body));assert.ok(model.source.endsWith('ENDING\n'));
  assert.match(model.source,/A \\\*literal\\\* \\\[title\\\]/);assert.equal(model.blocks.length,0);
  draft.title='';assert.match(prepareExportPreview(draft,{destination:'markdown',includeTitle:true}).titleHandling,/omitted/);
});

test('Preview validation matches destination readiness and refuses unsupported or oversized inputs',()=>{
  for(const destination of ['word','html','wordpress','markdown'])for(const body of ['', ' ', 'x'.repeat(60001), 'x\u0000y'])assert.throws(()=>prepareExportPreview(fixture(body),{destination}));
  assert.throws(()=>prepareExportPreview(fixture(),{destination:'other'}),/Choose/);assert.throws(()=>prepareExportPreview(fixture(),{destination:'word',includeTitle:'yes'}),/Choose/);
  assert.throws(()=>prepareExportPreview(fixture(),{destination:'word',includeLinkedImages:true}),/only for WordPress/);
  assert.throws(()=>prepareExportPreview(fixture(),{destination:'wordpress',includeTitle:true}),/separate post title/);
  assert.throws(()=>prepareExportPreview(fixture('Bad\u0001XML'),{destination:'word'}),/XML/);
  const noTitle={...fixture(),title:''};assert.throws(()=>prepareExportPreview(noTitle,{destination:'html',includeTitle:true}),/title/i);
  assert.equal(prepareExportPreview(noTitle,{destination:'html'}).title,'');assert.equal(prepareExportPreview(fixture('a'.repeat(59994)+'ENDING'),{destination:'word'}).blocks[0].text.length,60000);
});

test('Shared block renderer protects markup and rejects executable or resource element types',async()=>withDOM(async()=>{
  for(const type of ['script','img','iframe','style','svg'])assert.throws(()=>renderPreviewBlock({type,text:'literal'}),/Unsupported/);
  const node=renderPreviewBlock({type:'p',text:'<script>literal()</script> ![Picture](https://example.com/a.png) [Unsafe](javascript:alert(1))'});
  assert.ok(!descend(node).some(n=>['SCRIPT','IMG','IFRAME','SVG'].includes(n.tagName)));assert.equal(descend(node).filter(n=>n.tagName==='A').length,0);assert.match(node.textContent,/<script>literal/);
}));

test('Linked image preview contains an inert placeholder and exact URL/alt without loading an image',async()=>withDOM(async()=>{
  const value=fixture('![A *literal* image](https://example.com/picture.png)\n\n[Read](https://example.com/source)');
  const target=new Node();renderExportPreview(target,prepareExportPreview(value,{destination:'wordpress',includeLinkedImages:true}));
  const nodes=descend(target);assert.equal(nodes.filter(n=>n.tagName==='FIGURE').length,1);assert.equal(nodes.filter(n=>n.tagName==='IMG').length,0);assert.ok(!nodes.some(n=>Object.hasOwn(n.attrs,'src')));
  assert.match(target.textContent,/Alternative text: A \*literal\* image/);assert.match(target.textContent,/https:\/\/example.com\/picture.png/);assert.equal(nodes.filter(n=>n.tagName==='A').length,1);
}));

test('Structured and Markdown previews keep protected code and formatting aligned with existing rendering',async()=>withDOM(async()=>{
  const value=fixture('## Contents\n\n- **Parent**\n  - *Child*\n\n| A | B |\n| --- | --- |\n| `x` | [Source](https://example.com/) |\n\n```html\n<script>code()</script>\n```');
  const reading=new Node(),destination=new Node();renderPreview(reading,value.title,value.body);renderExportPreview(destination,prepareExportPreview(value,{destination:'word',includeTitle:true}));
  for(const tag of ['UL','LI','STRONG','EM','TABLE','TH','TD','A','PRE','CODE'])assert.equal(descend(destination).filter(n=>n.tagName===tag).length,descend(reading).filter(n=>n.tagName===tag).length,tag);
  assert.match(destination.textContent,/<script>code\(\)<\/script>/);assert.ok(!descend(destination).some(n=>n.tagName==='SCRIPT'));
  const markdown=new Node();renderExportPreview(markdown,prepareExportPreview(value,{destination:'markdown'}));assert.deepEqual(descend(markdown).map(n=>n.tagName),['DIV','PRE','CODE']);assert.equal(markdown.textContent,createArticleMarkdown(value));
}));

async function withUI(run) {
  await withDOM(async({$})=>{
    const state={draft:fixture(),busy:false,linked:false,captures:0};$('publishing-destination').value='word';$('reviewed').checked=true;$('export-format').value='page';
    const ui=installExportPreview({getDraft:()=>{state.captures++;return state.draft;},getWordPressOptions:()=>({includeLinkedImages:state.linked}),isBusy:()=>state.busy});
    ui.update();await run({$,state,ui});
  });
}

test('Closed preview avoids reading writing; opening follows title choices without changing approval',async()=>withUI(async({$,state,ui})=>{
  assert.equal(state.captures,0);assert.equal($('export-content-preview').children.length,0);
  $('export-content-panel').open=true;$('export-content-panel').fire();assert.ok($('export-content-preview').children.length);assert.doesNotMatch($('export-content-preview').textContent,/Separate title/);
  $('word-include-title').checked=true;ui.update();assert.match($('export-content-preview').textContent,/Separate title/);assert.equal($('reviewed').checked,true);assert.equal(state.draft.title,'Separate title');
}));

test('Changing destination, title options and linked images refreshes the current content preview',async()=>withUI(async({$,state,ui})=>{
  $('export-content-panel').open=true;ui.update();
  $('publishing-destination').value='html';ui.update();assert.equal(descend($('export-content-preview')).find(n=>n.attrs['data-export-heading-level']).attrs['data-export-heading-level'],'2');
  $('html-include-title').checked=true;ui.update();assert.match($('export-content-preview').textContent,/Separate title/);
  $('publishing-destination').value='markdown';$('export-format').value='document';ui.update();assert.equal($('export-content-preview').textContent,createArticleMarkdown(state.draft,{includeTitle:true}));
  state.draft=fixture('![Picture](https://example.com/picture.png)');$('publishing-destination').value='wordpress';ui.update();assert.match($('export-content-preview').textContent,/!\[Picture\]/);
  state.linked=true;ui.update();assert.match($('export-content-preview').textContent,/Linked image placeholder/);assert.equal($('reviewed').checked,true);
}));

test('Closing, hiding or resetting purges prepared article text and metadata',async()=>withUI(async({$,state,ui})=>{
  $('export-content-panel').open=true;ui.update();$('export-content-panel').open=false;$('export-content-panel').fire();assert.equal($('export-content-preview').textContent,'');assert.equal($('export-content-title').textContent,'');
  const captures=state.captures;ui.update();assert.equal(state.captures,captures);
  $('export-content-panel').open=true;ui.update();$('publishing-destination').value='other';ui.update();assert.equal($('export-content-panel').hidden,true);assert.equal($('export-content-preview').textContent,'');
  $('publishing-destination').value='word';ui.update();ui.reset();assert.equal($('export-content-panel').open,false);assert.equal($('export-content-preview').textContent,'');assert.equal($('reviewed').checked,true);
}));

test('Busy or invalid input removes stale previews and shows the current failure without mutating writing',async()=>withUI(async({$,state,ui})=>{
  $('export-content-panel').open=true;ui.update();const before=structuredClone(state.draft);
  state.busy=true;ui.update();assert.equal($('export-content-preview').textContent,'');assert.match($('export-content-status').textContent,/Finish the current file operation/);assert.deepEqual(state.draft,before);
  state.busy=false;state.draft.body='bad\u0000text';ui.update();assert.equal($('export-content-preview').textContent,'');assert.match($('export-content-status').textContent,/article body/i);
  state.draft=fixture('Corrected current text.');ui.update();assert.equal($('export-content-preview').textContent,'Corrected current text.');assert.equal($('reviewed').checked,true);
}));

test('Unchanged article/options preserve DOM nodes, while edits immediately refresh an open preview',async()=>withUI(async({$,state,ui})=>{
  $('export-content-panel').open=true;ui.update();const first=$('export-content-preview').children[0];ui.update();assert.equal($('export-content-preview').children[0],first);
  state.draft.questions=['PRIVATE_CHANGED_QUESTION'];ui.update();assert.equal($('export-content-preview').children[0],first);
  state.draft.body='A new current paragraph.';ui.update();assert.equal($('export-content-preview').textContent,'A new current paragraph.');assert.equal($('reviewed').checked,true);
}));

test('Preview models and rendered content exclude private fields and never alter actual export bytes',async()=>withDOM(async()=>{
  const value=fixture(),before=structuredClone(value),wordBefore=createWordDocument(value),htmlBefore=createHTMLSource(value),wpBefore=createWordPressArticle(value).html;
  for(const destination of ['word','html','wordpress','markdown']) {
    const model=prepareExportPreview({...value,source},{destination}),target=new Node();renderExportPreview(target,model);
    for(const marker of ['PRIVATE_REVIEW_MARKER','PRIVATE_SOURCE_MARKER','PRIVATE_AUDIENCE','PRIVATE_PURPOSE']) {assert.ok(!JSON.stringify(model).includes(marker));assert.ok(!target.textContent.includes(marker));}
  }
  assert.deepEqual(value,before);assert.deepEqual(createWordDocument(value),wordBefore);assert.equal(createHTMLSource(value),htmlBefore);assert.equal(createWordPressArticle(value).html,wpBefore);
}));

test('Private workspace files retain their existing schema without export-preview state',async()=>withUI(async({$,state,ui})=>{
  $('export-content-panel').open=true;ui.update();const saved=JSON.parse(createWorkspaceBackup(source,state.draft));
  assert.deepEqual(Object.keys(saved),['format','version','source','draft']);assert.deepEqual(saved.draft,state.draft);assert.equal(saved.source.notes,'PRIVATE_SOURCE_MARKER');
  assert.doesNotMatch(JSON.stringify(saved),/exportLevel|imageCount|titleHandling|export-content|preview/);
}));

test('All seven workspaces include the accessible optional preview with local-only responsive rendering',async()=>{
  for(const route of ['write','word-to-wordpress','word-to-markdown','google-docs-to-wordpress','markdown-to-wordpress','markdown-to-html','markdown-to-word']) {
    const html=await readFile('public/'+route+'/index.html','utf8');
    for(const id of ['export-content-panel','export-content-summary','export-content-preview','export-content-title','export-content-limit','export-content-status'])assert.equal(html.split('id="'+id+'"').length,2);
    assert.match(html,/id="export-content-preview"[^>]*role="region"[^>]*tabindex="0"/);assert.doesNotMatch(html,/id="export-content-panel"[^>]*open/);
    assert.ok(html.indexOf('id="export-content-panel"')<html.indexOf('id="export-format-review"'));
  }
  for(const path of ['public/export-preview.js','public/export-preview-controls.js'])assert.doesNotMatch(await readFile(path,'utf8'),/fetch\s*\(|XMLHttpRequest|innerHTML|outerHTML|srcdoc|localStorage|sessionStorage|indexedDB/);
  assert.match(await readFile('public/desk.css','utf8'),/@media\(max-width:850px\)\{\.export-content-preview\{max-height:none;overflow:visible/);
});
