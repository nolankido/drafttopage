# Original roadmap status

Checked October 16, 2026 against main `814bfa5d89ff13f50c4abc3aa80f21632335fab9` and the continuation candidate. The original twenty recommendations were recovered from the earlier project evaluation conversation. They are reproduced as concise scopes, not verbatim quotations. The later numbered cycles in [the overnight log](OVERNIGHT_IMPROVEMENTS_20261016.md) include additional engineering fixes and are not a completion checklist for the original recommendations.

“Implemented” below means bounded source functionality with the stated local evidence. It does not establish adoption, independent production rendering, current source-application compatibility or device acceptance. No recommendation requiring those outcomes is marked complete based on code alone.

| Original item | Current evidence | Remaining acceptance |
| --- | --- | --- |
| 1. Plain-text clipboard correctness | PR #69; [literal punctuation contract](PLAIN_CLIPBOARD_RELEASE.md) | Current application/device selections in item 8 |
| 2. Release baseline | PR #70; [manual stable-source gate](RELEASE_BASELINE_20261016.md) | Run on each release; Actions remain off |
| 3. Application-origin document benchmark | PR #71; [13 inputs, 15 contracts](DOCUMENT_BENCHMARK_20261016.md) | Extend with consented current full-length source-app captures |
| 4. WordPress round trips | PR #72 plus later additions; [real local save/reopen](WORDPRESS_ROUNDTRIP_20261016.md), extended to [twelve native Visual paste cases and a separate Code editor fallback](WORDPRESS_VISUAL_PASTE_20261016.md) | Actual hosted versions/plugins, physical-device clipboards, and current source-app handoff |
| 5. Simpler first conversion | PR #73; untitled first-conversion browser journey, followed by [reviewed import continuation to export](REVIEWED_IMPORT_CONTINUATION_20261016.md) with an edit-first alternative | Unassisted human completion |
| 6. Explicit opt-in recovery | PR #74; opt-in, lock, comparison, deletion and failure fixtures | Actual browser/device recovery sessions |
| 7. Copy and handoff feedback | PR #75; current/pending/stale/failure fixtures | Actual device permission and destination behavior |
| 8. Ten-person public alpha | [Kit and task cards](PUBLIC_ALPHA_STUDY_20261016.md) prepared | NOT_RUN. No recruitment, contact or response collection authorized |
| 9. Image reconciliation | PR #78; [number/context/map matching](WORD_IMAGE_RECONCILIATION_20261016.md) | Actual author image placement and upload acceptance |
| 10. Actionable conversion findings | PR #79; [exact source and tool shortcuts](ACTIONABLE_FORMATTING_20261016.md) | Whether people resolve their actual failures unaided |
| 11. Fidelity fixes | PR #81 strikethrough, existing [corpus contracts](DOCUMENT_BENCHMARK_20261016.md), and the [retained Google Docs checklist conversion](GOOGLE_DOCS_CHECKLISTS_20261016.md) | The checklist's explicit states and unambiguous nesting now have conversion coverage. Strict Word namespaces and other documented unsupported inputs remain; current source-application acceptance is still needed |
| 12. Accessibility and device acceptance | PR #82 focus fixes; keyboard, narrow-layout and native accessibility-tree checks; continuation [Enter release fix](RECOVERY_KEY_RELEASE_20261016.md) prevents a reproduced restore gesture from editing recovered text | Actual assistive technology and physical devices NOT_RUN |
| 13. Preview-linked editing | [Exact preview passages](PREVIEW_PASSAGES_RELEASE.md), [guided tables](GUIDED_TABLE_EDITOR_RELEASE.md), links/images, actionable shortcuts | Guided repairs exist within stated limits; common repairs without Markdown still need task acceptance. No full rich-text editor claim |
| 14. Repeat publishing | [Portable publishing profiles](PUBLISHING_PROFILES_RELEASE.md) and [draft collections](DRAFT_COLLECTIONS_RELEASE.md) | Observe a second distinct article with fewer setup actions; no measured convenience claim yet |
| 15. Performance and regression | Manual full gate; [recorded local editing diagnostics](LONG_ARTICLE_PERFORMANCE_20261016.md), follow-up fixes and a continuation [whole-article link guard](LINK_SCAN_FAST_PATH_20261016.md) | Active-control/long-article tails, cross-device and field latency remain unresolved; rejected variants and worsening measurements retained |
| 16. Product proof | Focused homepage and same-converter illustration already shipped; continuation adds complete fictional Word-file walkthrough and dated test-scope guide | Authentic customer outcome or time saving requires observations. Generated sample is labelled as such |
| 17. Search pages and measurement | Dedicated Word/Google Docs converters, unique metadata, canonical URLs and sitemap; continuation adds source-specific troubleshooting and evidence links | Search Console ownership/access and actual indexing/query results unverified. No analytics/tracking added |
| 18. Distribution experiment | [Bounded protocol](VALIDATION_AND_DEMAND_PROTOCOL_20261016.md) prepared | NOT_RUN. Channel selection, explicit messaging authorization and observed completed tasks required |
| 19. Four-week repeat use | [Return-use protocol](VALIDATION_AND_DEMAND_PROTOCOL_20261016.md) prepared | NOT_RUN. Four elapsed weeks and at least five voluntary second real articles required |
| 20. Paid workflow proposition | [Hypotheses and commitment protocol](VALIDATION_AND_DEMAND_PROTOCOL_20261016.md) prepared | NOT_RUN. Real commitments, price and feasible delivery evidence required before billing/integration |

## Finishable work and evidence gates

The continuation can improve reproducible product defects, source clarity and validation tooling without contacting anyone or spending money. It cannot manufacture the missing participant sessions, elapsed weeks, paid commitments, device inventory or private provider acceptance. The existing private AI activation checklist remains a separate owner-controlled gate; public conversion does not require provider activation.

Keep completed records and raw source-app captures outside this public repository unless they are deliberately fictional, licensed for public retention and separately reviewed. Do not add a tracking system to work around the measurement restriction. Do not convert a protocol, public guide or local test into a claim that its real-world acceptance gate passed.

Nolan subsequently granted standing authorization for routine validated merges and deployments in PR #98, as recorded in [AGENTS.md](../AGENTS.md). The [paired study runner](alpha/RUNNER.md) shipped in PR #99. Participant sessions remain NOT_RUN. Checklist source work continues from main `8509a62df078615c58ef855a9ee1ee89d7550f04`; its exact release outcome is recorded in its PR.

The [direct WordPress paste continuation](WORDPRESS_VISUAL_PASTE_20261016.md) follows checklist release PR #100, starting from main `f99004dafcefdb11114da7fc773b4a1630699a0b`. It makes ordinary Visual-editor paste the primary instructions, aligns the kit and help, and requires actual clipboard-to-saved-draft evidence for every retained WordPress case. The release PR records its exact tested source, merge, and native deployment outcome. This does not complete the unrun participant, hosted installation, or device gates.

A later [independent public browser observation](LIVE_SITE_CHECK_20261016.md) verifies the actual homepage and one fictional Markdown-to-WordPress sample path, including copy feedback and approval clearing after an edit. It does not cover unmerged candidates or prove source-app, destination or device acceptance. No Search Console report was available. The unrun research, distribution, four-week return and commitment gates remain unrun; replacing them with more features would not complete their original recommendations.
