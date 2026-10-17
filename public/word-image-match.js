import { describeWordImagePlaceholders, imageEditTarget } from './image-editing.js';

// Find the first currently editable occurrence in article reading order.
// This only nominates a location. Map labels are not proof of provenance.
export function nextWordImageMatch(body, placements) {
  if (typeof body !== 'string' || !Array.isArray(placements) || !placements.length || placements.length > 200) return null;
  const byLabel = new Map();
  for (const entry of placements) {
    if (!entry || typeof entry.placeholder !== 'string' || byLabel.has(entry.placeholder)) return null;
    byLabel.set(entry.placeholder, entry);
  }
  let found;
  try { found = describeWordImagePlaceholders(body); } catch { return null; }
  for (const item of found) {
    if (item.count !== 1) continue; // Combined articles may reuse original image numbers.
    const entry = byLabel.get(item.label);
    if (!entry?.filename || !/^\[Word image (?:[1-9]|[1-9]\d|1\d\d|200)\]$/.test(item.label)) continue;
    try {
      const target = imageEditTarget(body, item.start, item.end);
      const literal = target.before.replace(/\\([\[\]])/g, '$1');
      if (literal !== item.label) continue;
      return {
        placeholder: item.label, start: item.start, end: item.end,
        line: item.line, context: item.context, filename: entry.filename
      };
    } catch {
      // Never target protected code, headings, lists, or partially formatted phrases.
    }
  }
  return null;
}
