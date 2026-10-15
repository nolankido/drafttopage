# Guided table editing

Release: `guided-table-editor-20261014`.

## Product decision

Word tables already convert into the supported article format, but changing a cell, row, or column requires pipe-table Markdown. This improvement addresses a concrete finishing task for writers bringing existing drafts: edit the table in a grid and inspect the result before updating the article. Acquisition, retention, and willingness to pay remain unmeasured.

## Implemented behavior

- All five public workspaces include Add or edit table. Choose a recognized article table, use the article cursor inside a table, or create a blank two-column/two-data-row table at the article end. Unsupported tables are selected for direct source editing without replacing their source.
- Edit column headers, alignment, and individual cell contents. Insert or remove rows/columns, including between existing ones. Removing populated preparation asks for confirmation; the article is kept until apply. At most twelve columns and 100 data rows are supported. Only ten data rows are mounted at a time, while all prepared rows remain in memory. Input nodes are kept during ordinary typing to preserve caret/focus. Controls from an obsolete rendered grid cannot mutate a new grid.
- Cells accept one line of up to 2,000 characters, with supported inline Markdown. Oversized bulk pastes reject in full. Changed tables trim cell edges and escape literal pipes, then round-trip through the existing table parser. Unsupported backslash/pipe combinations, invalid shapes, blank new/changed headers, overflow, and multiline/oversized cells reject without replacing writing. There is no invented header, dropped cell, merged-cell support, new production dependency, or repair of cell URLs.
- Preview provides a reading table and exact source before/after. Applying saves previous valid writing as an in-tab checkpoint, then changes only the complete table range (or appends a separated table), preserving all surrounding UTF-16/CRLF source. Review approval and the linked-image option clear after changes. Exact no-ops preserve authored source, approval, and history. Whole-table removal has a separate preview and ignores pending cell edits.
- Body changes invalidate the target and purge the preview while retaining prepared cells. Explicit recheck uses the table currently selected by the user; its complete source must match the original table exactly. Repeated tables are never guessed. A new-table recheck explicitly moves its append location to the current article end. Changed original table content refuses recheck and keeps preparation. Closing purges previews and keeps prepared cells; discard keeps article writing and approval.
- File operations block actions. Checkpoint or preview failures keep article/preparation. Unsaved table work contributes to exit/replacement guards and is excluded from unchanged v1 backups, checkpoints, collections, profiles, and article exports. Full writing replacement clears it. Applied tables use the existing article body field and export through existing Markdown/WordPress/HTML/Word paths.
- No upload, destination request, AI call, persistent browser storage, external service, account, tracking, scheduled task, or GitHub Actions workflow. Prepared reading links navigate only when selected; source HTML/images remain inert. Native Cloudflare deployment integration is retained.

## Validation

442 Node tests passed, including independent HTML and DOCX ZIP/XML parsing, table round trips, source-range preservation, CRLF/Unicode, immutable row/column changes, bounded pagination, stale-grid controls, explicit rechecks, repeated/changed tables, checkpoint failure, preview failure, removal, no-op/discard, and unchanged private formats.

Static and live desktop/download results are recorded in the pull request after validation and deployment. Automated Playwright scenarios require Chromium; actual WordPress/Word application rendering, mobile browser operation, and screen-reader testing remain unrun. GitHub Actions remain stopped.
