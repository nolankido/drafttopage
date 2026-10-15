import test from 'node:test';
import assert from 'node:assert/strict';
import { LIST_LIMITS, markdownListRanges } from '../public/markdown-list.js';
import { previewBlocks, renderPreview } from '../public/preview.js';
import { createWordPressArticle } from '../public/wordpress-export.js';
import { createFormattedArticle, createReadingPage } from '../public/html-export.js';
import { reviewWordPress } from '../public/wordpress-review.js';
import { wordPressKitFiles } from '../public/wordpress-kit.js';
import { QUICK_SAMPLE, QUICK_LIST_SAMPLE } from '../public/quick-sample.js';

test('Ordinary flat lists retain their existing shape and bullet styles can mix', () => {
  assert.deepEqual(previewBlocks('- One\n* Two\n+ Three'), [{ type: 'ul', items: ['One', 'Two', 'Three'] }]);
  assert.deepEqual(previewBlocks('1. One\n2. Two'), [{ type: 'ol', items: ['One', 'Two'] }]);
  assert.deepEqual(previewBlocks('1) One\n1) Two'), [{ type: 'ol', items: ['One', 'Two'] }]);
  assert.deepEqual(previewBlocks('- Bullet\n4. Step\n5. Next'), [{ type: 'ul', items: ['Bullet'] }, { type: 'ol', items: ['Step', 'Next'], start: 4 }]);
});

test('Mixed nested lists keep parent-child ownership and ordered starting values', () => {
  const root = previewBlocks(QUICK_LIST_SAMPLE)[0];
  assert.equal(root.type, 'ol'); assert.equal(root.start, 4); assert.equal(root.items.length, 2);
  assert.deepEqual(root.children[0][0].items, ['Compare facts', 'Check links']);
  assert.deepEqual(root.children[0][0].children[0][0].items, ['Keep uncertainty']);
  assert.equal(root.children[1][0].start, 7); assert.equal(root.children[1][0].type, 'ol');
  assert.deepEqual(reviewWordPress({ body: QUICK_LIST_SAMPLE }).findings, []);
  const mixed = previewBlocks('- Parent\n  - Bullet\n  3. Step\n  4. Next\n- Sibling')[0];
  assert.deepEqual(mixed.children[0].map(child => child.type), ['ul', 'ol']);
  assert.equal(mixed.children[0][1].start, 3); assert.equal(mixed.items[1], 'Sibling');
});

test('Two- and four-space nesting, outdenting, and multiple root groups are deterministic', () => {
  const body = '- Root\n    - Child\n      - Grandchild\n    - Child sibling\n- Root sibling\n\n6. New group';
  const blocks = previewBlocks(body);
  assert.equal(blocks.length, 2); assert.equal(blocks[1].start, 6);
  assert.deepEqual(blocks[0].items, ['Root', 'Root sibling']);
  assert.deepEqual(blocks[0].children[0][0].items, ['Child', 'Child sibling']);
  assert.equal(blocks[0].children[0][0].children[0][0].items[0], 'Grandchild');
  assert.deepEqual(previewBlocks('- Root\n## Heading').map(b => b.type), ['ul', 'h4']);
});

test('Numbered lists preserve zero and non-1 starts without accepting inconsistent numbering', () => {
  for (const start of [0, 4, 73, 999999998]) {
    const body = `${start}. First\n${start + 1}. Second`, html = createWordPressArticle({ body }).html;
    assert.equal(previewBlocks(body)[0].start, start);
    assert.ok(html.includes('"start":' + start)); assert.ok(html.includes('start="' + start + '"'));
    assert.ok(!reviewWordPress({ body }).findings.some(f => f.kind === 'list-start'));
  }
  for (const body of ['4. First\n6. Keep six', '2. First\n2. Keep two', '1. First\n3. Keep three']) {
    assert.deepEqual(previewBlocks(body), [{ type: 'p', text: body }]);
    assert.match(reviewWordPress({ body }).findings.find(f => f.kind === 'list').message, /Inconsistent numbers stay intact/);
  }
});

test('Invalid indentation, empty items, tabs, and multiline blocks retain the complete candidate', () => {
  for (const body of ['- Parent\n - One-space child', '- Parent\n   - Three-space child', '- Parent\n    - Child\n  - Inconsistent outdent', '- Parent\n\t- Tab child', '- Parent\n  Continued prose\n- Last', '- Parent\n- \n- Last', '- Parent\n  ```\n  <script>literal()</script>\n  ```\n- Last', '- Parent\n1000000000. Too many digits']) {
    assert.deepEqual(previewBlocks(body), [{ type: 'p', text: body }]);
    const findings = reviewWordPress({ body }).findings;
    assert.equal(findings.filter(f => f.kind === 'list').length, 1);
    const html = createWordPressArticle({ body }).html;
    assert.doesNotMatch(html, /<!-- wp:list(?: |-| -->)/);
    assert.match(html, /Parent/);
  }
});

test('Depth and item limits accept the boundary and keep every item on rejection', () => {
  const depth = n => Array.from({ length: n }, (_, i) => '  '.repeat(i) + '- Level ' + (i + 1)).join('\n');
  assert.equal(previewBlocks(depth(LIST_LIMITS.depth))[0].type, 'ul');
  const deep = depth(LIST_LIMITS.depth + 1);
  assert.deepEqual(previewBlocks(deep), [{ type: 'p', text: deep }]);
  assert.match(reviewWordPress({ body: deep }).findings.find(f => f.kind === 'list').message, /six-level/);
  const items = Array.from({ length: 200 }, (_, i) => '- Item ' + i).join('\n');
  assert.equal(previewBlocks(items)[0].items.length, 200);
  const excess = items + '\n- LAST ITEM';
  assert.deepEqual(previewBlocks(excess), [{ type: 'p', text: excess }]);
  assert.match(createWordPressArticle({ body: excess }).html, /LAST ITEM/);
  assert.match(reviewWordPress({ body: excess }).findings.find(f => f.kind === 'list').message, /200-item/);
  assert.throws(() => markdownListRanges('x'.repeat(60001)));
});

test('Code fences, quoted lists, and orphan indentation stay outside nested-list conversion', () => {
  for (const body of ['~~~md\n' + QUICK_LIST_SAMPLE + '\n~~~', QUICK_LIST_SAMPLE.split('\n').map(line => '> ' + line).join('\n'), '  - Orphan', '\\- Literal']) {
    assert.ok(!previewBlocks(body).some(b => b.items)); assert.equal(markdownListRanges(body).length, 0);
  }
  assert.match(reviewWordPress({ body: '  - Orphan' }).findings[0].message, /no supported parent/);
});

test('Rejected-group findings select the original Unicode/CRLF header and do not mutate source', () => {
  const draft = { body: '日本語 😀\r\n\r\n4. Keep this line\r\n  - Child\r\n6. Keep six' }, before = JSON.stringify(draft);
  const finding = reviewWordPress(draft).findings.find(f => f.kind === 'list');
  assert.equal(finding.line, 3); assert.equal(draft.body.slice(finding.start, finding.end), '4. Keep this line');
  assert.equal(JSON.stringify(draft), before);
  assert.equal(markdownListRanges(draft.body)[0].end, draft.body.length);
});

test('Native WordPress list blocks preserve every nested item and keep private fields separate', () => {
  const draft = { body: QUICK_LIST_SAMPLE, title: 'PRIVATE TITLE', questions: ['PRIVATE QUESTION'], source: { notes: 'PRIVATE SOURCE' } };
  const result = createWordPressArticle(draft);
  assert.equal(result.blockCount, 1); assert.deepEqual(result.notices, []);
  assert.equal((result.html.match(/<!-- wp:list-item -->/g) || []).length, 7);
  assert.equal((result.html.match(/<!-- wp:list(?: | -->)/g) || []).length, 4);
  assert.match(result.html, /<li>Compare facts<!-- wp:list -->/);
  assert.match(result.html, /<ol class="wp-block-list" start="7">/);
  assert.doesNotMatch(result.html, /PRIVATE/);
});

test('Unsafe content in nested items stays inert and task checkboxes remain reviewable text', () => {
  const body = '- Parent\n  + <script>bad()</script>\n  + ![img](https://example.test/a.png)\n  + [bad](javascript:bad())\n  + [safe](https://example.test/)\n  + [x] Task\n- <!-- wp:html -->';
  const html = createWordPressArticle({ body }).html;
  assert.doesNotMatch(html, /<script|<img|<!-- wp:html|href="javascript:|\ssrc=|\son\w+=/);
  assert.match(html, /&lt;script&gt;/); assert.match(html, /<li>\[x\] Task/);
  assert.match(html, /href="https:\/\/example.test\/" target="_blank" rel="noopener noreferrer"/);
  for (const kind of ['html', 'image', 'link', 'task-list']) assert.ok(reviewWordPress({ body }).findings.some(f => f.kind === kind));
  assert.ok(!reviewWordPress({ body }).findings.some(f => ['list', 'nested-list'].includes(f.kind)));
});

test('Formatted and reading exports preserve nesting and numbered starts, including plain-text fallback', () => {
  const draft = { title: 'A fictional checklist', body: QUICK_LIST_SAMPLE }, formatted = createFormattedArticle(draft);
  assert.match(formatted.html, /<ol start="4"><li>Inspect the article<ul>/);
  assert.match(formatted.html, /<li>Prepare the handoff<ol start="7">/);
  assert.equal(formatted.text, '4. Inspect the article\n  - Compare facts\n    - Keep uncertainty\n  - Check links\n5. Prepare the handoff\n  7. Paste the blocks\n  8. Preview the post');
  const reading = createReadingPage(draft); assert.match(reading, /ul,ol\{padding-left:1\.35rem\}/); assert.match(reading, /<ol start="7">/);
  assert.doesNotMatch(reading, /<script|<img|<iframe/);
});

test('Publishing kits preserve exact original hierarchy and exclude private workspace material', () => {
  const body = QUICK_LIST_SAMPLE.replaceAll('\n', '\r\n') + '\r\n', draft = { ...QUICK_SAMPLE, body, source: { notes: 'PRIVATE SOURCE' }, questions: ['PRIVATE QUESTION'] };
  const before = JSON.stringify(draft), files = wordPressKitFiles(draft).files;
  assert.equal(files.find(f => f.name === 'article-body.md').content, body);
  assert.match(files.find(f => f.name === 'wordpress-blocks.html').content, /"start":4/);
  assert.match(files.find(f => f.name === 'reading-page.html').content, /<ol start="4">/);
  assert.ok(files.every(f => !/PRIVATE SOURCE|PRIVATE QUESTION/.test(f.content)));
  assert.equal(JSON.stringify(draft), before);
});

test('Preview builds semantic lists beneath their parent items and removes stale hierarchy', () => {
  const oldDocument = globalThis.document;
  const make = tag => ({ tag, children: [], attrs: {}, textContent: '', append(...nodes) { this.children.push(...nodes); }, replaceChildren(...nodes) { this.children = nodes; }, setAttribute(name, value) { this.attrs[name] = value; } });
  const target = make('target'), walk = node => [node, ...node.children?.flatMap(walk) || []];
  globalThis.document = { createElement: make, createTextNode: text => ({ tag: 'text', textContent: text }), createDocumentFragment: () => make('fragment') };
  try {
    renderPreview(target, 'Test', QUICK_LIST_SAMPLE);
    const nodes = walk(target);
    assert.equal(nodes.filter(n => n.tag === 'li').length, 7);
    assert.deepEqual(nodes.filter(n => n.tag === 'ol').map(n => n.attrs.start), ['4', '7']);
    assert.ok(nodes.filter(n => n.tag === 'li').some(n => n.children.some(c => c.tag === 'ul')));
    renderPreview(target, '', 'Changed article.'); assert.ok(!walk(target).some(n => n.tag === 'li'));
  } finally { globalThis.document = oldDocument; }
});
