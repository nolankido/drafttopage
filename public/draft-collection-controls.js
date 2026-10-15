import { MAX_COLLECTION_BYTES, MAX_COLLECTION_ENTRIES, createDraftCollectionState, collectionWorkspace, workspaceContainsWriting, parseDraftCollection } from './draft-collection.js';
import { createWorkspaceBackup } from './workspace.js';
import { downloadText } from './download.js';

export function installDraftCollection({ capture, openWorkspace, hasUnsavedPreparation = () => false, isBusy = () => false, workChanged, report, confirmAction = message => confirm(message), download = downloadText }) {
  const $ = id => document.getElementById(id), collection = createDraftCollectionState();
  let generation = 0, reading = false, pending = null, viewRevision = -1, selectedIndex = 0;
  const status = message => { $('draft-collection-status').textContent = message; };
  function clearPreview() { pending = null; $('draft-collection-file-preview').hidden = true; $('draft-collection-file-entries').replaceChildren(); $('apply-draft-collection').disabled = true; }
  function update() {
    const entries = collection.list(), busy = reading || isBusy();
    $('draft-collection-controls').disabled = busy;
    if (viewRevision !== collection.revision()) {
      viewRevision = collection.revision(); selectedIndex = Math.max(0, Math.min(selectedIndex, entries.length - 1));
      $('draft-collection-select').replaceChildren(...entries.map(entry => { const option = document.createElement('option'); option.value = String(entry.index); option.textContent = (entry.index + 1) + '. ' + entry.name; return option; }));
      $('draft-collection-select').value = String(selectedIndex);
      $('draft-collection-name').value = entries[selectedIndex]?.name || '';
      $('draft-collection-private-ok').checked = false;
      $('draft-collection-count').textContent = entries.length + ' / ' + MAX_COLLECTION_ENTRIES + ' saved articles in this tab; ' + collection.bytes().toLocaleString() + ' / ' + MAX_COLLECTION_BYTES.toLocaleString() + ' file bytes. Editor edits need Add or Update.';
    }
    $('draft-collection-selection').hidden = !entries.length;
    $('draft-collection-select').disabled = busy || !entries.length;
    $('undo-draft-collection').disabled = busy || !collection.canUndo();
    $('download-draft-collection').disabled = busy || !entries.length || !$('draft-collection-private-ok').checked;
    $('apply-draft-collection').disabled = busy || !pending;
    let current = null, error = '';
    try { current = collectionWorkspace(capture()); } catch (failure) { error = failure.message; }
    $('add-to-draft-collection').disabled = busy || entries.length >= MAX_COLLECTION_ENTRIES || !current || !workspaceContainsWriting(current);
    const entry = entries[selectedIndex];
    let matches = false;
    if (entry && current) matches = collection.matches(selectedIndex, current);
    $('open-draft-collection-entry').disabled = busy || !entry || !current || matches;
    $('update-draft-collection-entry').disabled = busy || !entry || !current || !workspaceContainsWriting(current);
    for (const id of ['rename-draft-collection-entry', 'remove-draft-collection-entry']) $(id).disabled = busy || !entry;
    $('draft-collection-selected-status').textContent = !entry ? '' : entry.characters.toLocaleString() + ' article characters, ' + entry.notes.toLocaleString() + ' source-note characters, ' + entry.questions + ' review questions. ' + (error ? error + ' Correct current writing before opening another article.' : matches ? 'This saved article matches current writing.' : 'Current writing differs. Add or Update to save current edits before downloading the collection.');
    if (entry && $('draft-collection-inspection').open) { const saved = collection.read(selectedIndex); $('draft-collection-saved-preview').value = createWorkspaceBackup(saved.source, saved.draft); }
    else $('draft-collection-saved-preview').value = '';
  }
  function mutate(action, message) {
    if (reading || isBusy()) return;
    try { const before = collection.revision(); action(); update(); workChanged(); status(collection.revision() === before ? 'Saved entries already match this change. Editor writing is unchanged. Download the collection before leaving.' : message + ' Undo is available for this collection change. Download the private collection before leaving.'); }
    catch (error) { status(error.message); }
  }
  $('add-to-draft-collection').addEventListener('click', () => mutate(() => { selectedIndex = collection.add(capture(), $('draft-collection-name').value); }, 'Current writing saved as a new collection entry.'));
  $('update-draft-collection-entry').addEventListener('click', () => mutate(() => { collection.update(selectedIndex, capture(), $('draft-collection-name').value); }, 'Selected entry updated from current writing.'));
  $('rename-draft-collection-entry').addEventListener('click', () => mutate(() => { collection.rename(selectedIndex, $('draft-collection-name').value); }, 'Selected saved article renamed. Its article title is unchanged.'));
  $('remove-draft-collection-entry').addEventListener('click', () => mutate(() => { collection.remove(selectedIndex); }, 'Selected saved entry removed. The editor and downloaded files are unchanged.'));
  $('undo-draft-collection').addEventListener('click', () => { if (reading || isBusy()) return; if (collection.undo()) { update(); workChanged(); status('Last collection change undone. The editor is unchanged. No further collection undo is available.'); } });
  $('draft-collection-select').addEventListener('change', () => {
    const index = Number($('draft-collection-select').value);
    if (Number.isInteger(index) && collection.list()[index]) { selectedIndex = index; $('draft-collection-name').value = collection.list()[index].name; }
    update();
  });
  $('draft-collection-name').addEventListener('input', workChanged);
  $('draft-collection-private-ok').addEventListener('change', update);
  $('draft-collection-inspection').addEventListener('toggle', update);
  $('draft-collection-panel').addEventListener('toggle', update);
  $('open-draft-collection-entry').addEventListener('click', () => {
    if (reading || isBusy()) return;
    try {
      const target = collection.read(selectedIndex), current = collectionWorkspace(capture());
      if (collection.matches(selectedIndex, current)) return;
      if ((workspaceContainsWriting(current) || hasUnsavedPreparation()) && !confirmAction('Open this saved article, replacing the current editor writing, notes, and any unsaved passage review or image preparation? Current edits are not added to the collection automatically. Valid saved writing is kept as a checkpoint in this tab. Unsaved passage reviews and image preparation are excluded from files and checkpoints; save the review note or apply the image change first to keep it. Save a private backup or update the collection to keep writing after leaving.')) { status('Opening cancelled. The editor and collection are unchanged.'); return; }
      openWorkspace(target); update(); workChanged(); status('Saved article opened. Approval and publishing profiles are cleared. The collection snapshot is unchanged; use Update selected after editing.'); report('Saved article opened locally. Previous valid writing is in Revisions. Nothing was uploaded or published.');
    } catch (error) { status(error.message); }
  });
  $('download-draft-collection').addEventListener('click', () => {
    if (reading || isBusy() || !$('draft-collection-private-ok').checked) return;
    try { download(collection.download(), 'drafttopage-private-collection.json', 'application/json;charset=utf-8'); status('Private collection download requested with saved entries only. Unsaved editor edits, checkpoints, undo, profiles, and approvals are excluded. Check the actual file before leaving.'); }
    catch (error) { status(error.message); }
  });
  $('load-draft-collection').addEventListener('change', async () => {
    const file = $('load-draft-collection').files?.[0];
    if (!file || reading || isBusy()) { $('load-draft-collection').value = ''; return; }
    const token = ++generation; reading = true; clearPreview(); update(); workChanged(); status('Reading the selected collection locally. Editor writing and saved entries are unchanged.');
    try {
      if (file.size > MAX_COLLECTION_BYTES) throw new Error('Choose a draft collection no larger than 2 MiB.');
      const value = parseDraftCollection(await file.text());
      if (token !== generation) return;
      pending = value;
      $('draft-collection-file-entries').replaceChildren(...value.entries.map(entry => {
        const li = document.createElement('li'); li.textContent = entry.name + ': ' + (entry.workspace.draft?.body?.length || 0).toLocaleString() + ' article characters; ' + entry.workspace.source.notes.length.toLocaleString() + ' source-note characters.'; return li;
      }));
      $('draft-collection-file-preview').hidden = false; status('Collection preview ready. Load this collection to replace saved entries only; the editor and approval stay unchanged.');
    } catch (error) { if (token === generation) { clearPreview(); status(error.message || 'Could not read this collection. Current writing and saved entries are unchanged.'); } }
    finally { if (token === generation) { reading = false; $('load-draft-collection').value = ''; update(); workChanged(); } }
  });
  $('apply-draft-collection').addEventListener('click', () => {
    if (reading || isBusy() || !pending) return;
    if (collection.list().length && !confirmAction('Replace the saved collection entries in this tab? Undo can recover the previous collection until the next change. Current editor writing and downloaded files stay unchanged.')) { status('Collection load cancelled. The editor and saved entries are unchanged.'); return; }
    const value = pending;
    mutate(() => { collection.load(value); selectedIndex = 0; clearPreview(); }, 'Collection loaded without changing editor writing or approval. Open a selected article separately.');
  });
  $('cancel-draft-collection').addEventListener('click', () => { clearPreview(); update(); workChanged(); status('Collection preview cancelled. Current writing and saved entries are unchanged.'); });
  function clear() {
    ++generation; reading = false; clearPreview(); collection.clear(); selectedIndex = 0;
    $('load-draft-collection').value = ''; $('draft-collection-name').value = ''; $('draft-collection-private-ok').checked = false; $('draft-collection-saved-preview').value = '';
    update(); status('Collection and collection undo cleared from this tab. Downloaded files are unchanged.');
  }
  update(); status('Add current writing explicitly, or load a private collection to preview. Download saved entries before leaving; there is no autosave.');
  return { update, clear, hasWork: () => reading || Boolean(pending) || collection.hasWriting() || Boolean($('draft-collection-name').value) };
}
