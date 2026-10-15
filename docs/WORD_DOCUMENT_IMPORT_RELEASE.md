# Previewed Word document import

Release: `word-document-import-20261014`.

## Problem and result

Writers with an existing Word draft previously needed a formatted clipboard selection or an HTML export. The writer and all three converters now open a selected plain .docx directly, entirely in the tab. The automatically staged conversion shows a reading preview, exact Markdown, page fields, and notices. A fresh acknowledgement is required before the existing checkpointed replacement flow. Selecting, previewing, or cancelling does not change the current article or approve an export.

An opening title heading moves to the title field through the existing article importer. Article fields and review questions are replaced only on apply; current source notes are retained. Valid displaced writing is checkpointed before replacement, approval is cleared, and pending file bytes/previews are purged after success. A refused confirmation or failed checkpoint keeps both current writing and the pending conversion. File, text, format, and header-choice changes invalidate acknowledged previews. A selected Word file can be previewed again after changing the table-header choice.

## Supported content and explicit limits

- Ordinary paragraphs, heading styles/outline levels through six, bold/italic runs, line breaks, safe absolute HTTP(S) hyperlinks, simple bullets/decimal numbering, and simple rectangular header tables.
- Lists preserve ordinary starts, nesting, and continuation using Word numbering definitions. Missing parents, custom/lettered numbering, unusual restart rules, and over-limit groups are rejected. Existing Markdown bounds remain six levels and 200 items per group.
- Tables retain marked first-row headers. An unmarked first row requires the explicit column-header choice before conversion. Merged/nested/uneven tables and lists in cells are rejected. Existing bounds remain twelve columns and 100 data rows.
- Images/objects become visible text placeholders. No image bytes, alt-image interpretation, external resources, or embedded files are loaded. Explicit hidden text is omitted with notice.
- Main article only. Headers, footers, comments, document properties, page layout, fonts, colors, and unsupported inline styling are excluded or simplified. Keep the original and compare.
- Tracked changes, fields such as automatic tables of contents, footnotes/endnotes, equations, unsupported content wrappers, and ambiguous packages are rejected before replacement. This is article conversion, not a Word round-trip editor.

## Package and data handling

`docx-archive.js` validates classic single-disk ZIP metadata before reading selected parts: at most 8 MiB input, 256 entries, 32 MiB declared expansion, 2 MiB per selected XML part, and 4 MiB selected XML in total. Stored and raw DEFLATE are supported, including data descriptors. Duplicate/unsafe paths, overlapping/trailing local entries, inconsistent headers, encryption, unsupported methods, ZIP64, macros, and missing standard parts fail closed. Only the six canonical content-type/relationship/document/style/numbering XML parts can be decompressed. Streaming output is bounded against the declared size, then length, CRC32, UTF-8, and XML preflight checks apply. Other package bytes are never decompressed or extracted.

`docx-import.js` parses XML in detached documents with no DTD/entities. Namespace-aware structure, required main content type and relationship, style inheritance, numbering, node/depth bounds, and supported content are checked. It creates a detached, application-owned semantic HTML tree and passes it to the existing bounded Markdown converter. Original XML nodes never enter the live page. Reading previews use only the existing inert Markdown renderer.

The optional Word converter loads on file selection. Browsers without raw DEFLATE support retain formatted-selection import as a fallback. No production dependency, upload, persistent storage, tracking, account, AI request, private-format change, or GitHub Actions workflow is added. Original bytes and pending conversion state are excluded from every backup/export. Existing v1 workspace/profile/collection contracts remain unchanged.

## Validation

Local unit and static checks, browser fixture availability, independent-document QA, publication, and live results are recorded with the release PR. The new browser fixture imports an actual Word export through real DOMParser and the file control, then checks acknowledgement, cancelled replacement, source retention, approval reset, preview purge, and layout. An independently created fictional python-docx file is used separately from repository-native exports.

Do not treat fixture/XML compatibility as proof of import testing in Microsoft Word, Google Docs, or the WordPress editor. Real mobile and screen-reader sessions remain separate unless explicitly recorded.

## Format references

- [Microsoft: WordprocessingML document structure](https://learn.microsoft.com/en-us/office/open-xml/word/structure-of-a-wordprocessingml-document)
- [Microsoft: numbering properties](https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.wordprocessing.numberingproperties)
- [Microsoft: paragraph style identifiers](https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.wordprocessing.paragraphstyleid)
- [WHATWG Compression Standard](https://compression.spec.whatwg.org/)
