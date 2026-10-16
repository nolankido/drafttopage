import { createArticleMarkdown } from '../public/article-markdown.js';
import { escapeHTML } from './site-shell.mjs';
import { readFileSync } from 'node:fs';

export const WORD_MARKDOWN_SAMPLE = {
  title: 'A small publishing plan',
  body: '## Before publishing\n\nKeep **clear structure** and [source links](https://example.com/).\n\n1. Review the article.\n2. Preview the destination.\n\n| Step | Status |\n| --- | --- |\n| Review | Ready |\n| Publish | Planned |'
};
export const WORD_MARKDOWN_GUIDE = `
<section class="converter-guide" aria-labelledby="word-markdown-guide">
<h2 id="word-markdown-guide">Convert a Word draft into Markdown</h2>
<ol><li><strong>Open the document.</strong> Choose a plain .docx up to 8 MiB. It is read locally. Keep the original Word document.</li><li><strong>Check the import.</strong> Compare the reading preview, exact converted text, and all formatting notices with the original. Acknowledge the changes, then import into the editor. Your existing article stays intact until you apply.</li><li><strong>Review the Markdown.</strong> Edit the article if needed. The opening title, when recognized, moves to the separate title field. The Markdown destination includes that title as a heading by default when available. Uncheck the title option for body-only output.</li><li><strong>Copy or download.</strong> Check the export review box, then copy article Markdown or download a .md file. Inspect headings, tables, links, and images in your destination before publishing.</li></ol>
<h2 id="word-markdown-limits">What converts, and what needs attention?</h2>
<div class="article-table" role="region" aria-label="Word to Markdown conversion support" tabindex="0"><table class="format-table"><thead><tr><th scope="col">Word content</th><th scope="col">Markdown result</th></tr></thead><tbody>
<tr><th scope="row">Paragraphs and common heading styles</th><td>Paragraphs and Markdown headings. A recognized opening title becomes a separate title field.</td></tr>
<tr><th scope="row">Bold, italic, and web hyperlinks</th><td>Supported single-line emphasis, combined bold and italic, and absolute HTTP(S) links. Unsupported styles can be simplified with notices.</td></tr>
<tr><th scope="row">Ordinary lists and simple tables</th><td>Bullets, decimal numbering, supported nesting, and rectangular pipe tables. Unmarked table headers require your explicit choice before import. Complex layouts need simplification.</td></tr>
<tr><th scope="row">Pictures and embedded objects</th><td>Numbered text placeholders. Before importing, you can separately recover supported PNG and JPEG files with their placement notes. This .md export does not contain or automatically link image files.</td></tr>
<tr><th scope="row">Footnotes and endnotes</th><td>Supported referenced notes become labeled article sections, with visible markers. Review the numbering and text before importing. These sections are included in the .md export.</td></tr>
<tr><th scope="row">Page design and document extras</th><td>Fonts, colors, page layout, headers, footers, comments, and document metadata are not retained. Tracked changes are blocked by default. Ordinary text insertions and deletions can use an explicit proposed/previous version preview. Complex revisions, fields, equations, and structures need review in Word.</td></tr>
</tbody></table></div>
<p>Articles are limited to 60,000 characters. .doc, macro-enabled, encrypted, damaged, and unusually packaged documents are unsupported. This is a limited article conversion, not a complete Word layout reproduction. <a href="/help/article-import/">Read the Word import limits</a>.</p>
${readFileSync(new URL('./word-notes-help.html.inc', import.meta.url), 'utf8')}
<h2 id="word-markdown-example">Try a real Word sample</h2>
<p>This fictional document has headings, emphasis, a link, a numbered list, and a simple table. It is generated locally by this project's Word exporter. Download it, open it above, and compare your result. Word import can add escaping to keep literal punctuation and explicit bold from heading or table-header styles; equivalent Markdown can look different.</p>
<p><a href="/samples/word-to-markdown.docx" download="drafttopage-fictional-sample.docx">Download the fictional .docx</a> · <a href="/samples/word-to-markdown.md" download="drafttopage-fictional-sample.md">Download the example Markdown</a></p>
<pre class="code-sample"><code>${escapeHTML(createArticleMarkdown(WORD_MARKDOWN_SAMPLE, { includeTitle: true }))}</code></pre>
<h2 id="word-markdown-questions">Common questions</h2>
<details><summary>Is this converter free?</summary><p>Yes. The public tool needs no account, subscription, API key, or AI credits. The private AI pilot is separate.</p></details>
<details><summary>Does my Word file leave this page?</summary><p>Application code reads and converts the selected file locally. It does not upload the document. The original bytes and pending preview are discarded when you apply or clear the import, or leave the page. Save your writing explicitly.</p></details>
<details><summary>Does it generate GitHub-flavored Markdown?</summary><p>It prepares a limited Markdown article, including supported pipe tables. GitHub and other editors can interpret Markdown differently. Review the actual file in your destination; full dialect compatibility is not claimed. This tool does not connect to GitHub or publish files.</p></details>
<details><summary>Where did the title go?</summary><p>A recognized opening title moves into Article title. The Markdown destination includes it as an H1 heading by default when available. Body-only output excludes that separate title. An existing title heading inside the body is kept, so check for duplicates.</p></details>
<details><summary>Can I turn Markdown back into Word?</summary><p>Use the <a href="/markdown-to-word/">Markdown to Word converter</a> for a new editable .docx with the supported article structure. It cannot recreate the original layout, comments, image placement, or other excluded information.</p></details>
<p class="small">Draft to Page is in development and has no claimed Microsoft or GitHub partnership. Need editable blocks instead? Use <a href="/word-to-wordpress/">Word to WordPress</a>. For private unfinished writing, keep a <a href="/help/local-workspace/">workspace backup</a>.</p>
</section>`;
