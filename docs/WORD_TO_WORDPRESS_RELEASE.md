# Word to WordPress entry page

Release: `word-to-wordpress-20261014`.

## Selected improvement

The local Word importer works, but the existing entry points lead with Markdown and put Word import behind a secondary action. A writer arriving with a .docx needs a clear path that matches that task. `/word-to-wordpress/` now provides a dedicated file-first workspace with a distinct title, description, canonical URL, indexed sitemap entry, and practical Word-specific guide.

The homepage offers Open a Word draft beside Paste text or Markdown. Navigation, the publishing-tool cards, related Word/Markdown guides, and import help link to the new task. No search ranking, demand, new users, conversion increase, or revenue has been established. This is a discoverability and first-use hypothesis that should later be tested with actual authors.

## Workflow

- Choose a Word document opens the existing native file picker from a deliberate user action. It does not read a file automatically, change formats, clear writing, or discard an acknowledged preview when the picker is cancelled. A blocked picker leaves the visible file control as a fallback. File operations disable the launch action and reject concurrent starts.
- The shared import panel appears first and starts open. Pasted-source format controls remain available in a closed native disclosure; the Word table-header choice, conversion preview, and clear action remain outside it. Every existing shared workspace control remains present exactly once.
- A completed conversion focuses its review heading. Acknowledgement, staged replacement, checkpoint protection, rejection, cancellation, source retention, and temporary-byte cleanup use the unchanged importer and v1 private formats.
- Accepting the import closes only this route's file panel and focuses the article. Its desktop editor/result layout, compact extra exports, default WordPress destination, review checks, image preparation, profile/collection/revision tools, and WordPress handoff use the existing shared implementation.
- Paste formatted writing deliberately opens the alternate-source disclosure before focusing its field. Disclosure changes alone do not modify writing or approval. The fictional sample is explicitly labelled as prewritten, not an actual Word-file import.

## Boundaries

The Word import retains its existing limits and losses: plain .docx up to 8 MiB with bounded ZIP/XML processing, main article only, a 60,000-character converted body, basic supported structure, image/object placeholders, and rejection of tracked changes, fields, footnotes/endnotes, equations, and unsupported structures. Original files should be kept. WordPress remains a manual post Code editor handoff, with title separate and actual post inspection required.

No account, upload, provider call, new dependency, tracking, persistent storage, monetization prompt, WordPress connection, automatic publication, or GitHub Actions workflow is added. No writing or filename is placed in a URL. The existing native Cloudflare Git build integration remains in use.

## Validation

Tests cover the complete shared control inventory, balanced editor/result/source reading order, file-first ordering, open/closed disclosure defaults, visible clear action placement, focus target, unique metadata, canonical/index discovery, old-route import defaults, and truthful limits. Importer regressions cover picker opening/cancellation/blocked fallback, preservation of an acknowledged candidate, concurrent-read protection, preview focus, and formatted-source access. The browser fixture now exercises the new primary picker with actual DOCX bytes, staged confirmation/apply, focus, panel collapse, rejection/clear, and alternate-source access.

Record executed local checks, browser availability, native deployment, live fictional-document results, and unrun integration/mobile/screen-reader checks in the release PR. Local fixture or source completion does not establish real user acquisition or actual WordPress editor compatibility.
