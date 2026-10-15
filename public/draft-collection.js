import { createWorkspaceBackup, parseWorkspaceBackup, validateWorkspace, DRAFT_FIELDS } from './workspace.js';

export const MAX_COLLECTION_ENTRIES = 8;
export const MAX_COLLECTION_BYTES = 2 * 1024 * 1024;
const byteLength = text => new TextEncoder().encode(text).byteLength;
function exactObject(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== keys.length || !keys.every(key => Object.hasOwn(value, key))) throw new Error('Choose a supported Draft to Page collection file. Workspace backups and publishing profiles use their separate controls.');
}
function entryName(value) {
  if (typeof value !== 'string' || !value.trim() || value.length > 80 || /[\u0000-\u001f\u007f]/.test(value)) throw new Error('Use a saved article name of 1 to 80 characters, without control characters.');
  return value.trim();
}
export function collectionWorkspace(value) {
  return parseWorkspaceBackup(createWorkspaceBackup(value.source, value.draft));
}
export function workspaceContainsWriting(value) {
  return ['notes', 'audience', 'purpose'].some(key => value.source[key].length) || DRAFT_FIELDS.some(key => value.draft?.[key]?.length) || Boolean(value.draft?.questions?.length);
}
export function suggestedArticleName(value) {
  const title = (value.draft?.title || '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim() || 'Untitled article';
  let result = '';
  for (const char of title) { if (result.length + char.length > 80) break; result += char; }
  return result;
}
export function validateDraftCollection(value) {
  exactObject(value, ['format', 'version', 'entries']);
  if (value.format !== 'drafttopage-collection' || value.version !== 1) throw new Error('This draft collection version is not supported.');
  if (!Array.isArray(value.entries) || !value.entries.length || value.entries.length > MAX_COLLECTION_ENTRIES) throw new Error('A collection must contain one to eight saved articles.');
  const entries = value.entries.map(entry => {
    exactObject(entry, ['name', 'workspace']);
    const workspace = collectionWorkspace(validateWorkspace(entry.workspace));
    if (!workspaceContainsWriting(workspace)) throw new Error('Each saved article needs writing or source notes.');
    return { name: entryName(entry.name), workspace };
  });
  const result = { format: 'drafttopage-collection', version: 1, entries };
  if (byteLength(JSON.stringify(result, null, 2) + '\n') > MAX_COLLECTION_BYTES) throw new Error('The collection exceeds 2 MiB. Save fewer articles in this collection; existing writing is kept.');
  return result;
}
export function createDraftCollection(value) { return JSON.stringify(validateDraftCollection(value), null, 2) + '\n'; }
export function parseDraftCollection(content) {
  if (typeof content !== 'string' || byteLength(content) > MAX_COLLECTION_BYTES) throw new Error('Choose a draft collection no larger than 2 MiB.');
  let value;
  try { value = JSON.parse(content); } catch { throw new Error('The collection is not valid JSON. Current writing and saved articles are unchanged.'); }
  return validateDraftCollection(value);
}

// Immutable snapshots, with one previous collection state for explicit undo.
export function createDraftCollectionState() {
  let entries = [], previous = null, revision = 0;
  const selected = index => {
    if (!Number.isInteger(index) || index < 0 || index >= entries.length) throw new Error('Choose a saved article that is still in this collection.');
    return entries[index];
  };
  function commit(next) {
    const validated = next.length ? validateDraftCollection({ format: 'drafttopage-collection', version: 1, entries: next }).entries : [];
    if (JSON.stringify(validated) === JSON.stringify(entries)) return;
    previous = entries; entries = validated; revision++;
  }
  return {
    revision: () => revision,
    list: () => entries.map((entry, index) => ({ index, name: entry.name, title: entry.workspace.draft?.title || '', characters: entry.workspace.draft?.body?.length || 0, questions: entry.workspace.draft?.questions?.length || 0, notes: entry.workspace.source.notes.length })),
    hasWriting: () => entries.length > 0 || Boolean(previous?.length),
    canUndo: () => previous !== null,
    read: index => collectionWorkspace(selected(index).workspace),
    matches: (index, value) => JSON.stringify(selected(index).workspace) === JSON.stringify(collectionWorkspace(value)),
    bytes: () => entries.length ? byteLength(createDraftCollection({ format: 'drafttopage-collection', version: 1, entries })) : 0,
    download: () => createDraftCollection({ format: 'drafttopage-collection', version: 1, entries }),
    add(value, name = '') {
      if (entries.length >= MAX_COLLECTION_ENTRIES) throw new Error('This collection already has eight saved articles. Download it and use a different collection, or remove an entry first.');
      const workspace = collectionWorkspace(value);
      if (!workspaceContainsWriting(workspace)) throw new Error('Add article writing or source notes before saving to the collection.');
      commit([...entries, { name: name.trim() ? entryName(name) : suggestedArticleName(workspace), workspace }]);
      return entries.length - 1;
    },
    update(index, value, name = '') {
      const current = selected(index), workspace = collectionWorkspace(value);
      if (!workspaceContainsWriting(workspace)) throw new Error('Add article writing or source notes before updating a saved article.');
      commit(entries.map((entry, i) => i === index ? { name: name.trim() ? entryName(name) : current.name, workspace } : entry));
    },
    rename(index, name) { selected(index); const valid = entryName(name); commit(entries.map((entry, i) => i === index ? { ...entry, name: valid } : entry)); },
    remove(index) { selected(index); commit(entries.filter((_, i) => i !== index)); },
    load(value) { commit(validateDraftCollection(value).entries); },
    undo() { if (previous === null) return false; entries = previous; previous = null; revision++; return true; },
    clear() { entries = []; previous = null; revision++; }
  };
}
