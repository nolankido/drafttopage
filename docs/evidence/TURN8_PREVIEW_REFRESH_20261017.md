# Turn 8 reading-preview refresh benchmark protocol

Scope: **synthetic and local** until executed on the declared devices. This is not field INP and does not certify actual paint time. Earlier pinned ABBA local Chromium results are at \`docs/evidence/review-ab-performance-20261016.json\`; they are prior revisions, not a measured before/after for Turn 8.

The parsed-only smoke from a lightweight isolate on the October 17 Turn 7 main used:
- Fictional ordinary 6,600 characters: 40 runs, parser median below 1 ms, p95 about 1 ms.
- Fictional ordinary 58,798 characters: 15 runs, parser median about 1 ms, p95 about 2 ms.
- Fictional rich 58,833 characters: 15 runs, parser median about 5 ms, p95 about 6 ms.

Those parser-only timings omit browser DOM creation, painting, device input queue and full controller refresh. They **do not** establish visible-update latency. The existing broader synthetic benchmark (prior PR #116) observed much slower full-input handling in rich near-limit cases, so this change addresses repeated DOM rebuilding rather than parser micro-optimization.

## Measured performance target (provisional)

- On each declared target device/browser/assistive-technology combination, define budgets *before* the paired A/B run: normal article p95 visible update below 200 ms; no unexplained multi-second stall or lost input. Near-limit p95 is recorded and compared, not assumed to meet the normal-document target.
- Benchmark startup-to-first-usable-input, full native paste, first reading preview, 15 typed edits with the reading preview already open, WordPress export preparation, and save/recovery actions.
- Use **identical** original and candidate builds on the same machine, browser version, viewport, article (6K normal and 58K rich), and sequence, with serial ABBA orders, 20+ measured updates per cohort after warmup. Include cold-load network and paint measures separately; do not mix browser scripting and user-input latency.
- Record timestamps via the browser Performance API around actual input handlers and requestAnimationFrame paint (not JavaScript parser-only timings), median, p95, max, counts, failures, export hashes, source-ending check and immediate export-approval invalidation. Confirm no drift in saved and exported bytes.
- This implementation coalesces only **background repeated preview renders** when the article is at least 12,000 characters, the editor has focus and passage navigation is off. A full render is still immediate on initial open and explicit navigation. The coalescer has 70 ms quiet time and a 160 ms deadline. The old preview is inert and marked busy until replaced. This is not a browser rendering throughput claim until the before/after device benchmark is run.
- Run existing local \`python3 scripts/editing_benchmark.py --samples 31 --only rich:wordpress:open\` and the full \`npm test\` and \`npm run check\` on a complete checkout. Use the original main commit before Turn 8 as a baseline, with the same run configuration; separate any changed dependency versions.

## Explicitly unverified

Hardware-specific input-to-paint p95, iOS Safari paste and keyboard, Android Chrome, screen-reader focus transitions, and hosted WordPress draft acceptance remain **NOT_RUN** here. Synthetic queue tests prove schedule and state invariants, not physical device responsiveness.


## Paired full-controller synthetic evidence from this turn

An additional controlled V8-source simulation loaded the **actual unmodified main** \`public/preview-navigation.js\` at \`de8cdd09449492161e9fc72251c77d320ccf0f46\` and the candidate at \`fdaf53e17725a579c3e0c84fa962a59d8d84f2ec\`, together with the actual dependent \`preview.js\`, Markdown parser and inline-renderer modules. Both ran the same fictional rich 58,833-character body with 1,148 parsed passages against detached DOM-like node objects. A 15-edit burst appended one character at each step. Simulated keystrokes were spaced 7 ms apart, then the candidate's bounded timer was delivered after the burst.

| Synthetic measurement | Prior main | Candidate |
| --- | ---: | ---: |
| Initial full reading-preview construction | 40 ms | 41 ms |
| Sum of 15 synchronous refresh calls | 510 ms | 2 ms |
| Full preview replacements through edit burst | 16 | 1 |
| Full replacements after bounded delivery | 16 | 2 |
| Final 15-character ending present | Yes | Yes |
| Pending view inaccessible until new render | Not applicable | Yes (inert, aria-busy) |

These **single-run** V8 timings are not ABBA medians or Chromium user-experience measurements. The supplied baseline is the entire old controller, not an invented rendering-only control. They validate that the candidate reduces repeated synchronous DOM construction under the selected source and event sequence. No full viewport layout, paint, device scheduler, clipboard paste, startup network cost, browser extension effects or hardware timings were measured. Only one source type and one burst length were used for this comparison. Do **not** use these numbers as a product p95 claim.

For reruns on a complete repository checkout, \`node scripts/preview-input-benchmark.mjs\` produces a local controlled ordinary/rich same-source report for the checkout's implementation. Run it on the pinned before/after commits with identical Node versions. The script does not contact a website, fake a WordPress save, or assert browser/device budgets.

This turn's direct source-level queue checks additionally confirmed a single callback wins during a burst, a 160 ms cap prevents indefinite deferral, source changes are read at execution rather than captured, and clear/explicit flush cancel pending work. The complete Node suite, full Chromium benchmark, real-device normal-document p95, paste and startup metrics are **NOT_RUN** in this environment.
