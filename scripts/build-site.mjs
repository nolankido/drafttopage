// Temporary focused validation. Never merge.
import { execFileSync } from 'node:child_process';
await import('./build-content.mjs');
execFileSync(process.execPath, ['--test', 'tests/word-image-sequence.test.js'], { stdio: 'inherit', timeout: 60000 });
