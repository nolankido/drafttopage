import { revealDetails } from './disclosure.js';
import { articleLinks, articleLinkNotes, linkEditTarget, planLinkEdit, LINK_LABEL_LIMIT, LINK_URL_LIMIT, LINK_REVIEW_LIMIT } from './link-editing.js';
import { revealArticleSelection } from './editing.js';
import { installPasteGuard } from './paste-guard.js';
import { downloadText } from './download.js';

export function installLinkEditor({ getBody, apply, workChanged, report, isBusy = () => false, confirmAction = message => confirm(message), reveal = revealArticleSelection, download = downloadText }) {
  const $ = id => document.getElementById(id);
  let target = null, preview = null, snapshot = null, rendered = null, links = [], error = '', message = 'Choose article text or an existing link, enter details, then preview.';
  const fields = () => ({ label: $('link-label').value, url: $('link-url').value });
  const hasWork = () => Boolean(target || fields().label || fields().url);
  const status = text => { message = text; $('link-editor-status').textContent = text; };
  function purgePreview() { preview = null; $('link-before').value = ''; $('link-after').value = ''; $('link-change-preview').hidden = true; }
  function refresh() {
    const body = getBody(), busy = isBusy(), stale = target && target.body !== body;
    if (body !== snapshot) {
      snapshot = body;
      try { links = articleLinks(body); error = ''; } catch (failure) { links = []; error = failure.message; }
    }
    if (stale) purgePreview();
    const visible = $('link-editor-panel').open && $('article-link-list-panel').open;
    if (!visible) { $('article-link-list').replaceChildren(); rendered = null; }
    else if (rendered !== snapshot) {
      rendered = snapshot;
      $('article-link-list').replaceChildren(...links.slice(0, LINK_REVIEW_LIMIT).map(link => {
        const li = document.createElement('li'), label = document.createElement('p'), url = document.createElement('p'), state = document.createElement('p'), edit = document.createElement('button');
        label.textContent = 'Line ' + link.line + ' · ' + (link.label || '(empty label)'); url.textContent = 'URL: ' + link.url;
        state.textContent = (link.href ? 'Supported web link. Destination not verified.' : 'Stays literal text. Use a non-empty label and an absolute HTTP or HTTPS URL without credentials.') + (link.inTable ? ' Edit table links directly in the article.' : '') + (link.formattedLabel || link.inEmphasis ? ' Edit this formatted link directly in the article; the Edit button selects its source.' : '') + (/^(?:click here|here|read more|link)$/i.test(link.label.trim()) ? ' Consider a more descriptive label.' : '');
        edit.type = 'button'; edit.className = 'secondary'; edit.textContent = 'Edit link on line ' + link.line;
        const original = snapshot;
        edit.addEventListener('click', () => {
          if (isBusy()) return;
          if (getBody() !== original) { refresh(); report('The article changed. Choose a link from its current list.'); return; }
          if (!choose(link.start, link.end)) {
            $('body').focus(); $('body').setSelectionRange(link.start, link.end);
            try { reveal($('body')); } catch { /* Exact source selection is kept. */ }
          }
        });
        li.append(label, url, state, edit); return li;
      }));
    }
    for (const button of $('article-link-list').querySelectorAll('button')) button.disabled = busy;
    $('article-link-status').textContent = error || (links.length + ' recognized inline link(s); ' + links.filter(link => link.href).length + ' supported web link(s). ' + (links.length > LINK_REVIEW_LIMIT ? 'Showing the first 40; the download includes all. ' : '') + 'Links inside supported emphasis are included. Plain URLs, reference links, images, nested links, and code are outside this inspection. No URLs were visited.');
    for (const id of ['start-link-editor','link-use-selection','link-label','link-url']) $(id).disabled = busy;
    $('link-preview').disabled = busy || !target || Boolean(stale);
    $('link-preview-remove').disabled = busy || !target?.existing || Boolean(stale);
    $('link-apply').disabled = busy || !preview || Boolean(stale);
    $('link-discard').disabled = busy || !hasWork();
    $('download-link-notes').disabled = busy || !links.length;
    $('link-target-status').textContent = !target ? 'Choose a location or an existing link.' : stale ? 'The article changed. Choose a current location again; pending details are kept.' : (target.existing ? 'Edit the complete link on' : target.start === target.end ? 'Insert a link at' : 'Replace ' + (target.end - target.start) + ' selected characters on') + ' line ' + target.line + '.';
    $('link-editor-status').textContent = stale ? 'The article changed. The old preview was cleared. Choose a current selection or link again.' : message;
  }
  function clear() {
    target = null; $('link-label').value = ''; $('link-url').value = ''; purgePreview(); for (const guard of guards) guard.clear();
    status('Link preparation cleared. Article writing and approval are kept.'); refresh(); workChanged();
  }
  function choose(start, end) {
    if (isBusy()) return false;
    try {
      const next = linkEditTarget(getBody(), start, end);
      const nextFields = next.existing ? { label: next.label, url: next.url } : { ...fields(), ...(next.before ? { label: next.label } : {}) };
      if ((fields().label || fields().url) && JSON.stringify(nextFields) !== JSON.stringify(fields()) && !confirmAction('Replace the pending link details with this article selection? The article is kept.')) return false;
      target = next; $('link-label').value = nextFields.label; $('link-url').value = nextFields.url; purgePreview();
      revealDetails($('link-editor-panel')); status(next.existing ? 'Complete link selected. Preview a correction or remove the link while keeping its original text.' : 'Location selected. Review the link text and destination before previewing.'); refresh(); workChanged();
      $(next.existing || next.before ? 'link-url' : 'link-label').focus(); return true;
    } catch (failure) { status(failure.message); report(failure.message); return false; }
  }
  const guards = [['link-label', LINK_LABEL_LIMIT], ['link-url', LINK_URL_LIMIT]].map(([id, limit]) => installPasteGuard({ element: $(id), limit, label: id === 'link-url' ? 'The link URL' : 'Link text', report: text => { if (text) { status(text); report(text); } } }));
  for (const id of ['link-label','link-url']) $(id).addEventListener('input', () => { purgePreview(); status('Link details changed. Preview again before applying.'); refresh(); workChanged(); });
  $('link-use-selection').addEventListener('click', () => choose($('body').selectionStart, $('body').selectionEnd));
  $('start-link-editor').addEventListener('click', () => {
    if (isBusy()) return;
    revealDetails($('link-editor-panel'));
    if (!hasWork()) choose($('body').selectionStart, $('body').selectionEnd);
    else { refresh(); $('link-label').focus(); }
  });
  function prepare(mode) {
    if (isBusy()) return;
    purgePreview();
    try {
      const plan = planLinkEdit(target, fields(), getBody(), mode);
      preview = { plan, fields: JSON.stringify(fields()) }; $('link-before').value = plan.before; $('link-after').value = plan.replacement; $('link-change-preview').hidden = false;
      status(!plan.changed ? 'This link already matches. Applying will keep writing and approval unchanged.' : mode === 'remove' ? 'Removal preview ready. The original link text is kept; pending label or URL edits are not used. Inspect before applying.' : 'Exact link change prepared. Inspect both passages before applying.');
    } catch (failure) { status(failure.message); report(failure.message); }
    refresh();
  }
  $('link-preview').addEventListener('click', () => prepare('edit'));
  $('link-preview-remove').addEventListener('click', () => prepare('remove'));
  $('link-apply').addEventListener('click', () => {
    if (isBusy()) return;
    try {
      if (!preview || preview.fields !== JSON.stringify(fields())) throw new Error('Preview the current link change before applying.');
      const plan = planLinkEdit(target, fields(), getBody(), preview.plan.mode);
      if (plan.changed) apply(plan, plan.mode === 'remove' ? 'Before removing a link' : 'Before link change');
      clear(); $('body').focus(); $('body').setSelectionRange(plan.selectionStart, plan.selectionEnd); try { reveal($('body')); } catch { /* Exact selection remains available. */ }
      const text = plan.changed ? 'Link ' + (plan.mode === 'remove' ? 'removed, keeping its original text' : 'change applied') + '. Previous writing is in Revisions in this tab. Export approval and the linked-image choice were cleared. No destination was loaded.' : 'The link already matches. Writing and approval were kept.';
      status(text); report(text);
    } catch (failure) { status(failure.message); report(failure.message); refresh(); }
  });
  $('link-discard').addEventListener('click', () => { if (!isBusy()) clear(); });
  $('link-editor-panel').addEventListener('toggle', () => { if (!$('link-editor-panel').open) purgePreview(); refresh(); });
  $('article-link-list-panel').addEventListener('toggle', refresh);
  $('download-link-notes').addEventListener('click', () => {
    if (isBusy()) return;
    try { download(articleLinkNotes(getBody()), 'article-link-review.txt', 'text/plain;charset=utf-8'); report('Link review notes download requested. It contains article link text and URLs only. Inspect before sharing; private source/review notes are excluded. No destination was loaded.'); }
    catch (failure) { report(failure.message); }
  });
  refresh();
  return { refresh, clear, hasWork, editLink: choose };
}
