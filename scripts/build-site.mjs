// Temporary full validation hook, never merge.
import { readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
await import('./build-content.mjs');
const tests=readdirSync('tests').filter(name=>name.endsWith('.test.js')).sort().map(name=>'tests/'+name);
console.log('Offline Node regression: '+tests.length+' test files.');
execFileSync(process.execPath,['--test',...tests],{stdio:'inherit',timeout:240000});
execFileSync(process.execPath,['scripts/check.mjs'],{stdio:'inherit',timeout:60000});
