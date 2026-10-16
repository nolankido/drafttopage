# Paired public-alpha study runner

This release advances the October 16 evaluation's first recommendation: execute the existing ten-writer study and compare the complete publishing task with each participant's ordinary method. The study kit already existed. Its missing capability was an executable record and summary workflow for that paired comparison.

The local dependency-free runner can initialize ten blank private records and summarize observed outcomes. The version 2 record adds explicit human/synthetic evidence, qualification, consent, publishing frequency, paired task boundaries/order, and voluntary distinct real-article return fields. Incomplete and legacy records cannot establish time savings; synthetic tests cannot become participants. Failed and assisted tasks, slower conversions, missing follow-ups and release-specific denominators remain visible. Private free text and participant IDs are omitted from summaries. Input/output is local and deliberate; there is no participant contact, hosted form, tracking or provider activation.

Use the [runner instructions](alpha/RUNNER.md) and [existing task cards](PUBLIC_ALPHA_STUDY_20261016.md). Completed records must remain outside the public repository. The runner rejects in-checkout directories, including symlink paths, never overwrites a session file, bounds input files, and reports invalid records without reproducing their contents.

Regression coverage checks the empty-study outcome, synthetic/legacy exclusion, consent and task consistency, duplicate participants, mixed releases, paired scope, slower and zero-baseline results, safety incidents, repeat-use evidence, private-output omissions, storage location, no-overwrite behavior, and command-line reporting. These tests use temporary synthetic records; they do not constitute participant sessions.

Human-study status remains **NOT_RUN**. No users were recruited, contacted or counted; no adoption, repeat use, time saving or payment outcome is claimed. This completes the missing execution tooling, not the research recommendation itself. No public workspace behavior or hosting configuration changes in this release.
