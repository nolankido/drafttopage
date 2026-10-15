import { ARTICLE_BODY_LIMIT } from './writing-limits.js';
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
function readLink(text, start) {
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
  let depth = 1, end = close + 2;
  for (; end < text.length && text[end] !== '\n'; end++) {
    if (text[end] === '(') depth++;
    if (text[end] === ')' && --depth === 0) break;
  }
  if (depth !== 0) return null;
  const label = text.slice(open + 1, close), target = text.slice(close + 2, end);
  return { type: image ? 'image' : 'link', text: label, target, href: image || !label.trim() ? null : safeWebLink(target), start, end: end + 1 };
}
export function inlineTokens(text) {
  if (typeof text !== 'string' || text.length > ARTICLE_BODY_LIMIT) throw new Error('Inline text supports at most 60,000 characters.');
  const parts = []; let offset = 0, plainStart = 0;
  const flush = end => { if (end > plainStart) parts.push({ type: 'text', text: text.slice(plainStart, end), start: plainStart, end }); };
  while (offset < text.length) {
    // Escaped syntax stays literal, including escaped links and images.
    if (text[offset] === '\\') { offset += 2; continue; }
    let part = readLink(text, offset);
    if (!part) {
      const match = /^(\x60([^\x60\n]+)\x60|\*\*([^*\n]+)\*\*|\*([^*\n]+)\*|_([^_\n]+)_)/.exec(text.slice(offset));
      if (match) part = { type: match[2] ? 'code' : match[3] ? 'strong' : 'em', text: match[2] || match[3] || match[4] || match[5], start: offset, end: offset + match[0].length };
    }
    if (!part) { offset++; continue; }
    flush(offset); parts.push(part); offset = part.end; plainStart = offset;
  }
  flush(text.length); return parts;
}
