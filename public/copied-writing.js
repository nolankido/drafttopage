import { MAX_IMPORT_BYTES, parseArticleImport } from './article-import.js';
import { markdownFromInline } from './inline-markdown.js';

function checked(text) {
  if (typeof text !== 'string' || text.length > MAX_IMPORT_BYTES || new TextEncoder().encode(text).byteLength > MAX_IMPORT_BYTES) throw new Error('The copied selection exceeds 512 KiB. Copy a smaller section. Current writing and any previous preview are kept.');
  if (!text.trim()) throw new Error('The clipboard did not provide copied writing. Copy a text selection, then paste again. Current writing and any previous preview are kept.');
  return text;
}
// Read only data attached to this user-initiated paste event. No clipboard API.
export function copiedWritingSource(clipboard) {
  if (!clipboard || typeof clipboard.getData !== 'function') throw new Error('This browser did not provide clipboard data. Paste text manually or open a Word .docx instead.');
  let html, plain;
  try { html = clipboard.getData('text/html'); if (!html) plain = clipboard.getData('text/plain'); }
  catch { throw new Error('Copied writing could not be read. Current writing and any previous preview are kept. Try a Word .docx instead.'); }
  return { format: html ? 'html' : 'plain', text: checked(html || plain) };
}
export function parseCopiedWriting(source, options = {}) {
  if (!source || !['html', 'plain'].includes(source.format)) throw new Error('Choose a supported copied selection.');
  const raw = checked(source.text);
  // The editor stores Markdown, but a plain clipboard selection has no authored
  // Markdown semantics. Escape through the current bounded inline serializer
  // before import can interpret headings, page details, or reply code fences.
  const text = source.format === 'plain' ? markdownFromInline([{ type: 'text', text: raw.replace(/\r\n?/g, '\n') }]).markdown : raw;
  const result = parseArticleImport(text, '', source.format === 'html' ? 'html' : 'markdown', options);
  return { ...result, kind: source.format === 'html' ? 'Copied formatted writing' : 'Copied plain text', requiresAck: true,
    warnings: source.format === 'html' ? result.warnings : ['Only plain text was supplied. Punctuation stays literal; Markdown and page details are not interpreted. Missing source formatting cannot be recovered. Copy again with formatting, or choose Markdown in Import format for intentional Markdown.', ...result.warnings] };
}
