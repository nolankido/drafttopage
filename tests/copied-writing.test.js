import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { parseCopiedWriting } from '../public/copied-writing.js';
import { parseArticleImport } from '../public/article-import.js';
import { createFormattedArticle, createHTMLSource } from '../public/html-export.js';
import { createWordPressArticle } from '../public/wordpress-export.js';
import { wordDocumentParts } from '../public/word-export.js';
import { createWorkspaceBackup, parseWorkspaceBackup } from '../public/workspace.js';

const plain = text => parseCopiedWriting({ format: 'plain', text });
function readExports(draft) {
  return JSON.parse(execFileSync('python3', ['-c', String.raw`
import json,sys,xml.etree.ElementTree as E
from html.parser import HTMLParser
class Reader(HTMLParser):
 def __init__(self):super().__init__();self.paragraphs=[];self.current=None;self.tags=[]
 def handle_starttag(self,tag,attrs):
  self.tags.append(tag)
  assert tag in ['p','br'], 'Plain writing unexpectedly became '+tag
  if tag=='p':assert self.current is None;self.current=''
  elif tag=='br':self.current+='\n'
 def handle_endtag(self,tag):
  assert tag=='p' and self.current is not None
  self.paragraphs.append(self.current);self.current=None
 def handle_data(self,text):
  if self.current is not None:self.current+=text
  else:assert not text.strip()
v=json.load(sys.stdin);html=[]
for source in v['html']:
 r=Reader();r.feed(source);assert r.current is None;html.append('\n\n'.join(r.paragraphs))
ns={'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main'};w='{'+ns['w']+'}'
parts={p['name']:p['content'] for p in v['word']};root=E.fromstring(parts['word/document.xml'])
assert not root.findall('.//w:hyperlink',ns)
paragraphs=[]
for p in root.findall('w:body/w:p',ns):
 paragraphs.append(''.join(n.text or '' if n.tag==w+'t' else '\n' if n.tag==w+'br' else '\t' if n.tag==w+'tab' else '' for n in p.iter()))
print(json.dumps({'html':html,'word':'\n\n'.join(paragraphs)}))
`], { input: JSON.stringify({ html: [createHTMLSource(draft), createWordPressArticle(draft).html], word: wordDocumentParts(draft) }), encoding: 'utf8' }));
}

test('Plain clipboard page details, headings, separators and reply fences remain visible article writing', () => {
  for (const source of [
    '---\ntitle: Literal clipboard title\ncustom: [keep, this]\ndraft: false\n---\n\nKeep the ending.',
    '# Literal title\n\n## Literal section\n\nUnderlined title\n===\n\n---\n\n***',
    '```markdown\n# Keep this fence and heading\n```',
    '```json\n{"title":"Keep this JSON as writing"}\n```',
  ]) {
    const result = plain(source);
    assert.deepEqual({ ...result.draft, body: '' }, { title: '', excerpt: '', description: '', slug: 'untitled-article', body: '', questions: [] });
    assert.equal(createFormattedArticle(result.draft).text, source);
    assert.deepEqual(result.unmapped, []);
    assert.equal(result.requiresAck, true);
    assert.match(result.warnings.join(' '), /Punctuation stays literal/);
    const exported = readExports(result.draft);
    assert.deepEqual(exported, { html: [source, source], word: source });
  }
});

test('Plain clipboard links, lists, tables, code, HTML and Unicode stay literal across independent export readers', () => {
  const source = '**literal bold** and _literal emphasis_, `literal code`, \\*literal slash\\*.\n\n' +
    '[label](https://example.com/) ![image](https://example.com/picture.png) &lt; <script>fictional()</script>\n\n' +
    '1. Literal numbered line\n- Literal bullet\n> Literal quotation\n\n' +
    '| Literal | Table |\n| --- | --- |\n| A | B |\n\n' +
    '😀 café 界 ALPHA_END_4827\nNext\tline.';
  const result = plain(source), exported = readExports(result.draft);
  assert.deepEqual(exported, { html: [source, source], word: source });
  const backup = createWorkspaceBackup({ profile: 'guide', notes: '', audience: '', purpose: '' }, result.draft);
  assert.deepEqual(parseWorkspaceBackup(backup).draft, result.draft);
});

test('Plain clipboard normalizes line endings and rejects unsupported input without truncation', () => {
  const result = plain('# Literal\r\nSecond line\rEnding');
  assert.equal(createFormattedArticle(result.draft).text, '# Literal\nSecond line\nEnding');
  for (const source of ['', ' \r\n\t', 'bad\u0000text', 'bad\u000btext', 'bad\u007ftext', '界'.repeat(174763)]) assert.throws(() => plain(source));
});

test('Plain clipboard capacity includes literal escapes and accepts the exact article bound', () => {
  assert.equal(plain('a'.repeat(60000)).draft.body.length, 60000);
  const result = plain('!'.repeat(30000));
  assert.equal(result.draft.body.length, 60000);
  assert.equal(createFormattedArticle(result.draft).text, '!'.repeat(30000));
  for (const source of ['a'.repeat(60001), '!'.repeat(30001), '🙂'.repeat(30001)]) assert.throws(() => plain(source), /60,000|nothing was truncated/);
});

test('Intentional Markdown still extracts page details and interprets authored formatting', () => {
  const result = parseArticleImport('---\ntitle: An intentional title\n---\n\n# An intentional title\n\n**Bold** and [source](https://example.com/).', '', 'markdown');
  assert.equal(result.draft.title, 'An intentional title');
  assert.equal(result.draft.body, '**Bold** and [source](https://example.com/).');
  assert.match(createHTMLSource(result.draft), /<strong>Bold<\/strong> and <a /);
  assert.equal(parseArticleImport('```markdown\n# Intentional heading\n\nBody.\n```', '', 'markdown').draft.title, 'Intentional heading');
});
