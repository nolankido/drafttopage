<details id="import-panel" class="import-panel">
<summary>Import an article or drafting result</summary>
<p class="small">Open a Word .docx, bring Markdown or article JSON, or paste a formatted selection. Preview first. Replace the article or insert writing into it. Nothing is uploaded, and your current writing stays intact until you apply.</p>
<fieldset id="import-fields"><legend class="sr-only">Local article import</legend>
<label for="import-file">Choose a Word document or article file</label><input id="import-file" type="file" accept=".docx,.md,.markdown,.txt,.json,.html,.htm,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/markdown,text/plain,application/json,text/html" aria-describedby="import-file-help import-file-status"><p id="import-file-help" class="small">Word .docx up to 8 MiB, or UTF-8 text up to 512 KiB. Word files convert the main article locally. Images become numbered placeholders; the preview can separately recover embedded PNG and JPEG files. Supported referenced footnotes and endnotes become labeled article sections and are included in exports. Tracked changes, fields, and complex structures must be resolved in Word. Keep the original file. <a href="/help/article-import/#word-notes" target="_blank" rel="noopener">Word note limits (new tab)</a>. For workspace JSON backups, use Save or restore this workspace.</p><p id="import-file-status" class="small" role="status" aria-live="polite"></p>
<label for="import-format">Import format</label><select id="import-format"><option value="auto">Detect Markdown, article JSON, or an HTML file</option><option value="markdown">Markdown</option><option value="json">Structured article JSON</option><option value="html">Formatted selection or HTML</option></select>
<div id="import-html-options" hidden><p id="import-html-help" class="small">Copy a formatted selection, then paste into the empty box below. Its conversion preview opens immediately; the box empties for the next selection. Missing clipboard formatting receives a plain-text warning. The copied source stays in this tab for re-preview until cleared or applied. You can also type HTML source and choose Preview. Headings, emphasis, safe web links, simple nested lists, code, and header tables can be converted to Markdown. Fonts, layout, and images are not retained. Normal pasting in the article editor remains plain text.</p><button id="import-html-example" type="button" class="secondary">Preview a formatted example</button></div>
<label class="check"><input id="import-first-row-headers" type="checkbox"><span>For Word or HTML tables without marked headers, use the first row as column headers. Preview again after changing this choice.</span></label>
<label for="import-text">Or paste writing or article source</label><textarea id="import-text" rows="5" maxlength="524288" aria-describedby="import-file-help import-html-help import-paste-status"></textarea><p id="import-paste-status" class="field-error small" role="status" aria-live="polite"></p>
<button id="preview-import" type="button" class="secondary">Preview selected Word file or pasted article</button>
</fieldset>
<section id="import-preview" hidden aria-labelledby="import-preview-heading">
<h2 id="import-preview-heading">Check the import</h2><p id="import-summary"></p>
<label for="import-destination">How should this import join your article?</label><select id="import-destination" aria-describedby="import-destination-help"><option value="replace">Replace the article and its page details</option><option value="selection">Insert at article cursor or replace selected blocks</option><option value="append">Add to the end of the article</option></select>
<p id="import-destination-help" class="small">Insertion keeps your existing title, excerpt, description, filename, source notes, and review notes. Only the imported body is used; imported page details and questions are not added. You can include its title as a section heading below. Replacement keeps the existing import behavior.</p>
<section id="import-insertion-controls" hidden aria-labelledby="import-insertion-heading"><h3 id="import-insertion-heading">Preview where this writing will go</h3>
<p class="small">For a selection, place the article cursor between complete blocks, or select complete paragraphs, lists, tables, or code blocks. Then preview here. A partial paragraph or block is refused. Adding to the end needs no selection. Applying saves a checkpoint first. Nothing is changed by previewing.</p>
<label class="check"><input id="import-include-title" type="checkbox"><span>Include the imported title as a level-two section heading</span></label>
<button id="preview-insertion" type="button" class="secondary" disabled>Preview at article cursor or selection</button>
<p id="import-insertion-status" class="small" role="status" aria-live="polite" aria-atomic="true"></p>
<div id="import-insertion-preview" hidden><p id="import-insertion-summary" class="small"></p><label for="import-insertion-before">Selected article source to replace</label><textarea id="import-insertion-before" rows="3" readonly></textarea><label for="import-insertion-after">Exact Markdown to insert, including paragraph separation</label><textarea id="import-insertion-after" rows="5" readonly></textarea></div>
</section>
<section aria-labelledby="import-reading-heading"><h3 id="import-reading-heading">Reading preview of the conversion</h3><div id="import-reading-preview" class="article-preview"></div></section>
<label for="import-body-preview">Article body to import</label><textarea id="import-body-preview" rows="6" readonly></textarea>
<details><summary>Page details to import</summary><dl id="import-page-details"></dl></details>
<ul id="import-warnings"></ul>
<section id="word-comment-handoff" class="word-comment-handoff" hidden aria-labelledby="word-comment-heading">
<h3 id="word-comment-heading">Keep Word editorial comments private</h3>
<p class="small">Comments stay out of the converted article. Recover their text separately before applying the import. The original document stays in this tab until you apply or clear it. <a href="/help/article-import/#word-comments" target="_blank" rel="noopener">Comment recovery limits (new tab)</a></p>
<button id="prepare-word-comments" type="button" class="secondary">Recover Word comment text</button>
<p id="word-comment-status" class="small" role="status" aria-live="polite" aria-atomic="true"></p>
<div id="word-comment-review" hidden>
<p id="word-comment-guidance" class="small"></p>
<details id="word-comment-details"><summary>Inspect recovered comment text</summary><ol id="word-comment-list" aria-label="Recovered private Word comments"></ol></details>
<label class="check"><input id="word-comments-include" type="checkbox" disabled aria-describedby="word-comment-notes-status"><span>Include these comments as private review notes when replacing the article</span></label>
<p id="word-comment-notes-status" class="small"></p>
<label class="check"><input id="word-comment-private-ok" type="checkbox"><span>I reviewed this private report. It contains comment text, possibly including text hidden by Word styling. The downloaded file is unencrypted.</span></label>
<div class="actions"><button id="download-word-comments" type="button" class="secondary" disabled>Download private comment report</button><button id="discard-word-comments" type="button" class="secondary">Discard recovered comment text</button></div>
</div>
<p class="small">Download before importing. Applying or clearing the import discards this temporary recovery. Explicitly included review notes stay in private workspace backups and are excluded from article exports. Insertion keeps existing review notes. Long or numerous comments can use the separate report instead of being cut down to fit.</p>
</section>
<section id="word-image-handoff" class="word-image-handoff" hidden aria-labelledby="word-image-heading">
<h3 id="word-image-heading">Keep the Word images</h3>
<p class="small">Recover embedded PNG and JPEG files with numbered placement notes and the alternative text supplied in Word. Images are not displayed here or uploaded. Linked images and other formats stay as placeholders.</p>
<button id="prepare-word-images" type="button" class="secondary">Prepare Word image files</button>
<p id="word-image-kit-status" class="small" role="status" aria-live="polite" aria-atomic="true"></p>
<div id="word-image-kit-review" hidden><ul id="word-image-kit-files" class="word-image-kit-files" aria-label="Prepared Word image files"></ul><ul id="word-image-kit-skipped" class="small" aria-label="Images to handle separately"></ul>
<label id="word-image-private-label" class="check"><input id="word-image-private-ok" type="checkbox"><span>I reviewed this package. It includes article text and original image files, with possible metadata and areas hidden by Word cropping.</span></label>
<div class="actions"><button id="download-word-images" type="button" class="button" disabled>Download images &amp; placement notes</button><button id="discard-word-images" type="button" class="secondary">Discard prepared image package</button></div></div>
<p class="small"><strong>Download before importing.</strong> Applying or clearing this import discards the prepared image package. Extract the ZIP, upload the files to your WordPress Media Library, and replace the numbered placeholders yourself. These files are separate from workspace backups and article exports.</p>
</section>
<label id="import-changes-section" class="check" hidden><input id="import-changes-ok" type="checkbox"><span>I reviewed the converted article and the formatting changes or omissions listed above.</span></label>
<section id="import-unmapped-section" hidden><h3>Unmapped front matter</h3><pre id="import-unmapped" class="code-sample"></pre><p class="small">These fields will not be imported. Keep any values your destination needs in your original file or private notes.</p><label class="check"><input id="import-unmapped-ok" type="checkbox"><span>I will handle these unmapped fields separately.</span></label></section>
<div class="actions"><button id="apply-import" type="button" class="button" disabled>Import into editor</button></div>
</section>
<div class="actions"><button id="cancel-import" type="button" class="secondary">Clear selected file or import preview</button></div>
<p class="small">An import preview is temporary and is not included in workspace backups. Apply the import to keep its article and questions. <a href="/help/article-import/" target="_blank" rel="noopener">Supported formats, insertion steps, and examples (new tab)</a></p>
</details>
