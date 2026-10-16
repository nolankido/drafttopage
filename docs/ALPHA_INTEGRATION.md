# Alpha compatibility and integration gate

Checked October 16, 2026 UTC. This is code-review evidence, not permission to merge, release, or invite testers.

## Two independently changing lines

- Alpha PR #47 was at `1cc800083e4afdcfd43f28f3c28adf62029ce632`, tree `83390c9eddabefd0d5f4afc17d829c50e9c50ea0`, when this pass began.
- The checked main snapshot is `d63b28c62c520d1615335ce6d2f26dbf7ccce27f`, tree `277e61d28b5182fdaf16476a9fce154c0050c2ca`.
- Shared source baseline: `b4b9df2635abcd5f764abceab32a4adf7dd950d4`.

Main is actively changing elsewhere. Its Word image/note/comment/revision handling, nested inline formatting, reference links, Markdown headings/separators, destination previews, backup inspection, layout, search protection and HTML-to-Markdown work must not be overwritten by this older alpha line. The observed worktree was left untouched. All candidate checks ran in a separate detached copy of the pinned commit.

Do not interpret either branch's independent passing suite as a passing combined application. Pin the actual heads again before integration. No main merge or public release was performed by this pass.

## Repeatable private-file and publication checks

Use Node >=22 and Python 3. From the alpha repository:

```sh
npm run test:alpha-portability
DRAFTTOPAGE_COMPAT_ROOT=/absolute/path/to/isolated-candidate npm run test:alpha-portability
```

The default command checks the alpha contract against itself. The explicit path loads the candidate's actual workspace, article import and WordPress kit modules. It does not edit that path, check out a branch, access browser storage or call a network service. Supply a trusted local repository, not arbitrary downloaded code. Confirm its commit and clean tracked state first.

Eight cases cover version-1 backups in both directions (notes-only, a complete article, and a Unicode body within 50 UTF-16 units of the 60,000-unit limit); rejection of unknown versions, extra transient state, nulls and oversized writing; explicit Markdown/JSON import; and actual WordPress ZIPs with linked images off/on. An independent Python ZIP/HTML reader checks CRCs, all six files, exact original Markdown, golden visible text, page fields, structure, list start, inert source HTML, image mode and exclusion of fictional private-note markers. Original inputs are not mutated.

Where a candidate has the optional transfer-comparison model, the tests compare it with independently read block text too. Pinned main has no such model and the command explicitly reports that limitation. Its publication kit is still checked. These fixtures exercise the shared subset, not all of main's newer formats or every imported article.

## The merge dry run is not clean

A Git merge-tree calculation using the common baseline and the initial pinned trees reported **22 content-conflict paths**. No merge was applied to a branch, index or working source. The first attempt in the reconstructed alpha repository could not read its original baseline object; the calculation succeeded in the isolated candidate copy with the baseline object present.

Repeating the calculation after separating the comparison model reports **23 conflict paths**: `public/wordpress-export.js` is now explicitly conflicted instead of silently retaining an unbound comparison dependency. This is not a resolved merge. With the required commit objects present, reproduce the calculation without applying a merge:

```sh
git merge-tree --write-tree --merge-base=b4b9df2635abcd5f764abceab32a4adf7dd950d4 feat/alpha-first-article-20261015 d63b28c62c520d1615335ce6d2f26dbf7ccce27f
```

Exit status 1 is expected for these conflicts. Do not treat the generated tree as releasable or check it out over active work.

| Area | Conflicting paths | Preserve and reconcile |
| --- | --- | --- |
| Editor and review | `public/desk.css`, `public/desk.js`, `public/review-controls.js`, `public/source-review-controls.js` | Main's layouts, destination previews and protected editing; alpha's deliberate recovery, review reset and comparison lifecycle |
| Import and source | `public/html-import.js`, `public/import-controls.js`, `public/markdown-inline.js` | Main's richer conversion/parser; alpha's literal plain clipboard, ordered findings and stale-preview rejection |
| Recovery and shared pilot | `public/recovery.js`, `public/pilot.js`, `src/recovery-markup.js` | Main's newer file review; alpha's off-by-default browser recovery, explicit consent, checkpoint/refusal, removal and busy-state rules; no pilot activation |
| Navigation and page assembly | `scripts/build-content.mjs`, `scripts/site-shell.mjs`, `scripts/google-docs-tool.mjs`, `scripts/writing-desk.html`, `scripts/writing-pages.mjs` | All newer routes and guided controls; reachable alpha consent/review/handoff; avoid duplicate IDs or competing status owners |
| Copy and help | `public/export-controls.js`, `public/wordpress-export.js`, `scripts/formatted-import-help.html.inc`, `scripts/google-docs-intro.html.inc`, `scripts/import-panel.html.inc`, `scripts/word-to-wordpress-intro.html.inc`, `scripts/wordpress-tool-intro.html.inc` | New destination review and output; explicitly restore the comparison re-export without losing the nested renderer; all five alpha clipboard locks, stale outcomes, nearby feedback, explicit import acknowledgement |
| Project status | `README.md` | Accurate route list, development status and the distinction between branch evidence and a release |

There was also a **silent merge hazard** in the automatically combined `public/wordpress-export.js`: the alpha text-model function remained, but the main renderer import replaced the import that supplied `inlineParts`. Calling that combined function would reference an undefined name. Conflict counts alone therefore are not a sufficient integration check.

The alpha comparison model now lives in `public/wordpress-text.js` with its own explicit dependencies, re-exported through the existing WordPress exporter API. Its article validation and image-choice boundary remain. Separator blocks, if supplied by a newer parser, contribute no visible text. The existing text-comparison regression suite verifies current behavior. Preserve main's nested renderer and parser when reconciling; do not replace them with the alpha renderer.

## Focused model-overlay diagnostic

In a disposable, pinned candidate copy only, copy the alpha `public/wordpress-text.js` unchanged to `public/wordpress-text.integration-probe.js`. Then run:

```sh
node scripts/check-alpha-model-portability.mjs /absolute/path/to/isolated-candidate /absolute/path/to/isolated-candidate/public/wordpress-text.integration-probe.js
```

This read-only command compares the supplied model with the candidate's actual exporter and an independent HTML reader for six fictional cases: nested emphasis, a styled link, and an underlined heading with a separator, each with linked images off/on. It uses hand-written expected visible text. The overlay must use candidate dependencies, not accidentally resolve back into the alpha directory. Its passing result is a focused compatibility probe, not an integration build or a claim that pinned main contains the alpha model.

## Checks actually completed

- Eight portability cases passed against both the alpha modules and pinned main's modules. The candidate lacks the transfer model; its kit checks passed, not a nonexistent comparison UI.
- Pinned main's own suite: **665 tests passed**. Its static checks passed for **29 HTML pages**. This happened before the untracked model probe was added to the isolated copy; tracked source stayed at the pin.
- The unchanged alpha model file, Git blob `fa5a72f9f27393b0b0d973c09bb1f7667bbcddc6`, passed all six focused overlay probes against pinned main dependencies. No main source file was replaced.
- The alpha's existing 15 transfer-comparison cases passed after separating the model dependency.

Full alpha suite and static results are recorded in `docs/ALPHA_READINESS.md` and the PR. The pins and counts here are dated observations, not a promise that a subsequently changed main has passed.

## Before merging or inviting testers

1. Wait for a stable integration point. Re-read current heads and active work, then resolve the file groups deliberately on a review branch. Do not force-push either line or accept ours/theirs wholesale.
2. Recompute conflicts and inspect automatically merged runtime modules too. Run both feature-specific suites plus the full combined suite and static checks. Test comparison against nested inline formatting, headings/separators, tables, code and both image modes.
3. Check every generated workspace route, including newer Markdown and HTML routes. Confirm IDs, step navigation, layout changes, approval/reset, busy flags, pending previews, private-note boundaries and clear/remove flows.
4. Keep native Cloudflare configuration intact and GitHub Actions/cron absent. A branch preview is not a public release.
5. Complete the human/device/source/WordPress acceptance in `docs/ALPHA_READINESS.md`. Real Word files, real Google Docs selections, exact clipboard payloads, full close/reopen, intended WordPress save/reopen, narrow devices and assistive technology remain unverified by this pass.
