import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { configuration, roundTripCases } from '../scripts/wordpress-roundtrip-cases.mjs';

const expected = ['authored-compound-docx-article','authored-compound-docs-style-html'];

test('Isolated WordPress acceptance includes both real source-parser routes with synthetic-only provenance', () => {
  const cases = configuration.cases.filter(item => item.sourceFixture);
  assert.deepEqual(cases.map(item => item.sourceFixture), expected);
  assert.deepEqual(cases.map(item => item.sourceRoute), ['/word-to-wordpress/','/google-docs-to-wordpress/']);
  assert.ok(cases.every(item => item.inputMode === 'native-visual-paste'));
  assert.ok(cases.every(item => item.sourceLabel.includes('Synthetic') && !item.file));
  assert.ok(cases.every(item => item.top.length >= 6 && item.text.includes('Final') || item.text.includes('harbor 924.')));
  for (const item of roundTripCases().filter(x => x.sourceFixture)) {
    assert.equal(item.html, undefined, 'Do not pre-generate source blocks instead of exercising native file import');
  }
});
test('Synthetic fixture loader has deterministic identities, valid DOCX and no network', () => {
  const result = execFileSync('python3', ['-c', String.raw`
import io, json, sys, zipfile, xml.etree.ElementTree as ET
from pathlib import Path
sys.path.insert(0, str(Path('scripts').resolve()))
from wordpress_source_fixtures import SOURCES, load_wordpress_source_fixture
root=Path('.').resolve()
info={}
for key, (kind,mime) in SOURCES.items():
 a=load_wordpress_source_fixture(root,key)
 b=load_wordpress_source_fixture(root,key)
 assert a['input']['buffer']==b['input']['buffer']
 assert a['sha256']==b['sha256'] and len(a['sha256'])==64
 assert a['input']['name']==key+'.'+kind and a['input']['mimeType']==mime
 assert a['origin']=='authored-synthetic'
 if kind=='docx':
  with zipfile.ZipFile(io.BytesIO(a['input']['buffer'])) as z:
   assert z.testzip() is None
   assert 'word/numbering.xml' in z.namelist()
   document=ET.fromstring(z.read('word/document.xml'))
   assert document.tag.endswith('}document')
 else:
  assert b'Final publishing sentinel:' in a['input']['buffer']
 info[key]={'sha256':a['sha256'],'bytes':len(a['input']['buffer'])}
for invalid in ['../../home','word-single-paragraph.docx','authored-cjk','']:
 try:load_wordpress_source_fixture(root,invalid)
 except ValueError:pass
 else:raise AssertionError('Unknown input accepted')
print(json.dumps(info))
`], { encoding:'utf8', timeout:45000 });
  const data=JSON.parse(result);
  assert.deepEqual(Object.keys(data), expected);
  assert.ok(Object.values(data).every(item => /^[a-f0-9]{64}$/.test(item.sha256) && item.bytes > 100));
  for (const file of ['scripts/wordpress_source_fixtures.py','scripts/wordpress_roundtrip.py']) {
    const code=readFileSync(file,'utf8');
    assert.doesNotMatch(code,/urllib\.request|requests\.get|fetch\(|localStorage|sessionStorage/);
  }
});
