import { reviewExport, exportReviewText, exportTitleHandling, EXPORT_REVIEW_LIMIT } from './export-review.js';
import { revealArticleSelection } from './editing.js';
import { focusWorkflowTarget } from './workflow-navigation.js';
import { downloadText } from './download.js';

export function installExportReview({ getDraft, isBusy = () => false, report, reveal = revealArticleSelection, move = target => focusWorkflowTarget(target, { bar: document.getElementById('workflow-steps') }), download = downloadText }) {
  const $ = id => document.getElementById(id), panel = $('export-format-review');
  // Older cached markup must still allow the core writing and export controls to load.
  if (!panel) return { update() {}, reset() {} };
  let signature = '', review = null, failure = '', rendered = '', textSignature = '';
  const active = () => ['word', 'html'].includes($('publishing-destination').value);
  const current = () => {
    const destination = $('publishing-destination').value, draft = getDraft();
    const options = { destination, includeTitle: destination === 'word' ? $('word-include-title').checked : $('html-include-title').checked };
    return { draft, options, key: JSON.stringify([destination, draft.title, draft.body, options.includeTitle]) };
  };
  function reset() {
    signature = ''; review = null; failure = ''; rendered = ''; textSignature = '';
    panel.hidden = true; $('export-format-findings').replaceChildren();
    $('export-format-status').textContent = ''; $('export-title-handling').textContent = ''; $('export-review-text').value = '';
    $('copy-export-review').disabled = true; $('download-export-review').disabled = true;
  }
  function update() {
    if (!active()) { reset(); return; }
    panel.hidden = false;
    const model = current(), busy = isBusy(), name = model.options.destination === 'word' ? 'Word' : 'HTML';
    $('export-format-summary').textContent = 'Before you export: inspect ' + name + ' formatting';
    $('export-title-handling').textContent = exportTitleHandling(model.options);
    if (model.key !== signature) {
      signature = model.key; failure = ''; review = null;
      try { review = reviewExport(model.draft, model.options); } catch (error) { failure = error.message || 'Could not inspect this article.'; }
    }
    $('export-format-status').textContent = busy ? 'Finish the current file operation before inspecting this export.' : failure || (review.totalFindings
      ? review.totalFindings + ' item(s) to inspect for ' + name + '.' + (review.truncated ? ' Showing the first ' + EXPORT_REVIEW_LIMIT + '; inspect the complete article.' : '')
      : 'No items found by these limited checks. Inspect the actual export and your source before sharing.');
    for (const id of ['copy-export-review', 'download-export-review']) $(id).disabled = busy || !review;
    if (!panel.open || busy || !review) {
      $('export-format-findings').replaceChildren(); rendered = '';
    } else if (rendered !== signature) {
      rendered = signature;
      $('export-format-findings').setAttribute('aria-label', name + ' export findings');
      $('export-format-findings').replaceChildren(...review.findings.map(item => {
        const li = document.createElement('li'), text = document.createElement('p'), button = document.createElement('button');
        text.textContent = 'Line ' + item.line + ': ' + item.message;
        button.type = 'button'; button.className = 'secondary'; button.textContent = 'Inspect line ' + item.line;
        const original = signature;
        button.addEventListener('click', () => {
          if (isBusy()) return;
          if (!active() || current().key !== original) { update(); report('The article or export options changed. Choose a current formatting finding.'); return; }
          const body = $('body'); body.setSelectionRange(item.start, item.end); move(body);
          try { reveal(body); } catch { /* The exact selection is retained without geometry. */ }
          report('Selected ' + name + ' formatting finding on line ' + item.line + '. Inspect or edit the article. Nothing changed automatically.');
        });
        li.append(text, button); return li;
      }));
    }
    if (panel.open && $('export-review-text-panel').open && !busy && review) {
      if (textSignature !== signature) { $('export-review-text').value = exportReviewText(model.draft, model.options); textSignature = signature; }
    } else { $('export-review-text').value = ''; textSignature = ''; }
  }
  function content() {
    if (!active() || isBusy()) throw new Error('Select Word or HTML and finish the current file operation first.');
    const model = current(); return { ...model, text: exportReviewText(model.draft, model.options) };
  }
  panel.addEventListener('toggle', update);
  $('export-review-text-panel').addEventListener('toggle', update);
  $('copy-export-review').addEventListener('click', async () => {
    try {
      const model = content(); await navigator.clipboard.writeText(model.text);
      report(current().key === model.key ? 'Formatting review copied. Its line numbers apply to the current article and export options. Private source and review notes are excluded.' : 'A review for the previous article or export options was copied. Use a current review before relying on its line numbers.');
    } catch (error) {
      update();
      if (active() && !isBusy() && review) {
        panel.open = true; $('export-review-text-panel').open = true; update(); move($('export-review-text'));
        report('Clipboard unavailable. Download the formatting review or select its current text and copy it manually.');
      } else report(error.message || 'Could not prepare the formatting review.');
    }
  });
  $('download-export-review').addEventListener('click', () => {
    try {
      const model = content(); download(model.text, 'drafttopage-' + model.options.destination + '-formatting-review.txt', 'text/plain;charset=utf-8');
      report('Formatting review download requested. Line numbers apply to the current article and export options. This separate report does not restore the workspace or certify the article.');
    } catch (error) { report(error.message); }
  });
  reset();
  return { update, reset };
}
