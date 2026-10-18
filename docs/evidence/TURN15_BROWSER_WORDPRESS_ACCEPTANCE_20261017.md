# Turn 15: recovered browser and local WordPress acceptance

Date: October 17, 2026 in Pacific/Honolulu; execution continued on October 18 UTC.

## Recovered project state

The interrupted "Evaluate Alpha Improvements" conversation had progressed beyond its last retrievable message. GitHub retained completed Turn 14 in [PR #143](https://github.com/nolankido/drafttopage/pull/143), merged as `7dc4a7ab0060f06dd0e6b68213fc7876cd58f6d6`. That release repaired 17 Node regression failures and added the complete Node/static gate to the existing native Cloudflare build. Turn 14 was not repeated or reverted.

Turn 15 executes the browser and local WordPress checks left open by that release. It changes acceptance harnesses and this evidence record. The public application, approval requirements, image privacy checks, storage consent, security headers, and hosting configuration retain their existing behavior.

## Failures observed and repaired

1. **Clipboard-denial focus expectation.** The browser suite expected focus to stay on Copy WordPress blocks after permission denial. The shipped fallback intentionally opens and focuses the approved read-only source. The corrected test checks visibility, focus, read-only state, exact complete block source, unchanged writing/approval, and unchanged clipboard bytes. Successful copies still preserve later user focus. The corresponding Node test name now describes its existing assertions accurately.
2. **Word image receipt missing from two harnesses.** The browser image-map test and actual local WordPress Media Library test omitted the explicit image-kit choice and saved-file confirmation. The WordPress baseline passed all 13 article cases, then correctly stopped at the disabled import control. Both harnesses now choose the kit, download and open the actual ZIP, verify its integrity and original image bytes, and confirm the receipt. Apply must remain disabled before that confirmation. The WordPress harness also verifies both import actions become enabled afterward.
3. **Recovery test polling conflicted with CSP.** Two Playwright `wait_for_function` calls evaluated strings in a page protected by `script-src 'self'`. The site correctly rejected that evaluation. The harness now polls the real stored fixture through ordinary browser evaluation, with a 15-second deadline and exact full-body comparison. No CSP bypass, `unsafe-eval`, or product-side workaround was introduced.

These are acceptance-harness repairs. A guard blocking an incomplete test procedure was not treated as a product failure or removed to obtain a passing result.

## Observed corrected working-tree results

The following checks were actually executed, using a complete checkout based on the recovered Turn 14 commit:

| Check | Observed result |
| --- | --- |
| Complete Node suite | 1,090 passed; zero failed, skipped, or cancelled |
| Static checker | 31 HTML pages; links, anchors, accessible references, script syntax, imports, routing/storage/logging guards, and absence of GitHub Actions passed |
| Full routed browser suite | 59 workflow checks passed |
| Browser layout checks | 382 passed at the suite's desktop and narrow viewport sizes; no reported overflow |
| Document corpus | 37 passed: 19 preserved, 9 disclosed, 8 correctly rejected, 1 sampled |
| Browser errors and unexpected requests | Zero |
| Local WordPress article cases | 13/13 passed, including exact saved source, valid blocks after reopening, and native edit/second reopen |
| Invalid-block negative control | Correctly detected |
| Local Media Library | Two PNG/JPEG uploads returned HTTP 201; served bytes matched the original files |
| Image article | Three placements, reused media with separate alternative text, trusted Visual paste, and exact unpublished draft save/reopen passed |
| WordPress private-field exclusions | Source and review fields excluded from exported content |
| WordPress errors and unexpected requests | Zero |
| Read-only production smoke | 7/7 fixed public routes passed |

The corrected WordPress run completed at `2026-10-18T04:59:37Z` with `sourceUnchanged: true`. Its pre-documentation working-tree fingerprint was `1fc3c19b580b4143dd52cc99be2e58627b413ac358d90a3e91aa6c488c2bf630`. That identifies the observed working-tree run, not the eventual release commit.

The isolated runtime used Node `24.19.0`, Python `3.12.14`, Playwright `1.51.0`, Chromium `134.0.6998.35`, WordPress Playground CLI `3.1.58`, WordPress `7.1.3`, and PHP `8.3.33` with SQLite. WordPress ran locally as an Author without unfiltered HTML. Its server was stopped after testing.

## Final release binding and reproduction

After committing the corrections and documentation, run the existing full gate from a stable checkout. The gate must observe the same Git HEAD and complete source fingerprint before and after execution. Record its exact result, commit, source SHA256, and the native Cloudflare preview/production outcome in the associated pull request. This avoids trying to embed a commit's own hash into that same commit.

Use Node 22+, an installed Python Playwright/Chromium runtime, and the pinned Playground CLI. Set `DRAFTTOPAGE_BROWSER_PYTHON`, `CHROMIUM_EXECUTABLE`, and `DRAFTTOPAGE_WORDPRESS_CLI` to their actual installed paths when they are not on the normal tool path. A network environment using an explicit proxy may additionally need Node's supported environment-proxy setting; that is runner configuration, not a website change.

```sh
npm run verify:release
npm run verify:wordpress:receipt
npm run verify:production
npm run verify:alpha
```

Receipts remain in ignored `test-results/`. `verify:release` must include WordPress for the complete local result. `verify:alpha` is expected to remain BLOCKED until the independent observations below exist. Do not reuse the pre-commit results as a clean merged-commit attestation.

## Remaining alpha gates

Local software acceptance and a successful public-route smoke do not establish current Word/Google Docs source-app behavior, an actual hosted WordPress installation's persistence, physical mobile/keyboard/screen-reader behavior, device latency, a selected private support channel, a tested rollback, or a consenting writer study. Those remain separate observations under [release operations](../alpha/RELEASE_OPERATIONS.md).

The routed browser suite uses fictional content and fixture authentication. Its native browser downloads are temporary automated-browser files, not evidence of an author's own operating-system save workflow. The local WordPress image case uses a deliberately isolated HTTPS alias for loopback media; it is not a hosted WordPress HTTPS test.

No human acceptance, invitation, outreach, provider activation, paid resource, tracking, new service, or GitHub Actions run is claimed or introduced. Continue from the final merged commit and current receipts, keeping every unobserved real-world gate explicitly open.
