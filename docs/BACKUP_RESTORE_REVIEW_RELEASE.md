# Review private backups before restoring

Release: `backup-restore-review-20261016`.

## Problem and decision

Choosing a valid private workspace file previously led directly to replacement after a generic confirmation. A visitor could not first inspect an older article, source notes, review notes, or blank fields that would clear current writing. Revision recovery improved the ability to undo replacement, but the restore decision still lacked a concrete comparison.

This release adds review before replacement to the shared recovery flow. It addresses an existing editing and recovery gap without persistent storage, a paid service, or private-pilot activation. It makes no claim about measured retention, traffic, revenue, or assistive-technology certification.

## Behavior

- All seven public workspaces and the inactive private-pilot markup share the staged restore. Selecting a file validates its entire existing version-1 schema and 512 KiB limit. It changes no writing, export approval, consent, or checkpoint history.
- A focused review heading introduces the selected filename and a summary of fields that would change or become empty. A selector compares exact current and proposed source fields, page fields, article body, and private review notes. Review notes use explicit JSON list boundaries to distinguish embedded numbered lines from separate notes.
- An optional reading preview uses the existing bounded inert article renderer. Filenames and source text are data. Source HTML never executes, images never load, and safe article links open only when selected.
- Applying requires a current acknowledgement and replacement confirmation. Current writing edits update the comparison and reset acknowledgement, including an edit missed by earlier refreshes. A matching file is a no-op. Invalid current fields block replacement until corrected.
- Article imports must finish or be cleared before restore. Busy file operations block apply. Reading a backup does not block plain typing; the comparison uses the current writing when reading completes.
- The public desk requires the revision controller and checkpoints valid current writing before its first field mutation. A failed checkpoint retains current writing and the staged file. Success clears approval and preferences through the established replacement path, reports the recovery location and any bounded-history eviction, and purges the file preview. The inactive private pilot gains review without claiming checkpoint history.
- Discarding removes the staged private contents without changing current writing or approval. Public full-workspace replacement and clear also purge the preview. Clear/sign-out behavior in the inactive pilot purges it. A late asynchronous file read cannot reintroduce a discarded preview.
- Pending previews contribute to exit warnings. No preview data is added to backups, collections, profiles, checkpoints, exports, URLs, network requests, logs, or persistent storage. Private source fields remain excluded from article exports.
- Comparison columns stack below 650 px, controls wrap, and the reading preview has no nested scroll restriction on narrow screens. The focused heading uses the measured sticky-navigation offset. The local status announces changes without making full private writing a live region.

## Validation

Twelve new behavioral and source tests cover staging, private-field comparisons, empty-field warnings, required acknowledgement, cancellation, checkpoint recovery, synchronous clear/refresh ordering, stale approval, malformed/oversized input, busy and pending imports, failed checkpoints, identical files, explicit discard, asynchronous invalidation, invalid current fields, source-only backups, inert markup, and review-note list boundaries. Generated-page assertions cover the seven public workspaces and the shared inactive pilot contract.

Run the full Node suite, static page checks, and diff checks before publication. Native Cloudflare Git deployment remains the publication route. GitHub Actions stay off. Live QA after deployment must cover selected-file preview, changed-writing acknowledgement, cancellation, restore, recovery of displaced writing, private backup round-trip, and output exclusion. Source checks cover responsive rules; no actual mobile-device or screen-reader session is claimed.
