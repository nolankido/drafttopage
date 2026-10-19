"""Local verifier unit tests, not native WordPress acceptance."""
import copy
import json
from pathlib import Path
import sys
import tempfile

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import wordpress_compound_contract as contract


def fixture(start=1, implicit=False):
    html = ('<h2>Editorial safeguards</h2><p>The draft stays private.</p>' +
            ('<ol>' if implicit else '<ol start="' + str(start) + '">') +
            '<li>First</li><li>Second</li></ol>' +
            '<table><tr><th>Name</th><th>Count</th></tr><tr><td>Alpha</td><td>2</td></tr></table>')
    expected = {
        'wordStructure': True,
        'headings': [{'level': 2, 'text': 'Editorial safeguards'}],
        'tableGroups': [{'rows': [['Name', 'Count'], ['Alpha', '2']], 'cellTags': [['th', 'th'], ['td', 'td']]}],
        'listStarts': [start], 'listItems': ['First', 'Second']
    }
    attributes = {'ordered': True}
    if not implicit:
        attributes['start'] = start
    blocks = {'all': [{'name': 'core/list', 'attributes': attributes},
                      {'name': 'core/list-item', 'attributes': {'content': 'First'}},
                      {'name': 'core/list-item', 'attributes': {'content': 'Second'}}]}
    return {'content': {'raw': html, 'rendered': html}}, blocks, expected


def main():
    report = {'scope': 'synthetic WordPress verifier controls; real WordPress NOT_RUN',
              'positive': [], 'negative': [], 'errors': []}
    for name, start, implicit in [('implicit-one', 1, True), ('explicit-one', 1, False), ('explicit-four', 4, False)]:
        post, blocks, expected = fixture(start, implicit)
        contract.check_post_structure(post, expected)
        contract.check_blocks_structure(blocks, expected)
        report['positive'].append(name)
    post, blocks, expected = fixture(1, True)
    for representation in ['raw', 'rendered']:
        for name, before, after in [
            ('bulleted-list', '<ol>', '<ul>'),
            ('wrong-start', '<ol>', '<ol start="4">'),
            ('reversed-list', '<ol>', '<ol reversed>'),
            ('lettered-list', '<ol>', '<ol type="a">'),
            ('item-override', '<li>First', '<li value="8">First'),
            ('lost-header', '<th>Name</th><th>Count</th>', '<td>Name</td><td>Count</td>'),
            ('split-table', '</tr><tr><td>Alpha', '</tr></table><table><tr><td>Alpha'),
            ('merged-cell', '<th>Name', '<th colspan="2">Name'),
            ('heading-demoted', '<h2>Editorial safeguards</h2>', '<p>Editorial safeguards</p>'),
            ('heading-boundary', '<h2>Editorial safeguards</h2><p>The draft stays private.</p>',
                '<h2>Editorial safeguards The draft</h2><p>stays private.</p>')
        ]:
            damaged = copy.deepcopy(post)
            assert before in damaged['content'][representation]
            damaged['content'][representation] = damaged['content'][representation].replace(before, after)
            if name == 'bulleted-list':
                damaged['content'][representation] = damaged['content'][representation].replace('</ol>', '</ul>')
            label = representation + '-' + name
            try:
                contract.check_post_structure(damaged, expected)
            except AssertionError:
                report['negative'].append(label)
            else:
                report['errors'].append(label)
    for name, attributes in [
        ('store-bullets', {'ordered': False}), ('store-implicit-bullets', {}),
        ('store-reset-start', {'ordered': True, 'start': 4}),
        ('store-string-start', {'ordered': True, 'start': '1'}),
        ('store-boolean-start', {'ordered': True, 'start': True})
    ]:
        damaged = copy.deepcopy(blocks)
        damaged['all'][0]['attributes'] = attributes
        try:
            contract.check_blocks_structure(damaged, expected)
        except AssertionError:
            report['negative'].append(name)
        else:
            report['errors'].append(name)
    old_root = contract.ROOT
    try:
        with tempfile.TemporaryDirectory() as directory:
            contract.ROOT = Path(directory)
            path = contract.ROOT / 'tests/fixtures/documents/authored-cases.json'
            path.parent.mkdir(parents=True)
            corpus = {'version': 1, 'origin': 'authored-synthetic', 'cases': [
                {'id': source_id, 'expect': expected} for source_id in contract.SOURCE_IDS]}
            path.write_text(json.dumps(corpus), encoding='utf-8')
            for source_id in contract.SOURCE_IDS:
                case = {'sourceFixture': source_id}
                contract.check_compound_post(post, case)
                contract.check_compound_blocks(blocks, case)
                report['positive'].append('wired-' + source_id)
            for name, damaged in [('wrong-origin', dict(corpus, origin='customer')),
                                  ('duplicate-id', dict(corpus, cases=corpus['cases'] + [corpus['cases'][0]]))]:
                path.write_text(json.dumps(damaged), encoding='utf-8')
                try:
                    contract.compound_expectations({'sourceFixture': contract.SOURCE_IDS[0]})
                except AssertionError:
                    report['negative'].append(name)
                else:
                    report['errors'].append(name)
    finally:
        contract.ROOT = old_root
    report.update(result='FAIL' if report['errors'] else 'PASS', positiveCount=len(report['positive']),
                  negativeCount=len(report['negative']))
    print(json.dumps(report, indent=2))
    return 1 if report['errors'] else 0


if __name__ == '__main__':
    raise SystemExit(main())
