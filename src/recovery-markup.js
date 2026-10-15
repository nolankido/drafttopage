// Shared static markup. No submitted content, credentials, or server-side draft storage.
export const RECOVERY_HTML = `
<details class="recovery-box">
<summary>Save or restore this workspace</summary>
<p id="backup-help"><strong>Private backup, not a publishable article.</strong> The JSON file includes your source notes, audience, purpose, article, and review questions. It is unencrypted. Keep it private and out of public repositories. It contains no sign-in details or approval.</p>
<fieldset id="backup-controls"><legend class="sr-only">Local workspace files</legend>
<label class="check"><input id="backup-private-ok" type="checkbox"><span>I understand that a backup includes my notes and must be kept private.</span></label>
<button id="save-backup" class="secondary" type="button" disabled>Download private backup</button>
<label for="restore-backup">Restore a Draft to Page backup</label>
<input id="restore-backup" type="file" accept=".json,application/json" aria-describedby="restore-help backup-help">
<p id="restore-help" class="small">Choose a workspace JSON file up to 512 KiB to preview it locally. Selecting a file does not restore it. Inspect the preview, then choose Restore this backup. Invalid files leave current work unchanged. Restoring clears approvals and never calls AI.</p>
<p id="backup-status" class="small" aria-live="off"></p>
<section id="restore-preview" class="restore-preview" hidden aria-labelledby="restore-preview-heading">
<h3 id="restore-preview-heading" tabindex="-1">Review the backup before restoring</h3><p id="restore-preview-summary" class="small"></p>
<details id="restore-preview-contents"><summary>Inspect saved article and private notes</summary>
<label for="restore-preview-body">Saved article body, as text or Markdown</label><textarea id="restore-preview-body" rows="6" readonly></textarea>
<label for="restore-preview-notes">Saved private source notes</label><textarea id="restore-preview-notes" rows="4" readonly></textarea>
<dl id="restore-preview-details"></dl><h4>Saved review questions</h4><ul id="restore-preview-questions"></ul>
</details>
<p class="small">Restoring replaces the open notes and article. It does not restore collections, revision history, pending imports, unsaved tool preparation, approval, or export choices. The preview itself is temporary and is not included in downloads or browser recovery.</p>
<div class="actions"><button id="apply-restore-backup" class="button" type="button" disabled>Restore this backup</button><button id="cancel-restore-backup" class="secondary" type="button">Cancel preview</button></div>
</section>
</fieldset>
<p class="small">Check that the file is saved on your device before closing this tab. A file backup is separate from optional browser recovery in the public workspace. Browser exit warnings can be missed, especially on mobile.</p>
<a href="/help/local-workspace/" target="_blank" rel="noopener">How backups and article exports differ (new tab)</a>
</details>`;

