import { MAX_IMPORT_BYTES, parseArticleImport } from './article-import.js';
import { installPasteGuard } from './paste-guard.js';
import { renderPreview } from './preview.js';
import { MAX_DOCX_BYTES } from './docx-archive.js';
import { installImportInsertion } from './import-insertion-controls.js';
import { copiedWritingSource, parseCopiedWriting } from './copied-writing.js';
import { downloadText } from './download.js';

export const FORMATTED_EXAMPLE = '<h1>A fictional neighborhood walk</h1><p>This illustrative draft has <strong>bold text</strong> and <em>emphasis</em>.</p><h2>Before you leave</h2><ol start="4"><li>Choose a route<ul><li>Check the weather</li><li>Bring water</li></ul></li><li>Invite a neighbor</li></ol><h2>Plan together</h2><table><tr><th>Stop</th><th>Idea</th></tr><tr><td>Park</td><td>Take a break</td></tr></table><p>Read the <a href="https://example.com/">illustrative link</a>. Replace this example with your own writing.</p>';

export function installArticleImport({ hasArticle, apply, applyInsertion, isBusy, busyChanged, report, focusPreview = false, workChanged = () => {}, pasteFirst = false, prepareImages = async (bytes, value) => (await import('./word-image-kit.js')).prepareWordImageKit(bytes, value), download = downloadText }) {
  const $ = id => document.getElementById(id);
  let candidate = null, reading = false, sourceName = '', wordFile = null, copiedSource = null, copiedFailed = false, wordImageKit = null;
  const clearWordImages = () => {
    wordImageKit = null; $('word-image-private-ok').checked = false;
    $('word-image-kit-review').hidden = true; $('download-word-images').disabled = true;
    $('word-image-kit-status').textContent = '';
    $('word-image-kit-files').replaceChildren(); $('word-image-kit-skipped').replaceChildren();
  };
  const insertion = installImportInsertion({ getBody: () => $('body').value, getSelection: () => ({ start: $('body').selectionStart, end: $('body').selectionEnd }), isBusy: () => reading || isBusy(), report, changed: updateApply });
  const paste = installPasteGuard({ element: $('import-text'), limit: MAX_IMPORT_BYTES, maxBytes: MAX_IMPORT_BYTES, label: 'The import box', skipPaste: () => $('import-format').value === 'html', report: message => {
    $('import-paste-status').textContent = message;
    $('import-paste-status').setAttribute('data-result', '');
    if (message) report(message);
  } });
  const clearPreview = () => {
    paste.clear();
    clearWordImages(); $('word-image-handoff').hidden = true;
    candidate = null;
    insertion.clear();
    $('import-preview').hidden = true; $('apply-import').disabled = true;
    $('import-unmapped-ok').checked = false;
    $('import-changes-ok').checked = false; $('import-changes-section').hidden = true;
    $('import-reading-preview').replaceChildren();
    $('import-body-preview').value = ''; $('import-summary').textContent = '';
    $('import-page-details').replaceChildren(); $('import-warnings').replaceChildren();
    $('import-unmapped').textContent = ''; $('import-unmapped-section').hidden = true;
    workChanged();
  };
  const clear = () => { clearPreview(); wordFile = null; copiedSource = null; copiedFailed = false; $('import-file-status').textContent = ''; workChanged(); };
  function previewCopied(source) {
    let result;
    try { result = parseCopiedWriting(source, { firstRowHeaders: $('import-first-row-headers').checked }); }
    catch (error) {
      copiedSource = source; copiedFailed = true; wordFile = null; sourceName = ''; $('import-text').value = '';
      $('import-changes-ok').checked = false;
      $('import-file-status').textContent = 'Copied source kept for re-preview. Any earlier preview remains visible but cannot be applied until a selection converts successfully.';
      updateApply(); workChanged(); throw error;
    }
    clear(); copiedSource = source; sourceName = ''; $('import-text').value = '';
    try { stage(result); }
    catch (error) { clearPreview(); throw error; }
    $('import-file-status').textContent = (source.format === 'html' ? 'Copied formatting' : 'Copied plain text') + ' kept in this tab for re-preview. Clear or apply the import to discard its original clipboard source.';
    $('import-paste-status').textContent = source.format === 'html' ? 'Copied writing converted below. The paste box is empty for your next selection; no raw HTML is displayed.' : 'Only plain text was available. Inspect the formatting warning below, or copy again with formatting. The paste box is ready for another selection.';
    $('import-paste-status').setAttribute('data-result', source.format === 'html' ? 'ready' : 'warning');
    workChanged();
  }
  function preview(text, name) {
    clear();
    stage(parseArticleImport(text, name, $('import-format').value, { firstRowHeaders: $('import-first-row-headers').checked }));
  }
  function stage(result) {
    clearPreview(); candidate = result;
    const count = candidate.draft.body.trim() ? candidate.draft.body.trim().split(/\s+/u).length : 0;
    $('import-summary').textContent = candidate.kind + ': ' + (candidate.draft.title || 'Untitled article') + '. ' + count + ' approximate words; ' + candidate.draft.questions.length + ' review question(s).';
    $('import-body-preview').value = candidate.draft.body;
    insertion.setCandidate(candidate.draft);
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
    $('word-image-handoff').hidden = !(wordFile && candidate.wordImages?.length);
    if (!$('word-image-handoff').hidden) $('word-image-kit-status').textContent = candidate.wordImages.length + ' numbered image or object position(s). Prepare files to inspect what can be recovered. Download the package before applying this import.';
    $('import-preview').hidden = false;
    $('import-changes-section').hidden = !candidate.requiresAck;
    updateApply();
    workChanged();
    report('Import preview ready. Current writing is unchanged. Inspect the conversion and choose its destination before applying.');
    if (focusPreview) $('import-preview-heading').focus();
  }
  const allowed = () => candidate && !copiedFailed && !reading && !isBusy() && (insertion.mode() === 'replace' || (typeof applyInsertion === 'function' && insertion.ready())) && (!candidate.unmapped.length || $('import-unmapped-ok').checked) && (!candidate.requiresAck || $('import-changes-ok').checked);
  function updateApply() {
    insertion.refresh();
    $('apply-import').disabled = !allowed();
    if ($('start-word-file')) $('start-word-file').disabled = reading || isBusy();
    if ($('start-insert-import')) $('start-insert-import').disabled = reading || isBusy();
    if ($('start-copied-paste')) $('start-copied-paste').disabled = reading || isBusy();
    $('prepare-word-images').disabled = reading || isBusy() || !wordFile || !candidate?.wordImages?.length;
    $('download-word-images').disabled = reading || isBusy() || !wordImageKit?.bytes || !$('word-image-private-ok').checked;
    $('discard-word-images').disabled = reading || isBusy();
    $('word-image-private-ok').disabled = reading || isBusy();
  }
  $('prepare-word-images').addEventListener('click', async () => {
    if (reading || isBusy() || !wordFile || !candidate?.wordImages?.length) return;
    const source = wordFile, preview = candidate;
    clearWordImages(); reading = true; $('import-fields').disabled = true; $('cancel-import').disabled = true; updateApply(); busyChanged();
    $('word-image-kit-status').textContent = 'Reading supported embedded image files locally. Current writing is unchanged.';
    try {
      const prepared = await prepareImages(source.bytes, preview);
      if (source !== wordFile || preview !== candidate) return;
      wordImageKit = prepared;
      $('word-image-kit-files').replaceChildren(...prepared.images.map(image => {
        const item = document.createElement('li'); item.textContent = image.name + ' · ' + image.width + ' × ' + image.height + ' pixels · ' + image.bytes.toLocaleString() + ' bytes · ' + image.placeholders.join(', '); return item;
      }));
      $('word-image-kit-skipped').replaceChildren(...prepared.skipped.map(image => {
        const item = document.createElement('li'); item.textContent = image.placeholder + ': ' + image.note; return item;
      }));
      $('word-image-private-label').hidden = !prepared.bytes;
      $('word-image-kit-review').hidden = false;
      $('word-image-kit-status').textContent = prepared.images.length + ' original image file(s) prepared; ' + prepared.skipped.length + ' position(s) need separate work. ' + (prepared.bytes ? 'The ZIP also includes article-body.md, image-map.json with Word alt text, and README.txt. Review and download before applying this import.' : 'No supported image files could be recovered. The article can still be imported.');
      report($('word-image-kit-status').textContent);
    } catch (error) {
      $('word-image-kit-status').textContent = (error.message || 'Image recovery is unavailable.') + ' The article preview and current writing are kept.';
      report($('word-image-kit-status').textContent);
    } finally {
      reading = false; $('import-fields').disabled = false; $('cancel-import').disabled = false; updateApply(); busyChanged();
    }
  });
  $('word-image-private-ok').addEventListener('change', updateApply);
  $('download-word-images').addEventListener('click', () => {
    if (reading || isBusy() || !wordImageKit?.bytes || !$('word-image-private-ok').checked) return;
    try { download(wordImageKit.bytes, wordImageKit.filename, 'application/zip'); report('Word image package download requested. Inspect the saved files, then upload images and replace placeholders in WordPress yourself. Nothing was published.'); }
    catch (error) { report('The image download could not start. Prepared files and your article preview are kept. ' + error.message); }
  });
  $('discard-word-images').addEventListener('click', () => {
    if (reading || isBusy()) return;
    clearWordImages(); updateApply(); report('Prepared image package discarded. The selected Word file and article preview are kept for another preparation.');
  });
  function updateFormat() { $('import-html-options').hidden = $('import-format').value !== 'html'; clear(); }
  $('import-text').addEventListener('input', () => { sourceName = ''; clear(); });
  $('import-format').addEventListener('change', updateFormat);
  $('import-first-row-headers').addEventListener('change', clearPreview);
  $('import-unmapped-ok').addEventListener('change', updateApply);
  $('import-changes-ok').addEventListener('change', updateApply);
  $('import-text').addEventListener('paste', event => {
    if (event.defaultPrevented || $('import-format').value !== 'html') return;
    event.preventDefault();
    $('import-paste-status').setAttribute('data-result', '');
    if (reading || isBusy()) { report('Finish the current file operation before pasting copied writing. Current writing is kept.'); return; }
    const input = $('import-text');
    if (input.value && (input.selectionStart !== 0 || input.selectionEnd !== input.value.length)) {
      $('import-paste-status').textContent = 'Clear the import box or select all of its text before pasting formatted writing. The import box is unchanged.'; report($('import-paste-status').textContent); return;
    }
    try { previewCopied(copiedWritingSource(event.clipboardData)); }
    catch (error) { $('import-paste-status').textContent = error.message; report(error.message); }
  });
  $('import-html-example').addEventListener('click', () => {
    if (reading || isBusy()) return;
    if (($('import-text').value.trim() || copiedSource || wordFile) && !confirm('Replace only the pending import source with the fictional formatted example? Your current article and notes are unchanged.')) return;
    if (pasteFirst) { try { previewCopied({ format: 'html', text: FORMATTED_EXAMPLE }); } catch (error) { report(error.message); } return; }
    $('import-text').value = FORMATTED_EXAMPLE; $('import-text').dispatchEvent(new Event('input', { bubbles: true }));
    try { preview(FORMATTED_EXAMPLE, ''); } catch (error) { clear(); report(error.message); }
  });
  async function previewWord() {
    reading = true; clearPreview(); $('import-fields').disabled = true; $('cancel-import').disabled = true; updateApply(); busyChanged();
    try {
      const { parseDocxArticle } = await import('./docx-import.js');
      stage(await parseDocxArticle(wordFile.bytes, wordFile.name, { firstRowHeaders: $('import-first-row-headers').checked }));
    } catch (error) { clearPreview(); report(error.message || 'Word import is unavailable. Current writing is unchanged. Try a formatted selection instead.'); }
    finally { reading = false; $('import-fields').disabled = false; $('cancel-import').disabled = false; updateApply(); busyChanged(); }
  }
  $('preview-import').addEventListener('click', async () => {
    if (reading || isBusy()) return;
    if (wordFile) { await previewWord(); return; }
    if (copiedSource) { try { previewCopied(copiedSource); } catch (error) { report(error.message); } return; }
    try { preview($('import-text').value, sourceName); }
    catch (error) { clear(); report(error.message); }
  });
  $('import-file').addEventListener('change', async () => {
    const file = $('import-file').files?.[0];
    if (!file || reading || isBusy()) { $('import-file').value = ''; return; }
    reading = true; clear(); $('import-fields').disabled = true; $('cancel-import').disabled = true; updateApply(); busyChanged();
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
    finally { reading = false; $('import-fields').disabled = false; $('cancel-import').disabled = false; $('import-file').value = ''; updateApply(); busyChanged(); }
  });
  $('apply-import').addEventListener('click', () => {
    if (!allowed()) return;
    if (insertion.mode() !== 'replace') {
      try {
        const plan = insertion.getPlan();
        if (plan.changed) applyInsertion(plan);
        clear(); $('import-text').value = ''; sourceName = '';
        report(plan.changed ? 'Article insertion applied locally. Previous writing is in Revisions in this tab. Existing title, page fields, source notes, and review notes were kept. Approval and the linked-image choice were cleared.' : 'This insertion already matches. Writing, approval, and history were kept.');
      } catch (error) { report(error.message); updateApply(); }
      return;
    }
    if (hasArticle() && !confirm('Replace the article, page details, review questions, and any unsaved passage review, image preparation, link preparation, or table preparation with this import? Save a private backup to keep saved writing first. Unsaved preparation is excluded from files. Source notes are kept.')) {
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
  return { reading: () => reading, clear, updateBusy: updateApply, pending: () => Boolean(candidate || wordFile || copiedSource || $('import-text').value.trim()), openCopied: () => {
    if (reading || isBusy()) return;
    $('import-panel').open = true; $('import-format').value = 'html'; $('import-html-options').hidden = false;
    if ($('copied-import-alternatives')) $('copied-import-alternatives').open = false;
    $('import-text').focus(); $('import-text').select();
    report('Copy writing in Google Docs or another editor, then paste here with Ctrl+V or Command+V. A conversion preview opens before anything changes.');
  }, openInsertion: () => {
    if (reading || isBusy()) return;
    $('import-panel').open = true; insertion.chooseMode('append');
    if (candidate) $('import-destination').focus(); else $('import-file').focus();
    report('Insert more writing: choose a file or preview pasted writing. Then preview adding it to the article end, or choose a complete-block selection. Current writing is kept.');
  }, openWordFile: () => {
    if (reading || isBusy()) { report('Finish the current file operation before choosing another document. Current writing is unchanged.'); return; }
    $('import-panel').open = true;
    try { $('import-file').click(); }
    catch { $('import-file').focus(); report('Choose a Word document using the file control in the import panel. Current writing is unchanged.'); }
  }, openFormatted: () => {
    if (reading || isBusy()) return;
    $('import-panel').open = true; $('import-format').value = 'html'; updateFormat();
    if ($('word-import-alternatives')) $('word-import-alternatives').open = true;
    $('import-text').focus(); $('import-text').select();
    report('Formatted import ready. Choose a Word .docx or HTML file, or paste a copied selection, then inspect the preview before applying.');
  } };
}
