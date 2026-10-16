import { wordCommentNotes, wordCommentsReport } from './word-comment-report.js';
import { validateDraft } from './workspace.js';
import { downloadText } from './download.js';

export function installWordComments({ getSource, getCandidate, getMode, isBusy, setBusy, changed, report,
  prepare = async bytes => (await import('./word-comments.js')).prepareWordComments(bytes), download = downloadText }) {
  const $ = id => document.getElementById(id), panel = $('word-comment-handoff');
  if (!panel) return null;
  let model = null, source = null, candidate = null, request = 0;
  const current = () => model && source === getSource() && candidate === getCandidate();
  const notes = () => current() ? wordCommentNotes(model) : null;
  const canInclude = () => notes() && getMode() === 'replace' && candidate.draft.questions.length + notes().length <= 12;
  function clear() {
    request++; model = null; source = null; candidate = null;
    panel.hidden = true; $('word-comment-review').hidden = true;
    $('word-comment-list').replaceChildren(); $('word-comment-status').textContent = ''; $('word-comment-guidance').textContent = '';
    $('word-comment-notes-status').textContent = ''; $('word-comment-details').open = false;
    $('word-comment-private-ok').checked = false; $('word-comments-include').checked = false;
    $('download-word-comments').disabled = true; $('word-comments-include').disabled = true;
  }
  function update() {
    panel.hidden = !getSource() || !getCandidate();
    const busy = isBusy(), eligible = Boolean(canInclude());
    if (!eligible && $('word-comments-include').checked) { $('word-comments-include').checked = false; changed(); }
    $('prepare-word-comments').disabled = busy || panel.hidden;
    $('discard-word-comments').disabled = busy;
    $('word-comment-private-ok').disabled = busy || !current() || !model.comments.length;
    $('download-word-comments').disabled = busy || !current() || !model.comments.length || !$('word-comment-private-ok').checked;
    $('word-comments-include').disabled = busy || !eligible;
    $('word-comment-notes-status').textContent = !current() ? '' : getMode() !== 'replace'
      ? 'Insertion keeps current review notes. Download the separate comment report before applying.'
      : eligible ? model.comments.length + ($('word-comments-include').checked ? ' comment(s) will be added' : ' comment(s) can be added') + ' as private review notes with article replacement. They are excluded from article exports.'
      : 'These comments exceed the review-note limits or contain no text. Download the separate report; comment text will not be truncated to fit.';
  }
  $('prepare-word-comments').addEventListener('click', async () => {
    if (isBusy() || !getSource() || !getCandidate()) return;
    clear(); changed(); source = getSource(); candidate = getCandidate(); const thisRequest = ++request, file = source, preview = candidate;
    setBusy(true); $('word-comment-status').textContent = 'Reading comment text locally. Current writing is unchanged.';
    try {
      const result = await prepare(file.bytes);
      if (thisRequest !== request || file !== getSource() || preview !== getCandidate()) return;
      model = result;
      $('word-comment-list').replaceChildren(...model.comments.map(comment => {
        const item = document.createElement('li'), label = document.createElement('strong'), text = document.createElement('p');
        label.textContent = 'Word comment ID ' + comment.id; text.textContent = comment.text; item.append(label, text); return item;
      }));
      $('word-comment-guidance').textContent = model.guidance;
      $('word-comment-review').hidden = false;
      $('word-comment-status').textContent = model.comments.length ? model.comments.length + ' comment(s) recovered for private review. Download before applying or clearing the import, or explicitly include eligible comments as review notes.' : 'No standard Word comments were found. Other annotation formats are not recovered; keep the original file.';
      report($('word-comment-status').textContent);
    } catch (error) {
      if (thisRequest === request) { model = null; $('word-comment-status').textContent = (error.message || 'Comment recovery is unavailable.') + ' Your article preview and writing are kept.'; report($('word-comment-status').textContent); }
    } finally { setBusy(false); update(); }
  });
  $('word-comment-private-ok').addEventListener('change', update);
  $('word-comments-include').addEventListener('change', () => { changed(); update(); });
  $('discard-word-comments').addEventListener('click', () => { if (isBusy()) return; clear(); changed(); update(); report('Recovered comment text discarded from this preview. Original files and current writing are kept.'); });
  $('download-word-comments').addEventListener('click', () => {
    update(); if ($('download-word-comments').disabled) return;
    try {
      download(wordCommentsReport(model), 'private-word-comments.txt', 'text/plain;charset=utf-8');
      report('Private comment report download requested. It contains editorial feedback and possible hidden comment text. Inspect and keep it private.');
    } catch { report('The private comment report could not download. The recovered text is kept; retry or copy it from the comment preview.'); }
  });
  clear();
  return { clear, update, selectedCount: () => $('word-comments-include').checked && canInclude() ? notes().length : 0, draft(value) {
    if (!$('word-comments-include').checked) return value;
    if (isBusy() || !canInclude()) throw new Error('Prepare and review the current Word comments before including them. Current writing is unchanged.');
    return validateDraft({ ...value, questions: [...value.questions, ...notes()] });
  } };
}
