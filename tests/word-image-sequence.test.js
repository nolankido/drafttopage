import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { nextWordImageMatch } from '../public/word-image-match.js';
import { imageEditTarget } from '../public/image-editing.js';
import { installWordImageMap } from '../public/word-image-map-controls.js';
import { installImageEditor } from '../public/image-editor-controls.js';

const entry = (n, file = 'word-image-001.png') => ({
  placeholder: '[Word image ' + n + ']', filename: file,
  alt: 'Fictional original alt for ' + n, altTruncated: false, note: 'Original.'
});
function fixture(numbers = [1, 2]) {
  const placements = numbers.map(n => entry(n));
  return {
    format: 'drafttopage-word-images-v1',
    placementScope: 'This selected fictional import before later edits or insertion.',
    images: [{ name: 'word-image-001.png', bytes: 81, width: 2, height: 3,
      placeholders: placements.map(item => item.placeholder) }],
    placements
  };
}

test('Next match follows current article order, and moves to the next after replacement', () => {
  const map = fixture([1, 2]);
  const body = 'Before \\[Word image 2\\] after.\n\n[Word image 1]';
  const first = nextWordImageMatch(body, map.placements);
  assert.equal(first.placeholder, '[Word image 2]');
  assert.equal(first.line, 1);
  assert.equal(body.slice(first.start, first.end), '\\[Word image 2\\]');
  assert.equal(first.filename, 'word-image-001.png');
  const changed = body.slice(0, first.start) + 'Image already replaced' + body.slice(first.end);
  assert.equal(nextWordImageMatch(changed, map.placements).placeholder, '[Word image 1]');
  assert.equal(nextWordImageMatch(changed.replace('[Word image 1]', 'Done.'), map.placements), null);
});

test('Repeated image numbers, missing files, unknown maps, and unrelated placeholders never autopin', () => {
  const map = fixture([1, 2]);
  assert.equal(nextWordImageMatch('[Word image 1]\n\n\\[Word image 1\\]', map.placements), null);
  assert.equal(nextWordImageMatch('[Word image 3]', map.placements), null);
  assert.equal(nextWordImageMatch('[Word image 1]', [{ ...entry(1), filename: '' }]), null);
  assert.equal(nextWordImageMatch('[Word image 1]', [entry(1), entry(1)]), null);
  assert.equal(nextWordImageMatch(null, map.placements), null);
  assert.equal(nextWordImageMatch('a'.repeat(60001) + '[Word image 1]', map.placements), null);
  assert.equal(nextWordImageMatch('[Word image 1]', []), null);
});

test('Protected Markdown locations do not become candidates, but later safe text can be selected', () => {
  const placements = [entry(1), entry(2), entry(3), entry(4), entry(5)];
  const body = [
    '## [Word image 1]', '- [Word image 2]', '> [Word image 3]',
    '~~~', '[Word image 4]', '~~~', '',
    '日本語 😀 [Word image 5] follows.'
  ].join('\n');
  const match = nextWordImageMatch(body, placements);
  assert.equal(match.placeholder, '[Word image 5]');
  assert.equal(imageEditTarget(body, match.start, match.end).before, '[Word image 5]');
});

test('The guided map action can reach a safe item past the first 40 dropdown choices', () => {
  const body = Array.from({ length: 50 }, (_, i) => '[Word image ' + (i + 1) + ']').join('\n\n');
  const placements = Array.from({ length: 50 }, (_, i) => entry(i + 1, i === 49 ? 'word-image-001.png' : ''));
  const match = nextWordImageMatch(body, placements);
  assert.equal(match.placeholder, '[Word image 50]');
  assert.equal(match.line, 99);
});

class Control {
  constructor() {
    this.value = ''; this.checked = false; this.disabled = false; this.hidden = false;
    this.open = false; this.children = []; this.events = new Map(); this.selectionStart = 0; this.selectionEnd = 0;
    this.textContent = '';
  }
  addEventListener(type, listener) {
    if (!this.events.has(type)) this.events.set(type, []);
    this.events.get(type).push(listener);
  }
  async fire(type, event = {}) {
    for (const listener of this.events.get(type) || []) await listener(event);
  }
  replaceChildren(...nodes) {
    this.children = nodes; this.value = nodes[0]?.value || '';
  }
  focus() { this.focused = true; }
  setSelectionRange(start, end) { this.selectionStart = start; this.selectionEnd = end; }
  setAttribute() {}
}

async function withDocument(callback) {
  const previous = globalThis.document, nodes = new Map();
  const $ = id => {
    if (!nodes.has(id)) nodes.set(id, new Control());
    return nodes.get(id);
  };
  globalThis.document = { getElementById: $, createElement: () => new Control() };
  try { await callback($); } finally { globalThis.document = previous; }
}

async function loadMap($, value = fixture()) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  $('image-map-file').files = [{ size: bytes.length, arrayBuffer: async () => bytes.buffer }];
  await $('image-map-file').fire('change');
}

test('Map button pins only a distinct current occurrence and clears prior comparison', async () => {
  await withDocument(async $ => {
    let body = '[Word image 1]\n\n[Word image 2]', current = null, busy = false, reject = false;
    const pinned = [], reused = [];
    const ui = installWordImageMap({
      getTarget: () => current, getBody: () => body, isBusy: () => busy, workChanged: () => {},
      pinMatch: match => {
        if (reject) return false;
        current = imageEditTarget(body, match.start, match.end); pinned.push(match); return true;
      },
      useAlt: alt => { reused.push(alt); return true; }
    });
    assert.equal($('image-map-next').disabled, true);
    await loadMap($);
    assert.equal($('image-map-next').disabled, false);
    reject = true;
    await $('image-map-next').fire('click');
    assert.equal(current, null);
    assert.equal($('image-map-entry').value, '[Word image 1]');
    reject = false;
    await $('image-map-next').fire('click');
    assert.equal(current.before, '[Word image 1]');
    assert.equal($('image-map-entry').value, '[Word image 1]');
    assert.equal($('image-map-confirm').checked, false);
    assert.equal(reused.length, 0);
    assert.match($('image-map-status').textContent, /No image URL, alt text, or article change/);
    body = body.replace('[Word image 1]', 'Already handled.');
    ui.refresh();
    await $('image-map-next').fire('click');
    assert.equal(current.before, '[Word image 2]');
    assert.equal(pinned.length, 2);
    body += '\n\n[Word image 2]';
    ui.refresh();
    assert.equal($('image-map-next').disabled, true);
    busy = true; ui.refresh();
    assert.equal($('image-map-next').disabled, true);
    ui.clear();
    assert.equal($('image-map-next').disabled, true);
    assert.equal($('image-map-review').hidden, true);
  });
});

test('Integrated guided selection never carries a pending URL, alternative text, or approval to another image', async () => {
  await withDocument(async $ => {
    $('body').value = '[Word image 1]\n\n[Word image 2]';
    let approval = true, imageConsent = true, changeCount = 0, allowed = false, prompted = 0, applies = 0;
    let ui;
    ui = installImageEditor({
      getBody: () => $('body').value, isBusy: () => false,
      workChanged: () => { changeCount++; }, report: () => {},
      confirmAction: () => { prompted++; return allowed; }, reveal: () => {},
      apply: plan => {
        $('body').value = plan.body; approval = false; imageConsent = false; applies++;
        ui.refresh();
      }
    });
    await loadMap($);
    assert.equal($('image-map-next').disabled, false);
    $('image-url').value = 'https://example.com/pending.jpg';
    await $('image-url').fire('input');
    $('image-alt').value = 'Pending for a different image';
    await $('image-alt').fire('input');
    const initial = $('body').value;
    await $('image-map-next').fire('click');
    assert.equal(prompted, 1);
    assert.equal($('image-url').value, 'https://example.com/pending.jpg');
    assert.equal($('image-alt').value, 'Pending for a different image');
    assert.equal($('body').value, initial);
    allowed = true;
    await $('image-map-next').fire('click');
    assert.equal(prompted, 2);
    assert.equal($('image-url').value, '');
    assert.equal($('image-alt').value, '');
    assert.equal($('image-decorative').checked, false);
    assert.equal($('image-map-confirm').checked, false);
    assert.equal($('image-map-use-alt').disabled, true);
    assert.equal($('body').value, initial);
    assert.equal(approval, true); assert.equal(imageConsent, true);
    $('image-map-confirm').checked = true;
    await $('image-map-confirm').fire('change');
    await $('image-map-use-alt').fire('click');
    assert.equal($('image-alt').value, 'Fictional original alt for 1');
    assert.equal($('image-url').value, '');
    $('image-url').value = 'https://example.com/one.jpg';
    await $('image-url').fire('input');
    await $('image-preview').fire('click');
    assert.equal($('image-apply').disabled, false);
    assert.equal(applies, 0); assert.equal(approval, true);
    await $('image-apply').fire('click');
    assert.equal(applies, 1);
    assert.equal(approval, false); assert.equal(imageConsent, false);
    assert.match($('body').value, /!\[Fictional original alt for 1\]\(https:\/\/example.com\/one.jpg\)/);
    assert.equal($('image-map-next').disabled, false);
    await $('image-map-next').fire('click');
    assert.equal($('image-map-entry').value, '[Word image 2]');
    assert.equal($('image-url').value, '');
    assert.equal($('image-alt').value, '');
    assert.ok(changeCount > 0);
  });
});

test('All guide surfaces expose the optional shortcut but retain manual and privacy safeguards', async () => {
  const html = await readFile(new URL('../scripts/image-editor.html.inc', import.meta.url), 'utf8');
  const guide = await readFile(new URL('../scripts/publishing-handoff-help.html.inc', import.meta.url), 'utf8');
  assert.match(html, /id="image-map-next"/);
  assert.match(html, /aria-describedby="image-map-next-help"/);
  assert.match(html, /Repeated labels and protected sections require manual selection/);
  assert.match(guide, /Find next matching Word image/);
  const controller = await readFile(new URL('../public/image-editor-controls.js', import.meta.url), 'utf8');
  assert.match(controller, /Discard pending image URL and alternative text/);
  assert.doesNotMatch(controller, /localStorage|sessionStorage|XMLHttpRequest/);
});
