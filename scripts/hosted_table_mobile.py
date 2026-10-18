"""Manually run an anonymous hosted 320/390px table-editing smoke test.

This is NOT the source-bound local release gate, a WordPress save/reopen test,
or evidence of physical-device or human-alpha readiness. It makes no changes to
accounts and uses only fictional writing inside a new ephemeral browser context.
"""
import argparse
import json
import os
import shutil
import sys
from pathlib import Path
from urllib.parse import urlsplit

FORMAT = 'drafttopage-hosted-table-mobile-smoke'
WIDTHS = (1440, 390, 320)
REQUIRED_KEYS = (
    'table-row-arrange-before-1440',
    'table-row-arrange-before-390',
    'table-row-arrange-inserted-320',
    'table-row-arrange-moved-320',
    'table-row-arrange-moved-390',
)
CONTROLS = (
    'table-row-arrange', 'table-row-selected', 'table-row-destination',
    'table-insert-before', 'table-insert-after', 'table-move-up',
    'table-move-down', 'table-move-to', 'table-grid',
)


def validate_origin(raw):
    parsed = urlsplit(raw)
    host = (parsed.hostname or '').lower()
    local = host in ('127.0.0.1', 'localhost')
    hosted = host in ('drafttopage.com', 'www.drafttopage.com') or (
        host.endswith('.nolankido.workers.dev') and 'drafttopage' in host
    )
    if (parsed.scheme not in (('http', 'https') if local else ('https',)) or
            not (local or hosted) or parsed.username or parsed.password or
            parsed.path not in ('', '/') or parsed.query or parsed.fragment or
            (not local and parsed.port not in (None, 443))):
        raise ValueError('Use the Draft to Page HTTPS origin or an explicit localhost/127.0.0.1 test origin; no paths or credentials.')
    return parsed.scheme + '://' + parsed.netloc.lower()


def layout_errors(observed, expected_width):
    errors = []
    if observed.get('width') != expected_width:
        errors.append('CSS viewport width does not match requested viewport')
    if observed.get('documentWidth', expected_width + 100) > expected_width + 1:
        errors.append('Document has horizontal overflow')
    got = observed.get('controls')
    if not isinstance(got, list) or len(got) != len(CONTROLS):
        return errors + ['Missing measured row controls']
    for item, target_id in zip(got, CONTROLS):
        if item.get('id') != target_id or item.get('displayed') is not True:
            errors.append('Control missing or hidden: ' + target_id)
        elif (item.get('left', -100) < -2 or item.get('right', 100000) > expected_width + 2 or
              item.get('textClipped') is True):
            errors.append('Control clipped or offscreen: ' + target_id)
    return errors


def self_test():
    for origin in (
        'https://drafttopage.com', 'https://www.drafttopage.com',
        'https://fix-example-drafttopage.nolankido.workers.dev',
        'http://localhost:8123', 'http://127.0.0.1:8123'
    ):
        assert validate_origin(origin)
    for value in (
        'http://drafttopage.com', 'https://example.com', 'https://drafttopage.com/pilot',
        'https://drafttopage.com?token=secret', 'https://user:pass@drafttopage.com',
        'https://drafttopage.com:8080', 'file:///etc/passwd'
    ):
        try:
            validate_origin(value)
        except ValueError:
            pass
        else:
            raise AssertionError('Untrusted origin was accepted')
    for width in WIDTHS:
        good = {'width': width, 'documentWidth': width, 'controls': [
            {'id': key, 'left': 10, 'right': width - 10, 'displayed': True, 'textClipped': False}
            for key in CONTROLS
        ]}
        assert layout_errors(good, width) == []
        assert layout_errors({**good, 'documentWidth': width + 5}, width)
        assert layout_errors({**good, 'width': width - 1}, width)
        assert layout_errors({**good, 'controls': good['controls'][:-1]}, width)
        bad = json.loads(json.dumps(good))
        bad['controls'][1]['textClipped'] = True
        assert layout_errors(bad, width)
    return {'format': FORMAT, 'selfTest': 'PASS', 'realBrowser': 'NOT_RUN', 'actualWidths': [], 'note': 'Pure origin and viewport contract unit test only.'}


def measure(page, width):
    page.set_viewport_size({'width': width, 'height': 850})
    page.locator('#table-row-arrange').scroll_into_view_if_needed()
    observed = page.evaluate('''() => ({
        width: innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        controls: [
          'table-row-arrange','table-row-selected','table-row-destination',
          'table-insert-before','table-insert-after','table-move-up',
          'table-move-down','table-move-to','table-grid'
        ].map(id => {
          const el = document.getElementById(id);
          if (!el) return {id, displayed: false};
          const rect = el.getBoundingClientRect();
          return {id, left: rect.left, right: rect.right,
             displayed: rect.width > 0 && rect.height > 0,
             textClipped: el.tagName === 'BUTTON' && el.scrollWidth > el.clientWidth + 2};
        })
    })''')
    errors = layout_errors(observed, width)
    if errors:
        raise AssertionError(f'{width}px layout: ' + '; '.join(errors))
    if not page.locator('#table-grid').evaluate('(el)=>getComputedStyle(el).overflowX === "auto"'):
        raise AssertionError(f'{width}px: only the table grid should scroll horizontally')
    return observed['width']


def open_details(page, selector):
    node = page.locator(selector)
    for ancestor in node.locator('xpath=ancestor::details').all():
        if not ancestor.evaluate('el=>el.open'):
            ancestor.locator(':scope > summary').click()
    if not node.evaluate('el=>el.open'):
        node.locator(':scope > summary').click()


def exercise(page, report):
    from playwright.sync_api import expect
    old_rows = [(f'Row {i}', f'Detail {i}') for i in range(1, 13)]
    original_table = '\n'.join(['| Name | Detail |', '| --- | --- |', *[
        f'| {name} | {detail} |' for name, detail in old_rows
    ]])
    original = 'Before sentinel 😀.\n\n' + original_table + '\n\nAfter sentinel.'
    page.fill('#body', original)
    page.check('#reviewed')
    open_details(page, '#editing-tools')
    page.click('#start-table-editor')
    page.click('#table-open-selected')
    expect(page.locator('#table-row-selected option')).to_have_count(12)
    expect(page.locator('#table-row-destination option')).to_have_count(12)
    report['measurements'][REQUIRED_KEYS[0]] = measure(page, 1440)
    report['measurements'][REQUIRED_KEYS[1]] = measure(page, 390)
    page.locator('#table-insert-before').focus()
    assert page.locator('#table-insert-before').evaluate('el=>document.activeElement===el')
    page.click('#table-insert-before')
    expect(page.locator('#table-cell-0-0')).to_have_value('')
    expect(page.locator('#table-cell-1-0')).to_have_value('Row 1')
    page.fill('#table-cell-0-0', 'Inserted first')
    page.fill('#table-cell-0-1', 'Inserted detail')
    assert page.locator('#body').input_value() == original
    assert page.locator('#reviewed').is_checked()
    report['measurements'][REQUIRED_KEYS[2]] = measure(page, 320)
    page.select_option('#table-row-selected', '1')
    page.select_option('#table-row-destination', '12')
    page.click('#table-move-to')
    expect(page.locator('#table-row-selected')).to_have_value('12')
    expect(page.locator('#table-cell-12-0')).to_have_value('Row 1')
    expect(page.locator('#table-cell-12-1')).to_have_value('Detail 1')
    expect(page.locator('#table-page-status')).to_contain_text('Rows 11 to 13 of 13')
    assert page.locator('#table-cell-12-0').evaluate('el=>document.activeElement===el')
    report['measurements'][REQUIRED_KEYS[3]] = measure(page, 320)
    report['measurements'][REQUIRED_KEYS[4]] = measure(page, 390)
    assert page.locator('#body').input_value() == original
    page.click('#table-preview-change')
    assert page.locator('#table-before').input_value() == original_table
    intended = [('Inserted first','Inserted detail'), *old_rows[1:], old_rows[0]]
    updated_table = '\n'.join(['| Name | Detail |','| --- | --- |', *[
        f'| {name} | {detail} |' for name, detail in intended
    ]])
    assert page.locator('#table-after').input_value() == updated_table
    expect(page.locator('#table-reading-preview table tbody tr')).to_have_count(13)
    before_count = page.locator('#checkpoint-select option').count()
    page.click('#table-apply')
    expect(page.locator('#body')).to_have_value('Before sentinel 😀.\n\n' + updated_table + '\n\nAfter sentinel.')
    assert page.locator('#checkpoint-select option').count() == before_count + 1
    assert not page.locator('#reviewed').is_checked()
    report['checks'] = ['real viewport geometry','keyboard focus','insert-before','13-row cross-page move',
                        'source unchanged before apply','exact preview','apply','revision checkpoint','approval reset']


def run_hosted(origin, timeout_ms):
    from playwright.sync_api import sync_playwright
    result = {'format': FORMAT, 'version': 1, 'origin': origin, 'scope': 'hosted anonymous browser, no Git source pin',
              'result': 'RUNNING', 'measurements': {}, 'checks': [], 'errors': [],
              'sourceBound': False, 'wordPressAcceptance': 'NOT_RUN', 'physicalMobile': 'NOT_RUN', 'alphaReady': False}
    browser = None
    with sync_playwright() as p:
        binary = os.getenv('CHROMIUM_EXECUTABLE') or shutil.which('chromium') or shutil.which('chromium-browser')
        options = {'headless': True, 'args': ['--no-sandbox','--disable-dev-shm-usage']}
        if binary:
            options['executable_path'] = binary
        browser = p.chromium.launch(**options)
        result['browser'] = browser.version
        context = browser.new_context(viewport={'width':1440,'height':850}, reduced_motion='reduce', accept_downloads=False)
        page = context.new_page()
        page.set_default_timeout(timeout_ms)
        page.on('pageerror', lambda error: result['errors'].append('JavaScript runtime error: ' + type(error).__name__))
        page.on('dialog', lambda dialog: dialog.dismiss())
        def route(r):
            dest = urlsplit(r.request.url)
            if dest.netloc != urlsplit(origin).netloc or dest.path.startswith('/api/') or dest.path.startswith('/pilot'):
                result['errors'].append('Blocked unexpected off-origin or API request')
                r.abort()
            else:
                r.continue_()
        context.route('**/*', route)
        try:
            response = page.goto(origin+'/markdown-to-wordpress/', wait_until='domcontentloaded', timeout=timeout_ms)
            if not response or response.status != 200:
                raise AssertionError('Public Markdown-to-WordPress route did not return HTTP 200')
            exercise(page, result)
            if result['errors']:
                raise AssertionError('Unexpected browser runtime or outbound request errors')
            result['result'] = 'PASS'
        except Exception as error:
            result['result'] = 'FAIL'
            result['errors'].append(type(error).__name__ + ': ' + str(error).split('\n')[0][:240])
        finally:
            context.close()
            browser.close()
    return result


def main():
    parser=argparse.ArgumentParser(description='Host-only Draft to Page table row mobile smoke. Does not qualify a release or alpha.')
    parser.add_argument('--origin',default='https://drafttopage.com',help='Approved HTTPS Draft to Page site or localhost test server')
    parser.add_argument('--timeout-ms', type=int, default=15000)
    parser.add_argument('--output', default='test-results/hosted-table-mobile.json')
    parser.add_argument('--self-test',action='store_true',help='Pure contract tests; does not launch browser or access site')
    options=parser.parse_args()
    if options.self_test:
        print(json.dumps(self_test(),indent=2))
        return 0
    if not 1000 <= options.timeout_ms <= 120000:
        parser.error('timeout-ms must be between 1000 and 120000')
    try:
        origin=validate_origin(options.origin)
    except ValueError as error:
        parser.error(str(error))
    output=Path(options.output)
    output.parent.mkdir(parents=True,exist_ok=True)
    output.unlink(missing_ok=True)
    try:
        report=run_hosted(origin,options.timeout_ms)
    except Exception as error:
        report={'format':FORMAT,'scope':'hosted only','result':'FAIL','error':type(error).__name__ + ': ' + str(error).split('\n')[0][:240], 'sourceBound':False,'alphaReady':False}
    output.write_text(json.dumps(report,indent=2)+'\n',encoding='utf8')
    print(report['result'] + ': hosted table mobile smoke; see ' + str(output) + '. Not a release or alpha receipt.')
    if report['result']!='PASS':
        print(str(report.get('error') or report.get('errors'))[:360],file=sys.stderr)
        return 1
    return 0

if __name__=='__main__':
    sys.exit(main())