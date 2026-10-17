// Inspect only known PNG/JPEG metadata segment types. Never decode values, pixel data,
// private text, location fields, or files from the web. This is not a sanitization step.
const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10];
const pngSignals = new Map([
  ['eXIf', 'PNG EXIF metadata'],
  ['tEXt', 'PNG text metadata'],
  ['zTXt', 'PNG compressed text metadata'],
  ['iTXt', 'PNG international text metadata']
]);
const error = () => new Error('Image metadata could not be inspected safely. The original image was not added to the package.');

export function wordImageMetadataSignals(bytes, mime) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 12 || bytes.length > 4 * 1024 * 1024) throw error();
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const found = new Set();
  if (mime === 'image/png') {
    if (!pngSignature.every((value, index) => bytes[index] === value)) throw error();
    let at = 8, ended = false;
    while (at + 12 <= bytes.length) {
      const size = view.getUint32(at), marker = String.fromCharCode(...bytes.subarray(at + 4, at + 8));
      if (size > bytes.length - at - 12 || !/^[A-Za-z]{4}$/.test(marker)) throw error();
      if (pngSignals.has(marker)) found.add(pngSignals.get(marker));
      at += size + 12;
      if (marker === 'IEND') { ended = at === bytes.length && size === 0; break; }
    }
    if (!ended) throw error();
  } else if (mime === 'image/jpeg') {
    if (bytes[0] !== 0xff || bytes[1] !== 0xd8) throw error();
    let at = 2;
    while (at < bytes.length - 2) {
      if (bytes[at++] !== 0xff) throw error();
      while (at < bytes.length && bytes[at] === 0xff) at++;
      if (at >= bytes.length) throw error();
      const marker = bytes[at++];
      if (marker === 0xda || marker === 0xd9) break; // Read header segments only, never compressed image data.
      if (marker === 0x01 || marker >= 0xd0 && marker <= 0xd7) continue;
      if (at + 2 > bytes.length) throw error();
      const size = view.getUint16(at);
      if (size < 2 || size > bytes.length - at) throw error();
      if (marker === 0xe1) {
        const prefix = bytes.subarray(at + 2, Math.min(at + size, at + 2 + 40));
        const starts = text => [...text].every((letter, i) => prefix[i] === letter.charCodeAt(0));
        found.add(starts('Exif\0\0') ? 'JPEG EXIF metadata' : starts('http://ns.adobe.com/xap/1.0/') ? 'JPEG XMP metadata' : 'JPEG APP1 metadata');
      }
      if (marker === 0xed) found.add('JPEG IPTC or Photoshop metadata');
      if (marker === 0xfe) found.add('JPEG comment metadata');
      at += size;
    }
  } else throw error();
  return [...found];
}

export function wordImageDownloadAllowed(kit, privateReviewed, metadataReviewed, busy = false) {
  return Boolean(!busy && kit?.bytes && privateReviewed && (!kit.metadata?.length || metadataReviewed));
}
