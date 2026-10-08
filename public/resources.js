import { EXAMPLES } from './content-data.js';
import { createMarkdown } from './markdown.js';
const message = document.querySelector('#resource-status');
const report = text => { if (message) message.textContent = text; };
for (const button of document.querySelectorAll('[data-copy]')) {
  button.addEventListener('click', async () => {
    const field = document.getElementById(button.dataset.copy);
    if (!field) return;
    try { await navigator.clipboard.writeText(field.value ?? field.textContent); report('Copied. Paste this into your own notes document or the private pilot. Nothing was sent to AI.'); }
    catch { field.focus(); if (field.select) field.select(); report('Clipboard unavailable. Select the visible text and copy it manually.'); }
  });
}
const demo = document.querySelector('#demo');
if (demo) {
  const $ = id => document.getElementById(id);
  const fields = ['title', 'excerpt', 'description', 'slug', 'body'];
  let dirty = false;
  const controls = () => {
    const reviewed = $('demo-reviewed').checked;
    $('demo-download').disabled = !reviewed; $('demo-copy').disabled = !reviewed;
  };
  function load() {
    const example = EXAMPLES.find(item => item.id === $('demo-example').value) || EXAMPLES[0];
    for (const id of fields) $(`demo-${id}`).value = example.draft[id];
    $('demo-notes').textContent = example.notes;
    $('demo-questions').replaceChildren(...example.draft.questions.map(text => {
      const li = document.createElement('li'); li.textContent = text; return li;
    }));
    $('demo-reviewed').checked = false; dirty = false; controls();
    report('Illustrative sample loaded. This is prewritten material, not a live AI response. Edit, review, and export to try the workflow.');
  }
  for (const id of fields) $(`demo-${id}`).addEventListener('input', () => { dirty = true; $('demo-reviewed').checked = false; controls(); });
  $('demo-reviewed').addEventListener('change', controls);
  $('demo-load').addEventListener('click', () => { if (!dirty || confirm('Replace your edits with the selected prewritten sample? Export anything you want to keep first.')) load(); });
  function exported() {
    if (!$('demo-reviewed').checked) throw new Error('Review the sample and check the approval box before exporting.');
    return createMarkdown(Object.fromEntries(fields.map(id => [id, $(`demo-${id}`).value])));
  }
  $('demo-download').addEventListener('click', () => {
    try {
      const content = exported(); const url = URL.createObjectURL(new Blob([content], { type: 'text/markdown;charset=utf-8' }));
      const a = document.createElement('a'); a.href = url; a.download = `${$('demo-slug').value}.md`; document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      report('Sample Markdown exported with draft: true. Nothing was published. Source notes and review questions are not in the file. Read the export guide before using it on a website.');
    } catch (error) { report(error.message); }
  });
  $('demo-copy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(exported()); report('Sample Markdown copied. Nothing was published.'); }
    catch (error) { report(error.message || 'Clipboard unavailable. Use Download Markdown instead.'); }
  });
  window.addEventListener('beforeunload', event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } });
  // Do not restore edited text through the back/forward cache.
  window.addEventListener('pageshow', event => { if (event.persisted) load(); });
  load();
}
