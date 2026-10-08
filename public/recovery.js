import { MAX_BACKUP_BYTES, createWorkspaceBackup, parseWorkspaceBackup } from './workspace.js';
import { downloadText } from './download.js';

/** Bind local backup controls to an editor, independently of its AI connection. */
export function installRecovery({ capture, restore, hasWork, isBusy, report }) {
  const controls = document.getElementById('backup-controls');
  const acknowledge = document.getElementById('backup-private-ok');
  const save = document.getElementById('save-backup');
  const fileInput = document.getElementById('restore-backup');
  let reading = false;
  const update = () => {
    controls.disabled = reading || isBusy();
    save.disabled = !acknowledge.checked || reading || isBusy();
  };
  acknowledge.addEventListener('change', update);
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
    reading = true; update();
    try {
      if (file.size > MAX_BACKUP_BYTES) throw new Error('Choose a workspace backup no larger than 128 KiB. Current work is unchanged.');
      // Validate before confirming or changing any visible field. Never merge arbitrary keys.
      const value = parseWorkspaceBackup(await file.text());
      if (isBusy()) throw new Error('Finish the current operation before restoring. Current work is unchanged.');
      if (hasWork() && !confirm('Replace the current notes and article with this backup? Download anything you want to keep first.')) {
        report('Restore cancelled. Current writing is unchanged.'); return;
      }
      restore(value);
      acknowledge.checked = false;
      report('Workspace restored locally. Review approval and any AI consent are cleared. Nothing was uploaded, generated, or published.');
    } catch (error) { report(error.message || 'Could not read this backup. Current writing is unchanged.'); }
    finally { reading = false; fileInput.value = ''; update(); }
  });
  update();
  return { update, reading: () => reading };
}
