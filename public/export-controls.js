import { articleIssues } from './authoring.js';
import { createFormattedArticle } from './html-export.js';
import { publishingKitFiles, createPublishingKit } from './publishing-kit.js';
import { downloadText } from './download.js';
import { createWordPressArticle } from './wordpress-export.js';
import { suggestFilename } from './preview.js';
import { installWordPressHandoff } from './wordpress-handoff-controls.js';
import { installHTMLSource } from './html-source-controls.js';
import { installWordDocument } from './word-controls.js';
import { installMarkdownHandoff } from './markdown-handoff-controls.js';
import { installExportReview } from './export-review-controls.js';
import { installExportPreview } from './export-preview-controls.js';
import { createCopyActions } from './copy-actions.js';

export function installPublishingExports({ getDraft, approved, changed, report, isBusy = () => false, getWordPressOptions = () => ({}), getCopySnapshot = getDraft, copyChanged = () => {}, openFinding = null, defaultDestination = 'wordpress', compact = false }) {
  const $ = id => document.getElementById(id);
  $('publishing-destination').value = defaultDestination;
  $('additional-exports').open = !compact;
  const copies = createCopyActions({ snapshot: () => JSON.stringify([getCopySnapshot(), getWordPressOptions(), $('publishing-destination').value, $('reviewed').checked, $('export-format').value, $('copy-title').checked, $('html-include-title').checked, $('word-include-title').checked]), report, changed: () => { update(); copyChanged(); } });
  const reportAction = destination => message => copies.notice(message, destination);
  const handoff = installWordPressHandoff({ getDraft, approved, report, reportAction: reportAction('wordpress'), isBusy, getWordPressOptions, copyActions: copies, openFinding });
  const html = installHTMLSource({ getDraft, approved, changed, report: reportAction('html'), isBusy, copyActions: copies });
  const word = installWordDocument({ getDraft, approved, changed, report: reportAction('word'), isBusy });
  const markdown = installMarkdownHandoff({ getDraft, approved, changed, report: reportAction('markdown'), isBusy, copyActions: copies, defaultIncludeTitle: defaultDestination === 'markdown' });
  const destinationPreview = installExportPreview({ getDraft, getWordPressOptions, isBusy });
  const formattingReview = installExportReview({ getDraft, isBusy, report, copyActions: copies, openFinding });
  let kitSnapshot = null;
  const options = () => ({ includeTitleHeading: $('export-format').value === 'document' });
  function update() {
    const draft = getDraft(), reviewed = $('reviewed').checked;
    const copyState = copies.state(), copying = copyState.pending, destination = $('publishing-destination').value;
    for (const [target, ids] of Object.entries({ wordpress: ['wordpress-action-status', 'wordpress-fields-action-status'], html: ['html-source-action-status'], markdown: ['markdown-action-status'], word: ['word-action-status'], other: ['other-export-action-status'] })) {
      const message = destination !== target ? '' : copyState.feedback && copyState.destination === target ? copyState.feedback : copying ? 'A clipboard request is pending. Wait for confirmation; downloads remain available.' : '';
      for (const id of ids) if ($(id)) $(id).textContent = message;
    }
    for (const id of ['wordpress-actions', 'wordpress-field-actions', 'html-source-actions', 'markdown-actions', 'other-copy-actions']) $(id)?.setAttribute?.('aria-busy', String(copying));
    if ($('export-review-action-status')) $('export-review-action-status').textContent = ['word', 'html'].includes(destination) ? copyState.feedback && copyState.destination === destination ? copyState.feedback : copying ? 'A clipboard request is pending. Wait for confirmation; downloads remain available.' : '' : '';
    const wordpress = $('publishing-destination').value === 'wordpress';
    $('wordpress-handoff').hidden = !wordpress;
    let article = null;
    try { if (wordpress) article = createWordPressArticle(draft, getWordPressOptions()); } catch { /* Readiness below explains missing article. */ }
    $('copy-wordpress').disabled = copying || isBusy() || !reviewed || !article || !wordpress;
    $('download-wordpress').disabled = isBusy() || !reviewed || !article || !wordpress;
    $('copy-wordpress-title').disabled = copying || isBusy() || !reviewed || !wordpress || Boolean(articleIssues(draft, 'html').title);
    $('wordpress-readiness').textContent = !article ? 'Paste an article first. Page metadata is optional.' : article.blockCount + ' top-level blocks prepared locally. ' + (reviewed ? 'Copy or download, then inspect them in WordPress.' : 'Review your reading preview, then check the approval box to copy or download.') + (articleIssues(draft, 'html').title ? ' Add a title separately in WordPress.' : ' Your title stays separate from the body.');
    $('wordpress-notices').replaceChildren(...(article?.notices || []).map(text => { const li = document.createElement('li'); li.textContent = text; return li; }));
    // Clear hidden or unapproved output immediately after edits, restore, or clear.
    $('wordpress-code-preview').value = !isBusy() && wordpress && reviewed && $('wordpress-code-panel').open ? article?.html || '' : '';
    handoff.update();
    html.update();
    word.update();
    markdown.update();
    formattingReview.update();
    destinationPreview.update();
    $('copy-formatted').disabled = copying || isBusy() || !reviewed || Object.keys(articleIssues(draft, $('copy-title').checked ? 'html' : 'body')).length > 0;
    if ($('copy')) $('copy').disabled = copying || isBusy() || !reviewed || Object.keys(articleIssues(draft)).length > 0;
    if ($('copy-body')) $('copy-body').disabled = copying || isBusy() || !reviewed || Object.keys(articleIssues(draft, 'body')).length > 0;
    if ($('copy-brief')) $('copy-brief').disabled = copying || isBusy();
    if ($('copy-questions')) $('copy-questions').disabled = copying || isBusy() || !draft.questions?.length;
    let kit = null, error = '';
    try { if ($('additional-exports').open) kit = publishingKitFiles(draft, options()); }
    catch (failure) { error = failure.message; }
    $('download-kit').disabled = !reviewed || !kit;
    $('kit-readiness').textContent = !$('additional-exports').open ? '' : kit ? 'Includes ' + kit.files.length + ' files. ' + (kit.notices.join(' ') || 'All page fields are complete.') : 'Add a valid title and article for a publishing kit. ' + error;
    if ($('additional-exports').open && $('publishing-kit-panel').open) {
      const snapshot = JSON.stringify([kit?.filename, kit?.files.map(file => [file.name, file.purpose]), kit?.notices, error]);
      if (snapshot !== kitSnapshot) {
        kitSnapshot = snapshot;
        $('kit-files').replaceChildren(...(kit?.files || []).map(file => {
          const item = document.createElement('li'), name = document.createElement('code'); name.textContent = file.name;
          item.append(name, document.createTextNode(': ' + file.purpose)); return item;
        }));
      }
    } else { kitSnapshot = null; $('kit-files').replaceChildren(); }
  }
  $('publishing-kit-panel').addEventListener('toggle', update);
  $('additional-exports').addEventListener('toggle', update);
  $('wordpress-code-panel').addEventListener('toggle', update);
  $('publishing-destination').addEventListener('change', () => { if ($('publishing-destination').value === 'other') $('additional-exports').open = true; changed(); });
  $('copy-title').addEventListener('change', changed);
  $('copy-formatted').addEventListener('click', async () => {
    if (isBusy()) return;
    const includeTitle = $('copy-title').checked;
    await copies.run({ destination: $('publishing-destination').value, label: 'the formatted article', write: () => {
      approved(); const article = createFormattedArticle(getDraft(), { includeTitle });
      if (typeof ClipboardItem !== 'function' || typeof navigator.clipboard?.write !== 'function') throw new Error('Formatted clipboard support unavailable.');
      return navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([article.html], { type: 'text/html' }), 'text/plain': new Blob([article.text], { type: 'text/plain' }) })]);
    }, success: 'Formatted article copied' + (includeTitle ? ' with its title' : ' without its title') + '. Paste into an editor that accepts formatted text, then check headings, links, and title handling. Nothing was published.', fallback: 'Formatted copy unavailable. Use Copy article body or Download reading page, or select visible preview text manually. Your writing is kept.' });
  });
  $('download-kit').addEventListener('click', () => {
    if (!$('additional-exports').open || isBusy()) return;
    try {
      approved(); const kit = createPublishingKit(getDraft(), options());
      downloadText(kit.bytes, kit.filename, 'application/zip');
      report('Publishing kit download requested with ' + kit.files.length + ' article files. Extract and inspect them before sharing. Source notes and private review notes are excluded. Nothing was uploaded or published.');
    } catch (error) { report(error.message); }
  });
  $('copy-wordpress').addEventListener('click', async () => {
    if (isBusy() || $('publishing-destination').value !== 'wordpress') return;
    const copied = await copies.run({ destination: 'wordpress', label: 'WordPress blocks', write: () => {
      approved(); const article = createWordPressArticle(getDraft(), getWordPressOptions());
      return navigator.clipboard.writeText(article.html);
    }, success: 'WordPress blocks copied without a title or page fields. In a new, empty WordPress draft, click the empty paragraph below the title in Visual editor and paste normally with Ctrl+V or Command+V. Inspect the blocks, save as a draft, then close and reopen it. Selected linked image URLs can load there. Nothing was published.', fallback: 'WordPress copy unavailable. Download the blocks or open Inspect or manually copy the approved blocks.' });
    if (copied && $('wordpress-instructions')) $('wordpress-instructions').open = true;
  });
  $('download-wordpress').addEventListener('click', () => {
    if (isBusy() || $('publishing-destination').value !== 'wordpress') return;
    try {
      approved(); const draft = getDraft(), article = createWordPressArticle(draft, getWordPressOptions());
      downloadText(article.html, suggestFilename(draft.title) + '-wordpress.html', 'text/html;charset=utf-8');
      copies.notice('WordPress blocks download requested. Open the file in a text editor, copy the complete source including block comments, then paste normally into the empty paragraph below the title of a new WordPress draft in Visual editor. If raw source appears, use the full post Code editor fallback, then return to Visual editor. Opening the file in a browser shows its reading view' + (article.imageCount ? ' and can load linked images' : '') + '. Nothing was published.', 'wordpress');
    } catch (error) { copies.notice(error.message, 'wordpress'); }
  });
  $('copy-wordpress-title').addEventListener('click', async () => {
    if (isBusy() || $('publishing-destination').value !== 'wordpress') return;
    await copies.run({ destination: 'wordpress', label: 'the title', write: () => { approved(); const draft = getDraft(); if (articleIssues(draft, 'html').title) throw new Error('Add a valid title first.'); return navigator.clipboard.writeText(draft.title.trim()); }, success: 'Title copied separately. Paste into the WordPress title field. Nothing was published.', fallback: 'Title copy unavailable. Select the article title and copy it manually.' });
  });
  return { update, copyActions: copies, reset: () => { destinationPreview.reset(); formattingReview.reset(); handoff.reset(); html.reset(); markdown.reset(); $('copy-title').checked = false; $('publishing-destination').value = defaultDestination; $('additional-exports').open = !compact; word.reset(); $('wordpress-code-preview').value = ''; kitSnapshot = null; $('kit-files').replaceChildren(); copies.state(); } };
}
