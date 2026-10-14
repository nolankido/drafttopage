# Section organization release

The public writing desk previously offered heading navigation but required cutting and pasting complete sections to reorganize an article. The outline now has Move up and Move down controls beside each displayed heading.

A move swaps adjacent same-level siblings within the same parent. Each section includes its deeper subsections, and opening writing before the first heading stays in place. The parser recognizes ATX headings outside fenced code. It does not implement every Markdown extension. Inter-section and terminal newline slots remain in place, preserving length and final-newline behavior even when the final section has no newline. Text inside each section is preserved.

Moves capture the previous validated workspace through the existing in-tab revision mechanism before changing the body. A checkpoint failure blocks the edit. Approval clears and old draft findings are discarded. Existing version-1 workspace backups and public exports retain their schemas and private-content boundaries. No server, persistent browser storage, or AI service was added.

Only adjacent siblings among the forty displayed outline headings can move. Controls stop during file reads and when any code fence is unfinished. Event handlers reject stale body snapshots. After moving, focus stays on the moved section's corresponding action, or its heading navigation button when that action reaches a boundary. Buttons use heading-specific accessible names and wrap in narrow layouts.

Review findings, link entries, and headings now share the wrapped-text selection measurement already used by article search. Exact source selection survives a geometry failure. Clearing an empty workspace also removes cached outline nodes while the panel is closed.

## Validation

All 177 local Node tests and source checks for 22 HTML pages passed. Eleven new tests cover parent boundaries, nested moves, CRLF and mixed line endings, Unicode selection offsets, final sections without newlines, maximum article size, fenced code, reversible swaps across varied section writing, checkpoint preservation of private source/questions, approval and findings invalidation, stale/busy/failed edits, keyboard focus contracts, closed-panel clearing, and visible-heading limits. Controller tests use an event fixture and do not establish browser rendering.

The manual browser fixture includes section moves, approval clearing, focus, unfinished-fence blocking, wrapped finding navigation, and closed-panel clearing. The full fixture requires a local Chromium executable. Live validation and the native Cloudflare release are recorded separately in the pull request; do not treat fixture source or its Python syntax check as an executed browser suite.

GitHub Actions workflows remain absent. Validation is local/manual and publishing uses the existing native Cloudflare Git integration.
