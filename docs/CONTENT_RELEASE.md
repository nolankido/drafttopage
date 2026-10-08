# Content and pilot usability release

Release: `content-pilot-20261008`.
Base reviewed: `dc3132d7af75646ccfcad098f2bd3354dabfb360`.

## Source and build

`public/content-data.js` is the single source for six templates and three fictional examples. `scripts/build-content.mjs` creates eleven indexable public pages, a useful 404 page, three sample Markdown exports using the existing exporter, sitemap, robots file, and a public non-sensitive release marker. The build makes no network calls and reads no secrets.

Generated HTML, samples, sitemap, robots, and release marker are ignored rather than hand-edited. Edit the content data or build script and run `npm run build`. The Wrangler custom build runs that same command automatically before deployment. Keep the existing blank dashboard build command and `npx wrangler deploy`; no dashboard or DNS reconfiguration is required. `npm test`, `npm run check`, and `npm run preview:mock` build public content first. Existing authentication, provider limits, quota storage, migration, canonical pilot routing, and no-content-logging rules are unchanged.

The public sample editor has no AI calls or authentication bypass. It loads prewritten examples, allows edits, requires review, validates exports with the same Markdown function, and keeps edits only in the open page. Public scripts do not use persistent browser storage. No account forms, tracking, external assets, extra runtime dependencies, or billing are introduced.

## Pilot improvements

- Accurate Article type label, six local note outlines, and article-type-specific fictional sample notes.
- Guard against sending a completely unfilled built-in outline from the UI.
- Prominent unsaved-work warning and help links that open in a new tab.
- Recheck connection action that preserves work, makes no AI call, and restores the generation control after reauthentication.
- Response validation before overwriting existing fields, clear retry guidance, and bounded browser request waits.
- Separate copy controls for notes, review questions, and article body; Markdown exports still exclude notes and questions.
- Editing any article field clears approval. Export guidance distinguishes draft metadata from publication controls.

## Validation and scope

Authoring checks: 23 new Node content tests passed; static checks passed across 15 generated/public/protected page variants, scripts, assets, local anchors and cross-page anchors. Unchanged baseline backend tests are retained in GitHub and must also pass in PR CI. The existing CI job runs the entire Node suite plus a pinned Wrangler dry-run.

The expanded Python Playwright script passed DOM-only tests for all twelve public pages at 1440px, 390px and 320px; template copying and clipboard failure; local sample editing and export; private-pilot template/sample loading, unfilled-outline blocking, review gating, edited output, response-failure preservation, session recovery, inert hostile markup and clearing. No JavaScript page errors were observed. Desktop homepage and mobile sample-editor screenshots were visually inspected.

These browser tests inject local assets and mocked responses. They do not test deployed CSP, real network cookies, Cloudflare Durable Object behavior, provider credentials, live AI quality, or an actual device download. No production secrets were read or changed and no genuine provider request was made. Deployment and activation are separate acceptance steps, not implied by the local result.

## Public-page inventory

| Route | Reader task |
| --- | --- |
| `/` | Understand the outcome and choose a real next action. |
| `/examples/` | Compare notes, articles, page details, review questions, and sample files. |
| `/templates/` | Copy one of six factual note outlines. |
| `/demo/` | Edit, review, and export prewritten fictional material without signing in. |
| `/getting-started/` | Complete the first invited-user workflow. |
| `/help/` | Resolve access, generation, clipboard, export, and recovery questions. |
| `/help/markdown-export/` | Understand the file and validate a manual publishing handoff. |
| `/access/` | Understand public resources, invitations, and owner activation. |
| `/guides/source-notes/` | Prepare source-grounded input. |
| `/guides/review/` | Check claims, voice, uncertainty, permissions, and the complete output. |
| `/privacy/` | Understand public-demo and private-pilot data handling. |

All content is public-safe. No fabricated customer evidence or integration claims are included. Samples remain explicitly illustrative until a separate genuine pilot run is documented. Recheck these pages when authentication, storage, model use, export fields, or supported destinations change. See `ACTIVATION_CHECKLIST.md` for the owner-only production acceptance work.
