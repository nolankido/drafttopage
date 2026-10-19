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

test('Every authored Markdown probe executes its importer and independently checks the three export formats', () => {
  assert.equal(authored.origin, 'authored-synthetic');
  const accepted = [];
  let rejected = 0, htmlCases = 0, docxCases = 0;
  for (const item of authored.cases) {
    assert.ok(['md', 'html', 'docx'].includes(item.kind), item.id + ' must declare a supported source format');
    if (item.kind === 'docx') {
      assert.equal(item.ui, true, 'Synthetic DOCX must run the actual file import path in the browser corpus');
      assert.match(item.source, /<w:p>/);
      assert.ok(item.relationships?.length);
      docxCases++;
      continue;
    }
    if (item.kind === 'html') {
      // The browser corpus uses the actual detached HTML parser and native file
      // input. Never reinterpret an HTML probe as Markdown in this Node loop.
      assert.equal(item.ui, true, item.id + ' must run HTML import review or rejection in the browser corpus');
      htmlCases++;
      continue;
    }
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
  assert.equal(htmlCases, 6);
  assert.equal(docxCases, 1);
  const report = execFileSync('python3', ['-c', VERIFY], {
    input: JSON.stringify(accepted), encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024, timeout: 45000
  });
  assert.match(report.trim(), /^17 independent 3-format export comparisons passed$/);
});

test('Authored HTML quote probes explicitly cover preservation, disclosed loss, and review-safe rejection', () => {
  const htmlCases = authored.cases.filter(item => item.id.startsWith('authored-html-quote-'));
  assert.deepEqual(htmlCases.map(item => item.id), [
    'authored-html-quote-inline-citation',
    'authored-html-quote-nested-disclosure',
    'authored-html-quote-hidden-unsafe',
    'authored-html-quote-checklist-rejected'
  ]);
  for (const item of htmlCases) {
    assert.equal(item.ui, true);
    assert.match(item.source, /<blockquote>/);
    assert.ok(Buffer.byteLength(item.source, 'utf8') < 2048, 'Keep these regression probes small and independently reviewable');
    if (item.expect.category === 'rejected') assert.match(item.expect.error, /Checklist/);
    else {
      assert.ok(item.expect.quotes.length > 0, 'Accepted HTML quote cases need actual quote structure assertions');
      assert.match(item.expect.text, /Final .* sentinel:/, 'Keep a final paragraph as a truncation guard');
    }
  }
  const fidelity = htmlCases[0].expect;
  assert.deepEqual(Object.keys(fidelity.inlineMarks).sort(), ['code', 'em', 'strong']);
  assert.deepEqual(fidelity.wordLinks, fidelity.links);
  assert.deepEqual(fidelity.strikes, ['old']);
});
