import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createHTMLSource } from '../public/html-export.js';
import { createWordPressArticle } from '../public/wordpress-export.js';
import { createWordDocument } from '../public/word-export.js';

// Exercise real export modules against an independently specified contract.
// This is not a source-app capture, native WordPress paste, or a rendered UI.
test('Actual compound exports satisfy the independent semantic and package contract', () => {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const draft = { title: 'Fictional semantic export', body: [
    '## Scope', '', 'Keep **important** wording.', '', '4. First', '5. Second', '',
    '| Name | Count |', '| --- | --- |', '| Alpha | 2 |', '', 'Final sentinel 928.'
  ].join('\n') };
  const wanted = {
    title: draft.title,
    text: 'Scope Keep important wording. First Second Name Count Alpha 2 Final sentinel 928.',
    headings: [{ level: 2, text: 'Scope' }], listStarts: [4], listItems: ['First', 'Second'],
    rows: [['Name', 'Count'], ['Alpha', '2']],
    tableGroups: [{ rows: [['Name', 'Count'], ['Alpha', '2']], cellTags: [['th', 'th'], ['td', 'td']] }],
    inlineMarks: { strong: ['important'], em: [], code: [] }, wordStructure: true
  };
  const result = {
    draft, warnings: [], findings: [],
    html: createHTMLSource(draft), wordpress: createWordPressArticle(draft).html,
    word: Buffer.from(createWordDocument(draft)).toString('base64')
  };
  const response = JSON.parse(execFileSync('python3', ['-c',
    "import json,sys; from scripts.document_benchmark import check_conversion; p=json.load(sys.stdin); print(json.dumps(check_conversion(p['result'],p['wanted'])))"
  ], { cwd: root, input: JSON.stringify({ result, wanted }), encoding: 'utf8',
    timeout: 45000, maxBuffer: 1024 * 1024 }));
  assert.equal(response.textCheck, 'exact');
  assert.match(response.wordStructure, /independent Word/);
  assert.match(response.inlineMarks, /Word run properties/);
});
