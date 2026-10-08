import { readFile, readdir, access } from 'node:fs/promises';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { appPage, loginPage, unavailablePage } from '../src/pages.js';
async function files(dir) {
  return (await Promise.all((await readdir(dir, { withFileTypes: true })).map(e => e.isDirectory() ? files(join(dir, e.name)) : join(dir, e.name)))).flat();
}
const sourceFiles = (await Promise.all(['src', 'public', 'scripts', 'tests'].map(files))).flat();
for (const file of sourceFiles.filter(p => /\.(m?js)$/.test(p))) execFileSync(process.execPath, ['--check', file]);
const pages = [appPage, loginPage, unavailablePage, ...await Promise.all(sourceFiles.filter(p => p.endsWith('.html')).map(p => readFile(p, 'utf8')))];
for (const page of pages) {
  assert.equal((page.match(/<h1\b/g) || []).length, 1, 'One h1 per page');
  const ids = [...page.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
  assert.equal(new Set(ids).size, ids.length, 'Unique IDs');
  assert.ok(!page.includes('\u2014'), 'No em dashes');
  for (const [, href] of page.matchAll(/(?:href|src)="([^"]+)"/g)) {
    if (href.startsWith('#')) assert.ok(ids.includes(href.slice(1)), `Missing anchor ${href}`);
    else if (href.startsWith('/') && href !== '/pilot' && !href.startsWith('/api/')) {
      const path = `public${href}${href.endsWith('/') ? 'index.html' : ''}`;
      await access(path);
    }
  }
}
const config = JSON.parse(await readFile('wrangler.jsonc', 'utf8'));
assert.equal(config.name, 'drafttopage'); assert.equal(config.main, 'src/worker.js');
assert.equal(config.assets.binding, 'ASSETS');
assert.deepEqual(config.assets.run_worker_first, ['/pilot', '/pilot/*', '/api/*']);
assert.ok(config.migrations[0].new_sqlite_classes.includes('PilotQuota'));
assert.equal(config.observability.enabled, false);
assert.ok(!config.vars, 'No secrets or deployment activation flags in source');
const ui = await readFile('public/pilot.js', 'utf8');
assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML|localStorage|sessionStorage|eval\(/.test(ui));
for (const file of sourceFiles.filter(p => p.startsWith('src/'))) assert.ok(!/console\.(log|warn|error)/.test(await readFile(file, 'utf8')), `No production content logging in ${file}`);
console.log(`Static checks passed: ${pages.length} HTML pages, script syntax, links, routing, and no persistent browser storage or production console logging.`);
