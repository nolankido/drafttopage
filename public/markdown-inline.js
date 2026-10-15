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

export const INLINE_NESTING_LIMIT = 16;
const punctuation = value => Boolean(value && /[\p{P}\p{S}]/u.test(value));
const space = value => !value || /\s/u.test(value);
const prior = (text, at) => at > 1 && /[\uDC00-\uDFFF]/.test(text[at - 1]) ? text.slice(at - 2, at) : text[at - 1];
const next = (text, at) => at < text.length ? String.fromCodePoint(text.codePointAt(at)) : '';
class InlineLimit extends Error {}

// Positions always refer to the original UTF-16 source, including escaped punctuation.
// Links/images and code are atomic while resolving surrounding emphasis.
export function inlineTokens(text) {
  if (typeof text !== 'string' || text.length > ARTICLE_BODY_LIMIT) throw new Error('Inline text supports at most 60,000 characters.');
  const result = [];
  let from = 0;
  for (const line of text.split('\n')) {
    const end = from + line.length, budget = { left: Math.max(256, line.length * 32) };
    try { result.push(...parse(from, end, true, 0, budget)); }
    catch (error) { if (!(error instanceof InlineLimit)) throw error; result.push({ type: 'text', text: line, start: from, end }); }
    if (end < text.length) result.push({ type: 'text', text: '\n', start: end, end: end + 1 });
    from = end + 1;
  }
  return mergeText(result);

  function spend(budget) { if (--budget.left < 0) throw new InlineLimit(); }
  function codeAt(at, end, budget) {
    let size = 1; while (at + size < end && text[at + size] === '`') { spend(budget); size++; }
    let close = at + size;
    while (close < end) {
      spend(budget);
      if (text[close] !== '`') { close++; continue; }
      let run = 1; while (close + run < end && text[close + run] === '`') { spend(budget); run++; }
      if (run === size) {
        const value = text.slice(at + size, close);
        return { type: 'code', text: /^ .* $/.test(value) && /\S/.test(value) ? value.slice(1, -1) : value, start: at, end: close + run, depth: 0 };
      }
      close += run;
    }
    return { type: 'text', text: text.slice(at, at + size), start: at, end: at + size, depth: 0 };
  }
  function linkAt(start, end, allowLinks, depth, budget) {
    const image = text[start] === '!', open = start + (image ? 1 : 0);
    if (text[open] !== '[') return null;
    let close = open + 1;
    for (; close < end; close++) {
      spend(budget);
      if (text[close] === '\\' && close + 1 < end) { close++; continue; }
      if (text[close] === '[') return null;
      if (text[close] === ']') break;
    }
    if (close >= end || text[close + 1] !== '(') return null;
    let balance = 1, finish = close + 2;
    for (; finish < end; finish++) {
      spend(budget);
      if (text[finish] === '(') balance++;
      if (text[finish] === ')' && --balance === 0) break;
    }
    if (balance !== 0) return null;
    const label = text.slice(open + 1, close), target = text.slice(close + 2, finish);
    const href = image || !label.trim() ? null : safeWebLink(target);
    // A link inside a link label remains literal, never a nested anchor.
    if (!allowLinks && !image) return { type: 'text', text: text.slice(start, finish + 1), start, end: finish + 1, depth: 0 };
    const node = { type: image ? 'image' : 'link', text: label, target, href, start, end: finish + 1, depth: 0 };
    if (href) {
      if (depth >= INLINE_NESTING_LIMIT) throw new InlineLimit();
      node.children = parse(open + 1, close, false, depth + 1, budget);
      node.depth = 1 + Math.max(0, ...node.children.map(child => child.depth || 0));
      if (depth + node.depth > INLINE_NESTING_LIMIT) throw new InlineLimit();
    }
    return node;
  }
  function parse(start, end, allowLinks, depth, budget) {
    const head = { next: null }, tail = { prev: head }; head.next = tail;
    const delimiters = [];
    const append = node => { node.prev = tail.prev; node.next = tail; tail.prev.next = node; tail.prev = node; };
    let at = start, plain = start;
    const flush = to => { if (to > plain) append({ type: 'text', text: text.slice(plain, to), start: plain, end: to, depth: 0 }); };
    while (at < end) {
      spend(budget);
      if (text[at] === '\\') { at += 2; continue; }
      let node = text[at] === '`' ? codeAt(at, end, budget) : linkAt(at, end, allowLinks, depth, budget);
      if (!node && (text[at] === '*' || text[at] === '_')) {
        let finish = at + 1; while (finish < end && text[finish] === text[at]) { spend(budget); finish++; }
        const before = prior(text, at), after = next(text, finish);
        const left = !space(after) && (!punctuation(after) || space(before) || punctuation(before));
        const right = !space(before) && (!punctuation(before) || space(after) || punctuation(after));
        node = { type: 'delimiter', text: text.slice(at, finish), start: at, end: finish, mark: text[at],
          canOpen: text[at] === '*' ? left : left && (!right || punctuation(before)),
          canClose: text[at] === '*' ? right : right && (!left || punctuation(after)), active: true, depth: 0 };
        delimiters.push(node);
      }
      if (!node) { at++; continue; }
      flush(at); append(node); at = node.end; plain = at;
    }
    flush(end);
    for (let ci = 0; ci < delimiters.length; ci++) {
      const closer = delimiters[ci];
      while (closer.active && closer.canClose && closer.end > closer.start) {
        let oi = ci - 1;
        for (; oi >= 0; oi--) {
          spend(budget);
          const opener = delimiters[oi], a = opener.end - opener.start, b = closer.end - closer.start;
          if (opener.active && opener.canOpen && opener.mark === closer.mark && a &&
              !((opener.canClose || closer.canOpen) && (a + b) % 3 === 0 && (a % 3 !== 0 || b % 3 !== 0))) break;
        }
        if (oi < 0) break;
        const opener = delimiters[oi], use = Math.min(opener.end - opener.start, closer.end - closer.start) >= 2 ? 2 : 1;
        const children = [];
        for (let node = opener.next; node !== closer; node = node.next) { spend(budget); children.push(clean(node)); }
        const nesting = 1 + Math.max(0, ...children.map(child => child.depth || 0));
        if (depth + nesting > INLINE_NESTING_LIMIT) throw new InlineLimit();
        const wrapper = { type: use === 2 ? 'strong' : 'em', text: text.slice(opener.end, closer.start), children: mergeText(children),
          start: opener.end - use, end: closer.start + use, depth: nesting, prev: opener, next: closer };
        opener.next = wrapper; closer.prev = wrapper;
        opener.end -= use; opener.text = text.slice(opener.start, opener.end);
        closer.start += use; closer.text = text.slice(closer.start, closer.end);
        for (let i = oi + 1; i < ci; i++) { spend(budget); delimiters[i].active = false; }
        if (opener.start === opener.end) { opener.active = false; opener.prev.next = wrapper; wrapper.prev = opener.prev; }
        if (closer.start === closer.end) { closer.active = false; wrapper.next = closer.next; closer.next.prev = wrapper; }
      }
    }
    const nodes = []; for (let node = head.next; node !== tail; node = node.next) nodes.push(clean(node));
    return mergeText(nodes);
  }
}
function clean(node) {
  const { prev, next, mark, canOpen, canClose, active, ...value } = node;
  if (value.type === 'delimiter') value.type = 'text';
  return value;
}
function mergeText(nodes) {
  const result = [];
  for (const node of nodes) {
    if (node.start === node.end && !node.text) continue;
    const previous = result.at(-1);
    if (previous?.type === 'text' && node.type === 'text' && previous.end === node.start) { previous.text += node.text; previous.end = node.end; }
    else result.push(node);
  }
  return result;
}
export function* walkInlineTokens(nodes) {
  for (const node of nodes) { yield node; if (node.children) yield* walkInlineTokens(node.children); }
}
export function inlineVisibleText(nodes, { includeCode = false, includeImages = false } = {}) {
  return nodes.map(node => node.type === 'code' ? (includeCode ? node.text : '') : node.type === 'image' ? (includeImages ? decodeMarkdownEscapes(node.text) : '') : node.children ? inlineVisibleText(node.children, { includeCode, includeImages }) : decodeMarkdownEscapes(node.text)).join('');
}
