import test from 'node:test';
import assert from 'node:assert/strict';
import { routeFormattedPaste } from '../public/formatted-paste.js';
import { installPasteGuard } from '../public/paste-guard.js';
import { ARTICLE_BODY_LIMIT, MAX_IMPORT_BYTES } from '../public/writing-limits.js';

function pasteEvent(clipboardData, options = {}) {
  const event = new Event('paste', { cancelable: true });
  Object.assign(event, { clipboardData }, options);
  return event;
}
function clipboard(html, plain = '') {
  const reads = [];
  return { reads, getData(type) { reads.push(type); return type === 'text/html' ? html : type === 'text/plain' ? plain : ''; } };
}
function setup({ allowed = true, preview } = {}) {
  const messages = [], received = [], state = { article: 'Keep this article and its ending.', previous: 'Earlier preview' };
  const options = { canPreview: () => allowed, report: message => messages.push(message), preview: source => {
    received.push(source);
    return preview ? preview(source, state) : true;
  } };
  return { options, state, messages, received, route: event => routeFormattedPaste(event, options) };
}

test('HTML and plain clipboard variants route only HTML to a staged preview', () => {
  const x = setup(), data = clipboard('<h2>Heading</h2><p><strong>Writing</strong> and its ending.</p>', 'Heading\nWriting and its ending.');
  const event = pasteEvent(data), before = { ...x.state };
  assert.equal(x.route(event), true);
  assert.equal(event.defaultPrevented, true);
  assert.deepEqual(data.reads, ['text/html']);
  assert.deepEqual(x.received, [{ format: 'html', text: '<h2>Heading</h2><p><strong>Writing</strong> and its ending.</p>' }]);
  assert.deepEqual(x.state, before);
});

test('Plain-only clipboard remains native, including intentional Markdown punctuation', () => {
  for (const plain of ['A plain sentence.', '## Authored Markdown\n\n**Keep these marks**', '']) {
    const x = setup(), event = pasteEvent(clipboard('', plain));
    assert.equal(x.route(event), false);
    assert.equal(event.defaultPrevented, false);
    assert.deepEqual(x.received, []);
    assert.deepEqual(x.messages, []);
  }
});

test('Missing clipboard is left to the established plain-text guard', () => {
  for (const unavailable of [null, undefined, {}]) {
    const x = setup(), event = pasteEvent(unavailable);
    assert.equal(x.route(event), false);
    assert.equal(event.defaultPrevented, false);
    assert.deepEqual(x.received, []);
  }
});

test('An unreadable clipboard is blocked without echoing its exception', () => {
  const x = setup(), before = { ...x.state }, event = pasteEvent({ getData() { throw new Error('PRIVATE CLIPBOARD DETAIL'); } });
  assert.equal(x.route(event), true);
  assert.equal(event.defaultPrevented, true);
  assert.deepEqual(x.state, before);
  assert.deepEqual(x.received, []);
  assert.match(x.messages[0], /could not be read/);
  assert.doesNotMatch(x.messages.join(' '), /PRIVATE CLIPBOARD DETAIL/);
});

test('Malformed clipboard values cannot become a plain paste or replace preparation', () => {
  for (const html of [null, undefined, {}, 4, ' \n\t ']) {
    const x = setup(), before = { ...x.state }, event = pasteEvent(clipboard(html, 'Do not insert this fallback.'));
    assert.equal(x.route(event), true);
    assert.equal(event.defaultPrevented, true);
    assert.deepEqual(x.state, before);
    assert.deepEqual(x.received, []);
    assert.match(x.messages[0], /readable formatted selection/);
  }
});

test('HTML source bounds use UTF-8 bytes and do not fall back to plain text', () => {
  for (const html of ['x'.repeat(MAX_IMPORT_BYTES + 1), 'é'.repeat(MAX_IMPORT_BYTES / 2 + 1), '😀'.repeat(MAX_IMPORT_BYTES / 4 + 1)]) {
    const x = setup(), before = { ...x.state }, event = pasteEvent(clipboard(html, 'Short fallback'));
    assert.equal(x.route(event), true);
    assert.equal(event.defaultPrevented, true);
    assert.deepEqual(x.state, before);
    assert.deepEqual(x.received, []);
    assert.match(x.messages[0], /exceeds 512 KiB/);
  }
  const x = setup();
  assert.equal(x.route(pasteEvent(clipboard('é'.repeat(MAX_IMPORT_BYTES / 2)))), true);
  assert.equal(x.received.length, 1, 'An exact-bound source still reaches the shared parser for article limits.');
});

test('A pending import or file operation keeps both the article and existing preview', () => {
  const x = setup({ allowed: false }), before = { ...x.state }, event = pasteEvent(clipboard('<p>A replacement</p>', 'A replacement'));
  assert.equal(x.route(event), true);
  assert.equal(event.defaultPrevented, true);
  assert.deepEqual(x.state, before);
  assert.deepEqual(x.received, []);
  assert.match(x.messages[0], /Finish or clear the current import/);
});

test('Shared-parser rejection never inserts fallback text or exposes thrown source details', () => {
  const x = setup({ preview() { throw new Error('PRIVATE INVALID SOURCE'); } }), before = { ...x.state };
  const event = pasteEvent(clipboard('<table><tr><td colspan="2">Needs review</td></tr></table>', 'Needs review'));
  assert.equal(x.route(event), true);
  assert.equal(event.defaultPrevented, true);
  assert.deepEqual(x.state, before);
  assert.match(x.messages[0], /could not be previewed/);
  assert.doesNotMatch(x.messages.join(' '), /PRIVATE INVALID SOURCE/);
});

test('Importer-owned failure messaging is not overwritten when preview returns false', () => {
  const x = setup({ preview() { x.messages.push('The first table needs an explicit header choice.'); return false; } });
  assert.equal(x.route(pasteEvent(clipboard('<p>Writing</p>'))), true);
  assert.deepEqual(x.messages, ['The first table needs an explicit header choice.']);
});

test('The router does not parse, insert or fetch imported markup', () => {
  const html = '<script>throw Error("Never execute")</script><img src="https://example.invalid/pixel"><p>Writing</p>';
  const x = setup();
  x.route(pasteEvent(clipboard(html)));
  assert.equal(x.received[0].text, html, 'Opaque source goes to the existing bounded, detached importer.');
  assert.equal(x.state.article, 'Keep this article and its ending.');
});

test('An already handled paste is not read or staged a second time', () => {
  const data = clipboard('<p>Writing</p>'), x = setup(), event = pasteEvent(data);
  event.preventDefault();
  assert.equal(x.route(event), true);
  assert.deepEqual(data.reads, []);
  assert.deepEqual(x.received, []);
});

function guardedSetup() {
  const element = new EventTarget();
  Object.assign(element, { value: 'Keep this article and its ending.', selectionStart: 5, selectionEnd: 5 });
  const x = setup(), guardMessages = [];
  installPasteGuard({ element, limit: ARTICLE_BODY_LIMIT, label: 'The article', skipPaste: event => x.route(event), report: message => guardMessages.push(message) });
  return { ...x, element, guardMessages, fire: event => { element.dispatchEvent(event); return event; } };
}

test('Routing inside the established guard preserves native plain paste and its one-use mobile permit', () => {
  const x = guardedSetup(), event = x.fire(pasteEvent(clipboard('', '**Native Markdown**')));
  assert.equal(event.defaultPrevented, false);
  assert.deepEqual(x.received, []);
  const next = new Event('beforeinput', { cancelable: true });
  Object.assign(next, { inputType: 'insertFromPaste', dataTransfer: null, data: null });
  x.fire(next);
  assert.equal(next.defaultPrevented, false);
  assert.equal(x.element.value, 'Keep this article and its ending.', 'Only the browser, not these guards, performs accepted native edits.');
});

test('A consumed formatted paste invalidates any earlier native permit and blocks a data-less follow-up', () => {
  const x = guardedSetup();
  x.fire(pasteEvent(clipboard('', 'Previously checked text')));
  const event = x.fire(pasteEvent(clipboard('<p>New formatted selection</p>', 'New formatted selection')));
  assert.equal(event.defaultPrevented, true);
  assert.equal(x.received.length, 1);
  const next = new Event('beforeinput', { cancelable: true });
  Object.assign(next, { inputType: 'insertFromPaste', dataTransfer: null, data: null });
  x.fire(next);
  assert.equal(next.defaultPrevented, true);
  assert.equal(x.element.value, 'Keep this article and its ending.');
});

test('The existing guard still rejects oversized plain text and unavailable payloads', () => {
  const x = guardedSetup();
  for (const data of [clipboard('', 'x'.repeat(ARTICLE_BODY_LIMIT + 1)), null]) {
    assert.equal(x.fire(pasteEvent(data)).defaultPrevented, true);
  }
  assert.deepEqual(x.received, []);
  assert.equal(x.element.value, 'Keep this article and its ending.');
  assert.ok(x.guardMessages.some(message => /60,000/.test(message)));
});
