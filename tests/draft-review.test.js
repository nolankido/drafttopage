import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeDraft, articleStructure, REVIEW_LIMIT } from '../public/draft-review.js';
import { inlineTokens, safeWebLink } from '../public/markdown-inline.js';
import { inlineParts, previewBlocks } from '../public/preview.js';
import { createReadingPage } from '../public/html-export.js';
import { createWorkspaceBackup, parseWorkspaceBackup } from '../public/workspace.js';

test('Outline locations select the exact source heading, including CRLF and Unicode', () => {
  const body = 'An opening 😀.\r\n\r\n## Café\r\nText.\r\n\r\n### Detail\r\nMore.';
  const result = analyzeDraft({ body });
  assert.equal(result.headings.length, 2);
  assert.equal(body.slice(result.headings[0].start, result.headings[0].end), '## Café\r');
  assert.equal(result.headings[1].line, 6);
  assert.deepEqual(result.findings, []);
});
test('Placeholders and link offsets remain exact after CRLF and heading prefixes', () => {
  const body = 'First line.\r\nAdd TODO here.\r\n\r\n## [click here](https://example.test/)\r\nA section.';
  const result = analyzeDraft({ body });
  const item = result.findings.find(f => f.kind === 'placeholder');
  assert.equal(item.line, 2); assert.equal(body.slice(item.start, item.end), 'TODO');
  const link = result.links[0]; assert.equal(body.slice(link.start, link.end), '[click here](https://example.test/)');
  assert.equal(link.line, 4);
});
test('Fenced and inline code do not generate prose placeholders or outline entries', () => {
  const body = 'Real prose. `TODO`\n\n``` js\n## Not a heading\nTODO\n[x](javascript:bad())\n```\n\n## Real section\nDone.';
  const result = analyzeDraft({ body });
  assert.equal(result.headings.length, 1); assert.equal(result.links.length, 0);
  assert.deepEqual(result.findings, []); assert.equal(result.words, 5);
  assert.equal(articleStructure('~~~\nTODO')[0].unclosed, true);
  assert.equal(analyzeDraft({ body: '~~~\nTODO' }).findings[0].kind, 'fence');
  assert.equal(previewBlocks('``` js\n## hidden\n```')[0].type, 'pre');
});
test('Review detects unfinished source placeholders without rewriting', () => {
  const draft = { title: 'An update', body: 'TODO: add context.\n\n[insert date] and {{author}}.\n\nLorem ipsum.' };
  const snapshot = JSON.stringify(draft), result = analyzeDraft(draft);
  assert.equal(result.findings.filter(f => f.kind === 'placeholder').length, 4);
  assert.equal(JSON.stringify(draft), snapshot);
});
test('Review catches repeated prose, long paragraphs, empty sections, and heading skips', () => {
  const passage = 'A fictional experiment has an uncertain outcome and remains unfinished.';
  const body = '## Start\n' + passage + '\n\n' + passage.toUpperCase() + '\n\n' + 'word '.repeat(121) + '\n\n#### Empty\n\n## Last';
  const result = analyzeDraft({ body });
  for (const kind of ['repeat', 'paragraph', 'empty-section', 'heading']) assert.ok(result.findings.some(f => f.kind === kind));
  assert.ok(result.findings.find(f => f.kind === 'repeat').message.includes('line 2'));
});
test('A heading container with a subsection is allowed and a duplicate title is advisory', () => {
  const result = analyzeDraft({ title: 'An update', body: '## An update\n### Detail\nA short paragraph.' });
  assert.equal(result.findings.length, 1); assert.equal(result.findings[0].kind, 'title');
  assert.equal(analyzeDraft({ body: '## \n## Next\nBody.' }).findings[0].kind, 'heading');
});
test('Reading estimate excludes code, image syntax, and addresses and explains a bounded estimate', () => {
  const result = analyzeDraft({ body: '## Heading\nOne [resource](https://example.test/long/path) and `code words`.\n\n![picture words](https://example.test/image)\n\n```\nignored code words\n```' });
  assert.equal(result.words, 4); assert.equal(result.readingMinutes, 1);
  assert.equal(analyzeDraft({ body: '' }).readingMinutes, 0);
  assert.equal(analyzeDraft({ body: 'word '.repeat(201) }).readingMinutes, 2);
});
test('Findings are bounded with a visible total instead of silently truncating', () => {
  const result = analyzeDraft({ body: 'TODO\n\n'.repeat(90) });
  assert.equal(result.findings.length, REVIEW_LIMIT); assert.equal(result.totalFindings, 90); assert.equal(result.truncated, true);
  assert.throws(() => analyzeDraft({ body: 'a'.repeat(12001) }));
  assert.throws(() => analyzeDraft({ body: null }));
  assert.throws(() => analyzeDraft({ title: 'a'.repeat(161), body: 'Valid' }));
});
test('Only absolute HTTP(S) links without credentials are navigation', () => {
  assert.equal(safeWebLink('https://example.test/path?x=1&y=2'), 'https://example.test/path?x=1&y=2');
  assert.equal(safeWebLink('HTTP://example.test'), 'http://example.test/');
  for (const url of ['javascript:alert(1)', 'data:text/html,x', 'file:///etc/passwd', '//example.test', '/relative', '#fragment', 'mailto:a@example.test', 'https://u:p@example.test', 'https://example.test\\evil', 'https://example.test/\nextra', 'https://example.test/"onclick=x', 'https://', 'https://example.test/ bad']) assert.equal(safeWebLink(url), null, url);
});
test('Link scanner supports balanced parentheses and keeps images, escaped syntax, and code inert', () => {
  const text = '[A resource](https://example.test/a_(b)) ![image](https://example.test/i.png) ` [code](https://example.test/) ` \\[escaped](https://example.test/)';
  const parts = inlineParts(text);
  assert.equal(parts.filter(p => p.type === 'a').length, 1);
  assert.equal(parts[0].href, 'https://example.test/a_(b)');
  assert.ok(parts.some(p => p.type === 'text' && p.text.startsWith('![')));
  for (const value of ['[x](javascript:alert(1))', '[](https://example.test/)', '[x](https://u:p@example.test/)', '[x](<https://example.test/>)']) assert.deepEqual(inlineParts(value), [{ type: 'text', text: value }]);
  assert.throws(() => inlineTokens('a'.repeat(12001)));
});
test('HTML export escapes hostile labels, shares protected URLs, and preserves heading hierarchy', () => {
  const html = createReadingPage({ title: 'An update', body: '## Section\n### Detail\n[<img onerror=bad()>](https://example.test/?a=1&b=2)\n\n[unsafe](javascript:bad())\n\n![image](https://example.test/a.png)' });
  assert.equal((html.match(/<h1>/g) || []).length, 1);
  assert.match(html, /<h2>Section<\/h2>\n<h3>Detail<\/h3>/);
  assert.match(html, /href="https:\/\/example.test\/\?a=1&amp;b=2" target="_blank" rel="noopener noreferrer"/);
  assert.match(html, /&lt;img onerror=bad\(\)&gt;<\/a>/);
  assert.equal((html.match(/<a /g) || []).length, 1);
  assert.doesNotMatch(html, /<img|<script|href="javascript:/);
});
test('Unsupported link/image handoffs are advisory and backups keep the version-1 contract', () => {
  const draft = { title: '', excerpt: '', description: '', slug: '', body: '[relative](/page) and ![image](https://example.test/i.png)', questions: ['Private note'] };
  const result = analyzeDraft(draft);
  assert.deepEqual(result.findings.map(f => f.kind), ['link', 'image']);
  const source = { profile: 'personal', notes: '', audience: '', purpose: '' };
  const backup = createWorkspaceBackup(source, draft);
  assert.deepEqual(parseWorkspaceBackup(backup).draft, draft);
  assert.ok(!backup.includes('findings')); assert.equal(JSON.parse(backup).version, 1);
});
