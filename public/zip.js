// A small deterministic ZIP writer: stored UTF-8 text, fixed safe names, no dependencies.
// No archive input, filesystem paths, executable entries, encryption, or ZIP64.
import { MAX_ZIP_BYTES } from './writing-limits.js';
export { MAX_ZIP_BYTES };
const encoder = new TextEncoder();
const table = Array.from({ length: 256 }, (_, i) => {
  let crc = i;
  for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  return crc >>> 0;
});
export function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = table[(crc ^ byte) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
export function createZip(entries) {
  if (!Array.isArray(entries) || !entries.length || entries.length > 8) throw new Error('A publishing ZIP supports one to eight files.');
  const seen = new Set(); let total = 22;
  const files = entries.map(entry => {
    if (!entry || typeof entry.name !== 'string' || !/^[a-z0-9][a-z0-9._-]{0,100}\.(?:md|html|json|txt)$/i.test(entry.name) || entry.name.includes('..') || /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])\./i.test(entry.name) || seen.has(entry.name.toLowerCase())) throw new Error('The publishing ZIP has an unsafe or duplicate filename.');
    if (typeof entry.content !== 'string') throw new Error('The publishing ZIP accepts text files only.');
    // Bound input before allocating encoded bytes.
    if (entry.content.length > MAX_ZIP_BYTES) throw new Error('The publishing ZIP exceeds its 4 MiB limit.');
    seen.add(entry.name.toLowerCase());
    const name = encoder.encode(entry.name), content = encoder.encode(entry.content);
    total += 30 + 46 + name.length * 2 + content.length;
    if (total > MAX_ZIP_BYTES) throw new Error('The publishing ZIP exceeds its 4 MiB limit.');
    return { name, content, crc: crc32(content) };
  });
  const output = new Uint8Array(total), view = new DataView(output.buffer);
  let offset = 0;
  for (const file of files) {
    file.offset = offset;
    view.setUint32(offset, 0x04034b50, true); view.setUint16(offset + 4, 20, true);
    view.setUint16(offset + 6, 0x800, true); view.setUint16(offset + 12, 0x21, true);
    view.setUint32(offset + 14, file.crc, true);
    view.setUint32(offset + 18, file.content.length, true); view.setUint32(offset + 22, file.content.length, true);
    view.setUint16(offset + 26, file.name.length, true);
    output.set(file.name, offset + 30); output.set(file.content, offset + 30 + file.name.length);
    offset += 30 + file.name.length + file.content.length;
  }
  const directory = offset;
  for (const file of files) {
    view.setUint32(offset, 0x02014b50, true); view.setUint16(offset + 4, 20, true); view.setUint16(offset + 6, 20, true);
    view.setUint16(offset + 8, 0x800, true); view.setUint16(offset + 14, 0x21, true);
    view.setUint32(offset + 16, file.crc, true);
    view.setUint32(offset + 20, file.content.length, true); view.setUint32(offset + 24, file.content.length, true);
    view.setUint16(offset + 28, file.name.length, true); view.setUint32(offset + 42, file.offset, true);
    output.set(file.name, offset + 46); offset += 46 + file.name.length;
  }
  view.setUint32(offset, 0x06054b50, true);
  view.setUint16(offset + 8, files.length, true); view.setUint16(offset + 10, files.length, true);
  view.setUint32(offset + 12, offset - directory, true); view.setUint32(offset + 16, directory, true);
  return output;
}
