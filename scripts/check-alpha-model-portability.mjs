import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Manual, read-only diagnostic. Prepare any model overlay in an isolated copy first.
const [rootArg, modelArg] = process.argv.slice(2);
if (!rootArg || !modelArg || process.argv.length !== 4) throw new Error('Supply an isolated candidate repository and the explicit model file to check.');
const root = resolve(rootArg), model = resolve(modelArg);
assert.equal(JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')).name, 'drafttopage');
const { wordPressArticleText } = await import(pathToFileURL(model).href);
const { createWordPressArticle } = await import(pathToFileURL(resolve(root, 'public/wordpress-export.js')).href);
const normalize = text => text.replace(/\s+/gu, ' ').trim();
const cases = [
  ['Keep **bold and _nested_**.', 'Keep bold and nested.'],
  ['***bold italic*** and [**styled** link](https://example.com/).', 'bold italic and styled link.'],
  ['Fictional heading\n===\n\nBefore the separator.\n\n---\n\nAfter the separator.', 'Fictional heading Before the separator. After the separator.']
];
let checked = 0;
for (const [body, expected] of cases) for (const includeLinkedImages of [false, true]) {
  const image = '![Fictional picture](https://example.com/fictional-model.png)';
  const draft = { title: 'Fictional integration probe', body: body + '\n\n' + image };
  const result = wordPressArticleText(draft, { includeLinkedImages });
  const html = createWordPressArticle(draft, { includeLinkedImages }).html;
  const visible = execFileSync('python3', ['-c', String.raw`
import sys,re
from html.parser import HTMLParser
class P(HTMLParser):
 def __init__(self): super().__init__(convert_charrefs=True); self.text=[]
 def handle_data(self,t): self.text.append(t)
 def handle_starttag(self,t,a):
  if t in ['p','h2','br']: self.text.append(' ')
 def handle_endtag(self,t):
  if t in ['p','h2']: self.text.append(' ')
p=P();p.feed(sys.stdin.read());print(re.sub(r'\s+',' ',''.join(p.text)).strip(),end='')
`], { input: html, encoding: 'utf8' });
  assert.equal(normalize(result.text), expected + (includeLinkedImages ? '' : ' ' + image));
  assert.equal(normalize(result.text), visible);
  assert.equal(result.imageCount, includeLinkedImages ? 1 : 0);
  checked++;
}
console.log(JSON.stringify({ passed: checked, root, model, scope: 'Text-model overlay against explicit candidate dependencies, not a merged application or browser acceptance.' }));
