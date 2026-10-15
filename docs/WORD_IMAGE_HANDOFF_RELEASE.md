# Recover embedded Word images

Release: `word-image-handoff-20261015`.

Word imports previously discarded embedded pictures and left a generic omission message. This release numbers visible picture positions and offers an explicit local ZIP of supported PNG/JPEG originals, the converted article, Word alternative text, and a placement map for a manual WordPress handoff.

## Behavior

- Ordinary import still reads only the six bounded XML parts. It collects image relationship metadata without reading media bytes. Hidden runs, headers, footers, unreferenced media, linked resources, and embedded objects are not recovered.
- Prepare Word image files is a separate action in the conversion preview. The archive reader checks sizes and CRCs; recovery checks filename/content-type agreement, image signatures, structure, and dimensions without displaying or decoding pixels. It preserves original bytes and reuses a file for repeated references, while retaining each position's alternative text.
- Recovery maps at most 200 visible image/object positions and reads up to 40 unique files, each at most 4 MiB and together at most 12 MiB. Images over 40 million pixels or 20,000 pixels on either side are skipped. Unsupported, missing, damaged, or oversized files receive individual explanations; their article placeholders remain usable.
- The separate ZIP contains original image files, article-body.md, image-map.json, and README.txt. It requires its own acknowledgement and an explicit download. Original files may contain metadata and portions hidden by Word cropping. Crops, rotation, effects, captions, and document layout are not applied. Signature and archive checks do not certify image content.
- The package describes the selected import before later edits or article combinations. Download before applying. Discarding preparation keeps the article preview; applying or clearing the import removes prepared bytes. Preparation failures preserve current writing and the conversion preview.
- Instructions cover extracting the ZIP, uploading files to WordPress Media Library, reviewing alternative text, and replacing numbered placeholders. No automatic Image blocks, upload, account connection, or publishing is added. The existing guided image editor recognizes both numbered placeholders and the legacy generic placeholder.
- Existing article exports and private backup/checkpoint/collection/profile formats remain unchanged. They exclude recovered files and pending preparation. No network request, persistent storage, tracking, dependency, AI call, or GitHub Actions job is added.

## Validation

The local suite checks original PNG/JPEG bytes with Python's independent ZIP reader, archive corruption, unsupported and external references, hidden content, repeated positions, alternative text, file/dimension/aggregate limits, unchanged ZIP contracts, and guided placeholder compatibility. UI lifecycle checks cover explicit preparation/download acknowledgement, errors, discard, busy controls, stale results, and clearing on apply.

Run `npm test`, `npm run check`, and `git diff --check`. The shared responsive panel wraps filenames and actions at narrow widths. A live desktop browser pass and native Cloudflare Git deployment are verified separately from local source checks. A mobile-device browser pass is not claimed when its managed browser capability is unavailable. GitHub Actions remain off.
