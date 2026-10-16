# Word image reconciliation

This bounded improvement connects the existing Word image placement package with the guided article image editor. It does not add an upload service or change the version-1 image-map or workspace formats. The starting main is `e5529da55d0808e6ef08a4c59a7d8338cc8ddd75`.

## Problem and resulting behavior

The placeholder picker previously labeled remaining choices by their position in the list. After replacing image 1, the original image 2 could be shown as image 1. It now retains the literal Word placeholder label, shows its article line and nearby text, and identifies repeated labels by occurrence. A separate read-only context shows the exact pinned location. Article edits invalidate that target. This does not certify that every matching text occurrence is an actual imported image; structural/code positions still use the existing guided-edit guards.

The optional placement-map panel explains the complete manual handoff: download the original-image ZIP before applying the Word import, extract and inspect its files, upload an image in the publishing tool, match its map entry against the original document and current article occurrence, then enter the uploaded public HTTPS URL. Original files may include metadata and areas hidden by Word cropping. No image is loaded or uploaded by the new controls.

An explicitly selected UTF-8 image-map.json, at most 512 KiB, is validated in full against the existing `drafttopage-word-images-v1` shape. Bounds, unique labels/files, PNG/JPEG filenames, per-file/total image budgets, declared dimensions, and bidirectional placement references are checked. Unknown fields, malformed encodings and inconsistent maps are rejected. These checks validate the map, not the underlying image content or its authenticity. A hand-edited map can still be syntactically valid.

Opening a map does not fill image details or change writing, approval or linked-image consent. A writer must choose a matching numbered map entry, pin a current placeholder, acknowledge comparison with the original document, and choose Use reviewed Word alternative text. Numbers alone do not prove provenance, especially for combined documents. Different pending alternative text or a decorative choice requires replacement confirmation. Missing files and empty alt text cannot be silently reused. Shortened Word text is labeled for review. No URL is generated from a filename, and no missing alt text is automatically decorative.

Changing the article, pinned location or map entry clears the comparison acknowledgement. Image details still require the existing exact replacement preview and checkpointed apply. Applying clears approval and linked-image consent. The map remains available between individual image edits. Clear placement map purges map data while retaining writing and pending details. Discard image preparation and whole-workspace replacement also purge it; generation checks prevent a cancelled file read from repopulating it.

Map text and pending preparation remain in tab memory and are excluded from backups, browser recovery, checkpoints, collections and exports. Only explicitly applied image Markdown becomes article text. The WordPress linked-image option remains a separate explicit choice. No original image is displayed, fetched, re-encoded, persisted, uploaded, or added to an ordinary article kit.

## Verification

Ten new model/controller checks cover original and duplicate labels, actual generated-package compatibility, shared-image filenames with distinct per-position alt text, inert Unicode, missing/shortened alt text, malformed/oversized/non-UTF-8 maps, unknown fields, inconsistent references, explicit comparison, stale targets, busy/cancelled reuse, map purging, and cancelled or failed reads. Existing guided-editor and image-recovery tests remain in the full suite.

A new Chromium journey imports a fictional three-image DOCX through the actual UI, downloads the image ZIP, independently reads it with Python ZIP tools and checks recovered bytes against the original document. It opens the actual downloaded map, reuses selected alt text only after comparison, verifies pending backup exclusion, retains the map across multiple checkpointed edits, observes unchanged original numbers, invalidates stale acknowledgement, and downloads three native Image blocks only after separate linked-image consent. It also checks duplicate labels/context, map clearing, invalid-map preservation, inert preview, no API calls and layout at 1440, 390 and 320 pixels.

The release PR records the exact complete-gate result, source hash, merge and native Cloudflare deployment outcome. This is local fixture evidence, not an actual Media Library upload, user study, physical-device test, screen-reader test or new destination save/reopen acceptance. The existing serializer is unchanged; earlier WordPress save/reopen evidence retains its documented scope. Direct public-site rendering remains independently unverified from this execution environment.

## Completed release evidence

Released in [PR #78](https://github.com/nolankido/drafttopage/pull/78), merged as `1bb5f625e31770f95180e1361f6546a50f6018fb`. The full stable-source gate passed 756 tests, 40 browser journeys, 265 layout checks, 15 document benchmark cases and eight fresh genuine local WordPress 7.1.3 Author-role save/reopen cases. Validated tree: `c2ce5d054dba55d3cbd1c2b9d4a97b43ccf74f81`. Source SHA-256: `0f010cc8068ab00c6c4602f051dc51538efdb3658ba30258d7e97738f0a2a4f4`.

Native Cloudflare preview build `5e186e98-491f-4af9-a99d-498dd9904dd5` and production build `3d962cfe-6892-450f-b168-e66e70bc9704` succeeded. Production version: `6305ba3c-83eb-4df0-8faf-c35c021bd23a`. No expanded user/device or independent public-rendering acceptance is inferred from deployment success.
