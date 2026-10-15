# Linked images for WordPress

Release: `wordpress-linked-images-20261014`

## User outcome

Writers previously had to rebuild every Markdown image after taking blocks into WordPress. The shared public workspaces now provide **Images for WordPress**, with a text-only reference inventory and an explicit **Include supported linked images in WordPress blocks** option. The choice feeds block copying, source inspection, block downloads, handoff findings, and the complete six-file WordPress kit consistently.

The option defaults off. It converts a complete standalone `![Alternative text](https://example.com/photo.jpg)` paragraph into a native `wp:image` block with a fixed `wp-block-image` figure and escaped image URL/alt attributes. It creates no attachment ID, file bytes, Media Library entry, caption, crop, dimensions, or featured image. Empty authored alt text is preserved with a specific review finding; the writer must decide whether a meaningful description or deliberately decorative image is appropriate.

Only absolute HTTPS URLs accepted by the existing protected web-link validator are allowed. Credentials, spaces, unsafe characters, relative/non-HTTPS URLs, quoted titles, reference syntax, inline images among prose, images in headings/lists/quotes/tables/links, and four-space or tab indentation are outside this conversion. Code images are not inspected. Unsupported syntax stays complete as text, with actionable findings where recognized. No URL is repaired automatically. Validated raw paragraphs are split before reading-parser CR normalization, preventing a malformed URL containing CR from silently becoming an active image reference.

## Explicit privacy and state boundaries

No image file is requested or displayed in Draft to Page. Inventory entries and code inspection use text nodes/textarea values only; the production CSP and local rendering model are unchanged. Selected linked images can request their URLs when the exported blocks are opened in WordPress or a browser. They are references to files elsewhere, not uploads. Use public files with publication permission, inspect them in WordPress, and use Upload to Media Library when a copy should be stored on the destination site.

The local reading preview, standalone reading page, HTML source, rich-text copying, and Word documents keep image syntax as text. Markdown preserves its references. They are not visual previews of linked images.

Changing the image option clears approval and temporary publishing-checklist completion. Body edits, leaving WordPress, import/restore/sample/clear, and applying or clearing a publishing profile reset it. Panel toggles and exact source navigation preserve writing and approval. Closed/hidden inventories are purged, busy operations cannot change mode or export through these controls, and stale buttons recheck current body/destination before selecting offsets. Optional controls failing to load leave default literal-image exports usable.

All current v1 workspace, collection, and profile formats are unchanged. Private files keep image references as article text but do not keep the linked-image option. No new persistence, tracking, account, dependency, upload, provider/API call, cost, GitHub Actions workflow, or Actions job is added. Existing native Cloudflare Git deployment is preserved.

## Handoff records

At most 40 references are rendered on screen. All recognized references appear in an explicit text download and in the kit's existing REVIEW.txt. Every eligible reference is converted when selected, without an undisclosed conversion cap. The kit retains exactly six files and its existing ZIP whitelist and size bound. Its original Markdown body preserves exact whitespace/CRLF, while the reading page remains inert. README.txt discloses the selected mode, possible destination requests, unsupported content, alt review, and Media Library steps. Image URLs/alt text themselves can be private; source notes, private questions, history, and auth fields are excluded.

## Validation

- 360 Node tests passed, including 15 image tests and a publishing-profile regression. Coverage includes HTTPS/credential rejection, raw CR and exact Unicode offsets, unsupported contexts, escaped attributes, empty-alt findings, default/off behavior, current mode propagation, later findings beyond many images, unchanged private formats/other exports, read-only inspection, stale/busy/reset behavior, bounded DOM/full inventory, profile ticks, and privacy.
- An independent Python HTML parser checked generated figure/img attributes, balanced block markers, and inert hostile source. Existing independent ZIP tests still validate the six-file archive. Image kits are deterministic.
- Static checks passed for 25 HTML pages, browser imports, syntax/assets/anchors/accessibility references, storage/network guards, protected routes, and no Actions workflows. Python fixture compilation and whitespace passed.
- The browser fixture now includes both image modes, actual block/plan/ZIP downloads, no image network requests, source/privacy checks, reset/destination behavior, optional-controls failure, and 1440/390/320 layouts. The fixture is unrun because its required Chromium executable is absent. Mobile, screen-reader, and actual WordPress editor import checks remain unrun.
- Live desktop verification and native Cloudflare build results are recorded in the pull request after publication. A source-validated Image block is not a guarantee of every WordPress version, theme, or plugin's behavior.

## Sources and product hypothesis

Reviewed the official [Image block documentation](https://wordpress.org/documentation/article/image-block/), [Gutenberg save.jsx](https://github.com/WordPress/gutenberg/blob/trunk/packages/block-library/src/image/save.jsx), and [block.json](https://github.com/WordPress/gutenberg/blob/trunk/packages/block-library/src/image/block.json) on October 14, 2026, Hawaii time. The linked-file/Media Library distinction and minimum serialization follow these primary sources. This implementation is independent and claims no WordPress partnership.

The hypothesis is that supporting common article images reduces manual handoff work for repeat publishers. User acquisition, retention, and willingness to pay remain unmeasured. No customer or performance result is invented.
