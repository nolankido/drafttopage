# Local WordPress Media Library image acceptance

This release adds a **separate end-to-end acceptance case** to the existing, explicitly invoked local WordPress Playground test. It tests the highest-risk gap after the sequential Word image selection work: real WordPress Media Library attachment creation, followed by an editable Image-block article that saves and reopens without publishing.

## Source and destination

The source is a **fictional, deterministic DOCX** generated from the existing licensed-independent test helpers. It has one ordinary paragraph and three image occurrences: two different embedded PNG/JPEG files, with the PNG reused in positions 1 and 3. The two occurrences of that PNG have distinct Word alternative text. This is **not** a current Word version, a real author's draft, or a hosted WordPress test.

The destination is the disposable WordPress 7.1.3, PHP 8.3, SQLite Playground site already used by `scripts/wordpress_roundtrip.py`. The test asserts the fixture marker, Author role with unfiltered HTML disabled, loopback URL and unpublished draft status. It never connects to a public WordPress account.

## Tested path when the optional local WordPress gate runs

1. Choose the fictional DOCX through Draft to Page's **real file input**, preview the converted article, prepare and download its original-image ZIP. Independently read its archive, assert two byte-identical recovered image files and verify the unchanged `drafttopage-word-images-v1` placement map, including the reused file and per-position alt text.
2. From a logged-in local WordPress editor page, upload each distinct recovered image exactly **once** through the actual WordPress REST Media Library endpoint. Require HTTP 201, a unique WordPress attachment ID, matching MIME, a loopback source URL and a subsequent GET returning the exact original bytes.
3. Confirm the reviewed article import into Draft to Page. Load the extracted map through the real local map input. For each of three placeholders, select **Find next matching Word image**, explicitly compare the pinned map entry, request Word alt text, provide the already-uploaded image's address, preview, and apply the exact replacement. Require the approval and linked-image consent to reset after each apply.
4. Explicitly select linked Image blocks, review export, download blocks, and copy through the actual Copy button. Require exact clipboard/export agreement and no leaked private notes or unreplaced Word image placeholders.
5. Paste through a **trusted native Visual-editor paste event** into an empty WordPress draft, use its normal Save control, then close and reopen the post. Require valid native Image blocks, exact URLs and distinct contextual alt text in order, the same uploaded attachment referenced in positions 1 and 3, actual rendered images, and an unpublished status.

The runner records separate `mediaLibrary` evidence in `test-results/wordpress-results.json`. `validateWordPressEvidence` now requires that evidence in addition to all **13 existing clipboard and save/reopen cases**. Negative tests intentionally corrupt upload status, file bytes, IDs, URL origin, alt text, image mapping, native paste, privacy, and reopen status, and require the validator to reject them.

## Local HTTPS boundary

Draft to Page intentionally allows only HTTPS image URLs. The isolated local WordPress Playground server serves HTTP on `127.0.0.1`. The test therefore maps its **actual uploaded media files** to an invented `https://wordpress-media.test` test-only origin using Playwright's request routing. Only URLs mapped to successful GETs from the marked local WordPress instance are served. This does not weaken the product's HTTPS validation or prove hosted WordPress HTTPS acceptance. The alias is never published publicly; it exists only in a disposable local fixture draft.

## Reproducibility

The full, already existing locally controlled WordPress gate is invoked by the release runner only when `DRAFTTOPAGE_WORDPRESS_CLI` points to a separately installed, pinned `@wp-playground/cli` executable. The test never installs a provider, starts GitHub Actions, reaches a production website, or schedules a task. WordPress image uploads, their saved draft and the disposable site are destroyed when the test process stops.

Run:

```sh
DRAFTTOPAGE_WORDPRESS_CLI=/path/to/installed/@wp-playground/cli/cli.js \
  npm run verify:release
```

The release checks perform the build, Node tests, static checks, browser suite and local WordPress test when correctly configured. A full passing result must be recorded using the **same stable source revision**. When WordPress Playground or the browser runtime is not available, report the Media Library acceptance as **NOT_RUN**. Passing Node fixture/validator tests or a Cloudflare build is not a substitute.

## Limits

This tests two **fictional files**, three placements, one local WordPress version and the manual handoff UI. It is not an image privacy audit, an image optimization or transcoding benchmark, a physical clipboard-device test, real-author article acceptance, an unassisted ten-writer study or production WordPress plugin/theme compatibility. No claim of time saved, repeat usage or monetization follows from the fixture.

## Executed local fixture acceptance

The [October 16 observed local acceptance record](WORDPRESS_MEDIA_ACCEPTANCE_OBSERVED_20261016.md) supersedes the earlier **NOT_RUN** status for **this exact synthetic WordPress 7.1.3 Media Library fixture only**. All 13 retained cases and the separate two-upload, three-placement Media Library case completed with PASS. Real-author, hosted and physical-device checks remain NOT_RUN. To validate a fresh local receipt against the current Git revision, run `npm run verify:wordpress:receipt` after the optional local WordPress test.
