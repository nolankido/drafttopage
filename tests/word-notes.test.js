import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { run, para, fixture, convert, zip } from './docx-fixtures.js';
import { readDocxXML, inspectDocxArchive } from '../public/docx-archive.js';
import { parseArticleImport } from '../public/article-import.js';
import { createArticleMarkdown } from '../public/article-markdown.js';
import { createHTMLSource } from '../public/html-export.js';
import { createWordPressArticle } from '../public/wordpress-export.js';
import { createWordDocument } from '../public/word-export.js';
import { createWorkspaceBackup, parseWorkspaceBackup } from '../public/workspace.js';

import { notesFixture, ref, note, mark, p, rel, rels } from './word-note-fixtures.js';

test('Word footnotes and endnotes receive separate labels in first-visible-reference order', () => {
  const body = p(run('First') + ref('footnote', 90) + run(' then') + ref('endnote', 90) + run(' next') + ref('footnote', 7) + run(' repeated') + ref('footnote', 90));
  const parts = notesFixture(body, note(7, para('Second footnote.')) + note(90, para('First footnote.')), note(90, para('First endnote.'), 'endnote'));
  const result = convert(parts);
  assert.match(result.markdown, /First\\\[Word footnote 1\\\] then\\\[Word endnote 1\\\] next\\\[Word footnote 2\\\] repeated\\\[Word footnote 1\\\]/);
  assert.ok(result.markdown.indexOf('First footnote') < result.markdown.indexOf('Second footnote'));
  assert.equal((result.markdown.match(/### Word footnote 1/g) || []).length, 1);
  assert.match(result.markdown, /## Imported Word endnotes\n\n### Word endnote 1/);
  assert.match(result.warnings.join(' '), /2 referenced footnotes/); assert.match(result.warnings.join(' '), /1 referenced endnote to/);
  for (const phrase of ['not the original Word numbering', 'included in article exports', 'without automatic numbering', 'recheck labels']) assert.ok(result.warnings.join(' ').includes(phrase));
});

test('Note paragraphs, emphasis, and safe links are retained using each note part\'s relationships', () => {
  const noteText = p(mark('footnote') + run('A ', '<w:b/>') + run('careful source', '<w:b/><w:i/>')) + p('<w:hyperlink r:id="same">' + run('Read the source') + '</w:hyperlink>');
  const parts = notesFixture(p('<w:hyperlink r:id="same">' + run('Main link') + '</w:hyperlink>' + ref()), note(7, noteText));
  parts['word/_rels/document.xml.rels'] = parts['word/_rels/document.xml.rels'].replace('</Relationships>', rel('same', 'hyperlink', 'https://example.com/main', 'External') + '</Relationships>');
  parts['word/_rels/footnotes.xml.rels'] = rels(rel('same', 'hyperlink', 'https://example.com/note', 'External'));
  const result = convert(parts);
  assert.match(result.markdown, /\[Main link\]\(https:\/\/example.com\/main\)/);
  assert.match(result.markdown, /\[Read the source\]\(https:\/\/example.com\/note\)/);
  assert.match(result.markdown, /\*\*\*careful source\*\*\*/);
  assert.match(result.markdown, /careful source\*\*\*\n\n\[Read/);
});

test('Separator content, orphaned notes, and notes reached only by hidden references stay out of the article', () => {
  const parts = notesFixture(p(run('Keep') + ref() + '<w:r><w:rPr><w:vanish/></w:rPr><w:footnoteReference w:id="9"/></w:r>'), note(-1, para('PRIVATE_SEPARATOR'), 'footnote', 'separator') + note(0, para('PRIVATE_CONTINUATION'), 'footnote', 'continuationSeparator') + note(7, para('Visible note')) + note(9, para('PRIVATE_HIDDEN_NOTE')) + note(10, para('PRIVATE_ORPHAN')));
  const result = convert(parts);
  assert.match(result.markdown, /Visible note/); assert.doesNotMatch(result.markdown, /PRIVATE_/);
  assert.match(result.warnings.join(' '), /Unreferenced footnotes were excluded/);
  assert.match(result.warnings.join(' '), /hidden text was omitted/);
  assert.doesNotMatch(convert(notesFixture(para('No note reference'), note(7, para('PRIVATE_UNUSED')))).markdown, /Imported Word|PRIVATE/);
});

test('Missing, separator, duplicate, malformed, and custom-mark references reject before producing an article', () => {
  for (const [body, definitions] of [[p(ref('footnote', 99)), note(7, para('Note'))], [p(ref('footnote', -1)), note(-1, para('Separator'), 'footnote', 'separator')], [p(ref()), note(7, para('One')) + note(7, para('Two'))], [p(ref('footnote', '07')), note(7, para('Note'))], [p(ref('footnote', 7, ' w:customMarkFollows="1"')), note(7, para('Note'))], [p(ref()), note(7, para('Note'), 'footnote', 'unknown')]]) assert.throws(() => convert(notesFixture(body, definitions)), /Unsupported Word notes/);
  assert.throws(() => convert(fixture(p(ref()))), /Unsupported Word notes/);
  assert.match(convert(notesFixture(p(ref('footnote', 0)), note(0, para('Valid zero identifier')))).markdown, /Valid zero identifier/);
});

test('Note parts require exact internal relationships and unambiguous matching content types', () => {
  const base = notesFixture(), linkPath = 'word/_rels/document.xml.rels', typePath = '[Content_Types].xml';
  for (const mutate of [
    parts => { delete parts[linkPath]; },
    parts => { parts[linkPath] = parts[linkPath].replace('Target="footnotes.xml"', 'Target="https://example.com/notes" TargetMode="External"'); },
    parts => { parts[linkPath] = parts[linkPath].replace('Target="footnotes.xml"', 'Target="../footnotes.xml"'); },
    parts => { parts[linkPath] = parts[linkPath].replace('</Relationships>', rel('another', 'footnotes', 'footnotes.xml') + '</Relationships>'); },
    parts => { parts[typePath] = parts[typePath].replace('wordprocessingml.footnotes+xml', 'wordprocessingml.comments+xml'); },
    parts => { parts[typePath] = parts[typePath].replace('</Types>', '<Override PartName="/word/footnotes.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footnotes+xml"/></Types>'); },
    parts => { parts['word/footnotes.xml'] = parts['word/footnotes.xml'].replaceAll('w:footnotes', 'w:endnotes'); },
    parts => { delete parts['word/footnotes.xml']; },
    parts => { parts['word/_rels/endnotes.xml.rels'] = rels(''); }
  ]) { const parts = { ...base }; mutate(parts); assert.throws(() => convert(parts), /notes|relationships/); }
  const absolute = { ...base, [linkPath]: base[linkPath].replace('Target="footnotes.xml"', 'Target="/word/footnotes.xml"') };
  assert.match(convert(absolute).markdown, /A source note/);
});

test('Nested notes, fields, tracked changes, images, lists, tables, and unexpected automatic marks reject', () => {
  for (const content of [p(ref()), p(ref('endnote', 7)), p('<w:r><w:fldChar w:fldCharType="begin"/></w:r>'), p('<w:ins>' + run('Changed') + '</w:ins>'), p('<w:r><w:drawing/></w:r>'), '<w:tbl/>', para('List', '<w:numPr><w:numId w:val="1"/></w:numPr>'), para('Heading', '<w:outlineLvl w:val="1"/>'), p(mark('endnote') + run('Wrong mark')), p(mark('footnote') + mark('footnote') + run('Repeated mark'))]) assert.throws(() => convert(notesFixture(undefined, note(7, content))), /Unsupported|tracked changes|cannot|need review/);
  assert.throws(() => convert(notesFixture(p(mark('footnote') + run('Unexpected body mark')))), /Unexpected/);
});

test('Note and reference limits reject excessive input without truncating it', () => {
  const hundred = Array.from({ length: 100 }, (_, i) => i + 1);
  const result = convert(notesFixture(p(hundred.map(i => ref('footnote', i)).join('')), hundred.map(i => note(i, para('Note ' + i))).join('')));
  assert.match(result.markdown, /### Word footnote 100\n\nNote 100$/);
  const ids = [...hundred, 101];
  assert.throws(() => convert(notesFixture(p(ids.map(i => ref('footnote', i)).join('')), ids.map(i => note(i, para('Note ' + i))).join(''))), /100 referenced/);
  assert.throws(() => convert(notesFixture(p(Array.from({ length: 1001 }, () => ref()).join('')))), /1,000/);
  assert.throws(() => convert(notesFixture(undefined, Array.from({ length: 201 }, (_, i) => note(i, para('Note'))).join(''))), /200 ordinary/);
  assert.throws(() => convert(notesFixture(undefined, note(7, Array.from({ length: 11 }, () => para('Paragraph')).join('')))), /one to ten/);
  assert.throws(() => convert(notesFixture(undefined, note(7, para('x'.repeat(4001))))), /4,000/);
  assert.match(convert(notesFixture(undefined, note(7, para('x'.repeat(4000))))).markdown, /x{4000}$/);
  assert.throws(() => convert(notesFixture(undefined, note(7, para('   ')))), /Word footnote 1: No supported article text|visible text/);
  assert.throws(() => convert(notesFixture(p(run('x'.repeat(59950)) + ref()), note(7, para('KEEP THE ENTIRE NOTE ENDING')))), /60,000/);
});

test('Unsafe note links and hostile text stay inert; absent note relationships never reuse main links', () => {
  const link = '<w:hyperlink r:id="url">' + run('A label') + '</w:hyperlink>';
  const parts = notesFixture(undefined, note(7, p(run('&lt;img src=x&gt; &lt;script&gt;bad()&lt;/script&gt; ') + link)));
  parts['word/_rels/document.xml.rels'] = parts['word/_rels/document.xml.rels'].replace('</Relationships>', rel('url', 'hyperlink', 'https://example.com/WRONG', 'External') + '</Relationships>');
  let result = convert(parts), html = createHTMLSource({ body: result.markdown });
  assert.doesNotMatch(result.markdown, /WRONG/); assert.doesNotMatch(html, /<img|<script/);
  parts['word/_rels/footnotes.xml.rels'] = rels(rel('url', 'hyperlink', 'javascript:alert(1)', 'External'));
  result = convert(parts); assert.doesNotMatch(result.markdown, /javascript:/); assert.match(result.markdown, /A label/);
  assert.match(result.warnings.join(' '), /links lost their targets/);
});

test('Note XML is allowlisted, size bounded, checksum checked, and protected against entities', async () => {
  const parts = notesFixture(); parts['word/comments.xml'] = 'PRIVATE_COMMENTS'; parts['docProps/core.xml'] = 'PRIVATE_AUTHOR'; parts['word/media/image.png'] = 'BINARY_NOT_XML';
  const bytes = zip(parts), xml = await readDocxXML(bytes);
  assert.ok(xml.has('word/footnotes.xml')); assert.doesNotMatch([...xml.values()].join(''), /PRIVATE_|BINARY_NOT_XML/);
  assert.match(convert(Object.fromEntries(xml)).markdown, /Word footnote 1/);
  for (const source of ['<!DOCTYPE x [<!ENTITY bad SYSTEM "https://example.com/">]>', 'bad\u0000text']) await assert.rejects(readDocxXML(zip({ ...parts, 'word/footnotes.xml': source })), /damaged/);
  assert.throws(() => inspectDocxArchive(zip({ ...parts, 'word/footnotes.xml': 'x'.repeat(2097153) })), /2 MiB/);
  const stored = zip(parts, true), entry = inspectDocxArchive(stored).entries.find(e => e.name === 'word/footnotes.xml'); stored[entry.start + 1] ^= 1;
  await assert.rejects(readDocxXML(stored), /damaged/);
});

test('Referenced notes survive article exports and workspace round trips without private workspace fields', async () => {
  const imported = parseArticleImport(convert(notesFixture()).markdown).draft;
  imported.questions = ['PRIVATE_REVIEW']; imported.excerpt = 'PRIVATE_METADATA';
  const outputs = [createArticleMarkdown(imported), createHTMLSource(imported), createWordPressArticle(imported).html];
  for (const value of outputs) { assert.match(value, /Word footnote 1/); assert.match(value, /A source note/); assert.doesNotMatch(value, /PRIVATE_/); }
  const docx = await readDocxXML(createWordDocument(imported));
  assert.ok(!docx.has('word/footnotes.xml'), 'Word output retains the labeled article section, not native note machinery');
  assert.match(convert(Object.fromEntries(docx)).markdown, /A source note/);
  const source = { profile: 'personal', notes: 'PRIVATE_SOURCE', audience: '', purpose: '' };
  const restored = parseWorkspaceBackup(createWorkspaceBackup(source, imported));
  assert.equal(restored.draft.body, imported.body); assert.equal(restored.source.notes, source.notes);
});

test('Public Word guidance discloses labeled sections, export inclusion, and actual limits', async () => {
  for (const path of ['word-to-wordpress/index.html', 'word-to-markdown/index.html', 'help/article-import/index.html']) {
    const html = await readFile('public/' + path, 'utf8');
    for (const phrase of ['footnotes', 'endnotes', '100', '4,000', 'article exports']) assert.ok(html.includes(phrase), path + ': ' + phrase);
    assert.doesNotMatch(html, /fields, footnotes,|footnotes\/endnotes, equations|only six known XML/);
  }
});
