# Observed local WordPress Media Library acceptance

**Observed October 16, 2026 HST (October 17 UTC).** This record supplements the [Media Library acceptance contract](WORDPRESS_MEDIA_LIBRARY_ACCEPTANCE_20261016.md). It describes an actual, completed, deliberately fictional **local** WordPress test, not a hosted WordPress customer installation.

## Result

| Requirement | Observed outcome |
| --- | --- |
| Pinned local WordPress version | **7.1.3** |
| WordPress Playground CLI | **3.1.58** |
| Python Playwright | **1.57.0** |
| Existing native clipboard, WordPress block, draft-save/reopen cases | **13 of 13 PASS** |
| Distinct recovered image uploads to the real local Media Library | **2, PASS** |
| WordPress Image blocks after native Visual paste, save and reopen | **3, PASS** |
| Repeated original image file and distinct per-placement alt text | **PASS** |
| Exact original Word image bytes and returned Media Library file bytes | **PASS** |
| Separate export approval and exclusion of private source/review fields | **PASS** |
| Source remained unchanged during the WordPress runner | **true** |
| Real author documents, hosted installations, physical devices | **NOT_RUN** |

The runner's report contains `result: PASS`, `mediaLibrary.result: PASS`, a `cases` array with 13 passing entries, `environment.wordpress: 7.1.3`, and `sourceUnchanged: true`. The temporary preview hook summarized that array as `completedCases: 13` and `totalCases: 13`; those summary fields are not fields emitted by the WordPress runner. The published diagnostic is limited to aggregate fictional-fixture outcomes, not the full raw WordPress report.

## What was actually executed

The existing `scripts/wordpress_roundtrip.py` ran on a short-lived WordPress Playground site, under its configured **Author** role with unfiltered HTML disabled and a disposable SQLite database. It first completed all thirteen retained clipboard/Visual-editor and Code-editor fallback cases. It then executed the new `scripts/wordpress_media_acceptance.py` scenario end to end.

The Media Library scenario generated a fictional Word document with two distinct embedded image files and three article image positions. It checked the original-image ZIP and placement map, uploaded each unique file **once** to the *real local WordPress REST media endpoint*, retrieved the served files to compare original bytes, applied the three reviewed image placements in Draft to Page, and moved approved blocks by a trusted native clipboard paste. It saved an unpublished post, closed and reopened it, and confirmed the editable Image blocks and contextual alternative text. A single PNG file is referenced in two positions with different alt text.

The local WordPress server used HTTP loopback. The browser test mapped its actual uploaded media bytes to a synthetic `https://wordpress-media.test` URL to satisfy Draft to Page's normal HTTPS-only image validation. It did not weaken the production policy or demonstrate HTTPS on a hosted WordPress site.

## Reproducible environment and evidence references

- Public repository source tested: `eb45d7a2fb4113fdd210fbb206675334c4a18d97`, with only an **unmerged temporary test build hook** added in the isolated branch. The runner verified no source changed during its test.
- Temporary validation branch test commit: `ab96a81a12c0276bb9440d67364e42315fd165d5`.
- [Successful Cloudflare preview build](https://dash.cloudflare.com/10751507dfad053ca2e7887d5bf082a7/workers/services/view/drafttopage/production/previews/validate-word-media-playground-20261016/builds/e2af96f8-9f50-4975-b49d-c4da4c58a571), completed 2026-10-17 05:36:29 UTC.
- The [original temporary preview diagnostic](https://7ded1305-drafttopage.nolankido.workers.dev/_dtp-wordpress-probe-20261016.html) preserved the synthetic-only aggregate result. Its WordPress command exited with code 0 after 263 seconds, and its separately extracted report summary recorded all 13 cases and the Media Library case as passing.
- A [later temporary diagnostic](https://07f4fdb3-drafttopage.nolankido.workers.dev/_dtp-wordpress-probe-20261016.html), at `2e813e0c2b80f12e66f2bcb6d6e59f9d9be32852`, reran the local WordPress acceptance in 415 seconds and passed the new source-bound receipt check. It also passed focused WordPress/receipt tests and static checks. That branch contained the initial receipt candidate plus an unmerged diagnostic hook, not the final corrected release source.

The temporary build hooks captured command outcomes without always failing the overall Cloudflare build when an inner command failed. Their green deployment status alone is not acceptance evidence. The results above come from the individual command exit codes and extracted WordPress summaries. A separate full Node-suite attempt timed out after 220 seconds and is not a passing Node-suite result; the final release PR records validation of its corrected source independently.

The [manual nonroot Linux reproduction instructions](WORDPRESS_PLAYGROUND_REPRODUCE_20261016.md) describe the same pinned tools and temporary dependency setup. No additional GitHub Actions or scheduled checks were enabled.

The isolated builder installed the exact npm CLI and Python Playwright versions, fetched its own browser binary, and unpacked ten standard Ubuntu Chromium runtime packages into `/tmp` without root privileges. This changed no production dependencies or OS image. The validation branch and diagnostics were **not merged**.

After running `npm run verify:wordpress` on a configured local computer, use `npm run verify:wordpress:receipt` to verify the full JSON report against the exact local Git commit, source snapshot and complete WordPress evidence. A stale, missing or incomplete report must fail; a passing Cloudflare build without a WordPress report is not sufficient.

## Unverified boundaries

This is a real **software execution** against an isolated WordPress 7.1.3 instance and artificial image source material. It does not show that current Word versions preserve all real documents, that any hosted WordPress configuration or Media Library plugins are compatible, that a physical phone or clipboard works, that a real author can complete the process unaided, or that the tool saves time. The ten-writer paired study, distribution/return-use observation and any monetization evidence remain **NOT_RUN**. No WordPress post was publicly published.
