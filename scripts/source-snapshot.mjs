import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const command = (root, args) => execFileSync('git', args, {
  cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']
});

// Keep both JavaScript receipt gates aligned with wordpress_roundtrip.py.
// UTF-8 byte order matches Python's Unicode code-point order. JavaScript's
// default UTF-16 sort differs when supplementary-plane filenames are present.
export function sourceDigest(root = process.cwd(), git = command, read = readFileSync) {
  root = resolve(root);
  const paths = git(root, ['ls-files', '-z', '--cached', '--others', '--exclude-standard'])
    .split('\0').filter(Boolean).sort((a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b)));
  if (!paths.length) throw new Error('No Git source files found for source snapshot validation.');
  const hash = createHash('sha256');
  for (const path of paths) {
    hash.update(path + '\0');
    try { hash.update(read(resolve(root, path))); }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      hash.update('[deleted]');
    }
    hash.update('\0');
  }
  return hash.digest('hex');
}
