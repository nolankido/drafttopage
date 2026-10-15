# Long articles without partial pastes

Release: `long-drafts-20261014`.

## Product reason

The public WordPress converter provides an immediate, free use case for writers bringing their own drafts. Its previous 12,000-character article limit excluded longer guides and essays. Raising only the textarea limit would leave imports, recovery, review, and exports unable to retain that writing. This release expands the entire local article workflow, and protects oversized pastes before insertion. There is no measured acquisition or retention result yet.

## Scope

- Article body: 60,000 UTF-16 code units, consistent with browser textarea character counting. Emoji can use two units; UTF-8 file size is counted separately.
- Markdown/text/article JSON import and private workspace backups: 512 KiB each. These budgets accommodate maximum-length Unicode articles and JSON escaping with the existing private field limits.
- Revision history: at most five checkpoints and 2 MiB of serialized writing, oldest first eviction. Large versions can reach the byte limit before five checkpoints. Current writing is retained before a programmatic replacement, or replacement is blocked if validation fails.
- Publishing ZIP: 4 MiB, with the same fixed safe paths, stored UTF-8 entries, CRC32 checks, deterministic timestamps, and explicit download.

`public/writing-limits.js` supplies the shared runtime bounds. Plain Markdown, structured JSON, old version-1 backups, article preview, optional review, search and replacement, section moves, exact revision comparison, formatted copy, Markdown, reading HTML, and both publishing kits use the expanded capacity. The private pilot can edit and restore the same local articles; its guarded AI output remains separately limited to 12,000 characters. No AI activation or provider request is part of this release.

Article and import paste guards account for the current selection and browser newline normalization. The import box also checks UTF-8 bytes. Oversized, null-containing, unavailable, and image-only pasted content is rejected before insertion. Rejection leaves the current field unchanged and provides text feedback. Accepted content is left to native browser editing and undo. Cancelable paste/drop and bulk text beforeinput provide additional checks; browser-specific noncancelable input and IME behavior remain subject to native maxlength handling. No rich-text HTML import is added.

Format-complexity limits remain: tables allow 12 columns and 100 data rows; continuous list groups allow six levels and 200 items; review display is bounded to 40 findings; revision alignment uses at most 160,000 LCS cells before its grouped fallback. Malformed source stays inert text. Repeated opening brackets, braces, and angle brackets no longer cause quadratic optional handoff scans.

Drafts and checkpoints remain in tab memory. No autosave, persistence, analytics, account, new service, network request, paid dependency, or GitHub Actions workflow is introduced. Private source and review notes stay out of article exports.

## Validation

Source validation, actual publication, and browser/download evidence are recorded in the pull request. Real-mobile and screen-reader testing remain outstanding; the unavailable local Chromium runtime must not be reported as a passing browser suite.
