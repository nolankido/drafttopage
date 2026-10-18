// Deliberately invoked local research tooling. No network, tracking or participant contact.
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const template = JSON.parse(readFileSync(resolve(root, 'docs/alpha/session-record-template.json'), 'utf8'));
const statuses = ['NOT_RUN', 'PASS_UNAIDED', 'PASS_ASSISTED', 'FAIL', 'DECLINED'];
export const ISSUE_CATEGORIES = Object.freeze(['START','PREVIEW','FIDELITY','HANDOFF','RECOVERY','OTHER']);
export const ALPHA_SOURCE_COHORTS = Object.freeze(['WORD','GOOGLE_DOCS','MARKDOWN']);
// Fixed method categories prevent arbitrary tool names, URLs and participant details
// from leaking into aggregate reports. These identify the observed control,
// not a recommendation, endorsement or paid product comparison.
export const ALPHA_BASELINE_METHODS = Object.freeze(['NATIVE_WORDPRESS_PASTE','OTHER_FREE_TOOL','OTHER_MANUAL_WORKFLOW']);
const pairedField = (pair, name) => pair[name] === undefined ? null : pair[name];
export const ALPHA_ADDITIONAL_SAFETY_FLAGS = Object.freeze([
  'unintended_persistence','unintended_publication','unexpected_external_request'
]);
// These fields were introduced after private version-2 study records existed.
// Absence means unverified, never a negative observation.
const safetyObserved = (record, key) => record[key] === undefined ? null : record[key];
function safetySummary(records) {
  const incidents = {
    writing_loss: records.filter(record => record.unrecoverable_writing_loss === true).length,
    private_material_exported: records.filter(record => record.private_material_in_export === true).length,
    article_ending_lost: records.filter(record => record.article_ending_retained === false).length,
    unintended_persistence: records.filter(record => safetyObserved(record,'unintended_persistence') === true).length,
    unintended_publication: records.filter(record => safetyObserved(record,'unintended_publication') === true).length,
    unexpected_external_request: records.filter(record => safetyObserved(record,'unexpected_external_request') === true).length
  };
  const missing_checks = records.filter(record =>
    record.unrecoverable_writing_loss === null ||
    record.private_material_in_export === null ||
    completed(record.tasks[0]) && record.article_ending_retained === null ||
    ALPHA_ADDITIONAL_SAFETY_FLAGS.some(flag => safetyObserved(record,flag) === null)).length;
  return { ...incidents, missing_checks };
}
const hasSafetyIncident = summary => Object.entries(summary)
  .some(([key,count]) => key !== 'missing_checks' && count > 0);
// Never copy arbitrary source-app or issue note strings into an aggregate.
function sourceCategory(value) {
  const source = typeof value === 'string' ? value.toLowerCase().replace(/[ _-]+/g,' ').trim() : '';
  if (['word','microsoft word','docx'].includes(source)) return 'WORD';
  if (['google docs','docs'].includes(source)) return 'GOOGLE_DOCS';
  if (['markdown','plain markdown','md'].includes(source)) return 'MARKDOWN';
  return 'OTHER_OR_UNRECORDED';
}
function categorizedCounts(records) {
  const result = Object.fromEntries([...ALPHA_SOURCE_COHORTS,'OTHER_OR_UNRECORDED'].map(key => [key,0]));
  for (const record of records) result[sourceCategory(record.source_cohort)]++;
  return result;
}
export function prioritizeAlphaIssues(counts) {
  return ISSUE_CATEGORIES.filter(name => counts[name] > 0)
    .sort((a,b) => counts[b] - counts[a] || ISSUE_CATEGORIES.indexOf(a) - ISSUE_CATEGORIES.indexOf(b))
    .map(category => ({ category, affected_sessions: counts[category] }));
}
function issueCounts(records) {
  return Object.fromEntries(ISSUE_CATEGORIES.map(key =>
    [key, records.filter(record => record.issue_categories?.includes(key)).length]));
}
const completed = task => ['PASS_UNAIDED', 'PASS_ASSISTED'].includes(task.status);
const median = values => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b), middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};
const invalid = message => { throw new Error(message); };
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const nullableBoolean = value => value === null || typeof value === 'boolean';
const nullableNumber = value => value === null || typeof value === 'number' && Number.isFinite(value) && value >= 0;

function taskValid(task) {
  if (!object(task) || !statuses.includes(task.status) || !nullableNumber(task.elapsed_seconds) ||
      !(task.procedural_hints === null || Number.isInteger(task.procedural_hints) && task.procedural_hints >= 0)) return false;
  if (task.status === 'NOT_RUN') return task.elapsed_seconds === null && task.procedural_hints === null;
  if (task.status === 'DECLINED') return true;
  return task.elapsed_seconds !== null && task.procedural_hints !== null &&
    (task.status !== 'PASS_UNAIDED' || task.procedural_hints === 0) &&
    (task.status !== 'PASS_ASSISTED' || task.procedural_hints > 0);
}

export function validateSession(record) {
  if (!object(record) || record.format !== template.format || ![1, 2].includes(record.version) ||
      !['NOT_RUN', 'OBSERVED'].includes(record.status)) invalid('Invalid session format, version or status.');
  if (Object.keys(record).some(key => !Object.hasOwn(template, key))) invalid('Unknown session field. Use the blank template; do not add personal identifiers.');
  if (record.session_id !== null && (!/^P\d{2,3}$/.test(record.session_id || '') || record.session_id.trim() !== record.session_id)) invalid('Use an anonymous session ID such as P01.');
  // Only predefined, non-identifying tags enter the aggregate. Older version-2
  // private records without issue_categories remain valid and count as untagged.
  if (record.issue_categories !== undefined && (!Array.isArray(record.issue_categories) ||
      record.issue_categories.length > ISSUE_CATEGORIES.length ||
      new Set(record.issue_categories).size !== record.issue_categories.length ||
      record.issue_categories.some(item => typeof item !== 'string' || !ISSUE_CATEGORIES.includes(item))))
    invalid('Issue categories must be unique predefined category names, without writing or identifying details.');
  if (!Array.isArray(record.tasks) || record.tasks.length !== 6 ||
      record.tasks.some((task, index) => !object(task) || task.id !== 'T' + (index + 1) || !taskValid(task))) invalid('Tasks must contain T1 through T6 with consistent outcomes, times and hints.');
  if (ALPHA_ADDITIONAL_SAFETY_FLAGS.some(flag =>
    record[flag] !== undefined && !nullableBoolean(record[flag])))
    invalid('Unexpected-persistence, publication and external-request observations must be boolean or null.');
  const flags = ['article_ending_retained', 'private_material_in_export', 'unrecoverable_writing_loss',
    'title_handling_understood', 'approval_understood', 'manual_publishing_understood',
    'wordpress_save_reopen_attempted', 'wordpress_native_blocks_editable', 'actual_second_article_observed'];
  if (flags.some(key => !nullableBoolean(record[key])) || !nullableNumber(record.setup_seconds) ||
      !nullableNumber(record.second_article_delay_hours)) invalid('Observation flags and times must be explicit values or null.');
  if (record.wordpress_native_blocks_editable !== null && record.wordpress_save_reopen_attempted !== true) invalid('WordPress acceptance requires an attempted save/reopen.');
  if (record.actual_second_article_observed !== true && record.second_article_delay_hours !== null) invalid('A repeat-use time requires an observed second article.');
  if (record.version === 2) {
    if (![null, 'HUMAN_OBSERVATION', 'SYNTHETIC'].includes(record.evidence_type) ||
        !nullableBoolean(record.participant_qualified) || !nullableBoolean(record.consent_to_record_outcomes) ||
        !nullableNumber(record.publishes_articles_per_month) || !nullableBoolean(record.second_article_voluntary) ||
        !nullableBoolean(record.second_article_is_distinct_real_work)) invalid('Invalid evidence, qualification, consent or repeat-use fields.');
    const pair = record.paired_comparison;
    if (!object(pair) || pair.boundary !== 'READY_SOURCE_TO_REVIEWED_SAVED_REOPENED_DRAFT' ||
        !nullableBoolean(pair.same_source_and_destination) || !nullableBoolean(pair.includes_image_and_cleanup_work) ||
        ![null, 'USUAL_FIRST', 'DRAFTTOPAGE_FIRST'].includes(pair.order) || !taskValid(pair.usual_workflow) || !taskValid(pair.drafttopage) ||
        ![null,...ALPHA_BASELINE_METHODS].includes(pairedField(pair,'baseline_method')) ||
        !nullableBoolean(pairedField(pair,'usual_saved_reopened')) ||
        !nullableBoolean(pairedField(pair,'drafttopage_saved_reopened'))) invalid('Invalid paired workflow comparison.');
    if (pairedField(pair,'usual_saved_reopened') === true && !completed(pair.usual_workflow) ||
        pairedField(pair,'drafttopage_saved_reopened') === true && !completed(pair.drafttopage))
      invalid('A verified saved/reopened destination requires a completed method.');
    if (record.actual_second_article_observed !== true &&
        (record.second_article_voluntary !== null || record.second_article_is_distinct_real_work !== null)) invalid('Repeat-use qualification requires an observed second article.');
  }
  if (record.status === 'NOT_RUN') {
    if (record.tasks.some(task => task.status !== 'NOT_RUN') || flags.some(key => record[key] !== null) ||
        record.setup_seconds !== null || record.second_article_delay_hours !== null ||
        (record.issue_categories?.length ?? 0) !== 0 ||
        ALPHA_ADDITIONAL_SAFETY_FLAGS.some(flag => safetyObserved(record,flag) !== null) ||
        record.version === 2 && (record.evidence_type !== null || record.participant_qualified !== null ||
          record.consent_to_record_outcomes !== null || record.publishes_articles_per_month !== null ||
          record.paired_comparison.usual_workflow.status !== 'NOT_RUN' || record.paired_comparison.drafttopage.status !== 'NOT_RUN' ||
          record.paired_comparison.same_source_and_destination !== null || record.paired_comparison.includes_image_and_cleanup_work !== null ||
          record.paired_comparison.order !== null || pairedField(record.paired_comparison,'baseline_method') !== null ||
          pairedField(record.paired_comparison,'usual_saved_reopened') !== null ||
          pairedField(record.paired_comparison,'drafttopage_saved_reopened') !== null)) invalid('An unrun session cannot contain observed outcomes.');
  } else {
    if (!record.session_id || record.release_commit?.length !== 40 || !/^[a-f0-9]{40}$/.test(record.release_commit || '') ||
        !/^\d{4}-\d{2}-\d{2}$/.test(record.session_date || '') || !Number.isFinite(Date.parse(record.session_date)) ||
        new Date(record.session_date).toISOString().slice(0, 10) !== record.session_date) invalid('Observed sessions need an anonymous ID, release commit and valid calendar date.');
    if (record.version === 2 && (record.evidence_type === null || typeof record.participant_qualified !== 'boolean' ||
        record.evidence_type === 'HUMAN_OBSERVATION' && record.consent_to_record_outcomes !== true)) invalid('Human observations require recorded consent and explicit qualification.');
  }
  return record;
}

function summarizeRelease(records) {
  const denominator = Math.max(10, records.length), threshold = Math.ceil(denominator * 0.8);
  const tasks = Object.fromEntries(Array.from({ length: 6 }, (_, index) => {
    const id = 'T' + (index + 1), values = records.map(record => record.tasks[index]);
    return [id, { statuses: Object.fromEntries(statuses.map(status => [status, values.filter(task => task.status === status).length])),
      unaided_completion_seconds: values.filter(task => task.status === 'PASS_UNAIDED').map(task => task.elapsed_seconds),
      attempted_seconds: values.filter(task => !['NOT_RUN', 'DECLINED'].includes(task.status)).map(task => task.elapsed_seconds) }];
  }));
  const first = tasks.T1;
  first.median_unaided_completion_seconds = median(first.unaided_completion_seconds);
  first.median_attempted_seconds = median(first.attempted_seconds);
  const safety = safetySummary(records);
  const comprehension = Object.fromEntries(['title_handling_understood', 'approval_understood', 'manual_publishing_understood'].map(key =>
    [key, { understood: records.filter(record => record[key] === true).length, unknown: records.filter(record => record[key] === null).length }]));
  const attemptedWP = records.filter(record => record.wordpress_save_reopen_attempted === true);
  const wordpress = { attempted: attemptedWP.length, editable: attemptedWP.filter(record => record.wordpress_native_blocks_editable === true).length,
    failed: attemptedWP.filter(record => record.wordpress_native_blocks_editable === false).length,
    unknown: attemptedWP.filter(record => record.wordpress_native_blocks_editable === null).length };
  const repeat = { verified_within_72_hours: 0, verified_within_four_weeks: 0, unverified: 0, ineligible_or_failed: 0 };
  const comparison = { accepted_unaided_pairs: [], excluded_incomplete: 0, excluded_scope: 0,
    excluded_assisted_or_failed: 0, excluded_baseline_unrecorded: 0, excluded_delivery_unverified: 0,
    baseline_method_counts: Object.fromEntries([...ALPHA_BASELINE_METHODS,'NOT_RECORDED'].map(method => [method,0])) };
  for (const record of records) {
    if (completed(record.tasks[5]) && record.actual_second_article_observed === true && record.second_article_voluntary === true &&
        record.second_article_is_distinct_real_work === true && record.second_article_delay_hours !== null) {
      if (record.second_article_delay_hours <= 72) repeat.verified_within_72_hours++;
      if (record.second_article_delay_hours <= 672) repeat.verified_within_four_weeks++;
    } else if (record.actual_second_article_observed === true && (record.second_article_voluntary === false ||
        record.second_article_is_distinct_real_work === false || ['FAIL', 'DECLINED'].includes(record.tasks[5].status))) repeat.ineligible_or_failed++;
    else if (record.actual_second_article_observed !== false) repeat.unverified++;
    const pair = record.paired_comparison, method = pairedField(pair,'baseline_method');
    comparison.baseline_method_counts[method ?? 'NOT_RECORDED']++;
    if (['NOT_RUN', 'DECLINED'].includes(pair.usual_workflow.status) || ['NOT_RUN', 'DECLINED'].includes(pair.drafttopage.status)) comparison.excluded_incomplete++;
    else if (pair.same_source_and_destination !== true || pair.includes_image_and_cleanup_work !== true || pair.order === null ||
        method === 'NATIVE_WORDPRESS_PASTE' && !/wordpress/i.test(record.destination_type || '')) comparison.excluded_scope++;
    else if (pair.usual_workflow.status !== 'PASS_UNAIDED' || pair.drafttopage.status !== 'PASS_UNAIDED') comparison.excluded_assisted_or_failed++;
    else if (method === null) comparison.excluded_baseline_unrecorded++;
    else if (pairedField(pair,'usual_saved_reopened') !== true || pairedField(pair,'drafttopage_saved_reopened') !== true)
      comparison.excluded_delivery_unverified++;
    else {
      const usual = pair.usual_workflow.elapsed_seconds, drafttopage = pair.drafttopage.elapsed_seconds;
      comparison.accepted_unaided_pairs.push({ baseline_method: method, order: pair.order, usual_seconds: usual, drafttopage_seconds: drafttopage,
        saved_seconds: usual - drafttopage, saved_percent: usual === 0 ? null : (usual - drafttopage) / usual * 100 });
    }
  }
  comparison.median_saved_seconds = median(comparison.accepted_unaided_pairs.map(pair => pair.saved_seconds));
  comparison.median_saved_percent = median(comparison.accepted_unaided_pairs.map(pair => pair.saved_percent).filter(value => value !== null));
  // A named native-WordPress comparison is never inferred from an unlabelled
  // "usual workflow". Suppress pilot medians for fewer than five verified pairs.
  const native = comparison.accepted_unaided_pairs.filter(pair => pair.baseline_method === 'NATIVE_WORDPRESS_PASTE');
  comparison.native_wordpress = {
    baseline_method: 'NATIVE_WORDPRESS_PASTE', verified_unaided_pairs: native.length,
    faster: native.filter(pair => pair.saved_seconds > 0).length,
    slower: native.filter(pair => pair.saved_seconds < 0).length,
    tied: native.filter(pair => pair.saved_seconds === 0).length,
    median_saved_seconds: native.length >= 5 ? median(native.map(pair => pair.saved_seconds)) : null,
    median_saved_percent: native.length >= 5 ? median(native.map(pair => pair.saved_percent).filter(value => value !== null)) : null,
    evidence_status: native.length === 0 ? 'NOT_RUN' : native.length < 5 ? 'INSUFFICIENT_PAIRS' : 'DESCRIPTIVE_PILOT_ONLY'
  };
  const target = (met, unknown = 0) => records.length < 10 ? 'PENDING' : met ? 'MET' : unknown ? 'PENDING' : 'NOT_MET';
  return { release_commit: records[0].release_commit, qualified_observed: records.length, enrolled_target_denominator: denominator,
    tasks, safety, comprehension, wordpress, repeat, paired_comparison: comparison,
    actual_source_mix: categorizedCounts(records),
    issue_category_counts: issueCounts(records),
    issue_priority: prioritizeAlphaIssues(issueCounts(records)),
    targets: {
      first_conversion: target(first.statuses.PASS_UNAIDED >= threshold && first.median_unaided_completion_seconds <= 300, first.statuses.NOT_RUN),
      safety: hasSafetyIncident(safety) ? 'BLOCKED' : safety.missing_checks ? 'PENDING' : 'NO_INCIDENT_RECORDED',
      title_understanding: target(comprehension.title_handling_understood.understood >= threshold, comprehension.title_handling_understood.unknown),
      approval_understanding: target(comprehension.approval_understood.understood >= threshold, comprehension.approval_understood.unknown),
      manual_publishing_understanding: target(comprehension.manual_publishing_understood.understood >= threshold, comprehension.manual_publishing_understood.unknown),
      wordpress_save_reopen: !wordpress.attempted ? 'NOT_RUN' : wordpress.failed ? 'NOT_MET' : wordpress.unknown ? 'PENDING' : 'MET_FOR_ATTEMPTED_CASES',
      repeat_within_72_hours: target(repeat.verified_within_72_hours >= Math.ceil(denominator / 2), repeat.unverified)
    } };
}

export function summarizeSessions(input) {
  if (!Array.isArray(input) || input.length > 100) invalid('Use at most 100 session records.');
  const records = input.map(validateSession), ids = records.map(record => record.session_id).filter(Boolean);
  if (new Set(ids).size !== ids.length) invalid('Duplicate session IDs. Each participant must be counted once.');
  const observed = records.filter(record => record.version === 2 && record.status === 'OBSERVED' && record.evidence_type === 'HUMAN_OBSERVATION');
  const qualified = observed.filter(record => record.participant_qualified === true);
  const releases = [...new Set(qualified.map(record => record.release_commit))];
  const releaseReports = releases.map(release => summarizeRelease(qualified.filter(record => record.release_commit === release)));
  const allHumanSafety = safetySummary(observed);
  const { missing_checks: missingSafety, ...critical } = allHumanSafety;
  const unsafe = hasSafetyIncident(allHumanSafety);
  const expansion = unsafe ? 'STOP_FOR_SAFETY' : missingSafety ? 'HOLD_SAFETY_CHECKS_INCOMPLETE' :
    qualified.length < 10 ? 'WAIT_FOR_QUALIFIED_SESSIONS' :
    !releaseReports.some(report => report.qualified_observed >= 10) ? 'HOLD_NO_SINGLE_RELEASE_COHORT' :
    !releaseReports.some(report => report.qualified_observed >= 10 &&
      report.targets.first_conversion === 'MET' &&
      report.targets.wordpress_save_reopen === 'MET_FOR_ATTEMPTED_CASES' &&
      report.targets.title_understanding === 'MET' &&
      report.targets.approval_understanding === 'MET' &&
      report.targets.manual_publishing_understanding === 'MET' &&
      report.targets.safety === 'NO_INCIDENT_RECORDED') ? 'HOLD_PRODUCT_TARGETS_OR_UNVERIFIED_DESTINATION' :
    'OWNER_REVIEW_REQUIRED';
  return { format: 'drafttopage-public-alpha-summary', version: 1,
    study_status: !observed.length ? 'NOT_RUN' : !releaseReports.some(report => report.qualified_observed >= 10) ? 'PARTIAL' : 'OBSERVATIONS_RECORDED',
    expansion_decision: expansion,
    cohort_target: { WORD: 5, GOOGLE_DOCS: 3, MARKDOWN: 2 },
    actual_qualified_source_mix: categorizedCounts(qualified),
    issue_category_counts_qualified: issueCounts(qualified),
    issue_priority_qualified: prioritizeAlphaIssues(issueCounts(qualified)),
    planned_cohort: 10, records_supplied: records.length, human_observations: observed.length, qualified_human_observations: qualified.length,
    not_run: records.filter(record => record.status === 'NOT_RUN').length,
    excluded_legacy: records.filter(record => record.version === 1 && record.status === 'OBSERVED').length,
    excluded_synthetic: records.filter(record => record.evidence_type === 'SYNTHETIC').length,
    excluded_unqualified: observed.length - qualified.length,
    critical_incidents_all_human_observations: critical,
    missing_safety_checks_all_human_observations: missingSafety,
    mixed_releases: releases.length > 1, releases: releaseReports,
    interpretation: 'Local transcription of recorded observations, not verification that sessions occurred. Paired time summaries require a named baseline, matched scope, two completed unaided methods and independently observed save/reopen for both. A native WordPress median needs at least five eligible pairs and is descriptive only. Missing and synthetic evidence never establish adoption, causal time savings or willingness to pay. Release cohorts stay separate. Keep this small-cohort report private.' };
}

function privateDirectory(directory, create = false) {
  const selected = resolve(directory), repository = realpathSync(root);
  let ancestor = selected;
  while (!existsSync(ancestor)) {
    const parent = dirname(ancestor);
    if (parent === ancestor) invalid('Select a private directory outside the repository.');
    ancestor = parent;
  }
  const resolvedAncestor = realpathSync(ancestor), resolvedTarget = resolve(resolvedAncestor, relative(ancestor, selected));
  const inside = relative(repository, resolvedTarget);
  if (inside === '' || !inside.startsWith('..' + sep) && inside !== '..' && !isAbsolute(inside)) invalid('Study records must stay outside the public repository, including through symlinks.');
  if (create) mkdirSync(selected, { recursive: true, mode: 0o700 });
  if (!lstatSync(realpathSync(selected)).isDirectory()) invalid('Select a private directory.');
  return realpathSync(selected);
}

export function initializeStudy(directory) {
  const destination = privateDirectory(directory, true);
  const files = Array.from({ length: 10 }, (_, index) => 'P' + String(index + 1).padStart(2, '0') + '.json');
  if (files.some(name => existsSync(resolve(destination, name)))) invalid('A session file already exists. Nothing was overwritten.');
  for (const [index, name] of files.entries()) writeFileSync(resolve(destination, name), JSON.stringify({ ...template, session_id: 'P' + String(index + 1).padStart(2, '0') }, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  return { status: 'NOT_RUN', blank_records_created: 10, participants_contacted: 0 };
}

export function readStudy(directory) {
  const source = privateDirectory(directory);
  const files = readdirSync(source).filter(name => name.endsWith('.json')).sort();
  if (files.length > 100) invalid('Use at most 100 session records.');
  const records = files.map((name, index) => {
    const path = resolve(source, name), info = lstatSync(path);
    if (!info.isFile() || info.isSymbolicLink() || info.size > 65536) invalid('Session file ' + (index + 1) + ' must be a regular JSON file up to 64 KiB.');
    try { return JSON.parse(readFileSync(path, 'utf8')); } catch { invalid('Session file ' + (index + 1) + ' is not valid JSON.'); }
  });
  return summarizeSessions(records);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const [command, directory, ...extra] = process.argv.slice(2);
    if (!directory || extra.length || !['init', 'report'].includes(command)) invalid('Usage: node scripts/alpha-study.mjs <init|report> /absolute/private-study-directory');
    if (!isAbsolute(directory)) invalid('Use an absolute private-directory path.');
    console.log(JSON.stringify(command === 'init' ? initializeStudy(directory) : readStudy(directory), null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
