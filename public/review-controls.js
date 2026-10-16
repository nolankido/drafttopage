import { revealDetails } from './disclosure.js';
import { analyzeDraft, REVIEW_LIMIT } from './draft-review.js';
import { articleSections, moveArticleSection } from './article-sections.js';
import { revealArticleSelection } from './editing.js';
import { createCopyActions } from './copy-actions.js';

export function installDraftReview({ getDraft, applySectionMove, editLink = () => false, isBusy = () => false, report, reveal = revealArticleSelection, getCopyActions = () => null }) {
  const $ = id => document.getElementById(id);
  const fallbackCopies = createCopyActions({ snapshot: () => JSON.stringify(getDraft()), report, changed: refresh });
  const copies = () => getCopyActions() || fallbackCopies;
  let checked = null, snapshot = '', outlineBody = null;
  const signature = draft => JSON.stringify([draft.title, draft.body]);
  function jump(item) {
    if (isBusy()) return;
    if (item.type === 'link' && (!checked || signature(getDraft()) !== snapshot)) { refresh(); report('The article changed. Run draft checks again before choosing a link.'); return; }
    if (item.type === 'link' && editLink(item.start, item.end)) return;
    const body = $('body'); body.focus(); body.setSelectionRange(item.start, item.end);
    try { reveal(body); } catch { /* The exact selection remains available. */ }
    report('Selected article text on line ' + item.line + '. Edit it in the article field.');
  }
  function button(item, label) {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'secondary review-jump'; button.textContent = label;
    button.addEventListener('click', () => jump(item)); return button;
  }
  function outline() {
    const body = getDraft().body;
    // Preserve button nodes through editor blur, so a pending click still fires.
    if (body === outlineBody) {
      for (const control of $('article-outline').querySelectorAll('[data-section-move]')) control.disabled = isBusy() || control.dataset.available !== 'true';
      return;
    }
    outlineBody = body;
    const { sections: headings, movable } = articleSections(body);
    $('outline-status').textContent = headings.length ? headings.length + ' heading(s). Select one to edit its source.' + (headings.length > REVIEW_LIMIT ? ' Showing the first ' + REVIEW_LIMIT + '; moves are limited to these headings.' : '') + (movable ? '' : ' Close the unfinished code fence to enable section moves.') : 'No Markdown headings yet. Add a heading with the formatting tools when it helps the reader.';
    $('article-outline').replaceChildren(...headings.slice(0, REVIEW_LIMIT).map(item => {
      const li = document.createElement('li');
      li.append(button(item, 'Line ' + item.line + ': ' + '#'.repeat(item.level) + ' ' + (item.text.slice(0, 120) || '(empty heading)')));
      const actions = document.createElement('div'); actions.className = 'section-moves';
      for (const direction of ['up', 'down']) {
        const control = document.createElement('button'); control.type = 'button'; control.className = 'secondary'; control.textContent = 'Move ' + direction;
        control.setAttribute('aria-label', 'Move ' + (item.text.slice(0, 120) || 'empty heading on line ' + item.line) + ' ' + direction);
        control.dataset.sectionMove = direction; control.dataset.headingStart = String(item.start);
        control.dataset.available = String(Boolean(applySectionMove) && movable && item[direction] !== null && item[direction] < REVIEW_LIMIT);
        control.disabled = isBusy() || control.dataset.available !== 'true';
        control.addEventListener('click', () => {
          if (isBusy() || control.dataset.available !== 'true') return;
          if (getDraft().body !== body) { outline(); report('The article changed. Choose a section from its current outline.'); return; }
          try {
            const plan = moveArticleSection(body, item.start, direction);
            applySectionMove(plan, 'Before moving a section ' + direction);
            refresh();
            const moved = $('article-outline').querySelector('[data-section-move="' + direction + '"][data-heading-start="' + plan.selectionStart + '"]');
            // Keep keyboard users in the outline for another move or navigation.
            if (moved && !moved.disabled) moved.focus();
            else moved?.closest('li').querySelector('.review-jump').focus();
            report('Section moved ' + direction + ' with its subsections. Previous writing is in Revisions in this tab. Review approval was cleared.');
          } catch (error) { report(error.message); }
        });
        actions.append(control);
      }
      li.append(actions); return li;
    }));
  }
  function refresh() {
    if (checked && signature(getDraft()) !== snapshot) {
      checked = null; $('draft-findings').replaceChildren(); $('draft-links').replaceChildren(); $('copy-checks').disabled = true;
      $('draft-check-status').textContent = 'The article changed. Run checks again for current findings and text positions.';
      $('draft-check-stats').textContent = '';
      $('draft-link-status').textContent = 'The article changed. Run checks again to inspect its current links.';
    }
    if ($('draft-check-panel').open || !getDraft().body) outline();
    $('copy-checks').disabled = !checked || !getDraft().body.trim() || isBusy() || copies().state().pending;
  }
  $('draft-check-panel').addEventListener('toggle', refresh);
  $('start-checks').addEventListener('click', () => {
    revealDetails($('draft-check-panel')); $('run-checks').click();
    $('run-checks').focus(); $('draft-check-panel').scrollIntoView({ block: 'start' });
  });
  $('run-checks').addEventListener('click', () => {
    try {
      const draft = getDraft(); checked = analyzeDraft(draft); snapshot = signature(draft); outline();
      const webLinks = checked.links.filter(link => link.href).length;
      $('draft-check-stats').textContent = checked.words + ' approximate words; ' + (checked.words ? 'about ' + checked.readingMinutes + ' minute(s) at 200 words per minute' : 'no reading-time estimate') + '; ' + checked.headings.length + ' heading(s); ' + webLinks + ' supported web link(s). Code and image syntax are excluded from the word estimate.';
      $('draft-check-status').textContent = !draft.body.trim() ? 'Add an article to review.' : checked.totalFindings ? checked.totalFindings + ' item(s) to consider.' + (checked.truncated ? ' Showing the first ' + REVIEW_LIMIT + '; resolve them and check again.' : '') : 'No patterns were flagged by these limited checks. Compare the article with your source and review its claims before approving.';
      $('draft-findings').replaceChildren(...checked.findings.map(item => {
        const li = document.createElement('li'), text = document.createElement('p'); text.textContent = item.message;
        li.append(text, button(item, 'Edit line ' + item.line)); return li;
      }));
      $('draft-links').replaceChildren(...checked.links.slice(0, REVIEW_LIMIT).map(link => {
        const li = document.createElement('li'), text = document.createElement('p');
        text.textContent = (link.type === 'image' ? 'Image' : link.href ? 'Web link' : 'Text-only link') + ': ' + (link.text || '(empty label)').slice(0, 120) + ' → ' + link.target.slice(0, 240);
        li.append(text, button(link, 'Edit link on line ' + link.line)); return li;
      }));
      $('draft-link-status').textContent = checked.links.length ? 'Inline link/image syntax found: ' + checked.links.length + '. No addresses were visited or verified.' + (checked.links.length > REVIEW_LIMIT ? ' Showing the first ' + REVIEW_LIMIT + '.' : '') : 'No supported inline link or image syntax found. Reference links and other Markdown formats are outside these checks.';
      $('copy-checks').disabled = !draft.body.trim() || isBusy() || copies().state().pending;
      report('Local draft checks complete. Your writing and export approval were kept. Review the results before publishing.');
    } catch (error) { report(error.message); }
  });
  $('copy-checks').addEventListener('click', async () => {
    if (isBusy() || !checked || signature(getDraft()) !== snapshot) { refresh(); return; }
    const text = ['Draft to Page: local draft checks', $('draft-check-stats').textContent, $('draft-check-status').textContent,
      ...checked.findings.map(item => '- Line ' + item.line + ': ' + item.message),
      'Limited writing-pattern checks only. No fact-checking or URL verification. Source notes and private review notes are excluded.'].join('\n');
    await copies().run({ destination: $('publishing-destination')?.value || 'other', label: 'the draft check summary', write: () => navigator.clipboard.writeText(text), success: 'Draft check summary copied. No upload was made.', fallback: 'Clipboard unavailable. Select the visible check results and copy them manually.' });
  });
  return { refresh };
}
