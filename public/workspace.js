// Explicit, local files only. Backups contain writing, never credentials or approvals.
export const MAX_BACKUP_BYTES = 128 * 1024;
export const DRAFT_FIELDS = ['title', 'excerpt', 'description', 'slug', 'body'];
const SOURCE_LIMITS = { notes: 8000, audience: 160, purpose: 240 };
const DRAFT_LIMITS = { title: 160, excerpt: 300, description: 160, slug: 80, body: 12000 };
const PROFILES = ['personal', 'update', 'guide'];

function object(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).length !== keys.length || !keys.every(key => Object.hasOwn(value, key))) {
    throw new Error('This is not a supported Draft to Page workspace backup.');
  }
}
function text(value, max) {
  if (typeof value !== 'string' || value.length > max || value.includes('\u0000')) {
    throw new Error('The backup contains an invalid or oversized writing field.');
  }
  return value;
}
export function validateDraft(value) {
  object(value, [...DRAFT_FIELDS, 'questions']);
  const result = Object.fromEntries(DRAFT_FIELDS.map(key => [key, text(value[key], DRAFT_LIMITS[key])]));
  if (!Array.isArray(value.questions) || value.questions.length > 12) {
    throw new Error('The backup has an invalid review-question list.');
  }
  result.questions = value.questions.map(question => text(question, 500));
  return result;
}
export function validateWorkspace(value) {
  object(value, ['format', 'version', 'source', 'draft']);
  if (value.format !== 'drafttopage-workspace' || value.version !== 1) {
    throw new Error('This workspace backup version is not supported.');
  }
  object(value.source, ['profile', ...Object.keys(SOURCE_LIMITS)]);
  if (!PROFILES.includes(value.source.profile)) throw new Error('The backup uses an unsupported writing profile.');
  const source = { profile: value.source.profile };
  for (const [key, limit] of Object.entries(SOURCE_LIMITS)) source[key] = text(value.source[key], limit);
  return { format: value.format, version: 1, source, draft: value.draft === null ? null : validateDraft(value.draft) };
}
export function createWorkspaceBackup(source, draft = null) {
  const value = validateWorkspace({ format: 'drafttopage-workspace', version: 1, source, draft });
  const result = JSON.stringify(value, null, 2) + '\n';
  if (new TextEncoder().encode(result).byteLength > MAX_BACKUP_BYTES) throw new Error('The workspace is too large to back up.');
  return result;
}
export function parseWorkspaceBackup(content) {
  if (typeof content !== 'string' || new TextEncoder().encode(content).byteLength > MAX_BACKUP_BYTES) {
    throw new Error('Choose a workspace backup smaller than 128 KiB.');
  }
  let value;
  try { value = JSON.parse(content); }
  catch { throw new Error('The file is not valid workspace JSON. Your current writing is unchanged.'); }
  return validateWorkspace(value);
}
