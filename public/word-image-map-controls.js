import { parseWordImageMap, WORD_IMAGE_MAP_LIMIT } from './word-image-map.js';
import { nextWordImageMatch } from './word-image-match.js';

export function installWordImageMap({ getTarget, getBody, useAlt, isBusy, workChanged, pinMatch = null, read = file => file.arrayBuffer() }) {
  const $ = id => document.getElementById(id);
  let model = null, reading = false, generation = 0, targetKey = '';
  let queuedBody = null, queuedModel = null, queuedMatch = null;
  function next() {
    const body = getBody();
    if (body !== queuedBody || model !== queuedModel) {
      queuedBody = body; queuedModel = model;
      queuedMatch = model ? nextWordImageMatch(body, model.placements) : null;
    }
    return queuedMatch;
  }
  const selected = () => model?.placements.find(item => item.placeholder === $('image-map-entry').value);
  const status = message => { $('image-map-status').textContent = message; };
  function refresh() {
    const target = getTarget(), key = JSON.stringify([target?.body, target?.start, target?.end, getBody()]);
    if (key !== targetKey) { targetKey = key; $('image-map-confirm').checked = false; }
    const item = selected(), label = target?.before.replace(/\\([\[\]])/g, '$1');
    const matches = Boolean(item && target?.body === getBody() && label === item.placeholder);
    const busy = reading || isBusy(), upcoming = next();
    $('image-map-next').disabled = busy || typeof pinMatch !== 'function' || !upcoming;
    $('image-map-next-help').textContent = !model ? 'Open the placement map to use this shortcut.' :
      !upcoming ? 'No single editable matching placeholder remains. Missing files, repeated labels, and protected article sections require the manual picker or work in WordPress.' :
      'Next in article order: ' + upcoming.placeholder + ' on line ' + upcoming.line + ' (' + upcoming.filename + '). Selection alone does not verify the original document.';
    $('image-map-file').disabled = busy;
    $('image-map-entry').disabled = busy;
    $('image-map-confirm').disabled = busy || !matches;
    $('image-map-use-alt').disabled = busy || !matches || !$('image-map-confirm').checked || !item?.filename || !item?.alt;
    $('image-map-clear').disabled = isBusy() || (!model && !reading);
    $('image-map-match').textContent = !item ? '' : !target ? 'Choose the current Word placeholder above, then compare this entry.' : !matches ? 'This entry does not match the current placeholder number, or the article changed. Choose the matching entry and a current location.' : 'The numbers match. This does not verify the document or occurrence. Compare the context and original Word document, especially after combining imports.';
  }
  function inspect() {
    const item = selected(); $('image-map-confirm').checked = false;
    $('image-map-alt').value = item?.alt || '';
    $('image-map-file-note').textContent = item ? (item.filename || 'NOT RECOVERED') + ': ' + item.note + (item.altTruncated ? ' Word alternative text was shortened to 500 characters. Review it against the original.' : '') + (!item.alt ? ' No alternative text was supplied. Describe the image yourself or explicitly mark it decorative.' : '') : '';
    refresh();
  }
  function presentMap(parsed, message) {
    model = parsed;
    $('image-map-entry').replaceChildren(...model.placements.map(item => {
      const option = document.createElement('option'); option.value = item.placeholder;
      option.textContent = item.placeholder + ': ' + (item.filename || 'NOT RECOVERED'); return option;
    }));
    $('image-map-entry').value = model.placements[0].placeholder;
    $('image-map-scope').textContent = 'Map scope: ' + model.scope;
    $('image-map-review').hidden = false; inspect();
    status(message);
  }
  function loadPreparedMap(source, expectedBody) {
    // Bind to the exact resulting article; reject stale or malformed handoffs
    // without changing the previous map, writing, image URL or alt text.
    if (reading || isBusy() || typeof expectedBody !== 'string' || getBody() !== expectedBody) return false;
    let parsed;
    try { parsed = parseWordImageMap(source); } catch { return false; }
    clear();
    presentMap(parsed, 'Placement map carried from your confirmed Word ZIP for this tab only. Compare each placement with the saved Word file and original document before reusing alt text. No image has been loaded or approved.');
    $('image-map-panel').open = true;
    refresh(); workChanged(); return true;
  }
  function clear() {
    ++generation; model = null; reading = false; targetKey = '';
    $('image-map-file').value = ''; $('image-map-entry').replaceChildren();
    $('image-map-review').hidden = true; $('image-map-scope').textContent = '';
    inspect(); status('Placement map cleared. The article and pending image details are kept.'); workChanged();
  }
  $('image-map-file').addEventListener('change', async () => {
    const file = $('image-map-file').files?.[0];
    if (!file || reading || isBusy()) { $('image-map-file').value = ''; return; }
    clear(); const token = ++generation; reading = true; refresh(); workChanged();
    status('Reading only the selected placement map locally. The article and image details are kept.');
    try {
      if (!Number.isInteger(file.size) || file.size > WORD_IMAGE_MAP_LIMIT) throw new Error('Choose an image map no larger than 512 KiB.');
      const bytes = await read(file);
      if (token !== generation) return;
      presentMap(parseWordImageMap(new Uint8Array(bytes)),
        'Placement map ready to inspect. No image, alternative text, URL, or article change has been applied.');
    } catch (error) { if (token === generation) { model = null; status(error.message || 'The selected image map could not be read. Current writing and image details are kept.'); } }
    finally { if (token === generation) { reading = false; $('image-map-file').value = ''; refresh(); workChanged(); } }
  });
  $('image-map-entry').addEventListener('change', inspect);
  $('image-map-next').addEventListener('click', () => {
    refresh();
    if ($('image-map-next').disabled) return;
    // Recompute under the click to avoid acting on a stale article or a changed map.
    const body = getBody(), match = nextWordImageMatch(body, model?.placements);
    if (!match) { refresh(); return; }
    try {
      if (!pinMatch({ ...match, body })) {
        status('The article selection was not changed. Pending image details are kept.');
        return;
      }
      $('image-map-entry').value = match.placeholder;
      inspect(); // Always clear the old comparison acknowledgement after changing target.
      status('Pinned ' + match.placeholder + ' on line ' + match.line + '. Compare the original Word document and this file before approving its alternative text. No image URL, alt text, or article change was applied.');
    } catch (error) {
      status(error.message || 'The next placeholder could not be selected. The article is unchanged.');
    }
    refresh();
  });
  $('image-map-confirm').addEventListener('change', refresh);
  $('image-map-clear').addEventListener('click', () => { if (!isBusy()) clear(); });
  $('image-map-use-alt').addEventListener('click', () => {
    refresh(); if ($('image-map-use-alt').disabled) return;
    const item = selected();
    if (useAlt(item.alt)) { $('image-map-confirm').checked = false; status('Word alternative text placed in image preparation only. Review it, enter the uploaded HTTPS URL, then preview the exact article change.'); }
    refresh();
  });
  refresh();
  return { refresh, clear, loadPreparedMap, hasWork: () => reading || Boolean(model) };
}
