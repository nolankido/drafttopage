import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createWordPressArticle, wordPressArticleText } from '../public/wordpress-export.js';
import { compareWordPressText, TRANSFER_TEXT_LIMIT } from '../public/wordpress-transfer.js';
import { installWordPressTransfer } from '../public/wordpress-transfer-controls.js';
import { createWorkspaceBackup } from '../public/workspace.js';
import { QUICK_SAMPLE } from '../public/quick-sample.js';

const fixture = { title: 'Separate title', body: '## A heading\n\nA **bold** and *italic* [label](https://example.com/path). 日本語 😀\n\n4. Parent\n  - Child\n5. Next\n\n| Name | Value |\n| --- | --- |\n| A | `x` |\n\n> A quotation.\n\n~~~\nif (x < 2) {\n  keep();\n}\n~~~\n\n<div>literal</div>\n\n\\*escaped\\*', excerpt: 'PRIVATE EXCERPT', description: 'PRIVATE DESCRIPTION', slug: 'private-slug', questions: ['PRIVATE QUESTION'], source: { notes: 'PRIVATE SOURCE' } };
const normalized = text => text.replace(/\s+/gu, ' ').trim();

test('Expected transfer text matches independently parsed real block exports across supported and literal structures', () => {
  const drafts = [fixture, QUICK_SAMPLE, { body: '![Alt](https://example.com/a.jpg)\n\nA & B.\nSoft\nbreak.\n\n`<tag>`' }, { body: '- [x] task\n\n~~literal~~\n\n[bad](/relative)\n\n| malformed | table |\n| --- | --- |\n| unequal |' }];
  const pairs = [];
  for (const draft of drafts) for (const options of [{ includeLinkedImages: false }, { includeLinkedImages: true }]) pairs.push({ html: createWordPressArticle(draft, options).html, text: normalized(wordPressArticleText(draft, options).text) });
  const parsed = JSON.parse(execFileSync('python3', ['-c', `
import json,sys,re
from html.parser import HTMLParser
class Text(HTMLParser):
 def __init__(self): super().__init__(convert_charrefs=True); self.parts=[]
 def handle_starttag(self,tag,attrs):
  if tag in ['p','h2','h3','h4','h5','h6','li','th','td','pre','blockquote','br']: self.parts.append(' ')
 def handle_endtag(self,tag):
  if tag in ['p','h2','h3','h4','h5','h6','li','th','td','pre','blockquote']: self.parts.append(' ')
 def handle_data(self,data): self.parts.append(data)
out=[]
for row in json.load(sys.stdin):
 parser=Text(); parser.feed(row['html']); out.append(re.sub(r'\\s+',' ',''.join(parser.parts)).strip())
print(json.dumps(out))
`], { input: JSON.stringify(pairs), encoding: 'utf8' }));
  assert.deepEqual(parsed, pairs.map(row => row.text));
  assert.doesNotMatch(wordPressArticleText(fixture).text, /PRIVATE|Separate title|https:\/\/example.com\/path|4\. Parent/);
  assert.match(wordPressArticleText(fixture).text, /<div>literal<\/div>/);
});

test('Comparison ignores whitespace only, preserves punctuation and case, and does not certify code indentation', () => {
  const expected = wordPressArticleText(fixture).text;
  const result = compareWordPressText(fixture, '\t' + expected.replace(/\s+/gu, '\r\n\t\u00a0') + '\n');
  assert.equal(result.matches, true); assert.equal(result.firstDifference, null); assert.equal(result.expectedExcerpt, '');
  assert.equal(compareWordPressText({ body: '~~~\n  code();\n~~~' }, 'code();').matches, true);
  for (const changed of [expected.replace('heading', 'Heading'), expected.replace('quotation.', 'quotation!'), expected.replace('bold', 'bold EXTRA'), expected.replace('Child', ''), expected + '\nRepeated ending.', 'A heading\n' + expected]) assert.equal(compareWordPressText(fixture, changed).matches, false);
});

test('Beginning, middle and ending differences are reported without claiming which version is correct', () => {
  for (const [received, position] of [['Xabc def', 1], ['abc Xdef', 5], ['abc de', 7], ['abc def!', 8]]) {
    const result = compareWordPressText({ body: 'abc def' }, received);
    assert.equal(result.matches, false); assert.equal(result.firstDifference, position);
    assert.equal(result.expectedCharacters, 7); assert.equal(result.receivedCharacters, Array.from(received).length);
  }
});

test('Unicode character positions and bounded excerpts do not split surrogate pairs', () => {
  const prefix = '日本語😀'.repeat(30), result = compareWordPressText({ body: prefix + ' ending' }, prefix + ' changed');
  assert.equal(result.firstDifference, 122); assert.ok(result.expectedExcerpt.startsWith('…')); assert.ok(result.expectedExcerpt.length < 250);
  assert.equal(result.expectedCharacters, 127); assert.equal(result.receivedCharacters, 128);
  assert.doesNotMatch(result.expectedExcerpt, /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u);
});

test('Input and article bounds reject in full and leave caller data unchanged', () => {
  const before = JSON.stringify(fixture);
  for (const received of [null, '', ' \n\t', 'x\u0000y', 'x'.repeat(TRANSFER_TEXT_LIMIT + 1)]) assert.throws(() => compareWordPressText(fixture, received));
  assert.equal(compareWordPressText({ body: 'x' }, 'x'.repeat(TRANSFER_TEXT_LIMIT)).receivedCharacters, TRANSFER_TEXT_LIMIT);
  for (const draft of [{ body: '' }, { body: 'x'.repeat(60001) }, { body: 'x\0y' }]) assert.throws(() => compareWordPressText(draft, 'writing'));
  assert.throws(() => compareWordPressText(fixture, 'writing', { includeLinkedImages: 'yes' }));
  assert.equal(JSON.stringify(fixture), before);
});

test('Image-only exports cannot pass an empty text comparison and image omissions are explicit', () => {
  const image = '![Alt](https://example.com/a.jpg)';
  assert.throws(() => compareWordPressText({ body: image }, 'Alt', { includeLinkedImages: true }), /no exported body text/);
  assert.equal(compareWordPressText({ body: image }, image).matches, true);
  const result = compareWordPressText({ body: image + '\n\nBody.' }, 'Body.', { includeLinkedImages: true });
  assert.equal(result.matches, true); assert.equal(result.imageCount, 1);
  assert.equal(compareWordPressText({ body: image + '\n\nBody.' }, 'Alt Body.', { includeLinkedImages: true }).matches, false);
});

test('Near-limit malformed-link writing is compared through its complete ending', () => {
  const body = '[x]('.repeat(14985) + '\n\nFinal ending 日本語 😀';
  const expected = wordPressArticleText({ body }).text;
  assert.equal(compareWordPressText({ body }, expected).matches, true);
  const changed = compareWordPressText({ body }, expected.replace('Final ending', 'Final omission'));
  assert.equal(changed.matches, false); assert.match(changed.expectedExcerpt, /Final ending/);
});

class Control {
  constructor() { this.value = ''; this.open = false; this.hidden = false; this.disabled = false; this.textContent = ''; this.events = new Map(); this.selectionStart = 0; this.selectionEnd = 0; }
  addEventListener(type, action) { const actions = this.events.get(type) || []; actions.push(action); this.events.set(type, actions); }
  fire(type = 'click', event = {}) { for (const action of this.events.get(type) || []) action(event); }
  focus() { this.focused = true; }
}
async function withControls(run) {
  const before = globalThis.document, nodes = new Map(), $ = id => { if (!nodes.has(id)) nodes.set(id, new Control()); return nodes.get(id); };
  let draft = structuredClone(fixture), images = false, busy = false;
  const messages = [];
  globalThis.document = { getElementById: $ }; $('publishing-destination').value = 'wordpress';
  const ui = installWordPressTransfer({ getDraft: () => draft, getWordPressOptions: () => ({ includeLinkedImages: images }), report: text => messages.push(text), isBusy: () => busy });
  const open = () => { $('wordpress-transfer-panel').open = true; $('wordpress-transfer-panel').fire('toggle'); };
  const fill = text => { $('wordpress-transfer-input').value = text; $('wordpress-transfer-input').fire('input'); };
  const compare = () => $('compare-wordpress-text').fire();
  try { await run({ $, ui, messages, open, fill, compare, draft: () => draft, edit: value => { draft = { ...draft, ...value }; ui.update(); }, images: value => { images = value; ui.update(); }, busy: value => { busy = value; ui.update(); } }); }
  finally { globalThis.document = before; }
}

test('Explicit comparison shows local feedback and inert excerpts without changing writing or approval', () => withControls(async ({ $, open, fill, compare, draft, messages }) => {
  const before = JSON.stringify(draft()); $('reviewed').checked = false; open(); fill(wordPressArticleText(draft()).text); compare();
  assert.match($('wordpress-transfer-status').textContent, /^Text matches.*whitespace/); assert.equal($('wordpress-transfer-status').textContent, messages.at(-1));
  assert.equal($('reviewed').checked, false); assert.equal(JSON.stringify(draft()), before); assert.equal($('wordpress-transfer-difference').hidden, true);
  fill('Hostile <script>inert()</script>'); compare(); assert.equal($('wordpress-transfer-difference').hidden, false); assert.match($('wordpress-transfer-received-excerpt').textContent, /<script>inert/);
  assert.match($('wordpress-transfer-status').textContent, /only the text you supplied.*Nothing was changed or published/);
}));

test('A result is invalidated on returned-text/body/image edits; excluded title and private fields keep the comparison valid', () => withControls(async ({ $, open, fill, compare, draft, edit, images }) => {
  open(); fill(wordPressArticleText(draft()).text); compare();
  edit({ title: 'Another title', source: { notes: 'Another private note' } }); assert.match($('wordpress-transfer-status').textContent, /^Text matches/);
  edit({ body: 'Changed article.' }); assert.match($('wordpress-transfer-status').textContent, /changed.*Compare again/); assert.equal($('wordpress-transfer-inspection').hidden, true); assert.notEqual($('wordpress-transfer-input').value, '');
  compare(); assert.match($('wordpress-transfer-status').textContent, /^Text differs/);
  images(true); assert.match($('wordpress-transfer-status').textContent, /changed.*Compare again/);
  fill('Changed article.'); assert.equal($('wordpress-transfer-status').textContent, ''); assert.equal($('wordpress-transfer-difference').hidden, true);
}));

test('Exact expected text is optional and purged on closing inspection, panel closing, reset and destination changes', () => withControls(async ({ $, ui, open, fill, compare, draft }) => {
  const prepare = () => { open(); fill(wordPressArticleText(draft()).text); compare(); $('wordpress-transfer-inspection').open = true; $('wordpress-transfer-inspection').fire('toggle'); assert.equal($('wordpress-transfer-expected').value, wordPressArticleText(draft()).text); };
  prepare(); $('wordpress-transfer-inspection').open = false; $('wordpress-transfer-inspection').fire('toggle'); assert.equal($('wordpress-transfer-expected').value, '');
  for (const finish of [() => { $('wordpress-transfer-panel').open = false; $('wordpress-transfer-panel').fire('toggle'); }, () => ui.reset(), () => { $('publishing-destination').value = 'html'; ui.update(); }]) {
    $('publishing-destination').value = 'wordpress'; prepare(); finish();
    for (const id of ['wordpress-transfer-input', 'wordpress-transfer-expected']) assert.equal($(id).value, '');
    assert.equal($('wordpress-transfer-status').textContent, ''); assert.equal($('wordpress-transfer-difference').hidden, true); assert.equal($('wordpress-transfer-expected-excerpt').textContent, '');
  }
}));

test('Invalidating a comparison replaces the global match announcement once, including on input, close and destination changes', () => withControls(async ({ $, ui, open, fill, compare, draft, edit, messages }) => {
  const prepare = () => { $('publishing-destination').value = 'wordpress'; open(); fill(wordPressArticleText(draft()).text); compare(); assert.match(messages.at(-1), /^Text matches/); };
  prepare(); edit({ body: 'Changed body.' }); assert.match(messages.at(-1), /changed.*Compare again/);
  const after = messages.length; edit({ body: 'Changed body again.' }); assert.equal(messages.length, after);
  prepare(); fill('Changed supplied text.'); assert.match(messages.at(-1), /^Comparison text changed/);
  prepare(); $('wordpress-transfer-panel').open = false; $('wordpress-transfer-panel').fire('toggle'); assert.match(messages.at(-1), /panel closed.*cleared/);
  prepare(); $('publishing-destination').value = 'html'; ui.update(); assert.match(messages.at(-1), /cleared after changing destination/);
}));

test('Busy or hidden controls cannot compare or clear writing and release without losing supplied text', () => withControls(async ({ $, open, fill, compare, draft, busy, ui, messages }) => {
  open(); fill(wordPressArticleText(draft()).text); busy(true); const count = messages.length;
  compare(); $('clear-wordpress-text').fire(); assert.equal(messages.length, count); assert.notEqual($('wordpress-transfer-input').value, ''); assert.equal($('wordpress-transfer-controls').disabled, true);
  busy(false); assert.equal($('compare-wordpress-text').disabled, false); compare(); assert.match(messages.at(-1), /^Text matches/);
  $('clear-wordpress-text').fire(); assert.equal($('wordpress-transfer-input').value, ''); assert.equal($('wordpress-transfer-input').focused, true); assert.equal($('compare-wordpress-text').disabled, true);
  $('publishing-destination').value = 'other'; ui.update(); const after = messages.length; compare(); assert.equal(messages.length, after);
}));

test('Oversized paste is rejected whole and invalidates an earlier match while preserving existing supplied text', () => withControls(async ({ $, open, fill, compare, draft }) => {
  open(); const text = wordPressArticleText(draft()).text; fill(text); compare(); let rejected = false;
  $('wordpress-transfer-input').fire('paste', { preventDefault: () => { rejected = true; }, clipboardData: { getData: () => 'x'.repeat(TRANSFER_TEXT_LIMIT + 1) } });
  assert.equal(rejected, true); assert.equal($('wordpress-transfer-input').value, text); assert.match($('wordpress-transfer-status').textContent, /120,000.*Current text is unchanged/); assert.doesNotMatch($('wordpress-transfer-status').textContent, /^Text matches/); assert.equal($('wordpress-transfer-inspection').hidden, true);
}));

test('Supplied comparison text is excluded from the existing private backup format', () => withControls(async ({ open, fill, draft }) => {
  open(); fill('RETURNED_TEXT_ONLY_SENTINEL');
  const { source, ...article } = draft();
  const backup = createWorkspaceBackup({ profile: 'personal', notes: 'Own notes', audience: '', purpose: '' }, article);
  assert.doesNotMatch(backup, /RETURNED_TEXT_ONLY_SENTINEL/);
}));

test('All public workspaces provide closed, labelled comparison controls with hidden initial results', async () => {
  for (const route of ['write', 'word-to-wordpress', 'google-docs-to-wordpress', 'markdown-to-wordpress', 'markdown-to-html', 'markdown-to-word']) {
    const html = await readFile('public/' + route + '/index.html', 'utf8');
    assert.match(html, /<details id="wordpress-transfer-panel">/); assert.match(html, /<div id="wordpress-transfer-difference" hidden>/); assert.match(html, /<details id="wordpress-transfer-inspection" hidden>/);
    assert.match(html, /id="wordpress-transfer-expected"[^>]*readonly/); assert.match(html, /id="wordpress-transfer-status"[^>]*aria-live="off"/);
    assert.match(html, /comparison.*excluded from backups and exports/i); assert.doesNotMatch(html, /id="wordpress-transfer-input"[^>]*maxlength/);
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]); assert.equal(new Set(ids).size, ids.length);
  }
});
