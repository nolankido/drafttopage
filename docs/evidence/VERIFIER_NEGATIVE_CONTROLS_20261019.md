# Export-verifier failure injection

Date: October 19, 2026

## Source and reproduction

The full `scripts/document_benchmark.py` file was retrieved from candidate commit `105316bbebe4461e1452fcdf36c6a7e17b88963e` and copied to the local test environment. Its Git blob SHA was independently recomputed as `23bf450b3c716f850c151e0e0e5ca0aa018af930`, identical to GitHub. This was a scoped source extraction, not a complete Git checkout or a full release run.

The independent checker accepted a Word header row when `w:tblHeader` was present but explicitly disabled (`0`, `false`, `off`). It also accepted an invalid value and duplicate conflicting header flags. The code inspected presence rather than the boolean value. These five damaged cases falsely passed even though their expected header semantics were absent or invalid.

## Corrective scope

The Word table checker now rejects duplicate header declarations and unrecognized values. It respects explicit on/off values rather than treating presence alone as true. The ordinary enabled forms, including an omitted `w:val`, remain supported. There is no public converter, pricing, publishing, or UI feature change in this correction.

`tests/document_fidelity_negative.py` supplies independently authored fictional HTML and Word XML specimens, not product-generated expected outputs. It checks list starts, heading level/style, grouped tables, header-cell loss, missing endings, invalid list references, and disabled/invalid/duplicate Word header flags. A Node test wrapper makes the checks part of the existing `tests/*.test.js` suite without adding dependencies or GitHub Actions.

## Executed local results

Environment: Node 22.16.0 and Python 3.13.5.

- Before correction: 12 valid controls accepted, 21 of 26 damaged controls rejected, five damaged header variants incorrectly accepted.
- After correction: all 12 valid controls accepted and all 26 damaged controls rejected.
- `node --test tests/document-fidelity-negative.test.js`: PASS.
- Corrected checker blob: `098f812d0076d4b16eb5866ddc689f60e9ec3823`.

To reproduce on the candidate source:

    python3 tests/document_fidelity_negative.py
    node --test tests/document-fidelity-negative.test.js

## Boundaries

These are tests of the export verifier, not a live browser or WordPress save/reopen test. The local environment had Chromium and Playwright but could not reach GitHub or the deployed site, so no full checkout or hosted browser journey was run. Actual Word/Google Docs source sessions, the 44-case routed browser corpus, full WordPress acceptance, physical-device and human alpha gates remain unqualified by these results. Fresh exact-head build and independent review are still required before production merge. No new service, paid API, tracking, account connection, outreach, or automatic publishing was enabled.
