import { articleIssues } from './authoring.js';
import { previewBlocks, inlineParts } from './preview.js';
import { tableHTML } from './markdown-table.js';
import { listHTML, listText } from './markdown-list.js';
import { wordPressImageBlocks } from './wordpress-images.js';

const escape = text => String(text).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const inline = text => inlineParts(text).map(part => part.type === 'text' ? escape(part.text) : part.type === 'a' ? '<a href="' + escape(part.href) + '" target="_blank" rel="noopener noreferrer">' + escape(part.text) + '</a>' : '<' + part.type + '>' + escape(part.text) + '</' + part.type + '>').join('').replaceAll('\n', '<br>');
const block = (name, html, attributes = '') => '<!-- wp:' + name + attributes + ' -->\n' + html + '\n<!-- /wp:' + name + ' -->';

function articleBlocks(draft, { includeLinkedImages = false } = {}) {
  if (typeof includeLinkedImages !== 'boolean') throw new Error('Choose whether to prepare linked images.');
  const issues = articleIssues(draft, 'body');
  if (Object.keys(issues).length) throw new Error(Object.values(issues)[0]);
  return includeLinkedImages ? wordPressImageBlocks(draft.body) : previewBlocks(draft.body);
}

// Use the actual export's block and inline model, without CSS list markers or link targets.
export function wordPressArticleText(draft, options) {
  const blocks = articleBlocks(draft, options);
  const plain = text => inlineParts(text).map(part => part.text).join('');
  const list = item => item.items.map((text, index) => [plain(text), ...(item.children?.[index] || []).map(list)].join('\n')).join('\n');
  return {
    text: blocks.filter(item => item.type !== 'linked-image').map(item => item.type === 'pre' ? item.text : item.items ? list(item) : item.type === 'table' ? [item.head, ...item.rows].map(row => row.map(plain).join('\t')).join('\n') : plain(item.text)).join('\n\n'),
    imageCount: blocks.filter(item => item.type === 'linked-image').length
  };
}

// Only article body becomes blocks. Title and page fields belong in WordPress fields.
// Linked Image blocks require an explicit option. No source HTML is executable.
export function createWordPressArticle(draft, options) {
  const blocks = articleBlocks(draft, options);
  const notices = [];
  const imageCount = blocks.filter(item => item.type === 'linked-image').length;
  if (imageCount) notices.push(imageCount + ' linked Image block(s) include HTTPS references, not uploaded files. Draft to Page has not loaded or verified these images. WordPress and browsers can request their URLs when the blocks are opened. The local reading preview keeps image syntax as text.');
  if (blocks.some(item => item.level === 1)) notices.push('Body H1 headings become H2. Put the post title in the separate WordPress title field.');
  if (blocks.some(item => !['pre', 'linked-image'].includes(item.type) && /!\[|<[^<>]+>|\|.*\||^\s*\[[^\]]+\]:|~~|^\s*(?:---+|\*\*\*+)\s*$/m.test(item.type === 'table' ? [item.head, ...item.rows].flat().join('\n').replaceAll('|', '') : item.items ? listText(item, text => text) : item.text))) notices.push('Some syntax may remain literal text: unsupported or unselected images, source HTML, malformed tables or lists, reference links, strike-through, or separators. Inspect it and rebuild those parts in WordPress.');
  const html = blocks.map(item => {
    if (item.type === 'linked-image') return block('image', '<figure class="wp-block-image"><img src="' + escape(item.url) + '" alt="' + escape(item.alt) + '"/></figure>');
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
  return { html, blockCount: blocks.length, imageCount, notices };
}
