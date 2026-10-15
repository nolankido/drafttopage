export function installArticleFlow({ getDraft, report, isBusy = () => false }) {
  const $ = id => document.getElementById(id);
  const editor = $('article-edit-panel');
  if (!editor) return { update() {}, reading: () => false, handoff: () => false, reset() {} };
  document.querySelector('main').classList.add('guided-converter');
  let step = '';
  function update() {
    const ready = Boolean(getDraft().body.trim());
    $('conversion-results').hidden = !ready;
    editor.hidden = !ready && !editor.open;
    const wordpress = $('publishing-destination').value === 'wordpress';
    const next = !ready ? '1. Bring your article' : $('reviewed').checked ? wordpress ? '3. Ready to copy into WordPress' : '3. Ready to export your article' : '2. Review your converted article';
    if (next !== step) {
      step = next;
      if ($('article-progress')) $('article-progress').textContent = next;
    }
    for (const [id, current] of [[document.querySelector('#start-word-file') ? 'start-word-file' : 'start-copied-paste', !ready], ['start-review', ready && !$('reviewed').checked], ['start-handoff', ready && $('reviewed').checked]]) {
      const button = $(id);
      if (current) button.setAttribute('aria-current', 'step'); else button.removeAttribute('aria-current');
    }
  }
  function reading() {
    update();
    if (!getDraft().body.trim()) { report('Bring an article first, then review its converted reading preview.'); return true; }
    $('import-panel').open = false;
    $('preview-panel').open = true;
    $('conversion-heading').focus();
    return true;
  }
  function handoff() {
    if (isBusy()) { report('Finish the current file operation before changing the handoff. Your writing is kept.'); return true; }
    update();
    if (!getDraft().body.trim()) { report('Bring an article first. Nothing is ready to copy yet.'); return true; }
    const destination = $('publishing-destination');
    if (destination.value !== 'wordpress') { destination.value = 'wordpress'; destination.dispatchEvent(new Event('change', { bubbles: true })); }
    $('other-export-formats').open = false;
    update();
    $('reviewed').focus();
    report('Review the article, check the approval box, then copy the WordPress blocks. The title is copied separately.');
    return true;
  }
  editor.addEventListener('toggle', update);
  return { update, reading, handoff, reset() { editor.open = false; update(); } };
}
