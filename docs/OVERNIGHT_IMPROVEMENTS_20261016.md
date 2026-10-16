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

Released in [PR #78](https://github.com/nolankido/drafttopage/pull/78), merged as `1bb5f625e31770f95180e1361f6546a50f6018fb`, tree `c2ce5d054dba55d3cbd1c2b9d4a97b43ccf74f81`. See [the release notes](WORD_IMAGE_RECONCILIATION_20261016.md). Native Cloudflare preview and production builds succeeded; production version `6305ba3c-83eb-4df0-8faf-c35c021bd23a`. The complete stable-source gate passed 756 Node tests, 40 browser journeys, 265 layout checks, 15 document benchmark cases and eight fresh local WordPress 7.1.3 Author-role save/reopen cases. Source SHA-256: `0f010cc8068ab00c6c4602f051dc51538efdb3658ba30258d7e97738f0a2a4f4`.

The image picker now retains original Word numbers after earlier replacements, identifies duplicate labels by occurrence, and shows nearby text plus the pinned location. An optional selected image-map.json from the existing original-image ZIP can be inspected without opening any image, URL or folder. It validates the unchanged v1 map fully, including bounds and bidirectional file/placement references. Reusing Word alternative text requires a matching current placeholder and explicit document/context comparison; different pending text requires confirmation. URLs remain manually entered. Missing/shortened alt text, omitted files, map scope and original-byte privacy limits are visible. Individual image applies keep the map, while discarding or replacing the workspace purges it and cancels in-flight reads. Temporary map data is excluded from backups, browser recovery, checkpoints, collections and exports. Existing preview/checkpoint/approval and separate linked-image consent remain required.

Local targeted checks passed 35 image/model/controller tests, including ten new cases. The preliminary desk-only browser run passed 34 journeys and 160 layout checks. Its new journey recovered a fictional three-image DOCX through the UI, independently read the actual downloaded ZIP, verified original image bytes, opened its actual map, explicitly reused alt text, rejected stale comparison, checked backup exclusion, retained original/duplicate labels, and downloaded three native Image blocks after separate consent. It checked map deletion, invalid-map preservation and 1440/390/320-pixel layout. The PR records the stable-source full gate and terminal deployment checks. This does not claim a Media Library upload, real-user session, screen-reader/physical-device test or fresh Word/Google Docs clipboard acceptance. The eight genuine local WordPress cases retain the scope in WORDPRESS_ROUNDTRIP_20261016.md. The block serializer and hosting configuration are unchanged.

## Cycle 10: actionable formatting findings

Released in [PR #79](https://github.com/nolankido/drafttopage/pull/79), merged as `e37fa7c1276b0f6424af94c8232699c8eb6fdcf0`, tree `e8e4d124b52a24c6b6d76ea3cc2e72a211c42f04`. See [the release notes](ACTIONABLE_FORMATTING_20261016.md). Native Cloudflare preview and production builds succeeded; production version `075fd122-f315-487b-9dab-1fc2f24d8d78`. The stable-source full release gate passed 769 Node tests, 42 browser journeys, 274 layout checks and all 15 document benchmark cases. Source SHA-256: `d654b2e69498056415c620a1f72773009d5860b968991eabdd88fb2b6d91c372`. WordPress save/reopen was explicitly NOT_RUN in this cycle because the serializer was unchanged; PR #78 retains the latest eight fresh local cases.

A reproduced Word placeholder previously received zero handoff findings despite remaining literal text. Original and legacy labels now receive destination-specific exact-passage warnings, with protected code/link/image contexts, duplicate/Unicode/CRLF offsets, deterministic order, complete totals and the existing 40-item bound. Relevant findings route to current image preparation or reference conversion controls without rewriting writing, approving exports, choosing linked images, or applying conversions. Every saved action rechecks its current source, title, destination and relevant options. Busy operations block it. Missing modules, unsupported locations, declined preparation and failures retain exact manual source inspection. A source change during failure cannot select or claim an old range. Word and HTML explicitly retain literal-image limitations.

The targeted model/controller suite passed 37 tests, including thirteen new cases. Two browser journeys cover the actual shortcut flow and optional image-module failure, with second-occurrence targeting, unchanged approval on navigation, existing preview/checkpoint/apply ownership of edits, Word/HTML limitations, reference conversion, actual kit review, manual fallback and narrow layouts. The preliminary run exposed an incorrect test assertion for the kit's filename; the fixture now reads its actual existing article-body.md member. The corrected complete stable-source gate passed; the preliminary fixture failure is not counted as an acceptance pass. The block serializer and private formats are unchanged; PR #78 retains the latest eight genuine local WordPress cases.

## Cycle 11: ordinary strikethrough fidelity

Released in [PR #81](https://github.com/nolankido/drafttopage/pull/81), merged as `9bab282f96882e5e86c6fd4dcfdf77531a8f2b86`, tree `0b15469113ec16e247d055f6009a8aa93765c743`. Read [the fidelity scope](STRIKETHROUGH_20261016.md). The complete stable-source gate passed 787 Node tests, 43 browser journeys, 280 layout checks, 15 document cases and ten fresh genuine local WordPress 7.1.3 Author-role save/reopen cases. Source SHA-256: `03a1763425bbc1853a091f1ed2044ca635034122fd6d4f195d630b2b93af5192`. Native Cloudflare preview and production builds succeeded; production build `352ab1d8-53ae-4c39-bcd7-f57528ca3285`, version `bac5bfda-64ed-460f-acea-5b376ddfb70c`.

The real pinned Word fixture now retains the actual struck text through ordinary Word/HTML body import, exact double-tilde Markdown, inert preview and HTML/Word/WordPress output. Direct on/off values and supported style toggles, code/URL protection, literal clipboard/title escaping, guided-edit guards, parser bounds and unsupported-format warnings are covered. H1/title fields, double strike, complex styling, multiline/deep structures and imported plain blockquotes retain explicit limits. HTML tracked-change ins/del remains rejected.

Eighteen new model cases pass, and 10,000 deterministic non-tilde token arrays match starting main exactly. The preliminary 15-case real document corpus passed with three preserved, seven disclosed, four rejected and one sampled contract; mark preservation is checked independently in HTML and Word XML. The new browser journey checks visible marks, staged review, all three native downloads, plain/formatted paste fixtures and narrow layouts. The local WordPress gate adds two semantic save/reopen cases and rejects missing raw/rendered marks even when words match. Exact full-gate results, source/tree hashes, PR merge and native deployment outcomes are recorded in PR #81. No acceptance is claimed for a check before it actually passes.

Document-default-on strikethrough combined with paragraph or character style strike declarations is conservatively rejected unless each affected run supplies an explicit on/off value. Microsoft documents compatibility differences for this combination; the converter does not guess which appearance was intended. Unambiguous defaults and ordinary direct formatting remain supported. See [the Microsoft toggle compatibility note](https://learn.microsoft.com/en-us/openspecs/office_standards/ms-oi29500/f7130225-2368-48f3-acae-a9d278d0fb25).

A preliminary genuine WordPress run exposed a rendering difference in the new Word fixture: the stored straight apostrophe is displayed as a typographic apostrophe. The case now checks exact original stored text/marks and the separately specified rendered text/marks. Only this observed fixture expectation changes; punctuation is not normalized across the suite. A separate raw-text evidence flag is required. The initial full gate failed on that newly added expectation and is not counted as an acceptance pass. The final full stable-source rerun passed October 16, 2026, 11:21 UTC with unchanged source, including both new WordPress cases.

## Release outcomes and continuation checkpoint

| Cycle | GitHub outcome | Confirmed native Cloudflare production version |
| --- | --- | --- |
| 5: first conversion | PR #73, `f63fd67df746db361d7acdcc02bdbec67b57ee4b` | `1c460ea7-9b82-4f6a-89d7-766fac635b67` |
| 6: browser recovery | PR #74, `68523832af742a80df124608df33d3eb393f0cca` | `5d1fd385-8db6-45e1-8fb9-1a7f887a3c57` |
| 7: handoff feedback | PR #75, `1a56ad7be4bee70f8c44de81571ed5fa6d1c7524` | `78347d63-95e6-423b-aad9-9197620cc114` |
| 8: alpha kit preparation | PR #76, `c5c428920882d16d605249f935811c3bfe0074f6` | Its preview succeeded; production build `bcc76301-a5b0-4c5c-895c-f510acce0731` failed without a diagnostic in GitHub. |
| 9: image reconciliation | PR #78, `1bb5f625e31770f95180e1361f6546a50f6018fb` | `6305ba3c-83eb-4df0-8faf-c35c021bd23a` |
| 10: actionable findings | PR #79, `e37fa7c1276b0f6424af94c8232699c8eb6fdcf0` | `075fd122-f315-487b-9dab-1fc2f24d8d78` |
| 11: strikethrough fidelity | PR #81, `9bab282f96882e5e86c6fd4dcfdf77531a8f2b86` | `bac5bfda-64ed-460f-acea-5b376ddfb70c` |

After the documentation-only production failure, the exact native build command `node scripts/build-site.mjs` passed again locally. A diff from PR #75 to PR #76 confirms zero changes under public, src or scripts, or to package/hosting configuration. GitHub's check output has no diagnostic text and reports zero annotations, so a cause has not been established. This checkpoint records the outcome and provides one bounded retry through the preserved native Git deployment integration. The follow-up PR records its terminal build result. Do not add Actions, change hosting configuration, or repeatedly push empty commits to mask a failed build.

PR #77 completed the bounded documentation-build retry successfully, merged as `e5529da55d0808e6ef08a4c59a7d8338cc8ddd75`; native production version `cdc9b3ae-ce3a-456b-9395-1266a1034754`. The failed earlier build is retained above because its cause remains unknown. The latest completed runtime gate is PR #81: 787 tests, 43 browser journeys, 280 layout checks, 15 document cases and ten genuine local WordPress save/reopen cases passed. Documentation-only follow-ups do not claim another full runtime or destination acceptance run. The public site's direct HTTP rendering remains independently unverified from this execution environment, which previously returned 403.

## Cycle 12: recovery keyboard continuity

Active in [PR #82](https://github.com/nolankido/drafttopage/pull/82), on `fix/recovery-keyboard-focus-20261016`, from main `9bab282f96882e5e86c6fd4dcfdf77531a8f2b86`. A local Chromium reproduction using Enter activation confirms focus falls to document.body after enable, pause and remove hide or disable their initiating controls. This is a reproduced keyboard navigation gap, not a real screen-reader session. Do not duplicate active work. See [the keyboard scope](RECOVERY_KEYBOARD_20261016.md).

The bounded fix retains focus at a useful visible recovery control after an explicit action, respects focus or pointer movement elsewhere while an action waits, and adds no focus handoff during background saving or cross-tab notifications. The existing restored-article focus is preserved. Consent, safe restore, checkpoints, approvals, local storage and privacy behavior stay within cycle 6's existing contract. All 26 existing recovery model/controller checks and a focused real-keyboard/storage/locking diagnostic pass. The full stable-source gate is still required before release; exact results and native build outcomes belong in PR #82. WordPress serialization is unchanged, so this cycle will record that separate destination gate as NOT_RUN and retain PR #81's ten-case evidence.

## Next items

1. Finish cycle 12's bounded recovery keyboard continuity, with actual Enter/Tab transitions, cancelled/failed restore, competing tabs and background updates. Broader real-mobile and assistive-technology acceptance remain unperformed.
2. Evaluate the next specific preview-editing or repeat-publishing gap using current source and a reproducible fixture. Preserve the simpler first conversion and explicit review boundaries.
3. Actual ten-writer sessions and repeat-use evidence remain an owner dependency. Do not contact people, invent findings or treat the prepared kit as completed research.
4. Continue device/accessibility and performance work before broad marketing or paid claims. Discovery, distribution, repeat usage and a paid proposition still need actual evidence.

## Validation commands and remaining limits

Both feature trees passed `npm run verify:release` with the documented local Chromium and Playwright configuration. Cycle 9 also supplied `DRAFTTOPAGE_WORDPRESS_CLI` for the eight-case local WordPress gate. Cycle 10 deliberately omitted that separate gate and records NOT_RUN. Feature PRs #78 and #79 record exact validated trees, content hashes, counts, native preview/production build IDs and terminal outcomes. These are native Cloudflare Git builds, not GitHub Actions.

This documentation checkpoint changes only repository Markdown. Build, static checks, Markdown links/fixture hash and diff scope are checked locally; the previously passed runtime suites are not claimed as rerun for documentation. The progress record now names the actual feature PRs and next reproducible case. No image upload, external-user session, physical-device/screen-reader acceptance, Word/Google Docs clipboard session or independently verified production rendering has been added. That checkpoint completed before the separate cycle 11 work described above.

## Continuation rules

Read current main and open PRs before choosing work. Do not duplicate active work. Keep releases bounded, preserve source/privacy exclusions and existing version-1 file formats, and record actual checks. Finish safely or checkpoint ongoing work when the window ends. No claim of real users, broad destination acceptance, fresh Word/Google Docs clipboard acceptance, or production rendering should be inferred from local fixtures.
