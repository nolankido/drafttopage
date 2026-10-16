# Long-article editing: inactive WordPress handoff

Cycle 13 was released in [PR #84](https://github.com/nolankido/drafttopage/pull/84), merged as `166f25cacdf1c3eef948e8b1ab2967948085ddde`, tree `80d1bf9fe53aead890c97d7837cb3453da8f77ad`. The complete stable-source release gate passed 792 Node tests, 45 browser journeys, 286 layout checks and all 15 document cases. Repository source SHA-256: `1363cb2c7b178e92adc6305634bfdf77954134021038e0f1f10f73732210b419`. Native Cloudflare preview and production builds succeeded; production version `40feeb8b-1e52-40bb-9f7a-d92f0263e993`. Exact build IDs and environment scope are recorded in the PR.

## Measured problem and bounded change

The WordPress handoff controller previously captured the current draft and options, inspected formatting and refreshed kit readiness on changed text even when HTML, Word or Markdown was selected. In a rich Markdown input-path CPU profile, WordPress review accounted for 310 of 622 inclusive sampled input-path hits in the complete matrix. A separate 31-insertion baseline attributed 924 of 1813 such hits to WordPress review. These are sampled stack observations, not precise time shares or measurements of real users.

The controller now checks its destination before reading article content or options. Inactive updates drop the derived review/signature, findings, kit list and statuses, and disable its four field/kit controls. Returning to WordPress recomputes from the current article and options. Existing action handlers still check current destination, writing, approval and busy state. No debounce, deferred approval invalidation, new cache of private writing, changed serializer or automatic export is introduced. The active WordPress path is intentionally unchanged apart from removing redundant visibility checks.

The post-change rich Markdown profiles no longer list WordPress review among their leading sampled paths. Three new controller regressions establish zero inactive draft/option reads, safe toggles/actions, fresh Unicode/CRLF findings, and rejection of saved old actions. Two failed against the original controller; all three pass after the change. The existing empty-article test now checks cleared hidden status, then the existing guidance after returning to WordPress.

## Local measurement method

The optional [editing benchmark](../scripts/editing_benchmark.py) loads built local assets through routed `https://drafttopage.test` responses under the actual CSP. Other network requests are aborted and recorded. No production site, provider, analytics or remote writing service is used. Chromium was `153.0.8010.0`, headless, 1440 by 1000, reduced motion, without CPU throttling. This execution host is not a representative phone or real-user environment.

The ordinary fixture is 58,918 ASCII characters; the rich fixture is 58,833, with headings, bold/italic/strike, safe fictional links, lists and header tables. Source is seeded outside timing, followed by one warm-up. Each measured insertion uses the browser's native trusted text-input path. A capturing input listener starts timing; a bubbling document listener records synchronous input-path duration and the next animation-frame callback records frame delay. These figures omit initial event queueing and are not end-to-end perceived typing latency or INP.

Nine insertions are measured in each of 16 kind/destination/panel cases. Controlled disclosures are the reading preview, selected-export preview, WordPress review/kit, Word/HTML formatting review and additional publishing-kit panels, open or closed together. This is not every optional editing tool. The rich Markdown closed case also uses a 1 ms sampled CPU profile. Both matrices passed with unchanged public files and no runtime errors or unexpected requests. Timing values are diagnostics, not pass/fail budgets.

An initial native bulk-fill setup timed out on the rich fixture before samples could be completed. That partial attempt is not an acceptance pass. The complete matched matrices instead seed source outside the measured interval, then measure actual native insertions. A separate baseline worktree at the starting main repeats the selected case using the same harness. Application files were not modified during any measurement run.

Public-asset SHA-256 before: `1f09f1c2851d28c65cefce3adb3691255150d6cbb5ba07031524f3bbda449cbf`. After: `f95f20ae8b065ef9b0c70d64064bdf7947e1abf59ee15d26d615cda516d95b57`. These cover the built local public tree, separately from the full repository source digest recorded by the release gate.

## Complete nine-insertion matrix

All values below are synchronous input-path milliseconds. With nine samples, nearest-rank p95 is the largest sample. Both improvements and regressions are retained.

| Article | Destination | Panels | Median before | Median after | p95 before | p95 after |
| --- | --- | --- | ---: | ---: | ---: | ---: |
| ordinary | wordpress | closed | 31.3 | 31 | 60.6 | 54 |
| ordinary | wordpress | open | 109.4 | 103.8 | 123.5 | 259.5 |
| ordinary | html | closed | 37.5 | 28.8 | 54.4 | 39.9 |
| ordinary | html | open | 71.3 | 65.8 | 83.3 | 116.1 |
| ordinary | word | closed | 37.3 | 28.4 | 64.5 | 70.7 |
| ordinary | word | open | 70.9 | 77.6 | 134.8 | 97.2 |
| ordinary | markdown | closed | 53.9 | 15.7 | 81.5 | 23.1 |
| ordinary | markdown | open | 54.4 | 47 | 59.2 | 50.4 |
| rich | wordpress | closed | 84.8 | 114.7 | 113.8 | 360 |
| rich | wordpress | open | 302.1 | 312.9 | 440.2 | 591.6 |
| rich | html | closed | 101.3 | 68 | 172.2 | 118.2 |
| rich | html | open | 282.7 | 306.1 | 342 | 749 |
| rich | word | closed | 130.2 | 97.1 | 191.3 | 217 |
| rich | word | open | 257.7 | 214.9 | 339 | 315.3 |
| rich | markdown | closed | 79.3 | 44.3 | 108.9 | 456.6 |
| rich | markdown | open | 190.7 | 152.1 | 289.9 | 223.6 |

The active WordPress control cases do not establish a speedup. Some open-panel medians and several tails worsened. Shared-host scheduling, allocation/collection and expensive still-active work are possible contributors, not established causes. Do not infer a universal speedup, production p95 reduction, real-device improvement or acquisition/retention result from these data.

## Larger selected-case repeat

The separate starting-main worktree and modified tree each ran 31 rich Markdown closed-panel insertions, with the same browser and fixture. Public digests matched their corresponding full-matrix runs and remained unchanged.

| Metric, milliseconds | Before | After |
| --- | ---: | ---: |
| Median synchronous input | 65.2 | 39.5 |
| p95 synchronous input | 90.4 | 323.7 |
| Maximum synchronous input | 103.1 | 693.7 |
| Median input to next frame | 66.8 | 41.5 |
| p95 input to next frame | 92 | 325.6 |
| Maximum input to next frame | 104.6 | 711.9 |

This confirms lower median measured work in this selected case, while explicitly failing to establish better tail latency. Remaining large-article stalls need a separate measured investigation. Image analysis and link inspection remain prominent in the post-change profile; the next change must preserve linked-image consent and exact source guards rather than simply hiding their warnings.

## Validation and reproduction

The 28 focused tests cover controller behavior, existing actionable findings, benchmark fixture sizes/statistics and the optional/local/source-bound harness. The new browser journey passed destination switches, hidden and detached action guards, no inactive clipboard writes, byte-identical actual six-file WordPress kits after a destination round trip, private-field exclusions, fresh current findings, native near-limit approval invalidation and 1440/390/320 layouts. An initial long-article UI fixture accidentally exceeded 60,000 characters and was rejected while preserving current writing. It now uses an explicitly checked 58,750-character backup before native typing. Preliminary incomplete runs are not acceptance passes. The complete stable-source gate passed October 16, 2026, 12:38 UTC, including unchanged-source verification. All 55 relative Markdown links in changed prose and diff checks also passed.

After `npm run build`, an explicitly configured local browser can run:

```sh
CHROMIUM_EXECUTABLE=/path/to/chromium /path/to/playwright-python scripts/editing_benchmark.py --output test-results/editing-benchmark.json
```

Use `--samples 31 --only rich:markdown:closed` for the selected repeat. Use a separate baseline worktree and the same harness to compare a pinned earlier runtime. Do not run competing browser suites while collecting timings. Missing dependencies are not installed automatically, prior reports are removed before a run, and public-source changes or runtime/unexpected-network errors prevent a PASS. The benchmark is deliberately not part of the release gate and does not enforce noisy timing thresholds.

WordPress serialization is unchanged; this cycle records its separate genuine save/reopen gate as NOT_RUN and retains PR #81's ten local Author-role cases. No fresh Word/Google Docs application clipboard, physical-device, screen-reader, real-user or independently verified public rendering acceptance is claimed. No Actions, cron, providers, fees, dependencies, persistent writing, tracking, hosting changes or outreach are introduced.
