import { createMarkdown } from './markdown.js';
import { DRAFT_FIELDS } from './workspace.js';
import { installRecovery } from './recovery.js';
import { downloadText } from './download.js';
import { suggestFilename } from './preview.js';
import { installPreviewNavigation } from './preview-navigation.js';
import { articleIssues, articleBody, makeDraftingBrief } from './authoring.js';
import { createReadingPage } from './html-export.js';
import { TEMPLATES } from './content-data.js';
import { installArticleImport } from './import-controls.js';
import { formatMarkdown, loadEditingTool } from './editing.js';
import { installDraftReview } from './review-controls.js';
import { installPublishingExports } from './export-controls.js';
import { articleWordCount } from './draft-review.js';
import { installRevisions } from './revision-controls.js';
import { QUICK_SAMPLE } from './quick-sample.js';
import { ARTICLE_BODY_LIMIT } from './writing-limits.js';
import { installPasteGuard } from './paste-guard.js';
import { revealDetails } from './disclosure.js';
import { installWorkflowNavigation, focusWorkflowTarget } from './workflow-navigation.js';
import { installWorkspaceLayout } from './workspace-layout.js';
const htmlMarkdownTool = document.querySelector('.desk-intro')?.dataset.workspace === 'html-to-markdown';
const wordMarkdownTool = document.querySelector('.desk-intro')?.dataset.workspace === 'word-to-markdown';
const markdownTool = wordMarkdownTool || htmlMarkdownTool;
const wordImportTool = wordMarkdownTool || document.querySelector('.desk-intro')?.dataset.workspace === 'word-to-wordpress';
const copiedPasteTool = document.querySelector('.desk-intro')?.dataset.workspace === 'google-docs';
const wordpressTool = wordImportTool || copiedPasteTool || document.querySelector('.desk-intro')?.dataset.workspace === 'wordpress';
const htmlTool = document.querySelector('.desk-intro')?.dataset.workspace === 'html';
const wordTool = document.querySelector('.desk-intro')?.dataset.workspace === 'word';

const $ = id => document.getElementById(id);
const sourceFields = ['profile', 'audience', 'purpose', 'notes'];
let questions = [], recovery = null, workflow = null, importer = null, draftReview = null, publishingExports = null, revisions = null, articleSearch = null, revisionDiff = null, publishingProfiles = null, draftCollection = null, sourceReview = null, wordPressImages = null, imageEditor = null, linkEditor = null, tableEditor = null, previewNavigation = null, referenceLinks = null, browserRecovery = null;
const touched = new Set();
const report = message => { $('desk-status').textContent = message; };
const bodyPaste = installPasteGuard({ element: $('body'), limit: ARTICLE_BODY_LIMIT, label: 'The article', report: message => {
  $('body-paste-status').textContent = message;
  if (message) report(message);
} });
const warn = event => { event.preventDefault(); event.returnValue = ''; };
const capture = () => ({
  source: Object.fromEntries(sourceFields.map(id => [id, $(id).value])),
  draft: { ...Object.fromEntries(DRAFT_FIELDS.map(id => [id, $(id).value])), questions: [...questions] }
});
const hasWork = () => [...DRAFT_FIELDS, 'notes', 'audience', 'purpose'].some(id => $(id).value.length) || questions.length > 0 || Boolean(importer?.pending()) || Boolean(recovery?.pending()) || Boolean(revisions?.hasWriting()) || Boolean(publishingProfiles?.hasWork()) || Boolean(draftCollection?.hasWork()) || Boolean(sourceReview?.hasWork()) || Boolean(imageEditor?.hasWork()) || Boolean(linkEditor?.hasWork()) || Boolean(tableEditor?.hasWork());
function updateExitWarning() {
  window.removeEventListener('beforeunload', warn);
  if (hasWork()) window.addEventListener('beforeunload', warn);
}
const filename = () => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test($('slug').value) && $('slug').value.length <= 80 ? $('slug').value : suggestFilename($('title').value);
function update() {
  const value = capture();
  const words = articleWordCount($('body').value);
  $('body-count').textContent = words.toLocaleString() + ' approximate words; ' + $('body').value.length.toLocaleString() + ' / ' + ARTICLE_BODY_LIMIT.toLocaleString('en-US') + ' characters';
  $('description-count').textContent = $('description').value.length + ' / 160 characters';
  $('note-count').textContent = $('notes').value.length.toLocaleString() + ' / 8,000 characters';
  const issues = articleIssues(value.draft);
  const destination = $('publishing-destination').value;
  const needsTitle = destination === 'html' && $('html-include-title').checked || destination === 'word' && $('word-include-title').checked;
  for (const id of DRAFT_FIELDS) {
    const error = $(id + '-error');
    const optionalExportField = destination !== 'other' && id !== 'body' && !$(id).value.length && !(id === 'title' && needsTitle);
    const showError = !optionalExportField && Boolean(issues[id]) && (touched.has(id) || $(id).value.length > 0);
    error.textContent = issues[id] || ''; error.hidden = !showError;
    if (showError) $(id).setAttribute('aria-invalid', 'true'); else $(id).removeAttribute('aria-invalid');
  }
  const reviewed = $('reviewed').checked;
  for (const id of ['download', 'copy']) $(id).disabled = !reviewed || Object.keys(issues).length > 0;
  for (const id of ['copy-body', 'download-body']) $(id).disabled = !reviewed || Object.keys(articleIssues(value.draft, 'body')).length > 0;
  $('download-html').disabled = !reviewed || Object.keys(articleIssues(value.draft, 'html')).length > 0;
  const missing = Object.keys(issues).map(id => ({ title: 'title', body: 'article', excerpt: 'excerpt', description: 'description', slug: 'filename' })[id]);
  $('markdown-readiness').textContent = missing.length ? 'For page Markdown, complete: ' + missing.join(', ') + '.' : 'All page fields are complete. Choose how the title heading will be handled.';
  $('export-readiness').textContent = issues.body ? 'Add an article, review it, then choose how to take it with you.' : issues.title ? 'Body copying and downloading are available after review. Add a title for a reading page or publishing kit.' : 'After review, copy into an editor, take a reading page, or download a publishing kit. Open Markdown with page details for website Markdown.';
  if (!issues.body) {
    const destination = $('publishing-destination').value;
    if (destination === 'word') $('export-readiness').textContent = 'Read the preview, choose whether to include the title, then review and download Word. Page metadata can remain empty.';
    else if (destination === 'markdown') $('export-readiness').textContent = 'Read the preview, choose title handling, then review and copy or download article Markdown. Page metadata can remain empty.';
    else if (destination === 'html') $('export-readiness').textContent = 'Read the preview, choose title handling, then review and copy HTML source. Page metadata can remain empty.';
    else if (destination === 'wordpress') $('export-readiness').textContent = 'Read the preview and inspect the handoff findings, then review and copy WordPress blocks. Your title stays separate; page metadata is optional.';
  }
  $('load-outline').disabled = !$('template-select').value;
  const hasBody = Boolean(value.draft.body.trim());
  $('preview-empty').hidden = hasBody; $('article-preview').hidden = !hasBody;
  try { $('drafting-brief').value = makeDraftingBrief(value.source); }
  catch (error) { $('drafting-brief').value = error.message; }
  recovery?.update();
  previewNavigation?.refresh(); referenceLinks?.refresh();
  draftReview?.refresh();
  wordPressImages?.refresh();
  publishingExports?.update();
  publishingProfiles?.update();
  revisions?.update();
  articleSearch?.refresh();
  draftCollection?.update();
  sourceReview?.refresh();
  imageEditor?.refresh();
  linkEditor?.refresh();
  tableEditor?.refresh();
  importer?.updateBusy();
  workflow?.update();
  browserRecovery?.refresh();
}
function changed(event) {
  if (event?.target && DRAFT_FIELDS.includes(event.target.id)) touched.add(event.target.id);
  $('reviewed').checked = false;
  updateExitWarning();
  update();
  browserRecovery?.schedule();
}
function fill(value) {
  recovery?.clear();
  bodyPaste.clear();
  for (const id of sourceFields) $(id).value = value.source[id];
  for (const id of DRAFT_FIELDS) $(id).value = value.draft?.[id] ?? '';
  questions = value.draft?.questions ? [...value.draft.questions] : [];
  sourceReview?.clear();
  imageEditor?.clear();
  linkEditor?.clear();
  tableEditor?.clear();
  touched.clear(); renderQuestions(); setFocus(false);
  importer?.clear(); $('import-text').value = '';
  articleSearch?.clear();
  $('article-preview').replaceChildren(); previewNavigation?.clear(); referenceLinks?.clear();
  $('notes-panel').open = Boolean($('notes').value || questions.length);
  $('export-format').value = 'page';
  wordPressImages?.reset();
  publishingExports?.reset();
  publishingProfiles?.reset();
  changed(); $('body').focus();
}
recovery = installRecovery({ capture, restore: value => { if (!revisions) throw new Error('Revision recovery is unavailable. Current writing is unchanged.'); const result = revisions.captureBefore('Before workspace restore'); fill(value); return { checkpointed: Boolean(result.id), evicted: result.evicted }; }, hasWork, hasPendingImport: () => Boolean(importer?.pending()), workChanged: updateExitWarning, isBusy: () => Boolean(browserRecovery?.busy()) || Boolean(importer?.reading()), busyChanged: () => { importer?.updateBusy(); revisions?.update(); articleSearch?.refresh(); draftReview?.refresh(); publishingProfiles?.update(); draftCollection?.update(); sourceReview?.refresh(); imageEditor?.refresh(); linkEditor?.refresh(); tableEditor?.refresh(); wordPressImages?.refresh(); publishingExports?.update(); previewNavigation?.refresh(); referenceLinks?.refresh(); workflow?.update(); }, report });
previewNavigation = installPreviewNavigation({ getDraft: () => capture().draft, isBusy: () => recovery.reading() || Boolean(browserRecovery?.busy()) || Boolean(importer?.reading()), hasPendingImport: () => Boolean(importer?.pending()), report, selectReview: () => workflow?.select('review') });
for (const id of [...sourceFields, ...DRAFT_FIELDS]) $(id).addEventListener('input', changed);
for (const id of DRAFT_FIELDS) $(id).addEventListener('blur', () => { touched.add(id); update(); });
$('profile').addEventListener('change', changed);
$('reviewed').addEventListener('change', update);
$('preview-panel').addEventListener('toggle', update);
$('template-select').addEventListener('change', update);
$('export-format').addEventListener('change', changed);
$('start-notes').addEventListener('click', () => {
  if (recovery.reading() || browserRecovery?.busy() || importer?.reading()) return;
  workflow?.select('bring');
  setFocus(false); $('notes-panel').open = true; $('template-select').focus();
  report('Choose an outline or enter your own notes. No text is generated automatically.');
});
$('start-draft').addEventListener('click', () => {
  if (recovery.reading() || browserRecovery?.busy() || importer?.reading()) return;
  workflow?.select('bring');
  setFocus(true); $('notes-panel').open = false; focusWorkflowTarget($('body'), { bar: $('workflow-steps'), anchor: $('article-heading') });
  report(markdownTool ? 'Paste text or Markdown into the article body. Review, then copy or download the .md file. Page metadata is optional.' : wordTool ? 'Paste simple Markdown into the article body. Review the preview, then download Word. The title is optional unless you include it.' : htmlTool ? 'Paste simple Markdown into the article body. Review the preview, then copy HTML source. The title is optional unless you include it.' : wordpressTool ? 'Paste simple Markdown into the article body. Keep the post title separate. The reading preview updates as you edit.' : 'Paste or write your article. Page details can wait until you need a full Markdown export.');
});
function loadSample() {
  if (recovery.reading() || browserRecovery?.busy() || importer?.reading()) return;
  const existing = capture();
  if ((DRAFT_FIELDS.some(id => existing.draft[id].length) || importer?.pending() || sourceReview?.hasWork() || imageEditor?.hasWork() || linkEditor?.hasWork() || tableEditor?.hasWork()) && !confirm('Replace the current article with a fictional sample? A checkpoint keeps the current writing in this tab. Source notes and saved review questions are kept. Unsaved passage review, image preparation, link preparation, and table preparation are discarded. Save a private backup to keep them after leaving.')) return;
  try { revisions?.captureBefore('Before fictional sample'); } catch (error) { report(error.message); return; }
  fill({ source: existing.source, draft: { ...QUICK_SAMPLE, questions: existing.draft.questions } });
  setFocus(true); $('preview-panel').open = true; update(); workflow?.review();
  report('Fictional sample loaded. Try the reading preview, review the article, then ' + (markdownTool ? 'copy or download Markdown' : wordTool ? 'download Word' : htmlTool ? 'copy HTML source' : 'copy WordPress blocks or choose another export') + '. Replace this sample before publishing.');
}
$('start-sample').addEventListener('click', loadSample);
function loadOutline(id) {
  const template = TEMPLATES.find(item => item.id === id);
  if (!template || recovery.reading() || browserRecovery?.busy() || importer?.reading()) return;
  if ($('notes').value && !confirm('Replace the source notes with this outline? Save any notes you want to keep first. The current article is kept.')) return;
  try { revisions?.captureBefore('Before outline replacement'); } catch (error) { report(error.message); return; }
  $('notes').value = template.outline; $('profile').value = template.profile;
  $('template-select').value = template.id; setFocus(false); $('notes-panel').open = true;
  changed(); $('notes').focus();
  report('Outline loaded locally. Replace its prompts with your own facts. The existing article is kept; compare it with the new notes before approving.');
}
$('load-outline').addEventListener('click', () => loadOutline($('template-select').value));
function followFragment() {
  const hash = window.location.hash;
  if (hash.startsWith('#template-')) loadOutline(hash.slice('#template-'.length));
  else if (hash === '#notes') $('start-notes').click();
  else if (hash === '#draft') $('start-draft').click();
  else if (['#exports', '#export-heading'].includes(hash)) workflow?.handoff();
  else if (['#conversion-results', '#conversion-heading', '#preview-panel', '#article-preview'].includes(hash)) workflow?.review();
  else if (hash === '#sample') loadSample();
  else if (hash === '#table-editor-panel') { revealDetails($('table-editor-panel')); $('table-editor-panel').querySelector('summary').focus(); }
  else if (hash === '#link-editor-panel') { revealDetails($('link-editor-panel')); $('link-editor-panel').querySelector('summary').focus(); }
  else if (hash === '#image-editor-panel') { revealDetails($('image-editor-panel')); $('image-editor-panel').querySelector('summary').focus(); }
  else if (hash === '#source-review-panel') { revealDetails($('source-review-panel')); $('source-review-panel').querySelector('summary').focus(); }
}
window.addEventListener('hashchange', followFragment);
$('suggest-slug').addEventListener('click', () => {
  if (recovery.reading() || browserRecovery?.busy() || importer?.reading()) return;
  if ($('slug').value && !confirm('Replace the current filename with a suggestion from the title?')) return;
  try { revisions?.captureBefore('Before filename suggestion'); } catch (error) { report(error.message); return; }
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
  if (recovery.reading() || browserRecovery?.busy() || importer?.reading() || !publishingExports) return;
  await publishingExports.copyActions.run({ destination: $('publishing-destination').value, label: 'the selected writing', write: () => navigator.clipboard.writeText(content), success, fallback: 'Clipboard unavailable. Download the article or select and copy the visible text manually.' });
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
$('clear').addEventListener('click', async () => {
  if (recovery.reading() || browserRecovery?.busy() || importer?.reading()) return;
  if ((hasWork() || browserRecovery?.state().available) && !confirm('Clear the notes, article, questions, backup preview, unsaved passage review, image preparation, link preparation, and table preparation, publishing profile, private draft collection, collection undo, ALL checkpoints in this tab, and the recovery copy stored in this browser? Download a private backup and collection first to keep saved writing. Unsaved preparation is excluded from files. This cannot be undone in the workspace.')) return;
  const clearWorkspaceKey = JSON.stringify(capture());
  if (browserRecovery && !await browserRecovery.removeForClear()) { report('Clear was cancelled because browser recovery could not be removed safely. Current writing is kept. Check its recovery status.'); return; }
  if (recovery.reading() || browserRecovery?.busy() || importer?.reading() || JSON.stringify(capture()) !== clearWorkspaceKey) { report('Writing changed while clearing was prepared. Current writing was kept.'); return; }
  revisions?.clear();
  draftCollection?.clear();
  fill({ source: { profile: 'personal', audience: '', purpose: '', notes: '' }, draft: null });
  $('template-select').value = '';
  $('backup-private-ok').checked = false; recovery.clear(); update();
  report('Writing desk, backup preview, private collection, collection undo, and all in-tab checkpoints cleared. Files already downloaded to your device are unchanged.');
});
function setFocus(active) {
  $('main').classList.toggle('desk-focus', active);
  document.querySelector('.source-editor').hidden = active;
  $('toggle-focus').setAttribute('aria-pressed', String(active));
  $('toggle-focus').textContent = active ? 'Show source & review' : 'Focus on article';
}
$('toggle-focus').addEventListener('click', () => setFocus($('toggle-focus').getAttribute('aria-pressed') !== 'true'));
for (const button of document.querySelectorAll('[data-format]')) button.addEventListener('click', () => {
  if (recovery.reading() || browserRecovery?.busy() || importer?.reading()) return;
  try {
    const result = formatMarkdown($('body').value, $('body').selectionStart, $('body').selectionEnd, button.dataset.format);
    revisions?.captureBefore('Before ' + button.textContent.toLowerCase() + ' formatting');
    $('body').value = result.body; $('body').focus(); $('body').setSelectionRange(result.selectionStart, result.selectionEnd);
    touched.add('body'); changed(); report('Formatting applied locally. Previous writing is available in Revisions in this tab. Review approval was cleared.');
  } catch (error) { report(error.message); }
});
function renderQuestions() {
  $('questions').replaceChildren(...questions.map((text, index) => {
    const item = document.createElement('li');
    const label = document.createElement('label'); label.htmlFor = 'review-question-' + index; label.textContent = 'Review note ' + (index + 1);
    const input = document.createElement('textarea'); input.id = label.htmlFor; input.rows = 3; input.maxLength = 500; input.value = text;
    input.addEventListener('input', () => { questions[index] = input.value; changed(); });
    const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'secondary'; remove.textContent = 'Remove note ' + (index + 1);
    remove.addEventListener('click', () => {
      if (recovery.reading() || browserRecovery?.busy() || importer?.reading()) return;
      try { revisions?.captureBefore('Before removing a review note'); } catch (error) { report(error.message); return; }
      questions.splice(index, 1); renderQuestions(); changed();
      $('add-question').focus(); report('Review note removed from this workspace. Downloaded backups are unchanged.');
    });
    item.append(label, input, remove); return item;
  }));
  $('question-count').textContent = questions.length + ' / 12 review notes; up to 500 characters each';
  $('add-question').disabled = questions.length >= 12;
  $('copy-questions').disabled = questions.length === 0;
  if (questions.length) $('review-panel').open = true;
}
$('add-question').addEventListener('click', () => {
  if (questions.length >= 12) return;
  questions.push(''); renderQuestions(); changed();
  $('questions').lastElementChild.querySelector('textarea').focus();
});
$('copy-questions').addEventListener('click', () => copy(questions.map(text => '- ' + text).join('\n'), 'Review notes copied locally. They are excluded from article exports.'));
importer = installArticleImport({
  focusPreview: wordImportTool || copiedPasteTool || htmlMarkdownTool, pasteFirst: copiedPasteTool,
  focusImportPreview: heading => focusWorkflowTarget(heading, { bar: $('workflow-steps') }),
  workChanged: () => { updateExitWarning(); previewNavigation?.refresh(); referenceLinks?.refresh(); workflow?.update(); },
  hasArticle: () => DRAFT_FIELDS.some(id => $(id).value.length) || questions.length > 0 || Boolean(sourceReview?.hasWork()) || Boolean(imageEditor?.hasWork()) || Boolean(linkEditor?.hasWork()) || Boolean(tableEditor?.hasWork()),
  isBusy: () => recovery.reading() || Boolean(browserRecovery?.busy()), busyChanged: () => { recovery.update(); revisions?.update(); articleSearch?.refresh(); draftReview?.refresh(); publishingProfiles?.update(); draftCollection?.update(); sourceReview?.refresh(); imageEditor?.refresh(); linkEditor?.refresh(); tableEditor?.refresh(); wordPressImages?.refresh(); publishingExports?.update(); previewNavigation?.refresh(); referenceLinks?.refresh(); workflow?.update(); }, report,
  applyInsertion: plan => {
    revisions.captureBefore('Before article insertion');
    $('body').value = plan.body; touched.add('body'); changed();
    $('body').focus(); $('body').setSelectionRange(plan.selectionStart, plan.selectionEnd);
  },
  apply: draft => {
    revisions?.captureBefore('Before article import');
    for (const id of DRAFT_FIELDS) $(id).value = draft[id];
    articleSearch?.clear(); previewNavigation?.clear(); referenceLinks?.clear();
    questions = [...draft.questions]; touched.clear(); renderQuestions(); setFocus(false);
    sourceReview?.clear();
    imageEditor?.clear();
    linkEditor?.clear();
    tableEditor?.clear();
    wordPressImages?.reset();
    if (!publishingProfiles?.hasSetup()) $('export-format').value = markdownTool ? 'document' : 'page';
    if (wordImportTool || copiedPasteTool || htmlMarkdownTool) $('import-panel').open = false;
    changed(); focusWorkflowTarget($('body'), { bar: $('workflow-steps'), anchor: $('article-heading') });
  }
});
$('start-import').addEventListener('click', () => { if (recovery.reading() || browserRecovery?.busy() || importer?.reading()) return; workflow?.select('bring'); $('import-panel').open = true; revealDetails($('import-file')); $('import-file').focus(); });
$('start-insert-import').addEventListener('click', () => { workflow?.select('bring'); importer.openInsertion(); });
$('start-formatted-import').addEventListener('click', () => { workflow?.select('bring'); importer.openFormatted(); });
$('start-word-file')?.addEventListener('click', () => { workflow?.select('bring'); importer.openWordFile(); });
$('start-copied-paste')?.addEventListener('click', () => { workflow?.select('bring'); importer.openCopied(); });
$('import-text').addEventListener('input', () => {
  updateExitWarning();
});
renderQuestions();
draftReview = installDraftReview({
  getCopyActions: () => publishingExports?.copyActions,
  getDraft: () => capture().draft, editLink: (start, end) => linkEditor?.editLink(start, end) ?? false, isBusy: () => recovery.reading() || Boolean(browserRecovery?.busy()) || Boolean(importer?.reading()), report,
  applySectionMove: (plan, label) => {
    revisions.captureBefore(label);
    $('body').value = plan.body; touched.add('body'); changed();
    $('body').setSelectionRange(plan.selectionStart, plan.selectionEnd);
  }
});
publishingExports = installPublishingExports({ getDraft: () => capture().draft, getCopySnapshot: capture, copyChanged: () => draftReview?.refresh(), getWordPressOptions: () => ({ includeLinkedImages: wordPressImages?.enabled() ?? false }), approved, changed, report, isBusy: () => recovery.reading() || Boolean(browserRecovery?.busy()) || Boolean(importer?.reading()), defaultDestination: markdownTool ? 'markdown' : wordTool ? 'word' : htmlTool ? 'html' : 'wordpress', compact: wordTool || htmlTool || wordpressTool || markdownTool });
loadEditingTool(() => import('./reference-link-controls.js'), ({ installReferenceLinks }) => {
  referenceLinks = installReferenceLinks({ getBody: () => $('body').value, getTitle: () => $('title').value, apply: (body, label) => {
    revisions.captureBefore(label);
    $('body').value = body; touched.add('body'); changed();
  }, isBusy: () => recovery.reading() || Boolean(browserRecovery?.busy()) || Boolean(importer?.reading()), hasPendingImport: () => Boolean(importer?.pending()), onApplied: () => workflow?.review(), report });
}, () => {
  $('reference-links-panel').hidden = false;
  $('reference-status').textContent = 'Reference-link preparation could not load. Edit references directly as inline Markdown links. Your writing and other tools are kept.';
});
loadEditingTool(() => import('./wordpress-image-controls.js'), ({ installWordPressImages }) => {
  wordPressImages = installWordPressImages({ getDraft: () => capture().draft, changed, report, editImage: (start, end) => imageEditor?.editImage(start, end) ?? false, isBusy: () => recovery.reading() || Boolean(browserRecovery?.busy()) || Boolean(importer?.reading()) });
}, () => {
  $('wordpress-image-status').textContent = 'Image preparation could not load. Images remain literal text in WordPress blocks. Your writing and other exports are kept.';
});
loadEditingTool(() => import('./publishing-profile-controls.js'), ({ installPublishingProfiles }) => {
  publishingProfiles = installPublishingProfiles({ getWorkspace: capture, resetLinkedImages: () => wordPressImages?.reset(), changed, workChanged: updateExitWarning, isBusy: () => recovery.reading() || Boolean(browserRecovery?.busy()) || Boolean(importer?.reading()), report });
}, () => {
  $('publishing-profile-status').textContent = 'Publishing profiles could not load in this browser. Continue using the destination and title choices directly. Your writing is kept.';
});
revisions = installRevisions({ capture, restore: fill, isBusy: () => recovery.reading() || Boolean(browserRecovery?.busy()) || Boolean(importer?.reading()), workChanged: updateExitWarning, report, comparisonChanged: () => revisionDiff?.refresh() });
loadEditingTool(() => import('./table-editor-controls.js'), ({ installTableEditor }) => {
  tableEditor = installTableEditor({ getBody: () => $('body').value, apply: (plan, label) => {
    revisions.captureBefore(label);
    $('body').value = plan.body; touched.add('body'); changed();
  }, isBusy: () => recovery.reading() || Boolean(browserRecovery?.busy()) || Boolean(importer?.reading()), workChanged: updateExitWarning, report });
}, () => {
  $('table-editor-status').textContent = 'Table editor could not load. Edit table Markdown directly in the article. Your writing and exports are kept.';
});
loadEditingTool(() => import('./link-editor-controls.js'), ({ installLinkEditor }) => {
  linkEditor = installLinkEditor({ getBody: () => $('body').value, apply: (plan, label) => {
    revisions.captureBefore(label);
    $('body').value = plan.body; touched.add('body'); changed();
  }, isBusy: () => recovery.reading() || Boolean(browserRecovery?.busy()) || Boolean(importer?.reading()), workChanged: updateExitWarning, report });
}, () => {
  $('link-editor-status').textContent = 'Link editor could not load. Edit link Markdown directly in the article. Your writing and exports are kept.';
});
loadEditingTool(() => import('./image-editor-controls.js'), ({ installImageEditor }) => {
  imageEditor = installImageEditor({ getBody: () => $('body').value, apply: (plan, label) => {
    revisions.captureBefore(label);
    $('body').value = plan.body; touched.add('body'); changed();
  }, isBusy: () => recovery.reading() || Boolean(browserRecovery?.busy()) || Boolean(importer?.reading()), workChanged: updateExitWarning, report });
}, () => {
  $('image-editor-status').textContent = 'Image editor could not load. Edit image Markdown directly in the article. Your writing and exports are kept.';
});
loadEditingTool(() => import('./source-review-controls.js'), ({ installSourceReview }) => {
  sourceReview = installSourceReview({ getWorkspace: capture, applyNotes: (notes, label) => { revisions.captureBefore(label); questions = [...notes]; renderQuestions(); changed(); }, showSource: () => { setFocus(false); $('notes-panel').open = true; $('notes').focus(); }, isBusy: () => recovery.reading() || Boolean(browserRecovery?.busy()) || Boolean(importer?.reading()), workChanged: updateExitWarning, report });
  $('start-source-review').disabled = false;
  $('start-source-review').addEventListener('click', () => { revealDetails($('source-review-panel')); $('pin-review-passage').click(); });
}, () => {
  $('source-review-status').textContent = 'Passage review could not load. Use ordinary private review notes under Source notes & review. Your writing is kept.';
});
loadEditingTool(() => import('./draft-collection-controls.js'), ({ installDraftCollection }) => {
  draftCollection = installDraftCollection({ capture, hasUnsavedPreparation: () => Boolean(sourceReview?.hasWork()) || Boolean(imageEditor?.hasWork()) || Boolean(linkEditor?.hasWork()) || Boolean(tableEditor?.hasWork()), openWorkspace: value => { revisions.captureBefore('Before opening a saved article'); fill(value); }, isBusy: () => recovery.reading() || Boolean(browserRecovery?.busy()) || Boolean(importer?.reading()), workChanged: updateExitWarning, report });
}, () => {
  $('draft-collection-status').textContent = 'Draft collections could not load in this browser. Use single-workspace backups to keep writing. Your current work is unchanged.';
});
// An optional editing tool must not block the core writing/recovery workspace.
loadEditingTool(() => import('./revision-diff-controls.js'), ({ installRevisionDiff }) => {
  revisionDiff = installRevisionDiff({ getComparison: () => revisions.articleComparison() });
}, () => {
  $('article-diff-status').textContent = 'Article changes could not load in this browser. Use the complete saved/current field comparison below. Your writing is kept.';
});
loadEditingTool(() => import('./search-controls.js'), ({ installArticleSearch }) => {
  articleSearch = installArticleSearch({
    isBusy: () => recovery.reading() || Boolean(browserRecovery?.busy()) || Boolean(importer?.reading()), report,
    apply: (plan, label) => {
      revisions.captureBefore(label);
      $('body').value = plan.body; touched.add('body'); changed();
      $('body').focus(); $('body').setSelectionRange(plan.selectionStart, plan.selectionEnd);
    }
  });
  $('start-find').disabled = false;
}, () => {
  $('start-find').disabled = true;
  $('find-status').textContent = 'Find and replace could not load in this browser. Continue editing the article directly. Your writing is kept.';
});
window.addEventListener('pageshow', event => {
  if (event.persisted) { $('reviewed').checked = false; update(); report('Returned to the writing desk. Review again before exporting. Browser recovery is off unless enabled in this tab.'); }
});
installWorkspaceLayout();
workflow = installWorkflowNavigation({
  getDraft: () => capture().draft,
  getImportState: () => ({ pending: Boolean(importer?.pending()), staged: Boolean(importer?.staged()) }),
  isBusy: () => recovery.reading() || Boolean(browserRecovery?.busy()) || Boolean(importer?.reading()), refreshPreview: update, report
});
await loadEditingTool(() => import('./browser-recovery.js'), ({ installBrowserRecovery }) => {
  browserRecovery = installBrowserRecovery({ capture, hasWork,
    stateChanged: () => { update(); updateExitWarning(); },
    isBusy: () => recovery.reading() || Boolean(importer?.reading()) || Boolean(importer?.pending()),
    restore: value => {
      if (!revisions) throw new Error('Revision recovery is unavailable. Current writing is unchanged.');
      revisions.captureBefore('Before browser recovery restore'); fill(value);
      report('Reviewed browser copy restored. Export approval is cleared. Saving resumes in this tab only; keep a downloaded private backup.');
    }
  });
}, () => { $('browser-recovery-status').textContent = 'Browser recovery could not load. Writing stays in this tab; download a private backup before leaving.'; });
setFocus(true); update();
report(htmlMarkdownTool ? 'HTML to Markdown tool ready. Paste HTML source or choose an HTML file, then preview before importing. Save explicitly before leaving.' : copiedPasteTool ? 'Copied-writing tool ready. Paste a Google Docs selection into the import box to preview before applying. Save explicitly before leaving.' : wordImportTool ? 'Word to ' + (markdownTool ? 'Markdown' : 'WordPress') + ' tool ready. Choose a .docx to preview locally before importing. Save explicitly before leaving.' : wordTool ? 'Markdown to Word tool ready. Paste your body or try the fictional sample. Save explicitly before leaving.' : htmlTool ? 'Markdown to HTML tool ready. Paste your body or try the fictional sample. Save explicitly before leaving.' : wordpressTool ? 'Markdown to WordPress tool ready. Paste your body or try the fictional sample. Save explicitly before leaving.' : 'Writing workspace ready. Edit locally and save explicitly. No AI request or upload is made here.');
followFragment();
