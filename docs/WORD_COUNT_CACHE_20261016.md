# Bounded synchronous article word counting

Cycle 17 was released in [PR #89](https://github.com/nolankido/drafttopage/pull/89), merged as `6f9a81141e130de17c4f8869000f3c9750728779`, tree `b404a6c91bcda1bba3ca5a7b1780cdbae0e73e0a`. The complete stable-source gate passed 875 Node tests, 49 browser journeys, 298 layouts and all 15 document cases. Source SHA-256: `fd139161f7b79b6f7501aff5ce07c0674a0054b7fa922f77f505662754f49dc0`. Native preview build `f0761fca-4f8f-47e9-b990-efcaeaf9717a` and production build `fd607e4c-964f-4443-8c00-11f7395898c4` succeeded; production version `4c493af4-f439-4e86-a0a7-df778921a79d`. Independent public rendering remains unverified.

A fresh starting-main profile attributed 284 of 514 inclusive input-path sample hits to articleWordCount, which re-read structure and parsed inline content on every desk update, including unchanged bodies. The initial profile's synchronous median/p95/max was 19.4/34.7/46.5 ms; input-to-frame was 22.7/38.9/49.1 ms. This is local diagnostic evidence, not field performance.

## Behavior and bounds

The desk now owns one synchronous counter. An unchanged body returns the last complete total without structural or inline parsing. Every changed nonempty article still re-reads its actual block structure, so adding/removing a fence, heading or separator cannot preserve stale block interpretation. Non-code blocks reuse counts only for identical source text; new text uses the exact existing inline/visible-text/word definition. Repeated identical current blocks count once per occurrence, not once per cache entry. Code remains excluded.

The derived map contains at most 512 block-text entries from the last successfully counted article. Rebuilding replaces the map rather than retaining versions. Cached text is bounded by the 60,000-character input as well as the entry cap. Text beyond the cap is counted normally, not omitted or approximated differently. An empty article clears derived text immediately, including after confirmed workspace clearing. Separate desks do not share a counter. Failed validation/computation cannot publish a partial new snapshot; the last complete count remains internally recoverable for that exact prior source, not an edit history. The next valid result replaces it, and empty/reset purges it.

Counts and character length remain synchronous during the same input event. Approval still clears immediately. No timer, worker, asynchronous result, new storage, history, protocol, dependency or changed counting rule is introduced. Source notes and private review fields never enter this cache. The stateless articleWordCount definition remains unchanged for independent comparison and existing consumers. A changing single near-limit paragraph still needs its inline parse; this is not an incremental full Markdown parser or a universal latency fix.

## Checks

All 32 focused count/benchmark/publishing/block checks pass, including eight new counter cases. They cover exact totals across semantic/fence/code/heading/Unicode/CRLF edits, zero-word values, unchanged-body no-parse behavior, current-only reuse, duplicate blocks, the 512-entry cap without loss, separate workspaces, empty purge, failed-count atomicity, invalid/60,000-character bounds and changing near-limit single paragraphs. Three thousand deterministic editing states and their repeated states match the unchanged stateless function exactly.

The focused Chromium journey compares the exact current textarea source against that function. It verifies same-input-event displayed words/UTF-16 characters and approval clearing, metadata invariance, structural edits, a restored 1,000-distinct-paragraph article beyond the cache bound followed by real native typing, optional formatting, checkpoint restore, a current actual WordPress download/private exclusions, clear/reset, and 1440/390/320 layouts. Initial diagnostic fixture issues were corrected: Python newline escaping in the helper test and a timed-out bulk-fill setup. The large fixture now uses the actual reviewed private-backup restore path before native typing. Preliminary incomplete runs are not acceptance passes, and no cause of the bulk-fill timeout is established.

The complete stable-source release gate passed October 16, 2026, 15:16 UTC. Serializers and document schemas are unchanged; this cycle's separate genuine WordPress acceptance is NOT_RUN. PR #87 retains eleven fresh genuine local WordPress 7.1.3 Author-role save/reopen cases. These local checks are not physical-device/screen-reader, actual Word/Google Docs clipboard application, real-user, or independently verified public rendering acceptance.

## Sequential matched diagnostics

Six source-stable Chromium 153.0.8010.0 diagnostics ran sequentially, baseline then candidate for each fixture, with 31 native insertions, a separate warm-up, Markdown destination and closed controlled panels/inventory. Baseline assets come from a detached worktree at the pinned main. The optional harness adds a deterministic distinct-block fixture to avoid relying solely on repeated sample text; every source block in that fixture differs, and it exceeds the cache-entry cap. Original fixture builders and lengths remain unchanged by default.

| Fixture | Synchronous before median / p95 / max ms | Synchronous after median / p95 / max ms | Input-to-frame before median / p95 / max ms | Input-to-frame after median / p95 / max ms |
| --- | --- | --- | --- | --- |
| Rich, 58,833 characters | 15.7 / 24.4 / 26.3 | 10 / 17.4 / 18.1 | 18 / 26.8 / 28.5 | 11.9 / 18.8 / 20 |
| Distinct rich blocks, 58,990 | 15.7 / 54.5 / 61.2 | 12.6 / 23.5 / 24 | 17.5 / 58.1 / 68.1 | 14.4 / 25.2 / 26.2 |
| Ordinary, 58,918 | 6.9 / 14.2 / 32.8 | 5 / 11.3 / 18.5 | 7.9 / 19.8 / 34.3 | 6 / 14.5 / 19.5 |

All six passed fixture, source-stability, runtime-error, unexpected-request and immediate approval guards. Before public SHA-256: `aa0f6d062fe9416c57be3c83b48d09df7005c96c72b52f4e51f1b6f0ae4d6452`. After: `237bba0deeec5900851d1b8e9c5e0bcab32fcebe0f24d487cf5ab2dad8b4099e`. The ordinary rich candidate profile spends most remaining count work in fresh structural parsing; the distinct-block candidate still has uncached inline work beyond the cap, as intended. Counting spies establish reuse independently of sampled attribution.

These selected measurements improved in median and tail, but the same-source initial rich baseline differed from the matched baseline. Earlier active-control regressions and 356.7/417.5 ms maxima remain documented in the lazy-inventory release, with no established cause. Short local samples are not INP, paint completion, a statistical field study, or an all-device/general tail guarantee. Active inventories/reviews, remaining structural/table scans, DOM work and host variability need separate evidence.

No providers, charges, tracking, outreach, persistence, workers, timers, dependencies, Actions, cron, hosting, file-schema or export-approval changes are introduced. Native Cloudflare Git deployment remains intact.
