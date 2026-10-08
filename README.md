# Draft to Page

Your ideas. Ready for your website.

Repository: `nolankido/drafttopage`. Domain: `drafttopage.com`. Hosting: the existing Cloudflare Worker `drafttopage`.

## Three ways to work

- `/write/`: a local, manual writing desk for your own article. Edit page details and Markdown, inspect a deliberately limited text-only preview, and export after review. It does not call AI, upload writing, or publish anything.
- `/demo/`: practice on prewritten fictional examples. These remain illustrative, not actual model responses or customer evidence.
- `/pilot`: an invitation-only AI-assisted workflow that requires owner activation. Its article types are Personal essay, Project update, and Practical guide, not custom saved profiles or a learned voice.

The public site has thirteen indexable pages plus a useful 404, including six source-note templates, three complete examples with synchronized Markdown downloads, getting-started/export/review guidance, help, data use, and access information. No public registration, billing, tracking, automatic publishing, audio/video processing, or server-side draft history is introduced.

## Explicit files, not autosave

The local desk and private pilot share a versioned JSON workspace-backup format. A deliberately downloaded backup includes source notes, audience, purpose, article type, draft fields, and review questions. It excludes application authentication fields and approvals. Files are unencrypted and must be kept private. Do not put them in this public repository.

A restore reads only the selected file, validates the entire content and a 128 KiB limit before replacement, asks before overwriting existing writing, and clears approval and pilot consent. It does not call AI. Article Markdown exports continue to omit notes and review questions.

There is no browser autosave, persistent browser storage, account history, or server recovery. A download request cannot establish that the device saved the file. Check the actual file before leaving. See `/help/local-workspace/` and [the local desk release](docs/LOCAL_DESK_RELEASE.md).

## Owner activation remains deferred

The public desk is not an activation workaround or an unlocked AI endpoint. The remaining owner-only work stays in [the activation checklist](docs/ACTIVATION_CHECKLIST.md): privately configure/verify runtime access and provider settings, verify usage protection and spending controls, and run a real fictional-notes acceptance test. Do not treat a merge, successful build, local fixture, or public sample export as proof of provider readiness.

Preserve the existing Worker, GitHub integration, custom domains, production branch `main`, blank dashboard build field, and deploy command `npx wrangler deploy`. Do not change Squarespace, DNS, plans, or billing for this release. Runtime secrets stay private, never in chat, screenshots, browser JavaScript, or the repository. Inspect existing configuration before replacing a secret; password rotation invalidates current sessions. See [the original pilot setup](docs/PILOT_SETUP.md) for configuration and safe disable procedures.

## Build

Requires Node.js 22 or newer. Production code has no third-party npm dependencies.

```sh
npm run build
npm test
npm run check
npm run preview:mock
```

`npm run build` invokes `scripts/build-site.mjs`. It first runs the existing content builder, then the deterministic local-writing extension. The extension shares the generated header/footer, adds the writing desk and file-help page, updates navigation/data-use guidance, and rebuilds the sitemap and release marker. Generated HTML and downloads are ignored by Git. Edit the build sources, not generated files. The same build runs before tests/checks/mock preview and automatically through Wrangler before deployment.

Public fictional data remains in `public/content-data.js`. Writing-desk page source is in `scripts/writing-pages.mjs`. `public/workspace.js` is the bounded file contract reused from the earlier recovery work; `src/recovery-markup.js` and `public/recovery.js` share the controls between the manual desk and pilot.

## Tests and their limits

GitHub CI runs the complete Node suite, syntax/asset/anchor/accessibility-reference checks, and a pinned Wrangler dry-run. A separate read-only browser job installs Playwright 1.57.0 as test-only tooling and executes `python scripts/browser-smoke.py`.

The browser suite loads actual ES modules using local Playwright response routes with CSP headers. It checks desktop/narrow layouts, export approval, actual temporary-browser download bytes, backup restoration and cancellation, hostile text, sample/template regressions, and simulated pilot session failures. These routes are test fixtures, not real Cloudflare authentication, Durable Object execution, or genuine provider requests. No test secrets or real private writing are used.

The original mock preview binds only to `127.0.0.1:8790` and uses fake credentials and handcrafted model output. Never deploy it or use its test password in production. A dry-run bundles code but does not activate the service. Hosted acceptance and provider-quality testing remain separate.

## Preserved safety boundaries

Signed Secure, HttpOnly, SameSite=Strict host-only pilot cookies expire after four hours. Worker-first protected routes, exact-origin mutation checks, canonical-domain restrictions, input limits, fixed model/output limits, and shared atomic quotas remain in place. The whole pilot shares 20 reserved generation attempts per UTC day, at least 30 seconds apart; failed provider attempts count. No automatic provider retries are added.

No notes, drafts, authentication values, or provider responses are saved in application storage or logs. Only shared counters/timestamps persist in the existing Durable Object. Infrastructure/provider processing is separate from application storage. The privacy notice explains these boundaries and explicitly downloaded files.

User writing and imported markup are treated as text. The local preview creates no links or images and executes no HTML. Markdown exports remain untrusted input for the destination, not sanitized for every renderer. `draft: true` is not a universal publication lock.

## Change process

Use feature branches and reviewed pull requests. Keep private material out of all public branches and documents. Preserve existing work when reconciling older branches. Distinguish source changes, local tests, CI, deployment, and genuine AI activation in release reports.
