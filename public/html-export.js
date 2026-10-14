import { articleIssues } from './authoring.js';
import { previewBlocks, inlineParts } from './preview.js';

const escape = text => String(text).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const inline = text => inlineParts(text).map(p => p.type === 'text' ? escape(p.text) : p.type === 'a' ? '<a href="' + escape(p.href) + '" target="_blank" rel="noopener noreferrer" aria-label="' + escape(p.text + ' (opens in a new tab)') + '">' + escape(p.text) + '</a>' : '<' + p.type + '>' + escape(p.text) + '</' + p.type + '>').join('');
export function createReadingPage(draft) {
  const issues = articleIssues(draft, 'html');
  if (Object.keys(issues).length) throw new Error(Object.values(issues)[0]);
  const description = typeof draft.description === 'string' ? draft.description.trim().slice(0, 160) : '';
  const body = previewBlocks(draft.body).map(block => {
    if (block.items) return '<' + block.type + '>' + block.items.map(item => '<li>' + inline(item) + '</li>').join('') + '</' + block.type + '>';
    if (block.type === 'pre') return '<pre><code>' + escape(block.text) + '</code></pre>';
    const tag = block.level ? 'h' + Math.max(2, block.level) : block.type;
    return '<' + tag + '>' + inline(block.text) + '</' + tag + '>';
  }).join('\n');
  return '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; base-uri \'none\'; form-action \'none\'">' +
    '<title>' + escape(draft.title.trim()) + '</title><meta name="description" content="' + escape(description) + '">' +
    '<style>body{margin:0;background:#faf9f5;color:#202e28;font:18px/1.75 Georgia,serif}main{max-width:720px;margin:0 auto;padding:clamp(24px,6vw,64px)}h1{font-size:clamp(2rem,6vw,3.3rem);line-height:1.15}h2,h3,h4,h5,h6{line-height:1.3}p,li,h1,h2,h3,h4,h5,h6{overflow-wrap:anywhere}a{color:#244b40;text-underline-offset:.16em}p,blockquote{white-space:pre-wrap}blockquote{margin:1.5rem 0;padding-left:1rem;border-left:3px solid #244b40}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#edf0e8;padding:1rem;border-radius:6px}code{font:0.9em/1.5 ui-monospace,monospace}</style></head>' +
    '<body><main><article><h1>' + escape(draft.title.trim()) + '</h1>\n' + body + '</article></main></body></html>\n';
}
