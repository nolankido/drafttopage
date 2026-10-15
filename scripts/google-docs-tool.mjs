import { readFileSync } from 'node:fs';
import { guidedWorkspace } from './alpha-workspace.mjs';

export function googleDocsWorkspace(importPanel, compactBody) {
  const markers = ['<label for="import-file">', '<label for="import-format">', '<div id="import-html-options"', '<label class="check"><input id="import-first-row-headers"', '<label for="import-text">', '<button id="preview-import"', '</fieldset>'];
  const positions = markers.map(marker => importPanel.indexOf(marker));
  if (positions.some((position, index) => position < 0 || (index > 0 && position <= positions[index - 1]))) throw new Error('The copied-writing entry page needs its shared importer controls.');
  const [file, format, help, header, text, preview, end] = positions;
  const pasteHelp = '<div id="import-html-options"><p id="import-html-help" class="small">Use Ctrl+V or Command+V. Review the conversion before applying. Images become placeholders.</p><details><summary>Conversion details and a fictional example</summary><p class="small">Supported headings, emphasis, lists, links, and simple tables become editable article structure. Fonts and layout are dropped. A plain-text clipboard cannot recover missing formatting. The copied source stays in this tab for re-preview until cleared or applied.</p><button id="import-html-example" type="button" class="secondary">Preview a formatted example</button></details></div>';
  const pastePanel = (importPanel.slice(0, file) + importPanel.slice(text, preview) + pasteHelp + importPanel.slice(header, text) + importPanel.slice(preview, end) +
    '<details id="copied-import-alternatives"><summary>Use a Word or HTML file, or choose another source format</summary>' + importPanel.slice(file, format) + importPanel.slice(format, help) + '</details>' + importPanel.slice(end))
    .replace('<details id="import-panel" class="import-panel">', '<details id="import-panel" class="import-panel" open>')
    .replace('<summary>Import an article or drafting result</summary>', '<summary>1. Paste copied writing</summary>')
    .replace(/<p class="small">Open a Word \.docx, bring Markdown or article JSON, or paste a formatted selection\.[\s\S]*?<\/p>/, '')
    .replace('<div id="import-html-options" hidden>', '<div id="import-html-options">')
    .replace('<option value="html">', '<option value="html" selected>')
    .replace('Or paste writing or article source', 'Paste copied writing here')
    .replace('id="import-text" rows="5"', 'id="import-text" rows="3" placeholder="Copy your selection, then paste here with Ctrl+V or Command+V."')
    .replace('Preview selected Word file or pasted article', 'Preview again or convert typed source')
    .replace('id="import-preview-heading"', 'id="import-preview-heading" tabindex="-1"');
  return readFileSync(new URL('./google-docs-intro.html.inc', import.meta.url), 'utf8') + pastePanel +
    guidedWorkspace(compactBody.replace(importPanel, '').replace('<h2 id="article-heading">1. Paste or edit your draft</h2>', '<h2 id="article-heading">Edit your converted article</h2>')) +
    '<details id="desk-more" class="desk-more"><summary>Use a file, plain text, source notes, or more tools</summary><div class="desk-start"><button id="start-draft" type="button" class="secondary">Paste text or Markdown</button><button id="start-formatted-import" type="button" class="secondary">Open formatted import</button><button id="start-import" type="button" class="secondary">Open article import</button><button id="start-notes" type="button" class="secondary">Start with notes</button><button id="toggle-focus" type="button" class="secondary" aria-pressed="false">Focus on article</button><button id="start-checks" type="button" class="secondary">Check draft</button></div></details>' + readFileSync(new URL('./google-docs-guide.html.inc', import.meta.url), 'utf8');
}
