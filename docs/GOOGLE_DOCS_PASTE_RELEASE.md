# Google Docs paste-first publishing

Release: `google-docs-paste-20261014`.

Visual follow-up: `google-docs-paste-feedback-20261014` renders successful HTML-paste feedback in the normal muted text color, while plain-only warnings and rejected pastes retain caution/error feedback. Live messages still use the existing status region.

## Product decision

The site already converts supported formatted writing, but users starting from Google Docs must discover a format selector and raw HTML import box. This release makes copied writing a clear entry path with an immediate conversion preview and a dedicated, indexed Google Docs to WordPress page. It is an acquisition and usability hypothesis. Demand, traffic, retention and willingness to pay remain unmeasured.

## Implemented behavior

- `/google-docs-to-wordpress/` opens the existing shared importer with the copied-selection target first, HTML mode selected, and file/source-format alternatives collapsed. It retains the complete writing, insertion, review, checkpoint, private-backup and export tools. Homepage tool cards/actions, navigation, help and the sitemap make it discoverable. The guide includes source-linked Google copy/download and WordPress editor instructions, conversion limits and an explicit independent-project status.
- In formatted-selection mode, the shared importer handles only user-initiated paste-event data. HTML is preferred when present; an HTML-only clipboard does not need a plain-text representation. Supported content immediately opens the safe conversion preview. The target empties instead of displaying raw HTML. The source remains bounded to 512 KiB and the converted article to 60,000 characters, with no truncation. Other source modes and ordinary article-field pasting retain native behavior.
- Plain-only clipboard data gets a clearly labelled conversion and an explicit warning that absent formatting cannot be recovered. Both kinds require conversion acknowledgement before apply. There is no background clipboard read, clipboard permission request, Google account connection, document URL request, content upload or image download.
- Retained copied source supports explicit re-preview after the table-header choice changes. Oversized, empty or unreadable clipboard payloads keep previous conversion/source. A bounded conversion failure retains the latest source for retry; an earlier visible preview is blocked from apply until a selection converts successfully. New typed source, source-format changes, clearing, full workspace replacement or successful apply purge retained clipboard data. Busy file operations cannot capture a paste.
- Current writing and approval stay unchanged during capture/review. Replacement keeps confirmation and mandatory checkpoint behavior. Existing exact insertion supports combining copied sections without replacing page fields or private notes. A failed checkpoint retains the conversion/source. Pending clipboard source and conversion choices stay outside unchanged private v1 files, collections, profiles and article exports.
- Existing detached, bounded HTML conversion is reused. Its single audited template parser remains the only HTML insertion sink. Converted output is rendered with created text/element nodes, and external destinations are not visited. No production dependency, tracking, persistent browser storage, timer, scheduled job or GitHub Actions workflow is added. Preserve native Cloudflare deployment.

## Verification

Validation covers MIME selection, HTML-only and plain-only pastes, byte bounds, immediate staging, acknowledgements, failed conversion and header retry, candidate preservation, source clearing, busy/file and checkpoint failures, exact insertion, and balanced accessible page structure. Existing conversion fixtures include Google Docs-style wrappers with explicit normal weight and nested emphasis, lists, links and tables. Final counts and live results are recorded in the release PR.

The Google Docs product itself is not connected or accessed. Clipboard/browser variations require source comparison and a Word-file fallback. Actual Google Docs account-to-WordPress use, WordPress/Word application rendering, real mobile operation and screen-reader testing require separate verification. Do not equate local parser tests or exported file structure with those checks.
