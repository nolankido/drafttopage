import { ARTICLE_BODY_LIMIT } from './writing-limits.js';
import { articleProtectionMask } from './search-protection.js';
export const SEARCH_LIMIT = 200;
export const REPLACEMENT_LIMIT = 500;
export const ARTICLE_LIMIT = ARTICLE_BODY_LIMIT;
export const REPLACEMENT_PREVIEW_LIMIT = 5;

function text(value, limit, label) {
  if (typeof value !== 'string' || value.length > limit || value.includes('\u0000')) throw new Error(label + ' contains invalid text or exceeds ' + limit.toLocaleString() + ' characters.');
}
const wordCharacter = /[\p{L}\p{N}\p{M}\p{Pc}\u200c\u200d]/u;
function previousCharacter(body, index) {
  if (!index) return '';
  const last = body.charCodeAt(index - 1);
  return body.slice(index - (last >= 0xdc00 && last <= 0xdfff && index > 1 && body.charCodeAt(index - 2) >= 0xd800 && body.charCodeAt(index - 2) <= 0xdbff ? 2 : 1), index);
}
export function articleSearchResults(body, query, { matchCase = false, wholeWords = false, scope = 'source' } = {}) {
  text(body, ARTICLE_LIMIT, 'The article'); text(query, SEARCH_LIMIT, 'Find text');
  if (typeof matchCase !== 'boolean') throw new Error('Choose whether to match case.');
  if (typeof wholeWords !== 'boolean') throw new Error('Choose whether to find whole words.');
  if (!['source', 'protected'].includes(scope)) throw new Error('Choose a valid search scope.');
  const result = { matches: [], protectedCount: 0, partialCount: 0, totalCount: 0 };
  if (!query.length) return result;
  const mask = scope === 'protected' ? articleProtectionMask(body) : null;
  // Escape every metacharacter: authors enter literal text, never a pattern.
  const pattern = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  for (const match of body.matchAll(new RegExp(pattern, matchCase ? 'gu' : 'giu'))) {
    const start = match.index, end = start + match[0].length; result.totalCount++;
    if (wholeWords && (wordCharacter.test(previousCharacter(body, start)) || wordCharacter.test(body.slice(end, end + (body.codePointAt(end) > 0xffff ? 2 : 1))))) { result.partialCount++; continue; }
    if (mask?.subarray(start, end).includes(1)) { result.protectedCount++; continue; }
    result.matches.push({ start, end, text: match[0] });
  }
  return result;
}
export function findArticleMatches(body, query, options) {
  return articleSearchResults(body, query, options).matches;
}
export function navigateArticleMatch(matches, start, end, direction = 1) {
  if (!Array.isArray(matches) || !Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || ![1, -1].includes(direction)) throw new Error('Choose a valid article selection.');
  if (!matches.length) return -1;
  const selected = matches.findIndex(match => match.start === start && match.end === end);
  if (selected >= 0) return (selected + direction + matches.length) % matches.length;
  if (direction === 1) { const index = matches.findIndex(match => match.start >= end); return index < 0 ? 0 : index; }
  for (let index = matches.length - 1; index >= 0; index--) if (matches[index].end <= start) return index;
  return matches.length - 1;
}
function replace(body, matches, replacement) {
  text(replacement, REPLACEMENT_LIMIT, 'Replacement text');
  const length = body.length + matches.reduce((sum, match) => sum + replacement.length - (match.end - match.start), 0);
  if (length > ARTICLE_LIMIT) throw new Error('Replacement would exceed 60,000 article characters. Current writing is unchanged.');
  const chunks = []; let offset = 0;
  for (const match of matches) { chunks.push(body.slice(offset, match.start), replacement); offset = match.end; }
  chunks.push(body.slice(offset));
  return chunks.join('');
}
export function replaceArticleMatch(body, query, replacement, index, options) {
  const matches = findArticleMatches(body, query, options);
  if (!Number.isInteger(index) || index < 0 || index >= matches.length) throw new Error('Select a current match before replacing it.');
  const match = matches[index];
  return { body: replace(body, [match], replacement), selectionStart: match.start, selectionEnd: match.start + replacement.length, changedCount: match.text === replacement ? 0 : 1 };
}
export function previewArticleReplacements(body, query, replacement, options) {
  const matches = findArticleMatches(body, query, options);
  const result = replace(body, matches, replacement);
  const changed = matches.filter(match => match.text !== replacement);
  return {
    body: result, matchCount: matches.length, changedCount: changed.length,
    examples: changed.slice(0, REPLACEMENT_PREVIEW_LIMIT).map(match => {
      const from = Math.max(0, match.start - 32), to = Math.min(body.length, match.end + 32);
      const prefix = (from ? '…' : '') + body.slice(from, match.start), suffix = body.slice(match.end, to) + (to < body.length ? '…' : '');
      return { start: match.start, end: match.end, before: prefix + match.text + suffix, after: prefix + replacement + suffix };
    })
  };
}
