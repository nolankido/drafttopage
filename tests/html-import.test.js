import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { htmlTreeToMarkdown, parseHTMLArticle } from '../public/html-import.js';
import { parseArticleImport } from '../public/article-import.js';
import { inlineTokens, decodeMarkdownEscapes } from '../public/markdown-inline.js';
import { inlineParts, previewBlocks } from '../public/preview.js';
import { createHTMLSource } from '../public/html-export.js';
import { createWordPressArticle } from '../public/wordpress-export.js';
import { installArticleImport } from '../public/import-controls.js';
import { copiedWritingSource, parseCopiedWriting } from '../public/copied-writing.js';

const text = value => ({ nodeType: 3, nodeValue: value, childNodes: [] });
function element(name, nodes = [], attributes = {}) {
  return { nodeType: 1, localName: name, childNodes: nodes.map(n => typeof n === 'string' ? text(n) : n), getAttribute: key => Object.hasOwn(attributes, key) ? attributes[key] : null, hasAttribute: key => Object.hasOwn(attributes, key) };
}
const tree = (...nodes) => ({ nodeType: 11, childNodes: nodes });
const convert = (...nodes) => htmlTreeToMarkdown(tree(...nodes));
const output = (...nodes) => createHTMLSource({ body: convert(...nodes).markdown });

test('Document wrappers preserve headings, paragraphs, span emphasis, and line breaks', () => {
  const root = element('b', [element('h1', ['A fictional title']), element('p', ['One ', element('span', ['important'], { style: 'font-weight:700' }), ' and ', element('span', ['quiet'], { style: 'font-style:italic' }), '.', element('br'), 'Next line.'])], { style: 'font-weight:normal', id: 'docs-internal-guid-example' });
  const result = convert(root);
  assert.equal(result.markdown, '# A fictional title\n\nOne **important** and *quiet*\\.\nNext line\\.');
  assert.match(output(root), /<strong>important<\/strong> and <em>quiet<\/em>\.<br>Next line\./);
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
test('Tracked changes are rejected, and nested or delimiter emphasis keeps all text with notices', () => {
  for (const name of ['ins', 'del']) assert.throws(() => convert(element('p', [element(name, ['Unresolved'])])), /tracked changes/);
  const result = convert(element('p', [element('strong', ['A ', element('em', ['nested']), ' word']), ' ', element('strong', ['A *literal* delimiter'])]));
  assert.ok(result.warnings.some(w => w.includes('Nested'))); assert.ok(result.warnings.some(w => w.includes('delimiter')));
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
  constructor(name = '') { this.nodeType = 1; this.localName = name; this.childNodes = []; this.value = ''; this.checked = false; this.disabled = false; this.hidden = false; this.selectionStart = 0; this.selectionEnd = 0; this.events = new Map(); this.attributes = {}; }
  addEventListener(type, fn) { if (!this.events.has(type)) this.events.set(type, []); this.events.get(type).push(fn); }
  async fire(type = 'click', fields = {}) { const event = { type, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...fields }; for (const fn of this.events.get(type) || []) await fn(event); return event; }
  dispatchEvent(event) { for (const fn of this.events.get(event.type) || []) fn(event); return true; }
  append(...nodes) { this.childNodes.push(...nodes); }
  replaceChildren(...nodes) { this.childNodes = nodes; }
  setAttribute(name, value) { this.attributes[name] = value; }
  focus() { this.focused = true; }
  select() { this.selectionStart = 0; this.selectionEnd = this.value.length; }
}
function withDOM(run, options = {}) {
  const previous = globalThis.document, priorConfirm = globalThis.confirm;
  const nodes = new Map(), $ = id => { if (!nodes.has(id)) nodes.set(id, new Control()); return nodes.get(id); };
  let parseTree = tree(element('h1', ['Fictional title.']), element('p', ['Keep this body.'])), assigned = 0;
  globalThis.document = { getElementById: $, createTextNode: text, createDocumentFragment: () => new Control(), createElement: name => {
    const node = new Control(name);
    if (name === 'template') Object.defineProperty(node, 'innerHTML', { set() { node.content = parseTree; assigned++; } });
    return node;
  } };
  let confirmValue = true, busy = false, applications = [], message = '', fail = false;
  globalThis.confirm = () => confirmValue;
  $('import-format').value = 'auto';
  const ui = installArticleImport({ hasArticle: () => true, isBusy: () => busy, busyChanged: () => {}, report: text => { message = text; }, apply: draft => { if (fail) throw new Error('Checkpoint refused'); applications.push(draft); }, ...options });
  return Promise.resolve().then(() => run({ $, ui, message: () => message, applications, assigned: () => assigned, parse: root => { parseTree = root; }, confirm: value => { confirmValue = value; }, busy: value => { busy = value; }, fail: () => { fail = true; } })).finally(() => { globalThis.document = previous; globalThis.confirm = priorConfirm; });
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
  await $('apply-import').fire(); assert.equal(applications.length, 0);
  $('import-changes-ok').checked = true; await $('import-changes-ok').fire('change'); assert.equal($('apply-import').disabled, false);
  confirm(false); await $('apply-import').fire(); assert.equal(applications.length, 0); assert.ok(ui.pending());
  confirm(true); await $('apply-import').fire(); assert.equal(applications.length, 1); assert.equal(applications[0].title, 'Fictional title.');
  assert.equal($('import-reading-preview').childNodes.length, 0); assert.equal($('import-body-preview').value, ''); assert.equal(ui.pending(), false); assert.equal($('import-changes-ok').checked, false);
}));
test('Import review counts every reported conversion note without replacing existing writing', () => withDOM(async ({ $, ui, applications, parse }) => {
  $('body').value = 'Existing article stays here.';
  parse(tree(element('h1', ['Fictional title']), element('p', ['Keep the body.']), element('img', [], { src: 'https://example.test/fictional.jpg', alt: 'Fictional image' })));
  const expected = parseArticleImport('HTML fixture', '', 'html');
  ui.openFormatted(); $('import-text').value = 'HTML fixture'; await $('preview-import').fire();
  assert.ok(expected.warnings.length > 0);
  assert.deepEqual($('import-warnings').childNodes.map(node => node.textContent), expected.warnings);
  assert.match($('import-review-summary').textContent, new RegExp('^' + expected.warnings.length + ' conversion note'));
  assert.match($('import-review-summary').textContent, /Current writing is unchanged/);
  assert.equal($('body').value, 'Existing article stays here.'); assert.equal(applications.length, 0);
  assert.equal($('import-changes-ok').checked, false); assert.equal($('apply-import').disabled, true);
}));
test('A new conversion reopens reading, closes optional source and resets acknowledgement; clearing purges its report', () => withDOM(async ({ $, ui }) => {
  ui.openFormatted(); $('import-text').value = 'HTML fixture'; await $('preview-import').fire();
  $('import-reading-panel').open = false; $('import-source-panel').open = true; $('import-changes-ok').checked = true;
  await $('preview-import').fire();
  assert.equal($('import-reading-panel').open, true); assert.equal($('import-source-panel').open, false);
  assert.equal($('import-changes-ok').checked, false); assert.equal($('apply-import').disabled, true);
  assert.ok($('import-body-preview').value); assert.ok($('import-review-summary').textContent);
  await $('cancel-import').fire();
  assert.equal($('import-review-summary').textContent, ''); assert.equal($('import-warnings').childNodes.length, 0);
  assert.equal($('import-body-preview').value, ''); assert.equal($('import-preview').hidden, true);
}));
test('Quiet Markdown imports and unmapped front matter have accurate summaries and preserve their existing consent rules', () => withDOM(async ({ $, ui, applications }) => {
  $('import-format').value = 'markdown'; $('import-text').value = 'Plain article body.'; await $('preview-import').fire();
  assert.match($('import-review-summary').textContent, /^No conversion notes were reported/);
  assert.equal($('import-warnings').childNodes.length, 0); assert.equal($('import-changes-section').hidden, true);
  assert.equal($('apply-import').disabled, false);
  $('import-text').value = '---\nlayout: article\n---\n\nAnother body.'; await $('preview-import').fire();
  assert.match($('import-review-summary').textContent, /1 front-matter field needs separate handling/);
  assert.equal($('apply-import').disabled, true); await $('apply-import').fire(); assert.equal(applications.length, 0);
  $('import-unmapped-ok').checked = true; await $('import-unmapped-ok').fire('change'); assert.equal($('apply-import').disabled, false);
  ui.clear(); assert.equal($('import-review-summary').textContent, '');
}));
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
  $('import-changes-ok').checked = true; await $('import-changes-ok').fire('change'); await $('apply-import').fire(); assert.equal(applications.length, 1); assert.equal(inlineParts(applications[0].body).map(part => part.text).join(''), 'Plain body with no hidden formatting.'); assert.equal(ui.pending(), false); assert.equal($('import-file-status').textContent, '');
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
  assert.match($('import-review-summary').textContent, /earlier preview.*cannot be applied/); assert.equal($('import-review-notes').attributes['data-state'], 'stale');
  $('import-first-row-headers').checked = true; await $('import-first-row-headers').fire('change'); await $('preview-import').fire(); assert.match($('import-body-preview').value, /\| Name \|/); assert.equal($('import-changes-ok').checked, false);
  assert.doesNotMatch($('import-review-summary').textContent, /earlier preview/); assert.equal($('import-review-notes').attributes['data-state'], '');
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
  const before = $('import-body-preview').value;
  confirm(false); await $('import-html-example').fire(); assert.match($('import-summary').textContent, /Copied plain text/); assert.equal($('import-body-preview').value, before);
  await $('preview-import').fire(); assert.equal($('import-body-preview').value, before);
}, { pasteFirst: true }));
test('Selected HTML files retain raw text for retry and cannot bypass the review acknowledgement', () => withDOM(async ({ $, parse, applications }) => {
  const raw = '<table><tr><td>Name</td></tr><tr><td>One</td></tr></table>';
  parse(tree(element('table', [element('tr', [element('td', ['Name'])]), element('tr', [element('td', ['One'])])])));
  $('import-file').files = [{ name: 'example.html', size: raw.length, arrayBuffer: async () => new TextEncoder().encode(raw).buffer }];
  await $('import-file').fire('change'); assert.equal($('import-format').value, 'html'); assert.equal($('import-text').value, raw); assert.equal(applications.length, 0);
  $('import-first-row-headers').checked = true; await $('import-first-row-headers').fire('change'); await $('preview-import').fire();
  assert.equal($('import-preview').hidden, false); assert.equal($('apply-import').disabled, true);
  $('import-changes-ok').checked = true; await $('import-changes-ok').fire('change'); await $('apply-import').fire(); assert.equal(applications.length, 1);
}));
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
