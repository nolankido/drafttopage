import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const HOSTED_WORDPRESS_STEPS = [
  'copied_complete_source','pasted_into_editor','native_editable_blocks','no_unexpected_content_warning',
  'separate_title','web_links_correct','list_starts_and_nesting_correct','table_headers_correct',
  'images_and_alt_text_correct','optional_fields_checked','private_notes_absent','unique_ending_present',
  'saved_unpublished_draft','left_editor_after_save','reopened_same_draft_editable','edited_after_reopen',
  'saved_second_edit','left_and_reopened_second_time','second_edit_and_ending_present'
];
const optional = new Map([
  ['web_links_correct','web_links'],['list_starts_and_nesting_correct','list_groups'],
  ['table_headers_correct','tables'],['images_and_alt_text_correct','linked_images'],
  ['optional_fields_checked','optional_fields']
]);
const ready = value => typeof value === 'string' && value.trim().length > 0;

export function validateHostedWordPressEvidence(value) {
  if (value?.format !== 'drafttopage-hosted-wordpress-acceptance' || value.version !== 1)
    throw new Error('Choose a version 1 hosted WordPress acceptance record.');
  if (value.status === 'NOT_RUN') return { result:'NOT_RUN', detail:'No hosted WordPress destination observation exists.' };
  if (value.status !== 'OBSERVED') throw new Error('Use NOT_RUN or OBSERVED as the record status.');
  if (value.evidence_type !== 'HUMAN_OBSERVATION' || !ready(value.observed_at)
      || !/^[0-9a-f]{40}$/.test(value.release_commit || '') || !['visual','code-editor-fallback'].includes(value.paste_mode)
      || value.post_status !== 'draft'
      || !['copy-button','downloaded-block-file'].includes(value.source_transport))
    return { result:'INCOMPLETE', detail:'Record source version, method, human observation, and unpublished draft status.' };
  if (value.source_transport === 'downloaded-block-file'
      && (value.download_requested !== true || value.download_saved_and_opened !== true))
    return { result:'INCOMPLETE', detail:'A download request is not a saved, opened block source file.' };
  for (const key of ['wordpress_version','browser_family_and_version','editor_role','plugins_affecting_editor'])
    if (!ready(value.environment?.[key])) return { result:'INCOMPLETE', detail:'Missing destination environment: '+key };
  for (const count of ['web_links','list_groups','tables','linked_images','optional_fields'])
    if (!Number.isInteger(value.expected_counts?.[count]) || value.expected_counts[count] < 0 || value.expected_counts[count] > 60000)
      return { result:'INCOMPLETE', detail:'Missing or invalid local expected count: '+count };
  const failures = [], missing = [];
  for (const key of HOSTED_WORDPRESS_STEPS) {
    const result = value.observed?.[key], count = optional.get(key);
    if (result === false) failures.push(key);
    else if (result === 'NOT_APPLICABLE' && count !== undefined && value.expected_counts[count] === 0) continue;
    else if (result !== true) missing.push(key);
  }
  if (failures.length) return { result:'OBSERVED_FAIL', detail:'Destination failures: '+failures.join(', ') };
  if (missing.length) return { result:'INCOMPLETE', detail:'Unobserved or unjustified steps: '+missing.join(', ') };
  return { result:'OBSERVED_MANUAL_PASS',
    detail:'Human checklist complete for the recorded hosted environment. Not independently verified by Draft to Page.' };
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const target = process.argv[2];
    if (!target) throw new Error('Provide an explicitly completed private JSON record path.');
    const result = validateHostedWordPressEvidence(JSON.parse(readFileSync(target,'utf8')));
    process.stdout.write(result.result+': '+result.detail+'\n');
    if (result.result !== 'OBSERVED_MANUAL_PASS') process.exitCode = 1;
  } catch (error) {
    process.stderr.write('Hosted WordPress evidence invalid: '+error.message+'\n');
    process.exitCode = 1;
  }
}
