# Reading preview to article source

Release: `preview-passages-20261016`.

## Problem and resulting behavior

A writer could see a problem in the reading preview but had to find the same passage in the Markdown editor. The existing outline and draft findings cover only selected patterns. Every public writing workspace now has an optional Find passages in editor control directly above its reading preview.

Turning it on adds source-selection buttons beside the first 200 passages. A passage is a heading, paragraph, continuous list group, quotation, fenced code block, or table. Its control names the type and original line numbers. Choosing it selects that exact Markdown range, opens the editor location, and reveals the selected text inside the textarea. Repeated paragraphs have independent ranges. Original UTF-16 offsets, CRLF and bare carriage returns are accounted for; matching display text is never used to guess an occurrence.

After editing, Return to this passage in preview below the editor focuses the passage containing the current cursor in the updated source. A cursor in whitespace goes to the following passage, or the final passage at the article end. If the cursor is beyond the first 200 passages, return opens the full reading preview and explains the control bound. The full article remains readable and editable at the existing 60,000-character limit.

The feature starts off. Native buttons, accessible group labels, visible focus, and wrapping controls support keyboard and narrow-layout navigation. Existing article links retain normal new-tab behavior, and text remains selectable. Lists and tables are selected as complete source groups; this is a source-navigation aid, not a rich-text editor. A staged import has no passage-edit controls and must be applied or cleared before current-article navigation. File reads block jumps and the return action.

## Implementation and boundaries

`previewPassages` groups the existing bounded preview parser's results alongside original source ranges. `previewBlocks` still exposes the same flattened rendering blocks without source metadata. Existing HTML, WordPress, Word, Markdown, clipboard, and ZIP exports continue to use their established content contracts. Only the public editor's current-article preview opts into decorated groups; import and private-pilot previews stay undecorated.

`preview-navigation.js` owns temporary control nodes, current-render signatures, source selections, and the return path. A stale detached button checks its source snapshot before selecting. Unrelated updates and editor blur preserve current button nodes. Actual article edits refresh ranges and clear approval through the existing editor. Navigation does not call the mutation path, create checkpoints, change writing, or approve exports. Full workspace replacement and article replacement clear passage navigation; disabling controls clears the return path.

Controls and source-position metadata are excluded from all exports, version-1 private workspace files, collections, and publishing profiles. Safe DOM node construction is retained; source HTML and images stay inert. No production dependency, upload, external request, tracking, persistent storage, account, AI request, paid service, scheduled job, or GitHub Actions workflow is added. Existing native Cloudflare Git deployment remains in place.

## Verification

Focused tests cover independent expected source ranges, repeated Unicode/CRLF passages, all supported block groups, malformed table/list fallbacks, unfinished fences, exact selection, current-cursor return, stale controls, busy and pending-import guards, the 200-control boundary without content loss, safe semantic rendering, unchanged article exports and private file schemas, clearing/reopening, and accessible control placement in all seven public workspaces.

Executed local checks, native deployment, and live desktop evidence are recorded in the release pull request. Local managed preview is unavailable because the required control-browser skill is absent; no replacement preview server or browser is installed. Narrow-layout CSS and source structure are checked locally. Actual mobile-device and assistive-technology testing remain unrun. User completion rates, retention, traffic, and willingness to pay remain unmeasured.
