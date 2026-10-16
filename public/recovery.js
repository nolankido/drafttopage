import { MAX_BACKUP_BYTES, createWorkspaceBackup, parseWorkspaceBackup } from './workspace.js';
import { compareWorkspaces } from './revisions.js';
import { renderPreview } from './preview.js';
import { focusWorkflowTarget } from './workflow-navigation.js';
import { downloadText } from './download.js';

/** Explicit local files, with review before replacement. No persistent writing storage. */
export function installRecovery({ capture, restore, hasWork, isBusy, hasPendingImport = () => false, busyChanged = () => {}, workChanged = () => {}, report }) {
  const $ = id => document.getElementById(id);
  const controls = $('backup-controls'), acknowledge = $('backup-private-ok'), save = $('save-backup');
  const fileInput = $('restore-backup'), reviewed = $('restore-reviewed'), apply = $('apply-restore');
  let reading = false, requestId = 0, staged = null, comparison = [], currentKey = '', pendingImport = false;
  const status = text => { if ($('restore-status').textContent !== text) $('restore-status').textContent = text; };
  function showField() {
    const field = comparison.find(item => item.id === $('restore-field').value);
    $('restore-current').value = field?.current || '';
    $('restore-proposed').value = field?.saved || '';
  }
  function update() {
    const busy = reading || isBusy();
    controls.disabled = busy; save.disabled = !acknowledge.checked || busy;
    apply.disabled = true;
    if (!staged) return;
    try {
      const current = capture(), key = JSON.stringify(current);
      if (key !== currentKey) {
        reviewed.checked = false;
        comparison = compareWorkspaces(staged.value, current).map(field => {
          if (field.id !== 'questions') return field;
          // Preserve list boundaries even when a note itself contains numbered lines.
          const saved = staged.value.draft?.questions || [], now = current.draft?.questions || [];
          return { ...field, saved: saved.length ? JSON.stringify(saved, null, 2) : '', current: now.length ? JSON.stringify(now, null, 2) : '', changed: JSON.stringify(saved) !== JSON.stringify(now) };
        });
        const previousField = $('restore-field').value;
        $('restore-field').replaceChildren(...comparison.map(field => {
          const option = document.createElement('option'); option.value = field.id;
          option.textContent = field.label + (field.changed ? ' (will change)' : ' (same)'); return option;
        }));
        $('restore-field').value = comparison.some(field => field.id === previousField) ? previousField : 'body';
        const changed = comparison.filter(field => field.changed);
        const emptied = changed.filter(field => field.current.length && !field.saved.length);
        $('restore-summary').textContent = changed.length
          ? 'Fields to replace: ' + changed.map(field => field.label).join(', ') + '.' + (emptied.length ? ' Fields that will become empty: ' + emptied.map(field => field.label).join(', ') + '.' : '')
          : 'This backup matches your current writing. No restore is needed.';
        status(currentKey ? 'Current writing changed. Review the updated comparison and acknowledge it again.' : 'Backup ready to review. Current writing and approval are unchanged.');
        currentKey = key; showField();
      }
      const pending = Boolean(hasPendingImport());
      if (pending !== pendingImport) {
        pendingImport = pending; reviewed.checked = false;
        if (!pending) status('Article import finished or cleared. Review this backup and acknowledge the comparison again.');
      }
      if (pending) status('An article import is unfinished. Apply or clear that import before restoring this backup.');
      apply.disabled = busy || pending || !reviewed.checked || !comparison.some(field => field.changed);
    } catch (error) {
      comparison = []; currentKey = ''; reviewed.checked = false;
      $('restore-field').replaceChildren(); showField(); $('restore-summary').textContent = '';
      status((error.message || 'Current writing could not be compared.') + ' Correct the current writing before restoring. The backup preview is kept.');
    }
  }
  function clear() {
    requestId++; reading = false; staged = null; comparison = []; currentKey = ''; pendingImport = false;
    fileInput.value = ''; reviewed.checked = false;
    $('restore-preview').hidden = true; $('restore-field').replaceChildren();
    $('restore-file-name').textContent = ''; $('restore-summary').textContent = '';
    $('restore-article-preview').replaceChildren(); showField(); status('');
    update(); workChanged();
  }
  acknowledge.addEventListener('change', update);
  reviewed.addEventListener('change', update);
  $('restore-field').addEventListener('change', showField);
  $('workspace-files').addEventListener('toggle', update);
  save.addEventListener('click', () => {
    if (!acknowledge.checked || reading || isBusy()) return;
    try {
      const { source, draft } = capture();
      const content = createWorkspaceBackup(source, draft);
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      downloadText(content, `drafttopage-private-workspace-${stamp}.json`, 'application/json;charset=utf-8');
      report('Private backup download requested. Check the saved file before leaving. It includes source notes and review questions. Nothing was uploaded or sent to AI.');
    } catch (error) { report(error.message); }
  });
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file || reading || isBusy()) { fileInput.value = ''; return; }
    clear(); const id = ++requestId;
    reading = true; update(); busyChanged();
    status('Reading the selected backup locally. Current writing is unchanged.');
    try {
      if (file.size > MAX_BACKUP_BYTES) throw new Error('Choose a workspace backup no larger than 512 KiB. Current work is unchanged.');
      const value = parseWorkspaceBackup(await file.text());
      if (id !== requestId) return;
      if (isBusy()) throw new Error('Finish the current operation before previewing. Current work is unchanged.');
      // Never insert file markup as HTML. Comparison text and reading output stay inert.
      renderPreview($('restore-article-preview'), value.draft?.title || '', value.draft?.body || '');
      staged = { value }; $('restore-preview').hidden = false;
      $('restore-file-name').textContent = 'Selected file: ' + String(file.name || 'Workspace backup').slice(0, 180);
    } catch (error) {
      if (id !== requestId) return;
      status(error.message || 'Could not read this backup. Current writing is unchanged.');
      report($('restore-status').textContent);
    } finally {
      if (id === requestId) {
        reading = false; fileInput.value = ''; update(); busyChanged(); workChanged();
        if (staged) focusWorkflowTarget($('restore-preview-heading'), { bar: $('workflow-steps') });
      }
    }
  });
  apply.addEventListener('click', () => {
    if (!staged || reading || isBusy()) return;
    update(); if (apply.disabled) return;
    if (hasWork() && !confirm('Restore this reviewed backup, replacing the entire workspace and discarding unsaved passage, image, link, or table preparation? Empty fields in the backup will clear those current fields. Download a private backup first to keep your current writing beyond this tab.')) {
      reviewed.checked = false; update(); status('Restore cancelled. Current writing and the backup preview are kept.'); return;
    }
    try {
      const value = staged.value;
      const result = restore(value); // The public desk checkpoints before its first field mutation.
      clear(); acknowledge.checked = false; update();
      const message = 'Reviewed backup restored locally. Review approval and any AI consent are cleared.' + (result?.checkpointed ? ' Previous writing remains in Revisions in this tab.' : '') + (result?.evicted ? ' Older checkpoints were removed to stay within the limits.' : '');
      status(message); report(message + ' Nothing was uploaded, generated, or published.');
    } catch (error) { status(error.message || 'Could not restore this backup.'); report($('restore-status').textContent); update(); }
  });
  $('discard-restore').addEventListener('click', () => {
    if (reading || isBusy()) return;
    clear(); status('Backup preview discarded. Current writing and approval are unchanged.'); fileInput.focus();
  });
  update();
  return { update, reading: () => reading, pending: () => Boolean(staged), clear };
}
