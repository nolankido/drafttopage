# Direct paste into WordPress Visual editor

This continuation starts from checklist release PR #100, main `f99004dafcefdb11114da7fc773b4a1630699a0b`. It advances the WordPress handoff recommendation by making ordinary paste into the Visual editor the primary workflow. The release PR records the exact tested source, command results, merge, and native Cloudflare deployment separately.

The independent Bing verification change in PR #101 landed during preparation. Its exact main source, `0fed594683d91c731f17f2d656189f04da814648`, is retained in the validation base. The earlier partial run was deliberately interrupted and the full gate restarted after this integration.

That integration exposed seven existing HTML structure test parsers that treated a self-closing void element as a closing tag for its parent. Their narrow correction accepts self-closing void elements through the normal start-tag checks and continues to reject self-closing non-void elements and mismatched nesting. The production Bing verification tag is unchanged. The failed attempt is retained separately from the required fresh release result.

Full runs also exposed timing assumptions in two existing browser checks. The direct-template check now waits for the same required note content while its template module initializes. The keyboard recovery check waits for the explicit cancellation result before changing the simulated confirmation answer or sending its next key; acquiring the browser lock can finish after the first keypress returns. These bounded waits retain the original exact content, focus, approval, and subsequent-action requirements. They do not retry either flow or accept extra article characters. The failed attempts are retained separately before a fresh complete gate.

## User workflow

After reviewing the article, choose **Copy WordPress blocks**. In a new, empty WordPress draft, enter the title separately, click the empty paragraph below it in Visual editor, and paste with Ctrl+V or Command+V. Inspect the actual blocks, save the draft, close and reopen it, and preview before publishing.

The workspace opens these instructions below the copy controls after a successful current copy. The primary steps do not require an editor-mode change. A separate **If pasted source text appears** disclosure explains how to undo that paste or start another empty draft, paste the complete source into the full post Code editor, return to Visual editor, and repeat inspection and save/reopen. This fallback is distinct from a Code block, Custom HTML block, or the Classic Editor.

The homepage, Markdown/Word/Google Docs converter guides, publishing help, conversion-check walkthrough, block-download feedback, WordPress kit README, file-purpose list, and review checklist follow the same sequence. Downloaded block source is opened in a text editor and copied completely, including block comments, before either paste path. Opening that file in a browser instead shows its reading view and can request selected linked images.

The existing single copy button still writes `article.html` with `navigator.clipboard.writeText`. The copied block format, review requirement, private-field exclusions, destination selection, and pending/stale/denied-copy guards are retained. Title and optional page fields remain separate. This work does not add a WordPress connection or automatic publication.

## Native handoff acceptance

The local fixture remains pinned to WordPress 7.1.3, Playground CLI 3.1.58, PHP 8.3, and SQLite. Its Author account lacks unfiltered HTML, and the environment checks that content filtering is enabled. The fixture is temporary, loopback-only, and uses real WordPress editor, REST, and database behavior. The [original round-trip record](WORDPRESS_ROUNDTRIP_20261016.md) explains the setup and its network boundaries.

All twelve retained primary cases now use the actual Draft to Page source UI and native clipboard paste into Visual editor. A thirteenth case separately exercises native paste into the full post Code editor. Parser/store seeding cannot substitute for the primary paste path.

| Retained case | Source and destination contract |
| --- | --- |
| Paragraphs and inline formatting | Article fields, separate title, H2/H3 levels, nested strong/emphasis, exact link, and a native edit after reopening |
| Nested lists | Ordered starting values, list-item order, and exact parent-child paths |
| Tables | Aligned header cells, emphasis, data cells, and a header-only table |
| Quote, code, and separator | Native block types and inert literal script text |
| Unicode and literal source | Accents, Japanese text, emoji, punctuation, and source HTML |
| Linked images enabled | Explicit image option, native Image block, exact URL and alternative text |
| Linked images disabled | Image syntax remains literal article text |
| Word footnotes | Native file input, import preview/review/apply, note labels, and note sections |
| Nested strikethrough | Strike marks, emphasis, links, escaped markers, and literal code |
| Strikethrough toolbar | Actual formatting control changes only the selected source before copying |
| Word strikethrough | Native Word-file import and exact stored marks/text, with WordPress typography checked separately |
| Google Docs checklist | Retained HTML-file import, explicit checked/unchecked labels, independent strike marks, and nested item paths |
| Code editor fallback | Separate copy/paste/save/reopen case with the same paragraph, heading, and inline contract |

For each case, the source and private review fields are populated and read back before approval. The approved source, actual downloaded block file, clipboard readback, and trusted paste-event text must agree exactly. The clipboard and event must contain only `text/plain`; the Visual target must be an empty editable paragraph. The application itself still does not read the clipboard; those readbacks belong to the test browser.

The runner then uses the real Save control, requires an HTTP 200 draft save, closes the page, and opens the saved post afresh. It checks exact saved source, rendered article content, valid native blocks, separate title, and private-field exclusion. The paragraph case makes a deliberate native edit at a unique known passage, requires a changed saved hash, and checks that the second reopened source exactly matches the second save. A deliberately invalid Heading remains a negative control for WordPress validation.

## Exact saved-source expectations

WordPress can reserialize valid blocks while saving. The gate does not treat arbitrary HTML or whitespace normalization as equivalence.

For unchanged Visual-paste forms, the expected saved source is the copied source with exactly its one terminal line feed removed. Seven reviewed fixture snapshots in `tests/fixtures/wordpress-roundtrip.json` pin the other observed forms:

- Nested ordered lists reorder the `start` and `class` attributes and add a separating newline between sibling List Item block comments.
- Tables omit the explicit default `hasFixedLayout: true` block-comment attribute and reorder aligned header-cell attributes.
- The Google checklist adds the separating newline between sibling List Item block comments.
- The separator adds one space before its self-closing tag's `/>`.
- The enabled image adds one space before its self-closing tag's `/>`, preserving its URL and alternative text exactly.
- The imported Word strike case saves a literal apostrophe instead of its equivalent `&#39;` entity inside the same strike element.
- The full post Code editor fallback retains the copied source's terminal line feed.

The six Visual-paste snapshots omit the terminal line feed; the separate fallback snapshot retains it. The expected strings retain all text, marks, nesting, list values, header scope, and alignment. The release gate independently hashes those pinned strings. Any further saved-source difference fails and leaves a mismatch artifact for inspection; it is not silently accepted by a broad normalizer.

A strict release attempt stopped at the separator's spacing difference. A separate, bounded diagnostic then captured the remaining ten cases while keeping their native copy/paste, content, structure, private-field, and save/reopen assertions. The four additional exact strings were independently reviewed before being pinned. That diagnostic was explicitly marked `DIAGNOSTIC_ONLY`; it cannot satisfy the release gate. The complete strict gate must run again against the final source.

## Required release checks

Use the externally installed test tools and run the complete gate on a stable source snapshot:

```sh
NODE_USE_ENV_PROXY=1 \
CHROMIUM_EXECUTABLE=/absolute/chromium \
DRAFTTOPAGE_BROWSER_PYTHON=/absolute/python-with-playwright \
DRAFTTOPAGE_WORDPRESS_CLI=/absolute/test-tools/node_modules/@wp-playground/cli/cli.js \
npm run verify:release
```

`NODE_USE_ENV_PROXY=1` is relevant when the local Node runtime must use an environment HTTP proxy for Playground boot metadata. It is a test-process setting, not production configuration. The command does not install tools or start GitHub Actions.

The required run combines build, Node regressions, static checks, browser journeys, retained document cases, and WordPress acceptance. The WordPress report binds the source digest, actual export/copy/paste hashes, trusted target details, saved hashes, and second-edit evidence. Coverage distinguishes twelve native Visual cases from the one fallback. Missing, stale, mismatched, failed, published, or partially reopened evidence fails the gate.

The source UI browser journey separately checks native keyboard copying, retained focus, instruction placement below the action, keyboard access to the fallback, exact downloaded bytes, unchanged writing and approval, private-field exclusion, and desktop/narrow layouts. Existing delayed, stale, denied, and overlapping clipboard checks remain in the full suite.

## Limits

This covers one pinned local WordPress configuration and the automated Chromium clipboard. It does not establish acceptance on every hosted WordPress installation, plugin, theme, browser, or physical device. The retained Google Docs HTML and Word files are fixtures, not new captures from a live source application session. Image responses are explicit local fixture assets; Media Library uploads and live image availability remain outside this gate.

The workflow removes the two editor-mode changes from the primary instructions. No measured time saving, unassisted human completion, participant-study result, adoption, or demand claim follows from that change. Those roadmap gates remain separate.

Official editor reference: [WordPress block editor documentation](https://wordpress.org/documentation/article/wordpress-block-editor/).
