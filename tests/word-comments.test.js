import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fixture, para, run, zip, trees, convert } from './docx-fixtures.js';
import { definition, commentFixture } from './word-comment-fixtures.js';
import { wordCommentTrees, prepareWordComments } from '../public/word-comments.js';
import { wordCommentNotes, wordCommentsReport } from '../public/word-comment-report.js';
import { readDocxXML, readDocxCommentXML } from '../public/docx-archive.js';
import { installWordComments } from '../public/word-comment-controls.js';
import { createWorkspaceBackup, parseWorkspaceBackup } from '../public/workspace.js';
import { parseArticleImport } from '../public/article-import.js';
import { createArticleMarkdown } from '../public/article-markdown.js';
import { createHTMLSource } from '../public/html-export.js';
import { createWordPressArticle } from '../public/wordpress-export.js';
import { wordDocumentParts } from '../public/word-export.js';

const recover = parts => wordCommentTrees(trees(parts));
const model = comments => ({ comments: comments || [{ id: '7', text: 'PRIVATE_COMMENT: Check the source.' }], guidance: 'Private feedback; compare the original.' });
const draft = () => ({ title: 'Fictional article', excerpt: '', description: '', slug: 'fictional', body: 'Public article body.', questions: [] });

test('Comment recovery retains exact plain paragraphs, line breaks, tabs, Unicode and file order without metadata', () => {
  const text = '<w:p>' + run('First ', '<w:b/>') + '<w:hyperlink r:id="unsafe">' + run('link label') + '</w:hyperlink><w:r><w:br/><w:t>Second</w:t><w:tab/><w:t>🙂 &amp; &lt;script&gt;</w:t></w:r></w:p>' + para('Final paragraph.');
  const result = recover(commentFixture(definition(90, text) + definition(7, para('A possible unanchored reply.'))));
  assert.deepEqual(result.comments, [{ id: '90', text: 'First link label\nSecond\t🙂 & <script>\n\nFinal paragraph.' }, { id: '7', text: 'A possible unanchored reply.' }]);
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE_AUTHOR|2026-10-01|unsafe/);
  assert.match(result.guidance, /unanchored|replies/);assert.match(result.guidance, /hidden by Word styling/);
});

test('Comment IDs, exact part relationships and content types reject ambiguity without guessing', () => {
  const invalid = [
    p => { delete p['word/_rels/document.xml.rels']; },
    p => { p['word/_rels/document.xml.rels'] = p['word/_rels/document.xml.rels'].replace('comments.xml', '../comments.xml'); },
    p => { p['word/_rels/document.xml.rels'] = p['word/_rels/document.xml.rels'].replace('Target="comments.xml"', 'Target="https://example.com/comments.xml" TargetMode="External"'); },
    p => { p['[Content_Types].xml'] = p['[Content_Types].xml'].replace('wordprocessingml.comments+xml', 'wordprocessingml.footnotes+xml'); },
    p => { p['word/comments.xml'] = p['word/comments.xml'].replace('w:id="7"', 'w:id="07"'); },
    p => { p['word/comments.xml'] = p['word/comments.xml'].replace('</w:comments>', definition(7) + '</w:comments>'); },
    p => { delete p['word/comments.xml']; }
  ];
  for (const mutate of invalid) { const parts = commentFixture();mutate(parts);assert.throws(() => recover(parts), /Word comment recovery/); }
  assert.deepEqual(recover(fixture()).comments, []);
});

test('Fields, drawings, tracked properties, complex wrappers and tables fail only optional recovery', () => {
  for (const content of ['<w:tbl/>', '<w:p><w:r><w:fldChar/></w:r></w:p>', '<w:p><w:r><w:drawing/></w:r></w:p>', '<w:p><w:ins>' + run('Revision') + '</w:ins></w:p>', '<w:p><w:pPr><w:pPrChange/></w:pPr>' + run('Changed properties') + '</w:p>', '<w:p><w:sdt>' + run('Wrapped') + '</w:sdt></w:p>']) {
    const parts = commentFixture(definition(7, content));
    assert.throws(() => recover(parts), /Word comment recovery/);
    // Ordinary article import neither reads nor parses the optional comment part.
    const articleParts = Object.fromEntries(Object.entries(parts).filter(([name]) => name !== 'word/comments.xml'));
    assert.equal(convert(articleParts).markdown, 'Fictional article');
  }
});

test('Count, paragraph and character limits reject whole recovery rather than truncate feedback', () => {
  assert.equal(recover(commentFixture(definition(0, para('x'.repeat(4000))))).comments[0].text.length, 4000);
  for (const comments of [definition(0, para('x'.repeat(4001))), definition(0, para('')), definition(0, Array.from({length:11},()=>para('Paragraph')).join('')), Array.from({length:101},(_,i)=>definition(i)).join(''), Array.from({length:26},(_,i)=>definition(i, para('x'.repeat(4000)))).join('')]) assert.throws(() => recover(commentFixture(comments)), /Word comment recovery/);
});

test('The explicit comment reader uses bounded exact XML parts while ordinary import leaves comment bytes unread', async () => {
  const parts = commentFixture();parts['docProps/core.xml'] = 'PRIVATE_METADATA';parts['word/media/photo.png'] = 'PRIVATE_IMAGE';
  const bytes = zip(parts), ordinary = await readDocxXML(bytes), comments = await readDocxCommentXML(bytes);
  assert.equal(ordinary.has('word/comments.xml'), false);
  assert.deepEqual([...comments.keys()].sort(), ['[Content_Types].xml', 'word/_rels/document.xml.rels', 'word/comments.xml'].sort());
  assert.doesNotMatch([...comments.values()].join(''), /PRIVATE_METADATA|PRIVATE_IMAGE/);
  const huge = commentFixture();huge['word/comments.xml'] = 'x'.repeat(2*1024*1024+1);
  assert.equal((await readDocxXML(zip(huge))).has('word/comments.xml'), false);
  await assert.rejects(readDocxCommentXML(zip(huge)), /limit|damaged/);
  const previous = globalThis.DOMParser;
  globalThis.DOMParser = class { parseFromString(text) { return { documentElement: trees({part:text}).get('part'), getElementsByTagName:()=>[] }; } };
  try {
    assert.equal((await prepareWordComments(bytes)).comments[0].id, '7');
    const bad = commentFixture();bad['word/comments.xml'] = '<!DOCTYPE x><w:comments/>';
    await assert.rejects(prepareWordComments(zip(bad)), /Unsupported Word XML/);
  } finally { globalThis.DOMParser = previous; }
});

test('Review-note bounds include the identifier label and preserve all report text when notes cannot fit', () => {
  const label = 'Word comment ID 7\n';
  assert.equal(wordCommentNotes(model([{id:'7',text:'x'.repeat(500-label.length)}]))[0].length, 500);
  assert.equal(wordCommentNotes(model([{id:'7',text:'x'.repeat(501-label.length)}])), null);
  assert.equal(wordCommentNotes(model(Array.from({length:13},(_,i)=>({id:String(i),text:'Keep'})))), null);
  assert.equal(wordCommentNotes(model([])), null);
  const report = wordCommentsReport(model([{id:'7',text:'x'.repeat(4000)+'END_COMMENT'}]));
  assert.match(report, /END_COMMENT/);assert.match(report, /private Word comments/);assert.doesNotMatch(report, /PRIVATE_AUTHOR/);
});

class Control {
  constructor() { this.children=[];this.events={};this.text='';this.value='';this.checked=false;this.disabled=false;this.hidden=false; }
  set textContent(value) { this.text=value;this.children=[]; }
  get textContent() { return this.text+this.children.map(child=>child.textContent).join(''); }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children=[...nodes]; }
  addEventListener(name,fn) { this.events[name]=fn; }
  fire(name='click') { return this.events[name]?.(); }
}
async function withUI(run, prepare = async()=>model()) {
  const previous = globalThis.document, nodes=new Map(),$=id=>{if(!nodes.has(id))nodes.set(id,new Control());return nodes.get(id);};
  const state = { source:{bytes:new Uint8Array([1])},candidate:{draft:draft()},mode:'replace',busy:false,message:'',changed:0,downloads:[] };
  globalThis.document = {getElementById:$,createElement:()=>new Control()};
  let ui;
  try {
    ui=installWordComments({getSource:()=>state.source,getCandidate:()=>state.candidate,getMode:()=>state.mode,isBusy:()=>state.busy,setBusy:value=>{state.busy=value;ui?.update();},changed:()=>{state.changed++;$('import-changes-ok').checked=false;},report:text=>{state.message=text;},prepare,download:(...args)=>state.downloads.push(args)});
    ui.update();await run({$,state,ui});
  } finally { globalThis.document=previous; }
}

test('Recovery is deliberate, inert, private by default, and its file download requires acknowledgement',()=>withUI(async({$,state,ui})=>{
  const before=structuredClone(state.candidate.draft);$('import-changes-ok').checked=true;
  assert.equal($('word-comment-handoff').hidden,false);assert.equal($('download-word-comments').disabled,true);
  await $('prepare-word-comments').fire();assert.equal($('import-changes-ok').checked,false);
  assert.match($('word-comment-list').textContent,/PRIVATE_COMMENT/);assert.equal($('word-comments-include').checked,false);
  assert.equal(ui.draft(state.candidate.draft),state.candidate.draft);assert.deepEqual(state.candidate.draft,before);
  await $('download-word-comments').fire();assert.equal(state.downloads.length,0);
  $('word-comment-private-ok').checked=true;$('word-comment-private-ok').fire('change');await $('download-word-comments').fire();
  assert.equal(state.downloads.length,1);assert.match(state.downloads[0][0],/PRIVATE_COMMENT/);assert.equal(state.downloads[0][1],'private-word-comments.txt');
  $('word-comments-include').checked=true;$('word-comments-include').fire('change');
  const withNotes=ui.draft(state.candidate.draft);assert.deepEqual(withNotes.questions,['Word comment ID 7\nPRIVATE_COMMENT: Check the source.']);assert.deepEqual(state.candidate.draft,before);assert.equal(ui.selectedCount(),1);
}));

test('Imported comment notes survive private backup but stay out of every article format',()=>{
  const value={...draft(),questions:wordCommentNotes(model())};
  const workspace={source:{profile:'guide',audience:'',purpose:'',notes:''},draft:value};
  assert.deepEqual(parseWorkspaceBackup(createWorkspaceBackup(workspace.source,workspace.draft)).draft.questions,value.questions);
  for(const article of [createArticleMarkdown(value),createHTMLSource(value),createWordPressArticle(value).html,...wordDocumentParts(value).map(part=>part.content)])assert.doesNotMatch(article,/PRIVATE_COMMENT|Word comment ID/);
  assert.equal(parseArticleImport('## Fictional article\n\nPublic article body.').draft.questions.length,0);
});

test('Insertion, stale sources, busy files and note limits cannot silently add or truncate comments',()=>withUI(async({$,state,ui})=>{
  await $('prepare-word-comments').fire();$('word-comments-include').checked=true;
  state.mode='append';ui.update();assert.equal($('word-comments-include').checked,false);assert.equal($('word-comments-include').disabled,true);assert.equal(ui.draft(state.candidate.draft),state.candidate.draft);
  state.mode='replace';ui.update();state.busy=true;ui.update();assert.equal($('download-word-comments').disabled,true);assert.equal($('prepare-word-comments').disabled,true);
  $('word-comments-include').checked=true;assert.throws(()=>ui.draft(state.candidate.draft),/Prepare and review/);
  state.busy=false;state.source={bytes:new Uint8Array([2])};ui.update();assert.equal($('word-comments-include').checked,false);assert.equal($('download-word-comments').disabled,true);
}));

test('Discard, failed recovery and late async completion preserve the article and purge private preview text',async()=>{
  await withUI(async({$,state,ui})=>{
    await $('prepare-word-comments').fire();$('word-comments-include').checked=true;await $('discard-word-comments').fire();
    assert.equal($('word-comment-list').textContent,'');assert.equal($('word-comment-guidance').textContent,'');assert.equal(ui.selectedCount(),0);assert.equal(state.candidate.draft.body,'Public article body.');
  });
  await withUI(async({$,state})=>{await $('prepare-word-comments').fire();assert.match(state.message,/Recovery failed/);assert.equal(state.candidate.draft.body,'Public article body.');assert.equal($('download-word-comments').disabled,true);},async()=>{throw new Error('Recovery failed');});
  let resolve;const pending=new Promise(done=>{resolve=done;});
  await withUI(async({$,state,ui})=>{const preparing=$('prepare-word-comments').fire();state.source=null;state.candidate=null;ui.clear();resolve(model());await preparing;assert.equal($('word-comment-list').textContent,'');assert.equal($('word-comment-handoff').hidden,true);assert.equal(state.busy,false);},()=>pending);
});

test('Shared import markup offers the private workflow in all seven tools without placing comments in article previews',async()=>{
  for(const route of ['write','word-to-wordpress','word-to-markdown','google-docs-to-wordpress','markdown-to-wordpress','markdown-to-html','markdown-to-word']){
    const html=await readFile('public/'+route+'/index.html','utf8');
    assert.equal((html.match(/id="word-comment-handoff"/g)||[]).length,1);
    assert.match(html,/id="word-comment-handoff"[^>]* hidden/);assert.match(html,/id="word-comments-include"[^>]* disabled/);
    assert.ok(html.indexOf('id="word-comment-handoff"')>html.indexOf('id="import-body-preview"'));
  }
});
