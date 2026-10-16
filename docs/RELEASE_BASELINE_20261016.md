# Release baseline and branch integration

This baseline follows the literal plain-text clipboard release in PR #69. It preserves the current public converters and establishes one manually invoked validation path for subsequent improvements.

## Integration decisions

The production source reviewed here is main at f2c3f1982a05ef6a6d04a22a59e932f6167d210f. The separate alpha line is PR #47 at 5841adffa092644e0293967775494c1b481959f2. The older pilot proposal is PR #3 at c8485cc4b265076a413eeb151b5dbba0bf9258a9.

A merge-tree calculation using their shared b4b9df2635abcd5f764abceab32a4adf7dd950d4 baseline reports 25 content-conflict paths between current main and the alpha pin. No merge was applied. This count is specific to those pins; recheck actual heads before integration. Automatically combined modules also require runtime checks, not just conflict resolution.

| Work | Current decision |
| --- | --- |
| Alpha private-file and WordPress-kit portability cases | Adapted into main's normal regression suite, with an explicit candidate-path option for future integration checks |
| Literal plain clipboard correction | Already adapted to main's newer inline serializer and released in PR #69 |
| Backup inspection and comparison | Main already has a newer staged restore; browser checks now exercise that contract rather than expecting immediate replacement |
| Alpha browser persistence | Retain for the dedicated recovery cycle; reconcile with main's staged review and private-file contracts |
| Alpha editor layout and import-note presentation | Retain for the first-use cycle; preserve main's newer layout choices and all converter routes |
| Alpha shared clipboard locks and nearby feedback | Retain for the handoff cycle, including current destination previews and export options |
| Alpha optional WordPress text comparison | Remains a separate proposal; main has no transfer-comparison model, and validation reports that limitation |
| Alpha parser changes | Preserve main's newer nested-inline parser. Port fixes by demonstrated behavior, without replacing it wholesale |
| Legacy pilot request reader | PR #3 contains bounded streamed-response handling that is not present as a separate module in main. Retain for a focused private-pilot review before activation |
| Legacy recovery, accessibility, and tooling | Main has newer recovery/schema coverage and accessible references. The existing-browser executable option is retained in the manual browser script |
| Legacy Actions workflow | Excluded. The owner's stopped-Actions policy and native Cloudflare deployment remain in force |

PR #47 and PR #3 are not bulk-merge candidates for this baseline. Their remaining work is explicitly accounted for above rather than discarded or represented as integrated. No AI service is activated.

## Manual release command

Use Node 22 or newer and Python 3 with Playwright and a compatible Chromium installation. Install test tools deliberately outside the production dependency tree. Run:

```sh
npm run verify:release
```

The command builds the site, runs every Node regression case, runs static checks, and then runs the complete routed-browser fixture suite. It never installs packages, starts GitHub Actions, deploys, or retries failures. Browser contexts request reduced motion for deterministic geometry while retaining ordinary visibility and pointer checks. Clipboard permission is granted only to the fictional test origin for native copy/paste round trips; this does not verify a real user's permission or fallback experience. The browser suite serves only repository fixtures and blocks unexpected requests; pilot responses are fictional. It does not sign in to a real account or contact an AI provider.

If Python or Chromium is elsewhere, supply its exact path through DRAFTTOPAGE_BROWSER_PYTHON or CHROMIUM_EXECUTABLE. The runner passes the Python path as one executable argument without a shell.

Reports are written to ignored test-results/release-results.json and test-results/browser-results.json. A new release run removes old browser evidence before checking anything. Failed commands, unavailable tools, missing evidence, partial browser scope, runtime errors, unexpected requests, and horizontal overflow prevent a passing release report. Source changes during validation also invalidate the report, so independently edited work cannot inherit a passing result. The source digest covers the current repository files, including proposed uncommitted changes; the HEAD alone is not a claim about those changes.

## Compatibility checks

The eight release-contract cases verify version-1 backups in both directions, notes-only workspaces, near-limit Unicode writing, unsupported format rejection, explicit Markdown and JSON imports, and actual six-file WordPress ZIPs with linked images off and on. Independent Python ZIP and HTML readers check text, structure, links, images, CRCs, and exclusion of private notes.

```sh
npm run test:contracts
DRAFTTOPAGE_COMPAT_ROOT=/absolute/path/to/trusted/candidate npm run test:contracts
```

An optional candidate is executable local source. Supply only an explicitly selected trusted checkout. The command does not check it out, modify it, or fetch anything. Passing portability checks establish those contracts, not a passing combined application.

The current main contracts pass against the pinned alpha source in both directions. The baseline does not establish genuine Word/Google Docs fidelity, real WordPress save/reopen compatibility, assistive-technology acceptance, or real-device clipboard behavior. Those remain the corresponding roadmap acceptance gates.

## Capacity observation to retain

In this environment, native filling of the 4,000-line revision fixture timed out in packaged headless Chromium 153 even with a 45-second limit. The browser case now uses 500 changed lines, which still exceeds the 160,000-cell diff budget and verifies coarse grouping, short previews, complete-passage expansion, and exact text retention. The 4,000-line model case remains unchanged. A passing release gate therefore does not establish 4,000-line interactive capacity. Reproduce that limit in a standard desktop browser during the performance cycle and measure the editor, preview, and revision refresh costs before claiming it is resolved.
