"""Fictional failure-injection tests for the independent export verifier.

These test the verifier itself, not a browser, source app or WordPress site.
Each damaged specimen keeps its text but changes one meaningful structure.
No network, credentials, real writing, or product-generated expectations.
"""
import base64
import copy
import io
import json
from pathlib import Path
import sys
import zipfile

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from document_benchmark import check_conversion

W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
P = 'http://schemas.openxmlformats.org/package/2006/relationships'
C = 'http://schemas.openxmlformats.org/package/2006/content-types'


def pack(parts):
    output = io.BytesIO()
    with zipfile.ZipFile(output, 'w', compression=zipfile.ZIP_STORED) as archive:
        for name, text in parts.items():
            item = zipfile.ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
            archive.writestr(item, text.encode('utf-8'))
    return base64.b64encode(output.getvalue()).decode('ascii')


def fixture(start=4, header_value=None):
    def p(text, properties=''):
        return '<w:p>' + ('<w:pPr>' + properties + '</w:pPr>' if properties else '') + '<w:r><w:t>' + text + '</w:t></w:r></w:p>'
    def cell(text):
        return '<w:tc>' + p(text) + '</w:tc>'
    num_pr = '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>'
    flag = '<w:tblHeader/>' if header_value is None else '<w:tblHeader w:val="' + header_value + '"/>'
    document = ('<w:document xmlns:w="' + W + '"><w:body>' +
                p('Scope', '<w:pStyle w:val="Heading2"/>') +
                p('First', num_pr) + p('Second', num_pr) +
                '<w:tbl><w:tr><w:trPr>' + flag + '</w:trPr>' + cell('Name') + cell('Count') + '</w:tr>' +
                '<w:tr>' + cell('Alpha') + cell('2') + '</w:tr></w:tbl>' +
                p('Final sentinel 928.') + '</w:body></w:document>')
    numbering = ('<w:numbering xmlns:w="' + W + '"><w:abstractNum w:abstractNumId="0">' +
                 '<w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/>' +
                 '<w:lvlText w:val="%1."/></w:lvl></w:abstractNum><w:num w:numId="1">' +
                 '<w:abstractNumId w:val="0"/><w:lvlOverride w:ilvl="0">' +
                 '<w:startOverride w:val="' + str(start) + '"/></w:lvlOverride></w:num></w:numbering>')
    html = ('<h2>Scope</h2><ol start="' + str(start) + '"><li>First</li><li>Second</li></ol>' +
            '<table><tr><th>Name</th><th>Count</th></tr><tr><td>Alpha</td><td>2</td></tr></table>' +
            '<p>Final sentinel 928.</p>')
    result = {'wordpress': html, 'html': html,
              'word': pack({
                  '[Content_Types].xml': ('<Types xmlns="' + C + '">'
                      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
                      '<Default Extension="xml" ContentType="application/xml"/>'
                      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
                      '<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>'
                      '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>'),
                  '_rels/.rels': ('<Relationships xmlns="' + P + '"><Relationship Id="document" Type="' + R +
                      '/officeDocument" Target="word/document.xml"/></Relationships>'),
                  'word/document.xml': document,
                  'word/numbering.xml': numbering,
                  'word/styles.xml': ('<w:styles xmlns:w="' + W + '"><w:style w:type="paragraph" w:styleId="Heading2">'
                      '<w:name w:val="heading 2"/><w:pPr><w:outlineLvl w:val="1"/></w:pPr></w:style></w:styles>'),
                  'word/_rels/document.xml.rels': ('<Relationships xmlns="' + P + '"><Relationship Id="numbering" Type="' + R +
                      '/numbering" Target="numbering.xml"/><Relationship Id="styles" Type="' + R +
                      '/styles" Target="styles.xml"/></Relationships>')
              }),
              'draft': {'title': 'Fictional verifier control'}, 'warnings': [], 'findings': []}
    wanted = {'text': 'Scope First Second Name Count Alpha 2 Final sentinel 928.',
              'rows': [['Name', 'Count'], ['Alpha', '2']], 'listItems': ['First', 'Second'],
              'tableGroups': [{'rows': [['Name', 'Count'], ['Alpha', '2']],
                               'cellTags': [['th', 'th'], ['td', 'td']]}],
              'headings': [{'level': 2, 'text': 'Scope'}], 'listStarts': [start], 'wordStructure': True}
    return result, wanted


def word_change(result, part, before, after):
    changed = copy.deepcopy(result)
    with zipfile.ZipFile(io.BytesIO(base64.b64decode(result['word']))) as archive:
        parts = {name: archive.read(name).decode('utf-8') for name in archive.namelist()}
    assert before in parts[part], 'Mutation must change an existing source fragment'
    parts[part] = parts[part].replace(before, after)
    changed['word'] = pack(parts)
    return changed


def without_part(result, part):
    changed = copy.deepcopy(result)
    with zipfile.ZipFile(io.BytesIO(base64.b64decode(result['word']))) as archive:
        parts = {name: archive.read(name).decode('utf-8') for name in archive.namelist() if name != part}
    changed['word'] = pack(parts)
    return changed


def main():
    report = {'scope': 'synthetic verifier failure injection only', 'positive': [], 'negative': [], 'errors': []}
    for start in [1, 4, 7]:
        for enabled in [None, '1', 'true', 'on']:
            name = 'valid-start-' + str(start) + '-header-' + str(enabled)
            result, wanted = fixture(start, enabled)
            try:
                check_conversion(result, wanted)
                report['positive'].append(name)
            except Exception as error:
                report['errors'].append({'name': name, 'reason': str(error)})
    good, wanted = fixture()
    variants = []
    for output in ['html', 'wordpress']:
        for name, before, after in [
            ('explicit-decimal-type', '<ol start="4">', '<ol start="4" type="1">'),
            ('unit-cell-span', '<th>Name', '<th colspan="1" rowspan="1">Name')
        ]:
            valid = copy.deepcopy(good)
            valid[output] = valid[output].replace(before, after)
            variants.append((output + '-' + name, valid))
    variants += [
        ('word-absolute-numbering-target', word_change(good, 'word/_rels/document.xml.rels',
            'Target="numbering.xml"', 'Target="/word/numbering.xml"')),
        ('word-explicit-internal-numbering', word_change(good, 'word/_rels/document.xml.rels',
            'Target="numbering.xml"', 'Target="numbering.xml" TargetMode="Internal"')),
        ('word-unit-grid-span', word_change(good, 'word/document.xml', '<w:tc>',
            '<w:tc><w:tcPr><w:gridSpan w:val="1"/></w:tcPr>'))
    ]
    for name, valid in variants:
        try:
            check_conversion(valid, wanted)
            report['positive'].append(name)
        except Exception as error:
            report['errors'].append({'name': name, 'reason': str(error)})
    cases = []
    for output in ['html', 'wordpress']:
        for name, before, after in [
            ('reversed-numbering', '<ol start="4">', '<ol start="4" reversed>'),
            ('false-reversed-is-still-reversed', '<ol start="4">', '<ol start="4" reversed="false">'),
            ('alphabetic-numbering', '<ol start="4">', '<ol start="4" type="a">'),
            ('roman-numbering', '<ol start="4">', '<ol start="4" type="I">'),
            ('item-value-override', '<li>First', '<li value="9">First'),
            ('item-type-override', '<li>First', '<li type="A">First'),
            ('cell-colspan', '<th>Name', '<th colspan="2">Name'),
            ('cell-rowspan', '<td>Alpha', '<td rowspan="2">Alpha'),
            ('cell-rowspan-to-end', '<td>Alpha', '<td rowspan="0">Alpha'),
            ('duplicate-cell-span', '<td>Alpha', '<td colspan="2" colspan="1">Alpha'),
            ('changed-list-start', 'start="4"', 'start="1"'),
            ('heading-demoted', '<h2>Scope</h2>', '<p>Scope</p>'),
            ('heading-level-changed', '<h2>Scope</h2>', '<h3>Scope</h3>'),
            ('header-cells-lost', '<th>Name</th><th>Count</th>', '<td>Name</td><td>Count</td>'),
            ('split-table', '</tr><tr><td>Alpha', '</tr></table><table><tr><td>Alpha'),
            ('missing-ending', '<p>Final sentinel 928.</p>', '')
        ]:
            damaged = copy.deepcopy(good)
            assert before in damaged[output]
            damaged[output] = damaged[output].replace(before, after)
            cases.append((output + '-' + name, damaged))
    for name, part, before, after in [
        ('word-empty-list-label', 'word/numbering.xml', '<w:lvlText w:val="%1."/>', '<w:lvlText w:val=""/>'),
        ('word-constant-list-label', 'word/numbering.xml', '<w:lvlText w:val="%1."/>', '<w:lvlText w:val="."/>'),
        ('word-wrong-level-label', 'word/numbering.xml', '<w:lvlText w:val="%1."/>', '<w:lvlText w:val="%2."/>'),
        ('word-missing-list-label', 'word/numbering.xml', '<w:lvlText w:val="%1."/>', ''),
        ('word-grid-span', 'word/document.xml', '<w:tc>', '<w:tc><w:tcPr><w:gridSpan w:val="2"/></w:tcPr>'),
        ('word-vertical-merge', 'word/document.xml', '<w:tc>', '<w:tc><w:tcPr><w:vMerge w:val="restart"/></w:tcPr>'),
        ('word-vertical-continue', 'word/document.xml', '<w:tc>', '<w:tc><w:tcPr><w:vMerge/></w:tcPr>'),
        ('word-horizontal-merge', 'word/document.xml', '<w:tc>', '<w:tc><w:tcPr><w:hMerge w:val="restart"/></w:tcPr>'),
        ('word-extra-grid-position', 'word/document.xml', '<w:trPr>', '<w:trPr><w:gridBefore w:val="1"/>'),
        ('word-numbering-relation-missing', 'word/_rels/document.xml.rels',
            '<Relationship Id="numbering" Type="' + R + '/numbering" Target="numbering.xml"/>', ''),
        ('word-numbering-relation-external', 'word/_rels/document.xml.rels',
            'Target="numbering.xml"', 'Target="numbering.xml" TargetMode="External"'),
        ('word-numbering-relation-target', 'word/_rels/document.xml.rels',
            'Target="numbering.xml"', 'Target="orphan.xml"'),
        ('word-numbering-type-missing', '[Content_Types].xml',
            '<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>', ''),
        ('word-numbering-type-wrong', '[Content_Types].xml',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml', 'application/xml'),
        ('word-main-target-wrong', '_rels/.rels', 'Target="word/document.xml"', 'Target="word/other.xml"'),
        ('word-start-reset', 'word/numbering.xml', '<w:startOverride w:val="4"/>', '<w:startOverride w:val="1"/>'),
        ('word-start-override-lost', 'word/numbering.xml', '<w:startOverride w:val="4"/>', ''),
        ('word-heading-demoted', 'word/document.xml', 'w:val="Heading2"', 'w:val="Normal"'),
        ('word-heading-level-changed', 'word/document.xml', 'w:val="Heading2"', 'w:val="Heading3"'),
        ('word-list-flattened', 'word/document.xml', '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>', ''),
        ('word-header-lost', 'word/document.xml', '<w:tblHeader/>', ''),
        ('word-table-split', 'word/document.xml', '</w:tr><w:tr><w:tc>', '</w:tr></w:tbl><w:tbl><w:tr><w:tc>'),
        ('word-wrong-list-reference', 'word/document.xml', '<w:numId w:val="1"/>', '<w:numId w:val="99"/>'),
        ('word-missing-heading-style', 'word/document.xml', '<w:pStyle w:val="Heading2"/>', '')
    ]:
        cases.append((name, word_change(good, part, before, after)))
    for value in ['0', 'false', 'off', 'invalid']:
        cases.append(('word-disabled-or-invalid-header-' + value,
                      word_change(good, 'word/document.xml', '<w:tblHeader/>', '<w:tblHeader w:val="' + value + '"/>')))
    cases.append(('word-duplicate-header-flags', word_change(good, 'word/document.xml', '<w:tblHeader/>',
                  '<w:tblHeader/><w:tblHeader w:val="false"/>')))
    for part in ['[Content_Types].xml', 'word/_rels/document.xml.rels', '_rels/.rels']:
        cases.append(('word-missing-package-part-' + part, without_part(good, part)))
    for name, damaged in cases:
        try:
            check_conversion(damaged, wanted)
        except AssertionError as error:
            report['negative'].append({'name': name, 'rejectedBy': str(error)})
        except Exception as error:
            report['errors'].append({'name': name, 'reason': 'Unexpected exception: ' + str(error)})
        else:
            report['errors'].append({'name': name, 'reason': 'Damaged export was incorrectly accepted'})
    report.update(result='FAIL' if report['errors'] else 'PASS',
                  positiveCount=len(report['positive']), negativeCount=len(report['negative']),
                  expectedPositiveCount=19, expectedNegativeCount=len(cases))
    print(json.dumps(report, indent=2))
    return 1 if report['errors'] else 0


if __name__ == '__main__':
    raise SystemExit(main())
