# Turn 7: compound document fidelity and table-caption boundaries

Date: October 18, 2026

## Objective and evidence separation

The existing offline corpus has 13 immutable upstream application-origin or historical source fixtures and 15 pinned contracts, plus 26 authored Markdown/HTML probes. This turn adds three fictional, independently specified **compound** article contracts: a reproducibly constructed DOCX package containing two headings, bold text, Unicode, a link, a numbered list, a header table and final sentinel; a Google Docs-style HTML clipboard article with heading, emphasis, link, list, table and quotation; and a two-paragraph HTML table caption that previously silently joined words. Total target: 44 contracts, with 29 authored. All 13 licensed source bytes, upstream hashes and attribution remain unchanged.

The DOCX benchmark is generated from explicit test-authored WordprocessingML with a minimal standards-format ZIP and optional numbered list and hyperlink relationships. It is tested through the actual .docx importer, WordPress blocks, HTML and Word exports, native file review and confirmation flows, and the independent Python HTML/XML/ZIP readers when `benchmark:documents` is run. It is **not** a recent Word app export, not a customer article, and not a native WordPress clipboard comparison. The HTML fixtures simulate formatting patterns; they are not current signed-in Google Docs paste captures.

## Reproduced defect and fix

A table caption containing two distinct paragraphs previously converted to `First lineSecond line` without warning. Simple `p/div` caption boundaries now produce separate article paragraphs in exported Markdown. The importer explicitly discloses that native table-caption semantics and layout were not preserved. Unsupported visible nested headings, lists, block quotes, code, rules and tables in captions fail closed instead of flattening. Previously guarded definition-list semantics and hidden descendants remain guarded and/or omitted.

## Validation contract

Use `npm test` and `npm run check` in a complete checkout. For real routed document benchmark run `npm run build` then `npm run benchmark:documents`, or include it in the manual `npm run verify:release`. A Cloudflare native Node/static build alone is not an actual routed browser run. Failures in exact text, structural list/table checks, link targets, quote markers, safe omissions, staged approval, or the final sentence must reject the release candidate.

## Remaining gates

The project still needs consented and independently recorded current Word and Google Docs source-application captures, comparison with native WordPress paste, hosted WordPress draft save/close/reopen, and human/device evidence. No users were contacted; no site, user data, or source document was fetched. No new account, AI API, payment, tracking, GitHub Actions, or automatic publishing was added.

## Independent review follow-up

Visible empty paragraph wrappers now retain block boundaries without creating breaks around hidden-only subtrees. Simple caption paragraphs serialize through temporary caption-style wrappers to retain inherited italic, bold and strikethrough rather than dropping it; ambiguous nested block wrappers are rejected before import. A native Word table caption remains a disclosed conversion.

The compound DOCX contract now requires independent Word ZIP/XML inspection of actual numbered list paragraphs and table rows/cells as well as HTML/WordPress structure and exact text. A flattened Word export is not eligible for a passing compound contract. These changes preserve the distinction between synthetic engineering evidence and actual source-app or WordPress destination acceptance.

The final integrated review also identified visible thematic rules inside definition-list shells as a silent omission path. The caption validator now treats `hr` and `wbr` as visible structural material, rejecting these unsupported caption definitions before import. Hidden/omitted void elements remain omitted with a disclosure.

## October 18 independent review completion follow-up

Simple block-level caption wrappers, including section, article and aside, now create deliberate paragraph boundaries instead of silently concatenating words. Nested ambiguous containers fail closed. The empty-block distinction handles visible empty formatting spans alongside separately omitted siblings without allowing fully hidden subtrees to divide visible text.

Both compound fixtures, including the synthetic HTML Docs-style case, now require **independent Word ZIP/XML checks** that exported lists remain genuine numbered-list paragraphs and tables remain genuine rows/cells. The synthetic DOCX builder includes actual package content-type defaults and an explicit numbering-part override, with a separate negative-control regression. These are synthetic format-verification changes, not claims about fresh Word/Docs capture or native hosted WordPress acceptance.

## Post-review corrections: comment markers and hidden definition descendants

A visible empty paragraph remains a paragraph separator even when it contains only HTML comment nodes, including nested empty inline wrappers. A completely hidden child subtree plus a neutral comment still does not create an artificial visible paragraph boundary. For omitted-only definition lists, the warning scan now recursively reaches hidden terms and descriptions nested within visible wrappers, disclosing hidden content without admitting visible definition semantics that could be flattened. Fictional regression cases preserve source identity, visible article prose, and the omission warning.
