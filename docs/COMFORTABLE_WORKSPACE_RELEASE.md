# Comfortable workspace layout

The public converters previously put the article beside a long preview and export column. Long articles, formatting reviews, and destination previews could leave a narrow reading area or an uneven page. The next usability improvement gives the seven shared tools one readable column by default, with an explicit comparison choice.

## Resulting behavior

- Full-width panels use one centered column, up to 900 pixels wide. Article editing comes before reading and export. Reading and destination previews use the page's vertical scrolling.
- Side by side on wide screens places the article beside reading and export, with private source notes below when shown. The reading preview remains keyboard focusable and has a bounded reading area.
- At widths up to 850 pixels, both choices use one column with previews in the page flow. Minimum-zero grid tracks, wrapping, and a full-width native select keep the layout within the available space.
- The step bar offers Edit article after writing is present. Back to editing also appears after the reading preview and at the start of export. Each shortcut focuses the article body without opening a file picker or selecting a different passage.
- Pending imports still take precedence, and file operations disable editing shortcuts. Navigation never grants export approval or performs an export.
- The choice is held only on the current main element. It does not read, clone, serialize, or store writing, preview nodes, or preferences. New tabs begin with full-width panels. Existing backup and article formats are unchanged.

The original layout remains available if the optional controls are absent. Without JavaScript, the workspace keeps its existing explanatory fallback. No service, API, dependency, analytics, persistent browser storage, publishing automation, or paid resource is added.

## Verification

Focused tests cover untouched writing, source notes, selection and scroll offsets, approval, preview identity, disclosure state, focus, invalid layout choices, optional markup, fresh-tab defaults, and shared built markup across all seven routes. Navigation tests cover text, Word, and copied-writing entry routes, pending imports, empty articles, busy files, and exact cursor preservation.

The full Node suite, static site checks, and staged diff checks run before publication. Live browser evidence and the native Cloudflare build result are recorded in the pull request. Responsive CSS inspection and desktop keyboard checks do not establish compatibility with every mobile browser or screen reader.

The site remains in development. This release improves workspace usability; it does not establish conversion fidelity in an external editor or measured conversion-rate gains.
