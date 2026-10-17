import { MAX_IMPORT_BYTES, parseArticleImport } from './article-import.js';
import { installPasteGuard } from './paste-guard.js';
import { renderPreview } from './preview.js';
import { MAX_DOCX_BYTES } from './docx-archive.js';
import { installImportInsertion } from './import-insertion-controls.js';
import { copiedWritingSource, parseCopiedWriting } from './copied-writing.js';
import { downloadText } from './download.js';
import { installWordComments } from './word-comment-controls.js';
import { HTML_SOURCE_SAMPLE } from './html-source-sample.js';
import { wordImageDownloadAllowed } from './word-image-metadata.js';
import { summarizeWordImageHandoff, wordImageDecisionReady, wordImageDecisionStatus, wordImageAfterApply } from './word-image-handoff.js';
import { summarizeImportFindings, guidanceForImportWarning } from './import-findings.js';

export const FORMATTED_EXAMPLE = '<h1>A fictional neighborhood walk</h1><p>This illustrative draft has <strong>bold text</strong> and <em>emphasis</em>.</p><h2>Before you leave</h2><ol start="4"><li>Choose a route<ul><li>Check the weather</li><li>Bring water</li></ul></li><li>Invite a neighbor</li></ol><h2>Plan together</h2><table><tr><th>Stop</th><th>Idea</th></tr><tr><td>Park</td><td>Take a break</td></tr></table><p>Read the <a href="https://example.com/">illustrative link</a>. Replace this example with your own writing.</p>';

export function installArticleImport({ hasArticle, apply, applyInsertion, continueToExport, isBusy, busyChanged, report, focusPreview = false, focusImportPreview = heading => heading.focus(), workChanged = () => {}, pasteFirst = false, prepareImages = async (bytes, value) => (await import('./word-image-kit.js')).prepareWordImageKit(bytes, value), download = downloadText }) {
  const $ = id => document.getElementById(id);
  const continueButton = $('apply-import-and-continue'), continueHelp = $('import-continue-help');
  let candidate = null, reading = false, sourceName = '', wordFile = null, copiedSource = null, copiedFailed = false, wordImageKit = null, commentRecovery = null, candidateWordKey = null, candidateHTMLKey = null, imageDownloadRequested = false;
  const imageChoice = () => $('word-image-choice-kit').checked ? 'kit' : $('word-image-choice-placeholders').checked ? 'placeholders' : '';
  const htmlOptions = () => ({ firstRowHeaders: $('import-first-row-headers').checked, sourceURL: $('import-source-url')?.value || '' });
  const htmlOptionsKey = () => JSON.stringify(htmlOptions());
  const resetSourceURL = () => { if ($('import-source-url')) $('import-source-url').value = ''; };
  const wordOptions = () => ({ firstRowHeaders: $('import-first-row-headers').checked, textRevisions: $('import-word-revisions')?.value || 'require-clean' });
  const wordOptionsKey = () => JSON.stringify(wordOptions());
  const revisionLabel = () => candidate?.wordRevisions?.mode === 'previous' ? 'Previous text' : 'Proposed text';
  const hasTextRevisions = () => Boolean(candidate?.wordRevisions && candidate.wordRevisions.insertions + candidate.wordRevisions.deletions);
  const clearWordImages = (resetChoice = false) => {
    wordImageKit = null; imageDownloadRequested = false;
    $('word-image-saved-ok').checked = false; $('word-image-saved-label').hidden = true;
    if (resetChoice) { $('word-image-choice-kit').checked = false; $('word-image-choice-placeholders').checked = false; $('word-image-counts').textContent = ''; $('word-image-decision-status').textContent = ''; }
    $('word-image-private-ok').checked = false; $('word-image-metadata-ok').checked = false;
    $('word-image-metadata-review').hidden = true; $('word-image-metadata-files').replaceChildren();
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
    commentRecovery?.clear();
    clearWordImages(true); $('word-image-handoff').hidden = true;
    candidate = null; candidateWordKey = null; candidateHTMLKey = null;
    if ($('word-revision-review')) $('word-revision-review').hidden = true;
    if ($('word-revision-summary')) $('word-revision-summary').textContent = '';
    if ($('import-changes-label')) $('import-changes-label').textContent = 'I reviewed the converted article and the formatting changes or omissions listed above.';
    insertion.clear();
    $('import-reading-details').open = true; $('import-source-details').open = false;
    $('import-completion').hidden = true; $('import-completion').textContent = '';
    $('import-findings-status').textContent = '';
    $('import-preview').hidden = true; $('apply-import').disabled = true;
    if (continueButton) { continueButton.hidden = true; continueButton.disabled = true; }
    if (continueHelp) continueHelp.hidden = true;
    $('import-unmapped-ok').checked = false;
    $('import-changes-ok').checked = false; $('import-changes-section').hidden = true;
    $('import-reading-preview').replaceChildren();
    $('import-body-preview').value = ''; $('import-summary').textContent = '';
    $('import-page-details').replaceChildren(); $('import-warnings').replaceChildren();
    $('import-unmapped').textContent = ''; $('import-unmapped-section').hidden = true;
    workChanged();
  };
  const clear = () => { clearPreview(); wordFile = null; copiedSource = null; copiedFailed = false; if ($('import-word-options')) $('import-word-options').hidden = true; if ($('import-word-revisions')) $('import-word-revisions').value = 'require-clean'; $('import-file-status').textContent = ''; workChanged(); };
  const clearAll = () => { resetSourceURL(); clear(); };
  const discardImport = () => { $('import-text').value = ''; sourceName = ''; clearAll(); };
  function previewCopied(source) {
    let result; const options = htmlOptions(), key = JSON.stringify(options);
    try { result = parseCopiedWriting(source, options); }
    catch (error) {
      copiedSource = source; copiedFailed = true; wordFile = null; sourceName = ''; $('import-text').value = '';
      $('import-changes-ok').checked = false;
      $('import-file-status').textContent = 'Copied source kept for re-preview. Any earlier preview remains visible but cannot be applied until a selection converts successfully.';
      updateApply(); workChanged(); throw error;
    }
    clear(); copiedSource = source; sourceName = ''; $('import-text').value = '';
    try { stage(result, null, source.format === 'html' ? key : null); }
    catch (error) { clearPreview(); throw error; }
    $('import-file-status').textContent = (source.format === 'html' ? 'Copied formatting' : 'Copied plain text') + ' kept in this tab for re-preview. Clear or apply the import to discard its original clipboard source.';
    $('import-paste-status').textContent = source.format === 'html' ? 'Copied writing converted below. The paste box is empty for your next selection; no raw HTML is displayed.' : 'Only plain text was available. Inspect the formatting warning below, or copy again with formatting. The paste box is ready for another selection.';
    $('import-paste-status').setAttribute('data-result', source.format === 'html' ? 'ready' : 'warning');
    workChanged();
  }
  function preview(text, name) {
    clear();
    const format = $('import-format').value === 'html-source' ? 'html' : $('import-format').value;
    const options = htmlOptions(), key = JSON.stringify(options);
    stage(parseArticleImport(text, name, format, options), null, format === 'html' || format === 'auto' && /\.html?$/i.test(name) ? key : null);
  }
  function stage(result, wordKey = null, htmlKey = null) {
    clearPreview(); candidate = result; candidateWordKey = wordKey; candidateHTMLKey = htmlKey;
    if (hasTextRevisions()) {
      if ($('word-revision-review')) $('word-revision-review').hidden = false;
      if ($('word-revision-summary')) $('word-revision-summary').textContent = revisionLabel() + ' selected. ' + candidate.wordRevisions.insertions + ' insertion group(s); ' + candidate.wordRevisions.deletions + ' deletion group(s). ' + (candidate.wordRevisions.mode === 'previous' ? 'Deleted text is kept and inserted text is omitted.' : 'Inserted text is kept and deleted text is omitted.');
      if ($('import-changes-label')) $('import-changes-label').textContent = 'I reviewed the ' + revisionLabel().toLowerCase() + ' version and the listed changes. Text revision history will not be retained.';
    }
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
    $('import-findings-status').textContent = summarizeImportFindings(candidate);
    $('import-warnings').replaceChildren(...candidate.warnings.map(text => {
      const li = document.createElement('li'); li.textContent = text;
      const guidance = document.createElement('p'); guidance.className = 'small';
      guidance.textContent = guidanceForImportWarning(text); li.append(guidance);
      return li;
    }));
    $('import-unmapped').textContent = candidate.unmapped.map(item => item.key + ': ' + item.value).join('\n');
    $('import-unmapped-section').hidden = candidate.unmapped.length === 0;
    $('word-image-handoff').hidden = !(wordFile && candidate.wordImages?.length);
    if (!$('word-image-handoff').hidden) $('word-image-kit-status').textContent = 'Image recovery is optional. Prepare a package if you want to reuse supported PNG/JPEG files. Unresolved positions stay as placeholders.';
    $('import-preview').hidden = false;
    $('import-changes-section').hidden = !candidate.requiresAck;
    updateApply();
    workChanged();
    report('Import preview ready. Current writing is unchanged. Inspect the conversion and choose its destination before applying.');
    if (focusPreview) focusImportPreview($('import-preview-heading'));
  }
  const allowed = () => candidate && (!wordFile || candidateWordKey === wordOptionsKey()) && (candidateHTMLKey === null || candidateHTMLKey === htmlOptionsKey()) && !copiedFailed && !reading && !isBusy() && (insertion.mode() === 'replace' || (typeof applyInsertion === 'function' && insertion.ready())) && (!candidate.unmapped.length || $('import-unmapped-ok').checked) && (!candidate.requiresAck || $('import-changes-ok').checked) && wordImageDecisionReady(candidate, imageChoice(), wordImageKit, imageDownloadRequested, $('word-image-saved-ok').checked);
  const continuationOffered = () => Boolean(candidate && continueButton && typeof continueToExport === 'function' && insertion.mode() === 'replace');
  function updateApply() {
    insertion.refresh();
    commentRecovery?.update();
    if (candidate) {
      const count = candidate.draft.body.trim() ? candidate.draft.body.trim().split(/\s+/u).length : 0;
      $('import-summary').textContent = candidate.kind + ': ' + (candidate.draft.title || 'Untitled article') + '. ' + count + ' approximate words; ' + (candidate.draft.questions.length + (commentRecovery?.selectedCount() || 0)) + ' review question(s).';
    }
    const choice = imageChoice();
    $('word-image-counts').textContent = summarizeWordImageHandoff(candidate, wordImageKit);
    $('word-image-decision-status').textContent = wordImageDecisionStatus(candidate, choice, wordImageKit, imageDownloadRequested, $('word-image-saved-ok').checked);
    const receiptVisible = Boolean(candidate?.wordImages?.length && choice === 'kit' && wordImageKit?.bytes && imageDownloadRequested);
    $('word-image-saved-label').hidden = !receiptVisible;
    $('word-image-saved-ok').disabled = !receiptVisible || reading || isBusy();
    const ready = allowed(), continuing = continuationOffered();
    $('apply-import').disabled = !ready;
    $('apply-import').className = continuing ? 'secondary' : 'button';
    if (continuing) $('apply-import').textContent = 'Import and edit';
    if (continueButton) {
      continueButton.hidden = !continuing;
      continueButton.disabled = !continuing || !ready || !candidate?.draft.body.trim();
    }
    if (continueHelp) continueHelp.hidden = !continuing;
    if ($('import-word-revisions')) $('import-word-revisions').disabled = reading || isBusy();
    if ($('start-word-file')) $('start-word-file').disabled = reading || isBusy();
    if ($('start-insert-import')) $('start-insert-import').disabled = reading || isBusy();
    if ($('start-copied-paste')) $('start-copied-paste').disabled = reading || isBusy();
    $('prepare-word-images').disabled = reading || isBusy() || !wordFile || !candidate?.wordImages?.length;
    $('download-word-images').disabled = !wordImageDownloadAllowed(wordImageKit, $('word-image-private-ok').checked, $('word-image-metadata-ok').checked, reading || isBusy());
    $('word-image-metadata-ok').disabled = reading || isBusy() || !wordImageKit?.metadata?.length;
    $('discard-word-images').disabled = reading || isBusy();
    $('word-image-private-ok').disabled = reading || isBusy();
  }
  commentRecovery = installWordComments({ getSource: () => wordFile, getCandidate: () => candidate, getMode: () => insertion.mode(), isBusy: () => reading || isBusy(),
    setBusy: active => { reading = active; $('import-fields').disabled = active; $('cancel-import').disabled = active; updateApply(); busyChanged(); },
    changed: () => { $('import-changes-ok').checked = false; updateApply(); workChanged(); }, report, download });
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
      $('word-image-metadata-files').replaceChildren(...(prepared.metadata || []).map(image => {
        const item = document.createElement('li'); item.textContent = image.name + ': ' + image.signals.join(', '); return item;
      }));
      $('word-image-metadata-review').hidden = !(prepared.metadata || []).length;
      $('word-image-kit-skipped').replaceChildren(...prepared.skipped.map(image => {
        const item = document.createElement('li'); item.textContent = image.placeholder + ': ' + image.note; return item;
      }));
      $('word-image-private-label').hidden = !prepared.bytes;
      $('word-image-kit-review').hidden = false;
      $('word-image-kit-status').textContent = prepared.images.length + ' original image file(s) prepared; ' + prepared.skipped.length + ' position(s) need separate work. ' + ((prepared.metadata || []).length ? prepared.metadata.length + ' file(s) have recognizable metadata markers. Review the separate privacy warning before downloading. ' : '') + (prepared.bytes ? 'The ZIP also includes article-body.md, image-map.json with Word alt text, and README.txt. Review and download before applying this import.' : 'No supported image files could be recovered. The article can still be imported.');
      report($('word-image-kit-status').textContent);
    } catch (error) {
      $('word-image-kit-status').textContent = (error.message || 'Image recovery is unavailable.') + ' The article preview and current writing are kept.';
      report($('word-image-kit-status').textContent);
    } finally {
      reading = false; $('import-fields').disabled = false; $('cancel-import').disabled = false; updateApply(); busyChanged();
    }
  });
  for (const id of ['word-image-choice-kit', 'word-image-choice-placeholders']) $(''+id).addEventListener('change', () => {
    imageDownloadRequested = false;
    $('word-image-saved-ok').checked = false;
    updateApply();
    workChanged();
  });
  $('word-image-saved-ok').addEventListener('change', () => { updateApply(); workChanged(); });
  $('word-image-private-ok').addEventListener('change', updateApply);
  $('word-image-metadata-ok').addEventListener('change', updateApply);
  $('download-word-images').addEventListener('click', () => {
    if (!wordImageDownloadAllowed(wordImageKit, $('word-image-private-ok').checked, $('word-image-metadata-ok').checked, reading || isBusy())) return;
    try {
      download(wordImageKit.bytes, wordImageKit.filename, 'application/zip');
      imageDownloadRequested = true;
      $('word-image-saved-ok').checked = false;
      updateApply();
      report('Word image ZIP download requested. Verify the file was actually saved and opens on your device, then confirm the receipt before importing. Nothing was published.');
    } catch (error) {
      imageDownloadRequested = false;
      $('word-image-saved-ok').checked = false;
      updateApply();
      report('The image download could not start. The image package and article preview remain here. ' + error.message);
    }
  });
  $('discard-word-images').addEventListener('click', () => {
    if (reading || isBusy()) return;
    clearWordImages(); updateApply(); report('Prepared image package discarded. The selected Word file and article preview are kept for another preparation.');
  });
  function showFormat() {
    const source = $('import-format').value === 'html-source', formatted = $('import-format').value === 'html';
    $('import-html-options').hidden = !source && !formatted;
    if ($('import-source-context')) $('import-source-context').hidden = !source && !formatted;
    $('import-html-help').hidden = source;
    if ($('import-html-source-help')) $('import-html-source-help').hidden = !source;
    $('import-text').setAttribute('aria-describedby', 'import-file-help ' + (source ? 'import-html-source-help' : 'import-html-help') + ' import-paste-status');
    if ($('import-text-label')) $('import-text-label').textContent = source ? 'HTML source code' : formatted ? 'Paste copied formatted writing' : 'Or paste writing or article source';
    $('import-html-example').textContent = source ? 'Preview an HTML source example' : 'Preview a formatted example';
  }
  function updateFormat() { if (!['html', 'html-source'].includes($('import-format').value)) resetSourceURL(); showFormat(); clear(); }
  $('import-text').addEventListener('input', () => { sourceName = ''; clear(); });
  $('import-format').addEventListener('change', updateFormat);
  $('import-first-row-headers').addEventListener('change', clearPreview);
  $('import-source-url')?.addEventListener('input', () => {
    if (wordFile) return;
    clearPreview();
    report('Source page URL changed. Preview the HTML again and inspect its links before importing. Current writing and approval are unchanged.');
  });
  $('import-word-revisions')?.addEventListener('change', () => {
    clearPreview(); updateApply();
    if (wordFile) report('Word text version changed. Preview the selected file again and review it before importing. Current writing and approval are unchanged.');
  });
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
    resetSourceURL();
    if ($('import-format').value === 'html-source' && $('import-source-url')) $('import-source-url').value = HTML_SOURCE_SAMPLE.sourceURL;
    if (pasteFirst && $('import-format').value !== 'html-source') { try { previewCopied({ format: 'html', text: FORMATTED_EXAMPLE }); } catch (error) { report(error.message); } return; }
    const example = $('import-format').value === 'html-source' ? HTML_SOURCE_SAMPLE.html : FORMATTED_EXAMPLE;
    $('import-text').value = example; $('import-text').dispatchEvent(new Event('input', { bubbles: true }));
    try { preview(example, ''); } catch (error) { clear(); report(error.message); }
  });
  async function convertWord(source) {
    const options = wordOptions(), key = JSON.stringify(options);
    const { parseDocxArticle } = await import('./docx-import.js');
    const result = await parseDocxArticle(source.bytes, source.name, options);
    if (source !== wordFile || key !== wordOptionsKey()) { report('The Word source or conversion choices changed while reading. Preview the current file again. Current writing is unchanged.'); return; }
    stage(result, key);
  }
  async function previewWord() {
    reading = true; clearPreview(); $('import-fields').disabled = true; $('cancel-import').disabled = true; updateApply(); busyChanged();
    try {
      await convertWord(wordFile);
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
    reading = true; clearAll(); $('import-fields').disabled = true; $('cancel-import').disabled = true; updateApply(); busyChanged();
    try {
      if (/\.docx$/i.test(file.name)) {
        if (file.size > MAX_DOCX_BYTES) throw new Error('Choose a .docx file no larger than 8 MiB. Current writing is unchanged.');
        wordFile = { name: file.name, bytes: await file.arrayBuffer() };
        if ($('import-word-options')) $('import-word-options').hidden = false;
        $('import-text').value = ''; sourceName = '';
        $('import-file-status').textContent = 'Selected Word document: ' + file.name + '. Preview again after changing the text revision version or table-header choice. Each new file starts with tracked changes blocked. Original bytes remain only until you clear or apply this import.';
        await convertWord(wordFile);
        return;
      }
      if (/\.(doc|docm|dotm)$/i.test(file.name)) throw new Error('Choose a plain .docx file. Old .doc and macro-enabled documents are not supported.');
      if (file.size > MAX_IMPORT_BYTES) throw new Error('Choose an article file no larger than 512 KiB. Current writing is unchanged.');
      const content = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer());
      if ($('import-format').value === 'auto' && /\.html?$/i.test(file.name)) { $('import-format').value = 'html-source'; updateFormat(); }
      $('import-text').value = content; sourceName = file.name;
      preview(content, file.name);
    } catch (error) { clearPreview(); report(error instanceof TypeError && !wordFile ? 'Use a UTF-8 text file. Current writing is unchanged.' : error.message); }
    finally { reading = false; $('import-fields').disabled = false; $('cancel-import').disabled = false; $('import-file').value = ''; updateApply(); busyChanged(); }
  });
  function applyImport(continueAfterImport = false) {
    if (!allowed()) return;
    if (continueAfterImport && (!continuationOffered() || !candidate.draft.body.trim())) return;
    if (insertion.mode() !== 'replace') {
      try {
        const plan = insertion.getPlan();
        if (plan.changed) applyInsertion(plan);
        const imagesAfter = wordImageAfterApply(candidate, imageChoice(), wordImageKit);
        discardImport();
        $('import-completion').hidden = false;
        $('import-completion').textContent = (plan.changed ? 'Writing inserted locally. Existing page details and private notes were kept. Recheck the article before exporting; approval was cleared.' : 'No changes needed. Existing writing and approval were kept.') + (imagesAfter ? ' ' + imagesAfter : '');
        report(plan.changed ? 'Article insertion applied locally. Previous writing is in Revisions in this tab. Existing title, page fields, source notes, and review notes were kept. Approval and the linked-image choice were cleared.' : 'This insertion already matches. Writing, approval, and history were kept.');
      } catch (error) { report(error.message); updateApply(); }
      return;
    }
    if (hasArticle() && !confirm('Replace the article, page details, review questions, and any unsaved passage review, image preparation, link preparation, or table preparation with this import? ' + (hasTextRevisions() ? revisionLabel() + ' is selected. Its text revision history will be flattened. ' : '') + 'Save a private backup to keep saved writing first. Unsaved preparation is excluded from files. Source notes are kept.')) {
      report('Import cancelled. Current article and source notes are unchanged.'); return;
    }
    try {
      apply(commentRecovery?.draft(candidate.draft) || candidate.draft, { continueToExport: continueAfterImport });
      const imagesAfter = wordImageAfterApply(candidate, imageChoice(), wordImageKit);
      discardImport();
      $('import-completion').hidden = false;
      $('import-completion').textContent = (continueAfterImport ? 'Article imported. Export review is next, with approval still required. Nothing has been published.' : 'Article imported locally. Edit or review your article below before exporting. Export approval was cleared.') + (imagesAfter ? ' ' + imagesAfter : '');
      report('Article imported locally. Source notes were kept and export approval was cleared. Review before exporting. Nothing was uploaded or sent to AI.');
      if (continueAfterImport) continueToExport();
    } catch (error) { report(error.message); }
  }
  $('apply-import').addEventListener('click', () => applyImport());
  continueButton?.addEventListener('click', () => applyImport(true));
  $('cancel-import').addEventListener('click', () => {
    if (reading) return;
    discardImport();
    report('Import preview cleared. Current article and notes are unchanged.');
  });
  showFormat(); updateApply();
  return { reading: () => reading, staged: () => Boolean(candidate && !copiedFailed), clear: discardImport, updateBusy: updateApply, pending: () => Boolean(candidate || wordFile || copiedSource || $('import-text').value.trim() || $('import-source-url')?.value.trim()), openCopied: () => {
    if (reading || isBusy()) return;
    $('import-panel').open = true; $('import-format').value = 'html'; showFormat();
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
