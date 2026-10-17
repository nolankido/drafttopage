// Temporary map-controller diagnostic, do not merge.
import { execFileSync } from 'node:child_process';
await import('./build-content.mjs');
execFileSync(process.execPath, ['--test', '--test-name-pattern=Map button|All guide', 'tests/word-image-sequence.test.js'], { stdio: 'inherit', timeout: 60000 });
