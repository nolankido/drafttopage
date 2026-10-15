import { revealDetails } from './disclosure.js';
import { createSourceReviewNote, parseSourceReviewNote, locateReviewedPassage, planSourceReviewNote } from './source-review.js';
import { revealArticleSelection } from './editing.js';
import { installPasteGuard } from './paste-guard.js';

export function installSourceReview({ getWorkspace, applyNotes, showSource = () => {}, isBusy = () => false, workChanged, report, reveal = revealArticleSelection, confirmAction = message => confirm(message) }) {
  const $ = id => document.getElementById(id);
  const ids = ['review-passage', 'review-source-reference', 'review-evidence', 'review-decision'];
  let baseline = null, editing = null, rendered = null;
  const signature = () => { const value = getWorkspace(); return JSON.stringify([value.draft.body, value.source.notes]); };
  const hasWork = () => ids.slice(0, 3).some(id => $(id).value.length) || $('review-decision').value !== 'Needs checking' || editing !== null;
  const review = () => ({ passage: $('review-passage').value, source: $('review-source-reference').value, evidence: $('review-evidence').value, decision: $('review-decision').value });
  for (const [id, limit] of [['review-passage', 240], ['review-source-reference', 160], ['review-evidence', 240]]) installPasteGuard({ element: $(id), limit, label: 'This review field', report: message => { if (message) report(message); } });
  function clear() {
    for (const id of ids.slice(0, 3)) $(id).value = '';
    $('review-decision').value = 'Needs checking'; baseline = null; editing = null;
    refresh(); workChanged();
  }
  function ready() {
    if (baseline !== null && baseline !== signature()) throw new Error('The article or source notes changed. Compare the current writing, then choose Recheck against current writing before saving.');
    const note = createSourceReviewNote(review());
    const location = locateReviewedPassage(getWorkspace().draft.body, review().passage);
    if (location.state === 'missing') throw new Error('This exact passage is absent from the current article. Select or enter its current text.');
    const notes = planSourceReviewNote(getWorkspace().draft.questions, note, editing);
    return { note, location, notes };
  }
  function renderRecords() {
    const { draft } = getWorkspace(), key = JSON.stringify([draft.body, draft.questions]);
    if (key !== rendered) {
      rendered = key;
      const records = draft.questions.flatMap((note, index) => { const value = parseSourceReviewNote(note); return value ? [{ note, index, value }] : []; });
      $('source-review-count').textContent = records.length + ' saved passage review(s); ' + draft.questions.length + ' / 12 total private notes. These are past review records, not a verified-article score.';
      $('source-review-records').replaceChildren(...records.map(({ note, index, value }) => {
        const li = document.createElement('li'), title = document.createElement('p'), passage = document.createElement('blockquote'), source = document.createElement('p'), evidence = document.createElement('p'), position = document.createElement('p');
        title.textContent = 'Note ' + (index + 1) + ': ' + value.decision; title.className = 'source-review-decision';
        passage.textContent = value.passage; source.textContent = 'Source: ' + (value.source || 'Not recorded'); evidence.textContent = 'Evidence or explanation: ' + (value.evidence || 'Not recorded');
        const location = locateReviewedPassage(draft.body, value.passage);
        position.className = 'small'; position.textContent = location.state === 'unique' ? 'Exact passage currently on line ' + location.line + '. Recheck its support after edits.' : location.state === 'multiple' ? 'Exact passage occurs more than once. Choose the intended occurrence in the editor.' : 'Passage no longer matches the article. Review its current wording.';
        const jump = document.createElement('button'); jump.type = 'button'; jump.className = 'secondary'; jump.textContent = 'Select passage for note ' + (index + 1); jump.dataset.reviewJump = location.state;
        jump.addEventListener('click', () => {
          if (isBusy()) return;
          const current = getWorkspace().draft;
          if (current.questions[index] !== note) { refresh(); report('This review note changed. Choose its current record.'); return; }
          const found = locateReviewedPassage(current.body, value.passage);
          if (found.state !== 'unique') { refresh(); report('The passage is missing or repeated. Select its intended current wording yourself.'); return; }
          const body = $('body'); body.focus(); body.setSelectionRange(found.start, found.end);
          try { reveal(body); } catch { /* The exact selection remains usable. */ }
          report('Selected the current passage for review note ' + (index + 1) + '. Text matching does not verify the claim.');
        });
        const edit = document.createElement('button'); edit.type = 'button'; edit.className = 'secondary'; edit.textContent = 'Edit review note ' + (index + 1);
        edit.addEventListener('click', () => {
          if (isBusy()) return;
          if (getWorkspace().draft.questions[index] !== note) { refresh(); report('This review note changed. Choose its current record.'); return; }
          if (hasWork() && !confirmAction('Discard the unsaved passage review and edit this saved note? Saved writing is kept.')) return;
          $('review-passage').value = value.passage; $('review-source-reference').value = value.source; $('review-evidence').value = value.evidence; $('review-decision').value = value.decision;
          editing = { index, original: note }; baseline = signature(); refresh(); workChanged(); $('review-passage').focus();
          report('Review the saved decision against current writing. Nothing changes until you save.');
        });
        li.append(title, passage, source, evidence, position, jump, edit); return li;
      }));
    }
    for (const button of $('source-review-records').querySelectorAll('button')) button.disabled = isBusy() || Boolean(button.dataset.reviewJump && button.dataset.reviewJump !== 'unique');
  }
  function refresh() {
    const busy = isBusy(), pending = hasWork();
    for (const id of ids) $(id).disabled = busy;
    $('pin-review-passage').disabled = busy;
    $('start-source-review').disabled = busy;
    $('edit-review-source').disabled = busy;
    $('return-source-review').disabled = busy;
    $('pin-review-evidence').disabled = busy || !getWorkspace().source.notes.length;
    $('cancel-source-review').disabled = busy || !pending;
    $('refresh-source-review').disabled = busy || !pending || baseline === null || baseline === signature();
    $('review-source-notes').value = $('source-review-panel').open ? getWorkspace().source.notes : '';
    $('save-source-review').textContent = editing ? 'Update private review note' : 'Save private review note';
    let valid = false, message = 'Select a short article passage, or enter its exact text. Save your judgment as a private review note.';
    if (pending) {
      try { const value = ready(); valid = true; message = value.note.length + ' / 500 note characters. ' + (value.location.state === 'multiple' ? 'Passage is repeated; navigation will stay disabled.' : 'Passage matches the current article.') + ' Save explicitly to keep this review in backups.'; }
      catch (error) { message = error.message; }
    }
    $('source-review-status').textContent = message;
    $('save-source-review').disabled = busy || !valid;
    renderRecords();
  }
  for (const id of ids) $(id).addEventListener(id === 'review-decision' ? 'change' : 'input', () => {
    if (baseline === null) baseline = signature();
    refresh(); workChanged();
  });
  $('source-review-panel').addEventListener('toggle', refresh);
  $('edit-review-source').addEventListener('click', () => { if (!isBusy()) showSource(); });
  $('return-source-review').addEventListener('click', () => { revealDetails($('source-review-panel')); $('review-passage').focus(); });
  $('pin-review-passage').addEventListener('click', () => {
    if (isBusy()) return;
    const body = $('body'), passage = body.value.slice(body.selectionStart, body.selectionEnd);
    if (!passage.trim() || passage.length > 240) { report('Select 1 to 240 characters in the article body first. Nothing was cut off or changed.'); return; }
    if (hasWork() && !confirmAction('Discard the unsaved passage review and start a new one from this selection? Saved notes are kept.')) return;
    clear(); $('review-passage').value = passage; baseline = signature(); revealDetails($('source-review-panel')); refresh(); workChanged(); $('review-source-reference').focus();
    report('Article passage pinned. Compare it with a source, record your evidence, and save a private review note.');
  });
  $('pin-review-evidence').addEventListener('click', () => {
    if (isBusy()) return;
    const source = $('review-source-notes'), evidence = source.value.slice(source.selectionStart, source.selectionEnd);
    if (!evidence.trim() || evidence.length > 240) { report('Select 1 to 240 characters in the comparison source notes first. Nothing was cut off or changed.'); return; }
    if ($('review-evidence').value && !confirmAction('Replace the unsaved evidence field with this source selection? Saved notes are kept.')) return;
    $('review-evidence').value = evidence;
    if (baseline === null) baseline = signature();
    refresh(); workChanged(); $('review-source-reference').focus();
  });
  $('refresh-source-review').addEventListener('click', () => {
    if (isBusy()) return;
    baseline = signature(); refresh(); report('Review preparation now uses current article and source notes. Check the evidence and decision yourself before saving.');
  });
  $('cancel-source-review').addEventListener('click', () => {
    if (isBusy()) return;
    clear(); report('Unsaved passage review discarded. Saved writing and approval are kept.');
  });
  $('save-source-review').addEventListener('click', () => {
    if (isBusy()) return;
    try {
      const { notes } = ready();
      if (JSON.stringify(notes) === JSON.stringify(getWorkspace().draft.questions)) { report('This note is unchanged. Writing and approval are kept.'); return; }
      applyNotes(notes, editing ? 'Before updating a passage review' : 'Before adding a passage review');
      clear(); $('pin-review-passage').focus(); report('Private passage review saved. Previous writing is in Revisions in this tab. Approval was cleared. Download a backup or update the collection entry to keep it.');
    } catch (error) { refresh(); report(error.message); }
  });
  refresh();
  return { refresh, clear, hasWork };
}
