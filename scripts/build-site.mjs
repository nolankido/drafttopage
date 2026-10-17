// Temporary integrated test diagnostic, never merge.
import { execFileSync } from 'node:child_process';
await import('./build-content.mjs');
execFileSync(process.execPath, ['--test', '--test-name-pattern=Integrated guided', 'tests/word-image-sequence.test.js'], { stdio: 'inherit', timeout: 60000 });
