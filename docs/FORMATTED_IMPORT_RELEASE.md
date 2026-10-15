# Formatted article import

Release: `formatted-import-20261014`.

Writers bringing an article from a document can now deliberately import its HTML clipboard representation or a UTF-8 HTML file. This removes some manual rebuilding before the existing WordPress and HTML handoffs. It is an acquisition hypothesis, with no measured user growth or retention result yet.

## Behavior

The desk and both converters expose Import formatted writing. It opens HTML mode without changing the article. A user-initiated rich paste captures HTML as textarea data only; partial replacement of pending import text and inputs above 512 KiB are rejected. Normal article paste and automatic-mode pasted Markdown keep their existing behavior. Selected .html/.htm files are detected in automatic mode, decoded strictly as UTF-8, and retained as pending source so rejected tables can be previewed again after an explicit header choice. DOCX parsing is not implemented.

Conversion supports common HTML headings, paragraphs, line breaks, semantic and span-style emphasis, safe absolute links, fenced and inline code, single-line nested lists, and simple header tables. An opening H1 becomes a plain title. Literal punctuation is escaped in generated Markdown and decoded for display without altering inline token source offsets. Code retains its literal content. Common Google Docs block wrappers with normal font weight are unwrapped without flattening the whole article.

Reading and Markdown previews are staged. Notices describe omitted images, embedded/interactive or explicitly hidden content, unsafe/relative links, and simplified emphasis or cell/item paragraphs. Every HTML import requires a fresh acknowledgement of conversion changes. Tables without semantic headers need an explicit first-row-as-headers choice. Tracked changes, merged/nested tables, unusual list structure, reversed/lettered lists, and bound violations are rejected before replacement. Original document CSS and layout are not applied.

Apply uses the existing replacement confirmation and checkpoint-before-mutation path. Source notes remain; article fields and review questions are replaced, and export approval clears. Cancellation, rejected input, or checkpoint failure retains current writing. Raw source, preview nodes, and acknowledgement are purged after applying or clearing. Pending HTML, import preferences, and previews are excluded from backups and article exports.

## Parsing and bounds

`public/html-import.js` parses only into a detached template and converts its content tree to Markdown. It never appends source nodes to the document. The reading preview uses the existing safe Markdown renderer. This follows the [HTML Standard's template contents model](https://html.spec.whatwg.org/multipage/scripting.html#the-template-element). The static no-HTML-insertion guard permits exactly one named assignment in this module and retains the prohibition everywhere else. No network request, external resource loading, storage, dependency, account, tracking, AI activation, or Actions workflow is added.

Raw input is bounded to 512 KiB and 6,000 opening-tag candidates before browser parsing. The parsed tree supports at most 12,000 nodes and depth 32. Converted Markdown supports 60,000 characters, six list levels and 200 items per group, twelve table columns and 100 data rows. Output is never truncated to fit. These limits do not constitute complete CommonMark, Word, Google Docs, CSS, or HTML round-trip support.

## Validation

- The 259 existing Node tests passed before new coverage. The expanded suite adds conversion, escaping/offset, omission, bounds, list/table parity, explicit parsing, staged acknowledgement, cancellation, stale choices, busy/checkpoint failure, user-paste replacement, file retry, example, and public-copy tests.
- Static checks cover 24 HTML pages, syntax, local dependencies, links/anchors, accessible references, hosting/routing, privacy guards, and absent Actions workflows. Python browser-fixture compilation and whitespace checks pass.
- The expanded local browser fixture includes real parser rendering, rich clipboard round trip, HTML file header retry, source/approval preservation, and responsive layouts. Execution remains blocked by a missing Chromium headless binary. Mobile and screen-reader checks remain unrun.
- Production Cloudflare build, actual desktop browser interactions, downloads, and Actions state are recorded separately in the pull request after publication. Fixture source and mocked controller tests are not browser passes, and common document markup tests do not establish direct Word or Google Docs compatibility across all versions.
