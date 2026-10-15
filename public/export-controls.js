import { articleIssues } from './authoring.js';
import { createFormattedArticle } from './html-export.js';
import { publishingKitFiles, createPublishingKit } from './publishing-kit.js';
import { downloadText } from './download.js';
import { createWordPressArticle } from './wordpress-export.js';
import { suggestFilename } from './preview.js';
import { installWordPressHandoff } from './wordpress-handoff-controls.js';
import { installHTMLSource } from './html-source-controls.js';
import { installWordDocument } from './word-controls.js';

export function installPublishingExports({ getDraft, approved, changed, report, isBusy = () => false, getWordPressOptions = () => ({}), defaultDestination = 'wordpress', compact = false }) {
  const $ = id => document.getElementById(id);
  $('publishing-destination').value = defaultDestination;
  $('additional-exports').open = !compact;
  const handoff = installWordPressHandoff({ getDraft, approved, report, isBusy, getWordPressOptions });
  const html = installHTMLSource({ getDraft, approved, changed, report, isBusy });
  const word = installWordDocument({ getDraft, approved, changed, report, isBusy });
  let kitSnapshot = null;
  const options = () => ({ includeTitleHeading: $('export-format').value === 'document' });
  function update() {
    const draft = getDraft(), reviewed = $('reviewed').checked;
    const wordpress = $('publishing-destination').value === 'wordpress';
    $('wordpress-handoff').hidden = !wordpress;
    for (const id of ['wordpress-primary-review', 'wordpress-primary-actions']) if ($(id)) $(id).hidden = !wordpress;
    let article = null;
    try { if (wordpress) article = createWordPressArticle(draft, getWordPressOptions()); } catch { /* Readiness below explains missing article. */ }
    for (const id of ['copy-wordpress', 'download-wordpress']) $(id).disabled = isBusy() || !reviewed || !article || !wordpress;
    $('copy-wordpress-title').disabled = isBusy() || !reviewed || !wordpress || Boolean(articleIssues(draft, 'html').title);
    $('wordpress-readiness').textContent = !article ? 'Paste an article first. Page metadata is optional.' : article.blockCount + ' top-level blocks prepared locally. ' + (reviewed ? 'Copy or download, then inspect them in WordPress.' : 'Review your reading preview, then check the approval box to copy or download.') + (articleIssues(draft, 'html').title ? ' Add a title separately in WordPress.' : ' Your title stays separate from the body.');
    $('wordpress-notices').replaceChildren(...(article?.notices || []).map(text => { const li = document.createElement('li'); li.textContent = text; return li; }));
    // Clear hidden or unapproved output immediately after edits, restore, or clear.
    $('wordpress-code-preview').value = !isBusy() && wordpress && reviewed && $('wordpress-code-panel').open ? article?.html || '' : '';
    handoff.update();
    html.update();
    word.update();
    $('copy-formatted').disabled = !reviewed || Object.keys(articleIssues(draft, $('copy-title').checked ? 'html' : 'body')).length > 0;
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
    try {
      approved();
      const includeTitle = $('copy-title').checked;
      const article = createFormattedArticle(getDraft(), { includeTitle });
      if (typeof ClipboardItem !== 'function' || typeof navigator.clipboard?.write !== 'function') throw new Error('Formatted clipboard support unavailable.');
      // Invoke the clipboard write during this explicit user action, before any await.
      await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([article.html], { type: 'text/html' }), 'text/plain': new Blob([article.text], { type: 'text/plain' }) })]);
      report('Formatted article copied' + (includeTitle ? ' with its title' : ' without its title') + '. Paste into an editor that accepts formatted text, then check headings, links, and title handling. Nothing was published.');
    } catch {
      report('Formatted copy unavailable. Use Copy article body or Download reading page, or select visible preview text manually. Your writing is kept.');
    }
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
    try {
      const copyState = () => JSON.stringify([getDraft().title, getDraft().body, getWordPressOptions(), $('publishing-destination').value]);
      const original = copyState();
      approved(); const article = createWordPressArticle(getDraft(), getWordPressOptions());
      await navigator.clipboard.writeText(article.html);
      $('wordpress-instructions').open = true;
      if (copyState() !== original || !$('reviewed').checked) {
        report('An earlier article version was copied. The article changed while copying. Review and copy the current version again before continuing in WordPress.'); return;
      }
      report('WordPress blocks copied without a title or page fields. Paste into the Code editor of a new WordPress draft, return to Visual editor, and inspect the result.' + (article.imageCount ? ' Linked image URLs can load there.' : '') + ' Nothing was published.');
    } catch (error) { report('WordPress copy unavailable. Download the blocks or open Inspect or manually copy the approved blocks. ' + error.message); }
  });
  $('download-wordpress').addEventListener('click', () => {
    if (isBusy() || $('publishing-destination').value !== 'wordpress') return;
    try {
      approved(); const draft = getDraft(), article = createWordPressArticle(draft, getWordPressOptions());
      downloadText(article.html, suggestFilename(draft.title) + '-wordpress.html', 'text/html;charset=utf-8');
      report('WordPress blocks download requested. Open the file in a text editor and paste its contents into the WordPress Code editor. Opening it in a browser shows its reading view' + (article.imageCount ? ' and can load linked images' : '') + '. Nothing was published.');
    } catch (error) { report(error.message); }
  });
  $('copy-wordpress-title').addEventListener('click', async () => {
    if (isBusy() || $('publishing-destination').value !== 'wordpress') return;
    try {
      const titleState = () => JSON.stringify([getDraft().title, $('publishing-destination').value]), original = titleState();
      approved(); const draft = getDraft(); if (articleIssues(draft, 'html').title) throw new Error('Add a valid title first.');
      await navigator.clipboard.writeText(draft.title.trim());
      if (titleState() !== original || !$('reviewed').checked) { report('A title from the previous review was copied. Review and copy the current title again before continuing in WordPress.'); return; }
      report('Title copied separately. Paste into the WordPress title field. Nothing was published.');
    }
    catch (error) { report('Title copy unavailable. Select the article title and copy it manually. ' + error.message); }
  });
  return { update, reset: () => { handoff.reset(); html.reset(); $('copy-title').checked = false; $('publishing-destination').value = defaultDestination; $('additional-exports').open = !compact; if ($('other-export-formats')) $('other-export-formats').open = false; word.reset(); $('wordpress-code-preview').value = ''; kitSnapshot = null; $('kit-files').replaceChildren(); } };
}
