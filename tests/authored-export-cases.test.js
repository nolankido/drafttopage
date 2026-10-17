import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { parseArticleImport } from '../public/article-import.js';
import { createWordPressArticle } from '../public/wordpress-export.js';
import { createHTMLSource } from '../public/html-export.js';
import { createWordDocument } from '../public/word-export.js';

// Authored inputs are fictional regression probes, not genuine source-app captures.
const authored = JSON.parse(readFileSync(new URL('./fixtures/documents/authored-cases.json', import.meta.url), 'utf8'));
const VERIFY = String.raw`
import json,sys
from scripts.document_benchmark import check_conversion
cases=json.load(sys.stdin)
for case in cases:
 try:
  check_conversion(case['result'],case['expect'])
 except Exception as error:
  raise AssertionError(case['id']+': '+str(error)) from error
print(str(len(cases))+' independent 3-format export comparisons passed')
`;

test('Authored probes execute the actual Markdown importer and independently check the three export formats', () => {
  assert.equal(authored.origin, 'authored-synthetic');
  const accepted = [];
  let rejected = 0;
  for (const item of authored.cases) {
    if (item.expect.category === 'rejected') {
      assert.throws(
        () => parseArticleImport(item.source, item.id + '.md', 'markdown'),
        error => typeof error?.message === 'string' && error.message.includes(item.expect.error),
        item.id + ' must reject for the independently specified reason'
      );
      rejected++;
      continue;
    }
    const imported = parseArticleImport(item.source, item.id + '.md', 'markdown');
    const draft = imported.draft;
    assert.deepEqual(imported.unmapped, [], item.id + ' must not silently drop page fields');
    const wordpress = createWordPressArticle(draft).html;
    const html = createHTMLSource(draft);
    const word = Buffer.from(createWordDocument(draft)).toString('base64');
    accepted.push({
      id: item.id,
      expect: item.expect,
      result: { draft, warnings: imported.warnings, wordpress, html, word, findings: [], imageReferences: 0 }
    });
  }
  assert.equal(accepted.length, 17);
  assert.equal(rejected, 5);
  const report = execFileSync('python3', ['-c', VERIFY], {
    input: JSON.stringify(accepted), encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024, timeout: 45000
  });
  assert.match(report.trim(), /^17 independent 3-format export comparisons passed$/);
});
