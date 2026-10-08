import { createMarkdown } from './markdown.js';
import { pilotRequest } from './request.js';
import { DRAFT_FIELDS, MAX_BACKUP_BYTES, createWorkspaceBackup, parseWorkspaceBackup, validateDraft } from './workspace.js';
const $ = selector => document.querySelector(selector);
const fields = DRAFT_FIELDS;
let ready = false, busy = false, connecting = false, dirty = false, profiles = {}, questions = [];
const status = message => { $('#status').textContent = message; };
const updateExports = () => {
  const enabled = !$('#editor').hidden && $('#reviewed').checked && !busy;
  $('#download').disabled = !enabled; $('#copy').disabled = !enabled;
};
const edited = () => { dirty = true; $('#reviewed').checked = false; updateExports(); };
const profileHelp = () => { $('#profile-help').textContent = profiles[$('#profile').value]?.guidance || 'Reusable writing guidance, configured for this pilot.'; };
function updateControls() {
  $('#generate').disabled = !ready || busy || connecting;
  $('#source-fields').disabled = busy;
  $('#draft-form').setAttribute('aria-busy', String(busy));
  $('#editor').setAttribute('aria-busy', String(busy));
  for (const id of [...fields, 'reviewed', 'logout', 'clear', 'save-backup', 'restore-backup']) $(`#${id}`).disabled = busy;
  $('#refresh').disabled = busy || connecting;
  updateExports();
}
const source = () => Object.fromEntries(['profile', 'notes', 'audience', 'purpose'].map(id => [id, $(`#${id}`).value]));
const draft = () => $('#editor').hidden ? null : { ...Object.fromEntries(fields.map(id => [id, $(`#${id}`).value])), questions: [...questions] };
const api = async (path, value) => {
  try { return await pilotRequest(path, value, { timeoutMs: path === 'generate' ? 75000 : 15000 }); }
  catch (error) {
    if (error.status === 401) { $('#reauth').hidden = false; ready = false; updateControls(); }
    throw error;
  }
};
async function connect() {
  if (busy || connecting) return;
  connecting = true; ready = false; updateControls();
  status('Checking the connection without reloading your writing…');
  try {
    const session = await api('session');
    if (session.authenticated !== true || !session.profiles ||
        !['personal', 'update', 'guide'].every(key => typeof session.profiles[key]?.guidance === 'string')) {
      throw new Error('The pilot returned an unexpected connection response. Your writing is unchanged.');
    }
    ready = session.generationReady === true; profiles = session.profiles;
    $('#reauth').hidden = true; profileHelp();
    status(ready ? 'Ready. Notes are sent only when you select Prepare draft.' : 'AI generation is not activated. After the owner adds the API credential, select Refresh connection. Your writing will stay here.');
  } catch (error) { status(error.message); }
  finally { connecting = false; updateControls(); }
}
$('#refresh').addEventListener('click', connect);
function sourceChanged() {
  dirty = true; $('#consent').checked = false;
  $('#note-count').textContent = `${$('#notes').value.length.toLocaleString()} / 8,000`;
}
$('#profile').addEventListener('change', () => { profileHelp(); sourceChanged(); });
for (const id of ['notes', 'audience', 'purpose']) $(`#${id}`).addEventListener('input', sourceChanged);
for (const id of fields) $(`#${id}`).addEventListener('input', edited);
$('#reviewed').addEventListener('change', updateExports);
$('#sample').addEventListener('click', () => {
  if ($('#notes').value && !confirm('Replace the source notes with a fictional example?')) return;
  $('#notes').value = 'Fictional example: I rearranged my studio desk this week. I moved notebooks to the shelf beside it to keep the work surface clear. I am still testing whether the new arrangement feels better. Do not claim it improved my productivity.';
  sourceChanged(); status('Fictional sample loaded locally. No AI request has been made.');
});
function displayDraft(value) {
  for (const id of fields) $(`#${id}`).value = value?.[id] || '';
  questions = value ? [...value.questions] : [];
  $('#questions').replaceChildren();
  const visible = questions.length ? questions : ['No specific questions were returned. Independently review every factual claim and the writing.'];
  if (value) for (const question of visible) {
    const li = document.createElement('li'); li.textContent = question; $('#questions').append(li);
  }
  $('#editor').hidden = value === null; $('#empty-state').hidden = value !== null;
  $('#reviewed').checked = false; updateExports();
}
$('#draft-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (!ready || busy || connecting || !$('#draft-form').reportValidity()) return;
  if (!$('#editor').hidden && !confirm('A successful response will replace this article. Save a workspace backup or export any work you want to keep first. Continue?')) return;
  busy = true; updateControls(); let completed = false;
  status('Preparing your draft. This can take up to a minute. Keep this tab open.');
  try {
    const data = await api('generate', { ...source(), consent: $('#consent').checked });
    // Validate the entire response before replacing any existing field.
    const next = validateDraft(data.draft);
    createMarkdown(next);
    if (!Number.isInteger(data.remainingToday) || data.remainingToday < 0 || data.remainingToday > 20) throw new Error('Unexpected usage response. Your previous writing is unchanged.');
    displayDraft(next); edited(); completed = true;
    status(`Draft prepared. ${data.remainingToday} shared attempt(s) remain today. Review and edit before exporting.`);
  } catch (error) { status(error.message || 'Connection failed. Your notes and previous draft are unchanged.'); }
  finally {
    busy = false; updateControls();
    if (completed) $('#title').focus();
  }
});
function saveFile(content, type, filename) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a'); link.href = url; link.download = filename;
  document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 5000);
}
function getExport() {
  if (busy || $('#editor').hidden || !$('#reviewed').checked) throw new Error('Review the draft and check the approval box first.');
  return createMarkdown(draft());
}
$('#download').addEventListener('click', () => {
  try {
    saveFile(getExport(), 'text/markdown;charset=utf-8', `${$('#slug').value}.md`);
    status('Markdown download requested with draft: true. Nothing was published. Your source notes are not in the file. Check your browser downloads.');
  } catch (error) { status(error.message); }
});
$('#copy').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(getExport()); status('Markdown copied. Nothing was published.'); }
  catch { status('Copy failed. Confirm review approval, check the fields, or use Download Markdown.'); }
});
$('#save-backup').addEventListener('click', () => {
  if (busy) return;
  try {
    const content = createWorkspaceBackup(source(), draft());
    saveFile(content, 'application/json;charset=utf-8', `drafttopage-workspace-${new Date().toISOString().replaceAll(':', '-')}.json`);
    status('Workspace backup download requested. It includes source notes and review questions, without encryption. Keep the file private and check your browser downloads.');
  } catch (error) { status(error.message); }
});
$('#restore-backup').addEventListener('change', async () => {
  const file = $('#restore-backup').files?.[0];
  if (!file || busy) return;
  busy = true; updateControls(); let completed = false;
  try {
    if (file.size > MAX_BACKUP_BYTES) throw new Error('Choose a workspace backup smaller than 128 KiB.');
    const saved = parseWorkspaceBackup(await file.text());
    if (dirty && !confirm('Replace the current notes and article with this backup? Save the current workspace first to keep both.')) return;
    for (const [id, value] of Object.entries(saved.source)) $(`#${id}`).value = value;
    displayDraft(saved.draft); sourceChanged(); profileHelp(); completed = true;
    status('Workspace restored locally. No AI request was made. Confirm data use again before generating, and review again before exporting.');
  } catch (error) { status(`${error.message} Your current writing is unchanged.`); }
  finally {
    $('#restore-backup').value = ''; busy = false; updateControls();
    if (completed) $('#notes').focus();
  }
});
function clearWorkspace() {
  $('#draft-form').reset(); displayDraft(null); $('#restore-backup').value = '';
  $('#note-count').textContent = '0 / 8,000'; dirty = false; profileHelp(); updateControls();
}
$('#clear').addEventListener('click', () => {
  if (busy || (dirty && !confirm('Discard these notes and the editable draft? Only backups you downloaded can restore them.'))) return;
  clearWorkspace(); status('Workspace cleared.'); $('#notes').focus();
});
$('#logout').addEventListener('click', async () => {
  if (busy || (dirty && !confirm('Sign out and discard unsaved writing? Save a workspace backup first to keep it.'))) return;
  busy = true; updateControls();
  try { await api('logout', {}); clearWorkspace(); location.replace('/pilot'); }
  catch (error) { status(error.message); }
  finally { busy = false; updateControls(); }
});
window.addEventListener('beforeunload', event => { if (dirty || busy) { event.preventDefault(); event.returnValue = ''; } });
window.addEventListener('pageshow', event => { if (event.persisted) { clearWorkspace(); location.reload(); } });
connect();
