// Read the existing placement-map format only. No images or URLs are opened.
export const WORD_IMAGE_MAP_LIMIT = 512 * 1024;
const fail = () => { throw new Error('Choose an intact image-map.json from a Draft to Page Word image package. The article and pending image details are unchanged.'); };
const object = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const text = (value, limit) => typeof value === 'string' && value.length <= limit && !/[\u0000-\u001f\u007f]/.test(value);
const placeholder = value => typeof value === 'string' && /^\[Word image ([1-9]\d{0,2})\]$/.test(value) && Number(value.match(/\d+/)[0]) <= 200;
const filename = value => typeof value === 'string' && /^word-image-\d{3}\.(?:png|jpg)$/.test(value) && Number(value.slice(11,14)) >= 1 && Number(value.slice(11,14)) <= 200;
export function parseWordImageMap(input) {
  let raw;
  try {
    if (input instanceof Uint8Array) {
      if (input.length > WORD_IMAGE_MAP_LIMIT) fail();
      raw = new TextDecoder('utf-8', { fatal: true }).decode(input);
    } else {
      if (typeof input !== 'string' || input.length > WORD_IMAGE_MAP_LIMIT || new TextEncoder().encode(input).length > WORD_IMAGE_MAP_LIMIT) fail();
      raw = input;
    }
    const value = JSON.parse(raw);
    if (!object(value, ['format','placementScope','images','placements']) || value.format !== 'drafttopage-word-images-v1' || !text(value.placementScope, 1000) || !value.placementScope || !Array.isArray(value.images) || !value.images.length || value.images.length > 40 || !Array.isArray(value.placements) || !value.placements.length || value.placements.length > 200) fail();
    const files = new Map(), positions = new Map(); let total = 0;
    for (const image of value.images) {
      if (!object(image, ['name','bytes','width','height','placeholders']) || !filename(image.name) || files.has(image.name) || !Number.isInteger(image.bytes) || image.bytes < 1 || image.bytes > 4 * 1024 * 1024 || !Number.isInteger(image.width) || !Number.isInteger(image.height) || image.width < 1 || image.height < 1 || image.width > 20000 || image.height > 20000 || image.width * image.height > 40000000 || !Array.isArray(image.placeholders) || !image.placeholders.length || image.placeholders.length > 200 || new Set(image.placeholders).size !== image.placeholders.length || !image.placeholders.every(placeholder)) fail();
      total += image.bytes; files.set(image.name, image);
    }
    if (total > 12 * 1024 * 1024) fail();
    for (const item of value.placements) {
      if (!object(item, ['placeholder','filename','alt','altTruncated','note']) || !placeholder(item.placeholder) || positions.has(item.placeholder) || (item.filename !== '' && (!filename(item.filename) || !files.has(item.filename))) || !text(item.alt, 500) || typeof item.altTruncated !== 'boolean' || !text(item.note, 1000)) fail();
      positions.set(item.placeholder, item);
    }
    for (const image of files.values()) {
      const actual = value.placements.filter(item => item.filename === image.name).map(item => item.placeholder);
      if (actual.length !== image.placeholders.length || !image.placeholders.every(label => positions.get(label)?.filename === image.name)) fail();
    }
    return { scope: value.placementScope, placements: value.placements.map(item => ({ ...item })) };
  } catch { fail(); }
}
