"""Browser regression tests with real module loading and CSP response headers.
All HTTP responses are local Playwright routes. Private sign-in/provider replies are
fixtures, not production authentication or real AI. Downloads are actual files in
the automated browser's temporary directory, not a user's device.
Run npm run build first. --desk-only restricts testing to the new local writing desk.
"""
import argparse
import io
import json
import zipfile
import xml.etree.ElementTree as ET
import mimetypes
import os
import re
import shutil
import subprocess
import sys
import time
from contextlib import contextmanager
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
from pathlib import Path
from urllib.parse import urlparse, unquote
from playwright.sync_api import sync_playwright, expect

parser = argparse.ArgumentParser()
scope = parser.add_mutually_exclusive_group()
scope.add_argument('--desk-only', action='store_true')
scope.add_argument('--documents-only', action='store_true')
scope.add_argument('--checklists-only', action='store_true')
scope.add_argument('--import-continue-only', action='store_true')
scope.add_argument('--table-rows-only', action='store_true')
args = parser.parse_args()
root = Path.cwd()
out = root / 'test-results'
out.mkdir(exist_ok=True)
(out/'browser-results.json').unlink(missing_ok=True)
(out/'document-benchmark.json').unlink(missing_ok=True)
origin = 'https://drafttopage.test'
csp = next(line.split(':', 1)[1].strip() for line in (root/'public/_headers').read_text().splitlines() if 'Content-Security-Policy:' in line)
app_html = subprocess.check_output(['node','--input-type=module','-e',"import {appPage} from './src/pages.js'; process.stdout.write(appPage)"], text=True)
report = {'mode':'local routed responses, real ES modules and CSP; no live authentication/provider', 'scope':'table-rows-only' if args.table_rows_only else 'documents-only' if args.documents_only else 'checklists-only' if args.checklists_only else 'import-continue-only' if args.import_continue_only else 'desk-only' if args.desk_only else 'full', 'checks':[], 'errors':[], 'unexpected_requests':[], 'layout':{}, 'motion':'reduced for deterministic fixture geometry'}
source = {'profile':'update','notes':'Fictional source notes, not part of the article.','audience':'Readers','purpose':'Explain the experiment.'}
draft = {'title':'An edited local article','excerpt':'A brief summary.','description':'A factual description.','slug':'edited-local-article','body':'An article paragraph.\n\n## A heading\n\n- One\n- Two','questions':['Does this preserve uncertainty?']}
backup = {'format':'drafttopage-workspace','version':1,'source':source,'draft':draft}

def wait_for_recovery_body(page, key, expected):
    # Playwright's wait_for_function uses eval in some versions, which the
    # production CSP correctly rejects. Poll the actual stored fixture with
    # ordinary browser evaluation and keep the exact-content assertion.
    deadline = time.monotonic() + 15
    while True:
        raw = page.evaluate('(key)=>localStorage.getItem(key)', key)
        saved = json.loads(raw) if raw else {}
        if saved.get('workspace', {}).get('draft', {}).get('body') == expected:
            return
        if time.monotonic() >= deadline:
            raise AssertionError('Browser recovery did not save the exact expected fictional article.')
        page.wait_for_timeout(25)

@contextmanager
def static_download_site():
    # Native static downloads bypass Playwright routing. Give this fixture a real
    # loopback response, with the same public CSP; no production request is made.
    class Handler(SimpleHTTPRequestHandler):
        def __init__(self,*args,**kwargs):super().__init__(*args,directory=str(root/'public'),**kwargs)
        def log_message(self,*args):pass
        def end_headers(self):
            self.send_header('Content-Security-Policy',csp)
            self.send_header('X-Content-Type-Options','nosniff')
            super().end_headers()
    server=ThreadingHTTPServer(('127.0.0.1',0),Handler)
    thread=Thread(target=server.serve_forever,daemon=True);thread.start()
    try:yield 'http://127.0.0.1:'+str(server.server_port)
    finally:server.shutdown();server.server_close();thread.join()

def open_more(page):
    if not page.locator('#start-notes').is_visible():
        page.click('#desk-more > summary')


def open_details(page, selector):
    target=page.locator(selector)
    for parent in target.locator('xpath=ancestor::details').all():
        if not parent.evaluate('el=>el.open'):
            parent.locator(':scope > summary').click()
    if not target.evaluate('el=>el.open'):
        target.locator(':scope > summary').click()


def open_extra_exports(page):
    panel=page.locator('#additional-exports')
    if panel.count() and panel.get_attribute('open') is None:
        page.locator('#additional-exports > summary').click()


with sync_playwright() as p:
    options = {'headless':True,'args':['--no-sandbox','--disable-dev-shm-usage']}
    binary = os.environ.get('CHROMIUM_EXECUTABLE') or shutil.which('chromium') or shutil.which('chromium-browser')
    if binary: options['executable_path'] = binary
    browser = p.chromium.launch(**options)
    report['browser_version']=browser.version
    def open_page(path, js=True, blocked_modules=(), site_origin=origin):
        print('Browser fixture: '+path,flush=True)
        state = {'calls':0,'expired':False,'failure':False,'accept':True,'api':[], 'blocked':[]}
        context = browser.new_context(viewport={'width':1440,'height':1000},java_script_enabled=js,accept_downloads=True,reduced_motion='reduce')
        # Test-browser clipboard permission is scoped to this fictional local origin.
        context.grant_permissions(['clipboard-read','clipboard-write'],origin=site_origin)
        def route(r):
            u = urlparse(r.request.url)
            if u.netloc != urlparse(site_origin).netloc:
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
        page=context.new_page(); page.set_default_timeout(15000)
        page.on('pageerror',lambda error: report['errors'].append(str(error)))
        page.on('dialog',lambda dialog: dialog.accept() if state['accept'] else dialog.dismiss())
        page.goto(site_origin+path)
        return page,context,state
    def layout(page,name):
        for width in [1440,390,320]:
            page.set_viewport_size({'width':width,'height':900})
            overflow=page.evaluate('document.documentElement.scrollWidth > innerWidth')
            report['layout'][f'{name}-{width}']=overflow
            assert not overflow, f'{name} overflows at {width}'
            if name=='write' and width in [1440,390]: page.screenshot(path=str(out/f'write-{width}.png'),full_page=True)
        page.set_viewport_size({'width':1440,'height':1000})
    def stage_backup(page, value):
        data = value if isinstance(value, bytes) else json.dumps(value).encode()
        before = page.locator('#body').input_value()
        reviewed = page.locator('#reviewed').is_checked()
        files = page.locator('#workspace-files')
        if not files.evaluate('el=>el.open'):
            files.locator('summary').first.click()
        page.locator('#restore-backup').set_input_files({'name':'fixture.json','mimeType':'application/json','buffer':data})
        return before,reviewed
    def restore(page, value):
        before,reviewed = stage_backup(page,value)
        expect(page.locator('#restore-preview')).to_be_visible()
        expect(page.locator('#body')).to_have_value(before)
        assert page.locator('#reviewed').is_checked()==reviewed
        expect(page.locator('#apply-restore')).to_be_disabled()
        page.check('#restore-reviewed')
        page.click('#apply-restore')
    if args.documents_only:
        from document_benchmark import run_document_benchmark
        corpus = run_document_benchmark(open_page,root,out)
        report['document_benchmark'] = {'result':corpus['result'],'cases':len(corpus['cases']),'counts':corpus['counts']}
        report['layout'].update(corpus['layout'])
        report['checks'].append('Pinned document corpus: exact and sampled text, structure, disclosures, rejections, independent Word bytes, and native file import/export')
        browser.close()
        assert not report['errors'] and not report['unexpected_requests'], report
        report['result']='PASS'
        (out/'browser-results.json').write_text(json.dumps(report,indent=2))
        print(json.dumps(report,indent=2))
        sys.exit(0)
    if args.table_rows_only:
        from table_row_acceptance import run_table_row_acceptance
        run_table_row_acceptance(open_page, report, open_details)
        browser.close()
        assert not report['errors'] and not report['unexpected_requests'], report
        assert report['layout'] and not any(report['layout'].values()), report['layout']
        report['result'] = 'PASS'
        (out/'browser-results.json').write_text(json.dumps(report,indent=2))
        print(json.dumps(report,indent=2))
        sys.exit(0)
    if not args.checklists_only:
        from import_continue_acceptance import run_import_continue_acceptance
        run_import_continue_acceptance(open_page, root, out, layout)
        report['checks'].append('Reviewed import continuation: four source routes, real Word file and clipboard input, acknowledgement and stale-source guards, cancelled replacement, native Enter to current export, exact article and notes visibility preservation, approval-gated clipboard/download bytes, edit-first alternative, and narrow layouts')
    if args.import_continue_only:
        browser.close()
        assert not report['errors'] and not report['unexpected_requests'], report
        report['result']='PASS'
        (out/'browser-results.json').write_text(json.dumps(report,indent=2))
        print(json.dumps(report,indent=2))
        sys.exit(0)
    from checklist_acceptance import run_checklist_acceptance
    run_checklist_acceptance(open_page, root, out, layout)
    report['checks'].append('Google Docs checklist: native fixture clipboard, explicit-state and exact hierarchy review, contradictory-marker rejection, cancellation and checkpointed apply, actual WordPress/HTML/Word downloads, edit invalidation, no source images or API calls, and narrow layouts')
    if args.checklists_only:
        browser.close()
        assert not report['errors'] and not report['unexpected_requests'], report
        report['result']='PASS'
        (out/'browser-results.json').write_text(json.dumps(report,indent=2))
        print(json.dumps(report,indent=2))
        sys.exit(0)
    page,context,state=open_page('/markdown-to-wordpress/')
    current_links='\n\n'.join('[Current resource '+str(i)+'](https://example.test/'+str(i)+')' for i in range(519))
    open_more(page);page.click('#start-notes')
    page.fill('#notes','PRIVATE_CURRENT_LINKS');page.fill('#title','Fictional current inventory')
    page.evaluate('(text)=>navigator.clipboard.writeText(text)',current_links)
    page.locator('#body').focus();page.keyboard.press('Control+V')
    expect(page.locator('#body')).to_have_value(current_links)
    page.check('#reviewed')
    with page.expect_download() as info:page.click('#download-wordpress')
    inventory_blocks=Path(info.value.path()).read_bytes()
    open_details(page,'#link-editor-panel');open_details(page,'#article-link-list-panel')
    expect(page.locator('#article-link-list li')).to_have_count(40)
    expect(page.locator('#article-link-status')).to_contain_text('519 recognized')
    assert page.locator('#reviewed').is_checked()
    with page.expect_download() as info:page.click('#download-link-notes')
    all_notes=Path(info.value.path()).read_text()
    assert 'Current resource 518' in all_notes and 'PRIVATE_CURRENT_LINKS' not in all_notes
    page.locator('#body').focus();page.keyboard.press('Control+Home');page.keyboard.insert_text('😀\n\n')
    expect(page.locator('#article-link-list li p').first).to_contain_text('Line 3')
    assert not page.locator('#reviewed').is_checked()
    page.locator('#article-link-list button').first.click()
    expect(page.locator('#link-label')).to_have_value('Current resource 0')
    expect(page.locator('#link-url')).to_have_value('https://example.test/0')
    expect(page.locator('#link-target-status')).to_contain_text('line 3')
    page.locator('#body').focus();page.keyboard.press('Control+Z')
    expect(page.locator('#body')).to_have_value(current_links)
    page.evaluate('(text)=>navigator.clipboard.writeText(text)','~~~\n'+current_links+'\n~~~')
    page.locator('#body').focus();page.keyboard.press('Control+A');page.keyboard.press('Control+V')
    expect(page.locator('#article-link-list li')).to_have_count(0)
    expect(page.locator('#download-link-notes')).to_be_disabled()
    page.keyboard.press('Control+Z');expect(page.locator('#body')).to_have_value(current_links)
    expect(page.locator('#article-link-status')).to_contain_text('519 recognized')
    expect(page.locator('#link-apply')).to_be_disabled()
    page.click('#article-link-list-panel > summary');expect(page.locator('#article-link-list li')).to_have_count(0)
    open_details(page,'#article-link-list-panel');expect(page.locator('#article-link-list li')).to_have_count(40)
    page.check('#reviewed')
    with page.expect_download() as info:page.click('#download-wordpress')
    assert Path(info.value.path()).read_bytes()==inventory_blocks
    assert b'PRIVATE_CURRENT_LINKS' not in inventory_blocks
    plain_inventory='\n\n'.join('Fictional plain paragraph '+str(i)+'.' for i in range(900))
    page.evaluate('(text)=>navigator.clipboard.writeText(text)',plain_inventory)
    page.locator('#body').focus();page.keyboard.press('Control+A');page.keyboard.press('Control+V')
    expect(page.locator('#article-link-list li')).to_have_count(0)
    expect(page.locator('#article-link-status')).to_contain_text('0 recognized')
    page.check('#reviewed');page.locator('#body').focus();page.keyboard.press('Control+End')
    page.keyboard.insert_text('\n\n[New current link](https://example.test/current)')
    expect(page.locator('#article-link-list li')).to_have_count(1)
    assert not page.locator('#reviewed').is_checked()
    page.locator('#article-link-list button').first.click()
    expect(page.locator('#link-url')).to_have_value('https://example.test/current')
    assert state['api']==[];layout(page,'current-link-inventory');context.close()
    report['checks'].append('Active link inventory: 519 distinct linked paragraphs, native paste/edit/undo and protected-fence transitions, fresh Unicode source lines and chosen URL, hidden purge/reopen, complete notes and identical actual block download/private exclusion, approval and narrow layouts')
    # The public walkthrough starts with an actual downloaded file, not seeded editor text.
    with static_download_site() as sample_origin:
        page,context,state=open_page('/help/conversion-checks/',js=False,site_origin=sample_origin)
        expect(page.locator('h1')).to_contain_text('Check a Word or Google Docs draft')
        for anchor in ['word','google-docs','wordpress','tested']:
            page.locator('nav[aria-label="Conversion checks"] a[href="#'+anchor+'"]').click()
            expect(page.locator('#'+anchor)).to_be_visible()
        with page.expect_download() as info:
            page.get_by_role('link',name='Download the fictional Word sample',exact=True).click()
        sample_bytes=Path(info.value.path()).read_bytes()
        layout(page,'conversion-checks');assert state['api']==[];context.close()
    with zipfile.ZipFile(io.BytesIO(sample_bytes)) as z:
        assert z.testzip() is None
        xml=ET.fromstring(z.read('word/document.xml'))
        sample_text=''.join(xml.itertext())
        assert all(value in sample_text for value in ['A small publishing plan','Before publishing','Planned'])
    page,context,state=open_page('/word-to-wordpress/')
    page.locator('#import-file').set_input_files({'name':'fictional-sample.docx','mimeType':'application/vnd.openxmlformats-officedocument.wordprocessingml.document','buffer':sample_bytes})
    expect(page.locator('#import-preview')).to_be_visible()
    assert page.locator('#body').input_value()==''
    expect(page.locator('#apply-import')).to_be_disabled()
    expect(page.locator('#import-reading-preview')).to_contain_text('Planned')
    page.check('#import-changes-ok');page.click('#apply-import')
    expect(page.locator('#title')).to_have_value('A small publishing plan')
    open_details(page,'#preview-panel')
    expect(page.locator('#article-preview').get_by_role('heading',name='Before publishing',exact=True)).to_be_visible()
    expect(page.locator('#article-preview li')).to_have_count(2)
    expect(page.locator('#article-preview td')).to_have_count(4)
    assert not page.locator('#reviewed').is_checked()
    page.check('#reviewed')
    with page.expect_download() as info:page.click('#download-wordpress')
    from html.parser import HTMLParser
    class WalkthroughReader(HTMLParser):
        def __init__(self):super().__init__(convert_charrefs=True);self.tags=[];self.text=[]
        def handle_starttag(self,tag,attrs):self.tags.append(tag)
        def handle_data(self,text):self.text.append(text)
    blocks=Path(info.value.path()).read_text();reader=WalkthroughReader();reader.feed(blocks)
    assert all(value in ''.join(reader.text) for value in ['Before publishing','clear structure','Review the article.','Preview the destination.','Publish','Planned'])
    assert 'A small publishing plan' not in ''.join(reader.text)
    assert reader.tags.count('li')==2 and reader.tags.count('td')==4 and reader.tags.count('table')==1
    assert '<!-- wp:heading' in blocks and '<!-- wp:table' in blocks
    assert state['api']==[];context.close()
    report['checks'].append('Public conversion walkthrough: no-JavaScript guide anchors, real sample download and independent Word ZIP read, native staged file import/acknowledgement, separate title, exact expected passages/list/table in actual WordPress download; dated scope and source-specific troubleshooting')
    # Native paste, not the fill helper: Chromium insertText can emit an event per line.
    bulk='\n\n'.join('Fictional paragraph '+str(i)+' keeps one uncertainty.' for i in range(1000))+'\n\n日本語 😀 END_NATIVE_PASTE'
    assert 47000<len(bulk)<59000
    for route_name in ['write','markdown-to-wordpress','word-to-wordpress','word-to-markdown','google-docs-to-wordpress','html-to-markdown','markdown-to-html','markdown-to-word']:
        page,context,state=open_page('/'+route_name+'/')
        page.fill('#body','Earlier fictional writing.');page.check('#reviewed')
        page.evaluate("window.nativeInputs=[];document.addEventListener('input',e=>{if(e.target.id==='body')nativeInputs.push({type:e.inputType,trusted:e.isTrusted,length:e.target.value.length,approved:document.getElementById('reviewed').checked})})")
        page.evaluate('(text)=>navigator.clipboard.writeText(text)',bulk)
        page.locator('#body').focus();page.keyboard.press('Control+A');page.keyboard.press('Control+V')
        assert page.locator('#body').input_value()==bulk and not page.locator('#reviewed').is_checked()
        utf16=len(bulk.encode('utf-16-le'))//2
        assert page.evaluate('nativeInputs')==[{'type':'insertFromPaste','trusted':True,'length':utf16,'approved':False}]
        assert page.locator('#body-count').inner_text().endswith(page.evaluate('(n)=>n.toLocaleString()+" / 60,000 characters"',utf16))
        page.keyboard.press('Control+Z');assert page.locator('#body').input_value()=='Earlier fictional writing.'
        page.keyboard.press('Control+Shift+Z');assert page.locator('#body').input_value()==bulk
        page.check('#reviewed');events=page.evaluate('nativeInputs.length')
        page.evaluate('(text)=>navigator.clipboard.writeText(text)','x'*60001)
        page.locator('#body').focus();page.keyboard.press('Control+A');page.keyboard.press('Control+V')
        assert page.locator('#body').input_value()==bulk and page.locator('#reviewed').is_checked()
        assert page.evaluate('nativeInputs.length')==events
        expect(page.locator('#body-paste-status')).to_contain_text('Current text is unchanged')
        # A selected-range replacement remains native and undoable after rejection.
        page.evaluate('(text)=>navigator.clipboard.writeText(text)','Replaced fictional passage.')
        page.locator('#body').evaluate('el=>el.setSelectionRange(0,el.value.indexOf("\\n"))')
        page.keyboard.press('Control+V')
        assert page.locator('#body').input_value()=='Replaced fictional passage.'+bulk[bulk.index('\n'):]
        assert not page.locator('#reviewed').is_checked()
        page.keyboard.press('Control+Z');assert page.locator('#body').input_value()==bulk
        if route_name=='write':
            boundary=bulk+'x'*(60000-utf16-len(' LIMIT_END'))+' LIMIT_END'
            assert len(boundary.encode('utf-16-le'))//2==60000
            page.evaluate('(text)=>navigator.clipboard.writeText(text)',boundary.replace('\n','\r\n'))
            page.locator('#body').focus();page.keyboard.press('Control+A');page.keyboard.press('Control+V')
            assert page.locator('#body').input_value()==boundary
            assert page.locator('#body-count').inner_text().endswith('60,000 / 60,000 characters')
            page.keyboard.press('Control+Z');assert page.locator('#body').input_value()==bulk
        assert state['api']==[]
        if route_name=='write':layout(page,'native-bulk-paste')
        context.close()
    report['checks'].append('Eight workspaces: exact native 1,000-paragraph clipboard paste, one trusted input event, UTF-16 count and same-event approval reset, undo/redo, atomic oversized rejection retaining approval, selected replacement/undo; 60,000-character CRLF boundary on the desk and narrow layout')

    page,context,state=open_page('/markdown-to-wordpress/')
    pipe='| Name | Note |\n| --- | --- |\n| Fictional | Keep uncertainty |'
    original='日本語 😀 opening.\n\n'+pipe+'\n\nMiddle.\n\n'+pipe+'\n\nEnding.'
    restore(page,{**backup,'source':{**source,'notes':'PRIVATE_TABLE_SOURCE'},'draft':{**draft,'body':original,'questions':['PRIVATE_TABLE_REVIEW']}})
    expect(page.locator('#table-select option')).to_have_count(0)
    page.check('#reviewed')
    with page.expect_download() as info:page.click('#download-wordpress')
    before_blocks=Path(info.value.path()).read_bytes()
    open_details(page,'#table-editor-panel');expect(page.locator('#table-select option')).to_have_count(2)
    page.select_option('#table-select','1');page.locator('#table-editor-panel > summary').click()
    page.locator('#table-editor-panel > summary').click();assert page.locator('#table-select').input_value()=='1'
    page.locator('#editing-tools > summary').click();page.locator('#editing-tools > summary').click()
    assert page.locator('#table-select').input_value()=='1' and page.locator('#reviewed').is_checked()
    with page.expect_download() as info:page.click('#download-wordpress')
    assert Path(info.value.path()).read_bytes()==before_blocks
    page.click('#table-open-selected');page.fill('#table-cell-0-1','Prepared second table.');page.click('#table-preview-change')
    expect(page.locator('#table-change-preview')).to_be_visible()
    page.locator('#editing-tools > summary').click()
    page.locator('#body').focus();page.keyboard.press('Control+Home');page.keyboard.insert_text('New intro.\n\n')
    current='New intro.\n\n'+original
    expect(page.locator('#table-select option')).to_have_count(0)
    assert page.locator('#table-after').input_value()=='' and page.locator('#table-cell-0-1').input_value()=='Prepared second table.'
    assert not page.locator('#reviewed').is_checked()
    page.locator('#editing-tools > summary').click();expect(page.locator('#table-select option')).to_have_count(2)
    page.select_option('#table-select','1');page.click('#table-recheck');expect(page.locator('#table-apply')).to_be_disabled()
    page.click('#table-preview-change');assert page.locator('#table-before').input_value()==pipe
    replacement=page.locator('#table-after').input_value();last=current.rindex(pipe)
    checkpoints=page.locator('#checkpoint-select option').count();page.click('#table-apply')
    applied=current[:last]+replacement+current[last+len(pipe):]
    assert page.locator('#body').input_value()==applied and page.locator('#checkpoint-select option').count()==checkpoints+1
    assert not page.locator('#reviewed').is_checked();page.check('#reviewed')
    with page.expect_download() as info:page.click('#download-wordpress')
    blocks=Path(info.value.path()).read_text()
    from html.parser import HTMLParser
    class TableText(HTMLParser):
        def __init__(self):super().__init__();self.tables=[];self.inside=False
        def handle_starttag(self,tag,attrs):
            if tag=='table':self.tables.append([]);self.inside=True
        def handle_endtag(self,tag):
            if tag=='table':self.inside=False
        def handle_data(self,data):
            if self.inside:self.tables[-1].append(data)
    parsed=TableText();parsed.feed(blocks)
    assert len(parsed.tables)==2 and 'Keep uncertainty' in ''.join(parsed.tables[0]) and 'Prepared second table.' in ''.join(parsed.tables[1])
    assert 'PRIVATE_TABLE' not in blocks
    # New-table preparation keeps every cell while an explicit end recheck follows hidden edits.
    page.click('#table-create');page.fill('#table-head-0','New header');page.fill('#table-head-1','Note');page.fill('#table-cell-0-0','Prepared append')
    page.locator('#table-editor-panel > summary').click();page.locator('#body').focus();page.keyboard.press('Control+End');page.keyboard.insert_text(' More ending.')
    current=applied+' More ending.';expect(page.locator('#table-select option')).to_have_count(0)
    page.locator('#table-editor-panel > summary').click();page.click('#table-recheck');assert page.locator('#table-cell-0-0').input_value()=='Prepared append'
    page.click('#table-preview-change');page.click('#table-apply');assert page.locator('#body').input_value().startswith(current)
    assert 'Prepared append' in page.locator('#body').input_value() and not page.locator('#reviewed').is_checked()
    assert state['api']==[];layout(page,'lazy-table-inventory');context.close()
    report['checks'].append('Lazy table inventory: closed/ancestor deferral, unchanged selected occurrence and exact export bytes, hidden-source choice/preview purge with cell retention, explicit duplicate-table and append-end rechecks, exact checkpointed apply, independent downloaded table text/private exclusion and narrow layouts')

    # A native list choice identifies source without silently loading another preparation.
    page,context,state=open_page('/markdown-to-wordpress/')
    first='| Time | Plan |\n| --- | --- |\n| Morning | Coffee |'
    second='| Time | Plan |\n| --- | --- |\n| Evening | Tea |'
    original='Fictional morning plan.\n\n'+first+'\n\nFictional evening plan.\n\n'+second
    restore(page,{**backup,'source':{**source,'notes':'PRIVATE_CHOICE_SOURCE'},'draft':{**draft,'body':original,'questions':['PRIVATE_CHOICE_REVIEW']}})
    assert page.locator('#table-choice-context').inner_text()=='' and page.locator('#table-choice-context').is_hidden()
    page.check('#reviewed')
    with page.expect_download() as info:page.click('#download-wordpress')
    original_bytes=Path(info.value.path()).read_bytes();history=page.locator('#checkpoint-select option').count()
    open_details(page,'#table-editor-panel')
    assert page.locator('#table-select option').first.inner_text().endswith('2 columns, 1 row · Time')
    expect(page.locator('#table-choice-context')).to_contain_text('First data row: Morning | Coffee.')
    page.locator('#table-select').focus();page.keyboard.press('End')
    expect(page.locator('#table-select')).to_have_value('1');expect(page.locator('#table-choice-context')).to_contain_text('First data row: Evening | Tea.')
    assert page.locator('#table-select').evaluate('el=>el===document.activeElement') and page.locator('#table-working').is_hidden()
    assert page.locator('#body').input_value()==original and page.locator('#reviewed').is_checked()
    page.locator('#table-select').evaluate('el=>window.choiceTextNode=document.getElementById("table-choice-context").firstChild')
    page.fill('#title','Fictional choice identity')
    assert page.evaluate('choiceTextNode===document.getElementById("table-choice-context").firstChild')
    page.check('#reviewed');page.locator('#table-select').focus();page.keyboard.press('Home');page.click('#table-open-selected')
    page.fill('#table-cell-0-1','Prepared morning');page.click('#table-preview-change');preview=page.locator('#table-after').input_value()
    page.locator('#table-select').focus();page.keyboard.press('End')
    assert page.locator('#table-cell-0-1').input_value()=='Prepared morning' and page.locator('#table-after').input_value()==preview
    expect(page.locator('#table-target-status')).to_contain_text('line 3')
    state['accept']=False;page.click('#table-open-selected');assert page.locator('#table-cell-0-1').input_value()=='Prepared morning'
    state['accept']=True;page.click('#table-open-selected');assert page.locator('#table-cell-0-1').input_value()=='Tea'
    assert page.locator('#reviewed').is_checked() and page.locator('#checkpoint-select option').count()==history
    page.fill('#table-cell-0-1','Prepared evening');page.click('#table-preview-change')
    page.locator('#editing-tools > summary').click();expect(page.locator('#table-choice-context')).to_have_text('')
    with page.expect_download() as info:page.click('#download-wordpress')
    assert Path(info.value.path()).read_bytes()==original_bytes
    page.locator('#body').focus();page.keyboard.press('Control+Home');page.keyboard.insert_text('New intro.\n\n')
    current='New intro.\n\n'+original;expect(page.locator('#table-select option')).to_have_count(0)
    assert page.locator('#table-choice-context').inner_text()=='' and page.locator('#table-cell-0-1').input_value()=='Prepared evening'
    page.locator('#editing-tools > summary').click();expect(page.locator('#table-select option')).to_have_count(2);expect(page.locator('#table-select')).to_be_enabled();page.locator('#table-select').focus();page.keyboard.press('End')
    expect(page.locator('#table-choice-context')).to_contain_text('First data row: Evening | Tea.')
    page.click('#table-recheck');page.click('#table-preview-change');replacement=page.locator('#table-after').input_value()
    page.click('#table-apply');applied=current[:current.rindex(second)]+replacement
    assert page.locator('#body').input_value()==applied and not page.locator('#reviewed').is_checked()
    assert page.locator('#checkpoint-select option').count()==history+1
    page.check('#reviewed')
    with page.expect_download() as info:page.click('#download-wordpress')
    blocks=Path(info.value.path()).read_text()
    assert blocks.count('<table ')==2 and '<td>Morning</td><td>Coffee</td>' in blocks and '<td>Evening</td><td>Prepared evening</td>' in blocks
    assert 'Prepared morning' not in blocks and 'PRIVATE_CHOICE' not in blocks
    open_details(page,'#workspace-files');page.check('#backup-private-ok')
    with page.expect_download() as info:page.click('#save-backup')
    saved=json.loads(Path(info.value.path()).read_text());assert saved['draft']['body']==applied
    assert set(saved)=={'format','version','source','draft'} and set(saved['draft'])=={'title','excerpt','description','slug','body','questions'}
    assert saved['source']['notes']=='PRIVATE_CHOICE_SOURCE'
    assert state['api']==[];layout(page,'table-choice-context');context.close()

    page,context,state=open_page('/write/')
    literal='| '+'😀'*500+' | <img src="https://example.test/never.png"> | Third | HIDDEN_FOURTH |\n| --- | --- | --- | --- |\n| '+'🚀'*500+' | [literal](https://example.test/) | Third | HIDDEN_FOURTH |\n| HIDDEN_SECOND_ROW | x | y | z |\n\n| Head | Note |\n| - | --- |\n| One | Two |'
    page.fill('#body',literal);open_details(page,'#table-editor-panel');expect(page.locator('#table-choice-context')).to_contain_text('Headers:');context_text=page.locator('#table-choice-context').inner_text()
    assert '<img src="https://example.test/never.png">' in context_text and '[literal](https://example.test/)' in context_text
    assert 'HIDDEN_' not in context_text and 'first three columns' in context_text and '…' in context_text
    assert page.locator('#table-choice-context a,#table-choice-context img,#table-choice-context svg').count()==0
    assert page.locator('#table-choice-context').evaluate('el=>el.textContent.isWellFormed()&&Array.from(el.textContent).length<650')
    assert page.locator('#table-select').evaluate('el=>el.getAttribute("aria-describedby").split(" ").every(id=>document.getElementById(id))')
    page.locator('#table-select').focus();page.keyboard.press('End');expect(page.locator('#table-choice-context')).to_contain_text('Source editing needed: Use at least three dashes')
    assert page.locator('#body').input_value()==literal and state['api']==[]
    layout(page,'table-choice-literal');page.set_viewport_size({'width':320,'height':900});page.locator('#table-choice-context').scroll_into_view_if_needed();page.screenshot(path=str(out/'table-choice-320.png'));context.close()
    report['checks'].append('Table choices: keyboard context without loading/retargeting, stable nodes, dirty replacement cancel/confirm, hidden/stale source purging and explicit recheck, exact checkpointed apply, current block and private backup downloads, inert bounded Unicode/unsupported snippets, accessible descriptions and narrow layouts')

    # Compare real same-event counts and heading positions to the frozen starting reader.
    page,context,state=open_page('/markdown-to-wordpress/')
    restore(page,{**backup,'source':{**source,'notes':'PRIVATE_STRUCTURE_SOURCE'},'draft':{**draft,'body':'Earlier fictional text.','questions':['PRIVATE_STRUCTURE_REVIEW']}})
    page.evaluate("document.addEventListener('input',e=>{if(e.target.id==='body')window.structureAtInput={text:document.getElementById('body-count').textContent,approved:document.getElementById('reviewed').checked}})")
    open_details(page,'#draft-check-panel')
    structural_states=[
        '日本語 😀 opening.\n\nHeading\nplain words.\n\nTail.',
        '日本語 😀 opening.\n\nHeading\n===\nTail.',
        '日本語 😀 opening.\n\nHeading\n\n---\nTail.',
        '```\n日本語 😀\nHeading\n===\n---\n```\n\n## Real\nReal words.',
        '| Name | Note |\n| --- | --- |\n| Fictional | Keep uncertainty |\n\n- One\n- Two'
    ]
    for value in structural_states:
        expected=json.loads(subprocess.check_output(['node','--input-type=module','-e',r"""import {readFileSync} from 'node:fs';import {baselineArticleStructure} from './tests/fixtures/article-structure-20261016.js';import {inlineTokens,inlineVisibleText} from './public/markdown-inline.js';const blocks=baselineArticleStructure(JSON.parse(readFileSync(0,'utf8')));const words=blocks.reduce((n,b)=>n+(b.kind==='code'?0:(inlineVisibleText(inlineTokens(b.text)).match(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu)||[]).length),0);process.stdout.write(JSON.stringify({words,headings:blocks.filter(b=>b.kind==='heading')}));"""],input=json.dumps(value),text=True))
        page.check('#reviewed');page.fill('#body',value)
        count=page.evaluate('([words,length])=>words.toLocaleString()+" approximate words; "+length.toLocaleString()+" / 60,000 characters"',[expected['words'],len(value.encode('utf-16-le'))//2])
        assert page.evaluate('structureAtInput')=={'text':count,'approved':False}
        assert page.locator('#body').input_value()==value
        page.check('#reviewed');page.click('#run-checks')
        assert page.locator('#draft-check-stats').inner_text().startswith(str(expected['words'])+' approximate words;')
        expect(page.locator('#article-outline .review-jump')).to_have_count(len(expected['headings']))
        if expected['headings']:
            page.locator('#article-outline .review-jump').first.click();heading=expected['headings'][0]
            assert page.locator('#body').evaluate('el=>[el.selectionStart,el.selectionEnd]')==[heading['start'],heading['end']]
        assert page.locator('#reviewed').is_checked()
    with page.expect_download() as info:page.click('#download-wordpress')
    structural_blocks=Path(info.value.path()).read_text()
    assert '<!-- wp:table {"hasFixedLayout":true} -->' in structural_blocks and '<!-- wp:list -->' in structural_blocks
    assert 'Keep uncertainty' in structural_blocks and 'PRIVATE_STRUCTURE' not in structural_blocks
    assert state['api']==[];layout(page,'structural-fast-path');context.close()
    report['checks'].append('Conservative structural scan: same-event Unicode words/characters and approval, ordinary/setext/separator/protected-code/table transitions, exact heading source selection and review totals against the frozen starting reader, current native block download/private exclusions and narrow layouts')

    # Cached word totals remain exact and synchronous, including structural edits.
    page,context,state=open_page('/write/')
    page.evaluate("document.addEventListener('input',e=>{if(e.target.id==='body')window.currentCountAtInput={text:document.getElementById('body-count').textContent,approved:document.getElementById('reviewed').checked}})")
    body='First paragraph.\n\nSecond **marked** phrase.\n\n```\nHidden words.\n```\n\n## Heading'
    restore(page,{**backup,'draft':{**draft,'body':body}})
    def count_text(value):
        words=int(subprocess.check_output(['node','--input-type=module','-e',"import {readFileSync} from 'node:fs';import {articleWordCount} from './public/draft-review.js';process.stdout.write(String(articleWordCount(JSON.parse(readFileSync(0,'utf8')))));"],input=json.dumps(value),text=True))
        return page.evaluate('([words,length])=>words.toLocaleString()+" approximate words; "+length.toLocaleString()+" / 60,000 characters"',[words,len(value.encode('utf-16-le'))//2])
    assert page.locator('#body-count').inner_text()==count_text(body)
    page.check('#reviewed');page.locator('#body').focus();page.keyboard.press('Control+End');page.keyboard.insert_text(' appended words')
    body+=' appended words'
    captured=page.evaluate('window.currentCountAtInput')
    assert captured=={'text':count_text(body),'approved':False}
    page.fill('#title','Metadata does not change article words');page.fill('#notes','Private fictional count fixture.')
    assert page.locator('#body-count').inner_text()==count_text(body) and page.locator('#body').input_value()==body
    unique='\n\n'.join('Fictional paragraph '+str(i)+' keeps one uncertainty.' for i in range(1000))
    assert 40000<len(unique)<59000
    bodies=[
        'same words\n\nsame words','```\nsame words\n\nsame words\n```',
        'same words\n===\n\nsame words','# same words\n\nsame words',
        'same words\n\n```\nsame words','same words\n\n```\nsame words\n```\n\nsame words',
        'café 日本語 😀 and can’t-stop 2026\r\n\r\n[**A label**](https://example.test/) ~~old words~~ `not counted`',
        '| A | B |\n| --- | --- |\n| One | Two |\n\n***\n\n> A quote.'
    ]
    for value in bodies:
        page.check('#reviewed');page.fill('#body',value)
        # Textareas normalize CRLF to LF on actual entry. Compare that exact current source.
        current=page.locator('#body').input_value()
        assert page.evaluate('window.currentCountAtInput')=={'text':count_text(current),'approved':False}
        assert page.locator('#body-count').inner_text()==count_text(current)
    restore(page,{**backup,'source':{**source,'notes':'Private fictional count fixture.'},'draft':{**draft,'body':unique}})
    assert page.locator('#body').input_value()==unique and page.locator('#body-count').inner_text()==count_text(unique)
    page.check('#reviewed');page.locator('#body').focus();page.keyboard.press('Control+End');page.keyboard.insert_text(' Current words.')
    body=unique+' Current words.'
    assert page.locator('#body').input_value()==body and page.evaluate('window.currentCountAtInput')=={'text':count_text(body),'approved':False}
    open_details(page,'#text-format-tools')
    page.locator('#body').evaluate('el=>el.setSelectionRange(0,el.value.indexOf("\\n"))')
    page.check('#reviewed');before=page.locator('#checkpoint-select option').count();page.click('[data-format=strike]')
    marked=page.locator('#body').input_value()
    assert marked=='~~'+body[:body.index('\n')]+'~~'+body[body.index('\n'):]
    assert page.locator('#body-count').inner_text()==count_text(marked) and not page.locator('#reviewed').is_checked()
    assert page.locator('#checkpoint-select option').count()==before+1
    open_details(page,'#checkpoint-panel');page.click('#restore-checkpoint')
    assert page.locator('#body').input_value()==body and page.locator('#body-count').inner_text()==count_text(body)
    assert not page.locator('#reviewed').is_checked()
    page.select_option('#publishing-destination','wordpress');page.check('#reviewed')
    with page.expect_download() as info:page.click('#download-wordpress')
    exported=Path(info.value.path()).read_text()
    assert 'Fictional paragraph 999' in exported and 'Private fictional count fixture.' not in exported and draft['questions'][0] not in exported
    assert page.locator('#body-count').inner_text()==count_text(body) and page.locator('#reviewed').is_checked()
    layout(page,'bounded-word-count')
    page.click('#clear')
    assert page.locator('#body').input_value()=='' and page.locator('#body-count').inner_text()==count_text('')
    assert page.locator('#notes').input_value()=='' and not page.locator('#reviewed').is_checked()
    assert state['api']==[];context.close()
    report['checks'].append('Word-count cache: exact synchronous input-event totals and approval invalidation, semantic fence/heading/code/Unicode edits, metadata invariance, 1000 unique current paragraphs beyond cache bound, formatting/checkpoint restore, current native export/private exclusions, clear reset and narrow layouts')
    # Closed link inventory defers inspection without losing pending preparation.
    page,context,state=open_page('/word-to-wordpress/')
    expect(page.locator('#start-link-editor')).to_be_enabled()
    original='😀 Fictional article.\n\n[<img src=x onerror=bad()>](javascript:alert(1))\n\n'+ '\n\n'.join('[Resource '+str(i)+'](https://example.test/'+str(i)+')' for i in range(45))+'\n\n[**Styled**](https://example.test/styled)\n\n`[Code](https://example.test/code)`'
    restore(page,{**backup,'draft':{**draft,'body':original}})
    assert page.locator('#link-editor-panel').get_attribute('open') is None
    assert page.locator('#article-link-list li').count()==0 and page.locator('#download-link-notes').is_disabled()
    page.check('#reviewed')
    with page.expect_download() as info:page.click('#download-wordpress')
    original_blocks=Path(info.value.path()).read_bytes()
    open_details(page,'#editing-tools')
    page.locator('#body').evaluate('el=>{const at=el.value.indexOf("[Resource 0]");el.setSelectionRange(at,at)}')
    page.click('#start-link-editor');expect(page.locator('#link-label')).to_have_value('Resource 0')
    page.fill('#link-label','Prepared fictional correction');page.fill('#link-url','https://example.test/prepared')
    page.click('#link-preview');pending=page.locator('#link-after').input_value()
    assert page.locator('#body').input_value()==original and page.locator('#reviewed').is_checked()
    open_details(page,'#article-link-list-panel')
    expect(page.locator('#article-link-list li')).to_have_count(40)
    expect(page.locator('#article-link-status')).to_contain_text('47 recognized inline link(s); 46 supported')
    expect(page.locator('#article-link-status')).to_contain_text('first 40')
    assert page.locator('#article-link-list a, #article-link-list img, #article-link-list script').count()==0
    page.locator('#editing-tools > summary').click()
    expect(page.locator('#article-link-list li')).to_have_count(0)
    assert page.locator('#download-link-notes').is_disabled()
    page.locator('#editing-tools > summary').click()
    expect(page.locator('#article-link-list li')).to_have_count(40)
    page.evaluate("window.oldInventoryButton=document.querySelector('#article-link-list button')")
    page.locator('#article-link-list-panel > summary').click()
    expect(page.locator('#article-link-list li')).to_have_count(0)
    assert page.locator('#link-after').input_value()==pending and page.locator('#link-apply').is_enabled()
    downloads=[];page.on('download',lambda item:downloads.append(item.suggested_filename))
    page.evaluate("()=>{document.getElementById('download-link-notes').dispatchEvent(new MouseEvent('click',{bubbles:true}));window.oldInventoryButton.click()}")
    assert downloads==[] and page.locator('#link-after').input_value()==pending
    assert page.locator('#link-label').input_value()=='Prepared fictional correction' and page.locator('#reviewed').is_checked()
    with page.expect_download() as info:page.click('#download-wordpress')
    assert Path(info.value.path()).read_bytes()==original_blocks
    # Staleness still clears the preview while inventory parsing is deferred.
    current='New 日本語 paragraph.\n\n'+original+'\n\n[Newest](https://example.test/newest)'
    page.locator('#body').focus();page.keyboard.press('Control+Home');page.keyboard.insert_text('New 日本語 paragraph.\n\n')
    page.keyboard.press('Control+End');page.keyboard.insert_text('\n\n[Newest](https://example.test/newest)')
    assert page.locator('#body').input_value()==current
    assert not page.locator('#reviewed').is_checked() and page.locator('#link-after').input_value()==''
    assert page.locator('#link-apply').is_disabled() and page.locator('#link-label').input_value()=='Prepared fictional correction'
    page.locator('#link-editor-panel > summary').click()
    page.evaluate("document.getElementById('article-link-list-panel').open=true")
    expect(page.locator('#article-link-list li')).to_have_count(0)
    page.check('#reviewed');count=page.locator('#checkpoint-select option').count()
    page.locator('#link-editor-panel > summary').click()
    expect(page.locator('#article-link-list li')).to_have_count(40)
    expect(page.locator('#article-link-status')).to_contain_text('48 recognized inline link(s); 47 supported')
    page.evaluate('window.oldInventoryButton.click()')
    assert page.locator('#link-label').input_value()=='Prepared fictional correction' and page.locator('#body').input_value()==current
    assert page.locator('#reviewed').is_checked() and page.locator('#checkpoint-select option').count()==count
    with page.expect_download() as info:page.click('#download-link-notes')
    notes=Path(info.value.path()).read_text()
    expected=subprocess.check_output(['node','--input-type=module','-e',"import {readFileSync} from 'node:fs';import {articleLinkNotes} from './public/link-editing.js';process.stdout.write(articleLinkNotes(JSON.parse(readFileSync(0,'utf8'))));"],input=json.dumps(current),text=True)
    assert notes==expected and 'Resource 44' in notes and 'Newest' in notes and 'Code' not in notes
    assert source['notes'] not in notes and draft['questions'][0] not in notes and page.locator('#reviewed').is_checked()
    page.locator('#article-link-list li').filter(has_text='· Resource 0').get_by_role('button').click()
    expect(page.locator('#link-label')).to_have_value('Resource 0')
    expect(page.locator('#link-target-status')).to_contain_text('line 7')
    assert page.locator('#body').input_value()==current and page.locator('#reviewed').is_checked()
    page.fill('#link-label','Current correction');page.fill('#link-url','https://example.test/corrected')
    page.click('#link-preview');page.click('#link-apply')
    corrected=current.replace('[Resource 0](https://example.test/0)','[Current correction](https://example.test/corrected)')
    assert page.locator('#body').input_value()==corrected and not page.locator('#reviewed').is_checked()
    assert page.locator('#checkpoint-select option').count()==count+1
    page.check('#reviewed')
    with page.expect_download() as info:page.click('#download-wordpress')
    from document_benchmark import ArticleHTML
    parsed=ArticleHTML(Path(info.value.path()).read_text())
    assert {'text':'Current correction','href':'https://example.test/corrected'} in parsed.links
    assert not parsed.unsafe and page.locator('#notes').input_value()==source['notes']
    layout(page,'lazy-link-inventory');assert state['api']==[];context.close()
    report['checks'].append('Lazy link inventory: closed derived-state purge, current Unicode line offsets, pending preparation and stale preview guards, detached/hidden actions, unchanged approved block bytes, forty-row/all-link notes with independent full-byte check, exact guarded edit/checkpoint/approval, inert unsafe labels, no URL/API requests and narrow layouts')
    # The optional strike control changes only a safe source selection.
    page,context,state=open_page('/write/')
    original='Old plan stays. **Strong** and `literal`.\n\n## A fictional section\n\n- Keep uncertainty'
    fixture={**backup,'draft':{**draft,'body':original}}
    restore(page,fixture)
    page.select_option('#publishing-destination','wordpress')
    assert page.locator('#text-format-tools').get_attribute('open') is None
    open_details(page,'#text-format-tools')
    button=page.locator('[data-format=strike]')
    expect(button).to_have_attribute('aria-describedby','strike-help')
    expect(page.locator('#strike-help')).to_contain_text('one phrase on one line')
    before_count=page.locator('#checkpoint-select option').count()
    page.check('#reviewed')
    page.locator('#body').focus();page.keyboard.press('Control+Home')
    for _ in range(8):page.keyboard.press('Shift+ArrowRight')
    button.focus();page.keyboard.press('Enter')
    marked='~~Old plan~~'+original[8:]
    assert page.locator('#body').input_value()==marked
    assert page.locator('#body').evaluate('el=>el===document.activeElement && el.value.slice(el.selectionStart,el.selectionEnd)==="Old plan"')
    assert not page.locator('#reviewed').is_checked()
    assert page.locator('#checkpoint-select option').count()==before_count+1
    first_checkpoint=page.locator('#checkpoint-select option').first.get_attribute('value')
    open_details(page,'#preview-panel')
    expect(page.locator('#article-preview s')).to_have_text('Old plan')
    assert 'line-through' in page.locator('#article-preview s').evaluate('el=>getComputedStyle(el).textDecorationLine')
    assert page.locator('#download-wordpress').is_disabled()
    from document_benchmark import ArticleHTML
    for destination,download in [('wordpress','#download-wordpress'),('html','#download-html-source'),('word','#download-word')]:
        page.select_option('#publishing-destination',destination);page.check('#reviewed')
        with page.expect_download() as info:page.click(download)
        if destination=='word':
            with zipfile.ZipFile(info.value.path()) as z:
                assert z.testzip() is None
                doc=ET.fromstring(z.read('word/document.xml'));w='{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
                assert [''.join(t.text or '' for t in r.iter(w+'t')) for r in doc.iter(w+'r') if r.find(w+'rPr/'+w+'strike') is not None]==['Old plan']
                exported=''.join(doc.itertext())
        else:
            exported=Path(info.value.path()).read_text()
            assert ArticleHTML(exported).strikes==['Old plan']
        assert source['notes'] not in exported and draft['questions'][0] not in exported
    page.locator('#body').evaluate('el=>el.setSelectionRange(2,10)')
    button.focus();page.keyboard.press('Space')
    assert page.locator('#body').input_value()==original and not page.locator('#reviewed').is_checked()
    expect(page.locator('#article-preview s')).to_have_count(0)
    assert page.locator('#body').evaluate('el=>el===document.activeElement && el.value.slice(el.selectionStart,el.selectionEnd)==="Old plan"')
    button.click();assert page.locator('#body').input_value()==marked
    for phrase in ['Old','`literal`','## A fictional section']:
        page.check('#reviewed');count=page.locator('#checkpoint-select option').count()
        page.locator('#body').evaluate('(el,phrase)=>{const at=el.value.indexOf(phrase);el.setSelectionRange(at,at+phrase.length)}',phrase)
        button.click()
        expect(page.locator('#desk-status')).to_contain_text('unchanged')
        assert page.locator('#body').input_value()==marked and page.locator('#reviewed').is_checked()
        assert page.locator('#checkpoint-select option').count()==count
    layout(page,'guarded-strike-toolbar')
    open_details(page,'#checkpoint-panel');page.select_option('#checkpoint-select',first_checkpoint)
    page.click('#restore-checkpoint')
    assert page.locator('#body').input_value()==original and not page.locator('#reviewed').is_checked()
    assert page.locator('#notes').input_value()==source['notes'] and page.locator('#questions textarea').first.input_value()==draft['questions'][0]
    assert state['api']==[];context.close()
    report['checks'].append('Strikethrough editing: collapsed optional control, real keyboard selection and Enter/Space toggle, exact source/focus/selection, checkpoint restore, rejected partial/code/block selections preserve writing/approval/history, independently read native WordPress/HTML/Word downloads, private exclusions, and 1440/390/320 layouts')
    # Image inspection is inactive outside WordPress and never retains consent.
    page,context,state=open_page('/markdown-to-wordpress/')
    restore(page,backup)
    images_body='Opening.\n\n![Fictional map](https://example.test/one.png)\n\nInline ![Unsafe](http://example.test/bad.png) text.\n\nEnding.'
    page.fill('#body',images_body);open_details(page,'#wordpress-image-panel')
    expect(page.locator('#wordpress-image-list > li')).to_have_count(2)
    assert not page.locator('#wordpress-linked-images').is_checked()
    page.evaluate('window.oldImageInspect=document.querySelector("#wordpress-image-list button")')
    page.check('#reviewed')
    with page.expect_download() as info:page.click('#download-wordpress')
    plain_images=Path(info.value.path()).read_text();assert '<img ' not in plain_images
    page.check('#wordpress-linked-images');assert not page.locator('#reviewed').is_checked()
    page.check('#reviewed')
    with page.expect_download() as info:page.click('#download-wordpress')
    linked_images=Path(info.value.path()).read_text()
    image_nodes=ET.fromstring('<root>'+linked_images+'</root>').findall('.//img')
    assert len(image_nodes)==1 and image_nodes[0].attrib=={'src':'https://example.test/one.png','alt':'Fictional map'}
    assert source['notes'] not in linked_images and draft['questions'][0] not in linked_images
    inactive_downloads=[];page.on('download',lambda download:inactive_downloads.append(download))
    for destination in ['html','word','markdown']:
        page.select_option('#publishing-destination',destination)
        assert not page.locator('#reviewed').is_checked() and not page.locator('#wordpress-linked-images').is_checked()
        assert page.locator('#wordpress-linked-images').is_disabled() and page.locator('#download-image-plan').is_disabled()
        assert page.locator('#wordpress-image-list > li').count()==0
        assert page.locator('#wordpress-image-status').text_content()=='' and page.locator('#wordpress-image-limit').text_content()==''
        page.check('#reviewed');selected=page.locator('#body').evaluate('el=>[el.selectionStart,el.selectionEnd]')
        page.evaluate("""() => {
          const choice=document.getElementById('wordpress-linked-images');choice.checked=true;choice.dispatchEvent(new Event('change',{bubbles:true}));
          document.getElementById('download-image-plan').dispatchEvent(new MouseEvent('click',{bubbles:true}));
          window.oldImageInspect.dispatchEvent(new MouseEvent('click',{bubbles:true}));
        }""")
        assert page.locator('#reviewed').is_checked() and not page.locator('#wordpress-linked-images').is_checked()
        assert page.locator('#body').input_value()==images_body and page.locator('#body').evaluate('el=>[el.selectionStart,el.selectionEnd]')==selected
    assert inactive_downloads==[]
    page.select_option('#publishing-destination','wordpress');expect(page.locator('#wordpress-image-list > li')).to_have_count(2)
    assert not page.locator('#wordpress-linked-images').is_checked() and not page.locator('#reviewed').is_checked()
    page.check('#reviewed')
    with page.expect_download() as info:page.click('#download-wordpress')
    assert Path(info.value.path()).read_text()==plain_images
    page.check('#wordpress-linked-images');assert not page.locator('#reviewed').is_checked();page.check('#reviewed')
    with page.expect_download() as info:page.click('#download-wordpress')
    assert Path(info.value.path()).read_text()==linked_images
    page.select_option('#publishing-destination','markdown')
    current_images='日本語 😀\n\n![New location](https://example.test/new.png)\n\n![Blocked](http://example.test/blocked.png)'
    page.fill('#body',current_images);page.select_option('#publishing-destination','wordpress')
    expect(page.locator('#wordpress-image-list > li')).to_have_count(2)
    expect(page.locator('#wordpress-image-list > li').first).to_contain_text('Line 3')
    expect(page.locator('#wordpress-image-list > li').last).to_contain_text('Stays literal text')
    assert not page.locator('#wordpress-linked-images').is_checked()
    selected=page.locator('#body').evaluate('el=>[el.selectionStart,el.selectionEnd]')
    page.evaluate('window.oldImageInspect.dispatchEvent(new MouseEvent("click",{bubbles:true}))')
    assert page.locator('#body').evaluate('el=>[el.selectionStart,el.selectionEnd]')==selected
    page.locator('#wordpress-image-list button').first.click()
    expect(page.locator('#image-url')).to_have_value('https://example.test/new.png')
    page.click('#image-preview');expect(page.locator('#image-before')).to_have_value('![New location](https://example.test/new.png)')
    assert page.locator('#body').input_value()==current_images and not page.locator('#reviewed').is_checked()
    layout(page,'inactive-wordpress-images')
    page.check('#wordpress-linked-images');page.fill('#title','A title-only edit')
    assert page.locator('#wordpress-linked-images').is_checked()
    page.fill('#body',current_images+'\n\nEdited.');assert not page.locator('#wordpress-linked-images').is_checked()
    page.check('#wordpress-linked-images');restore(page,backup)
    assert not page.locator('#wordpress-linked-images').is_checked() and not page.locator('#reviewed').is_checked()
    assert page.locator('#article-preview img').count()==0 and state['api']==[]
    context.close()
    report['checks'].append('Inactive WordPress images: native plain/linked block byte equality across destination round trip, independent image attributes, explicit renewed consent, hidden/detached event exclusion, zero inactive downloads, current Unicode references/warnings, exact guided-edit source, title/body/restore invalidation, inert previews, private-field exclusions and narrow layouts')
    # Hidden WordPress handoff work is discarded and re-created from current text.
    page,context,state=open_page('/markdown-to-wordpress/')
    restore(page,backup)
    original='A **bold** and ~~struck~~ fictional passage.\n\n[Word image 2]'
    page.fill('#body',original);open_details(page,'#wordpress-review-panel')
    expect(page.locator('#wordpress-findings li')).to_have_count(1)
    page.evaluate('window.oldHandoffInspect=document.querySelector("#wordpress-findings button")')
    open_details(page,'#wordpress-kit-panel')
    page.check('#reviewed')
    with page.expect_download() as info:page.click('#download-wordpress-kit')
    original_kit=Path(info.value.path()).read_bytes()
    with zipfile.ZipFile(io.BytesIO(original_kit)) as archive:
        assert archive.testzip() is None and len(archive.namelist())==6
        assert archive.read('article-body.md').decode()==original
        assert all(source['notes'] not in archive.read(name).decode() and draft['questions'][0] not in archive.read(name).decode() for name in archive.namelist())
    page.evaluate("""() => {
      window.inactiveWordPressWrites=[];
      const native=navigator.clipboard.writeText.bind(navigator.clipboard);
      navigator.clipboard.writeText=text=>{window.inactiveWordPressWrites.push(text);return native(text);};
    }""")
    for destination in ['html','word','markdown']:
        page.select_option('#publishing-destination',destination)
        assert not page.locator('#reviewed').is_checked()
        for selector in ['#wordpress-review-status','#wordpress-fields-status','#wordpress-kit-status']:
            assert page.locator(selector).text_content()==''
        assert page.locator('#wordpress-findings li').count()==0 and page.locator('#wordpress-kit-files li').count()==0
        page.check('#reviewed')
        page.evaluate("""() => {
          for(const id of ['copy-wordpress-excerpt','copy-wordpress-slug','copy-wordpress-description','download-wordpress-kit']){
            const control=document.getElementById(id);if(!control.disabled)throw Error('Inactive control enabled');
            control.dispatchEvent(new MouseEvent('click',{bubbles:true}));
          }
          window.oldHandoffInspect.dispatchEvent(new MouseEvent('click',{bubbles:true}));
        }""")
        assert page.evaluate('window.inactiveWordPressWrites.length')==0 and page.locator('#reviewed').is_checked()
        assert page.locator('#body').input_value()==original
    page.select_option('#publishing-destination','wordpress')
    expect(page.locator('#wordpress-findings li')).to_have_count(1)
    assert not page.locator('#reviewed').is_checked()
    page.check('#reviewed')
    with page.expect_download() as info:page.click('#download-wordpress-kit')
    assert Path(info.value.path()).read_bytes()==original_kit
    page.select_option('#publishing-destination','markdown')
    current='日本語 😀\n\nA different current paragraph.\n\n[Word image 19]'
    page.fill('#body',current);page.check('#reviewed')
    selected=page.locator('#body').evaluate('el=>[el.selectionStart,el.selectionEnd]')
    page.evaluate('window.oldHandoffInspect.dispatchEvent(new MouseEvent("click",{bubbles:true}))')
    assert page.locator('#body').evaluate('el=>[el.selectionStart,el.selectionEnd]')==selected and page.locator('#reviewed').is_checked()
    page.select_option('#publishing-destination','wordpress')
    expect(page.locator('#wordpress-findings li')).to_have_count(1)
    expect(page.locator('#wordpress-findings li').first).to_contain_text('Line 5:')
    page.locator('#wordpress-findings button').first.click()
    assert page.locator('#body').evaluate('el=>el.value.slice(el.selectionStart,el.selectionEnd)')=='[Word image 19]'
    assert page.locator('#body').input_value()==current and not page.locator('#reviewed').is_checked()
    long_body='Fictional local article. '*2350
    assert 58000<len(long_body)<59000
    restore(page,{**backup,'draft':{**draft,'body':long_body}})
    page.select_option('#publishing-destination','markdown')
    expect(page.locator('#body')).to_have_value(long_body);page.check('#reviewed')
    page.locator('#body').focus();page.keyboard.press('Control+End');page.keyboard.insert_text('!')
    assert not page.locator('#reviewed').is_checked(), 'Native article editing did not clear approval'
    actual=page.locator('#body').input_value()
    assert actual==long_body+'!', {'length':len(actual),'expected':len(long_body)+1,'tail':actual[-50:],'selection':page.locator('#body').evaluate('el=>[el.selectionStart,el.selectionEnd]')}
    assert page.locator('#wordpress-review-status').text_content()=='' and page.locator('#wordpress-findings li').count()==0
    layout(page,'inactive-wordpress');assert state['api']==[];context.close()
    report['checks'].append('Inactive WordPress handoff: hidden statuses/derived DOM cleared across HTML/Word/Markdown, disabled and programmatically guarded actions, no clipboard writes, identical actual six-file ZIP after destination round trip, fresh Unicode source selection after inactive edits, native near-limit typing clears approval immediately, private-field exclusions and narrow layouts')
    # Delayed permission fixtures still complete through the native clipboard.
    page,context,state=open_page('/markdown-to-wordpress/')
    restore(page,backup);page.check('#reviewed')
    page.evaluate("""() => {
      const native=navigator.clipboard.writeText.bind(navigator.clipboard);
      window.delayedClipboard={calls:[]};
      navigator.clipboard.writeText=text=>new Promise((resolve,reject)=>{
        window.delayedClipboard.calls.push(text);
        window.delayedClipboard.finish=()=>native(text).then(resolve,reject);
        window.delayedClipboard.reject=()=>reject(new DOMException('Permission denied','NotAllowedError'));
      });
    }""")
    page.click('#copy-wordpress')
    expect(page.locator('#wordpress-action-status')).to_contain_text('Wait for confirmation')
    assert page.locator('#wordpress-actions').get_attribute('aria-busy')=='true'
    assert page.locator('#copy-wordpress-title').is_disabled() and page.locator('#download-wordpress').is_enabled()
    page.select_option('#publishing-destination','html');page.fill('#body','Current fictional HTML article.');page.check('#reviewed')
    assert page.locator('#copy-html-source').is_disabled() and page.locator('#download-html-source').is_enabled()
    page.locator('#copy-html-source').evaluate("el=>el.dispatchEvent(new MouseEvent('click',{bubbles:true}))")
    assert page.evaluate('window.delayedClipboard.calls.length')==1
    with page.expect_download() as info:page.click('#download-html-source')
    assert 'Current fictional HTML article.' in Path(info.value.path()).read_text()
    page.evaluate('window.delayedClipboard.finish()')
    expect(page.locator('#desk-status')).to_contain_text('earlier export')
    assert page.locator('#html-source-action-status').inner_text()==''
    assert not page.locator('#wordpress-instructions').evaluate('el=>el.open')
    first_clipboard=page.evaluate('navigator.clipboard.readText()')
    assert '<!-- wp:paragraph -->' in first_clipboard and 'Current fictional HTML article.' not in first_clipboard
    page.click('#copy-html-source');page.evaluate('window.delayedClipboard.finish()')
    expect(page.locator('#html-source-action-status')).to_contain_text('HTML source copied as code')
    assert 'Current fictional HTML article.' in page.evaluate('navigator.clipboard.readText()')
    assert page.locator('#html-source-actions').get_attribute('aria-busy')=='false'
    page.click('#copy-html-source');page.evaluate('window.delayedClipboard.reject()')
    expect(page.locator('#html-source-action-status')).to_contain_text('Download the fragment')
    expect(page.locator('#copy-html-source')).to_be_enabled()
    open_details(page,'#html-source-code-panel')
    expect(page.locator('#html-source-preview')).not_to_have_value('')
    assert 'Current fictional HTML article.' in page.locator('#html-source-preview').input_value()
    page.select_option('#publishing-destination','markdown');page.check('#reviewed')
    page.click('#copy-article-markdown')
    expect(page.locator('#markdown-action-status')).to_contain_text('Wait for confirmation')
    assert page.locator('#download-article-markdown').is_enabled()
    page.evaluate('window.delayedClipboard.finish()')
    expect(page.locator('#markdown-action-status')).to_contain_text('Article Markdown copied')
    page.fill('#body','A newer article needs review.')
    assert page.locator('#markdown-action-status').inner_text()=='' and page.locator('#copy-article-markdown').is_disabled()
    layout(page,'copy-feedback');assert state['api']==[];context.close()
    report['checks'].append('Clipboard handoff: delayed native writes, one shared lock across destinations, duplicate-click exclusion, downloads while copying, stale-result identification, nearby success/failure feedback, native clipboard contents, manual fallback, approval reset, and narrow layouts')
    # The primary WordPress instructions open below the action that initiated a
    # real clipboard write. Keyboard users keep their place while reading them.
    page,context,state=open_page('/markdown-to-wordpress/')
    visual_backup={**backup,'source':{**source,'notes':'PRIVATE_NATIVE_COPY_SOURCE'},'draft':{**draft,'questions':['PRIVATE_NATIVE_COPY_REVIEW']}}
    restore(page,visual_backup);page.check('#reviewed')
    copy_button=page.locator('#copy-wordpress')
    relative_top='el=>el.getBoundingClientRect().top-document.getElementById("wordpress-handoff").getBoundingClientRect().top'
    before_copy_top=copy_button.evaluate(relative_top)
    copy_button.focus();page.keyboard.press('Enter')
    expect(page.locator('#wordpress-action-status')).to_contain_text('WordPress blocks copied')
    expect(copy_button).to_be_focused()
    instructions=page.locator('#wordpress-instructions')
    assert instructions.evaluate('el=>el.open')
    assert copy_button.evaluate('el=>Boolean(el.compareDocumentPosition(document.getElementById("wordpress-instructions")) & Node.DOCUMENT_POSITION_FOLLOWING)')
    assert abs(copy_button.evaluate(relative_top)-before_copy_top)<1
    expect(instructions.locator(':scope > ol')).to_contain_text('empty paragraph below the title')
    assert 'Code editor' not in instructions.locator(':scope > ol').inner_text()
    assert not page.locator('#wordpress-code-fallback').evaluate('el=>el.open')
    copied_blocks=page.evaluate('navigator.clipboard.readText()')
    assert '<!-- wp:paragraph -->' in copied_blocks and '<!-- wp:heading -->' in copied_blocks and '<!-- wp:list -->' in copied_blocks
    assert all(value not in copied_blocks for value in [draft['title'],draft['excerpt'],draft['description'],'PRIVATE_NATIVE_COPY_SOURCE','PRIVATE_NATIVE_COPY_REVIEW'])
    fallback_summary=page.locator('#wordpress-code-fallback > summary')
    fallback_summary.focus();page.keyboard.press('Enter')
    expect(fallback_summary).to_be_focused()
    assert page.locator('#wordpress-code-fallback').evaluate('el=>el.open')
    expect(page.locator('#wordpress-code-fallback')).to_contain_text('Undo that paste, or use another empty draft')
    expect(page.locator('#wordpress-code-fallback')).to_contain_text('Return to Visual editor')
    assert page.locator('#reviewed').is_checked() and page.locator('#body').input_value()==draft['body']
    with page.expect_download() as info:page.click('#download-wordpress')
    assert Path(info.value.path()).read_text()==copied_blocks
    assert page.evaluate('navigator.clipboard.readText()')==copied_blocks
    # A pending clipboard permission must not blur the initiating keyboard
    # button. Success preserves later user focus; denial reveals the approved
    # read-only source so a keyboard user can complete the manual fallback.
    page.evaluate("""()=>{
      const native=navigator.clipboard.writeText.bind(navigator.clipboard);
      window.focusClipboard={calls:[]};
      navigator.clipboard.writeText=text=>new Promise((resolve,reject)=>{
        window.focusClipboard.calls.push(text);
        window.focusClipboard.finish=()=>native(text).then(resolve,reject);
        window.focusClipboard.reject=()=>reject(new DOMException('Permission denied','NotAllowedError'));
      });
    }""")
    for index,focus_action in enumerate(['stay','tab','deny','edit']):
        if instructions.evaluate('el=>el.open'):instructions.locator(':scope > summary').click()
        copy_button.focus();page.keyboard.press('Enter')
        expect(copy_button).to_be_focused()
        assert copy_button.get_attribute('aria-disabled')=='true' and not copy_button.evaluate('el=>el.disabled')
        expect(page.locator('#wordpress-action-status')).to_contain_text('Wait for confirmation')
        page.keyboard.press('Enter')
        assert page.evaluate('window.focusClipboard.calls.length')==index+1
        if focus_action=='tab':
            page.keyboard.press('Tab');expect(page.locator('#download-wordpress')).to_be_focused()
        if focus_action=='edit':
            page.fill('#body','Changed while fictional clipboard permission was pending.')
            assert not page.locator('#reviewed').is_checked()
        if focus_action=='deny':page.evaluate('window.focusClipboard.reject()')
        else:page.evaluate('window.focusClipboard.finish()')
        expect(page.locator('#wordpress-action-status')).to_contain_text('Download the blocks' if focus_action=='deny' else 'earlier export' if focus_action=='edit' else 'WordPress blocks copied')
        if focus_action=='tab':expect(page.locator('#download-wordpress')).to_be_focused()
        elif focus_action=='edit':expect(page.locator('#body')).to_be_focused()
        elif focus_action=='deny':
            manual_source=page.locator('#wordpress-code-preview')
            expect(manual_source).to_be_visible()
            expect(manual_source).to_be_focused()
            expect(manual_source).to_have_value(copied_blocks)
            assert manual_source.evaluate('el=>el.readOnly')
            assert page.locator('#wordpress-code-panel').evaluate('el=>el.open')
            assert page.locator('#body').input_value()==draft['body'] and page.locator('#reviewed').is_checked()
            assert page.evaluate('navigator.clipboard.readText()')==copied_blocks
        else:expect(copy_button).to_be_focused()
        assert instructions.evaluate('el=>el.open')==(focus_action in ['stay','tab'])
        assert copy_button.evaluate('el=>el.disabled')==(focus_action=='edit')
        if focus_action!='edit':assert copy_button.get_attribute('aria-disabled')=='false'
        if focus_action!='deny':assert page.evaluate('navigator.clipboard.readText()')==copied_blocks
    layout(page,'wordpress-visual-paste');assert state['api']==[];context.close()
    report['checks'].append('Direct WordPress handoff UI: native keyboard copy and clipboard bytes, success opens Visual-paste steps below stationary section controls, pending/success focus retention, denial focuses exact approved read-only source, duplicate-key exclusion, later Tab/editor focus preserved on success, stale edits unapproved, keyboard Code-editor fallback, exact downloaded source, private-field exclusions, and narrow layouts')
    # A complete held Enter must finish before restore can hand focus to writing.
    for recovery_route in ['write','markdown-to-wordpress','word-to-wordpress','word-to-markdown','google-docs-to-wordpress','html-to-markdown','markdown-to-html','markdown-to-word']:
        page,context,state=open_page('/'+recovery_route+'/')
        expect(page.locator('#desk-status')).to_contain_text('ready')
        saved_keyboard='Fictional exact recovery 日本語 😀.\n\nEnding stays exact.'
        current_keyboard='Current fictional writing to checkpoint.'
        page.fill('#body',saved_keyboard)
        open_details(page,'#browser-recovery-panel');page.check('#browser-recovery-consent');page.click('#browser-recovery-start')
        expect(page.locator('#browser-recovery-pause')).to_be_enabled();page.click('#browser-recovery-pause')
        page.fill('#body',current_keyboard);page.check('#reviewed');page.click('#browser-recovery-inspect')
        page.check('#browser-recovery-consent');page.check('#browser-recovery-reviewed');page.locator('#browser-recovery-restore').focus()
        page.evaluate("""()=>{window.restoreBodyInputs=[];document.getElementById('body').addEventListener('input',e=>window.restoreBodyInputs.push(e.inputType));}""")
        page.keyboard.down('Enter');page.keyboard.down('Enter')
        page.evaluate('()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))')
        assert page.locator('#body').input_value()==current_keyboard and page.locator('#reviewed').is_checked()
        expect(page.locator('#browser-recovery-restore')).to_be_focused()
        assert page.locator('#checkpoint-select option').count()==0 and page.evaluate('window.restoreBodyInputs')==[]
        page.keyboard.up('Enter')
        expect(page.locator('#body')).to_have_value(saved_keyboard);expect(page.locator('#body')).to_be_focused()
        assert not page.locator('#reviewed').is_checked() and page.locator('#checkpoint-select option').count()==1
        assert page.evaluate('window.restoreBodyInputs')==[]
        page.keyboard.press('Control+End');page.keyboard.type(' Deliberate edit.')
        expected_saved=saved_keyboard+' Deliberate edit.'
        expect(page.locator('#body')).to_have_value(expected_saved)
        if recovery_route in ['write','word-to-wordpress']:
            page.click('#browser-recovery-pause')
            page.fill('#body',current_keyboard);page.check('#reviewed');page.click('#browser-recovery-inspect')
            page.check('#browser-recovery-consent');page.check('#browser-recovery-reviewed');page.locator('#browser-recovery-restore').focus()
            page.keyboard.down('Enter');page.keyboard.press('Tab');page.keyboard.up('Enter')
            assert page.locator('#body').input_value()==current_keyboard and page.locator('#reviewed').is_checked()
            expect(page.locator('#browser-recovery-restore')).not_to_be_focused()
            page.locator('#browser-recovery-restore').focus();page.keyboard.down('Enter');page.locator('#body').click();page.keyboard.up('Enter')
            assert page.locator('#body').input_value()==current_keyboard and page.locator('#reviewed').is_checked()
            page.locator('#browser-recovery-restore').focus();page.keyboard.down('Space')
            assert page.locator('#body').input_value()==current_keyboard
            page.keyboard.up('Space');expect(page.locator('#body')).to_have_value(expected_saved)
            page.click('#browser-recovery-pause');page.fill('#body',current_keyboard);page.click('#browser-recovery-inspect')
            page.check('#browser-recovery-consent');page.check('#browser-recovery-reviewed');page.click('#browser-recovery-restore')
            expect(page.locator('#body')).to_have_value(expected_saved)
        assert not page.locator('#reviewed').is_checked()
        page.select_option('#publishing-destination','markdown');page.check('#reviewed')
        with page.expect_download() as info:page.click('#download-article-markdown')
        assert Path(info.value.path()).read_text()==expected_saved+'\n'
        layout(page,'restore-key-release-'+recovery_route);assert state['api']==[];context.close()
    report['checks'].append('Browser recovery activation release: all eight routes retain current writing/approval while native Enter repeats are held, restore exact Unicode text only after release with no body input, preserve checkpoints and deliberate subsequent typing; Tab/pointer cancellation, native Space and pointer restore, and narrow layouts')
    # Explicit recovery actions keep a useful keyboard position as controls change.
    recovery_key='drafttopage.browser-recovery.v1'
    page,context,state=open_page('/write/')
    expect(page.locator('#desk-status')).to_contain_text('ready')
    page.fill('#body','Fictional keyboard recovery article.');page.check('#reviewed')
    page.locator('#browser-recovery-summary').focus();page.keyboard.press('Enter')
    page.locator('#browser-recovery-consent').focus();page.keyboard.press('Space')
    page.keyboard.press('Tab');expect(page.locator('#browser-recovery-start')).to_be_focused()
    page.keyboard.press('Enter');expect(page.locator('#browser-recovery-now')).to_be_focused()
    expect(page.locator('#browser-recovery-now')).to_be_in_viewport()
    page.keyboard.press('Tab');expect(page.locator('#browser-recovery-pause')).to_be_focused()
    page.keyboard.press('Enter');expect(page.locator('#browser-recovery-inspect')).to_be_focused()
    page.keyboard.press('Tab');expect(page.locator('#browser-recovery-forget')).to_be_focused()
    state['accept']=False;page.keyboard.press('Enter')
    expect(page.locator('#browser-recovery-forget')).to_be_focused()
    assert page.evaluate('(key)=>localStorage.getItem(key)!==null',recovery_key)
    state['accept']=True;page.keyboard.press('Enter')
    expect(page.locator('#browser-recovery-consent')).to_be_focused()
    assert page.locator('#reviewed').is_checked() and page.locator('#body').input_value()=='Fictional keyboard recovery article.'
    page.keyboard.press('Space');page.keyboard.press('Tab');page.keyboard.press('Enter')
    expect(page.locator('#browser-recovery-now')).to_be_focused()
    page.keyboard.press('Tab');page.keyboard.press('Enter')
    expect(page.locator('#browser-recovery-inspect')).to_be_focused()
    page.fill('#body','Current fictional writing to protect.');page.check('#reviewed')
    page.locator('#browser-recovery-inspect').focus();page.keyboard.press('Enter')
    expect(page.locator('#browser-recovery-preview-heading')).to_be_focused()
    page.locator('#browser-recovery-consent').focus();page.keyboard.press('Space')
    page.locator('#browser-recovery-reviewed').focus();page.keyboard.press('Space');page.keyboard.press('Tab')
    expect(page.locator('#browser-recovery-restore')).to_be_focused()
    state['accept']=False;page.keyboard.press('Enter')
    # The restore confirmation runs after its Web Lock arrives. Wait for the
    # cancelled action before changing the answer and starting another gesture.
    expect(page.locator('#browser-recovery-status')).to_contain_text('Restore cancelled.')
    expect(page.locator('#browser-recovery-restore')).to_be_enabled()
    expect(page.locator('#browser-recovery-restore')).to_be_focused()
    assert page.locator('#body').input_value()=='Current fictional writing to protect.' and page.locator('#reviewed').is_checked()
    state['accept']=True;page.keyboard.press('Enter')
    # Restoring already hands focus to the restored article. Keep that useful move.
    expect(page.locator('#body')).to_be_focused()
    expect(page.locator('#body')).to_have_value('Fictional keyboard recovery article.')
    assert not page.locator('#reviewed').is_checked() and page.locator('#checkpoint-select option').count()==1
    page.locator('#body').focus();page.keyboard.press('End');page.keyboard.type(' Saved automatically.')
    wait_for_recovery_body(page,recovery_key,'Fictional keyboard recovery article. Saved automatically.')
    expect(page.locator('#body')).to_be_focused()
    other=context.new_page();other.on('pageerror',lambda error:report['errors'].append(str(error)));other.goto(origin+'/write/')
    other.evaluate('(key)=>{const value=JSON.parse(localStorage.getItem(key));value.savedAt=new Date(Date.now()+1000).toISOString();localStorage.setItem(key,JSON.stringify(value));}',recovery_key)
    expect(page.locator('#browser-recovery-status')).to_contain_text('another tab')
    expect(page.locator('#body')).to_be_focused()
    layout(page,'recovery-keyboard');assert state['api']==[];context.close()
    # Delay the genuine lock call, then move away before it can complete.
    page,context,state=open_page('/write/')
    expect(page.locator('#desk-status')).to_contain_text('ready')
    page.fill('#body','Fictional delayed-lock article.')
    open_details(page,'#browser-recovery-panel');page.check('#browser-recovery-consent')
    page.evaluate("""() => {
      const native=navigator.locks.request.bind(navigator.locks);
      navigator.locks.request=(...args)=>new Promise((resolve,reject)=>{
        window.finishRecoveryLock=()=>native(...args).then(resolve,reject);
      });
    }""")
    page.locator('#browser-recovery-start').focus();page.keyboard.press('Enter')
    expect(page.locator('#browser-recovery-start')).to_be_disabled()
    page.locator('#body').focus();page.keyboard.press('End');page.keyboard.type(' Continued while waiting.')
    page.evaluate('void window.finishRecoveryLock()')
    expect(page.locator('#browser-recovery-summary')).to_have_text('Browser recovery: on')
    expect(page.locator('#body')).to_be_focused()
    assert json.loads(page.evaluate('(key)=>localStorage.getItem(key)',recovery_key))['workspace']['draft']['body']==page.locator('#body').input_value()
    assert not page.locator('#reviewed').is_checked() and state['api']==[]
    page.locator('#browser-recovery-pause').focus();page.keyboard.press('Enter')
    expect(page.locator('#browser-recovery-inspect')).to_be_focused()
    page.locator('#browser-recovery-forget').focus();page.keyboard.press('Enter')
    expect(page.locator('#browser-recovery-forget')).to_be_disabled()
    page.click('#article-heading')
    pointer_focus=page.evaluate('document.activeElement.id')
    page.evaluate('void window.finishRecoveryLock()')
    expect(page.locator('#browser-recovery-summary')).to_have_text('Keep work on this browser, optional')
    assert page.evaluate('document.activeElement.id')==pointer_focus
    assert page.evaluate('(key)=>localStorage.getItem(key)',recovery_key) is None
    context.close()
    report['checks'].append('Recovery keyboard continuity: real Enter/Space/Tab through enable, pause, delete and reviewed restore; cancellation, checkpoint and approval behavior; autosave and cross-tab focus preservation; delayed genuine Web Lock completion respects focus and pointer movement to the article; narrow layouts')
    # Opt-in recovery uses real browser storage and origin-scoped locks.
    recovery_key='drafttopage.browser-recovery.v1'
    page,context,state=open_page('/write/')
    expect(page.locator('#desk-status')).to_contain_text('ready')
    expect(page.locator('#article-save-status')).to_contain_text('Saving is off')
    assert page.locator('#article-save-status').get_attribute('aria-live')=='off'
    page.click('#article-save-options')
    expect(page.locator('#browser-recovery-consent')).to_be_focused()
    page.fill('#body','Unstored fictional writing.')
    assert page.evaluate('(key)=>localStorage.getItem(key)',recovery_key) is None
    restore(page,backup)
    open_details(page,'#browser-recovery-panel')
    assert page.locator('#browser-recovery-start').is_disabled()
    page.check('#browser-recovery-consent');page.click('#browser-recovery-start')
    expect(page.locator('#browser-recovery-summary')).to_have_text('Browser recovery: on')
    saved=json.loads(page.evaluate('(key)=>localStorage.getItem(key)',recovery_key))
    assert saved['workspace']['source']==source and saved['workspace']['draft']==draft
    assert set(saved)=={'format','version','savedAt','workspace'}
    assert 'reviewed' not in saved['workspace'] and 'preferences' not in saved['workspace']
    # A staged import must not indefinitely defer saves of the current article.
    open_details(page,'#import-panel')
    page.select_option('#import-format','markdown')
    page.fill('#import-text','# Pending import\n\nPENDING_IMPORT_ONLY must stay outside the recovery copy.')
    page.click('#preview-import')
    expect(page.locator('#import-preview')).to_be_visible()
    page.fill('#body','Newest fictional recovery article.')
    wait_for_recovery_body(page,recovery_key,'Newest fictional recovery article.')
    expect(page.locator('#article-save-status')).to_contain_text('Current writing saved in this browser')
    assert 'PENDING_IMPORT_ONLY' not in page.evaluate('(key)=>localStorage.getItem(key)',recovery_key)
    expect(page.locator('#import-preview')).to_be_visible()
    page.check('#reviewed');page.reload()
    expect(page.locator('#browser-recovery-summary')).to_contain_text('saved copy available')
    expect(page.locator('#article-save-status')).to_contain_text('Saving is off')
    assert page.locator('#body').input_value()=='' and not page.locator('#reviewed').is_checked()
    assert not page.locator('#browser-recovery-consent').is_checked()
    page.click('#browser-recovery-inspect')
    expect(page.locator('#browser-recovery-saved')).to_have_value('Newest fictional recovery article.')
    assert page.locator('#browser-recovery-preview-heading').evaluate('el=>el===document.activeElement')
    page.check('#browser-recovery-consent');page.check('#browser-recovery-reviewed')
    page.fill('#body','Current writing to keep until confirmation.')
    expect(page.locator('#browser-recovery-preview')).not_to_be_visible()
    assert page.locator('#browser-recovery-saved').input_value()==''
    page.check('#reviewed');page.click('#browser-recovery-inspect')
    page.select_option('#browser-recovery-fields','notes')
    expect(page.locator('#browser-recovery-saved')).to_have_value(source['notes'])
    page.check('#browser-recovery-reviewed')
    state['accept']=False;page.click('#browser-recovery-restore')
    expect(page.locator('#browser-recovery-status')).to_contain_text('cancelled')
    assert page.locator('#body').input_value()=='Current writing to keep until confirmation.' and page.locator('#reviewed').is_checked()
    state['accept']=True;page.click('#browser-recovery-restore')
    expect(page.locator('#body')).to_have_value('Newest fictional recovery article.')
    assert not page.locator('#reviewed').is_checked() and page.locator('#notes').input_value()==source['notes']
    assert page.locator('#checkpoint-select option').count()==1
    page.check('#reviewed')
    with page.expect_download() as info:page.click('#download-wordpress')
    exported=Path(info.value.path()).read_text()
    assert 'Newest fictional recovery article.' in exported and source['notes'] not in exported and draft['questions'][0] not in exported
    other=context.new_page();other.set_default_timeout(15000)
    other.on('pageerror',lambda error:report['errors'].append(str(error)))
    other.on('dialog',lambda dialog:dialog.accept())
    other.goto(origin+'/markdown-to-wordpress/')
    expect(other.locator('#browser-recovery-summary')).to_contain_text('saved copy available')
    other.click('#browser-recovery-inspect');other.check('#browser-recovery-consent');other.check('#browser-recovery-reviewed')
    other.click('#browser-recovery-restore')
    expect(other.locator('#browser-recovery-status')).to_contain_text('Another Draft to Page tab')
    expect(other.locator('#browser-recovery-restore')).to_be_focused()
    assert other.locator('#body').input_value()==''
    other.click('#browser-recovery-forget')
    expect(other.locator('#browser-recovery-status')).to_contain_text('Another Draft to Page tab')
    expect(other.locator('#browser-recovery-forget')).to_be_focused()
    page.click('#browser-recovery-pause')
    expect(page.locator('#browser-recovery-status')).to_contain_text('paused')
    other.click('#browser-recovery-restore')
    expect(other.locator('#body')).to_have_value('Newest fictional recovery article.')
    layout(other,'browser-recovery')
    other.click('#browser-recovery-forget')
    expect(other.locator('#browser-recovery-summary')).to_contain_text('optional')
    assert page.evaluate('(key)=>localStorage.getItem(key)',recovery_key) is None
    expect(page.locator('#browser-recovery-forget')).not_to_be_visible()
    assert page.locator('#body').input_value()=='Newest fictional recovery article.'
    other.fill('#body','Kept only in this tab after deletion.')
    assert other.evaluate('(key)=>localStorage.getItem(key)',recovery_key) is None
    other.check('#browser-recovery-consent');other.click('#browser-recovery-start')
    expect(other.locator('#browser-recovery-summary')).to_have_text('Browser recovery: on')
    open_more(other);other.click('#start-notes');other.click('#clear')
    expect(other.locator('#body')).to_have_value('')
    assert other.evaluate('(key)=>localStorage.getItem(key)',recovery_key) is None
    assert state['api']==[];context.close()
    report['checks'].append('Opt-in browser recovery: real localStorage and Web Locks, default-off/no writes, visible passive save status and options focus, consent, current-article autosave while a staged import stays pending and excluded, reload without auto-restore, exact private field comparison, stale/cancelled restore protection, checkpointed approval-clearing restore, private export exclusion, real competing tabs, pause, deletion, and clear')
    page,context,state=open_page('/markdown-to-wordpress/',blocked_modules=('/browser-recovery.js',))
    expect(page.locator('#browser-recovery-status')).to_contain_text('could not load')
    expect(page.locator('#article-save-status')).to_contain_text('unavailable')
    page.click('#article-save-options')
    expect(page.locator('#backup-private-ok')).to_be_focused()
    page.fill('#body','Core conversion stays available.');page.check('#reviewed')
    expect(page.locator('#download-wordpress')).to_be_enabled()
    assert page.evaluate('(key)=>localStorage.getItem(key)',recovery_key) is None
    context.close()
    report['checks'].append('Optional recovery-module failure leaves writing and reviewed exports available without browser storage')
    # Linked WordPress images are explicit; no image requests occur in this app.
    page,context,state=open_page('/markdown-to-wordpress/')
    image_body='## A fictional workshop\n\n![Participants at the workshop](https://example.test/photo.jpg?a=1&b=2)\n\nInline ![Inline example](https://example.test/inline.jpg) stays text.'
    image_backup={'format':'drafttopage-workspace','version':1,'source':source,'draft':{**draft,'body':image_body}}
    restore(page,image_backup)
    expect(page.locator('#desk-status')).to_contain_text('Reviewed backup restored')
    page.locator('#wordpress-image-panel > summary').click()
    expect(page.locator('#wordpress-linked-images')).to_be_enabled()
    expect(page.locator('#wordpress-image-status')).to_contain_text('2 image reference')
    assert not page.locator('#wordpress-linked-images').is_checked()
    page.check('#reviewed')
    open_details(page,'#wordpress-code-panel')
    expect(page.locator('#wordpress-code-preview')).not_to_have_value('')
    assert '<img ' not in page.locator('#wordpress-code-preview').input_value()
    page.check('#wordpress-linked-images')
    assert not page.locator('#reviewed').is_checked()
    expect(page.locator('#wordpress-code-preview')).to_have_value('')
    page.check('#reviewed')
    selected_html=page.locator('#wordpress-code-preview').input_value()
    assert selected_html.count('<!-- wp:image -->')==1 and selected_html.count('<img ')==1
    assert 'alt="Participants at the workshop"' in selected_html and 'a=1&amp;b=2' in selected_html
    assert '![Inline example]' in selected_html
    with page.expect_download() as info:page.click('#download-wordpress')
    assert Path(info.value.path()).read_text()==selected_html
    with page.expect_download() as info:page.click('#download-image-plan')
    image_plan=Path(info.value.path()).read_text()
    assert image_plan.count('Reference:')==2 and '1 linked Image block(s) selected' in image_plan
    page.locator('#wordpress-kit-panel > summary').click()
    with page.expect_download() as info:page.click('#download-wordpress-kit')
    with zipfile.ZipFile(info.value.path()) as z:
        assert z.testzip() is None and len(z.namelist())==6
        assert z.read('wordpress-blocks.html').decode()==selected_html
        assert z.read('article-body.md').decode()==image_body
        assert b'<img ' not in z.read('reading-page.html')
        assert '1 linked Image block(s) selected' in z.read('REVIEW.txt').decode()
        assert all(source['notes'] not in z.read(name).decode() and draft['questions'][0] not in z.read(name).decode() for name in z.namelist())
    layout(page,'wordpress-linked-images')
    page.fill('#body',image_body+'\n\nEdited context.')
    assert not page.locator('#reviewed').is_checked() and not page.locator('#wordpress-linked-images').is_checked()
    expect(page.locator('#wordpress-code-preview')).to_have_value('')
    page.check('#wordpress-linked-images')
    page.select_option('#publishing-destination','word')
    page.select_option('#publishing-destination','wordpress')
    assert not page.locator('#wordpress-linked-images').is_checked()
    restore(page,image_backup)
    assert not page.locator('#wordpress-linked-images').is_checked()
    assert state['api']==[];context.close()
    page,context,state=open_page('/markdown-to-wordpress/',blocked_modules=('/wordpress-image-controls.js',))
    expect(page.locator('#wordpress-image-status')).to_contain_text('could not load')
    page.fill('#body',image_body);page.check('#reviewed')
    open_details(page,'#wordpress-code-panel')
    expect(page.locator('#wordpress-code-preview')).not_to_have_value('')
    assert '<img ' not in page.locator('#wordpress-code-preview').input_value()
    expect(page.locator('#copy-wordpress')).to_be_enabled()
    context.close()
    report['checks'].append('Linked WordPress images: explicit mode, native block source and exact actual download, full image plan, six-file ZIP privacy, literal other exports, stale/reset/destination guards, 1440/390/320 reflow, optional-controls fallback, and zero image network requests')
    # Guided source reviews use existing private notes and preserve v1 files.
    page,context,state=open_page('/write/')
    review_passage='The fictional workshop had 18 participants.'
    page.fill('#title','Fictional workshop')
    page.fill('#body',review_passage)
    page.locator('#source-review-panel > summary').click()
    expect(page.locator('#review-passage')).to_be_enabled()
    page.fill('#review-passage',review_passage)
    page.fill('#review-source-reference','Fictional register, page 2')
    page.fill('#review-evidence','PRIVATE evidence: 18 attendees, excluding two hosts.')
    page.select_option('#review-decision',label='Supported by this source')
    page.check('#reviewed')
    assert page.locator('#reviewed').is_checked()
    layout(page,'source-review-preparation')
    page.click('#save-source-review')
    expect(page.locator('#source-review-count')).to_contain_text('1 saved passage')
    assert not page.locator('#reviewed').is_checked()
    page.get_by_role('button',name='Select passage for note 1',exact=True).click()
    assert page.locator('#body').evaluate('(e)=>e.value.slice(e.selectionStart,e.selectionEnd)')==review_passage
    page.get_by_role('button',name='Edit review note 1',exact=True).click()
    page.fill('#body',review_passage+' Updated context.')
    expect(page.locator('#save-source-review')).to_be_disabled()
    expect(page.locator('#source-review-status')).to_contain_text('changed')
    page.click('#refresh-source-review')
    page.fill('#review-evidence','PRIVATE revised evidence: count excludes two hosts.')
    page.click('#save-source-review')
    expect(page.locator('#source-review-count')).to_contain_text('1 saved passage')
    page.check('#reviewed')
    open_extra_exports(page)
    with page.expect_download() as info:page.click('#download-body')
    assert Path(info.value.path()).read_text()==review_passage+' Updated context.\n'
    page.locator('.recovery-box:has(#backup-controls) > summary').click()
    page.check('#backup-private-ok')
    with page.expect_download() as info:page.click('#save-backup')
    review_backup=json.loads(Path(info.value.path()).read_bytes())
    assert review_backup['version']==1 and len(review_backup['draft']['questions'])==1
    assert 'PRIVATE revised evidence' in review_backup['draft']['questions'][0]
    page.fill('#review-passage',review_passage)
    stage_backup(page,review_backup)
    expect(page.locator('#restore-summary')).to_contain_text('matches your current writing')
    page.check('#restore-reviewed'); expect(page.locator('#apply-restore')).to_be_disabled()
    expect(page.locator('#review-passage')).to_have_value(review_passage)
    # A matching file is a deliberate no-op. Change saved writing to exercise
    # replacement and purging of unsaved passage preparation separately.
    page.fill('#body','Temporary changed wording before restoration.')
    page.check('#restore-reviewed'); page.click('#apply-restore')
    expect(page.locator('#review-passage')).to_have_value('')
    expect(page.locator('#source-review-count')).to_contain_text('1 saved passage')
    page.fill('#body',review_passage+' '+review_passage)
    expect(page.get_by_role('button',name='Select passage for note 1',exact=True)).to_be_disabled()
    expect(page.locator('#source-review-records')).to_contain_text('more than once')
    page.fill('#body','New wording.')
    expect(page.locator('#source-review-records')).to_contain_text('no longer matches')
    layout(page,'source-review-records')
    assert state['api']==[]
    context.close()
    page,context,state=open_page('/write/',blocked_modules=('/source-review-controls.js',))
    expect(page.locator('#source-review-status')).to_contain_text('could not load')
    page.fill('#body','Core writing still works.')
    page.check('#reviewed')
    expect(page.locator('#copy-body')).to_be_enabled()
    context.close()
    report['checks'].append('Source review: preparation, saved private note, exact selection, stale pending guard, update in place, approval/checkpoint flow, actual body and v1 backup bytes, restore purge, missing/repeated passages, 1440/390/320 reflow, and optional-load failure')
    # Private collections are explicit snapshots, separate from the current editor.
    page,context,state=open_page('/write/')
    restore(page,backup)
    expect(page.locator('#desk-status')).to_contain_text('Reviewed backup restored')
    open_details(page,'#draft-collection-panel')
    expect(page.locator('#draft-collection-controls')).to_be_enabled()
    page.fill('#draft-collection-name','First article')
    page.check('#reviewed');page.click('#add-to-draft-collection')
    assert page.locator('#reviewed').is_checked()
    page.fill('#body','Second fictional article')
    page.fill('#draft-collection-name','Second article');page.click('#add-to-draft-collection')
    expect(page.locator('#draft-collection-count')).to_contain_text('2 / 8')
    page.select_option('#draft-collection-select','0')
    page.locator('#draft-collection-inspection > summary').click()
    expect(page.locator('#draft-collection-saved-preview')).not_to_have_value('')
    assert json.loads(page.locator('#draft-collection-saved-preview').input_value())['draft']['body']==draft['body']
    page.locator('#draft-collection-inspection > summary').click()
    expect(page.locator('#draft-collection-saved-preview')).to_have_value('')
    assert page.locator('#export-extra-settings').get_attribute('open') is None
    open_details(page,'#publishing-profile-panel')
    assert page.locator('#export-extra-settings').get_attribute('open') is not None
    page.fill('#publishing-profile-name','Temporary publishing setup')
    page.fill('#publishing-profile-checks','Fictional reminder')
    page.click('#open-draft-collection-entry')
    assert page.locator('#body').input_value()==draft['body'] and page.locator('#notes').input_value()==source['notes']
    assert not page.locator('#reviewed').is_checked() and page.locator('#publishing-profile-name').input_value()==''
    assert 'Before opening a saved article' in page.locator('#checkpoint-select').text_content(), page.locator('#checkpoint-select').text_content()
    page.fill('#body','An update to the first article');page.click('#update-draft-collection-entry')
    page.click('#undo-draft-collection')
    assert page.locator('#body').input_value()=='An update to the first article'
    page.click('#remove-draft-collection-entry');page.click('#undo-draft-collection')
    page.check('#draft-collection-private-ok')
    with page.expect_download() as info:page.click('#download-draft-collection')
    collection_bytes=Path(info.value.path()).read_bytes();collection=json.loads(collection_bytes)
    assert set(collection)=={'format','version','entries'} and len(collection['entries'])==2
    assert collection['entries'][0]['workspace']['draft']['body']==draft['body']
    assert collection['entries'][1]['workspace']['draft']['body']=='Second fictional article'
    assert collection['entries'][0]['workspace']['source']==source
    for width in [1440,850,390,320]:
        page.set_viewport_size({'width':width,'height':900})
        assert not page.evaluate('document.documentElement.scrollWidth > innerWidth'),f'Collection overflows at {width}'
    assert state['calls']==0;context.close()
    page,context,state=open_page('/markdown-to-wordpress/')
    page.fill('#body','Current editor must survive collection loading.')
    page.check('#reviewed');open_details(page,'#draft-collection-panel')
    page.locator('#load-draft-collection').set_input_files({'name':'collection.json','mimeType':'application/json','buffer':collection_bytes})
    expect(page.locator('#draft-collection-file-preview')).to_be_visible()
    page.click('#apply-draft-collection')
    assert page.locator('#body').input_value()=='Current editor must survive collection loading.' and page.locator('#reviewed').is_checked()
    page.click('#open-draft-collection-entry')
    assert page.locator('#body').input_value()==draft['body'] and not page.locator('#reviewed').is_checked()
    page.fill('#body','Temporary collection editor change before backup restoration.')
    restore(page,backup);expect(page.locator('#desk-status')).to_contain_text('Reviewed backup restored')
    expect(page.locator('#draft-collection-count')).to_contain_text('2 / 8')
    page.click('#clear')
    expect(page.locator('#draft-collection-count')).to_contain_text('0 / 8')
    assert page.locator('#undo-draft-collection').is_disabled() and page.locator('#draft-collection-saved-preview').input_value()==''
    context.close()
    page,context,state=open_page('/markdown-to-word/',blocked_modules=('/draft-collection-controls.js',))
    page.fill('#body','Core writing remains usable.');page.check('#reviewed')
    expect(page.locator('#download-word')).to_be_enabled()
    expect(page.locator('#draft-collection-status')).to_contain_text('could not load')
    context.close()
    report['checks'].append('Collections: explicit multi-article snapshots, source/question preservation, open checkpoint/profile reset, saved-only download, one-step undo, local file load preserving editor, restore/clear, narrow overflow, and optional-module failure')
    # Portable profiles reuse choices without replacing writing or completing review.
    for profile_route in ['write','markdown-to-wordpress','markdown-to-html','markdown-to-word']:
        page,context,state=open_page('/'+profile_route+'/')
        page.fill('#title','Private fictional article')
        page.fill('#body','## Keep this article\n\nA fictional paragraph to preserve.')
        assert page.locator('#export-extra-settings').get_attribute('open') is None
        open_details(page,'#publishing-profile-panel')
        assert page.locator('#export-extra-settings').get_attribute('open') is not None
        expect(page.locator('#publishing-profile-controls')).to_be_enabled()
        page.fill('#publishing-profile-name','Weekly website')
        page.fill('#publishing-profile-checks','Compare dates with source notes\nPreview my final page')
        page.select_option('#publishing-destination','html')
        page.check('#html-include-title')
        first=page.locator('#publishing-checklist-items input').first
        first.check();expect(page.locator('#publishing-checklist-status')).to_contain_text('1 / 2')
        page.check('#reviewed')
        with page.expect_download() as info:page.click('#download-publishing-profile')
        content=Path(info.value.path()).read_text()
        profile=json.loads(content)
        assert profile['preferences']['destination']=='html' and profile['preferences']['htmlTitle'] is True
        assert set(profile)=={'format','version','name','preferences','checklist'}
        assert 'Private fictional article' not in content and 'fictional paragraph' not in content
        page.select_option('#publishing-destination','word')
        page.check('#reviewed')
        page.locator('#load-publishing-profile').set_input_files({'name':'profile.json','mimeType':'application/json','buffer':content.encode()})
        expect(page.locator('#publishing-profile-preview')).to_be_visible()
        assert page.locator('#publishing-destination').input_value()=='word' and page.locator('#reviewed').is_checked()
        page.click('#cancel-publishing-profile')
        assert page.locator('#publishing-destination').input_value()=='word' and page.locator('#reviewed').is_checked()
        page.locator('#load-publishing-profile').set_input_files({'name':'profile.json','mimeType':'application/json','buffer':content.encode()})
        page.click('#apply-publishing-profile')
        assert page.locator('#body').input_value()=='## Keep this article\n\nA fictional paragraph to preserve.'
        assert page.locator('#publishing-destination').input_value()=='html' and not page.locator('#reviewed').is_checked()
        assert not first.is_checked()
        first.check();page.check('#reviewed')
        page.locator('#publishing-profile-panel > summary').click()
        assert first.is_checked() and page.locator('#reviewed').is_checked()
        page.fill('#body','A revised fictional paragraph.')
        assert not first.is_checked() and not page.locator('#reviewed').is_checked()
        page.locator('#publishing-profile-panel > summary').click()
        for width in [1440,850,390,320]:
            page.set_viewport_size({'width':width,'height':900})
            assert not page.evaluate('document.documentElement.scrollWidth > innerWidth'),f'Profile overflows at {width}'
        assert state['calls']==0
        context.close()
    report['checks'].append('Profiles: four workspaces, real local file round trip, strict download fields, preview/cancel preservation, apply, reminder invalidation, view-only toggles, desktop/narrow overflow, and no API requests')
    page,context,state=open_page('/markdown-to-word/',blocked_modules=('/publishing-profile-controls.js',))
    page.fill('#body','Core writing still works.')
    page.check('#reviewed')
    expect(page.locator('#download-word')).to_be_enabled()
    expect(page.locator('#publishing-profile-status')).to_contain_text('could not load')
    context.close()
    # All shared routes retain writing while switching between both layouts.
    for route_name in ['write','markdown-to-wordpress','word-to-wordpress','word-to-markdown','google-docs-to-wordpress','html-to-markdown','markdown-to-html','markdown-to-word']:
        page,context,state=open_page('/'+route_name+'/')
        assert page.locator('#workspace-layout-options').get_attribute('open') is None
        assert page.locator('#text-format-tools').get_attribute('open') is None
        page.locator('#title').focus(); page.locator('#body').focus()
        expect(page.locator('#title-error')).not_to_be_visible()
        assert page.locator('#title').get_attribute('aria-invalid') is None
        open_details(page,'#preview-panel')
        expect(page.locator('#preview-empty')).to_be_visible()
        if route_name!='write':assert page.locator('#additional-exports').get_attribute('open') is None
        body='## A fictional article\n\n'+'\n\n'.join(f'Paragraph {i}: keep a distinct fictional observation and inspect the result.' for i in range(100))+'\n\nKEEP THE ENDING'
        page.fill('#body',body)
        expect(page.locator('#preview-empty')).not_to_be_visible()
        region=page.locator('#article-preview')
        assert page.locator('#workspace-layout-choice').input_value()=='stacked'
        assert region.evaluate('(el)=>getComputedStyle(el).maxHeight')=='none'
        assert 'KEEP THE ENDING' in region.inner_text()
        page.check('#reviewed')
        open_details(page,'#workspace-layout-options')
        for view in ['stacked','compare']:
            page.select_option('#workspace-layout-choice',view)
            for width in [1440,850,390,320]:
                page.set_viewport_size({'width':width,'height':900})
                rects=page.evaluate("""() => {const a=document.getElementById('draft').getBoundingClientRect(),b=document.getElementById('conversion-results').getBoundingClientRect();return {a:{x:a.x,y:a.y,bottom:a.bottom},b:{x:b.x,y:b.y},overflow:document.documentElement.scrollWidth>innerWidth,maxHeight:getComputedStyle(document.getElementById('article-preview')).maxHeight}}""")
                report['layout'][route_name+'-'+view+'-'+str(width)]=rects['overflow']
                assert not rects['overflow']
                if view=='compare' and width>850:
                    assert rects['a']['x']<rects['b']['x'] and abs(rects['a']['y']-rects['b']['y'])<2
                    region.focus();region.press('End')
                    expect(region).not_to_have_js_property('scrollTop',0)
                else:assert rects['a']['bottom']<=rects['b']['y'] and rects['maxHeight']=='none'
                assert page.locator('#reviewed').is_checked() and page.locator('#body').input_value()==body
        open_extra_exports(page)
        assert page.locator('#reviewed').is_checked() and page.locator('#body').input_value()==body
        page.locator('#additional-exports > summary').click()
        assert page.locator('#reviewed').is_checked() and page.locator('#body').input_value()==body
        page.select_option('#publishing-destination','other')
        assert page.locator('#additional-exports').get_attribute('open') is not None and not page.locator('#reviewed').is_checked()
        assert state['api']==[];context.close()
    report['checks'].append('Eight workspace routes: full-width page-flow default, optional keyboard-scrollable comparison, both layouts at 1440/850/390/320, exact writing and approval preservation, and extra-export navigation')
    # First-time publishing needs only an article body and explicit review.
    page,context,state=open_page('/markdown-to-wordpress/')
    body='A fictional first post.\n\n## One next step\n\n- Keep this editable'
    page.fill('#body',body)
    page.click('#review-current-article')
    expect(page.locator('#article-preview')).to_contain_text('One next step')
    page.click('#continue-to-export')
    assert page.locator('#publishing-destination').evaluate('el=>el===document.activeElement')
    assert page.locator('#copy-wordpress').is_disabled()
    assert page.locator('#title-error').is_hidden()
    assert page.locator('#excerpt').input_value()=='' and page.locator('#slug').input_value()==''
    page.check('#reviewed')
    with page.expect_download() as info:page.click('#download-wordpress')
    content=Path(info.value.path()).read_text()
    assert '<!-- wp:paragraph -->' in content and '<!-- wp:heading' in content
    assert '<h1' not in content and 'Keep this editable' in content
    open_details(page,'#workspace-layout-options')
    page.select_option('#workspace-layout-choice','compare')
    open_details(page,'#text-format-tools')
    assert page.locator('#reviewed').is_checked() and page.locator('#body').input_value()==body
    page.select_option('#publishing-destination','other')
    assert not page.locator('#reviewed').is_checked()
    page.locator('#title').focus();page.locator('#body').focus()
    expect(page.locator('#title-error')).to_be_visible()
    assert state['api']==[];context.close()
    report['checks'].append('First conversion: collapsed optional tools, no false optional-title error, body-only native block download through review and export navigation, view-only approval preservation, and page-metadata validation when required')
    # Native Word download is review-gated and keeps destination defaults across restore.
    page,context,state=open_page('/markdown-to-word/')
    expect(page.locator('#desk-status')).to_contain_text('Markdown to Word tool ready')
    assert page.locator('#publishing-destination').input_value()=='word'
    expect(page.locator('h1')).to_have_text('Markdown to Word converter')
    assert page.locator('#word-handoff').is_visible() and page.locator('#download-word').is_disabled()
    word_body='## A fictional section\n\nKeep **important** and *quiet* writing.\nNext line.\n\n4. Parent\n  7. Child\n5. Next\n\n| Step | Keep |\n| --- | --- |\n| One | Uncertainty |\n\n<script>Literal source</script>'
    page.fill('#body',word_body); page.locator('#title').focus(); page.locator('#body').focus()
    assert not page.locator('#title-error').is_visible()
    open_more(page); page.click('#start-notes'); page.fill('#notes','Fictional source excluded from the Word article.')
    page.check('#reviewed')
    with page.expect_download() as info: page.click('#download-word')
    word_import_bytes=Path(info.value.path()).read_bytes()
    with zipfile.ZipFile(info.value.path()) as z:
        assert z.testzip() is None and len(z.namelist())==6
        document=ET.fromstring(z.read('word/document.xml')); ns={'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
        assert len(document.findall('.//w:tblHeader',ns))==1
        assert len(document.findall('.//w:ilvl',ns))==3
        assert 'Fictional source excluded' not in z.read('word/document.xml').decode()
        assert '<script>Literal source</script>' in ''.join(document.itertext())
    page.check('#word-include-title'); assert not page.locator('#reviewed').is_checked() and page.locator('#download-word').is_disabled()
    page.fill('#title','A fictional Word article'); page.check('#reviewed')
    page.select_option('#publishing-destination','html'); assert page.locator('#word-handoff').is_hidden() and not page.locator('#reviewed').is_checked()
    page.select_option('#publishing-destination','word'); page.check('#reviewed')
    page.locator('.recovery-box:has(#backup-controls) > summary').click(); page.check('#backup-private-ok')
    with page.expect_download() as info: page.click('#save-backup')
    word_backup=Path(info.value.path()).read_bytes(); assert b'word-include-title' not in word_backup
    page.fill('#body','Changed article.'); restore(page,word_backup)
    assert page.locator('#body').input_value()==word_body and page.locator('#publishing-destination').input_value()=='word'
    assert not page.locator('#reviewed').is_checked() and not page.locator('#word-include-title').is_checked()
    layout(page,'word-tool'); assert state['api']==[]; context.close()
    report['checks'].append('Word: actual DOCX download and XML/header/list reading, body-only readiness, source exclusion, title approval reset, destination switching, exact backup restore, and layout')
    # The file-first acquisition route uses the same real DOCX import and handoff.
    page,context,state=open_page('/word-to-wordpress/')
    expect(page.locator('h1')).to_have_text('Word to WordPress converter')
    assert page.locator('#import-panel').get_attribute('open') is not None
    assert page.locator('#word-import-alternatives').get_attribute('open') is None
    assert page.locator('#publishing-destination').input_value()=='wordpress'
    page.fill('#title','Keep the current title'); page.fill('#body','Keep the current article.')
    open_more(page); page.click('#start-notes'); page.fill('#notes','Keep fictional source notes.')
    page.check('#reviewed')
    with page.expect_file_chooser() as choice: page.click('#start-word-file')
    choice.value.set_files({'name':'fictional-article.docx','mimeType':'application/vnd.openxmlformats-officedocument.wordprocessingml.document','buffer':word_import_bytes})
    expect(page.locator('#import-summary')).to_contain_text('Word document')
    expect(page.locator('#import-preview-heading')).to_be_focused()
    expect(page.locator('#import-reading-preview').get_by_role('heading',name='A fictional section',exact=True)).to_be_visible()
    expect(page.locator('#import-reading-preview ol[start="4"] ol[start="7"]')).to_have_count(1)
    expect(page.locator('#import-reading-preview th')).to_have_count(2)
    expect(page.locator('#import-reading-preview img, #import-reading-preview script')).to_have_count(0)
    assert page.locator('#reviewed').is_checked() and page.locator('#apply-import').is_disabled()
    page.check('#import-changes-ok'); state['accept']=False; page.click('#apply-import')
    expect(page.locator('#body')).to_have_value('Keep the current article.')
    assert page.locator('#reviewed').is_checked()
    state['accept']=True; page.click('#apply-import')
    expect(page.locator('#desk-status')).to_contain_text('imported locally')
    assert 'Parent' in page.locator('#body').input_value() and page.locator('#notes').input_value()=='Keep fictional source notes.'
    assert not page.locator('#reviewed').is_checked() and page.locator('#import-file-status').inner_text()==''
    assert page.locator('#import-reading-preview').inner_html()==''
    assert page.locator('#import-panel').get_attribute('open') is None
    expect(page.locator('#body')).to_be_focused()
    imported_body=page.locator('#body').input_value()
    with zipfile.ZipFile(io.BytesIO(word_import_bytes)) as z: word_parts={n:z.read(n) for n in z.namelist()}
    rejected=io.BytesIO()
    with zipfile.ZipFile(rejected,'w',compression=zipfile.ZIP_DEFLATED) as z:
        for name,content in word_parts.items():
            if name=='word/document.xml': content=content.replace(b'<w:body>',b'<w:body><w:ins><w:p><w:r><w:t>Unresolved change</w:t></w:r></w:p></w:ins>')
            z.writestr(name,content)
    with page.expect_file_chooser() as choice: page.click('#start-word-file')
    choice.value.set_files({'name':'unresolved.docx','mimeType':'application/vnd.openxmlformats-officedocument.wordprocessingml.document','buffer':rejected.getvalue()})
    expect(page.locator('#desk-status')).to_contain_text('tracked changes')
    expect(page.locator('#cancel-import')).to_be_visible(); page.click('#cancel-import')
    assert page.locator('#import-file-status').inner_text()=='' and page.locator('#body').input_value()==imported_body
    if not page.locator('#start-formatted-import').is_visible(): page.click('#desk-more > summary')
    page.click('#start-formatted-import'); assert page.locator('#word-import-alternatives').get_attribute('open') is not None
    expect(page.locator('#import-text')).to_be_focused()
    layout(page,'word-to-wordpress'); assert state['api']==[]; context.close()
    report['checks'].append('Word import: actual exported DOCX bytes, native XML parsing, nested numbering, table headers, inert literal markup, staged acknowledgement, cancelled replacement preservation, apply/source retention/approval reset, preview purge, and layout')
    # A distinct HTML tool provides reviewed source and keeps its destination after restore.
    page,context,state=open_page('/markdown-to-html/#sample')
    expect(page.locator('#desk-status')).to_contain_text('Fictional sample loaded')
    assert page.locator('#publishing-destination').input_value()=='html'
    expect(page.locator('h1')).to_have_text('Markdown to HTML converter')
    assert page.locator('#html-source-handoff').is_visible() and page.locator('#wordpress-handoff').is_hidden()
    assert page.locator('#copy-html-source').is_disabled() and page.locator('#html-source-preview').input_value()==''
    assert page.locator('#html-source-code-panel').get_attribute('open') is None
    page.locator('#html-source-code-panel > summary').click()
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
    page.locator('.recovery-box:has(#backup-controls) > summary').click(); page.check('#backup-private-ok')
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
    open_extra_exports(page)
    with page.expect_download() as info: page.click('#download-html')
    assert 'KEEP THE ENTIRE ENDING' in Path(info.value.path()).read_text()
    page.locator('.recovery-box:has(#backup-controls) > summary').click(); page.check('#backup-private-ok')
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
    expect(page.locator('.tool-guide .conversion-example code')).to_have_count(2)
    body='A fictional conversion test.\n\n## Inspect this\n\nTODO: inspect this detail.'
    page.fill('#body',body)
    expect(page.locator('#article-preview')).to_contain_text('Inspect this')
    expect(page.locator('#wordpress-findings li')).to_have_count(1)
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
    expect(page.locator('#wordpress-findings li')).to_have_count(0)
    layout(page,'wordpress-tool'); assert state['api']==[]; context.close()
    report['checks'].append('Acquisition tool: working sample, live preview, current findings, approval-gated exact-body ZIP, edit resets, and narrow layouts')
    page,context,state=open_page('/markdown-to-wordpress/#sample')
    expect(page.locator('#article-preview table')).to_be_visible()
    expect(page.locator('#article-preview th[scope=col]')).to_have_count(2)
    expect(page.locator('#article-preview tbody tr')).to_have_count(3)
    table='| Name | Count |\n| :--- | ---: |\n| **Alpha** | 2 |\n| Beta \\| Gamma | 3 |'
    page.fill('#body',table)
    expect(page.locator('#wordpress-findings li')).to_have_count(0)
    page.check('#reviewed'); open_details(page,'#wordpress-code-panel')
    expect(page.locator('#wordpress-code-preview')).not_to_have_value('')
    assert '<!-- wp:table' in page.locator('#wordpress-code-preview').input_value()
    assert 'data-align="right"' in page.locator('#wordpress-code-preview').input_value()
    open_extra_exports(page)
    with page.expect_download() as info: page.click('#download-html')
    reading=Path(info.value.path()).read_text()
    assert '<thead>' in reading and 'Beta | Gamma' in reading
    bad=table+'\n| EXTRA | CELL | KEEP |'
    page.fill('#body',bad)
    expect(page.locator('#article-preview table')).to_have_count(0)
    expect(page.locator('#article-preview')).to_contain_text('KEEP')
    expect(page.locator('#wordpress-findings')).to_contain_text('same column count')
    assert not page.locator('#reviewed').is_checked()
    assert page.locator('#wordpress-code-preview').input_value()==''
    page.fill('#body',table)
    layout(page,'markdown-table'); assert state['api']==[]; context.close()
    report['checks'].append('Tables: live headers/alignment, escaped pipes, native blocks, reading file, malformed-source preservation, approval reset, and narrow layouts')
    page,context,state=open_page('/markdown-to-wordpress/#sample')
    expect(page.locator('#article-preview ol[start="4"]')).to_be_visible()
    expect(page.locator('#article-preview ol[start="7"]')).to_have_count(1)
    assert page.locator('#article-preview li > ul').count()>=2
    lists='4. Inspect the article\n  - Compare facts\n    + Keep uncertainty\n  - Check links\n5. Prepare the handoff\n  7) Paste the blocks\n  8) Preview the post'
    page.fill('#body',lists)
    expect(page.locator('#article-preview li')).to_have_count(7)
    expect(page.locator('#wordpress-findings li')).to_have_count(0)
    page.check('#reviewed'); open_details(page,'#wordpress-code-panel')
    expect(page.locator('#wordpress-code-preview')).not_to_have_value('')
    code=page.locator('#wordpress-code-preview').input_value()
    assert '"start":4' in code and '"start":7' in code
    assert code.count('<!-- wp:list-item -->')==7
    open_extra_exports(page)
    with page.expect_download() as info: page.click('#download-html')
    reading=Path(info.value.path()).read_text()
    assert '<ol start="4">' in reading and '<ol start="7">' in reading
    bad='4. Keep the parent\n   - Irregular child\n5. KEEP THE LAST ITEM'
    page.fill('#body',bad)
    expect(page.locator('#article-preview li')).to_have_count(0)
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
    open_details(page,'#wordpress-code-panel')
    expect(page.locator('#wordpress-code-preview')).not_to_have_value('')
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
    # The fragment sample loads after async desk initialization. Wait before
    # replacing it; faster controllers must not make this fixture race startup.
    expect(page.locator('#desk-status')).to_contain_text('Fictional sample loaded')
    page.fill('#body','A fictional opening.\n\n  - Nested list\n\n![image](https://example.test/image.png)\n\nTODO: inspect.')
    expect(page.locator('#wordpress-review-status')).to_contain_text('item(s) to inspect')
    expect(page.locator('#wordpress-findings li')).to_have_count(3)
    page.locator('#wordpress-findings button').first.click()
    assert page.locator('#body').evaluate('(el) => el.value.slice(el.selectionStart, el.selectionEnd)')=='  - Nested list'
    page.click('#wordpress-kit-panel > summary')
    expect(page.locator('#wordpress-kit-files li')).to_have_count(6)
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
    open_extra_exports(page)
    with page.expect_download() as info: page.click('#download-body')
    assert Path(info.value.path()).read_text()=='Body without page metadata.\n'
    page.fill('#title','A fictional reading page')
    page.check('#reviewed')
    open_extra_exports(page)
    with page.expect_download() as info: page.click('#download-html')
    reading_text=Path(info.value.path()).read_text()
    assert '<h1>A fictional reading page</h1>' in reading_text
    assert '<script' not in reading_text and 'default-src' in reading_text
    reader=context.new_page()
    reader.set_content(reading_text)
    expect(reader.locator('h1')).to_have_count(1)
    expect(reader.locator('script, img, a')).to_have_count(0)
    layout(reader,'reading-page')
    reader.close()
    page.locator('#page-details > summary').click()
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
    page.locator('.recovery-box:has(#backup-controls) > summary').click()
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
    stage_backup(page,b'{broken'); expect(page.locator('#desk-status')).to_contain_text('not valid workspace JSON')
    expect(page.locator('#restore-preview')).to_be_hidden()
    assert page.locator('#body').input_value()==previous
    stage_backup(page,b'x'*(512*1024+1)); expect(page.locator('#desk-status')).to_contain_text('512 KiB')
    expect(page.locator('#restore-preview')).to_be_hidden()
    assert page.locator('#body').input_value()==previous
    state['accept']=False; restore(page,backup); expect(page.locator('#restore-status')).to_contain_text('cancelled')
    assert page.locator('#body').input_value()==previous
    state['accept']=True; restore(page,backup); expect(page.locator('#desk-status')).to_contain_text('restored locally')
    expect(page.locator('#questions li')).to_have_count(1)
    page.locator('#preview-panel > summary').click()
    page.fill('#body','<img src="https://example.com/x" onerror="window.pwned=true">\n\n<script>window.pwned=true</script>\n\n[click](javascript:bad())')
    expect(page.locator('#article-preview img, #article-preview script, #article-preview a')).to_have_count(0)
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
    page.locator('.recovery-box:has(#backup-controls) > summary').click(); page.check('#backup-private-ok')
    with page.expect_download() as info: page.click('#save-backup')
    review_backup=Path(info.value.path()).read_bytes()
    assert json.loads(review_backup)['draft']['questions']==['Resolved: keep the uncertain outcome explicit.','Check the destination title once more.']
    page.click('#clear'); restore(page,review_backup)
    expect(page.locator('#review-question-1')).to_have_value('Check the destination title once more.')
    assert not page.locator('#reviewed').is_checked()
    open_more(page); page.click('#toggle-focus'); assert page.locator('.source-editor').is_hidden()
    page.fill('#body','One two three')
    page.locator('#body').evaluate('(el)=>el.setSelectionRange(4,7)')
    open_details(page,'#text-format-tools')
    page.click('[data-format=bold]'); expect(page.locator('#body')).to_have_value('One **two** three')
    open_details(page,'#text-format-tools')
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
    expect(page.locator('#article-preview script, #questions img')).to_have_count(0)
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
    expect(page.locator('#import-reading-preview ol[start="4"] ol[start="7"]')).to_have_count(1)
    expect(page.locator('#import-reading-preview th[scope="col"]')).to_have_count(2)
    expect(page.locator('#import-reading-preview script, #import-reading-preview img, #import-reading-preview iframe')).to_have_count(0)
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
    open_extra_exports(page)
    page.check('#copy-title'); page.check('#reviewed'); page.click('#copy-formatted')
    expect(page.locator('#desk-status')).to_contain_text('copied')
    page.click('#start-formatted-import'); page.locator('#import-text').press('Control+V')
    page.click('#preview-import'); expect(page.locator('#import-summary')).to_contain_text('Copied formatted writing')
    expect(page.locator('#import-reading-preview table')).to_have_count(1)
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
    expect(page.locator('#draft-findings li')).to_have_count(4)
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
    expect(page.locator('#article-preview img, #article-preview script')).to_have_count(0)
    # Leaving the editor must not replace a link before its click is dispatched.
    page.locator('#body').focus()
    page.evaluate("document.querySelector('#article-preview a').addEventListener('click',event=>{event.preventDefault();window.previewLinkClicked=true})")
    links.click()
    assert page.evaluate('window.previewLinkClicked') is True
    page.check('#reviewed')
    open_extra_exports(page)
    with page.expect_download() as info: page.click('#download-html')
    html=Path(info.value.path()).read_text()
    assert 'PRIVATE SOURCE CHECK SENTINEL' not in html and '<a href="https://example.test/a_(b)"' in html
    reader=context.new_page(); reader.set_content(html)
    expect(reader.locator('a')).to_have_count(1)
    expect(reader.locator('script,img')).to_have_count(0)
    expect(reader.locator('h1')).to_have_count(1)
    expect(reader.locator('h2')).to_have_count(2)
    layout(reader,'reading-links'); reader.close()
    page.locator('.recovery-box:has(#backup-controls) > summary').click(); page.check('#backup-private-ok')
    with page.expect_download() as info: page.click('#save-backup')
    kept=json.loads(Path(info.value.path()).read_bytes())
    assert kept['version']==1 and set(kept)=={'format','version','source','draft'}
    assert 'findings' not in kept['draft']
    page.fill('#body','A clear fictional paragraph.'); page.click('#run-checks')
    expect(page.locator('#draft-check-status')).to_contain_text('No patterns were flagged')
    page.fill('#body','TODO\n\n'*45); page.click('#run-checks')
    expect(page.locator('#draft-findings li')).to_have_count(40)
    expect(page.locator('#draft-check-status')).to_contain_text('Showing the first 40')
    page.fill('#body','<script>bad()</script>\n\n## <img src=x onerror=bad()>\nTODO')
    page.click('#run-checks')
    expect(page.locator('#draft-check-panel script, #draft-check-panel img')).to_have_count(0)
    # Section moves carry descendants, retain checkpoints, invalidate checks,
    # and keep keyboard focus in the outline. These are actual UI assertions.
    sections='Opening.\n\n## First\nTODO\n\n### Detail\nNested.\n\n## Second\nDone.'
    moved='Opening.\n\n## Second\nDone.\n\n## First\nTODO\n\n### Detail\nNested.'
    page.fill('#body',sections); page.click('#run-checks'); page.check('#reviewed')
    page.get_by_role('button',name='Move First down',exact=True).click()
    assert page.locator('#body').input_value()==moved
    assert not page.locator('#reviewed').is_checked()
    expect(page.locator('#draft-findings li')).to_have_count(0)
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
    expect(page.locator('#article-outline li')).to_have_count(0)
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
    open_extra_exports(page)
    page.click('#copy-formatted'); expect(page.locator('#desk-status')).to_contain_text('without its title')
    copied=page.evaluate('window.formattedFixture')
    assert set(copied)=={'text/html','text/plain'} and '<h1>' not in copied['text/html']
    assert '<strong>A fictional change</strong>' in copied['text/html'] and '<script>' not in copied['text/html']
    assert 'Planning resource (https://example.test/)' in copied['text/plain']
    reader=context.new_page(); reader.set_content(copied['text/html'])
    expect(reader.locator('script,img')).to_have_count(0)
    expect(reader.locator('a')).to_have_count(1)
    reader.close()
    open_extra_exports(page)
    page.fill('#title','Fictional handoff'); page.check('#copy-title')
    assert not page.locator('#reviewed').is_checked() and page.locator('#copy-formatted').is_disabled()
    open_extra_exports(page)
    page.check('#reviewed'); page.click('#copy-formatted')
    expect(page.locator('#desk-status')).to_contain_text('with its title')
    assert '<h1>Fictional handoff</h1>' in page.evaluate("window.formattedFixture['text/html']")
    page.evaluate("Object.defineProperty(navigator,'clipboard',{configurable:true,value:{write:async()=>{throw new DOMException('Blocked','NotAllowedError')},writeText:async text=>{window.bodyCopyFixture=text}}})")
    open_extra_exports(page)
    page.click('#copy-formatted'); expect(page.locator('#desk-status')).to_contain_text('Formatted copy unavailable')
    expect(page.locator('#body')).to_have_value(body)
    page.click('#copy-body'); assert page.evaluate('window.bodyCopyFixture')==body
    page.evaluate('window.savedClipboardItem=window.ClipboardItem; window.ClipboardItem=undefined')
    open_extra_exports(page)
    page.click('#copy-formatted'); expect(page.locator('#desk-status')).to_contain_text('Formatted copy unavailable')
    page.evaluate('() => { window.ClipboardItem=window.savedClipboardItem; }')
    open_more(page); page.click('#start-notes'); page.fill('#notes','PRIVATE SOURCE KIT SENTINEL')
    open_details(page,'#review-panel'); page.click('#add-question')
    page.fill('#review-question-0','PRIVATE QUESTION KIT SENTINEL')
    open_extra_exports(page)
    page.locator('#publishing-kit-panel > summary').click()
    expect(page.locator('#kit-files li')).to_have_count(4)
    expect(page.locator('#kit-readiness')).to_contain_text('page.md is omitted')
    page.check('#reviewed')
    open_extra_exports(page)
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
    open_extra_exports(page)
    with page.expect_download() as info: page.click('#download-kit')
    with zipfile.ZipFile(info.value.path()) as z:
        assert z.testzip() is None and '# Fictional handoff' in z.read('page.md').decode('utf-8')
    page.fill('#body','An updated fictional handoff.')
    assert not page.locator('#reviewed').is_checked() and page.locator('#download-kit').is_disabled()
    page.check('#reviewed')
    open_extra_exports(page)
    with page.expect_download() as info: page.click('#download-kit')
    with zipfile.ZipFile(info.value.path()) as z: assert z.read('article-body.md').decode('utf-8')=='An updated fictional handoff.\n'
    open_more(page); page.click('#start-checks')
    expect(page.locator('#draft-check-stats')).to_contain_text('4 approximate words')
    expect(page.locator('#body-count')).to_contain_text('4 approximate words')
    page.locator('.recovery-box:has(#backup-controls) > summary').click(); page.check('#backup-private-ok')
    with page.expect_download() as info: page.click('#save-backup')
    saved=json.loads(Path(info.value.path()).read_bytes())
    assert saved['version']==1 and set(saved['draft'])=={'title','excerpt','description','slug','body','questions'}
    page.fill('#body','Temporary fictional edit before file restore.')
    restore(page,saved); expect(page.locator('#copy-title')).not_to_be_checked()
    open_details(page,'#publishing-kit-panel')
    layout(page,'publishing-handoff')
    assert state['api']==[]; context.close()
    report['checks'].append('Publishing handoff: native ClipboardItem HTML/plain representations with title choices and blocked/unsupported fallback, actual partial/complete ZIP bytes and independent CRC validation, source/review exclusion, latest edits, consistent counts, unchanged backups, restored preferences, and no upload/API calls')
    # Revision recovery uses actual controls, comparisons and download bytes.
    page,context,state=open_page('/write/')
    expect(page.locator('#desk-status')).to_contain_text('ready')
    open_details(page,'#checkpoint-panel')
    page.click('#save-checkpoint'); expect(page.locator('#desk-status')).to_contain_text('Add writing')
    page.fill('#title','Fictional first version'); page.fill('#body','Original article text.')
    open_more(page); page.click('#start-notes'); page.fill('#notes','Fictional private revision source.')
    open_details(page,'#review-panel'); page.click('#add-question'); page.fill('#review-question-0','Fictional private review question?')
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
    open_extra_exports(page)
    state['accept']=True; page.check('#reviewed'); page.check('#copy-title'); page.check('#reviewed')
    page.click('#restore-checkpoint')
    expect(page.locator('#body')).to_have_value('Original article text.')
    assert not page.locator('#reviewed').is_checked() and not page.locator('#copy-title').is_checked()
    assert not page.locator('#checkpoint-private-ok').is_checked()
    page.click('#restore-checkpoint'); expect(page.locator('#body')).to_have_value('Replacement article text.')
    open_details(page,'#text-format-tools')
    page.click('[data-format=bold]')
    formatted=page.locator('#body').input_value(); assert '**' in formatted
    page.click('#restore-checkpoint'); expect(page.locator('#body')).to_have_value('Replacement article text.')
    page.click('#start-import'); page.fill('#import-text','## Fictional import\n\nImported article text.')
    page.click('#preview-import'); page.click('#apply-import')
    assert 'Imported article text.' in page.locator('#body').input_value()
    page.click('#restore-checkpoint'); expect(page.locator('#body')).to_have_value('Replacement article text.')
    page.locator('.recovery-box:has(#backup-controls) > summary').click(); restore(page,backup)
    expect(page.locator('#desk-status')).to_contain_text('restored locally')
    page.click('#restore-checkpoint'); expect(page.locator('#body')).to_have_value('Replacement article text.')
    open_more(page); page.click('#start-notes'); page.select_option('#template-select','progress'); page.click('#load-outline')
    assert page.locator('#notes').input_value()!='Fictional private revision source.'
    page.click('#restore-checkpoint'); expect(page.locator('#notes')).to_have_value('Fictional private revision source.')
    if not page.locator('#review-panel').evaluate('el=>el.open'): page.locator('#review-panel > summary').click()
    page.get_by_role('button',name='Remove note 1',exact=True).click()
    expect(page.locator('#questions li')).to_have_count(0)
    page.click('#restore-checkpoint'); assert page.locator('#questions li').count()==1
    for i in range(7):
        page.fill('#body','Fictional bounded version '+str(i)); page.click('#save-checkpoint')
    expect(page.locator('#checkpoint-select option')).to_have_count(5)
    page.select_option('#checkpoint-field','body'); layout(page,'revisions-expanded')
    # 500 changed lines exceed the 160,000-cell diff budget. Model tests also
    # retain the 4,000-line case; browser capacity is a separate performance gate.
    page.fill('#body','a\n'*500); page.click('#save-checkpoint'); page.fill('#body','b\n'*500)
    expect(page.locator('#article-diff-status')).to_contain_text('Large changed region grouped')
    assert page.locator('#article-diff-groups .article-diff-preview').all_text_contents()==['a\n'*8,'b\n'*8]
    expect(page.locator('.article-diff-complete[open]')).to_have_count(0)
    layout(page,'revision-diff-large')
    page.check('#reviewed'); page.locator('.article-diff-complete > summary').first.click()
    assert page.locator('.article-diff-complete').first.locator('pre').inner_text()=='a\n'*500
    assert page.locator('#reviewed').is_checked()
    page.locator('.article-diff-complete > summary').first.click()
    state['accept']=False; page.click('#clear'); assert page.locator('#checkpoint-select option').count()==5
    state['accept']=True; page.click('#clear')
    expect(page.locator('#checkpoint-count')).to_contain_text('0 / 5')
    assert page.locator('#checkpoint-comparison').is_hidden() and page.locator('#body').input_value()==''
    assert page.locator('#checkpoint-saved').input_value()=='' and page.locator('#checkpoint-current').input_value()==''
    expect(page.locator('#article-diff-groups li')).to_have_count(0)
    expect(page.locator('.article-diff-complete')).to_have_count(0)
    assert page.locator('#import-body-preview').input_value()==''
    open_details(page,'#preview-panel')
    expect(page.locator('#preview-empty')).to_be_visible()
    expect(page.locator('#article-preview')).to_be_hidden()
    assert state['api']==[]
    report['checks'].append('Revisions: empty/save/compare/private download, cancellation, restore/redo, approval/preferences reset, automatic snapshots around formatting/import/file restore/outline/review-note removal, count bounds, clear purge, expanded narrow layouts, and no API calls')
    context.close()
    # Failure of the optional comparison module must not block writing/recovery.
    page,context,state=open_page('/write/',blocked_modules=('/revision-diff-controls.js',))
    expect(page.locator('#desk-status')).to_contain_text('ready')
    page.fill('#body','Fictional original.'); open_details(page,'#checkpoint-panel'); page.click('#save-checkpoint')
    page.fill('#body','Fictional current.'); page.locator('#article-diff-panel > summary').click()
    expect(page.locator('#article-diff-status')).to_contain_text('could not load')
    assert page.locator('#checkpoint-saved').input_value()=='Fictional original.'
    assert page.locator('#checkpoint-current').input_value()=='Fictional current.'
    page.click('#restore-checkpoint'); expect(page.locator('#body')).to_have_value('Fictional original.')
    assert state['blocked']==['/revision-diff-controls.js'] and state['api']==[]
    context.close()
    page,context,state=open_page('/write/')
    expect(page.locator('#desk-status')).to_contain_text('ready')
    page.locator('.recovery-box:has(#backup-controls) > summary').click(); restore(page,backup)
    expect(page.locator('#desk-status')).to_contain_text('restored locally')
    original_search_body='foo and FOO and foo $& []'
    page.fill('#body',original_search_body); page.check('#reviewed')
    open_details(page,'#text-format-tools')
    page.click('#start-find'); page.fill('#find-text','foo')
    expect(page.locator('#find-status')).to_contain_text('3 eligible match')
    assert page.locator('#reviewed').is_checked() and page.locator('#replace-match').is_disabled()
    page.press('#find-text','Enter')
    assert page.locator('#body').evaluate('el=>[el.selectionStart,el.selectionEnd]')==[0,3]
    page.click('#find-next'); assert page.locator('#body').evaluate('el=>el.selectionStart')==8
    page.click('#find-previous'); assert page.locator('#body').evaluate('el=>el.selectionStart')==0
    page.fill('#replace-text','$&'); page.click('#replace-match')
    expect(page.locator('#body')).to_have_value('$& and FOO and foo $& []')
    assert not page.locator('#reviewed').is_checked()
    open_details(page,'#checkpoint-panel'); page.click('#restore-checkpoint')
    expect(page.locator('#body')).to_have_value(original_search_body)
    assert page.locator('#find-text').input_value()=='' and page.locator('#replace-text').input_value()==''
    page.fill('#find-text','foo'); page.fill('#replace-text','<script>fictional()</script>'); page.check('#reviewed')
    page.click('#preview-replace-all')
    expect(page.locator('#replace-summary')).to_contain_text('change 3 of 3')
    expect(page.locator('#replace-examples li')).to_have_count(3)
    expect(page.locator('#replace-examples').locator('script,img,a')).to_have_count(0)
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
    expect(page.locator('#notes')).to_have_value(source['notes'])
    expect(page.locator('#questions li')).to_have_count(1)
    assert not page.locator('#reviewed').is_checked() and page.locator('#replace-examples li').count()==0
    page.check('#reviewed')
    open_extra_exports(page)
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
    expect(page.locator('#replace-preview')).to_be_hidden()
    expect(page.locator('#replace-examples li')).to_have_count(0)
    assert state['api']==[]
    report['checks'].append('Article search: exact literal selection and keyboard navigation, approval-preserving preview, single/bulk checkpoint recovery, stale/cancelled/oversized protection, private source/review retention, inert examples, actual edited-body download, deletion, clear purge, expanded narrow layouts, and no API calls')
    context.close()
    page,context,state=open_page('/write/',blocked_modules=('/search-controls.js',))
    expect(page.locator('#desk-status')).to_contain_text('ready')
    expect(page.locator('#find-status')).to_contain_text('could not load')
    assert page.locator('#start-find').is_disabled()
    page.fill('#body','Fictional fallback article.'); page.check('#reviewed')
    assert page.locator('#download-body').is_enabled()
    open_extra_exports(page)
    with page.expect_download() as info: page.click('#download-body')
    assert Path(info.value.path()).read_text()=='Fictional fallback article.\n'
    open_details(page,'#text-format-tools')
    page.click('[data-format=bold]'); assert '**' in page.locator('#body').input_value()
    assert not page.locator('#reviewed').is_checked() and page.locator('#checkpoint-select option').count()==1
    assert state['blocked']==['/search-controls.js'] and state['api']==[]
    layout(page,'optional-search-unavailable')
    report['checks'].append('Optional search module rejection leaves the core desk ready, formatting and checkpoint recovery available, and actual body export functional')
    context.close()
    page,context,state=open_page('/word-to-wordpress/')
    page.fill('#body','Keep the earlier fictional article.');page.check('#reviewed')
    page.locator('#import-file').set_input_files(str(root/'tests/fixtures/documents/word-strikethrough.docx'))
    expect(page.locator('#import-reading-preview s')).to_have_text("Today's Special: Salmon")
    assert 'line-through' in page.locator('#import-reading-preview s').evaluate('el=>getComputedStyle(el).textDecorationLine')
    assert page.locator('#body').input_value()=='Keep the earlier fictional article.' and page.locator('#reviewed').is_checked()
    page.check('#import-changes-ok');page.click('#apply-import')
    strike_body=page.locator('#body').input_value()
    assert strike_body==r"~~Today\'s Special\: Salmon~~ Sold out"
    expect(page.locator('#article-preview s')).to_have_text("Today's Special: Salmon")
    page.check('#reviewed')
    with page.expect_download() as info:page.click('#download-wordpress')
    from document_benchmark import ArticleHTML
    blocks=ArticleHTML(Path(info.value.path()).read_text());assert blocks.strikes==["Today's Special: Salmon"]
    assert 'line-through' in page.locator('#article-preview s').evaluate('el=>getComputedStyle(el).textDecorationLine')
    page.select_option('#publishing-destination','html');page.check('#reviewed')
    with page.expect_download() as info:page.click('#download-html-source')
    assert ArticleHTML(Path(info.value.path()).read_text()).strikes==["Today's Special: Salmon"]
    page.select_option('#publishing-destination','word');page.check('#reviewed')
    with page.expect_download() as info:page.click('#download-word')
    with zipfile.ZipFile(info.value.path()) as z:
        assert z.testzip() is None
        doc=ET.fromstring(z.read('word/document.xml'));w='{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
        struck=[''.join(t.text or '' for t in r.iter(w+'t')) for r in doc.iter(w+'r') if r.find(w+'rPr/'+w+'strike') is not None]
        assert struck==["Today's Special: Salmon"]
    # Clipboard fixtures exercise actual paste handlers, without a live document app.
    open_more(page);page.click('#start-formatted-import')
    page.locator('#import-text').evaluate("el=>{const data=new DataTransfer();data.setData('text/plain','~~literal~~ and **literal**');el.dispatchEvent(new ClipboardEvent('paste',{bubbles:true,cancelable:true,clipboardData:data}));}")
    expect(page.locator('#import-reading-preview')).to_contain_text('~~literal~~ and **literal**')
    expect(page.locator('#import-reading-preview s, #import-reading-preview strong')).to_have_count(0)
    assert page.locator('#body').input_value()==strike_body and page.locator('#reviewed').is_checked()
    page.locator('#import-text').evaluate("el=>{const data=new DataTransfer();data.setData('text/html','<p><strong>New</strong> <span style=\"text-decoration-line:line-through\">old plan</span> and literal ~~words~~.</p>');el.dispatchEvent(new ClipboardEvent('paste',{bubbles:true,cancelable:true,clipboardData:data}));}")
    expect(page.locator('#import-reading-preview s')).to_have_text('old plan')
    expect(page.locator('#import-reading-preview')).to_contain_text('literal ~~words~~')
    assert page.locator('#body').input_value()==strike_body and page.locator('#reviewed').is_checked()
    layout(page,'strikethrough-import-export')
    page.click('#cancel-import');assert page.locator('#body').input_value()==strike_body and page.locator('#reviewed').is_checked()
    open_details(page,'#text-format-tools')
    page.locator('#body').evaluate('(el,end)=>el.setSelectionRange(0,end)',strike_body.index('~~',2)+2)
    page.click('[data-format=strike]')
    assert page.locator('#body').input_value()==strike_body.replace('~~','',2) and not page.locator('#reviewed').is_checked()
    expect(page.locator('#article-preview s')).to_have_count(0)
    page.select_option('#publishing-destination','wordpress');page.check('#reviewed')
    with page.expect_download() as info:page.click('#download-wordpress')
    assert ArticleHTML(Path(info.value.path()).read_text()).strikes==[]
    assert state['api']==[];context.close()
    report['checks'].append('Strikethrough: pinned real Word file with visible semantic preview, acknowledgement and source preservation, actual WordPress/HTML/Word downloads independently checked, plain clipboard tilde literals, CSS formatted paste, cancellation, guarded removal of imported escaped marks with a fresh actual block download, narrow layout and no API calls')
    page,context,state=open_page('/word-to-wordpress/')
    image_placeholder='\\[Image or object omitted from Word document\\]'
    image_original='Before '+image_placeholder+' after.'
    page.fill('#body',image_original);page.fill('#title','Fictional image edit');page.check('#reviewed')
    open_details(page,'#editing-tools');page.click('#start-image-editor');page.click('#image-use-placeholder')
    page.fill('#image-url','https://example.com/fictional_(1).jpg?a=1&b=2')
    page.fill('#image-alt','Fictional [workshop] participants')
    page.click('#image-preview')
    assert page.locator('#image-before').input_value()==image_placeholder
    assert page.locator('#image-after').input_value().startswith('\n\n![')
    assert page.locator('#body').input_value()==image_original and page.locator('#reviewed').is_checked()
    page.fill('#body',image_original+' Revised.')
    expect(page.locator('#image-apply')).to_be_disabled();assert page.locator('#image-after').input_value()==''
    page.click('#image-use-placeholder');page.click('#image-preview');page.click('#image-apply')
    assert page.locator('#body').input_value().startswith('Before \n\n![')
    assert page.locator('#body').input_value().endswith('\n\n after. Revised.')
    assert not page.locator('#reviewed').is_checked() and not page.locator('#wordpress-linked-images').is_checked()
    expect(page.locator('#article-preview img')).to_have_count(0)
    page.locator('#wordpress-image-panel > summary').click();page.check('#wordpress-linked-images');page.check('#reviewed')
    with page.expect_download() as info:page.click('#download-wordpress')
    blocks=Path(info.value.path()).read_text()
    assert blocks.count('<!-- wp:image -->')==1 and 'alt="Fictional [workshop] participants"' in blocks
    assert 'fictional_(1).jpg?a=1&amp;b=2' in blocks
    page.locator('#wordpress-image-list button').first.click();page.click('#image-preview');page.click('#image-apply')
    assert page.locator('#reviewed').is_checked() and page.locator('#wordpress-linked-images').is_checked()
    assert state['api']==[];layout(page,'guided-image-editor');context.close()
    report['checks'].append('Guided image editor: Word placeholder selection, exact replacement preview, stale-target rejection, checkpointed apply, explicit linked images, downloaded block source, no image DOM, and no-op approval preservation')
    # Recover an actual fictional DOCX package, then reconcile its downloaded map.
    page,context,state=open_page('/word-to-wordpress/')
    image_docx=subprocess.check_output(['node','--input-type=module','-e',"import {imageFixture} from './tests/word-image-fixtures.js';process.stdout.write(Buffer.from(imageFixture({ids:['one','one','one']}).bytes));"])
    with page.expect_file_chooser() as choice: page.click('#start-word-file')
    choice.value.set_files({'name':'fictional-images.docx','mimeType':'application/vnd.openxmlformats-officedocument.wordprocessingml.document','buffer':image_docx})
    expect(page.locator('#import-summary')).to_contain_text('Word document')
    expect(page.locator('#apply-import')).to_be_disabled()
    page.check('#word-image-choice-kit')
    page.click('#prepare-word-images');expect(page.locator('#word-image-kit-review')).to_be_visible()
    page.check('#word-image-private-ok')
    with page.expect_download() as info:page.click('#download-word-images')
    with zipfile.ZipFile(info.value.path()) as z:
        assert z.testzip() is None
        image_map=z.read('image-map.json')
        assert json.loads(image_map)['placements'][2]['filename']=='word-image-001.png'
        with zipfile.ZipFile(io.BytesIO(image_docx)) as original:
            assert z.read('word-image-001.png')==original.read('word/media/one.png')
    page.check('#import-changes-ok')
    expect(page.locator('#apply-import')).to_be_disabled()
    expect(page.locator('#word-image-saved-ok')).to_be_visible()
    expect(page.locator('#word-image-saved-ok')).not_to_be_checked()
    page.check('#word-image-saved-ok')
    expect(page.locator('#apply-import')).to_be_enabled()
    page.click('#apply-import')
    image_article=page.locator('#body').input_value();page.check('#reviewed')
    open_details(page,'#editing-tools');page.click('#start-image-editor');page.click('#image-use-placeholder')
    open_details(page,'#image-map-panel')
    page.locator('#image-map-file').set_input_files({'name':'image-map.json','mimeType':'application/json','buffer':image_map})
    expect(page.locator('#image-map-review')).to_be_visible()
    assert page.locator('#image-alt').input_value()=='' and page.locator('#image-url').input_value()==''
    assert page.locator('#body').input_value()==image_article and page.locator('#reviewed').is_checked()
    assert page.locator('#image-map-use-alt').is_disabled()
    # Inspect a different row without automatically retargeting or applying it.
    page.select_option('#image-map-entry','[Word image 3]');assert page.locator('#image-map-confirm').is_disabled()
    page.select_option('#image-placeholder-select','2');page.click('#image-use-placeholder')
    assert '[Word image 3' in page.locator('#image-target-context').input_value()
    page.check('#image-map-confirm');page.click('#image-map-use-alt')
    assert page.locator('#image-alt').input_value()=='Fictional image 3'
    assert page.locator('#image-url').input_value()=='' and page.locator('#reviewed').is_checked()
    # Pending map/private preparation never enters a deliberate workspace backup.
    open_details(page,'#workspace-files');page.check('#backup-private-ok')
    with page.expect_download() as info:page.click('#save-backup')
    pending_backup=Path(info.value.path()).read_text()
    assert 'Fictional image 3' not in pending_backup and 'placementScope' not in pending_backup
    page.fill('#image-url','https://example.com/reconciled.png');page.click('#image-preview')
    assert page.locator('#image-before').input_value()=='\\[Word image 3\\]'
    page.click('#image-apply')
    assert not page.locator('#reviewed').is_checked() and not page.locator('#wordpress-linked-images').is_checked()
    assert page.locator('#image-map-review').is_visible() and not page.locator('#image-map-confirm').is_checked()
    # Remaining choices keep labels 1 and 2. After removing 1, 2 still means 2.
    page.select_option('#image-placeholder-select','0');page.click('#image-use-placeholder')
    page.fill('#image-url','https://example.com/first.png');page.fill('#image-alt','First image reviewed')
    page.click('#image-preview');page.click('#image-apply')
    expect(page.locator('#image-placeholder-select option')).to_have_count(1)
    assert page.locator('#image-placeholder-select option').inner_text().startswith('[Word image 2] on line ')
    page.click('#image-use-placeholder');page.select_option('#image-map-entry','[Word image 2]');page.check('#image-map-confirm')
    body_before=page.locator('#body').input_value();page.fill('#body',body_before+'\n\nLater revision.')
    assert not page.locator('#image-map-confirm').is_checked() and page.locator('#image-map-use-alt').is_disabled()
    page.click('#image-use-placeholder');page.check('#image-map-confirm');page.click('#image-map-use-alt')
    assert page.locator('#image-alt').input_value()=='Fictional image 2'
    page.fill('#image-url','https://example.com/second.png');page.click('#image-preview');page.click('#image-apply')
    expect(page.locator('#image-placeholder-choices')).to_be_hidden()
    page.locator('#wordpress-image-panel > summary').click();page.check('#wordpress-linked-images');page.check('#reviewed')
    with page.expect_download() as info:page.click('#download-wordpress')
    blocks=Path(info.value.path()).read_text();assert blocks.count('<!-- wp:image -->')==3
    assert 'Fictional image 3' in blocks and 'Fictional image 2' in blocks and 'Later revision.' in blocks
    assert 'placementScope' not in blocks and 'word-image-001.png' not in blocks
    expect(page.locator('#article-preview img')).to_have_count(0)
    layout(page,'word-image-map-reconciliation')
    page.click('#image-map-clear');assert page.locator('#image-map-alt').input_value()==''
    assert page.locator('#image-map-review').is_hidden() and page.locator('#reviewed').is_checked()
    # Combined documents disclose duplicate labels and their exact source context.
    duplicate='First document [Word image 12].\n\nSecond document \\[Word image 12\\].'
    page.fill('#body',duplicate);page.select_option('#image-placeholder-select','1');page.click('#image-use-placeholder')
    assert '(occurrence 2 of 2)' in page.locator('#image-placeholder-select option').nth(1).inner_text()
    assert page.locator('#image-placeholder-context').input_value()=='Second document \\[Word image 12\\].'
    page.locator('#image-map-file').set_input_files({'name':'invalid.json','mimeType':'application/json','buffer':b'{"format":"wrong"}'})
    expect(page.locator('#image-map-status')).to_contain_text('intact image-map')
    assert page.locator('#body').input_value()==duplicate and page.locator('#image-map-review').is_hidden()
    assert state['api']==[];context.close()
    report['checks'].append('Word image reconciliation: real DOCX recovery and byte-identical image ZIP, actual downloaded map, original/duplicate labels and context, explicit alt reuse, stale acknowledgement reset, pending backup exclusion, retained map across checkpointed edits, three downloaded native Image blocks with separate consent, inert preview, local map deletion and invalid-file preservation')
    page,context,state=open_page('/markdown-to-wordpress/')
    unresolved_article='日本語 😀 first \\[Word image 12\\] ending.\n\nSecond occurrence \\[Word image 12\\] ending.\n\nRead [the paper][study].\n\n[study]: https://example.com/study'
    page.fill('#title','Fictional actionable review');page.fill('#body',unresolved_article);page.check('#reviewed')
    open_details(page,'#wordpress-review-panel')
    replacements=page.locator('#wordpress-findings').get_by_role('button',name='Prepare this Word image replacement',exact=True)
    expect(replacements).to_have_count(2)
    assert replacements.first.bounding_box()['height']>=44
    assert 'possible Word image placeholder' in page.locator('#wordpress-findings').inner_text()
    replacements.nth(1).click()
    expect(page.locator('#image-url')).to_be_focused()
    assert page.locator('#image-editor-panel').evaluate('el=>el.open') and page.locator('#editing-tools').evaluate('el=>el.open')
    assert 'line 3' in page.locator('#image-target-status').inner_text()
    assert page.locator('#body').input_value()==unresolved_article and page.locator('#reviewed').is_checked()
    page.fill('#image-url','https://example.com/actionable-image.png');page.fill('#image-alt','Reviewed fictional image')
    page.click('#image-preview');page.click('#image-apply')
    assert not page.locator('#reviewed').is_checked() and not page.locator('#wordpress-linked-images').is_checked()
    expect(page.locator('#wordpress-findings').get_by_role('button',name='Prepare this Word image replacement',exact=True)).to_have_count(1)
    # Word/HTML navigation states the remaining image limitation, without claiming repair.
    for destination in ['word','html']:
        page.select_option('#publishing-destination',destination);page.check('#reviewed')
        open_details(page,'#export-format-review')
        current=page.locator('#body').input_value()
        page.locator('#export-format-findings').get_by_role('button',name='Prepare this Word image replacement',exact=True).click()
        expect(page.locator('#desk-status')).to_contain_text('Image Markdown stays text in this export')
        assert page.locator('#body').input_value()==current and page.locator('#reviewed').is_checked()
        layout(page,'actionable-'+destination+'-formatting')
    page.select_option('#publishing-destination','wordpress');page.check('#reviewed')
    open_details(page,'#wordpress-review-panel')
    page.locator('#wordpress-findings').get_by_role('button',name='Review this image reference',exact=True).click()
    assert page.locator('#image-url').input_value()=='https://example.com/actionable-image.png'
    assert page.locator('#reviewed').is_checked()
    page.locator('#wordpress-findings').get_by_role('button',name='Review reference-link conversion',exact=True).first.click()
    expect(page.locator('#reference-links-panel > summary')).to_be_focused()
    assert page.locator('#reference-links-panel').evaluate('el=>el.open') and page.locator('#reference-result').is_hidden()
    assert page.locator('#body').input_value()==current and page.locator('#reviewed').is_checked()
    # Opening a remedy is navigation. The existing preview/apply still owns mutation.
    page.click('#reference-prepare');expect(page.locator('#reference-result')).to_be_visible()
    assert page.locator('#body').input_value()==current and page.locator('#reviewed').is_checked()
    page.check('#reference-ack');page.click('#reference-apply')
    assert '[the paper](https://example.com/study)' in page.locator('#body').input_value()
    assert not page.locator('#reviewed').is_checked()
    expect(page.locator('#wordpress-findings').get_by_role('button',name='Review reference-link conversion',exact=True)).to_have_count(0)
    page.check('#reviewed');open_details(page,'#wordpress-kit-panel')
    with page.expect_download() as info:page.click('#download-wordpress-kit')
    with zipfile.ZipFile(info.value.path()) as z:
        review=z.read('REVIEW.txt').decode();assert 'possible Word image placeholder' in review
        assert 'choose linked Image blocks separately' in review
        assert z.read('article-body.md').decode().count('Word image 12')==1
    layout(page,'actionable-wordpress-formatting')
    assert state['api']==[];context.close()
    report['checks'].append('Actionable formatting review: unresolved original Word placeholders reported before handoff, exact second-occurrence guided selection, navigation preserves approval, existing preview/apply owns mutation, Word/HTML literal-image limits, current-image and reference-conversion shortcuts, actual kit review, narrow layouts and no API calls')
    page,context,state=open_page('/markdown-to-wordpress/',blocked_modules=('/image-editor-controls.js',))
    page.fill('#body','Before \\[Word image 8\\] after.');page.check('#reviewed');open_details(page,'#wordpress-review-panel')
    page.locator('#wordpress-findings').get_by_role('button',name='Prepare this Word image replacement',exact=True).click()
    expect(page.locator('#body')).to_be_focused();expect(page.locator('#desk-status')).to_contain_text('exact source is selected')
    assert page.locator('#body').evaluate('el=>el.value.slice(el.selectionStart,el.selectionEnd)')=='\\[Word image 8\\]'
    assert page.locator('#reviewed').is_checked() and page.locator('#download-wordpress').is_enabled()
    assert state['api']==[];context.close()
    report['checks'].append('Unavailable guided image module: current formatting finding retains exact manual source selection, article approval and ordinary download readiness')
    page,context,state=open_page('/write/',blocked_modules=('/image-editor-controls.js',))
    expect(page.locator('#image-editor-status')).to_contain_text('could not load')
    page.fill('#body','Fictional fallback writing.');page.check('#reviewed');page.click('#copy-body')
    assert page.locator('#body').input_value()=='Fictional fallback writing.' and state['api']==[]
    context.close()
    report['checks'].append('Guided image optional-module failure keeps article editing and ordinary exports available')

    page,context,state=open_page('/markdown-to-wordpress/')
    link_original='Read this resource. [Original resource](https://example.com/original)'
    page.fill('#body',link_original);page.fill('#title','Fictional link editing');page.check('#reviewed')
    page.locator('#body').evaluate('(el)=>el.setSelectionRange(10,18)')
    open_details(page,'#editing-tools');page.click('#start-link-editor');page.fill('#link-label','Fictional [reading group]');page.fill('#link-url','https://example.com/reading_(1)?a=1&b=2');page.click('#link-preview')
    assert page.locator('#link-before').input_value()=='resource'
    assert page.locator('#body').input_value()==link_original and page.locator('#reviewed').is_checked()
    page.fill('#body',link_original+' Revised.')
    expect(page.locator('#link-apply')).to_be_disabled();assert page.locator('#link-after').input_value()==''
    page.locator('#body').evaluate('(el)=>el.setSelectionRange(10,18)');page.click('#link-use-selection')
    page.fill('#link-label','Fictional [reading group]');page.click('#link-preview');page.click('#link-apply')
    assert not page.locator('#reviewed').is_checked();assert page.locator('#link-url').input_value()==''
    expect(page.locator('#article-preview a')).to_have_count(2)
    page.check('#reviewed');page.locator('#article-link-list-panel > summary').click()
    expect(page.locator('#article-link-list li')).to_have_count(2)
    expect(page.locator('#article-link-list a')).to_have_count(0)
    page.locator('#article-link-list button').first.click();page.click('#link-preview');page.click('#link-apply')
    assert page.locator('#reviewed').is_checked()
    page.locator('#article-link-list button').first.click();page.click('#link-preview-remove');page.click('#link-apply')
    assert page.locator('#article-preview a').count()==1 and not page.locator('#reviewed').is_checked()
    page.check('#reviewed')
    with page.expect_download() as info:page.click('#download-wordpress')
    link_blocks=Path(info.value.path()).read_text()
    assert link_blocks.count('<a ')==1 and 'Fictional [reading group]' in link_blocks and 'https://example.com/original' in link_blocks
    assert 'https://example.com/reading_(1)' not in link_blocks
    assert state['api']==[];layout(page,'guided-link-editor');context.close()
    report['checks'].append('Guided link editor: exact selection preview, stale-target rejection, checkpointed apply, literal inventory, no-op approval preservation, unlink keeping label, and downloaded WordPress source')
    page,context,state=open_page('/write/',blocked_modules=('/link-editor-controls.js',))
    expect(page.locator('#link-editor-status')).to_contain_text('could not load')
    page.fill('#body','Fictional link fallback writing.');page.check('#reviewed');page.click('#copy-body')
    assert page.locator('#body').input_value()=='Fictional link fallback writing.' and state['api']==[]
    context.close()
    report['checks'].append('Guided link optional-module failure keeps article editing and ordinary exports available')

    page,context,state=open_page('/word-to-wordpress/')
    table_source='| Step | Plan |\n| :--- | ---: |\n| Welcome | Share an introduction |\n| Read | Take turns |'
    table_article='Opening.\n\n'+table_source+'\n\nEnding.'
    page.fill('#body',table_article);page.fill('#title','Fictional table edit');page.check('#reviewed')
    open_details(page,'#editing-tools');page.click('#start-table-editor');page.click('#table-open-selected')
    page.fill('#table-cell-1-1','Read together | quietly');page.select_option('#table-align-1','center');page.click('#table-preview-change')
    assert page.locator('#table-before').input_value()==table_source
    assert page.locator('#table-reading-preview table').count()==1 and page.locator('#body').input_value()==table_article and page.locator('#reviewed').is_checked()
    page.fill('#body','New intro.\n\n'+table_article)
    expect(page.locator('#table-apply')).to_be_disabled();assert page.locator('#table-after').input_value()==''
    page.click('#table-recheck');assert page.locator('#table-cell-1-1').input_value()=='Read together | quietly'
    page.click('#table-preview-change');page.click('#table-apply')
    assert page.locator('#body').input_value().startswith('New intro.\n\nOpening.') and page.locator('#body').input_value().endswith('\n\nEnding.')
    assert not page.locator('#reviewed').is_checked();page.check('#reviewed')
    with page.expect_download() as info:page.click('#download-wordpress')
    table_blocks=Path(info.value.path()).read_text()
    assert table_blocks.count('<th ')==2 and table_blocks.count('<tr>')==3 and 'Read together | quietly' in table_blocks and 'has-text-align-center' in table_blocks
    page.click('#table-open-selected');page.click('#table-preview-change');page.click('#table-apply');assert page.locator('#reviewed').is_checked()
    page.click('#table-create');page.fill('#table-head-0','Name');page.fill('#table-head-1','Notes');page.fill('#table-cell-0-0','Fictional group');page.fill('#table-cell-0-1','Preparation only');page.click('#table-preview-change');page.click('#table-discard')
    assert page.locator('#reviewed').is_checked();assert 'Preparation only' not in page.locator('#body').input_value()
    page.click('#table-open-selected')
    for _ in range(10):page.click('#table-add-column')
    assert state['api']==[];layout(page,'guided-table-editor');context.close()
    report['checks'].append('Guided table editor: cell/alignment editing, exact source/reading preview, stale-target recheck retaining cells, checkpointed apply, WordPress table download, no-op and discard approval preservation, and contained grid layout')
    page,context,state=open_page('/write/',blocked_modules=('/table-editor-controls.js',))
    expect(page.locator('#table-editor-status')).to_contain_text('could not load')
    page.fill('#body','Fictional table fallback.');page.check('#reviewed');page.click('#copy-body');assert page.locator('#body').input_value()=='Fictional table fallback.' and state['api']==[]
    context.close()
    report['checks'].append('Guided table optional-module failure keeps article editing and ordinary exports available')
    from table_row_acceptance import run_table_row_acceptance
    run_table_row_acceptance(open_page, report, open_details)

    page,context,state=open_page('/markdown-to-wordpress/')
    page.fill('#title','Existing fictional title');page.fill('#body','Existing opening.');page.check('#reviewed')
    open_details(page,'#editing-tools');page.click('#start-insert-import');page.fill('#import-text','# Additional section\n\nNew **details**.');page.click('#preview-import')
    expect(page.locator('#apply-import')).to_be_disabled();page.click('#preview-insertion')
    assert page.locator('#body').input_value()=='Existing opening.' and page.locator('#reviewed').is_checked()
    page.fill('#body','Current opening.');expect(page.locator('#apply-import')).to_be_disabled()
    assert page.locator('#import-insertion-after').input_value()=='' and page.locator('#import-body-preview').input_value()=='New **details**.'
    page.check('#import-include-title');page.click('#preview-insertion');page.click('#apply-import')
    assert page.locator('#body').input_value()=='Current opening.\n\n## Additional section\n\nNew **details**.'
    assert page.locator('#title').input_value()=='Existing fictional title' and not page.locator('#reviewed').is_checked()
    expect(page.locator('#checkpoint-select option')).to_have_count(1)
    page.check('#reviewed')
    with page.expect_download() as info:page.click('#download-wordpress')
    combined_blocks=Path(info.value.path()).read_text()
    assert 'Current opening.' in combined_blocks and '<h2 class="wp-block-heading">Additional section</h2>' in combined_blocks and '<strong>details</strong>' in combined_blocks
    open_details(page,'#editing-tools');page.click('#start-insert-import');page.fill('#import-text','Another section.');page.click('#preview-import');page.click('#preview-insertion')
    assert state['api']==[];layout(page,'article-import-insertion');context.close()
    report['checks'].append('Article insertion: exact append preview, stale location recovery retaining conversion, optional section title, existing title preservation, checkpointed apply, WordPress download, and contained layout')

    page,context,state=open_page('/google-docs-to-wordpress/')
    page.click('#start-copied-paste');assert page.locator('#import-format').input_value()=='html'
    open_details(page,'#copied-import-help')
    page.click('#import-html-example');expect(page.locator('#import-summary')).to_contain_text('Copied formatted writing')
    assert page.locator('#import-text').input_value()=='' and page.locator('#body').input_value()==''
    expect(page.locator('#apply-import')).to_be_disabled();page.check('#import-changes-ok');page.click('#apply-import')
    assert 'fictional' in page.locator('#title').input_value() and page.locator('#article-preview table').count()==1
    page.check('#reviewed')
    with page.expect_download() as info:page.click('#download-wordpress')
    copied_blocks=Path(info.value.path()).read_text();assert '<strong>bold text</strong>' in copied_blocks and '<!-- wp:table' in copied_blocks
    literal='---\ntitle: Keep this in the body\n---\n\n# Literal heading\n\n**Literal emphasis**\n\n```markdown\nKeep these fences.\n```'
    previous_body=page.locator('#body').input_value()
    page.click('#start-copied-paste');page.locator('#import-text').fill(literal)
    page.locator('#import-text').press('Control+A');page.locator('#import-text').press('Control+C');page.locator('#import-text').press('Control+V')
    expect(page.locator('#import-summary')).to_contain_text('Copied plain text');expect(page.locator('#import-warnings')).to_contain_text('Punctuation stays literal')
    expect(page.locator('#body')).to_have_value(previous_body)
    expect(page.locator('#apply-import')).to_be_disabled()
    pending=page.locator('#import-body-preview').input_value()
    page.click('#preview-import');expect(page.locator('#import-body-preview')).to_have_value(pending)
    page.check('#import-changes-ok');page.click('#apply-import')
    expect(page.locator('#title')).to_have_value('');expect(page.locator('#body')).to_have_value(pending)
    page.check('#reviewed')
    with page.expect_download() as info:page.click('#download-wordpress')
    literal_blocks=Path(info.value.path()).read_text()
    for passage in ['title: Keep this in the body','# Literal heading','**Literal emphasis**','```markdown','Keep these fences.']:
        assert passage in literal_blocks
    assert '<!-- wp:heading' not in literal_blocks and '<strong>' not in literal_blocks and '<pre' not in literal_blocks
    assert state['api']==[];layout(page,'google-docs-paste');context.close()
    report['checks'].append('Google Docs paste-first route: local example preview, acknowledgement, native table WordPress download, native plain-text punctuation/metadata/fence preservation through re-preview, apply and downloaded blocks, plus responsive layout')

    if not args.desk_only:
        for path in sorted((root/'public').rglob('*.html')):
            relative=path.relative_to(root/'public').as_posix()
            url='/'+relative.replace('index.html','')
            page,context,state=open_page(url,js=False); layout(page,relative)
            context.close()
        report['checks'].append('All generated public pages readable without JavaScript at 1440, 390, and 320 pixels')
        page,context,state=open_page('/write/#template-progress')
        expect(page.locator('#notes')).to_have_value(re.compile('What is completed:'))
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
        page.locator('.recovery-box:has(#backup-controls) > summary').click(); calls=state['calls']; restore(page,backup)
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
        from document_benchmark import run_document_benchmark
        corpus = run_document_benchmark(open_page,root,out)
        report['document_benchmark'] = {'result':corpus['result'],'cases':len(corpus['cases']),'counts':corpus['counts']}
        report['layout'].update(corpus['layout'])
        report['checks'].append('Pinned document corpus: exact and sampled text, structure, disclosures, rejections, independent Word bytes, and native file import/export')
    browser.close()
assert not report['errors'], report['errors']
assert not report['unexpected_requests'], report['unexpected_requests']
report['result']='PASS'
(out/'browser-results.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2))

