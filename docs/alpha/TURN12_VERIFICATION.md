# Turn 12: Git-bound release checks and production smoke

The older manually invoked release gate could report PASS without a Git HEAD or source SHA-256, because the source comparison was optional. The gate now requires both before running any tests, then checks both again before allowing PASS. It rejects missing Git history, source changes and commits that advance during validation.

On a trusted complete source checkout, run npm run verify:release with Node 22+, Python Playwright and Chromium deliberately installed. Set DRAFTTOPAGE_WORDPRESS_CLI to the explicit pinned local WordPress Playground CLI to require the WordPress roundtrip. If the CLI is absent, local WordPress acceptance stays NOT_RUN, and the separate alpha release gate remains BLOCKED.

After the existing native Cloudflare production deployment, run npm run build followed by npm run verify:production. The new command sends only fixed, unauthenticated GET requests to drafttopage.com. It checks release.json and Word, Google Docs, Markdown, help and preview JavaScript routes for matching public release labels, restrictive CSP, nosniff, valid content types and required page structure. No redirects, credentials, cookies, drafts, form submissions or external hosts are used. Failures are recorded without echoing raw network errors.

The production smoke report is written locally to ignored test-results/production-smoke.json. Success proves only public HTTP behavior and a human-readable release label. It does not cryptographically attest Git commit or Worker version and does not perform any Word/Google Docs clipboard test, hosted WordPress save/reopen, device testing or real human study.

The complete Node and routed-browser suites remain NOT_RUN until executed in a complete checkout. No GitHub Actions, new external service, tracking or runtime application requests are added.
