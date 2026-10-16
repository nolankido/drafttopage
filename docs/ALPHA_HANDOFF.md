# Alpha handoff, October 16, 2026

**Decision: keep the alpha work awaiting review. Do not invite testers to an unreconciled branch or bulk-merge PR #47.** No release or main merge was performed by this alpha preparation work. Product usefulness, retention and willingness to pay remain hypotheses, not results.

## What is ready for review

PR #47 contains a guided existing-article path, conversion findings before approval, optional source editing, nearby WordPress copy feedback, stale-copy protection, deliberate backup inspection/restoration, opt-in browser recovery and an optional text-only destination comparison. Fictional regression journeys check import, checkpoint/recovery and actual exported ZIP/HTML/Word content. Literal clipboard punctuation and identifier fidelity have targeted checks. None of this establishes success with every real source, browser or destination.

The newer main line has substantial additional conversion, formatting, document, layout and release-validation work. Preserve it. PR #74 already adapts the alpha recovery model to that line, with an additional explicit saved/current comparison. Another worktree had clipboard implementation edits in progress during this check; it was not modified. The appropriate next step is narrow reviewed ports or acceptance of the existing focused PRs, not replacement of newer main with the old alpha UI.

Live status update: PR #74 was merged independently at **2026-10-16 09:37:18 UTC** as main commit `68523832af742a80df124608df33d3eb393f0cca`. This alpha pass did not merge it. Its tree is exactly `06cb9e5ab0a1b178236a127c2553eefd1b10ce08`, the recovery source independently checked below. Preserve that landed recovery implementation rather than porting it again. No deployed-runtime or combined-alpha acceptance is inferred from the external merge.

## Exact source checked in this pass

| Line | Pin | What this pass independently checked |
| --- | --- | --- |
| Starting alpha PR #47 | `5841adffa092644e0293967775494c1b481959f2`, tree `92464a54f68deee2e5dfd91a7634c1ee4bbc0054` | The new recovery portability checks and full alpha validation are committed as a follow-up on this branch; see readiness/PR for the resulting head |
| Main | `f63fd67df746db361d7acdcc02bdbec67b57ee4b`, tree `7563dc3aa1807c3bbd310098b1812ee992c7298d` | Merge-tree calculation only in this pass; do not reuse the earlier `d63b28c` full-suite count as a result for this newer main |
| Recovery PR #74 | `8390fe284e9141489f0a712870e09688fdea23ca`, tree `06cb9e5ab0a1b178236a127c2553eefd1b10ce08` | Independent 733-test Node suite, 29-page static checks, eight file/import/kit portability cases and six recovery-model portability cases |

PR #74 was checked in an isolated detached copy at local commit `16a77acdaa283e3607a95acb2a6da22cefc01c7b`, which has the exact same tree. Its tracked source remained unchanged. No other writer's worktree was used for builds or tests. The pins are dated observations; re-read current heads before review or release.

## New recovery compatibility evidence

The six new cases use the actual alpha and candidate recovery modules with controlled in-memory storage, origin-named locks, timers and supplied restore/checkpoint callbacks. They verify:

- Version-1 envelopes round-trip in both directions with exact private writing and Unicode. Approval, pending imports and export choices stay excluded; unknown versions/extra envelope fields are refused.
- Both models use the same recovery key and lock. An active writer prevents the other model from restoring, deleting or clearing its copy.
- A later model session does not restore or start saving on its own. After an explicit pause, cancellation preserves current writing and stored data; deliberate restoration checkpoints displaced writing and clears the harness approval.
- Deliberate removal leaves open writing intact and cannot be reversed by a later edit in either paused model session.
- A storage-full failure after a cross-version handoff preserves the last good stored copy and keeps the newest writing available in a valid private file backup.
- Changed open writing while the lock is pending refuses restoration, without a checkpoint or mutation.

Run from the alpha repository with Node >=22:

```sh
npm run test:alpha-recovery-portability
DRAFTTOPAGE_COMPAT_ROOT=/absolute/path/to/isolated-recovery-candidate npm run test:alpha-recovery-portability
```

The default command checks the alpha model against itself. Set the explicit path to a trusted pinned candidate to check both implementations. These are model contracts, not a new real-browser consent, full-close/reopen, storage-eviction or assistive-technology result. The UI consent/review buttons and each integration callback still need acceptance on the selected combined candidate.

## Integration is still a release blocker

Using the original common baseline `b4b9df2635abcd5f764abceab32a4adf7dd950d4`, new merge-tree calculations reported **26 conflict paths against pinned main** and **39 against the recovery candidate**. Exit status 1 was expected. No merge was applied. The earlier 23-path result in `ALPHA_INTEGRATION.md` describes an older main pin, not the current count.

After observing the independent merge, the calculation was repeated against main `6852383` and again reported **39 conflict paths**. The 26-path result applies to the earlier `f63fd67` main pin. PR #47 remains draft and unmerged.

| Workstream | Review decision |
| --- | --- |
| Browser recovery | Preserve the landed PR #74 adaptation and accept its exact consent/comparison/removal behavior on the chosen candidate. Do not introduce a second storage key, lock or competing UI from PR #47. Never turn recovery on by default. |
| Clipboard handoff | Let the active implementation finish. Then check all body/title/optional-field payloads, overlap locks, rejection, stale completion, approval reset and local feedback on the selected head. No completion or merge of that work is claimed here. |
| File restoration and document conversion | Retain main's newer saved/current comparisons, Word recovery, reference links and formatting support. Port only missing safeguards with tests. |
| Text-only WordPress comparison | Keep it optional. If ported, retain the independent text model and clearing/exclusion rules; evaluate whether it saves more effort than it adds. It does not certify formatting or saved-post success. |
| First-use and reading order | Reassess main's newer simplified entry path before porting an older homepage or navigation. Test the complete import, change notices, review and handoff sequence, not just isolated controls. |
| Regression corpus | Keep the independent expected text, private-marker exclusion and cross-version tests. Run them against the eventual combined head; a green donor branch is insufficient. |

## Evidence that must not be conflated

Earlier alpha desktop checks and two official Gutenberg demo renderings are historical observations on their documented pins. This pass did not repeat them. The previous 665-test main result is for `d63b28c`, not current main.

PR #74 reports a broader local release gate with browser/layout/document checks and eight genuine local WordPress Author draft save/reopen fixtures. This pass independently reran its Node/static and portability checks only. It did **not** rerun or independently attest that browser/WordPress evidence. Even a reproduced local WordPress fixture result would not establish hosted WordPress/plugin/theme compatibility, physical-device behavior or a real Word/Google Docs clipboard payload.

The alpha's full local suite now passes **591 tests**, with static checks for **27 HTML pages**. These counts are separate from the recovery candidate's 733-test/29-page results and do not establish a combined application pass. The native branch-preview build is a separate check recorded on the PR.

No real users were observed and no adoption, time-saving or revenue results were collected. No outreach, signup, tracking, provider request, paid service or credential was added. Native Cloudflare configuration is unchanged; GitHub Actions and cron remain absent from this work.

## Required acceptance record before invitations

Use one reviewed, immutable candidate URL/commit. Record each result privately with the browser/OS, actual Word/Docs source, WordPress version/theme/plugins and reproduction steps. Leave unrun checks marked **not run**, not passed. Use fictional writing for recovery/failure exercises.

| Gate | Required observation | Current status for a combined candidate |
| --- | --- | --- |
| Integration | Focused changes coexist without stale status, duplicated controls or silent field replacement; full local gate and preview build on the exact head | Not established |
| Real source import | Actual Word-saved article and Google Docs selection retain complete text and supported structure; every omission/change is disclosed | Not established |
| Native clipboard | Body, separate title and optional fields paste exact Unicode/text into intended fields; edits invalidate approval and old feedback | Not established |
| Destination persistence | Review actual target WordPress blocks, images, code and optional fields; save a draft, close/reopen it, edit and reopen again | Not established for the target users' setup |
| Recovery and privacy | Consent off initially; explicit comparison/restore; actual full close/reopen; two-tab exclusion; pause, blocked storage, removal and no resurrection | Not established on the combined candidate and intended devices |
| Access and layout | Physical narrow/mobile view, keyboard-only use and screen-reader announcements/focus remain usable through the entire task | Not established |
| User value | Compare total publishing effort including cleanup and saved/reopened preview; record assistance, failures and voluntary second use | No real-user results |

Before an invitation, the owner also needs an agreed private support route. Do not place private writing or participant records in this public repository. The proposed 5 to 10 writer cohort and 8-of-10 unassisted threshold in `ALPHA_READINESS.md` remain proposed learning gates, not measured outcomes. Registration, monetization and public promotion remain separate later decisions.
