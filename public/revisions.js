import { createWorkspaceBackup, parseWorkspaceBackup, DRAFT_FIELDS } from './workspace.js';

export const MAX_CHECKPOINTS = 5;
export const MAX_CHECKPOINT_BYTES = 384 * 1024;
const fields = [
  ['source', 'profile', 'Article type'], ['source', 'audience', 'Audience'],
  ['source', 'purpose', 'Purpose'], ['source', 'notes', 'Source notes'],
  ...DRAFT_FIELDS.map(key => ['draft', key, ({ title: 'Title', excerpt: 'Excerpt', description: 'Description', slug: 'Filename', body: 'Article body' })[key]]),
  ['draft', 'questions', 'Review notes']
];
const serialize = value => createWorkspaceBackup(value.source, value.draft);
const writingPresent = value => ['notes', 'audience', 'purpose'].some(key => value.source[key].length) ||
  DRAFT_FIELDS.some(key => value.draft?.[key]?.length) || Boolean(value.draft?.questions?.length);

/** Writing-only snapshots in memory. No storage, timers, network, or credentials. */
export function createCheckpointHistory({ now = () => new Date().toISOString() } = {}) {
  let entries = [], nextId = 1;
  const list = () => entries.map(({ id, label, created, bytes }) => ({ id, label, created, bytes }));
  const get = id => {
    const entry = entries.find(item => item.id === Number(id));
    if (!entry) throw new Error('Choose a checkpoint that is still available in this tab.');
    return entry;
  };
  return {
    list,
    hasWriting: () => entries.length > 0,
    clear: () => { entries = []; },
    read: id => parseWorkspaceBackup(get(id).content),
    download: id => get(id).content,
    save(value, label = 'Saved checkpoint') {
      const content = serialize(value); // Validate and clone before modifying history.
      if (!writingPresent(parseWorkspaceBackup(content))) return { empty: true, evicted: 0 };
      if (typeof label !== 'string' || label.length > 80 || label.includes('\u0000')) throw new Error('Use a checkpoint label up to 80 characters.');
      const latest = entries.at(-1);
      if (latest?.content === content) return { id: latest.id, duplicate: true, evicted: 0 };
      const entry = { id: nextId++, label: label.trim() || 'Saved checkpoint', created: now(), content, bytes: new TextEncoder().encode(content).byteLength };
      entries.push(entry);
      let evicted = 0;
      while (entries.length > MAX_CHECKPOINTS || entries.reduce((sum, item) => sum + item.bytes, 0) > MAX_CHECKPOINT_BYTES) {
        entries.shift(); evicted++;
      }
      return { id: entry.id, evicted, duplicate: false };
    }
  };
}

/** Exact field comparison, bounded by the existing workspace limits. No guessed edits. */
export function compareWorkspaces(saved, current) {
  const left = parseWorkspaceBackup(serialize(saved)), right = parseWorkspaceBackup(serialize(current));
  return fields.map(([section, key, label]) => {
    const value = workspace => key === 'questions'
      ? (workspace.draft?.questions || []).map((text, index) => `${index + 1}. ${text}`).join('\n\n')
      : workspace[section]?.[key] || '';
    const before = value(left), after = value(right);
    return { id: key, label, saved: before, current: after, changed: before !== after };
  });
}
