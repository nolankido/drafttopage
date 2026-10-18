import { renderPreview, previewPassages } from './preview.js';
import { revealArticleSelection } from './editing.js';
import { focusWorkflowTarget } from './workflow-navigation.js';
import { createPreviewRenderQueue } from './preview-render-queue.js';

export const PREVIEW_PASSAGE_LIMIT = 200;
const passageKind = passage => passage.blocks.length > 1 || passage.blocks[0].items ? 'list group' :
  ({ p: 'paragraph', pre: 'code block', blockquote: 'quotation', table: 'table', hr: 'separator' })[passage.blocks[0].type] || 'heading';
const lineLabel = passage => passage.line === passage.endLine ? 'line ' + passage.line : 'lines ' + passage.line + ' to ' + passage.endLine;

// Selection is always based on the current source, including its original CRLF and UTF-16 offsets.
export function passageAtPosition(passages, position) {
  if (!Number.isInteger(position) || position < 0 || !passages.length) return -1;
  const next = passages.findIndex(passage => position <= passage.end);
  return next < 0 ? passages.length - 1 : next;
}

export function installPreviewNavigation({ getDraft, isBusy = () => false, hasPendingImport = () => false, report,
  selectReview = () => {}, reveal = revealArticleSelection, move = focusWorkflowTarget }) {
  const $ = id => document.getElementById(id), toggle = $('preview-locate'), back = $('return-to-passage');
  let snapshot = null, rendered = [], hasReturn = false, passageCount = 0;
  const queue = createPreviewRenderQueue();
  const preview = $('article-preview'), panel = $('preview-panel'), status = $('preview-locate-status');
  const pending = active => {
    preview.setAttribute('aria-busy', String(active));
    preview.inert = active; // Old links and source-navigation controls cannot be used.
  };
  const blocked = () => isBusy() || hasPendingImport();
  const navigate = (target, anchor = target) => move(target, { bar: $('workflow-steps'), anchor });

  function wrap(passage, index, body) {
    if (index >= PREVIEW_PASSAGE_LIMIT) return null;
    const node = document.createElement('div'), button = document.createElement('button');
    const kind = passageKind(passage), location = lineLabel(passage);
    node.className = 'preview-passage'; node.tabIndex = -1;
    node.setAttribute('role', 'group'); node.setAttribute('aria-label', kind + ', ' + location);
    button.type = 'button'; button.className = 'secondary preview-passage-jump';
    button.textContent = 'Edit ' + kind + ' (' + location + ')'; button.disabled = blocked();
    button.addEventListener('click', () => {
      if (blocked() || !toggle.checked) return;
      if (getDraft().body !== body) { refresh(); report('The article changed. Choose a passage from the updated preview.'); return; }
      const editor = $('body');
      selectReview(); navigate(editor, $('article-heading'));
      editor.setSelectionRange(passage.start, passage.end);
      try { reveal(editor); } catch { /* Exact source selection remains available. */ }
      hasReturn = true; back.hidden = false;
      report('Selected the ' + kind + ' on ' + location + '. Edit its Markdown, then return to this passage in the preview.');
    });
    node.append(button); rendered.push({ passage, node, button }); return node;
  }

  function refresh(force = false) {
    const { title, body } = getDraft(), hasBody = Boolean(body.trim());
    toggle.disabled = !hasBody || blocked(); back.disabled = blocked();
    if (!hasBody) hasReturn = false;
    back.hidden = !hasReturn || !toggle.checked;
    if (blocked()) status.textContent = isBusy() ? 'Finish the current file operation before locating passages.' : 'Apply or clear the pending import before locating passages in the current article.';
    else if (!hasBody) status.textContent = 'Add an article to locate its passages in the editor.';
    else if (!toggle.checked) status.textContent = 'Show buttons that select the matching Markdown in the article editor. Reading links keep their normal behavior.';
    // Do not replace button nodes through editor blur or unrelated updates.
    const signature = JSON.stringify([title, body, toggle.checked]);
    const dirty = snapshot !== signature;
    if (!panel.open) { queue.clear(); pending(false); }
    else if (dirty) {
      const typingLongArticle = snapshot !== null && !force && !toggle.checked && body.length >= 12000 &&
        typeof window !== 'undefined' && typeof window.setTimeout === 'function' &&
        document.activeElement === $('body');
      if (typingLongArticle) {
        pending(true);
        // Only the latest current draft is read on delivery. The user can still
        // edit immediately; approval and recovery change synchronously elsewhere.
        queue.enqueue(() => refresh(true));
      } else {
        queue.clear();
        pending(true);
        try {
          rendered = []; passageCount = 0;
          renderPreview(preview, title, body, toggle.checked ? { wrapPassage: (passage, index) => { passageCount++; return wrap(passage, index, body); } } : {});
          snapshot = signature;
        } catch {
          // Do not keep misleading, clickable old preview content on failure.
          preview.replaceChildren();
          status.textContent = 'The reading preview could not be refreshed. Your article is still in the editor.';
        } finally { pending(false); }
      }
    } else if (queue.pending()) {
      queue.clear(); pending(false);
    }
    for (const item of rendered) item.button.disabled = blocked() || queue.pending();
    if (queue.pending() && !toggle.checked) {
      status.textContent = 'Updating the reading preview after your edits. Writing remains in this tab; keep a private backup.';
    }
    if (hasBody && !blocked() && toggle.checked) {
      status.textContent = 'Choose Edit beside a passage to select its source. Lists, quotations, code blocks, and tables are selected as complete groups.' +
        (passageCount > PREVIEW_PASSAGE_LIMIT ? ' Controls cover the first ' + PREVIEW_PASSAGE_LIMIT + ' of ' + passageCount + ' passages; the full article remains in the preview and editor.' : ' After editing, use Return to this passage in preview.');
    }
  }

  toggle.addEventListener('change', () => {
    if (blocked()) return;
    if (!toggle.checked) hasReturn = false;
    refresh();
    report(toggle.checked ? 'Passage controls are shown in the reading preview. Choosing one only selects its source text.' : 'Passage controls hidden. Your article and export approval are kept.');
  });
  back.addEventListener('click', () => {
    if (blocked() || !toggle.checked || !hasReturn) return;
    const position = $('body').selectionStart;
    $('preview-panel').open = true; refresh(true); selectReview();
    const index = passageAtPosition(previewPassages(getDraft().body), position), item = rendered[index];
    if (!item) {
      navigate($('article-preview'), $('conversion-heading'));
      report('Returned to the full reading preview. Passage controls cover its first ' + PREVIEW_PASSAGE_LIMIT + ' passages.');
      return;
    }
    navigate(item.node);
    report('Returned to the current preview passage on ' + lineLabel(item.passage) + '. Compare your changes before exporting.');
  });
  function clear() {
    queue.clear(); pending(false);
    toggle.checked = false; hasReturn = false; back.hidden = true;
    rendered = []; snapshot = null; passageCount = 0; $('preview-locate-status').textContent = '';
  }
  refresh();
  return { refresh, clear };
}
