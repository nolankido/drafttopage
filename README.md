# Draft to Page

Your ideas. Ready for your website.

Public product-preview site plus a small, invitation-only publishing pilot. Domain: `drafttopage.com`. Repository: `nolankido/drafttopage`. Host: the existing Cloudflare Worker `drafttopage`.

## Implemented in the private pilot

`/pilot` provides sign-in, three reusable writing profiles, source notes, optional audience and purpose, a structured Claude draft, editable title/excerpt/description/filename/body, review questions, and Markdown download or copy. The owner must configure private access and the API credential before using generation.

The public homepage remains a product preview. No public registration, billing, analytics, automatic publishing, customer database, audio/video handling, or server-side draft history is included. The homepage example is fictional, not claimed AI output or customer evidence. API output is unverified and must be reviewed.

## Activate after review and merge

See [the setup guide](docs/PILOT_SETUP.md) for exact dashboard fields, test steps, and rollback cautions.

1. Keep the existing Worker, GitHub integration, domains, production branch `main`, blank build command, and deploy command `npx wrangler deploy`. Do not modify Squarespace or DNS.
2. Deploy the reviewed code. `/pilot` fails closed until the owner supplies a strong private password. The public landing page still works without secrets.
3. In the Worker's runtime **Settings > Variables and Secrets**, add **Secret** `PILOT_PASSWORD` containing a new password-manager-generated password, at least 24 characters. Do not use the local test password.
4. In an appropriate Anthropic Console workspace, configure a small spending limit and obtain a project-specific API key. Add it as runtime **Secret** `ANTHROPIC_API_KEY`. A Claude chat subscription alone is not an API credential. Never put either secret in GitHub, a browser script, a screenshot, or a chat message.
5. Save/deploy the secret changes, then visit `https://drafttopage.com/pilot` and test with fictional material. Adding both secrets enables real API use and may consume credits or money.

The Wrangler migration provisions a SQLite-backed Durable Object for usage counters. No paid plan upgrade is requested by this implementation. Hosting plan availability, quotas, and any actual charges still depend on the owner's Cloudflare account. Do not approve a billing upgrade without reviewing it.

## Safety boundaries

- Secure, HttpOnly, SameSite=Strict, host-only signed cookies, four-hour sessions, exact-origin mutation checks, and a same-origin request header.
- Protected HTML lives outside the public static directory. The Worker runs before `/pilot` and `/api/*`; generation authenticates every request. Alternate-domain pilot visits go to the canonical production domain.
- One atomic Durable Object quota shared across users: 20 reserved generation attempts per UTC day and at least 30 seconds between attempts. Failures consume attempts. Ten total sign-in attempts per minute. No automatic provider retries. These limits are application guards, not a replacement for provider spending limits.
- Up to 8,000 note characters and a bounded streaming request body; fixed model `claude-haiku-4-5-20251001`, 2,600 maximum output tokens, and a 60-second upstream timeout. Unknown input fields and malformed/truncated/refused output are rejected.
- No notes, drafts, passwords, or API responses in application storage or logs. Only shared counters/timestamps persist in the Durable Object. Provider-side retention and operational processing are separate; read [the data-use notice](public/privacy/index.html).
- Drafts appear as text values, not executed HTML. Exports are untrusted Markdown, marked `draft: true`, not automatically published or sanitized for every renderer. No notes or review questions are included in article exports.
- Shared pilot password is intentionally a small owner/invitation-only arrangement, not multi-tenant authentication. No per-person revocation or recovery exists. Rotation invalidates all sessions; logout removes the cookie from that browser.

## Local checks

Requires Node.js 22 or newer. Runtime code has no third-party npm dependencies.

```sh
npm test
npm run check
npm run preview:mock
```

The mock preview binds only to `127.0.0.1:8790`. Its terminal prints an explicitly fake test-only password. It uses handcrafted fictional output and in-memory counter mocks. It makes no Claude requests and does not validate real provider access or actual Cloudflare Durable Object behavior. Never deploy the preview server or use its password in production.

Optional browser fixture tests: `python scripts/browser-smoke.py` with Python Playwright and Chromium installed. These test DOM behavior with injected local assets and mocked browser responses, not the deployed CSP, live sign-in, or network. See [the test report](docs/PILOT_TEST_REPORT.md) for exact checks and limitations.

For a real Cloudflare runtime dry-run, install Wrangler in a network-enabled development environment and run `npx wrangler deploy --dry-run`. No real credential is needed for bundling. In this change's authoring environment, that command was not available and Cloudflare deployment was not performed.

## Change process

Use feature branches and pull requests. Review before merging; merging `main` can trigger a production deployment. Keep all unrelated projects and private material out of this public repository. Test the runtime and one genuine fictional-notes API request after owner activation before inviting anyone else. Local mocked results are not evidence of real model output quality.
