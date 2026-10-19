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

test('Independent quote checks reject HTML tag loss and corrupted Word quote, link, and inline-mark XML', () => {
  const result = execFileSync('python3', ['-c', String.raw`
import base64,copy,io,zipfile
from scripts.document_benchmark import check_conversion
W='http://schemas.openxmlformats.org/wordprocessingml/2006/main'
R='http://schemas.openxmlformats.org/officeDocument/2006/relationships'
P='http://schemas.openxmlformats.org/package/2006/relationships'
def archive(parts):
 output=io.BytesIO()
 with zipfile.ZipFile(output,'w') as z:
  for name,content in parts.items():z.writestr(name,content)
 return base64.b64encode(output.getvalue()).decode()
def run(text,props=''):
 return '<w:r>'+('<w:rPr>'+props+'</w:rPr>' if props else '')+'<w:t xml:space="preserve">'+text+'</w:t></w:r>'
body=(run('Keep ')+run('bold','<w:b/>')+run(', ')+run('italic','<w:i/>')+run(', ')+
      run('sample()','<w:rStyle w:val="CodeChar"/>')+run(', and ')+run('old','<w:strike/>')+
      run('. Read ')+'<w:hyperlink r:id="rIdCitation">'+run('source','<w:b/>')+'</w:hyperlink>'+run('.'))
document='<w:document xmlns:w="'+W+'" xmlns:r="'+R+'"><w:body><w:p><w:pPr><w:pStyle w:val="Quote"/></w:pPr>'+body+'</w:p><w:p>'+run('Final sentinel.')+'</w:p></w:body></w:document>'
rels='<Relationships xmlns="'+P+'"><Relationship Id="rIdCitation" Type="'+R+'/hyperlink" Target="https://example.test/quote" TargetMode="External"/></Relationships>'
html='<blockquote><p>Keep <strong>bold</strong>, <em>italic</em>, <code>sample()</code>, and <s>old</s>. Read <a href="https://example.test/quote"><strong>source</strong></a>.</p></blockquote><p>Final sentinel.</p>'
good={'wordpress':html,'html':html,'word':archive({'word/document.xml':document,'word/_rels/document.xml.rels':rels}),
      'draft':{'title':''},'warnings':[],'findings':[]}
link={'text':'source','href':'https://example.test/quote'}
quote='Keep bold, italic, sample(), and old. Read source.'
wanted={'text':quote+' Final sentinel.','quotes':[quote],
        'inlineMarks':{'strong':['bold','source'],'em':['italic'],'code':['sample()']},
        'strikes':['old'],'links':[link],'wordLinks':[link]}
checks=check_conversion(good,wanted)
assert all(key in checks for key in ['quotes','inlineMarks','wordLinks','strikethrough'])
bad=[]
for output,tag in [('wordpress','blockquote'),('html','strong'),('html','em'),('html','code')]:
 value=copy.deepcopy(good)
 value[output]=html.replace('<'+tag+'>','<span>').replace('</'+tag+'>','</span>')
 bad.append(value)
def corrupt_word(part,old,new):
 value=copy.deepcopy(good)
 with zipfile.ZipFile(io.BytesIO(base64.b64decode(value['word']))) as z:
  parts={name:z.read(name).decode() for name in z.namelist()}
 assert old in parts[part], 'The negative control must alter existing output'
 parts[part]=parts[part].replace(old,new)
 value['word']=archive(parts)
 bad.append(value)
for old,new in [('<w:pStyle w:val="Quote"/>',''),('<w:b/>','<w:b w:val="0"/>'),
                ('<w:i/>',''),('w:val="CodeChar"','w:val="Normal"'),
                ('<w:strike/>',''),('r:id="rIdCitation"','r:id="rIdMissing"')]:
 corrupt_word('word/document.xml',old,new)
corrupt_word('word/_rels/document.xml.rels','https://example.test/quote','https://wrong.test/quote')
corrupt_word('word/_rels/document.xml.rels','TargetMode="External"','TargetMode="Internal"')
assert len(bad)==12
for value in bad:
 try:check_conversion(value,wanted)
 except AssertionError:pass
 else:raise AssertionError('Corrupted quote fidelity evidence was accepted')
print('12 quote, link, and inline-mark corruptions rejected')
`], { cwd: fileURLToPath(root), encoding: 'utf8' });
  assert.equal(result.trim(), '12 quote, link, and inline-mark corruptions rejected');
});

test('Authored regression probes are explicit, independent of historical source provenance, and bounded', () => {
  const authored = JSON.parse(readFileSync(new URL('authored-cases.json', fixtures), 'utf8'));
  assert.equal(authored.version, 1);
  assert.equal(authored.origin, 'authored-synthetic');
  assert.match(authored.scope, /not application-origin captures/i);
  assert.equal(authored.cases.length, 29);
  assert.equal(manifest.cases.length + authored.cases.length, 44);
  const ids = new Set(manifest.cases.map(item => item.id));
  let rejected = 0, withStructure = 0, withUI = 0;
  const kinds = { md: 0, html: 0, docx: 0 };
  for (const item of authored.cases) {
    assert.match(item.id, /^authored-[a-z0-9-]+$/);
    assert.equal(ids.has(item.id), false, 'A pinned corpus ID was reused.');
    ids.add(item.id);
    assert.ok(['md', 'html', 'docx'].includes(item.kind));
    kinds[item.kind]++;
    assert.equal(typeof item.source, 'string');
    assert.ok(item.source.trim());
    assert.ok(Buffer.byteLength(item.source, 'utf8') <= 512 * 1024);
    assert.ok(typeof item.reason === 'string' && item.reason.length > 45, 'Explain why this authored probe matters.');
    assert.deepEqual(Object.keys(item).sort().filter(k => !['id', 'kind', 'source', 'expect', 'reason', 'ui', ...(item.kind === 'docx' ? ['numbering', 'relationships'] : [])].includes(k)), []);
    if (item.kind === 'docx') {
      assert.equal(item.ui, true);
      assert.equal(item.numbering, true);
      assert.ok(item.source.includes('<w:p>') && item.source.includes('<w:tbl>'));
      assert.ok(item.relationships.every(link => link.id && link.target.startsWith('https://')));
    }
    assert.ok(['preserved', 'disclosed', 'rejected'].includes(item.expect.category));
    assert.equal(typeof item.ui === 'undefined' || typeof item.ui === 'boolean', true);
    if (item.ui) withUI++;
    if (item.expect.category === 'rejected') {
      rejected++;
      assert.ok(typeof item.expect.error === 'string' && item.expect.error.length > 8);
    } else {
      assert.ok(typeof item.expect.text === 'string' && item.expect.text.length > 0);
      if (item.expect.category === 'disclosed') assert.ok(Array.isArray(item.expect.warnings) && item.expect.warnings.length);
      if (['rows', 'listItems', 'listPaths', 'links', 'strikes', 'quotes', 'inlineMarks', 'wordLinks'].some(key => key in item.expect)) withStructure++;
      for (const key of ['quotes', 'wordLinks']) if (key in item.expect) assert.ok(Array.isArray(item.expect[key]));
      if ('wordStructure' in item.expect) {
        assert.ok(['docx', 'html'].includes(item.kind));
        assert.equal(item.expect.wordStructure, true);
        assert.ok(item.expect.rows?.length && item.expect.listItems?.length);
        assert.equal(item.expect.tableGroups?.length, 1);
        assert.deepEqual(item.expect.tableGroups[0].rows, item.expect.rows);
        assert.deepEqual(item.expect.tableGroups[0].cellTags[0], item.expect.rows[0].map(() => 'th'));
        assert.ok(item.expect.tableGroups[0].cellTags.slice(1).every(row => row.every(tag => tag === 'td')));
        assert.equal(item.expect.listStarts?.length, 1);
        assert.ok(Number.isInteger(item.expect.listStarts[0]) && item.expect.listStarts[0] >= 1);
        assert.ok(item.expect.headings?.length);
        assert.ok(item.expect.headings.every(h => h.level === 2 && typeof h.text === 'string' && h.text.length));
      }
      if ('inlineMarks' in item.expect) {
        assert.deepEqual(Object.keys(item.expect.inlineMarks).filter(key => !['strong', 'em', 'code'].includes(key)), []);
        for (const marks of Object.values(item.expect.inlineMarks)) assert.ok(Array.isArray(marks) && marks.every(text => typeof text === 'string'));
      }
    }
  }
  assert.deepEqual(kinds, { md: 22, html: 6, docx: 1 });
  assert.ok(withUI >= 8);
  assert.equal(rejected, 6);
  assert.ok(withStructure >= 5, 'Keep meaningful structural assertions instead of text-only probes.');
  assert.equal(ids.size, 44);
});

test('Authored DOCX source builds as deterministic, independent synthetic ZIP', () => {
  const output = execFileSync('python3', ['-c', String.raw`
import io,json,sys,zipfile,xml.etree.ElementTree as ET
from scripts.document_benchmark import build_authored_docx
with open(sys.argv[1],encoding='utf-8') as file:
    corpus=json.load(file)
case=next(x for x in corpus['cases'] if x['id']=='authored-compound-docx-article')
a=build_authored_docx(case)
b=build_authored_docx(case)
assert a==b
assert len(a)<8*1024*1024
with zipfile.ZipFile(io.BytesIO(a)) as z:
    assert z.testzip() is None
    assert 'word/document.xml' in z.namelist()
    assert 'word/numbering.xml' in z.namelist()
    assert 'word/_rels/document.xml.rels' in z.namelist()
    content_types=ET.fromstring(z.read('[Content_Types].xml'))
    types_ns='{http://schemas.openxmlformats.org/package/2006/content-types}'
    overrides={x.get('PartName'):x.get('ContentType') for x in content_types.findall(types_ns+'Override')}
    defaults={x.get('Extension'):x.get('ContentType') for x in content_types.findall(types_ns+'Default')}
    assert overrides['/word/numbering.xml']=='application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml'
    assert overrides['/word/document.xml']=='application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml'
    assert defaults['rels']=='application/vnd.openxmlformats-package.relationships+xml'
    assert defaults['xml']=='application/xml'
    content=ET.fromstring(z.read('word/document.xml'))
    t=''.join((n.text or '') for n in content.iter() if n.tag.endswith('}t'))
    assert 'harbor 924.' in t
    assert '日本語' in t
    assert 'private addresses' in t
assert 'Microsoft Word' not in corpus['scope']
bad=dict(case, relationships=[{'id':'x','target':'javascript:unsafe'}])
try:build_authored_docx(bad)
except AssertionError:pass
else:raise AssertionError('unsafe relationship accepted')
print('deterministic synthetic DOCX ZIP valid')
`, new URL('./fixtures/documents/authored-cases.json', import.meta.url).pathname], {
    cwd: fileURLToPath(root), encoding: 'utf8', timeout: 45000
  });
  assert.equal(output.trim(), 'deterministic synthetic DOCX ZIP valid');
});
