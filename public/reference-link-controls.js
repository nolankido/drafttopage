import { hasReferenceLinks, planReferenceLinks } from './reference-links.js';
import { renderPreview } from './preview.js';

export function installReferenceLinks({ getBody, getTitle = () => '', apply, isBusy = () => false, hasPendingImport = () => false, onApplied = () => {}, report }) {
  const $ = id => document.getElementById(id);
  let plan = null, snapshot = null;
  const blocked = () => isBusy() || hasPendingImport();
  function purge() {
    plan = null; $('reference-ack').checked = false; $('reference-result').hidden = true;
    $('reference-after').value = ''; $('reference-reading-preview').replaceChildren();
    $('reference-examples').replaceChildren(); $('reference-findings').replaceChildren();
    $('reference-summary').textContent = ''; $('reference-apply').disabled = true;
  }
  function refresh() {
    const body = getBody(), signature = JSON.stringify([body, getTitle()]);
    if (snapshot !== signature) {
      const stale = Boolean(plan); snapshot = signature; purge();
      if (stale) $('reference-status').textContent = 'The article changed. Preview reference conversion again.';
    }
    $('reference-links-panel').hidden = !hasReferenceLinks(body);
    const busy = blocked();
    $('reference-prepare').disabled = busy;
    $('reference-remove-definitions').disabled = busy;
    $('reference-ack').disabled = busy || !plan?.changed;
    $('reference-apply').disabled = busy || !plan?.changed || !$('reference-ack').checked;
    $('reference-discard').disabled = busy || !plan;
    $('reference-blocked').textContent = busy ? isBusy() ? 'Finish the current file operation first.' : 'Apply or clear the pending import before converting the current article.' : '';
  }
  $('reference-prepare').addEventListener('click', () => {
    if (blocked()) return;
    purge();
    try {
      plan = planReferenceLinks(getBody(), { removeDefinitions: $('reference-remove-definitions').checked });
      snapshot = JSON.stringify([getBody(), getTitle()]);
      $('reference-summary').textContent = plan.converted + ' reference link(s) expanded; ' + plan.removed + ' definition line(s) removed; ' + plan.keptDefinitions + ' definition candidate(s) kept. ' + plan.unresolvedCount + ' item(s) need inspection.';
      $('reference-after').value = plan.body;
      renderPreview($('reference-reading-preview'), getTitle(), plan.body);
      $('reference-examples').replaceChildren(...plan.examples.map(example => {
        const item = document.createElement('li'), label = document.createElement('p'), before = document.createElement('pre'), after = document.createElement('pre');
        label.textContent = 'Line ' + example.line; before.textContent = 'Before: ' + example.before; after.textContent = 'After: ' + example.after;
        item.append(label, before, after); return item;
      }));
      $('reference-findings').replaceChildren(...plan.findings.map(finding => {
        const item = document.createElement('li'); item.textContent = 'Line ' + finding.line + ': ' + finding.message; return item;
      }));
      $('reference-result').hidden = false;
      $('reference-status').textContent = plan.changed ? 'Conversion preview ready. Current writing and export approval are unchanged. Compare the complete result before applying.' : 'No supported references were converted. Your article and approval are unchanged. Inspect the limits and any findings below.';
      report($('reference-status').textContent);
    } catch (error) { purge(); $('reference-status').textContent = error.message; report(error.message); }
    refresh();
  });
  $('reference-remove-definitions').addEventListener('change', () => { purge(); $('reference-status').textContent = 'The definition choice changed. Preview again before applying.'; refresh(); });
  $('reference-ack').addEventListener('change', refresh);
  $('reference-apply').addEventListener('click', () => {
    if (blocked() || !plan?.changed || !$('reference-ack').checked) return;
    if (getBody() !== plan.original || plan.removeDefinitions !== $('reference-remove-definitions').checked) { purge(); refresh(); report('The article or definition choice changed. Preview again before applying.'); return; }
    const prepared = plan;
    try {
      apply(prepared.body, 'Before reference-link conversion');
      purge(); refresh(); onApplied();
      report('Expanded ' + prepared.converted + ' reference link(s) and removed ' + prepared.removed + ' definition line(s). The previous article is in Revisions in this tab. Review approval was cleared. Inspect remaining literal references before exporting.');
    } catch (error) { $('reference-status').textContent = error.message; report(error.message); }
  });
  $('reference-discard').addEventListener('click', () => { if (blocked()) return; purge(); refresh(); $('reference-status').textContent = 'Conversion preview discarded. Your article and approval are kept.'; report($('reference-status').textContent); });
  function clear() { purge(); snapshot = null; $('reference-remove-definitions').checked = true; $('reference-status').textContent = 'Preview first, then compare and apply deliberately.'; }
  refresh();
  return { refresh, clear };
}
