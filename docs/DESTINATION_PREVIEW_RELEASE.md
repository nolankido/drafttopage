# Preview the selected export content

Release: `destination-preview-20261016`.

## Problem and decision

The general reading preview always includes a title and uses a single article representation. It is useful for reading and source navigation, but it does not follow a writer's title choice or WordPress linked-image choice. For example, a Word export can omit its separate title while the reading preview still displays it.

A separate optional export preview now follows the destination and options across all seven public workspaces. It addresses that concrete handoff-confidence gap while preserving the existing reading overview and exact passage navigation. It makes no traffic, revenue, native-editor rendering, or independent accessibility-certification claim.

## Behavior

- Preview selected export appears beneath the destination selector and publishing setup. It starts closed and is available for Word, HTML, WordPress, and Markdown. It adds no approval requirement or automatic export action. The existing article export controls retain their own review gates.
- Word previews its optional separate Title paragraph and body heading levels. HTML previews its optional title and normalizes body H1 to H2. WordPress previews body blocks without its separate post title, using the same linked-image eligibility as its exporter.
- WordPress selected linked images appear as inert figures with their exact URL and alternative text. No image element, remote-resource request, upload, image availability check, or permission check occurs. The interface explains that the exported blocks can request those images when opened in the destination. Unsupported and unselected image syntax remains literal text.
- Markdown displays the generated file source from the actual Markdown exporter, including literal title escaping, authored body text, and the final newline. It does not execute source HTML or create resource elements or active links. Another Markdown renderer can interpret source HTML and load referenced images differently.
- Word, HTML, and WordPress previews share the bounded parsed article structures and safe inline DOM rendering. This is a content and structure preview, not a simulation of native fonts, pagination, destination CSS, exact wrapping, or all editor behavior. Export heading levels are retained as model and DOM metadata; displayed headings sit below the surrounding page headings.
- The shared inert block DOM renderer is extracted from the original reading preview. Default reading output and source-passage wrapping are retained, while unsupported executable/resource element types are refused. No arbitrary source markup is inserted into the page.
- An open preview follows article, destination, and relevant title/image-option changes. Unchanged content preserves DOM nodes through editor blur. It does not move focus, edit writing, change approval, save a checkpoint, or add private schema fields. Source and private review-note edits do not create a second copy of those fields in the preview.
- Closed previews avoid capturing or parsing writing. Closing or hiding clears prepared text, rendered nodes, and metadata. Busy file operations and invalid writing clear stale content and show an explanation. Workspace replacement resets the preview to closed. No content is retained in browser persistent storage or added to backups, collections, profiles, reports, or article exports.
- Preview content is an explicitly named keyboard-focusable region. Tables retain their own scrollable regions and accessible headers. Long lines wrap; narrow screens remove the outer nested-scroll restriction. The status is not a live region, so typing does not repeatedly announce the article.

## Verification and limits

Sixteen new tests cover actual Word and HTML title/heading handling, shared WordPress image eligibility and block count, exact Markdown source with Unicode/CRLF/title escaping/final newline, destination validation and size/XML limits, inert markup and prohibited element types, linked-image placeholders, protected code, nested formatting/list/table renderer parity, lazy closed state, unchanged approval, option changes, clearing/reset/hiding, busy/invalid states, stable DOM nodes, live edits, private-field exclusions, unchanged actual export bytes and backup schemas, and markup in all seven generated workspaces.

Run the full Node suite, static checks, and diff checks before publication. Publish through the existing native Cloudflare Git integration; GitHub Actions remain off. Verify title/heading behavior, linked-image placeholders, Markdown source, option changes, closing/clearing, and actual downloaded files on the live site. Responsive rules are source checked; no actual mobile-device, screen-reader, or native Word pagination session is claimed. No dependency, paid resource, tracking, service, AI activation, hosting change, or persistent writing storage is added.
