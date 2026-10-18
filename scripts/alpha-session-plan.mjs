// Ten unassigned research slots only. No recruitment, messaging, tracking,
// real participant data, device identity or recorded outcomes.
export const ALPHA_PLANNED_ASSIGNMENTS = Object.freeze([
  ['WORD','USUAL_FIRST'],['GOOGLE_DOCS','DRAFTTOPAGE_FIRST'],
  ['WORD','DRAFTTOPAGE_FIRST'],['MARKDOWN','USUAL_FIRST'],
  ['WORD','USUAL_FIRST'],['GOOGLE_DOCS','USUAL_FIRST'],
  ['WORD','DRAFTTOPAGE_FIRST'],['MARKDOWN','DRAFTTOPAGE_FIRST'],
  ['WORD','USUAL_FIRST'],['GOOGLE_DOCS','DRAFTTOPAGE_FIRST']
]);
export function plannedAlphaSlots() {
  const slots=ALPHA_PLANNED_ASSIGNMENTS.map(([source_target,planned_comparison_order],i)=>({
    slot:'P'+String(i+1).padStart(2,'0'),source_target,planned_comparison_order,
    status:'UNASSIGNED',participant_qualified:null,consent:null,actual_source:null
  }));
  return {
    format:'drafttopage-alpha-recruitment-plan',version:1,status:'NOT_RUN',
    invited:0,contacted:0,qualified_observations:0,source_targets:{WORD:5,GOOGLE_DOCS:3,MARKDOWN:2},
    planned_order:{USUAL_FIRST:5,DRAFTTOPAGE_FIRST:5},slots,
    caution:'These are unassigned research slots, not participants or completed observations. Do not treat targets as actual cohort mix or initiate contact.'
  };
}
if (process.argv[1] && import.meta.url === new URL('file://'+process.argv[1]).href)
  process.stdout.write(JSON.stringify(plannedAlphaSlots(),null,2)+'\n');
