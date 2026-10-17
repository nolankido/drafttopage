# Reuse unchanged export-preview blocks

Base production: `3f3c0f9f0318c35b2858b6f24603d0b9a5d631a5`, following PR #123.

The selected-export preview previously regenerated every DOM block for each changed article, even when only the final paragraph changed. The controller now owns one current-preview renderer. It compares exact complete block descriptions, retains the unchanged prefix and suffix in place and replaces only the changed middle. Duplicate blocks are positional, never matched across arbitrary locations. Nested list/table properties, heading levels, title text, image URL/alt and source Markdown participate in identity. Destination and preview-kind changes invalidate all reuse.

This is DOM reuse, not a parser shortcut. Every changed article is still fully parsed by the existing prepareExportPreview function. Changed blocks are built with the original renderExportPreview function in detached fragments before applying any DOM update. No HTML strings are inserted. Full exported files, WordPress review, image consent, source selection, author approval, private backups and download paths are unchanged. Existing error/busy/closed/reset paths clear both DOM and retained current-entry signatures. No history, timers, debounce, persistent storage, additional dependency or network is introduced.

Nine local focused tests passed with a DOM ownership model: unchanged nodes, end/middle changes, insertions/deletions/duplicates/reordering, title/destination/source changes, nested syntax properties, detached-root detection, failed-render atomicity, fallback and a 1,500-block repeated-edit case. These are focused model tests, not browser or production acceptance. Full browser equivalence, source-bound release/WordPress acceptance and controlled typing measurements must complete before merge; record all adverse results.

The implementation uses standard DocumentFragment insertion and Node.insertBefore with an explicit node-or-null anchor. Existing unchanged nodes are not moved, so their native focus/selection can survive an unrelated block edit. References: https://developer.mozilla.org/en-US/docs/Web/API/Node/insertBefore and https://developer.mozilla.org/en-US/docs/Web/API/Element/replaceChildren . This is not a claim about physical-device speed, paint timing or field INP.

No GitHub Actions, scheduled runs, provider activation, accounts, tracking or live publication. Native Cloudflare Git deployment only.
