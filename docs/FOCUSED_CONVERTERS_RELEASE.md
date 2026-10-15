# Focused converter layout

Release: `focused-converters-20261014`.

The three free converter pages now put writing beside the reading preview and selected handoff on wider screens. This reduces the long path from the article field to its result. It is a usability and acquisition hypothesis; no visitor conversion or retention improvement has been measured.

## Layout and interaction

The shared source order is article, result, then private notes. WordPress, HTML, and Word routes use two columns above the existing 850px breakpoint and one column below it. The general writing workspace retains its source-notes layout when notes are shown and keeps additional exports expanded initially. Focus mode still controls source visibility without deleting notes.

Long desktop reading previews have a bounded, keyboard-focusable scroll region. The complete converted article remains available; nothing is truncated to fit the region. Smaller-screen CSS uses natural preview height rather than nested vertical scrolling. Empty writing gets a useful preview prompt. Preview formats and limits remain available in a native disclosure.

The selected WordPress, HTML, or Word handoff remains visible. More export options folds away formatted copying, article files, reading pages, complete page Markdown, and the general kit on converter routes. Selecting Another editor or Markdown site opens that group. WordPress paste steps use their own disclosure; handoff findings remain expanded. HTML source inspection starts collapsed, and code is prepared for inspection only when opened and approved. Direct copying/downloading still uses the current article.

Opening or closing these view panels does not edit writing or set approval. Existing writing, source notes, page fields, imports, review questions, and checkpoints use their established contracts. Restoring a workspace resets the route's extra-export default and approval. Backups do not include the view state.

## Hidden output and implementation

The existing workspace controls retain their IDs and event bindings. Static source composition moves preview and exports into a sibling result region, avoiding runtime reparenting or duplicated editors. There is no visual CSS ordering substitute for document order. Existing paste guards, safe renderers, output formats, explicit approval, checkpointing, and Cloudflare hosting remain intact.

When More export options is closed, the generic publishing kit is not prepared. Its hidden file list and readiness are purged, its download is disabled, and a hidden or busy kit action cannot initiate a stale download. Opening the group recomputes readiness and any expanded file list from current writing. Destination changes retain their existing approval reset.

No network request, AI call, account, tracking, storage, dependency, timer, or GitHub Actions workflow is added.

## Verification

- All 299 Node tests pass. The new suite independently parses all four generated workspaces as balanced HTML and checks sibling regions, reading order, field containment, collapsed defaults, focusable preview semantics, and primary versus extra actions. Controller checks cover unused metadata, hidden-kit output, view-only approval/writing preservation, other-editor reveal, route reset, and hidden/busy action guards.
- Static checks cover 25 HTML pages, scripts, links/anchors, accessible references, local dependencies, protected routing/hosting, privacy guards, and absent Actions workflows. Python browser-fixture compilation and whitespace checks pass.
- The browser fixture checks all three converters at 1440, 850, 390, and 320 pixels, including keyboard scrolling, full ending retention, layout geometry, view toggles, and destination changes. This suite remains unexecuted because the local Chromium headless binary is missing. CSS reflow is implemented and reviewed in source; real mobile and screen-reader behavior remain unverified.
- Production build and live desktop checks are recorded separately in the release PR. Static topology tests and fixture source do not establish browser layout or accessibility conformance.
