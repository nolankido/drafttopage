# Previewed reference-link conversion

Release: `reference-links-20261016`.

## Problem and resulting behavior

Reference-style Markdown links previously stayed raw in the reading preview and formatted exports. The current article now exposes Convert reference-style links below the preview whenever candidate syntax is present. Preparation expands supported full, collapsed, and shortcut references into the ordinary inline links already supported by preview, WordPress, HTML, Word, Markdown, and publishing kits. This deliberately changes article source after review; reference definitions are not silently interpreted by all renderers.

The preview reports expanded links, definition lines to remove, definitions kept, and items to inspect. It shows up to five before/after examples, forty findings, a safe reading preview, and the complete exact proposed Markdown. Current writing and approval stay unchanged until the author acknowledges and applies. Apply checkpoints the original article before changing the body, clears export approval, and returns to the current reading preview. A failed checkpoint keeps the original article and proposal. Discard leaves writing and approval intact.

## Supported subset and bounds

Definitions must be single lines at the left edge, in a paragraph containing only definition lines. Identifiers start with an ASCII letter/digit and contain at most 80 letters, digits, spaces/tabs, periods, hyphens, or underscores. Matching ignores case and collapses internal spaces. Destinations are safe absolute HTTP(S) URLs of at most 2,048 characters, optionally surrounded by angle brackets, without credentials or quoted titles. Parentheses and pipes in destinations are encoded for inline/table representation. Visible labels fit 300 characters and are accepted only when the existing parser verifies one complete supported inline link, retaining supported label formatting.

The converter handles at most 200 definition candidates and 1,000 reference uses. Output must fit the existing 60,000-character article limit; nothing is truncated. Changes use exact original UTF-16 positions and preserve all source outside explicit replacement/deletion ranges, including CRLF and final-line text.

Duplicate identifiers are ambiguous and stay unchanged. This conservative policy intentionally differs from CommonMark's first-definition precedence. Relative destinations, unsafe URLs, non-ASCII identifiers, titles, multiline/container definitions, nested labels, images, and Markdown footnotes need manual review. Fenced code, indented lines, and lines containing inline source HTML are excluded from expansion. Source HTML blocks, malformed inline links, and unclosed or multiline bracket syntax stop the whole preparation rather than interpreting definitions or references inside an unsupported structure. Unresolved items remain in source and are disclosed.

The removal option starts checked and is shown before preparation. Only a definition used by at least one expanded reference is eligible for removal. A conservative residual-bracket scan retains it if other syntax still mentions its identifier, including image references, code examples, escaped brackets, and unsupported positions. Unused and unresolved definitions remain. Authors can turn removal off to retain every definition. No unrelated blank lines are cleaned up.

## Implementation and privacy

`reference-links.js` plans bounded source edits using the existing passage and inline parsers, safe URL validation, and Maps for identifier lookup. `reference-link-controls.js` owns the optional staged UI. Body/title changes, definition-choice changes, full workspace/article replacement, and clear discard stale proposals and acknowledgements. File reads and pending imports block preparation and apply. Optional-module failure leaves direct editing and all existing tools available.

Only applied article text enters the existing export and private-backup contracts. Proposed output, examples, findings, and acknowledgements are temporary and excluded from backups, profiles, collections, and article exports. Source/review notes are unchanged and remain excluded from article exports. Source HTML and images stay inert. No URL is loaded or verified, and no dependency, account, persistent storage, tracking, AI request, paid service, scheduled job, or GitHub Actions workflow is added. Existing native Cloudflare Git deployment is preserved.

## Technical reference and verification

[CommonMark 0.31.2](https://spec.commonmark.org/0.31.2/#link-reference-definitions) documents full, collapsed, and shortcut reference links, identifier matching, and link definitions. This tool implements the disclosed bounded subset and source-edit preview, not complete CommonMark conformance.

Tests cover all three forms, safe formatted labels, identifier normalization, independent exact Unicode/CRLF results, selective definition retention/removal, hostile/ambiguous/unsupported sources, code/image protection, table-safe URLs, exact count/output limits, existing export families, unchanged private schemas, staging/acknowledgement, checkpoint failure, stale/busy/pending states, discard/reset, and accessible public markup. Executed checks, native deployment, and live fictional-article evidence are recorded in the release PR. Real-mobile and assistive-technology execution remain separate from source checks; acquisition and monetization outcomes remain unmeasured.
