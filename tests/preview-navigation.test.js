import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { previewBlocks, previewPassages } from '../public/preview.js';
import { installPreviewNavigation, passageAtPosition, PREVIEW_PASSAGE_LIMIT } from '../public/preview-navigation.js';
import { createFormattedArticle } from '../public/html-export.js';
import { createWordPressArticle } from '../public/wordpress-export.js';
import { createArticleMarkdown } from '../public/article-markdown.js';
import { createWorkspaceBackup } from '../public/workspace.js';

class Node {
  constructor(tag = 'div', id = '') { this.tagName = tag.toUpperCase(); this.id = id; this.children = []; this.attrs = {}; this.events = {}; this.value = ''; this.checked = false; this.disabled = false; this.hidden = false; this.selectionStart = 0; this.selectionEnd = 0; this.text = ''; }
  append(...nodes) { for (const node of nodes) this.children.push(...(node.tagName === 'FRAGMENT' ? node.children : [node])); }
  replaceChildren(...nodes) { this.children = []; this.append(...nodes); }
  setAttribute(key, value) { this.attrs[key] = String(value); }
  addEventListener(name, fn) { (this.events[name] ||= []).push(fn); }
  fire(name = 'click') { for (const fn of this.events[name] || []) fn(); }
  setSelectionRange(start, end) { this.selectionStart = start; this.selectionEnd = end; }
  set textContent(value) { this.text = value; this.children = []; }
  get textContent() { return this.text + this.children.map(node => node.textContent).join(''); }
}
const walk = node => [node, ...node.children.flatMap(walk)];
function withUI(run, initial = 'First paragraph.\n\nRepeated text.\n\nRepeated text.') {
  const original = globalThis.document, nodes = new Map(), $ = id => { if (!nodes.has(id)) nodes.set(id, new Node('div', id)); return nodes.get(id); };
  globalThis.document = { getElementById: $, createElement: tag => new Node(tag), createDocumentFragment: () => new Node('fragment'), createTextNode: text => { const node = new Node('text'); node.textContent = text; return node; } };
  $('preview-panel').open = true; $('body').value = initial; $('reviewed').checked = true;
  let busy = false, pending = false, message = '', reviews = 0, revealed = 0;
  const moves = [], getDraft = () => ({ title: 'Fictional article', body: $('body').value, excerpt: 'Private extra', description: '', slug: '', questions: ['PRIVATE_QUESTION'] });
  const ui = installPreviewNavigation({ getDraft, isBusy: () => busy, hasPendingImport: () => pending, report: text => { message = text; }, selectReview: () => { reviews++; }, reveal: () => { revealed++; }, move: (node, options) => { moves.push({ node, options }); return true; } });
  const buttons = () => walk($('article-preview')).filter(node => node.className === 'secondary preview-passage-jump');
  const enable = () => { $('preview-locate').checked = true; $('preview-locate').fire('change'); };
  try { return run({ $, ui, moves, getDraft, buttons, enable, message: () => message, reviews: () => reviews, revealed: () => revealed, setBusy: value => { busy = value; }, setPending: value => { pending = value; } }); }
  finally { globalThis.document = original; }
}

test('Preview ranges distinguish repeated Unicode passages and preserve original source offsets and line endings', () => {
  const body = '\r\n# Café 🐈\r\n\r\nRepeated **text**.\r\nSecond line.\r\n\r\nRepeated **text**.\r\n\r\nFinal\rcarriage.';
  const passages = previewPassages(body);
  assert.deepEqual(passages.map(p => body.slice(p.start, p.end)), ['# Café 🐈\r', 'Repeated **text**.\r\nSecond line.\r', 'Repeated **text**.\r', 'Final\rcarriage.']);
  assert.deepEqual(passages.map(p => [p.line, p.endLine]), [[2,2],[4,5],[7,7],[9,9]]);
  assert.equal(passages[2].start, body.lastIndexOf('Repeated'));
  assert.deepEqual(previewBlocks(body), [{ type:'h3',level:1,text:'Café 🐈' }, { type:'p',text:'Repeated **text**.\nSecond line.' }, { type:'p',text:'Repeated **text**.' }, { type:'p',text:'Finalcarriage.' }]);
  for (const p of passages) { assert.ok(p.start >= 0 && p.end <= body.length && p.end > p.start); }
});

test('Lists, quotes, tables, closed fences and unsupported groups select their complete original source', () => {
  const chunks = ['- Parent\n  3. Child\n1. Other root', '> First\n> Second', '| A | B |\n| --- | --- |\n| x | y |', '~~~js\n# not a heading\n\n~~~', '- Valid\n   - Wrong indentation', '| A | B |\n| --- | --- |\n| Incomplete |'];
  const body = chunks.join('\n\n'), passages = previewPassages(body);
  assert.deepEqual(passages.map(p => body.slice(p.start,p.end)), chunks);
  assert.deepEqual(passages.map(p => p.blocks.map(b => b.type)), [['ul','ol'],['blockquote'],['table'],['pre'],['p'],['p']]);
  assert.deepEqual(passages.flatMap(p => p.blocks),previewBlocks(body));
  assert.equal(previewPassages('```\n\nENDING')[0].end, '```\n\nENDING'.length);
  assert.equal(previewPassages('```')[0].end,3);
  assert.deepEqual(previewPassages(' \r\n\n'),[]);
  assert.throws(() => previewPassages('x'.repeat(60001)),/60,000/);
  assert.throws(() => previewPassages(null),/60,000/);
});

test('Return mapping follows the current caret, with a deterministic next passage across blank space', () => {
  const passages = previewPassages('One\n\nTwo\n\nThree');
  for (const [position,index] of [[0,0],[3,0],[4,1],[5,1],[8,1],[9,2],[100,2]]) assert.equal(passageAtPosition(passages,position),index);
  assert.equal(passageAtPosition([],0),-1); assert.equal(passageAtPosition(passages,-1),-1); assert.equal(passageAtPosition(passages,1.5),-1);
});

test('Passage controls start off and select the chosen repeated paragraph without editing or changing approval', () => withUI(({ $, ui, buttons, enable, moves, revealed, message }) => {
  const body = $('body').value;
  assert.equal($('preview-locate').checked,false); assert.equal(buttons().length,0); assert.equal($('return-to-passage').hidden,true);
  enable(); assert.equal(buttons().length,3); assert.equal(buttons()[2].textContent,'Edit paragraph (line 5)');
  const stable = buttons()[2]; ui.refresh(); assert.equal(buttons()[2],stable);
  buttons()[2].fire();
  assert.deepEqual([$('body').selectionStart,$('body').selectionEnd],[body.lastIndexOf('Repeated'),body.length]);
  assert.equal($('body').value,body); assert.equal($('reviewed').checked,true); assert.equal($('return-to-passage').hidden,false);
  assert.equal(moves.at(-1).node,$('body')); assert.equal(moves.at(-1).options.anchor,$('article-heading')); assert.equal(revealed(),1); assert.match(message(),/line 5/);
}));

test('The return action follows the edited cursor and focuses its updated reading passage', () => withUI(({ $, ui, buttons, enable, moves, message }) => {
  enable(); buttons()[1].fire();
  $('body').value = 'Inserted.\n\nFirst paragraph.\n\nRevised second paragraph.\n\nRepeated text.';
  $('body').selectionStart = $('body').value.indexOf('Revised') + 8;
  $('body').selectionEnd = $('body').selectionStart; $('reviewed').checked = false; ui.refresh();
  $('preview-panel').open = false; $('return-to-passage').fire();
  assert.equal($('preview-panel').open,true); assert.equal(moves.at(-1).node.attrs['aria-label'],'paragraph, line 5');
  assert.match(moves.at(-1).node.textContent,/Revised second paragraph/); assert.match(message(),/current preview passage on line 5/);
  assert.equal($('reviewed').checked,false);
}));

test('Heading and separator passage actions select complete original Markdown source', () => withUI(({ $, buttons, enable }) => {
  const body = $('body').value; enable();
  assert.equal(buttons()[0].textContent, 'Edit heading (lines 1 to 3)');
  buttons()[0].fire(); assert.equal(body.slice($('body').selectionStart, $('body').selectionEnd), 'Café 😀\r\nsecond line\r\n===\r');
  assert.equal(buttons()[1].textContent, 'Edit separator (line 5)');
  buttons()[1].fire(); assert.equal(body.slice($('body').selectionStart, $('body').selectionEnd), '***\r');
  assert.equal($('body').value, body); assert.equal($('reviewed').checked, true);
}, 'Café 😀\r\nsecond line\r\n===\r\n\r\n***\r\n\r\nEnding.'));

test('Stale controls never reuse old positions and file or pending-import states block every jump', () => withUI(({ $, ui, buttons, enable, moves, setBusy, setPending, message }) => {
  enable(); const stale = buttons()[1];
  $('body').value = 'Different article.'; $('body').setSelectionRange(2,2); stale.fire();
  assert.equal(moves.length,0); assert.equal($('body').selectionStart,2); assert.match(message(),/article changed/);
  buttons()[0].fire(); const before = moves.length;
  for (const setBlocked of [setBusy,setPending]) {
    setBlocked(true); ui.refresh(); assert.equal($('preview-locate').disabled,true); assert.equal($('return-to-passage').disabled,true); assert.equal(buttons()[0].disabled,true);
    buttons()[0].fire(); $('return-to-passage').fire(); assert.equal(moves.length,before); assert.equal($('body').value,'Different article.');
    setBlocked(false); ui.refresh(); assert.equal(buttons()[0].disabled,false);
  }
}));

test('Control bounds retain the entire readable article and returning past the bound uses the full preview', () => withUI(({ $, buttons, enable, moves, ui, message }) => {
  enable(); assert.equal(buttons().length,PREVIEW_PASSAGE_LIMIT);
  assert.match($('preview-locate-status').textContent,/first 200 of 201/); assert.match($('article-preview').textContent,/Passage 201 ENDING/);
  buttons()[0].fire(); $('body').selectionStart=$('body').value.length; $('body').selectionEnd=$('body').value.length;
  $('return-to-passage').fire(); assert.equal(moves.at(-1).node,$('article-preview')); assert.match(message(),/first 200/);
  ui.clear(); ui.refresh(); assert.equal($('preview-locate').checked,false); assert.equal(buttons().length,0); assert.equal($('return-to-passage').hidden,true);
},Array.from({length:201},(_,i) => 'Passage '+(i+1)+(i===200?' ENDING':'')).join('\n\n')));

test('Safe links, literal hostile markup, native semantic content and exports stay independent of navigation', () => withUI(({ $, buttons, enable, getDraft }) => {
  const draft = getDraft(), markdown = createArticleMarkdown(draft), html = createFormattedArticle(draft), wp = createWordPressArticle(draft);
  enable(); const nodes=walk($('article-preview')), link=nodes.find(n=>n.tagName==='A');
  assert.ok(link); assert.equal(link.href,'https://example.com/'); assert.equal(link.rel,'noopener noreferrer'); assert.equal(link.target,'_blank');
  assert.ok(!nodes.some(n=>['SCRIPT','IMG'].includes(n.tagName))); assert.match($('article-preview').textContent,/<img/);
  assert.ok(nodes.some(n=>n.tagName==='TABLE')); assert.ok(nodes.some(n=>n.tagName==='BLOCKQUOTE')); assert.ok(nodes.some(n=>n.tagName==='PRE'));
  assert.ok(nodes.filter(n=>n.tagName==='BUTTON').every(n=>n.children.length===0));
  buttons().at(-1).fire(); $('return-to-passage').fire();
  assert.deepEqual(createArticleMarkdown(getDraft()),markdown); assert.deepEqual(createFormattedArticle(getDraft()),html); assert.deepEqual(createWordPressArticle(getDraft()),wp);
  for(const text of [markdown,html.html,wp.html]) assert.doesNotMatch(text,/preview-passage|Edit paragraph|PRIVATE_QUESTION/);
  const backup=createWorkspaceBackup({profile:'personal',audience:'',purpose:'',notes:'PRIVATE_SOURCE'},draft);
  assert.doesNotMatch(backup,/preview-locate|preview-passage|return-to-passage/);
},'[**Source**](https://example.com/) <img src=x onerror=alert(1)>\n\n> Quote\n\n```\n<script>alert(1)</script>\n```\n\n| A |\n| --- |\n| B |'));

test('Closing, reopening, hiding controls and clearing writing discard navigation without touching approval', () => withUI(({ $, ui, buttons, enable }) => {
  enable(); buttons()[0].fire(); $('preview-panel').open=false; $('body').value='New source.'; ui.refresh();
  $('preview-panel').open=true; ui.refresh(); assert.equal(buttons().length,1); assert.match($('article-preview').textContent,/New source/);
  $('preview-locate').checked=false; $('preview-locate').fire('change'); assert.equal(buttons().length,0); assert.equal($('return-to-passage').hidden,true); assert.equal($('reviewed').checked,true);
  $('body').value=''; ui.refresh(); assert.equal($('preview-locate').disabled,true);
  ui.clear(); ui.refresh(); assert.equal($('preview-locate').checked,false); assert.equal($('return-to-passage').hidden,true);
}));

test('Every public workspace exposes accessible opt-in controls in reading order outside optional tools',async()=>{
  const routes=['write','word-to-wordpress','word-to-markdown','google-docs-to-wordpress','markdown-to-wordpress','markdown-to-html','markdown-to-word'];
  const pages=Object.fromEntries(await Promise.all(routes.map(async route=>[route,await readFile('public/'+route+'/index.html','utf8')])));
  const result=JSON.parse(execFileSync('python3',['-c',String.raw`
import sys,json
from html.parser import HTMLParser
class P(HTMLParser):
 def __init__(self):super().__init__();self.stack=[];self.ids={};self.order=[]
 def handle_starttag(self,t,a):
  a=dict(a)
  if 'id' in a:
   assert a['id'] not in self.ids
   self.ids[a['id']]={'attrs':a,'parents':[v[1].get('id') for v in self.stack]};self.order.append(a['id'])
  if t not in 'area base br col embed hr img input link meta param source track wbr'.split():self.stack.append((t,a))
 def handle_endtag(self,t):assert self.stack[-1][0]==t;self.stack.pop()
out=[]
for route,html in json.load(sys.stdin).items():
 p=P();p.feed(html);assert not p.stack
 assert p.ids['preview-locate']['attrs']['aria-describedby']=='preview-locate-status'
 assert 'checked' not in p.ids['preview-locate']['attrs']
 assert 'disabled' in p.ids['preview-locate']['attrs']
 assert 'preview-panel' in p.ids['preview-locate']['parents']
 assert 'editing-tools' not in p.ids['return-to-passage']['parents']
 assert 'hidden' in p.ids['return-to-passage']['attrs']
 assert p.order.index('body')<p.order.index('return-to-passage')<p.order.index('preview-locate')<p.order.index('article-preview')
 out.append(route)
print(json.dumps(out))
`],{input:JSON.stringify(pages),encoding:'utf8'}));
  assert.deepEqual(result,routes);
  assert.match(await readFile('public/help/draft-checks/index.html','utf8'),/id="preview-passages"/);
});
