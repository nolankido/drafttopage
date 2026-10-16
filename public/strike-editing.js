import { ARTICLE_BODY_LIMIT } from './writing-limits.js';
import { inlineTokens, walkInlineTokens } from './markdown-inline.js';
import { articleProtectionMask } from './search-protection.js';
import { previewBlocks } from './preview.js';

const unchanged = message => { throw new Error(message + ' Current writing is unchanged.'); };
const boundary = (body, at) => !(at > 0 && at < body.length &&
  (/[\uD800-\uDBFF]/.test(body[at - 1]) && /[\uDC00-\uDFFF]/.test(body[at]) || body[at - 1] === '\r' && body[at] === '\n'));

// Compare parsed structure, flattening only the exact wrapper being added or
// removed. Adjacent text nodes may split when a wrapper is inserted, so merge
// them again. All other emphasis, links, code, images and literal source remain.
function signature(nodes, omit) {
  const result = [];
  const append = node => {
    if (node.type === 'text' && result.at(-1)?.type === 'text') result.at(-1).text += node.text;
    else result.push(node);
  };
  for (const node of nodes) {
    if (node === omit) { for (const child of signature(node.children)) append(child); continue; }
    const value = { type: node.type };
    if (node.children) value.children = signature(node.children, omit);
    else value.text = node.text;
    if ('target' in node) { value.target = node.target; value.href = node.href; }
    append(value);
  }
  return result;
}

// Removing a wrapper can expose a heading, list, fence or table delimiter.
// Reuse the actual bounded block parser rather than guessing those transitions.
function blockShape(body) {
  const shape = block => ({ type: block.type, level: block.level, headingStyle: block.headingStyle,
    start: block.start, items: block.items?.length, children: block.children?.map(items => items.map(shape)),
    columns: block.head?.length, rows: block.rows?.map(row => row.length), align: block.align });
  return JSON.stringify(previewBlocks(body).map(shape));
}

// Explicit-click helper only. It never serializes or normalizes an article.
// Source edits are limited to inserting/removing the chosen four tildes.
export function formatStrikethrough(body, start, end) {
  if (typeof body !== 'string' || body.length > ARTICLE_BODY_LIMIT || !Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end > body.length || end <= start || !boundary(body, start) || !boundary(body, end)) unchanged('Select one complete phrase on a single article line.');
  if (/[\r\n\u2028\u2029\u0000]/.test(body.slice(start, end))) unchanged('Select one phrase on a single article line.');
  while (start < end && /\s/u.test(body[start])) start++;
  while (end > start && /\s/u.test(body[end - 1])) end--;
  if (start === end) unchanged('Select a phrase, not only spaces.');
  const lineStart = body.lastIndexOf('\n', start - 1) + 1;
  const next = body.indexOf('\n', end), lineEnd = next < 0 ? body.length : next;
  const line = body.slice(lineStart, lineEnd).replace(/\r$/, '');
  const from = start - lineStart, to = end - lineStart;
  const tokens = inlineTokens(line), strikes = [...walkInlineTokens(tokens)].filter(node => node.type === 's');
  const selected = strikes.find(node => node.start === from && node.end === to || node.start + 2 === from && node.end - 2 === to);
  const mask = articleProtectionMask(body);
  let replacement, editStart = start, editEnd = end, selectionStart, selectionEnd, candidate;
  if (selected) {
    editStart = lineStart + selected.start; editEnd = lineStart + selected.end;
    if ([editStart, editStart + 1, editEnd - 2, editEnd - 1].some(at => mask[at])) unchanged('Keep code, links, images and protected source outside the selection, or edit their source directly.');
    replacement = body.slice(editStart + 2, editEnd - 2);
    candidate = inlineTokens(line.slice(0, selected.start) + replacement + line.slice(selected.end));
    if (JSON.stringify(signature(tokens, selected)) !== JSON.stringify(signature(candidate))) unchanged('Removing these marks would change adjacent Markdown. Edit the source directly.');
    selectionStart = editStart; selectionEnd = editStart + replacement.length;
  } else {
    if (strikes.some(node => from < node.end && to > node.start)) unchanged('Select the complete struck phrase to remove its strikethrough.');
    if (mask.subarray(start, end).some(Boolean)) unchanged('Keep code, links, images, escaped punctuation, addresses and protected source outside the selection, or edit their source directly.');
    const prefix = /^(?: {0,3}>[ \t]?| {0,3}(?:#{1,6}|[-+*]|\d{1,9}[.)])[ \t]+)+/.exec(line)?.[0] || '';
    const closing = prefix.includes('#') ? /[ \t]+#+[ \t]*$/.exec(line) : null;
    if (from < prefix.length || closing && to > closing.index || /^ {0,3}#{1,6}[ \t]*$/.test(line) || /^ {0,3}(?:[-_*][ \t]*){3,}$/.test(line) || /^ {0,3}(?:=+|-+)[ \t]*$/.test(line) || line.includes('|') && (/^\s*\|?\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)+\|?\s*$/.test(line) || body.slice(start, end).includes('|'))) unchanged('Select text after block markers and within one table cell, or edit the source directly.');
    if (body.length + 4 > ARTICLE_BODY_LIMIT) unchanged('Formatting would exceed 60,000 characters.');
    replacement = '~~' + body.slice(start, end) + '~~';
    candidate = inlineTokens(line.slice(0, from) + replacement + line.slice(to));
    const added = [...walkInlineTokens(candidate)].find(node => node.type === 's' && node.start === from && node.end === to + 4);
    if (!added || JSON.stringify(signature(candidate, added)) !== JSON.stringify(signature(tokens))) unchanged('This selection would change adjacent Markdown. Select a complete phrase or edit the source directly.');
    selectionStart = start + 2; selectionEnd = end + 2;
  }
  const result = body.slice(0, editStart) + replacement + body.slice(editEnd);
  const changedLine = line.slice(0, editStart - lineStart) + replacement + line.slice(editEnd - lineStart);
  const heading = /^ {0,3}#{1,6}(?:[ \t]|$)/.test(line);
  if (blockShape(body) !== blockShape(result) || heading && (/[ \t]+#+[ \t]*$/.exec(line)?.[0] || '') !== (/[ \t]+#+[ \t]*$/.exec(changedLine)?.[0] || '')) unchanged('This selection would change Markdown block structure. Edit the source directly.');
  return { body: result, selectionStart, selectionEnd };
}
