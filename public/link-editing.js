import { ARTICLE_BODY_LIMIT } from './writing-limits.js';
import { articleStructure } from './draft-review.js';
import { inlineTokens, decodeMarkdownEscapes, safeWebLink } from './markdown-inline.js';
import { markdownTableRanges } from './markdown-table.js';

export const LINK_LABEL_LIMIT = 300;
export const LINK_URL_LIMIT = 2048;
export const LINK_REVIEW_LIMIT = 40;
function validBody(body) {
  if (typeof body !== 'string' || body.length > ARTICLE_BODY_LIMIT || body.includes('\0')) throw new Error('The article supports at most 60,000 characters and no null characters.');
}
function boundary(body, offset) {
  return Number.isInteger(offset) && offset >= 0 && offset <= body.length && !(offset > 0 && offset < body.length && ((/[\uD800-\uDBFF]/.test(body[offset - 1]) && /[\uDC00-\uDFFF]/.test(body[offset])) || (body[offset - 1] === '\r' && body[offset] === '\n')));
}
// Escape literal label text, including punctuation that could form blocks on unlink.
const literalMarkdown = text => text.replace(/[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/g, '\\$&');
export function articleLinks(body) {
  validBody(body);
  const tables = markdownTableRanges(body), links = [];
  for (const block of articleStructure(body)) {
    if (block.kind === 'code') continue;
    let line = block.line, offset = 0;
    for (const token of inlineTokens(block.text)) {
      if (token.type !== 'link') continue;
      line += (block.text.slice(offset, token.start).match(/\n/g) || []).length; offset = token.end;
      const start = block.contentStart + token.start, end = block.contentStart + token.end;
      links.push({ start, end, label: decodeMarkdownEscapes(token.text), url: token.target, href: token.href,
        line, inTable: tables.some(table => start >= table.start && end <= table.end) });
    }
  }
  return links;
}
export function linkEditTarget(body, start, end) {
  validBody(body);
  if (!boundary(body, start) || !boundary(body, end) || end < start) throw new Error('Choose a complete article selection or place the cursor between characters.');
  const links = articleLinks(body);
  const existing = links.find(link => start === end ? start >= link.start && start < link.end : start === link.start && end === link.end);
  if (existing) { start = existing.start; end = existing.end; }
  const tables = markdownTableRanges(body);
  if (tables.some(table => start <= table.end && end >= table.start)) throw new Error('Edit links in tables directly in the article. The guided editor preserves table structure by leaving these positions alone.');
  const block = articleStructure(body).find(item => start >= item.start && end <= item.end);
  if (block?.kind === 'code') throw new Error('Choose text outside fenced code.');
  if (block?.kind === 'heading' && (start < block.contentStart || end > block.contentStart + block.text.length)) throw new Error('Choose the heading text without its Markdown markers.');
  if (/[\r\n]/.test(body.slice(start, end))) throw new Error('Choose text on one article line for a link.');
  const lineStart = body.lastIndexOf('\n', Math.max(0, start - 1)) + 1, nextLine = body.indexOf('\n', end);
  const line = body.slice(start === 0 ? 0 : lineStart, nextLine < 0 ? body.length : nextLine).replace(/\r$/, '');
  const origin = start === 0 ? 0 : lineStart;
  const prefix = /^ {0,3}(?:(?:#{1,6}|[-+*]|\d+[.)])[ \t]+|(?:> ?)+)/.exec(line)?.[0].length || 0;
  if (/^(?: {4}|\t| {0,3}<)/.test(line) || start < origin + prefix) throw new Error('Choose ordinary article text after heading, list, or quote markers, outside indented code and source HTML.');
  for (const token of inlineTokens(line)) {
    const left = origin + token.start, right = origin + token.end;
    if (token.type !== 'text' && ((start > left && start < right) || (end > left && end < right))) throw new Error('Choose plain text, or select a complete existing link. Keep code, images, and emphasis outside the selection.');
    if (!existing && token.type !== 'text' && start < right && end > left) throw new Error('Choose plain text or a complete existing link. Formatted phrases and images are edited directly in the article.');
  }
  const before = body.slice(start, end), label = existing ? existing.label : decodeMarkdownEscapes(before);
  if (label.length > LINK_LABEL_LIMIT || (existing && existing.url.length > LINK_URL_LIMIT)) throw new Error('This selection exceeds the guided link limits. Choose a shorter label or edit this link directly.');
  return { body, start, end, before, label, url: existing?.url || '', existing: Boolean(existing), line: body.slice(0, start).split('\n').length };
}
export function linkMarkdown({ label, url }) {
  if (typeof label !== 'string' || !label.trim() || label.length > LINK_LABEL_LIMIT || /[\u0000-\u001f\u007f\u2028\u2029]/.test(label)) throw new Error('Use a descriptive single-line link label, up to 300 characters.');
  if (typeof url !== 'string' || url.length > LINK_URL_LIMIT || !safeWebLink(url)) throw new Error('Use an absolute HTTP or HTTPS URL, up to 2,048 characters, without credentials, spaces, or quoted titles.');
  const markdown = '[' + literalMarkdown(label) + '](' + url + ')', tokens = inlineTokens(markdown);
  if (tokens.length !== 1 || tokens[0].type !== 'link' || !tokens[0].href || tokens[0].target !== url || decodeMarkdownEscapes(tokens[0].text) !== label) throw new Error('This URL cannot be represented as a simple Markdown link. Use a URL with balanced parentheses.');
  return markdown;
}
export function planLinkEdit(target, fields, body, mode = 'edit') {
  if (!target || body !== target.body) throw new Error('The article changed. Choose a current selection or link again before applying.');
  const current = linkEditTarget(body, target.start, target.end);
  if (!['edit', 'remove'].includes(mode)) throw new Error('Choose a link edit or removal.');
  if (mode === 'remove' && !current.existing) throw new Error('Choose an existing link before removing it.');
  let replacement = mode === 'remove' ? literalMarkdown(current.label) : linkMarkdown(fields);
  if (mode === 'edit' && current.existing && current.label === fields.label && current.url === fields.url && safeWebLink(current.url)) replacement = current.before;
  const result = body.slice(0, current.start) + replacement + body.slice(current.end);
  if (result.length > ARTICLE_BODY_LIMIT) throw new Error('The link change would exceed the 60,000-character article limit. Shorten the article first.');
  const selectionStart = current.start, selectionEnd = selectionStart + replacement.length;
  if (mode === 'edit' && !articleLinks(result).some(link => link.start === selectionStart && link.end === selectionEnd && link.href)) throw new Error('This position would hide or change the link syntax. Choose ordinary article text or a blank line.');
  if (mode === 'remove' && articleLinks(result).some(link => selectionStart === selectionEnd ? link.start < selectionStart && link.end > selectionEnd : link.start < selectionEnd && link.end > selectionStart)) throw new Error('Surrounding Markdown would create another link. Edit this nested syntax directly in the article.');
  return { body: result, before: current.before, replacement, selectionStart, selectionEnd, changed: result !== body, mode };
}
export function articleLinkNotes(body) {
  const links = articleLinks(body);
  return ['Draft to Page: article link review', '', links.length + ' recognized inline link(s). No URLs were visited or verified.',
    'Plain URLs, reference links, nested Markdown, images, and code are outside this inspection. Table links may require direct source editing.', '',
    ...links.flatMap(link => ['Line ' + link.line + ': ' + (link.href ? 'Supported web link' : 'Stays literal text'), 'Label: ' + (link.label || '(empty)'), 'URL: ' + link.url, '']),
    'Inspect destination, label, factual support, and permission before publishing. These notes contain article labels and URLs only, excluding private source/review fields.'
  ].join('\n') + '\n';
}
