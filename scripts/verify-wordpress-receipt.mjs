// Deliberate, offline acceptance receipt check. No installs, WordPress requests,
// browser launch, or publishing. Requires an actual prior local runner result.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { validateWordPressEvidence } from './verify-release.mjs';
import { sourceDigest } from './source-snapshot.mjs';

export { sourceDigest } from './source-snapshot.mjs';

const command = (root, args) => execFileSync('git', args, {
  cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']
});

export function verifyWordPressReceipt({
  root = process.cwd(), read = readFileSync, git = command
} = {}) {
  root = resolve(root);
  const actualHead = git(root, ['rev-parse', 'HEAD']).trim();
  if (!/^[0-9a-f]{40}$/.test(actualHead)) throw new Error('The WordPress receipt requires an existing Git commit.');
  const path = resolve(root, 'test-results/wordpress-results.json');
  let evidence;
  try { evidence = JSON.parse(read(path, 'utf8')); }
  catch (error) { throw new Error('No readable WordPress acceptance result. Run the pinned local Playground test first. ' + error.message); }
  if (evidence.head !== actualHead) throw new Error('Stale WordPress acceptance: the result was created for a different Git commit.');
  const config = JSON.parse(read(resolve(root, 'tests/fixtures/wordpress-roundtrip.json'), 'utf8'));
  const snapshot = sourceDigest(root, git, read);
  const validated = validateWordPressEvidence(evidence, config, snapshot);
  if (validated.mediaLibraryUploads !== 2 || validated.mediaLibraryImageBlocks !== 3 ||
      evidence.mediaLibrary?.postStatus !== 'draft') {
    throw new Error('Local Media Library proof must include two distinct uploads and three editable unpublished image blocks.');
  }
  return { ...validated, head: actualHead, sourceSha256: snapshot };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const result = verifyWordPressReceipt();
    process.stdout.write('PASS: pinned local WordPress ' + result.version +
      '; ' + result.cases + ' saved/reopened cases; ' + result.mediaLibraryUploads +
      ' Media Library uploads; ' + result.mediaLibraryImageBlocks +
      ' image blocks; source ' + result.head + '\n');
  } catch (error) {
    process.stderr.write('WordPress receipt FAIL: ' + error.message + '\n');
    process.exitCode = 1;
  }
}
