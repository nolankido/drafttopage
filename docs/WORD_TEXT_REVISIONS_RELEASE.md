# Explicit Word text revision previews

Release marker: `word-text-revisions-20261016`.

## Problem and result

Word import previously refused every tracked change, including a simple word replacement. Writers had to resolve changes in another editor before they could review a conversion. The import now supports an explicit proposed or previous text version for a bounded subset of ordinary main-article text insertions and deletions. Each newly selected Word file starts with tracked changes blocked. It never silently chooses a version.

Proposed text keeps insertion groups and omits deletion groups. Previous text does the inverse. This reverses supported pending text changes only, not every historical edit, and is not a reconstruction of an original document. Revision author names, dates, and history do not enter the converted article. The original file is never rewritten. The reading and Markdown previews show the selected version, with group counts and a version-specific acknowledgement.

The namespace-aware scan validates up to 200 insertion/deletion groups within the existing 30,000-node, 40-level, bounded selected-XML policy. Supported groups contain ordinary text runs, basic run properties, tabs, breaks, and hyphens. Runs retain the existing emphasis, safe hyperlink-label, and hidden-text rules. The parser validates both kept and omitted groups before conversion. It does not rewrite detached XML or attach source nodes to the page.

Moves, paragraph marks, table structure changes, tracked properties/numbering, nested revisions, fields, drawings, note/comment references inside groups, wrong text kinds, and revisions in note or style parts remain blocked. Ordinary table-cell paragraph text can use the selected version; tracked row/cell changes cannot. Comment recovery remains separate and does not accept comment revisions. Formatted HTML tracked changes remain unsupported. This is not a complete Word revision engine or per-change review interface.

## State and recovery

Changing the version invalidates the previous article preview, acknowledgement, insertion plan, image package, and recovered comments. Preview must be prepared again. Conversion captures the source identity and options before asynchronous reading; a result for a discarded source or changed options is not staged. Apply also checks the current Word option signature, so silently changed controls cannot apply an obsolete preview. Each new file and clearing/applying reset the revision choice.

The existing apply path checkpoints validated writing before mutation and clears review approval. Search, version selection, conversion preview, cancellation, blocked data, and checkpoint failure do not replace current writing. Source notes remain separate. Article replacement keeps existing review-note replacement rules; insertion retains existing metadata and private notes. Temporary counts, choices, source XML, and original bytes are excluded from workspace backups and exports. Only the chosen applied article remains normal draft text.

The public copy, import help, Word converter guides, privacy explanation, and release capabilities describe the exact subset. Native controls use bounded full-width sizing and a 44-pixel minimum height. Existing native Cloudflare Git publishing remains. No dependency, paid service, AI request, upload, account, persistent storage, tracking, DNS/billing change, or GitHub Actions workflow is added. The site remains in development.

## Validation

Targeted tests cover independent proposed/previous output, retained formatting and links, hidden text, hostile literal text, malformed and unsupported revisions in either branch, note/style exclusions, group/XML/article bounds, unchanged documents, backup schema, default blocking, re-preview and renewed acknowledgement, cancellation/checkpoint failure, option changes without events, source/version changes during parsing, and per-file/reset behavior.

All 640 Node tests passed. Static checks passed for 28 HTML pages, script syntax and imports, assets and anchors, accessible references, protected routing, storage/logging guards, and absence of GitHub Actions workflows. All seven generated workspaces contain the version control and review; both file-first Word routes keep the control outside the folded alternate-source choices. Direct live UI, native deployment, recovery, and actual downloaded-file evidence are recorded in the release pull request. These checks do not certify Microsoft Word equivalence, real-mobile behavior, screen-reader support, or third-party editor compatibility.

Syntax references: Microsoft Learn [inserted run content](https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.wordprocessing.insertedrun?view=openxml-3.0.1), [deleted run content](https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.wordprocessing.deletedrun?view=openxml-3.0.1), and [revision distinctions including paragraph marks and table rows](https://learn.microsoft.com/en-us/office/open-xml/word/how-to-accept-all-revisions-in-a-word-processing-document).
