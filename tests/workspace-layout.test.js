import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { installWorkspaceLayout } from '../public/workspace-layout.js';

test('Layout changes preserve writing, selections, approval, disclosure state, focus, and DOM identity', () => {
  const previous = globalThis.document, events = {};
  const nodes = {
    main: { dataset: { release: 'fixture' } },
    'workspace-layout': { hidden: true },
    'workspace-layout-choice': { value: 'compare', addEventListener: (name, fn) => { events[name] = fn; } },
    'workspace-layout-status': { textContent: '' },
    body: { value: 'Private fictional writing', selectionStart: 8, selectionEnd: 17, scrollTop: 180 },
    notes: { value: 'Private fictional source' },
    reviewed: { checked: true },
    'preview-panel': { open: true },
    'article-preview': { children: ['same preview nodes'] }
  };
  const choice = nodes['workspace-layout-choice'];
  const protectedIds = ['body', 'notes', 'reviewed', 'preview-panel', 'article-preview'];
  const before = JSON.stringify(protectedIds.map(id => nodes[id]));
  const identities = protectedIds.map(id => nodes[id]);
  // Any attempt to capture writing or change focus fails the test.
  globalThis.document = { getElementById: id => {
    assert.ok(!protectedIds.includes(id), 'Layout must not access writing or preview nodes');
    return nodes[id] || null;
  }, activeElement: choice };
  try {
    const ui = installWorkspaceLayout();
    assert.equal(nodes.main.dataset.workspaceLayout, 'stacked');
    assert.equal(nodes.main.dataset.release, 'fixture');
    assert.equal(nodes['workspace-layout'].hidden, false);
    assert.equal(choice.value, 'stacked');
    assert.match(nodes['workspace-layout-status'].textContent, /full-width/);
    choice.value = 'compare'; events.change();
    assert.equal(nodes.main.dataset.workspaceLayout, 'compare');
    assert.match(nodes['workspace-layout-status'].textContent, /narrow screens/);
    assert.equal(globalThis.document.activeElement, choice);
    assert.equal(ui.select('stacked'), true);
    assert.equal(JSON.stringify(protectedIds.map(id => nodes[id])), before);
    assert.deepEqual(protectedIds.map(id => nodes[id]), identities);
    choice.value = 'invalid'; events.change();
    assert.equal(choice.value, 'stacked');
    assert.equal(nodes.main.dataset.workspaceLayout, 'stacked');
    assert.equal(ui.select(null), false);
  } finally { globalThis.document = previous; }
});

test('Layout controls are optional, and a newly opened workspace starts full-width', () => {
  const previous = globalThis.document;
  try {
    for (const missing of ['main', 'workspace-layout', 'workspace-layout-choice', 'workspace-layout-status']) {
      globalThis.document = { getElementById: id => id === missing ? null : {} };
      assert.equal(installWorkspaceLayout(), null);
    }
    for (let opening = 0; opening < 2; opening++) {
      const nodes = { main: { dataset: {} }, 'workspace-layout': {}, 'workspace-layout-choice': { addEventListener() {} }, 'workspace-layout-status': {} };
      globalThis.document = { getElementById: id => nodes[id] };
      const ui = installWorkspaceLayout();
      assert.equal(nodes.main.dataset.workspaceLayout, 'stacked');
      ui.select('compare');
    }
  } finally { globalThis.document = previous; }
});

test('All eight built workspaces share accessible layout choices and direct editing shortcuts', async () => {
  const routes = ['write', 'word-to-wordpress', 'word-to-markdown','html-to-markdown', 'google-docs-to-wordpress', 'markdown-to-wordpress', 'markdown-to-html', 'markdown-to-word'];
  const pages = Object.fromEntries(await Promise.all(routes.map(async route => [route, await readFile('public/' + route + '/index.html', 'utf8')])));
  const checked = JSON.parse(execFileSync('python3', ['-c', String.raw`
import sys,json
from html.parser import HTMLParser
class P(HTMLParser):
 def __init__(self):super().__init__();self.stack=[];self.ids={};self.labels=[];self.order=[];self.options=[]
 def handle_starttag(self,t,a):
  a=dict(a)
  if 'id' in a:
   assert a['id'] not in self.ids
   self.ids[a['id']]={'tag':t,'attrs':a,'parents':[v[1].get('id') for v in self.stack]};self.order.append(a['id'])
  if t=='label':self.labels.append(a.get('for'))
  if t=='option' and any(v[1].get('id')=='workspace-layout-choice' for v in self.stack):self.options.append(a['value'])
  if t not in 'area base br col embed hr img input link meta param source track wbr'.split():self.stack.append((t,a))
 def handle_endtag(self,t):assert self.stack[-1][0]==t;self.stack.pop()
out=[]
for route,html in json.load(sys.stdin).items():
 p=P();p.feed(html);assert not p.stack
 assert 'hidden' in p.ids['workspace-layout']['attrs']
 assert p.ids['workspace-layout-choice']['tag']=='select'
 assert 'workspace-layout-choice' in p.labels
 assert p.ids['workspace-layout-choice']['attrs']['aria-describedby']=='workspace-layout-status workspace-layout-help'
 assert p.options==['stacked','compare']
 assert p.order.index('workflow-steps')<p.order.index('workspace-layout')<p.order.index('body')
 for key in ['workflow-edit','edit-from-preview','edit-from-export']:
  assert p.ids[key]['tag']=='button'
  assert p.ids[key]['attrs']['type']=='button'
  assert 'hidden' in p.ids[key]['attrs']
  assert 'editing-tools' not in p.ids[key]['parents']
 assert 'exports' not in p.ids['edit-from-preview']['parents']
 assert 'workflow-steps' in p.ids['workflow-edit']['parents']
 assert 'exports' in p.ids['edit-from-export']['parents']
 assert p.order.index('article-preview')<p.order.index('edit-from-preview')<p.order.index('exports')<p.order.index('edit-from-export')
 out.append(route)
print(json.dumps(out))
`], { input: JSON.stringify(pages), encoding: 'utf8' }));
  assert.deepEqual(checked, routes);
});
