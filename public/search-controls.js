import { revealDetails } from './disclosure.js';
import { findArticleMatches, navigateArticleMatch, replaceArticleMatch, previewArticleReplacements } from './article-search.js';
import { revealArticleSelection } from './editing.js';

export function installArticleSearch({ apply, isBusy, report, reveal = revealArticleSelection }) {
  const $ = id => document.getElementById(id), body = $('body');
  let matches = [], searchKey = null, active = -1, candidate = null;
  const options = () => ({ matchCase: $('find-case').checked });
  const signature = () => JSON.stringify([body.value, $('find-text').value, $('replace-text').value, $('find-case').checked]);
  const selectionMatches = () => active >= 0 && matches[active]?.start === body.selectionStart && matches[active]?.end === body.selectionEnd;
  function clearPreview() {
    candidate = null; $('replace-preview').hidden = true; $('apply-replace-all').disabled = true;
    $('replace-summary').textContent = ''; $('replace-examples').replaceChildren();
  }
  function status() {
    const message = !$('find-text').value.length ? 'Enter literal text to find in the article.' : !matches.length ? 'No matches in the article.' : selectionMatches() ? 'Match ' + (active + 1) + ' of ' + matches.length + ' selected in the article.' : matches.length + ' match(es). Choose Next or Previous to select one.';
    if ($('find-status').textContent !== message) $('find-status').textContent = message;
  }
  function refresh() {
    try {
      const key = JSON.stringify([body.value, $('find-text').value, $('find-case').checked]);
      if (key !== searchKey) {
        matches = findArticleMatches(body.value, $('find-text').value, options());
        searchKey = key; active = -1; clearPreview();
      }
      if (candidate && candidate.signature !== signature()) clearPreview();
      const busy = isBusy();
      for (const id of ['find-next', 'find-previous', 'preview-replace-all']) $(id).disabled = busy || matches.length === 0;
      $('replace-match').disabled = busy || !selectionMatches();
      $('apply-replace-all').disabled = busy || !candidate?.plan.changedCount;
      status();
    } catch (error) {
      matches = []; active = -1; searchKey = null; clearPreview();
      for (const id of ['find-next', 'find-previous', 'replace-match', 'preview-replace-all']) $(id).disabled = true;
      $('find-status').textContent = error.message;
    }
  }
  function navigate(direction) {
    refresh(); if (isBusy() || !matches.length) return;
    active = navigateArticleMatch(matches, body.selectionStart, body.selectionEnd, direction);
    const match = matches[active]; body.focus(); body.setSelectionRange(match.start, match.end);
    try { reveal(body); } catch { /* Keep the exact selection if layout measurement is unavailable. */ }
    refresh(); report('Selected match ' + (active + 1) + ' of ' + matches.length + '. Searching kept your writing and review approval.');
  }
  $('start-find').addEventListener('click', () => { revealDetails($('find-panel')); $('find-text').focus(); refresh(); });
  $('find-panel').addEventListener('toggle', refresh);
  $('find-text').addEventListener('input', refresh);
  $('find-case').addEventListener('change', refresh);
  $('replace-text').addEventListener('input', refresh);
  for (const event of ['select', 'click', 'keyup']) body.addEventListener(event, refresh);
  $('find-text').addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.isComposing) { event.preventDefault(); navigate(event.shiftKey ? -1 : 1); }
  });
  $('find-next').addEventListener('click', () => navigate(1));
  $('find-previous').addEventListener('click', () => navigate(-1));
  $('replace-match').addEventListener('click', () => {
    refresh(); if (isBusy() || !selectionMatches()) return;
    try {
      const plan = replaceArticleMatch(body.value, $('find-text').value, $('replace-text').value, active, options());
      if (!plan.changedCount) { report('The replacement matches this text already. Writing and approval were kept.'); return; }
      apply(plan, 'Before replacing a match'); refresh();
      report('Selected match replaced locally. Previous writing is in Revisions in this tab. Review approval was cleared.');
    } catch (error) { report(error.message); }
  });
  $('preview-replace-all').addEventListener('click', () => {
    refresh(); if (isBusy() || !matches.length) return;
    try {
      const plan = previewArticleReplacements(body.value, $('find-text').value, $('replace-text').value, options());
      candidate = { plan, signature: signature() };
      $('replace-summary').textContent = plan.changedCount ? 'Will change ' + plan.changedCount + ' of ' + plan.matchCount + ' matches. Result: ' + plan.body.length.toLocaleString() + ' / 60,000 characters. Showing the first ' + plan.examples.length + ' changed passage(s).' : 'All matches already equal the replacement. No writing would change.';
      $('replace-examples').replaceChildren(...plan.examples.map(example => {
        const li = document.createElement('li');
        for (const [label, text] of [['Before', example.before], ['After', example.after]]) {
          const heading = document.createElement('strong'), content = document.createElement('pre'); heading.textContent = label; content.textContent = text; li.append(heading, content);
        }
        return li;
      }));
      $('replace-preview').hidden = false; refresh();
      report('Replacement preview ready. Current writing and approval are unchanged. Inspect the passages before applying.');
    } catch (error) { clearPreview(); report(error.message); }
  });
  $('apply-replace-all').addEventListener('click', () => {
    refresh(); if (isBusy() || !candidate?.plan.changedCount || candidate.signature !== signature()) return;
    const planned = candidate;
    if (!confirm('Replace ' + planned.plan.changedCount + ' matching passage(s) in the article body? This can also change Markdown, code, and link addresses. Previous writing will be kept as a checkpoint and review approval will be cleared.')) {
      report('Replace all cancelled. Current writing and approval are unchanged.'); return;
    }
    try {
      apply({ ...planned.plan, selectionStart: 0, selectionEnd: 0 }, 'Before replacing all matches'); clearPreview(); refresh();
      report('Replaced ' + planned.plan.changedCount + ' matching passage(s) locally. Previous writing is in Revisions in this tab. Review approval was cleared.');
    } catch (error) { report(error.message); }
  });
  $('cancel-replace-all').addEventListener('click', () => { clearPreview(); refresh(); report('Replacement preview cleared. Current writing is unchanged.'); });
  refresh();
  return { refresh, clear() { $('find-text').value = ''; $('replace-text').value = ''; $('find-case').checked = false; searchKey = null; active = -1; clearPreview(); refresh(); } };
}
