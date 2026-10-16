# Draft to Page overnight improvements

Authorized window: October 15, 2026, 23:09 to October 16, 2026, 08:09 Pacific/Honolulu. Equivalent UTC window: October 16, 09:09 to 18:09. This is a bounded improvement sprint, with manual validation and native Cloudflare Git deployment. No GitHub Actions, cron, paid services, provider calls, tracking, or user outreach are authorized.

## Starting point

Main began at `1202d837654188759c3bc70c3a05c66c8a60f013`, merged PR #72. The previous cycle added eight genuine local WordPress 7.1.3 draft save/reopen cases under an Author role. The full release check passed 707 tests, 35 browser journeys and 256 layout checks. Cloudflare production build succeeded. A direct public-site HTTP request returned 403 from the execution environment, so that request did not verify live rendering.

## Cycle 5: simpler first conversion

Released in [PR #73](https://github.com/nolankido/drafttopage/pull/73), merged as `f63fd67df746db361d7acdcc02bdbec67b57ee4b`. Full release gate passed 707 tests, 36 browser journeys and 256 layout checks. Native Cloudflare preview and production builds succeeded; production version `1c460ea7-9b82-4f6a-89d7-766fac635b67`.

- Layout settings start in a closed native disclosure.
- The article input precedes formatting buttons. Format text or find passages opens those optional tools without changing writing or approval.
- Short input guidance retains the paste limit and directs formatted selections to the importer.
- Destination choice and its reviews precede the export approval checkbox.
- Empty optional fields do not show required-field errors for body exports. Page Markdown still requires its metadata; HTML and Word still require a title when selected for inclusion.
- A new browser journey exercises an untitled first WordPress conversion from input through review, export navigation and actual native-block download. The existing eight-route layout journey checks the new closed defaults and optional title behavior.

Validation evidence and merge/deployment outcome belong in the cycle's PR. Run `npm run verify:release` against stable source, using the local test browser configuration documented in `RELEASE_BASELINE_20261016.md`. Changes to copy and layout do not extend the destination acceptance scope documented in `WORDPRESS_ROUNDTRIP_20261016.md`.

## Cycle 6: explicit opt-in browser recovery

Released in [PR #74](https://github.com/nolankido/drafttopage/pull/74), merged as `68523832af742a80df124608df33d3eb393f0cca`. Full release gate passed 733 tests, 38 browser journeys, 259 layout checks and eight fresh local WordPress round trips. Native Cloudflare preview and production builds succeeded; production version `5d1fd385-8db6-45e1-8fb9-1a7f887a3c57`. This adapts the alpha recovery model from pinned PR #47 source `5841adffa092644e0293967775494c1b481959f2` without merging the divergent alpha tree. It adds main's complete field comparison, acknowledgement invalidation, checkpoint-before-replacement and existing workspace reset behavior.

The public tools provide one bounded unencrypted workspace copy, off by default, with consent, single-writer Web Locks, coalesced saves, immediate save, pause and deletion. Restore requires a saved/current field comparison and acknowledgement. The exact inspected copy and current writing must still match when the lock is acquired. Failed checkpoints, storage failures, invalid data, unsupported locks and competing tabs preserve open writing. Confirmed desk clearing includes safe browser-copy deletion. No storage is added to the private pilot. The storage guard permits exactly one audited accessor in the dedicated module; other browser modules remain prohibited from persistent storage.

New model cases and real Chromium storage/locking journeys cover default-off behavior, reload without automatic restoration, private fields, stale/cancelled restore, checkpoint and approval reset, two-tab ownership, pause, deletion, clearing and optional-module failure. Release validation and deployment evidence are recorded in the cycle's PR. This is a local browser fixture, not a claim of mobile, assistive-technology or all-browser acceptance.

## Cycle 7: reliable copy and handoff feedback

Implementation branch: `improve/clipboard-handoff-20261016`.

One in-memory copy coordinator now covers the public workspace's publishing copies, title and optional post fields, plain/formatted article copies, drafting briefs, private review notes, draft-check summaries and formatting reviews. It invokes the browser write synchronously during the user action, holds the lock until settlement, retains approved downloads, and tracks changes to writing, destination, title/image choices and approval. Completion for an earlier state is identified; it cannot present old output as the current export. This coordinates one workspace page, not other tabs, apps or external clipboard writers.

Primary handoff controls show feedback beside the action while the existing status announces it once. WordPress paste instructions open after a successful current block copy. Permission failures retain download/manual-copy alternatives; the formatting-review fallback still exposes current read-only text. A browser fixture delays actual native writes to test pending locks across destinations, stale clipboard bytes, current HTML/Markdown success, rejection and manual fallback. Source and output exclusions remain unchanged. No clipboard reads are added to application code, and no copy state is persisted.

Model, browser and release evidence belong in the cycle's PR. Do not infer real-device permission behavior or destination acceptance from the controlled delay/permission fixtures.

## Next items

1. Complete and validate the clipboard/handoff cycle above before selecting another feature.
3. Ten-user alpha remains a human-research dependency. Do not invent participants or send invitations. Prepare a practical manual study kit if useful.
4. Then prioritize image reconciliation, actionable formatting losses, repeated fidelity problems, device/accessibility, preview editing, repeat publishing, performance, evidence-based homepage copy, discovery and distribution, repeat usage, and a paid proposition.

## Continuation rules

Read current main and open PRs before choosing work. Do not duplicate active work. Keep releases bounded, preserve source/privacy exclusions and existing version-1 file formats, and record actual checks. Finish safely or checkpoint ongoing work when the window ends. No claim of real users, broad destination acceptance, fresh Word/Google Docs clipboard acceptance, or production rendering should be inferred from local fixtures.
