"""Browser DOM smoke test with in-memory fixtures, not a live deployment test.
Requires Python Playwright and Chromium. Run from the repository root.
No network, credentials, or real model requests are used.
"""
import json
import subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright
root = Path.cwd()
out = root / 'test-results'
out.mkdir(exist_ok=True)
html = subprocess.check_output(['node', '--input-type=module', '-e', "import {appPage} from './src/pages.js'; process.stdout.write(appPage)"], text=True)
# Assets are injected from local source for a DOM-only test. This does not test HTTP/CSP.
html = html.replace('<link rel="stylesheet" href="/styles.css">', '').replace('<link rel="stylesheet" href="/pilot.css">', '').replace('<script type="module" src="/pilot.js"></script>', '')
css = (root/'public/styles.css').read_text() + (root/'public/pilot.css').read_text()
script = (root/'public/markdown.js').read_text().replace('export function ', 'function ')
script += (root/'public/pilot.js').read_text().replace("import { createMarkdown } from './markdown.js';", '')
mock = """
window.__calls=0; window.__failure=false;
window.__draft={title:'A little more room to work',excerpt:'A small experiment in arranging a desk.',description:'A personal update about clearing a work surface.',slug:'room-to-work',body:'This week, I moved my notebooks to a shelf beside my desk.\\n\\nI am still testing whether the setup feels better.',questions:['Confirm that this sounds like your voice.']};
window.fetch=async (url,options)=>{
  if(url.endsWith('/session')) return Response.json({generationReady:true,profiles:{personal:{guidance:'Reflective and specific.'},update:{guidance:'Separate completed and planned work.'},guide:{guidance:'Use plain English.'}}});
  window.__calls++;
  if(window.__failure) return Response.json({error:'Mock provider unavailable. Your notes are kept.'},{status:502});
  return Response.json({draft:window.__draft,remainingToday:19});
};
window.confirm=()=>true;
URL.createObjectURL=(blob)=>{ window.__export=blob; return 'blob:local-qa'; };
URL.revokeObjectURL=()=>{};
HTMLAnchorElement.prototype.click=function(){window.__filename=this.download;};
"""
report={'mode':'DOM-only fixtures plus separately executed Node backend tests. No live Cloudflare or Claude calls.'}
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    page=browser.new_page(viewport={'width':1440,'height':1000})
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.set_content(html)
    page.add_style_tag(content=css)
    page.evaluate(mock)
    page.add_script_tag(content=script)
    page.wait_for_function("!document.querySelector('#generate').disabled")
    page.click('#sample')
    assert page.evaluate('window.__calls')==0
    page.check('#consent')
    page.click('#generate')
    page.wait_for_selector('#editor',state='visible')
    assert page.locator('#title').input_value()=='A little more room to work'
    assert page.locator('#download').is_disabled()
    page.fill('#title','Edited local QA article')
    page.check('#reviewed')
    page.click('#download')
    content=page.evaluate('window.__export.text()')
    assert 'Edited local QA article' in content and 'draft: true' in content
    assert 'Fictional example:' not in content
    (out/'sample-export.md').write_text(content)
    assert page.evaluate('window.__filename')=='room-to-work.md'
    page.fill('#body','An edited sentence from the local QA test.')
    assert not page.locator('#reviewed').is_checked()
    assert page.locator('#download').is_disabled()
    report['generation_editing_export_and_reapproval']=True
    page.evaluate("window.__draft.title='<img src=x onerror=window.pwned=true>'; window.__draft.questions=['<svg onload=window.pwned=true>']; window.__draft.body='<script>window.pwned=true</script>'")
    page.click('#generate')
    page.wait_for_function("document.querySelector('#title').value.startsWith('<img')")
    assert page.evaluate('window.pwned === undefined')
    assert page.locator('#questions svg').count()==0
    report['untrusted_markup_is_inert_text']=True
    page.fill('#title','A little more room to work')
    page.fill('#body','This week, I moved my notebooks to a shelf beside my desk.\n\nI am still testing whether the setup feels better.')
    page.evaluate("document.querySelector('#questions').replaceChildren(Object.assign(document.createElement('li'),{textContent:'Confirm that this sounds like your voice.'}))")
    page.screenshot(path=str(out/'workspace-desktop.png'),full_page=True)
    report['desktop_horizontal_overflow']=page.evaluate('document.documentElement.scrollWidth > innerWidth')
    page.set_viewport_size({'width':390,'height':844})
    page.screenshot(path=str(out/'workspace-mobile.png'),full_page=True)
    report['mobile_horizontal_overflow']=page.evaluate('document.documentElement.scrollWidth > innerWidth')
    assert not report['desktop_horizontal_overflow'] and not report['mobile_horizontal_overflow']
    notes=page.locator('#notes').input_value(); body=page.locator('#body').input_value()
    page.evaluate('window.__failure=true')
    page.click('#generate')
    page.wait_for_function("document.querySelector('#status').textContent.includes('Mock provider unavailable')")
    assert page.locator('#notes').input_value()==notes and page.locator('#body').input_value()==body
    report['failure_preserves_previous_work']=True
    page.click('#clear')
    assert page.locator('#editor').is_hidden() and page.locator('#notes').input_value()==''
    report['clear_workspace']=True
    report['javascript_errors']=errors
    assert not errors
    browser.close()
report['result']='PASS'
(out/'browser-results.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2))
