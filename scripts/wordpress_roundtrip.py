"""Deliberate local WordPress acceptance test. No public WordPress account.

Requires an explicitly installed Playground CLI and Playwright/Chromium. The CLI
and browser run as children of this process so loopback access stays local even
in isolated execution environments. No REST response or editor is mocked.
"""
import hashlib
import json
import os
import re
import signal
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse, parse_qs

from document_benchmark import ArticleHTML, normalized

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'test-results'
ORIGIN = 'http://127.0.0.1:41865'
MARKER = 'drafttopage-local-acceptance'


def source_snapshot():
    paths = subprocess.check_output(['git', 'ls-files', '-z', '--cached', '--others', '--exclude-standard'], cwd=ROOT).decode().split('\0')
    digest = hashlib.sha256()
    for name in sorted(path for path in paths if path):
        digest.update((name + '\0').encode())
        path = ROOT / name
        digest.update(path.read_bytes() if path.exists() else b'[deleted]')
        digest.update(b'\0')
    return digest.hexdigest()


def rest_path(url):
    parsed = urlparse(url)
    return parse_qs(parsed.query).get('rest_route', [parsed.path.removeprefix('/wp-json')])[0].rstrip('/')


def check_post(post, case, markers, text=None):
    assert post['status'] == 'draft', 'Fixture must remain an unpublished draft'
    assert post['title']['raw'] == case['title'], 'Separate post title changed'
    article = ArticleHTML(post['content']['rendered'])
    assert normalized(''.join(article.text)) == (text or case['text']), 'Saved/rendered article text changed'
    assert not article.unsafe, 'Rendered article contains active markup'
    assert article.images == len(case.get('images', [])), 'Rendered image count changed'
    if 'rows' in case:
        assert article.rows == case['rows'], 'Saved/rendered table structure changed'
    if 'links' in case:
        assert article.links == case['links'], 'Saved/rendered link targets changed'
    if 'strikes' in case:
        assert article.strikes == case['strikes'], 'Saved/rendered strikethrough changed'
        assert ArticleHTML(post['content']['raw']).strikes == case['strikes'], 'Stored strikethrough changed'
    raw = post['content']['raw']
    assert not any(marker in raw or marker in post['content']['rendered'] for marker in markers), 'Private field leaked'
    return raw


BLOCKS = """() => {
 const blocks=wp.data.select('core/block-editor').getBlocks();
 const flat=items=>items.flatMap(item=>[item,...flat(item.innerBlocks||[])]);
 return {top:blocks.map(item=>item.name),all:flat(blocks).map(item=>({name:item.name,valid:item.isValid,attributes:item.attributes}))};
}"""


def check_blocks(page, case):
    blocks = page.evaluate(BLOCKS)
    assert blocks['top'] == case['top'], 'Top-level block types changed'
    assert all(block['valid'] is True for block in blocks['all']), 'WordPress reports an invalid block'
    if 'listStarts' in case:
        assert [b['attributes'].get('start') for b in blocks['all'] if b['name'] == 'core/list'] == case['listStarts']
        assert sum(b['name'] == 'core/list-item' for b in blocks['all']) == case['listItems']
    if 'images' in case:
        assert [{'src': b['attributes']['url'], 'alt': b['attributes']['alt']} for b in blocks['all'] if b['name'] == 'core/image'] == case['images']
    else:
        assert not any(b['name'] == 'core/image' for b in blocks['all'])
    return blocks


def main():
    from playwright.sync_api import sync_playwright, expect
    OUT.mkdir(exist_ok=True)
    report_file = OUT / 'wordpress-results.json'
    report_file.unlink(missing_ok=True)
    report = {'result': 'RUNNING', 'scope': 'local WordPress save/reopen', 'cases': [],
              'runtimeErrors': [], 'unexpectedRequests': [], 'fixtureAssets': [], 'negativeControl': False,
              'startedAt': datetime.now(timezone.utc).isoformat()}
    def save():
        report_file.write_text(json.dumps(report, indent=2) + '\n')
    save()
    process = None
    try:
        cli = Path(os.environ.get('DRAFTTOPAGE_WORDPRESS_CLI', ''))
        if not cli.is_file():
            raise RuntimeError('Set DRAFTTOPAGE_WORDPRESS_CLI to an explicitly installed Playground cli.js. No tools are installed automatically.')
        package = json.loads((cli.parent / 'package.json').read_text())
        config = json.loads(subprocess.check_output(['node', 'scripts/wordpress-roundtrip-cases.mjs'], cwd=ROOT))
        assert package['name'] == '@wp-playground/cli' and package['version'] == config['playground'], 'Use the pinned Playground CLI version'
        report['head'] = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
        report['sourceSha256'] = source_snapshot()
        report['playground'] = package['version']
        blueprint = {'preferredVersions': {'wp': config['wordpress'], 'php': config['php']},
                     'features': {'networking': False}, 'login': True,
                     'constants': {'DISABLE_WP_CRON': True, 'AUTOMATIC_UPDATER_DISABLED': True,
                                   'WP_AUTO_UPDATE_CORE': False, 'DISALLOW_UNFILTERED_HTML': True},
                     'siteOptions': {'blogname': MARKER, 'show_avatars': '0', 'blog_public': '0'},
                     'steps': [{'step': 'runPHP', 'code': "<?php require '/wordpress/wp-load.php'; wp_update_user(array('ID'=>1,'role'=>'author')); file_put_contents('/wordpress/drafttopage-fixture-meta.json', json_encode(array('marker'=>'" + MARKER + "','wordpress'=>$wp_version,'php'=>PHP_VERSION,'databaseClass'=>get_class($wpdb),'pdoDrivers'=>PDO::getAvailableDrivers(),'unfilteredHTMLDisabled'=>DISALLOW_UNFILTERED_HTML)));"}]}
        blueprint_file = OUT / 'wordpress-blueprint.json'
        blueprint_file.write_text(json.dumps(blueprint))
        log_file = OUT / 'wordpress-server.log'
        with log_file.open('w') as log:
            process = subprocess.Popen(['node', str(cli.resolve()), 'server', '--wp=' + config['wordpress'],
                                        '--php=' + config['php'], '--port=41865', '--workers=6', '--login',
                                        '--blueprint=' + str(blueprint_file)], cwd=ROOT, stdout=log, stderr=subprocess.STDOUT)
            deadline = time.monotonic() + 120
            while 'Ready! WordPress is running' not in log_file.read_text():
                if process.poll() is not None:
                    raise RuntimeError('Local WordPress startup failed. See test-results/wordpress-server.log.')
                if time.monotonic() >= deadline:
                    raise RuntimeError('Local WordPress startup timed out.')
                time.sleep(.25)
            print('Local WordPress editor ready', flush=True)
            with sync_playwright() as playwright:
                launch = {'headless': True, 'args': ['--no-sandbox', '--disable-dev-shm-usage']}
                if os.environ.get('CHROMIUM_EXECUTABLE'):
                    launch['executable_path'] = os.environ['CHROMIUM_EXECUTABLE']
                browser = playwright.chromium.launch(**launch)
                report['browser'] = browser.version
                context = browser.new_context(viewport={'width': 1440, 'height': 1000}, reduced_motion='reduce')
                def route(request):
                    url = request.request.url
                    if url.startswith(ORIGIN + '/'):
                        request.continue_()
                    elif url == 'https://example.test/roundtrip.png?a=1&b=2':
                        report['fixtureAssets'].append('fictional linked image')
                        request.fulfill(content_type='image/svg+xml', body='<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>')
                    elif url == 'https://s.w.org/images/block-editor/welcome-canvas.svg':
                        report['fixtureAssets'].append('WordPress welcome artwork')
                        request.fulfill(content_type='image/svg+xml', body='<svg xmlns="http://www.w3.org/2000/svg"/>')
                    elif url.startswith('https://drafttopage.test/'):
                        parsed = urlparse(url)
                        path = (ROOT / 'public' / parsed.path.lstrip('/')).resolve()
                        assert path.is_relative_to((ROOT / 'public').resolve())
                        if path.is_dir():
                            path /= 'index.html'
                        if not path.is_file():
                            report['unexpectedRequests'].append(parsed.path)
                            request.abort()
                            return
                        mime = 'text/javascript' if path.suffix == '.js' else 'text/css' if path.suffix == '.css' else 'text/html'
                        request.fulfill(body=path.read_bytes(), content_type=mime)
                    else:
                        parsed = urlparse(url)
                        report['unexpectedRequests'].append(parsed.netloc + parsed.path)
                        request.abort()
                context.route('**/*', route)
                def new_page():
                    page = context.new_page()
                    page.set_default_timeout(30000)
                    page.on('pageerror', lambda error: report['runtimeErrors'].append(str(error)))
                    return page
                def open_editor(post_id=None):
                    page = new_page()
                    path = '/wp-admin/post.php?post=' + str(post_id) + '&action=edit' if post_id else '/wp-admin/post-new.php'
                    page.goto(ORIGIN + path, wait_until='domcontentloaded')
                    page.wait_for_function("window.wp?.data?.select('core/editor')?.getCurrentPostId()")
                    page.evaluate("wp.data.dispatch('core/preferences').set('core/edit-post','welcomeGuide',false)")
                    return page
                def save_draft(page, post_id):
                    with page.expect_response(lambda response: response.request.method == 'POST' and rest_path(response.url) == '/wp/v2/posts/' + str(post_id)) as response:
                        page.get_by_role('button', name=re.compile(r'^(Save draft|Save)$')).click()
                    assert response.value.status == 200, 'WordPress rejected the save request'
                    page.wait_for_function("!wp.data.select('core/editor').isSavingPost() && !wp.data.select('core/editor').isEditedPostDirty()")
                    return response.value.json()
                page = open_editor()
                metadata = page.request.get(ORIGIN + '/drafttopage-fixture-meta.json').json()
                assert metadata['marker'] == MARKER and metadata['wordpress'] == config['wordpress'], 'Unexpected WordPress fixture site/version'
                assert metadata['unfilteredHTMLDisabled'] is True
                assert metadata['php'].startswith(config['php'] + '.') and metadata['databaseClass'] == 'WP_SQLite_DB' and 'sqlite' in metadata['pdoDrivers'], 'Unexpected PHP/database environment'
                report['environment'] = metadata
                user = page.evaluate("wp.apiFetch({path:'/wp/v2/users/me?context=edit'}).then(user=>({roles:user.roles,unfilteredHTML:!!user.capabilities?.unfiltered_html}))")
                assert user['roles'] == ['author'] and user['unfilteredHTML'] is False, 'This test requires an Author account without unfiltered HTML'
                report['user'] = user
                bad = '<!-- wp:heading {"level":2} --><div>Intentionally invalid fixture</div><!-- /wp:heading -->'
                report['negativeControl'] = page.evaluate("html=>wp.blocks.parse(html).some(block=>block.isValid===false)", bad)
                assert report['negativeControl'], 'WordPress did not detect the deliberately invalid block'
                page.close()
                for case in config['cases']:
                    print('WordPress draft round trip: ' + case['id'], flush=True)
                    entry = {'id': case['id'], 'result': 'RUNNING'}
                    report['cases'].append(entry)
                    if case.get('file'):
                        source_page = new_page()
                        source_page.on('dialog', lambda dialog: dialog.accept())
                        source_page.goto('https://drafttopage.test/word-to-wordpress/')
                        expect(source_page.locator('#desk-status')).to_contain_text('ready')
                        source_page.locator('#import-file').set_input_files(str(ROOT / case['file']))
                        expect(source_page.locator('#import-preview')).to_be_visible()
                        source_page.check('#import-changes-ok')
                        source_page.click('#apply-import')
                        source_page.check('#reviewed')
                        with source_page.expect_download() as download:
                            source_page.click('#download-wordpress')
                        case['html'] = Path(download.value.path()).read_text()
                        entry['source'] = 'native Word file import, review, apply, and actual block download'
                        source_page.close()
                    page = open_editor()
                    if case.get('inputMode') == 'code-editor':
                        page.keyboard.press('Control+Shift+Alt+M')
                        editor = page.locator('textarea.editor-post-text-editor')
                        expect(editor).to_be_visible()
                        editor.fill(case['html'])
                        editor.press('Tab')
                        page.keyboard.press('Control+Shift+Alt+M')
                        page.wait_for_function("count=>wp.data.select('core/block-editor').getBlocks().length===count", arg=len(case['top']))
                        page.evaluate("title=>wp.data.dispatch('core/editor').editPost({title})", case['title'])
                        entry['inputMode'] = 'code-editor'
                    else:
                        page.evaluate("({html,title})=>{wp.data.dispatch('core/block-editor').resetBlocks(wp.blocks.parse(html));wp.data.dispatch('core/editor').editPost({title});}", case)
                    check_blocks(page, case)
                    post_id = page.evaluate("wp.data.select('core/editor').getCurrentPostId()")
                    post = save_draft(page, post_id)
                    raw = check_post(post, case, config['privateMarkers'])
                    entry.update({'postId': post_id, 'saveResponse': 200, 'savedSha256': hashlib.sha256(raw.encode()).hexdigest()})
                    page.close()
                    page = open_editor(post_id)
                    check_blocks(page, case)
                    reopened = page.evaluate("id=>wp.apiFetch({path:'/wp/v2/posts/'+id+'?context=edit'})", post_id)
                    assert check_post(reopened, case, config['privateMarkers']) == raw, 'Stored block source changed after reopening'
                    if 'strikes' in case:
                        entry['strikethroughVerified'] = True
                    assert page.evaluate('window.DTP_FIXTURE_EXECUTED===undefined'), 'Literal source executed'
                    if case.get('editAfterReopen'):
                        selector = '[data-type="core/paragraph"][contenteditable="true"], [data-type="core/paragraph"] [contenteditable="true"]'
                        page.wait_for_function("selector=>[document,...Array.from(document.querySelectorAll('iframe')).map(frame=>frame.contentDocument)].filter(Boolean).some(doc=>doc.querySelector(selector))", arg=selector)
                        editable = next((frame.locator(selector).first for frame in page.frames if frame.locator(selector).count()), None)
                        assert editable is not None, 'No native editable paragraph found'
                        editable.click()
                        editable.press('Control+End')
                        editable.press_sequentially(' Reopened edit.')
                        edited = save_draft(page, post_id)
                        edited_text = case['text'].replace('a link.', 'a link. Reopened edit.')
                        check_post(edited, case, config['privateMarkers'], edited_text)
                        page.close()
                        page = open_editor(post_id)
                        check_blocks(page, case)
                        edited = page.evaluate("id=>wp.apiFetch({path:'/wp/v2/posts/'+id+'?context=edit'})", post_id)
                        check_post(edited, case, config['privateMarkers'], edited_text)
                        entry['editedAndReopened'] = True
                        entry['editedSha256'] = hashlib.sha256(edited['content']['raw'].encode()).hexdigest()
                    entry.update({'result': 'PASS', 'status': reopened['status'], 'validAfterReopen': True})
                    page.close()
                    save()
                context.close()
                browser.close()
        assert not report['runtimeErrors'], report['runtimeErrors']
        assert not report['unexpectedRequests'], report['unexpectedRequests']
        report['sourceUnchanged'] = source_snapshot() == report['sourceSha256']
        assert report['sourceUnchanged'], 'Repository source changed during WordPress validation. Run again against stable source.'
        report['result'] = 'PASS'
    except Exception as error:
        report['result'] = 'FAIL'
        report['error'] = str(error)
        for case in report['cases']:
            if case['result'] == 'RUNNING':
                case['result'] = 'FAIL'
    finally:
        if process and process.poll() is None:
            process.send_signal(signal.SIGINT)
            try:
                process.wait(timeout=8)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait()
        report['completedAt'] = datetime.now(timezone.utc).isoformat()
        save()
    print('Local WordPress save/reopen: ' + report['result'], flush=True)
    if report.get('error'):
        print(report['error'], flush=True)
    return 0 if report['result'] == 'PASS' else 1


if __name__ == '__main__':
    raise SystemExit(main())
