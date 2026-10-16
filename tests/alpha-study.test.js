import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { initializeStudy, readStudy, summarizeSessions, validateSession } from '../scripts/alpha-study.mjs';

const blank = () => JSON.parse(readFileSync(new URL('../docs/alpha/session-record-template.json', import.meta.url), 'utf8'));
const task = (status = 'PASS_UNAIDED', elapsed_seconds = 100, procedural_hints = 0) => ({ status, elapsed_seconds, procedural_hints });
function observed(index = 1) {
  const record = blank();
  Object.assign(record, { status: 'OBSERVED', session_id: 'P' + String(index).padStart(2, '0'), release_commit: 'a'.repeat(40), session_date: '2026-10-16',
    evidence_type: 'HUMAN_OBSERVATION', participant_qualified: true, consent_to_record_outcomes: true, publishes_articles_per_month: 4,
    article_ending_retained: true, private_material_in_export: false, unrecoverable_writing_loss: false,
    title_handling_understood: true, approval_understood: true, manual_publishing_understood: true,
    wordpress_save_reopen_attempted: true, wordpress_native_blocks_editable: true });
  record.tasks = record.tasks.map(({ id }) => ({ id, ...task() }));
  record.tasks[5] = { id: 'T6', ...task('NOT_RUN', null, null) };
  Object.assign(record.paired_comparison, { same_source_and_destination: true, includes_image_and_cleanup_work: true, order: 'USUAL_FIRST',
    usual_workflow: task('PASS_UNAIDED', 600), drafttopage: task('PASS_UNAIDED', 300) });
  return record;
}
function fixture(run) {
  const directory = mkdtempSync(resolve(tmpdir(), 'drafttopage-alpha-test-'));
  try { return run(directory); } finally { rmSync(directory, { recursive: true, force: true }); }
}

test('Blank and legacy records never turn preparation into participants or time savings', () => {
  const current = blank(), legacy = blank(); legacy.version = 1;
  const result = summarizeSessions([current, legacy]);
  assert.equal(result.study_status, 'NOT_RUN'); assert.equal(result.human_observations, 0);
  assert.equal(result.not_run, 2); assert.deepEqual(result.releases, []);
  const oldObserved = observed(); oldObserved.version = 1;
  assert.equal(summarizeSessions([oldObserved]).excluded_legacy, 1);
  assert.equal(summarizeSessions([oldObserved]).human_observations, 0);
});

test('Synthetic cases and unqualified observations cannot establish qualified adoption', () => {
  const synthetic = observed(), unqualified = observed(2); synthetic.evidence_type = 'SYNTHETIC'; unqualified.participant_qualified = false;
  const result = summarizeSessions([synthetic, unqualified]);
  assert.equal(result.excluded_synthetic, 1); assert.equal(result.excluded_unqualified, 1);
  assert.equal(result.qualified_human_observations, 0); assert.deepEqual(result.releases, []);
  assert.equal(summarizeSessions([synthetic]).study_status, 'NOT_RUN');
  unqualified.unrecoverable_writing_loss = true;
  assert.equal(summarizeSessions([unqualified]).critical_incidents_all_human_observations.writing_loss, 1);
});

test('Observed success needs consent, exact anonymous IDs, a source release, real dates and consistent task records', () => {
  const variants = [
    record => { record.consent_to_record_outcomes = false; }, record => { record.session_id = 'person@example.test'; }, record => { record.session_id = 'P01\n'; },
    record => { record.release_commit = 'main'; }, record => { record.session_date = '2026-02-30'; },
    record => { record.tasks[0].procedural_hints = 1; }, record => { record.tasks[0].elapsed_seconds = null; },
    record => { record.tasks[0].elapsed_seconds = -1; }, record => { record.tasks[0].elapsed_seconds = Infinity; },
    record => { record.tasks[0].status = 'PASS_ASSISTED'; }, record => { record.tasks[0].status = 'NOT_RUN'; },
    record => { record.tasks[1].id = 'T1'; }, record => { record.tasks[0] = null; }, record => { record.name = 'A private name'; },
    record => { record.wordpress_save_reopen_attempted = false; }, record => { record.second_article_delay_hours = 1; }
  ];
  for (const mutate of variants) { const record = observed(); mutate(record); assert.throws(() => validateSession(record)); }
  const unrun = blank(); unrun.tasks[0] = { id: 'T1', ...task() }; assert.throws(() => validateSession(unrun), /unrun/);
  assert.throws(() => summarizeSessions([observed(), observed()]), /Duplicate/);
});

test('Incomplete cohorts and unknown outcomes stay pending, with failures visible alongside completion medians', () => {
  const records = Array.from({ length: 10 }, (_, index) => observed(index + 1));
  assert.equal(summarizeSessions(records.slice(0, 8)).releases[0].targets.first_conversion, 'PENDING');
  records[8].tasks[0] = { id: 'T1', ...task('PASS_ASSISTED', 400, 1) };
  records[9].tasks[0] = { id: 'T1', ...task('FAIL', 500, 0) };
  const result = summarizeSessions(records).releases[0];
  assert.equal(result.targets.first_conversion, 'MET'); assert.equal(result.tasks.T1.statuses.FAIL, 1);
  assert.equal(result.tasks.T1.statuses.PASS_ASSISTED, 1); assert.equal(result.tasks.T1.attempted_seconds.length, 10);
  assert.equal(result.paired_comparison.accepted_unaided_pairs.length, 10);
  records[7].tasks[0] = { id: 'T1', ...task('NOT_RUN', null, null) };
  assert.equal(summarizeSessions(records).releases[0].targets.first_conversion, 'PENDING');
  records[7].tasks[0] = { id: 'T1', ...task('FAIL', 600, 0) };
  assert.equal(summarizeSessions(records).releases[0].targets.first_conversion, 'NOT_MET');
});

test('Different releases keep their own denominators and cannot combine into a passing cohort', () => {
  const records = Array.from({ length: 10 }, (_, index) => observed(index + 1));
  for (const record of records.slice(5)) record.release_commit = 'b'.repeat(40);
  const result = summarizeSessions(records);
  assert.equal(result.mixed_releases, true); assert.equal(result.releases.length, 2);
  assert.ok(result.releases.every(release => release.qualified_observed === 5 && release.targets.first_conversion === 'PENDING'));
});

test('Paired comparisons exclude failed, assisted, missing and mismatched work without hiding slower results', () => {
  const records = Array.from({ length: 7 }, (_, index) => observed(index + 1));
  records[0].paired_comparison.drafttopage.elapsed_seconds = 900;
  records[1].paired_comparison.usual_workflow.elapsed_seconds = 0;
  records[2].paired_comparison.same_source_and_destination = false;
  records[3].paired_comparison.includes_image_and_cleanup_work = null;
  records[4].paired_comparison.drafttopage = task('PASS_ASSISTED', 1, 1);
  records[5].paired_comparison.drafttopage = task('FAIL', 1);
  records[6].paired_comparison.usual_workflow = task('NOT_RUN', null, null);
  const result = summarizeSessions(records).releases[0].paired_comparison;
  assert.equal(result.accepted_unaided_pairs.length, 2); assert.equal(result.excluded_scope, 2);
  assert.equal(result.excluded_assisted_or_failed, 2); assert.equal(result.excluded_incomplete, 1);
  assert.equal(result.median_saved_seconds, -300); assert.equal(result.median_saved_percent, -50);
  assert.equal(result.accepted_unaided_pairs[1].saved_percent, null);
});

test('Safety incidents block, missing checks remain pending, and unattempted WordPress tasks are not passes', () => {
  const record = observed(); record.unrecoverable_writing_loss = true;
  assert.equal(summarizeSessions([record]).releases[0].targets.safety, 'BLOCKED');
  record.unrecoverable_writing_loss = null;
  record.wordpress_save_reopen_attempted = false; record.wordpress_native_blocks_editable = null;
  const result = summarizeSessions([record]).releases[0];
  assert.equal(result.targets.safety, 'PENDING'); assert.equal(result.targets.wordpress_save_reopen, 'NOT_RUN');
  record.wordpress_save_reopen_attempted = true;
  assert.equal(summarizeSessions([record]).releases[0].targets.wordpress_save_reopen, 'PENDING');
  record.wordpress_native_blocks_editable = false;
  assert.equal(summarizeSessions([record]).releases[0].targets.wordpress_save_reopen, 'NOT_MET');
});

test('Repeat use requires a voluntary distinct real article and a measured delay', () => {
  const records = Array.from({ length: 5 }, (_, index) => observed(index + 1));
  for (const record of records) { record.actual_second_article_observed = true; record.tasks[5] = { id: 'T6', ...task() }; }
  Object.assign(records[0], { second_article_voluntary: true, second_article_is_distinct_real_work: true, second_article_delay_hours: 72 });
  Object.assign(records[1], { second_article_voluntary: true, second_article_is_distinct_real_work: true, second_article_delay_hours: 96 });
  Object.assign(records[2], { second_article_voluntary: true, second_article_is_distinct_real_work: true, second_article_delay_hours: 673 });
  Object.assign(records[3], { second_article_voluntary: false, second_article_is_distinct_real_work: true, second_article_delay_hours: 12 });
  const repeat = summarizeSessions(records).releases[0].repeat;
  assert.equal(repeat.verified_within_72_hours, 1); assert.equal(repeat.verified_within_four_weeks, 2);
  assert.equal(repeat.unverified, 1); assert.equal(repeat.ineligible_or_failed, 1);
  records[0].tasks[5] = { id: 'T6', ...task('FAIL', 300) };
  assert.equal(summarizeSessions(records).releases[0].repeat.verified_within_72_hours, 0);
});

test('Summaries omit free text, participant IDs, browser details, private notes and issue descriptions', () => {
  const record = observed(); record.tasks[0].outcome_note = 'PRIVATE_MARKER'; record.issue_summaries = ['PRIVATE_MARKER'];
  record.browser_family_and_version = 'PRIVATE_MARKER'; record.source_cohort = 'PRIVATE_MARKER';
  const result = JSON.stringify(summarizeSessions([record]));
  assert.doesNotMatch(result, /PRIVATE_MARKER|P01|outcome_note|issue_summaries|browser_family_and_version/);
});

test('Study initialization creates ten private blank records and never overwrites existing files', () => fixture(directory => {
  const path = resolve(directory, 'sessions');
  assert.equal(initializeStudy(path).blank_records_created, 10); assert.equal(readdirSync(path).length, 10);
  assert.equal(readStudy(path).study_status, 'NOT_RUN'); assert.equal(readStudy(path).human_observations, 0);
  const before = readFileSync(resolve(path, 'P01.json'), 'utf8');
  assert.equal(JSON.parse(before).session_id, 'P01');
  assert.throws(() => initializeStudy(path), /Nothing was overwritten/);
  assert.equal(readFileSync(resolve(path, 'P01.json'), 'utf8'), before);
  if (process.platform !== 'win32') assert.equal(statSync(resolve(path, 'P01.json')).mode & 0o777, 0o600);
}));

test('Private record directories cannot point inside this public repository, including via symlinks', () => fixture(directory => {
  assert.throws(() => initializeStudy(resolve('test-results/forbidden-study')), /outside the public repository/);
  const link = resolve(directory, 'repository-link'); symlinkSync(process.cwd(), link, 'dir');
  assert.throws(() => initializeStudy(resolve(link, 'test-results/forbidden-study')), /outside the public repository/);
  assert.equal(existsSync(resolve('test-results/forbidden-study')), false);
}));

test('The CLI rejects malformed, oversized and symlinked records without printing their contents', () => fixture(directory => {
  const path = resolve(directory, 'sessions'); initializeStudy(path);
  const first = resolve(path, 'P01.json');
  writeFileSync(first, 'PRIVATE_MARKER');
  assert.throws(() => readStudy(path), /not valid JSON/);
  const result = spawnSync(process.execPath, ['scripts/alpha-study.mjs', 'report', path], { encoding: 'utf8' });
  assert.equal(result.status, 1); assert.doesNotMatch(result.stderr + result.stdout, /PRIVATE_MARKER/);
  writeFileSync(first, ' '.repeat(65537)); assert.throws(() => readStudy(path), /64 KiB/);
  rmSync(first); symlinkSync(resolve(path, 'P02.json'), first); assert.throws(() => readStudy(path), /regular JSON/);
}));

test('The command-line runner reports NOT_RUN for a newly initialized study', () => fixture(directory => {
  const path = resolve(directory, 'sessions');
  execFileSync(process.execPath, ['scripts/alpha-study.mjs', 'init', path]);
  const result = JSON.parse(execFileSync(process.execPath, ['scripts/alpha-study.mjs', 'report', path], { encoding: 'utf8' }));
  assert.equal(result.study_status, 'NOT_RUN'); assert.equal(result.not_run, 10);
  const invalidPath = spawnSync(process.execPath, ['scripts/alpha-study.mjs', 'init', 'relative-path'], { encoding: 'utf8' });
  assert.equal(invalidPath.status, 1); assert.match(invalidPath.stderr, /absolute/);
}));
