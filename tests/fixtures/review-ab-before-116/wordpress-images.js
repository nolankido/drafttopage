import { articleStructure } from './draft-review.js';
import { inlineTokens, walkInlineTokens, decodeMarkdownEscapes, safeWebLink } from './markdown-inline.js';
import { previewBlocks } from './preview.js';

export const IMAGE_REVIEW_LIMIT = 40;
export function safeImageLink(target) {
  const url = safeWebLink(target);
  return url && url.startsWith('https://') ? url : null;
}

/** Only a complete, standalone image paragraph qualifies. Never repair a URL. */
export function standaloneWordPressImage(text) {
  if (typeof text !== 'string') return null;
  const line = text.endsWith('\r') ? text.slice(0, -1) : text;
  if (/[\r\n\u0000]/.test(line) || /^(?: {4}|\t)/.test(line)) return null;
  const value = line.replace(/^ {0,3}/, '').replace(/[ \t]+$/, ''), tokens = inlineTokens(value);
  if (tokens.length !== 1 || tokens[0].type !== 'image' || tokens[0].start !== 0 || tokens[0].end !== value.length) return null;
  const image = tokens[0];
  return { alt: decodeMarkdownEscapes(image.text), target: image.target, url: safeImageLink(image.target) };
}

export function analyzeWordPressImages(body) {
  if (typeof body === 'string' && body.includes('\u0000')) throw new Error('Remove null characters before preparing images.');
  const images = [];
  for (const section of articleStructure(body)) {
    if (section.kind === 'code') continue;
    const standalone = section.kind === 'paragraph' ? standaloneWordPressImage(section.text) : null;
    for (const token of walkInlineTokens(inlineTokens(section.text))) {
      if (token.type !== 'image') continue;
      const start = section.contentStart + token.start, end = section.contentStart + token.end;
      const url = safeImageLink(token.target), eligible = Boolean(standalone?.url);
      images.push({ start, end, line: section.line + (section.text.slice(0, token.start).match(/\n/g) || []).length,
        alt: decodeMarkdownEscapes(token.text), target: token.target, url, eligible,
        reason: !url ? 'Use an absolute HTTPS image URL without credentials, spaces, or quoted titles.' : !standalone ? 'Place this image alone in its own paragraph, outside headings, lists, quotes, tables, links, and code.' : '',
        paragraphStart: section.start, paragraphEnd: section.end });
    }
  }
  return images;
}

/** Split at validated raw-source paragraphs before the reading parser normalizes CRs. */
export function wordPressImageBlocks(body) {
  const images = analyzeWordPressImages(body).filter(image => image.eligible), result = [];
  let offset = 0;
  for (const image of images) {
    result.push(...previewBlocks(body.slice(offset, image.paragraphStart)), { type: 'linked-image', ...image });
    offset = image.paragraphEnd;
  }
  result.push(...previewBlocks(body.slice(offset)));
  return result;
}

export function wordPressImagePlan(body, { includeLinkedImages = false } = {}) {
  if (typeof includeLinkedImages !== 'boolean') throw new Error('Choose whether to prepare linked images.');
  const images = analyzeWordPressImages(body), eligible = images.filter(image => image.eligible).length;
  return ['Draft to Page: WordPress image handoff', '',
    images.length + ' recognized image reference(s); ' + (includeLinkedImages ? eligible : 0) + ' linked Image block(s) selected.',
    'No image was fetched, uploaded, embedded as file bytes, or checked for availability or permission.',
    'Linked images will request their HTTPS URLs when opened in WordPress or a browser. A URL is not a Media Library upload.',
    'Reading HTML, Word, formatted copies, and other exports keep image syntax as text. Original Markdown keeps the references.', '',
    ...images.flatMap(image => ['Line ' + image.line + ': ' + (includeLinkedImages && image.eligible ? 'Linked Image block' : 'Literal Markdown text'),
      'Alt text: ' + (image.alt || '(empty; review whether this image is decorative)'), 'Reference: ' + image.target,
      ...(image.reason ? ['Action: ' + image.reason] : []), '']),
    'In WordPress: inspect every image and its alternative text. Use only images you have permission to publish.',
    'Use Upload to Media Library when you want a copy stored on your site, then check the actual post and mobile preview.',
    'Source notes, private review questions, and revision history are excluded.'
  ].join('\n') + '\n';
}
