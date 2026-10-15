import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

test('Every workspace keeps conversion notes before reading, exact source optional, and consent reachable outside both disclosures', async () => {
  const routes = ['write', 'markdown-to-wordpress', 'word-to-wordpress', 'google-docs-to-wordpress', 'markdown-to-html', 'markdown-to-word'];
  const pages = Object.fromEntries(await Promise.all(routes.map(async route => [route, await readFile('public/' + route + '/index.html', 'utf8')])));
  const checked = JSON.parse(execFileSync('python3', ['-c', String.raw`
import sys,json
from html.parser import HTMLParser
class P(HTMLParser):
 def __init__(self):super().__init__();self.stack=[];self.nodes={};self.order=[]
 def handle_starttag(self,t,a):
  a=dict(a)
  if 'id' in a:
   assert a['id'] not in self.nodes
   self.nodes[a['id']]={'attrs':a,'ancestors':[x[1].get('id') for x in self.stack]};self.order.append(a['id'])
  if t not in 'area base br col embed hr img input link meta param source track wbr'.split():self.stack.append((t,a))
 def handle_endtag(self,t):assert self.stack[-1][0]==t,(t,self.stack[-1][0]);self.stack.pop()
checked=[]
for route,page in json.load(sys.stdin).items():
 p=P();p.feed(page);assert not p.stack
 assert p.order.index('import-review-summary')<p.order.index('import-warnings')<p.order.index('import-reading-preview')<p.order.index('import-changes-ok')<p.order.index('apply-import')
 assert 'import-review-notes' in p.nodes['import-warnings']['ancestors']
 assert 'open' in p.nodes['import-reading-panel']['attrs']
 assert 'open' not in p.nodes['import-source-panel']['attrs']
 assert 'import-source-panel' in p.nodes['import-body-preview']['ancestors']
 assert 'readonly' in p.nodes['import-body-preview']['attrs']
 assert p.nodes['import-reading-preview']['attrs']['tabindex']=='0'
 assert p.nodes['import-reading-preview']['attrs']['role']=='region'
 assert p.nodes['import-changes-ok']['attrs']['aria-describedby']=='import-review-summary'
 for key in ['import-changes-ok','import-unmapped-ok','apply-import']:
  assert not any(parent in p.nodes[key]['ancestors'] for parent in ['import-reading-panel','import-source-panel'])
 checked.append(route)
print(json.dumps(checked))
`], { input: JSON.stringify(pages), encoding: 'utf8' }));
  assert.deepEqual(checked, routes);
});
