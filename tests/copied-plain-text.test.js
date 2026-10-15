import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCopiedWriting } from '../public/copied-writing.js';
import { parseArticleImport } from '../public/article-import.js';
import { inlineParts, previewBlocks } from '../public/preview.js';
import { createWordPressArticle } from '../public/wordpress-export.js';

const copied = text => parseCopiedWriting({ format: 'plain', text });
const visible = body => previewBlocks(body).map(block => {
  assert.equal(block.type, 'p');
  const parts = inlineParts(block.text);
  assert.ok(parts.every(part => part.type === 'text'));
  return parts.map(part => part.text).join('');
}).join('\n\n');

test('Plain clipboard writing retains literal punctuation through preview and WordPress export', () => {
  const text = '# A literal heading\n\nUse _draft_ and ** stars **, `ticks`, C:\\notes, and café 😀.\n[Link](https://example.com/) ![image](https://example.com/a.png)\n\n4. Literal number\n- Literal bullet\n> Literal quote\n\n| a | b |\n| --- | --- |';
  const result = copied(text);
  assert.equal(result.draft.title, '');
  assert.equal(visible(result.draft.body), text);
  assert.equal(result.requiresAck, true);
  assert.match(result.warnings[0], /literal/);
  const html = createWordPressArticle(result.draft).html;
  assert.doesNotMatch(html, /wp:(?:heading|list|quote|table|code|image)|<(?:a|em|strong|img|script)\b/);
  assert.match(html, /_draft_/);
});

test('Plain copied front matter, JSON and code fences remain article text without extracting fields', () => {
  for (const text of ['---\ntitle: Literal title\nexcerpt: Literal excerpt\n---\n\nBody.', '{"title":"A literal example","body":"Article text"}', '```markdown\n# Keep the fence\n```']) {
    const result = copied(text);
    assert.equal(visible(result.draft.body), text);
    for (const key of ['title','excerpt','description']) assert.equal(result.draft[key], '');
    assert.deepEqual(result.draft.questions, []);
    assert.deepEqual(result.unmapped, []);
  }
});

test('Plain clipboard normalization preserves paragraph and line boundaries, and rejects overflow intact', () => {
  assert.equal(visible(copied('First.\r\nNext.\r\n\r\nLast.').draft.body), 'First.\nNext.\n\nLast.');
  assert.equal(visible(copied('x'.repeat(60000)).draft.body).length, 60000);
  for (const value of ['x'.repeat(60001), '*'.repeat(30001)]) assert.throws(() => copied(value), /60,000|smaller/);
  assert.throws(() => copied('Text\u0000hidden'), /control characters/);
});

test('Intentional Markdown import still extracts fields and supported formatting', () => {
  const result = parseArticleImport('---\ntitle: Chosen title\n---\n\n## Section\n\n**Bold** and _italic_.', '', 'markdown');
  assert.equal(result.draft.title, 'Chosen title');
  assert.match(createWordPressArticle(result.draft).html, /wp:heading/);
  assert.match(createWordPressArticle(result.draft).html, /<strong>Bold<\/strong>/);
});
