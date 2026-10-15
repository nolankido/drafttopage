import { wordImagePartName } from './docx-archive.js';

const DRAWING = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const WP = 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing';
const PICTURE = 'http://schemas.openxmlformats.org/drawingml/2006/picture';
const OFFICE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const VML = 'urn:schemas-microsoft-com:vml';
const TYPES = 'http://schemas.openxmlformats.org/package/2006/content-types';
const elements = node => Array.from(node?.childNodes || []).filter(child => child.nodeType === 1);

export function wordImageReference(node, relationships, types, index) {
  const record = { index, placeholder: '[Word image ' + index + ']', part: '', mime: '', alt: '', altTruncated: false, reason: '' };
  if (node.localName === 'object') return { ...record, reason: 'Embedded objects are not image files in this recovery workflow.' };
  const references = [], descriptions = [];
  const stack = [node];
  while (stack.length) {
    const current = stack.pop();
    if (current.namespaceURI === DRAWING && current.localName === 'blip') references.push({ id: current.getAttributeNS(OFFICE, 'embed'), linked: current.getAttributeNS(OFFICE, 'link') });
    if (current.namespaceURI === VML && current.localName === 'imagedata') references.push({ id: current.getAttributeNS(OFFICE, 'id'), linked: current.getAttribute('src') });
    if (current.namespaceURI === WP && current.localName === 'docPr' || current.namespaceURI === PICTURE && current.localName === 'cNvPr') {
      const value = current.getAttribute('descr') || current.getAttribute('title');
      if (value) descriptions.push(value.replace(/\s+/g, ' ').trim());
    }
    stack.push(...elements(current).reverse());
  }
  const alt = descriptions.find(Boolean) || '';
  record.alt = alt.slice(0, 500); record.altTruncated = alt.length > 500;
  if (references.length !== 1) return { ...record, reason: 'This drawing has no single supported image reference. Inspect it in Word.' };
  const reference = references[0], relationship = relationships.get(reference.id);
  if (!reference.id || !relationship || relationship.type !== OFFICE + '/image') return { ...record, reason: reference.linked ? 'Linked images are not fetched. Add this image yourself in WordPress.' : 'The image relationship is missing or unsupported.' };
  if (relationship.mode && relationship.mode !== 'Internal') return { ...record, reason: 'External image relationships are not fetched.' };
  const target = relationship.target || '';
  const part = target.startsWith('/word/media/') ? target.slice(1) : target.startsWith('media/') ? 'word/' + target : '';
  if (!wordImagePartName(part)) return { ...record, reason: 'Only ordinary embedded PNG and JPEG files can be recovered.' };
  const declarations = elements(types);
  const overrides = declarations.filter(n => n.namespaceURI === TYPES && n.localName === 'Override' && n.getAttribute('PartName') === '/' + part);
  const extension = part.split('.').pop().toLowerCase();
  const defaults = declarations.filter(n => n.namespaceURI === TYPES && n.localName === 'Default' && (n.getAttribute('Extension') || '').toLowerCase() === extension);
  if (overrides.length > 1 || !overrides.length && defaults.length !== 1) return { ...record, reason: 'The image content type is missing or ambiguous.' };
  const mime = (overrides[0] || defaults[0]).getAttribute('ContentType');
  if (mime !== (extension === 'png' ? 'image/png' : 'image/jpeg')) return { ...record, reason: 'The image filename and declared content type do not agree.' };
  return { ...record, part, mime };
}
