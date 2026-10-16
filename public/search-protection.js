import { ARTICLE_BODY_LIMIT } from './writing-limits.js';

// Conservative source protection, not a CommonMark parser. Ambiguous or unclosed
// constructs may protect extra text. Offsets always refer to the original source.
export function articleProtectionMask(body) {
  if (typeof body !== 'string' || body.length > ARTICLE_BODY_LIMIT || body.includes('\u0000')) throw new Error('The article cannot be scanned for protected search.');
  const mask = new Uint8Array(body.length);
  let budget = Math.max(1024, body.length * 32);
  const spend = (amount = 1) => { budget -= amount; if (budget < 0) throw new Error('Protected search reached its scan limit. Current writing is unchanged.'); };
  const protect = (start, end) => { spend(end - start); mask.fill(1, start, end); };
  const punctuation = character => {
    const code = character?.charCodeAt(0);
    return code >= 33 && code <= 47 || code >= 58 && code <= 64 || code >= 91 && code <= 96 || code >= 123 && code <= 126;
  };
  let fence = null, reference = false;
  for (let start = 0; start < body.length;) {
    const newline = body.indexOf('\n', start), end = newline < 0 ? body.length : newline + 1;
    const line = body.slice(start, end).replace(/[\r\n]+$/, '');
    spend(line.length + 1);
    // Strip quote/list containers for fence recognition. Four-space/tab lines
    // are protected even when they could be nested prose rather than code.
    const content = line.replace(/^(?: {0,3}>[ \t]?| {0,3}(?:[-+*]|\d{1,9}[.)])[ \t]+)+/, '').trimStart();
    const run = /^(`{3,}|~{3,})(.*)$/.exec(content);
    if (fence) {
      protect(start, end);
      if (run && run[1][0] === fence.character && run[1].length >= fence.length && !run[2].trim()) fence = null;
    } else if (run) {
      fence = { character: run[1][0], length: run[1].length }; protect(start, end); reference = false;
    } else if (!content) {
      reference = false;
    } else if (reference || /^\[.*\]:/.test(content)) {
      reference = true; protect(start, end);
    } else if (/^(?: {4}|\t)/.test(line) || /^(?: {0,3}>[ \t]?)+(?: {4}|\t)/.test(line)) {
      protect(start, end);
    }
    start = end;
  }

  // Opaque inline constructs are marked before brackets so a ] inside code or
  // an escaped bracket cannot close a link label prematurely.
  for (let index = 0; index < body.length;) {
    spend();
    if (mask[index]) { index++; continue; }
    if (body[index] === '\\' && punctuation(body[index + 1])) { protect(index, index + 2); index += 2; continue; }
    if (body[index] === '`') {
      let runEnd = index + 1;
      while (body[runEnd] === '`') { spend(); runEnd++; }
      const length = runEnd - index;
      let cursor = runEnd, end = body.length;
      while (cursor < body.length) {
        spend();
        if (mask[cursor] || body[cursor] !== '`') { cursor++; continue; }
        let close = cursor + 1;
        while (body[close] === '`') { spend(); close++; }
        if (close - cursor === length) { end = close; break; }
        cursor = close;
      }
      protect(index, end); index = end; continue;
    }
    if (body[index] === '<') {
      let end, raw = null;
      const terminator = body.startsWith('<!--', index) ? '-->' : body.startsWith('<![CDATA[', index) ? ']]>' : body.startsWith('<?', index) ? '?>' : null;
      if (terminator) {
        const close = body.indexOf(terminator, index + 2); end = close < 0 ? body.length : close + terminator.length;
      } else {
        let cursor = index + 1, quote = '';
        for (; cursor < body.length; cursor++) {
          spend();
          const character = body[cursor];
          if (quote) { if (character === quote) quote = ''; }
          else if (character === '"' || character === "'") quote = character;
          else if (character === '>') break;
        }
        end = Math.min(body.length, cursor + 1);
        raw = /^<\s*(script|style|pre|textarea|code)\b/i.exec(body.slice(index, index + 32));
      }
      if (raw) {
        const closing = new RegExp('</' + raw[1] + '\\s*>', 'gi'); closing.lastIndex = end;
        const match = closing.exec(body); end = match ? match.index + match[0].length : body.length;
      }
      protect(index, end); index = end; continue;
    }
    index++;
  }
  // Deliberately broad: URL punctuation is kept rather than guessing where a
  // destination ends. This can also exclude adjacent prose punctuation.
  for (const match of body.matchAll(/(?:https?:\/\/|ftp:\/\/|mailto:|www\.)[^\s<>]+/giu)) protect(match.index, match.index + match[0].length);

  for (let index = 0; index < body.length;) {
    spend();
    if (mask[index] || body[index] !== '[') { index++; continue; }
    const start = index > 0 && body[index - 1] === '!' && !mask[index - 1] ? index - 1 : index;
    let cursor = index + 1, depth = 1;
    for (; cursor < body.length && depth; cursor++) {
      spend(); if (mask[cursor]) continue;
      if (body[cursor] === '[') depth++;
      else if (body[cursor] === ']') depth--;
    }
    let end = cursor;
    if (!depth) {
      while (/\s/.test(body[cursor] || '') && cursor < body.length) { spend(); cursor++; }
      if (body[cursor] === '(') {
        let nested = 1, quote = ''; cursor++;
        for (; cursor < body.length && nested; cursor++) {
          spend();
          const character = body[cursor];
          if (character === '\\' && punctuation(body[cursor + 1])) { cursor++; continue; }
          if (quote) { if (character === quote) quote = ''; }
          else if (character === '"' || character === "'") quote = character;
          else if (character === '(') nested++;
          else if (character === ')') nested--;
        }
        end = cursor;
      }
    }
    protect(start, end); index = end;
  }
  return mask;
}
