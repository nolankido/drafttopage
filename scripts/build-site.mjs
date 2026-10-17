// Temporary preview-branch validation only. Never merge this build hook.
import { execFileSync } from 'node:child_process';
execFileSync('python3', ['-m', 'py_compile', 'scripts/document_benchmark.py'], { stdio: 'inherit' });
execFileSync(process.execPath, ['--test', 'tests/document-benchmark.test.js', 'tests/authored-export-cases.test.js'], { stdio: 'inherit' });
await import('./build-content.mjs');
execFileSync(process.execPath, ['scripts/check.mjs'], { stdio: 'inherit' });
