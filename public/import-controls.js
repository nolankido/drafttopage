import { MAX_IMPORT_BYTES, parseArticleImport } from './article-import.js';

export function installArticleImport({ hasArticle, apply, isBusy, busyChanged, report }) {
  const $ = id => document.getElementById(id);
  let candidate = null, reading = false;
  const clear = () => {
    candidate = null;
    $('import-preview').hidden = true; $('apply-import').disabled = true;
    $('import-unmapped-ok').checked = false;
    $('import-body-preview').value = ''; $('import-summary').textContent = '';
    $('import-page-details').replaceChildren(); $('import-warnings').replaceChildren();
    $('import-unmapped').textContent = ''; $('import-unmapped-section').hidden = true;
  };
  function preview(text, name) {
    clear();
    candidate = parseArticleImport(text, name, $('import-format').value);
    const count = candidate.draft.body.trim() ? candidate.draft.body.trim().split(/\s+/u).length : 0;
    $('import-summary').textContent = candidate.kind + ': ' + (candidate.draft.title || 'Untitled article') + '. ' + count + ' approximate words; ' + candidate.draft.questions.length + ' review question(s).';
    $('import-body-preview').value = candidate.draft.body;
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
    $('apply-import').disabled = candidate.unmapped.length > 0;
    report('Import preview ready. Current writing is unchanged. Inspect the preview, then choose Import into editor.');
  }
  $('import-text').addEventListener('input', clear);
  $('import-format').addEventListener('change', clear);
  $('import-unmapped-ok').addEventListener('change', () => {
    $('apply-import').disabled = !candidate || reading || (candidate.unmapped.length > 0 && !$('import-unmapped-ok').checked);
  });
  $('preview-import').addEventListener('click', () => {
    if (reading || isBusy()) return;
    try { preview($('import-text').value, ''); }
    catch (error) { clear(); report(error.message); }
  });
  $('import-file').addEventListener('change', async () => {
    const file = $('import-file').files?.[0];
    if (!file || reading || isBusy()) { $('import-file').value = ''; return; }
    reading = true; clear(); $('import-fields').disabled = true; busyChanged();
    try {
      if (file.size > MAX_IMPORT_BYTES) throw new Error('Choose an article file no larger than 48 KiB. Current writing is unchanged.');
      const content = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer());
      preview(content, file.name);
    } catch (error) { clear(); report(error instanceof TypeError ? 'Use a UTF-8 text file. Current writing is unchanged.' : error.message); }
    finally { reading = false; $('import-fields').disabled = false; $('import-file').value = ''; busyChanged(); }
  });
  $('apply-import').addEventListener('click', () => {
    if (!candidate || reading || isBusy() || (candidate.unmapped.length && !$('import-unmapped-ok').checked)) return;
    if (hasArticle() && !confirm('Replace the article, page details, and review questions with this import? Save a private backup to keep them first. Source notes are kept.')) {
      report('Import cancelled. Current article and source notes are unchanged.'); return;
    }
    try {
      apply(candidate.draft);
      clear(); $('import-text').value = '';
      report('Article imported locally. Source notes were kept and export approval was cleared. Review before exporting. Nothing was uploaded or sent to AI.');
    } catch (error) { report(error.message); }
  });
  $('cancel-import').addEventListener('click', () => {
    if (reading) return;
    clear(); $('import-text').value = '';
    report('Import preview cleared. Current article and notes are unchanged.');
  });
  return { reading: () => reading, clear, pending: () => Boolean(candidate || $('import-text').value.trim()) };
}
