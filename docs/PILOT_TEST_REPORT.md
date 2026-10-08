# Private pilot implementation checks

## Result and scope

The implementation is ready for GitHub review, not a claim of a live, activated service. No real Claude API requests, secrets, private source notes, or customer data were used. No Cloudflare account settings, DNS records, or paid plans were changed during implementation.

## Executed locally

`npm test`: 45 tests passed, zero failed. Coverage includes password validation, signed session expiry and origin binding, password rotation, cookie flags, missing-secret fail-closed behavior, protected editor routing, canonical-domain handling, mutation-origin checks, malformed and oversized requests, generation authentication, consent, fixed model/output limits, atomic concurrent quota reservations under a serialized storage mock, daily limits/reset, provider errors/refusal/truncation, no automatic retry, Markdown metadata quoting, edited-value export, and logout cookie expiration.

`npm run check`: passed. Checks JavaScript syntax, HTML page headings and IDs, internal assets and anchors, no em dashes in page text, no browser persistent storage or HTML-injection API in the editor, no production console logging, and Worker-first routing/configuration. The shared homepage stylesheet was retained unchanged.

`python scripts/browser-smoke.py`: passed using Chromium with DOM fixtures and mocked browser fetch responses. Desktop viewport 1440x1000 and mobile viewport 390x844 had no horizontal overflow. Both layouts were visually inspected. The test exercised fictional sample loading without a provider request, draft display, editing, export gating and re-approval, exported text and filename generation, inert display of hostile HTML strings, preservation of prior work after simulated generation failure, and workspace clearing. No JavaScript page errors were observed.

The browser export test captures the generated Blob and filename, not an actual user-device download. The Node suite separately tests the Markdown function. Browser fixtures inject local styles and scripts and therefore do not exercise the deployed CSP or network cookie handling.

## Environment limitations

The local Chromium configuration blocked navigating to the local HTTP preview with ERR_BLOCKED_BY_ADMINISTRATOR. No browser policies were changed. Browser checks instead used in-memory DOM fixtures. Successful server sign-in and cookie handling were covered by the Node Request/Response tests, not an integrated browser-to-server session.

GitHub network resolution was unavailable inside the code runtime and Wrangler/workerd was not installed. A Cloudflare `wrangler deploy --dry-run`, genuine Durable Object runtime/migration test, hosted security-header check, and real Claude response-quality test were not performed. The actual Durable Object uses a storage transaction, but the concurrency test substitutes a serialized storage mock. These limitations remain deployment acceptance items.

## Required before inviting testers

After review/merge, confirm Cloudflare builds and deploys the Worker and SQLite-backed quota binding. Add the two runtime secrets privately, set the provider's spending controls, and run the fictional-notes owner acceptance test in PILOT_SETUP.md. Confirm the hosted password gate, generated response, real downloaded Markdown, cookie/logout behavior, and provider usage before external invitations.
