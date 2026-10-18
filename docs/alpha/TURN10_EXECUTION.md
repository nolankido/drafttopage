# Turn 10: controlled human alpha execution

Status: **NOT_RUN**. Study tooling is ready, but this work has not contacted, recruited, observed, or counted any real participants. Turn 9 release readiness remains BLOCKED until real source-app, hosted WordPress, device, support and rollback evidence are reviewed. Merging these changes does not authorize outreach.

## Prepare empty slots, not participants

Run `npm run study:plan` from a trusted checkout with Node 22+ to print ten unassigned proposed slots: Word 5, Google Docs 3, Markdown 2. It balances method order 5 usual-first and 5 DraftToPage-first. Planning slots must never be treated as recruited people. If the real mix differs, record the actual cohort and method order rather than modifying history to fit quotas.

Run `npm run study:init -- /absolute/private-alpha/sessions` to create ten blank, private, non-overwriting records outside the checkout. This does not invite or contact anyone. The owner must separately choose the invited participants, private support contact method, recording consent, deletion policy, and session timing. No public signup form, tracking or automated outreach is introduced.

## Run the existing six neutral task prompts

Follow [the ten-writer study](../PUBLIC_ALPHA_STUDY_20261016.md). Start with fictional writing and consent, then use the participant's real source app and device. Keep article, images, credentials and site URLs on their own device. Record actual source, destination, elapsed time, help, outcome and first blocker. T1 is the reviewed export; the paired workflow includes destination editing, image cleanup, actual draft save and reopen. Counterbalance workflow order when practical and document actual learning effects.

Status values are PASS_UNAIDED, PASS_ASSISTED, FAIL, DECLINED, or NOT_RUN. Leave every unobserved task NOT_RUN; do not transform a failed unaided attempt into an unaided pass because a hint was supplied. For an actual return, T6 must involve voluntary distinct useful work and an observed delay. A second prompted fixture or claimed intention is not return evidence.

Use source_cohort as WORD, GOOGLE_DOCS or MARKDOWN if observed. Another source or missing value appears as OTHER_OR_UNRECORDED in aggregates. For privacy-safe triage, use optional `issue_categories` with unique codes START, PREVIEW, FIDELITY, HANDOFF, RECOVERY or OTHER. These codes count affected participants, not raw clicks. Freeform issue_summaries remain in the private record and never enter the aggregate.

## Expansion stop and bounded repair

If any observed human, including an unqualified participant, experiences unrecoverable writing loss, private material appearing in an article export, or a lost final paragraph, the summary says STOP_FOR_SAFETY. Unknown safety checks also hold expansion. Stop new invitations and reproduce only with fictional content. Do not request private writing in a public issue. Fix an actual reproducible defect on a feature branch, rerun gates, and keep before/after participants separated by exact commit.

Otherwise use `npm run study:report -- /absolute/private-alpha/sessions` to see the actual qualified source mix beside the 5/3/2 planning target, and the most frequent issue category by affected participant count. This helps choose which concrete observed defect to investigate first; the tag alone is not a bug proof. Mixed five-person release groups may not be pooled into a ten-person success claim.

Provisional goals remain at least 8/10 unaided first conversions, median unaided T1 time <=300 seconds, every attempted WordPress draft save/reopen editable, no writing/privacy/ending loss, and 5/10 observed voluntary distinct returns within 72 hours. These are goals, not measured outcomes. A ten-blank-record report must say NOT_RUN and zero human observations.

The owner determines whether to invite people after the blocked release and private support requirements are resolved. Do not create messages, invitations, automations or participant accounts merely to run this tooling.
