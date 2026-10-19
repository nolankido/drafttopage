# Export and WordPress verifier qualification, October 19, 2026

## Scope

This is executed synthetic verifier evidence, not a WordPress session, source-application capture, customer result or alpha qualification. No production application feature changed in this correction. Existing pull requests #162 and #163 remain subject to exact-head build and review gates.

The baseline is PR #162 commit `97a038c2611eebd193d85776032a07178e04e5ee`, with `scripts/document_benchmark.py` blob `098f812d0076d4b16eb5866ddc689f60e9ec3823`. The WordPress runner baseline is PR #163 commit `7eca191aacd5b648c9c04289bf5170bcc6020ca8`, runner blob `1f8ca74838a90a882ac73063a9cb1dafe16c334f`. Fetched source subsets were reconstructed locally and their exact Git blob hashes checked before editing. This was not a complete repository checkout.

## Executed results

| Run | Valid controls accepted | Damaged controls rejected | Result |
| --- | ---: | ---: | --- |
| Previous unmodified negative-control suite | 12 / 12 | 26 / 26 | PASS |
| Expanded suite against byte-identical previous verifier | 19 / 19 | 26 / 64 | FAIL: 38 damaged variants accepted |
| Same expanded suite against corrected verifier | 19 / 19 | 64 / 64 | PASS |
| New WordPress structural verifier-only suite | 5 / 5 | 27 / 27 | PASS |

The 38 cases are deliberately varied test corruptions, not 38 independently observed user defects. Positive controls include implicit and explicit numbering, enabled header forms, unit spans, canonical relative/absolute local numbering targets, and explicit Internal relationship mode. Negative controls alter one structure or package field while retaining the article text wherever possible.

The corrected export checker refuses reversed/non-decimal HTML lists, list-item value overrides, merged HTML or Word cells, missing/wrong/external numbering relationships, missing/wrong package content types, and absent/constant/wrong Word numbering marker templates. The positive Word controls now contain a correctly linked six-part package rather than unattached document and numbering XML.

The new WordPress contract separately checks that compound lists remain ordered, treats absent start as 1 only for an ordered list, and checks exact heading text and grouped table header cells in both raw and rendered post content. The real local runner calls these checks on initial save and reopen. Tests simulate those data structures; no WordPress editor, server, REST save or database was run.

## Reproduce the focused checks

From the repository root with Node and Python already installed:

```sh
python3 tests/document_fidelity_negative.py
python3 tests/wordpress_compound_negative.py
node --test tests/document-fidelity-negative.test.js tests/wordpress-compound-negative.test.js
```

The two Node test wrappers passed locally. Python syntax compilation of the edited checker, WordPress runner, contract module and test scripts also passed. Runtime: Node v22.16.0, Python 3.13.5. The WordPress wrapper belongs to PR #163; before its integration, run only the export wrapper on PR #162.

## Tested source identities

| File | Git blob |
| --- | --- |
| scripts/document_benchmark.py | ad551c9a4ddbb078f7416ba3ac12d9a06e7e41ba |
| tests/document_fidelity_negative.py | 9a9846004f0887f34ae61866fe9826a3380666fe |
| tests/document-fidelity-negative.test.js | c46bfd624980a523a92c91478c8960f5b929e3f6 |
| scripts/wordpress_roundtrip.py | 69e2302a0ae0eab84c26d601955763978b85ce63 |
| scripts/wordpress_compound_contract.py | 2284083167bb04da792133249564cc6c6318c53f |
| tests/wordpress_compound_negative.py | f99c54d3c5bafee548087f008dba6463fb011398 |
| tests/wordpress-compound-negative.test.js | 3800b1ec8cc23d5c81cf06b0378882bb9c33f88d |

## Outstanding release evidence

A focused passing subset is not `npm test` for a complete checkout. Native Cloudflare Node/static results and final independent review must match each committed candidate. Full routed browser/document corpus, isolated WordPress Playground save/reopen, fresh Word/Google Docs application captures, hosted WordPress, physical devices and human comparisons remain NOT_RUN by this work. No GitHub Actions, paid services, tracking, accounts, credentials, outreach or automatic publishing were added.
