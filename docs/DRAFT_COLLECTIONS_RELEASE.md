# Private draft collections

Release: `draft-collections-20261014`.

The next repeat-use hypothesis is managing several articles without juggling a separate workspace backup for each one. This release provides a small, explicit, portable collection within the existing memory-only public workspace. No retention or acquisition improvement is claimed as measured.

## User behavior

The writer and all three converters have a native Keep several articles in a private collection disclosure above the editor. A collection holds up to eight named saved workspaces and 2 MiB of serialized JSON. Add current writing as a new saved article captures the existing version-1 private workspace shape. Update selected from current writing replaces a selected saved snapshot explicitly. Rename changes only a collection label, not the article title. No entry is updated by typing in the editor, and no entry is automatically evicted at a limit.

Selecting or inspecting a saved article does not change current writing or approval. Opening a different article validates current writing and delegates checkpoint capture before editor replacement. Confirmation explains that current edits are not automatically written into the collection. An invalid current workspace or a checkpoint failure blocks replacement. Opening restores all source/article/question fields, clears approval, and resets publishing profiles through the established shared fill path. Other imports/restores keep the collection intact.

One immutable previous collection state supports Undo last collection change for add, update, rename, removal, or loading a different collection. No-op updates preserve that undo. Undo changes saved entries only. It is replaced by the next collection mutation and never exported. Clear this writing desk explicitly purges collection entries, previous collection state, pending file preview, late read generation, hidden saved-workspace text, profile, and existing checkpoints. Downloaded files are unchanged.

## Files and privacy

A collection file has exactly format, version, and entries. Each entry has exactly name and workspace. Nested workspaces use the existing strict version-1 validation, field limits, and 512 KiB individual backup bound. The outer canonical serialized file is capped at 2 MiB and eight nonempty writing workspaces. Unknown fields, unsupported versions, wrong file kinds, invalid nested fields, labels with controls or excess length, and oversized UTF-8 are rejected before any collection replacement. Every returned workspace is an independent validated copy.

The file contains all saved article/source fields and private review questions. Its unencrypted nature is explicit, and download requires a separate private-content acknowledgement. Saved-entry changes reset acknowledgement. Editor changes are deliberately excluded until Add or Update. Article exports and existing single-workspace backups do not contain other collection entries. Approval, consent, credentials, publishing profiles, transient checks/imports, checkpoints, and collection undo are excluded from the collection schema.

Loading a selected file validates and stages a names/sizes preview. Applying replaces only collection entries and preserves editor writing and approval. Existing entries require a replacement confirmation; one-step undo recovers them. Cancel, invalid files, and file-read failures preserve existing entries and writing. A generation token prevents a late read from resurrecting data after Clear this writing desk. Saved-workspace inspection is prepared only when open and purged when closed. Exit warnings include saved entries, recoverable collection undo, entered labels, and pending files.

The optional module loads independently of core writing, recovery, and exports. No account, dependency, AI call, network request, browser persistence, server history, tracking, upload, or GitHub Actions job is added. Native Cloudflare Git deployment remains intact.

## Verification

The release PR records executed local checks and live desktop evidence. Unit/controller coverage exercises strict file round trips, independent nested copies, malformed/wrong-kind files, count/byte limits without eviction, invalid current-work preservation, immutable undo and no-op behavior, exact line endings, literal hostile names, article-export isolation, explicit-save semantics, acknowledgement, preview/cancellation, separate loading/opening, checkpoint failure, hidden inspection purge, invalid replacements, busy guards, and cancelled late reads. Browser fixtures are not evidence of execution unless actually run. Mobile and screen-reader checks remain separate from source validation.
