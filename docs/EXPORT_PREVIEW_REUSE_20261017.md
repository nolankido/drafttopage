# Reuse unchanged export-preview blocks

Base production: `3f3c0f9f0318c35b2858b6f24603d0b9a5d631a5`, following PR #123. Implementation: PR #126, validated runtime feature `2f1dba61ef781f0b4e7444d2fa07a1b98788df1f`.

## Bounded behavior change

The selected-export preview previously regenerated every DOM block for each changed article, even when only the final paragraph changed. The controller now owns one current-preview renderer. It compares exact complete block descriptions, retains the unchanged prefix and suffix in place and replaces only the changed middle. Duplicate blocks are positional, never matched across arbitrary locations. Nested list/table properties, heading levels, title text, image URL/alt and source Markdown participate in identity. Destination and preview-kind changes invalidate all reuse.

This is DOM reuse, not a parser shortcut. Every changed article is still fully parsed by the existing `prepareExportPreview` function. Changed blocks are built with the original `renderExportPreview` function in detached fragments before applying any DOM update. No HTML strings are inserted. Full exported files, WordPress review, image consent, source selection, author approval, private backups and download paths are unchanged. Existing error/busy/closed/reset paths clear both DOM and retained current-entry signatures. No edit history, timers, debounce, persistent storage, additional dependency or external request is introduced.

The implementation uses standard DocumentFragment insertion and Node.insertBefore with an explicit node-or-null anchor. Unchanged nodes are not moved. References: https://developer.mozilla.org/en-US/docs/Web/API/Node/insertBefore and https://developer.mozilla.org/en-US/docs/Web/API/Element/replaceChildren .

## Completed correctness evidence

Nine focused Node tests passed locally and in the isolated release. They cover unchanged nodes, end/middle edits, insertion/deletion/duplicates/reordering, title/destination/source changes, nested syntax properties, root replacement, failed-render atomicity, fallback and a 1,500-block repeated-edit case. A separate local real-DOM stress check passed 2,000 deterministic mutations with a synthetic block renderer; it is not full application acceptance.

The permanent manual test `python3 scripts/export_preview_reuse_browser.py` then passed **358 exact real-renderer DOM comparisons** across WordPress, Word, HTML, Markdown, title choices, linked-image mode, Unicode/CRLF and source changes. A 57,538-character, 1,150-block article needed just one new block render after its final paragraph changed. An existing focused link remained focused when a different block changed. Closing, reopening, invalidating and replacing the preview cleared stale references and matched fresh full-render output.

An actual native input in the integrated writing workspace retained **899 of 900** displayed export blocks, replaced the one changed paragraph, matched the original renderer's markup and cleared export approval immediately. The focused script reported no errors, unexpected requests or source changes; its 320/390/1440 checks found no page overflow.

The full source-bound release gate passed separately: complete Node suite, static checks, **59 browser checks**, **379 layout checks**, **37 document benchmark cases**, local WordPress 7.1.3 **13/13 save/reopen cases**, and the Media Library scenario with two uploads and three placements. The independent WordPress receipt and source-snapshot checks passed. No overall Node test count is asserted.

## Controlled typing results

Twenty serial, unprofiled runs used unique near-limit rich article blocks and 31 native insertions per run, in before/after/after/before order for each case. Both versions used identical built assets except `export-preview-controls.js`; the new helper was present but unused by the baseline. Existing parsing and export implementations were held constant.

Values below are synchronous input-handler milliseconds. Medians are medians of the two run medians; p95 ranges retain both run p95 values, not pooled-population statistics.

| Unique rich article | Before median | After median | Before p95 range | After p95 range | Before worst | After worst |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| WordPress, panels open | 115.10 | 77.30 | 132.4 to 144.0 | 90.4 to 97.2 | 145.5 | 115.2 |
| Word, panels open | 112.35 | 78.60 | 133.0 to 141.9 | 89.9 to 93.1 | 149.0 | 95.7 |
| HTML, panels open | 115.70 | 74.90 | 132.0 to 132.8 | 87.2 to 89.7 | 148.7 | 107.4 |
| WordPress, panels closed | 26.45 | 26.95 | 35.8 to 36.5 | 37.3 to 39.3 | 38.3 | 42.8 |
| Markdown, panels closed | 6.25 | 5.80 | 10.7 to 11.4 | 9.9 to 10.9 | 14.3 | 12.4 |

Open-panel median reductions were approximately **32.8% WordPress, 30.0% Word and 35.3% HTML**. Both observed p95 ranges and worst samples improved in those targeted cases. The closed WordPress control became slightly slower, including a worse maximum; retain that negative result. The closed Markdown control also varied. These controlled observations are consistent with removing full-preview DOM work, not proof of universally faster behavior.

This pass deliberately uses unique blocks, unlike the previous repeated-block report. Do not compare absolute timings across the two hosts/corpora or multiply their reported percentage improvements. These measurements start inside the input listener and end at the synchronous listener boundary or next animation-frame callback. They omit event queueing, actual paint, initial preview opening, whole-article paste latency, physical devices and real users. The main reading preview and live full-article formatting checks still perform work and remain separate optimization targets.

## Evidence and reproduction

[Committed observed summary](evidence/export-preview-reuse-summary-20261017.json) retains every paired-case summary, frame timing, worst result, focused contract result and source identifiers. It explicitly is not a copy of individual raw samples.

[Original immutable receipt](https://ab51bd20-drafttopage.nolankido.workers.dev/_dtp_preview_reuse_20261017.json): 57,349 bytes, SHA256 `0e4bfdf25f2b7626aa24c29bf1410e2d094dc141d6747e80e5e3325e4d69cf51`. It contains all individual timing samples. Its bounded HTML receipt pages expose the same values for readers that omit JSON body text. Diagnostic commit `8a1d73b4b87f1313588207917af60ed55b428a7b` in temporary PR #127 contains the exact ABBA harness and original controller fixture. Run those tools only in an isolated checkout; never merge the build hook, test installer, baseline or generated receipt pages.

No GitHub Actions, scheduled jobs, provider activation, accounts, tracking or automatic publication. Native Cloudflare deployment and independent live-byte verification are recorded separately in the release PR.
