// Temporary validation hook, never merge. Run the full offline Node suite on this branch only.
import { readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
await import('./build-content.mjs');
const tests = readdirSync('tests').filter(name => name.endsWith('.test.js')).sort().map(name => 'tests/' + name);
console.log('Temporary validation: running ' + tests.length + ' Node test files.');
execFileSync(process.execPath, ['--test', ...tests], { stdio: 'inherit', timeout: 220000 });
execFileSync(process.execPath, ['scripts/check.mjs'], { stdio: 'inherit', timeout: 60000 });
