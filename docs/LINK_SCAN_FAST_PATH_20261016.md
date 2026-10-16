# Skip impossible article link inspections

Prepared from main `814bfa5d89ff13f50c4abc3aa80f21632335fab9`, with PR #95 integrated as the proposed series base. This is a feature candidate, not a main merge or production deployment. The final full stable-source gate and native preview result belong in its PR after execution.

## Reproduction and selected scope

A fresh current-main 31-insertion rich Markdown diagnostic with the link inventory open recorded synchronous median/p95/max 22.1/44/73.8 ms and input-to-next-animation-frame 24.8/46.2/78.4 ms. Its profile attributes 318 of 572 inclusive update-path sample hits to link-editor refresh, including 291 in articleLinks. Public asset SHA-256 `a95ba21e17329b5aed08e62c65a75828df3a6bdeafdb1edffcf5fb4914471628`. This reproduces a local cost, not field latency.

The selected change runs existing full body validation first, then returns an empty link list only if the entire article contains no literal opening bracket. Recognized inline Markdown links require that character. Every possible candidate, including escaped brackets, code and images, keeps the complete original structure/table/inline scan. Table membership, lines and UTF-16 offsets are unchanged. No cache, history, retained block text, timers, debounce or persistence is added. Existing guided editing, complete notes, source rechecks, checkpoints and approval rules stay authoritative.

A frozen test-only copy of starting main's articleLinks provides the oracle. Six new cases cover impossible articles, full-parser candidates, complete Unicode/CRLF/table/emphasis records, 5,000 deterministic mixed editing states, near-limit and 900-link articles, complete notes, invalid input and parser failure. All 32 focused link tests pass. The browser journey passes 519 distinct linked paragraphs, native paste/edit/undo and fenced-code transitions, fresh source lines and selected URL, hidden inventory purge/reopen, all-link notes, byte-identical actual block exports/private exclusion, and a 900-paragraph plain article becoming a current linked article. Approval clears on real edits. Layouts pass at 1440/390/320; the 320px empty-inventory screenshot was inspected. A preliminary fixture tried typing in closed source notes; its corrected navigation passes. Preliminary failures are not acceptance passes.

## Rejected variants

A 512-current-block inline-result cache passed its 34 focused checks and browser correctness diagnostic but had mixed timing and additional retained state. Its [production patch](experiments/rejected-link-cache-20261016.patch) is retained for reproduction only. It is absent from the final public modules. Local experiment commit was `b070c5a06e209824f52e9c0f5a8d10861e05f6d0`; no full release pass is claimed for it.

A [per-block opening-bracket guard](experiments/rejected-block-link-guard-20261016.patch) also passed exactness checks, but active rich p95 worsened in both recorded pairs and unique-block results varied. It is not the selected implementation. Its loop shortcut is removed; the final guard applies only to a whole article with no candidate character.

## All sequential measurements

Each record uses 31 trusted native insertions in one fictional near-limit article, link inspection open unless named closed, Markdown destination and reading/export panels closed. Ordinary articles contain 58,918 characters; repeated rich articles 58,833 and unique rich articles 58,990. The same unchanged harness is used in both trees. Initial seeding and warm-up are outside the measured interval. Input-to-frame ends at the next animation-frame callback; it is not paint or INP. No browser diagnostics, local tests or other benchmarks ran concurrently with these measurements. Remote public-browser observations are separate from local timing.

The cache baseline is pinned main, public SHA `a95ba21e17329b5aed08e62c65a75828df3a6bdeafdb1edffcf5fb4914471628`; its candidate is `576ccc00cdb4686d89f2ec26ed518bcfa63d7666e9f726a64e962f9f0a29bdfb`. Later paired baselines use the PR #95 candidate, local `8f51eb1`, public SHA `096bdaff036c0779f28547cb110054e4844217a398e6062931c6f06065a1e3d3`. Its Markdown workspace and runtime modules are unchanged from main; the guide changes other static pages. The block-guard candidate is `1e5d4be27d80ae741fb0acc78fb22d99be3553e0968a23fd1ab2258f204130e7`. The measured whole-article guard candidate is `7f5cc996244d7096f1dff6c007f3b69a6ed4631516b0ee2aa8ae19c219403134`. All 26 records passed source-stability, exact insertion count, approval, request and runtime checks. Subsequent review corrected two evidence URLs on the separate guide page; the measured Markdown page and runtime modules are unchanged. The fresh combined release gate includes that correction; timing records retain their actual earlier public hashes.


### Rejected cache

| Run order | Synchronous ms, median / p95 / max | Input-to-frame ms, median / p95 / max |
| --- | --- | --- |
| active-before | 21.9 / 33 / 33.2 | 24.5 / 36.1 / 36.6 |
| active-after | 10.9 / 57.2 / 110.1 | 13.5 / 63.9 / 118.5 |
| closed-before | 5.3 / 15.9 / 20.4 | 7.4 / 19 / 29.4 |
| closed-after | 6.2 / 21.4 / 44.4 | 9.1 / 30 / 61.1 |
| unique-before | 26.5 / 73.9 / 224.8 | 29.3 / 90.1 / 233 |
| unique-after | 35.3 / 51.7 / 53.3 | 38.7 / 55.3 / 57.5 |
| unique-reverse-after | 23.4 / 47.1 / 96 | 26.1 / 52.1 / 99.9 |
| unique-reverse-before | 26.4 / 36.4 / 39.7 | 28.6 / 39.6 / 42.9 |
| active-reverse-after | 14.2 / 24.1 / 41.6 | 17 / 27.2 / 49.8 |
| active-reverse-before | 32.5 / 180 / 370.3 | 36.6 / 420.1 / 467.9 |

### Rejected block guard

| Run order | Synchronous ms, median / p95 / max | Input-to-frame ms, median / p95 / max |
| --- | --- | --- |
| active-before | 17.5 / 26.4 / 29.6 | 19.6 / 28.9 / 31.4 |
| active-after | 14.9 / 29.9 / 30.7 | 17.7 / 34.8 / 39.9 |
| closed-before | 4.4 / 6.8 / 7.1 | 5.9 / 8 / 8.4 |
| closed-after | 4.9 / 7 / 8.2 | 6.5 / 10.4 / 10.7 |
| unique-before | 20 / 28.6 / 36.5 | 21.7 / 31.2 / 38.6 |
| unique-after | 16.8 / 21.3 / 24.1 | 19.1 / 23.9 / 25.6 |
| unique-reverse-after | 27.4 / 38.1 / 55.9 | 30.5 / 40.6 / 61.5 |
| unique-reverse-before | 20.6 / 33.4 / 51.4 | 22.6 / 35.6 / 57.4 |
| active-reverse-after | 19.8 / 38.4 / 69.8 | 22.5 / 40.1 / 80.1 |
| active-reverse-before | 19.9 / 33.1 / 55.4 | 22.7 / 36 / 62 |

### Final article guard

| Run order | Synchronous ms, median / p95 / max | Input-to-frame ms, median / p95 / max |
| --- | --- | --- |
| plain-before | 6.4 / 12.2 / 14.3 | 7.3 / 13.8 / 15.4 |
| plain-after | 4.5 / 27.5 / 35 | 6 / 34 / 43.6 |
| plain-reverse-after | 3.4 / 10.6 / 10.6 | 4.3 / 12.4 / 12.8 |
| plain-reverse-before | 7.3 / 18.2 / 33 | 8 / 19.7 / 35.7 |
| rich-before | 19.1 / 47.7 / 61.8 | 21.3 / 50.4 / 70.2 |
| rich-after | 15.8 / 25.3 / 34.7 | 18.1 / 28.3 / 36.9 |

The final ordinary median improves in both orders, but its first p95/max worsen. Rich input still uses the full parser and its varying control results demonstrate same-source noise. None of these records establishes a general tail-latency or field improvement. Earlier 356.7/417.5 ms outliers, current rejected-cache 370.3/467.9 ms maxima, structural fallback regressions and device differences remain unresolved. The concrete result is less work for impossible articles, with exact behavior retained; it is not a claim that long-article latency is solved.

## Reproduce locally

Use the manually installed Chromium and Python/Playwright described in [the release baseline](RELEASE_BASELINE_20261016.md). Run the same absolute scripts/editing_benchmark.py from each pinned worktree, sequentially, with --samples 31 --only ordinary:markdown:closed --link-inventory open and a separate output file. Run rich:markdown:closed as the full-parser control. The earlier variants also use --unique-blocks and a closed-inventory control. Preserve all before/after and reverse-order records, not only the best pair. No dependencies are installed, no production requests are made and no Actions/cron is added.

The separate [live site observation](LIVE_SITE_CHECK_20261016.md) verifies one public workflow independently. Human/device/source-application acceptance and the original demand gates remain open in [the roadmap status](ROADMAP_STATUS_20261016.md).

The first combined full gate passed October 16, 2026, 19:42:55 to 19:50:26 UTC: 900 Node tests, 55 browser journeys, 322 layout checks, all 15 document cases and eleven genuine local WordPress 7.1.3 / PHP 8.3.33 / SQLite Author-role save/reopen cases without unfiltered HTML, including the invalid-block control. Tested local commit `c4cc12ae00ad65263b5b322838856d95f7559a2e`, source SHA-256 `ab4a869cecbb228121ce17f73269c7a051526d5f9cda3d576728e3862e9fc832`. Native preview build `e2c2a732-8ed6-40ef-a05e-ef495202d884` succeeded for its byte-identical uploaded tree. The final PR records the subsequent fresh combined gate and preview including the evidence-pointer correction. Neither candidate is a production merge or deployment.
