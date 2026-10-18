# Turn 16: preserve quoted citations and formatting

## Problem and scope

This continuation starts from the verified Turn 15 main commit `07f519ae37e287be952270eea295fd32bd2d16a8`. Inspection of the current application found a concrete article-fidelity defect: formatted HTML quotations were reduced to plain text before import. The words of a citation remained, but its safe destination URL, bold or italic emphasis, strikethrough, and inline-code formatting disappeared.

For example, this deliberately fictional source:

```html
<blockquote><p>A <strong>critical</strong> finding from
<a href="https://example.test/study?q=1">the original study</a>.</p></blockquote>
```

previously became quoted text with no citation target or emphasis. The repaired importer keeps the supported Markdown equivalents, so the existing reading preview, HTML, WordPress blocks, and Word export can preserve them.

The runtime change is limited to `public/html-import.js`. It uses the existing inline serializer, safe-link resolver, escaping, and content limits. It does not expand the public workspace into a general nested-block editor.

While this work was being validated, the separate visitor-entry and formatted-paste changes in PR #144 merged as `1b17bc84063791959f30341ca3f093f098883ae4`. That revision was incorporated before the final combined release checks. The browser harness now opens its relocated example disclosure before clicking the example button and supplies an existing article before exercising insertion choices. It also verifies those choices stay hidden and disabled while the article is empty. The earlier focused results below were recorded against the Turn 15 base.

## Resulting behavior

- Ordinary quoted paragraphs and direct quoted text preserve supported bold, italic, strikethrough, inline code, and safe links.
- Paragraph and explicit line-break boundaries remain readable. Inline wrappers that span those boundaries retain their formatting and links.
- Inherited bold and explicit normal-weight overrides retain their existing meaning.
- Literal Markdown punctuation stays literal. Ambiguous link labels retain their safe URLs as disclosed text.
- Relative links still require an explicitly supplied source page URL. No source or destination URL is fetched.
- Image placeholders remain inert. Hidden and active content remains omitted. Visible checklist states and unresolved tracked changes in unsupported quote containers still reject the import.
- Nested lists, tables, headings, quotes, and code blocks become quoted text with a specific disclosure that their block structure was flattened. Simple supported quotes no longer receive that blanket simplification notice.

## Verification added

Eleven focused quote regressions cover visible text, citation targets, all supported inline marks, output quote structure, line boundaries, normal-weight overrides, relative and unsafe URLs, unusual labels, nested structures, image placeholders, hidden content, checklist and tracked-change rejection, and whole-article limits.

Running those cases against the exact previous committed importer reproduced **nine failures and two passes**. After the repair, the eleven new cases and the existing HTML import tests passed together: **65 tests**. An independent review and bounded malformed/complex input probes found no concrete runtime defect in the repaired path.

The existing browser document corpus now includes four explicitly fictional HTML probes alongside its 22 authored Markdown cases and 15 pinned upstream cases. Every new HTML probe goes through the browser's detached HTML parser and native file-input review or rejection path. Accepted cases retain the existing writing until explicit application, require fresh export review, and compare the downloaded WordPress bytes with the independently inspected output.

The independent readers now check requested HTML quote structures and inline marks, as well as actual Word Quote paragraphs, run properties, and hyperlink relationships. Deliberately corrupted outputs prove that removing or changing those properties fails verification. Text normalization in this corpus does not establish exact whitespace fidelity; the focused quote tests retain exact line-boundary assertions.

A fourteenth local WordPress case imports `tests/fixtures/quotation-handoff/fictional-quoted-citation.html`, reviews and applies it, copies the actual approved blocks, and pastes them into an isolated native Visual editor. Its required saved source explicitly includes the quotation, citation URL, bold, italic, strikethrough, inline code, line break, and final paragraph. The quote case requires a draft save and exact reopen. The existing separate paragraph case continues to require a native edit and second reopen. Private-field exclusion and negative-control checks remain required.

## Reproduction and final release record

Use the existing configured Python Playwright, Chromium, and pinned local WordPress runtime described in the Turn 15 evidence record. Run:

```sh
node --test --test-concurrency=4 tests/*.test.js
npm run check
python3 scripts/browser-smoke.py --documents-only
npm run verify:release
npm run verify:wordpress:receipt
npm run verify:production
```

The complete release command requires `DRAFTTOPAGE_WORDPRESS_CLI` to include local WordPress acceptance. The focused document run does not replace the full browser/release gate. Environment-specific proxy settings may be required for the fixed public production requests and the pinned WordPress runtime.

The release PR records the tested candidate commit, exact source fingerprint, full-suite results, merge commit, native Cloudflare production version, and post-deployment public checks. Those values cannot be embedded into the same commit before it exists. Earlier Turn 15 receipts remain historical evidence for their own revision.

## Boundaries and next useful work

These are fictional local tests, not current Google Docs or Word application captures, hosted WordPress acceptance, physical-device observations, or human alpha results. The real-world alpha requirements remain open.

The broader audit also found useful subsequent work: bring the primary export action closer to its review checkbox; make the return-to-editing navigation label and status reflect the current editing context; and add prepend/reorder operations to the guided table editor. PR #144 supplied the first-source-input and formatted-paste-entry changes independently of this quote repair.

Word Quote-style reimport and general HTML italic inheritance are separate fidelity limitations. This repair preserves the supported quoted formatting in the described HTML import and export path; it does not claim a complete Word round-trip editor.
