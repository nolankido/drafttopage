# Active export review: paired browser performance validation

This is an optional, isolated timing evaluation for PR #116, whose source-level improvement reduced duplicate article parses. Less parsing does not itself establish lower typing latency.

## Provenance and controls

Before uses the three exact public module Git blobs from production commit 4338b5e2629c7764a8382cfe52fefaf8db27b08c. After uses the corresponding three modules from the PR #116 feature commit 642affa77efbe46f5158341f15816d1c0b5f4512. All other current built public assets are held byte-identical, including CSS, handlers, templates and public policy. Original modules are preserved in tests/fixtures/review-ab-before-116 and verified against their exact Git blob SHAs.

After building the site, run python3 scripts/review_ab_benchmark.py --samples 31. Previously installed Python Playwright and Chromium are required. The runner never installs anything, does not use GitHub Actions, does not fetch public pages and refuses changed module SHAs. It uses the unchanged optional scripts/editing_benchmark.py and ephemeral public directories, without editing current files.

Five controlled near-limit Markdown cases cover ordinary and rich WordPress, rich Word, rich HTML, and a rich Markdown inactive-review control. Each has 31 native Chromium insertions per run in order before, after, after, before, yielding 20 sequential runs. Median, nearest-rank p95, max and frame timing are preserved independently for all runs. The aggregate lists each pair's range. All unexpected requests, errors and source modifications fail the run. Timing regressions never become an automatic green improvement claim.

The measured path begins inside the input listener and ends at the document bubbling listener; input-to-frame is to the next animation-frame callback. It is not event queueing, a paint measurement, Web Vitals INP, production traffic, a physical device or real-user acceptance. Results on a shared host, especially extreme tails, are inherently noisy. Never discard adverse results or claim user-experienced speedup from this diagnostic.

## Completed isolated results, October 16 HST

**Validation PASS** on nonmerging diagnostic commit 72cda71fdd90521803835710216960fc2ee8b996. The [native Cloudflare preview receipt](https://validate-paired-export-review-20261016-drafttopage.nolankido.workers.dev/_dtp_review_ab_probe_20261016.json) was independently fetched and source-checked. Its complete synthetic evidence is retained permanently in [the 20-run raw report](evidence/review-ab-performance-20261016.json).

The diagnostic ran the full Node suite (94 seconds), static checker (7 seconds), Python syntax (pass), pinned Python Playwright and Chromium, local Chromium libraries, and the full 20-run benchmark (268 seconds). Every stage reported PASS. The artifact has 20 valid controlled runs, five case summaries, zero reported errors, unchanged public source, the exact baseline/candidate Git blob identifiers, and all native insertion metrics. The diagnostic hook and synthetic public receipt must **never** be merged into production.

The table preserves every pair's p95 interval. Values are synchronous input-handler milliseconds. Medians are medians of the two run medians for that version, **not** medians over all 62 samples.

| Case | Before median | After median | Before p95s (range) | After p95s (range) | Before max | After max |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| ordinary / WordPress / open | 98.6 | 95.7 | 131.7–162.4 | 130–155.9 | 174.3 | 192.7 |
| rich / WordPress / open | 357.5 | 350.3 | 602.2–612.5 | 607.4–703.2 | 694.8 | 710.8 |
| rich / Word / open | 245.1 | 230.5 | 292.8–375.2 | 333.3–395 | 398.5 | 504.7 |
| rich / HTML / open | 224.05 | 212.05 | 295.4–329.5 | 339.7–361.3 | 398.2 | 387.4 |
| rich / Markdown / open (inactive review control) | 116.6 | 110.15 | 138.3–176.6 | 124.6–141.8 | 179 | 185.8 |

The retained artifact also includes the input-to-next-animation-frame medians, p95 ranges and maxima for **every** run, plus the exact individual run order and asset fingerprints. Its p95s are nearest-rank statistics over 31 observations, and paired host drift remains possible. The rich WordPress, Word and HTML tails were worse in some measured runs. Word's maximum synchronous path rose from 398.5 ms to 504.7 ms, while rich WordPress's worst p95 rose from 612.5 to 703.2 ms. Those adverse figures are kept, not omitted.

**Conclusion:** The measured medians were modestly lower across all five scenarios, but the inactive Markdown control also improved by roughly the same proportion as Word and HTML. Therefore this experiment **does not isolate a causal speedup** from structural reuse. It **does not demonstrate lower p95, improved field latency or better physical-device responsiveness**. The engineering outcome of PR #116 remains fewer redundant structural scans with unchanged output and passing acceptance, not a verified interactive-performance win. Do not revert a behaviorally correct release based on these noisy synthetic tails alone; investigate stable long-article profile hotspots and obtain device/real-user acceptance before claiming performance improvement.

No production WordPress install, real author, human study, hosted service, billing, external tracking or GitHub Actions was part of this measurement.
