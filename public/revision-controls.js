import { createCheckpointHistory, compareWorkspaces, MAX_CHECKPOINTS, MAX_CHECKPOINT_BYTES } from './revisions.js';
import { downloadText } from './download.js';

export function installRevisions({ capture, restore, isBusy, workChanged, report, comparisonChanged = () => {} }) {
  const $ = id => document.getElementById(id);
  const history = createCheckpointHistory();
  let historyKey = '', comparison = [], currentKey = '', articleComparison = null;
  const selected = () => Number($('checkpoint-select').value);
  const showField = () => {
    const field = comparison.find(item => item.id === $('checkpoint-field').value);
    $('checkpoint-saved').value = field?.saved || '';
    $('checkpoint-current').value = field?.current || '';
  };
  function update() {
    const entries = history.list(), key = entries.map(item => item.id).join(',');
    if (key !== historyKey) {
      const previous = selected();
      $('checkpoint-select').replaceChildren(...entries.slice().reverse().map(item => {
        const option = document.createElement('option'); option.value = item.id;
        option.textContent = item.label + ' · ' + new Date(item.created).toLocaleTimeString(); return option;
      }));
      if (entries.some(item => item.id === previous)) $('checkpoint-select').value = previous;
      historyKey = key; currentKey = ''; $('checkpoint-private-ok').checked = false;
    }
    $('checkpoint-count').textContent = entries.length + ' / ' + MAX_CHECKPOINTS + ' checkpoints in this tab. Oldest entries are removed when the count or ' + (MAX_CHECKPOINT_BYTES / 1024) + ' KiB writing limit is reached.';
    $('checkpoint-comparison').hidden = entries.length === 0;
    const busy = isBusy();
    $('save-checkpoint').disabled = busy;
    $('checkpoint-select').disabled = busy || !entries.length;
    $('download-checkpoint').disabled = busy || !entries.length || !$('checkpoint-private-ok').checked;
    if (!entries.length) {
      comparison = []; currentKey = '';
      $('checkpoint-field').replaceChildren(); $('checkpoint-differences').textContent = '';
      $('checkpoint-saved').value = ''; $('checkpoint-current').value = '';
      articleComparison = null; comparisonChanged();
      $('restore-checkpoint').disabled = true; return;
    }
    try {
      const current = capture(), snapshot = JSON.stringify([selected(), current]);
      if (snapshot !== currentKey) {
        comparison = compareWorkspaces(history.read(selected()), current);
        const previousField = $('checkpoint-field').value;
        $('checkpoint-field').replaceChildren(...comparison.map(field => {
          const option = document.createElement('option'); option.value = field.id;
          option.textContent = field.label + (field.changed ? ' (changed)' : ' (same)'); return option;
        }));
        $('checkpoint-field').value = previousField || 'body';
        const changed = comparison.filter(field => field.changed);
        const summary = changed.length ? 'Changed fields: ' + changed.map(field => field.label).join(', ') + '. Restoring replaces the entire workspace, including private source and review notes.' : 'This checkpoint matches your current writing.';
        if ($('checkpoint-differences').textContent !== summary) $('checkpoint-differences').textContent = summary;
        currentKey = snapshot; showField();
      }
      $('restore-checkpoint').disabled = busy || !comparison.some(field => field.changed);
      const body = comparison.find(field => field.id === 'body');
      articleComparison = { saved: body.saved, current: body.current };
    } catch (error) {
      articleComparison = null;
      $('checkpoint-differences').textContent = error.message + ' Correct the current field before comparing or restoring.';
      $('restore-checkpoint').disabled = true;
    }
    comparisonChanged();
  }
  function save(label) {
    const result = history.save(capture(), label);
    if (result.id) { update(); $('checkpoint-select').value = result.id; $('checkpoint-private-ok').checked = false; currentKey = ''; update(); workChanged(); }
    return result;
  }
  $('save-checkpoint').addEventListener('click', () => {
    if (isBusy()) return;
    try {
      const result = save($('checkpoint-label').value);
      if (result.empty) { report('Add writing before saving a checkpoint.'); return; }
      $('checkpoint-label').value = '';
      report((result.duplicate ? 'Your latest checkpoint already contains this writing.' : 'Checkpoint saved in this tab.') + (result.evicted ? ' Removed ' + result.evicted + ' oldest checkpoint(s) to stay within the limits.' : '') + ' Download a private backup before leaving.');
    } catch (error) { report(error.message); }
  });
  $('checkpoint-select').addEventListener('change', () => { currentKey = ''; $('checkpoint-private-ok').checked = false; update(); });
  $('checkpoint-field').addEventListener('change', showField);
  $('checkpoint-private-ok').addEventListener('change', update);
  $('checkpoint-panel').addEventListener('toggle', update);
  $('restore-checkpoint').addEventListener('click', () => {
    if (isBusy()) return;
    try {
      const target = history.read(selected()); // Retain target before bounded history can evict it.
      if (!compareWorkspaces(target, capture()).some(field => field.changed)) return;
      if (!confirm('Restore this checkpoint, replacing the current notes, article, page details, review questions, and any unsaved passage review or image preparation? Your current saved writing will be kept as a checkpoint when it contains work. Unsaved preparation is excluded from checkpoints and files; save the review note or apply the image first to keep it. Review approval will be cleared.')) {
        report('Checkpoint restore cancelled. Current writing is unchanged.'); return;
      }
      const result = save('Before checkpoint restore');
      restore(target); $('checkpoint-private-ok').checked = false; update();
      report('Checkpoint restored locally. Review approval was cleared.' + (result.empty ? '' : ' Your previous writing remains available in Revisions in this tab.') + (result.evicted ? ' Older checkpoints were removed to stay within the limits.' : '') + ' Nothing was uploaded or published.');
    } catch (error) { report(error.message); }
  });
  $('download-checkpoint').addEventListener('click', () => {
    if (isBusy() || !$('checkpoint-private-ok').checked) return;
    try {
      downloadText(history.download(selected()), 'drafttopage-private-checkpoint-' + selected() + '.json', 'application/json;charset=utf-8');
      report('Private checkpoint backup download requested. It includes source and review notes, and contains only the selected version. Check the file before leaving.');
    } catch (error) { report(error.message); }
  });
  update();
  return {
    update,
    articleComparison: () => articleComparison ? { ...articleComparison } : null,
    hasWriting: history.hasWriting,
    captureBefore(label) { const result = save(label); return result; },
    clear() { history.clear(); $('checkpoint-label').value = ''; $('checkpoint-private-ok').checked = false; update(); }
  };
}
