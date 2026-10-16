import test from 'node:test';
import assert from 'node:assert/strict';
import { formatMarkdown } from '../public/editing.js';
import { formatStrikethrough } from '../public/strike-editing.js';
import { inlineTokens, walkInlineTokens } from '../public/markdown-inline.js';
import { readFile } from 'node:fs/promises';

const select = (body, phrase) => [body, body.indexOf(phrase), body.indexOf(phrase) + phrase.length];
const toggle = (body, phrase) => formatMarkdown(...select(body, phrase), 'strike');

for (const [body, phrase] of [
  ['One old plan, unchanged.', 'old plan'], ['  old plan  ', '  old plan  '],
  ['Before café 日本語 😀 after.', 'café 日本語 😀'], ['Before **bold plan** after.', 'bold plan'],
  ['Before **bold plan** after.', '**bold plan**'], ['*An old plan* stays.', 'old plan'],
  ['## Old plan ##', 'Old plan'], ['- Old plan', 'Old plan'], ['> Old plan', 'Old plan'],
  ['4. Old plan\n5. Next plan', 'Old plan'], ['First\r\nSecond plan\r\nThird', 'Second plan'],
  ['| Old plan | Keep |\n| --- | --- |\n| A | B |', 'Old plan'],
  ['~~Earlier~~ and current plan.', 'current plan'], ['Emoji 😀', '😀']
]) test('Strike selection round trip preserves exact source: ' + JSON.stringify(body), () => {
  const added = toggle(body, phrase);
  const core = phrase.trim(), before = body.indexOf(phrase) + phrase.indexOf(core);
  assert.equal(added.body, body.slice(0, before) + '~~' + core + '~~' + body.slice(before + core.length));
  assert.equal(added.body.slice(added.selectionStart, added.selectionEnd), core);
  assert.equal(formatMarkdown(added.body, added.selectionStart, added.selectionEnd, 'strike').body, body);
  assert.equal(formatMarkdown(added.body, added.selectionStart - 2, added.selectionEnd + 2, 'strike').body, body);
});

for (const [body, phrase] of [
  ['Before ~~**old** and `literal`~~ after.', '~~**old** and `literal`~~'],
  ['Before ~~[safe](https://example.com/) and text~~ after.', '~~[safe](https://example.com/) and text~~'],
  [String.raw`~~Today\'s Special\: Salmon~~ Sold out`, String.raw`Today\'s Special\: Salmon`]
]) test('Removing a recognized full wrapper preserves protected inner source: ' + phrase, () => {
  const result = toggle(body, phrase);
  assert.equal(result.body, body.replace('~~', '').replace('~~', ''));
  assert.equal(result.body.slice(result.selectionStart, result.selectionEnd), body.slice(body.indexOf('~~') + 2, body.lastIndexOf('~~')));
});

for (const [body, phrase] of [
  ['Before `code` after.', 'code'], ['Before ``code`` after.', '``code``'],
  ['[label](https://example.com/)', 'label'], ['[~~label~~](https://example.com/)', '~~label~~'],
  ['Before ~~[safe](https://example.com/)~~ after.', '[safe](https://example.com/)'],
  ['![image](https://example.com/x.png)', 'image'], ['Bare https://example.com/path here', 'path'],
  ['www.example.com', 'example'], ['mailto:a@example.com', 'a@example'],
  ['[ref]: https://example.com/\ncontinuation', 'continuation'],
  ['```text\n~~code~~\n```', '~~code~~'], ['> ~~~\n> code\n> ~~~', 'code'],
  ['    Indented prose', 'Indented'], ['<script>old plan</script>', 'old plan'],
  ['<b title="old plan">text</b>', 'old plan'], [String.raw`escaped \~ tilde`, String.raw`\~`],
  ['Before ~~old plan~~ after', 'old'], ['Before ~~old plan~~ after', 'plan~~ after'],
  ['~~old~~ and ~~other~~', '~~old~~ and ~~other~~'],
  ['~~~literal~~~', 'literal'], ['a~word~b', 'word'],
  ['- Item', '- Item'], ['## Heading', '## Heading'], ['> Quote', '> Quote'],
  ['4. Item', '4. Item'], ['## Heading ##', 'Heading ##'], ['###', '###'],
  ['---', '---'], ['* * *', '* * *'], ['===', '==='],
  ['| A | B |', 'A | B'], ['| --- | --- |', '---'],
  ['~~# Heading~~', '# Heading'], ['~~- Item~~', '- Item'], ['~~> Quote~~', '> Quote'],
  ['~~---~~', '---'], ['## ~~Heading ##~~', 'Heading ##'],
  ['A | B\n~~---~~ | ---', '~~---~~'],
  ['a\nb', 'a\nb'], ['a\r\nb', 'a\r\nb'], ['a\u2028b', 'a\u2028b'], ['a\u2029b', 'a\u2029b'],
  ['a\u0000b', 'a\u0000b'], ['   ', '   ']
]) test('Unsafe or ambiguous strike rejects without a replacement: ' + JSON.stringify([body, phrase]), () => {
  assert.ok(body.includes(phrase));
  assert.throws(() => toggle(body, phrase), /unchanged/);
});

test('Strike has bounded source and UTF-16 selection validation without placeholder insertion', () => {
  for (const args of [['', 0, 0], ['text', 2, 2], ['text', -1, 2], ['text', 0, 5], ['text', 0.5, 2], ['text', 3, 2], [null, 0, 1], ['😀', 0, 1], ['😀', 1, 2], ['a\r\nb', 2, 4], ['x'.repeat(60001), 0, 1]]) assert.throws(() => formatStrikethrough(...args), /unchanged/);
  assert.throws(() => toggle('x'.repeat(60000), 'x'), /60,000/);
  assert.equal(toggle('x'.repeat(59996), 'x').body.length, 60000);
  assert.equal(toggle('~~' + 'x'.repeat(59996) + '~~', 'x'.repeat(59996)).body.length, 59996);
});

test('Deep parser fallback cannot silently insert literal strike delimiters', () => {
  const body = Array.from({ length: 20 }, (_, i) => i % 2 ? '_' : '*').join('') + 'phrase' + Array.from({ length: 20 }, (_, i) => i % 2 ? '*' : '_').join('');
  try {
    const result = toggle(body, 'phrase');
    assert.ok([...walkInlineTokens(inlineTokens(result.body))].some(node => node.type === 's' && node.start === result.selectionStart - 2 && node.end === result.selectionEnd + 2));
    assert.equal(formatMarkdown(result.body, result.selectionStart, result.selectionEnd, 'strike').body, body);
  } catch (error) { assert.match(error.message, /unchanged/); }
});

test('Every accepted selection in a deterministic punctuation corpus round trips without normalizing source', () => {
  let accepted = 0, rejected = 0;
  const corpus = ['plain phrase', '**bold** *italic*', 'a_b_c and a*b*c', String.raw`escaped \*mark\*`, '# Heading ##', '- Item text', '> Quote text', '| A | B |\n| --- | --- |', 'first\r\nsecond', '[label](https://example.com/)', '`code` and prose', '😀 café 日本語', '~~old~~ and new', '~tilde~ literal', '***', '  1) Item'];
  for (const body of corpus) for (let start = 0; start < body.length; start++) for (let end = start + 1; end <= body.length; end++) {
    let result;
    try { result = formatMarkdown(body, start, end, 'strike'); }
    catch (error) { assert.match(error.message, /unchanged/); rejected++; continue; }
    accepted++;
    assert.equal(Math.abs(result.body.length - body.length), 4);
    assert.equal(formatMarkdown(result.body, result.selectionStart, result.selectionEnd, 'strike').body, body);
  }
  assert.ok(accepted > 100 && rejected > 100);
});

test('All eight shared workspaces expose the optional labelled strike control and guidance', async () => {
  for (const route of ['write', 'markdown-to-wordpress', 'word-to-wordpress', 'google-docs-to-wordpress', 'markdown-to-html', 'markdown-to-word', 'word-to-markdown', 'html-to-markdown']) {
    const html = await readFile('public/' + route + '/index.html', 'utf8');
    assert.match(html, /data-format="strike" aria-describedby="strike-help">Strikethrough<\/button>/);
    assert.match(html, /id="strike-help"[^>]*>Strikethrough: select one phrase on one line/);
    assert.equal((html.match(/id="strike-help"/g) || []).length, 1);
  }
});
