import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { inlineTokens, walkInlineTokens, INLINE_NESTING_LIMIT } from '../public/markdown-inline.js';
import { inlineHTML, inlinePlainText } from '../public/inline-render.js';
import { markdownFromInline } from '../public/inline-markdown.js';
import { htmlTreeToMarkdown } from '../public/html-import.js';
import { wordDocumentParts } from '../public/word-export.js';
import { createHTMLSource } from '../public/html-export.js';
import { createWordPressArticle } from '../public/wordpress-export.js';
import { reviewExport } from '../public/export-review.js';
import { parseCopiedWriting } from '../public/copied-writing.js';
import { planArticleInsertion } from '../public/import-insertion.js';
import { articleLinks, linkEditTarget } from '../public/link-editing.js';
import { imageEditTarget } from '../public/image-editing.js';
import { analyzeWordPressImages } from '../public/wordpress-images.js';
import { analyzeDraft } from '../public/draft-review.js';
import { renderPreview } from '../public/preview.js';
import { readDocxXML } from '../public/docx-archive.js';
import { wordTreesToMarkdown } from '../public/docx-import.js';
import { fixture, para, run, word, convert, python, trees, create } from './docx-fixtures.js';

const element = (name, contents=[], attrs={}) => ({nodeType:1,localName:name,childNodes:contents.map(node=>typeof node==='string'?{nodeType:3,nodeValue:node,childNodes:[]}:node),getAttribute:key=>attrs[key]??null,hasAttribute:key=>Object.hasOwn(attrs,key)});
const htmlImport = (...nodes) => htmlTreeToMarkdown(element('div',nodes));
const xmlText = (text,props='') => '<w:p>'+run(text,props)+'</w:p>';
const strikes = body => [...walkInlineTokens(inlineTokens(body))].filter(token=>token.type==='s');

test('Exact double-tilde strikethrough composes with emphasis, Unicode, code and safe links',()=>{
  for(const [body,html] of [
    ['~~Old~~ new','<s>Old</s> new'],['~~日本語 😀~~','<s>日本語 😀</s>'],['~~**Bold** *italic*~~','<s><strong>Bold</strong> <em>italic</em></s>'],
    ['**Bold ~~old~~ text**','<strong>Bold <s>old</s> text</strong>'],['~~`literal *syntax*`~~','<s><code>literal *syntax*</code></s>'],
    ['~~[report](https://example.com/)~~','<s><a href="https://example.com/" target="_blank" rel="noopener noreferrer">report</a></s>'],
    ['[~~old~~ report](https://example.com/)','<a href="https://example.com/" target="_blank" rel="noopener noreferrer"><s>old</s> report</a>'],
    ['one~~two~~three','one<s>two</s>three']
  ])assert.equal(inlineHTML(body),html,body);
});
test('Single, long, empty, escaped, multiline and unfinished tilde delimiters remain literal',()=>{
  for(const body of ['~one~','~~~three~~~','~~~~four~~~~','~~ ~~','~~~~','~~ start~~','~~end ~~','~~open','close~~','\\~\\~literal\\~\\~','~~one\ntwo~~']){
    assert.equal(strikes(body).length,0,body);
    assert.equal(inlineHTML(body),body.replaceAll('\\~','~'),body);
  }
  assert.equal(inlineHTML('`~~code~~`'),' <code>~~code~~</code>'.trim());
  assert.equal(inlineHTML('[link](https://example.com/~~literal~~)'),'<a href="https://example.com/~~literal~~" target="_blank" rel="noopener noreferrer">link</a>');
});
test('Struck runs retain exact UTF-16 offsets across CRLF and repeated passages',()=>{
  const body='日本語 😀 ~~same~~\r\n\r\n~~same~~';
  const found=strikes(body);assert.equal(found.length,2);assert.notEqual(found[0].start,found[1].start);
  for(const token of found)assert.equal(body.slice(token.start,token.end),'~~same~~');
  const review=analyzeDraft({title:'',body:'日本語 😀 ~~TODO~~'});const finding=review.findings.find(item=>item.kind==='placeholder');assert.equal('日本語 😀 ~~TODO~~'.slice(finding.start,finding.end),'TODO');
});
test('Single-line nested depth and work bounds retain complete literal fallback and endings',()=>{
  let node={type:'s',text:'Ending'};
  for(let i=0;i<INLINE_NESTING_LIMIT+5;i++)node={type:i%2?'strong':'s',children:[{type:'text',text:'before '},node,{type:'text',text:' after'}]};
  const result=markdownFromInline([node]);assert.ok(result.markdown.includes('Ending'));
  assert.doesNotThrow(()=>inlineTokens(('~~x~~ '.repeat(5000)).slice(0,60000)));
  assert.throws(()=>inlineTokens('x'.repeat(60001)),/60,000/);
  assert.throws(()=>markdownFromInline([{type:'s',text:'x'.repeat(59997)}]),/60,000/);
  assert.deepEqual(markdownFromInline([{type:'s',text:'One\nTwo'}]),{markdown:'One\nTwo',simplified:true});
});
test('Inline serialization normalizes adjacent/repeated strike while escaping literal tildes',()=>{
  const result=markdownFromInline([{type:'s',text:'One'},{type:'s',children:[{type:'s',text:'Two'}]},{type:'text',text:' ~~literal~~'}]);
  assert.equal(result.simplified,false);assert.equal(inlineHTML(result.markdown),'<s>OneTwo</s> ~~literal~~');
});
test('Semantic HTML and ordinary CSS line-through survive conversion, including combined styles',()=>{
  for(const name of ['s','strike']){const result=htmlImport(element('p',[element(name,['Old'])]));assert.equal(inlineHTML(result.markdown),'<s>Old</s>');assert.doesNotMatch(result.warnings.join(' '),/inline formatting was simplified/);}
  const result=htmlImport(element('p',[element('span',['Old'],{style:'font-weight:bold;font-style:italic;text-decoration:line-through'})]));
  assert.equal(inlineHTML(result.markdown),'<s><em><strong>Old</strong></em></s>');assert.doesNotMatch(result.warnings.join(' '),/inline formatting was simplified/);
  const off=htmlImport(element('p',[element('s',['Normal'],{style:'text-decoration:none'})]));assert.equal(inlineHTML(off.markdown),'Normal');
  for(const style of ['text-decoration-line:line-through;text-decoration:none','text-decoration:none!important;text-decoration-line:line-through'])assert.equal(inlineHTML(htmlImport(element('p',[element('s',['Normal'],{style})])).markdown),'Normal');
  for(const style of ['text-decoration:none;text-decoration-line:line-through','text-decoration-line:line-through!important;text-decoration:none'])assert.equal(inlineHTML(htmlImport(element('p',[element('span',['Old'],{style})])).markdown),'<s>Old</s>');
});
test('Unsupported double/line styles and multiline formatting retain explicit loss warnings',()=>{
  for(const style of ['text-decoration:line-through double','text-decoration-line:line-through;text-decoration-style:double']){
    const result=htmlImport(element('p',[element('span',['Original'],{style})]));assert.equal(inlineHTML(result.markdown),'Original');assert.match(result.warnings.join(' '),/Double strikethrough/);
  }
  const result=htmlImport(element('p',[element('span',['Styled'],{style:'text-decoration:line-through wavy'})]));assert.equal(inlineHTML(result.markdown),'<s>Styled</s>');assert.match(result.warnings.join(' '),/line styling was simplified/);
  assert.match(htmlImport(element('p',[element('s',['One\nTwo'])])).warnings.join(' '),/Multiline/);
  for(const name of ['del','ins'])assert.throws(()=>htmlImport(element('p',[element(name,['Changes'])])),/tracked changes/);
  const heading=htmlImport(element('h1',[element('s',['Old title'])]));assert.equal(heading.markdown,'# Old title');assert.match(heading.warnings.join(' '),/Title fields do not retain inline formatting/);
});
test('Ordinary Word strike uses direct on/off values and false never becomes an unintended mark',()=>{
  for(const value of ['', ' w:val="true"',' w:val="1"',' w:val="on"']){const result=convert(fixture(xmlText('Old','<w:strike'+value+'/>')));assert.equal(inlineHTML(result.markdown),'<s>Old</s>');assert.doesNotMatch(result.warnings.join(' '),/simplified/);}
  for(const value of ['false','0','off'])assert.equal(inlineHTML(convert(fixture(xmlText('Normal','<w:strike w:val="'+value+'"/>'))).markdown),'Normal');
  assert.throws(()=>convert(fixture(xmlText('Bad','<w:strike w:val="invalid"/>'))),/strikethrough value/);
});
test('Word paragraph/character style toggles and direct overrides resolve before import',()=>{
  const styles=word('styles','<w:style w:type="paragraph" w:styleId="Cross"><w:rPr><w:strike/></w:rPr></w:style><w:style w:type="character" w:styleId="Again"><w:rPr><w:strike/></w:rPr></w:style>');
  const body='<w:p><w:pPr><w:pStyle w:val="Cross"/></w:pPr>'+run('Inherited')+run(' normal','<w:strike w:val="false"/>')+run(' toggled','<w:rStyle w:val="Again"/>')+run(' direct','<w:rStyle w:val="Again"/><w:strike/>')+'</w:p>';
  const result=convert(fixture(body,{'word/styles.xml':styles}));assert.equal(inlineHTML(result.markdown),'<s>Inherited</s> normal toggled <s>direct</s>');
});
test('Document defaults preserve unambiguous marks and reject default-on style combinations without direct decisions',()=>{
  const defaults='<w:docDefaults><w:rPrDefault><w:rPr><w:strike/></w:rPr></w:rPrDefault></w:docDefaults>';
  const body='<w:p><w:pPr><w:rPr><w:strike w:val="false"/></w:rPr></w:pPr>'+run('Default')+run(' off','<w:strike w:val="0"/>')+'</w:p>';
  assert.equal(inlineHTML(convert(fixture(body,{'word/styles.xml':word('styles',defaults)})).markdown),'<s>Default</s> off');
  for(const value of ['true','false']){
    const styles=word('styles',defaults+'<w:style w:type="paragraph" w:styleId="Base"><w:rPr><w:strike w:val="'+value+'"/></w:rPr></w:style>');
    const prefix='<w:p><w:pPr><w:pStyle w:val="Base"/></w:pPr>';
    assert.throws(()=>convert(fixture(prefix+run('Ambiguous')+'</w:p>',{'word/styles.xml':styles})),/Document-default strikethrough combined/);
    const direct=convert(fixture(prefix+run('Normal','<w:strike w:val="false"/>')+run(' old','<w:strike/>')+'</w:p>',{'word/styles.xml':styles}));
    assert.equal(inlineHTML(direct.markdown),'Normal <s>old</s>');
  }
});
test('Double-strike Word runs retain text and disclose the loss instead of inventing a single line',()=>{
  const result=convert(fixture(xmlText('Double','<w:dstrike/>')));assert.equal(inlineHTML(result.markdown),'Double');assert.match(result.warnings.join(' '),/Double strikethrough/);
  const off=convert(fixture(xmlText('Normal','<w:dstrike w:val="false"/>')));assert.equal(inlineHTML(off.markdown),'Normal');assert.doesNotMatch(off.warnings.join(' '),/Double strikethrough/);
});
test('The pinned real Word fixture preserves the actual struck text without a false loss warning',async()=>{
  const parts=await readDocxXML(new Uint8Array(await readFile('tests/fixtures/documents/word-strikethrough.docx')));
  const result=wordTreesToMarkdown(trees(Object.fromEntries(parts)),{},create);
  assert.equal(inlineHTML(result.markdown),'<s>Today\'s Special: Salmon</s> Sold out'.replaceAll("'",'&#39;'));
  assert.doesNotMatch(result.warnings.join(' '),/inline formatting was simplified/);
});
test('WordPress, HTML and Word output preserve struck semantic runs across article blocks',()=>{
  const body='## ~~Heading~~\n\n- ~~Item~~\n\n| A | B |\n| --- | --- |\n| ~~Cell~~ | value |\n\n> ~~Quote~~';
  for(const html of [createHTMLSource({body}),createWordPressArticle({body}).html])for(const text of ['Heading','Item','Cell','Quote'])assert.ok(html.includes('<s>'+text+'</s>'));
  const document=wordDocumentParts({body}).find(part=>part.name==='word/document.xml').content;
  const result=python('import sys,json,xml.etree.ElementTree as E\nr=E.fromstring(json.load(sys.stdin));n="{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"\nprint(json.dumps(["".join(x.text or "" for x in r.iter(n+"t")) for r in r.iter(n+"r") if r.find(n+"rPr/"+n+"strike") is not None]))',document);
  assert.deepEqual(result,['Heading','Item','Cell','Quote']);
});
test('Plain clipboard punctuation and literal inserted titles cannot introduce strikethrough',()=>{
  const value=parseCopiedWriting({format:'plain',text:'~~literal~~ and **literal**'});
  assert.equal(inlineHTML(value.draft.body),'~~literal~~ and **literal**');
  const imported={title:'~~literal title~~',body:'Article.',excerpt:'',description:'',slug:'',questions:[]};
  const planned=planArticleInsertion({body:'',start:0,end:0,before:'',mode:'append'},'',imported,{includeTitle:true});
  assert.doesNotMatch(createHTMLSource({body:planned.body}),/<s>/);
});
test('Struck links and partial format selections retain guided edit protections and exact source',()=>{
  const body='~~[Report](https://example.com/)~~',link=articleLinks(body)[0];assert.equal(link.inEmphasis,true);assert.throws(()=>linkEditTarget(body,link.start,link.end),/surrounding emphasis/);
  assert.throws(()=>imageEditTarget('~~Old~~',2,5),/complete formatted/);
  const images=analyzeWordPressImages('~~![Image](https://example.com/image.png)~~');assert.equal(images.length,1);assert.equal(images[0].eligible,false);
});
test('Recognized strike has no false loss finding, while remaining unsupported tilde syntax is actionable',()=>{
  for(const destination of ['wordpress','word','html']){
    const review=reviewExport({body:'~~Old **menu**~~ <div>literal</div>',title:''},{destination});assert.ok(!review.findings.some(item=>item.kind==='strike'));assert.ok(review.findings.some(item=>item.kind==='html'));
    assert.ok(reviewExport({body:'Before ~~~old~~~',title:''},{destination}).findings.some(item=>item.kind==='strike'));
  }
});
test('Inert DOM preview creates semantic strike nodes without source HTML execution or images',()=>{
  const previous=globalThis.document;const make=(name,text='')=>({name,text,children:[],append(...nodes){this.children.push(...nodes);},replaceChildren(...nodes){this.children=nodes;},setAttribute(){}});
  globalThis.document={createDocumentFragment:()=>make('fragment'),createElement:make,createTextNode:text=>make('text',text)};
  try{const target=make('target');renderPreview(target,'','~~Old~~ <script>literal</script>');const paragraph=target.children[0].children[1];assert.equal(paragraph.children[0].name,'s');assert.equal(paragraph.children[0].textContent,'Old');assert.ok(!JSON.stringify(target).includes('"name":"script"'));}finally{globalThis.document=previous;}
});

test('Independent saved-post and corpus readers reject missing or changed marks even when words match',()=>{
  const result=python(`import sys,json,copy,base64,io,zipfile
from pathlib import Path
sys.path.insert(0,str(Path('scripts').resolve()))
from wordpress_roundtrip import check_post
from document_benchmark import check_conversion
case={'title':'Fictional','text':'Old new','strikes':['Old']}
good={'status':'draft','title':{'raw':'Fictional'},'content':{'raw':'<p><s>Old</s> new</p>','rendered':'<p><s>Old</s> new</p>'}}
check_post(good,case,[])
for key in ['raw','rendered']:
 bad=copy.deepcopy(good);bad['content'][key]='<p>Old new</p>'
 try:check_post(bad,case,[])
 except AssertionError:pass
 else:raise AssertionError('A lost mark was accepted')
print(json.dumps('Missing marks rejected in stored and rendered content'))`,null);
  assert.equal(result,'Missing marks rejected in stored and rendered content');
});
