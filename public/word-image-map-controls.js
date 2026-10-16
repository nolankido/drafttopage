import { parseWordImageMap, WORD_IMAGE_MAP_LIMIT } from './word-image-map.js';

export function installWordImageMap({ getTarget, getBody, useAlt, isBusy, workChanged, read = file => file.arrayBuffer() }) {
  const $ = id => document.getElementById(id);
  let model = null, reading = false, generation = 0, targetKey = '';
  const selected = () => model?.placements.find(item => item.placeholder === $('image-map-entry').value);
  const status = message => { $('image-map-status').textContent = message; };
  function refresh() {
    const target = getTarget(), key = JSON.stringify([target?.body, target?.start, target?.end, getBody()]);
    if (key !== targetKey) { targetKey = key; $('image-map-confirm').checked = false; }
    const item = selected(), label = target?.before.replace(/\\([\[\]])/g, '$1');
    const matches = Boolean(item && target?.body === getBody() && label === item.placeholder);
    const busy = reading || isBusy();
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
      model = parseWordImageMap(new Uint8Array(bytes));
      $('image-map-entry').replaceChildren(...model.placements.map(item => {
        const option = document.createElement('option'); option.value = item.placeholder;
        option.textContent = item.placeholder + ': ' + (item.filename || 'NOT RECOVERED'); return option;
      }));
      $('image-map-entry').value = model.placements[0].placeholder;
      $('image-map-scope').textContent = 'Map scope: ' + model.scope;
      $('image-map-review').hidden = false; inspect();
      status('Placement map ready to inspect. No image, alternative text, URL, or article change has been applied.');
    } catch (error) { if (token === generation) { model = null; status(error.message || 'The selected image map could not be read. Current writing and image details are kept.'); } }
    finally { if (token === generation) { reading = false; $('image-map-file').value = ''; refresh(); workChanged(); } }
  });
  $('image-map-entry').addEventListener('change', inspect);
  $('image-map-confirm').addEventListener('change', refresh);
  $('image-map-clear').addEventListener('click', () => { if (!isBusy()) clear(); });
  $('image-map-use-alt').addEventListener('click', () => {
    refresh(); if ($('image-map-use-alt').disabled) return;
    const item = selected();
    if (useAlt(item.alt)) { $('image-map-confirm').checked = false; status('Word alternative text placed in image preparation only. Review it, enter the uploaded HTTPS URL, then preview the exact article change.'); }
    refresh();
  });
  refresh();
  return { refresh, clear, hasWork: () => reading || Boolean(model) };
}
