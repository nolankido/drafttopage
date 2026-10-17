# Lightweight kit file lists during live editing

Continuation of PR #120 from production commit `06a8823b45444741648022944ee6dd5115a7822c`.

## Source finding and change

When the general publishing-kit panel was open, every editor update built its full reading-page HTML, Markdown and metadata files merely to show their filenames and purposes. Opening the WordPress kit did more work: it rebuilt the general files, WordPress block HTML, a second complete review and image notes, again only to display six descriptions.

The two controllers now use `public/kit-manifests.js` for field-validated filenames, file order, descriptions, optional page Markdown, slug notices and linked-image notices. The helper returns no article content, HTML, private fields or ZIP bytes. It retains no draft or cache. The WordPress file-list signature now contains descriptions, not article text; current review findings and source guards still use their original article signatures.

The full `publishing-kit.js` and `wordpress-kit.js` serializers are unchanged. Explicit approved downloads still regenerate actual files from the complete current article. Existing WordPress, Word and HTML findings, preview content, consent, permissions, approval invalidation, download error handling and private-field boundaries are not bypassed. The file list is not proof that final export serialization will succeed; the download handler remains authoritative and reports failures.

## Contracts and evidence boundary

New regression tests compare manifests with the full serializers across title choices, missing/invalid optional fields, Unicode/CRLF, hostile literal HTML, lists, tables, image modes and near-limit articles. Invalid field rejection text is compared. Mutation isolation and private-data exclusion are checked. A poisoned-dependency test makes article-producing exports throw, proving the manifest path only uses field-validation and summary helpers. Controller guards pin full generation to actual downloads.

Descriptions deliberately duplicate the small existing serializer catalog to avoid changing authoritative export byte generation. Exact parity tests must fail if a later serializer changes a filename, purpose, notice or optional-file rule without updating its manifest.

Before release, run the complete Node/static/browser/WordPress gate, an instrumented open-panel no-serialization browser check, and a source-bound before/after typing comparison with profiled runs kept separate from uninstrumented timings. Preserve all p95 regressions and unchanged controls. Source-level removal of duplicate work is not itself a field-latency result.

No GitHub Actions, cron, tracking, new production dependencies, provider activation, account changes, outreach, user drafts or automatic publication. Native Cloudflare Git deployment only. Exact observed release and performance results belong in the PR and follow-up evidence note.
