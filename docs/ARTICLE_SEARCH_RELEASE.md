# Literal article search and protected replacement

Release marker: `article-search-20261014`.

## Selected gap and result

The earlier product evaluation rated editing/import usability 7/10 and accessibility/mobile usability 6/10. Formatting and optional checks existed, but authors could not navigate repeated text or preview bulk edits in the article field. This release improves that specific editing task. It does not claim a full assistive-technology/mobile audit or activate the private AI pilot.

Find & replace opens an inline panel next to the current article. Search is literal, with optional exact-case matching and non-overlapping substring matches. Previous/next navigation wraps and selects exact textarea offsets. Enter/Shift+Enter in the query navigates without intercepting an active IME composition. Default case matching uses browser Unicode rules rather than source lowercasing that could change offsets. No locale-specific spelling or normalization is promised.

Replace selected match verifies that the author still has that current occurrence selected. Bulk replacement needs an explicit preview and confirmation. The preview reports the number of matches that actually change, resulting article length, and at most five inert context examples; the confirmed edit applies to the entire article. Markdown, code, and link addresses can also change and require review.

Search/preview preserve approval. Actual replacements capture the previous validated workspace before writing, then clear approval and stale check results. Identical replacements do not change writing or create history. Empty replacement deletes the chosen text. Invalid data and growth past 12,000 characters are rejected before mutation. If checkpointing fails, replacement is blocked. Source/review notes and all article metadata are retained.

Article/query/case/replacement edits invalidate pending bulk previews. Imports, full workspace/checkpoint restores, and clearing purge query/replacement values and preview snippets. The unchanged version-1 backup contains writing fields only. Search state is excluded from backups and exports. No persistent storage, upload, AI request, timer, dependency, account, tracking, or GitHub Actions workflow is added.

## Validation

- All 166 local Node tests passed. New coverage includes literal metacharacters, dollar replacement text, Unicode positions/case, non-overlap, navigation/wrap, deletion, no-op counts, preview bounds, independent split/join output comparison, full article bounds, stale preview invalidation, approval preservation, selection changes, cancellation, busy state, checkpoint failure, private source retention, IME handling, clearing, optional module load/installation failure, and inert selection measurement with cleanup.
- Controller tests use minimal event-bearing controls and do not substitute for browser rendering.
- Source checks validate generated pages, syntax, local imports, assets/links, accessible references, protected routes, storage/logging restrictions, and absence of Actions workflows.
- The browser fixture suite is extended to cover real selection, replacement, recovery, downloads, hostile replacement strings, approval behavior, clearing, and expanded 1440/390/320-pixel layouts. Chromium remains unavailable locally, so no expanded-suite pass is claimed. Direct live checks follow native Cloudflare publication.

GitHub Actions remain stopped. Native Cloudflare Git publishing is separate. Genuine provider acceptance, destination compatibility, real-mobile testing, and independent screen-reader/security audits are separate work.

## Direct live checks

The initial search feature was published through PR #14 (`231072ba4b5aea6d6bbbac83f462ac3b6b729d95`), followed by independent optional loading in PR #15 (`5d949502d08edb3a8d69b52a3f36d81f7e8924a7`). Both native Cloudflare builds succeeded. A fresh live writing desk initialized its core controls and then enabled search.

Fictional writing verified exact case-insensitive selection, Enter/next navigation, literal dollar-sign replacement of one occurrence, checkpoint restoration, three-match bulk preview, invalidation after changing case settings, cancellation preserving approval/writing, and confirmed replacement preserving title/source/review notes while clearing approval. The actual downloaded body was independently checked: 79 bytes, with all edits and no source/review text.

A maximum-length wrapped-paragraph test selected the correct final occurrence but exposed an offscreen selection. Navigation now measures wrapped text in a temporary, inert, screen-reader-hidden mirror and removes it immediately. It uses the actual text-area width/font/padding, rather than newline counts. Exact selection still works if layout measurement is unavailable. The browser fixture includes the 12,000-character end-of-paragraph case. Final long-paragraph/clear verification follows publication of this fix.

## Optional feature loading

The search controller loads independently after the core desk initializes. Search controls stay disabled while loading. A rejected request or installation failure leaves writing, formatting, review, exports, and recovery available, and displays an unavailable message within the search panel. Source validation also checks local dynamic-import paths. This avoids turning an optional editing-tool load failure into an unusable workspace.
