# Guarded strikethrough editing

Cycle 15 is under review in [PR #87](https://github.com/nolankido/drafttopage/pull/87), following the released import/export fidelity in [PR #81](https://github.com/nolankido/drafttopage/pull/81). This is a source-editing convenience, not new document-format coverage or evidence of user demand.

## Behavior

The existing optional "Format text or find passages" disclosure offers a labelled Strikethrough button in all eight shared workspaces. Select one nonempty phrase on one line to add exact double tildes. Leading/trailing selected spaces stay outside the marks. The resulting phrase stays selected and the editor receives focus. Selecting the complete parsed struck phrase, with or without its marks, removes only its four delimiters. Supported nested emphasis, Unicode, CRLF, headings, lists, quotes and individual table cells retain their surrounding source.

Each accepted action uses the existing before-change checkpoint and clears export approval. Rejected actions return before checkpoint capture or writing. No placeholder is inserted for an empty selection. There is no automatic export or approval, browser storage change, extra keyboard shortcut, or per-keystroke scan.

The helper compares the parsed inline structure before and after, flattening only the exact added/removed strike node. All other inline structure and literal source must match. The existing bounded block parser must also retain block shape, and closing heading marks cannot change. This rejects changes that would expose headings, lists, breaks, fences or table delimiters. Existing formatting actions are unchanged.

## Conservative limits

Partial strikes, multiple struck phrases, multiline selections, surrogate-pair splits, line-ending splits, invalid selections, NUL, 60,000-character overflow and parser fallback cannot silently insert formatting. Protected code, links/images, addresses, escaped punctuation, HTML, reference definitions and conservatively recognized indented/fenced source are rejected when adding marks. Block markers and table delimiters stay outside the selection. Some valid Markdown remains a direct source edit, by design.

Removing a complete recognized wrapper can retain protected inner source where the wrapper's own delimiters are outside protected ranges. For example, the real imported Word fixture's escaped apostrophe and colon are preserved exactly. Conservative URL protection can extend to closing marks, so some struck links/addresses require direct source editing even when the full phrase is selected. This is not a general Markdown normalizer, arbitrary nested-format toggle or CommonMark implementation.

## Validation

Focused model checks cover successful exact-source round trips, whitespace/Unicode/CRLF, nested emphasis, ordinary block content, protected contexts, literal/ambiguous tilde runs, block promotion on removal, size and selection bounds, parser fallback, and a deterministic corpus of every nonempty selection. Every accepted corpus selection must toggle back to the exact original source. Generated-page checks require the labelled control and guidance in all eight workspaces.

The Chromium journey uses native keyboard selection, Enter/Space activation, current focus/selection, visible line-through preview, approval invalidation, unchanged writing/approval/checkpoint count on rejection, and exact checkpoint restore with private fields retained. Actual WordPress and HTML downloads are parsed independently; the actual Word ZIP/XML must contain the selected strike run and exclude private notes. Layouts are checked at 1440, 390 and 320 pixels. The existing real Word import journey additionally removes its complete escaped strike with this control and checks a fresh downloaded block file.

The genuine local WordPress harness adds a toolbar-to-native-download case to the ten existing cases. Its evidence must identify the actual toolbar action, then verify the stored/rendered mark after save/reopen as an Author without unfiltered HTML. Evidence missing the toolbar flag or source is rejected. The full stable-source release gate, fresh eleven-case destination acceptance, exact hashes and native build outcomes must pass and be recorded in the PR before release. Preliminary diagnostics are not full acceptance passes.

No provider, paid resource, dependency, tracking, outreach, Actions, cron, hosting or private file-format change is introduced. Local browser fixtures and local WordPress acceptance do not establish physical-device, assistive-technology, actual Word/Google Docs clipboard application, real-user or independent public rendering acceptance.
