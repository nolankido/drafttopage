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
