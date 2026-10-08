import { installRecovery } from './recovery.js';
import { validateDraft } from './workspace.js';
import { createMarkdown } from './markdown.js';
import { TEMPLATES, EXAMPLES } from './content-data.js';
const $ = selector => document.querySelector(selector);
let ready = false, busy = false, checking = false, dirty = false, profiles = {};
const fields = ['title', 'excerpt', 'description', 'slug', 'body'];
const exportButtons = ['download', 'copy', 'copy-body'];
const status = message => { $('#status').textContent = message; };
const updateExports = () => { for (const id of exportButtons) $(`#${id}`).disabled = !$('#reviewed').checked || busy; };
const edited = () => { dirty = true; $('#reviewed').checked = false; updateExports(); };
function updateProfile() {
  $('#profile-help').textContent = profiles[$('#profile').value]?.guidance || 'Built-in article guidance. This does not save a website profile or learn your voice.';
}
const api = async (path, value) => {
  let response;
  try {
    response = await fetch(`/api/pilot/${path}`, { method: value === undefined ? 'GET' : 'POST', credentials: 'same-origin', cache: 'no-store',
      headers: { 'content-type': 'application/json', 'x-drafttopage': 'pilot-v1' }, signal: AbortSignal.timeout(path === 'generate' ? 75000 : 15000),
      ...(value === undefined ? {} : { body: JSON.stringify(value) }) });
  } catch { throw new Error('Connection could not finish. No automatic retry was made. Keep this tab open; your notes and previous draft are unchanged.'); }
  if (response.status === 401) { ready = false; $('#reauth').hidden = false; $('#generate').disabled = true; }
  let data;
  try { data = await response.json(); }
  catch { throw new Error('The service returned an unreadable response. Keep this tab open and recheck the connection before deliberately retrying.'); }
  if (!response.ok) {
    const seconds = Number(response.headers.get('retry-after'));
    const wait = response.status === 429 && Number.isFinite(seconds) && seconds > 0 ? ` Retry no earlier than ${new Date(Date.now() + seconds * 1000).toLocaleString()}.` : '';
    throw new Error((data.error || 'The request failed. Your notes and prior draft are unchanged.') + wait);
  }
  return data;
};
async function connect() {
  if (busy || checking) return;
  checking = true; ready = false; $('#generate').disabled = true; $('#reconnect').disabled = true;
  status('Checking sign-in and configuration. No AI request is being made.');
  try {
    const session = await api('session');
    if (!session.authenticated || !session.profiles) throw new Error('The connection check was incomplete. Keep this tab open and try Recheck connection.');
    ready = session.generationReady === true; profiles = session.profiles; updateProfile(); $('#reauth').hidden = true;
    status(ready ? 'Ready. Notes are sent only when you select Prepare draft. Configuration is present; a successful draft is still needed to verify provider access.' : 'AI generation is not activated. The owner must configure the AI credential in Cloudflare. Your notes remain in this tab.');
  } catch (error) { status(error.message); }
  finally { checking = false; $('#reconnect').disabled = false; $('#generate').disabled = !ready; }
}
$('#reconnect').addEventListener('click', connect);
$('#profile').addEventListener('change', () => { updateProfile(); dirty = true; });
$('#notes').addEventListener('input', () => { $('#note-count').textContent = `${$('#notes').value.length.toLocaleString()} / 8,000`; dirty = true; });
for (const id of ['audience', 'purpose']) $(`#${id}`).addEventListener('input', () => { dirty = true; });
for (const id of fields) $(`#${id}`).addEventListener('input', edited);
$('#reviewed').addEventListener('change', updateExports);
function replaceNotes(text, profile, message) {
  if ($('#notes').value && !confirm('Replace the source notes? Copy any notes you want to keep first. The current article will not be changed.')) return;
  $('#notes').value = text; $('#profile').value = profile; updateProfile(); $('#notes').dispatchEvent(new Event('input'));
  $('#consent').checked = false; status(message);
}
$('#load-template').addEventListener('click', () => {
  const template = TEMPLATES.find(t => t.id === $('#note-template').value);
  if (template) replaceNotes(template.outline, template.profile, 'Outline loaded locally. Replace the prompts with your own facts. No AI request was made. The existing article is unchanged.');
});
$('#sample').addEventListener('click', () => {
  const sample = EXAMPLES.find(e => e.profile === $('#profile').value) || EXAMPLES[0];
  replaceNotes(sample.notes, sample.profile, 'Fictional sample loaded locally. No AI request has been made. The existing article is unchanged.');
});
async function copyText(text, success) {
  try { await navigator.clipboard.writeText(text); status(success); }
  catch { status('Clipboard unavailable. Select and copy the visible text manually, or use Download Markdown for the article.'); }
}
$('#copy-notes').addEventListener('click', () => copyText($('#notes').value, 'Source notes copied to your device clipboard. Keep them in your own private document.'));
$('#copy-questions').addEventListener('click', () => copyText([...$('#questions').children].map(li => `- ${li.textContent}`).join('\n'), 'Review questions copied. Save unresolved questions separately from the article.'));
$('#draft-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (!ready || busy || checking || recovery.reading() || !$('#draft-form').reportValidity()) return;
  if (TEMPLATES.some(t => t.outline.trim() === $('#notes').value.trim())) { status('Fill in the outline with your own facts before preparing a draft. No AI request was made.'); return; }
  if (!$('#editor').hidden && !confirm('Prepare another draft? A successful response will replace the article currently in the editor. Export any work you want to keep first.')) return;
  let prepared = false;
  busy = true; recovery.update(); $('.workspace').setAttribute('aria-busy', 'true'); $('#source-fields').disabled = true; $('#logout').disabled = true; $('#clear').disabled = true; $('#reconnect').disabled = true;
  for (const id of [...fields, 'reviewed']) $(`#${id}`).disabled = true;
  updateExports(); status('Preparing your draft. Keep this tab open. No automatic retry will be made.');
  try {
    const data = await api('generate', { notes: $('#notes').value, profile: $('#profile').value,
      audience: $('#audience').value, purpose: $('#purpose').value, consent: $('#consent').checked });
    // Validate the complete response before replacing any previous work.
    validateDraft(data.draft);
    createMarkdown(data.draft);
    if (!Array.isArray(data.draft.questions) || data.draft.questions.some(q => typeof q !== 'string')) throw new Error('The response was incomplete. Your previous article is unchanged.');
    for (const id of fields) $(`#${id}`).value = data.draft[id];
    $('#questions').replaceChildren();
    const questions = data.draft.questions.length ? data.draft.questions : ['No specific questions were returned. Independently review every factual claim and the writing.'];
    for (const question of questions) { const li = document.createElement('li'); li.textContent = question; $('#questions').append(li); }
    $('#editor').hidden = false; $('#empty-state').hidden = true; edited();
    status(`Draft prepared. ${data.remainingToday} shared attempt(s) remain today. Review and edit before exporting.`); prepared = true;
  } catch (error) { status(error.message || 'Connection failed. Your notes and previous draft are unchanged.'); }
  finally {
    busy = false; $('#source-fields').disabled = false; $('#logout').disabled = false; $('#clear').disabled = false; $('#reconnect').disabled = false; $('#generate').disabled = !ready;
    for (const id of [...fields, 'reviewed']) $(`#${id}`).disabled = false;
    recovery.update(); $('.workspace').setAttribute('aria-busy', 'false');
    updateExports();
    if (prepared) $('#title').focus();
  }
});
function getExport() {
  if (!$('#reviewed').checked) throw new Error('Review the draft and check the approval box first.');
  return createMarkdown(Object.fromEntries(fields.map(id => [id, $(`#${id}`).value])));
}
$('#download').addEventListener('click', () => {
  try {
    const content = getExport(); const url = URL.createObjectURL(new Blob([content], { type: 'text/markdown;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = `${$('#slug').value}.md`;
    document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 5000);
    status('Markdown exported with draft: true. Nothing was published. Check the actual file, then follow the export guide below. Notes and review questions are not included.');
  } catch (error) { status(error.message); }
});
$('#copy').addEventListener('click', () => { try { copyText(getExport(), 'Markdown copied. Nothing was published. Follow the export guide before importing it.'); } catch (error) { status(error.message); } });
$('#copy-body').addEventListener('click', () => { try { getExport(); copyText($('#body').value.trim(), 'Article body copied as Markdown, without the title or metadata. Add those separately in your publishing editor. Nothing was published.'); } catch (error) { status(error.message); } });
function clearWorkspace() {
  $('#draft-form').reset(); fields.forEach(id => { $(`#${id}`).value = ''; }); $('#questions').replaceChildren();
  $('#editor').hidden = true; $('#empty-state').hidden = false; $('#reviewed').checked = false;
  $('#note-count').textContent = '0 / 8,000'; dirty = false; updateProfile(); updateExports();
  $('#backup-private-ok').checked = false; recovery.update();
}
$('#clear').addEventListener('click', () => { if (recovery.reading()) return; if (dirty && !confirm('Discard these notes and the editable draft? There is no saved history.')) return; clearWorkspace(); status('Workspace cleared.'); });
$('#logout').addEventListener('click', async () => { if (recovery.reading()) return; if (dirty && !confirm('Sign out and discard unsaved notes and edits?')) return; try { await api('logout', {}); clearWorkspace(); location.replace('/pilot'); } catch (error) { status(error.message); } });
window.addEventListener('beforeunload', event => { if (dirty || busy) { event.preventDefault(); event.returnValue = ''; } });
window.addEventListener('pageshow', event => { if (event.persisted) { clearWorkspace(); location.reload(); } });
const recovery = installRecovery({
  isBusy: () => busy,
  hasWork: () => dirty,
  report: status,
  capture: () => ({
    source: Object.fromEntries(['profile', 'notes', 'audience', 'purpose'].map(id => [id, $(`#${id}`).value])),
    draft: $('#editor').hidden ? null : {
      ...Object.fromEntries(fields.map(id => [id, $(`#${id}`).value])),
      questions: [...$('#questions').children].map(li => li.textContent)
    }
  }),
  restore: value => {
    for (const id of ['profile', 'notes', 'audience', 'purpose']) $(`#${id}`).value = value.source[id];
    for (const id of fields) $(`#${id}`).value = value.draft?.[id] ?? '';
    $('#questions').replaceChildren(...(value.draft?.questions || []).map(text => {
      const li = document.createElement('li'); li.textContent = text; return li;
    }));
    $('#editor').hidden = value.draft === null; $('#empty-state').hidden = value.draft !== null;
    $('#consent').checked = false; $('#reviewed').checked = false;
    $('#note-count').textContent = `${$('#notes').value.length.toLocaleString()} / 8,000`;
    dirty = true; updateProfile(); updateExports(); $('#notes').focus();
  }
});
connect();
