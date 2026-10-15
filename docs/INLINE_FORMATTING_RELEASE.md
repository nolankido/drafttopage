# Preserve common inline formatting

Release: `inline-formatting-20261015`.

Combined bold/italic text previously left stray Markdown, and links inside emphasis or emphasis inside link labels could stay partly literal. Word and formatted imports also simplified these combinations. This release preserves common single-line inline structure across the conversion workflow.

## Changes

- A bounded inline tree handles nested strong/emphasis, `***both***`, `__strong__`, matching backtick code spans, safe links inside emphasis, and emphasis/code inside safe link labels. Unicode delimiter boundaries avoid turning underscores within ordinary words into emphasis. Escaped punctuation and source offsets remain exact.
- The DOM reading preview, formatted HTML, portable HTML fragments, reading pages, and WordPress blocks render the same tree. Plain clipboard text includes each safe link URL once. Word exports combine run properties and keep styled text inside protected hyperlink relationships.
- Detached HTML and Word conversion build semantic inline nodes. Adjacent and redundant styles are merged before serializing Markdown. Imported inline text, style, code, and link runs are compared with the parsed result. Ambiguous structures fall back to disclosed literal text with safe URLs instead of silently accepting altered formatting. Opening H1 title extraction stays plain text.
- Draft checks, link inventories, and WordPress image/review inspection traverse nested nodes with the original UTF-16 and CRLF positions. Code stays outside prose checks. Images inside emphasis remain literal and receive unsupported-placement findings. No image loading is added.
- The link inventory includes supported styled links. The guided link editor selects source for formatted labels, links within emphasis, and table links so direct editing can preserve structure. Plain-link editing keeps its existing behavior and guards.

## Bounds and limits

Articles remain limited to 60,000 characters. Inline parsing is single-line, with at most 16 nested levels and a bounded work budget per line. Excessive input becomes literal text without losing the ending. This is not a complete CommonMark or GitHub-flavored Markdown implementation. Nested links, multiline inline structures, reference links, autolinks, source HTML, and other unsupported syntax still need inspection. Import notices continue to disclose layout and unsupported-format losses.

Existing private formats, approval/reset behavior, image choices, checkpoints, routing, and hosting stay in place. No production dependency, storage, network request, account, paid service, AI request, tracking, or GitHub Actions workflow is added.

## Validation

Regression tests cover nested formatting in every block context, independent Python HTML and Word XML parsing, combined Word runs, detached HTML and real Word XML imports, original-source offsets, unsafe targets and hostile labels, inert images/code, malformed and bounded input, import serialization checks, and semantic DOM creation. Existing import/export/private-data and recovery tests remain required.

A separate local comparison matched text and bold/italic semantics for 108 single-line emphasis examples from [CommonMark 0.31.2](https://spec.commonmark.org/0.31.2/#emphasis-and-strong-emphasis). The subset excludes code, links, HTML, escaped source, multiline examples, and non-paragraph output. It does not establish full conformance. The production project has no dependency on the reference file or external service.

Run `npm test`, `npm run check`, and `git diff --check` locally. Native Cloudflare deployment and live desktop conversion/download checks are verified separately. Local browser preview and mobile-device QA are unavailable in this session because the managed preview browser skill is not installed. Existing responsive layout is retained. GitHub Actions remain off.
