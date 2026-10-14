# Bounded in-tab revision recovery

Release marker: `revision-recovery-20261014`.

## Behavior

The public writing desk supports labeled checkpoints, exact field comparison, confirmed restoration, and separately acknowledged private checkpoint downloads. Checkpoints capture source and draft fields only, using the existing validated version-1 workspace schema. They never serialize approval, sign-in details, AI consent, export preferences, or other checkpoint history.

Previous writing is captured before article imports, workspace-file restores, toolbar formatting, outline replacement, filename suggestions, and review-note removal. Cancellation and invalid imports leave current writing unchanged. Invalid current writing blocks replacement when it cannot be checkpointed. A checkpoint restore retains the displaced writing when nonempty, including when the target is evicted while making room for that displaced version.

At most five checkpoints and 384 KiB of serialized writing are retained. Snapshots and returned copies are independent. Consecutive identical versions deduplicate; empty work is skipped. Clear this writing desk purges the entire in-tab history after an explicit warning. Private downloaded files remain outside the application. Checkpoints count as work for exit warnings.

No timer, keystroke autosave, persistent browser storage, server history, AI call, upload, third-party dependency, or public account is introduced. This feature applies to the public desk; the private pilot keeps its existing backup behavior. The history can be lost on refresh, close, or navigation. Download a private workspace file for recovery beyond the tab.

## Validation record

- Local Node tests: 151 passed, covering the existing application and new snapshot isolation, partial writing, malformed fields, count/UTF-8 bounds, deduplication, unchanged backup format, private-field exclusion, comparison, cancellation, redo, full-history target eviction, busy controls, and clearing hidden comparison text.
- Controller contract tests use minimal event-bearing controls. They validate behavior but are not a rendering or browser substitute.
- Source checks cover generated pages, syntax, links, asset references, accessible references, local module imports, storage/logging restrictions, and absence of GitHub Actions workflows.
- The local Playwright browser suite is expanded for revision recovery. The current environment could not install a usable Chromium binary, so an expanded-suite pass is not claimed. Direct live-browser validation is required separately.
- No Actions workflow may be restored to perform validation. Native Cloudflare Git publishing is separate.

## Published result and direct live verification

PR #12 merged as `0d2b192a74488d664c9ad51332e8ed6bc1f1e719`. The native Cloudflare Workers build succeeded and published version `c63b1dc8-489a-4c21-b52d-e7d0f5579c01`. The live `/write/` page reported `revision-recovery-20261014`.

Using only disposable fictional writing, direct live-browser checks confirmed:

- Empty checkpoint handling, labeled saving without clearing existing approval, and exact saved/current field comparison.
- A real 552-byte selected-checkpoint download, independently read from disk: the saved article, source and review notes, and exact version-1 workspace shape, without labels/history/authentication/approval fields.
- Cancelled restore leaves current writing intact; restore clears approval/preferences and retains displaced writing; restoring again recovers that displaced version.
- Previous writing retained around formatting, article import, outline replacement, review-note removal, and restoring the downloaded workspace file. Imports kept source notes, and restoring the prior checkpoint recovered private review notes.
- The five-checkpoint limit, cancelled clearing, and confirmed clearing of article/source/questions/history and hidden comparison/import-preview values. An open empty reading preview correctly shows only the generic `Untitled article` heading, with no prior article text.
- No Draft to Page page errors in the observed browser logs and no horizontal overflow at the observed desktop viewport. Browser-extension errors are separate. Expanded automated narrow-layout tests remain unrun because Chromium installation failed; no new real-mobile or screen-reader audit is claimed.

GitHub Actions had no runs for the feature or production commits and no running or queued jobs. Both source trees contained no workflow files. Cloudflare's check was produced by its native GitHub App, not GitHub Actions. Repository administrator Actions permissions were not changed; configured workflow jobs were removed and guarded against reintroduction.

The live private pilot still reported that it was not activated. Genuine provider acceptance is not claimed.
