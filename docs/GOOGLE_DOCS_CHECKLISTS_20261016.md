# Google Docs checklist conversion

This change addresses a reproduced conversion-fidelity gap in original roadmap item 11. The retained, licensed Google Docs checklist HTML was rejected by the previous importer with `This list has unsupported structure`. The source contains five items, two checked states, three unchecked states, and two children belonging to the second top-level item. It is an upstream historical paste capture, not a new Google Docs session or a participant article.

## Result and boundaries

Explicit checked and unchecked list items become ordinary article list items with literal `[Checked]` and `[Unchecked]` labels. The labels survive Markdown, WordPress, HTML, and Word export and remain outside strikethrough. Supported single strikethrough on the item or its spans is preserved independently of the checkbox state. A checked item is not automatically struck through, and an unchecked item may contain struck text.

The staged import explains that these are text labels, not interactive checkboxes. A second notice identifies the reconstruction of Google Docs sibling-list nesting and asks the writer to compare it with the original. Import acknowledgement, replacement confirmation, checkpoints, and cleared export approval still apply.

The parser accepts the unusual sibling `ul` only after an explicit checkbox item, and requires consistent checked states and matching source levels throughout that reconstructed list branch. It plans the output without modifying source nodes. A hidden possible parent prevents the following sibling list from being attached to an earlier visible item. Missing or conflicting states, partially checked items, orphaned lists, contradictory levels, multiple child lists, text after child lists, and other ambiguous structures remain rejected. The existing six-level and 200-item budgets include reconstructed descendants.

A leading direct image marked as a checkbox is omitted only when its checked or unchecked alternative text matches the item's explicit state. Its address and bytes are never read or fetched. Ordinary images, wrapped matching markers, and nonleading matching markers retain visible placeholders and the existing disclosure. Unknown or conflicting checkbox-marker labels reject. Empty items remain rejected before a state label can make them appear nonempty.

Visible checkbox semantics are rejected when supported list conversion is unavailable, including non-list elements and quoted, code-container or invalid inline paths that would otherwise flatten away their state. Existing hidden-content and native interactive-control omission rules still apply with their notices.

## Evidence and reproduction

The original fixture remains unchanged at SHA-256 `1c38af3d1f3e2cc1eac2d3f86b94b7e97d90083820028d3b38d9acf220eb5e18`. Its provenance and license stay in the [document manifest](../tests/fixtures/documents/manifest.json). Its contract changes from an intentional rejection to a disclosed conversion. The corpus still has 13 inputs and 15 cases; this change does not inflate the input count.

The independent Python reader checks exact state labels, source text, strikethrough and list-item parent paths in HTML and WordPress output. Word ZIP/XML checks compare text, list paragraph levels and strike runs. Parent paths matter because the source repeats `done` and `todo`; text agreement alone cannot prove that children belong to the correct parent. Negative controls reject flattened or reassigned children and altered states in both raw and rendered saved-post content.

The focused browser journey uses an isolated test clipboard populated from the retained HTML, then native paste into the Google Docs converter. It covers staged notices, contradictory-marker rejection, blocked stale application, cancellation, explicit application, a previous-writing checkpoint, state labels in the reading preview, actual WordPress/HTML/Word downloads, private-note exclusion, later edit invalidation and 1440/390/320 layouts. This is a local browser fixture, not actual source-application or physical-device clipboard acceptance.

The new local WordPress case imports the retained HTML through the Google Docs route, downloads actual blocks, enters them through the real WordPress code editor, saves an unpublished draft and reopens it. It checks native valid List/List Item blocks, five item states, exact parent paths, and both strike runs. The pinned Author-role WordPress environment and invalid-block negative control remain unchanged. Exact pass/fail results and the tested source identity are recorded in the release PR; the existence of a fixture is not a passing result.

After building, reproduce the focused browser journey with the already installed test tools:

```sh
CHROMIUM_EXECUTABLE=/absolute/path/to/chromium /absolute/path/to/python scripts/browser-smoke.py --checklists-only
```

The full manual `npm run verify:release` includes this journey, the document corpus and the configured WordPress acceptance run. No Actions, schedules, provider activation, paid dependency, tracking or outreach is introduced. Real-writer sessions, physical-device and assistive-technology acceptance, current Google Docs captures, repeat use and paid demand remain unverified.
