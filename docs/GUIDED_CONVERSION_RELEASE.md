# A guided conversion path

Release: `guided-conversion-20261015`.

The long writing pages previously relied on focus-only step buttons. A preview or export control could remain offscreen, and visitors had to work out how an unfinished import related to the current article. This release provides explicit navigation through bringing writing, reviewing it, and choosing an export.

## Changes

- All six shared workspaces use one compact, three-column step bar immediately after the main introduction. It remains a sibling of the introduction so sticky positioning can continue through the workspace. Short visible labels and matching accessible names keep the input route clear. Supporting introduction text remains below it.
- The current step uses `aria-current="step"`. Status text describes actual article/import/busy/approval state without claiming a completed review or quality score. It is not a live region, so typing does not generate repeated announcements.
- Review this article appears below the editor. Destination-aware Continue controls appear below the reading preview. These actions, the step bar, and supported review/export fragments open needed disclosures, move keyboard focus without native scrolling, and explicitly scroll the corresponding heading into view.
- Sticky offsets are measured from the bar, including wrapping and resize changes. Reduced-motion behavior follows the existing CSS preference. Narrow layouts retain three compact columns; short windows use static positioning. No writing or focus is changed automatically while typing.
- Pending article imports take precedence in review/export shortcuts. A valid staged conversion opens its review heading; unfinished or failed conversions return to their input. Current article text, notes, approval, and import acknowledgements are retained. Existing export controls keep their own validation and approval rules.
- Navigation is disabled while an article import or private recovery file is being read. Programmatic navigation callbacks also guard busy state. File-first import previews explicitly reveal their heading after successful conversion; applying an import brings the article into view.
- Opening a step does not change the article, approval, export choices, or selection. It never copies, downloads, uploads, or publishes. Navigation state stays in memory and adds no private schema fields, persistence, dependency, service, tracking, or AI request.

## Validation

Behavioral coverage checks empty input routes, writing and approval transitions, return to preview, pending/failed imports, manual export approval, busy guards, destination labels, nested disclosures, focus/scroll order, measured offsets, and unchanged text/selection. Independent HTML parsing checks a single navigation bar outside each introduction, unique controls, reading order, accessible relationships, and continuation controls outside optional editing tools in all six workspaces.

Run `npm test`, `npm run check`, and `git diff --check` locally. Validate live scrolling, the pinned bar, pending import navigation, and export approval after native Cloudflare deployment. Local preview and mobile-device browser QA are unavailable in this session because the managed browser skill is not installed. Responsive structure and short-window fallback are checked in source; actual mobile-device rendering is not claimed. Existing native Cloudflare Git deployment is preserved and GitHub Actions remain off.
