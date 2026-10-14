# Writing workflow release

Release identifier: `writing-workflow-20261014`.

The public workspace now connects note outlines, an optional locally assembled drafting brief, article editing, reading preview, explicit private backups, and reviewed exports. Templates link directly to named outline fragments; URLs never contain user writing. The first-use guide starts with the public tools.

Body copying and downloading need only the reviewed article. Standalone HTML needs a title and article. Full page Markdown needs all page details, with an explicit choice about whether to include the title heading. Readiness and field errors distinguish those requirements. Markdown defaults remain unchanged for the existing sample and pilot exporters.

The reading preview and HTML export share bounded blocks and simple emphasis tokens. All supplied text is escaped or assigned as text nodes. No source HTML, script, link, image, or external asset is executed or loaded. The standalone document uses local styling and a restrictive meta CSP. Page Markdown still requires destination-specific review and is not universally sanitized. No website adapter or automatic publication is claimed.

The existing version-1 workspace-backup contract is preserved. It excludes credentials, approval, consent, and export-format preferences. Restore clears approval and consent; the desk resets its Markdown setting to website-supplied title. Editing source notes also clears approval in both public and pilot editors. Imported questions can be stale and remain an editorial aid.

All public pages now use one shared page shell, including navigation, footer, metadata, favicon, social card, and release marker. The prior string-patching build extension was removed. The source remains dependency-free for production. There are fourteen indexable pages plus a useful 404, including a factual about/support page. Existing public URLs and fictional example files are retained.

Local validation: all 108 Node tests passed; syntax, relative links and anchors, accessible references, asset imports, protected routing, and storage/logging checks passed. The browser suite has been expanded to exercise body exports without metadata, HTML download/rendering, template fragments, drafting briefs, existing backups, hostile text, and narrow layouts. Its executed results are reported in the pull request checks separately from local validation.

Private AI activation remains pending. No real provider call, runtime-secret change, DNS change, billing change, tracking, server draft history, or public registration is part of this release. The established GitHub-to-Cloudflare deployment workflow is retained. Passing fixtures cannot establish real model quality or production provider readiness.
