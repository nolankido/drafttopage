# Destination-specific formatting review

Release: `export-format-review-20261016`.

## Problem and decision

WordPress had a detailed handoff review, but Word and HTML exports offered only general guidance about unsupported formatting. A writer could approve a reading preview without receiving the same exact-passage warnings for those destinations. This release extends that review to the Word and HTML paths across all seven public workspaces.

The shared scanner now lives in `public/export-review.js`. WordPress keeps its public API, existing linked-image option, 40-finding bound, source selection contract, and separate kit report. The Word and HTML controls use the same bounded checks with destination-specific messages rather than duplicating the scanner or borrowing inaccurate WordPress wording.

## Behavior

- Word retains body heading levels 1 through 6 and includes a separate Title paragraph only when selected. HTML changes body H1 headings to H2 and includes a separate title H1 only when selected. The review states that actual handling, and repeated-title findings follow the current include-title option. Word does not receive a false H1-to-H2 warning.
- Findings identify some unsupported or unselected images, source HTML, reference links/images and Markdown footnotes, strike-through, checkbox markers, malformed lists and tables, nested quote structure, heading changes, and unfinished writing patterns. Fenced and inline code, URL contents, and escaped syntax remain protected. The checks are limited and do not certify an article, fetch images, verify web addresses, or check facts, grammar, or permissions.
- The review appears after the destination selector and before Word/HTML export controls. Its summary and title guidance follow the selected destination. The status is deliberately not a live region, avoiding repeated announcements while typing.
- Inspect line selects the exact UTF-16 source range in the current article, including repeated passages and CRLF/Unicode input. It focuses and reveals the selection without changing writing or approval. The selected destination, title option, title, and body are rechecked before any saved position is used. Busy operations block navigation and report actions.
- Up to 40 findings are shown, with the total count and an explicit truncation message. Unchanged article/options preserve button nodes through editor blur. Closing the panel, invalid input, changing to another destination, resetting, or replacing the workspace clears hidden findings and report text as appropriate.
- Copy formatting review and Download formatting review create an explicit, separate plain-text report with current line numbers, destination, title handling, findings, and the scope of the checks. Article approval is not required for this report, while article exports retain their existing approval rules. Clipboard failure exposes a current read-only fallback. A change during clipboard permission is reported as a previous-version copy.
- Reports exclude private source notes, private review questions, revision history, and approval. They are not inserted into article exports, kits, backups, collections, or profiles. Original export bytes and private file schemas are unchanged. A report downloaded before an edit can become outdated.
- Narrow layouts wrap controls and long finding text and retain a 44 px minimum button height. No dependency, account, tracking, network request, paid service, AI activation, persistent browser storage, workflow automation, or hosting change is added.

## Verification and limits

Fourteen new tests cover destination-specific findings and title handling against the actual Word and HTML generators, WordPress linked-image compatibility, protected syntax, exact Unicode/CRLF positions, repeated passages, bounded deterministic reports, invalid inputs, private schema exclusions, stable controls, stale positions, busy state, explicit report copying/downloading, clipboard denial and pending permission, report purging, and all seven generated workspaces. Existing WordPress and converter tests remain in the release suite.

Run the full Node suite, static checks, and diff checks before publishing through the existing native Cloudflare Git integration. GitHub Actions remain off. Live QA after publication covers Word/HTML destination changes, exact passage selection, title handling, report download and content, actual exported Word/HTML files, private-field exclusions, and the inactive review when choosing Markdown. Source checks cover responsive rules; actual mobile-device, screen-reader, and native Word-editor rendering are not claimed.
