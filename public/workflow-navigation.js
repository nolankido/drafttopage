// Navigation changes only the view. Approval and publishing remain separate actions.
function openAncestors(node) {
  for (let current = node; current; current = current.parentElement) if (current.tagName === 'DETAILS') current.open = true;
}
export function measureWorkflow(bar) {
  if (!bar) return;
  const sticky = typeof getComputedStyle === 'function' && getComputedStyle(bar).position === 'sticky';
  bar.parentElement?.style?.setProperty('--workflow-offset', (sticky ? Math.ceil(bar.getBoundingClientRect().height) + 20 : 20) + 'px');
}
export function focusWorkflowTarget(target, { bar, anchor = target } = {}) {
  if (!target || !anchor) return false;
  openAncestors(target); openAncestors(anchor);
  measureWorkflow(bar);
  if (!target.hasAttribute('tabindex') && !['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A', 'SUMMARY'].includes(target.tagName)) target.setAttribute('tabindex', '-1');
  anchor.setAttribute('data-workflow-anchor', '');
  target.focus({ preventScroll: true });
  // CSS supplies reduced-motion behavior and an offset for the measured step bar.
  anchor.scrollIntoView({ block: 'start', inline: 'nearest', behavior: 'auto' });
  return true;
}
export function installWorkflowNavigation({ getDraft, getImportState = () => ({}), isBusy = () => false, refreshPreview, report, move = focusWorkflowTarget }) {
  const $ = id => document.getElementById(id), bar = $('workflow-steps');
  const bring = bar.querySelector('[data-workflow-step="bring"]');
  const buttons = { bring, review: $('start-review'), export: $('start-handoff') };
  const source = bring.id === 'start-word-file' ? 'word' : bring.id === 'start-copied-paste' ? 'copied' : bring.id === 'start-html-source' ? 'html' : 'text';
  let selected = 'bring', lastBody, lastTitle, lastReviewed, editingCurrent = false;
  const actionForDestination = () => ({
    wordpress: { id: 'copy-wordpress', label: 'Copy WordPress blocks' },
    markdown: { id: 'copy-article-markdown', label: 'Copy article Markdown' },
    html: { id: 'copy-html-source', label: 'Copy HTML source' },
    word: { id: 'download-word', label: 'Download Word' },
    other: { id: 'copy-body', label: 'Copy article body' }
  })[$('publishing-destination').value] || null;
  const exportUnavailable = target => !target || target.disabled || target.getAttribute?.('aria-disabled') === 'true';
  const destination = () => ({ wordpress: 'WordPress', markdown: 'Markdown', html: 'HTML source', word: 'Word', other: 'another export' })[$('publishing-destination').value] || 'your export';
  function update() {
    const draft = getDraft(), hasBody = Boolean(draft.body.trim()), pending = getImportState(), busy = isBusy();
    if (draft.body !== lastBody || draft.title !== lastTitle) selected = hasBody ? 'review' : 'bring';
    lastBody = draft.body; lastTitle = draft.title;
    if ($('reviewed').checked && !lastReviewed && hasBody && !pending.pending) selected = 'export';
    lastReviewed = $('reviewed').checked;
    if (pending.pending || !hasBody) editingCurrent = false;
    const current = busy || pending.pending || !hasBody ? 'bring' : selected;
    bar.dataset.step = current;
    for (const [step, button] of Object.entries(buttons)) {
      if (step === current) button.setAttribute('aria-current', 'step'); else button.removeAttribute('aria-current');
      button.disabled = busy;
    }
    const message = busy ? 'Wait for the current file operation. Your article is kept.' : pending.pending ? pending.staged ? 'An import is waiting for review. Apply or clear it before continuing with this article.' : 'An import is unfinished. Preview or clear it before continuing.' : !hasBody ? source === 'word' ? 'Choose a Word document to begin.' : source === 'copied' ? 'Paste a copied selection to begin.' : source === 'html' ? 'Paste HTML source or choose an HTML file to begin.' : 'Add your article to begin.' : editingCurrent ? 'Editing the current article. Your writing and review choice are kept; changing the article clears export approval.' : $('reviewed').checked ? 'Export review is checked. Use the available ' + destination() + ' controls below, then inspect the result in your destination.' : current === 'export' ? 'Review is required before copying or downloading. Choose your destination and title handling below.' : 'Article in the editor. Read the preview, compare it with your source, then choose your export.';
    $('workflow-status').textContent = message;
    $('review-current-article').hidden = !hasBody && !pending.pending;
    $('review-current-article').disabled = busy;
    $('review-current-article').textContent = pending.pending ? 'Review pending import' : 'Review this article';
    $('continue-to-export').hidden = !hasBody || Boolean(pending.pending);
    $('continue-to-export').disabled = busy;
    $('continue-to-export').textContent = 'Continue to ' + destination();
    for (const id of ['workflow-edit', 'edit-from-preview', 'edit-from-export']) {
      const button = $(id);
      if (button) {
        button.hidden = !hasBody && !pending.pending;
        button.disabled = busy;
        button.textContent = pending.pending ? 'Review pending import' : id === 'workflow-edit' ? 'Edit current article' : 'Back to article editor';
      }
    }
    const action = actionForDestination(), target = action ? $(action.id) : null;
    const shortcut = $('approved-export-shortcut'), jump = $('jump-to-primary-export');
    shortcut.hidden = !hasBody || Boolean(pending.pending);
    jump.disabled = busy || !hasBody || Boolean(pending.pending) || !$('reviewed').checked || exportUnavailable(target);
    if (action) {
      jump.textContent = 'Go to ' + action.label;
      jump.setAttribute('aria-controls', action.id);
    }
    $('approved-export-hint').textContent = !$('reviewed').checked
      ? 'Review the article above to enable this shortcut. It never copies, downloads, or publishes.'
      : jump.disabled ? 'Finish any required export checks first. Your article stays unchanged.'
      : 'Moves focus to the existing ' + action.label + ' control. Select that control to copy or download. Nothing is published.';
    buttons.export.setAttribute('aria-label', $('publishing-destination').value === 'other' ? '3. Choose export options' : '3. Export to ' + destination());
    measureWorkflow(bar);
  }
  function select(step) { if (isBusy()) return; if (step !== 'bring') editingCurrent = false; selected = step; update(); }
  const navigate = (target, anchor = target) => move(target, { bar, anchor });
  function bringLocation(pending = getImportState()) {
    select('bring');
    if (pending.pending) {
      navigate(pending.staged ? $('import-preview-heading') : source === 'word' ? $('import-file') : $('import-text'));
      report(pending.staged ? 'Inspect the pending import, then apply or clear it. Your current article is kept until you apply.' : 'Finish previewing or clear the pending import. Your current article is kept.');
    } else if (source === 'word' || source === 'copied' || source === 'html') {
      navigate($(source === 'word' ? 'import-file' : 'import-text'), $('import-panel'));
      report(source === 'word' ? 'Choose a Word document and inspect its local preview before importing.' : source === 'html' ? 'Paste article HTML source and inspect its local conversion before importing.' : 'Paste your copied writing and inspect its local preview before importing.');
    } else {
      navigate($('body'), $('article-heading'));
      report('Add your article first. Review and export will use the writing you enter.');
    }
  }
  function review() {
    if (isBusy()) return;
    const pending = getImportState();
    if (pending.pending || !getDraft().body.trim()) { bringLocation(pending); return; }
    select('review'); $('preview-panel').open = true; refreshPreview();
    navigate($('article-preview'), $('conversion-heading'));
    report('Read this preview and compare it with your source. Continue to your export when ready. Navigation keeps your current approval choice.');
  }
  function edit() {
    if (isBusy()) return;
    const pending = getImportState();
    if (pending.pending) { bringLocation(pending); return; }
    select('bring'); editingCurrent = true; update(); navigate($('body'), $('article-heading'));
    report('Returned to the article editor. Your cursor position, writing, and export approval are kept. Editing writing clears approval.');
  }
  function handoff() {
    if (isBusy()) return;
    const pending = getImportState();
    if (pending.pending || !getDraft().body.trim()) { bringLocation(pending); return; }
    select('export'); navigate($('publishing-destination'), $('export-heading'));
    report('Choose your destination and inspect its handoff. Review approval is a separate checkbox. Nothing is copied, downloaded, or published by navigation.');
  }
  bring.addEventListener('click', () => { if (!isBusy()) { if (source === 'html') bringLocation(); else select('bring'); } });
  $('start-review').addEventListener('click', review);
  $('review-current-article').addEventListener('click', review);
  $('start-handoff').addEventListener('click', handoff);
  $('continue-to-export').addEventListener('click', handoff);
  $('jump-to-primary-export').addEventListener('click', () => {
    const action = actionForDestination(), target = action ? $(action.id) : null;
    if (isBusy() || getImportState().pending || !getDraft().body.trim() || !$('reviewed').checked || exportUnavailable(target)) return;
    select('export');
    navigate(target);
    report('Moved to ' + action.label + '. Activate that control to copy or download the reviewed article. Nothing was copied or published by this shortcut.');
  });
  for (const id of ['workflow-edit', 'edit-from-preview', 'edit-from-export']) $(id)?.addEventListener('click', edit);
  window.addEventListener('resize', () => measureWorkflow(bar));
  if (typeof ResizeObserver === 'function') new ResizeObserver(() => measureWorkflow(bar)).observe(bar);
  update();
  return { update, review, handoff, edit, select };
}
