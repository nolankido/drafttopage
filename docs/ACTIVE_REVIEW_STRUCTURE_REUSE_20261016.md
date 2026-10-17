# Active export review structural reuse

This is the next bounded engineering improvement under [original roadmap item 15](ROADMAP_STATUS_20261016.md). Source base: production `4338b5e2629c7764a8382cfe52fefaf8db27b08c`.

## Problem and change

Before this change, the active WordPress, Word and HTML formatting review independently asked the draft review, the image inspection, and the source-line reviewer to parse the same Markdown article structure. In a near-limit article this duplicated structural work on each edited body. The image inspector also parsed a whole article when the source did not contain any possible Markdown image introducer (`![`).

The review now creates **one current-body `articleStructure`** and shares it with the draft, image and source-line checks. The image scanner first rejects invalid inputs and null characters as before, but returns immediately when no `![` sequence appears. A candidate of any kind still receives the existing exact inline scan. List and table scans, warning text, source offsets, ordering, 40-item display, and the separate approval and export rules remain unchanged.

This does **not** retain drafts across edits, defer warnings, introduce a new cache or timer, skip active linked-image consent, or change what goes into a WordPress kit. Browser recovery and downloaded private workspace schemas remain unchanged. Closing or switching a destination continues to clear its existing derived inspection state.

## Explicit evidence boundary

The `tests/fixtures/review-export-before-reuse.js` module freezes the original review control flow for test-only comparisons. The new regression suite compares complete findings, start/end offsets, warnings, counts and truncation across WordPress (linked images on and off), Word and HTML, including Unicode, CRLF, escaped/inline/standalone images, code fences, nested lists, malformed tables and near-limit articles. Image scanning and draft scanning are independently compared with and without supplied structure. Invalid and image-free inputs must preserve the original behavior.

Reducing duplicate parsing is a deterministic source-level improvement. It is **not** a demonstrated field latency gain or a verified p95 reduction. The earlier high-tail and changing-host measurements in [the long-article diagnostic](LONG_ARTICLE_PERFORMANCE_20261016.md) and [the link-scan study](LINK_SCAN_FAST_PATH_20261016.md) remain unresolved. A [matched, source-pinned ABBA Chromium diagnostic](REVIEW_AB_PERFORMANCE_20261016.md) has now run with twenty sequential near-limit browser cases and exact before/after modules. It retained all observed p95 regressions and a Markdown negative control, which improved despite not using the optimized review. That result does **not** isolate a causal speedup or establish improved tail, device, or field performance. The benchmark tool and [complete synthetic evidence](evidence/review-ab-performance-20261016.json) are reproducible, but actual user-facing latency remains unverified.

## Release scope

No GitHub Actions, scheduled jobs, new dependencies, customer content, tracking, accounts, provider calls, paid services, live WordPress publishing or external outreach. Human/mobile/assistive-technology and hosted WordPress acceptance still require genuine external sessions and remain NOT_RUN. The separate current-source release/preview outcome is recorded in the pull request.
