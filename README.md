# Draft to Page

Your ideas. Ready for your website.

Repository: `nolankido/drafttopage`. Domain: `drafttopage.com`. Hosting: the existing Cloudflare Worker `drafttopage`.

## Public writing workflow

- `/write/`: start from notes or edit an existing article. Six outlines load directly into the workspace. A locally assembled drafting brief can be copied into a tool the author chooses; the public workspace itself never calls AI or uploads writing.
- Copy or download the reviewed article body without page metadata. Add a title for a standalone HTML reading page. Complete title, excerpt, description, filename, and body for a page Markdown export, with an explicit choice about the title heading.
- `/demo/`: practice with prewritten fictional examples. These are illustrative, not actual model responses or customer evidence.
- `/pilot`: private AI assistance requires owner activation and genuine hosted acceptance testing. Generation remains separate from the public workspace.

The public site has seventeen indexable pages plus a useful 404, including note templates, three complete examples, source/review/export guides, about and support, and data-use guidance. There is no public registration, billing, tracking, automatic publishing, or server-side draft history.

The public desk also supports previewed local Markdown and structured-article JSON imports, including selected UTF-8 files up to 48 KiB. Applying an import keeps source notes, replaces article fields and review questions after confirmation, and clears approval. Unmapped scalar front matter requires a deliberate destination decision. Complex YAML, unknown JSON fields, oversized input, and malformed data are rejected before replacement. Import previews are temporary and are not in backups until applied.

Review questions are editable, with twelve notes of up to 500 characters, and use the unchanged version-1 backup contract. Local formatting tools preserve text outside the selection and respect the editor limit. Focus mode hides the source/review panel without deleting data. Blank untouched fields do not show error styling; readiness remains visible.

The public reading preview and standalone HTML export support headings, lists, simple emphasis, code, and quotations through bounded text parsing. Simple inline links to absolute HTTP(S) addresses without credentials become protected new-tab links. Images, source HTML, and unsupported link formats remain text; no external resources are loaded until a reader follows a link. The exported HTML document includes local styling and a restrictive document CSP. It is not a full Markdown renderer or a verified integration with any particular website. Page Markdown remains untrusted input for the destination.

The article outline and optional local draft checks help locate unfinished placeholders, repeated passages, empty sections, skipped headings, long prose paragraphs, unclosed code fences, and unsupported inline link/image syntax. Findings select and reveal their editor passage and clear after article changes. The outline can move an entire section, including deeper subsections, beside an adjacent same-level sibling within its parent. Moves retain opening text and newline slots, checkpoint the previous workspace before mutation, and clear export approval. Unclosed fences, file reads, unavailable checkpoints, and moves outside the forty displayed headings are blocked. These are bounded editorial patterns, not factual, grammatical, link-availability, or source-quality verification. Results do not gate export and are excluded from workspace backups. See `/help/draft-checks/` and [the section release](docs/SECTION_ORDER_RELEASE.md).

## Publishing handoff

Copy formatted article writes safe article HTML and a plain-text representation in one explicit clipboard action. The default excludes the title; the author can include it deliberately. Supported formatting uses the same renderer as the reading page. A blocked or unsupported clipboard keeps writing intact and points to the existing body/HTML alternatives. Browser and destination-editor support varies; no CMS integration is claimed.

A publishing kit ZIP contains article-body.md, reading-page.html, page-details.json, README.txt, and page.md only when all page fields are complete. Preview its file list and omission notices before downloading. A safe filename is suggested for an incomplete/invalid filename field without overwriting that field. The archive excludes source notes, audience, purpose, article type, private review questions, check results, and authentication fields. The article itself may still contain private information. The kit is separate from the unencrypted version-1 private backup. See `/help/publishing-handoff/`.

The archive writer emits deterministic stored UTF-8 text with fixed safe filenames, CRC32 checksums, a 512 KiB bound, and fixed 1980 archive timestamps. It has no compression, executable entries, archive import, or new production dependencies. `public/publishing-kit.js` whitelists exportable fields; `public/zip.js` writes the archive; `public/export-controls.js` handles deliberate copying and downloading.

Editor and review word counts now share the same limited Markdown-aware estimate. Stale link-inventory status clears alongside other findings. The default export panel presents editor copying and individual files, with complete Markdown and kit choices in purpose-specific details panels.

## Explicit files, not autosave

Find & replace in the article provides bounded literal substring search with optional exact-case matching, previous/next selection, and Enter/Shift+Enter navigation. Replace selected match changes only the selected occurrence; Preview replace all reports actual changes, the resulting length, and at most five inert examples before confirmation. Both paths checkpoint current writing before mutation and clear approval. No-op and rejected replacements keep approval. Article/query/case/replacement edits invalidate bulk previews. Search/replacement settings and snippets are temporary, excluded from backups and exports, and purged on import, restore, or clear. See [the search release](docs/ARTICLE_SEARCH_RELEASE.md). The private pilot keeps its existing editor.

The public desk keeps bounded revision checkpoints in tab memory: at most five and 384 KiB of serialized writing. Authors can save labeled checkpoints and compare exact field text with current writing. Imports, workspace restores, toolbar formatting, outline replacement, filename suggestions, and review-note removal retain previous writing before mutation. Invalid current writing blocks these replacements rather than losing a version that could not be checkpointed. Restoring a checkpoint requires confirmation, retains displaced writing when nonempty, and clears approval and export preferences. Clear this writing desk purges all checkpoints after confirmation. There is no checkpoint on each keystroke, timer, network request, or persistent storage.

A selected checkpoint can be downloaded after a separate private-content acknowledgement. It uses the unchanged version-1 workspace format and includes only that version, without checkpoint labels or history. Current article exports exclude checkpoints and private source/review fields. Checkpoints are not crash recovery: refreshing, closing, or leaving can discard them. See [the full product evaluation](docs/PRODUCT_EVALUATION_20261014.md).

The local desk and private pilot share a versioned JSON workspace-backup format. A deliberately downloaded backup includes source notes, audience, purpose, article type, draft fields, and review questions. It excludes application authentication fields and approvals. Files are unencrypted and must be kept private. Do not put them in this public repository.

A restore reads only the selected file, validates the entire content and a 128 KiB limit before replacement, asks before overwriting existing writing, and clears approval and pilot consent. It does not call AI. Article Markdown exports continue to omit notes and review questions.

There is no browser autosave, persistent browser storage, account history, or server recovery. A download request cannot establish that the device saved the file. Check the actual file before leaving. See `/help/local-workspace/` and [the local desk release](docs/LOCAL_DESK_RELEASE.md).

## Owner activation remains deferred

The public desk is not an activation workaround or an unlocked AI endpoint. The remaining owner-only work stays in [the activation checklist](docs/ACTIVATION_CHECKLIST.md): privately configure/verify runtime access and provider settings, verify usage protection and spending controls, and run a real fictional-notes acceptance test. Do not treat a merge, successful build, local fixture, or public sample export as proof of provider readiness.

Preserve the existing Worker, GitHub integration, custom domains, production branch `main`, blank dashboard build field, and deploy command `npx wrangler deploy`. Do not change Squarespace, DNS, plans, or billing for this release. Runtime secrets stay private, never in chat, screenshots, browser JavaScript, or the repository. Inspect existing configuration before replacing a secret; password rotation invalidates current sessions. See [the original pilot setup](docs/PILOT_SETUP.md) for configuration and safe disable procedures.

## Build

Requires Node.js 22 or newer. The test suite also uses Python 3 standard-library ZIP reading for independent archive validation. Production code has no third-party npm dependencies.

```sh
npm run build
npm test
npm run check
npm run preview:mock
```

`npm run build` invokes `scripts/build-site.mjs`, which builds all public pages through `scripts/build-content.mjs`. The shared page shell, navigation, footer, metadata, and release identifier are in `scripts/site-shell.mjs`. No generated-HTML patching layer remains. Generated HTML and downloads are ignored by Git; edit build sources instead. Wrangler invokes the same build before deployment.

`public/content-data.js` contains public fictional examples and outlines. The desk markup is `scripts/writing-desk.html`, composed by `scripts/writing-pages.mjs`. `public/workspace.js` preserves the existing version-1 private-backup contract. `public/authoring.js` separates body, reading-page, and complete-page validation and assembles the local drafting brief, which requests the same six-field structured article shape the importer accepts. `public/article-import.js` bounds and parses article files; `public/import-controls.js` stages a preview before applying; `public/editing.js` provides pure selection transformations. `public/html-export.js` generates a standalone reading document without source markup execution. `public/preview.js` supplies the shared bounded reading blocks. `public/markdown-inline.js` shares inline parsing and safe URL validation across review, preview, and HTML export. `public/draft-review.js` supplies pure bounded checks; `public/review-controls.js` supplies live outline navigation, stale-result handling, and explicit summary copying.

## Tests and their limits

GitHub Actions workflows have been removed by owner request. Do not add or dispatch Actions jobs or cron schedules. Run `npm test` and `npm run check` locally; the latter rejects workflow YAML under `.github/workflows`. Run `python3 scripts/browser-smoke.py` manually when Playwright and Chromium are available. A pinned Wrangler dry-run is also a manual check, not an Actions job. See [the automation policy](docs/AUTOMATION_POLICY.md).

The browser suite loads actual ES modules using local Playwright response routes with CSP headers. It checks desktop/narrow layouts, export approval, actual temporary-browser download bytes, backup restoration and cancellation, hostile text, sample/template regressions, and simulated pilot session failures. These routes are test fixtures, not real Cloudflare authentication, Durable Object execution, or genuine provider requests. No test secrets or real private writing are used.

The original mock preview binds only to `127.0.0.1:8790` and uses fake credentials and handcrafted model output. Never deploy it or use its test password in production. A dry-run bundles code but does not activate the service. Hosted acceptance and provider-quality testing remain separate.

## Preserved safety boundaries

Signed Secure, HttpOnly, SameSite=Strict host-only pilot cookies expire after four hours. Worker-first protected routes, exact-origin mutation checks, canonical-domain restrictions, input limits, fixed model/output limits, and shared atomic quotas remain in place. The whole pilot shares 20 reserved generation attempts per UTC day, at least 30 seconds apart; failed provider attempts count. No automatic provider retries are added.

No notes, drafts, authentication values, or provider responses are saved in application storage or logs. Only shared counters/timestamps persist in the existing Durable Object. Infrastructure/provider processing is separate from application storage. The privacy notice explains these boundaries and explicitly downloaded files.

User writing and imported markup are treated as text. The local preview creates only validated HTTP(S) links and no images, and executes no source HTML. The same parser and protected links are used in reading exports. Standalone reading-page exports escape supplied markup and have no scripts or external assets. Markdown exports remain untrusted input for the destination, not sanitized for every renderer. `draft: true` is not a universal publication lock.

## Change process

Use feature branches and reviewed pull requests. Keep private material out of all public branches and documents. Preserve existing work when reconciling older branches. Distinguish source changes, local/manual tests, native Cloudflare deployment, and genuine AI activation in release reports. Do not start GitHub Actions for validation.

