import { createMarkdown } from './markdown.js';
import { DRAFT_FIELDS } from './workspace.js';
import { installRecovery } from './recovery.js';
import { downloadText } from './download.js';
import { renderPreview, suggestFilename } from './preview.js';

const $ = id => document.getElementById(id);
const sourceFields = ['profile', 'audience', 'purpose', 'notes'];
let questions = [], dirty = false;
const report = message => { $('desk-status').textContent = message; };
const warn = event => { event.preventDefault(); event.returnValue = ''; };
const capture = () => ({
  source: Object.fromEntries(sourceFields.map(id => [id, $(id).value])),
  draft: { ...Object.fromEntries(DRAFT_FIELDS.map(id => [id, $(id).value])), questions: [...questions] }
});
const hasWork = () => [...DRAFT_FIELDS, 'notes', 'audience', 'purpose'].some(id => $(id).value.length) || questions.length > 0;
function update() {
  const text = $('body').value.trim();
  const words = text ? text.split(/\s+/u).length : 0;
  $('body-count').textContent = `${words.toLocaleString()} approximate words; ${$('body').value.length.toLocaleString()} / 12,000 characters`;
  $('description-count').textContent = `${$('description').value.length} / 160 characters`;
  $('note-count').textContent = `${$('notes').value.length.toLocaleString()} / 8,000 characters`;
  for (const id of ['download', 'copy', 'copy-body']) $(id).disabled = !$('reviewed').checked;
  if ($('preview-panel').open) renderPreview($('article-preview'), $('title').value, $('body').value);
}
function changed() {
  dirty = hasWork(); $('reviewed').checked = false;
  window.removeEventListener('beforeunload', warn);
  if (dirty) window.addEventListener('beforeunload', warn);
  update();
}
function fill(value) {
  for (const id of sourceFields) $(id).value = value.source[id];
  for (const id of DRAFT_FIELDS) $(id).value = value.draft?.[id] ?? '';
  questions = value.draft?.questions ? [...value.draft.questions] : [];
  $('questions').replaceChildren(...questions.map(text => {
    const li = document.createElement('li'); li.textContent = text; return li;
  }));
  $('imported-questions').hidden = questions.length === 0;
  changed(); $('body').focus();
}
const recovery = installRecovery({ capture, restore: fill, hasWork, isBusy: () => false, report });
for (const id of [...sourceFields, ...DRAFT_FIELDS]) $(id).addEventListener('input', changed);
$('reviewed').addEventListener('change', update);
$('preview-panel').addEventListener('toggle', update);
$('suggest-slug').addEventListener('click', () => {
  if ($('slug').value && !confirm('Replace the current filename with a suggestion from the title?')) return;
  $('slug').value = suggestFilename($('title').value); changed();
  report('Filename suggested locally. Review it before exporting.');
});
const getExport = () => {
  if (!$('reviewed').checked) throw new Error('Review the article and check the approval box first.');
  return createMarkdown(capture().draft);
};
$('download').addEventListener('click', () => {
  try {
    downloadText(getExport(), `${$('slug').value}.md`, 'text/markdown;charset=utf-8');
    report('Article download requested. Check the saved Markdown file. Source notes and review questions are excluded. Nothing was published.');
  } catch (error) { report(error.message); }
});
async function copy(bodyOnly) {
  try {
    const content = getExport();
    await navigator.clipboard.writeText(bodyOnly ? $('body').value.trim() : content);
    report(bodyOnly ? 'Article body copied as Markdown without the title or metadata. Nothing was published.' : 'Article Markdown copied. Nothing was published.');
  } catch (error) { report(error.name === 'NotAllowedError' ? 'Clipboard unavailable. Download Markdown instead or select the text manually.' : (error.message || 'Clipboard unavailable. Use Download Markdown.')); }
}
$('copy').addEventListener('click', () => copy(false));
$('copy-body').addEventListener('click', () => copy(true));
$('clear').addEventListener('click', () => {
  if (recovery.reading()) return;
  if (hasWork() && !confirm('Clear the notes, article, and questions in this tab? Download a private backup first to keep unfinished work.')) return;
  fill({ source: { profile: 'personal', audience: '', purpose: '', notes: '' }, draft: null });
  $('backup-private-ok').checked = false; recovery.update();
  report('Writing desk cleared. Files already downloaded to your device are unchanged.');
});
// Re-entry from browser history must not silently restore approval.
window.addEventListener('pageshow', event => {
  if (event.persisted) { $('reviewed').checked = false; update(); report('Returned to the writing desk. Review again before exporting. There is no autosave.'); }
});
update();
report('Manual writing desk ready. You write and edit here; no AI generation, uploads, or automatic saving.');
