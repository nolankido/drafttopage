import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { crc32 } from '../public/zip.js';
import { wordImageMetadataSignals, wordImageDownloadAllowed } from '../public/word-image-metadata.js';
import { prepareWordImageKit } from '../public/word-image-kit.js';
import { parseWordImageMap } from '../public/word-image-map.js';
import { PNG, JPEG, imageFixture } from './word-image-fixtures.js';
import { python } from './docx-fixtures.js';

const encode = text => new TextEncoder().encode(text);
function addPNGChunk(original, name, payload) {
  const chunk = new Uint8Array(12 + payload.length), view = new DataView(chunk.buffer);
  view.setUint32(0, payload.length); chunk.set(encode(name), 4); chunk.set(payload, 8);
  view.setUint32(chunk.length - 4, crc32(chunk.subarray(4, chunk.length - 4)));
  const result = new Uint8Array(original.length + chunk.length);
  result.set(original.subarray(0, original.length - 12));
  result.set(chunk, original.length - 12);
  result.set(original.subarray(original.length - 12), original.length - 12 + chunk.length);
  return result;
}
function addJPEGSegment(original, marker, payload) {
  const segment = new Uint8Array(payload.length + 4), view = new DataView(segment.buffer);
  segment[0] = 0xff; segment[1] = marker; view.setUint16(2, payload.length + 2);
  segment.set(payload, 4);
  const result = new Uint8Array(original.length + segment.length);
  result.set(original.subarray(0, 2)); result.set(segment, 2); result.set(original.subarray(2), segment.length + 2);
  return result;
}
function kitFiles(bytes) {
  return python('import json,sys,io,zipfile\nwith zipfile.ZipFile(io.BytesIO(bytes(json.load(sys.stdin)))) as z:\n assert z.testzip() is None\n print(json.dumps({n:list(z.read(n)) for n in z.namelist()}))', Array.from(bytes));
}

test('PNG EXIF, text, compressed text and international text report marker types, not private values', () => {
  assert.deepEqual(wordImageMetadataSignals(PNG, 'image/png'), []);
  const marked = [
    ['tEXt', 'PNG text metadata'],
    ['zTXt', 'PNG compressed text metadata'],
    ['iTXt', 'PNG international text metadata'],
    ['eXIf', 'PNG EXIF metadata']
  ].reduce((bytes, [name]) => addPNGChunk(bytes, name, encode('PRIVATE_FICTIONAL_AUTHOR_LOCATION')), PNG);
  const signals = wordImageMetadataSignals(marked, 'image/png');
  assert.deepEqual(signals, ['PNG text metadata', 'PNG compressed text metadata', 'PNG international text metadata', 'PNG EXIF metadata']);
  assert.doesNotMatch(signals.join(' '), /PRIVATE_FICTIONAL/);
});

test('JPEG EXIF, XMP, APP13 and comments report only fixed segment names', () => {
  assert.deepEqual(wordImageMetadataSignals(JPEG, 'image/jpeg'), []);
  const marked = [
    [0xfe, 'PRIVATE_FICTIONAL_COMMENT'],
    [0xed, 'PRIVATE_FICTIONAL_IPTC'],
    [0xe1, 'http://ns.adobe.com/xap/1.0/\0PRIVATE_FICTIONAL_XMP'],
    [0xe1, 'Exif\0\0PRIVATE_FICTIONAL_EXIF']
  ].reduce((bytes, [marker, value]) => addJPEGSegment(bytes, marker, encode(value)), JPEG);
  assert.deepEqual(wordImageMetadataSignals(marked, 'image/jpeg'), [
    'JPEG EXIF metadata', 'JPEG XMP metadata', 'JPEG IPTC or Photoshop metadata', 'JPEG comment metadata'
  ]);
  assert.deepEqual(wordImageMetadataSignals(addJPEGSegment(JPEG, 0xe1, encode('unknown APP1')), 'image/jpeg'), ['JPEG APP1 metadata']);
});

test('Malformed marker framing or a nonimage input fail closed', () => {
  assert.throws(() => wordImageMetadataSignals('text', 'image/png'), /could not be inspected safely/);
  assert.throws(() => wordImageMetadataSignals(new Uint8Array(0), 'image/jpeg'), /could not be inspected safely/);
  assert.throws(() => wordImageMetadataSignals(PNG, 'image/svg+xml'), /could not be inspected safely/);
  const broken = addPNGChunk(PNG, 'tEXt', encode('test'));
  new DataView(broken.buffer).setUint32(PNG.length - 12, 0x7fffffff);
  assert.throws(() => wordImageMetadataSignals(broken, 'image/png'), /could not be inspected safely/);
  const brokenJPEG = addJPEGSegment(JPEG, 0xe1, encode('Exif\0\0'));
  new DataView(brokenJPEG.buffer).setUint16(4, 0xffff);
  assert.throws(() => wordImageMetadataSignals(brokenJPEG, 'image/jpeg'), /could not be inspected safely/);
});

test('Metadata review is a separate required acknowledgement only for flagged image packages', () => {
  const marked = { bytes: new Uint8Array([1]), metadata: [{ name: 'word-image-001.jpg', signals: ['JPEG EXIF metadata'] }] };
  const clean = { bytes: new Uint8Array([1]), metadata: [] };
  for (const item of [null, {}, { ...marked, bytes: null }]) assert.equal(wordImageDownloadAllowed(item, true, true), false);
  assert.equal(wordImageDownloadAllowed(marked, false, false), false);
  assert.equal(wordImageDownloadAllowed(marked, true, false), false);
  assert.equal(wordImageDownloadAllowed(marked, true, true), true);
  assert.equal(wordImageDownloadAllowed(marked, true, true, true), false);
  assert.equal(wordImageDownloadAllowed(clean, true, false), true);
  assert.equal(wordImageDownloadAllowed(clean, false, true), false);
});

test('Image ZIP preserves original marked bytes and unchanged version-1 placement map', async () => {
  const privateValue = 'PRIVATE_FICTIONAL_CAMERA_DETAILS';
  const image = addPNGChunk(PNG, 'tEXt', encode('Author\0' + privateValue));
  const { bytes, candidate } = imageFixture({
    ids: ['one', 'one'], media: { 'word/media/one.png': image }
  });
  const before = JSON.stringify(candidate);
  const prepared = await prepareWordImageKit(bytes, candidate);
  assert.equal(prepared.images.length, 1);
  assert.equal(prepared.metadata.length, 1);
  assert.deepEqual(prepared.metadata[0], { name: 'word-image-001.png', signals: ['PNG text metadata'] });
  assert.deepEqual(prepared.images[0].placeholders, ['[Word image 1]', '[Word image 2]']);
  const files = kitFiles(prepared.bytes);
  assert.deepEqual(files['word-image-001.png'], Array.from(image), 'Original image bytes were silently rewritten');
  const map = JSON.parse(new TextDecoder().decode(new Uint8Array(files['image-map.json'])));
  assert.deepEqual(Object.keys(map.images[0]).sort(), ['bytes', 'height', 'name', 'placeholders', 'width']);
  assert.equal(parseWordImageMap(JSON.stringify(map)).placements.length, 2);
  const readme = new TextDecoder().decode(new Uint8Array(files['README.txt']));
  assert.match(readme, /PNG text metadata/);
  assert.match(readme, /ORIGINAL BYTES/);
  assert.doesNotMatch(readme, /PRIVATE_FICTIONAL_CAMERA_DETAILS/);
  assert.equal(JSON.stringify(candidate), before, 'Image preparation mutated the source preview');
});

test('Unmarked images do not trigger a new gate and ordinary Word import remains unchanged', async () => {
  const { bytes, candidate } = imageFixture();
  const prepared = await prepareWordImageKit(bytes, candidate);
  assert.deepEqual(prepared.metadata, []);
  assert.equal(wordImageDownloadAllowed(prepared, true, false), true);
  assert.deepEqual(prepared.images.map(image => [image.width, image.height]), [[2, 3]]);
});

test('The metadata UI is explicit, offline, and closed when there are no detected markers', async () => {
  const panel = await readFile(new URL('../scripts/import-panel.html.inc', import.meta.url), 'utf8');
  const controller = await readFile(new URL('../public/import-controls.js', import.meta.url), 'utf8');
  const scanner = await readFile(new URL('../public/word-image-metadata.js', import.meta.url), 'utf8');
  const imageKit = await readFile(new URL('../public/word-image-kit.js', import.meta.url), 'utf8');
  for (const id of ['word-image-metadata-review', 'word-image-metadata-files', 'word-image-metadata-ok']) {
    assert.match(panel, new RegExp('id="' + id + '"'));
    assert.match(controller, new RegExp("'" + id + "'"));
  }
  assert.match(controller, /wordImageDownloadAllowed\(wordImageKit,/);
  assert.match(controller, /word-image-metadata-review'\)\.hidden = !/);
  assert.match(panel, /does not read the values, remove metadata, or guarantee/);
  assert.match(imageKit, /const metadata = files\.filter/);
  for (const source of [scanner, imageKit]) assert.doesNotMatch(source, /fetch\(|XMLHttpRequest|createObjectURL|localStorage|sessionStorage|innerHTML/);
});
