# Browser navigation preflight qualification, October 19, 2026

## Scope

This change corrects an environment-readiness false positive, not a document converter or a completed publishing journey. Baseline main is `cdfb477580f810388776a931964264c468a7a21b`. The local environment cannot resolve GitHub for a full clone. The original preflight and its test file were retrieved through the GitHub connector and reconstructed byte-for-byte, verified against Git blobs `146688f2db4e94e18dabb02ad07018cfce098fac` and `05c4765ebb758c1f1955d9a53f2aa5f3f9f8055b`. This is a source subset, not a full Git checkout or `npm test` result.

## Reproduction and executed evidence

The original preflight launched Chromium 144.0.7559.96 and reported its **Playwright Chromium** row as PASS. Independent attempts to navigate a routed `https://drafttopage.test` page and an ephemeral `http://127.0.0.1` page both failed with `net::ERR_BLOCKED_BY_ADMINISTRATOR`. The original launch-only check did not detect this. The complete baseline preflight was already BLOCKED for missing Git checkout information; only its browser row was falsely reassuring.

The corrected native probe reports:

| Check | Observed result |
| --- | --- |
| Chromium startup | PASS, version 144.0.7559.96 |
| Routed test-page navigation | BLOCKED, BROWSER_POLICY_BLOCK |
| Probe's optional localhost stage | NOT_RUN after the earlier navigation failure |
| Corrected native probe exit | 1, BLOCKED |
| Targeted Node regression suite | 12 tests passed, 0 failures |
| Python syntax and redaction/resource tests | PASS |

The Node suite uses mocked process responses to test the report contract. Its successful navigation cases are unit controls, not actual successful browser observations. The native blocked probe was executed separately. The unrelated missing Git checkout and unconfigured WordPress CLI remain visible in the complete preflight output. No browser-policy bypass, paid browser service, external test account or software installation was attempted.

## Change

Preflight now distinguishes browser launch, real routed navigation with ES-module execution, and optional real localhost navigation needed for WordPress. It serves only two fixed synthetic resources, aborts unexpected page requests, uses bounded timeouts, closes the browser and any ephemeral server, and does not read or change the clipboard. The local WordPress process is never started by this probe.

Node requires structured, internally consistent results and the matching process exit status. A bare Chromium version, truncated output, missing module-execution evidence, malformed results or a timed-out process cannot pass. Public diagnostics use allowlisted codes and fixed messages, not raw stderr, local paths, provider output or stack traces. Administrator policy is reported as a blocker, not as an instruction to install another browser or disable policy.

The existing source cleanliness and WordPress-CLI checks remain intact. The existing manual commands are unchanged:

```sh
npm run preflight:release
npm run preflight:release:full
```

Run full release qualification only from a complete checkout in an environment that permits the required browser navigation. A successful preflight checks prerequisites only. Actual application import/review/export, WordPress paste/save/reopen, fresh Word/Google Docs sessions, hosted/mobile/device and human acceptance remain NOT_RUN in this work.

No public application module, publishing behavior, provider integration, GitHub Actions, tracking, paid resource or production content changes.

## Locally tested source identities

| File | Git blob |
| --- | --- |
| `scripts/release-preflight.mjs` | `aaac6534c86e120f8c7a18d6efd9d422b2ab08b7` |
| `scripts/browser-preflight.py` | `19b723e329d7b8d7fe69a4d8fd6e19184dc230fd` |
| `tests/release-preflight.test.js` | `e140bbcea8e6951a1e50c73e0333a847fe17569c` |
