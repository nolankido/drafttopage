import { articleIssues, ARTICLE_LIMITS } from './authoring.js';
import { reviewWordPress } from './wordpress-review.js';
import { wordPressKitFiles, wordPressKitSummary, createWordPressKit } from './wordpress-kit.js';
import { revealArticleSelection, revealEditorFor } from './editing.js';
import { downloadText } from './download.js';

export function installWordPressHandoff({ getDraft, approved, report, isBusy = () => false, getWordPressOptions = () => ({}), reveal = revealArticleSelection, clipboardBusy = () => false, clipboardChanged = () => {}, reportCopy = report }) {
  const $ = id => document.getElementById(id);
  let signature = '', review = null, rendered = '', kitRendered = '', fieldCopying = false;
  const draftSignature = draft => JSON.stringify([draft.title, draft.body]);
  const fieldValid = (draft, key) => typeof draft[key] === 'string' && Boolean(draft[key].trim()) && draft[key].length <= ARTICLE_LIMITS[key] && !draft[key].includes('\u0000') && (key !== 'slug' || /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(draft[key]));
  function update() {
    const draft = getDraft(), visible = $('publishing-destination').value === 'wordpress';
    const options = getWordPressOptions(), next = JSON.stringify([draftSignature(draft), options]);
    if (next !== signature) { signature = next; try { review = reviewWordPress(draft, options); } catch { review = null; } }
    $('wordpress-review-status').textContent = !review ? 'Add an article to inspect the handoff.' : review.totalFindings ? review.totalFindings + ' item(s) to inspect before publishing.' + (review.truncated ? ' Showing the first ' + review.findings.length + '; inspect the complete article.' : '') : 'No items found by these limited checks. Review the actual post and your source before publishing.';
    if (!visible || !$('wordpress-review-panel').open || !review) {
      $('wordpress-findings').replaceChildren(); rendered = '';
    } else if (rendered !== signature) {
      rendered = signature;
      $('wordpress-findings').replaceChildren(...review.findings.map(item => {
        const li = document.createElement('li'), text = document.createElement('p'), button = document.createElement('button');
        text.textContent = 'Line ' + item.line + ': ' + item.message;
        button.type = 'button'; button.className = 'secondary'; button.textContent = 'Inspect line ' + item.line;
        // Recheck both the source and destination before using saved text positions.
        const original = signature;
        button.addEventListener('click', () => {
          if (isBusy()) return;
          if ($('publishing-destination').value !== 'wordpress' || JSON.stringify([draftSignature(getDraft()), getWordPressOptions()]) !== original) { update(); report('The article changed. Use its current handoff findings.'); return; }
          const body = $('body'); body.focus(); body.setSelectionRange(item.start, item.end);
          try { reveal(body); } catch { /* Selection still works if geometry is unavailable. */ }
          report('Selected article text on line ' + item.line + '. Inspect or edit it; nothing was changed automatically.');
        });
        li.append(text, button); return li;
      }));
    }
    for (const key of ['excerpt', 'slug', 'description']) $('copy-wordpress-' + key).disabled = isBusy() || fieldCopying || clipboardBusy() || !visible || !$('reviewed').checked || !fieldValid(draft, key);
    if ($('wordpress-field-actions')) $('wordpress-field-actions').setAttribute('aria-busy', String(fieldCopying || clipboardBusy()));
    const available = ['excerpt', 'slug', 'description'].filter(key => fieldValid(draft, key));
    $('wordpress-fields-status').textContent = available.length ? 'Optional fields available: ' + available.join(', ') + '. Copy each into its separate destination field after review.' : 'Optional post fields are empty or need editing. They are not required for copying blocks.';
    let kit = null, error = '';
    try { kit = wordPressKitSummary(draft, options); } catch (failure) { error = failure.message; }
    $('download-wordpress-kit').disabled = isBusy() || !visible || !$('reviewed').checked || !kit;
    $('wordpress-kit-status').textContent = kit ? 'Six files for a complete manual WordPress handoff. ' + kit.notices.join(' ') : 'Add a valid title and article for a WordPress kit. ' + error;
    if (visible && $('wordpress-kit-panel').open && kit) {
      const nextKit = JSON.stringify([draft.title, draft.body, draft.excerpt, draft.slug, draft.description, options]);
      if (kitRendered !== nextKit) {
        kitRendered = nextKit;
        $('wordpress-kit-files').replaceChildren(...wordPressKitFiles(draft, options).files.map(file => { const li = document.createElement('li'); li.textContent = file.name + ': ' + file.purpose; return li; }));
      }
    } else { $('wordpress-kit-files').replaceChildren(); kitRendered = ''; }
  }
  $('wordpress-review-panel').addEventListener('toggle', update);
  $('wordpress-kit-panel').addEventListener('toggle', update);
  $('wordpress-edit-fields').addEventListener('click', () => { revealEditorFor($('page-details')); $('page-details').open = true; $('excerpt').focus(); report('Edit optional post fields here, then review again. WordPress uses its own title, excerpt, and slug fields; an SEO description depends on your SEO tool.'); });
  for (const key of ['excerpt', 'slug', 'description']) $('copy-wordpress-' + key).addEventListener('click', async () => {
    if (isBusy() || fieldCopying || clipboardBusy() || $('publishing-destination').value !== 'wordpress') return;
    try {
      const copyState = () => JSON.stringify([getDraft()[key], $('publishing-destination').value]), original = copyState();
      approved(); const draft = getDraft();
      if (!fieldValid(draft, key)) throw new Error('Add a valid ' + key + ' first.');
      fieldCopying = true; clipboardChanged(true);
      const request = navigator.clipboard.writeText(draft[key].trim());
      update(); reportCopy('Copying the ' + key + '. Wait for confirmation before pasting.');
      await request;
      if (copyState() !== original || !$('reviewed').checked) {
        reportCopy('An earlier ' + key + ' was copied. The field, destination, or review changed while copying. Review and copy the current value again before continuing in WordPress.'); return;
      }
      reportCopy(key[0].toUpperCase() + key.slice(1) + ' copied separately. Paste into ' + ({ excerpt: 'the WordPress Excerpt setting', slug: 'the WordPress Slug/permalink setting when available', description: 'your SEO description field only if your SEO tool offers it' })[key] + '. Nothing was published.');
    } catch (error) { reportCopy('Field copy unavailable. Select the field under Page details and copy it manually. ' + error.message); }
    finally { if (fieldCopying) { fieldCopying = false; clipboardChanged(false); } update(); }
  });
  $('download-wordpress-kit').addEventListener('click', () => {
    if (isBusy() || $('publishing-destination').value !== 'wordpress') return;
    try { approved(); const kit = createWordPressKit(getDraft(), getWordPressOptions()); downloadText(kit.bytes, kit.filename, 'application/zip'); report('WordPress kit download requested with six article files, current handoff findings, image handoff notes, and destination instructions. Inspect the files before sharing. Private source and review notes are excluded. Nothing was published.'); }
    catch (error) { report(error.message); }
  });
  return { update, reset: () => { signature = ''; review = null; rendered = ''; kitRendered = ''; $('wordpress-findings').replaceChildren(); $('wordpress-kit-files').replaceChildren(); } };
}
