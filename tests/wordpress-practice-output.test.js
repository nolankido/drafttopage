// Build-time integration checks, not browser or real WordPress acceptance.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

test('Built WordPress page points to the generated Word sample and preserves its practice section', () => {
  const page = readFileSync('public/word-to-wordpress/index.html', 'utf8');
  const ids = [...page.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(ids.length, new Set(ids).size);
  for (const id of ['download-word-practice', 'word-practice', 'word-practice-steps', 'word-practice-expected',
    'start-sample', 'start-word-file', 'import-file', 'import-preview', 'reviewed', 'copy-wordpress']) assert.ok(ids.includes(id), id);
  assert.match(page, /<details id="word-practice">/);
  assert.match(page, /href="\/samples\/word-to-markdown\.docx" download=/);
  assert.match(page, /data-workspace="word-to-wordpress"/);
  assert.ok(page.indexOf('id="import-panel"') < page.indexOf('id="word-practice"'));
  assert.doesNotMatch(page, /<!--ENTRY_IMPORT-->|<!--WORKFLOW_NAVIGATION-->/);
});

test('Actual built fictional DOCX matches the practice guide title, heading, emphasis, link, list and final table', () => {
  const result = execFileSync('python3', ['-c', String.raw`
import sys,zipfile,xml.etree.ElementTree as ET,json
W='{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
R='{http://schemas.openxmlformats.org/officeDocument/2006/relationships}'
P='{http://schemas.openxmlformats.org/package/2006/relationships}'
with zipfile.ZipFile(sys.argv[1]) as z:
 if z.testzip() is not None:raise ValueError('invalid Word sample')
 doc=ET.fromstring(z.read('word/document.xml'))
 rels=ET.fromstring(z.read('word/_rels/document.xml.rels'))
 nums=ET.fromstring(z.read('word/numbering.xml'))
 text=lambda node: ''.join(t.text or '' for t in node.iter(W+'t'))
 paragraphs=list(doc.iter(W+'p'))
 visible=[text(p) for p in paragraphs if text(p)]
 expected=['A small publishing plan','Before publishing','Keep clear structure and source links.',
           'Review the article.','Preview the destination.','Step','Status','Review','Ready','Publish','Planned']
 if visible!=expected:raise ValueError('sample content differs from the practice guide')
 heading=paragraphs[1].find(W+'pPr/'+W+'pStyle')
 if heading is None or heading.get(W+'val')!='Heading2':raise ValueError('sample H2 changed')
 bold=[text(r) for r in doc.iter(W+'r') if r.find(W+'rPr/'+W+'b') is not None]
 if bold!=['clear structure']:raise ValueError('sample explicit bold changed')
 links=list(doc.iter(W+'hyperlink'))
 targets={r.get('Id'):r.get('Target') for r in rels.findall(P+'Relationship')}
 if len(links)!=1 or text(links[0])!='source links' or targets.get(links[0].get(R+'id'))!='https://example.com/':raise ValueError('sample source link changed')
 listed=[p for p in paragraphs if p.find(W+'pPr/'+W+'numPr') is not None]
 if [text(p) for p in listed]!=['Review the article.','Preview the destination.']:raise ValueError('sample list content changed')
 num_ids={p.find(W+'pPr/'+W+'numPr/'+W+'numId').get(W+'val') for p in listed}
 if len(num_ids)!=1:raise ValueError('sample list split')
 num=next(n for n in nums.findall(W+'num') if n.get(W+'numId') in num_ids)
 initial=num.find(W+'lvlOverride/'+W+'startOverride')
 if initial is None or initial.get(W+'val')!='1':raise ValueError('sample numbering changed')
 abstract_id=num.find(W+'abstractNumId').get(W+'val')
 abstract=next(a for a in nums.findall(W+'abstractNum') if a.get(W+'abstractNumId')==abstract_id)
 level=next(l for l in abstract.findall(W+'lvl') if l.get(W+'ilvl')=='0')
 if level.find(W+'numFmt').get(W+'val')!='decimal':raise ValueError('sample list is no longer numbered')
 tables=list(doc.iter(W+'tbl'))
 if len(tables)!=1:raise ValueError('sample table grouping changed')
 rows=tables[0].findall(W+'tr')
 if [[text(c) for c in row.findall(W+'tc')] for row in rows]!=[['Step','Status'],['Review','Ready'],['Publish','Planned']]:raise ValueError('sample table changed')
 if rows[0].find(W+'trPr/'+W+'tblHeader') is None:raise ValueError('sample table header missing')
 if any('/media/' in n for n in z.namelist()):raise ValueError('practice sample unexpectedly contains images')
 print(json.dumps({'source':'existing app-generated DOCX','visibleParagraphs':len(visible),'tables':1,'listItems':2,'result':'PASS'}))
`, 'public/samples/word-to-markdown.docx'], { encoding: 'utf8', timeout: 10000 });
  assert.deepEqual(JSON.parse(result), { source: 'existing app-generated DOCX', visibleParagraphs: 11, tables: 1, listItems: 2, result: 'PASS' });
});
