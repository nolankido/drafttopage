import { articleIssues } from './authoring.js';
import { previewBlocks, inlineParts } from './preview.js';

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
  if (blocks.some(item => item.type !== 'pre' && /!\[|<[^>]+>|\|.*\||^\s{2,}[-*+]|^\s*\d+\)|^\s*\[[^\]]+\]:|~~|^\s*(?:---+|\*\*\*+)\s*$/m.test(item.items?.join('\n') ?? item.text))) notices.push('Some syntax may remain literal text: images, source HTML, tables, nested lists, reference links, strike-through, or separators. Inspect it and rebuild those parts in WordPress.');
  const html = blocks.map(item => {
    if (item.items) {
      const items = item.items.map(text => block('list-item', '<li>' + inline(text) + '</li>')).join('\n');
      return block('list', '<' + item.type + ' class="wp-block-list">' + items + '</' + item.type + '>', item.type === 'ol' ? ' {"ordered":true}' : '');
    }
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
