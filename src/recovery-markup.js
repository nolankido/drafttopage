// Shared static markup. No submitted content, credentials, or server-side draft storage.
export const RECOVERY_HTML = `
<details id="workspace-files" class="recovery-box">
<summary>Save or restore this workspace</summary>
<p id="backup-help"><strong>Private backup, not a publishable article.</strong> The JSON file includes your source notes, audience, purpose, article, and review questions. It is unencrypted. Keep it private and out of public repositories. It contains no sign-in details or approval.</p>
<fieldset id="backup-controls"><legend class="sr-only">Local workspace files</legend>
<label class="check"><input id="backup-private-ok" type="checkbox"><span>I understand that a backup includes my notes and must be kept private.</span></label>
<button id="save-backup" class="secondary" type="button" disabled>Download private backup</button>
<label for="restore-backup">Restore a Draft to Page backup</label>
<input id="restore-backup" type="file" accept=".json,application/json" aria-describedby="restore-help backup-help">
<p id="restore-help" class="small">Choose a workspace JSON file up to 512 KiB to preview it locally. Your current writing stays unchanged until you review and apply the restore. Nothing is uploaded.</p>
<section id="restore-preview" aria-labelledby="restore-preview-heading" hidden>
<h2 id="restore-preview-heading" tabindex="-1">Review this backup before restoring</h2>
<p id="restore-file-name" class="small"></p><p id="restore-summary" class="small"></p>
<label for="restore-field">Compare a workspace field</label><select id="restore-field"></select>
<div class="checkpoint-columns">
<div><label for="restore-current">Current workspace text</label><textarea id="restore-current" rows="7" readonly spellcheck="false"></textarea></div>
<div><label for="restore-proposed">Text from the backup</label><textarea id="restore-proposed" rows="7" readonly spellcheck="false"></textarea></div>
</div>
<details><summary>Read the article from this backup</summary><p class="small">This preview shows supported article formatting. Source notes and review questions are available in the field comparison above. Links open only when selected; images and source HTML stay as text.</p><div id="restore-article-preview" class="article-preview"></div></details>
<p class="small">Restoring replaces the entire workspace, including fields that are empty in this file. Unsaved imports and passage, image, link, or table preparation are excluded from backups. Save a review note or apply a prepared change first to keep it. Approval and AI consent are cleared.</p>
<label class="check"><input id="restore-reviewed" type="checkbox"><span>I reviewed this backup and the fields it will replace, including private source and review notes.</span></label>
<div class="actions"><button id="apply-restore" type="button" class="button" disabled>Restore reviewed backup</button><button id="discard-restore" type="button" class="secondary">Discard backup preview</button></div>
</section>
<p id="restore-status" class="small" role="status" aria-live="polite" aria-atomic="true"></p>
</fieldset>
<p class="small">There is still no autosave. Check that the file is saved on your device before closing this tab. Browser exit warnings can be missed, especially on mobile.</p>
<a href="/help/local-workspace/" target="_blank" rel="noopener">How backups and article exports differ (new tab)</a>
</details>`;

