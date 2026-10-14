import { analyzeDraft, articleStructure, REVIEW_LIMIT } from './draft-review.js';

export function installDraftReview({ getDraft, report }) {
  const $ = id => document.getElementById(id);
  let checked = null, snapshot = '', outlineBody = null;
  const signature = draft => JSON.stringify([draft.title, draft.body]);
  function jump(item) {
    const body = $('body'); body.focus(); body.setSelectionRange(item.start, item.end);
    body.scrollTop = Math.max(0, (item.line - 2) * (parseFloat(getComputedStyle(body).lineHeight) || 24));
    report('Selected article text on line ' + item.line + '. Edit it in the article field.');
  }
  function button(item, label) {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'secondary review-jump'; button.textContent = label;
    button.addEventListener('click', () => jump(item)); return button;
  }
  function outline() {
    const body = getDraft().body;
    // Preserve button nodes through editor blur, so a pending click still fires.
    if (body === outlineBody) return;
    outlineBody = body;
    const headings = articleStructure(body).filter(block => block.kind === 'heading');
    $('outline-status').textContent = headings.length ? headings.length + ' heading(s). Select one to edit its source.' + (headings.length > REVIEW_LIMIT ? ' Showing the first ' + REVIEW_LIMIT + '.' : '') : 'No Markdown headings yet. Add a heading with the formatting tools when it helps the reader.';
    $('article-outline').replaceChildren(...headings.slice(0, REVIEW_LIMIT).map(item => {
      const li = document.createElement('li');
      li.append(button(item, 'Line ' + item.line + ': ' + '#'.repeat(item.level) + ' ' + (item.text.slice(0, 120) || '(empty heading)'))); return li;
    }));
  }
  function refresh() {
    if (checked && signature(getDraft()) !== snapshot) {
      checked = null; $('draft-findings').replaceChildren(); $('draft-links').replaceChildren(); $('copy-checks').disabled = true;
      $('draft-check-status').textContent = 'The article changed. Run checks again for current findings and text positions.';
      $('draft-check-stats').textContent = '';
    }
    if ($('draft-check-panel').open) outline();
  }
  $('draft-check-panel').addEventListener('toggle', refresh);
  $('start-checks').addEventListener('click', () => {
    $('draft-check-panel').open = true; $('run-checks').click();
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
      $('copy-checks').disabled = !draft.body.trim();
      report('Local draft checks complete. Your writing and export approval were kept. Review the results before publishing.');
    } catch (error) { report(error.message); }
  });
  $('copy-checks').addEventListener('click', async () => {
    if (!checked || signature(getDraft()) !== snapshot) { refresh(); return; }
    const text = ['Draft to Page: local draft checks', $('draft-check-stats').textContent, $('draft-check-status').textContent,
      ...checked.findings.map(item => '- Line ' + item.line + ': ' + item.message),
      'Limited writing-pattern checks only. No fact-checking or URL verification. Source notes and private review notes are excluded.'].join('\n');
    try { await navigator.clipboard.writeText(text); report('Draft check summary copied. No upload was made.'); }
    catch { report('Clipboard unavailable. Select the visible check results and copy them manually.'); }
  });
  return { refresh };
}
