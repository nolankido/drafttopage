# Active export review: paired browser performance validation

This is an optional, isolated timing evaluation for PR #116, whose source-level improvement reduced duplicate article parses. Less parsing does not itself establish lower typing latency.

## Provenance and controls

Before uses the three exact public module Git blobs from production commit 4338b5e2629c7764a8382cfe52fefaf8db27b08c. After uses the corresponding three modules from the PR #116 feature commit 642affa77efbe46f5158341f15816d1c0b5f4512. All other current built public assets are held byte-identical, including CSS, handlers, templates and public policy. Original modules are preserved in tests/fixtures/review-ab-before-116 and verified against their exact Git blob SHAs.

After building the site, run python3 scripts/review_ab_benchmark.py --samples 31. Previously installed Python Playwright and Chromium are required. The runner never installs anything, does not use GitHub Actions, does not fetch public pages and refuses changed module SHAs. It uses the unchanged optional scripts/editing_benchmark.py and ephemeral public directories, without editing current files.

Five controlled near-limit Markdown cases cover ordinary and rich WordPress, rich Word, rich HTML, and a rich Markdown inactive-review control. Each has 31 native Chromium insertions per run in order before, after, after, before, yielding 20 sequential runs. Median, nearest-rank p95, max and frame timing are preserved independently for all runs. The aggregate lists each pair's range. All unexpected requests, errors and source modifications fail the run. Timing regressions never become an automatic green improvement claim.

The measured path begins inside the input listener and ends at the document bubbling listener; input-to-frame is to the next animation-frame callback. It is not event queueing, a paint measurement, Web Vitals INP, production traffic, a physical device or real-user acceptance. Results on a shared host, especially extreme tails, are inherently noisy. Never discard adverse results or claim user-experienced speedup from this diagnostic.

## Execution evidence

Results are pending the single-use isolated preview execution. After the diagnostic run, record the complete pass/fail receipt and negative findings here. Do not merge any temporary preview build hooks or install GitHub Actions.
