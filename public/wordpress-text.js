import { articleIssues } from './authoring.js';
import { previewBlocks, inlineParts } from './preview.js';
import { wordPressImageBlocks } from './wordpress-images.js';

// Explicit imports keep the comparison model independent of renderer refactors.
// Use the export's block and inline model, without CSS list markers or link targets.
export function wordPressArticleText(draft, { includeLinkedImages = false } = {}) {
  if (typeof includeLinkedImages !== 'boolean') throw new Error('Choose whether to prepare linked images.');
  const issues = articleIssues(draft, 'body');
  if (Object.keys(issues).length) throw new Error(Object.values(issues)[0]);
  const blocks = includeLinkedImages ? wordPressImageBlocks(draft.body) : previewBlocks(draft.body);
  const plain = text => inlineParts(text).map(part => part.text).join('');
  const list = item => item.items.map((text, index) => [plain(text), ...(item.children?.[index] || []).map(list)].join('\n')).join('\n');
  return {
    text: blocks.filter(item => !['linked-image', 'hr'].includes(item.type)).map(item => item.type === 'pre' ? item.text : item.items ? list(item) : item.type === 'table' ? [item.head, ...item.rows].map(row => row.map(plain).join('\t')).join('\n') : plain(item.text)).join('\n\n'),
    imageCount: blocks.filter(item => item.type === 'linked-image').length
  };
}
