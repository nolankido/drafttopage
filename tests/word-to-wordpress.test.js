import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

test('Word authors get the complete shared workspace, WordPress destination, and a distinct indexed entry page', async () => {
  const [page, writer, sitemap, release] = await Promise.all(['word-to-wordpress/index.html', 'write/index.html', 'sitemap.xml', 'release.json'].map(p => readFile('public/' + p, 'utf8')));
  const ids = html => [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
  assert.equal(new Set(ids(page)).size, ids(page).length);
  for (const id of ids(writer)) assert.ok(ids(page).includes(id), id);
  assert.match(page, /data-workspace="word-to-wordpress"/);
  assert.match(page, /id="article-heading">Edit your imported article/);
  assert.match(page, /For workspace JSON backups, use Save or restore this workspace/);
  assert.doesNotMatch(page, /backups belong in Save or restore, above/);
  assert.match(page, /<title>Free Word to WordPress Converter \| Draft to Page<\/title>/);
  assert.match(page, /rel="canonical" href="https:\/\/drafttopage.com\/word-to-wordpress\/"/);
  assert.match(page, /href="\/word-to-wordpress\/" aria-current="page">Word to WordPress/);
  assert.match(page, /<details id="preview-panel" open>/);
  assert.match(page, /<script type="module" src="\/desk.js">/);
  assert.equal((sitemap.match(/<loc>https:\/\/drafttopage.com\/word-to-wordpress\/<\/loc>/g) || []).length, 1);
  assert.equal(JSON.parse(release).wordToWordPressTool, true);
  assert.doesNotMatch(page, /name="robots" content="noindex"|id="login-form"|<iframe|src="https?:/);
});
test('The file flow comes first and alternate formats stay accessible without nesting the header choice or preview', async () => {
  const page = await readFile('public/word-to-wordpress/index.html', 'utf8');
  const result = JSON.parse(execFileSync('python3', ['-c', String.raw`
import sys,json
from html.parser import HTMLParser
class P(HTMLParser):
 def __init__(self):super().__init__();self.stack=[];self.nodes={};self.order=[]
 def handle_starttag(self,t,a):
  a=dict(a)
  if 'id' in a:self.nodes[a['id']]={'ancestors':[v[1].get('id') for v in self.stack],'attrs':a};self.order.append(a['id'])
  if t not in 'area base br col embed hr img input link meta param source track wbr'.split():self.stack.append((t,a))
 def handle_endtag(self,t):
  assert self.stack[-1][0]==t;self.stack.pop()
p=P();p.feed(sys.stdin.read());assert not p.stack
assert 'open' in p.nodes['import-panel']['attrs'] and 'open' not in p.nodes['word-import-alternatives']['attrs']
for key in ['import-format','import-text','import-html-options']:assert 'word-import-alternatives' in p.nodes[key]['ancestors']
for key in ['import-first-row-headers','import-preview','cancel-import']:assert 'word-import-alternatives' not in p.nodes[key]['ancestors']
assert 'import-preview' not in p.nodes['cancel-import']['ancestors']
assert all(p.order.index('import-panel')<p.order.index(key) for key in ['backup-controls','draft-collection-panel','checkpoint-panel','draft'])
assert p.nodes['import-preview-heading']['attrs']['tabindex']=='-1'
print(json.dumps({'fileFirst':True,'alternatesClosed':True,'clearOutsidePreview':True}))
`], { input: page, encoding: 'utf8' }));
  assert.deepEqual(result, { fileFirst: true, alternatesClosed: true, clearOutsidePreview: true });
});
test('Existing tools keep their original import layout and the new task is linked from useful starting points', async () => {
  for (const route of ['write', 'markdown-to-wordpress', 'markdown-to-html', 'markdown-to-word']) {
    const page = await readFile('public/' + route + '/index.html', 'utf8');
    assert.doesNotMatch(page, /id="word-import-alternatives"|id="start-word-file"/);
    assert.match(page, /<details id="import-panel" class="import-panel">/);
  }
  const home = await readFile('public/index.html', 'utf8');
  assert.match(home, /href="\/word-to-wordpress\/" class="draft-start"/);
  assert.match(home, /href="\/markdown-to-wordpress\/#draft" class="draft-start"/);
  assert.match(home, /Open a Word draft/); assert.match(home, /Paste text or Markdown/);
  for (const route of ['markdown-to-wordpress', 'markdown-to-word', 'help/article-import']) {
    const page = await readFile('public/' + route + '/index.html', 'utf8');
    assert.ok(page.includes('href="/word-to-wordpress/">Word to WordPress converter</a>'));
  }
});
test('The Word-specific guide explains the real conversion and manual publishing limits', async () => {
  const guide = await readFile('scripts/word-to-wordpress-guide.html.inc', 'utf8');
  for (const pattern of [/8 MiB/, /60,000/, /six levels/, /twelve columns/, /100 data rows/, /Images and embedded objects/, /text placeholders/, /Tracked changes/, /No document upload/, /[Bb]rowser recovery is off by default/, /Code editor/, /Return to Visual editor/, /before publishing yourself/, /previews stay temporarily/, /not a complete Word layout conversion/]) assert.match(guide, pattern);
  assert.doesNotMatch(guide, /\u2014|<img\b|<script\b/);
  const intro = await readFile('scripts/word-to-wordpress-intro.html.inc', 'utf8');
  assert.match(intro, /sample is prewritten, not a Word-file import/);
});
