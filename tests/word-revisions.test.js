import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectWordTextRevisions, MAX_WORD_TEXT_REVISIONS } from '../public/word-revisions.js';
import { parseArticleImport } from '../public/article-import.js';
import { createWorkspaceBackup, parseWorkspaceBackup } from '../public/workspace.js';
import { createWordPressArticle } from '../public/wordpress-export.js';
import { wordTreesToMarkdown } from '../public/docx-import.js';
import { fixture, para, run, word, trees, create, convert, R } from './docx-fixtures.js';
import { notesFixture, note } from './word-note-fixtures.js';
import { insertion, deletion, revisionFixture, proposedBody, previousBody } from './word-revision-fixtures.js';

test('Tracked text requires a deliberate version, and both versions have independently expected exact bodies', () => {
  assert.throws(() => convert(revisionFixture()), /Unresolved tracked changes/);
  const parts = trees(revisionFixture()), original = JSON.stringify([...parts]);
  for (const [mode, body] of [['proposed', proposedBody], ['previous', previousBody]]) {
    const converted = wordTreesToMarkdown(parts, { textRevisions: mode }, create);
    const article = parseArticleImport(converted.markdown).draft;
    assert.equal(article.title, 'Fictional version review'); assert.equal(article.body, body);
    assert.deepEqual(converted.wordRevisions, { mode, insertions: 2, deletions: 2 });
    assert.equal(JSON.stringify([...parts]), original);
    assert.match(converted.warnings.join(' '), /2 tracked text insertion group/);
    assert.match(converted.warnings.join(' '), /not a Word revision review or a historical original/);
    assert.doesNotMatch(JSON.stringify(converted), /Fictional reviewer|2026-10-16/);
  }
});
test('Inline revisions in safe hyperlink labels keep the target and their inherited formatting', () => {
  const rels = '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="link" Type="' + R + '/hyperlink" Target="https://example.invalid/guide" TargetMode="External"/></Relationships>';
  const source = fixture('<w:p><w:hyperlink r:id="link">' + deletion('Previous label') + insertion('Proposed label', '<w:b/>') + '</w:hyperlink></w:p>', { 'word/_rels/document.xml.rels': rels });
  assert.equal(convert(source, { textRevisions: 'proposed' }).markdown, '[**Proposed label**](https://example.invalid/guide)');
  assert.equal(convert(source, { textRevisions: 'previous' }).markdown, '[Previous label](https://example.invalid/guide)');
});
test('Hidden revised runs and literal hostile text keep the established visibility and inert-export behavior', () => {
  const source = fixture('<w:p>' + run('Visible ') + deletion('PRIVATE_HIDDEN_OLD', '<w:vanish/>') + insertion('PRIVATE_HIDDEN_NEW', '<w:vanish/>') + deletion('&lt;script&gt;old()&lt;/script&gt;') + insertion('&lt;script&gt;new()&lt;/script&gt;') + '</w:p>');
  for (const mode of ['proposed', 'previous']) {
    const converted = convert(source, { textRevisions: mode });
    assert.doesNotMatch(converted.markdown, /PRIVATE_HIDDEN/);
    const html = createWordPressArticle({ body: converted.markdown }).html;
    assert.match(html, /&lt;script&gt;/); assert.doesNotMatch(html, /<script>/);
    assert.match(converted.warnings.join(' '), /hidden text/);
  }
});
test('Moves, paragraph marks, formatting, table changes and nested revisions remain blocked in either version', () => {
  const snippets = [
    '<w:p><w:pPr><w:rPr><w:del/></w:rPr></w:pPr>' + run('Paragraph mark') + '</w:p>',
    '<w:p><w:r><w:rPr><w:rPrChange/></w:rPr><w:t>Formatting</w:t></w:r></w:p>',
    '<w:p><w:moveFrom>' + run('Moved') + '</w:moveFrom></w:p>',
    '<w:p><w:moveToRangeStart/>' + run('Moved') + '<w:moveToRangeEnd/></w:p>',
    '<w:tbl><w:tr><w:trPr><w:ins/></w:trPr></w:tr></w:tbl>',
    '<w:p><w:ins>' + insertion('Nested') + '</w:ins></w:p>',
    '<w:ins>' + para('Block wrapper') + '</w:ins>',
    '<w:p><w:customXmlDelRangeStart/>' + run('Range') + '</w:p>',
    '<w:p><w:ins><w:r><w:delText>Wrong text kind</w:delText></w:r></w:ins></w:p>',
    '<w:p><w:del><w:r><w:t>Wrong text kind</w:t></w:r></w:del></w:p>',
    '<w:p><w:ins>Loose text' + run('Wrapped') + '</w:ins></w:p>',
    '<w:p><w:r><w:delText>Orphaned deleted text</w:delText></w:r></w:p>'
  ];
  for (const snippet of snippets) for (const mode of ['proposed', 'previous']) assert.throws(() => convert(fixture(snippet), { textRevisions: mode }), /Resolve complex revisions/, snippet);
});
test('Unsupported content is validated even in a revision the selected version would omit', () => {
  for (const tag of ['ins', 'del']) for (const content of ['<w:fldChar/>', '<w:drawing/>', '<w:footnoteReference w:id="7"/>', '<w:commentReference w:id="2"/>', '<w:instrText>FIELD</w:instrText>', '<w:t><w:r/></w:t>']) {
    const source = fixture('<w:p>' + run('Unchanged') + '<w:' + tag + '><w:r>' + content + '</w:r></w:' + tag + '></w:p>');
    for (const mode of ['proposed', 'previous']) assert.throws(() => convert(source, { textRevisions: mode }), /Resolve complex revisions/);
  }
});
test('Note and style revisions are refused rather than being silently flattened', () => {
  for (const mode of ['proposed', 'previous']) {
    assert.throws(() => convert(notesFixture(undefined, note(7, '<w:p>' + insertion('Note revision') + '</w:p>')), { textRevisions: mode }), /main article/);
    assert.throws(() => convert(fixture(para('Body'), { 'word/styles.xml': word('styles', '<w:style w:styleId="Changed"><w:rPr><w:rPrChange/></w:rPr></w:style>') }), { textRevisions: mode }), /main article/);
  }
});
test('Revision group, XML complexity, version and article bounds reject before returning a partial article', () => {
  const source = count => fixture('<w:p>' + run('Kept ') + Array.from({ length: count }, () => insertion('x')).join('') + '</w:p>');
  assert.equal(convert(source(MAX_WORD_TEXT_REVISIONS), { textRevisions: 'proposed' }).wordRevisions.insertions, 200);
  assert.throws(() => convert(source(MAX_WORD_TEXT_REVISIONS + 1), { textRevisions: 'previous' }), /at most 200/);
  assert.throws(() => convert(fixture('<w:p>' + insertion('x'.repeat(60001)) + '</w:p>'), { textRevisions: 'proposed' }), /60,000|limit/);
  assert.throws(() => inspectWordTextRevisions(trees(fixture()), 'accept-all'), /valid Word text revision/);
  let deep = run('x'); for (let index = 0; index < 42; index++) deep = '<w:unknown>' + deep + '</w:unknown>';
  assert.throws(() => convert(fixture(deep), { textRevisions: 'proposed' }), /too complex/);
});
test('Unchanged documents preserve their output, and private backup/export schemas retain only the chosen article', () => {
  const plain = fixture(para('Unchanged article.'));
  for (const mode of ['require-clean', 'proposed', 'previous']) assert.equal(convert(plain, { textRevisions: mode }).markdown, 'Unchanged article\\.');
  const draft = parseArticleImport(convert(revisionFixture(), { textRevisions: 'proposed' }).markdown).draft;
  const backup = createWorkspaceBackup({ profile: 'personal', notes: 'Private source', audience: '', purpose: '' }, draft);
  assert.equal(parseWorkspaceBackup(backup).draft.body, proposedBody);
  assert.doesNotMatch(backup, /wordRevisions|textRevisions|Fictional reviewer|A retired sentence/);
});
