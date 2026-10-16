// Read bounded selected parts of a Word ZIP. Ordinary import reads only XML.
import { crc32 } from './zip.js';

export const MAX_DOCX_BYTES = 8 * 1024 * 1024;
const MAX_EXPANDED = 32 * 1024 * 1024, MAX_PART = 2 * 1024 * 1024;
export const DOCX_XML_PARTS = Object.freeze(['[Content_Types].xml', '_rels/.rels', 'word/document.xml', 'word/_rels/document.xml.rels', 'word/styles.xml', 'word/numbering.xml', 'word/footnotes.xml', 'word/_rels/footnotes.xml.rels', 'word/endnotes.xml', 'word/_rels/endnotes.xml.rels']);
const invalid = () => new Error('This Word archive is damaged or uses unsupported ZIP features. Save a new .docx or import a formatted selection.');

export function inspectDocxArchive(input) {
  const bytes = input instanceof Uint8Array ? input : input instanceof ArrayBuffer ? new Uint8Array(input) : null;
  if (!bytes || bytes.length < 22 || bytes.length > MAX_DOCX_BYTES) throw new Error('Choose a .docx file no larger than 8 MiB.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const u16 = p => view.getUint16(p, true), u32 = p => view.getUint32(p, true);
  let end = -1;
  for (let p = bytes.length - 22; p >= Math.max(0, bytes.length - 65557); p--) {
    if (u32(p) === 0x06054b50 && p + 22 + u16(p + 20) === bytes.length) { end = p; break; }
  }
  if (end < 0 || u16(end + 4) || u16(end + 6) || u16(end + 8) !== u16(end + 10)) throw invalid();
  const count = u16(end + 10), directory = u32(end + 16), size = u32(end + 12);
  if (!count || count > 256 || directory + size !== end) throw invalid();
  const nameAt = (p, length) => {
    if (!length || p + length > end) throw invalid();
    const name = new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(p, p + length));
    if (!/^[\x20-\x7e]+$/.test(name) || /[\\:%?#]/.test(name) || name.startsWith('/') || name.split('/').some((v, i, a) => v === '.' || v === '..' || (!v && i !== a.length - 1))) throw invalid();
    return name;
  };
  function extra(p, length) {
    const stop = p + length;
    while (p < stop) { if (p + 4 > stop || p + 4 + u16(p + 2) > stop || u16(p) === 1) throw invalid(); p += 4 + u16(p + 2); }
  }
  const entries = [], names = new Set(); let p = directory, expanded = 0;
  for (let i = 0; i < count; i++) {
    if (p + 46 > end || u32(p) !== 0x02014b50) throw invalid();
    const flags = u16(p + 8), method = u16(p + 10), crc = u32(p + 16), compressed = u32(p + 20), length = u32(p + 24);
    const nl = u16(p + 28), el = u16(p + 30), cl = u16(p + 32), offset = u32(p + 42);
    if (p + 46 + nl + el + cl > end || flags & ~0x080e || ![0, 8].includes(method) || u16(p + 34) || offset >= directory || length === 0xffffffff || compressed === 0xffffffff || ((u32(p + 38) >>> 16) & 0xf000) === 0xa000) throw invalid();
    const name = nameAt(p + 46, nl), key = name.toLowerCase();
    if (names.has(key) || (method === 0 && compressed !== length) || (name.endsWith('/') && (length || compressed))) throw invalid();
    if (/vbaProject|\.docm$|\.dotm$/i.test(name)) throw new Error('Macro-enabled Word documents are not supported. Save a plain .docx first.');
    names.add(key); expanded += length;
    if (length > MAX_EXPANDED || expanded > MAX_EXPANDED) throw new Error('This Word document expands beyond the 32 MiB import limit. Use a smaller document.');
    if (DOCX_XML_PARTS.includes(name) && length > MAX_PART) throw new Error('A Word XML part exceeds the 2 MiB limit. Use a smaller document.');
    extra(p + 46 + nl, el);
    if (offset + 30 > directory || u32(offset) !== 0x04034b50 || u16(offset + 6) !== flags || u16(offset + 8) !== method) throw invalid();
    const lnl = u16(offset + 26), lel = u16(offset + 28), start = offset + 30 + lnl + lel;
    if (start + compressed > directory || nameAt(offset + 30, lnl) !== name) throw invalid();
    extra(offset + 30 + lnl, lel);
    for (const [at, expected] of [[14, crc], [18, compressed], [22, length]]) if (u32(offset + at) !== expected && (!(flags & 8) || u32(offset + at) !== 0)) throw invalid();
    let stop = start + compressed;
    if (flags & 8) {
      if (stop + 12 > directory) throw invalid();
      if (u32(stop) === 0x08074b50) stop += 4;
      if (stop + 12 > directory || u32(stop) !== crc || u32(stop + 4) !== compressed || u32(stop + 8) !== length) throw invalid();
      stop += 12;
    }
    entries.push({ name, method, crc, length, compressed, start, stop, offset }); p += 46 + nl + el + cl;
  }
  if (p !== end) throw invalid();
  let boundary = 0;
  for (const entry of [...entries].sort((a, b) => a.offset - b.offset)) { if (entry.offset !== boundary) throw invalid(); boundary = entry.stop; }
  if (boundary !== directory) throw invalid();
  for (const name of DOCX_XML_PARTS.slice(0, 3)) if (!names.has(name.toLowerCase()) || !entries.some(e => e.name === name)) throw new Error('Choose a standard .docx with its main document at word/document.xml.');
  if (entries.filter(e => DOCX_XML_PARTS.includes(e.name)).reduce((n, e) => n + e.length, 0) > 4 * 1024 * 1024) throw new Error('The selected Word XML exceeds the 4 MiB limit.');
  return { bytes, entries };
}

export async function readDocxXML(input) {
  const { bytes, entries } = inspectDocxArchive(input), parts = new Map();
  for (const entry of entries.filter(e => DOCX_XML_PARTS.includes(e.name))) {
    const content = await readEntry(bytes, entry, MAX_PART);
    let text;
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(content); }
    catch { throw new Error('The Word XML must use UTF-8. Save a new .docx or use formatted import.'); }
    if (/<!DOCTYPE|<!ENTITY/i.test(text) || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text)) throw invalid();
    parts.set(entry.name, text);
  }
  return parts;
}

async function readEntry(bytes, entry, limit) {
  if (!entry || entry.length > limit) throw new Error('This Word part exceeds the supported recovery limit.');
  // Data descriptors belong to the archive, not the compressed payload.
  const source = bytes.subarray(entry.start, entry.start + entry.compressed);
  let content;
  if (!entry.method) content = source;
  else {
    let stream;
    try { stream = new Blob([source]).stream().pipeThrough(new DecompressionStream('deflate-raw')); }
    catch { throw new Error('This browser cannot decompress Word files. Copy a formatted selection from Word instead.'); }
    const reader = stream.getReader(), chunks = []; let total = 0;
    try {
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        total += value.byteLength;
        if (total > entry.length || total > limit) { await reader.cancel(); throw invalid(); }
        chunks.push(value);
      }
    } catch { await reader.cancel().catch(() => {}); throw invalid(); }
    content = new Uint8Array(total); let at = 0;
    for (const chunk of chunks) { content.set(chunk, at); at += chunk.byteLength; }
  }
  if (content.length !== entry.length || crc32(content) !== entry.crc) throw invalid();
  return content;
}

// Comment XML is read only by the explicit private-feedback recovery action.
export async function readDocxCommentXML(input) {
  const { bytes, entries } = inspectDocxArchive(input);
  const selected = entries.filter(entry => ['[Content_Types].xml', 'word/_rels/document.xml.rels', 'word/comments.xml'].includes(entry.name));
  if (selected.reduce((total, entry) => total + entry.length, 0) > 4 * 1024 * 1024) throw new Error('The selected comment XML exceeds the 4 MiB recovery limit.');
  const parts = new Map();
  for (const entry of selected) {
    const raw = await readEntry(bytes, entry, MAX_PART);
    let text;
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(raw); }
    catch { throw new Error('Word comments must use valid UTF-8 XML.'); }
    parts.set(entry.name, text);
  }
  return parts;
}
export const MAX_WORD_IMAGE_BYTES = 4 * 1024 * 1024;
export const wordImagePartName = name => typeof name === 'string' && /^word\/media\/[a-z0-9][a-z0-9._-]{0,120}\.(?:png|jpe?g)$/i.test(name) && !name.includes('..');
// Called only by the explicit image-recovery action, never by ordinary import.
export async function readDocxImagePart(input, name) {
  if (!wordImagePartName(name)) throw new Error('Only embedded PNG and JPEG image parts can be recovered.');
  const { bytes, entries } = inspectDocxArchive(input);
  const entry = entries.find(item => item.name === name);
  if (!entry) throw new Error('The referenced image file is missing from this Word document.');
  return readEntry(bytes, entry, MAX_WORD_IMAGE_BYTES);
}
