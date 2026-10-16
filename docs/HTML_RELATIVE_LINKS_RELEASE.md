# Preserve relative HTML links

Release: `html-relative-links-20261016`

## Problem and result

HTML imports previously omitted every relative link target. Articles copied from websites or opened as HTML files could therefore lose useful references while retaining only their labels.

All eight workspaces now offer an optional **Source page URL** in their HTML import controls. The author supplies the original page URL, previews, and inspects the resulting Markdown. Safe root, directory, parent, query, fragment, and protocol-relative references can become absolute HTTP(S) links. Explicit safe absolute links retain their existing behavior. A conversion notice counts resolved relative targets. No page, image, or link is fetched or verified.

The HTML converter reads the original href attribute and uses only author-supplied context. It never uses this site's URL, imported base elements, clipboard metadata, or a selected local file path. Blank context retains the existing omission behavior. Invalid optional context blocks conversion rather than silently discarding it.

## Preview and privacy behavior

Changing the source URL clears the prepared HTML preview and its acknowledgement, while retaining raw or copied source for re-preview. The exact HTML options are checked again before application, including the URL and table-header choice, so a stale candidate cannot be applied even if input events were missed. Current writing and export approval remain untouched until the existing import/insertion action applies a reviewed candidate.

The field is limited to 2,048 characters. Source URLs require absolute HTTP(S), no credentials, and the same bounded URL safety rules as existing links. Unsafe schemes, malformed absolute URLs, backslashes, controls, and ambiguous malformed authority references are not repaired. Native URL resolution handles supported relative paths. A trailing slash affects the source directory, and fragment references lead to the original page rather than creating local Markdown anchors.

The source URL remains temporary. Applying or clearing an import, choosing another file, or replacing/clearing the workspace clears it. A fictional HTML-source example explicitly fills its fictional URL. The setting is excluded from private backups and ordinary exports; resolved URLs are part of the resulting article and are exported. Query parameters from the source can be retained by fragment links, so the UI asks authors to inspect actual output before sharing.

No paid service, dependency, AI request, account, persistent state, tracking, private-file schema, schedule, Actions job, or hosting change is added. This improves conversion fidelity; it does not establish traffic or revenue gains.

## Validation

Tests cover normal URL resolution, trailing-slash and query/fragment behavior, no-context preservation, unsafe/malformed inputs, explicit-base validation, hostile source base elements, inline formatting, HTML/file/copied-source preview lifecycle, stale application, whole-import bounds, output structures, and private-setting exclusion. Existing native Cloudflare publication and live verification are recorded in the pull request.

Reference: [MDN URL resolution](https://developer.mozilla.org/en-US/docs/Web/API/URL_API/Resolving_relative_references).
