# Readable article revision comparison

The earlier evaluation rated revision recovery and comparison 6/10 after in-tab checkpoints were added. Full saved/current fields supported recovery, but authors still had to inspect long text side by side to discover changes. This release adds a read-only Article changes view inside Revisions.

The comparator uses exact line tokens, including newline characters, Unicode, empty lines, and missing final newlines. Common prefixes and suffixes are removed before a longest-common-subsequence alignment with a maximum 160,000-cell Uint16 matrix. Larger changed regions use an explicitly labeled grouped removal/addition fallback. Matching lines inside that region may appear changed, so its counts are not presented as a minimal edit script.

Change groups identify saved-line removals and current-line additions with text labels and version-specific line numbers. Text remains inert DOM data, and wrapping avoids a fixed-width horizontal layout. At most forty changed groups are displayed. Each default preview is capped at eight lines or 800 characters, without splitting Unicode surrogate pairs; a notice and collapsed complete-passage control expose the full change deliberately. Complete versions also remain in the existing field comparison. This is a line comparison, not word-level editing, merge assistance, factual verification, or automatic approval. Only article bodies enter this view; private source/questions can still be compared separately using the existing field selector.

The optional comparator and controller load independently of the core desk. Load or installation failure leaves complete field comparison and recovery available. Processing waits for both comparison panels to be open, caches identical article pairs, clears stale nodes before deferred rendering, and purges text when history is cleared or current writing cannot be validated. Source-only edits do not rerender unchanged article differences.

No checkpoint, approval, writing, backup schema, public export, AI call, persistent storage, or external dependency is introduced by opening the comparison. Restore retains its existing confirmation and displaced-version recovery.

## Validation

All 190 local Node tests and source checks for 22 HTML pages passed. Thirteen new tests verify exact edit locations, reconstruction of both original strings, an independent exhaustive subsequence oracle, CRLF/blank/final-newline cases, Unicode/repeated/hostile text, large grouped comparisons and common-edge trimming, invalid-input bounds, deferred rendering/caching, checkpoint changes and clearing, inert labels/data, visible-group and preview limits, full-text expansion data, and recoverable comparison failure. Existing revision controller tests cover independently copied article-only pairs and invalid/cleared comparison state. Python fixture syntax and Git whitespace checks passed. These event fixtures do not establish browser rendering.

The local Playwright fixture includes approval-preserving comparison, exact displayed passages, private-note exclusion, clearing, and a blocked optional-module case that retains full comparison and checkpoint restoration. Local Chromium remains unavailable; fixture source and its Python syntax check must not be reported as an executed full browser/mobile suite. Native Cloudflare publication and direct live checks are recorded separately in the pull request.

GitHub Actions workflows remain absent. Validation stays local/manual, and the existing native Cloudflare Git deployment is preserved.
