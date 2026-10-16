import test from 'node:test';
import assert from 'node:assert/strict';
import { htmlTreeToMarkdown } from '../public/html-import.js';
import { inlineParts, previewBlocks } from '../public/preview.js';
import { createHTMLSource } from '../public/html-export.js';
import { createWordPressArticle } from '../public/wordpress-export.js';

const text = value => ({ nodeType: 3, nodeValue: value, childNodes: [] });
const comment = () => ({ nodeType: 8, nodeValue: 'inert source comment', childNodes: [] });
function element(name, nodes = [], attributes = {}) {
  return { nodeType: 1, localName: name, attributes,
    childNodes: nodes.map(node => typeof node === 'string' ? text(node) : node),
    getAttribute: key => Object.hasOwn(attributes, key) ? attributes[key] : null,
    hasAttribute: key => Object.hasOwn(attributes, key) };
}
const tree = (...nodes) => ({ nodeType: 11, childNodes: nodes });
const convert = (...nodes) => htmlTreeToMarkdown(tree(...nodes));
const checkbox = (state, nodes, level, extra = {}) => element('li', nodes, {
  role: 'checkbox', 'aria-checked': state,
  ...(level === undefined ? {} : { 'aria-level': String(level) }), ...extra
});
const marker = (state, extra = {}) => element('img', [], {
  alt: state, 'aria-roledescription': 'checkbox',
  src: 'https://example.test/never-load-this-image.png', ...extra
});
const visible = source => inlineParts(source).map(part => part.text).join('');
const checkboxNotice = /Checklist states were kept as \[Checked\] and \[Unchecked\] text labels\. These labels are not interactive checkboxes/;

test('Explicit checklist states become ordinary visible labels in all existing article outputs', () => {
  const result = convert(element('ul', [
    checkbox('true', ['Ready']), checkbox('false', ['Still to do'])
  ]), element('p', ['Keep the ending.']));
  assert.equal(result.markdown, '- \\[Checked\\] Ready\n- \\[Unchecked\\] Still to do\n\nKeep the ending\\.');
  assert.match(result.warnings.join(' '), checkboxNotice);
  const blocks = previewBlocks(result.markdown);
  assert.equal(blocks[0].type, 'ul');
  assert.deepEqual(blocks[0].items.map(visible), ['[Checked] Ready', '[Unchecked] Still to do']);
  const html = createHTMLSource({ body: result.markdown });
  const wordpress = createWordPressArticle({ body: result.markdown }).html;
  for (const output of [html, wordpress]) {
    assert.match(output, /\[Checked\] Ready/);
    assert.match(output, /\[Unchecked\] Still to do/);
    assert.match(output, /Keep the ending\./);
    assert.doesNotMatch(output, /<input|role=["']checkbox|aria-checked|never-load|<img/);
  }
});

test('The explicit Google Docs sibling-list shape retains parent paths, item order and inline strike', () => {
  const item = (state, word, level) => checkbox(state, [
    marker(state === 'true' ? 'checked' : 'unchecked'),
    element('p', [element('span', [word], { style: state === 'true' ? 'text-decoration:line-through' : 'text-decoration:none' })])
  ], level);
  const result = convert(element('ul', [
    item('true', 'done', 1),
    item('false', 'todo', 1),
    element('ul', [item('true', 'done', 2), item('false', 'todo', 2)]),
    item('false', 'todo', 1)
  ]));
  assert.equal(result.markdown, '- \\[Checked\\] ~~done~~\n- \\[Unchecked\\] todo\n  - \\[Checked\\] ~~done~~\n  - \\[Unchecked\\] todo\n- \\[Unchecked\\] todo');
  assert.match(result.warnings.join(' '), checkboxNotice);
  assert.match(result.warnings.join(' '), /Nested checklist levels were reconstructed from explicit source levels/);
  assert.doesNotMatch(result.warnings.join(' '), /Images were replaced/);
  const parent = previewBlocks(result.markdown)[0];
  assert.deepEqual(parent.items.map(visible), ['[Checked] done', '[Unchecked] todo', '[Unchecked] todo']);
  assert.equal((parent.children[0] || []).length, 0);
  assert.equal((parent.children[2] || []).length, 0);
  assert.deepEqual(parent.children[1][0].items.map(visible), ['[Checked] done', '[Unchecked] todo']);
  const html = createHTMLSource({ body: result.markdown });
  assert.match(html, /\[Checked\] <s>done<\/s>/);
  assert.doesNotMatch(html, /<s>\[Checked\]|<img|\[Image:/);
});

test('Checked state and strikethrough are independent and duplicate wrapper styles normalize once', () => {
  const result = convert(element('ul', [
    checkbox('true', ['Checked but not crossed out'], 1),
    checkbox('false', [element('span', ['Unchecked and crossed out'], { style: 'text-decoration:line-through' })], 1),
    checkbox('true', ['Item wrapper strike'], 1, { style: 'text-decoration-line:line-through' }),
    checkbox('false', [element('span', ['Same strike on item and span'], { style: 'text-decoration:line-through' })], 1, { style: 'text-decoration:line-through' })
  ]));
  const html = createHTMLSource({ body: result.markdown });
  assert.match(html, /\[Checked\] Checked but not crossed out<\/li>/);
  assert.match(html, /\[Unchecked\] <s>Unchecked and crossed out<\/s>/);
  assert.match(html, /\[Checked\] <s>Item wrapper strike<\/s>/);
  assert.match(html, /\[Unchecked\] <s>Same strike on item and span<\/s>/);
  assert.equal((html.match(/<s>/g) || []).length, 3);
  assert.doesNotMatch(html, /<s><s>|~~~~|<s>\[Checked\]|<s>\[Unchecked\]/);
});

test('Only a matching leading direct marker is omitted and no marker source address is read', () => {
  const reads = [], image = marker('checked', { src: 'data:image/png;base64,not-decoded', srcset: 'https://example.test/also-not-read' });
  const read = image.getAttribute;
  image.getAttribute = name => { reads.push(name); assert.ok(!['src', 'srcset'].includes(name)); return read(name); };
  const ordinary = element('img', [], { alt: 'A real article image', src: 'https://example.test/article.png' });
  const result = convert(element('ul', [checkbox('true', [' \n', comment(), image, ' Ready ', ordinary], 1)]));
  assert.equal(visible(previewBlocks(result.markdown)[0].items[0]), '[Checked] Ready [Image: A real article image]');
  assert.ok(reads.includes('alt'));
  assert.match(result.warnings.join(' '), /Images were replaced with text placeholders/);
  assert.doesNotMatch(result.markdown, /data:image|https:|not-decoded|also-not-read/);
});

test('Wrapped or nonleading matching markers stay visible placeholders, and ordinary image labels never imply state', () => {
  const result = convert(element('ul', [
    checkbox('false', [element('span', [marker('unchecked')]), ' Wrapped marker'], 1),
    checkbox('true', ['Text before ', marker('checked')], 1),
    checkbox('true', [element('img', [], { alt: 'checked' }), ' Ordinary image'], 1),
    element('li', [marker('checked'), ' No explicit state'], { style: 'text-decoration:line-through;list-style-type:none' }),
    element('li', ['Ordinary bullet'])
  ]));
  assert.deepEqual(previewBlocks(result.markdown)[0].items.map(visible), [
    '[Unchecked] [Image: unchecked] Wrapped marker',
    '[Checked] Text before [Image: checked]',
    '[Checked] [Image: checked] Ordinary image',
    '[Image: checked] No explicit state',
    'Ordinary bullet'
  ]);
  assert.match(result.warnings.join(' '), /Images were replaced with text placeholders/);
});

test('Unknown or contradictory checkbox marker labels reject instead of guessing from image appearance', () => {
  for (const state of ['true', 'false']) {
    for (const alt of ['', 'mixed', 'done', 'CHECKED?', state === 'true' ? 'unchecked' : 'checked']) {
      for (const location of ['leading', 'later', 'wrapped']) {
        const image = marker(alt);
        const nodes = location === 'leading' ? [image, 'Item'] : location === 'later' ? ['Item ', image] : [element('span', [image]), 'Item'];
        assert.throws(() => convert(element('ul', [checkbox(state, nodes, 1)])), /unknown or conflicting state/);
      }
    }
  }
  assert.equal(convert(element('ul', [checkbox(' TRUE ', [marker(' CHECKED '), 'Normalized explicit state'], 1, { role: ' Checkbox ' })])).markdown,
    '- \\[Checked\\] Normalized explicit state');
});

test('Checkbox state must be explicit on the list item and unsupported states cannot become ordinary bullets', () => {
  for (const state of ['', 'mixed', 'undefined', '1', '0', 'checked', 'unchecked']) {
    assert.throws(() => convert(element('ul', [checkbox(state, ['Keep this item'], 1)])), /state must be explicitly true or false/);
  }
  assert.throws(() => convert(element('ul', [element('li', ['Missing state'], { role: 'checkbox' })])), /Mixed or missing states/);
  for (const role of ['', 'listitem', 'checkbox listitem', 'menuitemcheckbox', 'switch']) {
    assert.throws(() => convert(element('ul', [element('li', ['Unknown role'], { role, 'aria-checked': 'true' })])), /state needs a checkbox list item/);
  }
  assert.throws(() => convert(element('ul', [element('li', ['Ambiguous checkbox role'], { role: 'checkbox listitem' })])), /state needs a checkbox list item/);
});

test('DOM-nested checkbox levels are optional but any supplied level must match actual depth', () => {
  const result = convert(element('ul', [
    checkbox('false', ['Parent', element('ul', [checkbox('true', ['Child'])])])
  ]));
  assert.equal(result.markdown, '- \\[Unchecked\\] Parent\n  - \\[Checked\\] Child');
  for (const level of ['0', '2', '7', '01', '1.0', 'no', '']) {
    assert.throws(() => convert(element('ul', [checkbox('true', ['Wrong root level'], level)])), /Checklist levels must match/);
  }
  assert.throws(() => convert(element('ul', [
    checkbox('false', ['Parent', element('ul', [checkbox('true', ['Wrong child level'], 1)])], 1)
  ])), /Checklist levels must match/);
});

test('Sibling repair requires matching explicit state and depth on every item and descendant', () => {
  const child = () => element('ul', [checkbox('true', ['Child'], 2)]);
  for (const parent of [
    element('li', ['Ordinary parent']),
    checkbox('false', ['Missing parent level']),
    checkbox('false', ['Wrong parent level'], 2)
  ]) assert.throws(() => convert(element('ul', [parent, child()])), /Checklist/);
  assert.throws(() => convert(element('ul', [
    checkbox('true', ['Earlier item without level']),
    checkbox('false', ['Parent'], 1), child()
  ])), /Checklist levels must match/);
  assert.throws(() => convert(element('ul', [
    element('li', ['Earlier ordinary item']),
    checkbox('false', ['Parent'], 1), child()
  ])), /Checklist state needs/);
  assert.throws(() => convert(element('ul', [
    checkbox('false', ['Parent'], 1),
    element('ul', [checkbox('true', ['Child without level'])])
  ])), /Checklist levels must match/);
  assert.throws(() => convert(element('ul', [
    checkbox('false', ['Parent'], 1),
    element('ul', [checkbox('true', ['Child', element('ul', [checkbox('false', ['Grandchild without level'])])], 2)])
  ])), /Checklist levels must match/);
  assert.throws(() => convert(element('ul', [
    checkbox('false', ['Parent'], 1),
    element('ul', [element('li', ['Ordinary child'])])
  ])), /Checklist state needs/);
});

test('Ambiguous sibling attachment and malformed nested shapes retain whole-import rejection', () => {
  const nested = () => element('ul', [checkbox('true', ['Child'], 2)]);
  const parent = () => checkbox('false', ['Parent'], 1);
  for (const list of [
    element('ul', [nested(), parent()]),
    element('ul', [parent(), 'intervening text', nested()]),
    element('ul', [parent(), element('div', ['intervening element']), nested()]),
    element('ol', [parent(), nested()]),
    element('ul', [parent(), element('ol', [checkbox('true', ['Child'], 2)])]),
    element('ul', [parent(), nested(), nested()]),
    element('ul', [checkbox('false', ['Parent', nested()], 1), nested()]),
    element('ul', [checkbox('false', ['Parent', element('div', [nested()])], 1)]),
    element('ul', [checkbox('false', ['Parent', nested(), 'text after nested list'], 1)])
  ]) assert.throws(() => convert(list), /unsupported structure|Multiple nested lists|Wrapped|after a nested list/);
});

test('Hidden list items and nested lists cannot leak text or reassign a sibling subtree to another parent', () => {
  const hidden = checkbox('mixed', ['PRIVATE HIDDEN ITEM'], 99, { hidden: '' });
  const good = checkbox('true', [
    marker('checked'),
    'Visible ',
    element('span', ['PRIVATE SPAN'], { style: 'display:none' }),
    element('span', [marker('unchecked')], { 'aria-hidden': 'true' }),
    element('ul', [checkbox('false', ['PRIVATE NESTED ITEM'], 2)], { hidden: '' })
  ], 1);
  const result = convert(element('ul', [hidden, good, checkbox('false', ['Next visible item'], 1)]));
  assert.equal(result.markdown, '- \\[Checked\\] Visible\n- \\[Unchecked\\] Next visible item');
  assert.match(result.warnings.join(' '), /Explicitly hidden content was omitted/);
  assert.doesNotMatch(result.markdown, /PRIVATE|Image:/);
  assert.throws(() => convert(element('ul', [
    checkbox('false', ['Earlier visible parent'], 1),
    checkbox('true', ['Hidden possible parent'], 1, { hidden: '' }),
    element('ul', [checkbox('false', ['Cannot safely assign this child'], 2)])
  ])), /unsupported structure/);
});

test('State prefixes cannot turn marker-only, hidden-only or whitespace-only items into successful conversions', () => {
  for (const nodes of [
    [], [' \n\t '], [marker('checked')],
    [' ', marker('checked'), element('p', [' \n '])],
    [marker('checked'), element('span', ['hidden text'], { hidden: '' })]
  ]) assert.throws(() => convert(element('ul', [checkbox('true', nodes, 1)])), /Empty list items/);
});

test('Sibling-normalized lists retain the shared 200-item and six-level bounds', () => {
  const group = count => element('ul', Array.from({ length: count }, (_, index) => checkbox('true', ['Child ' + index], 2)));
  assert.equal((convert(element('ul', [checkbox('false', ['Parent'], 1), group(199)])).markdown.match(/Checked/g) || []).length, 199);
  assert.throws(() => convert(element('ul', [checkbox('false', ['Parent'], 1), group(200)])), /200 items/);
  const chain = (depth, maximum) => element('ul', [
    checkbox(depth % 2 ? 'true' : 'false', ['Level ' + depth], depth),
    ...(depth < maximum ? [chain(depth + 1, maximum)] : [])
  ]);
  assert.equal(convert(chain(1, 6)).markdown.split('\n').length, 6);
  assert.throws(() => convert(chain(1, 7)), /six levels/);
});

test('Labels participate in the final article limit and invalid source text still fails atomically', () => {
  assert.throws(() => convert(element('ul', [checkbox('true', ['x'.repeat(59990)], 1)])), /exceeds 60,000.*nothing was truncated/);
  assert.throws(() => convert(element('ul', [checkbox('true', ['Keep\u0000this'], 1)])), /unsupported control characters/);
  assert.throws(() => convert(element('ul', [checkbox('true', ['Before ', element('del', ['unresolved change'])], 1)])), /tracked changes/);
});

test('Unsupported flattening containers cannot silently discard visible checklist state', () => {
  const list = () => element('ul', [checkbox('true', ['State must not disappear'], 1)]);
  for (const source of [
    element('blockquote', [list()]),
    element('pre', [list()]),
    element('ul', [checkbox('false', ['Outer item ', element('span', [checkbox('true', ['Malformed inner item'], 2)])], 1)])
  ]) assert.throws(() => convert(source), /Checklist items inside this container cannot be preserved/);
  // A code wrapper with block descendants takes the existing block-flow path,
  // which reaches list conversion and preserves the explicit state.
  assert.equal(convert(element('code', [list()])).markdown, '- \\[Checked\\] State must not disappear');
  const result = convert(element('blockquote', [
    element('ul', [checkbox('mixed', ['PRIVATE HIDDEN CHECKLIST'], 1)], { hidden: '' }),
    element('p', ['Visible quote'])
  ]));
  assert.equal(result.markdown, '> Visible quote');
  assert.doesNotMatch(result.markdown, /PRIVATE|Checked|Unchecked/);
});

test('State-bearing non-list elements reject while hidden and explicitly omitted controls keep their omission rules', () => {
  for (const attributes of [{ role: 'checkbox', 'aria-checked': 'true' }, { role: 'checkbox' }, { 'aria-checked': 'false' }, { role: 'checkbox listitem' }]) {
    for (const node of [
      element('div', ['Cannot flatten this state'], attributes),
      element('p', [element('span', ['Cannot flatten inline state'], attributes)]),
      element('ul', [checkbox('true', ['Cannot flatten list state'], 1)], attributes),
      element('ul', [checkbox('false', ['Before ', element('span', ['Cannot flatten nested state'], attributes)], 1)])
    ]) assert.throws(() => convert(node), /Checkbox state outside a list item cannot be preserved/);
  }
  const result = convert(element('p', [
    'Visible ending',
    element('span', ['PRIVATE HIDDEN CHECKBOX'], { role: 'checkbox', 'aria-checked': 'mixed', hidden: '' }),
    element('input', [], { type: 'checkbox', 'aria-checked': 'true', checked: '' })
  ]));
  assert.equal(result.markdown, 'Visible ending');
  assert.match(result.warnings.join(' '), /Explicitly hidden content was omitted/);
  assert.match(result.warnings.join(' '), /interactive.*content was omitted/);
});

test('Table section wrappers cannot bypass state rejection or explicit hidden-content omission', () => {
  const header = () => element('tr', [element('th', ['Heading'])]);
  const row = value => element('tr', [element('td', [value])]);
  for (const name of ['thead', 'tbody', 'tfoot']) {
    assert.throws(() => convert(element('table', [
      header(), element(name, [row('State must not disappear')], { role: 'checkbox', 'aria-checked': 'true' })
    ])), /Checkbox state outside a list item cannot be preserved/);
    const result = convert(element('table', [
      header(),
      element(name, [row('PRIVATE HIDDEN SECTION')], { role: 'checkbox', 'aria-checked': 'mixed', hidden: '' }),
      row('Visible cell')
    ]));
    assert.equal(result.markdown, '| Heading |\n| --- |\n| Visible cell |');
    assert.match(result.warnings.join(' '), /Explicitly hidden content was omitted/);
    assert.doesNotMatch(result.markdown, /PRIVATE|Checked|Unchecked/);
  }
});

test('Hostile punctuation, Unicode and safe links remain literal or semantically linked without touching source nodes', () => {
  const literal = '😀 日本語 العربية [x] ![image](https://example.test/pic) <script>boom()</script> & **literal**';
  const root = tree(element('ul', [
    checkbox('false', [marker('unchecked'), literal, ' ', element('a', ['Reviewed source'], { href: 'https://example.test/source' })], 1),
    element('ul', [checkbox('true', ['Nested ending 🧭'], 2)])
  ]));
  const freeze = node => {
    node.childNodes.forEach(freeze);
    Object.freeze(node.childNodes);
    if (node.attributes) Object.freeze(node.attributes);
    Object.freeze(node);
  };
  const before = JSON.stringify(root);
  freeze(root);
  const result = htmlTreeToMarkdown(root);
  assert.equal(JSON.stringify(root), before);
  const parent = previewBlocks(result.markdown)[0];
  assert.equal(visible(parent.items[0]), '[Unchecked] ' + literal + ' Reviewed source');
  assert.equal(visible(parent.children[0][0].items[0]), '[Checked] Nested ending 🧭');
  const html = createHTMLSource({ body: result.markdown });
  assert.match(html, /&lt;script&gt;boom\(\)&lt;\/script&gt;/);
  assert.match(html, /href="https:\/\/example\.test\/source"/);
  assert.doesNotMatch(html, /<script|<img|<input|<strong>literal/);
});

test('Ordinary bullets, nested numbered lists, hidden items and malformed numbering keep their existing behavior', () => {
  const result = convert(element('ol', [
    element('li', ['Hidden'], { hidden: '' }),
    element('li', ['Parent', element('ol', [element('li', ['Child']), element('li', ['Next child'])], { start: '7' })]),
    element('li', ['Next parent'])
  ], { start: '4' }));
  assert.equal(result.markdown, '4. Parent\n  7. Child\n  8. Next child\n5. Next parent');
  assert.doesNotMatch(result.warnings.join(' '), /Checklist/);
  for (const attributes of [{ reversed: '' }, { type: 'a' }, { start: '-1' }, { start: '1000000000' }]) {
    assert.throws(() => convert(element('ol', [element('li', ['Keep'])], attributes)));
  }
  assert.throws(() => convert(element('ol', [element('li', ['Keep'], { value: '7' })])), /Per-item numbering/);
});
