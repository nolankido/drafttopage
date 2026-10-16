# Continue from a reviewed import to export

This continuation develops original roadmap item 5, simpler first conversion, from main `451825efe8166607a9a59eaeb0b88d9d2b3d674c`. The WordPress Visual-editor handoff shipped in PR #102. This change addresses the preceding transition inside Draft to Page.

## User flow

The Word to WordPress, Word to Markdown, Google Docs to WordPress, and HTML to Markdown routes already show a readable conversion preview, exact converted text, and conversion notices. Previously their apply action always focused the Markdown editor and expanded the source-notes pane. The existing Export navigation could reach the handoff separately, so a second reading preview was not technically mandatory.

Reviewed replacement imports now offer two explicit choices:

- **Import and continue to export** applies the article and opens the currently selected export destination. The destination control receives focus and its heading scrolls below the workflow bar. Source-notes visibility is preserved.
- **Import and edit** applies the article and focuses the editor for changes.

The first choice requires a nonempty article body. It is offered only on those four source-conversion routes and only in replacement mode. Ordinary imports in the writing desk and Markdown tools retain their editor destination. Insertions retain their separate location preview and return to the inserted selection in the editor.

## State and recovery

Both choices share the existing apply path. Required conversion and unmapped-field acknowledgements, current Word/HTML options, busy checks, replacement confirmation, and checkpoint preparation remain in force. Declining replacement or failing checkpoint preparation keeps the current article and pending import without continuing.

Continuation runs only after the replacement succeeds and the original source, import preview, optional recovered comments/images, and temporary source URL are discarded. Running navigation before that cleanup would still see an unfinished import and reopen its preview.

Article fields and explicitly selected private comment notes are applied exactly as in ordinary replacement. Existing source notes are retained. Current destination and publishing-profile choices are preserved. The existing change handler clears export approval; temporary checklist completion resets when writing or preferences change. Continuation neither writes to the clipboard nor downloads a file. The writer still inspects destination options, checks export approval separately, and chooses an actual copy or download action.

The optional new controls are tolerated when older cached markup lacks them, preserving the existing edit action. Clearing a preview hides continuation. A failed new formatted paste can retain an earlier visible preview while disabling application. Missing, stale, or failed candidates cannot continue; the event handler independently checks eligibility.

## Retained validation

The importer unit coverage exercises acknowledgement, stale conversion options, busy and empty states, cancellation, checkpoint failure, exact application, cleanup before continuation, edit-first behavior, and insertion isolation. It uses the existing Word, HTML, and insertion harnesses.

`scripts/import_continue_acceptance.py`, included by the normal browser gate, exercises all four source routes with actual Word-file selection or native fixture clipboard paste. It checks the complete Enter gesture, destination focus and value, exact article preservation, notes visibility, pending-source cleanup, cancellation, narrow layouts, unchanged clipboard and absent downloads before approval, actual copied/downloaded bytes after approval, and return to editing. The focused command is:

```sh
CHROMIUM_EXECUTABLE=/path/to/chromium python3 scripts/browser-smoke.py --import-continue-only
```

The retained WordPress round-trip runner uses the primary continuation action for its imported-document cases before separate approval and native clipboard handoff. Its existing exact saved-content, editable-block, private-field, save/reopen, and second-edit checks remain required.

The release PR records the frozen source digest and tree, complete manual release-gate result, exact merge, and native Cloudflare deployment outcome. There is no new dependency, provider, tracking, GitHub Actions workflow, or hosting change.

## Limits

This establishes a direct, tested navigation choice. It does not measure task completion, time saved, abandonment, or repeat use. Real-writer sessions, current source-application captures, physical-device clipboards, assistive technology, and hosted WordPress configurations remain separate acceptance work. The ten-person study is still NOT_RUN. No parser compatibility or document-fidelity expansion is claimed by this change.
