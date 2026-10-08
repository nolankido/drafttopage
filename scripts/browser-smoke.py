"""DOM fixture regression tests, not a hosted authentication or real model test.
Run from the repository root with Python Playwright and Chromium installed.
An optional CHROMIUM_EXECUTABLE selects an existing browser installation.
Only fictional fixtures are used; downloads are captured as Blobs in memory.
"""
import json
import os
import re
import shutil
import subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright

root = Path.cwd()
out = root / 'test-results'
out.mkdir(exist_ok=True)
html = subprocess.check_output(['node', '--input-type=module', '-e', "import {appPage} from './src/pages.js'; process.stdout.write(appPage)"], text=True)
html = re.sub(r'<link rel="stylesheet"[^>]*>', '', html)
html = html.replace('<script type="module" src="/pilot.js"></script>', '')
css = (root / 'public/styles.css').read_text() + (root / 'public/pilot.css').read_text()
script = ''
for name in ['markdown.js', 'workspace.js', 'request.js', 'pilot.js']:
    source = (root / 'public' / name).read_text()
    source = re.sub(r'^import .*?;\n', '', source, flags=re.MULTILINE)
    script += re.sub(r'\bexport (?=(?:async )?(?:function|class|const)\b)', '', source) + '\n'
mock = r"""
window.__calls=0; window.__failure=false; window.__expired=false; window.__ready=true; window.__malformed=false; window.__badDraft=false;
window.__draft={title:'A little more room to work',excerpt:'A small experiment in arranging a desk.',description:'A personal update about clearing a work surface.',slug:'room-to-work',body:'This week, I moved my notebooks to a shelf beside my desk.\n\nI am still testing whether the setup feels better.',questions:['Confirm that this sounds like your voice.']};
window.fetch=async (url,options)=>{
  if(window.__expired) return Response.json({error:'Session ended.'},{status:401});
  if(url.endsWith('/session')) return Response.json({authenticated:true,generationReady:window.__ready,profiles:{personal:{guidance:'Reflective and specific.'},update:{guidance:'Separate completed and planned work.'},guide:{guidance:'Use plain English.'}}});
  window.__calls++;
  if(window.__malformed) return new Response('<html>internal error details</html>',{status:502,headers:{'content-type':'text/html'}});
  if(window.__failure) return Response.json({error:'Mock provider unavailable. Your notes are kept.'},{status:502});
  if(window.__badDraft) return Response.json({draft:{...window.__draft,questions:null},remainingToday:19});
  return Response.json({draft:window.__draft,remainingToday:19});
};
window.__confirm=true; window.confirm=()=>window.__confirm;
URL.createObjectURL=(blob)=>{window.__export=blob; return 'blob:local-qa';};
URL.revokeObjectURL=()=>{};
HTMLAnchorElement.prototype.click=function(){window.__filename=this.download;};
"""
report = {'mode': 'DOM-only fixtures with mocked requests and captured download Blobs. No live Cloudflare or Claude calls.'}
with sync_playwright() as p:
    executable = os.environ.get('CHROMIUM_EXECUTABLE') or shutil.which('chromium')
    kwargs = {'executable_path': executable} if executable else {}
    browser = p.chromium.launch(headless=True, args=['--no-sandbox', '--disable-dev-shm-usage'], **kwargs)
    page = browser.new_page(viewport={'width': 1440, 'height': 1000})
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.set_content(html)
    page.add_style_tag(content=css)
    page.evaluate(mock)
    page.add_script_tag(content=script)
    page.wait_for_function("!document.querySelector('#generate').disabled")
    page.click('#sample')
    assert page.evaluate('window.__calls') == 0
    page.select_option('#profile', 'update')
    assert page.locator('#profile').get_attribute('aria-describedby') == 'profile-help'
    assert page.locator('#profile-help').inner_text() == 'Separate completed and planned work.'
    page.check('#consent')
    page.click('#generate')
    page.wait_for_function("!document.querySelector('#title').disabled && !document.querySelector('#editor').hidden")
    assert page.evaluate('document.activeElement.id') == 'title'
    assert page.locator('#draft-form').get_attribute('aria-busy') == 'false'
    assert page.locator('#download').is_disabled()
    page.fill('#title', 'Edited local QA article')
    page.check('#reviewed')
    page.click('#download')
    markdown = page.evaluate('window.__export.text()')
    assert 'Edited local QA article' in markdown and 'draft: true' in markdown
    assert 'Fictional example:' not in markdown and 'Confirm that this' not in markdown
    assert page.evaluate('window.__filename') == 'room-to-work.md'
    page.fill('#body', 'An edited fictional sentence from the local QA test.')
    assert not page.locator('#reviewed').is_checked() and page.locator('#download').is_disabled()
    report['generation_focus_edit_export_reapproval'] = True

    page.click('.recovery summary')
    page.click('#save-backup')
    backup = page.evaluate('window.__export.text()')
    saved = json.loads(backup)
    assert saved['source']['profile'] == 'update'
    assert saved['draft']['body'] == page.locator('#body').input_value()
    assert saved['draft']['questions'] == ['Confirm that this sounds like your voice.']
    assert 'consent' not in backup and 'reviewed' not in backup
    assert page.evaluate('window.__filename').startswith('drafttopage-workspace-')
    report['private_backup_contents'] = True
    notes, body = page.locator('#notes').input_value(), page.locator('#body').input_value()

    for flag, message in [('__failure', 'Mock provider unavailable'), ('__malformed', 'usable response'), ('__badDraft', 'review-question')]:
        page.evaluate(f'window.{flag}=true')
        page.click('#generate')
        page.wait_for_function('(message)=>document.querySelector("#status").textContent.includes(message)', arg=message)
        assert page.locator('#notes').input_value() == notes and page.locator('#body').input_value() == body
        assert page.locator('#clear').is_enabled() and page.locator('#save-backup').is_enabled()
        page.evaluate(f'window.{flag}=false')
    report['failure_never_partially_overwrites_draft'] = True

    def restore(content):
        page.locator('#restore-backup').set_input_files({'name': 'test-workspace.json', 'mimeType': 'application/json', 'buffer': content.encode()})
        page.wait_for_function('!document.querySelector("#restore-backup").disabled')

    for bad in ['{broken', json.dumps({**saved, 'version': 99}), ' ' * (128 * 1024 + 1)]:
        restore(bad)
        assert page.locator('#notes').input_value() == notes and page.locator('#body').input_value() == body
    page.evaluate('window.__confirm=false')
    restore(backup)
    assert page.locator('#notes').input_value() == notes
    page.evaluate('window.__confirm=true')
    page.fill('#notes', 'Changed notes that should be replaced by the explicit restore.')
    calls = page.evaluate('window.__calls')
    restore(backup)
    assert page.locator('#notes').input_value() == notes and page.locator('#body').input_value() == body
    assert page.evaluate('window.__calls') == calls
    assert not page.locator('#consent').is_checked() and not page.locator('#reviewed').is_checked()
    assert page.locator('#profile-help').inner_text() == 'Separate completed and planned work.'
    assert page.locator('#download').is_disabled()
    report['restore_validation_local_only_and_reset_approvals'] = True

    hostile = json.loads(backup)
    hostile['draft']['title'] = '<img src=x onerror=window.pwned=true>'
    hostile['draft']['questions'] = ['<svg onload=window.pwned=true>']
    restore(json.dumps(hostile))
    assert page.evaluate('window.pwned === undefined') and page.locator('#questions svg').count() == 0
    restore(backup)
    report['hostile_markup_stays_inert'] = True

    page.evaluate('window.__expired=true')
    page.click('#refresh')
    page.wait_for_selector('#reauth', state='visible')
    assert page.locator('#generate').is_disabled() and page.locator('#save-backup').is_enabled()
    assert page.locator('#notes').input_value() == notes and page.locator('#body').input_value() == body
    page.evaluate('window.__expired=false; window.__ready=false')
    page.click('#refresh')
    page.wait_for_function('!document.querySelector("#refresh").disabled')
    assert page.locator('#generate').is_disabled() and page.locator('#reauth').is_hidden()
    page.evaluate('window.__ready=true')
    page.click('#refresh')
    page.wait_for_function('!document.querySelector("#generate").disabled')
    assert page.locator('#notes').input_value() == notes and page.locator('#body').input_value() == body
    report['session_and_activation_reconnect_without_data_loss'] = True

    report['horizontal_overflow'] = {}
    for width, height, label in [(1440, 1000, 'desktop'), (390, 844, 'mobile'), (320, 740, 'narrow')]:
        page.set_viewport_size({'width': width, 'height': height})
        page.screenshot(path=str(out / f'workspace-{label}.png'), full_page=True)
        overflow = page.evaluate('document.documentElement.scrollWidth > innerWidth')
        report['horizontal_overflow'][label] = overflow
        assert not overflow
    page.click('#clear')
    assert page.locator('#editor').is_hidden() and page.locator('#notes').input_value() == ''
    assert page.locator('#profile-help').inner_text() == 'Reflective and specific.'
    report['clear_resets_profile_guidance'] = True
    report['javascript_errors'] = errors
    assert not errors
    browser.close()
report['result'] = 'PASS'
(out / 'browser-results.json').write_text(json.dumps(report, indent=2))
print(json.dumps(report, indent=2))
