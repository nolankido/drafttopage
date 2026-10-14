# Draft to Page

Your ideas. Ready for your website.

Repository: `nolankido/drafttopage`. Domain: `drafttopage.com`. Hosting: the existing Cloudflare Worker `drafttopage`.

## Public writing workflow

- `/write/`: start from notes or edit an existing article. Six outlines load directly into the workspace. A locally assembled drafting brief can be copied into a tool the author chooses; the public workspace itself never calls AI or uploads writing.
- Copy or download the reviewed article body without page metadata. Add a title for a standalone HTML reading page. Complete title, excerpt, description, filename, and body for a page Markdown export, with an explicit choice about the title heading.
- `/demo/`: practice with prewritten fictional examples. These are illustrative, not actual model responses or customer evidence.
- `/pilot`: private AI assistance requires owner activation and genuine hosted acceptance testing. Generation remains separate from the public workspace.

The public site has fourteen indexable pages plus a useful 404, including note templates, three complete examples, source/review/export guides, about and support, and data-use guidance. There is no public registration, billing, tracking, automatic publishing, or server-side draft history.

The public reading preview and standalone HTML export support headings, lists, simple emphasis, code, and quotations through bounded text parsing. Links, images, and source HTML remain text; no external resources are loaded. The exported HTML document includes local styling and a restrictive document CSP. It is not a full Markdown renderer or a verified integration with any particular website. Page Markdown remains untrusted input for the destination.

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

`npm run build` invokes `scripts/build-site.mjs`, which builds all public pages through `scripts/build-content.mjs`. The shared page shell, navigation, footer, metadata, and release identifier are in `scripts/site-shell.mjs`. No generated-HTML patching layer remains. Generated HTML and downloads are ignored by Git; edit build sources instead. Wrangler invokes the same build before deployment.

`public/content-data.js` contains public fictional examples and outlines. The desk markup is `scripts/writing-desk.html`, composed by `scripts/writing-pages.mjs`. `public/workspace.js` preserves the existing version-1 private-backup contract. `public/authoring.js` separates body, reading-page, and complete-page validation and assembles the local drafting brief. `public/html-export.js` generates a standalone reading document without source markup execution. `public/preview.js` supplies the shared bounded reading blocks.

## Tests and their limits

GitHub CI runs the complete Node suite, syntax/asset/anchor/accessibility-reference checks, and a pinned Wrangler dry-run. A separate read-only browser job installs Playwright 1.57.0 as test-only tooling and executes `python scripts/browser-smoke.py`.

The browser suite loads actual ES modules using local Playwright response routes with CSP headers. It checks desktop/narrow layouts, export approval, actual temporary-browser download bytes, backup restoration and cancellation, hostile text, sample/template regressions, and simulated pilot session failures. These routes are test fixtures, not real Cloudflare authentication, Durable Object execution, or genuine provider requests. No test secrets or real private writing are used.

The original mock preview binds only to `127.0.0.1:8790` and uses fake credentials and handcrafted model output. Never deploy it or use its test password in production. A dry-run bundles code but does not activate the service. Hosted acceptance and provider-quality testing remain separate.

## Preserved safety boundaries

Signed Secure, HttpOnly, SameSite=Strict host-only pilot cookies expire after four hours. Worker-first protected routes, exact-origin mutation checks, canonical-domain restrictions, input limits, fixed model/output limits, and shared atomic quotas remain in place. The whole pilot shares 20 reserved generation attempts per UTC day, at least 30 seconds apart; failed provider attempts count. No automatic provider retries are added.

No notes, drafts, authentication values, or provider responses are saved in application storage or logs. Only shared counters/timestamps persist in the existing Durable Object. Infrastructure/provider processing is separate from application storage. The privacy notice explains these boundaries and explicitly downloaded files.

User writing and imported markup are treated as text. The local preview creates no links or images and executes no source HTML. Standalone reading-page exports escape supplied markup and have no scripts or external assets. Markdown exports remain untrusted input for the destination, not sanitized for every renderer. `draft: true` is not a universal publication lock.

## Change process

Use feature branches and reviewed pull requests. Keep private material out of all public branches and documents. Preserve existing work when reconciling older branches. Distinguish source changes, local tests, CI, deployment, and genuine AI activation in release reports.

