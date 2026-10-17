import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { revealDetails } from '../public/disclosure.js';

test('Converter essentials stay reachable while optional tools share one closed disclosure', async () => {
  const routes = ['markdown-to-wordpress', 'word-to-wordpress', 'word-to-markdown','html-to-markdown', 'google-docs-to-wordpress', 'markdown-to-html', 'markdown-to-word'];
  const pages = Object.fromEntries(await Promise.all(routes.map(async route => [route, await readFile('public/' + route + '/index.html', 'utf8')])));
  const report = JSON.parse(execFileSync('python3', ['-c', String.raw`
import sys,json
from html.parser import HTMLParser
class P(HTMLParser):
 def __init__(self):super().__init__();self.stack=[];self.nodes={}
 def handle_starttag(self,t,a):
  a=dict(a)
  if 'id' in a:
   assert a['id'] not in self.nodes
   self.nodes[a['id']]={'attrs':a,'ancestors':[v[1].get('id') for v in self.stack]}
  if t not in 'area base br col embed hr img input link meta param source track wbr'.split():self.stack.append((t,a))
 def handle_startendtag(self,t,a):
  assert t in 'area base br col embed hr img input link meta param source track wbr'.split()
  self.handle_starttag(t,a)
 def handle_endtag(self,t):assert self.stack[-1][0]==t;self.stack.pop()
out={}
for route,html in json.load(sys.stdin).items():
 p=P();p.feed(html);assert not p.stack
 assert 'open' not in p.nodes['editing-tools']['attrs']
 for key in ['body','title','reviewed','publishing-destination','copy-wordpress','download-word','copy-html-source','copy-article-markdown','download-article-markdown','markdown-handoff','backup-controls','import-panel','page-details','article-image-status']:
  assert 'editing-tools' not in p.nodes[key]['ancestors'],(route,key)
 for key in ['draft-check-panel','find-panel','image-editor-panel','link-editor-panel','table-editor-panel','source-review-panel','checkpoint-panel','draft-collection-panel']:
  assert 'editing-tools' in p.nodes[key]['ancestors'],(route,key)
 assert 'disabled' in p.nodes['copy-wordpress']['attrs']
 assert 'disabled' in p.nodes['download-word']['attrs']
 assert 'disabled' in p.nodes['copy-html-source']['attrs']
 out[route]=True
print(json.dumps(out))
`], { input: JSON.stringify(pages), encoding: 'utf8' }));
  assert.deepEqual(Object.keys(report), routes);
  assert.doesNotMatch(await readFile('public/write/index.html', 'utf8'), /id="editing-tools"/);
});

test('Workspace support links keep the writing tab open and preserve their guide destinations', async () => {
  const routes = ['write', 'word-to-wordpress', 'word-to-markdown', 'html-to-markdown', 'google-docs-to-wordpress', 'markdown-to-wordpress', 'markdown-to-html', 'markdown-to-word'];
  const pages = Object.fromEntries(await Promise.all(routes.map(async route => [route, await readFile('public/' + route + '/index.html', 'utf8')])));
  const links = JSON.parse(execFileSync('python3', ['-c', String.raw`
import sys,json,re
from html.parser import HTMLParser
class P(HTMLParser):
 def __init__(self):super().__init__();self.stack=[];self.links=[];self.current=None
 def handle_starttag(self,t,a):
  a=dict(a)
  if t=='a':
   self.current={'attrs':a,'text':'','depth':len(self.stack),'parents':[v.get('id') for _,v in self.stack],
    'guide':any(set(v.get('class','').split())&{'tool-guide','converter-guide'} for _,v in self.stack)}
   self.links.append(self.current)
  if t not in 'area base br col embed hr img input link meta param source track wbr'.split():self.stack.append((t,a))
 def handle_endtag(self,t):
  if t=='a':self.current=None
  if self.stack and self.stack[-1][0]==t:self.stack.pop()
 def handle_data(self,text):
  if self.current is not None and not any('hidden' in a or 'sr-only' in a.get('class','').split() for _,a in self.stack[self.current['depth']:]):self.current['text']+=text
out={}
for route,html in json.load(sys.stdin).items():
 p=P();p.feed(html)
 out[route]=[a for a in p.links if re.match(r'^/(help|getting-started|about|access|privacy)(/|$)',a['attrs'].get('href',''))]
print(json.dumps(out))
`], { input: JSON.stringify(pages), encoding: 'utf8' }));
  const guideTargets = {
    'word-to-markdown': ['/help/article-import/', '/help/local-workspace/'],
    'html-to-markdown': ['/help/article-import/#formatted-writing', '/privacy/'],
    'google-docs-to-wordpress': ['/help/publishing-handoff/#wordpress-code-editor', '/help/article-import/', '/privacy/'],
    'markdown-to-wordpress': ['/about/'],
    'markdown-to-html': ['/help/publishing-handoff/#html-source', '/about/'],
    'markdown-to-word': ['/help/article-import/#formatted-writing', '/help/local-workspace/', '/privacy/']
  };
  for (const route of routes) {
    for (const href of ['/help/', '/getting-started/', '/about/', '/access/', '/privacy/']) {
      assert.ok(links[route].some(link => link.attrs.href === href), route + ' retains ' + href);
    }
    assert.ok(links[route].some(link => link.parents.includes('import-panel') && link.attrs.href === '/help/article-import/'), route + ' keeps import help reachable');
    assert.ok(links[route].some(link => link.parents.includes('exports') && link.attrs.href === '/help/publishing-handoff/#wordpress'), route + ' keeps export help reachable');
    for (const href of guideTargets[route] || []) {
      assert.ok(links[route].some(link => link.guide && link.attrs.href === href), route + ' preserves guide destination ' + href);
    }
    for (const link of links[route]) {
      const context = route + ': ' + link.attrs.href;
      assert.equal(link.attrs.target, '_blank', context);
      assert.ok((link.attrs.rel || '').split(/\s+/).includes('noopener'), context);
      assert.match(link.text, /\(new tab\)/i, context + ' has a visible new-tab cue');
    }
  }
});

test('A shortcut reveals every enclosing disclosure before focus, without changing writing or approval', () => {
  const writing = { value: 'A draft to keep exactly.', checked: true };
  const outer = { tagName: 'DETAILS', open: false, parentElement: null };
  const section = { tagName: 'SECTION', parentElement: outer };
  const inner = { tagName: 'DETAILS', open: false, parentElement: section };
  const panel = { tagName: 'DETAILS', open: false, parentElement: inner, writing };
  const before = JSON.stringify(writing);
  revealDetails(panel);
  assert.equal(panel.open, true);
  assert.equal(inner.open, true);
  assert.equal(outer.open, true);
  assert.equal(Object.hasOwn(section, 'open'), false);
  assert.equal(JSON.stringify(writing), before);
  revealDetails(panel);
  revealDetails(null);
  assert.equal(JSON.stringify(writing), before);
});
