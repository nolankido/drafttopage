import { revealDetails } from './disclosure.js';
import { imageEditTarget, planImageEdit, describeWordImagePlaceholders, IMAGE_ALT_LIMIT, IMAGE_URL_LIMIT } from './image-editing.js';
import { installWordImageMap } from './word-image-map-controls.js';
import { standaloneWordPressImage } from './wordpress-images.js';
import { revealArticleSelection } from './editing.js';
import { installPasteGuard } from './paste-guard.js';

export function installImageEditor({ getBody, apply, workChanged, report, isBusy = () => false, confirmAction = message => confirm(message), reveal = revealArticleSelection }) {
  const $ = id => document.getElementById(id);
  let target = null, preview = null, snapshot = null, placeholders = [], message = 'Choose a location, enter the image details, then preview the change.';
  const fields = () => ({ url: $('image-url').value, alt: $('image-alt').value, decorative: $('image-decorative').checked });
  const hasWork = () => Boolean(target || fields().url || fields().alt || fields().decorative || imageMap.hasWork());
  const status = text => { message = text; $('image-editor-status').textContent = text; };
  function purgePreview() {
    preview = null; $('image-before').value = ''; $('image-after').value = ''; $('image-change-preview').hidden = true;
  }
  function refresh() {
    const body = getBody(), busy = isBusy(), stale = target && target.body !== body;
    if (snapshot !== body) {
      snapshot = body;
      try { placeholders = describeWordImagePlaceholders(body); } catch { placeholders = []; }
      $('image-placeholder-select').replaceChildren(...placeholders.slice(0, 40).map((item, index) => {
        const option = document.createElement('option'); option.value = String(index); option.textContent = item.label + (item.count > 1 ? ' (occurrence ' + item.occurrence + ' of ' + item.count + ')' : '') + ' on line ' + item.line + ': ' + item.context; return option;
      }));
      $('image-placeholder-choices').hidden = !placeholders.length;
      $('image-placeholder-limit').textContent = placeholders.length > 40 ? 'Showing the first 40 of ' + placeholders.length + ' Word placeholders. Apply a replacement to continue through the list.' : '';
      $('article-image-status').textContent = placeholders.length ? placeholders.length + ' omitted Word image placeholder(s). Use Add or edit image to prepare replacements.' : '';
    }
    if (stale) { purgePreview(); $('image-target-context').value = ''; }
    for (const id of ['start-image-editor','image-use-selection','image-at-end','image-url','image-alt','image-decorative']) $(id).disabled = busy;
    $('image-use-placeholder').disabled = busy || !placeholders.length;
    $('image-placeholder-select').disabled = busy;
    $('image-preview').disabled = busy || !target || Boolean(stale);
    $('image-apply').disabled = busy || !preview || Boolean(stale);
    $('image-discard').disabled = busy || !hasWork();
    $('image-target-status').textContent = !target ? 'Choose a location before preparing a change.' : stale ? 'The article changed. Choose a current location again. Pending image details are kept.' : (target.start === target.end ? 'Insert at' : 'Replace ' + (target.end - target.start) + ' selected characters on') + ' line ' + target.line + '.';
    $('image-editor-status').textContent = stale ? 'The article changed. The old preview was cleared; choose a current location before previewing again.' : message;
    const item = placeholders[Number($('image-placeholder-select').value)];
    $('image-placeholder-context').value = item?.context || '';
    imageMap.refresh();
  }
  function clear({ keepMap = false } = {}) {
    target = null; $('image-url').value = ''; $('image-alt').value = ''; $('image-decorative').checked = false;
    $('image-target-context').value = '';
    purgePreview(); for (const guard of guards) guard.clear(); if (!keepMap) imageMap.clear(); status('Image preparation cleared. The article is kept.'); refresh(); workChanged();
  }
  function choose(start, end, { edit = true } = {}) {
    if (isBusy()) return false;
    try {
      const next = imageEditTarget(getBody(), start, end), existing = edit ? standaloneWordPressImage(next.before) : null;
      if (existing && (existing.target.length > IMAGE_URL_LIMIT || existing.alt.length > IMAGE_ALT_LIMIT)) throw new Error('This image exceeds the guided editor limits. Edit it directly in the article.');
      if (existing && hasWork() && (fields().url !== existing.target || fields().alt !== existing.alt) && !confirmAction('Replace the pending image details with this selected image? The article is kept.')) return false;
      if (existing) { $('image-url').value = existing.target; $('image-alt').value = existing.alt; $('image-decorative').checked = false; }
      target = next; purgePreview(); status(existing ? 'Selected image loaded. Review its URL and alternative text. Empty alternative text requires an explicit decorative choice.' : 'Location selected. Enter image details and preview the exact change.');
      $('image-target-context').value = getBody().slice(Math.max(0, start - 120), Math.min(getBody().length, end + 120));
      revealDetails($('image-editor-panel')); refresh(); workChanged(); $('image-url').focus(); return true;
    } catch (error) { status(error.message); report(error.message); return false; }
  }
  const imageMap = installWordImageMap({ getTarget: () => target, getBody, isBusy, workChanged, useAlt: alt => {
    if (isBusy() || !target || target.body !== getBody()) return false;
    if ((fields().alt && fields().alt !== alt || fields().decorative) && !confirmAction('Replace the pending alternative text with the inspected Word alternative text? The article and URL are kept.')) return false;
    if (isBusy() || !target || target.body !== getBody()) return false;
    $('image-alt').value = alt; $('image-decorative').checked = false; purgePreview();
    status('Word alternative text is prepared. Review its meaning in this article, then preview again.'); refresh(); workChanged(); return true;
  }});
  const guards = [['image-url', IMAGE_URL_LIMIT], ['image-alt', IMAGE_ALT_LIMIT]].map(([id, limit]) => installPasteGuard({ element: $(id), limit, label: id === 'image-url' ? 'The image URL' : 'Alternative text', report: text => { if (text) { status(text); report(text); } } }));
  for (const id of ['image-url','image-alt','image-decorative']) $(id).addEventListener(id === 'image-decorative' ? 'change' : 'input', () => { purgePreview(); status('Image details changed. Preview again before applying.'); refresh(); workChanged(); });
  $('image-use-selection').addEventListener('click', () => choose($('body').selectionStart, $('body').selectionEnd));
  $('image-at-end').addEventListener('click', () => choose(getBody().length, getBody().length, { edit: false }));
  $('start-image-editor').addEventListener('click', () => {
    if (isBusy()) return;
    revealDetails($('image-editor-panel'));
    if (!hasWork()) choose($('body').selectionStart, $('body').selectionEnd);
    else { refresh(); $('image-url').focus(); }
  });
  $('image-use-placeholder').addEventListener('click', () => {
    if (isBusy() || snapshot !== getBody()) { refresh(); return; }
    const index = Number($('image-placeholder-select').value), item = Number.isInteger(index) ? placeholders[index] : null;
    if (item) choose(item.start, item.end, { edit: false });
  });
  $('image-placeholder-select').addEventListener('change', refresh);
  $('image-preview').addEventListener('click', () => {
    if (isBusy()) return;
    purgePreview();
    try {
      const plan = planImageEdit(target, fields(), getBody());
      preview = { plan, fields: JSON.stringify(fields()) };
      $('image-before').value = plan.before; $('image-after').value = plan.replacement; $('image-change-preview').hidden = false;
      status(plan.changed ? 'Exact change prepared. Read the selected text and replacement, then apply to the article.' : 'The image already matches. Applying will keep writing and approval unchanged.');
    } catch (error) { status(error.message); report(error.message); }
    refresh();
  });
  $('image-apply').addEventListener('click', () => {
    if (isBusy()) return;
    try {
      if (!preview || preview.fields !== JSON.stringify(fields())) throw new Error('Preview the current image details before applying.');
      const plan = planImageEdit(target, fields(), getBody());
      if (plan.changed) apply(plan, 'Before image change');
      clear({ keepMap: true }); $('body').focus(); $('body').setSelectionRange(plan.selectionStart, plan.selectionEnd);
      try { reveal($('body')); } catch { /* Exact selection remains available. */ }
      const text = plan.changed ? 'Image Markdown applied. Previous writing is in Revisions in this tab. Approval and the linked-image choice were cleared. For WordPress, explicitly choose linked images again. No image was loaded.' : 'The image already matches. Writing and approval were kept.';
      status(text); report(text);
    } catch (error) { status(error.message); report(error.message); refresh(); }
  });
  $('image-discard').addEventListener('click', () => { if (!isBusy()) clear(); });
  $('image-editor-panel').addEventListener('toggle', () => { if (!$('image-editor-panel').open) purgePreview(); refresh(); });
  refresh();
  return { refresh, clear, hasWork, editImage: (start, end) => choose(start, end) };
}
