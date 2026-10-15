import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { wordTreesToMarkdown, WORD_NS } from '../public/docx-import.js';

const W = WORD_NS, R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const xml = body => '<w:document xmlns:w="' + W + '" xmlns:r="' + R + '"><w:body>' + body + '</w:body></w:document>';
const run = (text, props = '') => '<w:r>' + (props ? '<w:rPr>' + props + '</w:rPr>' : '') + '<w:t>' + text + '</w:t></w:r>';
const para = (text, props = '') => '<w:p>' + (props ? '<w:pPr>' + props + '</w:pPr>' : '') + run(text) + '</w:p>';
const word = (tag, body) => '<w:' + tag + ' xmlns:w="' + W + '">' + body + '</w:' + tag + '>';
function fixture(body = para('Fictional writing'), more = {}) {
  const result = {
    '[Content_Types].xml': '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    '_rels/.rels': '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="main" Type="' + R + '/officeDocument" Target="word/document.xml"/></Relationships>',
    'word/document.xml': xml(body), ...more
  };
  if (!Object.hasOwn(more, 'word/_rels/document.xml.rels') && ['styles', 'numbering'].some(n => Object.hasOwn(more, 'word/' + n + '.xml'))) result['word/_rels/document.xml.rels'] = '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + ['styles', 'numbering'].filter(n => Object.hasOwn(more, 'word/' + n + '.xml')).map(n => '<Relationship Id="' + n + '" Type="' + R + '/' + n + '" Target="' + n + '.xml"/>').join('') + '</Relationships>';
  return result;
}
function python(code, input) {
  const result = spawnSync('python3', ['-c', code], { input: JSON.stringify(input), encoding: 'utf8', maxBuffer: 24 * 1024 * 1024 });
  assert.equal(result.status, 0, result.stderr); return JSON.parse(result.stdout);
}
function zip(parts = fixture(), stored = false) {
  return new Uint8Array(python('import sys,json,io,zipfile\nv=json.load(sys.stdin); b=io.BytesIO()\nwith zipfile.ZipFile(b,"w",compression=zipfile.ZIP_STORED if v["stored"] else zipfile.ZIP_DEFLATED) as z:\n for n,c in v["parts"].items(): z.writestr(n,bytes(c) if isinstance(c,list) else c)\nprint(json.dumps(list(b.getvalue())))', { parts: Object.fromEntries(Object.entries(parts).map(([name, value]) => [name, value instanceof Uint8Array ? Array.from(value) : value])), stored }));
}
// Independent XML parser supplies namespace-aware trees for pure conversion tests.
function trees(parts) {
  const raw = python('import sys,json,xml.etree.ElementTree as E\ndef node(n):\n ns,name=n.tag[1:].split("}") if n.tag.startswith("{") else ("",n.tag)\n return {"ns":ns,"name":name,"attrs":n.attrib,"text":n.text or "","children":[{"node":node(c),"tail":c.tail or ""} for c in n]}\nprint(json.dumps({k:node(E.fromstring(v)) for k,v in json.load(sys.stdin).items()}))', parts);
  const text = value => ({ nodeType: 3, nodeValue: value, get textContent() { return value; }, childNodes: [] });
  function adapt(v) {
    const childNodes = [text(v.text)];
    for (const c of v.children) childNodes.push(adapt(c.node), text(c.tail));
    return { nodeType: 1, namespaceURI: v.ns, localName: v.name, childNodes,
      getAttribute: key => v.attrs[key] ?? null,
      getAttributeNS: (ns, key) => v.attrs['{' + ns + '}' + key] ?? null,
      get textContent() { return childNodes.map(n => n.textContent).join(''); } };
  }
  return new Map(Object.entries(raw).map(([key, value]) => [key, adapt(value)]));
}
function create(name) {
  const attrs = {}, node = { nodeType: 1, localName: name, childNodes: [],
    setAttribute: (key, value) => { attrs[key] = value; }, getAttribute: key => attrs[key] ?? null, hasAttribute: key => Object.hasOwn(attrs, key),
    append(...nodes) { node.childNodes.push(...nodes.map(n => typeof n === 'string' ? { nodeType: 3, nodeValue: n, childNodes: [] } : n)); } };
  return node;
}
const convert = (parts, options) => wordTreesToMarkdown(trees(parts), options, create);
const numbering = (format = 'decimal', extra = '') => word('numbering', '<w:abstractNum w:abstractNumId="0">' + [0, 1, 2, 3, 4, 5].map(i => '<w:lvl w:ilvl="' + i + '"><w:start w:val="4"/><w:numFmt w:val="' + format + '"/><w:lvlText w:val="%' + (i + 1) + '."/>' + extra + '</w:lvl>').join('') + '</w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>');
const item = (text, level = 0) => para(text, '<w:numPr><w:ilvl w:val="' + level + '"/><w:numId w:val="1"/></w:numPr>');

export { W, R, xml, run, para, word, fixture, python, zip, trees, create, convert, numbering, item };
