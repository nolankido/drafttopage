# Defer unrequested export construction during long-article editing

The current editor's update path recomputes WordPress block HTML on *every body edit*, even when review approval is unchecked, and builds a complete general publishing kit whenever More export options is open, even if the kit's own panel is closed. These are large Markdown and HTML transformations with no visible or actionable output on the editing path.

## Bounded change

1. The active WordPress destination retains all body-validation, approval, status, copy/download and code-preview controls. Its expensive createWordPressArticle call now runs during an approved update, not on ordinary text input after approval has been cleared. Prior to approval, the visible readiness message says that the blocks will be prepared after review. Opening the approved code panel or checking approval still displays the exact complete current-source output.
2. General publishing-kit construction is deferred until **both** More export options and the complete-kit details are open. Those disclosure toggles perform a fresh synchronous update. A hidden kit list, stale approval, or active file operation keeps the kit download disabled. The download click additionally checks that its panel is open, then independently rebuilds the ZIP using the original validated serializer.
3. WordPress handoff findings, optional fields, guided repair controls, title handling, linked-image consent, export preview, Word/HTML checks, standalone source exports, private backups, and all serialization algorithms are otherwise unchanged. No debounce, promises, timers, remembered article cache, external requests or bypasses to approval.

## Verification

Existing regressions require byte-identical WordPress clipboard and real local WordPress save/reopen with Image Library. New focused tests inject counting compiler functions and verify no compiler calls for six unapproved near-limit edits, fresh/cleared approval-linked block previews, no kits in collapsed panels, changed-source recomputation, and invalid approved source rejection.

**Release evidence must be recorded after execution.** The exact development source commit, complete Node/browser/WordPress tests and any measured typing results belong in the PR. This source-level change alone does not prove lower field INP, physical-device typing latency or a consistent improvement in p95.

No GitHub Actions, scheduled tasks, paid integrations, tracking, customer content, outreach or live publishing.
