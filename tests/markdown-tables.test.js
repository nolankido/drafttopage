import test from 'node:test';
import assert from 'node:assert/strict';
import { TABLE_LIMITS, tableCells, markdownTableRanges } from '../public/markdown-table.js';
import { previewBlocks, renderPreview } from '../public/preview.js';
import { createWordPressArticle } from '../public/wordpress-export.js';
import { createFormattedArticle, createReadingPage } from '../public/html-export.js';
import { reviewWordPress } from '../public/wordpress-review.js';
import { wordPressKitFiles } from '../public/wordpress-kit.js';
import { QUICK_SAMPLE, QUICK_TABLE_SAMPLE } from '../public/quick-sample.js';

const sample = '| Name | Count | Status |\n| :--- | ---: | :---: |\n| **Alpha** | 2 | Ready |\n| Beta \\| Gamma | 3 | `A\\|B` |';
test('Pipe tables preserve cells, headers, column alignment, inline code, and escaped pipes', () => {
  const blocks = previewBlocks('Before.\n\n' + sample + '\n\nAfter.');
  assert.deepEqual(blocks.map(b => b.type), ['p', 'table', 'p']);
  assert.deepEqual(blocks[1].head, ['Name', 'Count', 'Status']);
  assert.deepEqual(blocks[1].align, ['left', 'right', 'center']);
  assert.deepEqual(blocks[1].rows, [['**Alpha**', '2', 'Ready'], ['Beta | Gamma', '3', '`A|B`']]);
  assert.deepEqual(reviewWordPress({ body: sample }).findings, []);
  assert.deepEqual(tableCells('a | b'), ['a', 'b']);
  assert.deepEqual(tableCells('| empty | |'), ['empty', '']);
  assert.deepEqual(tableCells('| a\\\\| b |'), ['a\\\\', 'b']);
  assert.deepEqual(tableCells('| a\\\\\\| b |'), ['a\\\\| b']);
});

test('Optional outer pipes, header-only and one-column tables, Unicode, and CRLF are supported', () => {
  assert.deepEqual(previewBlocks('Name | 数\r\n--- | ---:\r\n日本語 😀 | 2')[0].rows, [['日本語 😀', '2']]);
  assert.deepEqual(previewBlocks('| One |\n| --- |')[0].rows, []);
  assert.deepEqual(previewBlocks('| One |\n| --- |\n|  |')[0].rows, [['']]);
  const html = createWordPressArticle({ body: '| One |\n| --- |' }).html;
  assert.match(html, /<thead><tr><th scope="col">One<\/th><\/tr><\/thead><\/table>/);
  assert.doesNotMatch(html, /<tbody/);
});

test('Mismatched and short-delimiter tables stay complete literal text and receive an exact finding', () => {
  for (const body of ['| A | B |\n| --- |\n| ONE | TWO | THREE |', '| A | B |\n| --- | --- |\n| ONE |', '| A | B |\n| -- | --- |\n| ONE | TWO |', '| A | B |\n| --- | --- |\n    | ONE | TWO |']) {
    assert.deepEqual(previewBlocks(body), [{ type: 'p', text: body }]);
    const result = createWordPressArticle({ body });
    assert.doesNotMatch(result.html, /<!-- wp:table/);
    assert.match(result.html, /ONE/);
    assert.equal(reviewWordPress({ body }).findings.filter(f => f.kind === 'table').length, 1);
  }
  const body = '日本語 😀\r\n\r\n| 名前 | 数 |\r\n| --- | --- |\r\n| A | 1 | EXTRA |';
  const finding = reviewWordPress({ body }).findings.find(f => f.kind === 'table');
  assert.equal(finding.line, 3); assert.equal(body.slice(finding.start, finding.end), '| 名前 | 数 |');
  assert.match(finding.message, /no cells are dropped or invented/);
});

test('Table bounds accept the limit and reject excess without partial conversion or discarded source', () => {
  const rows = '| A | B |\n| --- | --- |\n' + Array(TABLE_LIMITS.rows).fill('| Keep | me |').join('\n');
  assert.equal(previewBlocks(rows)[0].rows.length, 100);
  const excess = rows + '\n| LAST | ROW |';
  assert.deepEqual(previewBlocks(excess), [{ type: 'p', text: excess }]);
  assert.match(reviewWordPress({ body: excess }).findings.find(f => f.kind === 'table').message, /100-data-row/);
  for (const columns of [12, 13]) {
    const body = '|' + Array(columns).fill('H').join('|') + '|\n|' + Array(columns).fill('---').join('|') + '|\n|' + Array(columns).fill('V').join('|') + '|';
    assert.equal(previewBlocks(body)[0].type, columns === 12 ? 'table' : 'p');
  }
  assert.throws(() => markdownTableRanges('x'.repeat(12001)));
});

test('Code fences, quoted and indented tables, block markers, and escaped prose are not converted', () => {
  for (const body of ['~~~md\n' + sample + '\n~~~', sample.split('\n').map(l => '> ' + l).join('\n'), sample.split('\n').map(l => '    ' + l).join('\n'), '# A | B\n--- | ---', 'a\\|b\n---\\|---']) {
    assert.ok(!previewBlocks(body).some(b => b.type === 'table'));
    assert.equal(markdownTableRanges(body).length, 0);
  }
  assert.deepEqual(previewBlocks(sample + '\n## Next heading').map(b => b.type), ['table', 'h4']);
  assert.deepEqual(previewBlocks(sample + '\nText outside the table.').map(b => b.type), ['table', 'p']);
});

test('WordPress tables are native blocks with accessible headers and safe aligned cells', () => {
  const result = createWordPressArticle({ body: sample, title: 'PRIVATE TITLE', source: { notes: 'PRIVATE SOURCE' } });
  assert.equal(result.blockCount, 1); assert.deepEqual(result.notices, []);
  assert.match(result.html, /<!-- wp:table {"hasFixedLayout":true} -->\n<figure class="wp-block-table"><table class="has-fixed-layout">/);
  assert.match(result.html, /<th scope="col" class="has-text-align-right" data-align="right">Count<\/th>/);
  assert.match(result.html, /<strong>Alpha<\/strong>/); assert.match(result.html, /<code>A\|B<\/code>/);
  assert.doesNotMatch(result.html, /PRIVATE/);
});

test('Table cells never execute source HTML, block comments, images, or unsafe links', () => {
  const body = '| Content | Other |\n| --- | --- |\n| <script>bad()</script> | ![img](https://example.test/a.png) |\n| <!-- wp:html --> | [bad](javascript:bad()) |\n| [safe](https://example.test/?a=1&b=2) | **bold** |';
  const html = createWordPressArticle({ body }).html;
  assert.doesNotMatch(html, /<script|<img|<!-- wp:html|href="javascript:|\son\w+=|\ssrc=/);
  assert.match(html, /&lt;script&gt;bad\(\)&lt;\/script&gt;/);
  assert.match(html, /href="https:\/\/example.test\/\?a=1&amp;b=2" target="_blank" rel="noopener noreferrer"/);
  const findings = reviewWordPress({ body }).findings;
  for (const kind of ['html', 'image', 'link']) assert.ok(findings.some(f => f.kind === kind));
  assert.ok(!findings.some(f => f.kind === 'table'));
});

test('Formatted copies and reading files keep table structure and offer keyboard-scrollable regions', () => {
  const draft = { body: sample, title: 'A fictional table' }, formatted = createFormattedArticle(draft);
  assert.match(formatted.html, /role="region" aria-label="Article table, scroll horizontally if needed" tabindex="0"/);
  assert.match(formatted.html, /<th scope="col"/);
  assert.equal(formatted.text, 'Name\tCount\tStatus\nAlpha\t2\tReady\nBeta | Gamma\t3\tA|B');
  const reading = createReadingPage(draft);
  assert.match(reading, /overflow-x:auto/); assert.match(reading, /\.has-text-align-center\{text-align:center\}/);
  assert.doesNotMatch(reading, /<script|<img|<iframe/);
});

test('Publishing kits preserve exact original table Markdown and exclude private workspace material', () => {
  const body = '  \r\n' + sample.replaceAll('\n', '\r\n') + '\r\n';
  const draft = { ...QUICK_SAMPLE, body, source: { notes: 'PRIVATE SOURCE' }, questions: ['PRIVATE QUESTION'] };
  const before = JSON.stringify(draft), files = wordPressKitFiles(draft).files;
  assert.equal(files.find(f => f.name === 'article-body.md').content, body);
  assert.match(files.find(f => f.name === 'wordpress-blocks.html').content, /<!-- wp:table/);
  assert.match(files.find(f => f.name === 'reading-page.html').content, /<thead>/);
  assert.ok(files.every(f => !/PRIVATE SOURCE|PRIVATE QUESTION/.test(f.content)));
  assert.equal(JSON.stringify(draft), before);
  assert.ok(previewBlocks(QUICK_TABLE_SAMPLE).some(b => b.type === 'table'));
  assert.ok(previewBlocks(QUICK_SAMPLE.body).some(b => b.type === 'table'));
});

test('Live preview creates safe table DOM and replaces stale table nodes', () => {
  const oldDocument = globalThis.document;
  const make = tag => ({ tag, children: [], attrs: {}, textContent: '', append(...nodes) { this.children.push(...nodes); }, replaceChildren(...nodes) { this.children = nodes; }, setAttribute(name, value) { this.attrs[name] = value; } });
  const target = make('target');
  globalThis.document = { createElement: make, createTextNode: text => ({ tag: 'text', textContent: text }), createDocumentFragment: () => make('fragment') };
  const walk = node => [node, ...node.children?.flatMap(walk) || []];
  try {
    renderPreview(target, 'Test', sample);
    const nodes = walk(target), region = nodes.find(n => n.className === 'article-table');
    assert.equal(region.tabIndex, 0); assert.equal(region.attrs.role, 'region');
    assert.equal(nodes.filter(n => n.tag === 'th' && n.attrs.scope === 'col').length, 3);
    assert.equal(nodes.filter(n => n.tag === 'td').length, 6);
    assert.ok(nodes.some(n => n.tag === 'code' && n.textContent === 'A|B'));
    renderPreview(target, '', 'Changed article.');
    assert.ok(!walk(target).some(n => n.tag === 'table'));
  } finally { globalThis.document = oldDocument; }
});
