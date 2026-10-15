import { ARTICLE_BODY_LIMIT } from './writing-limits.js';
export const MAX_DIFF_CELLS = 160000;
export const DIFF_GROUP_LIMIT = 40;
export const DIFF_PREVIEW_LINES = 8;
export const DIFF_PREVIEW_CHARACTERS = 800;

export function previewArticleChange(text) {
  if (typeof text !== 'string' || text.length > ARTICLE_BODY_LIMIT || text.includes('\u0000')) throw new Error('Choose a bounded article passage.');
  let cut = Math.min(text.length, DIFF_PREVIEW_CHARACTERS), lineEnd = -1;
  for (let line = 0; line < DIFF_PREVIEW_LINES; line++) {
    lineEnd = text.indexOf('\n', lineEnd + 1);
    if (lineEnd < 0) break;
    if (line === DIFF_PREVIEW_LINES - 1) cut = Math.min(cut, lineEnd + 1);
  }
  // Do not split a UTF-16 surrogate pair at the preview boundary.
  if (cut > 0 && /[\uDC00-\uDFFF]/.test(text[cut] || '') && /[\uD800-\uDBFF]/.test(text[cut - 1])) cut--;
  return { text: text.slice(0, cut), truncated: cut < text.length };
}

// Exact line tokens include their line endings and the absence of a final one.
const lines = text => text.match(/[^\n]*\n|[^\n]+$/g) || [];
export function compareArticleLines(saved, current) {
  for (const text of [saved, current]) if (typeof text !== 'string' || text.length > ARTICLE_BODY_LIMIT || text.includes('\u0000')) throw new Error('Compare article text within the 60,000-character editor limit.');
  const a = lines(saved), b = lines(current), groups = [];
  let prefix = 0, suffix = 0, savedLine = 1, currentLine = 1, coarse = false;
  const emit = (kind, token) => {
    let group = groups.at(-1);
    if (!group || group.kind !== kind) { group = { kind, savedLine, currentLine, lines: [] }; groups.push(group); }
    group.lines.push(token);
    if (kind !== 'added') savedLine++;
    if (kind !== 'removed') currentLine++;
  };
  while (prefix < a.length && prefix < b.length && a[prefix] === b[prefix]) prefix++;
  while (suffix < a.length - prefix && suffix < b.length - prefix && a[a.length - suffix - 1] === b[b.length - suffix - 1]) suffix++;
  for (let i = 0; i < prefix; i++) emit('same', a[i]);
  const n = a.length - prefix - suffix, m = b.length - prefix - suffix, width = m + 1;
  if (!n || !m || (n + 1) * width > MAX_DIFF_CELLS) {
    coarse = Boolean(n && m);
    for (let i = 0; i < n; i++) emit('removed', a[prefix + i]);
    for (let j = 0; j < m; j++) emit('added', b[prefix + j]);
  } else {
    const lcs = new Uint16Array((n + 1) * width);
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) lcs[i * width + j] = a[prefix + i] === b[prefix + j]
      ? 1 + lcs[(i + 1) * width + j + 1] : Math.max(lcs[(i + 1) * width + j], lcs[i * width + j + 1]);
    let i = 0, j = 0;
    while (i < n || j < m) {
      if (i < n && j < m && a[prefix + i] === b[prefix + j]) { emit('same', a[prefix + i]); i++; j++; }
      else if (i < n && (j === m || lcs[(i + 1) * width + j] >= lcs[i * width + j + 1])) emit('removed', a[prefix + i++]);
      else emit('added', b[prefix + j++]);
    }
  }
  for (let i = a.length - suffix; i < a.length; i++) emit('same', a[i]);
  const result = groups.map(({ lines, ...group }) => ({ ...group, text: lines.join(''), lineCount: lines.length }));
  const count = kind => result.filter(group => group.kind === kind).reduce((sum, group) => sum + group.lineCount, 0);
  return { groups: result, added: count('added'), removed: count('removed'), unchanged: count('same'), coarse };
}
