"""Reviewed import continuation in an isolated browser with fictional sources.

Exercises the actual file picker, clipboard paste, keyboard actions, and exported
files. This does not represent an unassisted writer or a physical device session.
"""
from pathlib import Path

from playwright.sync_api import expect


def run_import_continue_acceptance(open_page, root, out, layout):
    html = '<h1>Fictional continuation</h1><h2>Review this section</h2><p>Keep <strong>important text</strong> and <a href="/guide">the guide</a>.</p>'
    private = 'PRIVATE_IMPORT_CONTINUATION_803'
    clipboard_marker = 'UNCHANGED_CLIPBOARD_UNTIL_EXPLICIT_COPY_803'
    routes = [
        ('word-to-wordpress', 'wordpress', '#copy-wordpress', '#download-wordpress'),
        ('word-to-markdown', 'markdown', '#copy-article-markdown', '#download-article-markdown'),
        ('google-docs-to-wordpress', 'html', '#copy-html-source', '#download-html-source'),
        ('html-to-markdown', 'markdown', '#copy-article-markdown', '#download-article-markdown'),
    ]
    for route, destination, copy_button, download_button in routes:
        page, context, state = open_page('/' + route + '/')
        downloads = []
        page.on('download', lambda download: downloads.append(download))
        try:
            expect(page.locator('#desk-status')).to_contain_text('ready')
            if route == 'google-docs-to-wordpress':
                page.click('#desk-more > summary')
                page.click('#start-notes')
                page.fill('#notes', private)
                page.fill('#title', 'Earlier fictional title')
                page.fill('#body', 'Earlier fictional article to keep until replacement.')
                page.select_option('#publishing-destination', destination)
                page.check('#reviewed')
                page.click('#start-copied-paste')
                page.evaluate("""html => navigator.clipboard.write([new ClipboardItem({
                  'text/html': new Blob([html], {type:'text/html'}),
                  'text/plain': new Blob(['Fictional clipboard fallback'], {type:'text/plain'})
                })])""", html.replace('/guide', 'https://example.com/guide'))
                page.locator('#import-text').focus()
                page.keyboard.press('Control+V')
            elif route.startswith('word-to-'):
                with page.expect_file_chooser() as chooser:
                    page.click('#start-word-file')
                chooser.value.set_files(str(root / 'public/samples/word-to-markdown.docx'))
            else:
                page.fill('#import-text', html)
                page.fill('#import-source-url', 'https://example.com/first/')
                page.click('#preview-import')
            expect(page.locator('#import-preview')).to_be_visible()
            expect(page.locator('#apply-import-and-continue')).to_be_visible()
            expect(page.locator('#apply-import-and-continue')).to_be_disabled()
            expect(page.locator('#apply-import')).to_have_text('Import and edit')
            expect(page.locator('#import-continue-help')).to_be_visible()
            assert page.locator('#publishing-destination').input_value() == destination

            if route == 'html-to-markdown':
                page.check('#import-changes-ok')
                expect(page.locator('#apply-import-and-continue')).to_be_enabled()
                page.fill('#import-source-url', 'https://example.com/second/')
                expect(page.locator('#apply-import-and-continue')).to_be_disabled()
                expect(page.locator('#body')).to_have_value('')
                page.click('#preview-import')
                expect(page.locator('#import-changes-ok')).not_to_be_checked()
                expect(page.locator('#import-join-options')).to_be_hidden()
                expect(page.locator('#import-destination')).to_be_disabled()
                # Insertion has its own location review and must keep editor focus.
                page.fill('#body', 'Fictional existing article for insertion review.')
                expect(page.locator('#import-destination')).to_be_enabled()
                page.select_option('#import-destination', 'append')
                expect(page.locator('#apply-import-and-continue')).to_be_hidden()
                expect(page.locator('#import-continue-help')).to_be_hidden()
                page.select_option('#import-destination', 'replace')
                page.fill('#body', '')
                expect(page.locator('#import-join-options')).to_be_hidden()
                expect(page.locator('#import-destination')).to_be_disabled()

            expected_body = page.locator('#import-body-preview').input_value()
            assert expected_body
            notes_hidden = page.locator('.source-editor').is_hidden()
            page.check('#import-changes-ok')
            expect(page.locator('#apply-import-and-continue')).to_be_enabled()
            layout(page, 'import-continue-review-' + route)
            if route == 'word-to-wordpress':
                page.set_viewport_size({'width': 320, 'height': 900})
                page.locator('#apply-import-and-continue').scroll_into_view_if_needed()
                page.screenshot(path=str(out / 'import-continue-review-320.png'))

            if route == 'google-docs-to-wordpress':
                state['accept'] = False
                page.locator('#apply-import-and-continue').press('Enter')
                expect(page.locator('#desk-status')).to_contain_text('Import cancelled')
                expect(page.locator('#body')).to_have_value('Earlier fictional article to keep until replacement.')
                expect(page.locator('#reviewed')).to_be_checked()
                expect(page.locator('#import-changes-ok')).to_be_checked()
                assert page.locator('#checkpoint-select option').count() == 0
                state['accept'] = True

            page.evaluate('text => navigator.clipboard.writeText(text)', clipboard_marker)
            page.locator('#apply-import-and-continue').press('Enter')
            expect(page.locator('#publishing-destination')).to_be_focused()
            expect(page.locator('#publishing-destination')).to_have_value(destination)
            expect(page.locator('#workflow-steps')).to_have_attribute('data-step', 'export')
            expect(page.locator('#body')).to_have_value(expected_body)
            expect(page.locator('#reviewed')).not_to_be_checked()
            expect(page.locator(copy_button)).to_be_disabled()
            expect(page.locator(download_button)).to_be_disabled()
            expect(page.locator('#import-preview')).to_be_hidden()
            expect(page.locator('#import-text')).to_have_value('')
            expect(page.locator('#import-source-url')).to_have_value('')
            assert page.locator('#import-reading-preview').inner_html() == ''
            assert page.locator('.source-editor').is_hidden() == notes_hidden
            assert page.locator('#import-panel').get_attribute('open') is None
            assert page.evaluate('navigator.clipboard.readText()') == clipboard_marker
            assert downloads == []
            geometry = page.evaluate("""() => {
              const heading = document.getElementById('export-heading').getBoundingClientRect();
              const bar = document.getElementById('workflow-steps');
              return {top: heading.top, bottom: heading.bottom, height: innerHeight,
                cover: getComputedStyle(bar).position === 'sticky' ? bar.getBoundingClientRect().bottom : 0};
            }""")
            assert geometry['top'] >= geometry['cover'] and geometry['bottom'] <= geometry['height'], geometry
            if route == 'word-to-wordpress':
                page.screenshot(path=str(out / 'import-continue-export-320.png'))
            if route == 'google-docs-to-wordpress':
                expect(page.locator('#notes')).to_have_value(private)
                assert page.locator('#checkpoint-select option').count() == 1

            page.check('#reviewed')
            page.click(copy_button)
            expect(page.locator('#desk-status')).to_contain_text('copied')
            copied = page.evaluate('navigator.clipboard.readText()')
            with page.expect_download() as download:
                page.click(download_button)
            exported = Path(download.value.path()).read_text()
            assert copied == exported and private not in exported
            assert ('Before publishing' if route.startswith('word-to-') else 'important text') in exported
            assert page.locator('#body').input_value() == expected_body

            # Returning to the editor stays one explicit navigation action away.
            page.click('#edit-from-export')
            expect(page.locator('#body')).to_be_focused()
            expect(page.locator('#reviewed')).to_be_checked()
            page.locator('#body').press('Control+End')
            page.keyboard.insert_text(' Revised.')
            expect(page.locator('#reviewed')).not_to_be_checked()
            assert page.locator('#body').input_value() == expected_body + ' Revised.'
            assert state['api'] == []
        finally:
            context.close()

    # The secondary choice intentionally enters the editor, without continuing.
    page, context, state = open_page('/html-to-markdown/')
    try:
        expect(page.locator('#desk-status')).to_contain_text('ready')
        page.fill('#import-text', '<p>Fictional writing to edit first.</p>')
        page.click('#preview-import')
        expected_body = page.locator('#import-body-preview').input_value()
        page.check('#import-changes-ok')
        page.click('#apply-import')
        expect(page.locator('#body')).to_be_focused()
        expect(page.locator('#body')).to_have_value(expected_body)
        expect(page.locator('#reviewed')).not_to_be_checked()
        assert page.locator('#workflow-steps').get_attribute('data-step') != 'export'
        assert state['api'] == []
    finally:
        context.close()
