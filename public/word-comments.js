import { readDocxCommentXML } from './docx-archive.js';
import { parseWordXML, WORD_NS } from './docx-import.js';
import { WORD_COMMENT_GUIDANCE as guidance } from './word-comment-report.js';

const R = 'http://schemas.openxmlformats.org/package/2006/relationships';
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments';
const T = 'http://schemas.openxmlformats.org/package/2006/content-types';
const TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml';
export const WORD_COMMENT_LIMIT = 100, WORD_COMMENT_TEXT_LIMIT = 4000, WORD_COMMENT_TOTAL_LIMIT = 100000;
const elements = node => Array.from(node?.childNodes || []).filter(n => n.nodeType === 1);
const is = (node, name) => node?.namespaceURI === WORD_NS && node.localName === name;
const fail = detail => { throw new Error('Word comment recovery: ' + detail + ' The article preview is kept. Review the comments in the original Word file.'); };

// Detached XML only. No source element or relationship URL enters the page.
export function wordCommentTrees(parts) {
  let nodes = 0;
  for (const root of parts.values()) {
    const stack = [[root, 0]];
    while (stack.length) {
      const [node, depth] = stack.pop();
      if (++nodes > 30000 || depth > 40) fail('the XML is too complex.');
      if (node.namespaceURI === WORD_NS && (/^(?:(?:customXml|conflict)?(?:ins|del|moveFrom|moveTo)(?:RangeStart|RangeEnd)?|cellIns|cellDel|cellMerge)$/i.test(node.localName) || node.localName.endsWith('PrChange') || node.localName === 'numberingChange')) fail('resolve tracked changes in comments first.');
      for (const next of elements(node)) stack.push([next, depth + 1]);
    }
  }
  const types = parts.get('[Content_Types].xml'), links = parts.get('word/_rels/document.xml.rels'), root = parts.get('word/comments.xml');
  if (types?.namespaceURI !== T || types.localName !== 'Types') fail('invalid content types.');
  if (links && (links.namespaceURI !== R || links.localName !== 'Relationships')) fail('invalid document relationships.');
  const relationshipNodes = elements(links), ids = new Set();
  for (const node of relationshipNodes) {
    const id = node.getAttribute('Id');
    if (node.namespaceURI !== R || node.localName !== 'Relationship' || !id || ids.has(id)) fail('ambiguous relationships.');
    ids.add(id);
  }
  const matches = relationshipNodes.filter(node => node.getAttribute('Type') === REL);
  const declarations = elements(types).filter(node => node.namespaceURI === T && node.localName === 'Override' && node.getAttribute('PartName') === '/word/comments.xml');
  if (!root && !matches.length && !declarations.length) return { comments: [], guidance };
  if (!is(root, 'comments') || matches.length !== 1 || !['comments.xml', '/word/comments.xml'].includes(matches[0].getAttribute('Target')) || ![null, '', 'Internal'].includes(matches[0].getAttribute('TargetMode')) || declarations.length !== 1 || declarations[0].getAttribute('ContentType') !== TYPE) fail('the standard comments part is missing or ambiguous.');
  const comments = [], commentIds = new Set(); let total = 0;
  function inline(node) {
    if (node.namespaceURI !== WORD_NS) fail('non-text content cannot be recovered.');
    const name = node.localName;
    if (['rPr', 'bookmarkStart', 'bookmarkEnd', 'proofErr', 'annotationRef', 'lastRenderedPageBreak'].includes(name)) return '';
    if (name === 't') { if (elements(node).length) fail('text contains unsupported elements.'); return node.textContent; }
    if (name === 'tab') return '\t';
    if (['br', 'cr'].includes(name)) return '\n';
    if (name === 'noBreakHyphen') return '\u2011';
    if (name === 'softHyphen') return '\u00ad';
    if (['r', 'hyperlink'].includes(name)) return elements(node).map(inline).join('');
    fail('fields, tracked changes, drawings, and complex comment content need review in Word.');
  }
  for (const node of elements(root)) {
    const id = node.getAttributeNS(WORD_NS, 'id');
    if (!is(node, 'comment') || !/^(?:0|[1-9]\d{0,8})$/.test(id || '') || commentIds.has(id)) fail('comment identifiers are missing, duplicate, or unsupported.');
    commentIds.add(id);
    if (commentIds.size > WORD_COMMENT_LIMIT) fail('use at most 100 comments.');
    const paragraphs = elements(node);
    if (!paragraphs.length || paragraphs.length > 10 || paragraphs.some(p => !is(p, 'p'))) fail('each comment needs one to ten ordinary paragraphs.');
    const text = paragraphs.map(p => elements(p).filter(n => !is(n, 'pPr')).map(inline).join('')).join('\n\n');
    if (!text.trim() || text.length > WORD_COMMENT_TEXT_LIMIT || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text)) fail('each comment needs nonempty text within 4,000 characters. Nothing was truncated.');
    total += text.length;
    if (total > WORD_COMMENT_TOTAL_LIMIT) fail('comment text exceeds 100,000 characters. Nothing was truncated.');
    comments.push({ id, text });
  }
  return { comments, guidance };
}

export async function prepareWordComments(bytes) {
  const raw = await readDocxCommentXML(bytes), parts = new Map();
  for (const [name, text] of raw) parts.set(name, parseWordXML(text));
  return wordCommentTrees(parts);
}
