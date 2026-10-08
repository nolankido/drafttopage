"""DOM-only browser regression checks. No live authentication, CSP, or provider testing.
Run npm run build first, then python scripts/browser-smoke.py with Playwright and Chromium.
Captured Blob contents verify export generation, not a real user-device download.
"""
import json
import re
import shutil
import subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright

root = Path.cwd()
out = root / 'test-results'
out.mkdir(exist_ok=True)
css = '\n'.join((root / 'public' / name).read_text() for name in ['styles.css', 'pilot.css', 'content.css'])
data = (root / 'public/content-data.js').read_text().replace('export const ', 'const ')
markdown = (root / 'public/markdown.js').read_text().replace('export function ', 'function ')
app = subprocess.check_output(['node', '--input-type=module', '-e', "import {appPage} from './src/pages.js'; process.stdout.write(appPage)"], text=True)
report = {'mode': 'DOM fixtures with mocked network; no real Cloudflare, cookies, CSP, or AI provider test', 'checks': [], 'overflow': {}, 'javascript_errors': []}
base_mock = """
window.__calls=0; window.__copies=[];
window.confirm=()=>true;
Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>window.__copies.push(text)}});
URL.createObjectURL=blob=>{window.__export=blob;return 'blob:local-qa';};
URL.revokeObjectURL=()=>{};
HTMLAnchorElement.prototype.click=function(){window.__filename=this.download;};
"""
with sync_playwright() as p:
    executable = shutil.which('chromium') or shutil.which('chromium-browser')
    options = {'headless': True, 'args': ['--no-sandbox', '--disable-dev-shm-usage']}
    if executable:
        options['executable_path'] = executable
    browser = p.chromium.launch(**options)
    def fixture(html, script=None, mock=''):
        page = browser.new_page(viewport={'width':1440,'height':1000})
        page.on('pageerror', lambda error: report['javascript_errors'].append(str(error)))
        html = re.sub(r'<link rel="stylesheet"[^>]*>', '', html)
        html = re.sub(r'<script[^>]*>.*?</script>', '', html, flags=re.S)
        page.set_content(html)
        page.add_style_tag(content=css)
        page.evaluate('() => {' + base_mock + mock + '}')
        if script:
            js = (root / 'public' / script).read_text()
            js = re.sub(r'^import .*?;\n', '', js, flags=re.M)
            page.add_script_tag(content=data + '\n' + markdown + '\n' + js)
        return page
    def layout(page, name, screenshot=False):
        for width in [1440, 390, 320]:
            page.set_viewport_size({'width':width,'height':900})
            overflow = page.evaluate('document.documentElement.scrollWidth > innerWidth')
            report['overflow'][f'{name}-{width}'] = overflow
            assert not overflow, f'{name} overflows at {width}'
            if screenshot and width in [1440,390]:
                page.screenshot(path=str(out / f'{name}-{width}.png'), full_page=True)
        page.set_viewport_size({'width':1440,'height':1000})
    # All public content must remain readable without executing its enhancement scripts.
    for path in sorted((root/'public').rglob('*.html')):
        page = fixture(path.read_text())
        name = str(path.relative_to(root/'public')).replace('/index.html','').replace('index.html','home').replace('/','-').replace('.html','')
        layout(page, name, name in ['home','examples','templates'])
        page.close()
    report['checks'].append('All 12 public pages fit desktop, 390px and 320px viewports with scripts disabled')
    page = fixture((root/'public/templates/index.html').read_text(), 'resources.js')
    page.click('[data-copy="outline-progress"]')
    assert 'What is completed:' in page.evaluate('window.__copies[0]')
    page.evaluate("() => { navigator.clipboard.writeText=async()=>{throw new Error('denied')}; }")
    page.click('[data-copy="outline-reflection"]')
    assert 'copy it manually' in page.locator('#resource-status').inner_text()
    assert page.locator('#outline-reflection').evaluate('(e)=>e.selectionEnd>e.selectionStart')
    page.close()
    report['checks'].append('Template copy works and blocked clipboard selects visible text for manual copying')
    page = fixture((root/'public/demo/index.html').read_text(), 'resources.js', "window.fetch=()=>{throw new Error('Unexpected network call')};")
    assert page.locator('#demo-download').is_disabled()
    page.fill('#demo-title','An edited demonstration')
    page.check('#demo-reviewed'); page.click('#demo-download')
    exported = page.evaluate('window.__export.text()')
    assert 'An edited demonstration' in exported and 'draft: true' in exported and 'Fictional example:' not in exported
    page.fill('#demo-body','A changed sample sentence.')
    assert page.locator('#demo-download').is_disabled() and not page.locator('#demo-reviewed').is_checked()
    page.fill('#demo-slug','../../bad'); page.check('#demo-reviewed'); page.click('#demo-download')
    assert 'filename' in page.locator('#resource-status').inner_text()
    page.select_option('#demo-example','meeting'); page.click('#demo-load')
    assert page.locator('#demo-title').input_value()=='Prepare a simple reading-group agenda'
    layout(page,'demo',True); page.close()
    report['checks'].append('Public demo loads all-local content, validates export, preserves edits in Blob, resets approval and loads another sample')
    mock = """
window.__failure=false;window.__expired=false;window.__malformed=false;
window.__draft={title:'A little more room to work',excerpt:'A small experiment in arranging a desk.',description:'A personal update about clearing a work surface.',slug:'room-to-work',body:'This week I moved my notebooks. The result is still uncertain.',questions:['Confirm that this sounds like your voice.']};
window.fetch=async (url,options)=>{
 if(url.endsWith('/session'))return window.__expired?Response.json({error:'Your session has ended.'},{status:401}):Response.json({authenticated:true,generationReady:true,profiles:{personal:{guidance:'Reflective and specific.'},update:{guidance:'Separate completed and planned work.'},guide:{guidance:'Use plain English.'}}});
 window.__calls++;
 if(window.__expired)return Response.json({error:'Your session has ended.'},{status:401});
 if(window.__failure)return Response.json({error:'Mock provider unavailable. Your notes are kept.'},{status:502});
 if(window.__malformed)return Response.json({draft:{...window.__draft,questions:null},remainingToday:19});
 return Response.json({draft:window.__draft,remainingToday:19});
};
"""
    page = fixture(app, 'pilot.js', mock)
    page.wait_for_function("!document.querySelector('#generate').disabled")
    page.locator('.source-template summary').click(); page.select_option('#note-template','progress'); page.click('#load-template')
    assert page.locator('#profile').input_value()=='update'
    page.check('#consent'); page.click('#generate')
    assert page.evaluate('window.__calls')==0 and 'Fill in the outline' in page.locator('#status').inner_text()
    page.click('#sample'); assert page.evaluate('window.__calls')==0 and not page.locator('#consent').is_checked()
    page.check('#consent'); page.click('#generate'); page.wait_for_selector('#editor',state='visible')
    assert page.locator('#download').is_disabled()
    page.fill('#title','Edited local QA article'); page.check('#reviewed'); page.click('#download')
    content = page.evaluate('window.__export.text()')
    assert 'Edited local QA article' in content and 'draft: true' in content and 'Fictional example:' not in content
    assert page.evaluate('window.__filename')=='room-to-work.md'
    (out/'sample-export.md').write_text(content)
    page.click('#copy-body'); assert page.evaluate('window.__copies.at(-1)')==page.locator('#body').input_value()
    page.click('#copy-questions'); assert 'Confirm that' in page.evaluate('window.__copies.at(-1)')
    page.fill('#body','An edited sentence from the local QA test.'); assert page.locator('#download').is_disabled()
    notes = page.locator('#notes').input_value(); body = page.locator('#body').input_value(); title = page.locator('#title').input_value()
    page.evaluate('window.__malformed=true'); page.click('#generate')
    assert page.locator('#title').input_value()==title and page.locator('#body').input_value()==body
    page.evaluate('window.__malformed=false;window.__failure=true'); page.click('#generate')
    assert page.locator('#notes').input_value()==notes and page.locator('#body').input_value()==body
    page.evaluate('window.__failure=false;window.__expired=true'); page.click('#generate')
    assert page.locator('#reauth').is_visible() and page.locator('#generate').is_disabled()
    calls = page.evaluate('window.__calls'); page.evaluate('window.__expired=false'); page.click('#reconnect')
    page.wait_for_function("!document.querySelector('#generate').disabled")
    assert page.evaluate('window.__calls')==calls and page.locator('#body').input_value()==body and page.locator('#reauth').is_hidden()
    report['checks'].append('Private pilot: blank-outline guard, local template/sample loading, edited export, body/question copy, reapproval, malformed/failure preservation, and session recovery')
    page.evaluate("window.__draft.title='<img src=x onerror=window.pwned=true>';window.__draft.questions=['<svg onload=window.pwned=true>'];window.__draft.body='<script>window.pwned=true</script>'")
    page.click('#generate'); page.wait_for_function("document.querySelector('#title').value.startsWith('<img')")
    assert page.evaluate('window.pwned===undefined') and page.locator('#questions svg').count()==0
    page.fill('#title','A little more room to work'); page.fill('#body',body)
    layout(page,'pilot',True)
    page.click('#clear'); assert page.locator('#editor').is_hidden() and page.locator('#notes').input_value()==''
    page.close()
    report['checks'].append('Private pilot: hostile markup stays inert, clearing removes work, desktop and narrow layouts fit')
    assert not report['javascript_errors']
    browser.close()
report['result']='PASS'
(out/'browser-results.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2))
