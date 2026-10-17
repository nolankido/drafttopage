import { articleIssues, ARTICLE_LIMITS } from './authoring.js';
import { reviewWordPress } from './wordpress-review.js';
import { wordPressKitSummary, createWordPressKit } from './wordpress-kit.js';
import { wordPressKitManifest } from './kit-manifests.js';
import { revealArticleSelection } from './editing.js';
import { downloadText } from './download.js';
import { createCopyActions } from './copy-actions.js';
import { formattingActionLabel } from './export-review.js';

export function installWordPressHandoff({ getDraft, approved, report, isBusy = () => false, getWordPressOptions = () => ({}), reveal = revealArticleSelection, copyActions = null, reportAction = report, openFinding = null }) {
  const $ = id => document.getElementById(id);
  const copies = copyActions || createCopyActions({ snapshot: () => JSON.stringify([getDraft(), getWordPressOptions(), $('publishing-destination').value, $('reviewed').checked]), report, changed: update });
  let signature = '', review = null, rendered = '', kitRendered = '';
  const draftSignature = draft => JSON.stringify([draft.title, draft.body]);
  const fieldValid = (draft, key) => typeof draft[key] === 'string' && Boolean(draft[key].trim()) && draft[key].length <= ARTICLE_LIMITS[key] && !draft[key].includes('\u0000') && (key !== 'slug' || /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(draft[key]));
  function reset() {
    signature = ''; review = null; rendered = ''; kitRendered = '';
    $('wordpress-findings').replaceChildren(); $('wordpress-kit-files').replaceChildren();
    for (const id of ['wordpress-review-status', 'wordpress-fields-status', 'wordpress-kit-status']) $(id).textContent = '';
    for (const id of ['download-wordpress-kit', 'copy-wordpress-excerpt', 'copy-wordpress-slug', 'copy-wordpress-description']) $(id).disabled = true;
  }
  function update() {
    // A hidden destination needs neither a writing snapshot nor a formatting scan.
    // Drop its derived state so returning always inspects the current article.
    if ($('publishing-destination').value !== 'wordpress') { reset(); return; }
    const draft = getDraft();
    const options = getWordPressOptions(), next = JSON.stringify([draftSignature(draft), options]);
    if (next !== signature) { signature = next; try { review = reviewWordPress(draft, options); } catch { review = null; } }
    $('wordpress-review-status').textContent = !review ? 'Add an article to inspect the handoff.' : review.totalFindings ? review.totalFindings + ' item(s) to inspect before publishing.' + (review.truncated ? ' Showing the first ' + review.findings.length + '; inspect the complete article.' : '') : 'No items found by these limited checks. Review the actual post and your source before publishing.';
    if (!$('wordpress-review-panel').open || !review) {
      $('wordpress-findings').replaceChildren(); rendered = '';
    } else if (rendered !== signature) {
      rendered = signature;
      $('wordpress-findings').replaceChildren(...review.findings.map(item => {
        const li = document.createElement('li'), text = document.createElement('p'), button = document.createElement('button');
        text.textContent = 'Line ' + item.line + ': ' + item.message;
        button.type = 'button'; button.className = 'secondary'; button.textContent = 'Inspect line ' + item.line;
        // Recheck both the source and destination before using saved text positions.
        const original = signature;
        const ready = () => {
          if (isBusy()) return false;
          if ($('publishing-destination').value !== 'wordpress' || JSON.stringify([draftSignature(getDraft()), getWordPressOptions()]) !== original) { update(); report('The article changed. Use its current handoff findings.'); return false; }
          return true;
        };
        const inspect = () => {
          if (!ready()) return false;
          const body = $('body'); body.focus(); body.setSelectionRange(item.start, item.end);
          try { reveal(body); } catch { /* Selection still works if geometry is unavailable. */ }
          report('Selected article text on line ' + item.line + '. Inspect or edit it; nothing was changed automatically.');
          return true;
        };
        button.addEventListener('click', inspect);
        li.append(text, button);
        const label = formattingActionLabel(item);
        if (label && openFinding) {
          const action = document.createElement('button'); action.type = 'button'; action.className = 'secondary'; action.textContent = label;
          action.addEventListener('click', () => {
            if (!ready()) return;
            try { if (openFinding(item) === true) return; } catch { /* Manual source inspection remains available. */ }
            if (inspect()) report('The guided control is unavailable for this location. Its exact source is selected; inspect it manually. Writing and approval are kept.');
          });
          li.append(action);
        }
        return li;
      }));
    }
    for (const key of ['excerpt', 'slug', 'description']) $('copy-wordpress-' + key).disabled = copies.state().pending || isBusy() || !$('reviewed').checked || !fieldValid(draft, key);
    const available = ['excerpt', 'slug', 'description'].filter(key => fieldValid(draft, key));
    $('wordpress-fields-status').textContent = available.length ? 'Optional fields available: ' + available.join(', ') + '. Copy each into its separate destination field after review.' : 'Optional post fields are empty or need editing. They are not required for copying blocks.';
    let kit = null, error = '';
    try { kit = wordPressKitSummary(draft, options); } catch (failure) { error = failure.message; }
    $('download-wordpress-kit').disabled = isBusy() || !$('reviewed').checked || !kit;
    $('wordpress-kit-status').textContent = kit ? 'Six files for a complete manual WordPress handoff. ' + kit.notices.join(' ') : 'Add a valid title and article for a WordPress kit. ' + error;
    if ($('wordpress-kit-panel').open && kit) {
      // The visible list needs descriptions, not full HTML, reviews or ZIP files.
      // Do not retain article text in a signature for non-interactive file labels.
      const manifest = wordPressKitManifest(draft, options), nextKit = JSON.stringify(manifest.files);
      if (kitRendered !== nextKit) {
        kitRendered = nextKit;
        $('wordpress-kit-files').replaceChildren(...manifest.files.map(file => { const li = document.createElement('li'); li.textContent = file.name + ': ' + file.purpose; return li; }));
      }
    } else { $('wordpress-kit-files').replaceChildren(); kitRendered = ''; }
  }
  $('wordpress-review-panel').addEventListener('toggle', update);
  $('wordpress-kit-panel').addEventListener('toggle', update);
  $('wordpress-edit-fields').addEventListener('click', () => { $('page-details').open = true; $('excerpt').focus(); report('Edit optional post fields here, then review again. WordPress uses its own title, excerpt, and slug fields; an SEO description depends on your SEO tool.'); });
  for (const key of ['excerpt', 'slug', 'description']) $('copy-wordpress-' + key).addEventListener('click', async () => {
    if (isBusy() || $('publishing-destination').value !== 'wordpress') return;
    await copies.run({ destination: 'wordpress', label: 'the ' + key, write: () => {
      approved(); const draft = getDraft();
      if (!fieldValid(draft, key)) throw new Error('Add a valid ' + key + ' first.');
      return navigator.clipboard.writeText(draft[key].trim());
    }, success: key[0].toUpperCase() + key.slice(1) + ' copied separately. Paste into ' + ({ excerpt: 'the WordPress Excerpt setting', slug: 'the WordPress Slug/permalink setting when available', description: 'your SEO description field only if your SEO tool offers it' })[key] + '. Nothing was published.', fallback: 'Field copy unavailable. Select the field under Page details and copy it manually.' });
  });
  $('download-wordpress-kit').addEventListener('click', () => {
    if (isBusy() || $('publishing-destination').value !== 'wordpress') return;
    try { approved(); const kit = createWordPressKit(getDraft(), getWordPressOptions()); downloadText(kit.bytes, kit.filename, 'application/zip'); reportAction('WordPress kit download requested with six article files, current handoff findings, image handoff notes, and destination instructions. Inspect the files before sharing. Private source and review notes are excluded. Nothing was published.'); }
    catch (error) { reportAction(error.message); }
  });
  return { update, reset };
}
