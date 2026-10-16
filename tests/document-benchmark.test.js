import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url), fixtures = new URL('./fixtures/documents/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('manifest.json', fixtures)));

test('The document corpus has immutable source identities, retained licenses, and explicit acceptance scope', () => {
  const names = new Set();
  for (const fixture of manifest.fixtures) {
    assert.match(fixture.file, /^[a-z0-9-]+\.(docx|html|md)$/);
    assert.equal(names.has(fixture.file), false); names.add(fixture.file);
    const bytes = readFileSync(new URL(fixture.file, fixtures));
    assert.equal(bytes.length, fixture.bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), fixture.sha256, fixture.file);
    assert.match(fixture.revision, /^[a-f0-9]{40}$/);
    assert.ok(fixture.source.startsWith('https://github.com/') && fixture.source.includes('/blob/' + fixture.revision + '/'));
    assert.match(fixture.license, /^(MAMMOTH|LEXICAL)-LICENSE\.txt$/);
    assert.match(readFileSync(new URL(fixture.license, fixtures), 'utf8'), /Copyright/);
    assert.ok(fixture.provenance.length > 60);
  }
  const files = readdirSync(fixtures).filter(name => /\.(docx|html|md)$/.test(name));
  assert.deepEqual(files.sort(), [...names].sort());
  assert.equal(new Set(manifest.cases.map(item => item.id)).size, manifest.cases.length);
  for (const item of manifest.cases) {
    assert.ok(names.has(item.file));
    const expected = item.expect;
    assert.ok(['preserved', 'disclosed', 'rejected', 'sampled'].includes(expected.category));
    if (expected.category === 'rejected') assert.ok(expected.error && item.ui, 'Rejections must exercise preservation through the UI');
    else if (expected.category === 'sampled') assert.ok(expected.passages.length >= 3 && !expected.text, 'Sampled checks cannot claim exact text fidelity');
    else assert.ok(expected.text);
    if (expected.category === 'disclosed') assert.ok(expected.warnings.length);
  }
  assert.equal(names.size, 13); assert.equal(manifest.cases.length, 15);
});

test('Word corpus origin metadata and source content are inspected with independent ZIP/XML readers', () => {
  const result = JSON.parse(execFileSync('python3', ['-c', String.raw`
import sys,json,zipfile,xml.etree.ElementTree as E
from pathlib import Path
p=Path(sys.argv[1]);m=json.loads((p/'manifest.json').read_text());out=[]
for f in m['fixtures']:
 if not f['file'].endswith('.docx'):continue
 with zipfile.ZipFile(p/f['file']) as z:
  assert z.testzip() is None
  app=E.fromstring(z.read('docProps/app.xml'))
  assert next(n.text for n in app.iter() if n.tag.endswith('}Application'))=='Microsoft Office Word'
  document=E.fromstring(z.read('word/document.xml'))
  out.append({'name':f['file'],'namespace':document.tag.split('}')[0][1:]})
print(json.dumps(out))
`, fileURLToPath(fixtures)], { cwd: fileURLToPath(root), encoding: 'utf8' }));
  assert.equal(result.length, 9);
  assert.equal(result.filter(item => item.namespace === 'http://schemas.openxmlformats.org/wordprocessingml/2006/main').length, 8);
  assert.equal(result.find(item => item.name === 'word-strict-format.docx').namespace, 'http://purl.oclc.org/ooxml/wordprocessingml/main');
});

test('Independent benchmark checks reject lost text, changed links, omitted disclosures, and active output', () => {
  const result = execFileSync('python3', ['-c', String.raw`
import base64,copy,io,zipfile
from scripts.document_benchmark import check_conversion
def word(text):
 b=io.BytesIO()
 with zipfile.ZipFile(b,'w') as z:z.writestr('word/document.xml','<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>'+text+'</w:t></w:r></w:p></w:body></w:document>')
 return base64.b64encode(b.getvalue()).decode()
html='<p>Alpha <a href="https://example.test/">Beta</a></p>'
good={'wordpress':html,'html':html,'word':word('Alpha Beta'),'draft':{'title':''},'warnings':['Placement was simplified.'],'findings':[]}
wanted={'text':'Alpha Beta','links':[{'text':'Beta','href':'https://example.test/'}],'warnings':['Placement was simplified']}
assert check_conversion(good,wanted)['textCheck']=='exact'
bad=[]
v=copy.deepcopy(good);v['word']=word('Alpha');bad.append(v)
v=copy.deepcopy(good);v.update(wordpress='<p>Alpha</p>',html='<p>Alpha</p>',word=word('Alpha'));bad.append(v)
v=copy.deepcopy(good);v['wordpress']=html.replace('example.test','wrong.test');bad.append(v)
v=copy.deepcopy(good);v['warnings']=[];bad.append(v)
v=copy.deepcopy(good);v['html']=html+'<script></script>';bad.append(v)
v=copy.deepcopy(good);v['wordpress']=html.replace('https://example.test/','javascript:alert(1)');bad.append(v)
for v in bad:
 try:check_conversion(v,wanted)
 except AssertionError:pass
 else:raise AssertionError('Corrupted evidence was accepted')
print('6 corrupted output cases rejected')
`], { cwd: fileURLToPath(root), encoding: 'utf8' });
  assert.equal(result.trim(), '6 corrupted output cases rejected');
});
