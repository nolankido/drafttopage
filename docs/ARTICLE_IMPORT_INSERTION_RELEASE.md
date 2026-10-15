# Combine article imports

Release: `article-import-insertion-20261014`.

## Product decision

Writers can bring existing Word documents, HTML/formatted selections, Markdown and article JSON, but each import replaced the whole article. This change supports assembling a post from several drafts or sections without manually copying converted Markdown or replacing existing page details. It is a usefulness and retention hypothesis; acquisition, demand and willingness to pay remain unmeasured.

## Implemented behavior

- Insert more writing appears beside the existing article editing tools in all five workspaces. It opens the shared importer in append mode. Existing candidates remain available. The conversion preview offers replacement, insertion at the current article cursor/selection, or addition at the article end. Replacement retains its existing confirmation, checkpoint and full-replacement behavior.
- Insertion uses only the converted body, optionally adding the imported title as a literal level-two heading. Existing title, excerpt, description, filename, source fields and private review questions are preserved. Incoming page details and questions are explicitly excluded. Conversion and unmapped-field acknowledgements still gate apply, including Word imports.
- Preview captures the exact current article and range. Cursors must sit between complete blocks; selections must span complete blocks. Partial paragraphs, lists, tables and code fences, split UTF-16 surrogate pairs and split CRLF boundaries reject without expanding the selection. Whole blocks can be deliberately replaced. Appending after an unfinished fence or inserting an unfinished imported fence rejects. Repeated source is never searched or guessed.
- Exact source before/after includes paragraph separation. Imported line endings follow the article's CRLF style when present; every source character outside the selected range is retained exactly. The combined article remains bounded to 60,000 characters. No truncation or automatic structure repair occurs.
- Applying captures the previous valid workspace before changing the body. A checkpoint failure keeps the writing, conversion and preview. Body changes clear approval and the WordPress linked-image choice. Exact no-ops skip the callback and preserve source, approval and history. Existing image, link, table and passage-review preparation remains in memory and follows its normal stale-context guard instead of being silently discarded by a fragment insertion.
- Article changes invalidate and purge old insertion source while keeping the converted candidate. Mode/title/source changes also require a fresh location preview. There is no automatic rebinding. Clearing an import purges its insertion source; pending conversion and locations stay outside unchanged private v1 files, collections, profiles and article exports. Import lifecycle changes refresh the exit-warning work signal.
- No production dependency, schema change, content upload, destination fetch, account, AI call, tracking, persistent browser storage, scheduled task or GitHub Actions workflow is added. Native Cloudflare deployment integration is preserved.

## Validation

Tests cover exact source preservation, Unicode/CRLF, block boundaries, paragraph separation, complete-block replacement, repeated passages, stale locations, code fences, literal title punctuation, combined limits, source/title/destination invalidation, busy states, conversion acknowledgements, mandatory checkpoint failure, no-op/discard, unchanged private files, and independent HTML/DOCX structure. Live and final test counts are recorded in the release pull request after verification.

The browser smoke fixture includes insertion, stale-location recovery, exported content, field preservation, checkpoint creation and narrow-layout scenarios. Automated fixture execution depends on Chromium availability. Actual WordPress/Word application rendering, real mobile operation and screen-reader testing require separate checks; do not infer those from source or export-structure tests.
