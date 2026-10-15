import { createWordDocument, wordDocumentIssues, WORD_MIME } from './word-export.js';
import { suggestFilename } from './preview.js';
import { downloadText } from './download.js';

export function installWordDocument({ getDraft, approved, changed, report, isBusy = () => false }) {
  const $ = id => document.getElementById(id);
  function update() {
    const active = $('publishing-destination').value === 'word';
    $('word-handoff').hidden = !active;
    $('download-word').disabled = true;
    if (!active) { $('word-readiness').textContent = ''; return; }
    const issues = wordDocumentIssues(getDraft(), { includeTitle: $('word-include-title').checked });
    const ready = !Object.keys(issues).length && !isBusy();
    $('download-word').disabled = !ready || !$('reviewed').checked;
    $('word-readiness').textContent = !ready ? (Object.values(issues)[0] || 'Wait for the current file operation to finish.') : $('reviewed').checked ? 'Ready to download an editable Word document. Open and inspect it before sharing.' : 'Read the preview, then check the review box to download. Page metadata is optional.';
  }
  $('word-include-title').addEventListener('change', changed);
  $('download-word').addEventListener('click', () => {
    if ($('publishing-destination').value !== 'word' || isBusy()) return;
    try {
      approved();
      const draft = getDraft();
      const bytes = createWordDocument(draft, { includeTitle: $('word-include-title').checked });
      downloadText(bytes, suggestFilename(draft.title) + '.docx', WORD_MIME);
      report('Word document download requested. Open the .docx file in Word or another compatible editor and check its layout before sharing. Private source and review notes are excluded. Nothing was uploaded or published.');
    } catch (error) { report(error.message); }
  });
  return { update, reset: () => { $('word-include-title').checked = false; update(); } };
}
