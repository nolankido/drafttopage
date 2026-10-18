import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sourceDigest, verifyWordPressReceipt } from '../scripts/verify-wordpress-receipt.mjs';
import { verifyRelease } from '../scripts/verify-release.mjs';
import { TABLE_ROW_SCENARIO, TABLE_ROW_LAYOUT_KEYS } from '../scripts/release-browser-contract.mjs';

const configuration = JSON.parse(readFileSync(new URL('./fixtures/wordpress-roundtrip.json', import.meta.url), 'utf8'));
const receiptScript = fileURLToPath(new URL('../scripts/verify-wordpress-receipt.mjs', import.meta.url));
const scriptDirectory = fileURLToPath(new URL('../scripts/', import.meta.url));

function repoFixture(run) {
  const root = mkdtempSync(join(tmpdir(), 'drafttopage-wp-receipt-'));
  const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  try {
    git(['init', '-q']);
    mkdirSync(join(root, 'test-results'));
    mkdirSync(join(root, 'tests/fixtures'), { recursive: true });
    writeFileSync(join(root, '.gitignore'), 'test-results/\n');
    writeFileSync(join(root, 'README.md'), 'Fictional article source.\n');
    git(['add', '.gitignore', 'README.md']);
    git(['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'Synthetic source']);
    return run({ root, git });
  } finally { rmSync(root, { force: true, recursive: true }); }
}

function independentlyHash(files) {
  const digest = createHash('sha256');
  for (const [name, contents] of Object.entries(files).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) {
    digest.update(name + '\0'); digest.update(contents); digest.update('\0');
  }
  return digest.digest('hex');
}

function pythonSourceDigest(root) {
  return execFileSync('python3', ['-c', String.raw`
import sys
from pathlib import Path
sys.path.insert(0, sys.argv[1])
import wordpress_roundtrip
wordpress_roundtrip.ROOT = Path(sys.argv[2])
print(wordpress_roundtrip.source_snapshot())
`, scriptDirectory, root], { encoding: 'utf8' }).trim();
}

// Synthetic receipt data exercises the offline validator, not WordPress itself.
function completeReceipt(head, sourceSha256) {
  const digest = value => createHash('sha256').update(value).digest('hex');
  const copiedDigest = digest('Fictional exported content');
  const fixture = configuration.mediaLibraryFixture;
  const alias = filename => fixture.fixtureHTTPSOrigin + '/wp-content/uploads/2026/10/' + filename;
  return {
    head, sourceSha256, sourceUnchanged: true, result: 'PASS',
    scope: 'local WordPress native clipboard, Visual paste, save/reopen, Code editor fallback, and Media Library image handoff',
    playground: configuration.playground,
    environment: { wordpress: configuration.wordpress, php: configuration.php + '.33', marker: 'drafttopage-local-acceptance',
      databaseClass: 'WP_SQLite_DB', pdoDrivers: ['sqlite'], unfilteredHTMLDisabled: true },
    user: { roles: ['author'], unfilteredHTML: false }, negativeControl: true, runtimeErrors: [], unexpectedRequests: [],
    cases: configuration.cases.map((item, index) => ({
      id: item.id, result: 'PASS', postId: index + 1, status: 'draft', saveResponse: 200,
      savedSha256: digest(item.expectedSavedSource ?? 'Fictional saved article'),
      expectedSavedSha256: digest(item.expectedSavedSource ?? 'Fictional saved article'),
      savedSourceExact: true, validAfterReopen: true, inputMode: item.inputMode,
      source: item.sourceFixture ? item.sourceLabel : 'Fictional receipt unit-test source',
      ...(item.sourceFixture ? { sourceOrigin: 'authored-synthetic', sourceInputSha256: digest(item.sourceFixture) } : {}),
      sourceTransport: 'copy-wordpress-button', privateFieldsPopulated: true,
      exportSha256: copiedDigest, clipboardSha256: copiedDigest,
      paste: { trusted: true, textSha256: copiedDigest, htmlEmpty: true, types: ['text/plain'],
        targetKind: item.inputMode === 'native-visual-paste' ? 'visual-paragraph' : 'code-textarea',
        ...(item.inputMode === 'native-visual-paste' ? { emptyParagraph: true, editableTarget: true } : {}) },
      ...(item.strikes ? { strikethroughVerified: true } : {}),
      ...(item.formatSelection ? { toolbarVerified: true } : {}),
      ...(item.listPaths ? { listHierarchyVerified: true } : {}),
      ...(item.rawText ? { rawTextVerified: true } : {}),
      ...(item.editAfterReopen ? { editedAndReopened: true, secondReopenExact: true, editedSha256: digest('Fictional edited article') } : {})
    })),
    mediaLibrary: {
      result: 'PASS', fixtureId: fixture.id, sourceDocumentSha256: digest('Fictional Word document'),
      imagePackageVerified: true, mapV1Verified: true, wordpressAttachmentCount: 2,
      nativeVisualPasteTrusted: true, exportMatchesClipboard: true, privateFieldsOmitted: true,
      exportApprovedSeparately: true, reusedMedia: true, syntheticHttpsAlias: true,
      postId: 99, postTitle: fixture.expectedTitle, postText: fixture.expectedText, postStatus: 'draft',
      saveResponse: 200, savedSha256: digest('Fictional image article'), validAfterReopen: true, reopenedSavedSourceExact: true,
      uploads: fixture.imageFiles.map((file, index) => ({ filename: file.filename, mime: file.mime,
        mediaId: index + 101, uploadStatus: 201, originalSha256: digest(file.filename), servedSha256: digest(file.filename),
        localLoopback: true, fixtureHttpsAlias: alias(file.filename) })),
      placements: fixture.imageOrder.map(item => ({ filename: item.filename, alt: item.alt, src: alias(item.filename) }))
    }
  };
}

test('Receipt digest matches independent tracked, untracked, and deleted-source hashing', () => repoFixture(({ root }) => {
  assert.equal(sourceDigest(root), independentlyHash({ '.gitignore': 'test-results/\n', 'README.md': 'Fictional article source.\n' }));
  writeFileSync(join(root, 'extra.txt'), 'Unicode 日本語 💡');
  assert.equal(sourceDigest(root), independentlyHash({
    '.gitignore': 'test-results/\n', 'README.md': 'Fictional article source.\n', 'extra.txt': 'Unicode 日本語 💡'
  }));
  rmSync(join(root, 'README.md'));
  assert.equal(sourceDigest(root), independentlyHash({
    '.gitignore': 'test-results/\n', 'README.md': '[deleted]', 'extra.txt': 'Unicode 日本語 💡'
  }));
  // Fixture report output is ignored; it must never masquerade as input code.
  writeFileSync(join(root, 'test-results/wordpress-results.json'), '{"result":"PASS"}');
  assert.equal(sourceDigest(root), independentlyHash({
    '.gitignore': 'test-results/\n', 'README.md': '[deleted]', 'extra.txt': 'Unicode 日本語 💡'
  }));
}));

test('Receipt and release source snapshots match Python with tracked, untracked, deleted, and Unicode filenames', () => repoFixture(({ root, git }) => {
  // U+E000 sorts before U+1F4DD by code point, but after it in JavaScript's
  // default UTF-16 sort. Both names are needed to expose the old mismatch.
  writeFileSync(join(root, '\uE000-note.txt'), 'Tracked Unicode filename');
  writeFileSync(join(root, '\u{1F4DD}-note.txt'), 'Untracked supplementary-plane filename');
  git(['add', '\uE000-note.txt']);
  rmSync(join(root, 'README.md'));
  writeFileSync(join(root, 'package.json'), '{"name":"drafttopage"}');
  writeFileSync(join(root, 'tests/fixture.test.js'), '');
  const expected = pythonSourceDigest(root);
  assert.equal(sourceDigest(root), expected);
  // A matching fingerprint is not by itself release proof: staged, deleted
  // and untracked source must fail before any browser or model command.
  let calls = 0;
  const dirty = verifyRelease({ root, env: {}, run: () => { calls++; return {status:0}; } });
  assert.equal(dirty.result, 'FAIL');
  assert.equal(calls, 0);
  assert.match(dirty.error, /clean Git checkout/);
  // Commit that exact Unicode source state, then qualify it normally.
  git(['add', '-A']);
  git(['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'Commit Unicode fixture']);
  const committed = pythonSourceDigest(root);
  assert.equal(sourceDigest(root), committed);
  const result = verifyRelease({ root, env: {}, run: () => {
    if (++calls === 4) writeFileSync(join(root, 'test-results/browser-results.json'), JSON.stringify({
      result: 'PASS', scope: 'full', checks: [TABLE_ROW_SCENARIO + ' (synthetic receipt contract test)'],
      errors: [], unexpected_requests: [],
      layout: Object.fromEntries(TABLE_ROW_LAYOUT_KEYS.map(key=>[key,false]))
    }));
    return { status: 0 };
  } });
  assert.equal(result.result, 'PASS');
  assert.equal(result.sourceSha256, committed);
  assert.deepEqual(result.steps.at(-1), { name: 'source snapshot', result: 'PASS' });
}));

test('A complete source-bound synthetic receipt passes the API and CLI, while changed source or partial proof fails', () => repoFixture(({ root, git }) => {
  writeFileSync(join(root, 'tests/fixtures/wordpress-roundtrip.json'), JSON.stringify(configuration));
  writeFileSync(join(root, '\uE000-source.txt'), 'Fictional source A');
  writeFileSync(join(root, '\u{1F4DD}-source.txt'), 'Fictional source B');
  const head = git(['rev-parse', 'HEAD']), sourceSha256 = pythonSourceDigest(root);
  const evidence = completeReceipt(head, sourceSha256);
  const path = join(root, 'test-results/wordpress-results.json');
  writeFileSync(path, JSON.stringify(evidence));
  assert.deepEqual(verifyWordPressReceipt({ root }), {
    result: 'PASS', version: configuration.wordpress, cases: 16, nativePasteCases: 15, codeEditorCases: 1,
    mediaLibraryUploads: 2, mediaLibraryImageBlocks: 3, role: 'author', head, sourceSha256
  });
  const cli = spawnSync(process.execPath, [receiptScript], { cwd: root, encoding: 'utf8' });
  assert.equal(cli.status, 0, cli.stderr);
  assert.match(cli.stdout, /16 saved\/reopened cases; 2 Media Library uploads; 3 image blocks/);
  assert.ok(cli.stdout.includes(head));

  const incomplete = structuredClone(evidence);
  incomplete.cases.pop();
  writeFileSync(path, JSON.stringify(incomplete));
  assert.throws(() => verifyWordPressReceipt({ root }), /WordPress evidence/);
  const missingMedia = structuredClone(evidence);
  delete missingMedia.mediaLibrary;
  writeFileSync(path, JSON.stringify(missingMedia));
  assert.throws(() => verifyWordPressReceipt({ root }), /Media Library image round trip/);

  writeFileSync(path, JSON.stringify(evidence));
  writeFileSync(join(root, 'README.md'), 'Changed since the fictional acceptance run.\n');
  assert.throws(() => verifyWordPressReceipt({ root }), /WordPress evidence/);
  const staleCLI = spawnSync(process.execPath, [receiptScript], { cwd: root, encoding: 'utf8' });
  assert.equal(staleCLI.status, 1);
  assert.match(staleCLI.stderr, /WordPress receipt FAIL/);
  assert.equal(staleCLI.stdout, '');
}));

test('Receipt fails closed for missing, stale, or incomplete local WordPress evidence', () => repoFixture(({ root, git }) => {
  assert.throws(() => verifyWordPressReceipt({ root }), /No readable WordPress acceptance result/);
  const path = join(root, 'test-results/wordpress-results.json');
  writeFileSync(path, JSON.stringify({ head: '0'.repeat(40), result: 'PASS' }));
  assert.throws(() => verifyWordPressReceipt({ root }), /Stale WordPress acceptance/);
  mkdirSync(join(root, 'tests/fixtures'), { recursive: true });
  writeFileSync(join(root, 'tests/fixtures/wordpress-roundtrip.json'), '{"cases":[],"mediaLibraryFixture":{}}');
  writeFileSync(path, JSON.stringify({ head: git(['rev-parse', 'HEAD']), result: 'PASS' }));
  assert.throws(() => verifyWordPressReceipt({ root }), /WordPress evidence/);
  writeFileSync(path, '{not-json');
  assert.throws(() => verifyWordPressReceipt({ root }), /No readable WordPress acceptance result/);
}));

test('Strict full release invokes a real independent receipt validator and rejects post-validation tampering', () => repoFixture(({ root, git }) => {
  writeFileSync(join(root, 'package.json'), '{"name":"drafttopage"}');
  writeFileSync(join(root, 'tests/fixture.test.js'), '// Fictional Node test fixture');
  writeFileSync(join(root, 'tests/fixtures/wordpress-roundtrip.json'), JSON.stringify(configuration));
  git(['add', 'package.json', 'tests/fixture.test.js', 'tests/fixtures/wordpress-roundtrip.json']);
  git(['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'Commit WordPress receipt inputs']);
  const cli = join(root, 'test-results', 'local-playground-cli.js');
  writeFileSync(cli, '// Fictional installed entry point, never invoked by this mock.\n');
  const head = git(['rev-parse', 'HEAD']), fingerprint = sourceDigest(root);
  const wordpress = completeReceipt(head, fingerprint);
  const browserEvidence = {
    result: 'PASS', scope: 'full', checks: [TABLE_ROW_SCENARIO + ' (synthetic receipt contract test)'],
    errors: [], unexpected_requests: [],
    layout: Object.fromEntries(TABLE_ROW_LAYOUT_KEYS.map(key=>[key,false]))
  };
  function runGate(tamper) {
    const commands = [];
    const result = verifyRelease({ root, env: { DRAFTTOPAGE_WORDPRESS_CLI: cli }, requireWordPress: true,
      run: (command, args, opts) => {
        assert.equal(opts.shell, false);
        const last = args.at(-1);
        commands.push(last);
        if (last === 'scripts/browser-smoke.py')
          writeFileSync(join(root, 'test-results/browser-results.json'), JSON.stringify(browserEvidence));
        if (last === 'scripts/wordpress_roundtrip.py')
          writeFileSync(join(root, 'test-results/wordpress-results.json'), JSON.stringify(wordpress));
        if (last === 'scripts/verify-wordpress-receipt.mjs') {
          if (tamper) writeFileSync(join(root, 'test-results/wordpress-results.json'),
            JSON.stringify({ ...wordpress, head: '0'.repeat(40) }));
          // Use the actual independent receipt validator and source snapshot.
          return spawnSync(process.execPath, [receiptScript], { cwd: root, encoding: 'utf8' });
        }
        return { status: 0 };
      } });
    return { result, commands };
  }
  const passing=runGate(false);
  assert.equal(passing.result.result, 'PASS');
  assert.equal(passing.result.wordpress.result, 'PASS');
  assert.deepEqual(passing.result.steps.map(x=>x.name), ['build','tests','static','browser','wordpress','wordpress receipt','source snapshot']);
  assert.equal(passing.result.steps.every(x=>x.result==='PASS'), true);
  assert.equal(passing.commands.includes('scripts/verify-wordpress-receipt.mjs'), true);
  const failing=runGate(true);
  assert.equal(failing.result.result, 'FAIL');
  assert.equal(failing.result.steps.find(x=>x.name==='wordpress').result,'PASS');
  assert.equal(failing.result.steps.find(x=>x.name==='wordpress receipt').result,'FAIL');
  assert.match(failing.result.error, /wordpress receipt failed/);
  assert.equal(failing.result.steps.some(x=>x.name==='source snapshot'), false);
}));

test('The receipt check is an explicit manual script, never part of site build or automated Actions', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(pkg.scripts['verify:wordpress:receipt'], 'node scripts/verify-wordpress-receipt.mjs');
  const build = readFileSync(new URL('../scripts/build-site.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(build, /playground|wordpress_roundtrip|verify-wordpress-receipt/);
});
