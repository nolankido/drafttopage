# Local writing desk and shared recovery

Release identifier: `local-desk-20261008`.
Base: `6e52e55896e88d6fe9972b28ac2389b1c4d73ade`.

## Owner-only work stays pending

AI activation remains deferred. The checklist in `ACTIVATION_CHECKLIST.md` is still outstanding and must not be marked complete by this code release. Independent improvements require no owner attention, secret changes, account access, DNS changes, plan upgrades, or production AI calls. The public manual desk is not an AI activation workaround.

## Added

- `/write/`: a manual editing workspace for the user's own text, five article fields, optional source fields, local filename suggestion, word/character counts, limited inert reading preview, and reviewed Markdown/body copy or download.
- `/help/local-workspace/`: distinguishes publishable article exports from unencrypted private workspace files; explains save, restore, cancellation, privacy, limits, and destination review.
- Shared private-backup controls in the manual desk and protected pilot. The serialization module is reused unchanged from the earlier PR #3 recovery work, blob `ce6e173c67e4aaef2ae995de53b2536afe524e92`, rather than inventing an incompatible format. Older branch content is not merged wholesale over newer pages.
- Strong restoration behavior: file size checked before reading, full shape/version/field validation before replacement, explicit overwrite confirmation, and no consent or review approval restored. Invalid/cancelled files preserve existing writing. Authentication fields are not part of the format.
- Accurate private-pilot profile associations and announcements, programmatic busy state, and post-generation focus only after fields are enabled. Existing copy, template, session-recheck, and failure-preservation behavior is retained.
- Public navigation, homepage entry, privacy/help updates, deterministic build extension, and thirteen sitemap entries. Public fixture examples remain unchanged and labeled illustrative.

## Safety and scope

There is still no autosave or server draft database. Explicit JSON files contain notes and questions, are unencrypted, and can be synchronized by the device's own services. The download code can request a file but cannot confirm that a user's device saved it. No new external production dependency, telemetry, contact form, signup, account storage, provider model change, API request, or automatic publication is added. Existing backend auth, quotas, origins, migration, and provider code are unchanged.

Preview is intentionally incomplete: it recognizes paragraphs, standalone headings, and simple lists. HTML, links, images, and inline Markdown remain inert text. It is a reading aid, not a destination-rendering or content-safety certification.

## Build composition

`npm run build` and Wrangler now invoke `scripts/build-site.mjs`. The original builder runs first; `extend-site.mjs` derives the shared shell from its generated homepage, adds the two writing pages, patches well-defined navigation/help regions, and updates sitemap/release metadata. The original public content source and sample-data file are preserved. Determinism and idempotency are tested. A missing expected shell aborts the build rather than guessing a replacement.

## Verification during authoring

Thirty new Node tests passed locally, covering file round trips, partial drafts, unknown fields/versions, malformed data, byte/field bounds, prototype keys, textual markup, export exclusions, filename constraints, accessible markup, and deterministic build composition.

An isolated offline DOM test of the new writing desk passed: edit/reapproval, captured article and backup Blob contents, valid/invalid/cancelled restores, approval reset, inert hostile preview text, and layouts at 1440, 390, and 320 pixels. Desktop/mobile screenshots were inspected, with no observed overflow or JavaScript errors.

The authoring environment could not resolve GitHub from the container and its Chromium policy blocked routed-page navigation with ERR_BLOCKED_BY_ADMINISTRATOR. No browser policy was changed. Therefore the local offline test used injected scripts/styles and captured Blobs, not real CSP/module navigation or actual saved downloads. Exact known source assets and the recovered serializer were compared with their Git blob hashes.

The repository browser suite is upgraded to real module loading through local response fixtures carrying CSP headers, with actual temporary-browser download files. Full Node, static, browser, and Wrangler CI results must be checked separately on the PR. CI fixtures still do not prove hosted authentication, quota storage, genuine provider use, or actual user-device behavior. Deployment verification must follow merge.

## Implementation references reviewed

- MDN File API: https://developer.mozilla.org/en-US/docs/Web/API/File
- MDN beforeunload limitations: https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeunload_event
- Cloudflare static-asset headers: https://developers.cloudflare.com/workers/static-assets/headers/
- Playwright network routing: https://playwright.dev/python/docs/network
- Playwright downloads: https://playwright.dev/python/docs/downloads
- Pinned test package: https://pypi.org/project/playwright/1.57.0/

Reviewed October 8, 2026. These references explain implementation behavior, not the correctness of generated writing.
