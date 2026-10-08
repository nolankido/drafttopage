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
<p id="restore-help" class="small">Choose a workspace JSON file up to 128 KiB. It is read locally, not uploaded. Invalid files leave current work unchanged. Restoring clears approvals and never calls AI.</p>
</fieldset>
<p class="small">There is still no autosave. Check that the file is saved on your device before closing this tab. Browser exit warnings can be missed, especially on mobile.</p>
<a href="/help/local-workspace/" target="_blank" rel="noopener">How backups and article exports differ (new tab)</a>
</details>`;
