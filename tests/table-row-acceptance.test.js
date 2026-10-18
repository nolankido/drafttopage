import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

test('Table row responsive acceptance is parsed by Python without creating compiled artifacts', () => {
  execFileSync('python3', ['-c', 'import ast,pathlib;ast.parse(pathlib.Path("scripts/table_row_acceptance.py").read_text(encoding="utf-8"))']);
});
test('The full routed browser gate and optional fast path share one actual responsive scenario', () => {
  const source=readFileSync('scripts/browser-smoke.py','utf8');
  assert.match(source,/--table-rows-only/);
  assert.equal(source.match(/run_table_row_acceptance\(open_page, report, open_details\)/g)?.length,2);
  const scenario=readFileSync('scripts/table_row_acceptance.py','utf8');
  for(const required of ["'width': 390", "'width': 320", "'width': 1440", "#table-move-to", "#table-insert-before", "#table-apply", "#download-wordpress"]) {
    assert.ok(scenario.includes(required), 'Missing real layout or content scenario '+required);
  }
  assert.match(scenario,/documentElement\.scrollWidth/);
  assert.match(scenario,/document\.activeElement/);
});
test('The new arrangement controls fit narrow pages without moving the grid scrolling to document level', () => {
  const css=readFileSync('public/desk.css','utf8');
  assert.match(css,/#table-row-arrange\{box-sizing:border-box;width:100%;max-width:100%;min-width:0/);
  assert.match(css,/#table-row-arrange button\{max-width:100%;min-width:0;white-space:normal/);
  assert.match(css,/#table-row-arrange select\{box-sizing:border-box;width:100%;min-width:0;max-width:100%/);
  assert.match(css,/\.table-edit-grid\{max-width:100%;overflow-x:auto/);
});
