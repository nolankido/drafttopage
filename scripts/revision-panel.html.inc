<details id="checkpoint-panel" class="checkpoint-panel">
<summary>Revisions in this tab</summary>
<p id="checkpoint-help" class="small">Keep a version before changing direction. Checkpoints contain your notes, article, page details, and review questions in this tab's memory only. Imports, workspace restores, formatting, find-and-replace edits, filename suggestions, outline replacements, and removing a review note also keep the previous writing. Checkpoints can be lost when you refresh or leave. Download a private backup before closing.</p>
<label for="checkpoint-label">Checkpoint label, optional</label><input id="checkpoint-label" maxlength="80" autocomplete="off" aria-describedby="checkpoint-help">
<button id="save-checkpoint" type="button" class="secondary">Save checkpoint</button>
<p id="checkpoint-count" class="small"></p>
<section id="checkpoint-comparison" hidden aria-labelledby="checkpoint-heading">
<h2 id="checkpoint-heading">Compare and recover</h2>
<label for="checkpoint-select">Saved version</label><select id="checkpoint-select"></select>
<p id="checkpoint-differences" class="small" aria-live="polite"></p>
<label for="checkpoint-field">Field to compare</label><select id="checkpoint-field"></select>
<div class="checkpoint-columns"><div><label for="checkpoint-saved">Saved version of this field</label><textarea id="checkpoint-saved" rows="6" readonly></textarea></div><div><label for="checkpoint-current">Current version of this field</label><textarea id="checkpoint-current" rows="6" readonly></textarea></div></div>
<button id="restore-checkpoint" type="button" class="secondary" disabled>Restore selected checkpoint</button>
<label class="check"><input id="checkpoint-private-ok" type="checkbox"><span>I understand that this backup includes source and review notes and must be kept private.</span></label>
<button id="download-checkpoint" type="button" class="secondary" disabled>Download selected private checkpoint</button>
<p class="small">A download keeps one version in the existing private workspace format, without history, labels, approval, preferences, or sign-in details. Clear this writing desk removes all writing and checkpoints from this tab. <a href="/help/local-workspace/" target="_blank" rel="noopener">Checkpoint and backup help (new tab)</a></p>
</section>
</details>
