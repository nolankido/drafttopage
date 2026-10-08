import { readFile, readdir, access } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
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
  assert.equal(new Set(ids).size, ids.length, 'Unique IDs'); assert.ok(!page.includes('\u2014'), 'No em dashes');
  for (const [, references] of page.matchAll(/aria-(?:labelledby|describedby)="([^"]+)"/g)) {
    for (const id of references.split(/\s+/)) assert.ok(ids.includes(id), `Missing accessible reference ${id}`);
  }
  for (const [, href] of page.matchAll(/(?:href|src)="([^"]+)"/g)) {
    if (href.startsWith('#')) assert.ok(ids.includes(href.slice(1)), `Missing anchor ${href}`);
    else if (href.startsWith('/')) {
      assert.ok(!href.startsWith('//'), 'No protocol-relative assets or links');
      const url = new URL(href, 'https://drafttopage.com');
      if (url.pathname === '/pilot' || url.pathname.startsWith('/api/')) continue;
      assert.equal(url.search, '', 'No public query-string links carrying content');
      const path = `public${url.pathname}${url.pathname.endsWith('/') ? 'index.html' : ''}`;
      await access(path);
      if (url.hash) {
        const target = await readFile(path, 'utf8');
        assert.ok(target.includes(`id="${decodeURIComponent(url.hash.slice(1))}"`), `Missing cross-page anchor ${href}`);
      }
    }
  }
}
const config = JSON.parse(await readFile('wrangler.jsonc', 'utf8'));
assert.equal(config.name, 'drafttopage'); assert.equal(config.main, 'src/worker.js');
assert.equal(config.build.command, 'node scripts/build-site.mjs');
assert.equal(config.assets.binding, 'ASSETS');
assert.deepEqual(config.assets.run_worker_first, ['/pilot', '/pilot/*', '/api/*']);
assert.ok(config.migrations[0].new_sqlite_classes.includes('PilotQuota'));
assert.equal(config.observability.enabled, false);
assert.deepEqual(config.previews.durable_objects.bindings, config.durable_objects.bindings);
assert.equal(config.previews.observability.enabled, false);
assert.ok(!config.previews.vars, 'No activation secrets in preview configuration');
assert.ok(!config.vars, 'No secrets or deployment activation flags in source');
for (const path of sourceFiles.filter(p => p.startsWith('public/') && p.endsWith('.js'))) {
  const ui = await readFile(path, 'utf8');
  assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML|localStorage|sessionStorage|indexedDB|eval\(/.test(ui), `No persistent browser storage or executable HTML insertion: ${path}`);
  for (const [, dependency] of ui.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
    assert.ok(dependency.startsWith('./'), `Local browser import required: ${dependency}`);
    const target = resolve(dirname(path), dependency);
    assert.ok(target.startsWith(resolve('public') + '/'), 'Browser module stays in public assets');
    await access(target);
  }
}
for (const file of sourceFiles.filter(p => p.startsWith('src/'))) assert.ok(!/console\.(log|warn|error)/.test(await readFile(file, 'utf8')), `No production content logging in ${file}`);
console.log(`Static checks passed: ${pages.length} HTML pages, script syntax, assets, anchors, accessible references, browser imports, protected routing, and storage/logging guards.`);
