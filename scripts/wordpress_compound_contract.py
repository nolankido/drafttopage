"""Exact synthetic compound expectations for the real WordPress runner.

The fixtures are author-written test data, never customer or source-app evidence.
This module does not start WordPress, modify a post, or contact a service.
"""
import json
from pathlib import Path
from document_benchmark import ArticleHTML

ROOT = Path(__file__).resolve().parent.parent
SOURCE_IDS = ('authored-compound-docx-article', 'authored-compound-docs-style-html')


def compound_expectations(case):
    source_id = case.get('sourceFixture')
    if source_id is None:
        return None
    assert source_id in SOURCE_IDS, 'Unknown compound source contract'
    corpus = json.loads((ROOT / 'tests/fixtures/documents/authored-cases.json').read_text(encoding='utf-8'))
    assert corpus.get('version') == 1 and corpus.get('origin') == 'authored-synthetic', 'Invalid compound source provenance'
    matches = [item for item in corpus['cases'] if item.get('id') == source_id]
    assert len(matches) == 1, 'Compound source contract must exist exactly once'
    expected = matches[0]['expect']
    assert expected.get('wordStructure') is True, 'Compound structural expectations are required'
    for key in ['tableGroups', 'headings', 'listStarts', 'listItems']:
        assert isinstance(expected.get(key), list) and expected[key], 'Missing compound ' + key + ' expectation'
    return expected


def check_post_structure(post, expected):
    for representation in ['raw', 'rendered']:
        article = ArticleHTML(post['content'][representation])
        assert not article.numbering_issues, 'WordPress ' + representation + ' has unsupported list numbering'
        assert not article.table_issues, 'WordPress ' + representation + ' has merged table cells'
        assert article.ordered_starts == expected['listStarts'], 'WordPress ' + representation + ' ordered-list starts or type changed'
        assert article.items == expected['listItems'], 'WordPress ' + representation + ' list items changed'
        assert article.table_groups == expected['tableGroups'], 'WordPress ' + representation + ' table groups or header cells changed'
        assert article.headings == expected['headings'], 'WordPress ' + representation + ' heading text or boundaries changed'


def check_blocks_structure(blocks, expected):
    lists = [block for block in blocks['all'] if block['name'] == 'core/list']
    assert len(lists) == len(expected['listStarts']), 'WordPress compound list count changed'
    starts = []
    for block in lists:
        attributes = block['attributes']
        assert attributes.get('ordered') is True, 'WordPress numbered list became bullets'
        start = attributes.get('start')
        if start is None:
            start = 1
        assert type(start) is int, 'WordPress list start must be numeric'
        starts.append(start)
    assert starts == expected['listStarts'], 'WordPress effective ordered-list starts changed'
    assert sum(block['name'] == 'core/list-item' for block in blocks['all']) == len(expected['listItems']), 'WordPress compound list-item count changed'


def check_compound_post(post, case):
    expected = compound_expectations(case)
    if expected is not None:
        check_post_structure(post, expected)


def check_compound_blocks(blocks, case):
    expected = compound_expectations(case)
    if expected is not None:
        check_blocks_structure(blocks, expected)
