<details id="import-panel" class="import-panel">
<summary>Import an article or drafting result</summary>
<p class="small">Open a Word .docx, bring Markdown or article JSON, or paste a formatted selection. Preview first. Nothing is uploaded, and your current writing stays intact until you import.</p>
<fieldset id="import-fields"><legend class="sr-only">Local article import</legend>
<label for="import-file">Choose a Word document or article file</label><input id="import-file" type="file" accept=".docx,.md,.markdown,.txt,.json,.html,.htm,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/markdown,text/plain,application/json,text/html" aria-describedby="import-file-help import-file-status"><p id="import-file-help" class="small">Word .docx up to 8 MiB, or UTF-8 text up to 512 KiB. Word files convert the main article locally. Images become placeholders; tracked changes, fields, footnotes, and complex structures must be resolved in Word. Keep the original file. Workspace JSON backups belong in Save or restore, above.</p><p id="import-file-status" class="small" role="status" aria-live="polite"></p>
<label for="import-format">Import format</label><select id="import-format"><option value="auto">Detect Markdown, article JSON, or an HTML file</option><option value="markdown">Markdown</option><option value="json">Structured article JSON</option><option value="html">Formatted selection or HTML</option></select>
<div id="import-html-options" hidden><p id="import-html-help" class="small">Copy a formatted selection, then paste into the empty box below. You can also paste HTML source. Headings, emphasis, safe web links, simple nested lists, code, and header tables can be converted to Markdown. Fonts, layout, and images are not retained. Normal pasting in the article editor remains plain text.</p><button id="import-html-example" type="button" class="secondary">Preview a formatted example</button></div>
<label class="check"><input id="import-first-row-headers" type="checkbox"><span>For Word or HTML tables without marked headers, use the first row as column headers. Preview again after changing this choice.</span></label>
<label for="import-text">Or paste writing or article source</label><textarea id="import-text" rows="5" maxlength="524288" aria-describedby="import-file-help import-html-help import-paste-status"></textarea><p id="import-paste-status" class="field-error small" role="status" aria-live="polite"></p>
<button id="preview-import" type="button" class="secondary">Preview selected Word file or pasted article</button>
</fieldset>
<section id="import-preview" hidden aria-labelledby="import-preview-heading">
<h2 id="import-preview-heading">Check the import</h2><p id="import-summary"></p>
<section aria-labelledby="import-reading-heading"><h3 id="import-reading-heading">Reading preview of the conversion</h3><div id="import-reading-preview" class="article-preview"></div></section>
<label for="import-body-preview">Article body to import</label><textarea id="import-body-preview" rows="6" readonly></textarea>
<details><summary>Page details to import</summary><dl id="import-page-details"></dl></details>
<ul id="import-warnings"></ul>
<label id="import-changes-section" class="check" hidden><input id="import-changes-ok" type="checkbox"><span>I reviewed the converted article and the formatting changes or omissions listed above.</span></label>
<section id="import-unmapped-section" hidden><h3>Unmapped front matter</h3><pre id="import-unmapped" class="code-sample"></pre><p class="small">These fields will not be imported. Keep any values your destination needs in your original file or private notes.</p><label class="check"><input id="import-unmapped-ok" type="checkbox"><span>I will handle these unmapped fields separately.</span></label></section>
<div class="actions"><button id="apply-import" type="button" class="button" disabled>Import into editor</button></div>
</section>
<div class="actions"><button id="cancel-import" type="button" class="secondary">Clear selected file or import preview</button></div>
<p class="small">An import preview is temporary and is not included in workspace backups. Apply the import to keep its article and questions. <a href="/help/article-import/" target="_blank" rel="noopener">Supported formats and examples (new tab)</a></p>
</details>
