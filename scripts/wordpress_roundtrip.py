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
from wordpress_media_acceptance import run_wordpress_media_handoff
from wordpress_source_fixtures import load_wordpress_source_fixture

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


def expected_saved_source(copied, case):
    # WordPress omits the export's single terminal LF. Other observed changes
    # use reviewed, exact fixture strings, never a general HTML normalizer.
    assert copied.endswith('\n') and not copied.endswith('\n\n'), 'Expected one final LF in copied block source'
    return case.get('expectedSavedSource', copied[:-1])


def check_post(post, case, markers, text=None):
    assert post['status'] == 'draft', 'Fixture must remain an unpublished draft'
    assert post['title']['raw'] == case['title'], 'Separate post title changed'
    article = ArticleHTML(post['content']['rendered'])
    actual_text, expected_text = normalized(''.join(article.text)), text or case['text']
    assert actual_text == expected_text, 'Saved/rendered article text changed: expected ' + repr(expected_text) + '; received ' + repr(actual_text)
    assert not article.unsafe, 'Rendered article contains active markup'
    assert article.images == len(case.get('images', [])), 'Rendered image count changed'
    if 'rows' in case:
        assert article.rows == case['rows'], 'Saved/rendered table structure changed'
    if 'strongs' in case:
        assert article.inline_marks['strong'] == case['strongs'], 'Rendered article lost authored bold emphasis'
        assert ArticleHTML(post['content']['raw']).inline_marks['strong'] == case['strongs'], 'Stored article lost authored bold emphasis'
    if 'quotes' in case:
        assert article.quotes == case['quotes'], 'Saved/rendered quotation boundaries changed'
    if 'links' in case:
        assert article.links == case['links'], 'Saved/rendered link targets changed'
    if 'listPaths' in case:
        assert article.list_paths == case['listPaths'], 'Saved/rendered list hierarchy or states changed'
        assert ArticleHTML(post['content']['raw']).list_paths == case['listPaths'], 'Stored list hierarchy or states changed'
    if 'strikes' in case:
        assert article.strikes == case['strikes'], 'Saved/rendered strikethrough changed'
        assert ArticleHTML(post['content']['raw']).strikes == case.get('rawStrikes', case['strikes']), 'Stored strikethrough changed'
    if 'rawText' in case:
        assert normalized(''.join(ArticleHTML(post['content']['raw']).text)) == case['rawText'], 'Stored article text changed'
    raw = post['content']['raw']
    assert not any(marker in raw or marker in post['content']['rendered'] for marker in markers), 'Private field leaked'
    return raw


BLOCKS = """() => {
 const blocks=wp.data.select('core/block-editor').getBlocks();
 const flat=(items,parent=[])=>items.flatMap((item,index)=>{
  const path=[...parent,index];
  return [{path,name:item.name,valid:item.isValid,attributes:item.attributes},...flat(item.innerBlocks||[],path)];
 });
 return {top:blocks.map(item=>item.name),all:flat(blocks)};
}"""


def check_blocks(page, case, edited=False):
    blocks = page.evaluate(BLOCKS)
    assert blocks['top'] == case['top'], 'Top-level block types changed'
    assert all(block['valid'] is True for block in blocks['all']), 'WordPress reports an invalid block'
    if 'blockPaths' in case:
        assert [{'path': b['path'], 'name': b['name']} for b in blocks['all']] == case['blockPaths'], 'Ordered block hierarchy changed'
    if 'headingLevels' in case:
        assert [b['attributes']['level'] for b in blocks['all'] if b['name'] == 'core/heading'] == case['headingLevels'], 'Heading levels changed'
    for item in case.get('editedInlineContents' if edited else 'inlineContents', []):
        block = next((b for b in blocks['all'] if b['path'] == item['path']), None)
        assert block is not None and block['attributes'].get('content') == item['content'], 'Inline marks or their nesting changed'
    if 'listStarts' in case:
        assert [b['attributes'].get('start') for b in blocks['all'] if b['name'] == 'core/list'] == case['listStarts']
        assert sum(b['name'] == 'core/list-item' for b in blocks['all']) == case['listItems']
    if 'images' in case:
        assert [{'src': b['attributes']['url'], 'alt': b['attributes']['alt']} for b in blocks['all'] if b['name'] == 'core/image'] == case['images']
    else:
        assert not any(b['name'] == 'core/image' for b in blocks['all'])
    return blocks


def visible_editor_control(page, selector):
    # The current editor canvas is an iframe. Use actual controls in that frame
    # rather than populating the editor store or dispatching a synthetic paste.
    deadline = time.monotonic() + 30
    while time.monotonic() < deadline:
        for frame in page.frames:
            nodes = frame.locator(selector)
            for index in range(nodes.count()):
                node = nodes.nth(index)
                if node.is_visible():
                    return node
        page.wait_for_timeout(100)
    raise AssertionError('No visible WordPress editor control: ' + selector)


def reveal_control(control):
    control.evaluate("node=>{for(let current=node;current;current=current.parentElement)if(current.tagName==='DETAILS')current.open=true}")


def observe_native_paste(control, target_kind):
    control.evaluate("""(node,targetKind)=>{
      const view=node.ownerDocument.defaultView;
      view.DTP_NATIVE_PASTE=null;
      node.ownerDocument.addEventListener('paste',event=>{
        view.DTP_NATIVE_PASTE={trusted:event.isTrusted,targetKind,
          editableTarget:(event.target===node||node.contains(event.target)) &&
            (node.isContentEditable || (node.tagName==='TEXTAREA'&&!node.disabled&&!node.readOnly)),
          types:Array.from(event.clipboardData.types),
          text:event.clipboardData.getData('text/plain'),
          htmlEmpty:event.clipboardData.getData('text/html')===''};
      },{capture:true,once:true});
    }""", target_kind)


def main():
    from playwright.sync_api import sync_playwright, expect
    OUT.mkdir(exist_ok=True)
    report_file = OUT / 'wordpress-results.json'
    report_file.unlink(missing_ok=True)
    report = {'result': 'RUNNING', 'scope': 'local WordPress native clipboard, Visual paste, save/reopen, Code editor fallback, and Media Library image handoff', 'cases': [],
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
                context.grant_permissions(['clipboard-read', 'clipboard-write'], origin='https://drafttopage.test')
                media_aliases = {}
                def route(request):
                    url = request.request.url
                    if url.startswith(ORIGIN + '/'):
                        request.continue_()
                    elif url == 'https://example.test/roundtrip.png?a=1&b=2':
                        report['fixtureAssets'].append('fictional linked image')
                        request.fulfill(content_type='image/svg+xml', body='<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>')
                    elif url.startswith('https://wordpress-media.test/'):
                        recorded = media_aliases.get(url)
                        if not recorded or not recorded['source_url'].startswith(ORIGIN + '/') or not recorded['bytes']:
                            report['unexpectedRequests'].append('Unregistered local media alias: ' + url)
                            request.abort()
                            return
                        # Serve the exact bytes previously retrieved and verified
                        # from the real local Media Library, without nested
                        # network operations inside the Playwright route callback.
                        request.fulfill(status=200, body=recorded['bytes'], content_type=recorded['mime'])
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
                    source_page = new_page()
                    source_page.goto('https://drafttopage.test' + case.get('sourceRoute', '/word-to-wordpress/' if case.get('file') or case.get('sourceFixture') else '/markdown-to-wordpress/'))
                    expect(source_page.locator('#desk-status')).to_contain_text('ready')
                    if case.get('file') or case.get('sourceFixture'):
                        if case.get('sourceFixture'):
                            synthetic = load_wordpress_source_fixture(ROOT, case['sourceFixture'])
                            source_page.locator('#import-file').set_input_files(synthetic['input'])
                            entry['sourceOrigin'] = synthetic['origin']
                            entry['sourceInputSha256'] = synthetic['sha256']
                            entry['source'] = case.get('sourceLabel', 'Synthetic authored fixture, not an actual source-app export')
                        else:
                            source_page.locator('#import-file').set_input_files(str(ROOT / case['file']))
                        expect(source_page.locator('#import-preview')).to_be_visible()
                        source_page.check('#import-changes-ok')
                        source_page.click('#apply-import-and-continue')
                        expect(source_page.locator('#publishing-destination')).to_be_focused()
                        expect(source_page.locator('#publishing-destination')).to_have_value('wordpress')
                        expect(source_page.locator('#reviewed')).not_to_be_checked()
                        entry['reviewedImportContinuation'] = True
                        if not case.get('sourceFixture'):
                            entry['source'] = case.get('sourceLabel', 'native Word file import, review, apply, and Copy WordPress blocks')
                    else:
                        source_page.fill('#body', case['body'])
                        entry['source'] = 'actual Markdown-to-WordPress article fields and Copy WordPress blocks'
                        if case.get('formatSelection'):
                            source_page.locator('#text-format-tools > summary').click()
                            source_page.locator('#body').evaluate('(el,phrase)=>{const at=el.value.indexOf(phrase);el.setSelectionRange(at,at+phrase.length)}', case['formatSelection'])
                            source_page.locator('[data-format=strike]').click()
                            assert source_page.locator('#body').input_value() == case['formattedBody'], 'Toolbar changed unexpected source'
                            assert not source_page.locator('#reviewed').is_checked()
                            entry['source'] = 'native strikethrough toolbar, review, and Copy WordPress blocks'
                            entry['toolbarVerified'] = True
                    source_page.fill('#title', case['title'])
                    original_body = source_page.locator('#body').input_value()
                    reveal_control(source_page.locator('#start-notes'))
                    source_page.click('#start-notes')
                    source_page.fill('#notes', config['privateMarkers'][0])
                    reveal_control(source_page.locator('#add-question'))
                    source_page.click('#add-question')
                    source_page.fill('#review-question-0', config['privateMarkers'][1])
                    assert source_page.locator('#notes').input_value() == config['privateMarkers'][0]
                    assert source_page.locator('#review-question-0').input_value() == config['privateMarkers'][1]
                    assert source_page.locator('#body').input_value() == original_body and source_page.locator('#title').input_value() == case['title']
                    entry['privateFieldsPopulated'] = True
                    if case.get('includeLinkedImages'):
                        reveal_control(source_page.locator('#wordpress-linked-images'))
                        source_page.check('#wordpress-linked-images')
                    source_page.check('#reviewed')
                    reveal_control(source_page.locator('#wordpress-code-preview'))
                    expect(source_page.locator('#wordpress-code-preview')).to_have_value(re.compile(r'^<!-- wp:'))
                    approved_source = source_page.locator('#wordpress-code-preview').input_value()
                    with source_page.expect_download() as download:
                        source_page.click('#download-wordpress')
                    downloaded_bytes = Path(download.value.path()).read_bytes()
                    exported = downloaded_bytes.decode('utf-8')
                    assert exported == approved_source, 'Downloaded block file differs from approved source'
                    if 'html' in case:
                        assert exported == case['html'], 'Approved UI export differs from expected article source'
                    assert not any(marker in exported for marker in config['privateMarkers']), 'Private field leaked into approved export'
                    entry['exportSha256'] = hashlib.sha256(downloaded_bytes).hexdigest()
                    source_page.click('#copy-wordpress')
                    expect(source_page.locator('#wordpress-action-status')).to_contain_text('WordPress blocks copied')
                    copied = source_page.evaluate('navigator.clipboard.readText()')
                    assert copied == exported, 'Actual clipboard differs from approved export'
                    clipboard_types = source_page.evaluate('navigator.clipboard.read().then(items=>items.flatMap(item=>item.types))')
                    assert clipboard_types == ['text/plain'], 'Expected only the existing plain-text clipboard representation'
                    entry.update({'sourceTransport': 'copy-wordpress-button', 'clipboardSha256': hashlib.sha256(copied.encode()).hexdigest()})
                    expected_raw = expected_saved_source(copied, case)
                    entry['expectedSavedSha256'] = hashlib.sha256(expected_raw.encode()).hexdigest()
                    page = open_editor()
                    title = visible_editor_control(page, '.editor-post-title__input')
                    title.fill(case['title'])
                    title.press('Enter')
                    selector = '[data-type="core/paragraph"][contenteditable="true"], [data-type="core/paragraph"] [contenteditable="true"]'
                    editable = visible_editor_control(page, selector)
                    empty_paragraph = page.evaluate("""() => {
                      const blocks=wp.data.select('core/block-editor').getBlocks();
                      return blocks.length===1 && blocks[0].name==='core/paragraph' &&
                        String(blocks[0].attributes.content||'')==='' && blocks[0].innerBlocks.length===0;
                    }""")
                    assert empty_paragraph and editable.inner_text().replace('\ufeff', '').strip() == '', 'Destination must be an empty Visual paragraph'
                    empty_source = page.evaluate("wp.data.select('core/editor').getEditedPostContent()")
                    input_mode = case['inputMode']
                    assert input_mode in ['native-visual-paste', 'code-editor'], 'Choose an explicit native input mode'
                    entry['inputMode'] = input_mode
                    if input_mode == 'code-editor':
                        page.keyboard.press('Control+Shift+Alt+M')
                        editor = page.locator('textarea.editor-post-text-editor')
                        expect(editor).to_be_visible()
                        observe_native_paste(editor, 'code-textarea')
                        editor.click()
                        editor.press('Control+A')
                        editor.press('Control+V')
                        editor.press('Tab')
                        page.keyboard.press('Control+Shift+Alt+M')
                    else:
                        observe_native_paste(editable, 'visual-paragraph')
                        editable.click()
                        editable.press('Control+V')
                    page.wait_for_function("({count,previous})=>wp.data.select('core/block-editor').getBlocks().length===count && wp.data.select('core/editor').getEditedPostContent()!==previous", arg={'count': len(case['top']), 'previous': empty_source})
                    events = [frame.evaluate('window.DTP_NATIVE_PASTE||null') for frame in page.frames]
                    events = [event for event in events if event]
                    assert len(events) == 1, 'Expected one observed native paste event'
                    paste = events[0]
                    entry['paste'] = {key: value for key, value in paste.items() if key != 'text'}
                    entry['paste'].update({'emptyParagraph': empty_paragraph, 'textSha256': hashlib.sha256(paste['text'].encode()).hexdigest()})
                    assert paste['trusted'] is True and paste['editableTarget'] is True, 'Paste did not reach the actual editable target'
                    assert paste['types'] == ['text/plain'] and paste['htmlEmpty'] is True and paste['text'] == copied, 'Native paste payload changed'
                    check_blocks(page, case)
                    post_id = page.evaluate("wp.data.select('core/editor').getCurrentPostId()")
                    post = save_draft(page, post_id)
                    raw = check_post(post, case, config['privateMarkers'])
                    entry.update({'postId': post_id, 'saveResponse': 200, 'savedSha256': hashlib.sha256(raw.encode()).hexdigest()})
                    if raw != expected_raw:
                        mismatch = OUT / ('wordpress-source-mismatch-' + case['id'] + '.json')
                        mismatch.write_text(json.dumps({'copied': copied, 'expected': expected_raw, 'saved': raw}, indent=2) + '\n')
                        raise AssertionError('Saved source differs from the explicit pinned expectation; inspect ' + mismatch.name)
                    entry['savedSourceExact'] = True
                    source_page.close()
                    page.close()
                    page = open_editor(post_id)
                    check_blocks(page, case)
                    reopened = page.evaluate("id=>wp.apiFetch({path:'/wp/v2/posts/'+id+'?context=edit'})", post_id)
                    assert check_post(reopened, case, config['privateMarkers']) == raw, 'Stored block source changed after reopening'
                    if 'strikes' in case:
                        entry['strikethroughVerified'] = True
                    if 'strongs' in case:
                        entry['inlineEmphasisVerified'] = True
                    if 'listPaths' in case:
                        entry['listHierarchyVerified'] = True
                    if 'rawText' in case:
                        entry['rawTextVerified'] = True
                        entry['typography'] = {'stored': case['rawText'], 'rendered': case['text']}
                    assert page.evaluate('window.DTP_FIXTURE_EXECUTED===undefined'), 'Literal source executed'
                    if case.get('editAfterReopen'):
                        assert case['text'].count('a link.') == 1, 'The native-edit fixture must have one exact replacement point'
                        editable = visible_editor_control(page, selector)
                        editable.click()
                        editable.press('Control+End')
                        editable.press_sequentially(' Reopened edit.')
                        edited = save_draft(page, post_id)
                        edited_text = case['text'].replace('a link.', 'a link. Reopened edit.')
                        edited_raw = check_post(edited, case, config['privateMarkers'], edited_text)
                        assert edited_raw != raw, 'Native edit did not change the saved source'
                        page.close()
                        page = open_editor(post_id)
                        check_blocks(page, case, edited=True)
                        edited = page.evaluate("id=>wp.apiFetch({path:'/wp/v2/posts/'+id+'?context=edit'})", post_id)
                        assert check_post(edited, case, config['privateMarkers'], edited_text) == edited_raw, 'Edited source changed after the second reopen'
                        entry['editedAndReopened'] = True
                        entry['editedSha256'] = hashlib.sha256(edited_raw.encode()).hexdigest()
                        entry['secondReopenExact'] = True
                    entry.update({'result': 'PASS', 'status': reopened['status'], 'validAfterReopen': True})
                    page.close()
                    save()
                print('WordPress Media Library round trip: fictional multi-image Word file', flush=True)
                report['mediaLibrary'] = {'result': 'RUNNING'}
                save()
                report['mediaLibrary'] = run_wordpress_media_handoff(
                    root=ROOT, origin=ORIGIN, config=config, new_page=new_page,
                    open_editor=open_editor, save_draft=save_draft,
                    visible_editor_control=visible_editor_control,
                    observe_native_paste=observe_native_paste, check_blocks=check_blocks,
                    check_post=check_post, media_aliases=media_aliases, rest_path=rest_path
                )
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
        if report.get('mediaLibrary', {}).get('result') == 'RUNNING':
            report['mediaLibrary'] = {'result': 'FAIL', 'reason': 'Full local media acceptance did not finish.'}
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
