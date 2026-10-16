# Markdown headings and thematic breaks

Release: `markdown-block-fidelity-20261016`

Ordinary underlined Markdown headings and divider lines previously appeared as literal article text. This improvement preserves them through the existing local conversion workflow. It addresses a core conversion-quality gap before adding acquisition pages or monetization friction.

## Result

- An ordinary paragraph followed by a contiguous line of `=` becomes H1; `-` makes H2. Multiline ordinary heading text is supported.
- Three or more identical `-`, `*`, or `_` markers form a thematic break. Spaces or tabs between break markers are allowed, with up to three leading spaces. A dash underline immediately after eligible paragraph text takes heading precedence; use a blank line for a break.
- Reading and destination previews use semantic headings and `hr` elements. The outline recognizes the same underlined headings. Passage navigation selects the complete original source, including its underline, CRLF line endings, and UTF-16 offsets.
- HTML emits `hr`; WordPress emits the native Separator block; Word emits an empty paragraph with a single bottom border. Plain formatted-copy fallback includes a visible `---` separator. Original Markdown exports and private recovery keep the authored syntax.
- Opening underlined H1 import uses the existing title extraction, conflict, and length rules. HTML `hr` imports become `***`. A narrow empty Word paragraph with one direct single bottom border becomes a thematic break with a styling-loss notice. Other direct paragraph borders receive an omission notice.
- Section moves select the complete heading and reject a result if moving content would change interpretation of underlined headings. Existing checkpoint and approval behavior applies.

## Limits

This remains a bounded Markdown subset, not full CommonMark. Headings and breaks inside lists, quotes, indented code, HTML blocks, and other container syntax are outside this addition. Multiline inline emphasis retains its existing limits. Fences keep marker text literal. Malformed source is retained rather than rewritten.

Markdown files beginning with `---` still use the existing front-matter rules. Use `***` for an opening break. Word paragraph-border conversion is deliberately narrow: it does not infer separators from bordered text, heading paragraphs, numbered paragraphs, or box borders. Separator paragraphs inside table cells or notes are unsupported. Imported multiline HTML/Word headings become single-line Markdown headings with a notice. Word spacing, borders, and pagination can differ by editor.

No dependency, production request, AI call, account, tracking, persistent state, private-file schema, service, schedule, or hosting change is added. This is a product-quality improvement, not evidence of traffic, revenue, or complete editor compatibility.

## Verification

Automated checks cover syntax precedence and bounds, Unicode/CRLF source navigation, exact inline findings, reversible and unsafe section moves, title import rules, native HTML/WordPress output, independent Word ZIP/XML inspection, divider round trips, original-source preservation, exclusion of private fields, and maximum-size literal fallback.

Production verification is recorded in the pull request after the native Cloudflare build.

## Primary references

- [CommonMark 0.31.2](https://spec.commonmark.org/0.31.2/), thematic breaks and setext headings. The implementation intentionally supports a smaller top-level subset.
- [WordPress Gutenberg Separator block](https://github.com/WordPress/gutenberg/blob/trunk/packages/block-library/src/separator/README.md), canonical saved block markup.
- [Open XML paragraph bottom border](https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.wordprocessing.paragraphborders.bottomborder?view=openxml-3.0.1), native Word paragraph border element.
