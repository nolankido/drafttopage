import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { installPublishingExports } from '../public/export-controls.js';
import { QUICK_SAMPLE } from '../public/quick-sample.js';

test('Shared page structure keeps editor, result, and notes as balanced sibling regions in reading order', async () => {
  const pages = Object.fromEntries(await Promise.all(['write', 'markdown-to-wordpress', 'word-to-wordpress', 'markdown-to-html', 'markdown-to-word'].map(async route => [route, await readFile('public/' + route + '/index.html', 'utf8')])));
  const report = JSON.parse(execFileSync('python3', ['-c', String.raw`
import sys,json
from html.parser import HTMLParser
void=set('area base br col embed hr img input link meta param source track wbr'.split())
class Parser(HTMLParser):
 def __init__(self):super().__init__();self.root={'tag':'root','children':[]};self.stack=[self.root];self.ids={};self.order=[]
 def handle_starttag(self,tag,attrs):
  node={'tag':tag,'attrs':dict(attrs),'children':[],'parent':self.stack[-1]};self.stack[-1]['children'].append(node)
  if 'id' in node['attrs']:
   key=node['attrs']['id'];assert key not in self.ids;self.ids[key]=node;self.order.append(key)
  if tag not in void:self.stack.append(node)
 def handle_endtag(self,tag):
  assert self.stack[-1]['tag']==tag,(tag,self.stack[-1]['tag']);self.stack.pop()
def inside(node,parent):
 while node.get('parent'):
  node=node['parent']
  if node is parent:return True
 return False
out={}
for route,html in json.load(sys.stdin).items():
 p=Parser();p.feed(html);assert len(p.stack)==1
 d=p.ids['draft'];r=p.ids['conversion-results'];wrapper=p.ids.get('article-edit-panel',d);container=wrapper['parent'];notes=next(n for n in container['children'] if 'source-editor' in n['attrs'].get('class',''))
 assert container is r['parent'] is notes['parent']
 if wrapper is d:assert container['children'].index(d)<container['children'].index(r)<container['children'].index(notes)
 else:assert container['children'].index(r)<container['children'].index(wrapper)<container['children'].index(notes) and 'open' not in wrapper['attrs']
 assert inside(p.ids['body'],d) and inside(p.ids['page-details'],d)
 assert inside(p.ids['article-preview'],r) and inside(p.ids['exports'],r) and not inside(p.ids['exports'],d)
 extra=p.ids['additional-exports'];assert all(inside(p.ids[key],extra) for key in ['copy-formatted','copy-body','download-body','download-html','download-kit'])
 assert all(not inside(p.ids[key],extra) for key in ['copy-wordpress','download-word','copy-html-source'])
 assert p.ids['article-preview']['attrs']['tabindex']=='0' and p.ids['article-preview']['attrs']['role']=='region'
 assert bool('open' in extra['attrs'])==(route=='write')
 assert bool('open' in p.ids['html-source-code-panel']['attrs'])==(route=='write')
 assert ('open' in p.ids['wordpress-instructions']['attrs'])==(route=='word-to-wordpress')
 assert p.ids['preview-empty']['tag']=='p'
 out[route]={'balanced':True,'sourceOrder':['article','result','notes'],'compact':route!='write'}
print(json.dumps(out))
`], { input: JSON.stringify(pages), encoding: 'utf8' }));
  assert.equal(Object.keys(report).length, 5);
  for (const entry of Object.values(report)) assert.equal(entry.balanced, true);
});

class Control {
  constructor() { this.value = ''; this.checked = false; this.open = false; this.hidden = false; this.disabled = false; this.textContent = ''; this.children = []; this.events = new Map(); }
  addEventListener(type, fn) { if (!this.events.has(type)) this.events.set(type, []); this.events.get(type).push(fn); }
  fire(type) { for (const fn of this.events.get(type) || []) fn(); }
  replaceChildren(...nodes) { this.children = nodes; }
  append(...nodes) { this.children.push(...nodes); }
  setAttribute() {}
}
async function withControls(run, compact = true) {
  const prior = globalThis.document;
  const controls = new Map(), $ = id => { if (!controls.has(id)) controls.set(id, new Control()); return controls.get(id); };
  globalThis.document = { getElementById: $, createElement: () => new Control(), createTextNode: value => ({ textContent: value }) };
  let draft = { ...QUICK_SAMPLE }, busy = false, approvalCalls = 0, changedCalls = 0;
  $('export-format').value = 'page';
  const ui = installPublishingExports({ getDraft: () => draft, defaultDestination: 'word', compact, isBusy: () => busy, approved: () => { approvalCalls++; if (!$('reviewed').checked) throw new Error('Review first'); }, changed: () => { changedCalls++; $('reviewed').checked = false; ui.update(); }, report: () => {} });
  try { await run({ $, ui, draft: () => draft, setDraft: value => { draft = value; }, busy: value => { busy = value; }, approvalCalls: () => approvalCalls, changedCalls: () => changedCalls }); }
  finally { globalThis.document = prior; }
}
test('Closed extra exports expose no kit output and leave body-only conversion ready despite unused metadata', () => withControls(({ $, ui, setDraft, changedCalls }) => {
  setDraft({ body: 'A valid body', title: 'x'.repeat(161) });
  $('reviewed').checked = true; ui.update();
  assert.equal($('additional-exports').open, false); assert.equal($('kit-files').children.length, 0); assert.equal($('kit-readiness').textContent, ''); assert.equal($('download-kit').disabled, true);
  assert.equal($('download-word').disabled, false); assert.equal(changedCalls(), 0);
}));
test('Opening and closing extra exports preserves writing and approval while purging the hidden file list', () => withControls(({ $, ui, draft, changedCalls }) => {
  const before = JSON.stringify(draft()); $('reviewed').checked = true; $('publishing-kit-panel').open = true;
  $('additional-exports').open = true; $('additional-exports').fire('toggle');
  assert.ok($('kit-files').children.length); assert.equal($('download-kit').disabled, false);
  $('additional-exports').open = false; $('additional-exports').fire('toggle');
  assert.equal($('kit-files').children.length, 0); assert.equal($('kit-readiness').textContent, ''); assert.equal($('download-kit').disabled, true);
  assert.equal($('reviewed').checked, true); assert.equal(JSON.stringify(draft()), before); assert.equal(changedCalls(), 0);
  $('additional-exports').open = true; $('additional-exports').fire('toggle'); assert.ok($('kit-files').children.length);
}));
test('The other-editor destination reveals its actions deliberately; reset restores the route defaults', () => withControls(({ $, ui, changedCalls }) => {
  $('reviewed').checked = true; $('publishing-destination').value = 'other'; $('publishing-destination').fire('change');
  assert.equal($('additional-exports').open, true); assert.equal($('reviewed').checked, false); assert.equal(changedCalls(), 1);
  ui.reset(); assert.equal($('publishing-destination').value, 'word'); assert.equal($('additional-exports').open, false); assert.equal($('kit-files').children.length, 0);
}));
test('Hidden or busy general kit actions cannot start a stale download', () => withControls(({ $, ui, busy, approvalCalls }) => {
  $('reviewed').checked = true; ui.update(); $('download-kit').fire('click'); assert.equal(approvalCalls(), 0);
  $('additional-exports').open = true; busy(true); $('download-kit').fire('click'); assert.equal(approvalCalls(), 0);
}));
test('The general writing workspace keeps its additional exports expanded', () => withControls(({ $, ui }) => {
  assert.equal($('additional-exports').open, true); $('additional-exports').open = false; ui.reset(); assert.equal($('additional-exports').open, true);
}, false));
test('Guided WordPress groups follow the selected format while approval remains available for other exports', () => withControls(({ $, ui }) => {
  $('publishing-destination').value = 'wordpress'; $('publishing-destination').fire('change');
  assert.equal($('wordpress-primary-review').hidden, false); assert.equal($('wordpress-primary-actions').hidden, false);
  assert.equal($('copy-wordpress').disabled, true);
  $('reviewed').checked = true; ui.update(); assert.equal($('copy-wordpress').disabled, false);
  $('publishing-destination').value = 'html'; $('publishing-destination').fire('change');
  assert.equal($('wordpress-primary-review').hidden, true); assert.equal($('wordpress-primary-actions').hidden, true);
  assert.equal($('reviewed').hidden, false); assert.equal($('reviewed').checked, false);
  assert.equal($('html-source-handoff').hidden, false);
  $('reviewed').checked = true; ui.update(); assert.equal($('copy-html-source').disabled, false);
  $('other-export-formats').open = true; ui.reset(); ui.update();
  assert.equal($('other-export-formats').open, false); assert.equal($('publishing-destination').value, 'word');
}));
