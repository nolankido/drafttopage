import test from 'node:test';
import assert from 'node:assert/strict';
import { htmlTreeToMarkdown } from '../public/html-import.js';
import { createHTMLSource } from '../public/html-export.js';
import { createWordPressArticle } from '../public/wordpress-export.js';
import { wordDocumentParts } from '../public/word-export.js';
import { previewBlocks, inlineParts } from '../public/preview.js';

const text = value => ({ nodeType: 3, nodeValue: value, childNodes: [] });
const element = (name, nodes = [], attributes = {}) => ({
  nodeType: 1, localName: name,
  childNodes: nodes.map(node => typeof node === 'string' ? text(node) : node),
  getAttribute: key => Object.hasOwn(attributes, key) ? attributes[key] : null,
  hasAttribute: key => Object.hasOwn(attributes, key)
});
const convert = (node, options) => htmlTreeToMarkdown({ nodeType: 11, childNodes: [node] }, options);
const quote = (nodes, attributes) => element('blockquote', nodes, attributes);
const anchor = (label, href) => element('a', Array.isArray(label) ? label : [label], { href });
const reading = result => createHTMLSource({ body: result.markdown });
const quoteText = result => {
  const blocks = previewBlocks(result.markdown);
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].type, 'blockquote');
  return inlineParts(blocks[0].text).map(part => part.text).join('');
};

test('Quoted citations and emphasis survive HTML import and every publishing format', () => {
  const result = convert(quote([element('p', [
    'A ', element('strong', ['critical']), ' finding from ',
    anchor('the original study', 'https://example.test/study?q=1&section=2'), '.'
  ])]));
  assert.equal(quoteText(result), 'A critical finding from the original study.');
  assert.doesNotMatch(result.warnings.join(' '), /Blockquote structure was simplified/);
  for (const html of [reading(result), createWordPressArticle({ body: result.markdown }).html]) {
    assert.match(html, /<blockquote[^>]*>/);
    assert.match(html, /<strong>critical<\/strong>/);
    assert.match(html, /href="https:\/\/example.test\/study\?q=1&amp;section=2"/);
    assert.match(html, />the original study<\/a>/);
  }
  const parts = wordDocumentParts({ body: result.markdown });
  const document = parts.find(part => part.name === 'word/document.xml').content;
  const relationships = parts.find(part => part.name === 'word/_rels/document.xml.rels').content;
  assert.match(document, /<w:pStyle w:val="Quote"\/>/);
  assert.match(document, /<w:b\/>/);
  assert.match(document, /<w:hyperlink r:id="rIdLink1">/);
  assert.match(relationships, /Target="https:\/\/example.test\/study\?q=1&amp;section=2" TargetMode="External"/);
});

test('Quoted nested inline marks retain their semantic formatting and exact visible text', () => {
  const result = convert(quote([element('p', [
    element('strong', ['Bold ', element('em', ['and italic'])]), ' ',
    element('s', ['superseded']), ' ', element('code', ['a < b && c']), ' ',
    anchor([element('em', ['read']), ' the source'], 'https://example.test/reference')
  ])]));
  assert.equal(quoteText(result), 'Bold and italic superseded a < b && c read the source');
  const html = reading(result);
  assert.match(html, /<strong>Bold <em>and italic<\/em><\/strong>/);
  assert.match(html, /<s>superseded<\/s>/);
  assert.match(html, /<code>a &lt; b &amp;&amp; c<\/code>/);
  assert.match(html, /<a [^>]*href="https:\/\/example.test\/reference"[^>]*><em>read<\/em> the source<\/a>/);
});

test('Quote paragraphs, wrapped paragraphs, and explicit line breaks keep their order and ending', () => {
  const result = convert(quote([
    element('p', ['First ', anchor('source', 'https://example.test/first'), element('br'), 'Next line.']),
    element('div', [element('p', ['Second paragraph.']), element('p', ['Final sentinel: café 日本語 🪴.'])])
  ]));
  assert.equal(quoteText(result), 'First source\nNext line.\nSecond paragraph.\nFinal sentinel: café 日本語 🪴.');
  assert.match(reading(result), /source<\/a><br>Next line\.<br>Second paragraph\.<br>Final sentinel: café 日本語 🪴\./);
});

test('Direct quote text and literal Markdown syntax stay literal around retained links', () => {
  const literal = '# *literal* [not a link](https://invalid.example) ![image](none) | > `ticks`';
  const result = convert(quote([literal, element('br'), anchor('Real source', 'https://example.test/real')]));
  assert.equal(quoteText(result), literal + '\nReal source');
  const html = reading(result);
  assert.equal((html.match(/<a\b/g) || []).length, 1);
  assert.doesNotMatch(html, /<img\b|<h1\b|<em\b|<code\b/);
  assert.match(html, /href="https:\/\/example.test\/real"/);
});

test('Inherited quote bold and explicit normal-weight resets retain their boundaries', () => {
  const result = convert(element('div', [quote([
    element('p', ['Inherited ', element('em', ['emphasis']), '.']),
    element('p', ['Normal paragraph.'], { style: 'font-weight:400' }),
    element('p', ['Bold ', element('span', ['normal span'], { style: 'font-weight:normal' }), ' bold again.'])
  ])], { style: 'font-weight:700' }));
  const html = reading(result);
  assert.match(html, /<strong>Inherited <em>emphasis<\/em>\.<\/strong>/);
  assert.match(html, /<br>Normal paragraph\.<br>/);
  assert.match(html, /<strong>Bold<\/strong> normal span <strong>bold again\.<\/strong>/);
  assert.doesNotMatch(html, /<strong>Normal paragraph/);
});

test('Quote links use explicit source context and keep unsafe targets out of every export', () => {
  const source = () => quote([element('p', [
    anchor('Relative citation', '../study?q=2'), ' ',
    anchor('Unsafe', 'javascript:alert(1)'), ' ',
    anchor('Credentialed', 'https://private:secret@example.test/restricted')
  ])]);
  const withoutContext = convert(source());
  assert.equal(quoteText(withoutContext), 'Relative citation Unsafe Credentialed');
  assert.doesNotMatch(reading(withoutContext), /<a\b/);
  assert.match(withoutContext.warnings.join(' '), /link targets were omitted/);
  const result = convert(source(), { sourceURL: 'https://example.test/articles/draft' });
  assert.match(reading(result), /href="https:\/\/example.test\/study\?q=2"/);
  assert.match(result.warnings.join(' '), /relative link target was resolved/);
  for (const content of [result.markdown, reading(result), createWordPressArticle({ body: result.markdown }).html,
    ...wordDocumentParts({ body: result.markdown }).map(part => part.content)]) {
    assert.doesNotMatch(content, /javascript:|private:secret|articles\/draft/);
  }
});

test('Ambiguous quoted link labels keep their safe citation URL as disclosed literal text', () => {
  const result = convert(quote([element('p', [anchor('[Source]', 'https://example.test/citation')])]));
  assert.equal(quoteText(result), '[Source] (https://example.test/citation)');
  assert.doesNotMatch(reading(result), /<a\b/);
  assert.match(result.warnings.join(' '), /safe URL was kept as text/);
});

test('Nested quote structures flatten with disclosure while their links and visible content survive', () => {
  const result = convert(quote([
    element('h2', ['Quoted heading']),
    element('ol', [element('li', ['First item']), element('li', [anchor('Second citation', 'https://example.test/second')])]),
    element('table', [element('tr', [element('td', ['Table A']), element('td', ['Table B'])])]),
    quote([element('p', [element('em', ['Inner quotation'])])]),
    element('p', ['Final nested sentinel.'])
  ]));
  const visible = quoteText(result);
  let position = 0;
  for (const fragment of ['Quoted heading', 'First item', 'Second citation', 'Table A', 'Table B', 'Inner quotation', 'Final nested sentinel.']) {
    const found = visible.indexOf(fragment, position);
    assert.ok(found >= position, fragment);
    position = found + fragment.length;
  }
  assert.match(reading(result), /href="https:\/\/example.test\/second"/);
  assert.doesNotMatch(reading(result), /<h2\b|<ol\b|<ul\b|<table\b/);
  assert.equal((reading(result).match(/<blockquote\b/g) || []).length, 1);
  assert.match(result.warnings.join(' '), /Nested block structure inside a quote was flattened/);
});

test('Hidden or active quote content is omitted and image placeholders stay inert', () => {
  const result = convert(quote([
    element('p', ['Visible ', element('img', [], { src: 'https://images.example.test/private.png', alt: 'Fictional *image*' }),
      element('script', ['PRIVATE_SCRIPT']), element('iframe', ['PRIVATE_FRAME']),
      element('span', ['PRIVATE_HIDDEN'], { hidden: '' }),
      element('span', ['PRIVATE_CSS'], { style: 'display:none' }),
      element('span', ['PRIVATE_ARIA'], { 'aria-hidden': 'true' })]),
    element('p', [anchor('Kept citation', 'https://example.test/kept')])
  ]));
  assert.equal(quoteText(result), 'Visible [Image: Fictional *image*]\nKept citation');
  const html = reading(result);
  assert.doesNotMatch(html, /PRIVATE_|private\.png|<img\b|<script\b|<iframe\b|<em\b/);
  assert.match(html, /href="https:\/\/example.test\/kept"/);
  assert.match(result.warnings.join(' '), /Images were replaced with text placeholders/);
});

test('Quoted tracked changes and visible checklist states still reject the complete import', () => {
  for (const tag of ['ins', 'del']) {
    assert.throws(() => convert(quote([element('p', ['Before ', element(tag, ['unresolved']), ' after.'])])), /tracked changes/);
  }
  const checklist = () => element('ul', [element('li', ['State must survive'], { role: 'checkbox', 'aria-checked': 'true' })]);
  assert.throws(() => convert(quote([checklist()])), /Checklist items inside this container cannot be preserved/);
  assert.throws(() => convert(quote([element('div', [checklist()])])), /Checklist items inside this container cannot be preserved/);
  const hidden = convert(quote([element('div', [checklist()], { hidden: '' }), element('p', ['Visible ending.'])]));
  assert.equal(quoteText(hidden), 'Visible ending.');
});

test('Quoted malformed text and oversized converted articles fail instead of losing their endings', () => {
  assert.throws(() => convert(quote([element('p', ['Keep\u0000ending'])])), /control characters/);
  assert.throws(() => convert(quote([element('p', ['.'.repeat(30001)])])), /exceeds 60,000.*nothing was truncated/);
  const manyParagraphs = quote(Array.from({ length: 200 }, () => element('p', ['x'.repeat(300)])));
  assert.throws(() => convert(manyParagraphs), /exceeds 60,000.*nothing was truncated/);
});
