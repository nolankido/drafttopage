import test from 'node:test';
import assert from 'node:assert/strict';
import { htmlLinkResolver, HTML_SOURCE_URL_LIMIT } from '../public/html-link-context.js';
import { htmlTreeToMarkdown } from '../public/html-import.js';
import { createHTMLSource } from '../public/html-export.js';
import { createWordPressArticle } from '../public/wordpress-export.js';
import { wordDocumentParts } from '../public/word-export.js';
import { analyzeDraft } from '../public/draft-review.js';
import { HTML_SOURCE_SAMPLE } from '../public/html-source-sample.js';

const element = (name, nodes = [], attrs = {}) => ({ nodeType: 1, localName: name, childNodes: nodes.map(n => typeof n === 'string' ? { nodeType: 3, nodeValue: n, childNodes: [] } : n), getAttribute: key => attrs[key] ?? null, hasAttribute: key => Object.hasOwn(attrs, key) });
const tree = (...nodes) => ({ nodeType: 11, childNodes: nodes });

test('Explicit source-page context resolves root, directory, parent, query, fragment, and network references', () => {
  const resolve = htmlLinkResolver('https://example.com/articles/entry?edition=2#old');
  for (const [input, expected] of [
    ['/about', 'https://example.com/about'], ['next', 'https://example.com/articles/next'], ['../guide', 'https://example.com/guide'], ['./chapter', 'https://example.com/articles/chapter'],
    ['?print=1', 'https://example.com/articles/entry?print=1'], ['#details', 'https://example.com/articles/entry?edition=2#details'], ['//cdn.example.org/help', 'https://cdn.example.org/help'],
    ['../../../../top', 'https://example.com/top'], ['café?x=1&y=2', 'https://example.com/articles/caf%C3%A9?x=1&y=2']
  ]) assert.deepEqual(resolve(input), { href: expected, relative: true }, input);
  assert.deepEqual(resolve('https://other.example/path'), { href: 'https://other.example/path', relative: false });
});

test('Trailing slashes and HTTP sources retain their actual URL meaning', () => {
  assert.equal(htmlLinkResolver('https://example.com/folder/')('next').href, 'https://example.com/folder/next');
  assert.equal(htmlLinkResolver('https://example.com/folder')('next').href, 'https://example.com/next');
  assert.equal(htmlLinkResolver('http://example.com/folder/')('//other.example/path').href, 'http://other.example/path');
  assert.equal(htmlLinkResolver('  https://example.com/folder/  ')('#part').href, 'https://example.com/folder/#part');
});

test('Blank context preserves absolute-only behavior and never invents a source origin', () => {
  for (const base of ['', ' ', '\t']) {
    const resolve = htmlLinkResolver(base);
    for (const target of ['/about', '../guide', '#part', '//example.com/guide']) assert.equal(resolve(target).href, null);
    assert.equal(resolve('https://example.com/guide').href, 'https://example.com/guide');
  }
});

test('Unsafe schemes, credentials, malformed absolute URLs and ambiguous input are never repaired', () => {
  const resolve = htmlLinkResolver('https://example.com/original');
  for (const target of [null, undefined, 5, '', 'javascript:alert(1)', 'JaVaScRiPt:bad()', 'data:text/html,test', 'vbscript:bad', 'file:///tmp/a', 'mailto:person@example.com', 'tel:123', 'https:example.com', 'https:/example.com', 'http:\\example.com', '//user:secret@other.example/path', 'https://user:secret@example.com/', '///other.example/path', '\\other.example/path', '/a b', '/a\nb', '/a\tb', '/a\0b', '/a<b', '/a"b']) assert.equal(resolve(target).href, null, String(target));
  assert.equal(resolve('./chapter:one').href, 'https://example.com/chapter:one');
});

test('Source context is optional, bounded, absolute HTTP(S), and free of credentials', () => {
  for (const base of [null, 5, {}, [], '/source', '//example.com', 'example.com/source', 'ftp://example.com', 'javascript:bad()', 'https:/example.com', 'https://u:p@example.com/', 'https://example.com/a b', 'https://example.com/a\\b']) assert.throws(() => htmlLinkResolver(base));
  const prefix = 'https://example.com/', maximum = prefix + 'a'.repeat(HTML_SOURCE_URL_LIMIT - prefix.length);
  assert.equal(maximum.length, 2048); assert.equal(htmlLinkResolver(maximum)('/guide').href, 'https://example.com/guide');
  assert.throws(() => htmlLinkResolver(maximum + 'a'), /2,048/);
});

test('Imported base elements and document metadata cannot supply or override author context', () => {
  const root = tree(element('base', [], { href: 'https://untrusted.example/' }), element('p', [element('a', ['Guide'], { href: '/guide' })]));
  root.baseURI = 'https://drafttopage.com/';
  const without = htmlTreeToMarkdown(root), withContext = htmlTreeToMarkdown(root, { sourceURL: 'https://author.example/article' });
  assert.equal(without.markdown, 'Guide'); assert.match(without.warnings.join(' '), /base URLs were ignored/);
  assert.equal(withContext.markdown, '[Guide](https://author.example/guide)'); assert.match(withContext.warnings.join(' '), /relative link target was resolved/);
  assert.doesNotMatch(withContext.markdown, /drafttopage|untrusted/);
});

test('Resolved links retain formatting and flow through every article exporter without leaking context settings', () => {
  const root = tree(element('p', [element('a', [element('strong', ['Read']), ' the guide'], { href: '/guide?x=1&y=2' }), ' and ', element('a', ['Next'], { href: '../next' })]));
  const result = htmlTreeToMarkdown(root, { sourceURL: 'https://example.com/PRIVATE_SETTING_PATH' }), draft = { body: result.markdown };
  assert.match(result.markdown, /\[\*\*Read\*\* the guide\]\(https:\/\/example.com\/guide\?x=1&y=2\)/);
  assert.match(result.warnings.join(' '), /2 occurrences/);
  assert.deepEqual(analyzeDraft(draft).links.map(link => link.href), ['https://example.com/guide?x=1&y=2', 'https://example.com/next']);
  for (const output of [createHTMLSource(draft), createWordPressArticle(draft).html, ...wordDocumentParts(draft).map(part => part.content)]) {
    assert.doesNotMatch(output, /PRIVATE_SETTING_PATH|sourceURL|import-source-url/);
  }
  assert.match(createHTMLSource(draft), /href="https:\/\/example.com\/guide\?x=1&amp;y=2"/);
});

test('Context errors block conversion and resolved-URL expansion retains whole-article limits', () => {
  const plain = tree(element('p', ['Unchanged text']));
  assert.throws(() => htmlTreeToMarkdown(plain, { sourceURL: 'invalid' }), /absolute/);
  const large = tree(element('p', Array.from({ length: 100 }, (_, i) => element('a', ['Keep'], { href: '#part' + i }))));
  assert.throws(() => htmlTreeToMarkdown(large, { sourceURL: 'https://example.com/' + 'x'.repeat(1000) }), /exceeds 60,000/);
});

test('Fictional example explicitly supplies context for a relative input and actual converted output', () => {
  assert.match(HTML_SOURCE_SAMPLE.html, /href="\/garden"/); assert.equal(HTML_SOURCE_SAMPLE.sourceURL, 'https://example.com/notes/plan');
  assert.match(HTML_SOURCE_SAMPLE.markdown, /\[source link\]\(https:\/\/example.com\/garden\)/);
});
