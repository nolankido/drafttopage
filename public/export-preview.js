import { articleIssues } from './authoring.js';
import { previewBlocks, renderPreviewBlock } from './preview.js';
import { wordDocumentIssues } from './word-export.js';
import { wordPressImageBlocks } from './wordpress-images.js';
import { createArticleMarkdown } from './article-markdown.js';
import { exportTitleHandling } from './export-review.js';

export function prepareExportPreview(draft, { destination, includeTitle = false, includeLinkedImages = false } = {}) {
  if (!['wordpress', 'word', 'html', 'markdown'].includes(destination)) throw new Error('Choose WordPress, Word, HTML, or Markdown to preview.');
  if (typeof includeTitle !== 'boolean' || typeof includeLinkedImages !== 'boolean') throw new Error('Choose the export title and image options.');
  if (destination === 'wordpress' && includeTitle) throw new Error('WordPress uses its separate post title field.');
  if (destination !== 'wordpress' && includeLinkedImages) throw new Error('Linked image blocks are available only for WordPress.');
  const labels = { wordpress: 'WordPress block content', word: 'Word document content', html: 'HTML fragment content', markdown: 'Markdown file contents' };
  if (destination === 'markdown') {
    const source = createArticleMarkdown(draft, { includeTitle });
    const included = includeTitle && typeof draft.title === 'string' && Boolean(draft.title.trim());
    return { destination, label: labels[destination], kind: 'source', source, title: '', blocks: [], imageCount: 0,
      titleHandling: included ? 'The title is included as an escaped Markdown heading.' : 'The separate title field is omitted.',
      limit: 'This is the Markdown text for the file, including its final newline. Your destination may interpret source HTML and request linked images differently. Inspect it before publishing.' };
  }
  const issues = destination === 'word' ? wordDocumentIssues(draft, { includeTitle }) : articleIssues(draft, includeTitle ? 'html' : 'body');
  if (Object.keys(issues).length) throw new Error(Object.values(issues)[0]);
  const original = destination === 'wordpress' && includeLinkedImages ? wordPressImageBlocks(draft.body) : previewBlocks(draft.body);
  const blocks = original.map(block => {
    if (!block.level) return block;
    const exportLevel = destination === 'word' ? block.level : Math.max(2, block.level);
    // Keep document headings below the surrounding page's headings in the DOM.
    return { ...block, exportLevel, type: 'h' + Math.min(6, exportLevel + 2) };
  });
  const imageCount = blocks.filter(block => block.type === 'linked-image').length;
  return { destination, label: labels[destination], kind: 'document', title: includeTitle ? draft.title.trim() : '', blocks, imageCount,
    titleHandling: exportTitleHandling({ destination, includeTitle }),
    limit: 'Content and structure preview only. Fonts, spacing, line wrapping, page breaks, and destination styling can differ.' + (imageCount ? ' Linked images are shown as placeholders with their exact URL and alternative text. No image is requested here; WordPress can request it when the blocks are opened.' : ' Images and source HTML stay literal text. No external resource is requested here.') };
}

export function renderExportPreview(target, model) {
  const fragment = document.createDocumentFragment();
  if (model.kind === 'source') {
    const pre = document.createElement('pre'), code = document.createElement('code');
    pre.className = 'export-preview-source'; code.textContent = model.source; pre.append(code); fragment.append(pre);
  } else {
    if (model.title) { const title = document.createElement('p'); title.className = 'export-preview-title'; title.setAttribute('data-export-title', ''); title.textContent = model.title; fragment.append(title); }
    for (const block of model.blocks) {
      if (block.type === 'linked-image') {
        const figure = document.createElement('figure'), caption = document.createElement('figcaption'), address = document.createElement('code');
        figure.className = 'export-preview-image';
        caption.textContent = 'Linked image placeholder. Alternative text: ' + (block.alt || '(empty; review whether this is decorative)');
        address.textContent = block.url; figure.append(caption, address); fragment.append(figure); continue;
      }
      const node = renderPreviewBlock(block);
      if (block.exportLevel) { node.setAttribute('data-export-heading-level', String(block.exportLevel)); node.className = 'export-preview-heading'; }
      fragment.append(node);
    }
  }
  target.replaceChildren(fragment);
}
