import { ARTICLE_BODY_LIMIT } from './writing-limits.js';
import { articleStructure } from './draft-review.js';
import { inlineTokens } from './markdown-inline.js';
import { safeImageLink, standaloneWordPressImage, analyzeWordPressImages } from './wordpress-images.js';
import { previewBlocks } from './preview.js';

export const IMAGE_ALT_LIMIT = 500;
export const IMAGE_URL_LIMIT = 2048;
function validBody(body) {
  if (typeof body !== 'string' || body.length > ARTICLE_BODY_LIMIT || body.includes('\0')) throw new Error('The article must contain at most 60,000 characters and no null characters.');
}
function boundary(body, offset) {
  return Number.isInteger(offset) && offset >= 0 && offset <= body.length && !(offset > 0 && offset < body.length && ((/[\uD800-\uDBFF]/.test(body[offset - 1]) && /[\uDC00-\uDFFF]/.test(body[offset])) || (body[offset - 1] === '\r' && body[offset] === '\n')));
}
export function imageEditTarget(body, start, end) {
  validBody(body);
  if (!boundary(body, start) || !boundary(body, end) || end < start) throw new Error('Select a complete article passage or place the cursor between characters.');
  const blocks = articleStructure(body), containing = blocks.filter(block => start <= block.end && end >= block.start);
  if (start === end && (start === 0 || start === body.length)) {
    if (start && blocks.at(-1)?.unclosed) throw new Error('Close the article code fence before adding an image at the end.');
    return { body, start, end, before: '', line: body.slice(0, start).split('\n').length };
  }
  const block = containing.find(item => start >= item.start && end <= item.end);
  if (containing.length && (!block || block.kind !== 'paragraph' || previewBlocks(block.text).some(item => item.type !== 'p') || /^(?: {4}|\t| {0,3}(?:>|[-+*][ \t]|\d+[.)][ \t]|<|\|))/m.test(block.text))) throw new Error('Choose ordinary paragraph text or a blank line, outside headings, lists, quotes, tables, source HTML, and code.');
  if (block) {
    for (const token of inlineTokens(block.text)) {
      if (token.type === 'text') continue;
      const left = block.contentStart + token.start, right = block.contentStart + token.end;
      if ((start > left && start < right) || (end > left && end < right)) throw new Error('Select the complete formatted phrase or image reference, or place the cursor outside it.');
    }
  }
  return { body, start, end, before: body.slice(start, end), line: body.slice(0, start).split('\n').length };
}
export function imageMarkdown({ url, alt, decorative = false }) {
  if (typeof url !== 'string' || url.length > IMAGE_URL_LIMIT || !safeImageLink(url)) throw new Error('Use an absolute HTTPS image URL, at most 2,048 characters, without credentials, spaces, or quoted titles.');
  if (typeof alt !== 'string' || alt.length > IMAGE_ALT_LIMIT || /[\u0000-\u001f\u007f]/.test(alt)) throw new Error('Use a single line of alternative text, at most 500 characters.');
  if (typeof decorative !== 'boolean' || (decorative ? alt !== '' : !alt.trim())) throw new Error('Describe the image, or clear the alternative text and explicitly mark it decorative.');
  const escaped = alt.replace(/[\\\[\]*_`!]/g, '\\$&'), markdown = '![' + escaped + '](' + url + ')';
  const parsed = standaloneWordPressImage(markdown);
  if (!parsed?.url || parsed.alt !== alt || parsed.target !== url) throw new Error('This URL cannot be represented safely as a simple Markdown image. Use an image URL with balanced parentheses.');
  return markdown;
}
export function planImageEdit(target, fields, currentBody) {
  if (!target || currentBody !== target.body) throw new Error('The article changed. Choose the current article selection or article end again before applying.');
  const { start, end } = imageEditTarget(currentBody, target.start, target.end);
  const markdown = imageMarkdown(fields), left = currentBody.slice(0, start), right = currentBody.slice(end);
  const newline = currentBody.includes('\r\n') ? '\r\n' : '\n';
  const separate = text => { const count = (text.match(/(?:\r?\n[ \t]*)+$/)?.[0].match(/\n/g) || []).length; return newline.repeat(Math.max(0, 2 - count)); };
  const prefix = left.length ? separate(left) : '';
  const leading = (right.match(/^(?:[ \t]*\r?\n)+/)?.[0].match(/\n/g) || []).length;
  const following = right.length ? newline.repeat(Math.max(0, 2 - leading)) : '';
  const replacement = prefix + markdown + following, body = left + replacement + right;
  if (body.length > ARTICLE_BODY_LIMIT) throw new Error('The image would exceed the 60,000-character article limit. Shorten the article first.');
  const selectionStart = start + prefix.length, selectionEnd = selectionStart + markdown.length;
  if (!analyzeWordPressImages(body).some(image => image.start === selectionStart && image.end === selectionEnd && image.eligible)) throw new Error('This position cannot produce a standalone image paragraph. Choose a blank line outside tables, lists, headings, and code.');
  return { body, selectionStart, selectionEnd, before: target.before, replacement, markdown, line: target.line, changed: body !== currentBody };
}
export function wordImagePlaceholders(body) {
  validBody(body);
  return [...body.matchAll(/\\?\[(?:Image or object omitted from Word document|Word image [1-9]\d{0,4})\\?\]/g)].map(match => ({ start: match.index, end: match.index + match[0].length, line: body.slice(0, match.index).split('\n').length }));
}
export function describeWordImagePlaceholders(body) {
  const positions = wordImagePlaceholders(body), totals = new Map(), seen = new Map();
  const labels = positions.map(item => body.slice(item.start, item.end).replace(/\\([\[\]])/g, '$1'));
  for (const label of labels) totals.set(label, (totals.get(label) || 0) + 1);
  return positions.map((item, index) => {
    const label = labels[index], occurrence = (seen.get(label) || 0) + 1;
    seen.set(label, occurrence);
    const before = Array.from(body.slice(Math.max(0, item.start - 100), item.start).split(/\r?\n/).at(-1)).slice(-45).join('');
    const after = Array.from(body.slice(item.end, item.end + 100).split(/\r?\n/)[0]).slice(0, 45).join('');
    return { ...item, label, occurrence, count: totals.get(label), context: (before + body.slice(item.start, item.end) + after).replace(/\s+/g, ' ') };
  });
}
