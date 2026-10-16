<details id="reference-links-panel" class="reference-links-panel" hidden>
<summary>Convert reference-style links</summary>
<p class="small">Turn references such as <code>[Read the source][source]</code> and <code>[source][]</code> into ordinary inline links before exporting. Matching shortcuts such as <code>[source]</code> are included when a supported definition exists. Preview first; nothing changes until you apply.</p>
<p class="small">Use single-line definitions such as <code>[source]: https://example.com/</code> at the left edge in a separate paragraph. Identifiers use up to 80 ASCII letters, digits, spaces, periods, hyphens, or underscores and match without case or repeated-space differences. Destinations must be absolute HTTP(S) URLs without credentials or titles. Images, footnotes, duplicate definitions, complex labels, source HTML, and multiline definitions need manual review. <a href="/help/draft-checks/#reference-links" target="_blank" rel="noopener">Reference conversion limits (new tab)</a></p>
<label class="check"><input id="reference-remove-definitions" type="checkbox" checked><span>Remove converted definition lines only when no remaining bracket use mentions their identifier.</span></label>
<p id="reference-blocked" class="small"></p>
<div class="actions"><button id="reference-prepare" type="button" class="secondary" disabled>Preview inline link conversion</button><button id="reference-discard" type="button" class="secondary" disabled>Discard conversion preview</button></div>
<p id="reference-status" class="small" role="status" aria-live="polite">Preview first, then compare and apply deliberately.</p>
<section id="reference-result" hidden aria-labelledby="reference-result-heading">
<h3 id="reference-result-heading">Inspect the proposed article</h3><p id="reference-summary" class="small"></p>
<p class="small">The first five expanded links are shown below. The exact complete result is available after the reading preview. Other text and line endings are retained. Unresolved items stay unchanged; no URL is visited or verified.</p>
<ol id="reference-examples" aria-label="Reference conversion examples"></ol>
<ul id="reference-findings" aria-label="Reference items to inspect"></ul>
<p class="small">At most 40 findings are displayed. Inspect the complete article if more are reported.</p>
<div id="reference-reading-preview" class="article-preview" role="region" aria-label="Reading preview of proposed reference conversion" tabindex="0"></div>
<details><summary>Inspect the exact proposed Markdown</summary><label for="reference-after">Complete article after reference conversion</label><textarea id="reference-after" rows="10" readonly spellcheck="false"></textarea></details>
<label class="check"><input id="reference-ack" type="checkbox" disabled><span>I reviewed the expanded links, remaining items, and definition removals above.</span></label>
<button id="reference-apply" type="button" disabled>Apply inline link conversion</button>
</section>
</details>
