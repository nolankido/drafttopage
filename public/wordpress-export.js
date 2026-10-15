import { articleIssues } from './authoring.js';
import { previewBlocks, inlineParts } from './preview.js';
import { tableHTML } from './markdown-table.js';
import { listHTML, listText } from './markdown-list.js';

const escape = text => String(text).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const inline = text => inlineParts(text).map(part => part.type === 'text' ? escape(part.text) : part.type === 'a' ? '<a href="' + escape(part.href) + '" target="_blank" rel="noopener noreferrer">' + escape(part.text) + '</a>' : '<' + part.type + '>' + escape(part.text) + '</' + part.type + '>').join('').replaceAll('\n', '<br>');
const block = (name, html, attributes = '') => '<!-- wp:' + name + attributes + ' -->\n' + html + '\n<!-- /wp:' + name + ' -->';

// Only article body becomes blocks. Title and page fields belong in WordPress fields.
// No source HTML, image, embed, or user-supplied block comment is executable.
export function createWordPressArticle(draft) {
  const issues = articleIssues(draft, 'body');
  if (Object.keys(issues).length) throw new Error(Object.values(issues)[0]);
  const blocks = previewBlocks(draft.body);
  const notices = [];
  if (blocks.some(item => item.level === 1)) notices.push('Body H1 headings become H2. Put the post title in the separate WordPress title field.');
  if (blocks.some(item => item.type !== 'pre' && /!\[|<[^<>]+>|\|.*\||^\s*\[[^\]]+\]:|~~|^\s*(?:---+|\*\*\*+)\s*$/m.test(item.type === 'table' ? [item.head, ...item.rows].flat().join('\n').replaceAll('|', '') : item.items ? listText(item, text => text) : item.text))) notices.push('Some syntax may remain literal text: images, source HTML, malformed tables or lists, reference links, strike-through, or separators. Inspect it and rebuild those parts in WordPress.');
  const html = blocks.map(item => {
    if (item.type === 'table') return block('table', tableHTML(item, inline, { wordpress: true }), ' {"hasFixedLayout":true}');
    if (item.items) return listHTML(item, inline, { wordpress: true });
    if (item.type === 'pre') return block('code', '<pre class="wp-block-code"><code>' + escape(item.text) + '</code></pre>');
    if (item.level) {
      const level = Math.max(2, item.level);
      return block('heading', '<h' + level + ' class="wp-block-heading">' + inline(item.text) + '</h' + level + '>', level === 2 ? '' : ' {"level":' + level + '}');
    }
    const paragraph = block('paragraph', '<p>' + inline(item.text) + '</p>');
    return item.type === 'blockquote' ? block('quote', '<blockquote class="wp-block-quote">' + paragraph + '</blockquote>') : paragraph;
  }).join('\n\n') + '\n';
  return { html, blockCount: blocks.length, notices };
}
