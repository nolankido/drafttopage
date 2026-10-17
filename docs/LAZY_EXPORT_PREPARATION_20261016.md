# Defer unrequested export construction during long-article editing

The current editor's update path recomputes WordPress block HTML on *every body edit*, even when review approval is unchecked, and builds a complete general publishing kit whenever More export options is open, even if the kit's own panel is closed. These are large Markdown and HTML transformations with no visible or actionable output on the editing path.

## Bounded change

1. The active WordPress destination retains all body-validation, approval, status, copy/download and code-preview controls. Its expensive createWordPressArticle call now runs during an approved update, not on ordinary text input after approval has been cleared. Prior to approval, the visible readiness message says that the blocks will be prepared after review. Opening the approved code panel or checking approval still displays the exact complete current-source output.
2. General publishing-kit construction is deferred until **both** More export options and the complete-kit details are open. Those disclosure toggles perform a fresh synchronous update. A hidden kit list, stale approval, or active file operation keeps the kit download disabled. The download click additionally checks that its panel is open, then independently rebuilds the ZIP using the original validated serializer.
3. WordPress handoff findings, optional fields, guided repair controls, title handling, linked-image consent, export preview, Word/HTML checks, standalone source exports, private backups, and all serialization algorithms are otherwise unchanged. No debounce, promises, timers, remembered article cache, external requests or bypasses to approval.

## Verification

Existing regressions require byte-identical WordPress clipboard and real local WordPress save/reopen with Image Library. New focused tests inject counting compiler functions and verify no compiler calls for six unapproved near-limit edits, fresh/cleared approval-linked block previews, no kits in collapsed panels, changed-source recomputation, and invalid approved source rejection.

## Completed validation and measured results

The first isolated diagnostic [PR #121](https://github.com/nolankido/drafttopage/pull/121) was **FAIL**, not accepted: a second existing `/write/#sample` browser fixture filled the body before the asynchronous sample had finished loading. It saw the sample's no-findings status instead of its attempted article's warnings. The feature branch added an explicit completion wait before that operation, consistent with the earlier sample fixture. No runtime behavior was weakened or output validation skipped.

The corrected, separately nonmerging [diagnostic PR #122](https://github.com/nolankido/drafttopage/pull/122) completed with a [source-bound PASS receipt](https://validate-deferred-export-builds-rerun-20261016-drafttopage.nolankido.workers.dev/_dtp_lazy_export_probe_20261016.json): focused regression, complete Node suite, static checks, 59 browser checks, 379 layout checks, source snapshot, local WordPress 7.1.3 Author-role 13/13 native save/reopen cases, and the actual local Media Library scenario (two PNG/JPEG uploads, three image placements). No browser errors or unexpected requests were reported. The feature was tested with its exact production runtime change; the diagnostic differs only by disposable build and timing scripts. The four temporary files must never be merged.

The [complete 16-run synthetic performance evidence](evidence/lazy-export-typing-ab-20261016.json) compares the exact previous `export-controls.js` blob `5104563` to the new code blob `b2300ec`, holding all other built public assets constant. Each case ran **before, after, after, before** with 31 native Chromium insertions per run. These are medians of two run medians and paired p95 ranges, not pooled-user statistics:

| Scenario | Before median sync ms | After median sync ms | Before p95 range ms | After p95 range ms |
| --- | ---: | ---: | ---: | ---: |
| Rich WordPress, export panels closed | 44.75 | 30.35 | 53.9 to 79.8 | 41.7 to 47.7 |
| Rich WordPress, export panels open | 238.8 | 219.1 | 260.2 to 303.7 | 243.3 to 338.0 |
| Rich Markdown, panels closed (control) | 4.55 | 4.45 | 6.7 to 7.0 | 6.9 to 7.6 |
| Rich HTML, panels open | 188.7 | 175.1 | 215.1 to 235.2 | 209.5 to 212.7 |

Closed-panel WordPress synchronous input median was **32% lower**, and its observed p95 ranges improved in both measured orders. With WordPress panels open, median was **8% lower** but one p95 and maximum were worse (worst observed sync input 327.4 ms before versus 387.6 ms after). The Markdown control was nearly unchanged. Frame-callback timings, worst cases and every individual run are preserved in the JSON artifact. This is meaningful synthetic evidence for deferred unrequested preparation, **not** proof of better real-user INP, physical-phone responsiveness, or universal p95 improvement. Some work remains unavoidable while full live review and kit panels are open.

The permanent feature PR includes only the public controller, new Node regression, the one-line asynchronous sample-fixture wait, this documentation, and fictional test receipts. Native Cloudflare production merge and verification are recorded separately in the release PR.


No GitHub Actions, scheduled tasks, paid integrations, tracking, customer content, outreach or live publishing.
