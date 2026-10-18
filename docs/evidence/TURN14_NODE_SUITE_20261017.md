# Turn 14: complete Node regression execution and native deployment gate

Status: the temporary feature-preview probe executed all 91 repository Node test files on Node v24.21.0. The first run found **1,073 passes and 17 failures across 1,090 tests**. After repairing the failing code/fixtures and two further diagnostic iterations, the source-equivalent probe at `a5ea0de658787bf9fd78cd7b5af938999e28add2` returned **1,090 passed, 0 failed, 0 cancelled and 0 skipped** in approximately 43 seconds. The bounded TAP output checksum was `15dc675cb278af922e67e0839ec23c6f7eefb74c5e787874397d4f3e06729af7` (a fingerprint of diagnostic stdout, not a cryptographic Cloudflare deployment attestation).

## Reproducible fixes

- The HTML importer now preserves inherited bold on paragraphs and headings explicitly declaring `font-weight:inherit`, and still honors `font-weight:normal` overrides.
- Nine legacy WordPress handoff/export tests were aligned with the actual seven-step optional destination checklist rather than constructing incomplete DOM fixtures.
- Word image-handling tests require explicit choice and, for the ZIP route, separately confirmed saved file, preserving the import gate instead of weakening it.
- The pending-copy keyboard focus test now expects the approved read-only fallback after clipboard denial instead of the old copy-button focus behavior.
- Sitemap and repeat-build tests compare against actual publicPage count rather than the obsolete 25-page count.
- Synthetic release test records now use real Git-bound source SHA and absolute fixture paths.

## Enforcement for future Cloudflare builds

The native Wrangler build command in this release runs these stages in sequence: build public pages; all Node tests (`node --test --test-concurrency=4 tests/*.test.js`); static/security-source checks (`node scripts/check.mjs`). A nonzero exit stops the native Cloudflare deployment. No GitHub Actions are used or introduced. This improves regression protection for future PR previews and production changes, but it does not replace the manually invoked browser or WordPress verification.

## Evidence boundaries

- The 1,090 passing tests were observed in a temporary Cloudflare feature preview on the complete source, not in the assistant's local container. The final clean branch must separately pass its exact Cloudflare preview build before merge.
- The temporary diagnostic probe file and its altered diagnostic-only build command are **excluded** from the clean merge. The original production deployment remains unchanged until PR validation and merge.
- Full Playwright routed-browser checks, pinned WordPress Playground/Media Library save-reopen, real Word and Google Docs app captures, hosted WordPress drafts, physical devices and consenting participant sessions remain **NOT_RUN** in this turn. Those are separate alpha gates.
- No private user documents, account credentials, tracking, external providers, paid services or GitHub Actions were added. The build emits no public diagnostic report by default.
