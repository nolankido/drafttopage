# Identify a table before loading it

Candidate: [PR #93](https://github.com/nolankido/drafttopage/pull/93), starting main `2c97f0202a5dbd2fd20ca987fa485d8ddab8a04b`. Complete stable-source validation and terminal native builds are still pending and belong in the PR.

## Reproduced gap

A fresh real-browser fictional fixture contains two same-size tables with identical headers but different morning/evening rows. Starting labels are only `Table 1 on line 3 · 2 columns, 1 rows` and `Table 2 on line 9 · 2 columns, 1 rows`. They expose no content for identification. Changing the list choice deliberately keeps an earlier dirty prepared target and its cells. That is a safety contract, not an invitation to silently retarget them. The change makes both the table identity and this separation more explicit. No real-user research or customer result is inferred.

## Current-source context, separate preparation

Each option now adds a short first-header snippet and correct singular/plural dimensions. The selected item shows literal current-source headers, the first data row and nearby before/after source. At most three columns appear. Cell snippets use at most 48 Unicode code points plus an ellipsis; the option header uses 24, and an unsupported reason uses 96. Nearby source windows contain at most 100 original UTF-16 units each and are clipped to 48 code points. The Before excerpt keeps the closest ending rather than the beginning of its window. Whitespace is collapsed for these descriptions only. Edge cuts avoid introducing half-surrogate characters into otherwise well-formed context. Prepared text and the article itself are never normalized by this display.

The description is composed of bounded fields, under 720 Unicode code points even in the modeled maximum unsupported case. Snippets deliberately omit later columns/rows and can contain literal Markdown or HTML-like text. They are an identification aid, not a complete table, compatibility certificate or source preview. Existing Edit selected table still performs the full editing guards, including individual cell limits. Unsupported sources remain available for direct inspection.

Choosing an option changes only its description. It does not load, rebind, rewrite, checkpoint or approve anything. Edit selected table remains a separate deliberate action, with the existing confirmation before replacing dirty preparation. Current target status and prepared cells remain distinct. The actual complete-source change still requires preview, explicit recheck when stale, checkpoint capture and apply. Source characters outside the selected table are retained exactly. Full file/clipboard contracts and version-1 schemas are unchanged.

Descriptions use textContent only, never HTML or Markdown rendering; no link/image/resource is loaded. They are associated with the native select using accessible descriptions, without a new live announcement on every article keystroke. Short guidance explains the choice/preparation distinction. Narrow text wraps within the page. Native keyboard selection retains focus.

The current range/body identity avoids replacing unchanged description text nodes during metadata, busy-state or preparation refreshes. Even when a new current range has the same description, its text node is kept. Closing the editor or an ancestor purges displayed context and its identity references. Hidden source changes remove obsolete options without inventory inspection. Opening recomputes current content while preserving an unchanged selected occurrence. Stale selection events before refresh cannot display old source or retarget preparation. These are bounded current-view references, not history or persistence. Descriptions read only the current article, never source notes, questions or pending cells. Description state is excluded from files, recovery and exports. Existing explicitly private backups and opted-in browser recovery still include their documented private workspace fields; this feature changes none of those rules.

## Checks

All 32 table checks pass, including seven new cases. Three pure cases cover current labels/content, immutability, rows/columns/scalar limits, hostile literal markup, unsupported reasons, CRLF and astral window edges, header-only tables and invalid ranges/body bounds. Four new controller cases fail on the starting controller and pass here; its other 28 overlaid cases pass. The compared controller blob is exactly the starting main blob `afce9165c5ac74015d21518eac63e34c5f3d8961`. This is a controller overlay, not a full older application acceptance run.

The 41-case focused table/structure/diagnostic suite passes. Existing all-route markup checks now cover all eight workspaces and the accessible descriptor IDs. The focused real-browser journey passes native Home/End choice and focus without loading, stable text nodes, dirty-replacement cancellation/confirmation, unchanged approval/checkpoints/export bytes, hidden-source context/list purging, retained cells, explicit second-table recheck and exact checkpointed apply. It reads actual current WordPress blocks and a private backup, checks strict file keys/private exclusions, exercises hostile/Unicode/unsupported snippets and all descriptor references, and checks 1440/390/320 layouts. The final 320px unsupported-context viewport was visually inspected. Preliminary reads/focus before native asynchronous toggles completed were corrected to wait for actual context and the enabled current list; the first full browser run failed that fixture race and is not an acceptance pass. An early model assertion caught a too-distant Before excerpt, fixed before acceptance. A documentation review corrected a mistaken exclusion statement: private backups retain private notes, while descriptions and public article exports do not include those private fields. Complete stable-source validation must be rerun after these corrections.

## Sequential controls

Four accepted 31-insertion diagnostics run sequentially on the near-limit 58,833-character rich Markdown fixture, source stability/runtime/request/immediate-approval guards all passing. The table inventory is explicitly closed or open with ancestors. This feature is a selection usability change, not a latency guarantee.

| Table inventory | Synchronous before median / p95 / max ms | Synchronous after median / p95 / max ms | Input-to-frame before median / p95 / max ms | Input-to-frame after median / p95 / max ms |
| --- | --- | --- | --- | --- |
| Closed | 5.5 / 9.4 / 9.6 | 4.5 / 8.5 / 9.8 | 7.4 / 11.5 / 12.9 | 6.5 / 10.3 / 12.3 |
| Open | 9.6 / 45.6 / 47 | 8.5 / 20.2 / 25.8 | 12 / 52.8 / 56.4 | 10.5 / 25.2 / 33 |

Before public SHA-256: `c6fcdee63b99cf9159aca68ed5e674638aad13b3ccb5cf1de882c415d2736745`. After: `a95ba21e17329b5aed08e62c65a75828df3a6bdeafdb1edffcf5fb4914471628`. These selected samples do not erase cycle 19's fallback-p95 regression, variable ordinary/active controls, or earlier 356.7/417.5 ms outliers. They are not INP, paint completion or field performance.

No tracking, research, outreach, charges, providers, persistent storage, Actions, cron, hosting, automatic export approval or serializer changes. Physical-device/screen-reader, actual Word/Google Docs clipboard application, real-user and independently verified live-rendering acceptance remain outstanding. Native Cloudflare Git deployment is preserved.
