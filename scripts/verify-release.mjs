import { mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { sourceDigest as snapshotSource } from './source-snapshot.mjs';
import { validateFullBrowserEvidence } from './release-browser-contract.mjs';
import { verifiedSyntheticSourceDigest } from './wordpress-fixture-identity.mjs';

export function validateWordPressEvidence(evidence, configuration, sourceSha256) {
  const expected = configuration.cases;
  const isDigest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
  const nativeCases = expected.filter(item => item.inputMode === 'native-visual-paste');
  if (evidence.result !== 'PASS' || evidence.scope !== 'local WordPress native clipboard, Visual paste, save/reopen, Code editor fallback, and Media Library image handoff' ||
      evidence.environment?.wordpress !== configuration.wordpress || evidence.environment?.unfilteredHTMLDisabled !== true ||
      evidence.playground !== configuration.playground || !evidence.environment?.php?.startsWith(configuration.php + '.') ||
      evidence.environment?.marker !== 'drafttopage-local-acceptance' || evidence.environment?.databaseClass !== 'WP_SQLite_DB' ||
      !evidence.environment?.pdoDrivers?.includes('sqlite') || evidence.sourceUnchanged !== true ||
      !isDigest(evidence.sourceSha256) || sourceSha256 && sourceSha256 !== evidence.sourceSha256 ||
      evidence.user?.roles?.length !== 1 || evidence.user.roles[0] !== 'author' || evidence.user.unfilteredHTML !== false ||
      evidence.negativeControl !== true || !Array.isArray(evidence.runtimeErrors) || evidence.runtimeErrors.length ||
      !Array.isArray(evidence.unexpectedRequests) || evidence.unexpectedRequests.length ||
      !nativeCases.length || !Array.isArray(evidence.cases) || evidence.cases.length !== expected.length ||
      new Set(evidence.cases.map(item => item.id)).size !== expected.length ||
      expected.some(item => {
        const found = evidence.cases.find(result => result.id === item.id);
        const native = item.inputMode === 'native-visual-paste', paste = found?.paste;
        const pinnedSavedSha256 = typeof item.expectedSavedSource === 'string'
          ? createHash('sha256').update(item.expectedSavedSource).digest('hex') : null;
        return !found || found.result !== 'PASS' || found.status !== 'draft' || found.validAfterReopen !== true || found.saveResponse !== 200 ||
          !Number.isInteger(found.postId) || found.postId <= 0 || !isDigest(found.savedSha256) ||
          !['native-visual-paste', 'code-editor'].includes(item.inputMode) || found.inputMode !== item.inputMode ||
          typeof found.source !== 'string' || !found.source.trim() || found.sourceTransport !== 'copy-wordpress-button' ||
          found.privateFieldsPopulated !== true || !isDigest(found.exportSha256) || found.clipboardSha256 !== found.exportSha256 ||
          paste?.trusted !== true || paste.textSha256 !== found.exportSha256 || paste.htmlEmpty !== true ||
          !Array.isArray(paste.types) || paste.types.length !== 1 || paste.types[0] !== 'text/plain' ||
          paste.targetKind !== (native ? 'visual-paragraph' : 'code-textarea') ||
          native && (paste.emptyParagraph !== true || paste.editableTarget !== true) ||
          found.savedSourceExact !== true || found.expectedSavedSha256 !== found.savedSha256 ||
          pinnedSavedSha256 && found.expectedSavedSha256 !== pinnedSavedSha256 ||
          item.editAfterReopen && (found.editedAndReopened !== true || found.secondReopenExact !== true ||
            !isDigest(found.editedSha256) || found.editedSha256 === found.savedSha256) ||
          item.strikes && found.strikethroughVerified !== true || item.rawText && found.rawTextVerified !== true ||
          item.listPaths && found.listHierarchyVerified !== true ||
          item.sourceFixture && (found.sourceOrigin !== 'authored-synthetic' ||
            found.source !== item.sourceLabel || !isDigest(found.sourceInputSha256) ||
            found.sourceInputSha256 !== verifiedSyntheticSourceDigest(item.sourceFixture)) ||
          item.strongs && found.inlineEmphasisVerified !== true ||
          item.formatSelection && found.toolbarVerified !== true;
      })) throw new Error('WordPress evidence is incomplete, contains failures, or targets a different environment.');
  // The separate media case is not another parser-only block fixture. It must
  // prove upload to an actual local Media Library, downloaded file identity,
  // three distinct Image blocks with one reused uploaded file, and save/reopen.
  const fixture = configuration.mediaLibraryFixture;
  const media = evidence.mediaLibrary;
  if (!fixture || !media || media.result !== 'PASS' || media.fixtureId !== fixture.id ||
      !isDigest(media.sourceDocumentSha256) || media.imagePackageVerified !== true || media.mapV1Verified !== true ||
      media.wordpressAttachmentCount !== fixture.imageFiles.length ||
      media.nativeVisualPasteTrusted !== true || media.exportMatchesClipboard !== true ||
      media.privateFieldsOmitted !== true || media.exportApprovedSeparately !== true ||
      media.reusedMedia !== true || media.syntheticHttpsAlias !== true ||
      !Number.isInteger(media.postId) || media.postId <= 0 ||
      media.postTitle !== fixture.expectedTitle || media.postText !== fixture.expectedText ||
      media.postStatus !== 'draft' || media.saveResponse !== 200 ||
      !isDigest(media.savedSha256) || media.validAfterReopen !== true ||
      media.reopenedSavedSourceExact !== true ||
      !Array.isArray(media.uploads) || media.uploads.length !== fixture.imageFiles.length ||
      !Array.isArray(media.placements) || media.placements.length !== fixture.expectedImageBlocks) {
    throw new Error('WordPress evidence lacks a complete real local Media Library image round trip.');
  }
  const mediaIds = new Set(), originalDigests = new Set(), mediaAliases = new Set(), mediaUrls = new Map();
  for (let index = 0; index < fixture.imageFiles.length; index++) {
    const wanted = fixture.imageFiles[index], received = media.uploads[index];
    if (!received || received.filename !== wanted.filename || received.mime !== wanted.mime ||
        !Number.isInteger(received.mediaId) || received.mediaId <= 0 ||
        mediaIds.has(received.mediaId) || received.uploadStatus !== 201 ||
        received.localLoopback !== true || !isDigest(received.originalSha256) || originalDigests.has(received.originalSha256) ||
        received.servedSha256 !== received.originalSha256 ||
        typeof received.fixtureHttpsAlias !== 'string') {
      throw new Error('WordPress Media Library attachment evidence is incomplete or damaged.');
    }
    let alias;
    try { alias = new URL(received.fixtureHttpsAlias); } catch { throw new Error('WordPress Media Library URL evidence is malformed.'); }
    if (alias.origin !== fixture.fixtureHTTPSOrigin || !alias.pathname.startsWith('/wp-content/uploads/') ||
        alias.search || alias.hash || alias.username || alias.password ||
        alias.pathname.split('/').some(part => part === '..' || part === '.')) {
      throw new Error('WordPress media evidence must use only its isolated test HTTPS alias.');
    }
    if (mediaAliases.has(alias.href)) {
      throw new Error('WordPress Media Library uploads must use distinct fixture HTTPS URLs.');
    }
    mediaIds.add(received.mediaId);
    originalDigests.add(received.originalSha256);
    mediaAliases.add(alias.href);
    mediaUrls.set(wanted.filename, received.fixtureHttpsAlias);
  }
  if (mediaUrls.size !== fixture.imageFiles.length || media.placements.some((item, index) => {
    const wanted = fixture.imageOrder[index];
    return !item || item.filename !== wanted.filename || item.alt !== wanted.alt ||
      item.src !== mediaUrls.get(wanted.filename);
  }) || media.placements[0].src !== media.placements[2].src ||
      media.placements[0].alt === media.placements[2].alt) {
    throw new Error('WordPress saved image placement and per-occurrence alternative-text evidence is invalid.');
  }
  return { result: 'PASS', version: evidence.environment.wordpress, cases: evidence.cases.length,
    nativePasteCases: nativeCases.length, codeEditorCases: expected.length - nativeCases.length,
    mediaLibraryUploads: fixture.imageFiles.length, mediaLibraryImageBlocks: fixture.expectedImageBlocks,
    role: 'author' };
}

// Git status can hide changed source behind index flags. Complete release
// qualification must refuse these states, even if source snapshots match.
const hasHiddenIndexFlags = git => git(['ls-files', '-v', '-z']).split('\0').some(
  entry => /^[hSs] /.test(entry)
);

// A deliberately invoked local gate. It never installs tools, starts Actions,
// deploys, activates the pilot, or retries a failed check.
export function verifyRelease({ root = process.cwd(), run = spawnSync, env = process.env, requireWordPress = false } = {}) {
  root = resolve(root);
  if (JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')).name !== 'drafttopage') throw new Error('Run from the Draft to Page repository.');
  const out = resolve(root, 'test-results');
  mkdirSync(out, { recursive: true });
  const resultFile = resolve(out, 'release-results.json'), browserFile = resolve(out, 'browser-results.json'), wordpressFile = resolve(out, 'wordpress-results.json');
  // An old green report must never survive a failed or unavailable browser run.
  rmSync(browserFile, { force: true });
  rmSync(wordpressFile, { force: true });
  const report = { result: 'RUNNING', startedAt: new Date().toISOString(), scope: 'local models, static checks, and routed browser fixtures', steps: [] };
  if (env.DRAFTTOPAGE_WORDPRESS_CLI) report.scope += ', plus local WordPress save/reopen';
  if (requireWordPress) report.scope += ', required independent WordPress receipt';
  if (!env.DRAFTTOPAGE_WORDPRESS_CLI) report.wordpress = { result: 'NOT_RUN', reason: 'Set DRAFTTOPAGE_WORDPRESS_CLI to run the separate local WordPress save/reopen gate.' };
  const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  const sourceDigest = () => {
    try { return snapshotSource(root); } catch { return null; }
  };
  try { report.head = git(['rev-parse', 'HEAD']).trim(); } catch { report.head = null; }
  report.sourceSha256 = sourceDigest();
  const save = () => writeFileSync(resultFile, JSON.stringify(report, null, 2) + '\n');
  save();
  const tests = readdirSync(resolve(root, 'tests')).filter(name => name.endsWith('.test.js')).sort().map(name => 'tests/' + name);
  const steps = [
    ['build', process.execPath, ['scripts/build-site.mjs']],
    ['tests', process.execPath, ['--test', ...tests]],
    ['static', process.execPath, ['scripts/check.mjs']],
    ['browser', env.DRAFTTOPAGE_BROWSER_PYTHON || 'python3', ['scripts/browser-smoke.py']]
  ];
  if (env.DRAFTTOPAGE_WORDPRESS_CLI) steps.push(['wordpress', env.DRAFTTOPAGE_BROWSER_PYTHON || 'python3', ['scripts/wordpress_roundtrip.py']]);
  // Any successful WordPress-qualified release, including the older command
  // with an explicitly set CLI, must carry independent source-bound receipt proof.
  // A normal release command without a CLI still records WordPress NOT_RUN.
  if (env.DRAFTTOPAGE_WORDPRESS_CLI)
    steps.push(['wordpress receipt', process.execPath, ['scripts/verify-wordpress-receipt.mjs']]);
  try {
    if (requireWordPress && !env.DRAFTTOPAGE_WORDPRESS_CLI)
      throw new Error('Complete release qualification requires DRAFTTOPAGE_WORDPRESS_CLI. No checks ran; local WordPress is NOT_RUN.');
    if (env.DRAFTTOPAGE_WORDPRESS_CLI) {
      const cli = env.DRAFTTOPAGE_WORDPRESS_CLI;
      let installed = false;
      try { installed = typeof cli === 'string' && isAbsolute(cli) && statSync(cli).isFile(); }
      catch { /* Missing or unreadable CLI is a hard failure, not a skipped test. */ }
      if (!installed) throw new Error('DRAFTTOPAGE_WORDPRESS_CLI must be an existing absolute local file. No release checks ran.');
    }
    // A green browser suite without a Git-bound source cannot be a release
    // receipt. The earlier optional source check could silently certify it.
    if (!/^[a-f0-9]{40}$/.test(report.head || '') || !/^[a-f0-9]{64}$/.test(report.sourceSha256 || ''))
      throw new Error('Release validation requires a Git commit and a complete source fingerprint.');
    // The standalone preflight is advisory for faster diagnosis, not a bypass.
    // Recheck cleanliness here so invoking either release command directly
    // cannot certify local edits, staged changes or untracked source files.
    if (git(['status', '--porcelain', '--untracked-files=normal']).trim())
      throw new Error('Release validation requires a clean Git checkout. Commit or discard source changes before rerunning the complete gate.');
    if (hasHiddenIndexFlags(git))
      throw new Error('Release validation requires a complete Git index: remove assume-unchanged and skip-worktree flags before qualification.');
    if (!tests.length) throw new Error('No regression tests were found.');
    for (const [name, command, args] of steps) {
      const entry = { name, result: 'RUNNING' }; report.steps.push(entry); save();
      const outcome = run(command, args, { cwd: root, env, stdio: 'inherit', shell: false });
      if (outcome.error || outcome.status !== 0) {
        entry.result = 'FAIL'; entry.exitCode = outcome.status;
        throw new Error(name + ' failed' + (outcome.error ? ': ' + outcome.error.message : '.'));
      }
      if (name === 'browser') {
        const evidence = JSON.parse(readFileSync(browserFile, 'utf8'));
        try {
          report.browser = validateFullBrowserEvidence(evidence);
        } catch (failure) {
          entry.result = 'FAIL'; throw failure;
        }
      }
      if (name === 'wordpress') {
        report.wordpress = validateWordPressEvidence(JSON.parse(readFileSync(wordpressFile, 'utf8')),
          JSON.parse(readFileSync(resolve(root, 'tests/fixtures/wordpress-roundtrip.json'), 'utf8')), report.sourceSha256);
      }
      entry.result = 'PASS'; save();
    }
    const matchingHead = report.head === git(['rev-parse', 'HEAD']).trim();
    const matches = report.sourceSha256 === sourceDigest();
    const clean = git(['status', '--porcelain', '--untracked-files=normal']).trim() === '' && !hasHiddenIndexFlags(git);
    const stable = matchingHead && matches && clean;
    report.steps.push({ name: 'source snapshot', result: stable ? 'PASS' : 'FAIL' });
    if (!stable) throw new Error('Repository commit or source changed during validation. Run the complete gate again against stable source.');
    report.result = 'PASS';
  } catch (error) {
    const running = report.steps.find(step => step.result === 'RUNNING');
    if (running) running.result = 'FAIL';
    report.result = 'FAIL'; report.error = error.message;
  }
  report.completedAt = new Date().toISOString(); save();
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const report = verifyRelease({ requireWordPress: process.argv.includes('--require-wordpress') });
  console.log('Local release validation: ' + report.result + '. See test-results/release-results.json.');
  if (report.result !== 'PASS') { console.error(report.error); process.exitCode = 1; }
}
