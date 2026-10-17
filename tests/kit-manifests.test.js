import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { publishingKitManifest, wordPressKitManifest } from '../public/kit-manifests.js';
import { publishingKitFiles } from '../public/publishing-kit.js';
import { wordPressKitFiles } from '../public/wordpress-kit.js';

const base = { title: 'Fictional source', body: 'A fictional paragraph.', excerpt: 'A summary.', description: 'A description.', slug: 'fictional-source' };
const metadata = kit => ({ filename: kit.filename, files: kit.files.map(({ name, purpose }) => ({ name, purpose })), notices: kit.notices });
const modes = [
  [publishingKitManifest, publishingKitFiles, { includeTitleHeading: false }],
  [publishingKitManifest, publishingKitFiles, { includeTitleHeading: true }],
  [wordPressKitManifest, wordPressKitFiles, { includeLinkedImages: false }],
  [wordPressKitManifest, wordPressKitFiles, { includeLinkedImages: true }]
];
function compare(draft) {
  const before = JSON.stringify(draft);
  for (const [manifest, serialize, options] of modes) {
    assert.deepEqual(manifest(draft, options), metadata(serialize(draft, options)));
    assert.ok(manifest(draft, options).files.every(file => !Object.hasOwn(file, 'content')));
  }
  assert.equal(JSON.stringify(draft), before);
}

test('Metadata manifests match the full unchanged serializers across source and option combinations', () => {
  const bodies = [
    'An ordinary paragraph.',
    '# Body title\r\n\r\n日本語 😀 café.\r\n\r\nTODO: inspect the source.',
    '## Example\n\n**Bold** and ~~old~~ with [a link](https://example.test/a).\n\n1. One\n  - Nested\n2. Two',
    '| Name | Value |\n| --- | ---: |\n| Fictional | 42 |',
    '| Name | Value |\n| --- | --- |\n| A | B | EXTRA |\n\n<div>Literal source</div>',
    '![One](https://example.test/one.png)\n\n![Two](https://example.test/one.png)\n\n![Unsafe](http://example.test/no.png)',
    '~~~text\n![Literal](https://example.test/no.png)\n~~~\n\n[Reference][id]\n\n[id]: https://example.test/'
  ];
  const details = [base, { title: '日本語', slug: '../unsafe' }, { title: 'Only a title' },
    { ...base, excerpt: '', description: '' }, { ...base, excerpt: ' ', slug: '' }];
  for (const body of bodies) for (const fields of details) compare({ ...fields, body });
});

test('Near-limit ordinary and rich articles retain the same file catalogs without article contents', () => {
  compare({ ...base, body: 'Fictional source sentence.\n\n'.repeat(2100) });
  const rich = '## Example\n\nOne [link](https://example.test/) and **formatting**.\n\n';
  compare({ ...base, body: rich.repeat(Math.floor(58500 / rich.length)) });
});

test('Field-validation failures retain the serializer rejection text', () => {
  const invalid = [null, {}, { ...base, title: '' }, { ...base, body: '' }, { ...base, body: ' \n ' },
    { ...base, body: 'x'.repeat(60001) }, { ...base, body: 'a\u0000b' },
    { ...base, title: 'x'.repeat(161) }, { ...base, excerpt: 'x'.repeat(301) },
    { ...base, description: null }, { ...base, slug: 'x'.repeat(81) }];
  const outcome = fn => { try { fn(); return 'NO ERROR'; } catch (error) { return error.message; } };
  for (const draft of invalid) for (const [manifest, serialize, options] of modes) {
    const expected = outcome(() => serialize(draft, options));
    assert.notEqual(expected, 'NO ERROR');
    assert.equal(outcome(() => manifest(draft, options)), expected);
  }
  for (const value of ['true', 1, null]) assert.throws(() => wordPressKitManifest(base, { includeLinkedImages: value }), /Choose whether/);
});

test('Manifest output contains no article, private fields, cached draft or mutable shared catalog', () => {
  const draft = Object.freeze({ ...base, body: 'MANIFEST_PRIVATE_BODY', excerpt: 'MANIFEST_PRIVATE_EXCERPT', description: 'MANIFEST_PRIVATE_DESCRIPTION',
    get questions() { throw new Error('Do not inspect private questions'); },
    get source() { throw new Error('Do not inspect private source notes'); } });
  for (const [manifest] of modes) {
    const result = manifest(draft);
    assert.deepEqual(Object.keys(result).sort(), ['filename', 'files', 'notices']);
    assert.doesNotMatch(JSON.stringify(result), /MANIFEST_PRIVATE/);
    result.files[0].name = 'corrupted'; result.files.push({ name: 'extra' }); result.notices.push('extra');
    const fresh = manifest(draft);
    assert.notEqual(fresh.files[0].name, 'corrupted');
    assert.ok(!fresh.files.some(file => file.name === 'extra'));
    assert.ok(!fresh.notices.includes('extra'));
  }
});

test('Metadata construction works with all content-producing dependency exports poisoned', async () => {
  const root = mkdtempSync(join(tmpdir(), 'dtp-manifest-only-'));
  const moduleURL = name => JSON.stringify(new URL('../public/' + name, import.meta.url).href);
  try {
    writeFileSync(join(root, 'package.json'), '{"type":"module"}');
    writeFileSync(join(root, 'kit-manifests.js'), readFileSync(new URL('../public/kit-manifests.js', import.meta.url)));
    const poison = 'const fail=()=>{throw Error("A manifest must not serialize article content")};\n';
    writeFileSync(join(root, 'publishing-kit.js'), 'export { publicationFields } from ' + moduleURL('publishing-kit.js') + ';\n' + poison + 'export {fail as publishingKitFiles,fail as createPublishingKit};\n');
    writeFileSync(join(root, 'wordpress-kit.js'), 'export { wordPressKitSummary } from ' + moduleURL('wordpress-kit.js') + ';\n' + poison + 'export {fail as wordPressKitFiles,fail as createWordPressKit};\n');
    writeFileSync(join(root, 'authoring.js'), 'export { articleIssues } from ' + moduleURL('authoring.js') + ';\n');
    writeFileSync(join(root, 'preview.js'), 'export { suggestFilename } from ' + moduleURL('preview.js') + ';\n' + poison + 'export {fail as previewBlocks,fail as renderPreview};\n');
    const fresh = await import(pathToFileURL(join(root, 'kit-manifests.js')).href);
    assert.deepEqual(fresh.publishingKitManifest(base), metadata(publishingKitFiles(base)));
    assert.deepEqual(fresh.wordPressKitManifest(base), metadata(wordPressKitFiles(base)));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('Panel controllers use metadata only and preserve full serializers in explicit download handlers', () => {
  const general = readFileSync(new URL('../public/export-controls.js', import.meta.url), 'utf8');
  const wordpress = readFileSync(new URL('../public/wordpress-handoff-controls.js', import.meta.url), 'utf8');
  assert.match(general, /prepareGeneralKitFiles = publishingKitManifest/);
  assert.doesNotMatch(general, /\bpublishingKitFiles\s*\(/);
  assert.match(general, /approved\(\); const kit = createPublishingKit\(getDraft\(\), options\(\)\)/);
  assert.match(wordpress, /wordPressKitManifest\(draft, options\)/);
  assert.doesNotMatch(wordpress, /\bwordPressKitFiles\s*\(/);
  assert.match(wordpress, /approved\(\); const kit = createWordPressKit\(getDraft\(\), getWordPressOptions\(\)\)/);
});
