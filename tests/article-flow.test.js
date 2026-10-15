import test from 'node:test';
import assert from 'node:assert/strict';
import { installArticleFlow } from '../public/article-flow.js';
import { revealEditorFor } from '../public/editing.js';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

class Control {
  constructor() { this.value = ''; this.hidden = false; this.open = false; this.checked = false; this.attributes = {}; this.listeners = {}; this.textContent = ''; this.focused = false; }
  addEventListener(event, action) { this.listeners[event] = action; }
  dispatchEvent(event) { this.listeners[event.type]?.(event); }
  setAttribute(key, value) { this.attributes[key] = value; }
  removeAttribute(key) { delete this.attributes[key]; }
  focus() { this.focused = true; }
}
function withFlow(run) {
  const previous = globalThis.document;
  const nodes = new Map(['article-edit-panel','conversion-results','reviewed','start-word-file','start-review','start-handoff','article-progress','preview-panel','conversion-heading','publishing-destination','other-export-formats','import-panel'].map(id => [id, new Control()]));
  let body = '', message = '', altered = 0, busy = false, destinationChanges = 0;
  nodes.get('publishing-destination').value = 'wordpress';
  nodes.get('publishing-destination').addEventListener('change', () => { destinationChanges++; nodes.get('reviewed').checked = false; flow.update(); });
  globalThis.document = { getElementById: id => nodes.get(id) ?? null, querySelector: selector => selector === 'main' ? { classList: { add() {} } } : nodes.get(selector.slice(1)) ?? null };
  const flow = installArticleFlow({ getDraft: () => ({ body }), report: text => { message = text; }, isBusy: () => busy });
  try { run({ flow, $: id => nodes.get(id), edit: value => { body = value; altered++; }, body: () => body, message: () => message, altered: () => altered, busy: value => { busy = value; }, destinationChanges: () => destinationChanges }); }
  finally { globalThis.document = previous; }
}
test('An empty guided workspace shows the import step and keeps empty results out of the task', () => withFlow(({ flow, $, message }) => {
  flow.update(); assert.equal($('conversion-results').hidden, true); assert.equal($('article-edit-panel').hidden, true);
  assert.equal($('start-word-file').attributes['aria-current'], 'step');
  assert.equal(flow.handoff(), true); assert.match(message(), /Bring an article first/);
}));
test('An applied article opens the reading path without forcing source editing or granting approval', () => withFlow(({ flow, $, edit, body }) => {
  edit('Converted body'); $('import-panel').open = true; flow.reading();
  assert.equal($('conversion-results').hidden, false); assert.equal($('article-edit-panel').open, false); assert.equal($('conversion-heading').focused, true);
  assert.equal($('reviewed').checked, false); assert.equal(body(), 'Converted body'); assert.equal($('start-review').attributes['aria-current'], 'step');
  assert.equal($('import-panel').open, false);
}));
test('Approval updates progress without claiming a successful copy, and editing resets the step', () => withFlow(({ flow, $, edit }) => {
  edit('An article'); $('reviewed').checked = true; flow.update();
  assert.match($('article-progress').textContent, /Ready to copy/); assert.doesNotMatch($('article-progress').textContent, /copied|published/);
  $('reviewed').checked = false; flow.update(); assert.equal($('start-review').attributes['aria-current'], 'step');
}));
test('Handoff takes users to review consent and does not change writing or approval', () => withFlow(({ flow, $, edit, body, altered }) => {
  edit('Unchanged article'); flow.handoff(); assert.equal($('reviewed').focused, true); assert.equal($('reviewed').checked, false); assert.equal(body(), 'Unchanged article'); assert.equal(altered(), 1);
}));
test('The WordPress shortcut selects its destination, clears stale approval and preserves writing', () => withFlow(({ flow, $, edit, body, destinationChanges }) => {
  edit('Keep the article'); $('publishing-destination').value = 'html'; $('reviewed').checked = true; $('other-export-formats').open = true;
  flow.handoff();
  assert.equal($('publishing-destination').value, 'wordpress'); assert.equal(destinationChanges(), 1);
  assert.equal($('reviewed').checked, false); assert.equal($('reviewed').focused, true);
  assert.equal($('other-export-formats').open, false); assert.equal(body(), 'Keep the article');
}));
test('An already selected WordPress handoff keeps its valid approval', () => withFlow(({ flow, $, edit, destinationChanges }) => {
  edit('Reviewed article'); $('reviewed').checked = true; flow.handoff();
  assert.equal($('reviewed').checked, true); assert.equal(destinationChanges(), 0);
}));
test('Other approved destinations have accurate progress without silently changing the destination', () => withFlow(({ flow, $, edit }) => {
  edit('Article for another editor'); $('publishing-destination').value = 'html'; $('reviewed').checked = true; flow.update();
  assert.equal($('article-progress').textContent, '3. Ready to export your article');
  assert.equal($('publishing-destination').value, 'html'); assert.equal($('reviewed').checked, true);
}));
test('Busy handoff shortcuts preserve the current destination and approval', () => withFlow(({ flow, $, edit, busy, message, destinationChanges }) => {
  edit('Keep current writing'); $('publishing-destination').value = 'word'; $('reviewed').checked = true; busy(true); flow.handoff();
  assert.equal($('publishing-destination').value, 'word'); assert.equal($('reviewed').checked, true);
  assert.equal(destinationChanges(), 0); assert.equal($('reviewed').focused, false); assert.match(message(), /Finish the current file operation/);
}));
test('Findings and page fields can reveal the optional editor before focusing their target', () => {
  const outer = { tagName: 'DETAILS', id: 'article-edit-panel', hidden: true, open: false, parentElement: null };
  const inner = { tagName: 'DETAILS', id: 'page-details', open: false, parentElement: outer };
  revealEditorFor({ parentElement: inner }); assert.equal(outer.hidden, false); assert.equal(outer.open, true); assert.equal(inner.open, true);
});
test('The two document converters place balanced reading regions before optional source editing', async () => {
  for (const route of ['word-to-wordpress','google-docs-to-wordpress']) {
    const page = await readFile('public/' + route + '/index.html', 'utf8');
    execFileSync('python3', ['-c', String.raw`
import sys
from html.parser import HTMLParser
class P(HTMLParser):
 def __init__(self):super().__init__();self.stack=[];self.ids={};self.order=[]
 def handle_starttag(self,t,a):
  a=dict(a)
  if 'id' in a:self.ids[a['id']]={'ancestors':[n[1].get('id') for n in self.stack],'attrs':a};self.order.append(a['id'])
  if t not in 'area base br col embed hr img input link meta param source track wbr'.split():self.stack.append((t,a))
 def handle_endtag(self,t):assert self.stack[-1][0]==t;self.stack.pop()
p=P();p.feed(sys.stdin.read());assert not p.stack
assert p.order.index('import-panel')<p.order.index('conversion-results')<p.order.index('article-edit-panel')<p.order.index('draft')
assert 'article-edit-panel' in p.ids['body']['ancestors']
assert 'article-edit-panel' not in p.ids['article-preview']['ancestors']
assert 'open' not in p.ids['article-edit-panel']['attrs']
assert 'workspace-tools' in p.ids['backup-controls']['ancestors']
assert p.ids['conversion-heading']['attrs']['tabindex']=='-1'
assert 'open' in p.ids['wordpress-instructions']['attrs']
assert p.order.index('wordpress-findings')<p.order.index('reviewed')<p.order.index('copy-wordpress')<p.order.index('wordpress-instructions')
assert 'wordpress-primary-review' in p.ids['wordpress-findings']['ancestors']
assert 'wordpress-primary-actions' in p.ids['copy-wordpress']['ancestors']
assert 'wordpress-handoff' not in p.ids['reviewed']['ancestors']
assert 'wordpress-primary-actions' not in p.ids['reviewed']['ancestors']
assert 'other-export-formats' in p.ids['publishing-destination']['ancestors']
assert 'open' not in p.ids['other-export-formats']['attrs']
`], { input: page });
  }
});
