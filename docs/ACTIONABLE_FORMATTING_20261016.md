# Actionable destination formatting review

Starting main: `1bb5f625e31770f95180e1361f6546a50f6018fb`, after Word image reconciliation in PR #78.

## Reproduced gap

The article `Before \[Word image 2\] after.` previously produced zero WordPress handoff findings, despite retaining a literal placeholder and no image. The same gap existed in Word and HTML reviews. Writers also had to locate the separate image editor or reference-link panel after receiving a relevant formatting warning.

## Implemented behavior

- Original numbered and legacy Word image placeholder text receives an exact-range, destination-specific warning. Repeated labels retain independent UTF-16 positions and CRLF line numbers. These are possible omitted-image markers, not authenticated image identities. Inline and fenced code, supported link/image labels, and URL syntax remain protected. Existing total counts, deterministic source ordering and the 40-finding display bound are preserved.
- Relevant image and reference-link findings offer direct routes into the existing image preparation or reference conversion panel. Opening a control preserves the article, export approval and linked-image mode. The existing preview, confirmation, checkpoint and apply controls remain responsible for any mutation. No URL is loaded and no image is uploaded.
- Every action rechecks source, title, destination and relevant title/image options before using a saved range. Busy operations block it. An unavailable optional module, unsupported location, failed callback, or declined preparation falls back to current exact source inspection. If source changes during a failed callback, no old range is selected or claimed.
- Word and HTML retain literal image syntax. Their findings and navigation message state that preparing Markdown does not embed an actual image. A writer must add those images in the destination editor. WordPress linked Image blocks still require a separate explicit choice after applying an image edit.
- Inspect line remains available for every finding. Adjacent controls wrap with spacing and a minimum 44-pixel height. Existing separate review reports and the WordPress kit include unresolved-placeholder instructions, while retaining private-field exclusions and unchanged article bytes/file formats.

## Validation and limits

Thirteen new model/controller cases cover original and legacy labels, duplicate Unicode/CRLF offsets, protected code/link/image contexts, no invented image blocks, destination wording, bounded counts, separate reports, suggested-action scope, current navigation, stale body/title/destination/title/image options, busy operations, manual fallback, exceptions, source changes during fallback, and cached pages without callbacks.

Two browser journeys exercise the actual current controls and optional-module fallback. They cover second-occurrence targeting, approval-preserving navigation, previewed/checkpointed image and reference changes, Word/HTML limitation messages, current image loading into preparation, a downloaded kit with the remaining placeholder warning, manual source selection, and narrow layouts. The release PR records exact final gate results, tree/hash and deployment checks.

This is local fixture evidence, not a new user study, real-device/screen-reader acceptance, external image upload, production rendering or expanded destination-compatibility claim. The existing block serializer and file formats are unchanged. GitHub Actions remain off and native Cloudflare Git deployment is preserved.
