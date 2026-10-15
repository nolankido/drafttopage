import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

test('The Google Docs route keeps every shared workspace control and has a distinct canonical indexed URL', async () => {
  const [page, writer, sitemap, release] = await Promise.all(['google-docs-to-wordpress/index.html','write/index.html','sitemap.xml','release.json'].map(p => readFile('public/' + p, 'utf8')));
  const ids = html => [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
  assert.equal(new Set(ids(page)).size, ids(page).length); for (const id of ids(writer)) assert.ok(ids(page).includes(id), id);
  assert.match(page, /data-workspace="google-docs"/); assert.match(page, /<title>Free Google Docs to WordPress Converter \| Draft to Page<\/title>/);
  assert.match(page, /rel="canonical" href="https:\/\/drafttopage.com\/google-docs-to-wordpress\/"/); assert.match(page, /href="\/google-docs-to-wordpress\/" aria-current="page"/);
  assert.equal((sitemap.match(/<loc>https:\/\/drafttopage.com\/google-docs-to-wordpress\/<\/loc>/g) || []).length, 1); assert.equal(JSON.parse(release).googleDocsWordPressTool, true); assert.equal(JSON.parse(release).copiedWritingPreview, true);
  assert.doesNotMatch(page, /name="robots" content="noindex"|<iframe|src="https?:|<form/);
});
test('A balanced native paste-first layout keeps file alternatives closed and header choice/preview outside them', async () => {
  const page = await readFile('public/google-docs-to-wordpress/index.html', 'utf8');
  const parsed = JSON.parse(execFileSync('python3', ['-c', String.raw`
import sys,json
from html.parser import HTMLParser
class P(HTMLParser):
 def __init__(self):super().__init__();self.stack=[];self.nodes={};self.order=[]
 def handle_starttag(self,t,a):
  a=dict(a)
  if 'id' in a:self.nodes[a['id']]={'ancestors':[v[1].get('id') for v in self.stack],'attrs':a};self.order.append(a['id'])
  if t not in 'area base br col embed hr img input link meta param source track wbr'.split():self.stack.append((t,a))
 def handle_endtag(self,t):assert self.stack[-1][0]==t;self.stack.pop()
p=P();p.feed(sys.stdin.read());assert not p.stack
assert 'open' in p.nodes['import-panel']['attrs'];assert 'open' not in p.nodes['copied-import-alternatives']['attrs']
for key in ['import-file','import-format']:assert 'copied-import-alternatives' in p.nodes[key]['ancestors']
for key in ['import-text','import-html-options','import-first-row-headers','preview-import','import-preview','cancel-import']:assert 'copied-import-alternatives' not in p.nodes[key]['ancestors']
assert p.order.index('import-text')<p.order.index('import-file') and p.order.index('import-panel')<p.order.index('draft')
assert p.nodes['import-preview-heading']['attrs']['tabindex']=='-1'
print(json.dumps({'pasteFirst':True,'closedFileAlternatives':True,'headersAndPreviewReachable':True}))
`], { input: page, encoding: 'utf8' })); assert.deepEqual(parsed, { pasteFirst: true, closedFileAlternatives: true, headersAndPreviewReachable: true });
});
test('The acquisition page explains clipboard limits, plain fallback, omissions, source retention and manual handoff', async () => {
  const page = await readFile('public/google-docs-to-wordpress/index.html', 'utf8');
  for (const pattern of [/Ctrl\+V/, /Command\+V/, /512 KiB/, /60,000/, /Plain text only/, /Images become/, /no autosave/, /no Google account connection/i, /cannot be applied until a selection converts successfully/, /Code editor/, /Return to Visual editor/, /No partnership is claimed/]) assert.match(page, pattern);
  assert.match(page, /support.google.com\/docs\/answer\/161768/); assert.match(page, /support.google.com\/docs\/answer\/49114/); assert.doesNotMatch(page, /\u2014|<img\b|contenteditable=/);
  const home = await readFile('public/index.html', 'utf8'); assert.match(home, /href="\/google-docs-to-wordpress\/" class="draft-start"/); assert.match(home, /Paste from Google Docs/);
});
test('The shared handler uses only event clipboard data and never introduces a second HTML insertion sink', async () => {
  const [capture, importer, paste] = await Promise.all(['public/copied-writing.js','public/import-controls.js','public/paste-guard.js'].map(p => readFile(p, 'utf8')));
  assert.doesNotMatch(capture + importer, /navigator\.clipboard\.read|innerHTML|insertAdjacentHTML|contenteditable|localStorage|sessionStorage/);
  assert.match(importer, /copiedWritingSource\(event.clipboardData\)/); assert.match(importer, /copiedFailed/); assert.match(paste, /skipPaste\(event\)/);
});
