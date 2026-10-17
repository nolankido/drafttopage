// Temporary preview-only validation. This file must never be merged.
import './build-content.mjs';
import { readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const tests = readdirSync('tests').filter(name => name.endsWith('.test.js')).sort().map(name => 'tests/' + name);
console.log('Preview-only full Node regression suite: ' + tests.length + ' files.');
execFileSync(process.execPath, ['--test', ...tests], { stdio: 'inherit', timeout: 200000 });
execFileSync(process.execPath, ['scripts/check.mjs'], { stdio: 'inherit', timeout: 60000 });
