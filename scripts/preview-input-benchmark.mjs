// Local, controlled synthetic preview timings. NOT browser INP or real paint.
// Run on a complete repository checkout at each pinned revision. No network,
// writing to disk, publication, or human observations.
import { performance } from 'node:perf_hooks';
import { installPreviewNavigation } from '../public/preview-navigation.js';

class Node {
  constructor(tag='div') {
    this.tagName=tag.toUpperCase();this.children=[];this.events=new Map();
    this.attrs={};this.value='';this.checked=false;this.disabled=false;
    this.hidden=false;this.open=false;this.inert=false;this.text='';
    this.selectionStart=0;this.selectionEnd=0;this.replacements=0;
  }
  set textContent(text) {this.text=text;this.children=[]}
  get textContent() {return this.text+this.children.map(n=>n.textContent).join('')}
  append(...nodes) {for(const node of nodes)this.children.push(...(node.tagName==='FRAGMENT'?node.children:[node]))}
  replaceChildren(...nodes) {this.replacements++;this.children=[];this.append(...nodes)}
  setAttribute(key,value) {this.attrs[key]=String(value)}
  addEventListener(name,fn) {this.events.set(name,fn)}
  setSelectionRange(a,b) {this.selectionStart=a;this.selectionEnd=b}
}
const ordinary='A fictional neighborhood guide compares simple choices and preserves uncertainty. This paragraph is test writing only.\n\n';
const rich='## Fictional heading\n\nA **bold** and *italic* passage with ~~old wording~~ and [a fictional link](https://example.test/guide).\n\n- First item\n- Second item\n\n| Place | Note |\n| --- | --- |\n| Park | Quiet |\n\n';
const corpora=[
  {name:'ordinary-6600',body:ordinary.repeat(55)},
  {name:'rich-near-limit',body:rich.repeat(Math.floor(58900/rich.length)).trim()}
];
function stats(values) {
  const sorted=[...values].sort((a,b)=>a-b);
  return {medianMs:Number(sorted[Math.floor(sorted.length/2)].toFixed(2)),
    p95Ms:Number(sorted[Math.ceil(sorted.length*.95)-1].toFixed(2)),
    maxMs:Number(sorted.at(-1).toFixed(2))};
}
const results=[];
for(const {name,body} of corpora) {
  const oldDocument=globalThis.document,oldWindow=globalThis.window,oldTimeout=globalThis.setTimeout,oldClear=globalThis.clearTimeout,oldNow=Date.now;
  try {
    let clock=0,id=0;
    const jobs=new Map(),nodes=new Map(),$=key=>{
      if(!nodes.has(key))nodes.set(key,new Node());
      return nodes.get(key);
    };
    globalThis.document={getElementById:$,activeElement:$('body'),
      createElement:tag=>new Node(tag),
      createDocumentFragment:()=>new Node('fragment'),
      createTextNode:text=>{const node=new Node('text');node.textContent=text;return node}};
    globalThis.setTimeout=(fn,ms)=>{jobs.set(++id,{fn,at:clock+ms});return id};
    globalThis.clearTimeout=id=>jobs.delete(id);
    globalThis.window={setTimeout:globalThis.setTimeout};
    Date.now=()=>clock;
    $('preview-panel').open=true;$('body').value=body;$('reviewed').checked=true;
    const start=performance.now();
    const ui=installPreviewNavigation({getDraft:()=>({title:'Fictional article',body:$('body').value}),report:()=>{}});
    const initialMs=performance.now()-start;
    const input=[];
    for(let n=0;n<15;n++) {
      $('body').value+='x';$('reviewed').checked=false;
      const start=performance.now();ui.refresh();input.push(performance.now()-start);clock+=7;
    }
    const before=$('article-preview').replacements;
    clock+=160;
    for(const [key,job] of [...jobs])if(job.at<=clock){jobs.delete(key);job.fn();}
    const ending=$('article-preview').textContent.endsWith('x'.repeat(15));
    if(!ending||$('reviewed').checked||$('article-preview').inert||$('article-preview').attrs['aria-busy']==='true')
      throw new Error('The preview or synchronous export-approval contract failed for '+name);
    results.push({name,characters:body.length,initialPreviewMs:Number(initialMs.toFixed(2)),input:stats(input),
      replacementsDuringInput:before,replacementsAfterSettle:$('article-preview').replacements,
      endingPreserved:ending,approvalUnchanged:false,virtualTypingSpacingMs:7});
    ui.clear();
  } finally {
    globalThis.document=oldDocument;globalThis.window=oldWindow;
    globalThis.setTimeout=oldTimeout;globalThis.clearTimeout=oldClear;Date.now=oldNow;
  }
}
process.stdout.write(JSON.stringify({scope:'Detached DOM-like nodes in Node; no browser layout, paint, real input or hardware',
  node:process.version,cases:results},null,2)+'\n');
