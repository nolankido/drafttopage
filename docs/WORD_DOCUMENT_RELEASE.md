# Editable Word document export

Release: `word-document-tool-20261014`.

Writers can now take an article into an editable .docx file, adding a useful result for people continuing their writing outside a website editor. The free `/markdown-to-word/` entry page gives that task a clear starting point and shares the established workspace. This is an acquisition hypothesis, not measured traffic or retention growth.

## Resulting behavior

Word document (.docx) is available in the destination selector on every public writing workspace. The Word route selects it initially and after sample, import, restore, and clear. Only the article is required by default. Title inclusion is explicit and requires a valid title. Writing and title-choice changes clear approval. An actual reviewed download generates the file locally; inactive, unapproved, busy, or invalid states cannot download it.

The existing bounded Markdown parser supplies paragraphs, line breaks, bold/italic runs, code, H1 through H6 heading styles, native lists and nesting with explicit start values, simple header tables, and safe absolute hyperlinks. The optional separate title uses the Title style. Word body H1 retains its authored level. Lists retain the existing six-level/200-item bound; tables retain twelve columns/100 data rows, alignment, and escaped pipes. Numbering instances keep parent and child sequences distinct. Tables have repeating header rows, bounded content-based column widths, padding and borders, and no forced row heights. Text uses Letter pages and standard margins; code uses a common monospaced font.

Unsupported Markdown, source HTML, images, malformed list/table candidates, and math syntax remain text. Direct .docx import, images, macros, embedded documents, comments, tracked changes, research, and automatic publishing are not added. The reading preview does not simulate Word pagination. Authors should inspect their actual editor, especially fonts, numbering, and page breaks.

Page metadata, source notes, audience, purpose, profile, private review notes, checkpoints, approval, and preferences are excluded. No author metadata is generated. Only the body and an explicitly included title enter the package. The unencrypted document is distinct from a workspace backup; a user's article can itself contain private information.

## Implementation boundaries

`public/word-export.js` creates WordprocessingML parts and only safe hyperlink relationships. All authored text is escaped as XML text; unsupported XML characters and incomplete Unicode are rejected without rewriting the draft. No field instructions or source markup execute. `public/word-controls.js` enforces the explicit download and current readiness.

The existing deterministic stored-ZIP writer now has a private shared writer and two distinct entry points. Publishing kits retain their original flat text filename restrictions. The Word entry point accepts exactly six named package parts, including content types and relationships; arbitrary names, missing parts, duplicates, executable parts, and sizes above 4 MiB are rejected. Fixed archive timestamps do not represent edit history. No production dependency, upload, network conversion, persistent browser storage, tracking, account, AI request, or GitHub Actions workflow is added.

The package follows Microsoft's documented [WordprocessingML structure](https://learn.microsoft.com/en-us/office/open-xml/word/structure-of-a-wordprocessingml-document), native numbering overrides, and repeating table headers. Structural tests are not a complete standards conformance certificate.

## Validation and limits

- All existing tests passed with the new route before dedicated Word coverage. The expanded tests independently read ZIP/CRC and XML, check relationships, list starts and hierarchy, styles and table headers/widths, safe links, literal source, Unicode/size limits, private exclusions, package allowlists, controller approval/busy/reset states, and public discovery/data-use copy.
- Two production-exporter fixtures opened through python-docx and rendered through the documents skill's LibreOffice renderer. All five final page PNGs were inspected. The formatting fixture covers nested starts 4/7, headings, emphasis, safe hyperlinks, a table, quote, code, and literal source markup. The three-page fixture retains all 42 table rows, repeats headers, and keeps the final paragraph visible. A code-font fallback and table spacing issue found during render review were corrected and all pages re-rendered and inspected.
- The local browser fixture now includes real Word download, independent XML inspection, title handling, source exclusion, destination changes, backup restore, and responsive layouts. Its execution remains blocked by the missing Chromium headless binary; mobile and screen-reader tests remain unrun.
- Production build and live desktop download evidence are recorded in the release PR after publishing. Microsoft Word and Google Docs application rendering are not directly verified; LibreOffice rendering and structural/byte checks are the executed document evidence.
