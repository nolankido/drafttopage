# Private Word comment recovery

Word article import previously discarded editorial comments. A separate recovery action now lets a writer inspect comment text, download an explicitly acknowledged private report, and optionally retain eligible comments as private workspace review notes.

## Behavior and boundaries

- Ordinary Word conversion still does not read the comments part. Recovery reads only three exact XML paths from the selected local document, using the existing bounded ZIP reader, CRC checks, fatal UTF-8 decoding, detached XML parsing, and complexity limits.
- The standard comment relationship and content type must match the canonical internal comments path. Missing or ambiguous parts, duplicate IDs, unsupported content, and oversized feedback stop optional recovery while keeping the staged article.
- Recovery retains plain run text, tabs, line breaks, and paragraph boundaries in file order. It includes unanchored definitions and possible replies. It deliberately makes no claim to preserve anchors, thread structure, resolved state, authors, dates, formatting, hyperlink targets, or visibility rules. Comment text hidden by Word styling may be included, and the UI and private acknowledgement disclose this.
- Up to 100 comments are supported, with one to ten ordinary paragraphs and 4,000 UTF-16 characters per comment, up to 100,000 characters overall. Comment XML is bounded to 2 MiB per part and selected XML to 4 MiB. Feedback is never shortened to meet limits.
- A separate acknowledgement enables downloading the unencrypted private text report. The report contains comment IDs and text, with no article or workspace source fields.
- Including comments as review notes is unchecked by default and available only for replacement when all notes fit the existing twelve-note, 500-character limit, including ID labels. Inclusion clears the import acknowledgement. Existing checkpoints protect displaced writing through the ordinary replacement path.
- Insertion keeps existing review notes and disables comment inclusion. Larger feedback can still use the separate private report.
- Included notes use the unchanged private backup schema and remain excluded from article files and publishing kits. Temporary recovery text, report choices, and source references are purged when the import is applied, cleared, or replaced. Failed and stale asynchronous recovery cannot replace current writing.

The reader follows Microsoft's description of the standard comments collection and comment elements: https://learn.microsoft.com/en-us/office/open-xml/word/how-to-retrieve-comments-from-a-word-processing-document. This is a bounded text-recovery workflow, not a Word conversation renderer or revision editor.

## Verification

New focused tests cover text fidelity, exact relationships/content types, duplicate and invalid identifiers, unsafe and complex content, limits, explicit XML reads, lazy preparation, private download acknowledgement, note bounds, all article export exclusions, private backup round trips, insertion/busy/stale guards, failure/discard cleanup, and all seven built tool pages. The full Node suite, static site checks, native Cloudflare build result, and live fictional-file evidence are recorded in the pull request.

No service, paid resource, API request, browser storage, account connection, publishing automation, dependency, or GitHub Actions workflow is added. The site remains in development.
