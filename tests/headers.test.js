import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
test('Public CSP allows local modules but no external connections or unsafe script execution', async () => {
  const headers = await readFile('public/_headers', 'utf8');
  assert.match(headers, /script-src 'self';/);
  assert.match(headers, /connect-src 'none';/);
  assert.match(headers, /object-src 'none';/);
  assert.match(headers, /frame-ancestors 'none';/);
  assert.doesNotMatch(headers, /unsafe-inline|unsafe-eval/);
});
