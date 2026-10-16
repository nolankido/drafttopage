import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { parseArticleImport } from '../public/article-import.js';
import { createWorkspaceBackup, parseWorkspaceBackup } from '../public/workspace.js';
import { createBrowserRecovery, parseBrowserCopy, RECOVERY_KEY } from '../public/browser-recovery.js';
import { createCheckpointHistory } from '../public/revisions.js';
import { createWordPressKit } from '../public/wordpress-kit.js';

// Fictional golden source, written independently of the export implementation.
const body = [
  '## Before starting', '',
  'Keep **every** word, including café, 日本語, and 😀. Read [the reference](https://example.com/alpha?x=1&y=2).', '',
  '4. Inspect the source', '  - Keep uncertainty', '5. Preview the post', '',
  '| Item | Action |', '| --- | --- |', '| Seedling | Water gently |', '| Label | Keep literal \\| text |', '',
  '> A quotation is still part of the article.', '',
  '~~~js', 'const sample = "<safe>";', '~~~', '',
  '![Fictional diagram](https://example.com/fictional-alpha.png)', '',
  'Final marker: ALPHA_END_4827.'
].join('\n');
const fields = { title: 'Fictional alpha field notes', excerpt: 'A fictional import and recovery exercise.', description: 'Fictional alpha fixture, not a real report.', slug: 'fictional-alpha-field-notes' };
const source = { profile: 'guide', notes: 'PRIVATE_SOURCE_4827: fictional private notes.', audience: 'PRIVATE_AUDIENCE_4827', purpose: 'PRIVATE_PURPOSE_4827' };
const question = 'PRIVATE_REVIEW_4827: check the fictional observation.';
const stamp = '2026-10-16T01:00:00.000Z';
const copy = value => structuredClone(value);
const canonical = value => parseWorkspaceBackup(createWorkspaceBackup(value.source, value.draft));
const settle = () => new Promise(resolve => setImmediate(resolve));

function imported(format) {
  const draft = { ...fields, body, questions: [] };
  const raw = format === 'json' ? JSON.stringify(draft) : '---\n' + Object.entries(fields).map(([key, value]) => key + ': ' + JSON.stringify(value)).join('\n') + '\ndraft: true\n---\n\n' + body;
  const result = parseArticleImport(raw, 'fictional-alpha.' + (format === 'json' ? 'json' : 'md'), format);
  assert.deepEqual(result.draft, draft); assert.deepEqual(result.unmapped, []);
  return { source: copy(source), draft: { ...result.draft, questions: [question] } };
}

function environment() {
  const records = new Map(); let held = false, full = false, writes = 0;
  const storage = {
    getItem: key => records.get(key) ?? null,
    setItem: (key, value) => { if (full) throw new Error('Fictional storage-full failure'); records.set(key, value); writes++; },
    removeItem: key => records.delete(key)
  };
  const locks = { request: async (name, options, action) => {
    assert.equal(options.ifAvailable, true); await Promise.resolve();
    if (held) return action(null);
    held = true; try { return await action({ name }); } finally { held = false; }
  } };
  return { storage, locks, records, writes: () => writes, full: value => { full = value; } };
}

function session(env, initial) {
  let workspace = copy(initial), approved = true, decision = true, timer = null;
  const history = createCheckpointHistory({ now: () => stamp });
  const control = createBrowserRecovery({ storage: () => env.storage, locks: () => env.locks,
    capture: () => ({ ...copy(workspace), approved, pendingImport: 'PRIVATE_PENDING_4827', exportChoice: 'PRIVATE_CHOICE_4827' }),
    restore: value => { history.save(workspace, 'Before browser restore'); workspace = { source: copy(value.source), draft: copy(value.draft) }; approved = false; },
    hasWork: () => Boolean(workspace.draft?.body || workspace.source.notes), confirm: () => decision, now: () => stamp,
    setTimer: callback => { timer = callback; return 1; }, clearTimer: () => { timer = null; }
  });
  return { control, history, capture: () => copy(workspace), approved: () => approved, decision: value => { decision = value; },
    edit: text => { workspace.draft.body = text; approved = false; }, tick: () => { const callback = timer; timer = null; callback?.(); } };
}

// Independent standard-library reader checks actual bytes, CRCs, markup, and visible text.
function inspectKit(kit) {
  return JSON.parse(execFileSync('python3', ['-c', String.raw`
import sys,json,io,base64,zipfile,re
from html.parser import HTMLParser
class P(HTMLParser):
 def __init__(self): super().__init__(convert_charrefs=True); self.text=[]; self.tags={}; self.links=[]; self.images=[]; self.starts=[]; self.comments=[]
 def handle_starttag(self,t,a):
  a=dict(a); self.tags[t]=self.tags.get(t,0)+1
  if t in ['p','h2','h3','h4','h5','h6','li','th','td','pre','blockquote','br']: self.text.append(' ')
  if t=='a': self.links.append(a)
  if t=='img': self.images.append(a)
  if t=='ol': self.starts.append(a.get('start'))
 def handle_endtag(self,t):
  if t in ['p','h2','h3','h4','h5','h6','li','th','td','pre','blockquote']: self.text.append(' ')
 def handle_data(self,t): self.text.append(t)
 def handle_comment(self,t): self.comments.append(t.strip())
z=zipfile.ZipFile(io.BytesIO(base64.b64decode(sys.stdin.read()))); assert z.testzip() is None
assert len(z.namelist())==len(set(z.namelist()))==6
assert all(not i.is_dir() and not i.flag_bits&1 for i in z.infolist())
files={n:z.read(n).decode('utf-8') for n in z.namelist()}; p=P(); p.feed(files['wordpress-blocks.html'])
print(json.dumps({'files':files,'text':re.sub(r'\s+',' ',''.join(p.text)).strip(),'tags':p.tags,'links':p.links,'images':p.images,'starts':p.starts,'comments':p.comments}))
`], { input: Buffer.from(kit.bytes).toString('base64'), encoding: 'utf8', maxBuffer: 2 * 1024 * 1024 }));
}

function verifyKit(workspace, includeLinkedImages = false, ending = 'ALPHA_END_4827') {
  const before = canonical(workspace), artifact = inspectKit(createWordPressKit(workspace.draft, { includeLinkedImages }));
  assert.deepEqual(Object.keys(artifact.files), ['wordpress-blocks.html', 'article-body.md', 'reading-page.html', 'page-details.json', 'REVIEW.txt', 'README.txt']);
  assert.equal(artifact.files['article-body.md'], workspace.draft.body);
  assert.deepEqual(JSON.parse(artifact.files['page-details.json']), { ...fields, draft: true });
  const expected = ['Before starting', 'Keep every word, including café, 日本語, and 😀. Read the reference.', 'Inspect the source', 'Keep uncertainty', 'Preview the post', 'Item Action Seedling Water gently Label Keep literal | text', 'A quotation is still part of the article.', 'const sample = "<safe>";', ...(!includeLinkedImages ? ['![Fictional diagram](https://example.com/fictional-alpha.png)'] : []), 'Final marker: ' + ending + '.'].join(' ');
  assert.equal(artifact.text, expected);
  assert.equal(artifact.tags.h2, 1); assert.equal(artifact.tags.table, 1); assert.equal(artifact.tags.th, 2); assert.equal(artifact.tags.td, 4);
  assert.equal(artifact.tags.pre, 1); assert.equal(artifact.tags.blockquote, 1); assert.deepEqual(artifact.starts, ['4']);
  assert.equal(artifact.links[0].href, 'https://example.com/alpha?x=1&y=2'); assert.equal(artifact.links[0].rel, 'noopener noreferrer');
  assert.equal(artifact.images.length, includeLinkedImages ? 1 : 0);
  if (includeLinkedImages) assert.deepEqual(artifact.images[0], { src: 'https://example.com/fictional-alpha.png', alt: 'Fictional diagram' });
  assert.ok(artifact.comments.includes('wp:code')); assert.ok(artifact.comments.some(text => text.startsWith('wp:list ')));
  for (const content of Object.values(artifact.files)) assert.doesNotMatch(content, /PRIVATE_(?:SOURCE|AUDIENCE|PURPOSE|REVIEW|PENDING|CHOICE)_4827/);
  assert.doesNotMatch(artifact.files['reading-page.html'], /<img\b/); assert.doesNotMatch(artifact.files['wordpress-blocks.html'], /<safe>|<script\b/);
  assert.deepEqual(canonical(workspace), before);
}

for (const format of ['markdown', 'json']) for (const images of [false, true]) test('Alpha model journey: ' + format + ' import, explicit recovery, checkpoint and independently read WordPress kit; linked images ' + images, async () => {
  const original = imported(format), backup = createWorkspaceBackup(original.source, original.draft);
  assert.deepEqual(canonical(parseWorkspaceBackup(backup)), canonical(original));
  const env = environment(), first = session(env, original);
  try {
    first.control.schedule(); first.control.flush(); assert.equal(env.writes(), 0); assert.equal(first.control.state().enabled, false);
    assert.equal(await first.control.start(), true); assert.equal(env.writes(), 1);
    const saved = env.records.get(RECOVERY_KEY), record = parseBrowserCopy(saved);
    assert.deepEqual(record.workspace, canonical(original)); assert.match(saved, /PRIVATE_SOURCE_4827/); assert.match(saved, /PRIVATE_REVIEW_4827/);
    assert.doesNotMatch(saved, /approved|PRIVATE_PENDING_4827|PRIVATE_CHOICE_4827/);
    first.control.dispose(); await settle();
    const other = { source: copy(source), draft: { ...fields, body: 'Unsaved different fictional writing.', questions: ['A different private question.'] } }, second = session(env, other);
    try {
      second.control.state(); second.control.schedule(); assert.deepEqual(second.capture(), other); assert.equal(env.writes(), 1);
      second.decision(false); assert.equal(await second.control.resume(), false); assert.deepEqual(second.capture(), other); assert.equal(second.history.list().length, 0); assert.equal(env.records.get(RECOVERY_KEY), saved);
      await settle(); second.decision(true); assert.equal(await second.control.resume(), true);
      assert.deepEqual(canonical(second.capture()), canonical(original)); assert.equal(second.approved(), false);
      assert.deepEqual(second.history.read(second.history.list()[0].id), canonical(other));
      // Export mode is chosen again explicitly, never recovered from private writing.
      verifyKit(second.capture(), images);
      assert.equal(second.control.pause(), true); await settle();
      assert.equal(await second.control.forget(), true); assert.equal(env.records.has(RECOVERY_KEY), false);
      second.edit(body.replace('ALPHA_END_4827', 'AFTER_REMOVAL_4827')); second.control.schedule(); second.tick(); assert.equal(env.records.has(RECOVERY_KEY), false);
    } finally { second.control.dispose(); }
  } finally { first.control.dispose(); await settle(); }
});

test('Alpha failure journey: refused checkpoint preserves current writing, stored import, and downloaded backup until explicit retry', async () => {
  const original = imported('json'), backup = createWorkspaceBackup(original.source, original.draft), env = environment(), first = session(env, original);
  assert.equal(await first.control.start(), true); first.control.dispose(); await settle();
  const saved = env.records.get(RECOVERY_KEY), invalid = { source: copy(source), draft: { ...fields, body: 'x'.repeat(60001), questions: [] } }, next = session(env, invalid);
  try {
    assert.equal(await next.control.resume(), false); assert.deepEqual(next.capture(), invalid); assert.equal(env.records.get(RECOVERY_KEY), saved); assert.equal(next.history.list().length, 0);
    assert.throws(() => createWordPressKit(next.capture().draft)); assert.deepEqual(canonical(parseWorkspaceBackup(backup)), canonical(original));
    await settle(); next.edit('Corrected current fictional writing.'); assert.equal(await next.control.resume(), true);
    assert.equal(next.history.read(next.history.list()[0].id).draft.body, 'Corrected current fictional writing.'); assert.equal(next.approved(), false); verifyKit(next.capture());
  } finally { next.control.dispose(); await settle(); }
});

test('Alpha failure journey: storage-full preserves the last browser copy while fresh private files and WordPress kits retain current edits', async () => {
  const original = imported('markdown'), env = environment(), x = session(env, original);
  try {
    assert.equal(await x.control.start(), true); const saved = env.records.get(RECOVERY_KEY);
    x.edit(body.replace('ALPHA_END_4827', 'LATEST_END_4827')); env.full(true); x.control.schedule(); x.tick();
    assert.equal(x.control.state().enabled, false); assert.equal(env.records.get(RECOVERY_KEY), saved); assert.match(x.control.state().message, /last saved|last copy|previous|Saving is off/);
    assert.match(x.capture().draft.body, /LATEST_END_4827/); assert.equal(x.approved(), false);
    const fresh = parseWorkspaceBackup(createWorkspaceBackup(x.capture().source, x.capture().draft)); assert.match(fresh.draft.body, /LATEST_END_4827/);
    assert.match(parseBrowserCopy(saved).workspace.draft.body, /ALPHA_END_4827/); verifyKit(fresh, false, 'LATEST_END_4827');
  } finally { x.control.dispose(); await settle(); }
});
