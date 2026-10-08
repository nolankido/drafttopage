# Draft to Page

Your ideas. Ready for your website.

Public writing resources and a small, invitation-only publishing pilot. Domain: `drafttopage.com`. Repository: `nolankido/drafttopage`. Host: the existing Cloudflare Worker `drafttopage`.

## Public site and sample editor

Eleven public pages provide a clear product introduction, three complete fictional examples, six copyable note templates, an editable sample workspace, getting-started instructions, export help, troubleshooting, access information, two writing guides, and data-use information. There is also a useful 404 page.

`/demo/` edits and exports prewritten fictional examples entirely in the open browser page. It is not live AI, does not call the generation API, and does not bypass private access. No autosave or persistent browser storage is included. Examples are illustrative, not customer evidence or actual model-quality results.

`public/content-data.js` contains public-safe templates and examples. `scripts/build-content.mjs` deterministically generates HTML, sample Markdown, sitemap, robots instructions, and `/release.json`. Generated files are ignored rather than edited by hand. See [the content release notes](docs/CONTENT_RELEASE.md).

## Private pilot

`/pilot` provides sign-in, three built-in article types, source notes, optional audience and purpose, a structured Claude draft, editable title/excerpt/description/filename/body, suggested review questions, and Markdown download or copy. The workspace includes note outlines, rechecking a session without refreshing, and separate copy controls for notes, questions, and article body. Editing an article field clears export approval.

Article types are Personal essay, Project update, and Practical guide. They are not custom saved website profiles or a learned personal voice. The owner must configure private access, quota protection, and the API credential before using generation. API output remains unverified and must be reviewed.

No public registration, billing, analytics, automatic publishing, customer database, audio/video handling, or draft history is included. Help and disclaimers do not replace a genuine production acceptance test.

## Activate after review and merge

Follow [the owner activation checklist](docs/ACTIVATION_CHECKLIST.md) and [the original setup guide](docs/PILOT_SETUP.md).

1. Keep the existing Worker, GitHub integration, domains, production branch `main`, blank dashboard build command, and deploy command `npx wrangler deploy`. Do not modify Squarespace or DNS. Wrangler runs the repository's custom content build before bundling.
2. Deploy the reviewed code. `/pilot` fails closed without valid private access and quota configuration. Public resources work without secrets.
3. In the Worker's runtime **Settings > Variables and Secrets**, configure **Secret** `PILOT_PASSWORD` with a new, unique password-manager-generated password between 24 and 256 characters. Never use the local test password.
4. Review the Anthropic workspace's data settings and small spending limit, then configure the project-specific API key as runtime **Secret** `ANTHROPIC_API_KEY`. A Claude chat subscription is not an API credential. Never put either secret in GitHub, browser scripts, screenshots, or chat.
5. Confirm the existing `PILOT_QUOTA` binding. Save/deploy secret changes, then use fictional material for the owner acceptance test. Real generation may consume credits or money. Inspect existing configuration before replacing a secret; password rotation invalidates sessions.

The existing migration provisions a SQLite-backed Durable Object for counters. No paid-plan upgrade is requested by this release. Account availability, quotas, and actual charges remain the owner's responsibility. Do not remove protection or approve an unexpected upgrade to make the app appear available.

## Safety boundaries

- Signed, Secure, HttpOnly, SameSite=Strict, host-only cookies; four-hour sessions; exact-origin mutation checks; and a same-origin request header.
- Protected HTML remains outside the static directory. Worker-first routing covers `/pilot` and `/api/*`; generation authenticates every request. Alternative-domain pilot visits go to the canonical production domain.
- One shared atomic Durable Object quota: 20 reserved generation attempts per UTC day, at least 30 seconds apart. Failed provider attempts count. Ten total sign-in attempts per minute. No automatic provider retry. Application guards do not replace provider spending limits.
- Up to 8,000 source-note characters; bounded streaming request input; fixed model `claude-haiku-4-5-20251001`; 2,600 maximum output tokens; 60-second upstream timeout. Unknown input fields and malformed, truncated, or refused output are rejected.
- No notes, drafts, passwords, or API responses in application storage or logs. Only counters and timestamps persist in the Durable Object. Provider retention and operational processing are separate. The data-use notice is generated from `scripts/build-content.mjs` at `/privacy/`.
- Drafts appear as text, not executed HTML. Exports are untrusted Markdown, not sanitized for every renderer. `draft: true` is not a universal publication lock. Source notes and review questions are omitted from article exports.
- The shared pilot password is an owner/invitation-only arrangement, not multi-tenant authentication. There is no per-person revocation or recovery. Rotation invalidates all sessions; logout removes the browser cookie.

## Build and checks

Requires Node.js 22 or newer. No third-party runtime npm dependencies are added.

```sh
npm run build
npm test
npm run check
npm run preview:mock
```

The test, check, and mock-preview commands build public content first. The mock preview binds to `127.0.0.1:8790` and prints an explicitly fake test-only password. It uses handcrafted output and in-memory counter mocks, not Claude or genuine Durable Object storage. Never deploy the preview server or use its password in production.

Optional browser checks: `python scripts/browser-smoke.py` with Python Playwright and Chromium installed. These are DOM-only fixtures with injected local assets and mocked responses. They do not verify hosted CSP, real cookies, actual provider behavior, or a user-device download. See [the release notes](docs/CONTENT_RELEASE.md) for scope and [the original implementation report](docs/PILOT_TEST_REPORT.md) for baseline history.

PR CI runs the full Node suite, static checks, and a pinned Wrangler dry-run. Bundling does not activate the service or prove account configuration. Test real generation and a real edited download after owner activation before inviting anyone else.

## Change process

Use feature branches and pull requests. Review before merging; `main` can trigger production deployment. Keep all unrelated projects and private material out of this public repository, including public branches and `docs/`. Distinguish local tests, repository changes, deployment, and genuine AI activation in every release report.
