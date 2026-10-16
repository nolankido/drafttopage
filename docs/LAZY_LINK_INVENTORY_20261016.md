# Lazy article-link inspection

Cycle 16 is under review in [PR #88](https://github.com/nolankido/drafttopage/pull/88), based on main `1d579741777c6b8f34191c43d954265826fe5c62`. This is a bounded input-work reduction, not evidence of real-user speed, new destination fidelity or solved tail latency.

## Current evidence and change

A fresh near-limit rich Markdown profile with the link inventory closed attributed 288 of 796 inclusive input-path sample hits to articleLinks, called through the link editor refresh. Source inspection confirmed refresh scanned whenever the article changed, before checking whether the inventory was visible. The list itself was hidden, but parsing still ran.

Inventory-only parsing now runs when the link editor, nested link inspection and every containing disclosure are open. Closing either panel or a containing disclosure purges derived links, rendered rows, count/error state and the cached inventory source. Notes downloads are disabled and their handler guards hidden invocation. Opening recomputes the current source. Visible unchanged source retains its existing cache, forty-row display and complete notes download. Labels and URLs remain inert text and no destination is loaded.

Pending editing is independent of inventory. Fields and the chosen target remain; changed article text still marks that target stale and clears its preview immediately, including while all panels are closed. Closing the link editor retains its existing preview-purge behavior. Explicit selection, preparation, preview and apply continue to recheck current source and use existing confirmation/checkpoint/approval rules. Busy guards, source ranges, formatted/table fallback, literal unsafe links, optional loading and private formats remain unchanged.

Every rendered inventory gets a generation token. Old detached rows cannot reopen preparation after closure/reopening or re-rendering, even if the article string is unchanged. The existing source check still rejects a body change before refresh. Closing an ancestor is observed directly rather than waiting for another keystroke.

## Checks

All 28 focused link/diagnostic model checks pass, including six new controller cases. A counting inspection dependency proves zero inventory-parser calls while closed and current parsing on opening, visible cache reuse, containing-disclosure handling, stale pending previews, hidden-download no-read behavior, detached-row generations, Unicode/CRLF source locations, invalid-source failure cleanup and unchanged approval. Explicit editing may still parse links as needed; the zero-call claim is about inactive inventory work, not all editing actions.

The focused actual Chromium journey passes real typing while inspection is closed, nested/parent disclosure changes, retained pending details, stale-preview rejection, hidden and detached events, inert unsafe labels, exact current Unicode source targeting, and 1440/390/320 layouts. It independently reads a complete actual notes download against the unchanged notes generator, including links beyond the forty displayed rows and excluding code/private fields. Approved native WordPress block bytes remain identical across view-only changes. A later explicitly reviewed link correction preserves the entire remaining source, captures a checkpoint, clears approval and produces the current link in an independently parsed actual block download. No URL or API request is made.

The full stable-source release gate must pass before readiness. This cycle changes no serializer or document schema; the separate genuine WordPress gate is NOT_RUN unless explicitly rerun. PR #87 retains eleven fresh genuine local save/reopen cases, including its toolbar-to-download path. Local fixtures do not establish physical-device, screen-reader, actual Word/Google Docs clipboard application, user adoption or independent production rendering acceptance.

## Matched local diagnostics

The optional harness now has an explicit closed/open link-inventory control, separate from reading/export panel state. It verifies zero or forty rendered rows before measurement. Six sequential, source-stable Chromium 153.0.8010.0 diagnostics used 31 native insertions each in the same 58,833-character fictional rich article, Markdown destination, other controlled panels closed, with a separate warm-up. Baseline runs use a detached worktree at the pinned main; candidate runs use the exact local public assets. The initial open-control attempt overlapped a preliminary browser diagnostic and was discarded, not used in this comparison. The repeat active pair ran candidate first, then baseline. No acceptance timing threshold is added.

| Inventory and run | Synchronous median / p95 / max ms | Input-to-frame median / p95 / max ms |
| --- | --- | --- |
| Closed, before | 28.1 / 53.7 / 68.8 | 30.7 / 64.8 / 71 |
| Closed, after | 13.7 / 23.9 / 26.3 | 15.6 / 26 / 27.7 |
| Open control, before | 30 / 46.3 / 49.4 | 31.8 / 50.8 / 51.5 |
| Open control, after | 33.2 / 80.7 / 84.5 | 35.5 / 82.7 / 97 |
| Open repeat, before (run last) | 47.6 / 196.9 / 417.5 | 50.8 / 215.4 / 423.7 |
| Open repeat, after (run first) | 43.2 / 99.2 / 356.7 | 48.2 / 108.3 / 362.6 |

All six diagnostics passed source-stability, fixture, runtime-error, unexpected-request and immediate approval-invalidation guards. Before public SHA-256: `b6d8d79aea813830a86c553f60951af8d6d20f93b7646fd8426bfa51d1a331de`. After: `aa0f6d062fe9416c57be3c83b48d09df7005c96c72b52f4e51f1b6f0ae4d6452`. The candidate closed profile no longer lists the link inventory among its leading input-path entries; the controller counting checks establish the logical skip independently of sampling.

The closed measurement supports the bounded work reduction. Active controls retain parsing and include both regressions and improvements. Same-source repeat differences, the reverse-order control and prior cycle outliers show substantial variability. Their cause is not established. These samples are neither INP nor paint completion, not a statistical field study, and not a general latency guarantee. Remaining word count, table scans, rendering and host effects require separate evidence. Do not describe 356.7 or 417.5 ms outliers as fixed.

No providers, charges, dependencies, tracking, outreach, persistence, Actions, cron or hosting configuration changes are introduced. Native Cloudflare Git deployment remains the release path.
