"""Offline corpus checks using the product's real browser modules and import UI.

Pinned upstream artifacts and separately labeled fictional Markdown/HTML probes
use expectations reviewed from source text and the documented conversion contract,
never regenerated from our output.
"""
import base64
import hashlib
import io
import json
import re
import time
import zipfile
import xml.etree.ElementTree as ET
from html.parser import HTMLParser
from pathlib import Path

if __package__:
    from .word_style_contract import numbering_index, resolved_word_headings
else:
    from word_style_contract import numbering_index, resolved_word_headings


def normalized(text):
    return re.sub(r'\s+', ' ', text).strip()


class ArticleHTML(HTMLParser):
    """Independent reader: never render source HTML or fetch its resources."""
    def __init__(self, html):
        super().__init__(convert_charrefs=True)
        self.text = []
        self.rows = []
        self.table_groups = []
        self.table_stack = []
        self.headings = []
        self.ordered_starts = []
        self.numbering_issues = []
        self.table_issues = []
        self.items = []
        self.links = []
        self.strikes = []
        self.quotes = []
        self.inline_marks = {name: [] for name in ['strong', 'em', 'code']}
        self.active = []
        self.unsafe = []
        self.images = 0
        self.list_paths = []
        self.list_stack = []
        self.list_item_stack = []
        self.top_lists = 0
        self.feed(html)

    def handle_starttag(self, tag, attrs):
        # Keep parsing broad enough for diagnostics, but never certify custom
        # numbering or a merged grid merely because plain text survived.
        seen = set()
        for name, value in attrs:
            if name in seen:
                if tag in ['ol', 'li'] and name in ['start', 'reversed', 'type', 'value']:
                    self.numbering_issues.append('duplicate numbering attribute')
                if tag in ['th', 'td'] and name in ['rowspan', 'colspan']:
                    self.table_issues.append('duplicate cell span attribute')
            seen.add(name)
        attrs = dict(attrs)
        if tag == 'ol':
            if 'reversed' in attrs:
                self.numbering_issues.append('reversed ordered list')
            if 'type' in attrs and attrs['type'] != '1':
                self.numbering_issues.append('non-decimal ordered list')
        if tag == 'li':
            if 'value' in attrs:
                self.numbering_issues.append('explicit list-item value override')
            if 'type' in attrs and attrs['type'] != '1':
                self.numbering_issues.append('list-item marker type override')
        if tag in ['th', 'td']:
            for name in ['colspan', 'rowspan']:
                if name in attrs and attrs[name] != '1':
                    self.table_issues.append('unsupported ' + name)
        if tag == 'ol':
            raw_start = attrs.get('start', '1')
            assert re.fullmatch(r'[0-9]{1,9}', raw_start), 'Invalid ordered list start in export'
            self.ordered_starts.append(int(raw_start))
        if tag == 'table':
            group = {'rows': [], 'cellTags': []}
            self.table_groups.append(group)
            self.table_stack.append(group)
        if tag in ['ul', 'ol']:
            if self.list_stack and self.list_item_stack:
                parent = self.list_item_stack[-1]['path']
            else:
                parent = [self.top_lists]
                self.top_lists += 1
            self.list_stack.append({'parent': parent, 'next': 0})
        if tag == 'li' and self.list_stack:
            current = self.list_stack[-1]
            item = {'path': current['parent'] + [current['next']], 'text': ''}
            current['next'] += 1
            self.list_paths.append(item)
            self.list_item_stack.append(item)
        if tag in ['script', 'iframe', 'object', 'embed', 'style'] or any(k.startswith('on') for k in attrs):
            self.unsafe.append(tag)
        if tag == 'a' and not re.match(r'^https?://', attrs.get('href', ''), re.I):
            self.unsafe.append('link target')
        if tag == 'img':
            self.images += 1
        if tag in ['p', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'th', 'td', 'pre', 'br']:
            self.text.append(' ')
            for node in self.active:
                if node['tag'] == 'blockquote':
                    node['text'].append(' ')
        if tag == 'tr':
            self.rows.append([])
            if self.table_stack:
                self.table_stack[-1]['rows'].append([])
                self.table_stack[-1]['cellTags'].append([])
        if tag in ['th', 'td', 'li', 'a', 's', 'blockquote', 'strong', 'em', 'code',
                   'h1', 'h2', 'h3', 'h4', 'h5', 'h6']:
            self.active.append({'tag': tag, 'text': [], 'href': attrs.get('href')})

    def handle_data(self, text):
        self.text.append(text)
        if self.list_item_stack:
            self.list_item_stack[-1]['text'] += text
        for node in self.active:
            node['text'].append(text)

    def handle_endtag(self, tag):
        if tag == 'li' and self.list_item_stack:
            item = self.list_item_stack.pop()
            item['text'] = normalized(item['text'])
        if tag in ['ul', 'ol'] and self.list_stack:
            self.list_stack.pop()
        if tag in ['p', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'th', 'td', 'pre']:
            self.text.append(' ')
            for node in self.active:
                if node['tag'] == 'blockquote':
                    node['text'].append(' ')
        for i in range(len(self.active) - 1, -1, -1):
            node = self.active[i]
            if node['tag'] != tag:
                continue
            text = normalized(''.join(node['text']))
            if tag in ['th', 'td']:
                self.rows[-1].append(text)
                if self.table_stack:
                    self.table_stack[-1]['rows'][-1].append(text)
                    self.table_stack[-1]['cellTags'][-1].append(tag)
            elif tag in ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']:
                self.headings.append({'level': int(tag[1]), 'text': text})
            elif tag == 'li':
                self.items.append(text)
            elif tag == 's':
                self.strikes.append(text)
            elif tag == 'blockquote':
                self.quotes.append(text)
            elif tag in self.inline_marks:
                self.inline_marks[tag].append(text)
            elif tag == 'a':
                self.links.append({'text': text, 'href': node['href']})
            self.active.pop(i)
            break
        if tag == 'table' and self.table_stack:
            self.table_stack.pop()


def word_text(encoded):
    """Check the actual exported ZIP with independent Python ZIP/XML readers."""
    with zipfile.ZipFile(io.BytesIO(base64.b64decode(encoded))) as archive:
        assert archive.testzip() is None, 'Exported Word ZIP failed its CRC check'
        root = ET.fromstring(archive.read('word/document.xml'))
        ns = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
        def text(node):
            if node.tag == ns + 't':
                return node.text or ''
            if node.tag in [ns + 'br', ns + 'tab']:
                return ' '
            return ''.join(text(child) for child in node) + (' ' if node.tag == ns + 'p' else '')
        return normalized(text(root))


def check_word_quote_fidelity(encoded, wanted):
    """Inspect only explicitly requested quote, inline-mark, and hyperlink fields."""
    checked = {}
    with zipfile.ZipFile(io.BytesIO(base64.b64decode(encoded))) as archive:
        document = ET.fromstring(archive.read('word/document.xml'))
        ns = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
        relationships = '{http://schemas.openxmlformats.org/officeDocument/2006/relationships}'
        package = '{http://schemas.openxmlformats.org/package/2006/relationships}'

        def text(node):
            return normalized(''.join(' ' if child.tag in [ns + 'br', ns + 'tab'] else child.text or ''
                                      for child in node.iter() if child.tag in [ns + 't', ns + 'br', ns + 'tab']))

        if 'quotes' in wanted:
            quotes = []
            for paragraph in document.iter(ns + 'p'):
                style = paragraph.find(ns + 'pPr/' + ns + 'pStyle')
                if style is not None and style.get(ns + 'val') == 'Quote':
                    quotes.append(text(paragraph))
            assert quotes == wanted['quotes'], 'Word quote paragraph structure changed'
            checked['quotes'] = 'independent HTML blockquotes and Word Quote paragraphs checked'

        if 'inlineMarks' in wanted:
            marks = {name: [] for name in ['strong', 'em', 'code']}
            for run in document.iter(ns + 'r'):
                properties = run.find(ns + 'rPr')
                if properties is None:
                    continue
                for name, property_name in [('strong', 'b'), ('em', 'i')]:
                    prop = properties.find(ns + property_name)
                    if prop is not None and prop.get(ns + 'val', 'true') not in ['0', 'false', 'off']:
                        marks[name].append(text(run))
                style = properties.find(ns + 'rStyle')
                fonts = properties.find(ns + 'rFonts')
                if ((style is not None and style.get(ns + 'val') == 'CodeChar') or
                        (fonts is not None and fonts.get(ns + 'ascii') == fonts.get(ns + 'hAnsi') == 'Courier New')):
                    marks['code'].append(text(run))
            for name, expected in wanted['inlineMarks'].items():
                assert name in marks, 'Unknown inline mark expectation: ' + name
                assert marks[name] == expected, 'Word ' + name + ' inline mark changed'
            checked['inlineMarks'] = 'independent HTML tags and Word run properties checked'

        if 'wordLinks' in wanted:
            relationship_root = ET.fromstring(archive.read('word/_rels/document.xml.rels'))
            targets = {node.get('Id'): node for node in relationship_root.findall(package + 'Relationship')}
            links = []
            for hyperlink in document.iter(ns + 'hyperlink'):
                relation = targets.get(hyperlink.get(relationships + 'id'))
                assert relation is not None, 'Word hyperlink relationship is missing'
                assert relation.get('Type') == relationships[1:-1] + '/hyperlink', 'Word hyperlink relationship type changed'
                assert relation.get('TargetMode') == 'External', 'Word hyperlink external target mode changed'
                target = relation.get('Target', '')
                assert re.match(r'^https?://', target, re.I), 'Word hyperlink target is unsafe'
                links.append({'text': text(hyperlink), 'href': target})
            assert links == wanted['wordLinks'], 'Word hyperlink labels or targets changed'
            checked['wordLinks'] = 'independent Word hyperlink labels and external relationships checked'
    return checked


def check_numbering_package(archive):
    """Verify the canonical package links used by our numbered Word exports.

    This checks package wiring, not arbitrary Word compatibility. It performs
    no relationship fetches and accepts only the exporter's local part paths.
    """
    names = archive.namelist()
    assert len(names) == len(set(names)), 'Word package contains duplicate parts'
    for name in ['[Content_Types].xml', '_rels/.rels', 'word/document.xml',
                 'word/numbering.xml', 'word/_rels/document.xml.rels']:
        assert name in names, 'Word numbering package part is missing: ' + name
    c = '{http://schemas.openxmlformats.org/package/2006/content-types}'
    r = '{http://schemas.openxmlformats.org/package/2006/relationships}'
    office = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/'
    types = ET.fromstring(archive.read('[Content_Types].xml'))
    assert types.tag == c + 'Types', 'Word content-types namespace is invalid'
    expected = {
        '/word/document.xml': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml',
        '/word/numbering.xml': 'application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml',
    }
    for name, mime in expected.items():
        declarations = [item for item in types.findall(c + 'Override') if item.get('PartName') == name]
        assert len(declarations) == 1 and declarations[0].get('ContentType') == mime, 'Word part content type is missing, duplicated or wrong: ' + name
    defaults = [item for item in types.findall(c + 'Default') if item.get('Extension') == 'rels']
    assert len(defaults) == 1 and defaults[0].get('ContentType') == 'application/vnd.openxmlformats-package.relationships+xml', 'Word relationship content type is invalid'
    for part, kind, allowed in [
        ('_rels/.rels', 'officeDocument', ['word/document.xml', '/word/document.xml']),
        ('word/_rels/document.xml.rels', 'numbering', ['numbering.xml', '/word/numbering.xml'])
    ]:
        relationships = ET.fromstring(archive.read(part))
        assert relationships.tag == r + 'Relationships', 'Word relationships namespace is invalid'
        entries = list(relationships)
        assert all(item.tag == r + 'Relationship' and item.get('Id') for item in entries), 'Invalid Word relationship entry'
        assert len({item.get('Id') for item in entries}) == len(entries), 'Word relationship identifiers are duplicated'
        links = [item for item in entries if item.get('Type') == office + kind]
        assert len(links) == 1, 'Word package needs exactly one ' + kind + ' relationship'
        link = links[0]
        assert link.get('Target') in allowed and link.get('TargetMode', 'Internal') == 'Internal', 'Word package relationship target is not its local ' + kind + ' part'


def check_unmerged_word_row(row, ns):
    """The supported compound table contract has no merged or skipped cells."""
    properties = row.findall(ns + 'trPr')
    assert len(properties) <= 1, 'Word row has ambiguous properties'
    for prop in properties:
        for name in ['gridBefore', 'gridAfter']:
            nodes = prop.findall(ns + name)
            assert len(nodes) <= 1 and all(node.get(ns + 'val') == '0' for node in nodes), 'Word table row has skipped grid positions'
    for cell in row.findall(ns + 'tc'):
        properties = cell.findall(ns + 'tcPr')
        assert len(properties) <= 1, 'Word cell has ambiguous properties'
        for prop in properties:
            assert not prop.findall(ns + 'vMerge') and not prop.findall(ns + 'hMerge'), 'Word table has merged cells'
            spans = prop.findall(ns + 'gridSpan')
            assert len(spans) <= 1 and all(span.get(ns + 'val') == '1' for span in spans), 'Word table has a non-unit grid span'


def check_conversion(result, wanted):
    # A compound export claims the complete supported explicit-mark contract.
    # Omitted mark names mean absent, not "unchecked". Do not mutate the oracle.
    if wanted.get('wordStructure'):
        marks = wanted.get('inlineMarks', {})
        assert set(marks) <= {'strong', 'em', 'code'}, 'Unknown compound inline mark expectation'
        wanted = {**wanted, 'inlineMarks': {name: marks.get(name, []) for name in ['strong', 'em', 'code']}}
    checked = {}
    articles = [ArticleHTML(result[key]) for key in ['wordpress', 'html']]
    texts = [normalized(''.join(article.text)) for article in articles]
    texts.append(word_text(result['word']))
    assert texts[0] == texts[1] == texts[2], 'HTML, WordPress, and Word disagree on article text'
    if 'text' in wanted:
        assert texts[0] == wanted['text'], 'Exact article text changed: ' + texts[0]
        checked['textCheck'] = 'exact'
    else:
        position = 0
        for passage in wanted['passages']:
            found = texts[0].find(passage, position)
            assert found >= 0, 'Authored passage missing or out of order: ' + passage
            position = found + len(passage)
        checked['textCheck'] = 'ordered sampled passages'
    if 'title' in wanted:
        assert result['draft']['title'] == wanted['title']
    for warning in wanted.get('warnings', []):
        assert any(warning in text for text in result['warnings']), 'Required loss disclosure missing: ' + warning
    for warning in wanted.get('forbiddenWarnings', []):
        assert not any(warning in text for text in result['warnings']), 'Unexpected loss disclosure: ' + warning
    for article in articles:
        assert not article.unsafe and not article.images, 'Unexpected active HTML or image load'
        if any(key in wanted for key in ['listStarts', 'listItems', 'listPaths']):
            assert not article.numbering_issues, 'HTML list numbering overrides changed: ' + ', '.join(article.numbering_issues)
        if any(key in wanted for key in ['tableGroups', 'rows']):
            assert not article.table_issues, 'HTML table grid changed: ' + ', '.join(article.table_issues)
        for key, actual in [('rows', article.rows), ('tableGroups', article.table_groups),
                            ('headings', article.headings), ('listStarts', article.ordered_starts),
                            ('listItems', article.items), ('listPaths', article.list_paths),
                            ('links', article.links), ('strikes', article.strikes), ('quotes', article.quotes)]:
            if key in wanted:
                assert actual == wanted[key], key + ' structure changed'
        for mark, expected in wanted.get('inlineMarks', {}).items():
            assert mark in article.inline_marks, 'Unknown inline mark expectation: ' + mark
            assert article.inline_marks[mark] == expected, 'HTML ' + mark + ' inline mark changed'
    if any(key in wanted for key in ['quotes', 'inlineMarks', 'wordLinks']):
        checked.update(check_word_quote_fidelity(result['word'], wanted))
    if 'listPaths' in wanted:
        with zipfile.ZipFile(io.BytesIO(base64.b64decode(result['word']))) as archive:
            document = ET.fromstring(archive.read('word/document.xml'))
            ns = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
            items = []
            for paragraph in document.iter(ns + 'p'):
                level = paragraph.find(ns + 'pPr/' + ns + 'numPr/' + ns + 'ilvl')
                if level is not None:
                    items.append({'depth': int(level.get(ns + 'val')), 'text': normalized(''.join(node.text or '' for node in paragraph.iter(ns + 't')))})
            assert items == [{'depth': len(item['path']) - 2, 'text': item['text']} for item in wanted['listPaths']], 'Word list hierarchy or item text changed'
        checked['listHierarchy'] = 'exact HTML parent paths and Word paragraph levels checked'
    if wanted.get('wordStructure'):
        for key in ['rows', 'listItems', 'tableGroups', 'headings', 'listStarts']:
            assert key in wanted, 'Compound Word structure requires explicit ' + key + ' expectations'
        with zipfile.ZipFile(io.BytesIO(base64.b64decode(result['word']))) as archive:
            check_numbering_package(archive)
            document = ET.fromstring(archive.read('word/document.xml'))
            numbering_root = ET.fromstring(archive.read('word/numbering.xml'))
            ns = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
            paragraphs = list(document.iter(ns + 'p'))
            list_rows, list_starts, seen_numbering = [], [], set()
            nums = numbering_index(numbering_root, 'num', 'numId')
            abstracts = numbering_index(numbering_root, 'abstractNum', 'abstractNumId')
            for paragraph in paragraphs:
                numbering = paragraph.find(ns + 'pPr/' + ns + 'numPr')
                if numbering is None:
                    continue
                level_node, id_node = numbering.find(ns + 'ilvl'), numbering.find(ns + 'numId')
                assert level_node is not None and id_node is not None, 'Word list numbering metadata missing'
                level, num_id = level_node.get(ns + 'val'), id_node.get(ns + 'val')
                assert level is not None and num_id in nums, 'Word list references invalid numbering'
                list_rows.append(normalized(''.join(item.text or '' for item in paragraph.iter(ns + 't'))))
                if (num_id, level) in seen_numbering:
                    continue
                seen_numbering.add((num_id, level))
                num = nums[num_id]
                abstract_link = num.find(ns + 'abstractNumId')
                assert abstract_link is not None, 'Word list abstract numbering reference missing'
                abstract = abstracts.get(abstract_link.get(ns + 'val'))
                assert abstract is not None, 'Word abstract list definition missing'
                levels = [item for item in abstract.findall(ns + 'lvl') if item.get(ns + 'ilvl') == level]
                assert len(levels) == 1, 'Word numbered-list level is ambiguous'
                num_format = levels[0].find(ns + 'numFmt')
                assert num_format is not None, 'Word list format missing'
                if num_format.get(ns + 'val') != 'decimal':
                    continue
                labels = levels[0].findall(ns + 'lvlText')
                assert len(labels) == 1 and labels[0].get(ns + 'val') == '%' + str(int(level) + 1) + '.', 'Word decimal list marker template changed'
                initial_node = levels[0].find(ns + 'start')
                initial = int(initial_node.get(ns + 'val')) if initial_node is not None else 1
                overrides = [item for item in num.findall(ns + 'lvlOverride') if item.get(ns + 'ilvl') == level]
                assert len(overrides) <= 1, 'Word list has ambiguous start overrides'
                if overrides:
                    assert not overrides[0].findall(ns + 'lvl'), 'Word custom list-level override is unsupported'
                    assert len(overrides[0].findall(ns + 'startOverride')) <= 1, 'Word list has duplicate start overrides'
                    explicit = overrides[0].find(ns + 'startOverride')
                    if explicit is not None:
                        initial = int(explicit.get(ns + 'val'))
                list_starts.append(initial)
            groups = []
            for block in document.iter(ns + 'tbl'):
                group = {'rows': [], 'cellTags': []}
                for row in block.findall(ns + 'tr'):
                    check_unmerged_word_row(row, ns)
                    # Presence alone is insufficient: w:val="false" explicitly
                    # disables a header. Reject ambiguous or invalid flags rather
                    # than certifying a lost header as preserved structure.
                    header_nodes = row.findall(ns + 'trPr/' + ns + 'tblHeader')
                    assert len(header_nodes) <= 1, 'Word table has duplicate header flags'
                    header_value = header_nodes[0].get(ns + 'val', 'true') if header_nodes else 'false'
                    assert header_value in ['true', 'false', '1', '0', 'on', 'off'], 'Word table header flag is invalid'
                    header = header_value in ['true', '1', 'on']
                    cells = [normalized(''.join(item.text or '' for item in cell.iter(ns + 't')))
                             for cell in row.findall(ns + 'tc')]
                    group['rows'].append(cells)
                    group['cellTags'].append(['th' if header else 'td'] * len(cells))
                groups.append(group)
            headings = resolved_word_headings(archive, document)
            assert list_rows == wanted['listItems'], 'Word numbered-list structure changed'
            assert list_starts == wanted['listStarts'], 'Word ordered-list start values changed'
            assert groups == wanted['tableGroups'], 'Word table grouping or header-cell semantics changed'
            assert headings == wanted['headings'], 'Word heading paragraph styles or ordering changed'
        checked['wordStructure'] = 'independent Word list starts, table grouping/header cells and heading styles checked'
    if 'strikes' in wanted:
        with zipfile.ZipFile(io.BytesIO(base64.b64decode(result['word']))) as archive:
            document = ET.fromstring(archive.read('word/document.xml'))
            ns = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
            struck = [normalized(''.join(node.text or '' for node in run.iter(ns + 't'))) for run in document.iter(ns + 'r') if run.find(ns + 'rPr/' + ns + 'strike') is not None]
            assert struck == wanted['strikes'], 'Word strikethrough changed'
        checked['strikethrough'] = 'independent HTML and Word XML checked'
    for private in wanted.get('forbidden', []):
        assert all(private not in text for text in texts), 'Comment leaked into publication content'
    if 'imageReferences' in wanted:
        assert result['imageReferences'] == wanted['imageReferences']
    checked.update({'warnings': result['warnings'], 'exportFindings': result['findings'], 'wordZip': 'CRC and independent XML text checked',
                  'textCharacters': len(texts[0])})
    return checked


CONVERT = """async ({data,kind,options}) => {
  try {
    const bytes=Uint8Array.from(atob(data),c=>c.charCodeAt(0)), raw=new TextDecoder().decode(bytes);
    const imported=kind==='docx'
      ? await (await import('/docx-import.js')).parseDocxArticle(bytes,'benchmark.docx',options)
      : kind==='html' ? (await import('/copied-writing.js')).parseCopiedWriting({format:'html',text:raw},options)
      : (await import('/article-import.js')).parseArticleImport(raw,'benchmark.md','markdown');
    const draft=imported.draft;
    const wordpress=(await import('/wordpress-export.js')).createWordPressArticle(draft).html;
    const html=(await import('/html-export.js')).createHTMLSource(draft);
    const word=(await import('/word-export.js')).createWordDocument(draft);
    // Product exports are bounded; chunk encoding avoids argument-size limits.
    let binary='';for(let i=0;i<word.length;i+=8192)binary+=String.fromCharCode(...word.subarray(i,i+8192));
    return {draft,warnings:imported.warnings,requiresAck:imported.requiresAck,
      imageReferences:imported.wordImages?.length||0,wordpress,html,word:btoa(binary),
      findings:(await import('/export-review.js')).reviewExport(draft).findings.map(item=>({kind:item.kind,message:item.message}))};
  } catch(error) { return {error:error.message}; }
}"""


# Construct a reproducible, fully synthetic DOCX from authored XML. This is
# not a Microsoft Word/Google Docs export or a measured native WordPress paste.
# Never fetch URLs and never infer the expected article from converter output.
def build_authored_docx(case):
    from xml.sax.saxutils import quoteattr
    assert case['kind'] == 'docx'
    assert isinstance(case['source'], str) and 0 < len(case['source']) < 512 * 1024
    word = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
    office_rel = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
    package_rel = 'http://schemas.openxmlformats.org/package/2006/relationships'
    document = ('<w:document xmlns:w="' + word + '" xmlns:r="' + office_rel +
                '"><w:body>' + case['source'] + '</w:body></w:document>')
    parsed = ET.fromstring(document)
    assert parsed.tag == '{' + word + '}document'
    assert not any(node.tag.endswith('}altChunk') for node in parsed.iter())
    rels = []
    parts = {
        '[Content_Types].xml': (
            '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            '<Default Extension="xml" ContentType="application/xml"/>'
            '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
            + ('<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>'
               if case.get('numbering') is True else '') + '</Types>'),
        '_rels/.rels': '<Relationships xmlns="' + package_rel + '"><Relationship Id="main" Type="' + office_rel + '/officeDocument" Target="word/document.xml"/></Relationships>',
        'word/document.xml': document
    }
    if case.get('numbering') is True:
        levels = ''.join('<w:lvl w:ilvl="' + str(i) + '"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%' + str(i+1) + '."/></w:lvl>' for i in range(2))
        parts['word/numbering.xml'] = '<w:numbering xmlns:w="' + word + '"><w:abstractNum w:abstractNumId="0">' + levels + '</w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>'
        rels.append('<Relationship Id="numbering" Type="' + office_rel + '/numbering" Target="numbering.xml"/>')
    links = case.get('relationships', [])
    assert isinstance(links, list) and len(links) <= 12
    used = set()
    for item in links:
        assert set(item) == {'id', 'target'}
        key, target = item['id'], item['target']
        assert re.fullmatch(r'[A-Za-z][A-Za-z0-9]{0,30}', key) and key not in used
        assert isinstance(target, str) and re.fullmatch(r'https://[A-Za-z0-9./?&=_%:-]{1,300}', target)
        used.add(key)
        rels.append('<Relationship Id=' + quoteattr(key) + ' Type="' + office_rel +
                    '/hyperlink" Target=' + quoteattr(target) + ' TargetMode="External"/>')
    if rels:
        parts['word/_rels/document.xml.rels'] = '<Relationships xmlns="' + package_rel + '">' + ''.join(rels) + '</Relationships>'
    for content in parts.values():
        ET.fromstring(content)
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, 'w', compression=zipfile.ZIP_STORED) as archive:
        for name, content in parts.items():
            item = zipfile.ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
            item.compress_type = zipfile.ZIP_STORED
            archive.writestr(item, content.encode('utf-8'))
    return buffer.getvalue()


def run_document_benchmark(open_page, root, out):
    from playwright.sync_api import expect
    fixture_root = root / 'tests/fixtures/documents'
    manifest = json.loads((fixture_root / 'manifest.json').read_text())
    authored_path = fixture_root / 'authored-cases.json'
    authored = json.loads(authored_path.read_text(encoding='utf-8'))
    assert authored['origin'] == 'authored-synthetic', 'Authored cases must declare their provenance'
    all_ids = [item['id'] for item in manifest['cases']] + [item['id'] for item in authored['cases']]
    assert len(all_ids) == len(set(all_ids)), 'Document benchmark IDs must be unique'
    report_path = out / 'document-benchmark.json'
    report_path.unlink(missing_ok=True)
    report = {'result': 'RUNNING', 'scope': manifest['scope'] + ' Additional authored synthetic regression cases are reported separately.', 'cases': [], 'layout': {},
              'pinnedCaseCount': len(manifest['cases']), 'authoredCaseCount': len(authored['cases']),
              'authoredManifestSha256': hashlib.sha256(authored_path.read_bytes()).hexdigest(),
              'manifestSha256': hashlib.sha256((fixture_root / 'manifest.json').read_bytes()).hexdigest(),
              'limits': ['Upstream microdocuments are not representative user articles.',
                         'Paste captures are historical upstream fixtures, not fresh application sessions.',
                         'Long Markdown sample uses passage checks, not exact whole-document fidelity.',
                         'No real WordPress save/reopen, real-device, or assistive-technology acceptance.',
                         'Authored fictional input probes are not real Word, Google Docs, or customer captures.',
                         'Synthetic DOCX is constructed from authored XML in this offline runner, not exported by Word.',
                         'No native WordPress paste comparison or human save/reopen timing was performed.']}
    def save():
        report_path.write_text(json.dumps(report, indent=2) + '\n')
    save()
    fixtures = {entry['file']: entry for entry in manifest['fixtures']}
    source_cases = [('pinned-upstream', item) for item in manifest['cases']]
    source_cases += [('authored-synthetic', item) for item in authored['cases']]
    for origin, case in source_cases:
        print('Document corpus (' + origin + '): ' + case['id'], flush=True)
        entry = {'id': case['id'], 'file': case.get('file'), 'origin': origin,
                 'expected': case['expect']['category'], 'result': 'RUNNING'}
        report['cases'].append(entry)
        page = context = None
        try:
            if origin == 'pinned-upstream':
                path = fixture_root / case['file']
                source = path.read_bytes()
                kind = path.suffix[1:]
                source_ref = fixtures[case['file']]['source']
                digest = hashlib.sha256(source).hexdigest()
                assert digest == fixtures[case['file']]['sha256'], 'Fixture bytes differ from the pinned corpus'
            else:
                assert case['kind'] in ['md', 'html', 'docx'] and case['id'].startswith('authored-'), 'Unknown authored case format'
                kind = case['kind']
                source = build_authored_docx(case) if kind == 'docx' else case['source'].encode('utf-8')
                assert len(source) <= (8 * 1024 * 1024 if kind == 'docx' else 512 * 1024), 'Authored source exceeds import limit'
                digest = hashlib.sha256(source).hexdigest()
                source_ref = ('Programmatically constructed fictional DOCX, never opened or exported by Microsoft Word' if kind == 'docx' else
                              'Locally authored fictional ' + ('HTML' if kind == 'html' else 'Markdown') + ' test input, not an application capture')
            entry.update({'sourceSha256': digest, 'source': source_ref, 'kind': kind})
            page, context, state = open_page('/write/')
            expect(page.locator('#desk-status')).to_contain_text('ready')
            page.fill('#title', 'Existing benchmark writing')
            page.fill('#body', 'Keep this existing article until reviewed.')
            page.check('#reviewed')
            started = time.perf_counter()
            result = page.evaluate(CONVERT, {'data': base64.b64encode(source).decode(),
                                           'kind': kind, 'options': case.get('options', {})})
            entry['conversionAndExportsMs'] = round((time.perf_counter() - started) * 1000, 1)
            wanted = case['expect']
            if wanted['category'] == 'rejected':
                assert wanted['error'] in result.get('error', ''), result
                entry['rejection'] = result['error']
            else:
                assert 'error' not in result, result.get('error')
                entry.update(check_conversion(result, wanted))
            # Direct parsers/exports must not replace current writing or approval.
            expect(page.locator('#body')).to_have_value('Keep this existing article until reviewed.')
            expect(page.locator('#reviewed')).to_be_checked()
            if case.get('ui'):
                for parent in page.locator('#start-import').locator('xpath=ancestor::details').all():
                    if not parent.evaluate('el=>el.open'):
                        parent.locator(':scope > summary').click()
                page.click('#start-import')
                if origin == 'pinned-upstream':
                    page.locator('#import-file').set_input_files(str(path))
                else:
                    page.locator('#import-file').set_input_files({
                        'name': case['id'] + '.' + kind,
                        'mimeType': ('application/vnd.openxmlformats-officedocument.wordprocessingml.document' if kind == 'docx' else
                                     'text/html' if kind == 'html' else 'text/markdown'), 'buffer': source
                    })
                if case.get('options', {}).get('firstRowHeaders'):
                    expect(page.locator('#desk-status')).to_contain_text('no explicit header row')
                    page.check('#import-first-row-headers')
                    page.click('#preview-import')
                if wanted['category'] == 'rejected':
                    expect(page.locator('#desk-status')).to_contain_text(wanted['error'])
                    expect(page.locator('#body')).to_have_value('Keep this existing article until reviewed.')
                    expect(page.locator('#title')).to_have_value('Existing benchmark writing')
                    expect(page.locator('#reviewed')).to_be_checked()
                else:
                    expect(page.locator('#import-preview')).to_be_visible()
                    expect(page.locator('#import-body-preview')).to_have_value(result['draft']['body'])
                    expect(page.locator('#body')).to_have_value('Keep this existing article until reviewed.')
                    expect(page.locator('#reviewed')).to_be_checked()
                    if page.locator('#import-changes-ok').is_visible():
                        expect(page.locator('#apply-import')).to_be_disabled()
                        page.check('#import-changes-ok')
                    page.click('#apply-import')
                    expect(page.locator('#body')).to_have_value(result['draft']['body'])
                    expect(page.locator('#title')).to_have_value(result['draft']['title'])
                    expect(page.locator('#reviewed')).not_to_be_checked()
                    page.check('#reviewed')
                    with page.expect_download() as download:
                        page.click('#download-wordpress')
                    assert Path(download.value.path()).read_text() == result['wordpress'], 'Downloaded blocks differ from checked model'
                entry['ui'] = 'native file input; staged review/apply or rejection; existing writing preserved'
                for width in [1440, 390, 320]:
                    page.set_viewport_size({'width': width, 'height': 900})
                    overflow = page.evaluate('document.documentElement.scrollWidth > innerWidth')
                    report['layout'][case['id'] + '-' + str(width)] = overflow
                    assert not overflow, 'Import UI overflows at ' + str(width)
            assert state['api'] == [], 'Corpus case made an API request'
            entry['result'] = 'PASS'
        except Exception as error:
            entry['result'] = 'FAIL'
            entry['error'] = str(error)
        finally:
            if context:
                context.close()
            save()
    report['originCounts'] = {
        origin: sum(case['origin'] == origin for case in report['cases'])
        for origin in ['pinned-upstream', 'authored-synthetic']
    }
    report['counts'] = {category: sum(case['expected'] == category for case in report['cases'])
                        for category in ['preserved', 'disclosed', 'rejected', 'sampled']}
    report['result'] = 'PASS' if all(case['result'] == 'PASS' for case in report['cases']) else 'FAIL'
    save()
    assert report['result'] == 'PASS', 'Document benchmark failed: ' + ', '.join(case['id'] for case in report['cases'] if case['result'] != 'PASS')
    return report
