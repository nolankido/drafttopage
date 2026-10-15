"""Browser regression tests with real module loading and CSP response headers.
All HTTP responses are local Playwright routes. Private sign-in/provider replies are
fixtures, not production authentication or real AI. Downloads are actual files in
the automated browser's temporary directory, not a user's device.
Run npm run build first. --desk-only restricts testing to the new local writing desk.
"""
import argparse
import json
import zipfile
import mimetypes
import shutil
import subprocess
from pathlib import Path
from urllib.parse import urlparse, unquote
from playwright.sync_api import sync_playwright, expect

parser = argparse.ArgumentParser()
parser.add_argument('--desk-only', action='store_true')
args = parser.parse_args()
root = Path.cwd()
out = root / 'test-results'
out.mkdir(exist_ok=True)
origin = 'https://drafttopage.test'
csp = next(line.split(':', 1)[1].strip() for line in (root/'public/_headers').read_text().splitlines() if 'Content-Security-Policy:' in line)
app_html = subprocess.check_output(['node','--input-type=module','-e',"import {appPage} from './src/pages.js'; process.stdout.write(appPage)"], text=True)
report = {'mode':'local routed responses, real ES modules and CSP; no live authentication/provider', 'scope':'desk-only' if args.desk_only else 'full', 'checks':[], 'errors':[], 'unexpected_requests':[], 'layout':{}}
source = {'profile':'update','notes':'Fictional source notes, not part of the article.','audience':'Readers','purpose':'Explain the experiment.'}
draft = {'title':'An edited local article','excerpt':'A brief summary.','description':'A factual description.','slug':'edited-local-article','body':'An article paragraph.\n\n## A heading\n\n- One\n- Two','questions':['Does this preserve uncertainty?']}
backup = {'format':'drafttopage-workspace','version':1,'source':source,'draft':draft}

def open_more(page):
    if not page.locator('#start-notes').is_visible():
        page.click('#desk-more > summary')


with sync_playwright() as p:
    options = {'headless':True,'args':['--no-sandbox','--disable-dev-shm-usage']}
    binary = shutil.which('chromium') or shutil.which('chromium-browser')
    if binary: options['executable_path'] = binary
    browser = p.chromium.launch(**options)
    def open_page(path, js=True, blocked_modules=()):
        state = {'calls':0,'expired':False,'failure':False,'accept':True,'api':[], 'blocked':[]}
        context = browser.new_context(viewport={'width':1440,'height':1000},java_script_enabled=js,accept_downloads=True)
        def route(r):
            u = urlparse(r.request.url)
            if u.netloc != 'drafttopage.test':
                report['unexpected_requests'].append(r.request.url); r.abort(); return
            if u.path in blocked_modules:
                state['blocked'].append(u.path); r.abort('blockedbyclient'); return
            if u.path == '/favicon.ico': r.fulfill(status=204,body=''); return
            if u.path.startswith('/api/'):
                state['api'].append(u.path)
                if u.path.endswith('/session'):
                    r.fulfill(status=401 if state['expired'] else 200,json={'error':'Session ended.'} if state['expired'] else {'authenticated':True,'generationReady':True,'profiles':{'personal':{'guidance':'Reflective.'},'update':{'guidance':'Completed versus planned.'},'guide':{'guidance':'Plain English.'}}}); return
                state['calls'] += 1
                if state['expired']: r.fulfill(status=401,json={'error':'Session ended.'}); return
                if state['failure']: r.fulfill(status=502,json={'error':'Fixture failure. Your writing is unchanged.'}); return
                r.fulfill(json={'draft':draft,'remainingToday':19}); return
            if u.path == '/pilot':
                private_csp = csp.replace("connect-src 'none'", "connect-src 'self'")
                r.fulfill(body=app_html,content_type='text/html',headers={'Content-Security-Policy':private_csp}); return
            name = unquote(u.path).lstrip('/')
            target = (root/'public'/name).resolve()
            if not target.is_relative_to((root/'public').resolve()): r.abort(); return
            if target.is_dir(): target /= 'index.html'
            if not target.exists(): report['unexpected_requests'].append(u.path); r.fulfill(status=404,body='Not found'); return
            mime = 'text/javascript' if target.suffix == '.js' else mimetypes.guess_type(str(target))[0] or 'text/plain'
            r.fulfill(body=target.read_bytes(),content_type=mime,headers={'Content-Security-Policy':csp,'X-Content-Type-Options':'nosniff'})
        context.route('**/*',route)
        page=context.new_page(); page.set_default_timeout(8000)
        page.on('pageerror',lambda error: report['errors'].append(str(error)))
        page.on('dialog',lambda dialog: dialog.accept() if state['accept'] else dialog.dismiss())
        page.goto(origin+path)
        return page,context,state
    def layout(page,name):
        for width in [1440,390,320]:
            page.set_viewport_size({'width':width,'height':900})
            overflow=page.evaluate('document.documentElement.scrollWidth > innerWidth')
            report['layout'][f'{name}-{width}']=overflow
            assert not overflow, f'{name} overflows at {width}'
            if name=='write' and width in [1440,390]: page.screenshot(path=str(out/f'write-{width}.png'),full_page=True)
        page.set_viewport_size({'width':1440,'height':1000})
    def restore(page, value):
        data = value if isinstance(value, bytes) else json.dumps(value).encode()
        page.locator('#restore-backup').set_input_files({'name':'fixture.json','mimeType':'application/json','buffer':data})
    # A distinct HTML tool provides reviewed source and keeps its destination after restore.
    page,context,state=open_page('/markdown-to-html/#sample')
    expect(page.locator('#desk-status')).to_contain_text('Fictional sample loaded')
    assert page.locator('#publishing-destination').input_value()=='html'
    expect(page.locator('h1')).to_have_text('Markdown to HTML converter')
    assert page.locator('#html-source-handoff').is_visible() and page.locator('#wordpress-handoff').is_hidden()
    assert page.locator('#copy-html-source').is_disabled() and page.locator('#html-source-preview').input_value()==''
    html_body='## Fictional heading\n\nFirst line.\nSecond line.\n\n<script>fictional()</script>\n\n| Left | Right |\n| --- | ---: |\n| One | Two |'
    page.fill('#body',html_body); page.check('#reviewed')
    html_source=page.locator('#html-source-preview').input_value()
    assert '<br>' in html_source and 'style="text-align:right"' in html_source
    assert '&lt;script&gt;' in html_source and '<script>' not in html_source and '<h1>' not in html_source
    with page.expect_download() as info: page.click('#download-html-source')
    assert Path(info.value.path()).read_text()==html_source
    page.check('#html-include-title'); assert not page.locator('#reviewed').is_checked()
    assert page.locator('#html-source-preview').input_value()==''
    page.check('#reviewed'); assert page.locator('#html-source-preview').input_value().startswith('<h1>')
    page.select_option('#publishing-destination','wordpress'); assert page.locator('#html-source-preview').input_value()==''
    page.select_option('#publishing-destination','html'); page.check('#reviewed')
    page.locator('.recovery-box summary').click(); page.check('#backup-private-ok')
    with page.expect_download() as info: page.click('#save-backup')
    html_backup=Path(info.value.path()).read_bytes()
    page.fill('#body','Short changed article.'); restore(page,html_backup)
    assert page.locator('#body').input_value()==html_body and page.locator('#publishing-destination').input_value()=='html'
    assert not page.locator('#reviewed').is_checked() and not page.locator('#html-include-title').is_checked()
    assert page.locator('#html-source-preview').input_value()==''
    layout(page,'html-tool'); context.close()
    # Full-length articles and native paste rejection preserve writing and approval.
    page,context,state=open_page('/markdown-to-wordpress/')
    long_tail='\n\n## Last section\nKEEP THE ENTIRE ENDING'
    long_body='## First section\n'+'界'*(60000-17-len(long_tail))+long_tail
    page.fill('#title','Fictional long guide'); page.fill('#body',long_body)
    expect(page.locator('#body-count')).to_contain_text('60,000 / 60,000')
    expect(page.locator('#article-preview')).to_contain_text('KEEP THE ENTIRE ENDING')
    page.check('#reviewed')
    context.grant_permissions(['clipboard-read','clipboard-write'])
    page.evaluate('(text)=>navigator.clipboard.writeText(text)',long_body+'X')
    page.locator('#body').press('Control+A'); page.locator('#body').press('Control+V')
    expect(page.locator('#body-paste-status')).to_contain_text('Current text is unchanged')
    assert page.locator('#body').input_value()==long_body and page.locator('#reviewed').is_checked()
    page.evaluate('(text)=>navigator.clipboard.writeText(text)',long_body)
    page.locator('#body').press('Control+A'); page.locator('#body').press('Control+V')
    assert page.locator('#body').input_value()==long_body and not page.locator('#reviewed').is_checked()
    page.check('#reviewed')
    with page.expect_download() as info: page.click('#download-html')
    assert 'KEEP THE ENTIRE ENDING' in Path(info.value.path()).read_text()
    page.locator('.recovery-box summary').click(); page.check('#backup-private-ok')
    with page.expect_download() as info: page.click('#save-backup')
    long_backup=Path(info.value.path()).read_bytes()
    assert json.loads(long_backup)['draft']['body']==long_body
    page.fill('#body','Short replacement.'); restore(page,long_backup)
    assert page.locator('#body').input_value()==long_body and not page.locator('#reviewed').is_checked()
    layout(page,'long-draft'); context.close()
    # Acquisition visitors use the complete editor without navigating away.
    page,context,state=open_page('/markdown-to-wordpress/#sample')
    expect(page.locator('#desk-status')).to_contain_text('Fictional sample loaded')
    expect(page.locator('h1')).to_have_text('Markdown to WordPress converter')
    assert page.locator('#preview-panel').get_attribute('open') is not None
    assert page.locator('.tool-guide .conversion-example code').count()==2
    body='A fictional conversion test.\n\n## Inspect this\n\nTODO: inspect this detail.'
    page.fill('#body',body)
    expect(page.locator('#article-preview')).to_contain_text('Inspect this')
    assert page.locator('#wordpress-findings li').count()==1
    assert page.locator('#copy-wordpress').is_disabled()
    page.click('#wordpress-kit-panel > summary')
    page.check('#reviewed')
    with page.expect_download() as info: page.click('#download-wordpress-kit')
    with zipfile.ZipFile(info.value.path()) as z:
        assert z.testzip() is None and len(z.namelist())==6
        assert z.read('article-body.md').decode()==body
        assert b'TODO' in z.read('REVIEW.txt')
    page.fill('#body','A changed fictional article.')
    assert not page.locator('#reviewed').is_checked()
    assert page.locator('#wordpress-findings li').count()==0
    layout(page,'wordpress-tool'); assert state['api']==[]; context.close()
    report['checks'].append('Acquisition tool: working sample, live preview, current findings, approval-gated exact-body ZIP, edit resets, and narrow layouts')
    page,context,state=open_page('/markdown-to-wordpress/#sample')
    expect(page.locator('#article-preview table')).to_be_visible()
    assert page.locator('#article-preview th[scope=col]').count()==2
    assert page.locator('#article-preview tbody tr').count()==3
    table='| Name | Count |\n| :--- | ---: |\n| **Alpha** | 2 |\n| Beta \\| Gamma | 3 |'
    page.fill('#body',table)
    assert page.locator('#wordpress-findings li').count()==0
    page.check('#reviewed'); page.click('#wordpress-code-panel > summary')
    assert '<!-- wp:table' in page.locator('#wordpress-code-preview').input_value()
    assert 'data-align="right"' in page.locator('#wordpress-code-preview').input_value()
    with page.expect_download() as info: page.click('#download-html')
    reading=Path(info.value.path()).read_text()
    assert '<thead>' in reading and 'Beta | Gamma' in reading
    bad=table+'\n| EXTRA | CELL | KEEP |'
    page.fill('#body',bad)
    assert page.locator('#article-preview table').count()==0
    expect(page.locator('#article-preview')).to_contain_text('KEEP')
    expect(page.locator('#wordpress-findings')).to_contain_text('same column count')
    assert not page.locator('#reviewed').is_checked()
    assert page.locator('#wordpress-code-preview').input_value()==''
    page.fill('#body',table)
    layout(page,'markdown-table'); assert state['api']==[]; context.close()
    report['checks'].append('Tables: live headers/alignment, escaped pipes, native blocks, reading file, malformed-source preservation, approval reset, and narrow layouts')
    page,context,state=open_page('/markdown-to-wordpress/#sample')
    expect(page.locator('#article-preview ol[start="4"]')).to_be_visible()
    assert page.locator('#article-preview ol[start="7"]').count()==1
    assert page.locator('#article-preview li > ul').count()>=2
    lists='4. Inspect the article\n  - Compare facts\n    + Keep uncertainty\n  - Check links\n5. Prepare the handoff\n  7) Paste the blocks\n  8) Preview the post'
    page.fill('#body',lists)
    assert page.locator('#article-preview li').count()==7
    assert page.locator('#wordpress-findings li').count()==0
    page.check('#reviewed'); page.click('#wordpress-code-panel > summary')
    code=page.locator('#wordpress-code-preview').input_value()
    assert '"start":4' in code and '"start":7' in code
    assert code.count('<!-- wp:list-item -->')==7
    with page.expect_download() as info: page.click('#download-html')
    reading=Path(info.value.path()).read_text()
    assert '<ol start="4">' in reading and '<ol start="7">' in reading
    bad='4. Keep the parent\n   - Irregular child\n5. KEEP THE LAST ITEM'
    page.fill('#body',bad)
    assert page.locator('#article-preview li').count()==0
    expect(page.locator('#article-preview')).to_contain_text('KEEP THE LAST ITEM')
    expect(page.locator('#wordpress-findings')).to_contain_text('two or four additional spaces')
    page.locator('#wordpress-findings button').first.click()
    assert page.locator('#body').evaluate('(el)=>el.value.slice(el.selectionStart,el.selectionEnd)')=='4. Keep the parent'
    assert not page.locator('#reviewed').is_checked() and page.locator('#wordpress-code-preview').input_value()==''
    page.fill('#body',lists); layout(page,'nested-lists'); assert state['api']==[]; context.close()
    report['checks'].append('Lists: nested ownership and starts, native list-item blocks, reading file, complete malformed-source preservation, exact finding selection, approval reset, and narrow layouts')
    # The homepage sample uses the real workspace and approval-gated destination.
    page,context,state=open_page('/write/#sample')
    expect(page.locator('#desk-status')).to_contain_text('Fictional sample loaded')
    assert page.locator('#preview-panel').get_attribute('open') is not None
    assert page.locator('.source-editor').is_hidden()
    assert page.locator('#copy-wordpress').is_disabled()
    page.check('#reviewed')
    page.click('#wordpress-code-panel > summary')
    assert '<!-- wp:list-item -->' in page.locator('#wordpress-code-preview').input_value()
    with page.expect_download() as info: page.click('#download-wordpress')
    wptext=Path(info.value.path()).read_text()
    assert '<!-- wp:paragraph -->' in wptext and '<h1>' not in wptext
    page.fill('#body','A new article.')
    assert not page.locator('#reviewed').is_checked() and page.locator('#wordpress-code-preview').input_value()==''
    state['accept']=False; page.click('#start-sample')
    assert page.locator('#body').input_value()=='A new article.'
    state['accept']=True; page.click('#start-sample')
    assert 'fictional sample article' in page.locator('#body').input_value()
    page.select_option('#publishing-destination','other')
    assert page.locator('#wordpress-handoff').is_hidden()
    assert not page.locator('#reviewed').is_checked()
    layout(page,'paste-first'); assert state['api']==[]; context.close()
    report['checks'].append('Paste-first sample: same workspace, approved WordPress file, stale-output clearing, sample confirmation, destination reset, mobile layouts')
    page,context,state=open_page('/write/#sample')
    page.fill('#body','A fictional opening.\n\n  - Nested list\n\n![image](https://example.test/image.png)\n\nTODO: inspect.')
    expect(page.locator('#wordpress-review-status')).to_contain_text('item(s) to inspect')
    assert page.locator('#wordpress-findings li').count()==3
    page.locator('#wordpress-findings button').first.click()
    assert page.locator('#body').evaluate('(el) => el.value.slice(el.selectionStart, el.selectionEnd)')=='  - Nested list'
    page.click('#wordpress-kit-panel > summary')
    assert page.locator('#wordpress-kit-files li').count()==6
    assert page.locator('#download-wordpress-kit').is_disabled()
    page.check('#reviewed')
    with page.expect_download() as info: page.click('#download-wordpress-kit')
    with zipfile.ZipFile(info.value.path()) as z:
        assert z.testzip() is None and len(z.namelist())==6
        assert b'TODO' in z.read('REVIEW.txt') and b'wp:paragraph' in z.read('wordpress-blocks.html')
    page.click('#wordpress-edit-fields'); expect(page.locator('#excerpt')).to_be_focused()
    page.fill('#excerpt','A fictional handoff summary.'); assert not page.locator('#reviewed').is_checked()
    page.fill('#body','A revised fictional article.'); assert page.locator('#wordpress-findings li').count()==0
    page.select_option('#publishing-destination','other'); assert page.locator('#wordpress-kit-files li').count()==0
    layout(page,'wordpress-handoff'); assert state['api']==[]; context.close()
    report['checks'].append('WordPress handoff: current findings and source selection, approved six-file ZIP, optional field editing, stale findings clearing, responsive layouts')
    page,context,state=open_page('/write/')
    expect(page.locator('#desk-status')).to_contain_text('ready')
    assert page.locator('#download').is_disabled()
    # Body copying/downloading must work before page metadata is supplied.
    page.fill('#body','Body without page metadata.')
    page.check('#reviewed')
    assert page.locator('#copy-body').is_enabled() and page.locator('#download').is_disabled()
    page.evaluate("Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.copiedFixture=text}}})")
    page.click('#copy-body')
    assert page.evaluate('window.copiedFixture')=='Body without page metadata.'
    with page.expect_download() as info: page.click('#download-body')
    assert Path(info.value.path()).read_text()=='Body without page metadata.\n'
    page.fill('#title','A fictional reading page')
    page.check('#reviewed')
    with page.expect_download() as info: page.click('#download-html')
    reading_text=Path(info.value.path()).read_text()
    assert '<h1>A fictional reading page</h1>' in reading_text
    assert '<script' not in reading_text and 'default-src' in reading_text
    reader=context.new_page()
    reader.set_content(reading_text)
    assert reader.locator('h1').count()==1 and reader.locator('script, img, a').count()==0
    layout(reader,'reading-page')
    reader.close()
    page.locator('#page-details summary').click()
    open_more(page); page.click('#start-notes')
    for key in ['title','excerpt','description','slug','body']: page.fill('#'+key,draft[key])
    page.fill('#notes',source['notes'])
    page.check('#reviewed')
    page.locator('#markdown-export-panel > summary').click()
    with page.expect_download() as info: page.click('#download')
    article=info.value; text=Path(article.path()).read_text()
    assert article.suggested_filename=='edited-local-article.md'
    assert 'An edited local article' in text and source['notes'] not in text and 'draft: true' in text
    page.fill('#body','Changed article text.'); assert not page.locator('#reviewed').is_checked() and page.locator('#download').is_disabled()
    page.locator('.recovery-box summary').click()
    assert page.locator('#save-backup').is_disabled()
    page.check('#backup-private-ok')
    with page.expect_download() as info: page.click('#save-backup')
    saved=info.value; saved_bytes=Path(saved.path()).read_bytes(); saved_json=json.loads(saved_bytes)
    assert saved.suggested_filename.startswith('drafttopage-private-workspace-')
    assert saved_json['source']['notes']==source['notes'] and saved_json['draft']['body']=='Changed article text.'
    assert 'reviewed' not in saved_json and 'consent' not in saved_json
    page.click('#clear'); expect(page.locator('#body')).to_have_value('')
    restore(page,saved_bytes); expect(page.locator('#desk-status')).to_contain_text('restored locally')
    assert page.locator('#body').input_value()=='Changed article text.' and not page.locator('#reviewed').is_checked()
    assert not page.locator('#backup-private-ok').is_checked()
    previous=page.locator('#body').input_value()
    restore(page,b'{broken'); expect(page.locator('#desk-status')).to_contain_text('not valid workspace JSON')
    assert page.locator('#body').input_value()==previous
    restore(page,b'x'*(512*1024+1)); expect(page.locator('#desk-status')).to_contain_text('512 KiB')
    assert page.locator('#body').input_value()==previous
    state['accept']=False; restore(page,backup); expect(page.locator('#desk-status')).to_contain_text('cancelled')
    assert page.locator('#body').input_value()==previous
    state['accept']=True; restore(page,backup); expect(page.locator('#desk-status')).to_contain_text('restored locally')
    assert page.locator('#questions li').count()==1
    page.locator('#preview-panel summary').click()
    page.fill('#body','<img src="https://example.com/x" onerror="window.pwned=true">\n\n<script>window.pwned=true</script>\n\n[click](javascript:bad())')
    assert page.locator('#article-preview img, #article-preview script, #article-preview a').count()==0
    assert page.evaluate('window.pwned === undefined')
    page.fill('#body',draft['body']); page.fill('#title',draft['title'])
    layout(page,'write')
    assert state['api']==[]
    report['checks'].append('Public workflow: body copy/download without metadata, standalone HTML download and inert browser rendering')
    report['checks'].append('Local desk: actual Markdown and private-JSON download bytes, restore, invalid/oversized/cancelled files, approval reset, inert preview, and no API calls')
    context.close()
    # Exercise imports in a separate context so existing fixture tests keep their baseline.
    page,context,state=open_page('/write/')
    assert page.locator('#title').get_attribute('aria-invalid') is None
    assert not page.locator('#title-error').is_visible()
    open_more(page); page.click('#start-notes'); page.fill('#notes',source['notes'])
    page.click('#start-import')
    sample=(root/'public/samples/studio.md').read_bytes()
    page.locator('#import-file').set_input_files({'name':'a-custom-article-name.md','mimeType':'text/markdown','buffer':sample})
    expect(page.locator('#import-preview')).to_be_visible()
    assert page.locator('#body').input_value()==''
    page.click('#apply-import')
    expect(page.locator('#desk-status')).to_contain_text('imported locally')
    assert page.locator('#notes').input_value()==source['notes']
    assert page.locator('#slug').input_value()=='a-custom-article-name'
    assert not page.locator('#reviewed').is_checked()
    old=page.locator('#body').input_value()
    page.check('#reviewed')
    page.fill('#import-text','{broken'); page.click('#preview-import')
    expect(page.locator('#desk-status')).to_contain_text('not valid')
    assert page.locator('#body').input_value()==old and page.locator('#reviewed').is_checked()
    page.fill('#import-text',json.dumps(draft)); page.click('#preview-import')
    expect(page.locator('#import-preview')).to_be_visible()
    state['accept']=False; page.click('#apply-import')
    expect(page.locator('#desk-status')).to_contain_text('cancelled')
    assert page.locator('#body').input_value()==old
    state['accept']=True; page.click('#apply-import')
    expect(page.locator('#desk-status')).to_contain_text('imported locally')
    assert page.locator('#questions li').count()==1 and page.locator('#notes').input_value()==source['notes']
    page.check('#reviewed'); page.fill('#review-question-0','Resolved: keep the uncertain outcome explicit.')
    assert not page.locator('#reviewed').is_checked()
    page.click('#add-question'); page.fill('#review-question-1','Check the destination title once more.')
    page.locator('.recovery-box summary').click(); page.check('#backup-private-ok')
    with page.expect_download() as info: page.click('#save-backup')
    review_backup=Path(info.value.path()).read_bytes()
    assert json.loads(review_backup)['draft']['questions']==['Resolved: keep the uncertain outcome explicit.','Check the destination title once more.']
    page.click('#clear'); restore(page,review_backup)
    expect(page.locator('#review-question-1')).to_have_value('Check the destination title once more.')
    assert not page.locator('#reviewed').is_checked()
    open_more(page); page.click('#toggle-focus'); assert page.locator('.source-editor').is_hidden()
    page.fill('#body','One two three')
    page.locator('#body').evaluate('(el)=>el.setSelectionRange(4,7)')
    page.click('[data-format=bold]'); expect(page.locator('#body')).to_have_value('One **two** three')
    page.click('[data-format=bold]'); expect(page.locator('#body')).to_have_value('One two three')
    open_more(page); page.click('#toggle-focus'); assert page.locator('.source-editor').is_visible()
    page.click('#start-import')
    page.fill('#import-text','---\ntitle: A fictional article\nlayout: article\n---\n\nBody.')
    page.click('#preview-import'); assert page.locator('#apply-import').is_disabled()
    page.check('#import-unmapped-ok'); page.click('#apply-import')
    expect(page.locator('#desk-status')).to_contain_text('imported locally')
    page.locator('#import-file').set_input_files({'name':'too-large.md','mimeType':'text/markdown','buffer':b'x'*(512*1024+1)})
    expect(page.locator('#desk-status')).to_contain_text('512 KiB')
    expect(page.locator('#body')).to_have_value('Body.')
    page.fill('#import-text',json.dumps({**draft,'body':'<script>window.importPwned=true</script>','questions':['<img src=x onerror=bad()>']}))
    page.click('#preview-import'); page.click('#apply-import')
    expect(page.locator('#desk-status')).to_contain_text('imported locally')
    page.locator('#preview-panel > summary').click()
    assert page.locator('#article-preview script, #questions img').count()==0
    assert page.evaluate('window.importPwned===undefined')
    layout(page,'import-review'); assert state['api']==[]
    context.close()
    report['checks'].append('Imports: real Markdown file, custom filename, JSON preview/apply/cancel, invalid and oversized preservation, source retention, editable review-note backup/restore, formatting, focus mode, unmapped-field decision, inert imported markup, and no API calls')
    # Explicit formatted import uses the browser parser and never attaches source HTML.
    page,context,state=open_page('/markdown-to-wordpress/')
    page.fill('#title','Keep original title'); page.fill('#body','Keep original article.')
    open_more(page); page.click('#start-notes'); page.fill('#notes','Fictional source notes to retain.')
    page.check('#reviewed'); page.click('#start-formatted-import')
    rich='<b style="font-weight:normal"><h1>A fictional imported article</h1><p>Keep <span style="font-weight:700">important</span> text.<br>Next line.</p><ol start="4"><li>Parent<ol start="7"><li>Child</li></ol></li><li>Next</li></ol><table><tr><th>Name</th><th>Count</th></tr><tr><td>One</td><td>2</td></tr></table><p>Literal *stars* and <a href="https://example.test/">safe link</a>.</p><img src="https://example.test/no-image.png" alt="Fictional image" onerror="document.body.dataset.htmlImportPwned=\'true\'"><script>document.body.dataset.htmlImportPwned="true"</script></b>'
    page.fill('#import-text',rich); page.click('#preview-import')
    expect(page.locator('#import-preview')).to_be_visible()
    assert page.locator('#import-reading-preview strong').inner_text()=='important'
    assert page.locator('#import-reading-preview ol[start="4"] ol[start="7"]').count()==1
    assert page.locator('#import-reading-preview th[scope="col"]').count()==2
    assert page.locator('#import-reading-preview script, #import-reading-preview img, #import-reading-preview iframe').count()==0
    assert page.locator('body').get_attribute('data-html-import-pwned') is None
    expect(page.locator('#body')).to_have_value('Keep original article.')
    assert page.locator('#reviewed').is_checked() and page.locator('#apply-import').is_disabled()
    page.check('#import-changes-ok'); state['accept']=False; page.click('#apply-import')
    expect(page.locator('#body')).to_have_value('Keep original article.')
    state['accept']=True; page.click('#apply-import')
    expect(page.locator('#desk-status')).to_contain_text('imported locally')
    assert page.locator('#notes').input_value()=='Fictional source notes to retain.'
    assert not page.locator('#reviewed').is_checked()
    assert page.locator('#import-text').input_value()=='' and page.locator('#import-reading-preview').inner_html()==''
    # The existing formatted-copy action provides a real rich clipboard round trip.
    page.check('#copy-title'); page.check('#reviewed'); page.click('#copy-formatted')
    expect(page.locator('#desk-status')).to_contain_text('copied')
    page.click('#start-formatted-import'); page.locator('#import-text').press('Control+V')
    page.click('#preview-import'); expect(page.locator('#import-summary')).to_contain_text('Formatted article')
    assert page.locator('#import-reading-preview table').count()==1
    assert page.locator('#apply-import').is_disabled()
    page.click('#cancel-import')
    page.locator('#import-file').set_input_files({'name':'header-choice.html','mimeType':'text/html','buffer':b'<table><tr><td>Name</td></tr><tr><td>One</td></tr></table>'})
    expect(page.locator('#desk-status')).to_contain_text('no explicit header')
    page.check('#import-first-row-headers'); page.click('#preview-import')
    assert page.locator('#import-reading-preview th').count()==1 and page.locator('#apply-import').is_disabled()
    layout(page,'formatted-import'); assert state['api']==[]
    context.close()
    report['checks'].append('Formatted HTML: browser parsing, staged source/readable previews, omissions acknowledgement, cancellation, source retention, checkpointed replacement, approval reset, rich clipboard round trip, HTML file header choice, and no source execution/resources')
    # Checks remain advisory and select exact current editor text. Links never preload.
    page,context,state=open_page('/write/')
    body='## A fictional update\n\nTODO: add context.\n\n## Next step\n\nRead [A resource](https://example.test/a_(b)) and [relative](/local).\n\n![Image](https://example.test/image.png)'
    page.fill('#title','A fictional update'); page.fill('#body',body)
    open_more(page); page.click('#start-notes'); page.fill('#notes','PRIVATE SOURCE CHECK SENTINEL')
    open_more(page); page.click('#start-checks')
    expect(page.locator('#article-outline li')).to_have_count(2)
    page.check('#reviewed'); page.click('#run-checks')
    assert page.locator('#reviewed').is_checked() and page.locator('#body').input_value()==body
    expect(page.locator('#draft-check-status')).to_contain_text('item(s) to consider')
    assert page.locator('#draft-findings li').count()==4
    page.locator('#draft-findings').get_by_role('button',name='Edit line 3',exact=True).click()
    selection=page.locator('#body').evaluate('(el)=>({text:el.value.slice(el.selectionStart,el.selectionEnd),focused:document.activeElement===el})')
    assert selection=={'text':'TODO','focused':True}
    page.locator('#article-outline').get_by_role('button',name='Line 5: ## Next step',exact=True).click()
    assert page.locator('#body').evaluate('(el)=>el.value.slice(el.selectionStart,el.selectionEnd)')=='## Next step'
    page.evaluate("Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.checkCopy=text}}})")
    page.click('#copy-checks')
    assert 'Possible unfinished text' in page.evaluate('window.checkCopy')
    assert 'PRIVATE SOURCE CHECK SENTINEL' not in page.evaluate('window.checkCopy')
    page.fill('#body',body.replace('TODO: add context.','A fictional change is still being tested.'))
    expect(page.locator('#draft-check-status')).to_contain_text('article changed')
    expect(page.locator('#draft-link-status')).to_contain_text('article changed')
    assert page.locator('#draft-findings li').count()==0 and page.locator('#copy-checks').is_disabled()
    page.click('#run-checks'); page.locator('#preview-panel > summary').click()
    links=page.locator('#article-preview a')
    expect(links).to_have_count(1)
    expect(links).to_have_attribute('href','https://example.test/a_(b)')
    assert links.get_attribute('rel')=='noopener noreferrer' and links.get_attribute('target')=='_blank'
    assert page.locator('#article-preview img, #article-preview script').count()==0
    # Leaving the editor must not replace a link before its click is dispatched.
    page.locator('#body').focus()
    page.evaluate("document.querySelector('#article-preview a').addEventListener('click',event=>{event.preventDefault();window.previewLinkClicked=true})")
    links.click()
    assert page.evaluate('window.previewLinkClicked') is True
    page.check('#reviewed')
    with page.expect_download() as info: page.click('#download-html')
    html=Path(info.value.path()).read_text()
    assert 'PRIVATE SOURCE CHECK SENTINEL' not in html and '<a href="https://example.test/a_(b)"' in html
    reader=context.new_page(); reader.set_content(html)
    assert reader.locator('a').count()==1 and reader.locator('script,img').count()==0
    assert reader.locator('h1').count()==1 and reader.locator('h2').count()==2
    layout(reader,'reading-links'); reader.close()
    page.locator('.recovery-box > summary').click(); page.check('#backup-private-ok')
    with page.expect_download() as info: page.click('#save-backup')
    kept=json.loads(Path(info.value.path()).read_bytes())
    assert kept['version']==1 and set(kept)=={'format','version','source','draft'}
    assert 'findings' not in kept['draft']
    page.fill('#body','A clear fictional paragraph.'); page.click('#run-checks')
    expect(page.locator('#draft-check-status')).to_contain_text('No patterns were flagged')
    page.fill('#body','TODO\n\n'*45); page.click('#run-checks')
    assert page.locator('#draft-findings li').count()==40
    expect(page.locator('#draft-check-status')).to_contain_text('Showing the first 40')
    page.fill('#body','<script>bad()</script>\n\n## <img src=x onerror=bad()>\nTODO')
    page.click('#run-checks')
    assert page.locator('#draft-check-panel script, #draft-check-panel img').count()==0
    # Section moves carry descendants, retain checkpoints, invalidate checks,
    # and keep keyboard focus in the outline. These are actual UI assertions.
    sections='Opening.\n\n## First\nTODO\n\n### Detail\nNested.\n\n## Second\nDone.'
    moved='Opening.\n\n## Second\nDone.\n\n## First\nTODO\n\n### Detail\nNested.'
    page.fill('#body',sections); page.click('#run-checks'); page.check('#reviewed')
    page.get_by_role('button',name='Move First down',exact=True).click()
    assert page.locator('#body').input_value()==moved
    assert not page.locator('#reviewed').is_checked()
    assert page.locator('#draft-findings li').count()==0
    assert page.locator('#checkpoint-saved').input_value()==sections
    assert page.locator('#article-outline .review-jump').nth(1).evaluate('(node)=>node===document.activeElement')
    page.get_by_role('button',name='Move First up',exact=True).click()
    assert page.locator('#body').input_value()==sections
    layout(page,'section-order')
    page.fill('#body','## One\nText.\n## Two\n~~~\nUnfinished'); page.click('#run-checks')
    assert page.get_by_role('button',name='Move One down',exact=True).is_disabled()
    expect(page.locator('#outline-status')).to_contain_text('unfinished code fence')
    # Wrapped line geometry must reveal a finding far below the textarea viewport.
    page.fill('#body','word '*2200+'TODO'); page.click('#run-checks')
    page.locator('#draft-findings .review-jump').last.click()
    selection=page.locator('#body').evaluate('(node)=>({text:node.value.slice(node.selectionStart,node.selectionEnd),scroll:node.scrollTop})')
    assert selection['text']=='TODO' and selection['scroll']>0
    page.locator('#draft-check-panel > summary').click()
    page.click('#clear')
    assert page.locator('#article-outline li').count()==0
    assert page.locator('#body').input_value()==''
    layout(page,'draft-checks')
    assert state['api']==[]
    context.close()
    report['checks'].append('Local draft review: exact finding/outline selection, advisory approval, stale-result clearing, private-safe copy, capped findings, inert imported text, real HTML links/downloads, unchanged backup contract, and no URL lookups or API calls')
    # Formatted clipboard representations and actual kit bytes are public-only handoffs.
    page,context,state=open_page('/write/')
    expect(page.locator('#desk-status')).to_contain_text('ready')
    assert page.locator('#copy-formatted').is_disabled() and page.locator('#download-kit').is_disabled()
    body='## A change\n\n**A fictional change** remains uncertain.\n\n- One\n- Two\n\n[Planning resource](https://example.test/)\n\n<script>bad()</script>'
    page.fill('#body',body); page.check('#reviewed')
    assert page.locator('#copy-formatted').is_enabled() and page.locator('#download-kit').is_disabled()
    page.evaluate("""Object.defineProperty(navigator,'clipboard',{configurable:true,value:{write:async items=>{const result={};for(const type of items[0].types)result[type]=await(await items[0].getType(type)).text();window.formattedFixture=result},writeText:async text=>{window.bodyCopyFixture=text}}})""")
    page.click('#copy-formatted'); expect(page.locator('#desk-status')).to_contain_text('without its title')
    copied=page.evaluate('window.formattedFixture')
    assert set(copied)=={'text/html','text/plain'} and '<h1>' not in copied['text/html']
    assert '<strong>A fictional change</strong>' in copied['text/html'] and '<script>' not in copied['text/html']
    assert 'Planning resource (https://example.test/)' in copied['text/plain']
    reader=context.new_page(); reader.set_content(copied['text/html'])
    assert reader.locator('script,img').count()==0 and reader.locator('a').count()==1
    reader.close()
    page.fill('#title','Fictional handoff'); page.check('#copy-title')
    assert not page.locator('#reviewed').is_checked() and page.locator('#copy-formatted').is_disabled()
    page.check('#reviewed'); page.click('#copy-formatted')
    expect(page.locator('#desk-status')).to_contain_text('with its title')
    assert '<h1>Fictional handoff</h1>' in page.evaluate("window.formattedFixture['text/html']")
    page.evaluate("Object.defineProperty(navigator,'clipboard',{configurable:true,value:{write:async()=>{throw new DOMException('Blocked','NotAllowedError')},writeText:async text=>{window.bodyCopyFixture=text}}})")
    page.click('#copy-formatted'); expect(page.locator('#desk-status')).to_contain_text('Formatted copy unavailable')
    expect(page.locator('#body')).to_have_value(body)
    page.click('#copy-body'); assert page.evaluate('window.bodyCopyFixture')==body
    page.evaluate('window.savedClipboardItem=window.ClipboardItem; window.ClipboardItem=undefined')
    page.click('#copy-formatted'); expect(page.locator('#desk-status')).to_contain_text('Formatted copy unavailable')
    page.evaluate('() => { window.ClipboardItem=window.savedClipboardItem; }')
    open_more(page); page.click('#start-notes'); page.fill('#notes','PRIVATE SOURCE KIT SENTINEL')
    page.locator('#review-panel > summary').click(); page.click('#add-question')
    page.fill('#review-question-0','PRIVATE QUESTION KIT SENTINEL')
    page.locator('#publishing-kit-panel > summary').click()
    expect(page.locator('#kit-files li')).to_have_count(4)
    expect(page.locator('#kit-readiness')).to_contain_text('page.md is omitted')
    page.check('#reviewed')
    with page.expect_download() as info: page.click('#download-kit')
    assert info.value.suggested_filename=='fictional-handoff-publishing-kit.zip'
    with zipfile.ZipFile(info.value.path()) as z:
        assert z.testzip() is None and 'page.md' not in z.namelist()
        assert set(z.namelist())=={'article-body.md','reading-page.html','page-details.json','README.txt'}
        contents='\n'.join(z.read(name).decode('utf-8') for name in z.namelist())
        assert 'PRIVATE SOURCE KIT SENTINEL' not in contents and 'PRIVATE QUESTION KIT SENTINEL' not in contents
        assert json.loads(z.read('page-details.json'))['slug']=='fictional-handoff'
    page.locator('#page-details > summary').click()
    for key in ['excerpt','description','slug']: page.fill('#'+key,draft[key])
    page.locator('#markdown-export-panel > summary').click(); page.select_option('#export-format','document')
    expect(page.locator('#kit-files li')).to_have_count(5)
    page.check('#reviewed')
    with page.expect_download() as info: page.click('#download-kit')
    with zipfile.ZipFile(info.value.path()) as z:
        assert z.testzip() is None and '# Fictional handoff' in z.read('page.md').decode('utf-8')
    page.fill('#body','An updated fictional handoff.')
    assert not page.locator('#reviewed').is_checked() and page.locator('#download-kit').is_disabled()
    page.check('#reviewed')
    with page.expect_download() as info: page.click('#download-kit')
    with zipfile.ZipFile(info.value.path()) as z: assert z.read('article-body.md').decode('utf-8')=='An updated fictional handoff.\n'
    open_more(page); page.click('#start-checks')
    expect(page.locator('#draft-check-stats')).to_contain_text('4 approximate words')
    expect(page.locator('#body-count')).to_contain_text('4 approximate words')
    page.locator('.recovery-box > summary').click(); page.check('#backup-private-ok')
    with page.expect_download() as info: page.click('#save-backup')
    saved=json.loads(Path(info.value.path()).read_bytes())
    assert saved['version']==1 and set(saved['draft'])=={'title','excerpt','description','slug','body','questions'}
    restore(page,saved); expect(page.locator('#copy-title')).not_to_be_checked()
    page.locator('#publishing-kit-panel').evaluate('(el)=>el.open=true')
    layout(page,'publishing-handoff')
    assert state['api']==[]; context.close()
    report['checks'].append('Publishing handoff: native ClipboardItem HTML/plain representations with title choices and blocked/unsupported fallback, actual partial/complete ZIP bytes and independent CRC validation, source/review exclusion, latest edits, consistent counts, unchanged backups, restored preferences, and no upload/API calls')
    # Revision recovery uses actual controls, comparisons and download bytes.
    page,context,state=open_page('/write/')
    expect(page.locator('#desk-status')).to_contain_text('ready')
    page.locator('#checkpoint-panel > summary').click()
    page.click('#save-checkpoint'); expect(page.locator('#desk-status')).to_contain_text('Add writing')
    page.fill('#title','Fictional first version'); page.fill('#body','Original article text.')
    open_more(page); page.click('#start-notes'); page.fill('#notes','Fictional private revision source.')
    page.click('#add-question'); page.fill('#review-question-0','Fictional private review question?')
    page.fill('#checkpoint-label','Before revision'); page.check('#reviewed'); page.click('#save-checkpoint')
    assert page.locator('#reviewed').is_checked()
    original=page.locator('#checkpoint-select').input_value()
    page.fill('#body','Replacement article text.'); page.fill('#title','Fictional second version')
    expect(page.locator('#checkpoint-differences')).to_contain_text('Title, Article body')
    assert page.locator('#checkpoint-saved').input_value()=='Original article text.'
    assert page.locator('#checkpoint-current').input_value()=='Replacement article text.'
    page.locator('#article-diff-panel > summary').click()
    expect(page.locator('#article-diff-status')).to_contain_text('1 added line(s); 1 removed line(s)')
    assert page.locator('#article-diff-groups pre').all_text_contents()==['Original article text.','Replacement article text.']
    page.check('#reviewed'); page.locator('#article-diff-panel > summary').click(); page.locator('#article-diff-panel > summary').click()
    assert page.locator('#reviewed').is_checked()
    page.select_option('#checkpoint-field','notes')
    assert page.locator('#checkpoint-saved').input_value()=='Fictional private revision source.'
    assert 'Fictional private revision source.' not in page.locator('#article-diff-groups').inner_text()
    assert 'Fictional private review question?' not in page.locator('#article-diff-groups').inner_text()
    assert page.locator('#download-checkpoint').is_disabled()
    page.check('#checkpoint-private-ok')
    with page.expect_download() as info: page.click('#download-checkpoint')
    checkpoint_json=json.loads(Path(info.value.path()).read_text())
    assert checkpoint_json['draft']['body']=='Original article text.'
    assert checkpoint_json['source']['notes']=='Fictional private revision source.'
    assert checkpoint_json['draft']['questions']==['Fictional private review question?']
    assert set(checkpoint_json)=={'format','version','source','draft'}
    state['accept']=False; page.click('#restore-checkpoint')
    expect(page.locator('#desk-status')).to_contain_text('cancelled')
    assert page.locator('#body').input_value()=='Replacement article text.'
    state['accept']=True; page.check('#reviewed'); page.check('#copy-title'); page.check('#reviewed')
    page.click('#restore-checkpoint')
    expect(page.locator('#body')).to_have_value('Original article text.')
    assert not page.locator('#reviewed').is_checked() and not page.locator('#copy-title').is_checked()
    assert not page.locator('#checkpoint-private-ok').is_checked()
    page.click('#restore-checkpoint'); expect(page.locator('#body')).to_have_value('Replacement article text.')
    page.click('[data-format=bold]')
    formatted=page.locator('#body').input_value(); assert '**' in formatted
    page.click('#restore-checkpoint'); expect(page.locator('#body')).to_have_value('Replacement article text.')
    page.click('#start-import'); page.fill('#import-text','## Fictional import\n\nImported article text.')
    page.click('#preview-import'); page.click('#apply-import')
    assert 'Imported article text.' in page.locator('#body').input_value()
    page.click('#restore-checkpoint'); expect(page.locator('#body')).to_have_value('Replacement article text.')
    page.locator('.recovery-box summary').click(); restore(page,backup)
    expect(page.locator('#desk-status')).to_contain_text('restored locally')
    page.click('#restore-checkpoint'); expect(page.locator('#body')).to_have_value('Replacement article text.')
    open_more(page); page.click('#start-notes'); page.select_option('#template-select','progress'); page.click('#load-outline')
    assert page.locator('#notes').input_value()!='Fictional private revision source.'
    page.click('#restore-checkpoint'); expect(page.locator('#notes')).to_have_value('Fictional private revision source.')
    if not page.locator('#review-panel').evaluate('el=>el.open'): page.locator('#review-panel > summary').click()
    page.get_by_role('button',name='Remove note 1',exact=True).click()
    assert page.locator('#questions li').count()==0
    page.click('#restore-checkpoint'); assert page.locator('#questions li').count()==1
    for i in range(7):
        page.fill('#body','Fictional bounded version '+str(i)); page.click('#save-checkpoint')
    assert page.locator('#checkpoint-select option').count()==5
    page.select_option('#checkpoint-field','body'); layout(page,'revisions-expanded')
    page.fill('#body','a\n'*4000); page.click('#save-checkpoint'); page.fill('#body','b\n'*4000)
    expect(page.locator('#article-diff-status')).to_contain_text('Large changed region grouped')
    assert page.locator('#article-diff-groups .article-diff-preview').all_text_contents()==['a\n'*8,'b\n'*8]
    assert page.locator('.article-diff-complete[open]').count()==0
    layout(page,'revision-diff-large')
    page.check('#reviewed'); page.locator('.article-diff-complete > summary').first.click()
    assert page.locator('.article-diff-complete').first.locator('pre').inner_text()=='a\n'*4000
    assert page.locator('#reviewed').is_checked()
    page.locator('.article-diff-complete > summary').first.click()
    state['accept']=False; page.click('#clear'); assert page.locator('#checkpoint-select option').count()==5
    state['accept']=True; page.click('#clear')
    expect(page.locator('#checkpoint-count')).to_contain_text('0 / 5')
    assert page.locator('#checkpoint-comparison').is_hidden() and page.locator('#body').input_value()==''
    assert page.locator('#checkpoint-saved').input_value()=='' and page.locator('#checkpoint-current').input_value()==''
    assert page.locator('#article-diff-groups li').count()==0
    assert page.locator('.article-diff-complete').count()==0
    assert page.locator('#import-body-preview').input_value()==''
    assert page.locator('#article-preview').inner_text().strip()=='Untitled article'
    assert state['api']==[]
    report['checks'].append('Revisions: empty/save/compare/private download, cancellation, restore/redo, approval/preferences reset, automatic snapshots around formatting/import/file restore/outline/review-note removal, count bounds, clear purge, expanded narrow layouts, and no API calls')
    context.close()
    # Failure of the optional comparison module must not block writing/recovery.
    page,context,state=open_page('/write/',blocked_modules=('/revision-diff-controls.js',))
    expect(page.locator('#desk-status')).to_contain_text('ready')
    page.fill('#body','Fictional original.'); page.locator('#checkpoint-panel > summary').click(); page.click('#save-checkpoint')
    page.fill('#body','Fictional current.'); page.locator('#article-diff-panel > summary').click()
    expect(page.locator('#article-diff-status')).to_contain_text('could not load')
    assert page.locator('#checkpoint-saved').input_value()=='Fictional original.'
    assert page.locator('#checkpoint-current').input_value()=='Fictional current.'
    page.click('#restore-checkpoint'); expect(page.locator('#body')).to_have_value('Fictional original.')
    assert state['blocked']==['/revision-diff-controls.js'] and state['api']==[]
    context.close()
    page,context,state=open_page('/write/')
    expect(page.locator('#desk-status')).to_contain_text('ready')
    page.locator('.recovery-box summary').click(); restore(page,backup)
    expect(page.locator('#desk-status')).to_contain_text('restored locally')
    original_search_body='foo and FOO and foo $& []'
    page.fill('#body',original_search_body); page.check('#reviewed')
    page.click('#start-find'); page.fill('#find-text','foo')
    expect(page.locator('#find-status')).to_contain_text('3 match')
    assert page.locator('#reviewed').is_checked() and page.locator('#replace-match').is_disabled()
    page.press('#find-text','Enter')
    assert page.locator('#body').evaluate('el=>[el.selectionStart,el.selectionEnd]')==[0,3]
    page.click('#find-next'); assert page.locator('#body').evaluate('el=>el.selectionStart')==8
    page.click('#find-previous'); assert page.locator('#body').evaluate('el=>el.selectionStart')==0
    page.fill('#replace-text','$&'); page.click('#replace-match')
    expect(page.locator('#body')).to_have_value('$& and FOO and foo $& []')
    assert not page.locator('#reviewed').is_checked()
    page.locator('#checkpoint-panel > summary').click(); page.click('#restore-checkpoint')
    expect(page.locator('#body')).to_have_value(original_search_body)
    assert page.locator('#find-text').input_value()=='' and page.locator('#replace-text').input_value()==''
    page.fill('#find-text','foo'); page.fill('#replace-text','<script>fictional()</script>'); page.check('#reviewed')
    page.click('#preview-replace-all')
    expect(page.locator('#replace-summary')).to_contain_text('change 3 of 3')
    assert page.locator('#replace-examples li').count()==3 and page.locator('#replace-examples script,img,a').count()==0
    assert page.locator('#reviewed').is_checked() and page.locator('#body').input_value()==original_search_body
    page.check('#find-case'); assert page.locator('#replace-preview').is_hidden()
    page.uncheck('#find-case'); page.click('#preview-replace-all')
    page.fill('#body',original_search_body+'!'); assert page.locator('#replace-preview').is_hidden()
    page.check('#reviewed'); page.click('#preview-replace-all')
    state['accept']=False; page.click('#apply-replace-all')
    expect(page.locator('#desk-status')).to_contain_text('cancelled')
    assert page.locator('#body').input_value()==original_search_body+'!' and page.locator('#reviewed').is_checked()
    layout(page,'article-search-preview')
    state['accept']=True; page.click('#apply-replace-all')
    applied='<script>fictional()</script> and <script>fictional()</script> and <script>fictional()</script> $& []!'
    expect(page.locator('#body')).to_have_value(applied)
    assert page.locator('#notes').input_value()==source['notes'] and page.locator('#questions li').count()==1
    assert not page.locator('#reviewed').is_checked() and page.locator('#replace-examples li').count()==0
    page.check('#reviewed')
    with page.expect_download() as info: page.click('#download-body')
    assert Path(info.value.path()).read_text()==applied+'\n'
    page.click('#restore-checkpoint'); expect(page.locator('#body')).to_have_value(original_search_body+'!')
    page.fill('#body','x '*5997+'needle'); page.fill('#find-text','needle'); page.press('#find-text','Enter')
    wrapped=page.locator('#body').evaluate('el=>({selected:el.value.slice(el.selectionStart,el.selectionEnd),scroll:el.scrollTop,maximum:el.scrollHeight-el.clientHeight})')
    assert wrapped['selected']=='needle' and wrapped['scroll']>=wrapped['maximum']-48 and wrapped['scroll']>0
    page.fill('#body','x'*60000); page.fill('#find-text','x'); page.fill('#replace-text','xx'); page.check('#reviewed')
    page.click('#preview-replace-all'); expect(page.locator('#desk-status')).to_contain_text('exceed 60,000')
    assert page.locator('#body').input_value()=='x'*60000 and page.locator('#reviewed').is_checked()
    page.fill('#replace-text',''); page.click('#preview-replace-all'); page.click('#apply-replace-all')
    expect(page.locator('#body')).to_have_value('')
    assert not page.locator('#reviewed').is_checked() and page.locator('#notes').input_value()==source['notes']
    page.click('#clear')
    assert page.locator('#find-text').input_value()=='' and page.locator('#replace-text').input_value()==''
    assert page.locator('#replace-preview').is_hidden() and page.locator('#replace-examples li').count()==0
    assert state['api']==[]
    report['checks'].append('Article search: exact literal selection and keyboard navigation, approval-preserving preview, single/bulk checkpoint recovery, stale/cancelled/oversized protection, private source/review retention, inert examples, actual edited-body download, deletion, clear purge, expanded narrow layouts, and no API calls')
    context.close()
    page,context,state=open_page('/write/',blocked_modules=('/search-controls.js',))
    expect(page.locator('#desk-status')).to_contain_text('ready')
    expect(page.locator('#find-status')).to_contain_text('could not load')
    assert page.locator('#start-find').is_disabled()
    page.fill('#body','Fictional fallback article.'); page.check('#reviewed')
    assert page.locator('#download-body').is_enabled()
    with page.expect_download() as info: page.click('#download-body')
    assert Path(info.value.path()).read_text()=='Fictional fallback article.\n'
    page.click('[data-format=bold]'); assert '**' in page.locator('#body').input_value()
    assert not page.locator('#reviewed').is_checked() and page.locator('#checkpoint-select option').count()==1
    assert state['blocked']==['/search-controls.js'] and state['api']==[]
    layout(page,'optional-search-unavailable')
    report['checks'].append('Optional search module rejection leaves the core desk ready, formatting and checkpoint recovery available, and actual body export functional')
    context.close()
    if not args.desk_only:
        for path in sorted((root/'public').rglob('*.html')):
            relative=path.relative_to(root/'public').as_posix()
            url='/'+relative.replace('index.html','')
            page,context,state=open_page(url,js=False); layout(page,relative)
            context.close()
        report['checks'].append('All generated public pages readable without JavaScript at 1440, 390, and 320 pixels')
        page,context,state=open_page('/write/#template-progress')
        assert 'What is completed:' in page.locator('#notes').input_value()
        assert page.locator('#profile').input_value()=='update'
        page.locator('.drafting-brief summary').click()
        page.click('#copy-brief'); expect(page.locator('#desk-status')).to_contain_text('Fill in the outline')
        page.fill('#notes',source['notes'])
        assert source['notes'] in page.locator('#drafting-brief').input_value()
        assert state['api']==[]
        context.close()
        report['checks'].append('Direct template handoff and local drafting brief with untouched-outline guard and no API calls')
        page,context,state=open_page('/demo/')
        expect(page.locator('#demo-title')).not_to_have_value('')
        page.select_option('#demo-example','meeting'); page.click('#demo-load')
        expect(page.locator('#demo-title')).to_have_value('Prepare a simple reading-group agenda')
        page.fill('#demo-title','A changed sample title'); page.check('#demo-reviewed')
        with page.expect_download() as info: page.click('#demo-download')
        assert 'A changed sample title' in Path(info.value.path()).read_text()
        page.fill('#demo-body','Changed sample.'); assert page.locator('#demo-download').is_disabled()
        assert state['api']==[]; context.close()
        report['checks'].append('Existing demo: real local modules under CSP, sample switching, downloaded edit, and reapproval')
        page,context,state=open_page('/templates/')
        page.evaluate("Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw new DOMException('Blocked','NotAllowedError')}}})")
        page.click('[data-copy="outline-progress"]')
        expect(page.locator('#resource-status')).to_contain_text('copy it manually')
        assert state['api']==[]; context.close()
        report['checks'].append('Existing templates: script loads under CSP and clipboard failure keeps visible copyable text')
        page,context,state=open_page('/pilot')
        expect(page.locator('#generate')).to_be_enabled()
        page.locator('.source-template summary').click(); page.select_option('#note-template','progress'); page.click('#load-template'); page.check('#consent'); page.click('#generate')
        expect(page.locator('#status')).to_contain_text('Fill in the outline'); assert state['calls']==0
        page.click('#sample'); page.check('#consent'); page.click('#generate'); expect(page.locator('#editor')).to_be_visible()
        expect(page.locator('#title')).to_be_focused()
        assert page.locator('.workspace').get_attribute('aria-busy')=='false'
        page.check('#reviewed')
        page.fill('#audience','A more specific readership')
        assert not page.locator('#reviewed').is_checked()
        page.check('#reviewed'); page.fill('#purpose','Describe the limits clearly.')
        assert not page.locator('#reviewed').is_checked()
        page.fill('#title','A pilot edit'); page.check('#reviewed')
        with page.expect_download() as info: page.click('#download')
        assert 'A pilot edit' in Path(info.value.path()).read_text()
        page.locator('.recovery-box summary').click(); calls=state['calls']; restore(page,backup)
        expect(page.locator('#status')).to_contain_text('restored locally')
        assert state['calls']==calls and not page.locator('#consent').is_checked() and not page.locator('#reviewed').is_checked()
        page.check('#consent'); state['failure']=True; old=page.locator('#body').input_value(); page.click('#generate')
        expect(page.locator('#status')).to_contain_text('Fixture failure'); assert page.locator('#body').input_value()==old
        state['failure']=False; state['expired']=True; page.click('#generate')
        expect(page.locator('#reauth')).to_be_visible(); expect(page.locator('#generate')).to_be_disabled()
        page.check('#backup-private-ok')
        with page.expect_download() as info: page.click('#save-backup')
        assert json.loads(Path(info.value.path()).read_bytes())['draft']['body']==old
        state['expired']=False; calls=state['calls']; page.click('#reconnect'); expect(page.locator('#generate')).to_be_enabled()
        assert state['calls']==calls and page.locator('#body').input_value()==old
        layout(page,'pilot'); context.close()
        report['checks'].append('Pilot: outline guard, generation focus, backup/restore without AI, consent reset, failed/expired-session preservation and local backup, session recheck')
    browser.close()
assert not report['errors'], report['errors']
assert not report['unexpected_requests'], report['unexpected_requests']
report['result']='PASS'
(out/'browser-results.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2))

