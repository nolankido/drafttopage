# Focused article alpha, October 15, 2026

Status: prepared for code review. This branch has not been merged or released to production. It is available as a native Cloudflare branch preview. Real-browser visual and destination acceptance remain required before calling it alpha-ready. No customer success, traffic, retention, or payment results are claimed.

Baseline: production main `b4b9df2635abcd5f764abceab32a4adf7dd950d4`, tree `f9f8d131e5a929218d27b540ac02ff9ed6fdaf8a`. The local alpha worktree was reconstructed from that exact tree and its differing files were checked against their Git blob hashes. Release identifier: `alpha-first-article-20261015`.

## The job being tested

A writer with an existing Word or Google Docs article can inspect its conversion and take editable blocks into a new WordPress draft with less total cleanup than their usual workflow. This is a hypothesis, not a demonstrated result.

## Implemented changes

- Shorter homepage explanation and five primary navigation links. Secondary conversion tools remain reachable from the homepage and footer.
- Word and Google Docs entry pages put the input earlier. Their converted reading view precedes optional Markdown source editing. Empty results are hidden by the guided controller. Progress describes the current step without claiming that copying or publishing succeeded.
- Source findings, optional page fields, draft checks, file alternatives, and passage review can reveal their enclosing disclosure before focusing a target.
- Document converters keep the manual WordPress paste instructions visible after applying an article. Other converters request opening the instructions after copying. A changed body during an asynchronous copy produces an earlier-version warning.
- Backup files, collections, and in-tab revisions share a disclosure. Existing private file formats, checkpoints, conversion acknowledgements, and review approval remain intact.
- Optional public-workspace browser recovery, off by default. It stores one unencrypted, bounded, validated workspace after explicit consent. The private AI pilot has no browser recovery.
- Onboarding follows Word, Google Docs, or Markdown through import, review, WordPress handoff, and deliberate saving. A downloadable alpha notes template stays local and does not submit responses.

## Recovery contract

Only `public/browser-recovery.js` accesses persistent browser storage. The static checker permits its single audited `window.localStorage` access and continues to reject other storage and executable HTML sinks. One origin-scoped exclusive Web Lock is held by the active writer. Another tab cannot overwrite, restore, or remove that copy while saving is active. Unsupported or policy-blocked browsers retain file backups as their fallback.

The copy contains the existing version-1 workspace whitelist: source fields, article fields, and saved review questions. The entire envelope is limited to 512 KiB. It excludes raw clipboard source, pending imports, unsaved editing preparation, history, collections, export choices, approval, and credentials. Current writing never restores automatically. Restore requires consent again, confirmation when replacing work, and a checkpoint before mutation. Errors preserve open writing.

Pause flushes valid current writing and keeps the copy. Removal is deliberate and leaves the open article intact. Desk clearing explicitly includes the browser copy, checks for changed writing during preparation, and refuses if another tab holds the recovery lock. External storage changes stop the writer. Leaving cancels pending lock acquisition, flushes when possible, and releases the writer; reopening requires a new choice. Browser storage can still be cleared, evicted, or unavailable. Keep downloaded backups for important writing.

## Verification performed

- 505 Node tests passed, including 23 new recovery tests and six guided-flow tests. Recovery cases cover opt-in, strict parsing and bounds, coalescing, replacement refusal, cancelled and stale restores, checkpoint failure, two-tab exclusion, pause, leaving during a pending request, storage-full/blocked/unsupported behavior, external changes, removal, failed removal, and no resurrection after removal.
- 27 HTML/static checks passed, including script syntax, routes, anchors, accessible references, local browser imports, protected routing, audited storage, content-logging guards, and no GitHub Actions workflows.
- The generated document converters were parsed independently with Python's HTML parser to check balanced structure, native disclosure boundaries, reading-before-source order, and preserved shared controls.
- Local HTTP smoke passed for 12 pages and five assets using the existing mock-only server in the test process. It made no external calls. The first attempt from a separate process could not reach the server; the same-process check succeeded. These checks do not establish visual layout or actual destination behavior.

The cloud browser's attempt to open the local preview returned `ERR_CONNECTION_REFUSED`. The existing native Cloudflare integration subsequently built and deployed PR #47 as a branch preview, without merging main. Browser QA could then start against that preview. Native Cloudflare configuration, bindings, migrations, security headers, and the separate AI pilot have not been activated or changed by this work. GitHub Actions remain stopped.

Initial branch-preview observations: at a 1348 by 936 document viewport, the Google Docs paste target was fully visible between y=596 and y=695, with no horizontal document overflow. A fictional formatted import preserved the heading, emphasis, nested numbered/bullet list with start 4, table, and link. Applying focused the reading heading, kept source editing collapsed, and left copying disabled until review. A later source edit cleared approval and disabled copying. Browser recovery was initially off; explicit consent and Enable saved a copy. A second tab offered the copy without opening writing, and refused takeover while the writer remained active. The saved-status message was observed after the edit. These are synthetic browser checks, not actual Google Docs account or WordPress acceptance.

The cloud browser's close attempt did not close the original writing tab and subsequent commands to that tab timed out. Therefore close/reopen and refresh recovery were not verified in that attempt. The browser also did not visibly open the WordPress instruction disclosure after a successful copy, although the copied-success status appeared. The document converters now render those instructions open as part of the ordinary handoff, with parser coverage for that state. The updated document-converter preview was checked and the WordPress instructions were visibly open after loading a fictional sample. Actual close/reopen remains unverified. Extension-origin metadata errors were seen; no application error was inferred from them.

Further browser checks on preview commit `9dd99fb`: recovery was enabled for a fictional 910-character sample, paused explicitly in the original tab, and offered after refreshing an empty second workspace without automatically opening writing or checking consent. Deliberate restoration recovered the title and full 910-character body with source editing collapsed, reading view visible, and approval cleared. This exposed core controls remaining disabled after the asynchronous restore finished. The recovery UI now reports pending-state transitions to the surrounding editor so its busy controls refresh; a new integration regression test checks both transitions. On preview commit `32dc3e5` (deployment `a4826725-0d4c-445f-9910-16651b334ce0`), the same deliberate restore recovered the 910-character sample with approval cleared, source editing collapsed, WordPress instructions open, and the file picker, import fieldset, and backup fieldset enabled. The active recovery writer was then paused. The busy-state fix is verified in that desktop browser.

The official WordPress Playground was also attempted for an isolated destination check. Its browser check completed, but the runtime displayed a hiccup and did not initialize after one retry. No WordPress post or destination-rendering pass is claimed.

## Required acceptance before inviting alpha testers

1. Open this branch in a supported preview environment. Verify desktop, narrow mobile widths, keyboard operation, visible focus, announcements, and scrolling. Check that the first input is reachable promptly and that optional editing remains reachable from every finding and deep link.
2. Use an actual Google Docs selection and ordinary Word documents. Compare all text and supported structure with the original. Check browser clipboard variations, unmarked table headers, unsupported documents, and visible image omissions.
3. Paste actual generated blocks into an empty WordPress draft's full Code editor. Return to Visual editor and inspect headings, nested lists with starting numbers, tables, quotes, links, image placeholders, and invalid-block warnings. Do not substitute exported-file structure for this check.
4. In a real browser, verify recovery consent, reload, restoration, approval reset, two-tab exclusion, pause, removal, clear, and blocked storage using fictional writing. Verify that a different workspace is never silently overwritten.
5. Confirm a direct private support route with the invited testers. Keep private documents and customer feedback out of this public repository. The site adds no tracking or response-collection service.

## Proposed learning gates

Start with 5 to 10 target writers who regularly move existing articles into WordPress. Observe their normal workflow and Draft to Page using comparable articles. Count total time through the final WordPress preview, including image work and cleanup. Record assistance, omissions, errors, and reasons to return or leave. Use `public/alpha-test-checklist.md` privately.

Proposed gates: 8 of 10 complete without assistance; no silent content loss in the evaluated documents; demonstrably less total publishing effort for the target workflow; and voluntary use for another real article. These are decision thresholds, not measured results or industry benchmarks. Monetization, registration, analytics, direct account integration, and broad public promotion remain separate decisions after learning from this alpha.
