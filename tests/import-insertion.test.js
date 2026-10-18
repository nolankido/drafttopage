import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { articleInsertionTarget, planArticleInsertion } from '../public/import-insertion.js';
import { installArticleImport } from '../public/import-controls.js';
import { parseArticleImport } from '../public/article-import.js';
import { createWorkspaceBackup, parseWorkspaceBackup } from '../public/workspace.js';
import { createCheckpointHistory } from '../public/revisions.js';
import { createWordPressArticle } from '../public/wordpress-export.js';
import { createHTMLSource } from '../public/html-export.js';
import { createWordDocument } from '../public/word-export.js';

const draft = (body = 'Additional **writing**.') => ({ title: 'Imported title', excerpt: 'Imported excerpt', description: 'Imported description', slug: 'imported', body, questions: ['IMPORTED_PRIVATE_QUESTION'] });
const body = () => '日本語 😀 opening.\n\n## Existing section\n\nKeep this paragraph.\n\nEnding kept.';
test('Insertion preserves every outside UTF-16 and CRLF character at whole-block selections', () => {
  for (const newline of ['\n', '\r\n']) {
    const original = body().replaceAll('\n', newline), start = original.indexOf('Keep this'), end = start + 'Keep this paragraph.'.length;
    const target = articleInsertionTarget(original, start, end), plan = planArticleInsertion(target, original, draft('One.\n\nTwo.'));
    assert.equal(plan.body, original.slice(0, start) + plan.replacement + original.slice(end));
    assert.equal(plan.body.slice(plan.selectionStart, plan.selectionEnd), ['One.', '', 'Two.'].join(newline));
    assert.equal(plan.before, 'Keep this paragraph.'); assert.ok(plan.body.endsWith('Ending kept.'));
  }
});
test('Insertion adds paragraph separation at the beginning, end and between complete blocks', () => {
  for (const original of ['', 'Text.', 'Text.\n', 'Text.\n\n', 'Text.\r\n', '- Item', '| H |\n| --- |\n| A |', '~~~\ncode\n~~~']) {
    const plan = planArticleInsertion(articleInsertionTarget(original, original.length), original, draft('Next.'));
    assert.ok(plan.body.startsWith(original)); assert.ok(plan.body.endsWith('Next.'));
    if (original.trim()) assert.match(plan.body, /\r?\n[ \t]*\r?\nNext\.$/);
  }
  const original = 'First.\n\nLast.', plan = planArticleInsertion(articleInsertionTarget(original, 8), original, draft('Middle.'));
  assert.equal(plan.body, 'First.\n\nMiddle.\n\nLast.');
  assert.equal(planArticleInsertion(articleInsertionTarget('Last.', 0), 'Last.', draft('First.')).body, 'First.\n\nLast.');
});
test('Partial paragraphs, lists, tables, code, split surrogate and CRLF boundaries reject without expansion', () => {
  for (const [original, start, end] of [['A paragraph.', 2, 5], ['- One\n- Two', 6, 6], ['| H |\n| --- |\n| A |', 6, 6], ['~~~\ncode\n~~~', 4, 4], ['😀', 1, 1], ['A.\r\n\r\nB.', 3, 3], ['text', -1, 0], ['text', 0, 9]]) assert.throws(() => articleInsertionTarget(original, start, end));
  for (const original of ['~~~\nunfinished', '```\nunfinished']) assert.throws(() => articleInsertionTarget(original, original.length), /unfinished/);
  assert.throws(() => planArticleInsertion(articleInsertionTarget('Before.', 7), 'Before.', draft('~~~\nunfinished')), /imported code fence/);
  assert.equal(planArticleInsertion(articleInsertionTarget('~~~\nunfinished', 0), '~~~\nunfinished', draft('Before.')).body, 'Before.\n\n~~~\nunfinished');
});
test('Complete lists, tables and code can be deliberately selected without rewriting their surroundings', () => {
  for (const source of ['- One\n- Two', '| H |\n| --- |\n| A |', '~~~\ncode\n~~~']) {
    const original = 'Before.\n\n' + source + '\n\nAfter.', start = original.indexOf(source);
    const plan = planArticleInsertion(articleInsertionTarget(original, start, start + source.length), original, draft('Replacement.'));
    assert.equal(plan.body, 'Before.\n\nReplacement.\n\nAfter.');
  }
});
test('Repeated passages use only the explicitly selected occurrence and stale bodies always reject', () => {
  const original = 'Same passage.\n\nSame passage.', start = original.lastIndexOf('Same');
  const target = articleInsertionTarget(original, start, original.length);
  assert.equal(planArticleInsertion(target, original, draft('New.')).body, 'Same passage.\n\nNew.');
  assert.throws(() => planArticleInsertion(target, 'Intro.\n\n' + original, draft()), /article changed/);
  assert.throws(() => planArticleInsertion(null, original, draft()), /article changed/);
});
test('Optional imported titles are literal H2 text, normalize line breaks, and do not copy private questions', () => {
  const value = { ...draft('Body.'), title: 'Literal *title* [name](https://example.com/)\nNext #', questions: ['PRIVATE'] };
  const target = articleInsertionTarget('', 0), plan = planArticleInsertion(target, '', value, { includeTitle: true });
  assert.match(plan.body, /^## Literal \\\*title\\\* \\\[name\\\]\(https:\/\/example.com\/\) Next \\#/);
  assert.doesNotMatch(plan.body, /PRIVATE|Imported excerpt|Imported description/);
  assert.equal(planArticleInsertion(target, '', value).body, 'Body.');
  assert.throws(() => planArticleInsertion(target, '', draft('')), /no imported body/);
  assert.equal(planArticleInsertion(target, '', draft(''), { includeTitle: true }).body, '## Imported title');
});
test('Combined bounds, nulls, invalid models and title overhead fail atomically; exact no-ops are identified', () => {
  for (const original of [null, 'x\0y', 'x'.repeat(60001)]) assert.throws(() => articleInsertionTarget(original, 0));
  const original = 'x'.repeat(59999); assert.throws(() => planArticleInsertion(articleInsertionTarget(original, original.length), original, draft('Y')), /60,000/);
  assert.throws(() => planArticleInsertion(articleInsertionTarget('', 0), '', { ...draft(), extra: true }));
  assert.throws(() => planArticleInsertion(articleInsertionTarget('', 0), '', draft('x'.repeat(60000)), { includeTitle: true }), /60,000/);
  const text = 'Before.\n\nSame.\n\nAfter.', target = articleInsertionTarget(text, 9, 14), plan = planArticleInsertion(target, text, draft('Same.'));
  assert.equal(plan.body, text); assert.equal(plan.changed, false);
});

class Node {
  constructor(tag = 'div') { this.nodeType = 1; this.localName = tag; this.childNodes = []; this.value = ''; this.checked = false; this.hidden = false; this.disabled = false; this.events = new Map(); this.selectionStart = 0; this.selectionEnd = 0; }
  addEventListener(type, fn) { if (!this.events.has(type)) this.events.set(type, []); this.events.get(type).push(fn); }
  async fire(type = 'click') { for (const fn of this.events.get(type) || []) await fn({ type }); }
  dispatchEvent(event) { for (const fn of this.events.get(event.type) || []) fn(event); }
  append(...nodes) { this.childNodes.push(...nodes); } replaceChildren(...nodes) { this.childNodes = nodes; }
  setAttribute() {} focus() { this.focused = true; } select() { this.selectionStart = 0; this.selectionEnd = this.value.length; }
}
async function ui(run, options = {}) {
  const prior = { document: globalThis.document, confirm: globalThis.confirm }, nodes = new Map(), $ = id => { if (!nodes.has(id)) nodes.set(id, new Node()); return nodes.get(id); };
  globalThis.document = { getElementById: $, createElement: tag => new Node(tag), createDocumentFragment: () => new Node(), createTextNode: text => ({ nodeType: 3, nodeValue: text }) };
  const workspace = { source: { profile: 'personal', notes: 'PRIVATE_SOURCE', purpose: 'Existing purpose', audience: 'Existing audience' }, draft: { ...draft(body()), title: 'Existing title', excerpt: 'Existing excerpt', description: 'Existing description', slug: 'existing', questions: ['EXISTING_PRIVATE_QUESTION'] } };
  $('body').value = workspace.draft.body; $('import-format').value = 'markdown';
  let busy = false, approval = true, linked = true, message = '', fail = false, confirmValue = true, confirms = 0, insertions = 0, replacements = 0, workChanges = 0;
  globalThis.confirm = () => { confirms++; return confirmValue; };
  const history = createCheckpointHistory();
  const controller = installArticleImport({ hasArticle: () => true, isBusy: () => busy, busyChanged: () => {}, report: text => { message = text; }, workChanged: () => { workChanges++; },
    apply: value => { replacements++; workspace.draft = value; },
    applyInsertion: plan => { if (fail) throw new Error('Checkpoint refused'); history.save(workspace, 'Before article insertion'); workspace.draft.body = plan.body; $('body').value = plan.body; approval = false; linked = false; insertions++; },
    ...options
  });
  const stage = async (text = '# Imported title\n\nAdditional **writing**.') => { $('import-text').value = text; await $('preview-import').fire(); };
  const mode = async value => { $('import-destination').value = value; await $('import-destination').fire('change'); };
  try { await run({ $, controller, workspace, history, stage, mode, state: () => ({ busy, approval, linked, message, confirms, insertions, replacements, workChanges }), busy: value => { busy = value; controller.updateBusy(); }, fail: value => { fail = value; }, confirm: value => { confirmValue = value; } }); }
  finally { Object.assign(globalThis, prior); }
}
test('Append preview and apply preserve all existing fields and private notes with one writing checkpoint', () => ui(async ({ $, workspace, stage, mode, history, state }) => {
  const original = structuredClone(workspace); await stage(); await mode('append');
  assert.equal($('apply-import').disabled, true); await $('preview-insertion').fire();
  assert.deepEqual(workspace, original); assert.equal(state().approval, true); assert.equal(history.list().length, 0);
  assert.equal($('import-insertion-before').value, ''); assert.equal($('import-insertion-after').value, '\n\nAdditional **writing**.');
  await $('apply-import').fire(); assert.equal(state().insertions, 1); assert.equal(state().replacements, 0); assert.equal(state().confirms, 0);
  assert.deepEqual(workspace, { ...original, draft: { ...original.draft, body: original.draft.body + '\n\nAdditional **writing**.' } });
  assert.equal(state().approval, false); assert.equal(state().linked, false); assert.equal(history.list().length, 1); assert.equal($('import-insertion-after').value, '');
}));
test('Insertion destinations refuse a programmatically fired continuation without changing writing or the reviewed plan', async () => {
  let continued = 0;
  await ui(async ({ $, controller, workspace, stage, mode, history, state }) => {
    const original = structuredClone(workspace); await stage();
    assert.equal($('apply-import-and-continue').hidden, false); assert.equal($('import-continue-help').hidden, false);
    for (const destination of ['append', 'selection']) {
      await mode(destination);
      if (destination === 'selection') {
        const start = $('body').value.indexOf('Keep this paragraph.');
        $('body').selectionStart = start; $('body').selectionEnd = start + 'Keep this paragraph.'.length;
      }
      await $('preview-insertion').fire(); const preview = $('import-insertion-after').value;
      assert.equal($('apply-import').disabled, false); assert.equal($('apply-import').textContent, 'Apply article insertion');
      assert.equal($('apply-import-and-continue').hidden, true); assert.equal($('apply-import-and-continue').disabled, true); assert.equal($('import-continue-help').hidden, true);
      await $('apply-import-and-continue').fire();
      assert.deepEqual(workspace, original); assert.equal(state().insertions, 0); assert.equal(state().replacements, 0); assert.equal(state().confirms, 0);
      assert.equal(state().approval, true); assert.equal(state().linked, true); assert.equal(history.list().length, 0); assert.equal(continued, 0);
      assert.equal(controller.pending(), true); assert.equal($('import-insertion-preview').hidden, false); assert.equal($('import-insertion-after').value, preview);
    }
    await $('apply-import').fire(); assert.equal(state().insertions, 1); assert.equal(state().replacements, 0); assert.equal(continued, 0);
  }, { continueToExport: () => { continued++; } });
});
test('Selection insertion requires explicit complete blocks, then changes only the selected occurrence', () => ui(async ({ $, workspace, stage, mode, state }) => {
  const original = workspace.draft.body; await stage(); await mode('selection'); $('body').selectionStart = 2; $('body').selectionEnd = 3; await $('preview-insertion').fire();
  assert.equal($('apply-import').disabled, true); assert.match(state().message, /complete/);
  const start = original.indexOf('Keep this'); $('body').selectionStart = start; $('body').selectionEnd = start + 'Keep this paragraph.'.length;
  await $('preview-insertion').fire(); await $('apply-import').fire();
  assert.equal(workspace.draft.body, original.replace('Keep this paragraph.', 'Additional **writing**.'));
}));
test('Body changes purge stale insertion source but keep the conversion for explicit current-location preview', () => ui(async ({ $, controller, stage, mode, state }) => {
  await stage(); await mode('append'); await $('preview-insertion').fire(); $('body').value = 'Changed article.'; controller.updateBusy();
  assert.equal($('import-insertion-preview').hidden, true); assert.equal($('import-insertion-after').value, ''); assert.equal($('apply-import').disabled, true);
  assert.equal(controller.pending(), true); assert.equal($('import-body-preview').value, 'Additional **writing**.');
  await $('apply-import').fire(); assert.equal(state().insertions, 0); await $('preview-insertion').fire(); await $('apply-import').fire(); assert.equal(state().insertions, 1);
}));
test('Checkpoint refusal keeps the conversion, exact preview, writing, approval and private content', () => ui(async ({ $, workspace, stage, mode, fail, state }) => {
  const original = structuredClone(workspace); await stage(); await mode('append'); await $('preview-insertion').fire(); fail(true); await $('apply-import').fire();
  assert.deepEqual(workspace, original); assert.equal(state().approval, true); assert.equal(state().linked, true); assert.equal($('import-insertion-preview').hidden, false); assert.match(state().message, /Checkpoint refused/);
  fail(false); await $('apply-import').fire(); assert.equal(state().insertions, 1);
}));
test('Destination, title and incoming-source changes invalidate earlier plans and block unpreviewed apply', () => ui(async ({ $, stage, mode, state }) => {
  await stage(); await mode('append'); await $('preview-insertion').fire(); $('import-include-title').checked = true; await $('import-include-title').fire('change');
  assert.equal($('apply-import').disabled, true); await $('preview-insertion').fire(); assert.match($('import-insertion-after').value, /## Imported title/);
  await mode('selection'); assert.equal($('import-insertion-after').value, ''); await mode('append'); await $('preview-insertion').fire();
  $('import-text').value = 'New pending source'; await $('import-text').fire('input'); assert.equal($('import-preview').hidden, true); await $('apply-import').fire(); assert.equal(state().insertions, 0);
}));
test('Busy file operations reject actions, and replacement mode retains its original confirmation flow', () => ui(async ({ $, stage, mode, busy, state, confirm }) => {
  await stage(); await mode('append'); await $('preview-insertion').fire(); busy(true); await $('apply-import').fire(); assert.equal(state().insertions, 0); assert.equal($('preview-insertion').disabled, true);
  busy(false); await mode('replace'); confirm(false); await $('apply-import').fire(); assert.equal(state().replacements, 0); assert.equal(state().confirms, 1);
  confirm(true); await $('apply-import').fire(); assert.equal(state().replacements, 1); assert.equal(state().insertions, 0);
}));
test('Insertion still requires conversion acknowledgements and unmapped-field decisions', () => ui(async ({ $, stage, mode, state }) => {
  await stage('---\ntitle: Imported title\nlayout: article\n---\n\nNew body.'); await mode('append'); await $('preview-insertion').fire();
  assert.equal($('apply-import').disabled, true); await $('apply-import').fire(); assert.equal(state().insertions, 0);
  $('import-unmapped-ok').checked = true; await $('import-unmapped-ok').fire('change'); assert.equal($('apply-import').disabled, false); await $('apply-import').fire(); assert.equal(state().insertions, 1);
}));
test('Continuation also requires an explicit decision about unmapped import metadata', async () => {
  let continued = 0;
  await ui(async ({ $, controller, workspace, stage, state }) => {
    const original = structuredClone(workspace);
    await stage('---\ntitle: Imported title\nlayout: article\n---\n\nNew body.');
    assert.equal($('import-unmapped-section').hidden, false); assert.equal($('apply-import-and-continue').disabled, true);
    await $('apply-import-and-continue').fire(); assert.deepEqual(workspace, original); assert.equal(state().replacements, 0); assert.equal(continued, 0); assert.equal(controller.pending(), true);
    $('import-unmapped-ok').checked = true; await $('import-unmapped-ok').fire('change'); assert.equal($('apply-import-and-continue').disabled, false);
    await $('apply-import-and-continue').fire(); assert.equal(state().replacements, 1); assert.equal(continued, 1); assert.equal(controller.pending(), false);
    assert.equal(workspace.draft.body, 'New body.'); assert.equal(Object.hasOwn(workspace.draft, 'layout'), false); assert.deepEqual(workspace.source, original.source);
  }, { continueToExport: () => { continued++; } });
});
test('Exact insertion no-ops and clearing preparation keep approval, history and current article', () => ui(async ({ $, workspace, history, stage, mode, state }) => {
  const original = structuredClone(workspace); await stage('Keep this paragraph.'); await mode('selection');
  const start = $('body').value.indexOf('Keep this'); $('body').selectionStart = start; $('body').selectionEnd = start + 'Keep this paragraph.'.length;
  await $('preview-insertion').fire(); await $('apply-import').fire(); assert.deepEqual(workspace, original); assert.equal(state().approval, true); assert.equal(history.list().length, 0); assert.equal(state().insertions, 0);
  await stage(); await mode('append'); await $('preview-insertion').fire(); await $('cancel-import').fire(); assert.deepEqual(workspace, original); assert.equal($('import-insertion-before').value, ''); assert.equal($('import-insertion-after').value, '');
}));
test('The article insertion shortcut preserves an existing candidate and contributes pending work signals', () => ui(async ({ $, controller, stage, state }) => {
  await stage(); const changes = state().workChanges; controller.openInsertion(); assert.equal($('import-destination').value, 'append'); assert.equal($('import-body-preview').value, 'Additional **writing**.'); assert.equal($('import-preview').hidden, false);
  assert.equal(controller.pending(), true); assert.ok(changes > 0); assert.equal($('import-destination').focused, true); assert.equal($('apply-import').disabled, true);
}));
test('A new article has one reviewed import path without insertion choices or replacement confirmation', () => ui(async ({ $, controller, workspace, stage, mode, state }) => {
  workspace.draft = draft(''); $('body').value = '';
  assert.equal($('import-join-options').hidden, true);
  assert.equal($('import-new-article-help').hidden, false);
  assert.equal($('import-destination').disabled, true);
  await stage();
  await mode('append');
  assert.equal($('import-destination').value, 'replace');
  assert.equal($('import-insertion-controls').hidden, true);
  assert.equal($('apply-import').disabled, false);
  controller.openInsertion();
  assert.equal($('import-preview-heading').focused, true);
  assert.equal($('import-destination').focused, undefined);
  await $('apply-import').fire();
  assert.equal(state().confirms, 0); assert.equal(state().replacements, 1); assert.equal(state().insertions, 0);
  assert.equal(workspace.draft.body, 'Additional **writing**.');
}, { hasArticle: () => false }));
test('Insertion choices follow existing article work and discard an obsolete plan when the article is cleared', async () => {
  let existing = false;
  await ui(async ({ $, controller, stage, mode, state }) => {
    $('body').value = ''; await stage();
    assert.equal($('import-join-options').hidden, true);
    $('body').value = 'Writing added after conversion.'; existing = true; controller.updateBusy();
    assert.equal($('import-join-options').hidden, false); assert.equal($('import-new-article-help').hidden, true);
    await mode('append'); await $('preview-insertion').fire();
    assert.equal($('import-insertion-preview').hidden, false);
    $('body').value = ''; existing = false; controller.updateBusy();
    assert.equal($('import-join-options').hidden, true); assert.equal($('import-destination').value, 'replace');
    assert.equal($('import-insertion-preview').hidden, true); assert.equal($('import-insertion-after').value, '');
    assert.equal(controller.pending(), true); assert.equal($('import-body-preview').value, 'Additional **writing**.');
    assert.equal(state().replacements, 0); assert.equal(state().insertions, 0);
  }, { hasArticle: () => existing });
});
test('Unchanged private v1 files include only applied writing, with existing source and review questions', () => ui(async ({ $, workspace, stage, mode }) => {
  await stage(JSON.stringify(draft())); $('import-format').value = 'json'; await $('preview-import').fire(); await mode('append'); await $('preview-insertion').fire();
  const before = parseWorkspaceBackup(createWorkspaceBackup(workspace.source, workspace.draft)); assert.doesNotMatch(before.draft.body, /Additional/); assert.equal(before.source.notes, 'PRIVATE_SOURCE');
  await $('apply-import').fire(); const after = parseWorkspaceBackup(createWorkspaceBackup(workspace.source, workspace.draft)); assert.match(after.draft.body, /Additional/); assert.deepEqual(after.draft.questions, ['EXISTING_PRIVATE_QUESTION']); assert.equal(after.version, 1);
}));
test('Independent HTML and DOCX readers find one inserted native table and no imported or existing private notes', () => {
  const original = 'Existing opening.', incoming = draft('| Step | Plan |\n| --- | :---: |\n| Read | Read \\| quietly |'), plan = planArticleInsertion(articleInsertionTarget(original, original.length), original, incoming);
  const combined = { ...draft(), body: plan.body, questions: ['EXISTING_PRIVATE_QUESTION'] };
  for (const html of [createWordPressArticle(combined).html, createHTMLSource(combined)]) {
    const result = JSON.parse(execFileSync('python3', ['-c', String.raw`
import sys,json
from html.parser import HTMLParser
class P(HTMLParser):
 def __init__(self):super().__init__();self.tags=[];self.text=[]
 def handle_starttag(self,t,a):self.tags.append(t)
 def handle_data(self,t):self.text.append(t)
p=P();p.feed(sys.stdin.read());print(json.dumps({'tables':p.tags.count('table'),'headers':p.tags.count('th'),'rows':p.tags.count('tr'),'text':''.join(p.text)}))
`], { input: html, encoding: 'utf8' }));
    assert.equal(result.tables, 1); assert.equal(result.headers, 2); assert.equal(result.rows, 2); assert.match(result.text, /Existing opening/); assert.match(result.text, /Read \| quietly/); assert.doesNotMatch(html, /PRIVATE_QUESTION|PRIVATE_SOURCE/);
  }
  const result = JSON.parse(execFileSync('python3', ['-c', String.raw`
import sys,io,zipfile,json,xml.etree.ElementTree as E
with zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())) as z:
 d=E.fromstring(z.read('word/document.xml'));w={'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
 print(json.dumps({'tables':len(d.findall('.//w:tbl',w)),'text':''.join(d.itertext())}))
`], { input: createWordDocument(combined), encoding: 'utf8' })); assert.equal(result.tables, 1); assert.match(result.text, /Existing opening/); assert.match(result.text, /Read \| quietly/);
});
test('All five generated workspaces expose labelled insertion controls and link to insertion help', async () => {
  for (const route of ['write','word-to-wordpress','markdown-to-wordpress','markdown-to-word','markdown-to-html']) {
    const page = await readFile('public/' + route + '/index.html', 'utf8');
    for (const id of ['start-insert-import','import-destination','import-insertion-controls','preview-insertion','import-insertion-before','import-insertion-after']) assert.ok(page.includes('id="' + id + '"'), route + ':' + id);
    assert.match(page, /for="import-destination"/); assert.match(page, /for="import-insertion-before"/); assert.match(page, /for="import-insertion-after"/);
  }
  const help = await readFile('public/help/article-import/index.html', 'utf8'); assert.match(help, /id="insert-writing"/); assert.match(help, /Browser recovery is optional and off by default/); assert.match(help, /not the pending conversion or insertion choices/); assert.match(help, /No upload, AI request/);
});
