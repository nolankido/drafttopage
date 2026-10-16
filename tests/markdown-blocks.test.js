import test from 'node:test';
import assert from 'node:assert/strict';
import { thematicBreak, setextLevel } from '../public/markdown-block-syntax.js';
import { previewBlocks, previewPassages, renderPreviewBlock } from '../public/preview.js';
import { articleStructure, analyzeDraft, articleWordCount } from '../public/draft-review.js';
import { articleSections, moveArticleSection } from '../public/article-sections.js';
import { parseArticleImport } from '../public/article-import.js';
import { createHTMLSource, createFormattedArticle, createReadingPage } from '../public/html-export.js';
import { createWordPressArticle } from '../public/wordpress-export.js';
import { createWordDocument, wordDocumentParts } from '../public/word-export.js';
import { prepareExportPreview } from '../public/export-preview.js';
import { reviewExport } from '../public/export-review.js';
import { createArticleMarkdown } from '../public/article-markdown.js';
import { createWorkspaceBackup } from '../public/workspace.js';
import { fixture, para, convert, python } from './docx-fixtures.js';

const draft = body => ({ title: 'Separate title', body, excerpt: '', description: '', slug: 'fictional-blocks', questions: ['PRIVATE_REVIEW'] });

test('Thematic breaks require three identical markers with bounded indentation', () => {
  for (const line of ['---', '***', '___', ' - - - ', '  *\t* *', '   _____\r']) assert.equal(thematicBreak(line), true, line);
  for (const line of ['', '--', '*_*', '- - x -', '    ---', '\t***', '\\---', 'text ---', '-\n--']) assert.equal(thematicBreak(line), false, line);
  for (const line of ['=', '=== ', '   ==\t\r']) assert.equal(setextLevel(line), 1);
  for (const line of ['-', '--', '   ---- ']) assert.equal(setextLevel(line), 2);
  for (const line of ['- - -', '=== x', '    ===', '\\===']) assert.equal(setextLevel(line), 0);
});

test('Underlines complete ordinary multiline paragraphs before separator recognition', () => {
  const blocks = previewBlocks('First line\nsecond **line**\n===\n\nSection\n---\n\n---\n\nEnding.');
  assert.deepEqual(blocks.map(b => [b.level || b.type, b.text]), [[1, 'First line\nsecond **line**'], [2, 'Section'], ['hr', ''], ['p', 'Ending.']]);
  assert.equal(articleWordCount('First line\n===\n\n***\n\nLast word.'), 4);
  assert.equal(previewBlocks('A paragraph.\n\n---')[1].type, 'hr');
  assert.equal(previewBlocks('A paragraph.\n---')[0].level, 2);
});

test('Fences, container content, escaped markers and HTML cannot become underlined headings', () => {
  for (const body of ['```md\nFictional\n===\n***\n```', '> Fictional\n> ===', '- Fictional\n  ===', '    Fictional\n===', '<div>Fictional</div>\n===', '[ref]: https://example.com\n===', 'Fictional\n\\===']) assert.ok(!previewBlocks(body).some(b => b.headingStyle === 'setext'), body);
  const list = previewBlocks('- First\n- Second\n***\nEnding.');
  assert.deepEqual(list.map(b => b.type), ['ul', 'hr', 'p']);
  const table = previewBlocks('| Name |\n| --- |\n| Fictional |');
  assert.equal(table[0].type, 'table'); assert.equal(table.length, 1);
});

test('CRLF and Unicode source ranges include the full heading and preserve inline finding offsets', () => {
  const body = 'Opening 😀.\r\n\r\n  Café 😀\r\n[Read](https://example.com) TODO\r\n---\r\n\r\n***\r\n\r\nEnding.';
  const passages = previewPassages(body), heading = passages[1], structure = articleStructure(body), review = analyzeDraft(draft(body));
  assert.equal(body.slice(heading.start, heading.end), '  Café 😀\r\n[Read](https://example.com) TODO\r\n---\r');
  assert.deepEqual([heading.line, heading.endLine], [3, 5]);
  assert.equal(structure.find(b => b.kind === 'heading').text, 'Café 😀\r\n[Read](https://example.com) TODO');
  const placeholder = review.findings.find(f => f.kind === 'placeholder');
  assert.equal(body.slice(placeholder.start, placeholder.end), 'TODO'); assert.equal(placeholder.line, 4);
  assert.equal(body.slice(review.links[0].start, review.links[0].end), '[Read](https://example.com)');
  assert.equal(structure.find(b => b.kind === 'separator').line, 7);
});

test('Underlined and mixed sections move reversibly with complete heading selection', () => {
  for (const newline of ['\n', '\r\n']) for (const tail of ['', newline, newline + newline]) {
    const body = ['Intro.', '', 'First 😀', '---', 'One.', '', '## Second', 'Two.'].join(newline) + tail;
    const second = articleSections(body).sections[1], moved = moveArticleSection(body, second.start, 'up');
    assert.equal(moved.body.length, body.length);
    assert.equal(moved.body.slice(moved.selectionStart, moved.selectionEnd).replace(/\r$/, ''), '## Second');
    assert.equal(moveArticleSection(moved.body, moved.selectionStart, 'down').body, body);
    const first = articleSections(moved.body).sections[1], back = moveArticleSection(moved.body, first.start, 'up');
    assert.equal(back.body.slice(back.selectionStart, back.selectionEnd).replace(/\r$/, ''), 'First 😀' + newline + '---');
  }
});

test('A move that absorbs surrounding text into an underlined heading rejects without rewriting', () => {
  const body = '## First\nText.\n\nSecond\n---\nEnding.\n## Third\nLast.';
  assert.throws(() => moveArticleSection(body, body.indexOf('Second'), 'down'), /Add blank lines/);
  assert.equal(body, '## First\nText.\n\nSecond\n---\nEnding.\n## Third\nLast.');
});

test('Markdown imports extract opening underlined H1 titles and retain conflicts and H2', () => {
  const parsed = parseArticleImport('A fictional\nmultiline title\n===\n\nEnding.', 'fictional.md');
  assert.equal(parsed.draft.title, 'A fictional multiline title'); assert.equal(parsed.draft.body, 'Ending.');
  const conflict = parseArticleImport('---\ntitle: Different\n---\n\nFictional\n===\n\nEnding.');
  assert.equal(conflict.draft.title, 'Different'); assert.match(conflict.draft.body, /^Fictional\n===/);
  assert.match(conflict.warnings.join(' '), /differs/);
  assert.equal(parseArticleImport('Fictional\n---\n\nEnding.').draft.title, '');
  assert.throws(() => parseArticleImport('x'.repeat(161) + '\n===\n\nEnding.'));
  assert.throws(() => parseArticleImport('---\nEnding.'), /front-matter block is not closed/);
  assert.equal(parseArticleImport('***\n\nEnding.').draft.body, '***\n\nEnding.');
});

test('HTML and WordPress emit native heading and separator structures without false warnings', () => {
  const value = draft('Overview\n===\n\nOpening **words**.\n\n***\n\nDetails\n---\n\nEnding.'), original = structuredClone(value);
  const html = createHTMLSource(value), wp = createWordPressArticle(value);
  assert.match(html, /^<h2>Overview<\/h2>/); assert.match(html, /<hr>\n<h2>Details<\/h2>/);
  assert.equal(wp.blockCount, 5); assert.match(wp.html, /<!-- wp:separator -->\n<hr class="wp-block-separator has-alpha-channel-opacity"\/>\n<!-- \/wp:separator -->/);
  assert.equal(wp.notices.length, 1); assert.match(wp.notices[0], /H1 headings become H2/);
  assert.match(createFormattedArticle(value).text, /Opening words\.\n\n---\n\nDetails/);
  assert.match(createReadingPage(value), /<hr>/);
  for (const destination of ['word', 'html']) assert.ok(!reviewExport(value, { destination }).findings.some(f => ['setext', 'separator'].includes(f.kind)));
  assert.deepEqual(value, original);
});

test('Destination previews preserve separators and destination-specific heading levels', () => {
  const value = draft('Overview\n===\n\n***\n\nEnding.');
  for (const destination of ['word', 'html', 'wordpress']) {
    const model = prepareExportPreview(value, { destination });
    assert.equal(model.blocks[0].exportLevel, destination === 'word' ? 1 : 2); assert.equal(model.blocks[1].type, 'hr');
  }
  const previous = globalThis.document;
  try { globalThis.document = { createElement: type => ({ type }) }; assert.equal(renderPreviewBlock({ type: 'hr' }).type, 'hr'); }
  finally { globalThis.document = previous; }
});

test('Word dividers are native paragraph borders in an independently readable safe ZIP', () => {
  const bytes = createWordDocument(draft('Heading\n===\n\n***\n\nEnding.'));
  const parsed = python('import sys,json,io,zipfile,xml.etree.ElementTree as E\nz=zipfile.ZipFile(io.BytesIO(bytes(json.load(sys.stdin))))\nassert z.testzip() is None\nw="{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"\nd=E.fromstring(z.read("word/document.xml"))\nprint(json.dumps({"parts":len(z.namelist()),"borders":[n.attrib for n in d.findall(".//"+w+"pBdr/"+w+"bottom")],"texts":[n.text for n in d.findall(".//"+w+"t")]}))', Array.from(bytes));
  assert.equal(parsed.parts, 6); assert.equal(parsed.borders.length, 1); assert.ok(parsed.texts.includes('Ending.'));
  assert.doesNotMatch(parsed.texts.join(' '), /\*\*\*|PRIVATE/);
  const parts = Object.fromEntries(wordDocumentParts(draft('Heading\n===\n\n***\n\nEnding.')).map(p => [p.name, p.content]));
  const imported = convert(parts);
  assert.match(imported.markdown, /# Heading\n\n\*\*\*\n\nEnding/); assert.match(imported.warnings.join(' '), /bottom border/);
});

test('Word border conversion remains narrow and discloses omitted border styling', () => {
  const border = '<w:pBdr><w:bottom w:val="single"/></w:pBdr>';
  const text = convert(fixture(para('Fictional text', border)));
  assert.doesNotMatch(text.markdown, /\*\*\*/); assert.match(text.warnings.join(' '), /borders were not retained/);
  const box = convert(fixture(para('', '<w:pBdr><w:top w:val="single"/><w:bottom w:val="single"/></w:pBdr>') + para('Ending.')));
  assert.doesNotMatch(box.markdown, /\*\*\*/);
  assert.throws(() => convert(fixture('<w:tbl><w:tr><w:tc>' + para('', border) + '</w:tc></w:tr></w:tbl>')), /separator inside a table cell/);
});

test('Original Markdown and private workspace recovery retain the exact authored source', () => {
  const body = 'Heading 😀\r\n===\r\n\r\n  * * *\r\n\r\nEnding.', value = draft(body);
  assert.equal(createArticleMarkdown(value), body + '\n');
  const backup = JSON.parse(createWorkspaceBackup({ profile: 'guide', audience: '', purpose: '', notes: 'PRIVATE_SOURCE' }, value));
  assert.equal(backup.draft.body, body);
  for (const text of [createHTMLSource(value), createWordPressArticle(value).html, ...wordDocumentParts(value).map(p => p.content)]) assert.doesNotMatch(text, /PRIVATE_SOURCE|PRIVATE_REVIEW/);
});

test('Maximum-size inputs keep literal endings and bounded source positions', () => {
  const prefix = '    Literal\n' + '=\n'.repeat(20000), body = prefix + 'x'.repeat(60000 - prefix.length - 8) + '\nENDING.';
  assert.equal(body.length, 60000);
  const passages = previewPassages(body); assert.equal(passages.length, 1); assert.ok(passages[0].blocks[0].text.endsWith('ENDING.'));
  assert.ok(!articleStructure(body).some(b => b.kind === 'heading'));
  assert.throws(() => previewPassages(body + 'x'), /60,000/);
});
