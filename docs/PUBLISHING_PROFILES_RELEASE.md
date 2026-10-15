# Reusable publishing profiles

Release: `publishing-profiles-20261014`.

The next product hypothesis is repeat usefulness for regular publishers. Converters can bring a visitor to a first export; a reusable destination setup and personal review routine reduce repeated preparation. This release does not establish demand, retention, conversion uplift, or willingness to pay.

## Behavior

The writing workspace and all three converters provide Reuse a publishing setup below the destination selector. A named profile contains the current destination, separate title-inclusion choices for formatted copy, HTML source, and Word, the page-Markdown title-heading choice, and up to eight personal reminders of 160 characters each. The native profile disclosure starts collapsed, preserving the focused primary export.

Reminder text becomes a checkable list beside export approval. Checklist completion never grants export approval, verifies a fact, or blocks exporting. Article/source/question edits and export-choice changes reset ticks; view toggles preserve them. Editing reminder text also clears approval. Invalid reminder text displays an error and clears the old checklist rather than showing stale completion. Reminder ticks are temporary and never enter any file.

Download publishing profile creates a separate, unencrypted JSON file. A user-selected profile file is limited to 16 KiB and fully validated before a staged preview. The preview lists all choices and reminders as inert text. Apply profile updates only explicit export controls and the profile name/checklist, clears approval, and starts reminders unchecked. It does not alter article fields, source notes, audience, purpose, questions, or checkpoints. Other-editor profiles open the secondary export group. Cancelling a preview preserves writing, choices, and approval.

Workspace/checkpoint restore, fictional sample loading, and desk clearing reset profile fields along with existing route export defaults. An ordinary article import retains an explicitly named setup or custom checklist and all its export choices while resetting checklist completion and approval. Without a setup, the importer retains its existing page-Markdown default. Readiness guidance follows the currently selected destination, including when a profile changes it. Remove profile name and checklist leaves actual destination/title choices in place. There is no automatic profile application or autosave.

## Boundaries and failure behavior

The strict version-1 profile schema accepts only format, version, name, preferences, and checklist. Preferences accept five known, typed fields. Unknown fields, unsupported versions/destinations, coercible arrays, excessive counts/lengths, controls in labels, duplicate reminders, malformed JSON, and oversized UTF-8 are rejected. Arbitrary objects are never merged into the workspace. Files that are not profiles, including workspace backups, cannot apply as profiles.

Profile downloads exclude article fields, source notes, audience, purpose, private review questions, authentication, approval, and completed ticks. A user can still type private information in a profile name or reminder; the UI and privacy/help copy explain that these texts are included in the profile and should be inspected before sharing. The unchanged private workspace backup format excludes profile preferences and reminders. Article exporters and publishing-kit formats are unchanged.

Staging a profile makes no article mutation. Application/download is blocked during workspace or article-file reads. A generation token invalidates outstanding profile reads after reset, so a late file completion cannot resurrect a cancelled profile after restore/clear. Existing active choices and writing survive failed replacement files. Profile file input values and hidden previews are purged after use/cancellation. Unsaved profile text or staged files participate in the existing exit warning.

The optional module loads independently, so an unavailable profile feature leaves the core desk, recovery, and exporters usable. No dependency, network request, AI call, account, upload, tracker, timer, persistent browser storage, server history, or GitHub Actions job is added. Native Cloudflare Git deployment remains intact.

## Verification

Local automated results and any live verification are recorded in the release PR. Profile tests cover strict validation, round trip, fresh allowlisted objects, literal hostile text, UTF-8 limits, preview/cancellation, writing preservation, application, checklist invalidation, download exclusion, rejected replacement files, busy guards, late-read cancellation, and other-editor reveal. Mobile and screen-reader behavior require actual browser/assistive-technology checks; unit tests do not establish their conformance.
