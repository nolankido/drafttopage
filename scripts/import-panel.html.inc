<details id="import-panel" class="import-panel">
<summary>Import an article or drafting result</summary>
<p class="small">Choose a Markdown/text file or paste the structured article returned by a Draft to Page brief. Preview first. Nothing is uploaded, and your current writing stays intact until you import.</p>
<fieldset id="import-fields"><legend class="sr-only">Local article import</legend>
<label for="import-file">Choose an article file</label><input id="import-file" type="file" accept=".md,.markdown,.txt,.json,text/markdown,text/plain,application/json" aria-describedby="import-file-help"><p id="import-file-help" class="small">UTF-8 text up to 48 KiB. Workspace JSON backups belong in Save or restore, above.</p>
<label for="import-format">Import format</label><select id="import-format"><option value="auto">Detect Markdown or article JSON</option><option value="markdown">Markdown</option><option value="json">Structured article JSON</option></select>
<label for="import-text">Or paste an article file or drafting result</label><textarea id="import-text" rows="5" maxlength="49152"></textarea>
<button id="preview-import" type="button" class="secondary">Preview pasted article</button>
</fieldset>
<section id="import-preview" hidden aria-labelledby="import-preview-heading">
<h2 id="import-preview-heading">Check the import</h2><p id="import-summary"></p>
<label for="import-body-preview">Article body to import</label><textarea id="import-body-preview" rows="6" readonly></textarea>
<details><summary>Page details to import</summary><dl id="import-page-details"></dl></details>
<ul id="import-warnings"></ul>
<section id="import-unmapped-section" hidden><h3>Unmapped front matter</h3><pre id="import-unmapped" class="code-sample"></pre><p class="small">These fields will not be imported. Keep any values your destination needs in your original file or private notes.</p><label class="check"><input id="import-unmapped-ok" type="checkbox"><span>I will handle these unmapped fields separately.</span></label></section>
<div class="actions"><button id="apply-import" type="button" class="button" disabled>Import into editor</button><button id="cancel-import" type="button" class="secondary">Clear import preview</button></div>
</section>
<p class="small">An import preview is temporary and is not included in workspace backups. Apply the import to keep its article and questions. <a href="/help/article-import/" target="_blank" rel="noopener">Supported formats and examples (new tab)</a></p>
</details>
