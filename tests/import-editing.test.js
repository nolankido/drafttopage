import test from 'node:test';
import assert from 'node:assert/strict';
import { parseArticleImport, MAX_IMPORT_BYTES } from '../public/article-import.js';
import { formatMarkdown } from '../public/editing.js';
import { createMarkdown } from '../public/markdown.js';
import { createWorkspaceBackup, parseWorkspaceBackup } from '../public/workspace.js';
import { EXAMPLES } from '../public/content-data.js';

for (const example of EXAMPLES) for (const includeTitleHeading of [true, false]) test('Reopen exported article ' + example.id + ' with heading=' + includeTitleHeading, () => {
  const result = parseArticleImport(createMarkdown(example.draft, { includeTitleHeading }), example.draft.slug + '.md');
  const { title, excerpt, description, body } = example.draft;
  assert.deepEqual(result.draft, { title, excerpt, description, body, slug: example.draft.slug, questions: [] });
  assert.equal(result.unmapped.length, 0);
});
test('Plain Markdown supports a partial draft, Unicode, line endings, and a separate title', () => {
  const result = parseArticleImport('\uFEFF# Café notes\r\n\r\n## What changed\r\nA small change.\r\n', 'notes.md');
  assert.equal(result.draft.title, 'Café notes'); assert.equal(result.draft.slug, 'notes');
  assert.equal(result.draft.body, '## What changed\nA small change.');
  assert.equal(parseArticleImport('# Title only').draft.body, '');
  assert.equal(parseArticleImport('    Literal indentation.\n').draft.body, '    Literal indentation.');
});
test('Structured drafting replies preserve review questions in an existing version-1 backup', () => {
  const result = parseArticleImport(JSON.stringify(EXAMPLES[0].draft));
  const source = { profile: 'personal', notes: 'Original private notes.', audience: '', purpose: '' };
  assert.deepEqual(parseWorkspaceBackup(createWorkspaceBackup(source, result.draft)).draft, EXAMPLES[0].draft);
  assert.deepEqual(parseArticleImport('\x60\x60\x60json\n' + JSON.stringify(EXAMPLES[0].draft) + '\n\x60\x60\x60').draft, EXAMPLES[0].draft);
});
test('Unsupported front-matter fields stay visible for a deliberate destination decision', () => {
  const result = parseArticleImport('---\ntitle: "A page"\nlayout: article\ndate: 2026-10-14\ndraft: false\n---\n\n# A page\n\nBody.');
  assert.deepEqual(result.unmapped, [{ key: 'layout', value: 'article' }, { key: 'date', value: '2026-10-14' }]);
  assert.equal(result.draft.body, 'Body.'); assert.ok(result.warnings.some(x => x.includes('false')));
  const conflict = parseArticleImport('---\ntitle: Metadata title\n---\n\n# Different body title\n\nBody.');
  assert.match(conflict.draft.body, /^# Different body title/);
});
test('Malformed, oversized, structured YAML, and prototype-shaped inputs are rejected before use', () => {
  const bad = [
    '', 'x'.repeat(MAX_IMPORT_BYTES + 1), 'x'.repeat(60001), 'Hidden\u0000text',
    '---\ntitle: "Bad"\n', '---\ntitle: A\ntitle: B\n---\nBody',
    '---\ntitle: !!js/function bad\n---\nBody', '---\ntitle: |\n  multline\n---\nBody',
    '---\n__proto__: bad\n---\nBody', '{broken', JSON.stringify({ ...EXAMPLES[0].draft, extra: true }),
    JSON.stringify({ ...EXAMPLES[0].draft, body: 'bad\u0000body' }), JSON.stringify({ ...EXAMPLES[0].draft, slug: '../../outside' })
  ];
  for (const text of bad) assert.throws(() => parseArticleImport(text), undefined, text.slice(0, 40));
  assert.equal({}.polluted, undefined);
  assert.throws(() => parseArticleImport('{"format":"drafttopage-workspace"}'), /workspace backup/);
});
test('Formatting preserves text outside the selection and respects the editor limit', () => {
  assert.deepEqual(formatMarkdown('One two three', 4, 7, 'bold'), { body: 'One **two** three', selectionStart: 6, selectionEnd: 9 });
  assert.equal(formatMarkdown('One **two** three', 6, 9, 'bold').body, 'One two three');
  assert.equal(formatMarkdown('One\nTwo\nThree', 4, 7, 'list').body, 'One\n- Two\nThree');
  assert.equal(formatMarkdown('One\nTwo', 0, 7, 'numbered').body, '1. One\n2. Two');
  assert.equal(formatMarkdown('Paragraph', 0, 0, 'heading').body, '## Paragraph');
  assert.equal(formatMarkdown('', 0, 0, 'italic').body, '*italic text*');
  assert.throws(() => formatMarkdown('x'.repeat(60000), 0, 1, 'bold'));
  assert.throws(() => formatMarkdown('text', -1, 2, 'bold'));
  assert.throws(() => formatMarkdown('text', 0, 2, 'unknown'));
});
