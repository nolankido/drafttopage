import test from 'node:test';
import assert from 'node:assert/strict';
import { installWorkspaceNavigation } from '../public/workspace-navigation.js';

class Node {
  constructor(doc, tagName = 'DIV', id = '') {
    this.ownerDocument = doc; this.tagName = tagName; this.id = id; this.parentElement = null;
    this.children = []; this.attributes = new Map(); this.dataset = {}; this.events = new Map();
    this.hidden = false; this.disabled = false; this.isConnected = true; this.textContent = ''; this.focuses = 0;
  }
  append(...nodes) { for (const node of nodes) { node.parentElement = this; this.children.push(node); } }
  contains(node) { for (let current = node; current; current = current.parentElement) if (current === this) return true; return false; }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  hasAttribute(name) { return this.attributes.has(name); }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  removeAttribute(name) { this.attributes.delete(name); }
  matches(selector) {
    if (selector === ':disabled') return this.disabled;
    if (selector === '[hidden]') return this.hidden;
    return selector.startsWith('[') ? this.hasAttribute(selector.slice(1, -1)) : this.tagName.toLowerCase() === selector;
  }
  closest(selector) { for (let node = this; node; node = node.parentElement) if (node.matches(selector)) return node; return null; }
  querySelectorAll(selector) { return this.children.flatMap(node => [...(node.matches(selector) ? [node] : []), ...node.querySelectorAll(selector)]); }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  addEventListener(type, fn) { if (!this.events.has(type)) this.events.set(type, new Set()); this.events.get(type).add(fn); }
  removeEventListener(type, fn) { this.events.get(type)?.delete(fn); }
  fire(type = 'click', fields = {}) {
    const event = { type, currentTarget: this, target: this, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...fields };
    for (const fn of this.events.get(type) || []) fn(event);
    return event;
  }
  click() { if (!this.disabled) return this.fire(); }
  focus() {
    if (this.disabled || this.closest('[hidden]')) return;
    if (this.ownerDocument.activeElement !== this) this.ownerDocument.activeElement?.fire('blur');
    this.ownerDocument.activeElement = this; this.focuses++;
  }
}

function setup({ work = false, busy = false, pending = false, staged = false } = {}) {
  const doc = { activeElement: null, addEventListener() {}, removeEventListener() {}, defaultView: { addEventListener() {}, removeEventListener() {} } };
  const nodes = new Map(), make = (id, tag = 'DIV') => { const node = new Node(doc, tag, id); nodes.set(id, node); return node; }, $ = id => nodes.get(id);
  const root = make('root'), menu = make('menu', 'DETAILS'), summary = make('summary', 'SUMMARY');
  const tools = make('workspace-current-tools'), label = make('workspace-converter-label', 'H2');
  const sourceGroup = make('workspace-converter-links'), writing = make('workspace-writing-link', 'A');
  const edit = make('workspace-edit-current', 'BUTTON'), save = make('workspace-save-current', 'BUTTON'), body = make('body', 'TEXTAREA');
  root.append(menu, writing, edit, save, body); menu.append(summary, tools, sourceGroup); sourceGroup.append(label);
  tools.hidden = true; edit.hidden = true; save.hidden = true; label.textContent = 'Choose a converter';
  writing.setAttribute('href', '/write/'); writing.textContent = 'Writing desk';
  for (const destination of ['wordpress', 'markdown', 'html', 'word']) {
    const button = make(destination, 'BUTTON'); button.dataset.currentDestination = destination;
    button.setAttribute('data-current-destination', destination); tools.append(button);
  }
  function source(id, href, { target, rel, cueHidden = true } = {}) {
    const link = make(id, 'A'), strong = make(id + '-label', 'STRONG'), cue = make(id + '-cue', 'SPAN');
    link.setAttribute('href', href); link.setAttribute('data-workspace-source-link', '');
    if (target !== undefined) link.setAttribute('target', target);
    if (rel !== undefined) link.setAttribute('rel', rel);
    strong.textContent = 'Source ' + id; cue.textContent = ' (new tab)'; cue.hidden = cueHidden;
    cue.setAttribute('data-workspace-new-tab-cue', ''); link.append(strong, cue); sourceGroup.append(link);
    return link;
  }
  const normal = source('normal', '/word-to-markdown/');
  const explicit = source('explicit', '/google-docs-to-wordpress/#draft', { target: '_self', rel: 'external  nofollow' });
  const separate = source('separate', '/write/#notes', { target: '_blank', rel: 'noopener noreferrer', cueHidden: false });
  const unmarked = make('unmarked', 'A'); unmarked.setAttribute('href', '/word-to-markdown/'); root.append(unmarked);
  doc.getElementById = $; doc.querySelectorAll = selector => root.querySelectorAll(selector);
  const state = { work, busy, pending, staged, destination: 'wordpress', approved: true,
    article: 'Keep this article. UNIQUE_END', sourceNotes: 'Keep these private notes.', selection: [5, 11],
    preparedImage: { url: 'https://example.com/image.png', alt: 'Pending image description' },
    importSource: '<p>Keep this copied source.</p>', acknowledged: true, revisions: ['Previous article'], recoveryConsent: false };
  const calls = [], order = [];
  const ui = installWorkspaceNavigation({ document: doc,
    hasWork: () => { order.push('work'); return state.work; },
    isBusy: () => { order.push('busy'); return state.busy; },
    getImportState: () => { order.push('import'); return { pending: state.pending, staged: state.staged }; },
    chooseDestination: destination => {
      order.push('choose'); calls.push(['choose', destination]);
      if (state.destination !== destination) { state.destination = destination; state.approved = false; }
    },
    editCurrent: () => { order.push('edit'); calls.push(['edit']); body.focus(); },
    saveCurrent: () => { order.push('save'); calls.push(['save']); },
    reviewImport: () => { order.push('review'); calls.push(['review', state.staged]); },
    report: message => calls.push(['report', message])
  });
  calls.length = 0; order.length = 0;
  return { $, doc, ui, state, calls, order, sources: [normal, explicit, separate] };
}

test('An empty workspace retains original navigation without revealing current-draft actions', () => {
  const { $, ui, calls, state } = setup(), before = structuredClone(state);
  assert.equal($('workspace-current-tools').hidden, true); assert.equal($('workspace-edit-current').hidden, true);
  assert.equal($('workspace-save-current').hidden, true); assert.equal($('workspace-writing-link').hidden, false);
  assert.equal($('workspace-converter-label').textContent, 'Choose a converter');
  assert.equal($('normal').getAttribute('target'), null); assert.equal($('normal').getAttribute('rel'), null);
  assert.equal($('explicit').getAttribute('target'), '_self'); assert.equal($('explicit').getAttribute('rel'), 'external  nofollow');
  assert.equal($('normal-cue').hidden, true); assert.equal($('separate-cue').hidden, false);
  for (const id of ['wordpress', 'markdown', 'html', 'word', 'workspace-edit-current', 'workspace-save-current']) $(id).fire();
  ui.update(); assert.deepEqual(calls, []); assert.deepEqual(state, before);
});

test('Work protects authored source links and restoring an empty workspace restores exact link attributes and cues', () => {
  const { $, state, ui, sources, calls } = setup();
  const original = sources.map(link => ({ href: link.getAttribute('href'), target: link.getAttribute('target'), rel: link.getAttribute('rel'), children: [...link.children], hidden: link.children[1].hidden }));
  state.work = true; const before = structuredClone(state); ui.update(); ui.update();
  assert.equal($('workspace-current-tools').hidden, false); assert.equal($('workspace-edit-current').hidden, false);
  assert.equal($('workspace-save-current').hidden, false); assert.equal($('workspace-writing-link').hidden, true);
  assert.equal($('workspace-converter-label').textContent, 'Start another conversion');
  for (const [index, link] of sources.entries()) {
    assert.equal(link.getAttribute('target'), '_blank'); assert.match(link.getAttribute('rel'), /\bnoopener\b/);
    assert.equal(link.children[1].hidden, false); assert.equal(link.getAttribute('href'), original[index].href);
    assert.deepEqual(link.children, original[index].children);
  }
  assert.equal($('unmarked').getAttribute('target'), null); assert.deepEqual(state, before); assert.deepEqual(calls, []);
  state.work = false; ui.update();
  for (const [index, link] of sources.entries()) {
    assert.equal(link.getAttribute('target'), original[index].target); assert.equal(link.getAttribute('rel'), original[index].rel);
    assert.equal(link.children[1].hidden, original[index].hidden);
  }
  assert.equal($('workspace-converter-label').textContent, 'Choose a converter');
  assert.equal($('workspace-writing-link').getAttribute('target'), null); assert.equal($('workspace-writing-link').getAttribute('rel'), null);
});

test('An initial asynchronous operation protects even an empty workspace and disables current actions', () => {
  const { $, ui, state, calls, order } = setup({ busy: true });
  assert.equal($('normal').getAttribute('target'), '_blank'); assert.equal($('workspace-current-tools').hidden, false);
  assert.equal($('workspace-current-tools').getAttribute('aria-busy'), 'true');
  for (const id of ['wordpress', 'markdown', 'html', 'word', 'workspace-edit-current', 'workspace-save-current']) {
    assert.equal($(id).disabled, true); order.length = 0; $(id).fire();
    assert.equal(order[0], 'busy'); assert.equal(order.includes('import'), false);
  }
  assert.equal(calls.every(([action]) => action === 'report'), true);
  assert.equal(state.approved, true); assert.equal(state.destination, 'wordpress');
  state.busy = false; ui.update(); assert.equal($('workspace-current-tools').hidden, true);
  assert.equal($('normal').getAttribute('target'), null); assert.equal($('workspace-writing-link').hidden, false);
});

test('Source links recheck live work before native activation without intercepting modifier or ordinary clicks', () => {
  const { $, state, calls } = setup();
  for (const fields of [{ button: 0 }, { button: 0, ctrlKey: true }, { button: 0, metaKey: true }, { button: 0, shiftKey: true }, { button: 1 }]) {
    state.work = true;
    const event = $('normal').fire('click', fields);
    assert.equal(event.defaultPrevented, false); assert.equal($('normal').getAttribute('target'), '_blank');
    assert.equal($('normal').getAttribute('href'), '/word-to-markdown/');
    state.work = false;
    assert.equal($('normal').fire('click', fields).defaultPrevented, false); assert.equal($('normal').getAttribute('target'), null);
  }
  state.work = true; assert.equal($('workspace-writing-link').fire().defaultPrevented, false);
  assert.equal($('workspace-writing-link').getAttribute('target'), '_blank'); assert.deepEqual(calls, []);
});

test('Destination buttons delegate the exact current-draft choice after guards and leave writing and preparation intact', () => {
  const { $, state, calls, order } = setup({ work: true });
  const before = structuredClone(state);
  $('wordpress').fire(); assert.deepEqual(calls, [['choose', 'wordpress']]); assert.equal(state.approved, true);
  assert.deepEqual(order.slice(0, 4), ['busy', 'work', 'import', 'choose']);
  for (const destination of ['markdown', 'html', 'word']) {
    $(destination).fire(); assert.deepEqual(calls.at(-1), ['choose', destination]);
    assert.equal(state.destination, destination); assert.equal(state.approved, false);
  }
  assert.deepEqual({ ...state, destination: before.destination, approved: before.approved }, before);
});

test('Raw and staged imports are reviewed before destination or edit callbacks without altering pending decisions', () => {
  for (const staged of [false, true]) {
    const { $, state, calls, order } = setup({ work: true, pending: true, staged });
    const before = structuredClone(state);
    for (const id of ['wordpress', 'markdown', 'html', 'word', 'workspace-edit-current']) {
      order.length = 0; $(id).fire();
      assert.deepEqual(calls.at(-1), ['review', staged]); assert.deepEqual(order.slice(0, 4), ['busy', 'work', 'import', 'review']);
      assert.deepEqual(state, before);
    }
    assert.equal(calls.length, 5);
  }
});

test('Click-time guards preserve newly busy work or a new import even before the surrounding desk refreshes', () => {
  const { $, state, calls } = setup({ work: true });
  state.busy = true; $('html').fire(); assert.equal(calls.at(-1)[0], 'report'); assert.equal(state.destination, 'wordpress');
  state.busy = false; state.pending = true; $('html').fire(); assert.deepEqual(calls.at(-1), ['review', false]);
  state.pending = false; state.work = false; const count = calls.length; $('html').fire(); assert.equal(calls.length, count);
  assert.equal(state.destination, 'wordpress'); assert.equal(state.approved, true);
});

test('Edit and Save options call only their explicit callbacks, with read-only saving options available during pending import', () => {
  const { $, doc, state, calls } = setup({ work: true }); const before = structuredClone(state);
  $('workspace-edit-current').fire(); assert.deepEqual(calls, [['edit']]); assert.equal(doc.activeElement, $('body'));
  assert.deepEqual(state, before);
  state.pending = true; const pending = structuredClone(state);
  $('workspace-save-current').fire(); assert.deepEqual(calls.at(-1), ['save']); assert.deepEqual(state, pending);
  assert.equal(state.recoveryConsent, false);
});

test('Focus follows a disappearing navigation control but background refreshes never move the article cursor', () => {
  for (const id of ['html', 'workspace-edit-current', 'workspace-save-current']) {
    const { $, doc, state, ui } = setup({ work: true }); $(id).focus();
    state.work = false; ui.update(); assert.equal(doc.activeElement, $('workspace-writing-link'));
  }
  const { $, doc, state, ui } = setup();
  $('workspace-writing-link').focus(); state.work = true; ui.update(); assert.equal(doc.activeElement, $('workspace-edit-current'));
  state.busy = true; ui.update(); assert.equal(doc.activeElement, $('summary'));
  $('body').focus(); state.busy = false; state.work = false; ui.update(); ui.update();
  assert.equal(doc.activeElement, $('body')); assert.deepEqual(state.selection, [5, 11]);
});

test('Enter activates focus-moving actions on release without sending held keystrokes into the article', () => {
  const { $, doc, calls } = setup({ work: true }); const edit = $('workspace-edit-current'); edit.focus();
  assert.equal(edit.fire('keydown', { key: 'Enter' }).defaultPrevented, true);
  assert.equal(edit.fire('keydown', { key: 'Enter', repeat: true }).defaultPrevented, true);
  assert.deepEqual(calls, []); assert.equal(doc.activeElement, edit);
  assert.equal(edit.fire('keyup', { key: 'Enter' }).defaultPrevented, true);
  assert.deepEqual(calls, [['edit']]); assert.equal(doc.activeElement, $('body'));
});

test('Pages without the workspace shell keep their ordinary navigation', () => {
  assert.equal(installWorkspaceNavigation({ document: { getElementById: () => null }, hasWork: () => false }), null);
});
