import { articleIssues } from './authoring.js';
import { analyzeDraft, articleStructure, REVIEW_LIMIT } from './draft-review.js';
import { inlineTokens } from './markdown-inline.js';

export const WORDPRESS_REVIEW_LIMIT = REVIEW_LIMIT;
export function reviewWordPress(draft) {
  const issues = articleIssues(draft, 'body');
  if (issues.body) throw new Error(issues.body);
  const body = draft.body;
  const basic = analyzeDraft({ body, title: typeof draft.title === 'string' && draft.title.length <= 160 ? draft.title : '' });
  const findings = basic.findings.map(item => ({ ...item,
    message: item.kind === 'image' ? 'Add this image in WordPress. Its Markdown stays text in copied blocks.' : item.kind === 'link' ? 'This link stays text. Use a non-empty label and a safe absolute http:// or https:// address, then inspect the destination.' : item.message
  }));
  let totalFindings = basic.totalFindings;
  const add = (kind, message, start, end, line) => { totalFindings++; findings.push({ kind, message, start, end, line }); };
  for (const section of articleStructure(body)) {
    if (section.kind === 'code') continue;
    if (section.kind === 'heading' && section.level === 1) add('title-level', 'This body H1 becomes H2 in WordPress. Keep the post title in its separate title field.', section.start, section.end, section.line);
    const originals = body.slice(section.start, section.end).split('\n');
    let start = section.start;
    for (let index = 0; index < originals.length; index++) {
      const original = originals[index], text = original.replace(/\r$/, ''), end = start + text.length, line = section.line + index;
      // Mask inline code and URLs before scanning unsupported syntax. Positions stay exact.
      let masked = '', offset = 0;
      for (const token of inlineTokens(text)) {
        if (['code', 'link', 'image'].includes(token.type)) { masked += text.slice(offset, token.start) + ' '.repeat(token.end - token.start); offset = token.end; }
      }
      masked += text.slice(offset);
      const flag = (kind, message) => add(kind, message, start, end, line);
      if (/(^|[^\\])<[^>\n]+>/.test(masked)) flag('html', 'Source HTML and angle-bracket links stay literal text. Rebuild the intended content in WordPress.');
      if (/^\s+([-*+]\s+|\d+[.)]\s+)/.test(masked)) flag('nested-list', 'Indented lists are outside this converter. Rebuild nesting in WordPress.');
      else if (/^(\+\s+|\d+\)\s+)/.test(masked)) flag('list-style', 'This list marker stays text. Use a flat - bullet or 1. numbered list, or rebuild it in WordPress.');
      else if (/^(?: {4}|\t)\S/.test(masked)) flag('indented-code', 'Indented text is not converted to a Code block. Use a fenced code block if this is code.');
      if (/^[-*] +\[[ xX]\]/.test(masked)) flag('task-list', 'Task checkboxes stay literal text inside the list. Rebuild them if your post needs checkboxes.');
      if (/^\d+\. +/.test(masked) && !/^1\. +/.test(masked) && (index === 0 || !/^\d+\. +/.test(originals[index - 1]))) flag('list-start', 'This numbered list is exported starting at 1. Adjust its starting number in WordPress if needed.');
      if (/^ {0,3}(?:-{3,}|_{3,}|(?:\*[ \t]*){3,})[ \t]*$/.test(masked) && !masked.includes('|')) flag('separator', 'This separator or setext heading marker stays text. Use a Markdown # heading or add a Separator block in WordPress.');
      if (/^ {0,3}={3,}[ \t]*$/.test(masked)) flag('setext', 'This setext heading marker stays text. Use a Markdown # heading for the intended heading.');
      if (/^> ?(?:>|[-*+] +|\d+[.)] +|#{1,6} +)/.test(masked)) flag('quote-format', 'Nested formatting in this quote stays text. Rebuild the intended list, heading, or nested quote in WordPress.');
      if (/(^|[^\\])~~[^~]+~~/.test(masked)) flag('strike', 'Strike-through is outside this converter. Apply it in WordPress if needed.');
      if (/^ {0,3}\[[^\]]+\]:|(^|[^\\])\[[^\]]+\]\[[^\]]*\]/.test(masked)) flag('reference', 'Reference links or footnotes stay text. Replace with inline links or rebuild them in WordPress.');
      const next = originals[index + 1]?.replace(/\r$/, '') || '';
      if (masked.includes('|') && /^\s*\|?\s*:?-{3,}:?\s*\|/.test(next)) flag('table', 'This Markdown table stays text. Rebuild it with a Table block in WordPress.');
      start += original.length + 1;
    }
  }
  findings.sort((a, b) => a.start - b.start || a.end - b.end || a.kind.localeCompare(b.kind));
  return { findings: findings.slice(0, WORDPRESS_REVIEW_LIMIT), totalFindings, truncated: totalFindings > WORDPRESS_REVIEW_LIMIT };
}

export function wordPressReviewText(draft, review = reviewWordPress(draft)) {
  return [
    'Draft to Page: WordPress handoff review', '',
    'Limited formatting and writing-pattern checks. This is not fact-checking, grammar checking, permissions review, or URL verification.',
    review.totalFindings ? review.totalFindings + ' item(s) to inspect.' : 'No items found by these limited checks. This does not certify the article.',
    ...(review.truncated ? ['Showing the first ' + WORDPRESS_REVIEW_LIMIT + ' items. Inspect the complete article.'] : []), '',
    ...review.findings.map(item => 'Line ' + item.line + ': ' + item.message), '',
    'Before publishing in WordPress:',
    '- Compare names, dates, claims, quotations, and uncertainty with your own source.',
    '- Check permissions for writing and images. Add and inspect images in WordPress.',
    '- Inspect supported formatting and any literal Markdown after returning to Visual editor.',
    '- Enter the title and optional excerpt, slug, and SEO description in their separate fields.',
    '- Check the actual post preview, mobile layout, and links before publishing yourself.', '',
    'Source notes and private review questions are excluded. Article text can still contain private information.'
  ].join('\n') + '\n';
}
