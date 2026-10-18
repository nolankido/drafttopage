import { readFileSync } from 'node:fs';
import { workflowNavigation } from './workflow-navigation.mjs';

export function googleDocsWorkspace(importPanel, compactBody) {
  const markers = ['<label for="import-file">', '<label for="import-format">', '<div id="import-html-options"', '<div id="import-source-context"', '<label class="check"><input id="import-first-row-headers"', '<label for="import-text">', '<button id="preview-import"', '</fieldset>'];
  const positions = markers.map(marker => importPanel.indexOf(marker));
  if (positions.some((position, index) => position < 0 || (index > 0 && position <= positions[index - 1]))) throw new Error('The copied-writing entry page needs its shared importer controls.');
  const [file, format, help, context, header, text, preview, end] = positions;
  const importIntro = importPanel.match(/<p class="small">[\s\S]*?<\/p>/)?.[0];
  const fileStatus = importPanel.match(/<p id="import-file-status"[\s\S]*?<\/p>/)?.[0];
  if (!importIntro || !fileStatus) throw new Error('The copied-writing entry page needs its shared explanation and source status.');
  const pastePanel = (importPanel.slice(0, file).replace(importIntro, '') + importPanel.slice(text, preview) +
    '<p id="import-entry-help" class="small">Copy a selection in Google Docs and paste it here. Only that selection is read; nothing is uploaded.</p>' + fileStatus +
    '<details id="copied-import-help" class="import-entry-details"><summary>Paste help and conversion limits</summary>' + importIntro + importPanel.slice(help, context) + '</details>' +
    '<details id="import-advanced-options" class="import-advanced-options"><summary>Table headers and relative links</summary>' + importPanel.slice(context, header) + importPanel.slice(header, text) + '</details>' + importPanel.slice(preview, end) +
    '<details id="copied-import-alternatives"><summary>Use a Word or HTML file, or choose another source format</summary>' + importPanel.slice(file, format).replace(fileStatus, '') + importPanel.slice(format, help) + '</details>' + importPanel.slice(end))
    .replace('<details id="import-panel" class="import-panel">', '<details id="import-panel" class="import-panel" open>')
    .replace('<summary>Import an article or drafting result</summary>', '<summary>1. Paste copied writing</summary>')
    .replace('<div id="import-html-options" hidden>', '<div id="import-html-options">')
    .replace('<option value="html">', '<option value="html" selected>')
    .replace('Or paste writing or article source', 'Paste copied writing here')
    .replace('id="import-text" rows="5"', 'id="import-text" rows="3" placeholder="Copy your selection, then paste here with Ctrl+V or Command+V."')
    .replace('aria-describedby="import-file-help import-html-help import-paste-status"', 'aria-describedby="import-entry-help import-paste-status"')
    .replace('Preview selected Word file or pasted article', 'Preview this writing')
    .replace('id="import-preview-heading"', 'id="import-preview-heading" tabindex="-1"');
  const navigation = workflowNavigation('copied');
  const layoutStart = navigation.indexOf('<details id="workspace-layout-options"');
  const intro = readFileSync(new URL('./google-docs-intro.html.inc', import.meta.url), 'utf8');
  if (layoutStart < 0 || !intro.includes('<!--ENTRY_IMPORT-->') || !intro.includes('<!--ENTRY_LAYOUT-->')) throw new Error('The copied-writing entry page needs its input and layout slots.');
  return intro.replace('<!--WORKFLOW_NAVIGATION-->', navigation.slice(0, layoutStart))
    .replace('<!--ENTRY_IMPORT-->', pastePanel)
    .replace('<!--ENTRY_LAYOUT-->', navigation.slice(layoutStart)) +
    compactBody.replace(importPanel, '').replace('<h2 id="article-heading">1. Paste or edit your draft</h2>', '<h2 id="article-heading">Edit your converted article</h2>') +
    readFileSync(new URL('./google-docs-guide.html.inc', import.meta.url), 'utf8');
}
