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
              'word': pack({'word/document.xml': document, 'word/numbering.xml': numbering}),
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
    cases = []
    for output in ['html', 'wordpress']:
        for name, before, after in [
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
                  expectedPositiveCount=12, expectedNegativeCount=len(cases))
    print(json.dumps(report, indent=2))
    return 1 if report['errors'] else 0


if __name__ == '__main__':
    raise SystemExit(main())
