// Temporary narrow diagnostic, do not merge.
import { execFileSync } from 'node:child_process';
await import('./build-content.mjs');
execFileSync(process.execPath, ['--test', '--test-name-pattern=Next match|Repeated image|Protected Markdown|first 40', 'tests/word-image-sequence.test.js'], { stdio: 'inherit', timeout: 60000 });
