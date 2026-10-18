import { inspectDocxArchive, readDocxImagePart, wordImagePartName, MAX_WORD_IMAGE_BYTES } from './docx-archive.js';
import { createWordImageZip } from './zip.js';
import { wordImageMetadataSignals } from './word-image-metadata.js';

export const MAX_WORD_IMAGE_FILES = 40;
export const MAX_WORD_IMAGE_TOTAL = 12 * 1024 * 1024;
const MAX_PIXELS = 40_000_000;

// Recognize dimensions without decoding, rendering, fetching, or rewriting pixels.
export function wordImageDimensions(bytes, mime) {
  if (!(bytes instanceof Uint8Array) || bytes.length > MAX_WORD_IMAGE_BYTES) throw new Error('The image exceeds the 4 MiB per-file limit.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let width = 0, height = 0;
  if (mime === 'image/png') {
    const signature = [137,80,78,71,13,10,26,10];
    if (bytes.length < 45 || !signature.every((v,i) => bytes[i] === v) || view.getUint32(8) !== 13 || String.fromCharCode(...bytes.subarray(12,16)) !== 'IHDR') throw new Error('This file is not a recognized PNG image.');
    width = view.getUint32(16); height = view.getUint32(20);
    let at = 8, ended = false, data = false;
    while (at + 12 <= bytes.length) {
      const length = view.getUint32(at), tag = String.fromCharCode(...bytes.subarray(at+4,at+8));
      if (length > bytes.length - at - 12 || !/^[A-Za-z]{4}$/.test(tag)) throw new Error('The PNG chunk structure is damaged.');
      if (tag === 'IDAT') data = true;
      at += 12 + length;
      if (tag === 'IEND') { ended = length === 0 && at === bytes.length; break; }
    }
    if (!ended || !data) throw new Error('The PNG is incomplete or has trailing data.');
  } else if (mime === 'image/jpeg') {
    if (bytes.length < 10 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[bytes.length-2] !== 0xff || bytes[bytes.length-1] !== 0xd9) throw new Error('This file is not a recognized JPEG image.');
    let at = 2;
    while (at < bytes.length - 2) {
      if (bytes[at++] !== 0xff) throw new Error('The JPEG header is damaged.');
      while (bytes[at] === 0xff) at++;
      const marker = bytes[at++];
      if (marker === 0xda || marker === 0xd9) break;
      if (marker === 0x01 || marker >= 0xd0 && marker <= 0xd7) continue;
      if (at + 2 > bytes.length) throw new Error('The JPEG header is incomplete.');
      const length = view.getUint16(at);
      if (length < 2 || at + length > bytes.length) throw new Error('The JPEG header is incomplete.');
      if ([0xc0,0xc1,0xc2].includes(marker)) {
        if (length < 8 || width) throw new Error('Unsupported JPEG frame structure.');
        height = view.getUint16(at+3); width = view.getUint16(at+5);
      }
      at += length;
    }
  } else throw new Error('Only PNG and JPEG images are supported.');
  if (!width || !height || width > 20000 || height > 20000 || width * height > MAX_PIXELS) throw new Error('Image dimensions are unsupported or exceed 40 million pixels.');
  return { width, height };
}

export async function prepareWordImageKit(input, candidate) {
  if (candidate?.kind !== 'Word document' || typeof candidate.draft?.body !== 'string' || candidate.draft.body.length > 60000 || !Array.isArray(candidate.wordImages) || !candidate.wordImages.length || candidate.wordImages.length > 200) throw new Error('Preview a Word document with image placeholders first.');
  const archive = inspectDocxArchive(input);
  const entries = new Map(archive.entries.map(entry => [entry.name, entry]));
  const parts = new Map(), files = [], placements = [], skipped = []; let total = 0;
  for (const record of candidate.wordImages) {
    if (!record || !Number.isInteger(record.index) || record.index < 1 || record.index > 200 || record.placeholder !== '[Word image ' + record.index + ']' || typeof record.alt !== 'string' || record.alt.length > 500) throw new Error('The Word image map is invalid. Preview the document again.');
    const placement = { placeholder: record.placeholder, filename: '', alt: record.alt, altTruncated: Boolean(record.altTruncated), note: '' };
    placements.push(placement);
    if (record.reason || !wordImagePartName(record.part)) { placement.note = record.reason || 'This image part is unsupported.'; skipped.push(placement); continue; }
    if (!parts.has(record.part)) {
      let file, error = '';
      const entry = entries.get(record.part);
      try {
        if (!entry) throw new Error('The referenced image file is missing.');
        if (files.length >= MAX_WORD_IMAGE_FILES) throw new Error('Only the first 40 supported image files are recovered.');
        if (entry.length > MAX_WORD_IMAGE_BYTES) throw new Error('This image exceeds the 4 MiB per-file limit.');
        if (total + entry.length > MAX_WORD_IMAGE_TOTAL) throw new Error('This image would exceed the 12 MiB combined image limit.');
        const content = await readDocxImagePart(input, record.part);
        const dimensions = wordImageDimensions(content, record.mime);
        const metadataSignals = wordImageMetadataSignals(content, record.mime);
        file = { metadataSignals, name: 'word-image-' + String(record.index).padStart(3, '0') + (record.mime === 'image/png' ? '.png' : '.jpg'), content, ...dimensions };
        total += content.length; files.push(file);
      } catch (failure) { error = failure.message || 'This image could not be read.'; }
      parts.set(record.part, { file, error });
    }
    const result = parts.get(record.part);
    if (result.error) { placement.note = result.error; skipped.push(placement); }
    else { placement.filename = result.file.name; placement.note = 'Original image file. Review alt text and placement in WordPress.'; }
  }
  const images = files.map(({ name, content, width, height }) => ({ name, bytes: content.length, width, height, placeholders: placements.filter(p => p.filename === name).map(p => p.placeholder) }));
  const metadata = files.filter(file => file.metadataSignals.length).map(file => ({ name: file.name, signals: [...file.metadataSignals] }));
  if (!files.length) return { bytes: null, filename: '', images, placements, skipped, metadata };
  const map = JSON.stringify({ format: 'drafttopage-word-images-v1', placementScope: 'This selected Word import before later edits or insertion into another article.', images, placements }, null, 2) + '\n';
  const instructions = [
    'WORD IMAGES FOR A MANUAL WORDPRESS HANDOFF',
    '',
    'LOCAL METADATA MARKER REVIEW',
    metadata.length ? metadata.length + ' recovered image file(s) contain recognized metadata segment types.' : 'No recognized EXIF or text-metadata segments were found. This does not establish that the images contain no metadata.',
    ...metadata.flatMap(item => [item.name + ': ' + item.signals.join(', ')]),
    'These are marker names only. The contents of metadata and any GPS/location details were not decoded, shown, or removed. Detection is not exhaustive.',
    'The recovered image files are the ORIGINAL BYTES. Inspect the images and remove metadata yourself if necessary before uploading or sharing them.',
    '',
    'This ZIP contains original embedded PNG/JPEG files, the converted article body, and image-map.json. It excludes private workspace source/review notes. Keep the files private until ready to publish.',
    '',
    '1. Extract this ZIP on your device. Inspect every recovered image.',
    '2. Import the article in Draft to Page, review it, and take its blocks into a new WordPress draft.',
    '3. Upload each numbered image file to your WordPress Media Library.',
    '4. Find each [Word image N] placeholder. Use image-map.json to choose its file and review the alternative text supplied in Word. A repeated image can use the same uploaded file.',
    '5. Replace the placeholder with an Image block. Add captions or layout in WordPress. Preview before publishing.',
    'Alternative: replace placeholders in Draft to Page before exporting. Open Add or edit image, then Match a downloaded Word image package. Select this image-map.json, pin the current placeholder, compare the entry and original Word document, and explicitly reuse reviewed alternative text. Enter the uploaded HTTPS image URL yourself, preview and apply each change, then separately choose linked Image blocks for WordPress.',
    '',
    'The article-body.md and placeholder map describe this import, not later article edits or combined documents. Use the original Word document to recheck positions.',
    'Recovery maps the first 200 visible image/object positions and up to 40 unique supported files, each at most 4 MiB and together at most 12 MiB. Additional positions need manual handling.',
    'Original bytes are preserved, including possible image metadata and portions hidden by Word cropping. Word crops, rotation, effects, document layout, and image captions are not applied. Missing alt text needs your decision; empty text is not automatically treated as decorative.',
    'No image was displayed, uploaded, fetched from a link, re-encoded, or independently verified. PNG/JPEG signatures, dimensions, bounds, and archive checksums are checked; image content is not certified.',
    'Unsupported, missing, corrupted, or oversized images remain placeholders and are listed in image-map.json. Downloading does not add images to WordPress or publish a post.',
    '',
    'PLACEMENT NOTES',
    ...placements.flatMap(p => [p.placeholder + ': ' + (p.filename || 'NOT RECOVERED'), 'Word alternative text: ' + (p.alt || '[not supplied]') + (p.altTruncated ? ' [shortened to 500 characters; inspect Word]' : ''), p.note, ''])
  ].join('\n');
  const bytes = createWordImageZip([...files.map(({ name, content }) => ({ name, content })), { name: 'article-body.md', content: candidate.draft.body.trim() + '\n' }, { name: 'image-map.json', content: map }, { name: 'README.txt', content: instructions }]);
  return { bytes, filename: 'drafttopage-word-images.zip', images, placements, skipped, metadata, placementMap: map };
}
