# A clearer first conversion

Release: `clear-first-use-20261015`.

Visitors previously faced nine header links, a long homepage explanation, and multiple optional editing panels before completing their first conversion. This release prioritizes choosing an input, inspecting the result, and taking the article into WordPress.

## Changes

- The homepage offers Word, Google Docs, and plain-text/Markdown starting points together. Other formats and note preparation remain available below the main workflow.
- A clearly fictional Markdown/result illustration is built using `createFormattedArticle`, the same supported reading conversion used for exports. It links to the existing working sample and does not claim a verified WordPress theme preview.
- A native Convert disclosure groups all five tools. The remaining main links are Writing desk, Examples, and Help. Templates remain linked from the homepage and footer.
- All five converters group richer editing, draft collections, and revisions under one initially closed disclosure. Basic formatting, article fields, the reading preview, exports, explicit backup controls, and omitted-image status remain outside it. The full writing desk keeps its layout.
- Tool shortcuts, direct tool fragments, and cross-panel image/link/source actions reveal the full disclosure path before moving keyboard focus. Opening a tool changes no article fields, approval, or export choices.
- Public copy continues to distinguish local conversion, manual publishing, explicit backups, and the separate inactive private AI pilot.

## Validation

The release adds structural regression coverage for all five converter pages and a nested-disclosure shortcut check. Existing conversion, import, export, review-reset, recovery, routing, and privacy tests remain required. Run `npm test` and `npm run check` locally. GitHub Actions remain off.

Responsive CSS stacks the input/result illustration and secondary content on narrow screens, wraps navigation, and bounds the tool menu to the viewport. Source checks verify balanced markup, local assets, anchors, accessible references, and the hosting configuration. The managed preview browser skill is unavailable in this session, so a local interactive mobile-browser pass is not claimed.

This is a usability release. It adds no tracking, signup, persistent storage, paid service, provider call, new conversion format, or automatic publishing.
