import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { htmlTreeToMarkdown, parseHTMLArticle } from '../public/html-import.js';
import { parseArticleImport } from '../public/article-import.js';
import { inlineTokens, decodeMarkdownEscapes } from '../public/markdown-inline.js';
import { inlineParts, previewBlocks } from '../public/preview.js';
import { createHTMLSource } from '../public/html-export.js';
import { wordDocumentParts } from '../public/word-export.js';
import { createWordPressArticle } from '../public/wordpress-export.js';
import { installArticleImport } from '../public/import-controls.js';
import { copiedWritingSource, parseCopiedWriting } from '../public/copied-writing.js';
import { HTML_SOURCE_SAMPLE } from '../public/html-source-sample.js';
import { MAX_IMPORT_BYTES } from '../public/writing-limits.js';

const text = value => ({ nodeType: 3, nodeValue: value, childNodes: [] });
function element(name, nodes = [], attributes = {}) {
  return { nodeType: 1, localName: name, childNodes: nodes.map(n => typeof n === 'string' ? text(n) : n), getAttribute: key => Object.hasOwn(attributes, key) ? attributes[key] : null, hasAttribute: key => Object.hasOwn(attributes, key) };
}
const tree = (...nodes) => ({ nodeType: 11, childNodes: nodes });
const convert = (...nodes) => htmlTreeToMarkdown(tree(...nodes));
const output = (...nodes) => createHTMLSource({ body: convert(...nodes).markdown });

test('HTML thematic breaks survive import, including at the start of an article', () => {
  const result = convert(element('hr', [], { onclick: 'bad()', style: 'color:red' }), element('p', ['Ending.']));
  assert.equal(result.markdown, '***\n\nEnding\\.');
  const imported = parseArticleImport(result.markdown);
  assert.match(createHTMLSource(imported.draft), /^<hr>\n<p>Ending\.<\/p>/);
  assert.doesNotMatch(result.markdown, /onclick|bad|color/);
});
test('Multiline HTML headings retain their level by normalizing line breaks with a notice', () => {
  const result = convert(element('h2', ['First', element('br'), 'second']), element('p', ['Ending.']));
  assert.match(result.markdown, /^## First second\n\n/);
  assert.match(result.warnings.join(' '), /Line breaks in a heading became spaces/);
  assert.match(createHTMLSource({ body: result.markdown }), /^<h2>First second<\/h2>/);
});

test('Document wrappers preserve headings, paragraphs, span emphasis, and line breaks', () => {
  const root = element('b', [element('h1', ['A fictional title']), element('p', ['One ', element('span', ['important'], { style: 'font-weight:700' }), ' and ', element('span', ['quiet'], { style: 'font-style:italic' }), '.', element('br'), 'Next line.'])], { style: 'font-weight:normal', id: 'docs-internal-guid-example' });
  const result = convert(root);
  assert.equal(result.markdown, '# A fictional title\n\nOne **important** and *quiet*\\.\nNext line\\.');
  assert.match(output(root), /<strong>important<\/strong> and <em>quiet<\/em>\.<br>Next line\./);
});
test('Explicit normal-weight span inside bold text stays normal while surrounding text remains bold', () => {
  const result = convert(element('p', [element('strong', ['bold ', element('span', ['normal'], { style: 'font-weight:400' }), ' bold again'])]));
  const out = createHTMLSource({ body: result.markdown });
  assert.match(out, /<strong>bold<\/strong> normal <strong>bold again<\/strong>/);
  assert.equal(inlineParts(result.markdown).map(p => p.text).join(''), 'bold normal bold again');
  assert.doesNotMatch(result.markdown, /unstrong/);
});
test('Inherited and relative font weights never accidentally cancel bold ancestors', () => {
  for (const weight of ['inherit', 'unset', 'bolder', 'lighter', 'revert', 'initially-unknown']) {
    const result = convert(element('p', [element('strong', ['before ', element('span', ['inside'], { style: 'font-weight:' + weight }), ' after'])]));
    const html = createHTMLSource({ body: result.markdown });
    assert.match(html, /<strong>before inside after<\/strong>/, weight);
  }
  const retained = convert(element('div', [element('p', ['inherited'], { style: 'font-weight:inherit' })], { style: 'font-weight:bold' }));
  assert.match(createHTMLSource({ body: retained.markdown }), /<strong>inherited<\/strong>/);
});
test('Inherited bold on block container reaches child paragraphs and honors normal-weight reset', () => {
  const result = convert(element('div', [
    element('p', ['Inherited ', element('em', ['bold and italic']), '.']),
    element('p', ['Not bold.'], { style: 'font-weight:normal' }),
    element('p', ['Bold again.'])
  ], { style: 'font-weight:700' }));
  const html = createHTMLSource({ body: result.markdown });
  assert.match(html, /<strong>Inherited <em>bold and italic<\/em>\.<\/strong>/);
  assert.match(html, /<p>Not bold\.<\/p>/);
  assert.match(html, /<strong>Bold again\.<\/strong>/);
  assert.doesNotMatch(html, /<strong>Not bold/);
});
test('Copied formatting transition retains the unique article ending and safe link target', () => {
  const result = convert(element('article', [
    element('p', [element('strong', ['A ', element('span', ['regular'], { style: 'font-weight:normal' }), ' note'])]),
    element('p', [element('a', ['Fictional reference'], { href: 'https://example.com/path?q=1' })]),
    element('p', ['END_FIDELITY_20261017'])
  ]));
  const html = createHTMLSource({ body: result.markdown });
  assert.match(html, /A<\/strong> regular <strong>note<\/strong>/);
  assert.match(html, /href="https:\/\/example.com\/path\?q=1"/);
  assert.match(html, /END_FIDELITY_20261017/);
});
test('Fictional combined Google Docs-style article keeps title, list start, table values and unique ending', () => {
  const root = tree(
    element('h1', ['Fictional editorial report']),
    element('h2', ['Scope']),
    element('p', ['A ', element('strong', ['bold ', element('span', ['normal'], { style: 'font-weight:400' }), ' phrase']), ' and a ', element('a', ['source'], { href: 'https://example.com/report?q=1' }), '.']),
    element('ol', [element('li', ['First checked item', element('ul', [element('li', ['Nested note'])])]), element('li', ['Second checked item'])], { start: '4' }),
    element('table', [element('thead', [element('tr', [element('th', ['Column']), element('th', ['Value'])])]), element('tbody', [element('tr', [element('td', ['Café']), element('td', ['日本語 😀'])])])]),
    element('p', ['FIDELITY_FINAL_UNIQUE_20261017'])
  );
  const result = htmlTreeToMarkdown(root);
  const parsed = parseArticleImport(result.markdown);
  assert.equal(parsed.draft.title, 'Fictional editorial report');
  assert.match(parsed.draft.body, /4\. First checked item/);
  assert.match(parsed.draft.body, /  - Nested note/);
  assert.match(parsed.draft.body, /\| Café \| 日本語 😀 \|/);
  assert.match(parsed.draft.body, /FIDELITY\\_FINAL\\_UNIQUE\\_20261017$/);
  const published = createWordPressArticle(parsed.draft).html;
  assert.match(published, /"start":4/);
  assert.match(published, /href="https:\/\/example.com\/report\?q=1"/);
  assert.match(published, /Café/);
  assert.match(published, /FIDELITY_FINAL_UNIQUE_20261017/);
});
test('Literal ASCII punctuation stays literal in preview and both HTML publishing formats', () => {
  const literal = '# A *literal* _word_ [label](https://example.com/) ![image](url) | <script> &lt; 1. + - \\ `code`';
  const { markdown } = convert(element('p', [literal]));
  assert.equal(inlineParts(markdown).map(part => part.text).join(''), literal);
  assert.ok(inlineParts(markdown).every(part => part.type === 'text'));
  const html = createHTMLSource({ body: markdown });
  assert.doesNotMatch(html, /<script|<a |<em|<code|<h2/); assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(createWordPressArticle({ body: markdown }).html, /<script|<a |<em|<code/);
  assert.equal(decodeMarkdownEscapes('\\a \\* \\.'), '\\a * .');
});
test('Display escaping leaves inline token source offsets and code content intact', () => {
  const source = '😀 \\*literal\\* then **bold\\.** and `a\\*`';
  const tokens = inlineTokens(source);
  for (const token of tokens) assert.ok(source.slice(token.start, token.end).length);
  assert.equal(tokens.find(p => p.type === 'strong').text, 'bold\\.');
  assert.equal(inlineParts(source).find(p => p.type === 'strong').text, 'bold.');
  assert.equal(inlineParts(source).find(p => p.type === 'code').text, 'a\\*');
});
test('Only safe absolute web links survive and unusual labels have a disclosed text fallback', () => {
  const result = convert(element('p', [element('a', ['Good'], { href: 'https://example.com/a(b)' }), ' ', element('a', ['Unsafe'], { href: 'javascript:bad()' }), ' ', element('a', ['Relative'], { href: '/page' }), ' ', element('a', ['Credentials'], { href: 'https://user:pass@example.com/' }), ' ', element('a', ['[Odd]'], { href: 'https://example.com/' })]));
  assert.match(result.markdown, /\[Good\]\(https:\/\/example.com\/a%28b%29\)/);
  assert.doesNotMatch(result.markdown, /javascript|user:pass|\/page/);
  assert.ok(result.warnings.some(w => w.includes('targets were omitted')));
  assert.ok(result.warnings.some(w => w.includes('safe URL was kept')));
  assert.equal(inlineParts(result.markdown).filter(p => p.type === 'a').length, 1);
});
test('Images, scripts, embeds, and explicitly hidden content cannot reach the rendered article', () => {
  const result = convert(element('p', ['Visible ', element('img', [], { alt: 'a *literal* picture', src: 'https://example.com/x', onerror: 'bad()' }), element('script', ['SECRET SCRIPT']), element('iframe', ['SECRET EMBED']), element('span', ['SECRET HIDDEN'], { style: 'display: none !important' }), element('span', ['SECRET ARIA'], { 'aria-hidden': 'true' }), element('div', ['SECRET ATTRIBUTE'], { hidden: '' })]));
  assert.doesNotMatch(result.markdown, /SECRET|onerror|https/);
  assert.equal(inlineParts(result.markdown).map(p => p.text).join(''), 'Visible [Image: a *literal* picture]');
  assert.ok(result.warnings.some(w => w.includes('Images'))); assert.ok(result.warnings.some(w => w.includes('hidden')));
});
test('Tracked changes are rejected, while nested emphasis and escaped literal delimiters are preserved', () => {
  for (const name of ['ins', 'del']) assert.throws(() => convert(element('p', [element(name, ['Unresolved'])])), /tracked changes/);
  const result = convert(element('p', [element('strong', ['A ', element('em', ['nested']), ' word']), ' ', element('strong', ['A *literal* delimiter'])]));
  assert.doesNotMatch(result.warnings.join(' '), /Nested|delimiter/);
  assert.match(createHTMLSource({body:result.markdown}), /<strong>A <em>nested<\/em> word<\/strong> <strong>A \*literal\* delimiter<\/strong>/);
  assert.ok(inlineParts(result.markdown).map(p => p.text).join('').includes('A *literal* delimiter'));
});
test('Nested lists retain starting numbers and hierarchy in both destinations', () => {
  const root = element('ol', [element('li', ['Parent', element('ol', [element('li', ['Child']), element('li', ['Next child'])], { start: '7' })]), element('li', ['Next parent'])], { start: '4' });
  const result = convert(root);
  assert.equal(result.markdown, '4. Parent\n  7. Child\n  8. Next child\n5. Next parent');
  const html = createHTMLSource({ body: result.markdown }); assert.match(html, /<ol start="4">/); assert.match(html, /<ol start="7">/);
  assert.match(createWordPressArticle({ body: result.markdown }).html, /"start":7/);
  assert.match(output(element('ol', [element('li', ['Zero'])], { start: '0' })), /start="0"/);
});
test('Unsupported list shapes and list bounds reject before conversion is applied', () => {
  for (const attributes of [{ reversed: '' }, { type: 'a' }, { start: '-1' }, { start: '1000000000' }]) assert.throws(() => convert(element('ol', [element('li', ['Keep'])], attributes)));
  assert.throws(() => convert(element('ul', [element('li', ['Text', element('ul', [element('li', ['Child'])]), 'AFTER'])])), /after a nested list/);
  assert.throws(() => convert(element('ul', [element('li', ['Text', element('div', [element('span', [element('ul', [element('li', ['Child'])])])])])])), /Wrapped/);
  assert.throws(() => convert(element('ol', [element('li', ['Keep'], { value: '7' })])), /Per-item/);
  assert.throws(() => convert(element('ul', Array.from({ length: 201 }, () => element('li', ['Item'])))), /200 items/);
  let nested = element('ul', [element('li', ['Deep'])]); for (let i = 0; i < 6; i++) nested = element('ul', [element('li', ['Parent', nested])]);
  assert.throws(() => convert(nested), /six levels/);
  assert.throws(() => convert(element('ul', [element('li', ['Parent', element('ul', [element('li', ['One'])]), element('ul', [element('li', ['Two'])])])])), /Multiple nested lists/);
  assert.equal(convert(element('ol', [element('li', ['Hidden'], { hidden: '' }), element('li', ['Visible']), element('li', ['Next'])])).markdown, '1. Visible\n2. Next');
});
test('Simple tables preserve scoped headers, literal pipes, and explicit header choices', () => {
  const root = element('table', [element('thead', [element('tr', [element('th', ['A | B']), element('th', ['Count'], { style: 'text-align:right' })])]), element('tbody', [element('tr', [element('td', ['One']), element('td', ['2'])])])]);
  const result = convert(root); assert.match(result.markdown, /A \\\| B/);
  const parsed = previewBlocks(result.markdown)[0]; assert.equal(parsed.type, 'table');
  assert.equal(inlineParts(parsed.head[0]).map(p => p.text).join(''), 'A | B');
  assert.match(createHTMLSource({ body: result.markdown }), /<th scope="col"[^>]*style="text-align:right">Count/);
  const unmarked = tree(element('table', [element('tr', [element('td', ['Name'])]), element('tr', [element('td', ['One'])])]));
  assert.throws(() => htmlTreeToMarkdown(unmarked), /no explicit header/);
  assert.ok(htmlTreeToMarkdown(unmarked, { firstRowHeaders: true }).warnings.some(w => w.includes('explicit choice')));
});
test('Merged, nested, uneven and oversized tables are rejected with no partial result', () => {
  const table = rows => element('table', rows);
  const header = element('tr', [element('th', ['Header'])]);
  for (const cell of [element('td', ['Keep'], { colspan: '2' }), element('td', [table([header])]), element('td', [element('ul', [element('li', ['Nested'])])])]) assert.throws(() => convert(table([header, element('tr', [cell])])));
  assert.throws(() => convert(table([header, element('tr', [element('td', ['One']), element('td', ['Two'])])])), /same number/);
  assert.throws(() => convert(table([element('tr', Array.from({ length: 13 }, () => element('th', ['H'])))])), /twelve/);
  assert.throws(() => convert(table([header, ...Array.from({ length: 101 }, () => element('tr', [element('td', ['Keep'])]))])), /100 data/);
});
test('Code preserves literal text and uses a longer fence, while quotes keep paragraph boundaries', () => {
  const code = 'const x = `<script>`;\n```\nKeep the ending.';
  const result = convert(element('pre', [element('code', [code])]), element('blockquote', [element('p', ['First']), element('p', ['Second'])]));
  assert.equal(previewBlocks(result.markdown)[0].text, code);
  assert.match(result.markdown, /^````\n/); assert.match(result.markdown, /> First\n> Second/);
  assert.match(createHTMLSource({ body: result.markdown }), /&lt;script&gt;/);
});
test('Decoded content, node count, depth, and expanded Markdown have explicit whole-import bounds', () => {
  assert.throws(() => convert(element('p', ['bad\u0000text'])), /control/);
  assert.throws(() => convert(element('p', ['x'.repeat(60001)])), /nothing was truncated/);
  assert.throws(() => convert(element('p', ['*'.repeat(30001)])), /nothing was truncated/);
  assert.throws(() => htmlTreeToMarkdown(tree(...Array.from({ length: 12001 }, () => text('x')))), /too complex/);
  let node = text('Keep'); for (let i = 0; i < 33; i++) node = element('span', [node]); assert.throws(() => convert(node), /too complex/);
  assert.equal(convert(element('p', ['x'.repeat(60000)])).markdown.length, 60000);
});

class Control {
  constructor(name = '') { this.nodeType = 1; this.localName = name; this.childNodes = []; this.value = ''; this.checked = false; this.disabled = false; this.hidden = false; this.selectionStart = 0; this.selectionEnd = 0; this.events = new Map(); }
  addEventListener(type, fn) { if (!this.events.has(type)) this.events.set(type, []); this.events.get(type).push(fn); }
  async fire(type = 'click', fields = {}) { const event = { type, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...fields }; for (const fn of this.events.get(type) || []) await fn(event); return event; }
  dispatchEvent(event) { for (const fn of this.events.get(event.type) || []) fn(event); return true; }
  append(...nodes) { this.childNodes.push(...nodes); }
  replaceChildren(...nodes) { this.childNodes = nodes; }
  setAttribute() {}
  focus() { this.focused = true; }
  select() { this.selectionStart = 0; this.selectionEnd = this.value.length; }
}
function withDOM(run, options = {}) {
  const previous = globalThis.document, priorConfirm = globalThis.confirm;
  const nodes = new Map(), $ = id => { if (!nodes.has(id)) nodes.set(id, new Control()); return nodes.get(id); };
  let parseTree = tree(element('h1', ['Fictional title.']), element('p', ['Keep this body.'])), assigned = 0;
  const parsedSources = [];
  globalThis.document = { getElementById: $, createTextNode: text, createDocumentFragment: () => new Control(), createElement: name => {
    const node = new Control(name);
    if (name === 'template') Object.defineProperty(node, 'innerHTML', { set(source) { node.content = parseTree; assigned++; parsedSources.push(source); } });
    return node;
  } };
  let confirmValue = true, busy = false, applications = [], intents = [], message = '', fail = false;
  globalThis.confirm = () => confirmValue;
  $('import-format').value = 'auto';
  const ui = installArticleImport({ hasArticle: () => true, isBusy: () => busy, busyChanged: () => {}, report: text => { message = text; }, apply: (draft, intent) => { if (fail) throw new Error('Checkpoint refused'); applications.push(draft); intents.push(intent); }, ...options });
  return Promise.resolve().then(() => run({ $, ui, message: () => message, applications, intents, assigned: () => assigned, parsedSources, parse: root => { parseTree = root; }, confirm: value => { confirmValue = value; }, busy: value => { busy = value; }, fail: () => { fail = true; } })).finally(() => { globalThis.document = previous; globalThis.confirm = priorConfirm; });
}
test('HTML parsing is explicit, preflighted, detached, and title escaping is decoded', () => withDOM(({ assigned }) => {
  assert.equal(parseArticleImport('<h1>Literal</h1>').draft.body, '<h1>Literal</h1>'); assert.equal(assigned(), 0);
  const parsed = parseArticleImport('HTML fixture', 'example.html'); assert.equal(assigned(), 1); assert.equal(parsed.draft.title, 'Fictional title.'); assert.equal(parsed.requiresAck, true);
  assert.equal(parsed.draft.slug, 'example');
  for (const raw of ['x'.repeat(524289), '🙂'.repeat(131073), 'bad\u0000text', '<a'.repeat(6001)]) assert.throws(() => parseHTMLArticle(raw));
  assert.equal(assigned(), 1);
}));
test('Formatted H1 text becomes a plain title without Markdown emphasis markers', () => withDOM(({ parse }) => {
  parse(tree(element('h1', [element('strong', ['Title.']), ' ', element('em', ['Literally *named*'])]), element('p', ['Body'])));
  const result = parseArticleImport('HTML fixture', '', 'html');
  assert.equal(result.draft.title, 'Title. Literally *named*'); assert.equal(result.draft.body, 'Body');
}));
test('Staged HTML requires acknowledgement, cancellation retains it, and apply purges all preview nodes', () => withDOM(async ({ $, ui, applications, confirm }) => {
  ui.openFormatted(); assert.equal($('import-format').value, 'html'); assert.equal($('import-html-options').hidden, false);
  $('import-text').value = 'HTML fixture'; await $('preview-import').fire(); assert.equal(applications.length, 0);
  assert.ok($('import-reading-preview').childNodes.length); assert.equal($('apply-import').disabled, true);
  assert.equal($('apply-import-and-continue').hidden, true); assert.equal($('import-continue-help').hidden, true);
  await $('apply-import').fire(); assert.equal(applications.length, 0);
  $('import-changes-ok').checked = true; await $('import-changes-ok').fire('change'); assert.equal($('apply-import').disabled, false);
  await $('apply-import-and-continue').fire(); assert.equal(applications.length, 0); assert.equal(ui.pending(), true);
  confirm(false); await $('apply-import').fire(); assert.equal(applications.length, 0); assert.ok(ui.pending());
  confirm(true); await $('apply-import').fire(); assert.equal(applications.length, 1); assert.equal(applications[0].title, 'Fictional title.');
  assert.equal($('import-reading-preview').childNodes.length, 0); assert.equal($('import-body-preview').value, ''); assert.equal(ui.pending(), false); assert.equal($('import-changes-ok').checked, false);
}));
test('Copied-writing continuation preserves the reviewed draft and clears retained clipboard context before navigation', async () => {
  const continued = []; let readState;
  const expected = { title: 'Fictional title.', excerpt: '', description: '', slug: 'fictional-title', body: 'Keep **this** body\\. [Guide](https://example.com/guide)', questions: [] };
  await withDOM(async ({ $, ui, parse, applications, intents }) => {
    readState = () => ({ pending: ui.pending(), staged: ui.staged(), text: $('import-text').value, sourceURL: $('import-source-url').value, status: $('import-file-status').textContent, preview: $('import-body-preview').value, applications: structuredClone(applications) });
    parse(tree(element('h1', ['Fictional title.']), element('p', ['Keep ', element('strong', ['this']), ' body. ', element('a', ['Guide'], { href: '../guide' })])));
    ui.openCopied(); $('import-source-url').value = 'https://example.com/folder/page'; await $('import-source-url').fire('input');
    const source = '<h1>Fictional title.</h1><p>Keep <strong>this</strong> body. <a href="../guide">Guide</a></p>';
    await $('import-text').fire('paste', { clipboardData: { getData: type => type === 'text/html' ? source : 'Fictional title.\nKeep this body. Guide' } });
    assert.equal($('import-body-preview').value, expected.body); assert.equal($('import-text').value, ''); assert.equal(ui.pending(), true);
    assert.equal($('apply-import-and-continue').hidden, false); assert.equal($('import-continue-help').hidden, false); assert.equal($('apply-import-and-continue').disabled, true);
    await $('apply-import-and-continue').fire(); assert.equal(applications.length, 0); assert.deepEqual(continued, []);
    $('import-changes-ok').checked = true; await $('import-changes-ok').fire('change'); await $('apply-import-and-continue').fire();
    assert.deepEqual(applications, [expected]); assert.deepEqual(intents, [{ continueToExport: true }]);
    assert.deepEqual(continued, [{ pending: false, staged: false, text: '', sourceURL: '', status: '', preview: '', applications: [expected] }]);
    assert.equal($('import-reading-preview').childNodes.length, 0); assert.equal($('apply-import-and-continue').hidden, true); assert.equal($('import-continue-help').hidden, true);
  }, { continueToExport: () => continued.push(readState()) });
});
test('Continuation refuses absent or empty article bodies while Import and edit remains a separate choice', async () => {
  let continued = 0;
  await withDOM(async ({ $, ui, parse, applications, intents }) => {
    assert.equal($('apply-import-and-continue').disabled, true); await $('apply-import-and-continue').fire(); assert.equal(applications.length, 0); assert.equal(continued, 0);
    ui.openFormatted(); parse(tree(element('h1', ['Fictional title.'])));
    $('import-text').value = '<h1>Fictional title.</h1>'; await $('preview-import').fire();
    assert.equal($('import-body-preview').value, ''); assert.equal(ui.staged(), true);
    $('import-changes-ok').checked = true; await $('import-changes-ok').fire('change');
    assert.equal($('apply-import').disabled, false); assert.equal($('apply-import-and-continue').disabled, true);
    await $('apply-import-and-continue').fire(); assert.equal(applications.length, 0); assert.equal(continued, 0); assert.equal(ui.pending(), true);
    parse(tree(element('h1', ['Fictional title.']), element('p', ['Keep this body.'])));
    $('import-text').value = '<h1>Fictional title.</h1><p>Keep this body.</p>'; await $('import-text').fire('input'); await $('preview-import').fire();
    $('import-changes-ok').checked = true; await $('import-changes-ok').fire('change');
    assert.equal($('apply-import-and-continue').disabled, false); assert.equal($('apply-import').textContent, 'Import and edit');
    await $('apply-import').fire(); assert.equal(applications.length, 1); assert.equal(applications[0].body, 'Keep this body\\.'); assert.deepEqual(intents, [{ continueToExport: false }]); assert.equal(continued, 0); assert.equal(ui.pending(), false);
  }, { continueToExport: () => { continued++; } });
});
test('Edits, format and header choices invalidate acknowledged candidates; busy or failed apply retains writing', () => withDOM(async ({ $, ui, applications, busy, fail, message }) => {
  ui.openFormatted(); $('import-text').value = 'HTML fixture'; await $('preview-import').fire(); $('import-changes-ok').checked = true;
  busy(true); await $('apply-import').fire(); assert.equal(applications.length, 0); busy(false);
  fail(); await $('apply-import').fire(); assert.match(message(), /Checkpoint refused/); assert.equal(ui.pending(), true);
  for (const [id, type] of [['import-text', 'input'], ['import-format', 'change'], ['import-first-row-headers', 'change']]) {
    await $('preview-import').fire(); $('import-changes-ok').checked = true; await $(id).fire(type);
    assert.equal($('apply-import').disabled, true); assert.equal($('import-reading-preview').childNodes.length, 0); assert.equal($('import-changes-ok').checked, false);
  }
}));
test('Rich paste immediately previews user event HTML, rejects partial replacement and overflow, and labels plain fallback', () => withDOM(async ({ $, ui, message }) => {
  const data = html => ({ getData: type => type === 'text/html' ? html : 'Plain selection' });
  assert.equal((await $('import-text').fire('paste', { clipboardData: data('<p>Rich</p>') })).defaultPrevented, false);
  ui.openFormatted(); $('import-text').value = 'Pending text'; $('import-text').selectionStart = 0; $('import-text').selectionEnd = 1;
  await $('import-text').fire('paste', { clipboardData: data('<p>Rich</p>') }); assert.equal($('import-text').value, 'Pending text'); assert.match(message(), /select all/);
  $('import-text').select(); await $('import-text').fire('paste', { clipboardData: data('🙂'.repeat(131073)) }); assert.equal($('import-text').value, 'Pending text'); assert.match(message(), /512 KiB/);
  await $('import-text').fire('paste', { clipboardData: data('<p>Rich</p>') }); assert.equal($('import-text').value, ''); assert.equal($('import-preview').hidden, false); assert.equal($('apply-import').disabled, true);
  $('import-text').select();
  assert.equal((await $('import-text').fire('paste', { clipboardData: data('') })).defaultPrevented, true); assert.match($('import-summary').textContent, /Copied plain text/); assert.match($('import-warnings').childNodes[0].textContent, /Only plain text/);
}));
test('Copied writing reads only the explicit paste payload and prefers HTML without requesting plain text', () => {
  const requested = [], source = copiedWritingSource({ getData: type => { requested.push(type); return type === 'text/html' ? '<p>Only HTML</p>' : 'Unused'; } });
  assert.deepEqual(source, { format: 'html', text: '<p>Only HTML</p>' }); assert.deepEqual(requested, ['text/html']);
  assert.deepEqual(copiedWritingSource({ getData: type => type === 'text/plain' ? 'Plain writing.' : '' }), { format: 'plain', text: 'Plain writing.' });
  for (const clipboard of [null, {}, { getData: () => { throw new Error('Unavailable'); } }, { getData: () => '' }, { getData: () => 'x'.repeat(524289) }, { getData: () => '🙂'.repeat(131073) }]) assert.throws(() => copiedWritingSource(clipboard));
  assert.throws(() => parseCopiedWriting({ format: 'unknown', text: 'Body.' }));
});
test('HTML-only copied writing bypasses the plain paste guard and immediately stages an acknowledged conversion', () => withDOM(async ({ $, ui, applications }) => {
  ui.openCopied(); $('body').value = 'Existing writing.';
  const event = await $('import-text').fire('paste', { clipboardData: { getData: type => type === 'text/html' ? '<p>HTML only</p>' : '' } });
  assert.equal(event.defaultPrevented, true); assert.equal($('import-preview').hidden, false); assert.equal($('import-text').value, ''); assert.equal($('import-preview-heading').focused, true);
  assert.match($('import-summary').textContent, /Copied formatted writing/); assert.equal($('apply-import').disabled, true); assert.equal(applications.length, 0); assert.equal($('body').value, 'Existing writing.'); assert.equal(ui.pending(), true);
  assert.match($('import-file-status').textContent, /kept in this tab/);
}, { focusPreview: true }));
test('Plain clipboard fallback is labelled, acknowledged, re-previewable, and purged after apply', () => withDOM(async ({ $, ui, applications }) => {
  ui.openCopied(); await $('import-text').fire('paste', { clipboardData: { getData: type => type === 'text/plain' ? 'Plain body with no hidden formatting.' : '' } });
  assert.match($('import-summary').textContent, /Copied plain text/); assert.match($('import-warnings').childNodes[0].textContent, /cannot be recovered/); assert.equal($('apply-import').disabled, true);
  await $('preview-import').fire(); assert.match($('import-summary').textContent, /Copied plain text/);
  $('import-changes-ok').checked = true; await $('import-changes-ok').fire('change'); await $('apply-import').fire(); assert.equal(applications.length, 1); assert.equal(createHTMLSource(applications[0]), '<p>Plain body with no hidden formatting.</p>\n'); assert.equal(ui.pending(), false); assert.equal($('import-file-status').textContent, '');
}));
test('Plain clipboard syntax stays literal through preview, re-preview and explicit apply', () => withDOM(async ({ $, ui, applications }) => {
  const source = '---\ntitle: Keep this in the body\n---\n\n# Literal heading\n\n**Literal emphasis**';
  ui.openCopied(); $('body').value = 'Existing writing.';
  await $('import-text').fire('paste', { clipboardData: { getData: type => type === 'text/plain' ? source : '' } });
  assert.equal($('body').value, 'Existing writing.'); assert.equal(applications.length, 0);
  assert.equal($('apply-import').disabled, true); assert.match($('import-warnings').childNodes[0].textContent, /Punctuation stays literal/);
  const before = $('import-body-preview').value;
  await $('preview-import').fire(); assert.equal($('import-body-preview').value, before);
  $('import-changes-ok').checked = true; await $('import-changes-ok').fire('change'); await $('apply-import').fire();
  assert.equal(applications.length, 1); assert.equal(applications[0].title, ''); assert.equal(applications[0].body, before);
  assert.equal(ui.pending(), false);
}));
test('Escaping beyond the article limit keeps current writing and blocks an older copied preview', () => withDOM(async ({ $, ui, applications, message }) => {
  ui.openCopied(); $('body').value = 'Current article.';
  await $('import-text').fire('paste', { clipboardData: { getData: type => type === 'text/plain' ? 'Earlier preview.' : '' } });
  const before = $('import-body-preview').value;
  await $('import-text').fire('paste', { clipboardData: { getData: type => type === 'text/plain' ? '!'.repeat(30001) : '' } });
  assert.equal($('body').value, 'Current article.'); assert.equal($('import-body-preview').value, before); assert.match(message(), /60,000|nothing was truncated/);
  $('import-changes-ok').checked = true; await $('import-changes-ok').fire('change'); await $('apply-import').fire();
  assert.equal($('apply-import').disabled, true); assert.equal(applications.length, 0);
  await $('preview-import').fire(); assert.equal($('apply-import').disabled, true);
}));
test('Oversized or unreadable clipboard data keeps the previous conversion and its source available', () => withDOM(async ({ $, ui }) => {
  ui.openCopied(); await $('import-text').fire('paste', { clipboardData: { getData: () => '<p>Valid</p>' } });
  const before = $('import-body-preview').value, summary = $('import-summary').textContent;
  for (const clipboardData of [{ getData: () => 'x'.repeat(524289) }, { getData: () => { throw new Error('Unreadable'); } }, { getData: () => '' }]) {
    await $('import-text').fire('paste', { clipboardData }); assert.equal($('import-body-preview').value, before); assert.equal($('import-summary').textContent, summary); assert.equal(ui.pending(), true);
  }
  await $('preview-import').fire(); assert.equal($('import-body-preview').value, before);
}));
test('A failed copied table retains bounded source for explicit header re-preview and blocks any older conversion', () => withDOM(async ({ $, ui, parse, applications }) => {
  ui.openCopied(); await $('import-text').fire('paste', { clipboardData: { getData: () => '<p>Earlier valid</p>' } });
  const previous = $('import-body-preview').value;
  parse(tree(element('table', [element('tr', [element('td', ['Name'])]), element('tr', [element('td', ['One'])])])));
  await $('import-text').fire('paste', { clipboardData: { getData: type => type === 'text/html' ? '<table><tr><td>Name</td></tr><tr><td>One</td></tr></table>' : '' } });
  assert.equal($('import-body-preview').value, previous); assert.match($('import-file-status').textContent, /cannot be applied/); $('import-changes-ok').checked = true; await $('import-changes-ok').fire('change'); assert.equal($('apply-import').disabled, true); await $('apply-import').fire(); assert.equal(applications.length, 0);
  $('import-first-row-headers').checked = true; await $('import-first-row-headers').fire('change'); await $('preview-import').fire(); assert.match($('import-body-preview').value, /\| Name \|/); assert.equal($('import-changes-ok').checked, false);
  $('import-changes-ok').checked = true; await $('import-changes-ok').fire('change'); assert.equal($('apply-import').disabled, false);
}));
test('Typing, clearing or changing format discards retained clipboard source and busy pastes cannot read it', () => withDOM(async ({ $, ui, busy }) => {
  ui.openCopied(); let reads = 0; const clipboardData = { getData: () => { reads++; return '<p>Copied</p>'; } };
  busy(true); await $('import-text').fire('paste', { clipboardData }); assert.equal(reads, 0); busy(false);
  await $('import-text').fire('paste', { clipboardData }); $('import-text').value = 'Manual source.'; await $('import-text').fire('input'); await $('preview-import').fire(); assert.doesNotMatch($('import-summary').textContent, /Copied/);
  await $('cancel-import').fire(); assert.equal(ui.pending(), false); assert.equal($('import-file-status').textContent, '');
  await $('import-text').fire('paste', { clipboardData }); $('import-format').value = 'markdown'; await $('import-format').fire('change'); assert.equal(ui.pending(), false); assert.equal($('import-body-preview').value, '');
}));
test('Reopening the paste target keeps an existing candidate; the paste-first example keeps raw HTML out of the box', () => withDOM(async ({ $, ui, applications }) => {
  ui.openCopied(); await $('import-html-example').fire(); assert.equal($('import-text').value, ''); assert.match($('import-summary').textContent, /Copied formatted writing/);
  const before = $('import-body-preview').value; ui.openCopied(); assert.equal($('import-body-preview').value, before); assert.equal($('import-preview').hidden, false); assert.equal($('import-text').focused, true); assert.equal(applications.length, 0);
}, { pasteFirst: true }));
test('Copied conversion checkpoint failure keeps source for retry and complete workspace clear prevents resurrection', () => withDOM(async ({ $, ui, fail, message, parse }) => {
  ui.openCopied(); await $('import-text').fire('paste', { clipboardData: { getData: () => '<p>Keep source</p>' } });
  $('import-changes-ok').checked = true; await $('import-changes-ok').fire('change'); fail(); await $('apply-import').fire(); assert.match(message(), /Checkpoint refused/); assert.equal(ui.pending(), true);
  await $('preview-import').fire(); assert.match($('import-summary').textContent, /Copied formatted writing/); assert.equal($('import-changes-ok').checked, false);
  ui.clear(); assert.equal(ui.pending(), false); parse(tree()); await $('preview-import').fire(); assert.equal(ui.pending(), false); assert.equal($('import-body-preview').value, '');
}));
test('Copied writing can join the current article through the existing exact insertion flow', async () => {
  const plans = [];
  await withDOM(async ({ $, ui, applications }) => {
    $('body').value = 'Existing article.'; ui.openInsertion(); ui.openCopied();
    await $('import-text').fire('paste', { clipboardData: { getData: () => '<p>Additional</p>' } });
    assert.equal($('import-destination').value, 'append'); await $('preview-insertion').fire(); assert.equal($('apply-import').disabled, true);
    $('import-changes-ok').checked = true; await $('import-changes-ok').fire('change'); await $('apply-import').fire(); assert.equal(plans.length, 1); assert.equal(plans[0].body, 'Existing article.\n\nKeep this body\\.'); assert.equal(applications.length, 0); assert.equal(ui.pending(), false);
  }, { applyInsertion: plan => plans.push(plan) });
});
test('Cancelling the fictional example keeps retained copied source and its existing preview', () => withDOM(async ({ $, ui, confirm }) => {
  ui.openCopied(); await $('import-text').fire('paste', { clipboardData: { getData: type => type === 'text/plain' ? 'Keep this copied draft.' : '' } });
  confirm(false); await $('import-html-example').fire(); assert.match($('import-summary').textContent, /Copied plain text/); assert.equal(createHTMLSource({ body: $('import-body-preview').value }), '<p>Keep this copied draft.</p>\n');
  const before = $('import-body-preview').value; await $('preview-import').fire(); assert.equal($('import-body-preview').value, before);
}, { pasteFirst: true }));
test('Selected HTML files retain raw text for retry and cannot bypass the review acknowledgement', () => withDOM(async ({ $, parse, applications }) => {
  const raw = '<table><tr><td>Name</td></tr><tr><td>One</td></tr></table>';
  parse(tree(element('table', [element('tr', [element('td', ['Name'])]), element('tr', [element('td', ['One'])])])));
  $('import-file').files = [{ name: 'example.html', size: raw.length, arrayBuffer: async () => new TextEncoder().encode(raw).buffer }];
  await $('import-file').fire('change'); assert.equal($('import-format').value, 'html-source'); assert.equal($('import-text').value, raw); assert.equal(applications.length, 0);
  $('import-first-row-headers').checked = true; await $('import-first-row-headers').fire('change'); await $('preview-import').fire();
  assert.equal($('import-preview').hidden, false); assert.equal($('apply-import').disabled, true);
  $('import-changes-ok').checked = true; await $('import-changes-ok').fire('change'); await $('apply-import').fire(); assert.equal(applications.length, 1);
}));

test('HTML source pastes use plain text and wait for explicit preview without reading clipboard HTML', () => withDOM(async ({ $, assigned, ui, applications }) => {
  $('import-format').value = 'html-source'; await $('import-format').fire('change');
  assert.equal($('import-html-options').hidden, false); assert.equal($('import-html-help').hidden, true); assert.equal($('import-html-source-help').hidden, false);
  const raw = '<h1>Fictional title.</h1><p>Keep this body.</p>', requested = [];
  const event = await $('import-text').fire('paste', { clipboardData: { getData: type => { requested.push(type); if(type !== 'text/plain') throw new Error('Clipboard HTML must not be read'); return raw; } } });
  assert.equal(event.defaultPrevented, false); assert.deepEqual(requested, ['text/plain']); assert.equal(assigned(), 0);
  // The accepted browser-native paste supplies the input event and text.
  $('import-text').value = raw; await $('import-text').fire('input'); assert.equal(ui.pending(), true);
  await $('preview-import').fire(); assert.equal(assigned(), 1); assert.equal($('import-text').value, raw);
  assert.equal($('import-body-preview').value, 'Keep this body\\.'); assert.equal($('apply-import').disabled, true); assert.equal(applications.length, 0);
  $('import-changes-ok').checked = true; await $('import-changes-ok').fire('change'); await $('apply-import').fire(); assert.equal(applications.length, 1);
}));

test('Switching HTML source and copied-writing modes invalidates conversion acknowledgement', () => withDOM(async ({ $, ui, applications }) => {
  $('import-format').value = 'html-source'; await $('import-format').fire('change'); $('import-text').value = '<p>Source</p>'; await $('preview-import').fire();
  $('import-changes-ok').checked = true; await $('import-changes-ok').fire('change'); assert.equal($('apply-import').disabled, false);
  $('import-format').value = 'html'; await $('import-format').fire('change'); await $('apply-import').fire();
  assert.equal($('import-changes-ok').checked, false); assert.equal($('import-preview').hidden, true); assert.equal(applications.length, 0); assert.equal($('import-html-help').hidden, false);
  ui.openCopied(); assert.equal($('import-html-source-help').hidden, true); assert.equal($('import-html-help').hidden, false);
  $('import-format').value = 'html-source'; await $('import-format').fire('change'); await $('preview-import').fire(); assert.equal($('apply-import').disabled, true);
}));

test('HTML source keeps the UTF-8 paste bound and refuses an oversized paste in full', () => withDOM(async ({ $, assigned }) => {
  $('import-format').value = 'html-source'; await $('import-format').fire('change'); $('import-text').value = '<p>Keep this source.</p>';
  const event = await $('import-text').fire('paste', { clipboardData: { getData: type => type === 'text/plain' ? '界'.repeat(200000) : '<p>Misleading smaller HTML</p>' } });
  assert.equal(event.defaultPrevented, true); assert.equal($('import-text').value, '<p>Keep this source.</p>'); assert.equal(assigned(), 0); assert.match($('import-paste-status').textContent, /512 KiB|524,288|byte/i);
}));

test('Source examples keep code visible even on copied-writing entry points and clear removes it', () => withDOM(async ({ $, ui, assigned }) => {
  $('import-format').value = 'html-source'; await $('import-format').fire('change'); await $('import-html-example').fire();
  assert.equal($('import-text').value, HTML_SOURCE_SAMPLE.html); assert.equal(assigned(), 1); assert.equal($('apply-import').disabled, true);
  await $('cancel-import').fire(); assert.equal(ui.pending(), false); assert.equal($('import-text').value, ''); assert.equal($('import-body-preview').value, '');
}, { pasteFirst: true }));

for (const [action, continueToExport] of [['apply-import', false], ['apply-import-and-continue', true]]) {
  test('HTML ' + (continueToExport ? 'continuation' : 'editing') + ' rechecks source context and header choices and requires acknowledgement of a fresh preview', async () => {
    let continued = 0;
    await withDOM(async ({ $, parse, applications, intents }) => {
      parse(tree(element('p', [element('a', ['Guide'], { href: '../guide' })])));
      $('import-format').value = 'html-source'; await $('import-format').fire('change'); $('import-text').value = '<p><a href="../guide">Guide</a></p>';
      $('import-source-url').value = 'https://example.com/folder/page'; await $('import-source-url').fire('input'); await $('preview-import').fire();
      assert.equal($('import-body-preview').value, '[Guide](https://example.com/guide)');
      $('import-changes-ok').checked = true; await $('import-changes-ok').fire('change'); assert.equal($(action).disabled, false);
      $('import-source-url').value = 'https://other.example/notes/'; await $(action).fire(); assert.equal(applications.length, 0); assert.equal(continued, 0);
      await $('import-source-url').fire('input'); assert.equal($('import-preview').hidden, true); assert.equal($('import-changes-ok').checked, false); assert.match($('import-text').value, /href="\.\.\/guide"/);
      await $('preview-import').fire(); assert.equal($('import-body-preview').value, '[Guide](https://other.example/guide)'); assert.equal($(action).disabled, true);
      await $(action).fire(); assert.equal(applications.length, 0); assert.equal(continued, 0);
      $('import-changes-ok').checked = true; await $('import-changes-ok').fire('change'); $('import-first-row-headers').checked = true;
      await $(action).fire(); assert.equal(applications.length, 0); assert.equal(continued, 0);
      $('import-first-row-headers').checked = false; await $(action).fire();
      assert.equal(applications.length, 1); assert.equal(applications[0].body, '[Guide](https://other.example/guide)');
      assert.equal($('import-source-url').value, ''); assert.equal(Object.hasOwn(applications[0], 'sourceURL'), false);
      assert.deepEqual(intents, [{ continueToExport }]); assert.equal(continued, Number(continueToExport));
    }, { continueToExport: () => { continued++; } });
  });
}

test('Copied HTML is retained for context re-preview and bad context cannot apply an older candidate', () => withDOM(async ({ $, ui, parse, applications }) => {
  parse(tree(element('p', [element('a', ['Guide'], { href: '/guide' })])));
  ui.openCopied(); await $('import-text').fire('paste', { clipboardData: { getData: type => type === 'text/html' ? '<p><a href="/guide">Guide</a></p>' : '' } });
  assert.equal($('import-body-preview').value, 'Guide');
  $('import-source-url').value = 'https://example.com/original'; await $('import-source-url').fire('input'); assert.equal($('import-text').value, ''); assert.equal(ui.pending(), true);
  await $('preview-import').fire(); assert.equal($('import-body-preview').value, '[Guide](https://example.com/guide)');
  $('import-changes-ok').checked = true; await $('import-changes-ok').fire('change');
  $('import-source-url').value = 'javascript:bad()'; await $('preview-import').fire(); await $('apply-import').fire(); assert.equal(applications.length, 0); assert.equal($('apply-import').disabled, true);
  $('import-source-url').value = 'https://other.example/original'; await $('import-source-url').fire('input'); await $('preview-import').fire(); assert.equal($('import-body-preview').value, '[Guide](https://other.example/guide)');
}));

test('Each selected file clears old source context and keeps its HTML available for a new URL preview', () => withDOM(async ({ $, parse }) => {
  parse(tree(element('p', [element('a', ['Guide'], { href: '/guide' })])));
  $('import-format').value = 'html-source'; await $('import-format').fire('change'); $('import-source-url').value = 'https://old.example/page';
  const content = '<p><a href="/guide">Guide</a></p>';
  $('import-file').files = [{ name: 'fictional.html', size: content.length, arrayBuffer: async () => new TextEncoder().encode(content).buffer }];
  await $('import-file').fire('change'); assert.equal($('import-source-url').value, ''); assert.equal($('import-body-preview').value, 'Guide');
  $('import-source-url').value = 'https://new.example/page'; await $('import-source-url').fire('input'); await $('preview-import').fire();
  assert.equal($('import-body-preview').value, '[Guide](https://new.example/guide)'); assert.equal($('import-text').value, content);
  await $('cancel-import').fire(); assert.equal($('import-source-url').value, '');
}));

test('HTML options are checked again at application even when a table-choice change event was missed', () => withDOM(async ({ $, applications }) => {
  $('import-format').value = 'html-source'; await $('import-format').fire('change'); $('import-text').value = '<p>Fictional</p>'; await $('preview-import').fire();
  $('import-changes-ok').checked = true; await $('import-changes-ok').fire('change'); $('import-first-row-headers').checked = true;
  await $('apply-import').fire(); assert.equal(applications.length, 0);
}));

test('Temporary context clears on workspace reset, leaving HTML mode, and accepting a fictional source example', () => withDOM(async ({ $, ui }) => {
  $('import-source-url').value = 'https://example.com/private?setting=only'; assert.equal(ui.pending(), true); ui.clear(); assert.equal($('import-source-url').value, ''); assert.equal(ui.pending(), false);
  $('import-format').value = 'html-source'; await $('import-format').fire('change'); $('import-source-url').value = 'https://example.com/old';
  $('import-format').value = 'markdown'; await $('import-format').fire('change'); assert.equal($('import-source-url').value, '');
  $('import-format').value = 'html-source'; await $('import-format').fire('change'); await $('import-html-example').fire(); assert.equal($('import-source-url').value, HTML_SOURCE_SAMPLE.sourceURL);
  await $('cancel-import').fire(); assert.equal($('import-source-url').value, ''); assert.equal(ui.pending(), false);
}));

for (const [action, continueToExport] of [['apply-import', false], ['apply-import-and-continue', true]]) {
  test('HTML ' + (continueToExport ? 'continuation' : 'editing') + ' cancellation and checkpoint failure retain the URL and reviewed source without navigation', async () => {
    let continued = 0;
    await withDOM(async ({ $, ui, confirm, fail, applications, message }) => {
      const source = '<p>Keep this import</p>';
      $('import-format').value = 'html-source'; await $('import-format').fire('change'); $('import-text').value = source; $('import-source-url').value = 'https://example.com/current'; await $('preview-import').fire();
      const preview = $('import-body-preview').value;
      $('import-changes-ok').checked = true; await $('import-changes-ok').fire('change'); confirm(false); await $(action).fire();
      assert.match(message(), /cancelled/); assert.equal(applications.length, 0); assert.equal(continued, 0); assert.equal(ui.pending(), true);
      assert.equal($('import-source-url').value, 'https://example.com/current'); assert.equal($('import-text').value, source); assert.equal($('import-body-preview').value, preview); assert.equal($('import-changes-ok').checked, true);
      confirm(true); fail(); await $(action).fire(); assert.match(message(), /Checkpoint refused/);
      assert.equal(applications.length, 0); assert.equal(continued, 0); assert.equal(ui.pending(), true);
      assert.equal($('import-source-url').value, 'https://example.com/current'); assert.equal($('import-text').value, source); assert.equal($('import-body-preview').value, preview); assert.equal($('import-preview').hidden, false);
    }, { continueToExport: () => { continued++; } });
  });
}

test('Clearing an import reports already-cleared source and URL to workflow and exit-warning observers', () => {
  const observed = [];
  return withDOM(async ({ $, ui }) => {
    $('import-text').value = '<p>Temporary source</p>'; $('import-source-url').value = 'https://example.com/page';
    await $('cancel-import').fire(); assert.deepEqual(observed.at(-1), ['', '']); assert.equal(ui.pending(), false);
    $('import-text').value = '<p>Another temporary source</p>'; $('import-source-url').value = 'https://example.com/next';
    ui.clear(); assert.deepEqual(observed.at(-1), ['', '']); assert.equal(ui.pending(), false);
  }, { workChanged: () => observed.push([document.getElementById('import-text').value, document.getElementById('import-source-url').value]) });
});
test('A formatted example stages only, and a refused pending-text replacement keeps the import', () => withDOM(async ({ $, ui, confirm, applications }) => {
  ui.openFormatted(); $('import-text').value = 'Keep pending text'; confirm(false); await $('import-html-example').fire(); assert.equal($('import-text').value, 'Keep pending text');
  confirm(true); await $('import-html-example').fire(); assert.match($('import-text').value, /fictional neighborhood/); assert.equal(applications.length, 0); assert.equal($('apply-import').disabled, true);
  await $('cancel-import').fire(); assert.equal(ui.pending(), false); assert.equal($('import-reading-preview').childNodes.length, 0);
}));
test('Public pages explain explicit HTML capture, losses, bounds, and data handling with the same workspace controls', async () => {
  for (const route of ['write', 'markdown-to-wordpress', 'markdown-to-html']) {
    const page = await readFile('public/' + route + '/index.html', 'utf8');
    for (const id of ['start-formatted-import', 'import-first-row-headers', 'import-changes-ok', 'import-reading-preview', 'import-html-example']) assert.match(page, new RegExp('id="' + id + '"'));
  }
  const help = await readFile('public/help/article-import/index.html', 'utf8'); assert.match(help, /tracked changes/); assert.match(help, /Original source nodes are never attached/); assert.match(help, /60,000/);
  const privacy = await readFile('public/privacy/index.html', 'utf8'); assert.match(privacy, /user-initiated paste/); assert.match(privacy, /Raw import text, pending previews, and import choices/);
});

function formattedImportState($) {
  return {
    article: $('body').value, title: $('title').value, notes: $('notes').value,
    approved: $('reviewed').checked, format: $('import-format').value,
    source: $('import-text').value, sourceURL: $('import-source-url').value,
    preview: $('import-body-preview').value, summary: $('import-summary').textContent,
    previewHidden: $('import-preview').hidden, acknowledged: $('import-changes-ok').checked,
    applyDisabled: $('apply-import').disabled, revisionChoice: $('import-word-revisions').value,
    revisionSummary: $('word-revision-summary').textContent, fileStatus: $('import-file-status').textContent
  };
}

test('Successful formatted import clears article paste notices after apply or apply and continue', async () => {
  for (const action of ['apply-import', 'apply-import-and-continue']) {
    let pasteNotice = '', continued = 0;
    await withDOM(async ({ $, ui, applications, message }) => {
      assert.equal(ui.previewFormatted({ format: 'html', text: '<p>Reviewed writing.</p>' }), true);
      pasteNotice = 'Copied formatting opened in Import for review.';
      if (action === 'apply-import-and-continue') {
        assert.equal(ui.previewFormatted({ format: 'html', text: '<p>Another selection.</p>' }), false);
        assert.match(pasteNotice, /Finish or clear the current import/);
      }
      const pendingNotice = pasteNotice;
      await $(action).fire();
      assert.equal(pasteNotice, pendingNotice); assert.equal(ui.pending(), true); assert.equal(applications.length, 0);
      $('import-changes-ok').checked = true; await $('import-changes-ok').fire('change');
      await $(action).fire();
      assert.equal(applications.length, 1); assert.equal(ui.pending(), false); assert.equal(pasteNotice, '');
      assert.match(message(), /^Article imported locally/);
      assert.equal(continued, action === 'apply-import-and-continue' ? 1 : 0);
    }, { reportPaste: value => { pasteNotice = value; }, continueToExport: () => { continued++; } });
  }
});

test('Cancelling or explicitly clearing an import clears article paste notices and keeps current writing', async () => {
  for (const action of ['cancel-import', 'clear']) {
    let pasteNotice = '';
    await withDOM(async ({ $, ui, applications }) => {
      $('body').value = 'Keep the current article.'; $('reviewed').checked = true;
      assert.equal(ui.previewFormatted({ format: 'html', text: '<p>Pending writing.</p>' }), true);
      pasteNotice = 'Copied formatting opened in Import for review.';
      if (action === 'clear') {
        assert.equal(ui.previewFormatted({ format: 'html', text: '<p>Another selection.</p>' }), false);
        assert.match(pasteNotice, /Finish or clear the current import/);
      }
      if (action === 'clear') ui.clear(); else await $('cancel-import').fire();
      assert.equal(pasteNotice, ''); assert.equal(ui.pending(), false); assert.equal(ui.staged(), false);
      assert.equal($('body').value, 'Keep the current article.'); assert.equal($('reviewed').checked, true);
      assert.equal(applications.length, 0);
    }, { reportPaste: value => { pasteNotice = value; } });
  }
});

test('Refused or failed formatted import keeps its article paste notice and retained preview source', async () => {
  for (const failure of ['confirmation', 'checkpoint']) {
    let pasteNotice = '';
    await withDOM(async ({ $, ui, confirm, fail, applications, parsedSources, message }) => {
      const source = { format: 'html', text: '<p>Retain this formatted source.</p>' };
      $('body').value = 'Keep the current article.'; $('reviewed').checked = true;
      assert.equal(ui.previewFormatted(source), true);
      pasteNotice = 'Copied formatting opened in Import for review.';
      if (failure === 'confirmation') confirm(false);
      else {
        assert.equal(ui.previewFormatted({ format: 'html', text: '<p>Another selection.</p>' }), false);
        assert.match(pasteNotice, /Finish or clear the current import/);
        fail();
      }
      $('import-changes-ok').checked = true; await $('import-changes-ok').fire('change');
      const before = formattedImportState($), pendingNotice = pasteNotice;
      await $('apply-import').fire();
      assert.match(message(), failure === 'confirmation' ? /Import cancelled/ : /Checkpoint refused/);
      assert.equal(pasteNotice, pendingNotice); assert.deepEqual(formattedImportState($), before);
      assert.equal(ui.pending(), true); assert.equal(applications.length, 0);
      await $('preview-import').fire();
      assert.deepEqual(parsedSources, [source.text, source.text]); assert.equal(pasteNotice, pendingNotice);
    }, { reportPaste: value => { pasteNotice = value; } });
  }
});

test('Article formatted paste stages the shared conversion without changing writing or export approval, then requires explicit acknowledgement and apply', () => withDOM(async ({ $, ui, parse, parsedSources, applications, intents }) => {
  const raw = '<h1>Fictional new title</h1><p>A <strong>formatted</strong> paragraph.</p><p>UNIQUE_END</p>';
  parse(tree(element('h1', ['Fictional new title']), element('p', ['A ', element('strong', ['formatted']), ' paragraph.']), element('p', ['UNIQUE_END'])));
  $('body').value = 'Keep the existing *article* and its ending.';
  $('title').value = 'Existing title'; $('notes').value = 'Private source notes'; $('reviewed').checked = true;
  const current = { body: $('body').value, title: $('title').value, notes: $('notes').value };
  assert.equal(ui.canPreviewFormatted(), true);
  assert.equal(ui.previewFormatted({ format: 'html', text: raw }), true);
  assert.equal(ui.canPreviewFormatted(), false);
  assert.deepEqual(parsedSources, [raw]);
  assert.deepEqual({ body: $('body').value, title: $('title').value, notes: $('notes').value }, current);
  assert.equal($('reviewed').checked, true);
  assert.equal($('import-format').value, 'html'); assert.equal($('import-text').value, '');
  assert.equal(ui.pending(), true); assert.equal(ui.staged(), true);
  assert.match($('import-body-preview').value, /A \*\*formatted\*\* paragraph\\\./);
  assert.match($('import-body-preview').value, /UNIQUE\\_END$/);
  assert.equal($('import-changes-ok').checked, false); assert.equal($('apply-import').disabled, true);
  await $('apply-import').fire(); assert.equal(applications.length, 0);
  $('import-changes-ok').checked = true; await $('import-changes-ok').fire('change');
  assert.equal($('apply-import').disabled, false);
  await $('apply-import').fire();
  assert.equal(applications.length, 1); assert.deepEqual(intents, [{ continueToExport: false }]);
  assert.equal(applications[0].title, 'Fictional new title');
  assert.match(createWordPressArticle(applications[0]).html, /<strong>formatted<\/strong>/);
  assert.match(createWordPressArticle(applications[0]).html, /UNIQUE_END/);
  assert.equal(ui.pending(), false); assert.equal($('import-body-preview').value, '');
  assert.equal(ui.canPreviewFormatted(), true);
}));

test('Article formatted paste rejects unsupported conversion and source bounds without replacing article, options or preparation', () => withDOM(({ $, ui, parse, assigned, message, applications }) => {
  $('body').value = 'Original article. UNIQUE_END'; $('notes').value = 'Keep private notes'; $('reviewed').checked = true;
  const before = formattedImportState($);
  parse(tree(element('table', [element('tr', [element('th', ['Header'])]), element('tr', [element('td', ['Merged'], { colspan: '2' })])])));
  assert.equal(ui.previewFormatted({ format: 'html', text: '<table><tr><th>Header</th></tr><tr><td colspan="2">Merged</td></tr></table>' }), false);
  assert.match(message(), /Merged table cells/);
  assert.deepEqual(formattedImportState($), before); assert.equal(ui.pending(), false); assert.equal(ui.canPreviewFormatted(), true);
  const parsed = assigned();
  for (const source of [
    { format: 'html', text: 'x'.repeat(MAX_IMPORT_BYTES + 1) },
    { format: 'html', text: '界'.repeat(Math.floor(MAX_IMPORT_BYTES / 3) + 1) },
    { format: 'html', text: 'bad\u0000source' },
    { format: 'html', text: '' },
    { format: 'unknown', text: '<p>Writing</p>' }
  ]) {
    assert.equal(ui.previewFormatted(source), false);
    assert.deepEqual(formattedImportState($), before);
    assert.equal(ui.pending(), false); assert.equal(assigned(), parsed, 'Preflight rejection does not construct an HTML tree.');
  }
  assert.equal(applications.length, 0);
}));

test('Article formatted paste refuses busy work and raw pending inputs before parsing them', () => withDOM(({ $, ui, busy, assigned, applications }) => {
  $('body').value = 'Current article and ending'; $('reviewed').checked = true;
  const source = { format: 'html', text: '<p>New source</p>' };
  busy(true);
  const beforeBusy = formattedImportState($);
  assert.equal(ui.canPreviewFormatted(), false); assert.equal(ui.previewFormatted(source), false);
  assert.deepEqual(formattedImportState($), beforeBusy); assert.equal(assigned(), 0);
  busy(false); assert.equal(ui.canPreviewFormatted(), true);
  for (const [id, value] of [['import-text', 'A pending article source'], ['import-source-url', 'https://example.com/original']]) {
    $(id).value = value;
    const before = formattedImportState($);
    assert.equal(ui.canPreviewFormatted(), false); assert.equal(ui.previewFormatted(source), false);
    assert.deepEqual(formattedImportState($), before); assert.equal(assigned(), 0);
    $(id).value = '';
  }
  assert.equal(ui.canPreviewFormatted(), true); assert.equal(applications.length, 0);
}));

test('Article formatted paste cannot replace an acknowledged earlier conversion or its retained original source', () => withDOM(async ({ $, ui, parse, parsedSources, applications }) => {
  const first = '<p>Keep the first formatted source.</p>';
  parse(tree(element('p', ['Keep the first formatted source.'])));
  $('body').value = 'Current article'; $('reviewed').checked = true;
  assert.equal(ui.previewFormatted({ format: 'html', text: first }), true);
  $('import-changes-ok').checked = true; await $('import-changes-ok').fire('change');
  const before = formattedImportState($);
  for (const second of ['<p>Do not replace the preview</p>', 'x'.repeat(MAX_IMPORT_BYTES + 1)]) {
    assert.equal(ui.previewFormatted({ format: 'html', text: second }), false);
    assert.deepEqual(formattedImportState($), before);
    assert.deepEqual(parsedSources, [first]);
  }
  await $('preview-import').fire();
  assert.deepEqual(parsedSources, [first, first]);
  assert.equal($('import-body-preview').value, before.preview);
  assert.equal($('import-changes-ok').checked, false);
  assert.equal(applications.length, 0); assert.equal($('reviewed').checked, true);
}));

test('Article formatted paste retains exact copied HTML for header-choice re-preview with renewed acknowledgement', () => withDOM(async ({ $, ui, parse, parsedSources, applications }) => {
  const raw = '<table><tr><td>Name</td></tr><tr><td>Fictional value</td></tr></table>';
  parse(tree(element('table', [element('tr', [element('td', ['Name'])]), element('tr', [element('td', ['Fictional value'])])])));
  $('body').value = 'Current article'; $('reviewed').checked = true;
  $('import-first-row-headers').checked = true;
  assert.equal(ui.previewFormatted({ format: 'html', text: raw }), true);
  const preview = $('import-body-preview').value;
  assert.match(preview, /\| Name \|/);
  $('import-changes-ok').checked = true; await $('import-changes-ok').fire('change');
  $('import-first-row-headers').checked = false; await $('import-first-row-headers').fire('change');
  assert.equal(ui.pending(), true); assert.equal($('import-changes-ok').checked, false); assert.equal($('import-text').value, '');
  await $('preview-import').fire(); assert.equal($('apply-import').disabled, true);
  await $('apply-import').fire(); assert.equal(applications.length, 0);
  $('import-first-row-headers').checked = true; await $('import-first-row-headers').fire('change');
  await $('preview-import').fire();
  assert.deepEqual(parsedSources, [raw, raw, raw]);
  assert.equal($('import-body-preview').value, preview); assert.equal($('import-changes-ok').checked, false);
  assert.equal($('body').value, 'Current article'); assert.equal($('reviewed').checked, true);
}));

test('Reopening either formatted source control selects copied mode while preserving pending HTML, context and acknowledgement', () => withDOM(async ({ $, ui, parse, parsedSources, applications }) => {
  const raw = '<p><a href="/guide">Guide</a></p>';
  parse(tree(element('p', [element('a', ['Guide'], { href: '/guide' })])));
  $('body').value = 'Existing article'; $('reviewed').checked = true;
  $('import-format').value = 'html-source'; await $('import-format').fire('change');
  $('import-text').value = raw; $('import-source-url').value = 'https://example.com/page';
  await $('preview-import').fire();
  $('import-changes-ok').checked = true; await $('import-changes-ok').fire('change');
  const before = formattedImportState($);
  for (const open of [ui.openFormatted, ui.openCopied, ui.openFormatted]) {
    open(); assert.deepEqual(formattedImportState($), { ...before, format: 'html' });
    assert.equal(ui.pending(), true); assert.equal(ui.staged(), true); assert.equal($('apply-import').disabled, false);
  }
  assert.deepEqual(parsedSources, [raw]); assert.equal(applications.length, 0);
  await $('preview-import').fire(); assert.deepEqual(parsedSources, [raw, raw]);
  assert.equal($('import-body-preview').value, '[Guide](https://example.com/guide)');
}));

test('Reopening copied controls preserves a selected Word file and its proposed-version choice, including retry after rejection', () => withDOM(async ({ $, ui, applications, message, assigned }) => {
  const bytes = new Uint8Array(22); let reads = 0;
  $('body').value = 'Existing article'; $('reviewed').checked = true;
  $('import-file').files = [{ name: 'fictional-needs-repair.docx', size: bytes.length, arrayBuffer: async () => { reads++; return bytes.buffer; } }];
  await $('import-file').fire('change');
  assert.match(message(), /Word archive is damaged/);
  assert.equal(ui.pending(), true); assert.equal($('import-word-options').hidden, false);
  assert.equal($('import-word-revisions').value, 'require-clean');
  $('import-word-revisions').value = 'proposed'; await $('import-word-revisions').fire('change');
  const before = formattedImportState($);
  for (const open of [ui.openFormatted, ui.openCopied]) {
    open(); assert.deepEqual(formattedImportState($), { ...before, format: 'html' });
    assert.equal($('import-word-options').hidden, false); assert.equal(ui.canPreviewFormatted(), false);
  }
  assert.equal(ui.previewFormatted({ format: 'html', text: '<p>Cannot replace the Word source</p>' }), false);
  assert.deepEqual(formattedImportState($), { ...before, format: 'html' });
  await $('preview-import').fire();
  assert.match(message(), /Word archive is damaged/, 'Retry still reads the retained Word package rather than an empty copied source.');
  assert.equal(reads, 1); assert.equal(assigned(), 0);
  assert.equal($('import-word-revisions').value, 'proposed'); assert.equal(ui.pending(), true);
  assert.equal($('body').value, 'Existing article'); assert.equal($('reviewed').checked, true); assert.equal(applications.length, 0);
}));


test('Definition lists keep terms, descriptions, inline formatting, links, and exact article ending across exports', () => {
  const root = element('section', [
    element('h2', ['Project information']),
    element('dl', [
      element('dt', ['Start time']),
      element('dd', ['Check-in at ', element('strong', ['10:00']), '.']),
      element('dt', ['Parking']),
      element('dd', ['Use the ', element('a', ['north lot'], { href: 'https://example.com/north?entry=1' }), '.']),
    ]),
    element('p', ['KEEP_DEFINITION_ENDING_20261018'])
  ]);
  const original = JSON.stringify(root);
  const result = convert(root), article = parseArticleImport(result.markdown);
  assert.equal(JSON.stringify(root), original, 'original detached HTML tree must not change');
  assert.match(result.markdown, /\*\*Term:\*\* Start time/);
  assert.match(result.markdown, /\*\*Definition:\*\* Check\\-in at \*\*10\\:00\*\*/);
  assert.match(result.markdown, /\*\*Term:\*\* Parking/);
  assert.match(result.markdown, /\[north lot\]\(https:\/\/example.com\/north\?entry=1\)/);
  assert.ok(result.warnings.some(text => text.includes('Definition lists became labeled')));
  assert.match(result.markdown, /KEEP\\_DEFINITION\\_ENDING\\_20261018$/);
  for (const output of [createHTMLSource(article.draft), createWordPressArticle(article.draft).html]) {
    for (const word of ['Start time', 'Check-in at', '10:00', 'Parking', 'north lot', 'KEEP_DEFINITION_ENDING_20261018']) assert.ok(output.includes(word), word);
    assert.match(output, /<strong>Term:<\/strong>/);
    assert.match(output, /<strong>Definition:<\/strong>/);
    assert.match(output, /href="https:\/\/example.com\/north\?entry=1"/);
    assert.doesNotMatch(output, /<dl|<dt|<dd|<script|<iframe/);
  }
  const word = wordDocumentParts(article.draft);
  const xml = word.find(part => part.name === 'word/document.xml').content;
  const relationships = word.find(part => part.name === 'word/_rels/document.xml.rels').content;
  for (const value of ['Start time','Check-in at','10:00','Parking','north lot','KEEP_DEFINITION_ENDING_20261018'])
    assert.ok(xml.includes(value), 'Word export retained ' + value);
  assert.ok(xml.indexOf('Start time') < xml.indexOf('Check-in at'));
  assert.ok(xml.indexOf('Check-in at') < xml.indexOf('Parking'));
  assert.ok(xml.indexOf('Parking') < xml.indexOf('north lot'));
  assert.ok(xml.indexOf('north lot') < xml.indexOf('KEEP_DEFINITION_ENDING_20261018'));
  assert.match(relationships, /https:\/\/example\.com\/north\?entry=1/);
});

test('Definition entries with ordinary paragraph wrappers keep boundaries without joining adjacent text', () => {
  const source = element('dl', [
    element('dt', ['Limit']),
    element('dd', [element('p', ['First paragraph.']), element('p', ['Second paragraph.'])]),
    element('dt', ['Single-line term']),
    element('dd', ['Final answer.'])
  ]);
  const result = convert(source);
  assert.match(result.markdown, /\*\*Definition:\*\* First paragraph\\\.\n\nSecond paragraph\\\./);
  assert.match(result.markdown, /\*\*Term:\*\* Single\\-line term/);
  const output = createHTMLSource({ body: result.markdown });
  assert.ok(output.indexOf('First paragraph') < output.indexOf('Second paragraph'));
  assert.ok(output.indexOf('Second paragraph') < output.indexOf('Single-line term'));
  assert.doesNotMatch(output, /First paragraphSecond paragraph|Second paragraphSingle-line/);
});

test('Ambiguous or oversized HTML definition lists fail closed rather than silently losing content', () => {
  const dl = (...items) => element('dl', items);
  for (const broken of [
    dl(element('dd', ['Orphan description']), element('dt', ['Late term'])),
    dl(element('dt', ['Trailing term only'])),
    dl(element('dt', ['Valid']), element('dd', ['First']), element('dt', ['No definition'])),
    dl(element('dt', ['Term']), element('dd', ['One']), element('div', [element('dd', ['Wrapped and ambiguous'])])),
    dl(element('dt', ['Term']), element('dd', [element('ul', [element('li', ['Nested item'])])])),
    dl(element('dt', ['Term']), element('dd', [element('table', [element('tr', [element('th', ['Nested'])])])])),
    dl(element('dt', ['Term']), element('dd', [''])),
    element('article', [element('dd', ['Outside list'])])
  ]) assert.throws(() => convert(broken), /definition|Definition|Nested lists|Empty/);
  const lots = dl(...Array.from({ length: 101 }, (_, i) => [element('dt', ['Term ' + i]), element('dd', ['Answer ' + i])]).flat());
  assert.throws(() => convert(lots), /200 terms and descriptions/);
  assert.throws(() => convert(dl(element('dt', ['Hidden'], { hidden: '' }), element('dd', ['Orphan']))), /definition needs a preceding term/);
});


test('Definition-list boundaries cannot silently flatten inside list items and table cells', () => {
  const nested = element('dl', [element('dt', ['Term']), element('dd', ['Description'])]);
  const insideList = element('ul', [element('li', ['Before ', nested, ' after'])]);
  const insideCell = element('table', [
    element('tr', [element('th', ['Header'])]),
    element('tr', [element('td', ['Before ', nested, ' after'])])
  ]);
  for (const source of [insideList, insideCell]) {
    const original = JSON.stringify(source);
    assert.throws(() => convert(source), /definition lists/);
    assert.equal(JSON.stringify(source), original);
  }
  assert.throws(() => convert(element('table', [
    element('tr', [element('th', ['Header'])]),
    element('tr', [element('td', [element('span', [element('dt', ['Bare term'])])])])
  ])), /definition lists/);
});

test('Hidden terms never let following visible definitions attach to earlier terms', () => {
  const list = (...entries) => element('dl', entries);
  assert.throws(() => convert(list(
    element('dt', ['Visible A']), element('dd', ['A answer']),
    element('dt', ['Hidden B'], { hidden: '' }), element('dd', ['B answer'])
  )), /definition needs a preceding term/);
  assert.throws(() => convert(list(
    element('dt', ['Unanswered visible term']),
    element('dt', ['Hidden replacement'], { style: 'display:none' }),
    element('dd', ['Answer for hidden replacement'])
  )), /visible definition term lost its description/);
  assert.throws(() => convert(list(
    element('dt', ['Visible term']),
    element('dd', ['Hidden answer'], { 'aria-hidden': 'true' })
  )), /visible definition term has a hidden description/);
  const valid = convert(list(
    element('dt', ['Visible A']), element('dd', ['A answer']),
    element('dt', ['Hidden B'], { hidden: '' }),
    element('dt', ['Visible C']), element('dd', ['C answer'])
  ));
  assert.doesNotMatch(valid.markdown, /Hidden B/);
  assert.match(valid.markdown, /Visible A/);
  assert.match(valid.markdown, /Visible C/);
});

test('Hidden nested structures in definitions are omitted without rejecting visible writing', () => {
  const source = element('dl', [
    element('dt', ['Safe term']),
    element('dd', ['Visible answer.', element('div', [element('ul', [element('li', ['HIDDEN NESTED LIST'])])], { hidden: '' })])
  ]);
  const result = convert(source);
  assert.match(result.markdown, /\*\*Definition:\*\* Visible answer\\\./);
  assert.doesNotMatch(result.markdown, /HIDDEN/);
  assert.ok(result.warnings.some(message => message.includes('hidden content')));
  const html = createHTMLSource({ body: result.markdown });
  assert.match(html, /Visible answer\./);
  assert.doesNotMatch(html, /HIDDEN|<ul|<li/);
});


test('Definition lists in table captions fail closed instead of joining visible terms and descriptions', () => {
  const table = caption => element('table', [
    caption,
    element('tr', [element('th', ['Column'])]),
    element('tr', [element('td', ['Value'])])
  ]);
  const entries = () => element('dl', [
    element('dt', ['Start time']),
    element('dd', ['Check in at 10:00.'])
  ]);
  for (const caption of [
    element('caption', ['Schedule ', entries()]),
    element('caption', [element('span', ['Before ', entries(), ' after'])]),
    element('caption', [element('em', [element('dt', ['Unpaired'])])])
  ]) {
    const original = JSON.stringify(caption);
    assert.throws(() => convert(table(caption)), /Definition lists inside table captions cannot be preserved/);
    assert.equal(JSON.stringify(caption), original, 'a rejected import must not change its detached source');
  }

  const safe = convert(table(element('caption', [
    'Visible caption ', element('span', [entries()], { hidden: '' }), 'ending.'
  ])));
  assert.doesNotMatch(safe.markdown, /Start time|Check in/);
  const rendered = createHTMLSource({ body: safe.markdown });
  assert.match(rendered, /Visible caption ending\./);
  assert.match(rendered, /<th\b[^>]*>Column<\/th>/);
  assert.ok(safe.warnings.some(message => message.includes('hidden content')));
});

test('Omitted definition lists and nested blocks cannot invent paragraph boundaries', () => {
  const entries = () => element('dl', [
    element('dt', ['HIDDEN TERM']),
    element('dd', ['HIDDEN DESCRIPTION'])
  ]);
  const cases = [
    element('dl', [element('dt', ['HIDDEN']), element('dd', ['ANSWER'])], { hidden: '' }),
    element('dl', [element('dt', ['HIDDEN']), element('dd', ['ANSWER'])], { 'aria-hidden': 'true' }),
    element('dl', [element('dt', ['HIDDEN']), element('dd', ['ANSWER'])], { style: 'display: none' }),
    element('dl', [element('dt', ['HIDDEN']), element('dd', ['ANSWER'])], { style: 'visibility: hidden !important' }),
    element('span', [entries()], { hidden: '' }),
    element('span', [element('dl', [element('dt', ['HIDDEN TERM']), element('dd', ['HIDDEN DESCRIPTION'])], { hidden: '' })]),
    element('strong', [element('span', [element('dl', [element('dt', ['HIDDEN TERM']), element('dd', ['HIDDEN DESCRIPTION'])], { style: 'display:none' })])]),
    element('div', [element('dl', [element('dt', ['HIDDEN TERM']), element('dd', ['HIDDEN DESCRIPTION'])], { hidden: '' })]),
    element('span', [element('div', [element('dl', [element('dt', ['HIDDEN TERM']), element('dd', ['HIDDEN DESCRIPTION'])], { hidden: '' })])]),
    element('div', [element('p', ['HIDDEN TEXT'])], { hidden: '' }),
    element('script', [element('div', ['HIDDEN SCRIPT'])])
  ];
  for (const omittedChild of cases) {
    const root = element('section', [
      element('div', ['Before ', omittedChild, 'after.']),
      element('p', ['END_SENTINEL_20261018'])
    ]);
    const original = JSON.stringify(root);
    const result = convert(root);
    assert.equal(JSON.stringify(root), original);
    assert.doesNotMatch(result.markdown, /HIDDEN|ANSWER|DESCRIPTION/);
    assert.match(createHTMLSource({ body: result.markdown }), /<p>Before after\.<\/p>/);
    assert.match(result.markdown, /END\\_SENTINEL\\_20261018$/);
    assert.ok(result.warnings.some(message => /hidden content|Embedded, interactive/.test(message)), 'omission must remain disclosed');
  }

  const withRealParagraph = convert(element('div', [
    'Before ', element('dl', [element('dt', ['Omitted']), element('dd', ['Omitted'])], { hidden: '' }),
    'after.', element('p', ['Actual new paragraph.'])
  ]));
  assert.match(createHTMLSource({ body: withRealParagraph.markdown }),
    /<p>Before after\.<\/p>\n<p>Actual new paragraph\.<\/p>/);
});

test('Visible break-only or empty blocks still separate neighboring article text', () => {
  const blocks = [
    element('div', [element('br')]),
    element('div'),
    element('div', [' ']),
    element('p'),
    element('p', ['\u00a0']),
    element('section', [element('p')])
  ];
  for (const gap of blocks) {
    const original = JSON.stringify(gap);
    const result = convert(element('div', ['Before', gap, 'After']));
    assert.equal(JSON.stringify(gap), original);
    assert.equal(result.markdown, 'Before\n\nAfter', 'visible block did not merge neighboring prose');
  }
  const hiddenOnly = convert(element('div', ['Before', element('div', [
    element('dl', [element('dt', ['Secret']), element('dd', ['Private'])], { hidden: '' })
  ]), 'After']));
  assert.equal(hiddenOnly.markdown, 'BeforeAfter');
  assert.doesNotMatch(hiddenOnly.markdown, /Secret|Private/);
});

test('Captions containing only hidden definition entries retain visible caption text', () => {
  const table = caption => element('table', [
    caption, element('tr', [element('th', ['Header'])]),
    element('tr', [element('td', ['Row'])])
  ]);
  for (const hidden of [{ hidden: '' }, { 'aria-hidden': 'true' }, { style: 'display:none' }]) {
    const source = table(element('caption', [
      'Schedule',
      element('dl', [
        element('dt', ['Secret'], hidden),
        element('dd', ['Private'], hidden)
      ])
    ]));
    const original = JSON.stringify(source);
    const result = convert(source);
    assert.equal(JSON.stringify(source), original);
    assert.match(result.markdown, /^Schedule\n/);
    assert.doesNotMatch(result.markdown, /Secret|Private/);
    assert.ok(result.warnings.some(text => text.includes('hidden content')));
  }
  assert.throws(() => convert(table(element('caption', ['Schedule',
    element('dl', [element('dt', ['Visible']), element('dd', ['Hidden'], { hidden: '' })])
  ]))), /Definition lists inside table captions cannot be preserved/);
});

test('Realistic multi-paragraph HTML table captions retain boundaries and exact trailing article text', () => {
  const caption = element('caption', [
    element('p', ['First quarter results']),
    element('p', ['Second quarter results'])
  ]);
  const article = element('section', [
    element('h1', ['Quarterly fictional report']),
    element('table', [
      caption,
      element('tr', [element('th', ['Metric']), element('th', ['Count'])]),
      element('tr', [element('td', ['Visitors']), element('td', ['12'])])
    ]),
    element('p', ['FINAL_CAPTION_SENTINEL_928'])
  ]);
  const original = JSON.stringify(article);
  const result = convert(article);
  assert.equal(JSON.stringify(article), original, 'detached source must remain unchanged');
  assert.match(result.markdown, /First quarter results\n\nSecond quarter results/);
  assert.doesNotMatch(result.markdown, /resultsSecond/);
  assert.ok(result.warnings.some(w => w.includes('Original caption placement and semantics were not retained')));
  const output = createHTMLSource({ body: result.markdown });
  assert.match(output, /<p>First quarter results<\/p>\n<p>Second quarter results<\/p>/);
  assert.match(output, /<th\b[^>]*>Metric<\/th>/);
  assert.match(output, /<td\b[^>]*>12<\/td>/);
  assert.match(output, /FINAL_CAPTION_SENTINEL_928/);
});
test('Unsupported visible nested structures in table captions are rejected before any article change', () => {
  const table = node => element('table', [
    element('caption', [element('p', ['Important context']), node]),
    element('tr', [element('th', ['Header'])]),
    element('tr', [element('td', ['Value'])])
  ]);
  for (const node of [
    element('h2', ['Heading']), element('ul', [element('li', ['List item'])]),
    element('blockquote', [element('p', ['Quoted'])]),
    element('pre', ['Code']), element('hr')
  ]) {
    const source = table(node), original = JSON.stringify(source);
    assert.throws(() => convert(source), /inside table captions need review/);
    assert.equal(JSON.stringify(source), original);
  }
  const omitted = convert(table(element('h2', ['SECRET'], { hidden: '' })));
  assert.doesNotMatch(omitted.markdown, /SECRET/);
  assert.match(omitted.markdown, /Important context/);
});

test('Table captions with fully hidden definition entries preserve visible caption and table', () => {
  const source = element('table', [
    element('caption', ['Schedule ', element('dl', [
      element('dt', ['Hidden term'], { hidden: '' }),
      element('dd', ['Hidden answer'], { 'aria-hidden': 'true' })
    ]), 'remains.']),
    element('tr', [element('th', ['Column'])]),
    element('tr', [element('td', ['Visible row'])])
  ]);
  const original = JSON.stringify(source);
  const result = convert(source);
  assert.equal(JSON.stringify(source), original);
  assert.match(result.markdown, /Schedule remains\\\./);
  assert.doesNotMatch(result.markdown, /Hidden term|Hidden answer/);
  assert.ok(result.warnings.some(w => w.includes('hidden content')));
  const rendered = createHTMLSource({ body: result.markdown });
  assert.match(rendered, /<th\b[^>]*>Column<\/th>/);
});

test('Empty visible paragraphs with harmless wrappers still delimit adjacent prose', () => {
  for (const blank of [
    element('p', [element('span')]),
    element('p', [element('em')]),
    element('div', [element('span', [element('i')])])
  ]) {
    const result = convert(element('div', ['Before', blank, 'After']));
    assert.equal(result.markdown, 'Before\n\nAfter');
  }
  const omitted = convert(element('div', ['Before', element('div', [
    element('span', [element('dl', [
      element('dt', ['Hidden'], { hidden: '' }),
      element('dd', ['Private'], { hidden: '' })
    ])])
  ]), 'After']));
  assert.equal(omitted.markdown, 'BeforeAfter');
  assert.ok(omitted.warnings.some(w => w.includes('hidden content')));
});

test('Caption-level emphasis survives separated HTML caption paragraphs', () => {
  const table = caption => element('table', [
    caption, element('tr', [element('th', ['Column'])]),
    element('tr', [element('td', ['Value'])])
  ]);
  for (const [style, marker] of [
    ['font-style:italic', '*'],
    ['font-weight:700', '**'],
    ['text-decoration:line-through', '~~']
  ]) {
    const root = table(element('caption', [
      element('p', ['First']), element('p', ['Second'])
    ], { style }));
    const converted = convert(root);
    assert.ok(converted.markdown.includes(marker + 'First' + marker + '\n\n' + marker + 'Second' + marker), style);
    assert.ok(converted.warnings.some(w => w.includes('Original caption placement')));
    const rendered = createHTMLSource({ body: converted.markdown });
    assert.match(rendered, /First/);
    assert.match(rendered, /Second/);
  }
  assert.throws(() => convert(table(element('caption', [
    element('div', [element('p', ['Nested one']), element('p', ['Nested two'])])
  ]))), /Nested paragraph wrappers/);
});
