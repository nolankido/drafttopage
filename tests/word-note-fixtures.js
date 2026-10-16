import { W, R, run, para, fixture } from './docx-fixtures.js';

const ref = (kind = 'footnote', id = 7, extra = '') => '<w:r><w:' + kind + 'Reference w:id="' + id + '"' + extra + '/></w:r>';
const note = (id, body, kind = 'footnote', type = '') => '<w:' + kind + ' w:id="' + id + '"' + (type ? ' w:type="' + type + '"' : '') + '>' + body + '</w:' + kind + '>';
const mark = kind => '<w:r><w:' + kind + 'Ref/></w:r>';
const p = content => '<w:p>' + content + '</w:p>';
const rel = (id, type, target, mode = '') => '<Relationship Id="' + id + '" Type="' + R + '/' + type + '" Target="' + target + '"' + (mode ? ' TargetMode="' + mode + '"' : '') + '/>';
const rels = content => '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + content + '</Relationships>';
function notesFixture(body = p(run('Article') + ref()), footnotes = note(7, p(mark('footnote') + run('A source note.'))), endnotes) {
  const parts = fixture(body), links = [];
  for (const [kind, content] of [['footnote', footnotes], ['endnote', endnotes]]) if (content !== undefined && content !== null) {
    const name = kind + 's';
    parts['word/' + name + '.xml'] = '<w:' + name + ' xmlns:w="' + W + '" xmlns:r="' + R + '">' + content + '</w:' + name + '>';
    parts['[Content_Types].xml'] = parts['[Content_Types].xml'].replace('</Types>', '<Override PartName="/word/' + name + '.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.' + name + '+xml"/></Types>');
    links.push(rel(name, name, name + '.xml'));
  }
  parts['word/_rels/document.xml.rels'] = rels(links.join(''));
  return parts;
}

export { notesFixture, ref, note, mark, p, rel, rels };
