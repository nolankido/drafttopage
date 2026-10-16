# Inactive WordPress image inspection

Cycle 14 is implemented in [PR #86](https://github.com/nolankido/drafttopage/pull/86), from main `ff2a243b098d25609ba0b99984fb8511644123f5`. Complete stable-source release checks and native deployment outcomes are required before release and belong in the PR.

## Problem and bounded behavior

The public image controller previously read and inspected the article before checking whether WordPress was selected. Shared export-option queries also called that inspection. The previous performance profile identified it as a remaining inactive input-path consumer; fresh source-bound measurements confirm the same path.

Both refresh and option-query paths now check destination first. While inactive they return false, purge the derived body signature, image records, error and rendered list, clear status/limit text, uncheck linked images and disable image-mode and note-download controls. They do not read the current article. Returning to WordPress inspects current references with linked images still off.

A disabled or cached image-choice event outside WordPress is rejected before reading writing or changing approval. Detached image buttons and notes retain current destination/body/busy guards. Eligible and unsupported current references, exact positions, 40-row DOM display and complete downloadable image notes remain. Title-only edits retain an existing explicit choice; body changes, destination changes and workspace reset clear it. No image is selected on return, fetched, uploaded or published automatically. The existing separate export approval is still required. Serializers and version-1 private file formats are unchanged.

## Fresh local measurements

The existing optional [editing benchmark](../scripts/editing_benchmark.py) ran 31 trusted insertions per selected case before runtime changes and again afterwards. The 58,833-character fictional rich fixture, 1440 by 1000 viewport, closed controlled panels, reduced motion, warm-up, timing definitions and sampling behavior are the same as [cycle 13](LONG_ARTICLE_PERFORMANCE_20261016.md). Chromium was `153.0.8010.0`, headless and not CPU-throttled. All four runs passed with unchanged public assets, no runtime errors and no unexpected requests. The Markdown case includes a 1 ms sampled CPU profile; the active WordPress control does not, consistently before and after.

| Local metric, milliseconds | Markdown before | Markdown after | Active WordPress before | Active WordPress after |
| --- | ---: | ---: | ---: | ---: |
| Median synchronous input | 156.9 | 33.3 | 95.8 | 80.4 |
| p95 synchronous input | 259 | 62 | 189 | 133 |
| Maximum synchronous input | 330.1 | 109.6 | 197.5 | 171.9 |
| Median input to next frame | 159.3 | 35.8 | 98.5 | 82.4 |
| p95 input to next frame | 261.1 | 64 | 198.5 | 135.3 |
| Maximum input to next frame | 332.2 | 118.7 | 199.6 | 187.8 |

The baseline Markdown profile attributed 767 of 2411 inclusive sampled input-path hits to the image controller's sync function; image analysis itself accounted for 664. Those paths are absent from the leading post-change profile entries. Four controller regressions independently establish zero inactive draft reads and consent/current-source behavior; three fail on the original controller.

Public-asset SHA-256 before: `f95f20ae8b065ef9b0c70d64064bdf7947e1abf59ee15d26d615cda516d95b57`. After: `24b13f1b98d1eca9fea2d0c36c87e6f6816c101624f132b1d1bac200c59c19c7`. These cover built public files, not the separate repository source digest recorded by the release gate.

These observations are not real-user, physical-device or production latency evidence. The active WordPress control also moved, and the baseline differs substantially from earlier same-source runs. Environment variance and active processing remain important. Lower timings in these selected runs do not establish that the earlier slow outliers are solved or guarantee a general p95 improvement. Cycle 13's regressions remain in its report. Link inspection and word counting remain prominent after this change; further optimization needs its own correctness scope and measurements.

## Checks and remaining limits

All 32 focused image-controller/handoff checks pass, including four new cases covering inactive installation, option queries, reset/toggles, hidden mode/download events, consent purge before surrounding refresh, Unicode/CRLF current positions, stale detached buttons, renewed opt-in, title-only preservation, busy rejection, 40-row inspection and complete 42-reference notes.

The focused Chromium journey passes actual native WordPress downloads with independent image attributes, byte-identical plain and linked output after a destination round trip, renewed consent, guarded hidden mode/download and detached button events, zero inactive downloads, current Unicode references and unsafe-reference warnings, exact guided-edit source, title/body/workspace-restore invalidation, private-field exclusions and inert preview. Expanded layouts pass at 1440/390/320. The complete stable-source gate is still required before merge; exact final counts and source/tree hashes belong in PR #86.

WordPress serialization is unchanged, so the separate genuine save/reopen gate is NOT_RUN in this cycle. PR #81 retains the latest ten local WordPress 7.1.3 Author-role cases. No fresh Word/Google Docs clipboard application, physical-device, screen-reader, real-user or independent live-rendering acceptance is claimed. No Actions, cron, tracking, persistent-writing changes, new dependency, provider, fee, hosting change or outreach is introduced.
