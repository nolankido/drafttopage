import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

test('Editing benchmark fixture builders and statistics are bounded and deterministic without a browser dependency', () => {
  const checked = JSON.parse(execFileSync('python3', ['-c', `
import ast,json,math,statistics
from pathlib import Path
tree=ast.parse(Path('scripts/editing_benchmark.py').read_text())
selected=[node for node in tree.body if isinstance(node,ast.FunctionDef) and node.name in ['article','stats'] or isinstance(node,ast.Assign) and any(isinstance(target,ast.Name) and target.id in ['ordinary','rich'] for target in node.targets)]
assert len(selected)==4
env={'math':math,'statistics':statistics}
exec(compile(ast.Module(body=selected,type_ignores=[]),'<actual benchmark helpers>','exec'),env)
ordinary,rich=env['article'](env['ordinary']),env['article'](env['rich'])
assert 58000<len(ordinary)<59000 and 58000<len(rich)<59000
assert env['article'](env['ordinary'])==ordinary and env['article'](env['rich'])==rich
for unit in [env['ordinary'],env['rich']]:
 unique=env['article'](unit,True);assert 58000<len(unique)<59000
 blocks=unique.split('\\n\\n');assert len(blocks)>200 and len(set(blocks))==len(blocks)
 assert env['article'](unit,True)==unique
assert ordinary.count('fictional')>200 and rich.count('## Fictional heading')>200
assert all(mark in rich for mark in ['**bold**','*italic*','~~old wording~~','https://example.test/guide','| --- | --- |','- First item'])
assert env['stats']([1.111,2.222,3.333])=={'median':2.22,'p95':3.33,'max':3.33}
assert env['stats'](list(range(1,21)))=={'median':10.5,'p95':19,'max':20}
print(json.dumps({'ordinary':len(ordinary),'rich':len(rich)}))
`], { encoding: 'utf8' }));
  assert.deepEqual(checked, { ordinary: 58918, rich: 58833 });
});

test('Editing diagnostics stay explicitly local, optional and source-bound rather than enforcing noisy timing targets', () => {
  const source=readFileSync('scripts/editing_benchmark.py','utf8');
  assert.match(source,/https:\/\/drafttopage\.test/);
  assert.match(source,/u\.netloc!='drafttopage\.test'.*unexpectedRequests.*r\.abort/);
  assert.match(source,/context\.route\('\*\*\/\*',route\)/);
  assert.match(source,/page\.keyboard\.insert_text\('x'\)/);
  assert.match(source,/public_digest\(\)==report\['publicSha256'\]/);
  assert.match(source,/output\.unlink\(missing_ok=True\)/);
  assert.match(source,/3 <= args\.samples <= 100/);
  assert.match(source,/not real-user latency/);
  assert.match(source,/--link-inventory.*choices=\['closed','open'\],default='closed'/);
  assert.match(source,/'linkInventory':args\.link_inventory/);
  assert.match(source,/to_have_count\(40 if args\.link_inventory=='open' and kind=='rich' else 0\)/);
  assert.match(source,/--unique-blocks.*action='store_true'/);
  assert.match(source,/'uniqueBlocks':args\.unique_blocks/);
  assert.doesNotMatch(source,/pip install|npm install|requests\.|urllib\.request|localStorage|sendBeacon/);
  assert.doesNotMatch(readFileSync('scripts/verify-release.mjs','utf8'),/editing_benchmark|benchmark:editing/);
});
