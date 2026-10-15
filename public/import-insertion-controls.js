import { articleInsertionTarget, planArticleInsertion } from './import-insertion.js';

export function installImportInsertion({ getBody, getSelection, isBusy, report, changed }) {
  const $ = id => document.getElementById(id);
  let draft = null, prepared = null;
  if (!$('import-destination').value) $('import-destination').value = 'replace';
  const mode = () => $('import-destination').value;
  const signature = () => JSON.stringify([draft, mode(), $('import-include-title').checked]);
  function purge() {
    prepared = null; $('import-insertion-preview').hidden = true;
    $('import-insertion-before').value = ''; $('import-insertion-after').value = ''; $('import-insertion-summary').textContent = '';
  }
  function refresh() {
    const inserting = mode() !== 'replace';
    if (prepared && (prepared.target.body !== getBody() || prepared.signature !== signature())) {
      purge(); $('import-insertion-status').textContent = 'The article or insertion choices changed. The converted import is kept. Preview the current location again; repeated text is never guessed.';
    }
    $('import-insertion-controls').hidden = !inserting;
    $('import-destination').disabled = isBusy();
    $('import-include-title').disabled = isBusy() || !draft?.title.trim();
    $('preview-insertion').disabled = isBusy() || !draft || !['selection', 'append'].includes(mode());
    $('preview-insertion').textContent = mode() === 'append' ? 'Preview insertion at article end' : 'Preview at article cursor or selection';
    $('apply-import').textContent = inserting ? 'Apply article insertion' : 'Import into editor';
  }
  function clear() { draft = null; purge(); $('import-insertion-status').textContent = ''; refresh(); }
  function setCandidate(value) { draft = value; purge(); $('import-insertion-status').textContent = 'Choose a location, then preview the exact insertion. Existing page fields and review notes will be kept.'; refresh(); }
  const ready = () => Boolean(prepared && prepared.target.body === getBody() && prepared.signature === signature());
  function getPlan() {
    if (!ready()) throw new Error('Preview the current insertion location before applying. The article and converted import are kept.');
    return planArticleInsertion(prepared.target, getBody(), draft, { includeTitle: $('import-include-title').checked });
  }
  function chooseMode(value) {
    if (!['replace', 'selection', 'append'].includes(value) || isBusy()) return;
    $('import-destination').value = value;
    purge(); $('import-insertion-status').textContent = 'Insertion choices changed. Preview its location before applying.'; refresh(); changed();
  }
  for (const id of ['import-destination', 'import-include-title']) $(id).addEventListener('change', () => {
    purge(); $('import-insertion-status').textContent = 'Insertion choices changed. Preview its location before applying.'; refresh(); changed();
  });
  $('preview-insertion').addEventListener('click', () => {
    if (isBusy() || !draft) return;
    purge();
    try {
      const body = getBody(), selection = mode() === 'append' ? { start: body.length, end: body.length } : mode() === 'selection' ? getSelection() : null;
      if (!selection) throw new Error('Choose an insertion destination.');
      const target = articleInsertionTarget(body, selection.start, selection.end);
      const plan = planArticleInsertion(target, body, draft, { includeTitle: $('import-include-title').checked });
      prepared = { target, signature: signature() };
      $('import-insertion-before').value = plan.before; $('import-insertion-after').value = plan.replacement;
      $('import-insertion-summary').textContent = !plan.changed ? 'This insertion already matches. Writing, approval, and history will be kept.' : (target.start === target.end ? 'Insert at' : 'Replace ' + plan.before.length.toLocaleString('en-US') + ' selected characters at') + ' article line ' + ((body.slice(0, target.start).match(/\n/g) || []).length + 1).toLocaleString('en-US') + '. Paragraph separation is included below. All source characters outside this selection are kept exactly.';
      $('import-insertion-preview').hidden = false;
      $('import-insertion-status').textContent = 'Insertion preview ready. Inspect the exact source before applying. The article is unchanged.';
    } catch (error) { $('import-insertion-status').textContent = error.message; report(error.message); }
    refresh(); changed();
  });
  refresh();
  return { clear, setCandidate, refresh, ready, getPlan, mode, chooseMode };
}
