# Source passage review

Release: `source-passage-review-20261014`

## Problem and behavior

Writers could preview and export articles but had only an unstructured checklist for comparing a claim with its source. The shared writer, WordPress, HTML, and Word workspaces now offer **Review a selected claim** and **Review claims against sources**. Writers pin or enter an exact short passage, compare current source notes, record a reference and evidence, and choose their own decision. No independent fact-checking is claimed.

The available decisions are Needs checking, Supported by this source, Needs revision, and Remove or qualify. Support requires a source reference and evidence. Other resolved decisions require an explanation. References and hostile-looking markup are rendered as text, never fetched or executed. The source-note mirror is read-only and is emptied when the panel closes. Edit full source notes reveals and focuses the existing source editor.

## Existing private-file compatibility

A saved review is one ordinary question string, at most 500 UTF-16 characters, in the unchanged version-1 workspace format. It uses five canonical lines: `Passage review`, `Passage: <JSON string>`, `Source: <JSON string>`, `Evidence: <JSON string>`, and `Decision: <supported decision>`. JSON string quoting keeps newlines and delimiters unambiguous. All twelve notes share the existing limit. Individual passage/reference/evidence bounds are 240/160/240 characters; the combined record must still fit 500. Oversized selections, pastes, and records are rejected in full.

The parser recognizes the entire canonical record or leaves the string as an ordinary editable review note. Legacy questions remain unchanged. Existing private workspace backups, checkpoints, and collection entries after Add or Update retain saved records without a migration. The pilot can still restore these files as ordinary notes. Article exports exclude the private question list, including evidence records. Unsaved guided fields remain temporary and are excluded from every file.

## Editing and recovery

Preparing, inspecting, selecting, discarding, and rechecking do not change writing or approval. Saving validates the whole note list, checks any edited note's original index and exact content, and requires a checkpoint before replacing the list and clearing approval. A no-op save preserves approval and history. Invalid current writing or a checkpoint failure blocks the mutation and keeps preparation intact. Full note lists, duplicates, malformed records, busy file-reading states, and stale edited-note identities also block saving.

Pending preparation binds to the exact current body and source notes. Changing either blocks saving until the writer explicitly rechecks current writing. Saved records are historical judgments, with no verified-article score. Navigation searches the current body for a unique exact match, recomputes positions at click time, and refuses missing or repeated passages, including overlapping matches. This match never establishes source support.

Workspace, checkpoint, and collection article restores, article imports, sample loading, and desk clearing purge unsaved preparation. Existing outer replacement confirmations protect writing. Preparation participates in the exit warning; no browser persistence, server history, tracking, account, service, AI call, or new dependency is added. Optional module failure leaves normal notes, recovery, editing, and exports usable. All GitHub Actions workflows remain absent and jobs remain stopped; deployment uses the existing native Cloudflare Git integration.

## Validation

- 344 Node tests pass, including 15 meaningful source-review tests covering bounds, canonical parsing, exact offsets, ambiguity, mutation identity, backup/collection/checkpoint round trips, export privacy, stale preparation, no-op updates, checkpoint failures, busy actions, selection limits, paste rejection, mirror purging, and all four generated pages. A collection regression also protects unsaved review preparation when the editor itself is empty.
- Static checks pass for 25 HTML pages, syntax, assets, anchors, accessible references, local imports, privacy guards, routing, and absent Actions workflows. Python fixture compilation and whitespace checks pass.
- The browser fixture now exercises source review, actual backup/body downloads, restore, missing/repeated passages, optional-module failure, and 1440/390/320 layouts. It could not launch in this environment because the Playwright Chromium executable is missing. These fixture and mobile assertions are not reported as executed. Screen-reader testing is unrun.
- Live browser verification and native Cloudflare build results are recorded in the pull request after publication.

## Product hypothesis

Keeping the evidence and unresolved judgments with a reusable article can make Draft to Page more useful for repeat publishing. User acquisition, retention, and willingness to pay remain unmeasured. No claimed customer results or monetization are introduced.
