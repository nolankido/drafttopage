import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { inlineTokens } from '../public/markdown-inline.js';
import { inlineParts } from '../public/preview.js';
import { createWordPressArticle, wordPressArticleText } from '../public/wordpress-export.js';
import { createFormattedArticle, createHTMLSource } from '../public/html-export.js';
import { wordDocumentParts } from '../public/word-export.js';

test('Underscores inside ASCII and Unicode identifiers stay literal with exact source spans', () => {
  for (const value of ['ALPHA_END_4827', 'snake_case_name', '10_20_30', 'foo_bar_', '_foo_bar', '_пристаням_стремятся', '日本_語_本文', '𝒜_name_𝒵', 'e\u0301_name_suffix', '__unsupported__']) {
    assert.deepEqual(inlineTokens(value), [{ type: 'text', text: value, start: 0, end: value.length }], value);
    assert.equal(inlineParts(value).map(part => part.text).join(''), value);
  }
});

test('Simple standalone underscore emphasis keeps Unicode and punctuation boundaries without consuming whitespace', () => {
  for (const value of ['_word_', '(_two words_)', '“_日本語_”', '😀_word_😀', '«_é_».']) assert.equal(inlineTokens(value).filter(part => part.type === 'em').length, 1, value);
  for (const value of ['_ word_', '_word _', '_\u00a0word_', '_word\u00a0_', 'foo_"bar"_', '_foo_бар']) assert.equal(inlineTokens(value).filter(part => part.type === 'em').length, 0, value);
  const source = '前😀 ALPHA_END_4827 (_kept_) 後';
  const part = inlineTokens(source).find(item => item.type === 'em');
  assert.equal(source.slice(part.start, part.end), '_kept_'); assert.equal(part.text, 'kept');
});

test('Escapes, code, links and asterisk emphasis keep their existing precedence and offsets', () => {
  const source = '\\_literal\\_ `ALPHA_END_4827` [snake_case_name](https://example.com/a_b_c) **strong** *italic* _emphasis_';
  const tokens = inlineTokens(source);
  assert.deepEqual(tokens.filter(part => part.type !== 'text').map(part => part.type), ['code', 'link', 'strong', 'em', 'em']);
  assert.equal(tokens.find(part => part.type === 'link').href, 'https://example.com/a_b_c');
  assert.equal(inlineParts('\\_literal\\_').map(part => part.text).join(''), '_literal_');
  for (const token of tokens) assert.equal(token.end - token.start, source.slice(token.start, token.end).length);
});

test('Independent HTML and Word XML readers retain literal identifier underscores in every rendered export', () => {
  const body = 'Keep ALPHA_END_4827 and 日本_語_本文 with _emphasis_.', draft = { title: 'Fictional identifiers', body };
  const fragments = [createWordPressArticle(draft).html, createFormattedArticle(draft).html, createHTMLSource(draft)];
  const parts = wordDocumentParts(draft), document = parts.find(part => part.name === 'word/document.xml').content;
  const parsed = JSON.parse(execFileSync('python3', ['-c', String.raw`
import sys,json,xml.etree.ElementTree as E
from html.parser import HTMLParser
class P(HTMLParser):
 def __init__(self): super().__init__(convert_charrefs=True); self.text=[]; self.em=0
 def handle_data(self,t): self.text.append(t)
 def handle_starttag(self,t,a):
  if t=='em': self.em+=1
v=json.load(sys.stdin); html=[]
for fragment in v['html']:
 p=P(); p.feed(fragment); html.append({'text':''.join(p.text).strip(),'em':p.em})
root=E.fromstring(v['xml']); ns={'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
print(json.dumps({'html':html,'word':''.join(n.text or '' for n in root.findall('.//w:t',ns))}))
`], { input: JSON.stringify({ html: fragments, xml: document }), encoding: 'utf8' }));
  for (const result of parsed.html) { assert.equal(result.text.replace(/\s+/g, ' '), 'Keep ALPHA_END_4827 and 日本_語_本文 with emphasis.'); assert.equal(result.em, 1); }
  assert.equal(parsed.word, 'Keep ALPHA_END_4827 and 日本_語_本文 with emphasis.');
  assert.equal(wordPressArticleText(draft).text, parsed.word); assert.equal(body, draft.body);
});

test('Near-limit identifier runs preserve the complete final identifier and a following valid emphasis pair', () => {
  const body = 'word_one_two '.repeat(4500) + 'ALPHA_END_4827 _final emphasis_';
  const tokens = inlineTokens(body);
  assert.equal(tokens.filter(part => part.type === 'em').length, 1); assert.equal(tokens.at(-1).text, 'final emphasis');
  assert.match(tokens[0].text, /ALPHA_END_4827 /); assert.equal(tokens.at(-1).end, body.length);
  assert.equal(inlineParts(body).map(part => part.text).join(''), body.replace('_final emphasis_', 'final emphasis'));
});
