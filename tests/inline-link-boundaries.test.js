import test from 'node:test';
import assert from 'node:assert/strict';
import { inlineTokens } from '../public/markdown-inline.js';
import { inlineParts } from '../public/preview.js';
import { createWordPressArticle } from '../public/wordpress-export.js';
import { analyzeWordPressImages } from '../public/wordpress-images.js';

test('Balanced URL parentheses keep their exact targets and UTF-16 review offsets', () => {
  const source = '😀 before ( [Read](https://example.test/a_(b(c))?x=(d)) after )';
  const token = inlineTokens(source).find(part => part.type === 'link');
  assert.equal(token.target, 'https://example.test/a_(b(c))?x=(d)');
  assert.equal(source.slice(token.start, token.end), '[Read](https://example.test/a_(b(c))?x=(d))');
  assert.equal(token.start, source.indexOf('[Read]'));
  assert.equal(inlineParts(source).find(part => part.type === 'a').href, token.target);
});

test('An unfinished outer URL cannot consume a later complete link or cross a newline', () => {
  for (const prefix of ['[unfinished](not closed ', '[unfinished](https://example.test/\n', '([unfinished](text ( ']) {
    const source = prefix + '[Kept](https://example.test/kept_(path))\n)';
    const links = inlineTokens(source).filter(part => part.type === 'link');
    assert.equal(links.length, 1);
    assert.equal(links[0].href, 'https://example.test/kept_(path)');
    assert.equal(links[0].start, prefix.length);
    assert.equal(source.slice(links[0].start, links[0].end), '[Kept](https://example.test/kept_(path))');
  }
});

test('Escaped label brackets, code and unsafe URL targets retain their existing boundaries', () => {
  const source = '[A \\] bracket](https://example.test/a_(b)) ` [code](https://example.test/) ` \\[literal](https://example.test/) [unsafe](https://example.test/a\\(b\\))';
  const tokens = inlineTokens(source), parts = inlineParts(source);
  assert.equal(parts.filter(part => part.type === 'a').length, 1);
  assert.equal(parts.find(part => part.type === 'a').text, 'A ] bracket');
  assert.equal(tokens.filter(part => part.type === 'link').length, 2);
  assert.equal(tokens.find(part => part.text === 'unsafe').href, null);
  assert.ok(parts.some(part => part.type === 'code'));
  assert.ok(parts.some(part => part.type === 'text' && part.text.includes('[literal]')));
});

test('Near-limit unfinished link and image runs preserve the ending and its valid link', () => {
  const tail = '\n\nENDING [Keep this](https://example.test/ending_(kept))';
  for (const unit of ['[unfinished](https://example.test/', '![unfinished](https://example.test/', '[\\]](https://example.test/']) {
    const prefix = unit.repeat(Math.floor((60000 - tail.length) / unit.length));
    const source = prefix + tail, tokens = inlineTokens(source);
    assert.equal(tokens.length, 2);
    assert.equal(tokens[0].text, prefix + '\n\nENDING ');
    assert.equal(tokens[1].href, 'https://example.test/ending_(kept)');
    assert.equal(source.slice(tokens[1].start, tokens[1].end), '[Keep this](https://example.test/ending_(kept))');
    const html = createWordPressArticle({ body: source }).html;
    assert.match(html, /ENDING <a href="https:\/\/example\.test\/ending_\(kept\)"/);
    assert.doesNotMatch(html, /<img\b/);
  }
});

test('Standalone linked images with balanced targets keep exact source ranges and explicit export choice', () => {
  const image = '![Fictional image](https://example.test/image_(2).jpg)', body = 'Before.\n\n' + image + '\n\nAfter.';
  const images = analyzeWordPressImages(body);
  assert.equal(images.length, 1); assert.equal(images[0].eligible, true);
  assert.equal(body.slice(images[0].start, images[0].end), image);
  assert.doesNotMatch(createWordPressArticle({ body }).html, /<img\b/);
  assert.match(createWordPressArticle({ body }, { includeLinkedImages: true }).html, /src="https:\/\/example\.test\/image_\(2\)\.jpg"/);
});
