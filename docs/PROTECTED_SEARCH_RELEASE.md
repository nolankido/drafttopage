# Protected article search and whole-word replacement

Release marker: `protected-search-20261016`.

## Problem and result

The existing Find & replace searched every literal substring in the article source. A terminology change could therefore alter a code example, image path, link destination, or part of a longer word. This release makes a conservative protected scope the public default across all seven writing workspaces and adds optional whole-word filtering. Entire Markdown source remains an explicit choice for deliberate syntax edits.

The scanner marks exact UTF-16 source positions without normalizing or rewriting the article. It excludes recognized fenced, indented, and inline code; entire bracketed groups and link/image destinations; reference definition paragraphs; broad bare URLs; escaped punctuation; angle-bracket markup; and raw script/style/pre/textarea/code elements with contents. A query touching any protected position is excluded in full. The scanner has an operation budget and never silently falls back to unprotected search. No Markdown compliance or universal syntax-safety guarantee is made.

Protection is deliberately conservative. Ordinary bracketed asides, some nested or indented prose, adjacent URL punctuation, and text following unclosed constructs can be skipped. Ordinary text between non-raw HTML tags is eligible. Replacement text is still literal Markdown source and can introduce formatting. Authors should inspect the reading preview and destination before approving an export.

Whole-word filtering rejects a match next to Unicode letters, numbers, combining marks, connector punctuation, or joiner characters. It keeps original textarea offsets, including astral characters and CRLF. Apostrophes and hyphens separate words. This is a Unicode boundary filter, not language-aware segmentation, spelling equivalence, or normalization. Whole-word exclusions are counted before protection exclusions so the counts do not overlap.

## Editing and recovery

The native scope select and whole-word checkbox are labelled, keyboard operable, and included in the live search status, bulk preview, and preview signature. Scope-specific confirmation explains which source regions are included. Changing article text, query, replacement, case, scope, or whole-word settings invalidates a pending bulk change before apply, even if no change event fired.

Search, previews, cancellation, and no-op replacements keep writing and approval. An actual edit first captures the previous validated workspace, then clears review approval. Checkpoint failure blocks the edit. Existing 60,000-character article, 200-character query, 500-character replacement, and five-example limits remain. Imports, workspace/checkpoint restore, and desk clear purge temporary search values and reset the new options. Source notes, private review notes, metadata, and the version-1 backup schema are unchanged.

No new dependency, external service, account, upload, AI request, tracking, persistent storage, billing, DNS change, or GitHub Actions workflow is introduced. Publication uses the existing native Cloudflare Git integration. The project retains its in-development status.

## Validation

Targeted tests cover exact protected bulk output across Markdown/HTML constructs, escaped/nested delimiters, malformed and unclosed syntax, conservative exclusions, source mode compatibility, Unicode boundaries and original offsets, disjoint counts, 60,000-character adversarial inputs, scope-specific confirmation, checkpoint retention, and stale option changes. Existing search tests continue to cover cancellation, no-op edits, bounds, approval, busy state, checkpoint failure, literal replacements, IME behavior, and clearing.

All 629 Node tests passed. Static checks passed for 28 HTML pages, JavaScript syntax, local imports, assets and anchors, accessible references, protected routing, storage/logging guards, and absence of GitHub Actions workflows. The native scope select uses full-width, bounded sizing and a 44-pixel minimum height. Direct live validation is recorded with the release pull request. A source or controller test is not a screen-reader, real-mobile, or third-party destination certification.
