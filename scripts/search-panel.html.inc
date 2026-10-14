<details id="find-panel" class="find-panel">
<summary>Find &amp; replace in the article</summary>
<p id="find-help" class="small">Find literal words or phrases in the article body, including Markdown, code, and link addresses. Matches are substrings and do not overlap. Source notes, review notes, and page details are kept. No AI request or upload is made.</p>
<label for="find-text">Find text</label><input id="find-text" maxlength="200" autocomplete="off" aria-describedby="find-help find-status">
<label class="check"><input id="find-case" type="checkbox"><span>Match uppercase and lowercase exactly</span></label>
<p id="find-status" class="small" role="status" aria-live="polite" aria-atomic="true">Enter literal text to find in the article.</p>
<div class="actions"><button id="find-previous" type="button" class="secondary" disabled>Previous match</button><button id="find-next" type="button" class="secondary" disabled>Next match</button></div>
<p class="small">Navigation wraps at the ends. Enter in Find text selects the next match; Shift+Enter selects the previous one. Searching keeps review approval.</p>
<label for="replace-text">Replace with</label><textarea id="replace-text" rows="2" maxlength="500" aria-describedby="replace-help"></textarea>
<p id="replace-help" class="small">Replacement text is literal. Leave it empty to delete matching text. Replacements keep the previous workspace as a checkpoint and clear approval. Review formatting and links afterwards.</p>
<div class="actions"><button id="replace-match" type="button" class="secondary" disabled>Replace selected match</button><button id="preview-replace-all" type="button" class="secondary" disabled>Preview replace all</button></div>
<section id="replace-preview" hidden aria-labelledby="replace-preview-heading">
<h3 id="replace-preview-heading">Review the replacements</h3><p id="replace-summary" class="small"></p><ol id="replace-examples" class="replace-examples" aria-label="Replacement examples"></ol>
<div class="actions"><button id="apply-replace-all" type="button" class="secondary" disabled>Apply replace all</button><button id="cancel-replace-all" type="button" class="secondary">Clear replacement preview</button></div>
<p class="small">Editing the article or search settings clears this preview. The applied change uses the complete current article, not only these examples. <a href="/help/local-workspace/#find-replace" target="_blank" rel="noopener">Editing and checkpoint help (new tab)</a></p>
</section>
</details>
