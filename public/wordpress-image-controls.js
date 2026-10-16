import { analyzeWordPressImages, wordPressImagePlan, IMAGE_REVIEW_LIMIT } from './wordpress-images.js';
import { revealArticleSelection } from './editing.js';
import { downloadText } from './download.js';

export function installWordPressImages({ getDraft, changed, report, editImage = () => false, isBusy = () => false, reveal = revealArticleSelection, download = downloadText }) {
  const $ = id => document.getElementById(id);
  let selected = false, bodySnapshot = null, rendered = null, images = [], error = '';
  function clearInactive() {
    selected = false; bodySnapshot = null; rendered = null; images = []; error = '';
    $('wordpress-linked-images').checked = false;
    $('wordpress-linked-images').disabled = true; $('download-image-plan').disabled = true;
    $('wordpress-image-list').replaceChildren();
    $('wordpress-image-status').textContent = ''; $('wordpress-image-limit').textContent = '';
  }
  function sync() {
    // Option queries also run for other exports. Never inspect or retain their
    // article here; returning to WordPress needs a fresh, unchecked inspection.
    if ($('publishing-destination').value !== 'wordpress') { clearInactive(); return false; }
    const body = getDraft().body;
    if (body !== bodySnapshot) {
      selected = false; bodySnapshot = body;
      try { images = analyzeWordPressImages(body); error = ''; }
      catch (failure) { images = []; error = failure.message; }
    }
    if (!images.some(image => image.eligible)) selected = false;
    $('wordpress-linked-images').checked = selected;
    return selected;
  }
  function refresh() {
    if ($('publishing-destination').value !== 'wordpress') { clearInactive(); return; }
    sync();
    const busy = isBusy(), eligible = images.filter(image => image.eligible).length;
    $('wordpress-linked-images').disabled = busy || !eligible;
    $('download-image-plan').disabled = busy || !images.length;
    $('wordpress-image-status').textContent = error || (!images.length ? 'No supported inline Markdown image references found. Images in code and reference-style image syntax are outside this inspection.' : images.length + ' image reference(s); ' + eligible + ' can become linked Image blocks. ' + (selected ? eligible + ' selected; ' + (images.length - eligible) + ' stay text.' : 'Images currently stay text. Open Images for WordPress to choose linked blocks.'));
    const key = JSON.stringify([bodySnapshot, selected]);
    if (!$('wordpress-image-panel').open) { $('wordpress-image-list').replaceChildren(); rendered = null; }
    else if (key !== rendered) {
      rendered = key;
      $('wordpress-image-list').replaceChildren(...images.slice(0, IMAGE_REVIEW_LIMIT).map(image => {
        const li = document.createElement('li'), alt = document.createElement('p'), url = document.createElement('p'), state = document.createElement('p'), button = document.createElement('button');
        alt.textContent = 'Line ' + image.line + ' · Alt text: ' + (image.alt || '(empty; review whether decorative)');
        url.textContent = 'Reference: ' + image.target;
        state.textContent = selected && image.eligible ? 'Linked Image block. ' + (!image.alt.trim() ? 'Review the empty alternative text in WordPress.' : 'Inspect appearance and availability in WordPress.') : 'Stays literal text. ' + (image.reason || 'Select Include supported linked images to prepare this reference.');
        button.type = 'button'; button.className = 'secondary'; button.textContent = 'Edit image on line ' + image.line;
        const original = bodySnapshot;
        button.addEventListener('click', () => {
          if (isBusy()) return;
          if ($('publishing-destination').value !== 'wordpress' || getDraft().body !== original) { refresh(); report('The article changed. Choose an image from its current list.'); return; }
          if (editImage(image.start, image.end)) return;
          const body = $('body'); body.focus(); body.setSelectionRange(image.start, image.end);
          try { reveal(body); } catch { /* Exact selection remains available. */ }
          report('Selected the image reference on line ' + image.line + '. Edit its alt text, URL, or paragraph placement. No image was loaded.');
        });
        li.append(alt, url, state, button); return li;
      }));
    }
    $('wordpress-image-limit').textContent = images.length > IMAGE_REVIEW_LIMIT ? 'Showing the first ' + IMAGE_REVIEW_LIMIT + ' references. The full image handoff notes include all recognized references; all eligible references are prepared when selected.' : '';
    for (const button of $('wordpress-image-list').querySelectorAll('button')) button.disabled = busy;
  }
  $('wordpress-linked-images').addEventListener('change', () => {
    const requested = $('wordpress-linked-images').checked;
    if (isBusy() || $('publishing-destination').value !== 'wordpress') { refresh(); return; }
    sync(); selected = Boolean(requested && images.some(image => image.eligible) && $('publishing-destination').value === 'wordpress');
    $('wordpress-linked-images').checked = selected;
    changed(); refresh();
    report(selected ? 'Supported standalone HTTPS images will become linked Image blocks in WordPress copies and kits. No image was loaded here. Review again before exporting; WordPress or a browser can request the image URLs when opening those blocks.' : 'WordPress images will stay as literal Markdown text. Approval was cleared.');
  });
  $('wordpress-image-panel').addEventListener('toggle', refresh);
  $('download-image-plan').addEventListener('click', () => {
    if (isBusy() || $('publishing-destination').value !== 'wordpress') return;
    try {
      const includeLinkedImages = sync();
      if (!images.length) throw new Error('Add an image reference to the article first.');
      download(wordPressImagePlan(getDraft().body, { includeLinkedImages }), 'wordpress-image-handoff.txt', 'text/plain;charset=utf-8');
      report('Image handoff notes download requested. It includes image URLs and alt text from the current article; inspect before sharing. Private source and review notes are excluded. No image was downloaded or uploaded.');
    } catch (failure) { report(failure.message); }
  });
  refresh();
  return { refresh, enabled: sync, reset: () => { selected = false; bodySnapshot = null; rendered = null; refresh(); } };
}
