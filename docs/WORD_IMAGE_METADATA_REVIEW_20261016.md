# Word image metadata privacy review

This release extends the existing local Word image placement package. The purpose is to reduce accidental sharing of original image files containing common metadata. It does not automate WordPress uploads, alter the original image bytes, or claim an image is privacy-safe.

## Behavior

When a writer explicitly selects **Prepare Word image files**, the existing bounded PNG/JPEG recovery reads selected embedded image bytes. It now also scans *headers and PNG chunk types only* for recognizable metadata indicators:

- PNG `eXIf`, `tEXt`, `zTXt`, and `iTXt`.
- JPEG APP1 (EXIF, XMP, or unidentified APP1), APP13 (possible IPTC/Photoshop), and COM segments before the first scan.

The scanner returns only fixed marker names. It never prints metadata values, resolves coordinates, decodes original images, accesses external URLs, or removes metadata. The source image remains identical in the downloaded ZIP. A marker can suggest metadata that **may** contain personal, location, camera, or creator information. It does not prove which values are present.

The package preview lists each affected filename and marker type. When at least one recovered image contains a recognized marker, the Download button additionally requires a **separate metadata acknowledgement**, in addition to the preexisting private-package acknowledgement. Changing or clearing the candidate resets both. The README within the ZIP includes the same static marker-only report and instructions to inspect or remove metadata before using the files elsewhere.

A missing marker is **not proof of metadata absence**. PNG and JPEG allow other metadata, private content within pixels, filenames, and unsupported segments. JPEG scanning stops at the first compressed scan. Inspect the original files with an appropriate offline image editor before sharing. If a marker cannot be inspected safely, that image is skipped rather than being silently included. Other recoverable images and the pending article remain available.

## Compatibility and privacy

The `drafttopage-word-images-v1` `image-map.json` schema, article placeholders, alt-text mapping, ZIP file names, layout/style losses, and original image bytes are unchanged. The metadata findings live only in the temporary prepared package model and the package README. They are not copied into a workspace backup, account, revision history, analytics, or publishing API. The original images are still unmodified, which means metadata is not stripped.

Only the explicit Word image recovery action reads image bytes. Ordinary Word import still reads supported article XML only. No AI activation, image proxy, external fetch, tracking, image decoder, new dependency, or backend service is introduced.

## Verification scope

Unit tests use intentionally fictional PNG/JPEG metadata chunks, validate marker-only reports without leaking values, verify unchanged image bytes and the old map parser, check malformed segments fail closed, and exercise the separate acknowledgement logic. Browser and mobile tests remain separate from the unit suite. This implementation does not establish real-device, author-image, or WordPress Media Library acceptance. The release PR records the actual checks, merge and Cloudflare outcome.
