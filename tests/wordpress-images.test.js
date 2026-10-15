import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { safeImageLink, standaloneWordPressImage, analyzeWordPressImages, wordPressImageBlocks, wordPressImagePlan } from '../public/wordpress-images.js';
import { createWordPressArticle } from '../public/wordpress-export.js';
import { reviewWordPress } from '../public/wordpress-review.js';
import { analyzeDraft } from '../public/draft-review.js';
import { wordPressKitFiles, createWordPressKit } from '../public/wordpress-kit.js';
import { createReadingPage, createFormattedArticle, createHTMLSource } from '../public/html-export.js';
import { createWordDocument } from '../public/word-export.js';
import { createWorkspaceBackup, parseWorkspaceBackup } from '../public/workspace.js';
import { installWordPressImages } from '../public/wordpress-image-controls.js';
import { installPublishingExports } from '../public/export-controls.js';

const image = '![Workshop participants](https://example.com/workshop.jpg)';
const draft = () => ({ title: 'Fictional workshop', excerpt: '', description: '', slug: '', body: '## Our workshop\n\n' + image + '\n\nA fictional observation.', questions: ['PRIVATE REVIEW'], source: { notes: 'PRIVATE SOURCE' } });
const on = { includeLinkedImages: true };

test('Image URLs require absolute HTTPS without credentials or unsafe attribute characters', () => {
  assert.equal(safeImageLink('HTTPS://EXAMPLE.COM/p.jpg?a=1&b=2'), 'https://example.com/p.jpg?a=1&b=2');
  for (const url of ['http://example.com/p.jpg','//example.com/p.jpg','/p.jpg','javascript:bad()','data:image/png;base64,xx','blob:https://example.com/a','file:///a','https://user:secret@example.com/a','https://example.com/a b','https://example.com/"x','https://example.com/\\x','https://example.com/\0x','https://example.com/\nx']) assert.equal(safeImageLink(url), null, url);
});
test('Standalone detection respects exact paragraphs, indentation, code, titles, and CRLF', () => {
  assert.equal(standaloneWordPressImage('   ' + image + '  \r').url, 'https://example.com/workshop.jpg');
  for (const value of ['    ' + image,'\t'+image,'prose '+image,image+' prose',image+'\n'+image,'`'+image+'`','\\'+image,'[x]: https://example.com/a',image.replace('workshop.jpg','work\rshop.jpg')]) assert.equal(standaloneWordPressImage(value), null, value);
  assert.equal(standaloneWordPressImage('![alt](https://example.com/p.jpg "title")').url, null);
  assert.deepEqual(analyzeWordPressImages(''), []);
  for (const body of [null,'x'.repeat(60001),'x\0y']) assert.throws(() => analyzeWordPressImages(body));
});
test('Image analysis excludes code and recognizes unsupported placement without guessing or normalizing offsets', () => {
  const body = '日本語 😀\r\n\r\n' + image + '\r\n\r\nInline '+image+' text.\r\n\r\n- '+image+'\r\n\r\n> '+image+'\r\n\r\n# '+image+'\r\n\r\n`'+image+'`\r\n\r\n~~~\r\n'+image+'\r\n~~~';
  const images = analyzeWordPressImages(body); assert.equal(images.length, 5); assert.equal(images.filter(x => x.eligible).length, 1);
  for (const item of images) { assert.equal(body.slice(item.start, item.end), image); assert.equal(item.line, body.slice(0, item.start).split('\n').length); }
  assert.equal(images[0].line, 3); assert.ok(images.slice(1).every(x => /alone/.test(x.reason)));
  assert.equal(analyzeWordPressImages('[!'+image.slice(1)+'](https://example.com/)')[0].eligible, false);
});
test('Opt-in emits only validated Image blocks and escapes alt/URL attributes, leaving defaults inert', () => {
  const value = { body: '!["><svg> & café](https://example.com/p_(1).jpg?a=1&b=2)\n\n![](https://example.com/decorative.jpg)' };
  const before = JSON.stringify(value), result = createWordPressArticle(value, on), off = createWordPressArticle(value);
  assert.equal(result.imageCount, 2); assert.equal(result.blockCount, 2);
  assert.match(result.html, /<!-- wp:image -->\n<figure class="wp-block-image"><img src="https:\/\/example.com\/p_\(1\).jpg\?a=1&amp;b=2" alt="&quot;&gt;&lt;svg&gt; &amp; café"\/><\/figure>/);
  assert.match(result.html, /alt=""/); assert.doesNotMatch(result.html, /<svg|onerror|wp-image-\d|size-large|<script/);
  assert.equal(off.imageCount, 0); assert.doesNotMatch(off.html, /<img|wp:image/); assert.equal(JSON.stringify(value), before);
  for (const includeLinkedImages of ['true',1,null,[]]) assert.throws(() => createWordPressArticle(value, { includeLinkedImages }));
});
test('Conversion preserves surrounding blocks and never repairs CR inside an image URL into a fetched reference', () => {
  const body = '# Title\r\n\r\nOpening.\r\n\r\n'+image+'\r\n\r\n## Next\r\n\r\n- Item\r\n\r\n~~~\r\n'+image+'\r\n~~~\r\n\r\n![bad](https://exam\rple.com/a.jpg)';
  const blocks = wordPressImageBlocks(body); assert.deepEqual(blocks.map(x=>x.type), ['h3','p','linked-image','h4','ul','pre','p']);
  const result = createWordPressArticle({ body }, on); assert.equal(result.imageCount, 1); assert.equal((result.html.match(/<img /g)||[]).length, 1); assert.match(result.html, /wp-block-code/);
  for (const unsupported of ['Inline '+image,'- '+image,'> '+image,'# '+image,'    '+image,'<div>\n'+image+'\n</div>','![a](http://example.com/a)','![a](data:image/png,x)','![a](https://u:p@example.com/a)']) {
    const result = createWordPressArticle({ body: unsupported }, on); assert.equal(result.imageCount, 0); assert.doesNotMatch(result.html, /<img /);
  }
});
test('Independent HTML parsing checks image-only structures and inert unsafe source', () => {
  const result = createWordPressArticle({ body: image+'\n\n![empty](javascript:bad())\n\n<script>literal()</script>' }, on);
  const parsed = JSON.parse(execFileSync('python3',['-c',String.raw`
import sys,json
from html.parser import HTMLParser
class Parser(HTMLParser):
 def __init__(self):super().__init__();self.images=[];self.figures=[];self.tags=[];self.comments=[]
 def handle_starttag(self,tag,attrs):
  self.tags.append(tag)
  if tag=='img':self.images.append(dict(attrs))
  if tag=='figure':self.figures.append(dict(attrs))
 def handle_comment(self,data):self.comments.append(data.strip())
p=Parser();p.feed(sys.stdin.read())
assert 'script' not in p.tags
assert p.comments.count('wp:image')==p.comments.count('/wp:image')==1
assert p.figures==[{'class':'wp-block-image'}]
print(json.dumps(p.images))
`],{input:result.html,encoding:'utf8'}));
  assert.deepEqual(parsed,[{ src:'https://example.com/workshop.jpg', alt:'Workshop participants' }]);
});
test('WordPress findings follow the mode, preserve empty-alt reminders, and never lose later basic checks', () => {
  const body = image+'\n\n![](https://example.com/a.jpg)\n\nInline '+image+' text.\n\nTODO finish.';
  const off = reviewWordPress({ body }), selected = reviewWordPress({ body }, on);
  assert.equal(off.findings.filter(x=>x.kind==='image').length, 3);
  assert.equal(selected.findings.filter(x=>x.kind==='image').length, 1); assert.equal(selected.findings.filter(x=>x.kind==='image-alt').length, 1); assert.ok(selected.findings.some(x=>x.kind==='placeholder'));
  assert.ok(analyzeDraft({ body }).findings.some(x=>x.kind==='image'), 'General reading checks still disclose literal images');
  const long = Array(80).fill(image).join('\n\n')+'\n\nTODO after the images.';
  assert.ok(reviewWordPress({ body:long },on).findings.some(x=>x.kind==='placeholder')); assert.equal(createWordPressArticle({ body:long },on).imageCount,80);
});
test('Kits consistently include image mode, blocks, exact Markdown and full image plan without private fields', () => {
  const value = draft(), before = JSON.stringify(value), kit = wordPressKitFiles(value,on), files = Object.fromEntries(kit.files.map(x=>[x.name,x.content]));
  assert.equal(kit.files.length,6); assert.equal(files['wordpress-blocks.html'],createWordPressArticle(value,on).html); assert.equal(files['article-body.md'],value.body);
  assert.match(files['REVIEW.txt'],/1 linked Image block\(s\) selected/); assert.match(files['REVIEW.txt'],/Reference: https:\/\/example.com\/workshop.jpg/); assert.doesNotMatch(files['REVIEW.txt'],/This image stays text/);
  assert.match(files['README.txt'],/Image mode: 1 supported/); assert.match(files['README.txt'],/not an image preview/); assert.match(files['README.txt'],/can request those URLs/);
  for(const text of Object.values(files)) assert.doesNotMatch(text,/PRIVATE REVIEW|PRIVATE SOURCE/);
  assert.doesNotMatch(files['reading-page.html'],/<img /); assert.ok(files['reading-page.html'].includes('![Workshop participants]'));
  assert.equal(JSON.stringify(value),before); assert.deepEqual(createWordPressKit(value,on).bytes,createWordPressKit(value,on).bytes);
  assert.doesNotMatch(wordPressKitFiles(value).files[0].content,/<img /);
});
test('Other exports and unchanged v1 backups retain their original image behavior', () => {
  const value = draft();
  for(const html of [createReadingPage(value),createFormattedArticle(value).html,createHTMLSource(value)]) assert.doesNotMatch(html,/<img /);
  const word = new TextDecoder().decode(createWordDocument(value)); assert.ok(word.includes('![Workshop participants]')); assert.doesNotMatch(word,/https:\/\/example.com\/workshop.jpg.*TargetMode/);
  const { source, ...writing } = value;
  const backup = parseWorkspaceBackup(createWorkspaceBackup({ profile:'personal',notes:'PRIVATE source',audience:'',purpose:'' },writing));
  assert.equal(backup.version,1); assert.equal(backup.draft.body,value.body); assert.deepEqual(Object.keys(backup.draft),['title','excerpt','description','slug','body','questions']);
});

class Control {
  constructor(tag='') { this.tag=tag;this.value='';this.checked=false;this.open=false;this.disabled=false;this.textContent='';this.children=[];this.events=new Map(); }
  addEventListener(type,fn) {if(!this.events.has(type))this.events.set(type,[]);this.events.get(type).push(fn);}
  fire(type) {let result;for(const fn of this.events.get(type)||[])result=fn();return result;}
  append(...nodes) {this.children.push(...nodes);}
  replaceChildren(...nodes) {this.children=nodes;}
  querySelectorAll(tag) {return this.children.flatMap(node=>[...(node.tag===tag?[node]:[]),...node.querySelectorAll(tag)]);}
  focus() {this.focused=true;}
  setSelectionRange(start,end) {this.selection=[start,end];}
  setAttribute(name,value) {this[name]=value;}
}
function controls(run) {
  const prior=globalThis.document,fields=new Map(),$=id=>{if(!fields.has(id))fields.set(id,new Control());return fields.get(id);};
  globalThis.document={getElementById:$,createElement:tag=>new Control(tag)};
  let value=draft(),busy=false,changes=0,download=null,report=''; $('publishing-destination').value='wordpress';$('reviewed').checked=true;
  const ui=installWordPressImages({getDraft:()=>value,isBusy:()=>busy,changed:()=>{changes++;$('reviewed').checked=false;ui.refresh();},report:text=>{report=text;},reveal:()=>{},download:(...args)=>{download=args;}});
  try {run({$,ui,setDraft:next=>{value=next;ui.refresh();},value:()=>value,busy:next=>{busy=next;ui.refresh();},changes:()=>changes,download:()=>download,report:()=>report});}
  finally {globalThis.document=prior;}
}
test('Image inspection is read-only; explicit mode clears approval; view toggles keep it and purge hidden references',()=>controls(({$,ui,changes})=>{
  assert.equal(ui.enabled(),false);$('wordpress-image-panel').open=true;$('wordpress-image-panel').fire('toggle');assert.equal($('wordpress-image-list').children.length,1);assert.equal($('reviewed').checked,true);
  $('wordpress-linked-images').checked=true;$('wordpress-linked-images').fire('change');assert.equal(ui.enabled(),true);assert.equal(changes(),1);assert.equal($('reviewed').checked,false);
  $('reviewed').checked=true;$('wordpress-image-panel').open=false;$('wordpress-image-panel').fire('toggle');assert.equal($('wordpress-image-list').children.length,0);assert.equal(ui.enabled(),true);assert.equal($('reviewed').checked,true);
}));
test('Exact current image selection keeps approval and stale buttons never use old positions',()=>controls(({$,ui,setDraft,value,report})=>{
  $('wordpress-image-panel').open=true;ui.refresh();const button=$('wordpress-image-list').querySelectorAll('button')[0];button.fire('click');assert.deepEqual($('body').selection,[value().body.indexOf(image),value().body.indexOf(image)+image.length]);assert.equal($('reviewed').checked,true);
  $('body').selection=null;setDraft({...value(),body:'Changed body.'});button.fire('click');assert.equal($('body').selection,null);assert.match(report(),/changed/);
}));
test('Body changes, destination changes, and reset clear image selection; busy controls cannot change or download',()=>controls(({$,ui,setDraft,value,busy,download})=>{
  $('wordpress-linked-images').checked=true;$('wordpress-linked-images').fire('change');assert.equal(ui.enabled(),true);
  setDraft({...value(),title:'Title only changed'});assert.equal(ui.enabled(),true);
  setDraft({...value(),body:value().body+'\nEdited.'});assert.equal(ui.enabled(),false);
  $('wordpress-linked-images').checked=true;$('wordpress-linked-images').fire('change');$('publishing-destination').value='word';ui.refresh();assert.equal(ui.enabled(),false);
  $('publishing-destination').value='wordpress';ui.refresh();busy(true);$('wordpress-linked-images').checked=true;$('wordpress-linked-images').fire('change');$('download-image-plan').fire('click');assert.equal(ui.enabled(),false);assert.equal(download(),null);
  busy(false);$('wordpress-linked-images').checked=true;$('wordpress-linked-images').fire('change');ui.reset();assert.equal(ui.enabled(),false);
}));
test('Image notes use the current mode and all recognized references while DOM inspection is bounded',()=>controls(({$,ui,setDraft,download})=>{
  setDraft({...draft(),body:Array(60).fill(image).join('\n\n')});$('wordpress-image-panel').open=true;ui.refresh();assert.equal($('wordpress-image-list').children.length,40);assert.match($('wordpress-image-limit').textContent,/first 40/);
  $('wordpress-linked-images').checked=true;$('wordpress-linked-images').fire('change');$('download-image-plan').fire('click');assert.equal((download()[0].match(/Reference:/g)||[]).length,60);assert.match(download()[0],/60 linked Image block/);assert.doesNotMatch(download()[0],/PRIVATE/);
  setDraft({...draft(),body:'No images.'});$('download-image-plan').fire('click');assert.equal($('download-image-plan').disabled,true);
}));
test('All workspaces include the image controls, optional fallback, and local-only dependencies',async()=>{
  for(const route of ['write','markdown-to-wordpress','markdown-to-html','markdown-to-word']) {
    const html=await readFile('public/'+route+'/index.html','utf8');for(const id of ['wordpress-image-panel','wordpress-linked-images','wordpress-image-list','download-image-plan'])assert.ok(html.includes('id="'+id+'"'));
  }
  for(const name of ['wordpress-images.js','wordpress-image-controls.js'])assert.doesNotMatch(await readFile('public/'+name,'utf8'),/\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|innerHTML|outerHTML|insertAdjacentHTML|localStorage|sessionStorage|indexedDB/);
  const desk=await readFile('public/desk.js','utf8');assert.match(desk,/import\('\.\/wordpress-image-controls.js'\)/);assert.match(desk,/Images remain literal text in WordPress blocks/);
});

test('Publishing controls use the same explicit image choice for inspection and clipboard, and reject hidden or busy copies', async()=>{
  const prior=globalThis.document,oldNavigator=Object.getOwnPropertyDescriptor(globalThis,'navigator'),fields=new Map(),$=id=>{if(!fields.has(id))fields.set(id,new Control());return fields.get(id);};
  globalThis.document={getElementById:$,createElement:tag=>new Control(tag),createTextNode:text=>({textContent:text})};
  let value=draft(),busy=false,copied='',images=null,exports=null;
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{clipboard:{writeText:async text=>{copied=text;}}}});
  const changed=()=>{$('reviewed').checked=false;images?.refresh();exports?.update();};
  try {
    $('publishing-destination').value='wordpress';$('export-format').value='page';$('wordpress-code-panel').open=true;
    images=installWordPressImages({getDraft:()=>value,changed,report:()=>{},isBusy:()=>busy,reveal:()=>{}});
    exports=installPublishingExports({getDraft:()=>value,getWordPressOptions:()=>({includeLinkedImages:images.enabled()}),approved:()=>{if(!$('reviewed').checked)throw Error('Review first.');},changed,report:()=>{},isBusy:()=>busy});
    $('wordpress-linked-images').checked=true;$('wordpress-linked-images').fire('change');assert.equal($('wordpress-code-preview').value,'');
    $('reviewed').checked=true;exports.update();assert.match($('wordpress-code-preview').value,/wp:image/);
    await $('copy-wordpress').fire('click');assert.equal(copied,createWordPressArticle(value,on).html);
    value={...value,body:value.body+'\n\nNew writing.'};changed();assert.equal(images.enabled(),false);assert.equal($('wordpress-code-preview').value,'');
    $('reviewed').checked=true;exports.update();await $('copy-wordpress').fire('click');assert.doesNotMatch(copied,/<img /);
    copied='';busy=true;exports.update();assert.equal($('copy-wordpress').disabled,true);await $('copy-wordpress').fire('click');assert.equal(copied,'');
    busy=false;$('publishing-destination').value='word';changed();await $('copy-wordpress').fire('click');assert.equal(copied,'');assert.equal(images.enabled(),false);
  } finally {globalThis.document=prior;if(oldNavigator)Object.defineProperty(globalThis,'navigator',oldNavigator);else delete globalThis.navigator;}
});
