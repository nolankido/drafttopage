# Ten-writer public alpha study

Status: **prepared, NOT_RUN**. No participants have been recruited, contacted, observed, or counted. This kit is for the free public converters and writing workspace. The private AI pilot stays inactive and is outside this study. No paid service, provider key, tracking, signup form, or automated outreach is needed.

The next product question is whether writers can complete a useful conversion in their normal workflow without a developer beside them. Automated fixtures establish bounded implementation contracts. They do not establish usability, willingness to return, or demand.

## Cohort and setup

Use ten writers who already publish articles. Aim for five Word-to-WordPress users, three Google Docs-to-WordPress users, and two Markdown users. Record actual cohorts and any substitutions rather than forcing the desired mix. Include both frequent and occasional publishers, and at least two people using a narrow screen or mobile device if they are available. These are recruitment targets, not existing users.

Reserve 25 minutes for each session. A participant should use their usual browser and device. For WordPress tasks, have an existing disposable draft destination ready before timing; do not publish the article. People without a destination can test conversion/export, with WordPress acceptance marked NOT_RUN. The owner organizes participation separately. Do not activate the private pilot or create accounts, subscriptions, or hosted test services for this kit.

Use the same release for the cohort when practical. Record its main commit, date, browser family/version, device class, source cohort and chosen export. If a critical bug requires a new release, keep before/after cohorts distinct. Record setup time separately from product task time.

Start with the public fictional Word sample at [word-to-markdown.docx](https://drafttopage.com/samples/word-to-markdown.docx), the [matching Markdown](https://drafttopage.com/samples/word-to-markdown.md), or [the fictional study article](alpha/fictional-study-article.md). For a genuine Google Docs clipboard task, the participant prepares the fictional article in their own editor and copies a visibly formatted selection. A local HTML capture or synthetic paste must not be recorded as fresh Google Docs clipboard acceptance. Keep the original document available for comparison.

## Session agreement and records

Explain that this is an unfinished product, exporting does not publish, browser recovery is optional, and the participant can stop. Start with fictional material. Their own article is optional and should be non-sensitive, permitted to use, and kept on their device.

Use anonymous session IDs such as P01 through P10. Store completed records privately outside this public repository. Do not commit names, email addresses, site identities, raw drafts, browser recovery contents, or screenshots of private writing. The repository contains only blank templates and fictional fixtures. Ask before recording a session; recording is unnecessary for these tasks. Summaries should describe an interaction, not reproduce private article text.

Copy [session-record-template.json](alpha/session-record-template.json) into the owner's private notes for each session. Leave unobserved values null or NOT_RUN. Suggested task statuses are PASS_UNAIDED, PASS_ASSISTED, FAIL, DECLINED and NOT_RUN. A recovery privacy opt-out is a valid preference, not a failed conversion. Record assisted completion separately from unaided success.

## Tasks and observation rules

Read only the prompt column aloud. The observation column is for the facilitator. Avoid pointing to a control or naming the expected path before the participant acts. A procedural hint changes that task's result to assisted. After five minutes of unsuccessful work, offer help, keep the original failure/time record, and continue if the participant wants to. Do not interrupt to fix cosmetic issues.

| Task | Participant prompt | Observe and record |
| --- | --- | --- |
| T1: first conversion | Take this fictional article from your usual source into a form you could use for your next post. | Chosen entry route, input selection, preview/apply understanding, unaided completion, elapsed time and first blocker. Start at opening Draft to Page; end at a usable reviewed export. Do not include account setup. |
| T2: fidelity and limits | Compare the result with the original. What would you check or repair before using it? | Heading hierarchy, list starts/nesting, table headers, link targets, title handling, source ending, and whether notices are understood. Separate a real defect from a disclosed limitation. Do not treat absence of a warning as proof of fidelity. |
| T3: handoff | Put this result into an unpublished draft in your normal destination and make sure you can edit it. | Actual paste or file opening, duplicate/missing title, clipboard fallback, manual rebuilding and assistance. For WordPress, save, close, reopen and confirm native editable blocks without unexpected-content warnings. If no destination is available, mark this step NOT_RUN. |
| T4: revise and export again | Change one sentence and one heading, then take the updated version with you. | Whether the participant notices renewed review approval, finds the right copy/download, and distinguishes pending/current/earlier copy feedback. Inspect the actual second export. |
| T5: keep unfinished work | You need to stop now and return later. Keep the work in a way you are comfortable with. | Whether private backup and optional browser recovery are understood. Ask what is saved, where, and who can access it before testing return. In a suitable private/disposable browser profile, voluntarily enabled recovery can be tested with refresh, field comparison, restore and deletion. Record refusal or unavailable storage separately. |
| T6: return visit | Use the tool for a second permitted article when it would otherwise be useful to you. | Observe actual repeat use within 72 hours if available. Record the second task and outcome; an intention to return is not repeat use. This follow-up is organized by the owner, not automated by this kit. |

For copy denial, use the device's ordinary permission controls only if the participant is comfortable. A naturally occurring denial is enough to observe fallback. Do not simulate success or count the automated delayed-clipboard fixture as a participant result.

For T2, the facilitator can use the fictional article to check its headings, the numbered list starting at four, a nested item, a two-column table, a web link, and the final sentence. The example.test link is deliberately fictional and is not expected to resolve. A working link on the web is outside conversion fidelity. If a source editor changes the example's semantics, note the actual source used.

## Predeclared decision targets

These are provisional product targets, not measured results or industry benchmarks:

- At least eight of ten qualified writers complete T1 without procedural help, with a median time of five minutes or less. Report both completion count and individual times; do not hide failures behind a median.
- Every completed export retains the intended article ending. Zero unrecoverable loss of current or saved writing is tolerated.
- At least eight of ten can explain the separate title, review approval and manual publishing step after trying the workflow. Report each concept separately.
- All actually attempted WordPress save/reopen tasks preserve editable supported blocks. Report the attempted denominator and destination setup. Do not count NOT_RUN cases as passes.
- At least five of ten return for a second useful article within 72 hours. If follow-up is not observed, repeat-use evidence remains NOT_RUN rather than inferred from survey answers.

Ten sessions give directional evidence, not a population estimate or product-market-fit proof. Keep the cohort and exceptions visible. A participant's choice to download instead of copy can be a successful handoff; count the outcome and the friction separately.

## Triage and next release

Stop expansion and reproduce any lost writing, private material in an article export, unintended persistence, publication, or unexpected external request using a fictional fixture. Fix and revalidate before more sessions. Preserve the participant's own material privately; do not request it for a public bug report.

Group other issues by observed failure: cannot begin, cannot understand preview, incorrect conversion, cannot finish handoff, or cannot resume safely. For each, record session IDs, task, affected source/destination, frequency, assistance needed and a minimal fictional reproduction. Prioritize repeated task blockers before adding features. Distinguish parser defects from confusing instructions and unmet formatting expectations.

After the cohort, write one private evidence table with denominators, task outcomes, times, fidelity issues, recovery choices and actual repeat use. Publish only consented, non-identifying aggregate findings if desired. Until sessions occur, the honest result is **study ready; real-user acceptance NOT_RUN**.
