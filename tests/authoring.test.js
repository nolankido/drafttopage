import test from 'node:test';
import assert from 'node:assert/strict';
import { articleIssues, articleBody, makeDraftingBrief } from '../public/authoring.js';
import { createReadingPage } from '../public/html-export.js';
import { createMarkdown } from '../public/markdown.js';
import { inlineParts, previewBlocks } from '../public/preview.js';
import { TEMPLATES, EXAMPLES } from '../public/content-data.js';

test('An article body can leave the workspace without a filename or page metadata', () => {
  const partial = { body: '  A reviewed article.  ', title: '', excerpt: '', description: '', slug: '' };
  assert.equal(articleBody(partial), 'A reviewed article.');
  assert.deepEqual(articleIssues(partial, 'body'), {});
  assert.ok(articleIssues(partial).slug);
  assert.ok(articleIssues(partial, 'html').title);
  for (const body of ['', ' ', null, 'x'.repeat(12001), 'hidden\u0000text']) assert.throws(() => articleBody({ body }));
});
test('A reading page needs only the title and article and emits one inert document', () => {
  const html = createReadingPage({ title: 'Fictional article', body: '## A detail\n**Supported** and *uncertain*.\n\n- First\n- Second' });
  assert.match(html, /^<!doctype html>/); assert.equal((html.match(/<h1>/g) || []).length, 1);
  assert.match(html, /<h2>A detail<\/h2>/); assert.match(html, /<strong>Supported<\/strong>/);
  assert.match(html, /<em>uncertain<\/em>/); assert.match(html, /<li>First<\/li>/);
  assert.match(html, /default-src 'none'/);
  assert.doesNotMatch(html, /<script|<img|<a |<iframe|<form|https?:\/\//);
  assert.throws(() => createReadingPage({ title: '', body: 'Body' }));
});
test('Hostile source markup and metadata remain escaped in a standalone page', () => {
  const html = createReadingPage({
    title: '<img src=x onerror=bad()>', description: '" onload="bad()',
    body: '<script>bad()</script>\n\n[go](javascript:bad())\n\n![image](https://example.test/image)\n\n\x60\x60\x60html\n<svg onload=bad()>\n\x60\x60\x60',
    notes: 'PRIVATE SOURCE SENTINEL', questions: ['PRIVATE QUESTION SENTINEL']
  });
  assert.doesNotMatch(html, /<script|<svg|<img|<a |PRIVATE SOURCE SENTINEL|PRIVATE QUESTION SENTINEL/);
  assert.match(html, /&lt;script&gt;/); assert.match(html, /content="&quot; onload=&quot;bad\(\)"/);
  assert.match(html, /<pre><code>&lt;svg/);
});
test('Page Markdown can hand title rendering to the destination without altering the authored body', () => {
  const draft = EXAMPLES[0].draft;
  const page = createMarkdown(draft, { includeTitleHeading: false });
  assert.match(page, /title:/); assert.match(page, /draft: true/);
  assert.ok(page.endsWith(draft.body.trim() + '\n'));
  assert.ok(!page.includes('\n# ' + draft.title + '\n'));
  assert.ok(createMarkdown(draft).includes('\n# ' + draft.title + '\n'));
});
test('Drafting briefs require filled source material, preserve uncertainty instructions, and never create an article', () => {
  const source = { profile: 'update', audience: 'Neighbors', purpose: 'Explain progress', notes: 'Two fictional volunteers checked a reading list. The venue remains undecided.' };
  const text = makeDraftingBrief(source);
  assert.match(text, /Project update/); assert.match(text, /Preserve uncertainty/);
  assert.ok(text.includes(JSON.stringify(source.notes)));
  for (const t of TEMPLATES) assert.throws(() => makeDraftingBrief({ ...source, profile: t.profile, notes: t.outline }), /Fill in/);
  assert.throws(() => makeDraftingBrief({ ...source, notes: 'Too short' }));
  assert.throws(() => makeDraftingBrief({ ...source, profile: '__proto__' }));
});
test('Reading aid recognizes adjacent blocks and leaves link targets as data', () => {
  assert.deepEqual(previewBlocks('## Heading\nParagraph.\n\n> Quoted\n> Continued\n\n\x60\x60\x60\n<script>x</script>\n\x60\x60\x60'), [
    { type: 'h4', text: 'Heading' }, { type: 'p', text: 'Paragraph.' },
    { type: 'blockquote', text: 'Quoted\nContinued' }, { type: 'pre', text: '<script>x</script>' }
  ]);
  assert.deepEqual(inlineParts('**Claim** and \x60code\x60'), [{ type: 'strong', text: 'Claim' }, { type: 'text', text: ' and ' }, { type: 'code', text: 'code' }]);
  assert.deepEqual(inlineParts('[link](javascript:bad())'), [{ type: 'text', text: '[link](javascript:bad())' }]);
});
