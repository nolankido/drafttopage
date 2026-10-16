import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Explicitly selected local source only. No checkout, network, storage, or UI mutation.
const here = fileURLToPath(new URL('../', import.meta.url));
const target = resolve(process.env.DRAFTTOPAGE_COMPAT_ROOT || here);
assert.equal(JSON.parse(readFileSync(resolve(target, 'package.json'), 'utf8')).name, 'drafttopage');
const load = async root => Object.assign({}, ...await Promise.all(['workspace', 'article-import', 'wordpress-kit', 'wordpress-export'].map(name => import(pathToFileURL(resolve(root, 'public', name + '.js')).href))));
const [baseline, candidate] = await Promise.all([load(here), load(target)]);
const sides = [{ name: 'baseline', api: baseline }, { name: target === resolve(here) ? 'baseline self-check' : 'explicit candidate', api: candidate }];

const source = { profile: 'guide', notes: 'PRIVATE_SOURCE_PORT_7361: fictional notes, café 日本語 😀.', audience: 'PRIVATE_AUDIENCE_PORT_7361', purpose: 'PRIVATE_PURPOSE_PORT_7361' };
const fields = { title: 'Fictional portable article', excerpt: 'An invented compatibility exercise.', description: 'A fictional portability fixture.', slug: 'fictional-portable-article' };
const body = [
  '## First inspection', '', 'Keep ALPHA_END_7361, café, 日本語, and 😀 with **bold** and _emphasis_.', '',
  '4. Review the source', '  - Preserve uncertainty', '5. Check the ending', '',
  '| Label | Value |', '| --- | --- |', '| Pipe | Literal \\| marker |', '',
  '> Fictional quoted observation.', '', '~~~js', 'const marker = "<safe>";', '~~~', '',
  'Read [the reference](https://example.com/portable?x=1&y=2).', '',
  '![Fictional picture](https://example.com/fictional-portable.png)', '',
  '<script>FICTIONAL_INERT_7361</script>', '', 'Last paragraph: PORTABILITY_END_7361.'
].join('\n');
const draft = { ...fields, body, questions: ['PRIVATE_REVIEW_PORT_7361: a fictional question.'] };
const clone = value => structuredClone(value);
const unit = 'café 日本語 😀 ALPHA_END_7361\n', ending = 'PORTABILITY_END_7361';
const longBody = unit.repeat(Math.floor((60000 - ending.length) / unit.length)) + ending;
assert.ok(longBody.length > 59950 && longBody.length <= 60000);

for (const [name, writing] of [
  ['notes only', null], ['complete article', draft],
  ['near-limit Unicode article', { ...draft, body: longBody }]
]) test('Portability: version-1 ' + name + ' round-trips in both directions', () => {
  for (const [from, to] of [[baseline, candidate], [candidate, baseline]]) {
    const original = { source: clone(source), draft: clone(writing) }, before = clone(original);
    const bytes = from.createWorkspaceBackup(original.source, original.draft);
    const opened = to.parseWorkspaceBackup(bytes);
    assert.deepEqual(opened, { format: 'drafttopage-workspace', version: 1, ...original });
    assert.equal(to.createWorkspaceBackup(opened.source, opened.draft), bytes);
    assert.deepEqual(from.parseWorkspaceBackup(to.createWorkspaceBackup(opened.source, opened.draft)), opened);
    assert.deepEqual(original, before);
  }
});

test('Portability: unsupported private formats and extra state fail closed on both sides', () => {
  const valid = JSON.parse(baseline.createWorkspaceBackup(source, draft));
  const invalid = [
    { ...clone(valid), version: 2 }, { ...clone(valid), approved: true },
    { ...clone(valid), pendingImport: 'PRIVATE_PENDING_PORT_7361' },
    { ...clone(valid), draft: { ...clone(draft), exportChoice: 'wordpress' } },
    { ...clone(valid), source: { ...clone(source), notes: '\u0000' } },
    { ...clone(valid), draft: { ...clone(draft), body: 'x'.repeat(60001) } }
  ];
  for (const { api } of sides) for (const value of invalid) assert.throws(() => api.parseWorkspaceBackup(JSON.stringify(value)));
  assert.deepEqual(JSON.parse(baseline.createWorkspaceBackup(source, draft)), valid);
});

for (const format of ['markdown', 'json']) test('Portability: explicit ' + format + ' import retains shared article and metadata', () => {
  const expected = { ...clone(draft), questions: [] };
  const raw = format === 'json' ? JSON.stringify(expected) : '---\n' + Object.entries(fields).map(([key, value]) => key + ': ' + JSON.stringify(value)).join('\n') + '\ndraft: true\n---\n\n' + body;
  for (const { api, name } of sides) {
    assert.deepEqual(api.parseArticleImport(raw, 'fictional-portable.' + (format === 'json' ? 'json' : 'md'), format).draft, expected, name);
    assert.throws(() => api.parseArticleImport(baseline.createWorkspaceBackup(source, draft), 'private.json', 'json'), /private workspace backup/i);
  }
});

// Read actual ZIP bytes with independent standard-library parsers, entirely in memory.
function readKit(bytes) {
  return JSON.parse(execFileSync('python3', ['-c', String.raw`
import sys,io,json,base64,zipfile,re
from html.parser import HTMLParser
class P(HTMLParser):
 def __init__(self): super().__init__(convert_charrefs=True); self.text=[]; self.tags={}; self.links=[]; self.images=[]; self.starts=[]
 def handle_starttag(self,t,a):
  a=dict(a); self.tags[t]=self.tags.get(t,0)+1
  if t in ['p','h2','li','th','td','blockquote','pre','br']: self.text.append(' ')
  if t=='a': self.links.append(a)
  if t=='img': self.images.append(a)
  if t=='ol': self.starts.append(a.get('start'))
 def handle_endtag(self,t):
  if t in ['p','h2','li','th','td','blockquote','pre']: self.text.append(' ')
 def handle_data(self,t): self.text.append(t)
z=zipfile.ZipFile(io.BytesIO(base64.b64decode(sys.stdin.read()))); assert z.testzip() is None
assert len(z.namelist())==len(set(z.namelist()))==6
assert all(not i.is_dir() and not i.flag_bits&1 for i in z.infolist())
files={n:z.read(n).decode('utf-8') for n in z.namelist()}
p=P(); p.feed(files['wordpress-blocks.html']); reading=P(); reading.feed(files['reading-page.html'])
print(json.dumps({'files':files,'text':re.sub(r'\s+',' ',''.join(p.text)).strip(),'tags':p.tags,'links':p.links,'images':p.images,'starts':p.starts,'readingImages':reading.images}))
`], { input: Buffer.from(bytes).toString('base64'), encoding: 'utf8', maxBuffer: 2 * 1024 * 1024 }));
}

for (const includeLinkedImages of [false, true]) test('Portability: independent WordPress ZIP contracts with linked images ' + includeLinkedImages, t => {
  const expected = ['First inspection', 'Keep ALPHA_END_7361, café, 日本語, and 😀 with bold and emphasis.',
    'Review the source', 'Preserve uncertainty', 'Check the ending', 'Label Value Pipe Literal | marker',
    'Fictional quoted observation.', 'const marker = "<safe>";', 'Read the reference.',
    ...(!includeLinkedImages ? ['![Fictional picture](https://example.com/fictional-portable.png)'] : []),
    '<script>FICTIONAL_INERT_7361</script>', 'Last paragraph: PORTABILITY_END_7361.'].join(' ');
  const privateWriting = clone(draft), before = clone(privateWriting);
  for (const { api, name } of sides) {
    const result = readKit(api.createWordPressKit(privateWriting, { includeLinkedImages }).bytes);
    assert.deepEqual(Object.keys(result.files), ['wordpress-blocks.html', 'article-body.md', 'reading-page.html', 'page-details.json', 'REVIEW.txt', 'README.txt'], name);
    assert.equal(result.files['article-body.md'], body); assert.equal(result.text, expected, name);
    if (typeof api.wordPressArticleText === 'function') assert.equal(api.wordPressArticleText(privateWriting, { includeLinkedImages }).text.replace(/\s+/gu, ' ').trim(), result.text, name + ' comparison model');
    else t.diagnostic(name + ' has no WordPress transfer-comparison model; only its publication kit is checked.');
    assert.deepEqual(JSON.parse(result.files['page-details.json']), { ...fields, draft: true });
    assert.equal(result.tags.h2, 1); assert.equal(result.tags.table, 1); assert.equal(result.tags.th, 2); assert.equal(result.tags.td, 2);
    assert.equal(result.tags.pre, 1); assert.equal(result.tags.blockquote, 1); assert.equal(result.tags.strong, 1); assert.equal(result.tags.em, 1);
    assert.deepEqual(result.starts, ['4']); assert.equal(result.tags.script, undefined);
    assert.equal(result.links[0].href, 'https://example.com/portable?x=1&y=2');
    assert.equal(result.images.length, includeLinkedImages ? 1 : 0); assert.deepEqual(result.readingImages, []);
    if (includeLinkedImages) assert.deepEqual(result.images[0], { src: 'https://example.com/fictional-portable.png', alt: 'Fictional picture' });
    for (const file of Object.values(result.files)) assert.doesNotMatch(file, /PRIVATE_(?:SOURCE|AUDIENCE|PURPOSE|REVIEW|PENDING)_PORT_7361/);
  }
  assert.deepEqual(privateWriting, before);
});
