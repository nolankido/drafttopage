import test from 'node:test';
import assert from 'node:assert/strict';
import { inlineTokens, walkInlineTokens, inlineVisibleText, INLINE_NESTING_LIMIT } from '../public/markdown-inline.js';
import { inlineHTML, inlineParts } from '../public/inline-render.js';
import { markdownFromInline } from '../public/inline-markdown.js';
import { createFormattedArticle, createHTMLSource } from '../public/html-export.js';
import { createWordPressArticle } from '../public/wordpress-export.js';
import { wordDocumentParts } from '../public/word-export.js';
import { htmlTreeToMarkdown } from '../public/html-import.js';
import { analyzeDraft } from '../public/draft-review.js';
import { articleLinks, linkEditTarget } from '../public/link-editing.js';
import { analyzeWordPressImages } from '../public/wordpress-images.js';
import { reviewWordPress } from '../public/wordpress-review.js';
import { renderPreview } from '../public/preview.js';
import { fixture, run, convert, python, R } from './docx-fixtures.js';

const element = (name, children = [], attrs = {}) => ({ nodeType:1, localName:name, childNodes:children.map(child=>typeof child === 'string'?{nodeType:3,nodeValue:child,childNodes:[]}:child), getAttribute:key=>attrs[key]??null,hasAttribute:key=>Object.hasOwn(attrs,key) });
const fromHTML = (...children) => htmlTreeToMarkdown({nodeType:11,childNodes:children});
const semantics = html => python(`import sys,json
from html.parser import HTMLParser
class Reader(HTMLParser):
 def __init__(self): super().__init__();self.stack=[];self.runs=[]
 def handle_starttag(self,tag,attrs):
  assert tag not in ['script','img','iframe','object','style']
  self.stack.append((tag,dict(attrs)))
 def handle_endtag(self,tag):
  assert self.stack[-1][0]==tag
  self.stack.pop()
 def handle_data(self,text):
  if not text.strip() and not self.stack: return
  flags=[any(t=='strong' for t,a in self.stack),any(t=='em' for t,a in self.stack),any(t=='code' for t,a in self.stack),next((a['href'] for t,a in self.stack if t=='a'),'')]
  if self.runs and self.runs[-1][1]==flags:self.runs[-1][0]+=text
  else:self.runs.append([text,flags])
r=Reader();r.feed(json.load(sys.stdin));assert not r.stack
print(json.dumps(r.runs))`,html);

test('Nested emphasis, strong underscores, code, and formatted safe links produce the intended HTML',()=>{
  for(const [source,expected] of [
    ['***Both***','<em><strong>Both</strong></em>'],
    ['___Both___','<em><strong>Both</strong></em>'],
    ['**Outer *inner* tail**','<strong>Outer <em>inner</em> tail</strong>'],
    ['*Outer **inner** tail*','<em>Outer <strong>inner</strong> tail</em>'],
    ['__Bold _italic_ tail__','<strong>Bold <em>italic</em> tail</strong>'],
    ['**Use `literal *syntax*` here**','<strong>Use <code>literal *syntax*</code> here</strong>'],
    ['snake_case_name and \\*literal\\*','snake_case_name and *literal*'],
    ['**A [source](https://example.com/) matters**','<strong>A <a href="https://example.com/" target="_blank" rel="noopener noreferrer">source</a> matters</strong>'],
    ['[A **clear** *source*](https://example.com/)','<a href="https://example.com/" target="_blank" rel="noopener noreferrer">A <strong>clear</strong> <em>source</em></a>'],
    ['``literal ` tick``','<code>literal ` tick</code>'],
  ]) assert.equal(inlineHTML(source),expected,source);
});

test('All HTML handoffs agree on nested formatting and plain clipboard text includes each link once',()=>{
  const body='**A *careful* [**source**](https://example.com/) and `code`**';
  const expected=[['A ',[true,false,false,'']],['careful',[true,true,false,'']],[' ',[true,false,false,'']],['source',[true,false,false,'https://example.com/']],[' and ',[true,false,false,'']],['code',[true,false,true,'']]];
  const article=createFormattedArticle({body});
  for(const html of [article.html,createHTMLSource({body}),createWordPressArticle({body}).html]) assert.deepEqual(semantics(html),expected);
  assert.equal(article.text,'A careful source (https://example.com/) and code');
});

test('Headings, list items, quotes, and table cells retain the same inline combinations',()=>{
  const body='## A ***heading***\n\n- An **item *inside***\n\n| Label | Reference |\n| --- | --- |\n| ***cell*** | [**source**](https://example.com/) |\n\n> **quote *detail***';
  for(const html of [createHTMLSource({body}),createWordPressArticle({body}).html]) {
    assert.match(html,/<em><strong>heading<\/strong><\/em>/);
    assert.match(html,/<strong>item <em>inside<\/em><\/strong>/);
    assert.match(html,/<em><strong>cell<\/strong><\/em>/);
    assert.match(html,/<a [^>]+><strong>source<\/strong><\/a>/);
    assert.match(html,/<strong>quote <em>detail<\/em><\/strong>/);
  }
});

test('Word runs combine emphasis and code and keep styled hyperlink text inside a safe relationship',()=>{
  const parts=wordDocumentParts({body:'***Both*** and **[A *source* and `code`](https://example.com/)**'});
  const actual=python(`import sys,json,xml.etree.ElementTree as E
v={x['name']:x['content'] for x in json.load(sys.stdin)}
ns={'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
root=E.fromstring(v['word/document.xml']); result=[]
for link in root.findall('.//w:hyperlink',ns):
 for r in link.findall('w:r',ns):
  props=r.find('w:rPr',ns)
  result.append([''.join(t.text or '' for t in r.findall('w:t',ns)),props.find('w:b',ns) is not None,props.find('w:i',ns) is not None,props.find('w:rStyle',ns).get('{'+ns['w']+'}val'),props.find('w:rFonts',ns) is not None])
both=next(r for r in root.findall('.//w:r',ns) if ''.join(t.text or '' for t in r.findall('w:t',ns))=='Both')
assert both.find('w:rPr/w:b',ns) is not None and both.find('w:rPr/w:i',ns) is not None
rels=[r for r in E.fromstring(v['word/_rels/document.xml.rels']) if r.get('Type','').endswith('/hyperlink')];assert len(rels)==1 and rels[0].get('Target')=='https://example.com/'
print(json.dumps(result))`,parts);
  assert.deepEqual(actual,[['A ',true,false,'Hyperlink',false],['source',true,true,'Hyperlink',false],[' and ',true,false,'Hyperlink',false],['code',true,false,'Hyperlink',true]]);
});

test('Detached HTML imports preserve combined spans, nested link labels, adjacent runs, and literal punctuation',()=>{
  const result=fromHTML(element('p',[element('span',['Both'],{style:'font-weight:700;font-style:italic'}),' ',element('strong',['A *literal* ',element('em',['detail'])]),' ',element('a',['A ',element('strong',['source'])],{href:'https://example.com/a(b)'}),' ',element('strong',['first']),element('strong',['second']),' ',element('code',['a`b'])]));
  const html=createHTMLSource({body:result.markdown});
  assert.match(html,/<em><strong>Both<\/strong><\/em>/);
  assert.match(html,/<strong>A \*literal\* <em>detail<\/em><\/strong>/);
  assert.match(html,/href="https:\/\/example.com\/a%28b%29"[^>]*>A <strong>source<\/strong><\/a>/);
  assert.match(html,/<strong>firstsecond<\/strong>/); assert.match(html,/<code>a`b<\/code>/);
  assert.doesNotMatch(result.warnings.join(' '),/simplified to literal|inside link labels was simplified|Nested or multiline/);
});

test('Real Word XML imports retain combined run properties and formatting inside hyperlinks',()=>{
  const rels='<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="web" Type="'+R+'/hyperlink" Target="https://example.com/" TargetMode="External"/></Relationships>';
  const result=convert(fixture('<w:p>'+run('Both','<w:b/><w:i/>')+run(' ')+run('One','<w:b/>')+run('Two','<w:b/>')+run(' ')+'<w:hyperlink r:id="web">'+run('Styled','<w:b/><w:i/>')+'</w:hyperlink></w:p>',{'word/_rels/document.xml.rels':rels}));
  const html=createWordPressArticle({body:result.markdown}).html;
  assert.match(html,/<em><strong>Both<\/strong><\/em>/); assert.match(html,/<strong>OneTwo<\/strong>/);
  assert.match(html,/<a [^>]+><em><strong>Styled<\/strong><\/em><\/a>/);
});

test('Generated inline Markdown is checked against text and style runs, with an explicit safe fallback',()=>{
  const source=[{type:'strong',children:[{type:'text',text:'A'},{type:'strong',text:'B'}]},{type:'strong',text:'C'}];
  assert.deepEqual(markdownFromInline(source),{markdown:'**ABC**',simplified:false});
  let nested={type:'text',text:'Keep ending'};
  for(let i=0;i<INLINE_NESTING_LIMIT+3;i++)nested={type:i%2?'strong':'em',children:[{type:'text',text:'x '},nested,{type:'text',text:' y'}]};
  const result=markdownFromInline([nested]);assert.equal(result.simplified,false);assert.ok(result.markdown.includes('Keep ending'));
  assert.deepEqual(markdownFromInline([{type:'strong',text:'First\nsecond'}]),{markdown:'First\nsecond',simplified:true});
});

test('Review and link inventory find nested references at exact UTF-16 and CRLF positions without counting code',()=>{
  const body='😀 Intro.\r\n\r\n## **A [*source*](https://example.com/) and `TODO`**\r\n\r\n**TODO**';
  const before=body, review=analyzeDraft({body}), links=articleLinks(body);
  assert.equal(links.length,1);assert.equal(links[0].label,'source');assert.equal(links[0].line,3);assert.equal(links[0].formattedLabel,true);
  assert.equal(body.slice(links[0].start,links[0].end),'[*source*](https://example.com/)');
  assert.equal(review.links.length,1); assert.equal(review.findings.filter(f=>f.kind==='placeholder').length,1);
  assert.equal(body.slice(review.findings.find(f=>f.kind==='placeholder').start,review.findings.find(f=>f.kind==='placeholder').end),'TODO');
  assert.throws(()=>linkEditTarget(body,links[0].start,links[0].end),/formatted link label/);
  const wrapped='**A [source](https://example.com/) matters**', inside=articleLinks(wrapped)[0];
  assert.equal(inside.inEmphasis,true);assert.throws(()=>linkEditTarget(wrapped,inside.start,inside.end),/surrounding emphasis/);
  assert.equal(body,before);
  assert.equal(inlineVisibleText(inlineTokens('**one *two* `ignored`**')), 'one two ');
});

test('Images inside nested formatting remain inert and receive unsupported-placement findings',()=>{
  const body='**Before ![picture](https://example.com/a.png) after**';
  const images=analyzeWordPressImages(body);assert.equal(images.length,1);assert.equal(images[0].eligible,false);assert.equal(body.slice(images[0].start,images[0].end),'![picture](https://example.com/a.png)');
  assert.doesNotMatch(createWordPressArticle({body},{includeLinkedImages:true}).html,/<img/);
  assert.equal(reviewWordPress({body},{includeLinkedImages:true}).findings.filter(f=>f.kind==='image').length,1);
  assert.doesNotMatch(reviewWordPress({body:'**[safe](https://example.com/?x=<tag>)**'}).findings.map(f=>f.kind).join(' '),/html/);
});

test('Code shields markup, unsafe link labels stay literal, and nested anchors are never emitted',()=>{
  for(const body of ['**`<script>bad()</script> [x](https://example.com/)`**','**[<img onerror=bad()>](javascript:bad())**','[outer [inner](https://example.com/)](https://elsewhere.test/)','[**literal <iframe>**](https://example.com/)']){
    const html=inlineHTML(body);assert.doesNotMatch(html,/<script|<img|<iframe|href="javascript:/);
    assert.equal((html.match(/<a /g)||[]).length,(html.match(/<\/a>/g)||[]).length);
    assert.doesNotMatch(html,/<a [^>]+>[^]*<a /);
  }
  assert.equal(inlineHTML('[**unsafe**](javascript:bad())'),'[**unsafe**](javascript:bad())');
});

test('Malformed, multiline, excessively nested, and adversarial input stays bounded without losing its ending',()=>{
  for(const body of ['['.repeat(59990)+'ENDING','`'.repeat(59990)+'ENDING',('*x _y ').repeat(9990)+'ENDING']){
    const start=performance.now(), html=inlineHTML(body);assert.ok(performance.now()-start<2000);assert.ok(html.includes('ENDING'));
  }
  assert.equal(inlineHTML('**first\nsecond**'),'**first\nsecond**');
  assert.equal(inlineHTML('`first\nsecond`'),'`first\nsecond`');
  const excessive='*'.repeat(40)+'Keep ending'+'*'.repeat(40);assert.equal(inlineHTML(excessive),excessive);
  assert.throws(()=>inlineTokens('x'.repeat(60001)),/60,000/);
  for(const token of walkInlineTokens(inlineTokens('***A [**source**](https://example.com/)***'))){assert.ok(token.start>=0);assert.ok(token.end>token.start);}
});

test('The DOM reading preview creates nested semantic nodes and only protected safe anchors',()=>{
  const previous=globalThis.document;
  const make=(name,text='')=>({name,text,children:[],attrs:{},append(...nodes){this.children.push(...nodes);},replaceChildren(...nodes){this.children=nodes;},setAttribute(key,value){this.attrs[key]=value;},set textContent(value){this.text=value;}});
  globalThis.document={createDocumentFragment:()=>make('fragment'),createElement:make,createTextNode:text=>make('text',text)};
  try {
    const target=make('target'); renderPreview(target,'A title','**A [*source*](https://example.com/) and `code`**');
    const paragraph=target.children[0].children[1], strong=paragraph.children[0], link=strong.children[1];
    assert.equal(strong.name,'strong');assert.equal(link.name,'a');assert.equal(link.children[0].name,'em');assert.equal(link.children[0].text,'source');
    assert.equal(link.href,'https://example.com/');assert.equal(link.rel,'noopener noreferrer');assert.equal(link.attrs['aria-label'],'source (opens in a new tab)');
  } finally {globalThis.document=previous;}
});
