# Word to Markdown and direct article exports

Release: `word-markdown-20261016`.

## Why this change

The public converters could already prepare an article as Markdown, but body copying and downloading were buried in More export options. Word visitors were directed through a WordPress-specific page. This release adds a focused, useful entry for Word-to-Markdown searches and exposes Markdown directly in every public workspace. Search traffic, conversion rates, and repeat use remain unmeasured.

## Visitor flow

`/word-to-markdown/` uses the established local .docx importer, staged reading preview, transformation acknowledgement, editable article, private backup controls, and guided navigation. Markdown is selected by default. The separate title is included as a literal H1 when available; an empty title does not block a body-only export. The author can turn title inclusion off. Existing headings in the body are never silently removed.

Every public writing and converter page offers Markdown article (.md) alongside WordPress, HTML, Word, and other exports. Copy article Markdown and Download .md file require explicit export review. Excerpt, description, slug, and other metadata are not required. The exact prepared text can be inspected and manually copied after approval. Clipboard failure preserves writing and explains the download/manual alternatives.

The body is retained exactly, including spaces, CRLF, unsupported Markdown, and literal HTML. A final newline is added only when absent. Title newlines become spaces, and literal punctuation is escaped through the checked inline serializer. Markdown is untrusted destination input, not universally sanitized HTML. Editors can interpret source HTML or request linked resources; the interface and help explain this distinction.

The title control and existing page-Markdown format share the `markdownTitle` preference. Existing version-1 profile files are unchanged in shape, and `markdown` is an additional allowed destination. Backups remain version 1 and exclude export choices. New Markdown-destination profiles require a release that understands this destination; older clients reject them instead of silently choosing another output.

The route has a canonical address, unique title/description, a navigation entry, homepage and contextual links, and a sitemap entry. The guide documents real supported structures and exclusions rather than promising full Word or Markdown-dialect compatibility. A fictional .docx and matching source .md are generated deterministically with the production exporters. The sample demonstrates actual file import without inventing user results; Word styles can produce equivalent explicit header emphasis and escaped punctuation.

## Privacy and scope

Article exports include only body text and the deliberately included title. They exclude page metadata, source notes, questions, checkpoints, collections, and authentication values. Prepared code is purged when hidden, collapsed, busy, invalid, unapproved, or reset. Direct event handlers independently enforce destination, busy state, current validation, and approval.

Word import limits, image-recovery choices, explicit replacement confirmations, existing publishing handoffs, memory-only recovery, and the inactive private AI pilot are preserved. There are no new dependencies, accounts, browser persistence, tracking, forms, network APIs, paid services, or automated publication. GitHub Actions remain absent; the existing native Cloudflare integration deploys main.

## Validation

`npm test` passed all 526 tests. `npm run check` passed for 28 HTML pages, script syntax, assets, links and anchors, accessible references, browser imports, protected routing, storage/logging guards, and the absence of GitHub Actions workflows. `git diff --check` passed. Deployment status and live browser evidence are recorded in the release pull request. Tests include exact source preservation, literal titles, optional and malformed fields, 60,000-character bounds, real sample DOCX import with independently parsed XML, ZIP CRC validation, copy/download bytes, manual approval and reset, hidden-output purging, busy actions, clipboard rejection, profile round trips, and generated-page discovery/navigation.

Responsive layout uses the existing shared converter CSS. Browser execution and any mobile or assistive-technology limits are reported separately from source validation.
