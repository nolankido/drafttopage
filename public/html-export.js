import { articleIssues } from './authoring.js';
import { previewBlocks, inlineParts } from './preview.js';
import { tableHTML } from './markdown-table.js';
import { listHTML, listText } from './markdown-list.js';

const escape = text => String(text).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const inline = (text, portable = false) => {
  const html = inlineParts(text).map(p => p.type === 'text' ? escape(p.text) : p.type === 'a' ? '<a href="' + escape(p.href) + '" target="_blank" rel="noopener noreferrer" aria-label="' + escape(p.text + ' (opens in a new tab)') + '">' + escape(p.text) + '</a>' : '<' + p.type + '>' + escape(p.text) + '</' + p.type + '>').join('');
  return portable ? html.replaceAll('\n', '<br>') : html;
};
export function createFormattedArticle(draft, { includeTitle = false, portable = false } = {}) {
  const issues = articleIssues(draft, includeTitle ? 'html' : 'body');
  if (Object.keys(issues).length) throw new Error(Object.values(issues)[0]);
  const blocks = previewBlocks(draft.body);
  const renderInline = text => inline(text, portable);
  const body = blocks.map(block => {
    if (block.type === 'table') return tableHTML(block, renderInline, { portable });
    if (block.items) return listHTML(block, renderInline);
    if (block.type === 'pre') return '<pre' + (portable ? ' style="white-space:pre-wrap;overflow-wrap:anywhere"' : '') + '><code>' + escape(block.text) + '</code></pre>';
    const tag = block.level ? 'h' + Math.max(2, block.level) : block.type;
    return '<' + tag + '>' + renderInline(block.text) + '</' + tag + '>';
  }).join('\n');
  const plainInline = text => inlineParts(text).map(part => part.type === 'a' ? part.text + ' (' + part.href + ')' : part.text).join('');
  const text = blocks.map(block => block.type === 'table' ? [block.head, ...block.rows].map(row => row.map(plainInline).join('\t')).join('\n') : block.items ? listText(block, plainInline) : block.type === 'pre' ? block.text : plainInline(block.text)).join('\n\n');
  return { html: (includeTitle ? '<h1>' + escape(draft.title.trim()) + '</h1>\n' : '') + body, text: (includeTitle ? draft.title.trim() + '\n\n' : '') + text };
}
// A reviewed article fragment for an HTML-capable editor, without document metadata.
// Only fixed layout hints are added. Source HTML and resource syntax stay literal.
export function createHTMLSource(draft, { includeTitle = false } = {}) {
  if (typeof includeTitle !== 'boolean') throw new Error('Choose whether to include the title in HTML source.');
  return createFormattedArticle(draft, { includeTitle, portable: true }).html + '\n';
}
export function createReadingPage(draft) {
  const article = createFormattedArticle(draft, { includeTitle: true });
  const description = typeof draft.description === 'string' ? draft.description.trim().slice(0, 160) : '';
  return '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; base-uri \'none\'; form-action \'none\'">' +
    '<title>' + escape(draft.title.trim()) + '</title><meta name="description" content="' + escape(description) + '">' +
    '<style>body{margin:0;background:#faf9f5;color:#202e28;font:18px/1.75 Georgia,serif}main{max-width:720px;margin:0 auto;padding:clamp(24px,6vw,64px)}h1{font-size:clamp(2rem,6vw,3.3rem);line-height:1.15}h2,h3,h4,h5,h6{line-height:1.3}p,li,h1,h2,h3,h4,h5,h6{overflow-wrap:anywhere}a{color:#244b40;text-underline-offset:.16em}p,blockquote{white-space:pre-wrap}blockquote{margin:1.5rem 0;padding-left:1rem;border-left:3px solid #244b40}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#edf0e8;padding:1rem;border-radius:6px}code{font:0.9em/1.5 ui-monospace,monospace}ul,ol{padding-left:1.35rem}li>ul,li>ol{margin-block:.35rem}.article-table{max-width:100%;overflow-x:auto;margin:1.5rem 0}.article-table:focus-visible{outline:3px solid #244b40;outline-offset:3px}.article-table table{border-collapse:collapse;min-width:100%}.article-table th,.article-table td{border:1px solid #d8ded4;padding:.6rem;min-width:6rem;overflow-wrap:anywhere;text-align:left}.article-table th{background:#edf0e8}.article-table .has-text-align-left{text-align:left}.article-table .has-text-align-center{text-align:center}.article-table .has-text-align-right{text-align:right}</style></head>' +
    '<body><main><article>' + article.html + '</article></main></body></html>\n';
}
