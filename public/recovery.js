import { MAX_BACKUP_BYTES, createWorkspaceBackup, parseWorkspaceBackup } from './workspace.js';
import { downloadText } from './download.js';

/** Bind local backup controls to an editor, independently of its AI connection. */
export function installRecovery({ capture, restore, hasWork, isBusy, busyChanged = () => {}, workChanged = () => {}, report, download = downloadText }) {
  const $ = id => document.getElementById(id);
  const controls = document.getElementById('backup-controls');
  const acknowledge = document.getElementById('backup-private-ok');
  const save = document.getElementById('save-backup');
  const fileInput = document.getElementById('restore-backup');
  let reading = false, candidate = null, requestId = 0;
  const say = message => { $('backup-status').textContent = message; report(message); };
  function clearContents() {
    $('restore-preview-body').value = ''; $('restore-preview-notes').value = '';
    $('restore-preview-details').replaceChildren(); $('restore-preview-questions').replaceChildren();
  }
  function inspect() {
    clearContents();
    if (!candidate || !$('restore-preview-contents').open) return;
    const { source, draft } = candidate.value;
    $('restore-preview-body').value = draft?.body || ''; $('restore-preview-notes').value = source.notes;
    for (const [label, value] of [['Article type', source.profile], ['Audience', source.audience], ['Purpose', source.purpose], ['Title', draft?.title], ['Excerpt', draft?.excerpt], ['Description', draft?.description], ['Filename', draft?.slug]]) {
      const term = document.createElement('dt'), detail = document.createElement('dd');
      term.textContent = label; detail.textContent = value || 'Not supplied'; $('restore-preview-details').append(term, detail);
    }
    for (const question of draft?.questions || []) { const li = document.createElement('li'); li.textContent = question; $('restore-preview-questions').append(li); }
  }
  const update = () => {
    controls.disabled = reading || isBusy();
    save.disabled = !acknowledge.checked || reading || isBusy();
    $('apply-restore-backup').disabled = !candidate || reading || isBusy();
  };
  function clear() {
    requestId++; candidate = null; fileInput.value = '';
    $('restore-preview').hidden = true; $('restore-preview-contents').open = false;
    $('restore-preview-summary').textContent = ''; $('backup-status').textContent = '';
    clearContents(); update(); workChanged();
  }
  $('restore-preview-contents').addEventListener('toggle', inspect);
  acknowledge.addEventListener('change', update);
  save.addEventListener('click', () => {
    if (!acknowledge.checked || reading || isBusy()) return;
    try {
      const { source, draft } = capture();
      const content = createWorkspaceBackup(source, draft);
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      download(content, `drafttopage-private-workspace-${stamp}.json`, 'application/json;charset=utf-8');
      say('Private backup download requested for the current workspace. Check the saved file before leaving. It includes source notes and review questions; the pending restore preview is excluded. Choose the saved file below to inspect it without restoring. Nothing was uploaded or sent to AI.');
    } catch (error) { say(error.message); }
  });
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file || reading || isBusy()) { fileInput.value = ''; return; }
    clear(); const currentRequest = ++requestId;
    reading = true; update(); busyChanged(); workChanged();
    say('Reading the selected backup locally. Current writing is kept.');
    try {
      if (file.size > MAX_BACKUP_BYTES) throw new Error('Choose a workspace backup no larger than 512 KiB. Current work is unchanged.');
      // Validate before confirming or changing any visible field. Never merge arbitrary keys.
      const bytes = await file.arrayBuffer();
      if (currentRequest !== requestId) return;
      if (bytes.byteLength > MAX_BACKUP_BYTES) throw new Error('Choose a workspace backup no larger than 512 KiB. Current work is unchanged.');
      const value = parseWorkspaceBackup(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
      candidate = { value, name: file.name };
      $('restore-preview-summary').textContent = 'File: ' + file.name + '. ' + (value.draft ? 'Article: ' + (value.draft.title || 'Untitled') + '. ' + value.draft.body.length.toLocaleString() + ' article characters.' : 'This backup has no article. Restoring it clears the current article fields.') + ' ' + value.source.notes.length.toLocaleString() + ' source-note characters; ' + (value.draft?.questions.length || 0) + ' saved review questions.';
      $('restore-preview').hidden = false;
      say('Backup preview ready. Current writing is unchanged. Inspect the saved writing, then choose Restore this backup or Cancel preview.');
      $('restore-preview-heading').focus();
    } catch (error) { if (currentRequest === requestId) say(error instanceof TypeError ? 'Use a UTF-8 workspace backup. Current writing is unchanged.' : error.message || 'Could not read this backup. Current writing is unchanged.'); }
    finally { reading = false; fileInput.value = ''; update(); busyChanged(); workChanged(); }
  });
  $('apply-restore-backup').addEventListener('click', () => {
    if (!candidate || reading || isBusy()) return;
    try {
      const target = candidate.value, before = JSON.stringify(capture());
      if (hasWork() && !confirm('Replace the current notes, article, and any unsaved preparation with this backup? Download saved writing you want to keep first. Unsaved passage reviews, image preparation, link preparation, and table preparation are excluded from files; save the review note or apply the image, link, or table change first to keep it.')) {
        say('Restore cancelled. Current writing is unchanged. The backup preview is still available.'); return;
      }
      if (reading || isBusy() || JSON.stringify(capture()) !== before) throw new Error('Current writing or another operation changed while restore was being confirmed. Nothing was restored. Review the backup and try again.');
      restore(target);
      clear();
      acknowledge.checked = false;
      update(); say('Workspace restored locally. Review approval and any AI consent are cleared. Nothing was uploaded, generated, or published.');
    } catch (error) { say(error.message || 'Could not restore this backup. Current writing is unchanged.'); update(); }
  });
  $('cancel-restore-backup').addEventListener('click', () => {
    if (reading || isBusy()) return;
    clear(); say('Backup preview cancelled. Current writing and files on your device are unchanged.'); fileInput.focus();
  });
  update();
  return { update, reading: () => reading, pending: () => reading || Boolean(candidate), clear };
}

