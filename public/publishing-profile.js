// Portable choices and reminders only. Article writing never enters this format.
export const MAX_PROFILE_BYTES = 16 * 1024;
export const PROFILE_DESTINATIONS = { wordpress: 'WordPress block editor', html: 'HTML source for a website', word: 'Word document (.docx)', other: 'Another editor or Markdown site' };
const preferenceKeys = ['destination', 'formattedTitle', 'htmlTitle', 'wordTitle', 'markdownTitle'];
function object(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== keys.length || !keys.every(key => Object.hasOwn(value, key))) throw new Error('Choose a supported Draft to Page publishing profile, not a workspace backup or article file.');
}
function label(value, limit, kind) {
  if (typeof value !== 'string' || !value.trim() || value.length > limit || /[\u0000-\u001f\u007f]/.test(value)) throw new Error('Check the ' + kind + ' and its length.');
  return value.trim();
}
export function validatePublishingProfile(value) {
  object(value, ['format', 'version', 'name', 'preferences', 'checklist']);
  if (value.format !== 'drafttopage-publishing-profile' || value.version !== 1) throw new Error('This publishing profile version is not supported.');
  const name = label(value.name, 80, 'profile name');
  object(value.preferences, preferenceKeys);
  const p = value.preferences;
  if (typeof p.destination !== 'string' || !Object.hasOwn(PROFILE_DESTINATIONS, p.destination) || !['page', 'document'].includes(p.markdownTitle) || ['formattedTitle', 'htmlTitle', 'wordTitle'].some(key => typeof p[key] !== 'boolean')) throw new Error('This profile contains an unsupported export choice.');
  if (!Array.isArray(value.checklist) || value.checklist.length > 8) throw new Error('Use up to eight checklist reminders.');
  const checklist = value.checklist.map(item => label(item, 160, 'checklist reminder'));
  if (new Set(checklist).size !== checklist.length) throw new Error('Use distinct checklist reminders.');
  return { format: 'drafttopage-publishing-profile', version: 1, name, preferences: Object.fromEntries(preferenceKeys.map(key => [key, p[key]])), checklist };
}
export function checklistFromText(text) {
  if (typeof text !== 'string' || text.length > 1287) throw new Error('Use up to eight reminders of 160 characters each.');
  const lines = text.split(/\r?\n/).filter(line => line.trim());
  return validatePublishingProfile({ format: 'drafttopage-publishing-profile', version: 1, name: 'Checklist', preferences: { destination: 'wordpress', formattedTitle: false, htmlTitle: false, wordTitle: false, markdownTitle: 'page' }, checklist: lines }).checklist;
}
export function createPublishingProfile(value) {
  const content = JSON.stringify(validatePublishingProfile(value), null, 2) + '\n';
  if (new TextEncoder().encode(content).byteLength > MAX_PROFILE_BYTES) throw new Error('This publishing profile is too large.');
  return content;
}
export function parsePublishingProfile(content) {
  if (typeof content !== 'string' || new TextEncoder().encode(content).byteLength > MAX_PROFILE_BYTES) throw new Error('Choose a publishing profile no larger than 16 KiB.');
  let value;
  try { value = JSON.parse(content); } catch { throw new Error('The profile is not valid JSON. Current writing and choices are unchanged.'); }
  return validatePublishingProfile(value);
}
