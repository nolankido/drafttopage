# Nested lists and ordered starting values

## User outcome

Writers can take a hierarchy of single-line bullets and numbered subpoints into native editable WordPress List and List Item blocks. A checklist beginning at 4 keeps that starting value, and a nested numbered list can begin at 7. The same structure appears in the reading preview, formatted HTML copy, plain-text copy, reading files, and publishing kits. This closes a manual rebuilding gap; acquisition and retention impact remain unmeasured.

The fictional working sample and the generated converter example now demonstrate mixed nested lists and continued numbering. Editor guidance, the supported-format matrix, publishing help, and kit instructions state the implemented limits. Original body Markdown, imports, explicit backups, and revisions keep their existing formats and unchanged source. Approval still clears after edits, and copying/exporting does not publish.

## Bounded subset

- Bullets using -, *, or + and ordered markers ending in . or ). Items must contain text on one physical line. Ordered markers have at most nine digits; starts from 0 through 999999999 are supported.
- Each new nesting level adds two or four spaces. Outdenting must match an active parent level. Mixed bullet and numbered child lists stay attached to their parent item. At most six levels and 200 items are converted in a continuous group; blank lines start a new group.
- Ordered markers must be consecutive or all 1 for ordinary Markdown automatic numbering. Inconsistent numbers, invalid indentation, empty items, tab indentation, multiline blocks inside items, excess depth, and excess item count reject the complete candidate group. Every source line remains visible as text; no item is silently discarded; inconsistent numbering is kept as source rather than normalized. The handoff finding selects the original first line using unchanged UTF-16/CRLF positions.
- Task checkboxes remain literal text with a review finding. Orphan indented lists, quoted lists, and code fences stay outside this parser. This is a limited subset, not full CommonMark/GFM list parsing. Safe inline formatting is reused; source HTML, block comments, images, and unsafe links remain inert.

Preview and reading files use semantic ol/ul/li elements, preserve ordered start attributes, and use bounded indentation. WordPress receives its own list markup and destination styling. Themes, plugins, and mobile layout still need author inspection.

## Validation

234 Node tests pass. New coverage includes unchanged flat-list representation, mixed nested ownership, starting values, zero, repeated-1 numbering, valid outdenting, invalid/empty/multiline preservation, six-level/200-item boundaries, fences/orphans, exact Unicode/CRLF findings, native nested comments, hostile content, plain-text hierarchy, semantic DOM and stale-node removal, unchanged kit Markdown, and private-field exclusion. Existing independent ZIP CRC and file-content checks pass.

Static checks pass across 23 HTML pages: syntax and imports, links and anchors, accessible references, routing/hosting configuration, privacy guards, and absent Actions workflows. Whitespace checks and Python browser-fixture compilation pass. The expanded browser fixture covers sample nesting, start attributes, native list-item source, actual reading download, malformed-source preservation, exact finding selection, approval resets, and 1440/390/320 layouts. Execution is blocked by missing Chromium, so mobile behavior remains unverified.

Before release, the official WordPress Gutenberg demo accepted the generated 830-character fixture as four native List blocks containing seven List Item blocks. Its visual DOM preserved starts 4 and 7 and the expected three-level hierarchy. A grandchild item was edited from Keep uncertainty to Keep uncertainty carefully without losing those starts. No invalid-block or validation warning was observed. This is evidence for that editor, not every WordPress installation.

A local 200-item kit took about 10 ms to prepare and contained 24535 bytes. A local 1000-group review took about 11 ms with zero format findings. Membership scanning advances through ordered source ranges rather than searching every range per line. These are local measurements, not cross-device performance guarantees.

Live deployment and desktop evidence are recorded in the release PR. Use the existing native Cloudflare Git integration. No GitHub Actions, cron, tracking, new account, external service, paid resource, AI call, persistent draft store, or automatic publishing is introduced.

Reference guidance: [WordPress List block](https://wordpress.org/documentation/article/list-block/), [core block attributes and relationships](https://developer.wordpress.org/block-editor/reference-guides/core-blocks/), and [List Item relationships](https://github.com/WordPress/gutenberg/blob/trunk/packages/block-library/src/list-item/README.md).
