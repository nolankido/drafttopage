import test from 'node:test';
import assert from 'node:assert/strict';
import { createWordPressArticle } from '../public/wordpress-export.js';
import { QUICK_SAMPLE } from '../public/quick-sample.js';
import { installPublishingExports } from '../public/export-controls.js';

test('WordPress handoff creates editable blocks and keeps all other fields separate', () => {
  const draft = { ...QUICK_SAMPLE, title: 'PRIVATE TITLE', excerpt: 'PRIVATE EXCERPT', description: 'PRIVATE DESCRIPTION', slug: 'private-slug', questions: ['PRIVATE QUESTION'], source: { notes: 'PRIVATE SOURCE' } };
  const before = JSON.stringify(draft), result = createWordPressArticle(draft);
  assert.equal(result.blockCount, 10); assert.deepEqual(result.notices, []);
  assert.match(result.html, /<!-- wp:list -->\n<ul class="wp-block-list">/);
  assert.equal((result.html.match(/<!-- wp:list-item -->/g) || []).length, 10);
  assert.match(result.html, /<!-- wp:list {"ordered":true,"start":4} -->\n<ol/);
  assert.match(result.html, /<!-- wp:quote -->\n<blockquote class="wp-block-quote"><!-- wp:paragraph -->/);
  assert.doesNotMatch(result.html, /PRIVATE|private-slug|<h1>/);
  assert.equal(JSON.stringify(draft), before);
});
test('Body-only handoff does not require a title or page fields and rejects invalid bodies', () => {
  assert.match(createWordPressArticle({ body: 'Only the body.' }).html, /<p>Only the body\.<\/p>/);
  for (const draft of [null, {}, { body: null }, { body: '' }, { body: ' \n ' }, { body: 'x'.repeat(12001) }, { body: 'hidden\u0000text' }]) assert.throws(() => createWordPressArticle(draft));
  assert.ok(createWordPressArticle({ body: '界'.repeat(12000) }).html.includes('界'.repeat(12000)));
});
test('Heading levels, code, line breaks and safe links survive without executable source HTML', () => {
  const body = '# Body H1\n\n### Third level\n\n###### Sixth level\n\nOne\nTwo **bold** *italic* `inline`.\n\n[link](https://example.test/?a=1&b=2)\n\n~~~js\n<script>literal & code</script>\n~~~';
  const result = createWordPressArticle({ body });
  assert.match(result.html, /<h2 class="wp-block-heading">Body H1<\/h2>/);
  assert.match(result.html, /wp:heading {"level":3}/); assert.match(result.html, /<h6 class="wp-block-heading">/);
  assert.match(result.html, /One<br>Two <strong>bold<\/strong> <em>italic<\/em> <code>inline<\/code>/);
  assert.match(result.html, /href="https:\/\/example.test\/\?a=1&amp;b=2" target="_blank" rel="noopener noreferrer"/);
  assert.match(result.html, /wp-block-code/); assert.match(result.html, /&lt;script&gt;literal &amp; code&lt;\/script&gt;/);
  assert.doesNotMatch(result.html, /<script>/); assert.match(result.notices.join(' '), /H1 headings become H2/);
});
test('Hostile block comments, image URLs and unsafe links remain literal text', () => {
  const body = '<!-- wp:html -->\n<script>bad()</script>\n<!-- /wp:html -->\n\n![img](https://example.test/a.png)\n\n[bad](javascript:bad())\n\n[<svg onload=bad()>](https://example.test/)\n\n| table | stays |\n\n  - nested list\n\n[ref]: https://example.test/';
  const result = createWordPressArticle({ body });
  assert.doesNotMatch(result.html, /<!-- wp:html|<script|<svg|<img|href="javascript:|src=/);
  assert.match(result.html, /&lt;!-- wp:html --&gt;/); assert.match(result.html, /!\[img\]/);
  assert.match(result.notices.join(' '), /remain literal text/);
});

function element(value = '') {
  const handlers = {};
  return { value, checked: false, open: false, hidden: false, disabled: false, textContent: '', children: [], addEventListener: (name, fn) => { handlers[name] = fn; }, replaceChildren(...children) { this.children = children; }, append() {}, fire(name) { return handlers[name]?.(); } };
}
test('WordPress controls require approval, clear stale output, and provide a clipboard fallback', async () => {
  const nodes = Object.fromEntries(['export-format','reviewed','publishing-destination','wordpress-handoff','copy-wordpress','download-wordpress','copy-wordpress-title','wordpress-readiness','wordpress-notices','wordpress-code-panel','wordpress-code-preview','copy-formatted','copy-title','download-kit','kit-readiness','publishing-kit-panel','kit-files','wordpress-review-status','wordpress-review-panel','wordpress-findings','copy-wordpress-excerpt','copy-wordpress-slug','copy-wordpress-description','wordpress-fields-status','download-wordpress-kit','wordpress-kit-status','wordpress-kit-panel','wordpress-kit-files','wordpress-edit-fields','page-details','excerpt','body'].map(id => [id, element()]));
  nodes['publishing-destination'].value = 'wordpress'; nodes['export-format'].value = 'page'; nodes['wordpress-code-panel'].open = true;
  const oldDocument = globalThis.document, oldNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  let copied = '', message = '', draft = { ...QUICK_SAMPLE };
  globalThis.document = { getElementById: id => nodes[id], createElement: () => element() };
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { clipboard: { writeText: async text => { copied = text; } } } });
  try {
    let control;
    control = installPublishingExports({ getDraft: () => draft, approved: () => { if (!nodes.reviewed.checked) throw new Error('Review first.'); }, changed: () => { nodes.reviewed.checked = false; control.update(); }, report: text => { message = text; } });
    control.update(); assert.equal(nodes['copy-wordpress'].disabled, true); assert.equal(nodes['wordpress-code-preview'].value, '');
    await nodes['copy-wordpress'].fire('click'); assert.equal(copied, '');
    nodes.reviewed.checked = true; control.update();
    assert.equal(nodes['copy-wordpress'].disabled, false); assert.ok(nodes['wordpress-code-preview'].value.startsWith('<!-- wp:paragraph -->'));
    await nodes['copy-wordpress'].fire('click'); assert.equal(copied, createWordPressArticle(draft).html); assert.match(message, /Nothing was published/);
    await nodes['copy-wordpress-title'].fire('click'); assert.equal(copied, draft.title);
    draft = { body: 'A changed article.', title: '' }; nodes.reviewed.checked = false; control.update();
    assert.equal(nodes['wordpress-code-preview'].value, ''); assert.equal(nodes['copy-wordpress-title'].disabled, true);
    nodes.reviewed.checked = true; control.update(); assert.equal(nodes['copy-wordpress'].disabled, false);
    navigator.clipboard.writeText = async () => { throw new Error('Blocked'); };
    await nodes['copy-wordpress'].fire('click'); assert.match(message, /Download the blocks/);
    nodes['publishing-destination'].value = 'other'; await nodes['publishing-destination'].fire('change');
    assert.equal(nodes.reviewed.checked, false); assert.equal(nodes['wordpress-handoff'].hidden, true); assert.equal(nodes['wordpress-code-preview'].value, '');
    control.reset(); assert.equal(nodes['publishing-destination'].value, 'wordpress');
    draft = { body: '', title: '' }; control.update(); assert.equal(nodes['copy-wordpress'].disabled, true);
  } finally {
    globalThis.document = oldDocument;
    if (oldNavigator) Object.defineProperty(globalThis, 'navigator', oldNavigator); else delete globalThis.navigator;
  }
});
