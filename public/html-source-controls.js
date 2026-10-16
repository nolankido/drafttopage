import { articleIssues } from './authoring.js';
import { createHTMLSource } from './html-export.js';
import { downloadText } from './download.js';
import { suggestFilename } from './preview.js';
import { createCopyActions } from './copy-actions.js';

export function installHTMLSource({ getDraft, approved, changed, report, isBusy = () => false, copyActions = null }) {
  const $ = id => document.getElementById(id);
  const copies = copyActions || createCopyActions({ snapshot: () => JSON.stringify([getDraft(), $('publishing-destination').value, $('reviewed').checked, $('html-include-title').checked]), report, changed: update });
  const options = () => ({ includeTitle: $('html-include-title').checked });
  const active = () => $('publishing-destination').value === 'html';
  function update() {
    const selected = active(), draft = getDraft(), busy = isBusy();
    $('html-source-handoff').hidden = !selected;
    const issues = articleIssues(draft, options().includeTitle ? 'html' : 'body');
    const ready = selected && !busy && $('reviewed').checked && !Object.keys(issues).length;
    $('copy-html-source').disabled = !ready || copies.state().pending;
    $('download-html-source').disabled = !ready;
    let source = '', failure = '';
    if (ready && $('html-source-code-panel').open) {
      try { source = createHTMLSource(draft, options()); }
      catch (error) { failure = error.message; }
    }
    $('html-source-preview').value = source;
    $('html-source-readiness').textContent = !selected ? '' : busy ? 'Finish the current file operation before exporting HTML.' : Object.keys(issues).length ? Object.values(issues)[0] : failure ? failure : ready ? 'HTML source is ready. Copy the code or download the fragment, then inspect it in your destination.' : 'Read the preview, then check the review box to prepare HTML source. Page metadata is optional.';
  }
  function source() {
    if (!active() || isBusy()) throw new Error('Select HTML source and finish any file operation first.');
    approved();
    return createHTMLSource(getDraft(), options());
  }
  $('html-include-title').addEventListener('change', changed);
  $('html-source-code-panel').addEventListener('toggle', update);
  $('copy-html-source').addEventListener('click', async () => {
    if (isBusy()) return;
    await copies.run({ destination: 'html', label: 'HTML source', write: () => navigator.clipboard.writeText(source()), success: 'HTML source copied as code. Paste into a field that accepts HTML source and inspect the result. Private source and review notes are excluded. Nothing was published.', fallback: 'HTML source copy unavailable. Download the fragment or select the approved code below and copy it manually.' });
  });
  $('download-html-source').addEventListener('click', () => {
    try {
      const content = source();
      downloadText(content, suggestFilename(getDraft().title) + '-article.html', 'text/html;charset=utf-8');
      report('HTML fragment download requested. Open it in a text editor to copy its source. Use Download reading page for a complete standalone document. Private source and review notes are excluded. Nothing was published.');
    } catch (error) { report(error.message); }
  });
  return { update, reset: () => { $('html-include-title').checked = false; $('html-source-preview').value = ''; } };
}
