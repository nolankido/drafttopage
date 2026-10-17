# Application-origin document benchmark

Follow-up: [Google Docs checklist conversion](GOOGLE_DOCS_CHECKLISTS_20261016.md) changes the retained checklist case to a disclosed conversion with explicit state labels, exact parent-path checks and Word list levels. The original baseline table below records what was observed before that change and before the strikethrough preservation release. Current contracts are in the [manifest](../tests/fixtures/documents/manifest.json).

This cycle adds a repeatable corpus to the release baseline from PR #70. It tests actual upstream application output alongside the hand-built regression fixtures. It is an initial conversion benchmark, not evidence of customer adoption or universal Word/Google Docs compatibility.

## Corpus and provenance

The corpus has 13 inputs and 15 cases. All inputs are public, pinned, and retained under their upstream licenses in `tests/fixtures/documents/`. The manifest records each source URL, revision, byte length, SHA-256, retained license, provenance limits, and independent expected behavior. No input is downloaded during testing.

- Nine unmodified DOCX packages come from [Mammoth](https://github.com/mwilliamson/mammoth.js/tree/5171a9072f8b7343ab1c9ed3a15d6d372cb59b67/test/test-data), revision `5171a9072f8b7343ab1c9ed3a15d6d372cb59b67`, under its retained BSD license. Each package records Microsoft Office Word in its application metadata. That is origin evidence, not independent verification of the authoring session or a claim about current Word versions.
- Three HTML strings are extracted unchanged from upstream Google Docs paste tests in [Lexical](https://github.com/facebook/lexical/tree/fd661f08c025c18593e0f1fbbcb503fe42b815e9), revision `fd661f08c025c18593e0f1fbbcb503fe42b815e9`, under its retained MIT license. These are a right-aligned list, checklist, and table with custom widths. Upstream does not identify the capture date or application/browser version. They are not fresh captures from a signed-in Google Docs session.
- The same Mammoth revision supplies its unmodified 29,981-byte README as authored long-form Markdown. This adds documentation, headings, links, code, and an ending sentinel to the microdocument cases. It is not a Word or Google Docs article.

The fixtures are developer inputs outside `public/`, not product samples or downloads. Upstream licenses apply to their respective files and remain in `MAMMOTH-LICENSE.txt` and `LEXICAL-LICENSE.txt`. We do not use upstream converters as production dependencies.

## What the benchmark verifies

The browser loads the current product's real ES modules under the site's CSP, with local routed responses and no provider or publishing service. Word input uses `parseDocxArticle`; paste captures use `parseCopiedWriting`; Markdown uses explicit Markdown import. All converted cases produce actual WordPress blocks, an HTML fragment, and a Word ZIP.

Independent Python HTML, ZIP, and XML readers compare the exported text. Ten microdocument cases require exact text after whitespace normalization. Selected cases also require exact list items, table cells, safe link destinations, warning passages, image placeholder counts, and exclusion of private comments. The long document requires ordered source passages and the title, plus text agreement between all three export formats. This sampled check does not establish exact source-to-output fidelity for every passage or formatting feature in that document.

Nine cases also use native file inputs, staged review, acknowledgement where required, application or explicit rejection, and real WordPress-file downloads. Rejected files must keep the existing title, article, and approval. Successful previews must leave current writing untouched until applied, and applied writing must clear approval. Those UI cases check for horizontal overflow at 1440, 390, and 320 pixels.

The verifier has negative tests for lost text, changed links, missing loss disclosures, active HTML, and unsafe link targets. Corpus integrity and application metadata are checked independently in the Node suite. Expected text and disclosures are committed review inputs; the runner never rewrites expectations from its own output.

## Observed baseline

The initial corpus run passed its specified contracts in Chromium 153. A passing rejection contract means writing was protected and the unsupported input was reported. It does not mean that input was converted.

| Case | Observed outcome | Acceptance checked |
| --- | --- | --- |
| Word paragraph | Preserved | Exact article text across three exports and staged UI import/download |
| Word bullets | Preserved | Exact text and two list items |
| Word table, no header decision | Rejected | Explicit header choice required; current writing preserved |
| Word table, reviewed first row | Disclosed conversion | Exact cells/text, explicit-choice warning, staged UI and download |
| Word footnotes | Disclosed conversion | Both notes and visible labels survive; appended placement disclosed |
| Word footnote link | Disclosed conversion | Note text and exact safe link survive; placement disclosed |
| Word comments | Disclosed conversion | Article survives; comment text excluded from all three exports; UI checked |
| Word strikethrough | Disclosed conversion | Text survives and simplified formatting is reported |
| Word embedded image | Disclosed conversion | One numbered placeholder and warning; no image request or image element |
| Strict-format Word | Rejected | Unsupported namespace reported; current writing preserved |
| Google Docs list | Disclosed conversion | Exact text/list items; simplification warning; UI checked |
| Google Docs table, no header decision | Rejected | Explicit header choice required; current writing preserved |
| Google Docs table, reviewed first row | Disclosed conversion | Exact cells/text; explicit-choice warning; UI and download checked |
| Google Docs checklist | Rejected | Unsupported list structure reported; current writing preserved |
| Long authored Markdown | Sampled conversion | Title, ordered source passages including the ending, and agreement across exports |

Totals: two preserved cases, eight disclosed conversions, four intentional rejections, and one sampled long-document case. There is no aggregate fidelity percentage. Generic font/layout loss is outside the supported article semantics, and preserved cases do not claim visual layout fidelity.

## Reproduce manually

Build first, then use the same deliberately installed Python/Playwright/Chromium tools as the release baseline:

```sh
npm run build
npm run benchmark:documents
```

The focused command uses `python3`. If Playwright is installed in a separate environment, invoke that interpreter directly:

```sh
CHROMIUM_EXECUTABLE=/absolute/path/to/chromium /absolute/path/to/python scripts/browser-smoke.py --documents-only
```

The full `npm run verify:release` includes this corpus after the existing browser journeys. `DRAFTTOPAGE_BROWSER_PYTHON` and `CHROMIUM_EXECUTABLE` still select external tools for that full command. It does not install tools, start Actions, activate AI, or publish anything.

Fresh ignored reports are written to `test-results/document-benchmark.json` and `test-results/browser-results.json`. The focused browser report explicitly has `documents-only` scope and cannot substitute for full release evidence. Every case records its source hash, outcome, warnings or rejection, verification scope, and an observed conversion/export duration. Durations include browser orchestration and are observations, not a performance acceptance threshold. Rejected cases are counted separately. A missing expected passage, altered fixture, omitted disclosure, mismatched output, or failed UI assertion fails the command.

## Decisions for subsequent cycles

1. Real WordPress save/reopen acceptance remains the next roadmap gate. Checked block bytes are not proof of destination acceptance.
2. Google Docs checklists need a deliberate conversion design for their sibling nested-list structure, checkbox state, and checkbox images. Keep the current rejection until meaning can be retained or reviewed explicitly.
3. Strict-format DOCX needs a dedicated compatibility review before adding namespace support. This is demonstrated on an actual upstream package, not a reason to weaken the parser's namespace checks globally.
4. Header inference remains an explicit user choice. These samples do not justify guessing that every table's first row contains column names.
5. Extend the corpus with current full-length Word and Google Docs articles, multilingual writing, revisions, combined features, and device-specific paste captures. Do not describe this microdocument corpus as representative real-user acceptance.

This cycle found no silent article-text loss within the ten exact-text contracts. It leaves known formatting simplifications, unsupported inputs, source-application version uncertainty, genuine destination acceptance, assistive-technology acceptance, and the earlier 4,000-line interactive capacity observation open.

## Additional authored conversion probes (October 16, 2026)

The benchmark now loads `tests/fixtures/documents/authored-cases.json` after the original pinned corpus. It adds **22 fictional Markdown regression cases**, giving **37 test contracts** in the runner. The original **13 licensed upstream inputs and 15 source cases remain byte-for-byte unchanged**. Authored cases are stored as explicit source strings and independently reviewed outcomes, not attributed to Word, Google Docs, contributors, or customers.

These probes cover CJK, Arabic, combining marks, emoji, punctuation, paragraph boundaries, title extraction, inline emphasis, strikethrough, an HTTPS hyperlink, unordered and numbered lists, nested-list parent paths, a header table, fenced code, inert literal HTML tags, a quote, and five deliberate rejections for malformed or unsafe Markdown metadata. Four cases also follow the native file-selection and staged-import UI. All accepted cases are checked against the real WordPress, HTML, and Word exporters using the existing independent HTML/ZIP/XML readers. Expected rejections are checked without replacing the existing article or clearing its export approval.

The report includes `pinnedCaseCount`, `authoredCaseCount`, `originCounts`, and the authored-cases file SHA-256. This is **regression breadth**, not 37 independent source applications or 37 real writers. The 22 authored probes do not satisfy the unmet recommendation to collect consented, current, full-length Word and Google Docs captures, and they cannot establish mobile-device, screen-reader, or hosted WordPress acceptance. Run `npm run verify:release` on a stable checkout before claiming the whole expanded suite has passed; the native Cloudflare build alone does not execute the complete release gate.
