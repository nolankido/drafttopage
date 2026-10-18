# Turn 3: fair comparison with the free native WordPress workflow

**Status: INSTRUMENT PREPARED, HUMAN COMPARISON NOT_RUN.** This is a companion to the existing [ten-writer alpha study](../PUBLIC_ALPHA_STUDY_20261016.md) and [local study runner](RUNNER.md). It is not a record of participants, completed sessions, measured speed, or demand.

## What is being compared

Draft to Page prepares editable WordPress blocks for a manual handoff. A fair native baseline is **the same participant using WordPress's own Visual block editor and their ordinary paste/import process**, without Draft to Page. Do not pre-clean the native source differently, and do not substitute the faster of several trial methods after seeing the outcome.

Use `NATIVE_WORDPRESS_PASTE` only if the participant actually used the native editor without a third-party conversion tool. `OTHER_FREE_TOOL` covers another verified free conversion tool, with its real name noted privately for later analysis; no additional account connection is made by this study. `OTHER_MANUAL_WORKFLOW` covers a manual workflow that is not native paste or a separate free converter. A paid tool cannot be represented as an identified free alternative. If the actual baseline is unclear, keep `baseline_method: null`; do not guess from the participant's source app.

**Target:** the planned five Word users, three Google Docs users and two Markdown users. Actual enrollment and method order may differ. Do not imply a participant exists from an unassigned study slot. This comparison is a paired exploratory study, not a randomized market experiment.

## Controls and a common task

Use the repository's [fictional study article](fictional-study-article.md) or the matching licensed Word sample. Keep headings, nested lists, table, link, quotation, and exact final sentence. The same original article, destination, account privileges, browser/device and reviewer should be used for both methods wherever practical. Prepare two **unpublished** WordPress drafts in a permitted sandbox or test site. Give the participant the neutral prompt:

> Put this article into an editable unpublished draft on your usual WordPress site. Check the result against the source, save it, close the editor, and reopen it to confirm the article is intact.

For the Draft to Page arm, give only its starting URL. Do not coach which controls to press. For native paste, start from the same ready document in the ordinary source application. A facilitator may intervene for safety, but a procedural hint changes that arm to PASS_ASSISTED and disqualifies its time from the unaided median. Set `order` to the **actual** USUAL_FIRST or DRAFTTOPAGE_FIRST sequence. Follow the preexisting balanced ten-slot order where available, not whichever order would make Draft to Page look better.

For Word, begin with an opened .docx. For Google Docs, begin with the document visibly ready in Google Docs, not an invented clipboard HTML fixture. For Markdown, use the same Markdown input file/text and the participant's genuinely normal native WordPress workflow, or classify a different baseline honestly. If source formats or editorial cleanup differ, mark `same_source_and_destination` or `includes_image_and_cleanup_work` false rather than normalizing the result afterward.

## Timing boundary and verification

Each timed arm starts **with the same article ready in its source application** and ends only after an unpublished WordPress draft is saved, closed, reopened, checked for the entire last sentence, and confirmed to contain editable blocks. Include repairs, retries, image placement work and cleanup. Record setup time separately. Do not stop the timer at a local preview or clipboard success message. If an arm cannot finish, record FAIL with elapsed time and the observed blocker, not a suspiciously fast success. Assistance counts procedural hints and preserves the original failed attempt.

Before setting `usual_saved_reopened` or `drafttopage_saved_reopened` true, the observer must see: correct separate post title, intended headings/list starts, table rows and cells, safe links, image placements (or disclosed manual repair), preserved final sentence, saved unpublished status, and native editability after closing and reopening. If destination verification was not possible, leave the field null; do not infer true from a button click or participant assertion. Never publish, change a real public site, or retain its credentials for this study.

The independent `wordpress_save_reopen_attempted` and `wordpress_native_blocks_editable` fields remain part of the broader alpha's handoff checks. They do not replace the two method-specific flags.

## How to record the paired evidence

Keep actual records **outside** the public repository with `npm run study:init -- /absolute/private-study/sessions`; do not overwrite an existing study. Use the existing version-2 session JSON, plus three nullable fields in `paired_comparison`: `baseline_method`, `usual_saved_reopened`, and `drafttopage_saved_reopened`. Historical version-2 files without them are readable but **not eligible** until the original observations support a deliberate update. Do not fill fields from a browser fixture or fake a human observer.

- Set `usual_workflow` and `drafttopage` task statuses, elapsed seconds and procedural hints separately.
- Set both scope checks and the true method order from actual observation. Include equivalent source, destination, images and cleanup.
- Set the two saved/reopened flags independently only after a destination round-trip.
- Record the source cohort and exact tested `release_commit`. Keep different releases separate.
- Mark synthetic engineering dry runs SYNTHETIC. They cannot establish human acceptance, competitor results or time savings.

The report keeps incomplete, mismatched, assisted, unnamed-baseline and unverified-delivery exclusions visible. It produces a distinct `native_wordpress` section, with faster, slower and tied counts; no descriptive median is shown before **five** qualified verified unaided native WordPress pairs. A negative time difference remains negative. The denominator is the actually eligible pair count, not ten assumed successes. No source content, account identity or site URL belongs in an aggregate.

## Release and safety gates

The existing [alpha release operations](RELEASE_OPERATIONS.md) and [Turn 10 consent protocol](TURN10_EXECUTION.md) still apply. Real participant recruitment, private contact, recording consent, test sites and a support channel require owner approval. The user has not authorized outreach, account connection, hosting purchases or data collection in this improvement.

A paired result is never a substitute for physical-device, screen-reader, fresh Word/Google Docs source, or hosted WordPress acceptance. Stop new invitations for writing loss, private exports, missing article ending, unintended persistence, publication or unexpected network requests. Preserve only a minimal fictional reproduction in the public repository. Do not install GitHub Actions.

**What success would mean:** a documented, consented set of real paired tasks producing an exploratory completion/fidelity/effort comparison with competing free publishing workflows. Until that happens, the truthful outcome is **NOT_RUN**, regardless of how many synthetic tests pass.
