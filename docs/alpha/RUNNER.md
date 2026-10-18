# Run and summarize the public alpha locally

Before recruiting or recording an actual session, use the [current release record](RELEASE_20261017.md) and [manual release gates](RELEASE_OPERATIONS.md). The alpha invitation gate remains BLOCKED without its real-device, destination, source-app and support evidence.

Status: tooling implemented; human sessions **NOT_RUN**. Running these commands creates blank records or summarizes supplied records. It does not recruit participants, verify that sessions happened, measure live visitors, or establish product demand. No browser tracking, public form, provider or external service is involved.

## 0. Inspect unassigned slots

Run `npm run study:plan` to view the ten UNASSIGNED planning targets (5 Word, 3 Google Docs, 2 Markdown; 5/5 paired workflow order). These are not participants. See [Turn 10 execution guidance](TURN10_EXECUTION.md) before recruitment or actual observations. The owner must authorize private support and outreach separately.

## 1. Create the private records

From a trusted Draft to Page checkout with Node 22 or newer, choose an absolute directory outside the checkout:

```sh
npm run study:init -- /absolute/private-study/sessions
```

The command creates P01.json through P10.json with null observations and NOT_RUN tasks. It never overwrites a session file. Newly created directories use owner-only permissions and files use mode 0600 on systems supporting POSIX modes. Check the actual device's access permissions. Do not put participant records, captured writing, or reports in this public repository. Directory checks resolve symlinks; input files must be regular JSON files no larger than 64 KiB. Initialization and reporting reject directories inside the checkout.

Keep raw records and recordings private according to the participant agreement and deletion date. Anonymous session IDs alone do not make a small-cohort report safe to publish. No automatic upload or publication is provided.

## 2. Observe the existing task cards

Use the [ten-writer study](../PUBLIC_ALPHA_STUDY_20261016.md), including its eligibility, neutral prompts, source-app distinctions, manual handoff and safety rules. Obtain permission to retain task outcomes before recording them. Use fictional writing first. Genuine participant writing stays on their device.

Use version 2 records. Set status to OBSERVED and evidence_type to HUMAN_OBSERVATION only after an actual human session. Set participant_qualified from the actual publishing workflow, consent_to_record_outcomes from the agreement, release_commit to the full tested commit, and session_date to the actual calendar date. Record publishing frequency when known. Do not guess a missing observation or backdate a session.

Every attempted task needs a nonnegative elapsed_seconds and an integer procedural_hints count. PASS_UNAIDED requires zero hints; PASS_ASSISTED requires at least one. Use FAIL for an unsuccessful attempt, DECLINED for a refused task and NOT_RUN for an unobserved task. Missing values stay null. A source problem or declined recovery choice is recorded in context rather than turned into a successful conversion.

Mark synthetic debugging records SYNTHETIC. The summary excludes them from human evidence even if their task results say PASS_UNAIDED. Observed version 1 records are reported as excluded_legacy because they do not establish consent, qualification and human evidence type. Review the original private session record and deliberately transcribe those fields into version 2 only when supported. Never infer them from a passing task.

## 3. Compare the complete workflows

The paired comparison has a different boundary from T1. T1 ends at a reviewed usable export. Each paired measurement starts with the article ready in its source application and ends with a reviewed, saved and reopened unpublished draft in the same destination. Include image handling, formatting cleanup, retries and repairs. Keep account setup outside the timed boundary and record setup time separately.

Ask the participant to use their ordinary publishing method for usual_workflow and Draft to Page for drafttopage. Use the same source article and destination. Alternate method order across participants where practical and record the actual order as USUAL_FIRST or DRAFTTOPAGE_FIRST. Keep practice, interruptions and mismatched tasks in the private task notes. Repeating the same article creates learning effects; counterbalancing reduces that concern but does not eliminate it.

Record each method's actual status, time and hints. Set same_source_and_destination and includes_image_and_cleanup_work only after checking their scope. A missing order, unmatched work, an unsuccessful method or procedural help excludes the pair from the unaided time-saving summary. Its exclusion count stays visible. Zero baseline duration produces no percentage rather than division by zero. Negative savings remain negative.

## 4. Observe a genuine return

A repeat-use success needs a completed T6, an observed second article, a voluntary return, distinct real work, and a measured delay from first use. Set second_article_voluntary and second_article_is_distinct_real_work explicitly. A repeat fixture, invitation to perform another test, intention to return, researcher-completed task, or failed second task cannot establish this outcome.

The summary reports completed returns within 72 hours and within 672 hours (four weeks) separately. A missing follow-up remains unverified; known prompted, fictional or failed returns are counted separately. Leave actual_second_article_observed null until follow-up is observed, and record false for a confirmed non-return after the relevant follow-up window. Do not schedule contact, send reminders, add tracking or create participant accounts through this runner.

## 5. Review the aggregate report

```sh
npm run study:report -- /absolute/private-study/sessions
```

For machine-readable JSON without npm's command banner, use Node directly. If retaining a report, keep it outside the sessions directory so a later report does not mistake it for a session:

```sh
node scripts/alpha-study.mjs report /absolute/private-study/sessions > /absolute/private-study/summary.json
```

The output omits participant IDs, free-text notes, issue descriptions, browser details and source content. New aggregates show normalized source cohorts and predefined issue categories only. The expansion decision blocks on safety incidents from any human observation, even an unqualified participant. It preserves task outcome counts, observed times, incomplete comparisons, unknown checks and per-release denominators. Different releases are never pooled to reach a passing target. Duplicate IDs and inconsistent records fail with a nonzero exit code; errors do not echo raw input.

A fresh ten-record study reports NOT_RUN, zero human observations and no time-saving result. A successful command means valid record processing, not a passed usability study. Targets stay PENDING for cohorts smaller than ten. The first-conversion target requires at least 80 percent unaided completion and an unaided completion median of at most five minutes. Failed and assisted task counts and all attempted times remain visible alongside that median. Larger cohorts use their larger denominator.

Any recorded writing loss, private material exported, lost article ending, unintended persistence, unintended publication or unexpected external request is a blocker. Version-2 records that predate the latter three safety flags remain readable, but missing observations count as unverified and hold expansion, not as false. Safety incidents from unqualified human participants still appear in the top-level incident totals. An absence of recorded incidents is not a security certification. WordPress acceptance covers only actually attempted save/reopen tasks; missing destination checks are NOT_RUN or PENDING. Comprehension and voluntary-return targets use the original cohort denominator, not just successful follow-ups.

Do not use this small convenience cohort as a population estimate, a willingness-to-pay result or proof of product-market fit. It helps choose the next reproducible product improvement. The owner must still arrange and observe actual sessions before this study can be reported as run.

## Turn 11 reviewed safety conditions

Record unintended_persistence, unintended_publication and unexpected_external_request as true, false or null along with writing loss, private export and missing ending. Each must be based on a direct observed outcome, not inferred from an issue category. A confirmed incident stops invitations. An older private record missing any new field is still readable but its safety evaluation holds until genuinely supported evidence can be transcribed. See [the Turn 11 remediation](TURN11_SAFETY_REMEDIATION.md).
