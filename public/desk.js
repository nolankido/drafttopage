import { createMarkdown } from './markdown.js';
import { DRAFT_FIELDS } from './workspace.js';
import { installRecovery } from './recovery.js';
import { downloadText } from './download.js';
import { renderPreview, suggestFilename } from './preview.js';
import { articleIssues, articleBody, makeDraftingBrief } from './authoring.js';
import { createReadingPage } from './html-export.js';
import { TEMPLATES } from './content-data.js';

const $ = id => document.getElementById(id);
const sourceFields = ['profile', 'audience', 'purpose', 'notes'];
let questions = [];
const report = message => { $('desk-status').textContent = message; };
const warn = event => { event.preventDefault(); event.returnValue = ''; };
const capture = () => ({
  source: Object.fromEntries(sourceFields.map(id => [id, $(id).value])),
  draft: { ...Object.fromEntries(DRAFT_FIELDS.map(id => [id, $(id).value])), questions: [...questions] }
});
const hasWork = () => [...DRAFT_FIELDS, 'notes', 'audience', 'purpose'].some(id => $(id).value.length) || questions.length > 0;
const filename = () => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test($('slug').value) && $('slug').value.length <= 80 ? $('slug').value : suggestFilename($('title').value);
function update() {
  const value = capture();
  const body = $('body').value.trim();
  const words = body ? body.split(/\s+/u).length : 0;
  $('body-count').textContent = words.toLocaleString() + ' approximate words; ' + $('body').value.length.toLocaleString() + ' / 12,000 characters';
  $('description-count').textContent = $('description').value.length + ' / 160 characters';
  $('note-count').textContent = $('notes').value.length.toLocaleString() + ' / 8,000 characters';
  const issues = articleIssues(value.draft);
  for (const id of DRAFT_FIELDS) {
    const error = $(id + '-error');
    error.textContent = issues[id] || ''; error.hidden = !issues[id];
    if (issues[id]) $(id).setAttribute('aria-invalid', 'true'); else $(id).removeAttribute('aria-invalid');
  }
  const reviewed = $('reviewed').checked;
  for (const id of ['download', 'copy']) $(id).disabled = !reviewed || Object.keys(issues).length > 0;
  for (const id of ['copy-body', 'download-body']) $(id).disabled = !reviewed || Object.keys(articleIssues(value.draft, 'body')).length > 0;
  $('download-html').disabled = !reviewed || Object.keys(articleIssues(value.draft, 'html')).length > 0;
  const missing = Object.keys(issues).map(id => ({ title: 'title', body: 'article', excerpt: 'excerpt', description: 'description', slug: 'filename' })[id]);
  $('export-readiness').textContent = missing.length ? 'For page Markdown, complete: ' + missing.join(', ') + '. Body export needs only the article; a reading page also needs a title.' : 'Page details complete. Review the article, then choose an export.';
  $('load-outline').disabled = !$('template-select').value;
  try { $('drafting-brief').value = makeDraftingBrief(value.source); }
  catch (error) { $('drafting-brief').value = error.message; }
  if ($('preview-panel').open) renderPreview($('article-preview'), $('title').value, $('body').value);
}
function changed() {
  $('reviewed').checked = false;
  window.removeEventListener('beforeunload', warn);
  if (hasWork()) window.addEventListener('beforeunload', warn);
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
  $('notes-panel').open = Boolean($('notes').value || questions.length);
  $('export-format').value = 'page';
  changed(); $('body').focus();
}
const recovery = installRecovery({ capture, restore: fill, hasWork, isBusy: () => false, report });
for (const id of [...sourceFields, ...DRAFT_FIELDS]) $(id).addEventListener('input', changed);
$('profile').addEventListener('change', changed);
$('reviewed').addEventListener('change', update);
$('preview-panel').addEventListener('toggle', update);
$('template-select').addEventListener('change', update);
$('export-format').addEventListener('change', changed);
$('start-notes').addEventListener('click', () => {
  $('notes-panel').open = true; $('template-select').focus();
  report('Choose an outline or enter your own notes. No text is generated automatically.');
});
$('start-draft').addEventListener('click', () => {
  $('notes-panel').open = false; $('body').focus();
  report('Paste or write your article. Page details can wait until you need a full Markdown export.');
});
function loadOutline(id) {
  const template = TEMPLATES.find(item => item.id === id);
  if (!template || recovery.reading()) return;
  if ($('notes').value && !confirm('Replace the source notes with this outline? Save any notes you want to keep first. The current article is kept.')) return;
  $('notes').value = template.outline; $('profile').value = template.profile;
  $('template-select').value = template.id; $('notes-panel').open = true;
  changed(); $('notes').focus();
  report('Outline loaded locally. Replace its prompts with your own facts. The existing article is kept; compare it with the new notes before approving.');
}
$('load-outline').addEventListener('click', () => loadOutline($('template-select').value));
function followFragment() {
  const hash = window.location.hash;
  if (hash.startsWith('#template-')) loadOutline(hash.slice('#template-'.length));
  else if (hash === '#notes') $('start-notes').click();
  else if (hash === '#draft') $('start-draft').click();
}
window.addEventListener('hashchange', followFragment);
$('suggest-slug').addEventListener('click', () => {
  if ($('slug').value && !confirm('Replace the current filename with a suggestion from the title?')) return;
  $('slug').value = suggestFilename($('title').value); changed();
  report('Filename suggested locally. Review it before exporting.');
});
function approved() {
  if (!$('reviewed').checked) throw new Error('Review the article and check the approval box first.');
}
const getExport = () => {
  approved();
  return createMarkdown(capture().draft, { includeTitleHeading: $('export-format').value === 'document' });
};
$('download').addEventListener('click', () => {
  try {
    downloadText(getExport(), filename() + '.md', 'text/markdown;charset=utf-8');
    report('Page Markdown download requested. Check the saved file and title handling in your destination. Notes and questions are excluded. Nothing was published.');
  } catch (error) { report(error.message); }
});
$('download-body').addEventListener('click', () => {
  try { approved(); downloadText(articleBody(capture().draft) + '\n', filename() + '.md', 'text/markdown;charset=utf-8'); report('Article body download requested, without a title or metadata. Check the saved file. Nothing was published.'); }
  catch (error) { report(error.message); }
});
$('download-html').addEventListener('click', () => {
  try {
    approved(); downloadText(createReadingPage(capture().draft), filename() + '.html', 'text/html;charset=utf-8');
    report('Reading page download requested. Open the saved HTML file in your browser to inspect it. Notes and questions are excluded. Nothing was published.');
  } catch (error) { report(error.message); }
});
async function copy(content, success) {
  try { await navigator.clipboard.writeText(content); report(success); }
  catch { report('Clipboard unavailable. Download the article or select and copy the visible text manually.'); }
}
$('copy').addEventListener('click', () => { try { copy(getExport(), 'Page Markdown copied. Nothing was published.'); } catch (error) { report(error.message); } });
$('copy-body').addEventListener('click', () => {
  try { approved(); copy(articleBody(capture().draft), 'Article body copied as Markdown without a title or metadata. Nothing was published.'); }
  catch (error) { report(error.message); }
});
$('copy-brief').addEventListener('click', () => {
  try { copy(makeDraftingBrief(capture().source), 'Drafting brief copied. No AI request was made. Review your chosen tool before sending the material there.'); }
  catch (error) { report(error.message); $('notes').focus(); }
});
$('clear').addEventListener('click', () => {
  if (recovery.reading()) return;
  if (hasWork() && !confirm('Clear the notes, article, and questions in this tab? Download a private backup first to keep unfinished work.')) return;
  fill({ source: { profile: 'personal', audience: '', purpose: '', notes: '' }, draft: null });
  $('template-select').value = '';
  $('backup-private-ok').checked = false; recovery.update(); update();
  report('Writing desk cleared. Files already downloaded to your device are unchanged.');
});
window.addEventListener('pageshow', event => {
  if (event.persisted) { $('reviewed').checked = false; update(); report('Returned to the writing desk. Review again before exporting. There is no autosave.'); }
});
update();
report('Writing workspace ready. Edit locally and save explicitly. No AI request or upload is made here.');
followFragment();
