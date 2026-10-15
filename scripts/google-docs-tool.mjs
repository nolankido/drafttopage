import { readFileSync } from 'node:fs';
import { workflowNavigation } from './workflow-navigation.mjs';

export function googleDocsWorkspace(importPanel, compactBody) {
  const markers = ['<label for="import-file">', '<label for="import-format">', '<div id="import-html-options"', '<label class="check"><input id="import-first-row-headers"', '<label for="import-text">', '<button id="preview-import"', '</fieldset>'];
  const positions = markers.map(marker => importPanel.indexOf(marker));
  if (positions.some((position, index) => position < 0 || (index > 0 && position <= positions[index - 1]))) throw new Error('The copied-writing entry page needs its shared importer controls.');
  const [file, format, help, header, text, preview, end] = positions;
  const pastePanel = (importPanel.slice(0, file) + importPanel.slice(help, header) + importPanel.slice(text, preview) + importPanel.slice(header, text) + importPanel.slice(preview, end) +
    '<details id="copied-import-alternatives"><summary>Use a Word or HTML file, or choose another source format</summary>' + importPanel.slice(file, format) + importPanel.slice(format, help) + '</details>' + importPanel.slice(end))
    .replace('<details id="import-panel" class="import-panel">', '<details id="import-panel" class="import-panel" open>')
    .replace('<summary>Import an article or drafting result</summary>', '<summary>1. Paste copied writing</summary>')
    .replace('<div id="import-html-options" hidden>', '<div id="import-html-options">')
    .replace('<option value="html">', '<option value="html" selected>')
    .replace('Or paste writing or article source', 'Paste copied writing here')
    .replace('id="import-text" rows="5"', 'id="import-text" rows="3" placeholder="Copy your selection, then paste here with Ctrl+V or Command+V."')
    .replace('Preview selected Word file or pasted article', 'Preview again or convert typed source')
    .replace('id="import-preview-heading"', 'id="import-preview-heading" tabindex="-1"');
  return readFileSync(new URL('./google-docs-intro.html.inc', import.meta.url), 'utf8').replace('<!--WORKFLOW_NAVIGATION-->', workflowNavigation('copied')) + pastePanel +
    compactBody.replace(importPanel, '').replace('<h2 id="article-heading">1. Paste or edit your draft</h2>', '<h2 id="article-heading">Edit your converted article</h2>') +
    readFileSync(new URL('./google-docs-guide.html.inc', import.meta.url), 'utf8');
}
