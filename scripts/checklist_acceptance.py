"""Local browser acceptance for the retained Google Docs checklist capture.

The clipboard is a fixture clipboard in an isolated test browser. This is not a
fresh Google Docs session or evidence of a physical device's clipboard behavior.
"""
import base64
import json
from pathlib import Path

from document_benchmark import ArticleHTML, check_conversion


def run_checklist_acceptance(open_page, root, out, layout):
    from playwright.sync_api import expect
    fixture_root = root / 'tests/fixtures/documents'
    manifest = json.loads((fixture_root / 'manifest.json').read_text())
    case = next(item for item in manifest['cases'] if item['id'] == 'google-checklist-preservation')
    source = (fixture_root / case['file']).read_text()
    wanted = case['expect']
    page, context, state = open_page('/google-docs-to-wordpress/')
    try:
        expect(page.locator('#desk-status')).to_contain_text('ready')
        page.click('#desk-more > summary')
        page.click('#start-notes')
        page.fill('#notes', 'PRIVATE_CHECKLIST_SOURCE_742')
        page.fill('#title', 'Keep the earlier title')
        original = 'Keep the earlier fictional article until the checklist is reviewed.'
        page.fill('#body', original)
        page.check('#reviewed')
        page.click('#start-copied-paste')

        def paste(html):
            page.evaluate("""html => navigator.clipboard.write([new ClipboardItem({
              'text/html': new Blob([html], {type:'text/html'}),
              'text/plain': new Blob(['Fictional clipboard fallback'], {type:'text/plain'})
            })])""", html)
            page.locator('#import-text').focus()
            page.keyboard.press('Control+V')

        paste(source)
        expect(page.locator('#import-preview')).to_be_visible()
        expect(page.locator('#import-warnings')).to_contain_text('not interactive checkboxes')
        expect(page.locator('#import-warnings')).to_contain_text('explicit source levels')
        expect(page.locator('#body')).to_have_value(original)
        expect(page.locator('#reviewed')).to_be_checked()
        expect(page.locator('#apply-import')).to_be_disabled()
        expected_body = page.locator('#import-body-preview').input_value()
        assert expected_body.count('\\[Checked\\]') == 2
        assert expected_body.count('\\[Unchecked\\]') == 3
        assert 'data:image' not in expected_body and '[Image:' not in expected_body
        assert page.locator('#import-preview img, #import-preview [role="checkbox"]').count() == 0
        layout(page, 'checklist-pending')
        page.set_viewport_size({'width': 390, 'height': 900})
        page.locator('#import-preview').screenshot(path=str(out / 'checklist-review-390.png'))
        page.set_viewport_size({'width': 1440, 'height': 1000})

        # A contradictory marker must block the earlier successful preview.
        paste(source.replace('alt="checked"', 'alt="unchecked"', 1))
        expect(page.locator('#desk-status')).to_contain_text('checkbox')
        expect(page.locator('#apply-import')).to_be_disabled()
        expect(page.locator('#body')).to_have_value(original)
        expect(page.locator('#reviewed')).to_be_checked()

        # Successful retry still requires acknowledgement. Declining the actual
        # replacement confirmation preserves writing and approval.
        paste(source)
        expect(page.locator('#import-body-preview')).to_have_value(expected_body)
        page.check('#import-changes-ok')
        state['accept'] = False
        page.click('#apply-import')
        expect(page.locator('#body')).to_have_value(original)
        expect(page.locator('#reviewed')).to_be_checked()
        state['accept'] = True
        page.click('#apply-import')
        expect(page.locator('#body')).to_have_value(expected_body)
        expect(page.locator('#reviewed')).not_to_be_checked()
        expect(page.locator('#notes')).to_have_value('PRIVATE_CHECKLIST_SOURCE_742')
        assert page.locator('#checkpoint-select option').count() == 1
        assert ArticleHTML(page.locator('#article-preview').inner_html()).list_paths == wanted['listPaths']
        assert page.locator('#article-preview img, #article-preview input').count() == 0

        # Read actual downloaded WordPress, HTML and DOCX bytes independently.
        outputs = {}
        for destination, button, key in [('wordpress', '#download-wordpress', 'wordpress'),
                                          ('html', '#download-html-source', 'html'),
                                          ('word', '#download-word', 'word')]:
            page.select_option('#publishing-destination', destination)
            expect(page.locator('#reviewed')).not_to_be_checked()
            page.check('#reviewed')
            with page.expect_download() as download:
                page.click(button)
            data = Path(download.value.path()).read_bytes()
            outputs[key] = base64.b64encode(data).decode() if key == 'word' else data.decode()
        outputs.update({'draft': {'title': ''}, 'warnings': [], 'findings': []})
        export_wanted = {key: value for key, value in wanted.items() if key != 'warnings'}
        check_conversion(outputs, export_wanted)
        assert all('PRIVATE_CHECKLIST_SOURCE_742' not in outputs[key] for key in ['wordpress', 'html'])

        # The current article remains editable and every change clears approval.
        page.locator('#body').press('Control+End')
        page.locator('#body').press_sequentially(' Updated.')
        expect(page.locator('#reviewed')).not_to_be_checked()
        assert page.locator('#body').input_value().endswith(' Updated.')
        assert state['api'] == []
        layout(page, 'checklist-applied')
    finally:
        context.close()
