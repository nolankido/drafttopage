"""One-time isolated source-bound mechanism, profile and ABBA study. Never merge."""
import hashlib, io, json, mimetypes, os, shutil, statistics, subprocess, sys, tempfile, zipfile
from pathlib import Path
from urllib.parse import urlparse, unquote
from playwright.sync_api import sync_playwright, expect
ROOT = Path.cwd().resolve()
BASE = '06a8823b45444741648022944ee6dd5115a7822c'
FEATURE = '9e9829fbe69eb74903d837279a2b6066f3f77465'
BLOBS = {
 'export-controls.js': ('b2300ecfc32f625b1fe519a94a12a232522b9632', '3adf372f87fb0f77ebd8d7506977dce9d82a3777'),
 'wordpress-handoff-controls.js': ('44a20cc4b55af575f4c72150ec0f636857ff521e', '83111ea7cc3af413eb751bb3a803a8043c53b6d9')
}
CASES = ['rich:wordpress:open', 'rich:word:open', 'rich:html:open', 'rich:wordpress:closed', 'rich:markdown:closed']
ORIGIN = 'https://drafttopage.test'
def blob(data):
 return hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()
def digest(public):
 h=hashlib.sha256()
 for f in sorted(p for p in public.rglob('*') if p.is_file()):
  h.update(str(f.relative_to(public.parent)).encode()+b'\0'+f.read_bytes()+b'\0')
 return h.hexdigest()
def instrumented_check(work, version):
 errors=[];requests=[]
 csp=next(x.split(':',1)[1].strip() for x in (work/'public/_headers').read_text().splitlines() if 'Content-Security-Policy:' in x)
 patch={
  '/publishing-kit.js': ('export function publishingKitFiles(draft, { includeTitleHeading = false } = {}) {', 'general'),
  '/wordpress-kit.js': ('export function wordPressKitFiles(draft, options = {}) {', 'wordpress')
 }
 with sync_playwright() as p:
  opts={'headless':True,'args':['--no-sandbox','--disable-dev-shm-usage']}
  binary=os.environ.get('CHROMIUM_EXECUTABLE') or shutil.which('chromium') or shutil.which('chromium-browser')
  if binary:opts['executable_path']=binary
  browser=p.chromium.launch(**opts)
  context=browser.new_context(viewport={'width':1440,'height':1000},reduced_motion='reduce',accept_downloads=True)
  def route(r):
   u=urlparse(r.request.url)
   if u.netloc!='drafttopage.test':requests.append(r.request.url);r.abort();return
   if u.path=='/favicon.ico':r.fulfill(status=204,body='');return
   f=(work/'public'/unquote(u.path).lstrip('/')).resolve()
   assert f.is_relative_to((work/'public').resolve())
   if f.is_dir():f/='index.html'
   if not f.is_file():requests.append(u.path);r.abort();return
   data=f.read_bytes()
   if u.path in patch:
    anchor,name=patch[u.path];text=data.decode();assert text.count(anchor)==1
    counter='\n(globalThis.__kitCalls ||= {general:0,wordpress:0}).'+name+'++;\n'
    data=text.replace(anchor,anchor+counter).encode()
   r.fulfill(body=data,content_type='text/javascript' if f.suffix=='.js' else mimetypes.guess_type(str(f))[0] or 'text/plain',headers={'Content-Security-Policy':csp})
  context.route('**/*',route)
  page=context.new_page();page.set_default_timeout(15000);page.on('pageerror',lambda x:errors.append(str(x)))
  page.goto(ORIGIN+'/write/');expect(page.locator('#desk-status')).to_contain_text('ready')
  draft={'title':'Fictional manifest check','body':'## Example\n\nA fictional [resource](https://example.test/).\n\nTODO: inspect this claim.','excerpt':'A summary.','description':'A description.','slug':'fictional-manifest-check'}
  page.evaluate("""values=>{for(const [id,value] of Object.entries(values))document.getElementById(id).value=value;document.getElementById('body').dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText'}));}""",{**draft,'notes':'MANIFEST_PRIVATE_SOURCE_SENTINEL','audience':'MANIFEST_PRIVATE_AUDIENCE_SENTINEL','purpose':'MANIFEST_PRIVATE_PURPOSE_SENTINEL'})
  page.evaluate("""()=>{for(const id of ['additional-exports','publishing-kit-panel','wordpress-kit-panel','wordpress-review-panel']){const el=document.getElementById(id);el.open=true;for(let p=el.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;}}""")
  expect(page.locator('#wordpress-kit-files li')).to_have_count(6)
  expect(page.locator('#kit-files li')).to_have_count(5)
  expect(page.locator('#wordpress-findings')).to_contain_text('TODO')
  page.evaluate('window.__kitCalls={general:0,wordpress:0}')
  page.locator('#body').focus();page.keyboard.press('Control+End')
  for _ in range(3):page.keyboard.insert_text('x');page.evaluate('()=>new Promise(requestAnimationFrame)')
  calls=page.evaluate('window.__kitCalls')
  assert not page.locator('#reviewed').is_checked()
  expect(page.locator('#wordpress-findings')).to_contain_text('TODO')
  if version=='before':assert calls['general']>0 and calls['wordpress']>0,calls
  else:assert calls=={'general':0,'wordpress':0},calls
  draft['body']=page.locator('#body').input_value()
  page.check('#reviewed')
  if version=='after':assert page.evaluate('window.__kitCalls')=={'general':0,'wordpress':0}
  downloads={}
  for name,button,module,function in [('wordpress','download-wordpress-kit','wordpress-kit.js','createWordPressKit'),('general','download-kit','publishing-kit.js','createPublishingKit')]:
   page.evaluate('window.__kitCalls={general:0,wordpress:0}')
   with page.expect_download() as info:page.click('#'+button)
   data=Path(info.value.path()).read_bytes()
   actual_calls=page.evaluate('window.__kitCalls')
   assert actual_calls['general']>0 and (name!='wordpress' or actual_calls['wordpress']>0),actual_calls
   code="import {"+function+"} from './public/"+module+"';process.stdout.write(Buffer.from("+function+"(JSON.parse(process.argv[1])).bytes));"
   expected=subprocess.check_output(['node','--input-type=module','-e',code,json.dumps(draft)],cwd=ROOT)
   assert data==expected,'Actual ZIP bytes differ: '+name
   with zipfile.ZipFile(io.BytesIO(data)) as z:
    assert z.testzip() is None
    assert all(b'MANIFEST_PRIVATE_' not in z.read(filename) for filename in z.namelist())
    files=z.namelist()
   downloads[name]={'exactBytes':True,'sha256':hashlib.sha256(data).hexdigest(),'files':files,'compilerCalls':actual_calls}
  page.fill('#title','')
  assert not page.locator('#reviewed').is_checked()
  expect(page.locator('#wordpress-kit-files li')).to_have_count(0)
  expect(page.locator('#kit-files li')).to_have_count(0)
  assert page.locator('#download-kit').is_disabled() and page.locator('#download-wordpress-kit').is_disabled()
  assert not errors and not requests,(errors,requests)
  context.close();browser.close()
 return {'result':'PASS','version':version,'nativeEdits':3,'typingCompilerCalls':calls,'liveFindingKept':True,'invalidTitleClearsFiles':True,'downloads':downloads,'errors':errors,'unexpectedRequests':requests}
def main():
 out=ROOT/'test-results/kit-manifest-study.json';out.parent.mkdir(exist_ok=True);out.unlink(missing_ok=True)
 initial=digest(ROOT/'public')
 report={'result':'RUNNING','scope':'Synthetic isolated Chromium, not real-author, device, paint or field INP','baselineCommit':BASE,'featureCommit':FEATURE,'moduleBlobs':BLOBS,'samplesPerRun':31,'runOrder':['before','after','after','before'],'cases':CASES,'mechanism':[],'profiles':[],'runs':[],'summary':[],'errors':[],'publicSha256':initial,'publicUnchanged':None}
 def save():out.write_text(json.dumps(report,indent=2)+'\n')
 save()
 try:
  for name,(old,new) in BLOBS.items():
   assert blob((ROOT/'scripts/manifest-baseline'/name).read_bytes())==old
   assert blob((ROOT/'public'/name).read_bytes())==new
  source=(ROOT/'scripts/editing_benchmark.py').read_text()
  guard="if kind=='rich' and destination=='markdown' and panels=='closed':"
  assert source.count(guard)==1
  timed=source.replace(guard,'if False:')
  marker="report['cases'].append(entry);print(json.dumps(entry),flush=True)"
  assert timed.count(marker)==1
  timed=timed.replace(marker,"entry['rawSynchronousInputMs']=measures['sync'];entry['rawInputToFrameMs']=measures['frame'];"+marker)
  profiled=source.replace(guard,"if kind=='rich' and destination=='wordpress' and panels=='open':")
  report['originalHarnessSha256']=hashlib.sha256(source.encode()).hexdigest()
  report['timingHarnessSha256']=hashlib.sha256(timed.encode()).hexdigest()
  report['profileHarnessSha256']=hashlib.sha256(profiled.encode()).hexdigest()
  with tempfile.TemporaryDirectory(prefix='dtp-manifest-study-') as temp:
   folder=Path(temp)
   timing=folder/'timing.py';timing.write_text(timed)
   profile=folder/'profile.py';profile.write_text(profiled)
   for version in ['before','after']:
    shutil.copytree(ROOT/'public',folder/version/'public')
   for name in BLOBS:shutil.copyfile(ROOT/'scripts/manifest-baseline'/name,folder/'before/public'/name)
   env=os.environ.copy();env['GIT_DIR']=subprocess.check_output(['git','rev-parse','--absolute-git-dir'],cwd=ROOT,text=True).strip();env['GIT_WORK_TREE']=str(ROOT)
   for version in ['before','after']:
    report['mechanism'].append(instrumented_check(folder/version,version));save()
   def run(case,version,index,harness):
    output=folder/version/'test-results'/('run-'+str(index)+'.json')
    command=[sys.executable,str(harness),'--samples','31','--only',case,'--output',str(output)]
    p=subprocess.run(command,cwd=folder/version,env=env,text=True,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,timeout=300)
    if p.returncode:raise RuntimeError(case+' '+version+': '+p.stdout[-1600:])
    evidence=json.loads(output.read_text());assert evidence['result']=='PASS' and evidence['publicUnchanged'] and not evidence['errors'] and not evidence['unexpectedRequests'] and len(evidence['cases'])==1
    row=evidence['cases'][0];assert ':'.join([row['kind'],row['destination'],row['panels']])==case
    return {'case':case,'version':version,'order':index,'browser':evidence['browser'],'assetSha256':evidence['publicSha256'],**row}
   for version in ['before','after']:
    report['profiles'].append(run('rich:wordpress:open',version,0,profile));save()
   for case in CASES:
    for index,version in enumerate(['before','after','after','before'],1):
     row=run(case,version,index,timing)
     assert len(row['rawSynchronousInputMs'])==31 and len(row['rawInputToFrameMs'])==31
     report['runs'].append(row);save();print('ABBA',case,index,version,row['synchronousInputMs'],flush=True)
    rows=[r for r in report['runs'] if r['case']==case];summary={'case':case}
    for metric in ['synchronousInputMs','inputToFrameMs']:
     summary[metric]={}
     for version in ['before','after']:
      data=[r[metric] for r in rows if r['version']==version]
      summary[metric][version]={'medianOfMedians':round(statistics.median(r['median'] for r in data),2),'p95Range':[min(r['p95'] for r in data),max(r['p95'] for r in data)],'worst':max(r['max'] for r in data)}
    report['summary'].append(summary);save()
  report['publicUnchanged']=digest(ROOT/'public')==initial
  assert report['publicUnchanged'] and len(report['runs'])==20 and len(report['profiles'])==2
  report['result']='PASS'
 except Exception as e:
  report['result']='FAIL';report['errors'].append(str(e));report['publicUnchanged']=digest(ROOT/'public')==initial
 save();print('Manifest study:',report['result'],flush=True)
 if report['result']!='PASS':print(report['errors'],file=sys.stderr)
 return 0 if report['result']=='PASS' else 1
if __name__=='__main__':sys.exit(main())
