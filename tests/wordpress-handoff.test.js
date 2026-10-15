import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { reviewWordPress, wordPressReviewText, WORDPRESS_REVIEW_LIMIT } from '../public/wordpress-review.js';
import { wordPressKitFiles, createWordPressKit } from '../public/wordpress-kit.js';
import { createWordPressArticle } from '../public/wordpress-export.js';
import { QUICK_SAMPLE } from '../public/quick-sample.js';
import { installWordPressHandoff } from '../public/wordpress-handoff-controls.js';

test('Handoff review identifies actual conversion limits and unfinished passages in source order', () => {
  const body = '# Post title\n\nTODO: finish this.\n\n![image](https://example.test/image.png)\n\n[relative](/page/)\n\n## A list\n\n  - Nested\n+ Alternative marker\n9. Different start\n10. Continues\n- [x] Task\n\n| Name | Count |\n| --- | --- |\n| A | 2 | EXTRA |\n\n[ref]: https://example.test/\nRead [the reference][ref].\n\n~~removed~~\n\n---\n\n<div>Source HTML</div>';
  const result = reviewWordPress({ title: 'Post title', body });
  for (const kind of ['title','title-level','placeholder','image','link','nested-list','task-list','table','reference','strike','separator','html']) assert.ok(result.findings.some(item => item.kind === kind), kind);
  assert.equal(result.findings.filter(item => ['list-start', 'list-style'].includes(item.kind)).length, 0);
  assert.equal(result.findings.filter(item => item.kind === 'table').length, 1);
  assert.ok(result.findings.every((item, index, all) => !index || item.start >= all[index - 1].start));
  for (const item of result.findings) { assert.ok(item.start >= 0 && item.end <= body.length); assert.equal(item.line, body.slice(0,item.start).split('\n').length); }
});
test('Fenced and inline code, URLs, and escaped syntax do not produce unsupported-format warnings', () => {
  const body = '## Literal code\n\n`~~text~~ <div> [ref]: - [x]`\n\n[Resource](https://example.test/a|b?x=~~text~~)\n\n\\~~literal\\~~ and \\[link][ref]\n\n~~~html\n<div>HTML</div>\n  - nested\n![image](https://example.test/a)\nTODO\n~~~';
  const result = reviewWordPress({ title: 'A code example', body });
  assert.deepEqual(result.findings, []);
});
test('Additional Markdown block forms are disclosed without rewriting the draft', () => {
  const draft = { body: 'An underlined heading\n===\n\n    const literal = 1;\n\n> ## Quote heading\n> > Nested quote' };
  const before = JSON.stringify(draft), result = reviewWordPress(draft);
  for (const kind of ['setext','indented-code','quote-format']) assert.ok(result.findings.some(item => item.kind === kind), kind);
  assert.equal(JSON.stringify(draft), before);
});
test('CRLF and Unicode findings select the exact current editor line without altering it', () => {
  const body = '日本語 😀\r\n\r\n  - Keep this line\r\n\r\n| 名前 | 数 |\r\n| --- | --- |\r\n| A | 1 | EXTRA |';
  const before = body, result = reviewWordPress({ body });
  const nested = result.findings.find(item => item.kind === 'nested-list'), table = result.findings.find(item => item.kind === 'table');
  assert.equal(body.slice(nested.start,nested.end), '  - Keep this line'); assert.equal(nested.line, 3);
  assert.equal(body.slice(table.start,table.end), '| 名前 | 数 |'); assert.equal(table.line, 5);
  assert.equal(body, before);
});
test('Review is bounded, discloses omissions, and does not certify an article with no findings', () => {
  const result = reviewWordPress({ body: Array(100).fill('<div>literal</div>').join('\n\n') });
  assert.equal(result.totalFindings, 100); assert.equal(result.findings.length, WORDPRESS_REVIEW_LIMIT); assert.equal(result.truncated, true);
  assert.match(wordPressReviewText({ body: 'A finished-looking paragraph.' }), /does not certify/);
  assert.match(wordPressReviewText({ body: Array(100).fill('<div>literal</div>').join('\n\n') }), /first 40 items/);
  for (const body of ['', ' ', 'x'.repeat(60001), null, 'a\u0000b']) assert.throws(() => reviewWordPress({ body }));
});
test('A WordPress kit is destination-specific, deterministic, and safe with optional fields absent', () => {
  const draft = { title: '日本語', body: 'A paragraph.', slug: '../unsafe', excerpt: '', description: '' }, before = JSON.stringify(draft);
  const kit = wordPressKitFiles(draft), files = Object.fromEntries(kit.files.map(file => [file.name,file.content]));
  assert.equal(kit.filename, 'untitled-article-wordpress-kit.zip');
  assert.deepEqual(Object.keys(files), ['wordpress-blocks.html','article-body.md','reading-page.html','page-details.json','REVIEW.txt','README.txt']);
  assert.equal(files['wordpress-blocks.html'], createWordPressArticle(draft).html);
  assert.equal(JSON.parse(files['page-details.json']).excerpt, ''); assert.equal(JSON.parse(files['page-details.json']).slug, 'untitled-article');
  assert.match(kit.notices.join(' '), /editor filename is unchanged/); assert.match(kit.notices.join(' '), /left empty/);
  assert.match(files['README.txt'], /TEXT EDITOR/); assert.match(files['README.txt'], /Excerpt setting/); assert.match(files['README.txt'], /not an automatic WordPress import/);
  assert.equal(JSON.stringify(draft), before); assert.deepEqual(createWordPressKit(draft).bytes, createWordPressKit(draft).bytes);
});
test('WordPress article files exclude private workspace data and preserve hostile material as inert text', () => {
  const draft = { ...QUICK_SAMPLE, body: '<script>literal()</script>\n\nTODO: inspect.\n\n[unsafe](javascript:bad())', source: { notes: 'PRIVATE SOURCE SENTINEL' }, questions: ['PRIVATE QUESTION SENTINEL'], audience: 'PRIVATE AUDIENCE SENTINEL', history: ['PRIVATE HISTORY SENTINEL'], password: 'PRIVATE AUTH SENTINEL' };
  for (const file of wordPressKitFiles(draft).files) assert.doesNotMatch(file.content, /PRIVATE .* SENTINEL/);
  const files = Object.fromEntries(wordPressKitFiles(draft).files.map(file => [file.name,file.content]));
  for (const name of ['wordpress-blocks.html','reading-page.html']) assert.doesNotMatch(files[name], /<script>|href="javascript:/);
  assert.match(files['REVIEW.txt'], /TODO/); assert.match(files['REVIEW.txt'], /Source HTML/);
  for (const change of [{ title: '' },{ body: '' },{ body: 'x'.repeat(60001) },{ excerpt: 'x'.repeat(301) },{ description: null },{ slug: 'x'.repeat(81) }]) assert.throws(() => createWordPressKit({ ...draft,...change }));
});
test('The kit preserves exact source whitespace and CRLF so review line numbers remain usable', () => {
  const draft = { title: 'A fictional source', body: '\r\n\r\n  - Nested source\r\n\r\n' };
  const files = Object.fromEntries(wordPressKitFiles(draft).files.map(file => [file.name, file.content]));
  assert.equal(files['article-body.md'], draft.body);
  assert.match(files['REVIEW.txt'], /Line 3: This indented list/);
  assert.match(files['README.txt'], /line numbers refer to the exact original body/);
});
test('An independent ZIP reader checks all six file bytes, CRCs, UTF-8 metadata, and safe paths', () => {
  const root = mkdtempSync(join(tmpdir(),'dtp-wordpress-'));
  try {
    const file = join(root,'kit.zip'), kit = createWordPressKit(QUICK_SAMPLE); writeFileSync(file,kit.bytes);
    const files = JSON.parse(execFileSync('python3',['-c','import json,sys,zipfile\nwith zipfile.ZipFile(sys.argv[1]) as z:\n assert z.testzip() is None\n assert all(i.compress_type == zipfile.ZIP_STORED and i.flag_bits & 0x800 and "/" not in i.filename for i in z.infolist())\n print(json.dumps({n:z.read(n).decode("utf-8") for n in z.namelist()}))',file],{encoding:'utf8'}));
    assert.deepEqual(files,Object.fromEntries(wordPressKitFiles(QUICK_SAMPLE).files.map(item => [item.name,item.content])));
    assert.ok(kit.bytes.length <= 4 * 1024 * 1024);
  } finally { rmSync(root,{recursive:true,force:true}); }
});

function node(value = '') {
  const handlers = {};
  return { value, checked:false, open:false, disabled:false, children:[], textContent:'', focus(){this.focused=true;}, setSelectionRange(start,end){this.selection=[start,end];}, addEventListener(name,fn){handlers[name]=fn;}, fire(name){return handlers[name]?.();}, append(...children){this.children.push(...children);}, replaceChildren(...children){this.children=children;} };
}
test('Handoff controls refresh findings, keep inspection read-only, reject stale positions, and gate field copies', async () => {
  const ids=['publishing-destination','reviewed','wordpress-review-status','wordpress-review-panel','wordpress-findings','copy-wordpress-excerpt','copy-wordpress-slug','copy-wordpress-description','wordpress-fields-status','download-wordpress-kit','wordpress-kit-status','wordpress-kit-panel','wordpress-kit-files','wordpress-edit-fields','page-details','excerpt','body'];
  const nodes=Object.fromEntries(ids.map(id=>[id,node()])); nodes['publishing-destination'].value='wordpress'; nodes['wordpress-review-panel'].open=true; nodes['wordpress-kit-panel'].open=true;
  const oldDocument=globalThis.document, oldNavigator=Object.getOwnPropertyDescriptor(globalThis,'navigator'); let draft={...QUICK_SAMPLE,body:'A line.\n\n  - Nested'}, copied='', report='', busy=false;
  globalThis.document={getElementById:id=>nodes[id],createElement:()=>node()};
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{clipboard:{writeText:async text=>{copied=text;}}}});
  try {
    const control=installWordPressHandoff({getDraft:()=>draft,approved:()=>{if(!nodes.reviewed.checked)throw Error('Review first.');},report:text=>{report=text;},isBusy:()=>busy,reveal:()=>{}});
    control.update(); assert.equal(nodes['wordpress-findings'].children.length,1); assert.equal(nodes['wordpress-kit-files'].children.length,6);
    assert.equal(nodes['download-wordpress-kit'].disabled,true); assert.equal(nodes['copy-wordpress-excerpt'].disabled,true);
    const button=nodes['wordpress-findings'].children[0].children[1]; nodes.reviewed.checked=true; control.update();
    await button.fire('click'); assert.deepEqual(nodes.body.selection,[9,19]); assert.equal(nodes.reviewed.checked,true); assert.equal(draft.body,'A line.\n\n  - Nested');
    busy=true; nodes.body.selection=null; await button.fire('click'); assert.equal(nodes.body.selection,null); busy=false;
    await nodes['copy-wordpress-excerpt'].fire('click'); assert.equal(copied,QUICK_SAMPLE.excerpt);
    draft={...draft,body:'Changed body.'}; await button.fire('click'); assert.equal(nodes.body.selection,null); assert.match(report,/article changed/); assert.equal(nodes['wordpress-findings'].children.length,0);
    draft={...draft,slug:'../bad',description:''}; nodes.reviewed.checked=false; control.update();
    assert.equal(nodes['copy-wordpress-slug'].disabled,true); assert.equal(nodes['copy-wordpress-description'].disabled,true); copied=''; await nodes['copy-wordpress-excerpt'].fire('click'); assert.equal(copied,'');
    await nodes['wordpress-edit-fields'].fire('click'); assert.equal(nodes['page-details'].open,true); assert.equal(nodes.excerpt.focused,true);
    draft={...draft,body:'  - Current issue'}; control.update(); assert.equal(nodes['wordpress-findings'].children.length,1);
    nodes['wordpress-review-panel'].open=false; await nodes['wordpress-review-panel'].fire('toggle'); assert.equal(nodes['wordpress-findings'].children.length,0);
    nodes['publishing-destination'].value='other'; control.update(); assert.equal(nodes['wordpress-kit-files'].children.length,0); assert.equal(nodes['download-wordpress-kit'].disabled,true);
    control.reset(); draft={title:'',body:''}; control.update(); assert.equal(nodes['wordpress-findings'].children.length,0); assert.match(nodes['wordpress-review-status'].textContent,/Add an article/);
  } finally {globalThis.document=oldDocument;if(oldNavigator)Object.defineProperty(globalThis,'navigator',oldNavigator);else delete globalThis.navigator;}
});
