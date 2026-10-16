"""Offline corpus checks using the product's real browser modules and import UI.

Source files are pinned upstream artifacts. Expectations are reviewed from source
text and the documented conversion contract, never regenerated from our output.
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


def normalized(text):
    return re.sub(r'\s+', ' ', text).strip()


class ArticleHTML(HTMLParser):
    """Independent reader: never render source HTML or fetch its resources."""
    def __init__(self, html):
        super().__init__(convert_charrefs=True)
        self.text = []
        self.rows = []
        self.items = []
        self.links = []
        self.strikes = []
        self.active = []
        self.unsafe = []
        self.images = 0
        self.list_paths = []
        self.list_stack = []
        self.list_item_stack = []
        self.top_lists = 0
        self.feed(html)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
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
        if tag == 'tr':
            self.rows.append([])
        if tag in ['th', 'td', 'li', 'a', 's']:
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
        for i in range(len(self.active) - 1, -1, -1):
            node = self.active[i]
            if node['tag'] != tag:
                continue
            text = normalized(''.join(node['text']))
            if tag in ['th', 'td']:
                self.rows[-1].append(text)
            elif tag == 'li':
                self.items.append(text)
            elif tag == 's':
                self.strikes.append(text)
            elif tag == 'a':
                self.links.append({'text': text, 'href': node['href']})
            self.active.pop(i)
            break


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


def check_conversion(result, wanted):
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
        for key, actual in [('rows', article.rows), ('listItems', article.items), ('listPaths', article.list_paths), ('links', article.links), ('strikes', article.strikes)]:
            if key in wanted:
                assert actual == wanted[key], key + ' structure changed'
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


def run_document_benchmark(open_page, root, out):
    from playwright.sync_api import expect
    fixture_root = root / 'tests/fixtures/documents'
    manifest = json.loads((fixture_root / 'manifest.json').read_text())
    report_path = out / 'document-benchmark.json'
    report_path.unlink(missing_ok=True)
    report = {'result': 'RUNNING', 'scope': manifest['scope'], 'cases': [], 'layout': {},
              'manifestSha256': hashlib.sha256((fixture_root / 'manifest.json').read_bytes()).hexdigest(),
              'limits': ['Upstream microdocuments are not representative user articles.',
                         'Paste captures are historical upstream fixtures, not fresh application sessions.',
                         'Long Markdown sample uses passage checks, not exact whole-document fidelity.',
                         'No real WordPress save/reopen, real-device, or assistive-technology acceptance.']}
    def save():
        report_path.write_text(json.dumps(report, indent=2) + '\n')
    save()
    fixtures = {entry['file']: entry for entry in manifest['fixtures']}
    for case in manifest['cases']:
        print('Document corpus: ' + case['id'], flush=True)
        entry = {'id': case['id'], 'file': case['file'], 'expected': case['expect']['category'], 'result': 'RUNNING'}
        report['cases'].append(entry)
        page = context = None
        try:
            path = fixture_root / case['file']
            source = path.read_bytes()
            digest = hashlib.sha256(source).hexdigest()
            assert digest == fixtures[case['file']]['sha256'], 'Fixture bytes differ from the pinned corpus'
            entry.update({'sourceSha256': digest, 'source': fixtures[case['file']]['source']})
            page, context, state = open_page('/write/')
            expect(page.locator('#desk-status')).to_contain_text('ready')
            page.fill('#title', 'Existing benchmark writing')
            page.fill('#body', 'Keep this existing article until reviewed.')
            page.check('#reviewed')
            started = time.perf_counter()
            result = page.evaluate(CONVERT, {'data': base64.b64encode(source).decode(),
                                           'kind': path.suffix[1:], 'options': case.get('options', {})})
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
                page.locator('#import-file').set_input_files(str(path))
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
    report['counts'] = {category: sum(case['expected'] == category for case in report['cases'])
                        for category in ['preserved', 'disclosed', 'rejected', 'sampled']}
    report['result'] = 'PASS' if all(case['result'] == 'PASS' for case in report['cases']) else 'FAIL'
    save()
    assert report['result'] == 'PASS', 'Document benchmark failed: ' + ', '.join(case['id'] for case in report['cases'] if case['result'] != 'PASS')
    return report
