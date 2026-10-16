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

Released in [PR #75](https://github.com/nolankido/drafttopage/pull/75), merged as `1a56ad7be4bee70f8c44de81571ed5fa6d1c7524`. Full release gate passed 746 tests, 39 browser journeys and 262 layout checks. The unchanged block serializer was not rerun through WordPress in this cycle; PR #74 retains the latest eight genuine local save/reopen cases. Native Cloudflare deployment outcome is recorded in PR #75.

One in-memory copy coordinator now covers the public workspace's publishing copies, title and optional post fields, plain/formatted article copies, drafting briefs, private review notes, draft-check summaries and formatting reviews. It invokes the browser write synchronously during the user action, holds the lock until settlement, retains approved downloads, and tracks changes to writing, destination, title/image choices and approval. Completion for an earlier state is identified; it cannot present old output as the current export. This coordinates one workspace page, not other tabs, apps or external clipboard writers.

Primary handoff controls show feedback beside the action while the existing status announces it once. WordPress paste instructions open after a successful current block copy. Permission failures retain download/manual-copy alternatives; the formatting-review fallback still exposes current read-only text. A browser fixture delays actual native writes to test pending locks across destinations, stale clipboard bytes, current HTML/Markdown success, rejection and manual fallback. Source and output exclusions remain unchanged. No clipboard reads are added to application code, and no copy state is persisted.

Model, browser and release evidence belong in the cycle's PR. Do not infer real-device permission behavior or destination acceptance from the controlled delay/permission fixtures.

## Cycle 8: public alpha study preparation

The [ten-writer public alpha kit](PUBLIC_ALPHA_STUDY_20261016.md) is prepared with a fictional article, a blank session-record template, six task cards, timing and assistance definitions, privacy rules, explicit denominators and provisional decision targets. It covers first conversion, fidelity, actual destination handoff, revision, voluntary recovery and observed repeat use. The owner can organize sessions separately without activating the private pilot or adding tracking. Completed records belong outside the public repository.

**Real-user acceptance is NOT_RUN.** No participants were contacted, no completed results were invented, and intention to return is not counted as repeat use. The templates and existing sample assets are checked locally. This is documentation preparation, not completion of the ten-user research gate.

## Cycle 9: Word image reconciliation

Implemented on `feat/word-image-reconciliation-20261016`, from main `e5529da55d0808e6ef08a4c59a7d8338cc8ddd75`. See [the release notes](WORD_IMAGE_RECONCILIATION_20261016.md). The release PR records its number, exact validated tree/source hash, merge and terminal native Cloudflare checks.

The image picker now retains original Word numbers after earlier replacements, identifies duplicate labels by occurrence, and shows nearby text plus the pinned location. An optional selected image-map.json from the existing original-image ZIP can be inspected without opening any image, URL or folder. It validates the unchanged v1 map fully, including bounds and bidirectional file/placement references. Reusing Word alternative text requires a matching current placeholder and explicit document/context comparison; different pending text requires confirmation. URLs remain manually entered. Missing/shortened alt text, omitted files, map scope and original-byte privacy limits are visible. Individual image applies keep the map, while discarding or replacing the workspace purges it and cancels in-flight reads. Temporary map data is excluded from backups, browser recovery, checkpoints, collections and exports. Existing preview/checkpoint/approval and separate linked-image consent remain required.

Local targeted checks passed 35 image/model/controller tests, including ten new cases. The preliminary desk-only browser run passed 34 journeys and 160 layout checks. Its new journey recovered a fictional three-image DOCX through the UI, independently read the actual downloaded ZIP, verified original image bytes, opened its actual map, explicitly reused alt text, rejected stale comparison, checked backup exclusion, retained original/duplicate labels, and downloaded three native Image blocks after separate consent. It checked map deletion, invalid-map preservation and 1440/390/320-pixel layout. The stable-source full release gate and its exact results belong in the PR. This does not claim a Media Library upload, real-user session, screen-reader/physical-device test, fresh Word/Google Docs clipboard acceptance or new WordPress save/reopen evidence. The block serializer and hosting configuration are unchanged.

## Release outcomes and continuation checkpoint

| Cycle | GitHub outcome | Confirmed native Cloudflare production version |
| --- | --- | --- |
| 5: first conversion | PR #73, `f63fd67df746db361d7acdcc02bdbec67b57ee4b` | `1c460ea7-9b82-4f6a-89d7-766fac635b67` |
| 6: browser recovery | PR #74, `68523832af742a80df124608df33d3eb393f0cca` | `5d1fd385-8db6-45e1-8fb9-1a7f887a3c57` |
| 7: handoff feedback | PR #75, `1a56ad7be4bee70f8c44de81571ed5fa6d1c7524` | `78347d63-95e6-423b-aad9-9197620cc114` |
| 8: alpha kit preparation | PR #76, `c5c428920882d16d605249f935811c3bfe0074f6` | Its preview succeeded; production build `bcc76301-a5b0-4c5c-895c-f510acce0731` failed without a diagnostic in GitHub. |

After the documentation-only production failure, the exact native build command `node scripts/build-site.mjs` passed again locally. A diff from PR #75 to PR #76 confirms zero changes under public, src or scripts, or to package/hosting configuration. GitHub's check output has no diagnostic text and reports zero annotations, so a cause has not been established. This checkpoint records the outcome and provides one bounded retry through the preserved native Git deployment integration. The follow-up PR records its terminal build result. Do not add Actions, change hosting configuration, or repeatedly push empty commits to mask a failed build.

The latest full runtime gate remains PR #75: 746 tests, 39 browser journeys and 262 layout checks passed. PR #74 additionally ran eight genuine local WordPress save/reopen cases. Documentation-only follow-ups do not claim another full runtime or destination acceptance run. The public site's direct HTTP rendering remains independently unverified from this execution environment, which previously returned 403.

## Next items

1. Actionable formatting losses and frequent fidelity defects, chosen from reproducible source cases.
2. Actual ten-writer sessions and repeat-use evidence remain an owner dependency. Do not contact people, invent findings or treat the prepared kit as completed research.
3. Continue with device/accessibility, preview editing, repeat publishing and performance before broad marketing or paid claims. Discovery, distribution, repeat usage and a paid proposition still need actual evidence.

## Continuation rules

Read current main and open PRs before choosing work. Do not duplicate active work. Keep releases bounded, preserve source/privacy exclusions and existing version-1 file formats, and record actual checks. Finish safely or checkpoint ongoing work when the window ends. No claim of real users, broad destination acceptance, fresh Word/Google Docs clipboard acceptance, or production rendering should be inferred from local fixtures.
