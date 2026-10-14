# WordPress handoff review and publishing kit

## User outcome

Writers can inspect local, line-specific handoff findings before copying blocks, jump to the current source passage without changing it, and take a six-file WordPress package. Optional excerpt, slug, and SEO description are copied separately and remain outside the body. Empty optional fields do not prevent block copying or a kit.

The package includes wordpress-blocks.html, the exact original article-body.md, reading-page.html, page-details.json, REVIEW.txt, and README.txt. Review line numbers refer to the exact Markdown body, including leading whitespace and CRLF. Title/body are required for the kit. Optional field bounds are validated through the same explicit public-field whitelist used by the existing publishing kit. An empty or invalid slug receives a disclosed safe suggestion in the package; the editor field is kept.

## Review behavior

The review combines existing placeholder, duplicate passage, structural, image, and unsupported-link checks with limited conversion diagnostics for H1 changes, indented lists/code, alternative list markers, task-list syntax, non-1 list starts, tables, source HTML/angle-bracket links, reference links/footnotes, strike-through, setext markers/separators, and nested quote formatting. Code fences and inline code are excluded from syntax scanning. URL targets are masked. Checks do not verify facts, grammar, permissions, or live URLs, and do not certify an article with no findings.

The first 40 findings are rendered with a total and truncation disclosure. Unicode and CRLF positions use the unchanged editor string. Buttons recheck the body/title signature and destination before applying a selection, preserve approval, and do not rewrite text. Edits refresh findings. Closing the panel or changing destinations removes hidden finding nodes and file-list nodes. Clearing/restoring resets the controller. Existing version-1 workspace backups remain unchanged and exclude these temporary results and export preferences.

## Validation

- 205 Node tests pass, including current source positions, skipped literal code/URLs, bounded findings, stale-selection rejection, read-only inspection, optional field copies, invalid field/body bounds, unchanged source, and private-field exclusion.
- An independent Python ZIP reader checks CRCs, safe fixed paths, UTF-8 metadata, and exact bytes of all six files. Packages are deterministic and use the existing 512 KiB stored-ZIP limit.
- Static checks cover 22 HTML pages, syntax/imports, links and anchors, accessible references, protected routing, privacy restrictions, and absent GitHub Actions workflows. Browser fixture compilation and whitespace checks pass.
- Worst-case local kit preparation was measured with 12,000 bracket characters (104 ms), 2,000 short HTML-like lines (11 ms), and 12,000 Unicode characters (8 ms). These are local observations, not device-wide performance claims. Full kit content is generated for an open file list or an explicit download; closed-panel readiness uses only field validation.
- WordPress block serialization is unchanged from the prior release, which was manually validated in the official Gutenberg demo. Field mapping was checked against official WordPress post settings and excerpt documentation. Theme/plugin differences still require destination inspection.
- The expanded browser fixture includes findings selection, the approval-gated six-file download, optional field editing, stale-node clearing, and 1440/390/320 layouts. The local browser suite is unexecuted because Chromium is unavailable. Live desktop findings are recorded in the PR after deployment; direct clipboard/download-byte inspection may be limited by Browser Use's separate virtual clipboard/filesystem.

## Operations

Use the native Cloudflare Git deployment through a feature branch and PR. No GitHub Actions workflow or schedule is added or enabled. No account, external API request, provider activation, tracking, persistent storage, paid service, or automatic publishing is added. Source notes, review questions, revisions, and sign-in fields stay outside the WordPress kit. Article text and page metadata can still contain private information and need author review before sharing. Acquisition and repeat-use impact remain unmeasured.
