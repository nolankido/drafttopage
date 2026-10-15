import { MAX_IMPORT_BYTES, parseArticleImport } from './article-import.js';
import { installPasteGuard } from './paste-guard.js';
import { renderPreview } from './preview.js';
import { MAX_DOCX_BYTES } from './docx-archive.js';

export const FORMATTED_EXAMPLE = '<h1>A fictional neighborhood walk</h1><p>This illustrative draft has <strong>bold text</strong> and <em>emphasis</em>.</p><h2>Before you leave</h2><ol start="4"><li>Choose a route<ul><li>Check the weather</li><li>Bring water</li></ul></li><li>Invite a neighbor</li></ol><h2>Plan together</h2><table><tr><th>Stop</th><th>Idea</th></tr><tr><td>Park</td><td>Take a break</td></tr></table><p>Read the <a href="https://example.com/">illustrative link</a>. Replace this example with your own writing.</p>';

export function installArticleImport({ hasArticle, apply, isBusy, busyChanged, report }) {
  const $ = id => document.getElementById(id);
  let candidate = null, reading = false, sourceName = '', wordFile = null;
  const paste = installPasteGuard({ element: $('import-text'), limit: MAX_IMPORT_BYTES, maxBytes: MAX_IMPORT_BYTES, label: 'The import box', report: message => {
    $('import-paste-status').textContent = message;
    if (message) report(message);
  } });
  const clearPreview = () => {
    paste.clear();
    candidate = null;
    $('import-preview').hidden = true; $('apply-import').disabled = true;
    $('import-unmapped-ok').checked = false;
    $('import-changes-ok').checked = false; $('import-changes-section').hidden = true;
    $('import-reading-preview').replaceChildren();
    $('import-body-preview').value = ''; $('import-summary').textContent = '';
    $('import-page-details').replaceChildren(); $('import-warnings').replaceChildren();
    $('import-unmapped').textContent = ''; $('import-unmapped-section').hidden = true;
  };
  const clear = () => { clearPreview(); wordFile = null; $('import-file-status').textContent = ''; };
  function preview(text, name) {
    clear();
    stage(parseArticleImport(text, name, $('import-format').value, { firstRowHeaders: $('import-first-row-headers').checked }));
  }
  function stage(result) {
    clearPreview(); candidate = result;
    const count = candidate.draft.body.trim() ? candidate.draft.body.trim().split(/\s+/u).length : 0;
    $('import-summary').textContent = candidate.kind + ': ' + (candidate.draft.title || 'Untitled article') + '. ' + count + ' approximate words; ' + candidate.draft.questions.length + ' review question(s).';
    $('import-body-preview').value = candidate.draft.body;
    renderPreview($('import-reading-preview'), candidate.draft.title, candidate.draft.body);
    const metadata = document.createDocumentFragment();
    for (const [key, label] of [['title', 'Title'], ['excerpt', 'Excerpt'], ['description', 'Description'], ['slug', 'Filename']]) {
      const term = document.createElement('dt'); term.textContent = label;
      const value = document.createElement('dd'); value.textContent = candidate.draft[key] || 'Not supplied';
      metadata.append(term, value);
    }
    $('import-page-details').replaceChildren(metadata);
    $('import-warnings').replaceChildren(...candidate.warnings.map(text => {
      const li = document.createElement('li'); li.textContent = text; return li;
    }));
    $('import-unmapped').textContent = candidate.unmapped.map(item => item.key + ': ' + item.value).join('\n');
    $('import-unmapped-section').hidden = candidate.unmapped.length === 0;
    $('import-preview').hidden = false;
    $('import-changes-section').hidden = !candidate.requiresAck;
    updateApply();
    report('Import preview ready. Current writing is unchanged. Inspect the preview, then choose Import into editor.');
  }
  const allowed = () => candidate && !reading && !isBusy() && (!candidate.unmapped.length || $('import-unmapped-ok').checked) && (!candidate.requiresAck || $('import-changes-ok').checked);
  function updateApply() { $('apply-import').disabled = !allowed(); }
  function updateFormat() { $('import-html-options').hidden = $('import-format').value !== 'html'; clear(); }
  $('import-text').addEventListener('input', () => { sourceName = ''; clear(); });
  $('import-format').addEventListener('change', updateFormat);
  $('import-first-row-headers').addEventListener('change', clearPreview);
  $('import-unmapped-ok').addEventListener('change', updateApply);
  $('import-changes-ok').addEventListener('change', updateApply);
  $('import-text').addEventListener('paste', event => {
    if (event.defaultPrevented || $('import-format').value !== 'html' || reading || isBusy()) return;
    const html = event.clipboardData?.getData('text/html');
    if (!html) return;
    event.preventDefault();
    const input = $('import-text');
    if (new TextEncoder().encode(html).byteLength > MAX_IMPORT_BYTES) {
      $('import-paste-status').textContent = 'The formatted selection exceeds 512 KiB. Paste a smaller selection; the import box is unchanged.'; report($('import-paste-status').textContent); return;
    }
    if (input.value && (input.selectionStart !== 0 || input.selectionEnd !== input.value.length)) {
      $('import-paste-status').textContent = 'Clear the import box or select all of its text before pasting formatted writing. The import box is unchanged.'; report($('import-paste-status').textContent); return;
    }
    input.value = html; input.dispatchEvent(new Event('input', { bubbles: true }));
    report('Formatted selection captured locally. Choose Preview selected Word file or pasted article to inspect the conversion. Current writing is unchanged.');
  });
  $('import-html-example').addEventListener('click', () => {
    if (reading || isBusy()) return;
    if ($('import-text').value.trim() && !confirm('Replace only the pending import text with the fictional formatted example? Your current article and notes are unchanged.')) return;
    $('import-text').value = FORMATTED_EXAMPLE; $('import-text').dispatchEvent(new Event('input', { bubbles: true }));
    try { preview(FORMATTED_EXAMPLE, ''); } catch (error) { clear(); report(error.message); }
  });
  async function previewWord() {
    reading = true; clearPreview(); $('import-fields').disabled = true; busyChanged();
    try {
      const { parseDocxArticle } = await import('./docx-import.js');
      stage(await parseDocxArticle(wordFile.bytes, wordFile.name, { firstRowHeaders: $('import-first-row-headers').checked }));
    } catch (error) { clearPreview(); report(error.message || 'Word import is unavailable. Current writing is unchanged. Try a formatted selection instead.'); }
    finally { reading = false; $('import-fields').disabled = false; updateApply(); busyChanged(); }
  }
  $('preview-import').addEventListener('click', async () => {
    if (reading || isBusy()) return;
    if (wordFile) { await previewWord(); return; }
    try { preview($('import-text').value, sourceName); }
    catch (error) { clear(); report(error.message); }
  });
  $('import-file').addEventListener('change', async () => {
    const file = $('import-file').files?.[0];
    if (!file || reading || isBusy()) { $('import-file').value = ''; return; }
    reading = true; clear(); $('import-fields').disabled = true; busyChanged();
    try {
      if (/\.docx$/i.test(file.name)) {
        if (file.size > MAX_DOCX_BYTES) throw new Error('Choose a .docx file no larger than 8 MiB. Current writing is unchanged.');
        wordFile = { name: file.name, bytes: await file.arrayBuffer() };
        $('import-text').value = ''; sourceName = '';
        $('import-file-status').textContent = 'Selected Word document: ' + file.name + '. Preview again after changing the table-header choice. Its original bytes remain only until you clear or apply this import.';
        const { parseDocxArticle } = await import('./docx-import.js');
        stage(await parseDocxArticle(wordFile.bytes, file.name, { firstRowHeaders: $('import-first-row-headers').checked }));
        return;
      }
      if (/\.(doc|docm|dotm)$/i.test(file.name)) throw new Error('Choose a plain .docx file. Old .doc and macro-enabled documents are not supported.');
      if (file.size > MAX_IMPORT_BYTES) throw new Error('Choose an article file no larger than 512 KiB. Current writing is unchanged.');
      const content = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer());
      if ($('import-format').value === 'auto' && /\.html?$/i.test(file.name)) { $('import-format').value = 'html'; updateFormat(); }
      $('import-text').value = content; sourceName = file.name;
      preview(content, file.name);
    } catch (error) { clearPreview(); report(error instanceof TypeError && !wordFile ? 'Use a UTF-8 text file. Current writing is unchanged.' : error.message); }
    finally { reading = false; $('import-fields').disabled = false; $('import-file').value = ''; updateApply(); busyChanged(); }
  });
  $('apply-import').addEventListener('click', () => {
    if (!allowed()) return;
    if (hasArticle() && !confirm('Replace the article, page details, and review questions with this import? Save a private backup to keep them first. Source notes are kept.')) {
      report('Import cancelled. Current article and source notes are unchanged.'); return;
    }
    try {
      apply(candidate.draft);
      clear(); $('import-text').value = ''; sourceName = '';
      report('Article imported locally. Source notes were kept and export approval was cleared. Review before exporting. Nothing was uploaded or sent to AI.');
    } catch (error) { report(error.message); }
  });
  $('cancel-import').addEventListener('click', () => {
    if (reading) return;
    clear(); $('import-text').value = ''; sourceName = '';
    report('Import preview cleared. Current article and notes are unchanged.');
  });
  return { reading: () => reading, clear, pending: () => Boolean(candidate || wordFile || $('import-text').value.trim()), openFormatted: () => {
    if (reading || isBusy()) return;
    $('import-panel').open = true; $('import-format').value = 'html'; updateFormat();
    $('import-text').focus(); $('import-text').select();
    report('Formatted import ready. Choose a Word .docx or HTML file, or paste a copied selection, then inspect the preview before applying.');
  } };
}
