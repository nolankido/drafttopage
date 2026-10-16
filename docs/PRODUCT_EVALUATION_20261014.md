# Draft to Page product evaluation

Date: October 14, 2026. Starting production commit: `514be7bcf300adea3563e756588299dbc79f1694`, after stopping GitHub Actions in PR #11.

## Scope and evidence

This is a product and source evaluation, with local validation and direct public-site interaction. It covers the public writing desk, examples/templates, imports, review tools, exports, private-pilot backend, privacy/security boundaries, accessibility, performance, build/deployment, and documentation. It is not an independent penetration test, an assistive-technology certification, a field-performance study, a conversion study, or a real-provider quality evaluation.

The starting application passed 143 local Node tests. Source checks cover generated pages, links, accessible references, routing, local dependencies, and storage/logging restrictions. The live writing desk loaded and applied formatting locally. The live `/pilot` page explicitly reported that the pilot was not activated. No password, provider credential, private writing, or paid AI request was used.

Scores are reasoned judgments on a 0 to 10 scale: 0 is absent, 5 is usable with substantial gaps, and 10 would require strong evidence of a complete production experience. They are not analytics or measured user-satisfaction scores.

## Full evaluation before this improvement

| Area | Score | Evidence and remaining gap |
| --- | ---: | --- |
| Revision recovery and comparison | **2** | Manual private backups preserve a single workspace. There is no in-tab version history, comparison, or recovery after programmatic replacements. Confirmation dialogs prevent some mistakes but cannot recover an accepted import or formatting change. |
| AI launch readiness | **2** | The source implements guarded generation, but the live pilot is not activated. Runtime configuration, spending controls, genuine provider behavior, quality review, and owner acceptance remain unverified. |
| Public writing usefulness | 7 | Users can write from notes, prepare a brief, import, review, and export without an account. The manual workflow is usable now. It cannot itself turn notes into an AI draft in the public desk. |
| Editing and import usability | 7 | Preview before replacement, strict Markdown/JSON bounds, field errors, focus mode, and formatting tools reduce friction. The editor remains a basic Markdown textarea, and unusual Markdown/YAML is intentionally unsupported. |
| Source review and editorial confidence | 6 | Notes/questions stay beside the article; checks find unfinished patterns and expose exact passages. No factual verification, substantive revision comparison, or proof of source-to-claim fidelity is available. |
| Exports and publishing handoff | 8 | Body Markdown, complete page Markdown, safe reading HTML, formatted copying, and independently validated ZIPs cover common manual handoffs. Destination rendering and metadata still require review; there is no tested CMS integration. |
| Security and privacy boundaries | 8 | No persistent public writing storage or tracking; inert imported markup; bounded requests/exports; protected private routes; signed strict cookies; exact-origin checks; atomic shared quotas; provider errors fail closed. This is evidence from source/tests, not an independent production security audit. Shared pilot credentials remain a limited-access design. |
| Accessibility and mobile usability | 6 | Semantic labels, status messages, keyboard controls, visible errors, local asset checks, and existing desktop/narrow fixtures are present. A full screen-reader and real-mobile audit is still needed. The desk has many controls and expandable panels. |
| Performance and maintainability | 7 | Small local ES modules, bounded inputs, dependency-free public functionality, and a deterministic build keep the application understandable. No current real-user latency, load, or memory measurements justify a higher score. |
| Validation and release process | 7 | Broad local unit coverage, source guards, browser fixture code, and separate live verification support reviewable releases. GitHub Actions are intentionally stopped; validation now needs deliberate local/manual execution. Browser-tool availability can limit reproducibility. |
| Operations and support | 6 | The existing native Cloudflare Git deployment remains; unavailable/session/error states preserve useful fallback paths; public issues and help give support routes. There is no established multi-user pilot operation or real-provider incident evidence. |
| Product clarity and onboarding | 7 | Fictional examples, six templates, first-use help, field guidance, and explicit in-development status avoid invented results. The private pilot and manual desk still require users to understand two different capabilities. |

Revision recovery and AI launch readiness tie for the lowest score. Revision recovery is selected because it can protect existing users immediately within the authorized local-workspace model. Genuine AI activation requires private owner configuration and paid-provider acceptance work; it should not be implied by a source merge.

## Selected improvement

The public desk now retains validated writing-only checkpoints in tab memory, with an explicit Save checkpoint action and optional label. Applying an import, restoring a workspace, toolbar formatting, replacing an outline, suggesting a filename, and removing a review note capture the previous workspace before mutation. If the previous writing cannot be checkpointed, replacement is blocked rather than losing it. Empty work is skipped and consecutive identical snapshots deduplicate.

Users can select a checkpoint, see exactly which fields changed, and compare saved/current text for each source or article field and the review-note list. Restore requires confirmation, clears approval/export preferences, and retains the displaced version when it contains writing. This gives a recovery route back to either version without claiming native edit undo or inventing a merged article.

History is bounded to five checkpoints and 384 KiB of serialized writing. The oldest versions are evicted at the limits. Clear this writing desk purges all writing and checkpoints after confirmation, so cleared source material is not secretly retained in history. Exit warnings include checkpoints even when current fields have been emptied.

A separate private-content acknowledgement allows downloading one selected checkpoint in the unchanged version-1 workspace format. The file includes source and review notes, and excludes labels, history, approval, preferences, and sign-in fields. Public exports continue to contain the current article and omit private workspace fields.

Revision recovery is provisionally **6/10 after this change**: common in-tab replacement mistakes now have bounded recovery and field comparison. There is still no crash recovery, keystroke autosave, persistent history, cross-device sync, line-level merge, or guaranteed recovery after closing/refreshing/leaving. Explicit private backups remain necessary. AI launch readiness remains 2/10.

## Validation and publication

The release marker is `revision-recovery-20261014`. Validation and publication results are recorded in [the revision release note](REVISION_RECOVERY_RELEASE.md). GitHub Actions must remain off; the existing native Cloudflare publishing integration is separate.

## Next priorities

The later original twenty-item conversion roadmap is reconciled in [the October 16 status](ROADMAP_STATUS_20261016.md). Numbered follow-up engineering cycles are not evidence that every original user-research or demand gate has passed.

1. Complete the private owner activation checklist using fictional notes and genuine provider acceptance, with spending controls confirmed privately.
2. Run screen-reader and real-mobile usability sessions, especially navigation among notes, article, checkpoints, and exports.
3. Evaluate draft quality against a small explicit set of fictional source scenarios, checking uncertainty, unsupported claims, voice, and edits.
4. If persistent recovery becomes a product requirement, design it deliberately with owner approval and clear privacy behavior. Do not silently turn these memory-only checkpoints into browser or server autosave.
