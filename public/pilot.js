import { createMarkdown } from './markdown.js';
const $ = selector => document.querySelector(selector);
let ready = false, busy = false, dirty = false, profiles = {};
const fields = ['title', 'excerpt', 'description', 'slug', 'body'];
const status = message => { $('#status').textContent = message; };
const edited = () => { dirty = true; $('#reviewed').checked = false; updateExports(); };
const updateExports = () => {
  const enabled = $('#reviewed').checked && !busy;
  $('#download').disabled = !enabled; $('#copy').disabled = !enabled;
};
const api = async (path, value) => {
  const response = await fetch(`/api/pilot/${path}`, { method: value === undefined ? 'GET' : 'POST', credentials: 'same-origin',
    headers: { 'content-type': 'application/json', 'x-drafttopage': 'pilot-v1' },
    ...(value === undefined ? {} : { body: JSON.stringify(value) }) });
  const data = await response.json();
  if (response.status === 401) $('#reauth').hidden = false;
  if (!response.ok) throw new Error(data.error || 'The request failed.');
  return data;
};
async function connect() {
  try {
    const session = await api('session');
    ready = session.generationReady; profiles = session.profiles;
    $('#profile-help').textContent = profiles[$('#profile').value].guidance;
    status(ready ? 'Ready. Your notes are sent only when you select Prepare draft.' : 'AI generation is not activated. The owner must add the API credential in Cloudflare.');
  } catch (error) { status(error.message); }
  $('#generate').disabled = !ready;
}
$('#profile').addEventListener('change', () => { $('#profile-help').textContent = profiles[$('#profile').value]?.guidance || ''; dirty = true; });
$('#notes').addEventListener('input', () => { $('#note-count').textContent = `${$('#notes').value.length.toLocaleString()} / 8,000`; dirty = true; });
for (const id of ['audience', 'purpose']) $(`#${id}`).addEventListener('input', () => { dirty = true; });
for (const id of fields) $(`#${id}`).addEventListener('input', edited);
$('#reviewed').addEventListener('change', updateExports);
$('#sample').addEventListener('click', () => {
  if ($('#notes').value && !confirm('Replace the source notes with a fictional example?')) return;
  $('#notes').value = 'Fictional example: I rearranged my studio desk this week. I moved notebooks to the shelf beside it to keep the work surface clear. I am still testing whether the new arrangement feels better. Do not claim it improved my productivity.';
  $('#notes').dispatchEvent(new Event('input'));
  $('#consent').checked = false;
  status('Fictional sample loaded locally. No AI request has been made.');
});
$('#draft-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (!ready || busy || !$('#draft-form').reportValidity()) return;
  if (!$('#editor').hidden && !confirm('Prepare another draft? A successful response will replace the article currently in the editor. Export any work you want to keep first.')) return;
  busy = true; $('#source-fields').disabled = true; $('#logout').disabled = true; $('#clear').disabled = true;
  for (const id of [...fields, 'reviewed']) $(`#${id}`).disabled = true;
  updateExports();
  status('Preparing your draft. This can take up to a minute. Keep this tab open.');
  try {
    const data = await api('generate', { notes: $('#notes').value, profile: $('#profile').value,
      audience: $('#audience').value, purpose: $('#purpose').value, consent: $('#consent').checked });
    for (const id of fields) $(`#${id}`).value = data.draft[id];
    $('#questions').replaceChildren();
    const questions = data.draft.questions.length ? data.draft.questions : ['No specific questions were returned. Independently review every factual claim and the writing.'];
    for (const question of questions) { const li = document.createElement('li'); li.textContent = question; $('#questions').append(li); }
    $('#editor').hidden = false; $('#empty-state').hidden = true; edited();
    status(`Draft prepared. ${data.remainingToday} shared attempt(s) remain today. Review and edit before exporting.`);
    $('#title').focus();
  } catch (error) { status(error.message || 'Connection failed. Your notes and previous draft are unchanged.'); }
  finally {
    busy = false; $('#source-fields').disabled = false; $('#logout').disabled = false; $('#clear').disabled = false;
    for (const id of [...fields, 'reviewed']) $(`#${id}`).disabled = false;
    updateExports();
  }
});
function getExport() {
  if (!$('#reviewed').checked) throw new Error('Review the draft and check the approval box first.');
  return createMarkdown(Object.fromEntries(fields.map(id => [id, $(`#${id}`).value])));
}
$('#download').addEventListener('click', () => {
  try {
    const content = getExport();
    const url = URL.createObjectURL(new Blob([content], { type: 'text/markdown;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = `${$('#slug').value}.md`;
    document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 5000);
    status('Markdown exported with draft: true. Nothing was published. Your original notes are not in the file.');
  } catch (error) { status(error.message); }
});
$('#copy').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(getExport()); status('Markdown copied. Nothing was published.'); }
  catch (error) { status(error.message || 'Clipboard unavailable. Use Download Markdown instead.'); }
});
function clearWorkspace() {
  $('#draft-form').reset(); fields.forEach(id => { $(`#${id}`).value = ''; }); $('#questions').replaceChildren();
  $('#editor').hidden = true; $('#empty-state').hidden = false; $('#reviewed').checked = false;
  $('#note-count').textContent = '0 / 8,000'; dirty = false; updateExports();
}
$('#clear').addEventListener('click', () => {
  if (dirty && !confirm('Discard these notes and the editable draft? There is no saved history.')) return;
  clearWorkspace(); status('Workspace cleared.');
});
$('#logout').addEventListener('click', async () => {
  if (dirty && !confirm('Sign out and discard unsaved notes and edits?')) return;
  try { await api('logout', {}); clearWorkspace(); location.replace('/pilot'); }
  catch (error) { status(error.message); }
});
window.addEventListener('beforeunload', event => { if (dirty || busy) { event.preventDefault(); event.returnValue = ''; } });
window.addEventListener('pageshow', event => { if (event.persisted) { clearWorkspace(); location.reload(); } });
connect();
