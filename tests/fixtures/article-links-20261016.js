// Frozen articleLinks from main 814bfa5d89ff13f50c4abc3aa80f21632335fab9.
import { ARTICLE_BODY_LIMIT } from '../../public/writing-limits.js';
import { articleStructure } from '../../public/draft-review.js';
import { markdownTableRanges } from '../../public/markdown-table.js';
import { inlineTokens, walkInlineTokens, inlineVisibleText, decodeMarkdownEscapes } from '../../public/markdown-inline.js';
function validBody(body) {
  if (typeof body !== 'string' || body.length > ARTICLE_BODY_LIMIT || body.includes('\0')) throw new Error('The article supports at most 60,000 characters and no null characters.');
}
export function baselineArticleLinks(body) {
  validBody(body);
  const tables = markdownTableRanges(body), links = [];
  for (const block of articleStructure(body)) {
    if (block.kind === 'code') continue;
    let line = block.line, offset = 0, emphasisEnd = 0;
    for (const token of walkInlineTokens(inlineTokens(block.text))) {
      if (['strong', 'em', 's'].includes(token.type)) emphasisEnd = Math.max(emphasisEnd, token.end);
      if (token.type !== 'link') continue;
      line += (block.text.slice(offset, token.start).match(/\n/g) || []).length; offset = token.end;
      const start = block.contentStart + token.start, end = block.contentStart + token.end;
      links.push({ start, end, label: token.children ? inlineVisibleText(token.children, { includeCode: true, includeImages: true }) : decodeMarkdownEscapes(token.text), formattedLabel: Boolean(token.children?.some(child => child.type !== 'text')), url: token.target, href: token.href,
        line, inEmphasis: token.start < emphasisEnd, inTable: tables.some(table => start >= table.start && end <= table.end) });
    }
  }
  return links;
}
