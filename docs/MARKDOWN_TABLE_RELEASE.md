# Editable Markdown tables

## User outcome

Simple pipe tables now render as tables in the public reading preview, formatted HTML clipboard representation, standalone reading files, and native WordPress Table blocks. The plain-text clipboard representation uses tab-separated columns. Body Markdown, explicit backups, imports, and revisions keep their existing formats and exact source. WordPress kits keep the exact original Markdown alongside converted blocks and reading HTML.

This closes a manual rework gap for writers who bring comparisons or summaries to the converter. The working fictional sample and generated input/output example demonstrate a table. Homepage, editor help, converter format guidance, publishing help, and kit instructions describe actual support. No customer demand, usage increase, indexing improvement, or retention result is claimed.

## Supported subset and preservation

- One header row, a delimiter row with at least three dashes per cell, and zero to 100 data rows. Up to 12 columns. Leading and trailing outer pipes are optional, but every table row needs a structural pipe and the same number of cells.
- Colons in delimiter cells set left, center, or right alignment. Escaped pipes are decoded inside cells, including inline code. Existing safe inline formatting and absolute HTTP(S) links are reused.
- Mismatched columns, short delimiters, excess rows or columns, and indented continuation rows reject the entire candidate. Every original line stays visible as text. No cell is silently discarded, padded, or partially converted. The WordPress handoff adds a source-specific finding with unchanged UTF-16/CRLF positions.
- Fenced code, quoted tables, indented table headers, and ordinary escaped-pipe prose stay outside table conversion. Merged/multiline cells, nested tables, source HTML tables, and complete GFM behavior are not implemented. Blank lines and other block boundaries end a table.
- Source HTML, images, block comments, and unsafe links remain inert even inside a supported table. Conversion fetches no resource, makes no AI call, and stores no draft persistently. Author review and the existing export approval gate remain required.

Preview and reading tables have scoped column headers, alignment classes, and a labeled keyboard-focusable horizontal scrolling region. Wide tables scroll inside that region. WordPress receives its own native figure/table markup and destination styling; the author's theme and mobile view still need inspection.

## Evidence

221 Node tests pass. New tests cover cells/alignment/escaped-pipe parity, Unicode and CRLF, one-column/header-only tables, malformed-source preservation, exact findings, row/column limits, code/quote boundaries, hostile content, safe DOM construction and stale-node removal, accessible reading markup, formatted text, exact kit Markdown, and private-field exclusion. Existing independent ZIP CRC/file-content checks pass.

Static checks pass across 23 HTML pages, including syntax/imports, links/anchors, accessible references, routing/hosting settings, privacy guards, and absent GitHub Actions workflows. Python browser-fixture compilation and whitespace checks pass. The expanded browser fixture exercises sample tables, headers, alignment, escaped pipes, WordPress source, a reading-file download, malformed-input preservation, approval reset, and 1440/390/320 layouts. Execution remains blocked by missing Chromium; mobile behavior is not verified.

Before release, an 820-character generated fixture was imported into the official WordPress Gutenberg demo's full Code editor. Visual editor recognized one native Table block with three header cells and two data rows, preserved scope="col", left/right/center classes, bold text, inline code, and an escaped pipe. Editing one body cell from 2 to 27 succeeded. No invalid-block or validation warning was observed. This demonstrates compatibility with that editor, not every WordPress version or theme.

Live deployment and desktop workflow results are recorded in the release PR. Use the existing native Cloudflare Git integration. No GitHub Actions workflows, cron, tracking, new external service, paid resource, account requirement, or automatic publishing is introduced.

Reference guidance: [GFM table syntax](https://github.github.io/gfm/#tables-extension-), [WordPress Table block schema](https://github.com/WordPress/gutenberg/blob/trunk/packages/block-library/src/table/block.json), and [WordPress Table block documentation](https://wordpress.org/documentation/article/table-block/). This implementation intentionally uses the stricter limits above rather than all GFM rules.
