import test from 'node:test';
import assert from 'node:assert/strict';
import { createExportPreviewRenderer } from '../public/export-preview-reuse.js';

class Node {
  constructor(doc, kind = 'element', value = '') { this.ownerDocument = doc; this.kind = kind; this.value = value; this.childNodes = []; this.parentNode = null; }
  get firstChild() { return this.childNodes[0] || null; }
  append(...nodes) { for (const node of nodes) this.insertBefore(node, null); }
  insertBefore(node, anchor) {
    if (anchor !== null && anchor.parentNode !== this) throw Error('Invalid anchor');
    if (node.kind === 'fragment') { for (const child of [...node.childNodes]) this.insertBefore(child, anchor); return node; }
    node.parentNode?.removeChild(node);
    const index = anchor === null ? this.childNodes.length : this.childNodes.indexOf(anchor);
    this.childNodes.splice(index, 0, node); node.parentNode = this; return node;
  }
  removeChild(node) {
    const index = this.childNodes.indexOf(node); if (index < 0) throw Error('Not a child');
    this.childNodes.splice(index, 1); node.parentNode = null; return node;
  }
  replaceChildren(...nodes) { for (const child of [...this.childNodes]) this.removeChild(child); this.append(...nodes); }
}
const block = text => ({ type: 'p', text });
const model = (blocks, extra = {}) => ({ kind: 'document', destination: 'wordpress', title: '', blocks: blocks.map(value => typeof value === 'string' ? block(value) : value), ...extra });
function fixture() {
  const doc = { createDocumentFragment() { return new Node(doc, 'fragment'); } };
  const target = new Node(doc); let calls = 0;
  const renderer = (to, value) => {
    calls++;
    if (value.blocks?.some(b => b.text === 'FAIL')) throw Error('Rejected fixture');
    const values = value.kind === 'source' ? [['source', value.source]] : [
      ...(value.title ? [['title', value.title]] : []), ...value.blocks.map(b => ['block', b])
    ];
    const fragment = doc.createDocumentFragment();
    fragment.append(...values.map(v => new Node(doc, 'element', JSON.stringify(v))));
    to.replaceChildren(fragment);
  };
  const ui = createExportPreviewRenderer(target, renderer);
  const expected = value => { const to = new Node(doc); renderer(to, value); return to.childNodes.map(n => n.value); };
  return { doc, target, ui, calls: () => calls, expected, values: () => target.childNodes.map(n => n.value) };
}

test('Repeated models perform no new rendering and retain all existing nodes', () => {
  const { ui, target, calls } = fixture();
  ui.render(model(['a','b','c'])); const nodes = [...target.childNodes], count = calls();
  ui.render(model(['a','b','c']));
  assert.equal(calls(), count); assert.deepEqual(target.childNodes, nodes);
});

test('One changed end or middle block retains untouched prefix and suffix in place', () => {
  const { ui, target, calls } = fixture();
  ui.render(model(['a','b','c'])); const nodes = [...target.childNodes];
  ui.render(model(['a','b','changed']));
  assert.equal(calls(), 4); assert.equal(target.childNodes[0], nodes[0]); assert.equal(target.childNodes[1], nodes[1]);
  const last = target.childNodes[2];
  ui.render(model(['a','different','changed']));
  assert.equal(calls(), 5); assert.equal(target.childNodes[0], nodes[0]); assert.equal(target.childNodes[2], last);
  assert.equal(nodes[1].parentNode, null); assert.equal(nodes[2].parentNode, null);
});

test('Insertions, deletions, identical duplicates and reordered blocks match complete rendering', () => {
  const { ui, values, expected } = fixture();
  const cases = [[],['a'],['a','a'],['a','a','b'],['x','a','a','b'],['x','a','b'],['b','a','x'],['b','b','a','x'],['a','x'],[],['x','x','x']];
  for (const blocks of cases) { const value = model(blocks); ui.render(value); assert.deepEqual(values(), expected(value)); }
});

test('Title, source kind and destination boundaries cannot retain stale output', () => {
  const { ui, target, values, expected } = fixture();
  const cases = [model(['a'], { title: 'First' }), model(['a'], { title: 'Second' }), model(['a']),
    model(['a'], { destination: 'word' }), {kind:'source',destination:'markdown',source:'# literal\n\n[link](https://example.test/)\n'},
    {kind:'source',destination:'markdown',source:'# replacement\n'},model(['a'])];
  let old = null;
  for (const value of cases) { ui.render(value); assert.deepEqual(values(), expected(value)); old = target.firstChild; }
  ui.clear(); assert.equal(target.childNodes.length, 0); assert.equal(old.parentNode, null);
  ui.render(model(['a'])); assert.notEqual(target.firstChild, old);
});

test('Any changed nested list, table, heading level or image property creates a fresh block', () => {
  const { ui, target, values, expected } = fixture();
  const cases = [
    {type:'ul',items:['one'],children:[[{type:'ul',items:['nested']}]]},
    {type:'ul',items:['one'],children:[[{type:'ol',start:4,items:['nested changed']}]]},
    {type:'table',head:['A'],rows:[['日本語 😀']],align:['left']},
    {type:'table',head:['A'],rows:[['日本語 😀']],align:['right']},
    {type:'h4',text:'Header',exportLevel:2}, {type:'h5',text:'Header',exportLevel:3},
    {type:'linked-image',url:'https://example.test/a.png',alt:'one'},
    {type:'linked-image',url:'https://example.test/a.png',alt:'two'},
    {type:'linked-image',url:'https://example.test/b.png',alt:'two'}
  ];
  let old = null;
  for (const item of cases) { const value = model([item]); ui.render(value); assert.notEqual(target.firstChild, old); assert.deepEqual(values(), expected(value)); old=target.firstChild; }
});

test('Whole target replacement is detected and stale node references are discarded', () => {
  const { ui, target, doc } = fixture(); ui.render(model(['a','b'])); const old = [...target.childNodes];
  target.replaceChildren(new Node(doc, 'element', 'foreign'));
  ui.render(model(['a','b']));
  assert.equal(target.childNodes.length, 2); assert.ok(target.childNodes.every(n => !old.includes(n)));
});

test('A failed detached render keeps the old DOM intact and does not commit a partial signature', () => {
  const { ui, target } = fixture(); ui.render(model(['a','b'])); const old = [...target.childNodes];
  assert.throws(() => ui.render(model(['a','new','FAIL'])), /Rejected fixture/);
  assert.deepEqual(target.childNodes, old);
  ui.render(model(['a','new','fixed'])); assert.equal(target.firstChild, old[0]);
  ui.clear(); assert.equal(target.childNodes.length, 0);
});

test('Partial DOM environments retain the original full-render fallback', () => {
  const target = { replaceChildren() { this.cleared = true; } }; let seen;
  const ui = createExportPreviewRenderer(target, (to, value) => { assert.equal(to, target); seen = value; });
  const value = model(['a']); ui.render(value); assert.equal(seen, value); ui.clear(); assert.equal(target.cleared, true);
});

test('Near-limit repeated blocks remain bounded to current entries without copying old nodes', () => {
  const { ui, target, calls } = fixture();
  const blocks = Array.from({length:1500}, (_,i) => 'Fictional passage '+i);
  ui.render(model(blocks)); const count=calls(), first=target.firstChild;
  for (let i=0;i<20;i++) { blocks[1499]='Last passage '+i; ui.render(model(blocks)); }
  assert.equal(calls()-count,20); assert.equal(target.childNodes.length,1500); assert.equal(target.firstChild,first);
  ui.clear(); ui.render(model(blocks)); assert.notEqual(target.firstChild,first);
});
