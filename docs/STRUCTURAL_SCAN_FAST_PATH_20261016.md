# Conservative structural scan fast path

Candidate: [PR #92](https://github.com/nolankido/drafttopage/pull/92), starting main `483e8b47f2406e619f5eea20687eaa2f61fe24f3`. Complete stable-source validation and native deployment outcomes are still pending and belong in the PR.

## Narrow optimization, unchanged semantics

The article structure reader previously built all preview passages merely to identify thematic separators and underlined headings before its own existing source scan. A fresh 31-insertion near-limit rich Markdown/closed-panel profile attributes 92 of 249 inclusive input-path sample hits to articleStructure, including 66 previewPassages hits. The selected starting synchronous median/p95/max is 8.6/14.6/15.8 ms; input-to-frame is 10.7/16.8/17.6. This is local diagnostic evidence, not user latency.

The reader first uses a cheap native regular-expression scan for a **superset** of eligible lines: up to three leading spaces, a marker, then only marker characters and horizontal whitespace. The same existing setextLevel/thematicBreak helpers remain authoritative for every possible candidate. It removes all carriage returns for eligibility, exactly as previewPassages does, without normalizing the original source or offsets. If none can match, the full preview scan cannot contribute any semantic entries this reader consumes and is skipped. The original structure scan still runs in full. If any line can match, including a candidate inside code, a list, a quotation or table, the entire original preview scan still runs. This deliberately conservative fallback owns container protection and ambiguity. There is no approximation, incremental parser, cache, asynchronous work, storage, new dependency, counting-rule or export change.

## Equivalence and work checks

All 29 focused structure/review/count-cache/diagnostic checks pass, including seven new tests. A test-only frozen copy of the starting articleStructure function retains its unconditional preview scan. Its function text was checked against pinned Git source exactly, changing only the function name. It continues to use the same unchanged preview parser and body bound, so tests isolate this fast path rather than silently substituting a second Markdown grammar.

Inspector-call checks prove no preview reading when no line is eligible and exactly one full reading when a candidate exists, even in protected contexts. They cover spaces/tabs, repeated/mixed markers, literal escapes, internal/trailing CR, Unicode, fences and invalid/60,000-character inputs. A generated 2,700-case marker/container boundary set and 10,000 deterministic mixed-source editing states match every original returned block field. The latter also matches stateless and repeated cached word totals to the frozen-reader-derived oracle. Near-limit rich, distinct, single-paragraph and candidate/code cases retain exact source positions and values. Failed fallback reading cannot return partial structure.

A dedicated real-browser journey compares same-event word/UTF-16 counts, approval invalidation, ordinary/setext/separator/protected-code/table transitions, outline sizes, exact heading source selections and review word totals against that frozen starting reader. It checks current actual native block download and private-field exclusion plus narrow layouts. Its first preliminary run reached the final download assertion, which incorrectly assumed a table block had no attributes; the fixture was corrected to the actual existing hasFixedLayout serialization. That incomplete run is not an acceptance pass. The corrected focused journey passes on both guard revisions, including all three layouts. The complete stable-source gate is still pending.

## Measurements and limits

The optional local diagnostic now has `--semantic-candidate`, which prefixes one real underlined heading to the otherwise identical rich fixture. It forces the complete fallback, retains the sub-60,000 input bound, and is recorded explicitly. Original default fixtures remain byte-identical. Distinct blocks and ordinary writing remain separate controls. All accepted records must be sequential, source-stable and include runtime/request/approval guards. A preliminary distinct-block candidate record overlapping a local model run was discarded and repeated without that overlap.

Each table contains twelve accepted sequential records, 31 native insertions per record. Columns show median / p95 / max in milliseconds. Reverse-order pairs run candidate before baseline. Before assets are always `78cf296dbb549790b752631691878c59fbb981418b0f82e41d7f41af000d1ccc`.

### Initial guard, not released

The initial per-line-helper-only guard was rejected after repeated tail regressions. Its public SHA-256 is `bf5f2aa01d365e58a09e7ef1ec08283eb4607d6848833fc3df67bacf92c200e6`. These results remain recorded rather than being replaced by the revision.

| Fixture | Synchronous before | Synchronous initial | Input-to-frame before | Input-to-frame initial |
| --- | --- | --- | --- | --- |
| Rich, 58,833 characters | 8.6 / 14.6 / 15.8 | 5 / 8.4 / 13.5 | 10.7 / 16.8 / 17.6 | 6.6 / 10.7 / 16.3 |
| Distinct rich, 58,990 | 13.2 / 23.6 / 35.3 | 12.4 / 47.8 / 105.9 | 14.7 / 31.1 / 41.2 | 14.2 / 57.4 / 111.2 |
| Distinct rich, reverse repeat | 12.8 / 25.7 / 168 | 14.3 / 47.9 / 161.5 | 14.5 / 30.2 / 176.6 | 16.2 / 56.5 / 167.7 |
| Semantic fallback, 58,855 | 6.4 / 15.3 / 85.8 | 7.7 / 32.3 / 33.7 | 8.1 / 19.8 / 87.8 | 9.7 / 35.9 / 45.3 |
| Fallback, reverse repeat | 9.1 / 18.7 / 20.9 | 9.7 / 24.3 / 27.6 | 11.2 / 21.6 / 22.8 | 11.2 / 37.8 / 144.9 |
| Ordinary, 58,918 | 4 / 10 / 11.9 | 3.2 / 4.7 / 15.4 | 4.7 / 10.7 / 14.1 | 4.1 / 5.6 / 19.4 |

### Revised cheap-superset guard

The revision avoids per-line JavaScript/helper work when the native coarse scan proves no candidate. Public SHA-256: `c6fcdee63b99cf9159aca68ed5e674638aad13b3ccb5cf1de882c415d2736745`. Work-count assertions and frozen-reader equivalence still pass.

| Fixture | Synchronous before | Synchronous revised | Input-to-frame before | Input-to-frame revised |
| --- | --- | --- | --- | --- |
| Rich, 58,833 characters | 7.4 / 10.8 / 12 | 4.9 / 7.6 / 7.9 | 9 / 13.2 / 13.6 | 6.6 / 9.3 / 9.4 |
| Distinct rich, 58,990 | 15.1 / 30.5 / 51.6 | 8.3 / 11.7 / 11.9 | 16.8 / 34.3 / 59.3 | 10 / 14.2 / 14.5 |
| Semantic fallback, 58,855 | 7.8 / 15.3 / 15.5 | 7.3 / 17.6 / 18.3 | 10.3 / 17.6 / 18.8 | 9 / 20.8 / 21.1 |
| Fallback, reverse repeat | 8.4 / 12.9 / 13.6 | 8.7 / 22.8 / 24.3 | 10.2 / 15.1 / 15.2 | 10.5 / 25.4 / 25.8 |
| Ordinary, 58,918 | 3.5 / 5.4 / 5.8 | 3.7 / 7.8 / 8.2 | 4.2 / 6.1 / 6.7 | 4.6 / 9.7 / 37.8 |
| Ordinary, reverse repeat | 3.7 / 6.5 / 7.6 | 2.9 / 5.8 / 5.9 | 4.4 / 7.9 / 8.6 | 3.7 / 6.5 / 6.9 |

The revised rich/distinct samples improve, while fallback p95 worsens in both pairs and ordinary writing varies. The full fallback intentionally retains the old work and adds eligibility checking. The remaining fallback tail is a known limitation, not a claimed improvement. Inspector counts establish less logical work on no-candidate writing, not zero total parsing or universal latency. Short samples, different baseline values and host/GC/JIT effects do not establish causation for every outlier. Earlier 356.7/417.5 ms stalls, cycle 18's first distinct-block regression and broader active-panel variance remain unresolved. None of these local figures establishes INP, completed paint, universal speed, real-user success, physical-device/assistive acceptance, actual Word/Google Docs clipboard selection fidelity or independently verified public rendering.

No providers, charges, tracking, outreach, Actions, cron, storage, schema, serializer or hosting changes are introduced. Native Cloudflare Git deployment remains intact.
