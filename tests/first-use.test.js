import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { revealDetails } from '../public/disclosure.js';

test('Converter essentials stay reachable while optional tools share one closed disclosure', async () => {
  const routes = ['markdown-to-wordpress', 'word-to-wordpress', 'google-docs-to-wordpress', 'markdown-to-html', 'markdown-to-word'];
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
 def handle_endtag(self,t):assert self.stack[-1][0]==t;self.stack.pop()
out={}
for route,html in json.load(sys.stdin).items():
 p=P();p.feed(html);assert not p.stack
 assert 'open' not in p.nodes['editing-tools']['attrs']
 for key in ['body','title','reviewed','publishing-destination','copy-wordpress','download-word','copy-html-source','backup-controls','import-panel','page-details','article-image-status']:
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
