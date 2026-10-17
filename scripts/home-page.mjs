import { createFormattedArticle } from '../public/html-export.js';
import { QUICK_SAMPLE } from '../public/quick-sample.js';
import { escapeHTML } from './site-shell.mjs';

// The illustration uses the public converter, not a separately authored result.
export const HOME_EXAMPLE = QUICK_SAMPLE.body.slice(0, QUICK_SAMPLE.body.indexOf('\n\n## Make the next step clear'));
const exampleHTML = createFormattedArticle({ body: HOME_EXAMPLE }).html;
export const WORDPRESS_STARTS = [
  ['01', 'Word document', 'Choose a .docx and inspect what converts.', '/word-to-wordpress/', 'Open a Word draft'],
  ['02', 'Google Docs', 'Paste a copied selection with its formatting.', '/google-docs-to-wordpress/', 'Paste from Google Docs'],
  ['03', 'Text or Markdown', 'Paste an article and see the reading preview.', '/markdown-to-wordpress/#draft', 'Paste text or Markdown']
];

export const HOME_PAGE = `
<section class="hero wrap home-hero">
  <div class="hero-copy">
    <p class="eyebrow">Free tools for WordPress writers</p>
    <h1>Your draft.<br>Ready for WordPress.</h1>
    <p class="lead">Bring your writing. Check the formatting. Take editable blocks into your next post.</p>
    <p>Start with Word, Google Docs, or Markdown. Keep supported headings, lists, links, and simple tables.</p>
    <div class="actions"><a class="button" href="#start">Choose your draft <span aria-hidden="true">↗</span></a><a class="text-link" href="/markdown-to-wordpress/#sample">Try a fictional sample</a></div>
    <ul class="home-assurances" aria-label="Public tool basics"><li>Free</li><li>No account</li><li>Local conversion</li></ul>
    <p class="small">You review and publish in WordPress. Save a backup before leaving.</p>
  </div>
  <aside class="home-start" id="start" aria-labelledby="start-heading">
    <p class="eyebrow">Start with what you have</p>
    <h2 id="start-heading">Where is your draft?</h2>
    <div class="draft-starts">${WORDPRESS_STARTS.map(([number, title, description, href, action]) => `<a href="${href}" class="draft-start"><span class="draft-start-number" aria-hidden="true">${number}</span><span><strong>${title}</strong><span>${description}</span><span class="draft-start-action">${action} <span aria-hidden="true">→</span></span></span></a>`).join('')}</div>
    <p class="small">Word imports can recover embedded PNG and JPEG files with placement notes. Upload them in WordPress. Pasted Google Docs images remain placeholders.</p>
  </aside>
</section>
<section class="example-band" id="example"><div class="wrap section home-example">
  <div class="home-section-heading"><div><p class="eyebrow">See the conversion</p><h2>A draft on the left.<br>A readable result on the right.</h2></div><p>This fictional excerpt is rendered by the same converter as the workspace. Your WordPress theme controls the final appearance.</p></div>
  <div class="home-comparison">
    <section class="comparison-input" aria-labelledby="example-input-heading"><p class="comparison-label" id="example-input-heading">Simple Markdown in</p><pre><code>${escapeHTML(HOME_EXAMPLE)}</code></pre></section>
    <section class="comparison-result" aria-labelledby="example-output-heading"><p class="comparison-label" id="example-output-heading">Supported formatting out</p><div class="home-reading">${exampleHTML}</div><p class="small">Headings, paragraphs, emphasis, and lists become editable WordPress blocks.</p></section>
  </div>
  <div class="actions"><a class="button" href="/markdown-to-wordpress/#sample">Open the working sample</a><a class="text-link" href="/examples/">More fictional examples</a><a class="text-link" href="/help/conversion-checks/#tested">What has been tested?</a></div>
</div></section>
<section class="section wrap" id="process"><p class="eyebrow">One article, three steps</p><h2>Keep the next step clear.</h2><div class="steps">
  <article><p class="step-number">01 / Bring</p><h3>Open or paste your draft.</h3><p>Choose a Word file, paste a Google Docs selection, or bring plain text and Markdown.</p></article>
  <article><p class="step-number">02 / Check</p><h3>Inspect the result.</h3><p>Read the preview, check conversion changes, and edit anything that needs attention.</p></article>
  <article><p class="step-number">03 / Take</p><h3>Continue in WordPress.</h3><p>Copy the reviewed blocks and paste into an empty paragraph in WordPress's Visual editor. Inspect, save, and reopen the draft before publishing.</p><a href="/help/publishing-handoff/#wordpress">See the WordPress steps</a></article>
</div></section>
<section class="section wrap home-secondary" id="publishing-tools"><div><p class="eyebrow">Other destinations</p><h2>Take your writing with you.</h2><p>Need a different handoff? Export clean article HTML, an editable Word document, or Markdown from the same workspace.</p><div class="actions"><a href="/word-to-markdown/">Word to Markdown</a><a href="/html-to-markdown/">HTML to Markdown</a><a href="/markdown-to-html/">Markdown to HTML</a><a href="/markdown-to-word/">Markdown to Word</a></div></div><div class="home-notes"><h3>Starting with notes?</h3><p>Use a note outline and keep your source material beside the article in the full writing workspace.</p><a href="/write/#notes">Start with your notes</a><p><a href="/templates/">Browse note templates</a></p></div></section>
<section class="section wrap home-status" id="status"><span class="badge">In development</span><p>The public tools work without an account. Conversion is local and the WordPress handoff is manual. Browser recovery is optional and off by default. The private AI pilot is separate.</p><p><a href="/getting-started/">Getting started</a> · <a href="/privacy/">Data use</a> · <a href="/access/">Access &amp; status</a></p></section>`;
