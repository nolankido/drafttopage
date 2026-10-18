# HTML to Markdown

Release: `html-markdown-tool-20261016`

## Problem and result

HTML article import was available inside other workflows, without a direct acquisition page. Its combined paste mode also blurred the difference between HTML code and a copied selection with clipboard formatting. Pasting literal code as copied writing could preserve tags as literal article text instead of converting the source.

The free `/html-to-markdown/` route opens the existing importer with **HTML source code** selected. Source pastes use plain text and the existing whole-paste UTF-8 bound. They remain in the input until the author explicitly previews. **Copied formatted writing** retains its separate immediate-preview paste behavior. Both use the existing detached HTML converter, notices, acknowledgements, insertion options, checkpoints, and export controls.

The new workspace defaults to article Markdown with an available title included. The author inspects the import, acknowledges losses, imports it, reviews the article, and explicitly copies or downloads the .md file. No title or page metadata is required for body-only Markdown. Navigation preserves pending imports. A fictional source-tree example produces both its HTML and actual converter output, with a matching browser example action.

The page has a unique title/description, self-canonical URL, sitemap entry, current-page navigation, homepage discovery link, related-tool links, supported-format guidance, and limitations. This is an acquisition and usability hypothesis. No search-demand estimate, search position, traffic, conversion, or revenue result is claimed. It supports the original free-tool acquisition strategy while retaining a usable product without payment friction.

## Boundaries

Source must be pasted or explicitly selected as a file. No URL fetch or website extraction is added. Full-page HTML can contain unwanted menus and footers. The existing subset preserves ordinary article structures, converts images to placeholders, omits unsafe/relative link targets and script/embedded/explicitly hidden content with notices, and rejects unsupported complex structures. Keep the original and inspect the destination.

Limits remain 512 KiB for text files/pastes, 60,000 article characters, six list levels/200 items, and twelve table columns/100 data rows. A first-row header assumption still requires an explicit choice. Private source/review fields remain excluded from ordinary article exports. Pending source and preview stay in tab memory; there is no autosave.

No dependency, paid resource, AI request, persistent state, tracking, account, private-file schema, schedule, Actions workflow, or hosting change is added. Existing Cloudflare Git deployment is retained.

## Verification

New checks cover explicit raw-source paste, clipboard-format isolation, size rejection without truncation, acknowledgement invalidation, source example behavior on copied-writing pages, navigation to pending HTML, generated examples, discovery metadata, and the shared workspace contract. Regression route matrices include the new workspace. Publication and live browser/download evidence are recorded in the pull request.

## October 18, 2026: definition-list fidelity repair

A synthetic, independently specified HTML article exposed a loss: `<dl><dt>Start time</dt><dd>Check-in at 10:00.</dd><dt>Parking</dt><dd>Use the north lot.</dd></dl>` became one concatenated paragraph without boundaries. The detached-tree parser now recognizes simple `dl/dt/dd` groups as blocks and converts each term or description into a separate Markdown paragraph with an explicit bold `Term:` or `Definition:` label. Supported inline emphasis and safe links remain in the description, and ordinary paragraph wrappers retain their boundaries. The conversion displays a notice that native definition-list semantics changed.

Malformed or unsupported groups fail before applying: orphan descriptions, unmatched trailing terms, empty entries, nested lists/tables/quotes/headings/code, unexpected direct wrappers and more than 200 entries. This conservative subset is not a promise of full HTML definition-list, accessibility, CSS or browser layout fidelity. The source stays local and inert. No external link is fetched and no article is automatically published.

Regression tests use fictional detached HTML source and confirm the actual HTML/WordPress exported paragraphs, inline formatting, original ending, explicit warning, unchanged source object and fail-closed invalid cases. The original licensed Word/Google Docs corpus and its pinned hashes remain unchanged; this is an authored HTML boundary case, not a new real-application capture. Full isolated Playwright/WordPress/device acceptance remains separate.

## October 18, 2026: post-review boundary safeguards (Turn 5)

The final automated review of PR #157 identified two additional edge cases. A visible native definition list embedded inside a table caption could be flattened into indistinguishable text; caption conversion now rejects direct or nested `dl/dt/dd` entries with a specific explanation. Hidden or otherwise omitted caption descendants are pruned before this check, so an invisible list does not prevent importing an otherwise supported caption.

The block-boundary scanner and article flow now both omit hidden/embedded subtrees before deciding where paragraphs end. For example, `<div>Before <dl hidden>...</dl>after.</div>` remains one visible paragraph rather than two. Explicitly hidden content is still disclosed in import warnings. Legitimate visible paragraphs remain separated. New synthetic tree regression cases cover direct and wrapped captions, hidden caption entries, hidden/aria-hidden/style-hidden blocks, embedded content, preservation of actual paragraph breaks, a retained ending marker, and unchanged original input trees.

These are scoped source-fidelity fixes, not evidence of successful conversion of arbitrary HTML, real author documents, hosted WordPress acceptance, physical devices, or human alpha readiness. No credential, API, network fetch, tracking, AI provider, payment, publishing automation, or GitHub Actions change is included.
