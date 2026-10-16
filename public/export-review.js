import { articleIssues } from './authoring.js';
import { analyzeDraft, articleStructure, REVIEW_LIMIT } from './draft-review.js';
import { inlineTokens, walkInlineTokens } from './markdown-inline.js';
import { markdownTableRanges } from './markdown-table.js';
import { markdownListRanges } from './markdown-list.js';
import { analyzeWordPressImages } from './wordpress-images.js';
import { setextLevel } from './markdown-block-syntax.js';

export const EXPORT_REVIEW_LIMIT = REVIEW_LIMIT;
export function reviewExport(draft, { destination = 'wordpress', includeLinkedImages = false, includeTitle = false } = {}) {
  if (!['wordpress', 'word', 'html'].includes(destination)) throw new Error('Choose WordPress, Word, or HTML for formatting review.');
  if (typeof includeTitle !== 'boolean') throw new Error('Choose whether the export includes the article title.');
  if (destination !== 'wordpress' && includeLinkedImages) throw new Error('Linked image blocks are available only for WordPress.');
  const wordpress = destination === 'wordpress';
  const target = wordpress ? 'WordPress' : destination === 'word' ? 'Word' : 'your website editor';
  if (typeof includeLinkedImages !== 'boolean') throw new Error('Choose whether to prepare linked images.');
  const issues = articleIssues(draft, 'body');
  if (issues.body) throw new Error(issues.body);
  const body = draft.body;
  const basic = analyzeDraft({ body, title: (wordpress || includeTitle) && typeof draft.title === 'string' && draft.title.length <= 160 ? draft.title : '' }, { imageFindings: false });
  const findings = basic.findings.map(item => ({ ...item,
    message: item.kind === 'link' ? 'This link stays text. Use a non-empty label and a safe absolute http:// or https:// address, then inspect the destination.' : item.message
  }));
  let totalFindings = basic.totalFindings;
  const add = (kind, message, start, end, line) => { totalFindings++; findings.push({ kind, message, start, end, line }); };
  for (const image of analyzeWordPressImages(body)) {
    if (!wordpress) { add('image', 'This image remains literal Markdown in the ' + (destination === 'word' ? 'Word document' : 'HTML fragment') + '. Add and inspect the actual image in your destination editor after exporting.', image.start, image.end, image.line); continue; }
    const prepared = includeLinkedImages && image.eligible;
    if (!prepared) add('image', 'This image stays text in copied blocks. ' + (image.reason || 'Open Images for WordPress and select Include supported linked images to prepare this reference, or add it in WordPress.'), image.start, image.end, image.line);
    else if (!image.alt.trim()) add('image-alt', 'This linked image has empty alternative text. Add a meaningful description, or deliberately mark it decorative in WordPress.', image.start, image.end, image.line);
  }
  const lists = markdownListRanges(body);
  let listIndex = 0;
  for (const list of lists) if (!list.supported) add('list', 'This list group stays text. ' + list.reason + ' Edit its Markdown or rebuild it in ' + target + '.', list.start, list.headerEnd, list.line);
  for (const table of markdownTableRanges(body)) if (!table.supported) add('table', 'This table stays text. ' + table.reason + ' Edit its Markdown or rebuild it in ' + target + '.', table.start, table.headerEnd, table.line);
  for (const section of articleStructure(body)) {
    if (section.kind === 'code' || section.kind === 'separator') continue;
    if (section.kind === 'heading' && section.level === 1 && destination !== 'word') add('title-level', wordpress ? 'This body H1 becomes H2 in WordPress. Keep the post title in its separate title field.' : 'This body H1 becomes H2 in HTML source. The separate title becomes H1 only when Include the article title is selected.', section.start, section.end, section.line);
    const originals = body.slice(section.start, section.end).split('\n');
    let start = section.start;
    for (let index = 0; index < originals.length; index++) {
      const original = originals[index], text = original.replace(/\r$/, ''), end = start + text.length, line = section.line + index;
      if (section.headingStyle === 'setext' && index === originals.length - 1) { start += original.length + 1; continue; }
      // Mask inline code and URLs before scanning unsupported syntax. Positions stay exact.
      let masked = '', offset = 0;
      for (const token of walkInlineTokens(inlineTokens(text))) {
        if (token.start >= offset && ['code', 'link', 'image'].includes(token.type)) { masked += text.slice(offset, token.start) + ' '.repeat(token.end - token.start); offset = token.end; }
      }
      masked += text.slice(offset);
      const flag = (kind, message) => add(kind, message, start, end, line);
      for (const match of masked.matchAll(/\\?\[(?:Word image [1-9]\d{0,4}|Image or object omitted from Word document)\\?\]/g)) {
        add('word-image', wordpress
          ? 'This possible Word image placeholder stays text in copied blocks. Compare this occurrence with the original document and placement map. Replace it with a reviewed HTTPS image reference and choose linked Image blocks separately, or add the image yourself in WordPress.'
          : 'This possible Word image placeholder stays text in the ' + (destination === 'word' ? 'Word document' : 'HTML fragment') + '. Compare it with the original document and add the actual image in your destination editor. Image Markdown also stays text in this export.',
        start + match.index, start + match.index + match[0].length, line);
      }
      if (/(^|[^\\])<[^<>\n]+>/.test(masked)) flag('html', 'Source HTML and angle-bracket links stay literal text. Rebuild the intended content in ' + target + '.');
      while (listIndex < lists.length && start >= lists[listIndex].end) listIndex++;
      const inList = Boolean(lists[listIndex] && start >= lists[listIndex].start && start < lists[listIndex].end);
      if (!inList && /^\s+([-*+]\s+|\d+[.)]\s+)/.test(masked)) flag('nested-list', 'This indented list has no supported parent. Start at the left edge, or nest under a parent item with two or four more spaces.');
      else if (!inList && /^(?:[-*+]\s+|\d+[.)]\s+)/.test(masked)) flag('list-style', 'This list marker stays text. Use a nonempty item with -, *, +, or a number of up to nine digits.');
      else if (!inList && /^(?: {4}|\t)\S/.test(masked)) flag('indented-code', 'Indented text is not converted to a Code block. Use a fenced code block if this is code.');
      if (/^\s*(?:[-*+]|\d+[.)]) +\[[ xX]\]/.test(masked)) flag('task-list', wordpress ? 'Task checkboxes stay literal text inside the list. Rebuild them if your post needs checkboxes.' : 'Task checkbox markers remain literal text inside the list. Add real checkboxes in your destination if needed.');
      if (/^ {0,3}(?:-{3,}|_{3,}|(?:\*[ \t]*){3,})[ \t]*$/.test(masked) && !masked.includes('|')) flag('separator', wordpress ? 'This separator or setext heading marker stays text. Use a Markdown # heading or add a Separator block in WordPress.' : 'This separator or setext heading marker stays text. Use a Markdown # heading or add a horizontal rule in your destination editor.');
      if (setextLevel(masked)) flag('setext', 'This underline has no supported preceding heading paragraph. Check the surrounding blocks or use a Markdown # heading.');
      if (/^> ?(?:>|[-*+] +|\d+[.)] +|#{1,6} +)/.test(masked)) flag('quote-format', 'Nested block formatting in this quote stays text. Rebuild the intended list, heading, or nested quote in ' + target + '.');
      if (/(^|[^\\])~~[^~]+~~/.test(masked)) flag('strike', 'Strike-through is outside this converter. Apply it in ' + target + ' if needed.');
      if (/^ {0,3}\[[^\]\n]+\]:|(^|[^\\])\[[^\[\]\n]+\]\[[^\[\]\n]*\]/.test(masked)) flag('reference', 'Reference links, reference images, or Markdown footnotes stay text. Use Convert reference-style links above the export for supported web references, or rebuild the remaining content in ' + target + '.');
      start += original.length + 1;
    }
  }
  findings.sort((a, b) => a.start - b.start || a.end - b.end || a.kind.localeCompare(b.kind));
  return { findings: findings.slice(0, EXPORT_REVIEW_LIMIT), totalFindings, truncated: totalFindings > EXPORT_REVIEW_LIMIT };
}

export function formattingActionLabel(item) {
  if (item.kind === 'word-image') return 'Prepare this Word image replacement';
  if (item.kind === 'image' || item.kind === 'image-alt') return 'Review this image reference';
  if (item.kind === 'reference') return 'Review reference-link conversion';
  return '';
}

export function exportTitleHandling({ destination, includeTitle = false }) {
  if (destination === 'word') return (includeTitle ? 'The title is included as a separate Title paragraph. ' : 'The title field is omitted. ') + 'Body headings keep levels 1 through 6 in Word.';
  if (destination === 'html') return (includeTitle ? 'The title is included as an H1 heading. ' : 'The title field is omitted. ') + 'Body H1 headings become H2 in the HTML fragment.';
  return 'WordPress uses its separate post title field. Body H1 headings become H2.';
}

export function exportReviewText(draft, options = {}) {
  const review = reviewExport(draft, options), destination = options.destination || 'wordpress';
  const name = { wordpress: 'WordPress', word: 'Word document', html: 'HTML source' }[destination];
  return [
    'Draft to Page: ' + name + ' formatting review', '', exportTitleHandling({ ...options, destination }), '',
    'Limited formatting and writing-pattern checks. No fact-checking, grammar checking, permissions review, image loading, or URL verification.',
    review.totalFindings ? review.totalFindings + ' item(s) to inspect.' : 'No items found by these limited checks. This does not certify the article.',
    ...(review.truncated ? ['Showing the first ' + EXPORT_REVIEW_LIMIT + ' findings. Inspect the complete article.'] : []), '',
    ...review.findings.map(item => 'Line ' + item.line + ': ' + item.message), '',
    'Open the actual exported file or paste into the destination editor. Inspect headings, lists, tables, links, images, literal Markdown, and title handling before sharing.',
    'Source notes, private review notes, revision history, and export approval are excluded. Article text can still contain private information.'
  ].join('\n') + '\n';
}
