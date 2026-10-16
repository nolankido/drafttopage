import { ARTICLE_BODY_LIMIT } from './writing-limits.js';
// Import literal writing without treating punctuation as Markdown structure.
export function escapeMarkdownText(text) {
  return text.replace(/[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/g, '\\$&');
}
// Decode punctuation for display only. Tokens retain original source offsets for review.
export function decodeMarkdownEscapes(text) {
  return text.replace(/\\([!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~])/g, '$1');
}
// A small, bounded inline parser shared by review, preview, and HTML export.
// Web links are opt-in navigation. Parsing never loads a URL or an image.
export function safeWebLink(target) {
  if (typeof target !== 'string' || !/^https?:\/\//i.test(target) || /[\s\u0000-\u001f\u007f<>"\\]/u.test(target)) return null;
  try {
    const url = new URL(target);
    if (!['https:', 'http:'].includes(url.protocol) || !url.hostname || url.username || url.password) return null;
    return url.href;
  } catch { return null; }
}
// Pair parentheses once per input, with newlines as boundaries. An unfinished
// URL then costs a lookup instead of rescanning the remaining article each time.
function parenthesisPairs(text) {
  const pairs = new Int32Array(text.length).fill(-1), stack = new Int32Array(text.length);
  let depth = 0;
  for (let index = 0; index < text.length; index++) {
    if (text[index] === '\n') depth = 0;
    else if (text[index] === '(') stack[depth++] = index;
    else if (text[index] === ')' && depth) pairs[stack[--depth]] = index;
  }
  return pairs;
}
function readLink(text, start, closeFor) {
  const image = text[start] === '!';
  const open = start + (image ? 1 : 0);
  if (text[open] !== '[') return null;
  let close = open + 1;
  for (; close < text.length; close++) {
    if (text[close] === '\\' && close + 1 < text.length && text[close + 1] !== '\n') { close++; continue; }
    if (text[close] === '[' || text[close] === '\n') return null;
    if (text[close] === ']') break;
  }
  if (close >= text.length || text[close + 1] !== '(') return null;
  const end = closeFor(close + 1);
  if (end < 0) return null;
  const label = text.slice(open + 1, close), target = text.slice(close + 2, end);
  return { type: image ? 'image' : 'link', text: label, target, href: image || !label.trim() ? null : safeWebLink(target), start, end: end + 1 };
}
// Only simple underscore pairs are supported. Do not eat identifier characters.
// Flanking uses bounded Unicode code-point context, never a scan of the prefix.
function underscoreBoundary(text, index) {
  const before = Array.from(text.slice(Math.max(0, index - 2), index)).at(-1) || '';
  const after = Array.from(text.slice(index + 1, index + 3))[0] || '';
  const whitespace = value => !value || /^[\t\n\f\r\p{Zs}]$/u.test(value);
  const punctuation = value => /^[\p{P}\p{S}]$/u.test(value);
  const left = !whitespace(after) && (!punctuation(after) || whitespace(before) || punctuation(before));
  const right = !whitespace(before) && (!punctuation(before) || whitespace(after) || punctuation(after));
  return { open: left && (!right || punctuation(before)), close: right && (!left || punctuation(after)) };
}

export function inlineTokens(text) {
  if (typeof text !== 'string' || text.length > ARTICLE_BODY_LIMIT) throw new Error('Inline text supports at most 60,000 characters.');
  const parts = []; let offset = 0, plainStart = 0, pairs = null;
  const closeFor = open => (pairs ??= parenthesisPairs(text))[open];
  const flush = end => { if (end > plainStart) parts.push({ type: 'text', text: text.slice(plainStart, end), start: plainStart, end }); };
  while (offset < text.length) {
    // Escaped syntax stays literal, including escaped links and images.
    if (text[offset] === '\\') { offset += 2; continue; }
    let part = readLink(text, offset, closeFor);
    if (!part) {
      let match = /^(\x60([^\x60\n]+)\x60|\*\*([^*\n]+)\*\*|\*([^*\n]+)\*|_([^_\n]+)_)/.exec(text.slice(offset));
      if (match?.[5]) {
        const end = offset + match[0].length;
        if (text[offset - 1] === '_' || text[end] === '_' || !underscoreBoundary(text, offset).open || !underscoreBoundary(text, end - 1).close) match = null;
      }
      if (match) part = { type: match[2] ? 'code' : match[3] ? 'strong' : 'em', text: match[2] || match[3] || match[4] || match[5], start: offset, end: offset + match[0].length };
    }
    if (!part) { offset++; continue; }
    flush(offset); parts.push(part); offset = part.end; plainStart = offset;
  }
  flush(text.length); return parts;
}
