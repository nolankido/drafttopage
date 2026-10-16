# Referenced Word footnotes and endnotes

Release: `word-notes-20261016`.

## Problem and resulting behavior

An otherwise supported Word article containing a footnote or endnote was rejected. The shared .docx importer now resolves ordinary note references and appends their text to clearly labeled article sections. All Word import entry points use the same conversion, preview, acknowledgement, and explicit apply flow.

Visible markers use `[Word footnote N]` or `[Word endnote N]`. Footnotes and endnotes have separate numbering in first visible reference order, with repeated references reusing the same label. Matching H3 labels appear below Imported Word footnotes/endnotes H2 sections. The original Word numeric identifiers are lookup keys, not display numbers. Original numbering formats, superscripts, page-bottom placement, native note objects, and clickable note links are not reproduced. Conversion notices and public help explain the change before apply and require marker/text comparison. Combining articles or editing labels needs a fresh manual check.

Each referenced note can contain one to ten ordinary paragraphs, supported inline emphasis, and safe absolute HTTP(S) links. Note links use that note part's own relationships. They never fall back to document relationships with a matching relationship ID. Standard automatic note marks are removed only inside their matching note kind. Fields, custom marks, nested note references, repeated/wrong automatic marks, images/objects, headings, lists, tables, tracked changes, and unsupported note structures reject the conversion before replacing writing.

## Bounds and validation

The import supports at most 100 referenced notes, 1,000 visible references, and 200 ordinary definitions across both note parts. A referenced note must have visible text and fit 4,000 converted characters. Main article plus appended sections must fit the existing 60,000-character bound. No excess text is silently truncated.

The ZIP reader's exact allowlist expands from six to ten XML paths: footnotes.xml, endnotes.xml, and each part's relationships are added under word/. Existing 8 MiB compressed-file, 256-entry, 32 MiB declared expansion, 2 MiB selected-part, 4 MiB selected-XML, CRC, UTF-8, DTD/entity, and archive-path checks remain. Shared XML-tree complexity and tracked-change checks cover note parts as well.

Each note part requires exactly one supported internal document relationship, the matching root namespace/name, and an unambiguous matching content-type declaration. Duplicate identifiers, missing note targets, unsupported paths, external part relationships, and missing or malformed parts fail closed. Separators and unreferenced note text do not enter the article. References inside explicitly hidden runs do not select their notes. A note-conversion error identifies the affected imported label without echoing note contents.

## Exports and privacy

Imported Word note text is article content and deliberately enters Markdown, WordPress blocks, HTML, Word, publishing kits, backups, and collection snapshots wherever the current article body is used. Word output retains ordinary labeled sections, not native footnote parts. Private workspace source notes and review questions remain separate and excluded from article exports. Backup and profile schemas are unchanged.

Original ZIP/XML and pending conversion results remain temporary. Existing apply/clear/restore behavior removes them. Images and other unselected parts remain unread by ordinary conversion. No external resource, account, upload, persistent browser storage, tracking, dependency, AI request, paid service, or automatic publication is added. Existing native Cloudflare Git deployment is preserved, and GitHub Actions remain absent.

## Technical references

Microsoft's Open XML documentation describes the reference-to-note identifier relationship and distinguishes that identifier from automatic display numbering. It also documents note content and non-conformant nested references:

- [Footnote reference](https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.wordprocessing.footnotereference?view=openxml-3.0.1)
- [Footnote content](https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.wordprocessing.footnote?view=openxml-3.0.1)
- [Endnote reference](https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.wordprocessing.endnotereference?view=openxml-3.0.1)

## Verification

Tests exercise independently parsed XML, actual stored/deflated archives, mixed and repeated references, part-specific links, unsafe text, hidden/orphaned notes, malformed relationships and types, identifier ambiguity, empty/complex notes, exact count/size limits, all article export families, backup preservation, staged acknowledgement, failed-preview invalidation, and public guidance. `npm test` passed all 539 tests. `npm run check` passed across 28 HTML pages, syntax, assets, links/anchors, accessible references, browser imports, protected routing, storage/logging guards, and the absence of Actions workflows. `git diff --check` passed. Native deployment and live desktop evidence are recorded in the release pull request. Mobile and assistive-technology execution remain separate from source checks.
