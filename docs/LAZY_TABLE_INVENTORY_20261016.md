# Current table inventory and native bulk paste

Released in [PR #91](https://github.com/nolankido/drafttopage/pull/91), merged as `483e8b47f2406e619f5eea20687eaa2f61fe24f3`, tree `736f6edcd9981cc7bd8d965711bc4c845afd44f4`. Complete stable-source gate passed October 16, 2026, 16:35 UTC: 880 Node tests, 51 browser journeys, 304 layouts and all 15 document cases. Source SHA-256: `b15b4c0b46528132efe46808552151a48540767eca020d07046468401a9744dd`. Native preview build `d361fcb9-eee4-48bd-8f67-b88c5f179098` and production build `e2a5b700-de39-4093-9aa3-47b167d04c37` succeeded; production version `b5b447aa-c0ea-4f49-8b91-4d79e81ee7fe`. Separate genuine WordPress acceptance was NOT_RUN in this unchanged-serializer cycle; PR #87 retained eleven local cases. Later PRs #92 and #93 each reran eleven fresh genuine local cases. Independent public rendering remains unverified.

## Bounded behavior

The table editor now inspects article tables only while its disclosure and every containing disclosure are open. A source change while closed removes obsolete choices without inventory parsing. Opening inspects the exact current article. An unchanged current list and its chosen option remain across closing/reopening, including an ancestor disclosure, so the selected duplicate occurrence does not silently reset. The cached inventory still describes only one current article, not a history. No persistence, timers, workers, dependencies or file-schema changes are added.

Pending target and prepared cells retain their original semantics. Every source change still clears the old apply preview and requires explicit location recheck. The exact unchanged chosen table, or current article end for a new table, must match before preview/apply. A hidden selected-list action is guarded. Current-source checks still reject events before a refresh has caught up. Forty choices remain the display limit; the article cursor still reaches later tables. Existing complete-table edits, no-ops, paging, bounds, checkpoints, review invalidation and private-field exclusions are unchanged. Explicit cursor commands may parse source; the zero-work claim is inventory inspection while closed, not all article parsing.

All 27 focused table/model/diagnostic checks pass. Five new controller cases fail against the starting controller and pass against this change. They count actual inspector calls and cover default/ancestor deferral, source purging, unchanged selection/node identity, hidden-action rejection, prepared-cell retention and exact duplicate recheck, forty-choice/later-cursor fallback and failed inspection without old-list leakage. The earlier twenty table cases still pass against both controllers.

The full browser gate passes exact native export-byte equality across unchanged toggles, hidden native edits, retained prepared cells, stale preview/list purging, deliberate duplicate-table and new-end rechecks, exact surrounding UTF-16 source, checkpoint capture, approval reset, independently read actual downloaded HTML table text/private exclusions and 1440/390/320 layouts. The desk boundary-paste check below also passes in that complete gate. Additional 320px table-choice/preparation viewport screenshots were inspected after validation without source changes.

## Bulk-input timeout diagnosis

The prior 47,888-character, 1,000-paragraph fill-helper setup timeout was reproduced on current main after the original preceding small-edit sequence. Event observation showed repeated trusted insertText input events, not one application paste. A bare textarea without any application code also emitted **2,998 trusted insertText input events** for that helper and completed in 5.827 seconds. Application handlers running for those events explain the local helper workload; this does not establish a supported-paste defect or a universal Chromium diagnosis. The application and its guards were not patched to bypass native events, and timeouts were not lengthened.

The same 47,888-character source pasted with the actual browser clipboard and Control+V after the original edit sequence was exact and emitted **one trusted insertFromPaste input event**. The browser automation round trip measured 0.259 seconds in that diagnostic, not field latency or paint completion. A fresh-page native paste also passed. Initial diagnostic attempts that did not reach assertions are not acceptance passes.

A durable release journey now checks native clipboard paste in all eight workspaces using a fictional 1,000-paragraph source with Japanese text, an emoji and an ending marker. It asserts exact text, one trusted input event, same-event approval reset and UTF-16 character count, native undo/redo, full 60,001-character rejection with writing/approval retained, selected-range replacement and undo. The desk additionally tests exactly 60,000 UTF-16 characters from CRLF clipboard text without truncation, followed by undo. Test-only clipboard permissions apply solely to the local fictional origin; no application clipboard read, collection or provider call is added.

This is routed local Chromium 153.0.8010.0 / Playwright 1.64 validation, not actual Word/Google Docs selections, physical devices, assistive technology or all-browser acceptance. The old backup-restore setup remains a separate recovery/counting case, not a substitute for native paste.

## Sequential diagnostics

A fresh 31-insertion rich Markdown/closed-panel starting profile attributes 64 of 376 inclusive input-path hits to the closed table refresh. Inspector spies establish logical deferral independently of sampled attribution. The optional benchmark adds an explicit `--table-inventory open` control, opens its ancestors and asserts all forty rich-fixture choices. Existing fixtures and default destination/panel choices remain unchanged. Each accepted record runs separately with source-stability, runtime-error, unexpected-request and immediate approval guards. One overlapping preliminary benchmark was cancelled and discarded before these records.

| Fixture and table inventory | Synchronous before median / p95 / max ms | Synchronous after median / p95 / max ms | Input-to-frame before median / p95 / max ms | Input-to-frame after median / p95 / max ms |
| --- | --- | --- | --- | --- |
| Rich, 58,833 characters, closed | 11.6 / 38.5 / 45.8 | 7.1 / 14.5 / 20.7 | 14.1 / 44.3 / 51.9 | 8.7 / 16.2 / 22.2 |
| Rich, open control | 11.3 / 16.6 / 26.5 | 10.4 / 16.5 / 18.4 | 13.4 / 18.3 / 29.7 | 12.1 / 18.7 / 20 |
| Distinct rich, 58,990 characters, closed | 12.9 / 21.6 / 21.7 | 12.8 / 31.3 / 37.4 | 14.9 / 23.4 / 23.5 | 15.3 / 45.6 / 117.6 |
| Distinct rich, reverse-order repeat | 13.3 / 28.3 / 32 | 11 / 17.5 / 20.1 | 15 / 30.3 / 37.5 | 12.7 / 21.4 / 21.5 |

All eight accepted records pass. The first distinct-block tail worsened; a reverse-order repeat improved. Both records remain evidence of variability, not proof that the regression never occurs. Do not infer that avoiding one scan fixes tail stalls or all fixtures. These local sample statistics are not INP, completed paint, real-user outcomes or all-device guarantees. Earlier 356.7/417.5 ms maxima and active-link-control regressions remain unresolved.

Before public SHA-256: `237bba0deeec5900851d1b8e9c5e0bcab32fcebe0f24d487cf5ab2dad8b4099e`. After: `78cf296dbb549790b752631691878c59fbb981418b0f82e41d7f41af000d1ccc`. Full checks and terminal build details are recorded above and in the PR. Native Cloudflare Git deployment is unchanged. No tracking, outreach, services, charges, providers, Actions, cron or automatic approval are introduced.
