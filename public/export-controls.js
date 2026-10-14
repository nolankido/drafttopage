import { articleIssues } from './authoring.js';
import { createFormattedArticle } from './html-export.js';
import { publishingKitFiles, createPublishingKit } from './publishing-kit.js';
import { downloadText } from './download.js';

export function installPublishingExports({ getDraft, approved, changed, report }) {
  const $ = id => document.getElementById(id);
  let kitSnapshot = null;
  const options = () => ({ includeTitleHeading: $('export-format').value === 'document' });
  function update() {
    const draft = getDraft(), reviewed = $('reviewed').checked;
    $('copy-formatted').disabled = !reviewed || Object.keys(articleIssues(draft, $('copy-title').checked ? 'html' : 'body')).length > 0;
    let kit = null, error = '';
    try { kit = publishingKitFiles(draft, options()); }
    catch (failure) { error = failure.message; }
    $('download-kit').disabled = !reviewed || !kit;
    $('kit-readiness').textContent = kit ? 'Includes ' + kit.files.length + ' files. ' + (kit.notices.join(' ') || 'All page fields are complete.') : 'Add a valid title and article for a publishing kit. ' + error;
    if ($('publishing-kit-panel').open) {
      const snapshot = JSON.stringify([kit?.filename, kit?.files.map(file => [file.name, file.purpose]), kit?.notices, error]);
      if (snapshot !== kitSnapshot) {
        kitSnapshot = snapshot;
        $('kit-files').replaceChildren(...(kit?.files || []).map(file => {
          const item = document.createElement('li'), name = document.createElement('code'); name.textContent = file.name;
          item.append(name, document.createTextNode(': ' + file.purpose)); return item;
        }));
      }
    }
  }
  $('publishing-kit-panel').addEventListener('toggle', update);
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
    try {
      approved(); const kit = createPublishingKit(getDraft(), options());
      downloadText(kit.bytes, kit.filename, 'application/zip');
      report('Publishing kit download requested with ' + kit.files.length + ' article files. Extract and inspect them before sharing. Source notes and private review notes are excluded. Nothing was uploaded or published.');
    } catch (error) { report(error.message); }
  });
  return { update, reset: () => { $('copy-title').checked = false; kitSnapshot = null; } };
}
