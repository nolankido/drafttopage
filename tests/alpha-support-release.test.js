import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('Support issue route offers safe issue template and explicit converter input',()=>{
  const page=read('scripts/alpha-support-page.mjs'),template=read('.github/ISSUE_TEMPLATE/alpha_bug_report.md');
  const build=read('scripts/build-content.mjs');
  assert.match(build,/add\('\/help\/alpha-support\/'/);
  for(const name of ['alpha-diagnostic-copy','alpha-diagnostic-converter','alpha-diagnostic-text'])assert.ok(page.includes('id="'+name+'"'));
  for(const name of ['Source and destination','Step','Expected','Observed','Fictional reproduction','writing']) assert.ok(template.includes(name),name);
  assert.match(page,/private support route has not been selected/);
});
test('Content-free diagnostics never read a document or browse browser storage',()=>{
  const code=read('public/alpha-support.js'),shell=read('scripts/site-shell.mjs');
  assert.match(shell,/alpha-release-turn9-20261017/);
  assert.doesNotMatch(code,/localStorage|sessionStorage|indexedDB|\.search\b|\.hash\b|fetch\(|XMLHttpRequest|sendBeacon|readText\(/);
  assert.match(code,/addEventListener\('click'/);
  assert.match(code,/not collected/);
});
test('Operator release instructions and historic PRs are explicitly bounded',()=>{
  const ops=read('docs/alpha/RELEASE_OPERATIONS.md'),release=read('docs/alpha/RELEASE_20261017.md');
  for(const name of ['verify:release','verify:alpha','rollback','GitHub Actions','PR #47','PR #3']) assert.ok(ops.toLowerCase().includes(name.toLowerCase()),name);
  assert.match(release,/NOT_RUN/);
  assert.match(release,/f8dada29721c188097c09bfa85dc0a83c9cdc010/);
});
