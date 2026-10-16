# Draft to Page overnight improvements

Authorized window: October 15, 2026, 23:09 to October 16, 2026, 08:09 Pacific/Honolulu. Equivalent UTC window: October 16, 09:09 to 18:09. This is a bounded improvement sprint, with manual validation and native Cloudflare Git deployment. No GitHub Actions, cron, paid services, provider calls, tracking, or user outreach are authorized.

## Starting point

Main began at `1202d837654188759c3bc70c3a05c66c8a60f013`, merged PR #72. The previous cycle added eight genuine local WordPress 7.1.3 draft save/reopen cases under an Author role. The full release check passed 707 tests, 35 browser journeys and 256 layout checks. Cloudflare production build succeeded. A direct public-site HTTP request returned 403 from the execution environment, so that request did not verify live rendering.

## Cycle 5: simpler first conversion

Implementation branch: `improve/first-conversion-20261016`.

- Layout settings start in a closed native disclosure.
- The article input precedes formatting buttons. Format text or find passages opens those optional tools without changing writing or approval.
- Short input guidance retains the paste limit and directs formatted selections to the importer.
- Destination choice and its reviews precede the export approval checkbox.
- Empty optional fields do not show required-field errors for body exports. Page Markdown still requires its metadata; HTML and Word still require a title when selected for inclusion.
- A new browser journey exercises an untitled first WordPress conversion from input through review, export navigation and actual native-block download. The existing eight-route layout journey checks the new closed defaults and optional title behavior.

Validation evidence and merge/deployment outcome belong in the cycle's PR. Run `npm run verify:release` against stable source, using the local test browser configuration documented in `RELEASE_BASELINE_20261016.md`. Changes to copy and layout do not extend the destination acceptance scope documented in `WORDPRESS_ROUNDTRIP_20261016.md`.

## Next items

1. Explicit opt-in browser recovery: default off, local-device privacy disclosure, bounded writing-only snapshot, safe preview before restore, clear approval, storage-failure feedback, cross-tab conflict handling, deletion and opt-out.
2. Copy and handoff feedback: status beside the action, pending operations locked, stale asynchronous completion identified, useful manual fallback, no claim that a download was actually saved or a destination accepted it.
3. Ten-user alpha remains a human-research dependency. Do not invent participants or send invitations. Prepare a practical manual study kit if useful.
4. Then prioritize image reconciliation, actionable formatting losses, repeated fidelity problems, device/accessibility, preview editing, repeat publishing, performance, evidence-based homepage copy, discovery and distribution, repeat usage, and a paid proposition.

## Continuation rules

Read current main and open PRs before choosing work. Do not duplicate active work. Keep releases bounded, preserve source/privacy exclusions and existing version-1 file formats, and record actual checks. Finish safely or checkpoint ongoing work when the window ends. No claim of real users, broad destination acceptance, fresh Word/Google Docs clipboard acceptance, or production rendering should be inferred from local fixtures.
