# Turn 1 integration and release evidence

Date: 2026-10-18.

## Integrated source

- Base main: \`bc0f14ca9dc9066c5772c39a09be9238d026c90d\`.
- Reviewed export-shortcut proposal: PR #148 at \`45d48aaa42ed67bb916ead8eff5792a44f70d2b6\`.
- Reviewed table-row proposal: PR #149 at \`8855075aceed683c1fe6a46956464efc7b2611f2\`.
- The two changes touch distinct code except both depend on the writing workspace; only PR #148's CSS was rebased onto the newer main stylesheet. Current-draft navigation and browser-recovery styling added in PR #147 are intentionally preserved.
- The generated writing template comes from PR #148. The table fragment, controller, editing model, tests, and table guide come from PR #149. There is no new networking, storage, publishing, analytics, billing, or AI provider behavior.
- The regression \`tests/turn1-export-table-integration.test.js\` checks both experiences co-exist in all eight generated writing routes, without replacing their focused unit and UI tests.

## Required release evidence (do not infer success from a source commit)

1. Native Cloudflare integration preview must report a successful build (complete Node suite and static validation) for the exact combined commit.
2. Browser test the combined deployed preview: sample article, approve review, use destination-aware shortcut to focus the existing copy action without activation; return to editor, prepare and apply table row moves, verify checkpoint and approval clearing, reapprove, then copy with correct feedback.
3. The clean-checkout \`npm run verify:release\` plus isolated local WordPress receipt is required for full alpha qualification. If inaccessible, mark NOT_RUN and do not claim alpha-ready.
4. Confirm the exact production main commit and Cloudflare deployment after any authorized merge. Hosted WordPress installations, source-app captures, physical devices and actual human study need separate evidence.

No GitHub Actions or cron is to be enabled. Cloudflare's existing native Git deployment is unchanged.

## Review follow-up

The first combined review found a real clipboard-pending shortcut issue: the WordPress copy button remains keyboard-focusable with `aria-disabled=true` while copying. The integrated navigation now respects that attribute, and the existing export-copy-state callback explicitly refreshes the shortcut. A new regression tests busy ARIA state, no-op clicks, and recovery after completion. These claims require fresh tests and browser evidence on the updated commit.

## Concurrent main update

While this integration was under test, separate PR #149 was independently merged to production main at \`9db4731695c1cc98d6821e592be43fc1ce0b1de3\`. Its six modified files exactly match the same blob SHAs in this integration branch. The integration branch then merged that new main with no force update and did not replace or alter those six table feature files. PR #150 now proposes only the export shortcut, clipboard availability guard, tests, styles, and this integration note above main.
