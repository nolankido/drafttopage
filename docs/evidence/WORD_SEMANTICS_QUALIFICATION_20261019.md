# Word semantic verifier qualification, October 19, 2026

## Scope and source binding

This pass addresses the three outstanding PR #162 findings on commit `f1ac68f9d8d5c133ccd6f4ca4fbe35ae3482f5ee`: duplicate numbering identifiers, heading style definitions, and unintended supported inline marks. It changes release verification, not public application features. PR #163 was already independently reviewed with no findings at `ef5f755c966d0a66ff83622b06138bf517043f48`; it still depends on PR #162.

The local runtime could not resolve github.com for a complete clone. Instead, the exact original checker and existing failure-injection suite were reconstructed through the GitHub connector and checked against their Git blob identities before edits: `ad551c9a4ddbb078f7416ba3ac12d9a06e7e41ba` and `9a9846004f0887f34ae61866fe9826a3380666fe`. This is an executed source subset, not a full checkout.

## Executed evidence

| Run | Valid controls accepted | Damaged controls rejected | Result |
| --- | ---: | ---: | --- |
| Prior existing structural suite, unchanged | 19 / 19 | 64 / 64 | PASS |
| New semantic suite against original checker | 9 / 9 | 2 / 32 | FAIL |
| New semantic suite against corrected checker | 9 / 9 | 32 / 32 | PASS |
| Prior existing structural suite against corrected checker | 19 / 19 | 64 / 64 | PASS |

The 30 newly rejected variants are fabricated corruptions, not 30 observed customer defects. The new Node test wrapper passes locally. Python syntax compilation also passes. Runtime: Node v22.16.0, Python 3.13.5.

## Corrected contract

Numbering maps reject missing, invalid and duplicate numeric identifiers, including numeric aliases, before a dictionary could discard conflicting declarations. Style validation requires the local styles part, its unique content-type declaration and internal document relationship. Heading levels resolve from actual paragraph-style outline properties, inherited base styles and direct paragraph overrides. Missing styles, wrong types, cycles, duplicated definitions and contradictory outline properties are rejected. Names such as Heading2 alone are not accepted as proof of heading structure.

Compound contracts compare the complete supported explicit inline-mark map (strong, em, code). Omitted mark names mean absent, not unchecked. Expected marks are copied before augmentation, leaving authored oracle objects unchanged. This check does not claim arbitrary inherited visual styling or rendered-layout fidelity.

Valid controls include ordinary starts 1, 4 and 7, absolute local styles targets, explicit Internal mode, an inherited heading level, an explicit matching paragraph outline and disabled italic formatting. Damaged controls keep ordinary article text while corrupting package/style identity, introducing direct heading overrides, or adding italic/code marks to individual or all exports.

The outline semantics follow Microsoft Open XML documentation: outline levels 0 through 8 are structural levels, 9 is body text; basedOn supplies style inheritance. This is not a rendering assertion.

## Reproduce

```sh
python3 tests/document_fidelity_negative.py
python3 tests/word_semantics_negative.py
node --test tests/document-fidelity-negative.test.js tests/word-semantics-negative.test.js
```

The existing wrapper is available in the full repository; only the new wrapper was run in this reconstructed subset. No npm test, routed document corpus, WordPress save/reopen, live deployment, fresh Word/Docs authoring, physical device, screen reader or human comparison is certified by this file. Full release qualification remains a separate gate. No GitHub Actions, paid resources, accounts, API-provider activation, tracking or publishing were added.

## Tested Git blobs

| File | Git blob |
| --- | --- |
| scripts/document_benchmark.py | 4a98346a65496323f5dcbf2c80c9bfc7a92a23c1 |
| scripts/word_style_contract.py | 7dac3fa428093ea7c4eca60f85396c2c6d6ead64 |
| tests/word_semantics_negative.py | 1ca6460649113984783ad378ccfa734bd5c2e42d |
| tests/word-semantics-negative.test.js | 472f7a07b3251599a3bdb72dc213859ff36b5d38 |
