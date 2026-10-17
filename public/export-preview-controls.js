import { prepareExportPreview, renderExportPreview } from './export-preview.js';
import { createExportPreviewRenderer } from './export-preview-reuse.js';

export function installExportPreview({ getDraft, getWordPressOptions = () => ({}), isBusy = () => false }) {
  const $ = id => document.getElementById(id), panel = $('export-content-panel');
  if (!panel) return { update() {}, reset() {} };
  const labels = { wordpress: 'WordPress blocks', word: 'Word document', html: 'HTML fragment', markdown: 'Markdown file' };
  const preview = createExportPreviewRenderer($('export-content-preview'), renderExportPreview);
  let signature = '';
  function clear() {
    signature = ''; preview.clear();
    $('export-content-title').textContent = ''; $('export-content-limit').textContent = ''; $('export-content-status').textContent = '';
  }
  function update() {
    const destination = $('publishing-destination').value;
    panel.hidden = !Object.hasOwn(labels, destination);
    $('export-content-summary').textContent = panel.hidden ? 'Preview selected export content' : 'Preview selected export: ' + labels[destination];
    if (panel.hidden || !panel.open) { clear(); return; }
    if (isBusy()) { clear(); $('export-content-status').textContent = 'Finish the current file operation before previewing the export.'; return; }
    try {
      const draft = getDraft(), options = { destination,
        includeTitle: destination === 'word' ? $('word-include-title').checked : destination === 'html' ? $('html-include-title').checked : destination === 'markdown' ? $('export-format').value === 'document' : false,
        includeLinkedImages: destination === 'wordpress' ? getWordPressOptions().includeLinkedImages ?? false : false };
      const key = JSON.stringify([draft.title, draft.body, options]);
      if (key === signature) return;
      const model = prepareExportPreview(draft, options);
      preview.render(model);
      $('export-content-preview').setAttribute('aria-label', model.label);
      $('export-content-title').textContent = model.titleHandling; $('export-content-limit').textContent = model.limit;
      $('export-content-status').textContent = model.kind === 'source' ? 'Markdown source preview. Nothing is copied or downloaded by opening it.' : model.blocks.length + ' content block(s)' + (model.imageCount ? ', including ' + model.imageCount + ' linked image placeholder(s)' : '') + '. Previewing keeps your writing and export approval.';
      signature = key;
    } catch (error) { clear(); $('export-content-status').textContent = error.message || 'Could not prepare this export preview. Current writing is unchanged.'; }
  }
  panel.addEventListener('toggle', update);
  return { update, reset() { panel.open = false; clear(); } };
}
