import { createArticleMarkdown } from './article-markdown.js';
import { downloadText } from './download.js';
import { suggestFilename } from './preview.js';
import { createCopyActions } from './copy-actions.js';

export function installMarkdownHandoff({ getDraft, approved, changed, report, isBusy = () => false, defaultIncludeTitle = false, download = downloadText, copyActions = null }) {
  const $ = id => document.getElementById(id);
  const copies = copyActions || createCopyActions({ snapshot: () => JSON.stringify([getDraft(), $('publishing-destination').value, $('reviewed').checked, $('export-format').value]), report, changed: update });
  const active = () => $('publishing-destination').value === 'markdown';
  const options = () => ({ includeTitle: $('export-format').value === 'document' });
  if (defaultIncludeTitle) $('export-format').value = 'document';
  function update() {
    const selected = active(), busy = isBusy(), draft = getDraft();
    $('markdown-handoff').hidden = !selected;
    $('markdown-include-title').checked = options().includeTitle;
    $('markdown-include-title').disabled = busy;
    let content = '', failure = '';
    if (selected && !busy) {
      try { content = createArticleMarkdown(draft, options()); }
      catch (error) { failure = error.message; }
    }
    const ready = selected && !busy && !failure && $('reviewed').checked;
    $('copy-article-markdown').disabled = !ready || copies.state().pending;
    $('download-article-markdown').disabled = !ready;
    $('article-markdown-preview').value = ready && $('markdown-source-panel').open ? content : '';
    $('article-markdown-readiness').textContent = !selected ? '' : busy ? 'Finish the current file operation before exporting Markdown.' : failure || (!ready ? 'Read the preview, then check the review box to copy or download Markdown. Page metadata is optional.' : 'Markdown is ready. Copy it or download the .md file, then inspect it in your destination.') + (options().includeTitle ? draft.title?.trim() ? ' The separate article title is included as a heading. Check for an existing title heading in the body.' : ' No separate title is available, so this export contains only the body.' : ' Only the body is included; the separate title is excluded.');
  }
  function content() {
    if (!active() || isBusy()) throw new Error('Select Markdown and finish any file operation first.');
    approved();
    return createArticleMarkdown(getDraft(), options());
  }
  $('markdown-include-title').addEventListener('change', () => {
    if (isBusy()) { update(); return; }
    $('export-format').value = $('markdown-include-title').checked ? 'document' : 'page';
    changed();
  });
  $('markdown-source-panel').addEventListener('toggle', update);
  $('copy-article-markdown').addEventListener('click', async () => {
    if (isBusy()) return;
    await copies.run({ destination: 'markdown', label: 'article Markdown', write: () => navigator.clipboard.writeText(content()), success: 'Article Markdown copied. Paste into a Markdown editor and inspect the result. Page metadata, private source notes, and review notes are excluded. Nothing was published.', fallback: 'Markdown copy unavailable. Download the .md file or open the approved Markdown below and copy it manually.' });
  });
  $('download-article-markdown').addEventListener('click', () => {
    try {
      const text = content();
      download(text, suggestFilename(getDraft().title) + '.md', 'text/markdown;charset=utf-8');
      report('Article Markdown download requested. Check the saved .md file in your own editor. Page metadata, private source notes, and review notes are excluded. Nothing was published.');
    } catch (error) { report(error.message); }
  });
  return { update, reset: () => {
    $('export-format').value = defaultIncludeTitle ? 'document' : 'page';
    $('markdown-include-title').checked = defaultIncludeTitle;
    $('article-markdown-preview').value = '';
  } };
}
