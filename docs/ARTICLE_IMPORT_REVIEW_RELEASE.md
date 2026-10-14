# Article import and review release

Release: `article-import-review-20261014`.

Users can reopen Markdown exports or paste a six-field structured drafting result into a local import preview. Supported UTF-8 files are limited to 48 KiB; article fields keep their existing length bounds. The preview shows article content, page details, transformation notices, and unmapped scalar front matter. Unmapped fields require explicit acknowledgment and remain in the original source file. Complex YAML, duplicate fields, invalid JSON, control characters, oversized content, invalid filenames, and unsupported shapes do not replace the current article.

Applying an import retains source notes, confirms replacement of existing article fields and review questions, and clears approval. A matching opening Markdown title moves to the title field; a conflicting title stays in the article for review. Selected filenames preserve a custom safe article filename when front matter does not supply one. Import previews are temporary and are excluded from workspace backups until applied.

The local drafting brief now requests exactly title, excerpt, description, slug, body, and questions as JSON, allowing the author to bring a result from their chosen tool back into the workspace with page details and questions. The site does not make an AI request in this workflow.

Public review questions are editable and kept in the unchanged version-1 private workspace format. There are up to twelve notes of 500 characters each. Notes are excluded from article exports and do not certify accuracy. Native formatting tools modify selections without changing other writing or exceeding 12,000 characters. Focus mode hides the source/review panel without deleting it. Initial untouched fields use neutral styling while export readiness remains visible.

Local checks: 120 Node regressions pass, including six export/import round trips, structured-result and version-1 backup compatibility, hostile/malformed inputs, partial Markdown, duplicate metadata, unmapped fields, and formatting bounds. Static syntax, asset, route, anchor, accessible-reference, storage, and logging checks pass. The browser suite also exercises actual UTF-8 file import, preview/cancel/apply, source preservation, edited review-note backup/restore, focus and selection formatting, oversized imports, unmapped-field acknowledgment, inert imported markup, and desktop/narrow layouts. Executed browser and Worker-build results appear in the pull request checks.

Existing static URLs, sample exports, auth, quotas, runtime setup, and hosting workflow remain in place. No persistent browser storage, autosave, server draft history, tracking, billing, registration, real provider call, or automatic publication is added. Private AI activation remains pending.
