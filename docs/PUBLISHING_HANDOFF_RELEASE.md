# Formatted copying and publishing kits

Release marker: `publishing-handoff-20261014`.

## User-facing result

The public workspace offers a deliberate formatted clipboard handoff and one-file publishing kit. The default export panel groups editor copying and single files; complete Markdown and kits have their own expandable panels. Readiness follows the author's current article instead of making page metadata the primary requirement for every export.

Copy formatted article writes HTML and a plain-text representation. It needs only an article by default. Including the title is an explicit preference that also requires a title and clears review approval when changed. The HTML uses the same bounded renderer, escaped source text, and protected HTTP(S) links as the reading-page export. Unsupported or denied clipboard writes leave writing intact and explain the existing body, reading-page, and manual alternatives. No particular CMS or destination-editor integration is claimed.

The locally prepared publishing ZIP has article-body.md, reading-page.html, page-details.json, README.txt, and page.md only when all page fields are complete. The contents preview and README explain omissions and the Markdown title choice. A safe archive name/page-details slug is suggested from the title when the editor filename is empty or invalid; the author’s original field stays unchanged. No summaries, dates, factual details, or destination-specific settings are invented.

All public handoffs whitelist article fields. Source notes, audience, purpose, article type, private review questions, check results, and authentication fields are excluded. Article text itself can still contain private material. The publishing kit is unencrypted and is separate from a full private workspace backup. Version-1 backups remain unchanged and exclude export preferences. Restore resets the formatted-title choice.

Editor and review counts use the same approximate Markdown-aware word estimate. Editing also clears stale link-inventory status. The site adds `/help/publishing-handoff/` and updates export, workspace, first-use, and data-use guidance. Seventeen indexable public pages and the existing 404 are built through the shared shell.

## Verification and boundaries

- `npm test` includes independent Python-standard-library archive reading, CRC validation, Unicode bytes, deterministic output, fixed timestamps, bounds, safe filenames, omitted/included page Markdown, title preferences, clipboard HTML escaping, private-field exclusions, and consistent word estimates.
- `npm run check` checks syntax, assets, anchors, accessible references, local browser imports, protected routes, and storage/logging guards.
- Browser fixtures load actual ES modules under CSP. They test native ClipboardItem HTML/plain representations through a test-only clipboard sink; denied/unsupported fallback; actual partial/complete/latest-edit ZIP downloads independently opened by Python; private-field exclusions; unchanged backups; restored preferences; the existing workflows; and layouts at 1440, 390, and 320 pixels.
- GitHub CI also dry-runs the existing Worker with pinned Wrangler tooling. Deployment and direct live interactions are reported separately from fixtures.

The production ZIP writer uses stored text entries, fixed safe filenames, standard CRC32 and directory records, a 512 KiB limit, and fixed 1980 timestamps. It adds no dependency, encryption, compression, executable entry, archive importer, or ZIP64 support. Format reference: [PKWARE ZIP specification](https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT). Clipboard reference: [W3C Clipboard API](https://www.w3.org/TR/clipboard-apis/).

The handoff neither publishes nor uploads. Genuine AI activation/provider testing, credentials, DNS, hosting plans, billing, tracking, autosave, persistent browser storage, and per-user accounts are unchanged. Destination rendering, metadata expectations, and permissions still require the author's review. A successful fixture or export is not a claim of destination compatibility, factual certification, or provider readiness.
