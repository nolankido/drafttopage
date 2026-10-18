# Manual alpha release, support and rollback operations

This is an owner-operated release procedure. Preserve the native Cloudflare Git deployment. **Never add GitHub Actions, cron, automatic deployment, tracking or new external services.**

## Freeze a version and run fresh checks

On a trusted complete checkout of main, record a clean working-tree result, the full Git HEAD, Node/Python/browser versions, and the last Cloudflare production Worker version. Run Git status, rev-parse and the current manual local gate. Do not change files, package versions or the browser installation midway through a validation run.

Run the deliberately invoked release preflight first on a **clean Git checkout**. It checks Git HEAD and tree cleanliness, Node 22+, installed Python Playwright, a launchable Chromium, and the explicitly installed WordPress Playground CLI without fetching or installing anything. A blocked preflight makes no release claim. The release command itself independently refuses dirty Git worktrees (including staged and untracked files) and a configured WordPress CLI that is not an existing absolute local file, even if the separate preflight was skipped. It purges stale browser/WordPress results and records FAIL before starting any build or test for these conditions. The final source check repeats Git cleanliness to reject files added or changed during validation. A source fingerprint alone never certifies an uncommitted checkout. The release preflight, actual release command and final alpha checker also reject Git index entries marked `assume-unchanged` or `skip-worktree`, which can conceal modified tracked files from ordinary `git status`. Use a complete checkout with those flags removed rather than interpreting a blank Git status as proof of source identity.

    DRAFTTOPAGE_WORDPRESS_CLI=/absolute/existing/cli.js npm run preflight:release:full
    DRAFTTOPAGE_WORDPRESS_CLI=/absolute/existing/cli.js npm run verify:release:full

The **strict full** command refuses to start if the WordPress CLI is not configured. It then runs build, all Node tests, static checks, the routed Playwright browser suite, actual isolated local WordPress paste/save/reopen/Media Library acceptance, and a separate source-bound WordPress receipt check. No earlier green receipt is reused. For a browser-only development check, `npm run verify:release` remains available, but its WordPress result is `NOT_RUN` unless WordPress CLI was supplied. When a CLI is supplied, **both commands require** the separate source-bound WordPress receipt step, and the alpha promotion evaluator refuses a legacy report without that step. A passing browser-only run must never be described as a full WordPress-qualified release.

For a faster isolated narrow-layout regression before full qualification, after building run:

    python3 scripts/browser-smoke.py --table-rows-only

This checks the actual generated workspace at desktop, 390px and 320px viewport widths, including row insertion/reordering across the ten-row page boundary. Do not use this scoped run in place of `verify:release:full`. Both manual full release commands now reject an otherwise green browser report unless it contains the explicit table-row scenario completion plus all five measured layout results (`before-1440`, `before-390`, `inserted-320`, `moved-320`, `moved-390`), each exactly `false` for overflow/clipping. The local release summary carries those verified keys forward; the alpha promotion gate rejects summaries without them. A generic successful browser count or unrelated mobile check does not qualify. The independent WordPress receipt can also be rechecked with `npm run verify:wordpress:receipt`.

The release gate performs build, Node tests, static checks, routed-browser tests and optional isolated local WordPress. Missing WordPress tools produce NOT_RUN, **not** a public alpha pass. Results remain under ignored test-results. A failed test or changed source must trigger a fresh entire run, not a reused green receipt.

## Optional hosted-site mobile browser smoke

On a machine with Python Playwright, Chromium, and **network access to Draft to Page**, this separate manual command exercises real CSS viewport widths of 1440px, 390px, and 320px directly against the deployed site. It enters only fictional writing in a fresh browser session, inserts a table row, moves it across the ten-row pagination boundary, checks for clipped controls and whole-document horizontal overflow, previews and applies the table change, and verifies a revision checkpoint and cleared export approval. It does **not** use WordPress, clipboard, downloads, publishing, AI, accounts or real draft content.

    npm run verify:hosted:mobile
    # Or test a trusted Draft to Page preview:
    python3 scripts/hosted_table_mobile.py --origin https://BRANCH-drafttopage.nolankido.workers.dev

It writes a small, content-free report under the ignored `test-results/hosted-table-mobile.json`. An unavailable network, missing Chromium, blocked origin, invalid controls or incorrect viewport fails the command. The `--self-test` flag tests only origin/layout validation logic and reports `realBrowser: NOT_RUN`. **Neither the hosted browser smoke nor its self-test substitutes for a complete clean-checkout `verify:release:full`, local WordPress receipt, physical device/screen-reader evidence or the human alpha gates.** This optional hosted test never writes `release-results.json` or `alpha-release-record.json` and never marks the alpha ready.

## Record live deployment and remaining real-world gates

After native Cloudflare deployment, independently verify the full main commit, successful Cloudflare production version UUID and the live Word, Google Docs and Markdown converter routes. Use fictional articles, verify the public support label, and do not log private writing. A successful Worker build alone does not show successful conversion in a real source app or destination.

Copy docs/alpha/alpha-release-record-template.json into the ignored private file test-results/alpha-release-record.json. Fill the full release commit and local source SHA256 from test-results/release-results.json, successful Cloudflare deployment commit/version, and the previous confirmed good commit/version. Mark manual_recovery_checked only after verifying in the Cloudflare dashboard that the previous version is actually restorable.

For each source-app/device/hosted-WordPress/latency/support gate, retain status NOT_RUN until someone completes an authorized real task. For a witnessed pass, use OBSERVED_PASS, HUMAN_OBSERVATION, the exact release commit, and an opaque evidence reference stored in approved private records. Synthetic browser and code tests never qualify as these human observations.

    npm run verify:alpha

This read-only checker compares HEAD, clean source, source digest and fresh local receipts with the recorded production and rollback pins. It writes only a content-free summary in test-results. BLOCKED exits nonzero. READY_FOR_OWNER_INVITATION_DECISION is **not** a command to invite anybody and does not independently authenticate owner-entered evidence.

## Support and issue triage

The project maintainer owns the public GitHub Issues queue. A tester can open https://drafttopage.com/help/alpha-support/ and copy only the fixed release label, selected converter and broad browser family. The safe issue template asks for a source type, destination, browser/device, step, observed error in non-sensitive words, lost-writing status and an optional fictional reproduction.

Do not request or publish authors' drafts, account information, clipboard values, URLs identifying users, private site details, screenshots with personal text, raw browser logs, credentials or private workspace backups. No private contact channel has been chosen. Confidential incidents must not be filed publicly.

Stop new invitations and assess rollback for actual writing loss, missing article ending, unintended upload/copy, privacy exposure or security defects. Block a specific source/device path for conversion failures without a usable fallback. Triage normal cosmetic reports separately. Preserve reproduction and severity facts, not content.

## Rollback a bad build

1. Pause new invited-alpha use. Keep existing user drafts under their owners' control; do not erase browser storage or attempt to retract WordPress drafts automatically.
2. Consult the prior Cloudflare Worker version UUID and exact Git main commit recorded at the last verified deployment. Confirm that version still exists; a Git hash is not itself an available rollback.
3. Use Cloudflare's native deployment rollback UI to restore the known-good Worker version, if supported, or deploy a reviewed Git revert PR. Record the actual resulting version and deployment outcome.
4. Recheck all public converter routes, response security headers, copy and download paths, safe help links and a fictional final-paragraph round trip. Do not claim user content was restored by rolling back a Worker.
5. On main, merge a reviewed revert PR rather than force-resetting shared history. Verify the resulting native Cloudflare deployment and rerun current release tests and content-free diagnostics.
6. Record the incident privately, update the last-known-good version and unblock invitations only after fresh evidence is reviewed.

The candidate rollback pin predating Turn 9 is in RELEASE_20261017.md. It has **not** been marked rollback-verified by this work.

## Older conflicting branches

- **PR #47:** Its old editor onboarding, staged recovery, shared copy lock, manual WordPress handoff and alpha-testing concepts are implemented or superseded on newer main. The additional optional WordPress transfer-text comparator is deferred for a separately reproduced need. Keep its historical checklist as reference; do not bulk-merge its ~70 divergent files.
- **PR #3:** Its request/stream recovery changes belong to the separate private AI pilot, not the public client-side converters; defer until a scoped pilot test and activation approval. Its older workspace recovery is superseded, and its GitHub Actions workflow is **excluded by owner policy**. Do not bulk-merge its 13 divergent files.

Neither existing PR needs an arbitrary merge or closure to proceed with independently verified public converter work.
