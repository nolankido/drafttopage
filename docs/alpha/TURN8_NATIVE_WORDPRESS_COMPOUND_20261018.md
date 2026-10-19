# Turn 8: isolated compound Word and Docs-style WordPress acceptance

Date: October 18, 2026

## What is newly executable

The existing pinned local WordPress Playground acceptance now includes two **synthetic** multi-feature source fixtures. They are sourced from the separate authored corpus, never fetched from customer documents or a signed-in Word/Google Docs account.

- A reproducible fictional DOCX, constructed from authored WordprocessingML, is opened via Draft to Page's actual Word file input and reviewed before the export. The test checks headings, text, a numbered list, complete table cells, safe link, Unicode, and the exact final sentence.
- A fictional formatted HTML case enters the Google Docs-to-WordPress route through its supported HTML file input, with heading, list starting at four, table, quotation, link and trailing sentence. It is **not** an actual Google Docs clipboard capture.
- For both, native **plain-text clipboard paste** into the isolated WordPress Visual editor, real unpublished draft save, editor close/reopen, native valid blocks, explicit article text, table rows and safe links are mandatory. Neither sample is preseeded into the WordPress parser/store. Both carry an explicit synthetic origin and input SHA-256 in ignored, local test evidence.
- The manual Code editor fallback remains a separately labeled case. The earlier historical Word, Google checklist, quotation, local Media Library and negative-control cases remain intact.

The allowlisted generator refuses arbitrary fixture IDs and produces the same file bytes deterministically. The release receipt checker fails closed on missing or mislabeled synthetic origins or invalid digest strings. Added Node/Python self-tests validate inputs and provenance even without WordPress installed.

## Execute the real isolated destination

A green GitHub or Cloudflare Node/static build proves only the test/source contract. To actually test native WordPress editor behavior, use a **trusted installed** pinned WordPress Playground CLI, a clean complete Git checkout and Chromium/Playwright:

    DRAFTTOPAGE_WORDPRESS_CLI=/absolute/existing/cli.js npm run preflight:release:full
    DRAFTTOPAGE_WORDPRESS_CLI=/absolute/existing/cli.js npm run verify:release:full

This must launch WordPress 7.1.3 locally as an Author with unfiltered HTML disabled, run real editor controls, save unpublished posts, close and reopen them, and validate source-bound receipts. The test adds no public site, new account, credentials, AI provider, GitHub Actions, paid service or tracking. If an exact saved-source or block-shape expectation fails, keep the release blocked and inspect the actual destination output before changing a contract.

## Evidence boundaries

The source is simulated. Real current Word and Google Docs application authoring sessions, native WordPress paste comparison with the **same original** file, hosted WordPress destination behavior, consented human tasks, mobile devices, screen-reader use and price/demand validation are all **NOT_RUN** and cannot be credited by these synthetic cases. No WordPress CLI was installed or run as part of authoring this change. The WordPress acceptance script does not run automatically on Cloudflare and must not be represented as completed until its signed source-bound local report exists.

## Review-driven fidelity and receipt hardening

The source-bound WordPress receipt now independently regenerates each allowlisted synthetic input using the same deterministic offline fixture loader as the browser journey and compares its **actual byte SHA-256** with the reported source input identity. Merely supplying any valid-looking 64-digit digest or saying "fictional" is insufficient. The configured provenance label and actual source bytes must match. The digest check runs in deliberate Node/Python release tooling, not in the public client-side app.

The compound Word article uses WordPress's actual implicit list start (no serialized `start` attribute for the ordinary start of 1), retaining the explicit semantic text and list-item counts. Both compound cases require the authored bold span to appear in the native editor and survive saved and reopened raw/rendered WordPress drafts. The optional exact paragraph content check also catches lost nested markup, and receipt tests deliberately corrupt source digests, labels and emphasis evidence to ensure they fail. These are test implementations; no WordPress session or customer document was run in this turn.
