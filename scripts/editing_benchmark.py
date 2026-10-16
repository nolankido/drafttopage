"""Local fictional editing diagnostic. No production request or application patch."""
import argparse, hashlib, json, math, mimetypes, os, shutil, statistics, subprocess
from pathlib import Path
from urllib.parse import urlparse, unquote
from playwright.sync_api import sync_playwright, expect

parser=argparse.ArgumentParser()
parser.add_argument('--output',default='test-results/editing-benchmark.json')
parser.add_argument('--samples',type=int,default=9)
parser.add_argument('--only',help='Optional kind:destination:panels diagnostic subset')
parser.add_argument('--link-inventory',choices=['closed','open'],default='closed',help='Explicit link inventory control, independent of reading/export panels')
parser.add_argument('--unique-blocks',action='store_true',help='Make every fictional block distinct instead of repeating identical source')
args=parser.parse_args()
if not 3 <= args.samples <= 100:parser.error('Choose 3 to 100 samples.')
output=Path(args.output);output.parent.mkdir(parents=True,exist_ok=True);output.unlink(missing_ok=True)
root=Path.cwd();origin='https://drafttopage.test'
csp=next(line.split(':',1)[1].strip() for line in (root/'public/_headers').read_text().splitlines() if 'Content-Security-Policy:' in line)
def public_digest():
 digest=hashlib.sha256()
 for f in sorted((root/'public').rglob('*')):
  if f.is_file():digest.update(str(f.relative_to(root)).encode()+b'\0'+f.read_bytes()+b'\0')
 return digest.hexdigest()
report={'scope':'local Chromium, fictional articles, trusted text insertion; not real-user latency','head':subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip(),'publicSha256':public_digest(),'samples':args.samples,'subset':args.only,'linkInventory':args.link_inventory,'uniqueBlocks':args.unique_blocks,'cases':[],'errors':[],'unexpectedRequests':[]}
ordinary='A fictional neighborhood guide compares simple choices and preserves uncertainty. This paragraph is test writing only.\n\n'
rich='## Fictional heading\n\nA **bold** and *italic* passage with ~~old wording~~ and [a fictional link](https://example.test/guide).\n\n- First item\n- Second item\n\n| Place | Note |\n| --- | --- |\n| Park | Quiet |\n\n'
def article(unit,unique=False):
 if not unique:return (unit*(59000//len(unit))).strip()
 blocks=[];size=0;index=0
 while True:
  for part in unit.strip().split('\n\n'):
   value=part.replace('| Park |','| Park '+str(index)+' |') if part.startswith('|') else part+' '+str(index)
   if size+len(value)+2>=59000:return '\n\n'.join(blocks)
   blocks.append(value);size+=len(value)+2;index+=1
def stats(values):return {'median':round(statistics.median(values),2),'p95':round(sorted(values)[math.ceil(len(values)*.95)-1],2),'max':round(max(values),2)}
with sync_playwright() as p:
 binary=os.environ.get('CHROMIUM_EXECUTABLE') or shutil.which('chromium') or shutil.which('chromium-browser')
 options={'headless':True,'args':['--no-sandbox','--disable-dev-shm-usage']}
 if binary:options['executable_path']=binary
 browser=p.chromium.launch(**options)
 report['browser']=browser.version
 for kind,unit in [('ordinary',ordinary),('rich',rich)]:
  for destination in ['wordpress','html','word','markdown']:
   for panels in ['closed','open']:
    if args.only and args.only!=':'.join([kind,destination,panels]):continue
    print('Editing benchmark: '+':'.join([kind,destination,panels]),flush=True)
    context=browser.new_context(viewport={'width':1440,'height':1000},reduced_motion='reduce')
    def route(r):
     u=urlparse(r.request.url)
     if u.netloc!='drafttopage.test':report['unexpectedRequests'].append(r.request.url);r.abort();return
     if u.path=='/favicon.ico':r.fulfill(status=204,body='');return
     f=(root/'public'/unquote(u.path).lstrip('/')).resolve()
     assert f.is_relative_to((root/'public').resolve())
     if f.is_dir():f/='index.html'
     if not f.is_file():report['unexpectedRequests'].append(u.path);r.abort();return
     r.fulfill(body=f.read_bytes(),content_type='text/javascript' if f.suffix=='.js' else mimetypes.guess_type(str(f))[0] or 'text/plain',headers={'Content-Security-Policy':csp})
    context.route('**/*',route)
    page=context.new_page();page.set_default_timeout(30000);page.on('pageerror',lambda e:report['errors'].append(str(e)))
    page.goto(origin+'/markdown-to-wordpress/')
    expect(page.locator('#desk-status')).to_contain_text('ready')
    page.fill('#title','Fictional performance fixture')
    page.select_option('#publishing-destination',destination)
    # Seed outside the measured interval. Every timed insertion below is native.
    page.locator('#body').evaluate('(el,text)=>{el.value=text;el.dispatchEvent(new InputEvent("input",{bubbles:true,inputType:"insertText"}));}',article(unit,args.unique_blocks))
    page.evaluate("""opened=>{
      for(const id of ['preview-panel','export-content-panel','wordpress-review-panel','wordpress-kit-panel','export-format-review','additional-exports','publishing-kit-panel']){
        const panel=document.getElementById(id);if(panel)panel.open=opened;
      }
    }""",panels=='open')
    page.evaluate("""opened=>{
      document.getElementById('link-editor-panel').open=opened;
      document.getElementById('article-link-list-panel').open=opened;
      if(opened)for(let parent=document.getElementById('link-editor-panel').parentElement;parent;parent=parent.parentElement)if(parent.tagName==='DETAILS')parent.open=true;
    }""",args.link_inventory=='open')
    page.evaluate('()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))')
    expect(page.locator('#article-link-list li')).to_have_count(40 if args.link_inventory=='open' and kind=='rich' else 0)
    page.evaluate("""()=>{
      window.editSamples=[];window.editFrames=[];let start=0;
      document.addEventListener('input',e=>{if(e.target.id==='body')start=performance.now();},true);
      document.addEventListener('input',e=>{if(e.target.id==='body'){
        window.editSamples.push(performance.now()-start);
        const before=start;requestAnimationFrame(()=>window.editFrames.push(performance.now()-before));
      }});
    }""")
    page.locator('#body').focus();page.keyboard.press('Control+End')
    # Warm-up is separate from the recorded sample set.
    page.keyboard.insert_text('x');page.evaluate('()=>new Promise(requestAnimationFrame)')
    page.evaluate('window.editSamples=[];window.editFrames=[]')
    cdp=None
    if kind=='rich' and destination=='markdown' and panels=='closed':
     cdp=context.new_cdp_session(page);cdp.send('Profiler.enable');cdp.send('Profiler.setSamplingInterval',{'interval':1000});cdp.send('Profiler.start')
    for i in range(args.samples):
     page.keyboard.insert_text('x')
     page.evaluate('()=>new Promise(requestAnimationFrame)')
     assert not page.locator('#reviewed').is_checked()
    measures=page.evaluate('({sync:window.editSamples,frame:window.editFrames})')
    assert len(measures['sync'])==args.samples and len(measures['frame'])==args.samples
    entry={'kind':kind,'destination':destination,'panels':panels,'linkInventory':args.link_inventory,'uniqueBlocks':args.unique_blocks,'characters':len(article(unit,args.unique_blocks)),'synchronousInputMs':stats(measures['sync']),'inputToFrameMs':stats(measures['frame'])}
    if cdp:
     profile=cdp.send('Profiler.stop')['profile'];hits={};inclusive={}
     nodes={node['id']:node for node in profile['nodes']}
     def total(node):
      value=node.get('hitCount',0)+sum(total(nodes[id]) for id in node.get('children',[]))
      frame=node['callFrame'];url=frame['url'];name=url.removeprefix(origin)+':'+frame['functionName']
      if origin in url:inclusive[name]=inclusive.get(name,0)+value
      return value
     total(profile['nodes'][0])
     for node in profile['nodes']:
      frame=node['callFrame'];url=frame['url']
      if origin in url:
       name=url.removeprefix(origin)+':'+frame['functionName'];hits[name]=hits.get(name,0)+node.get('hitCount',0)
     entry['profileSampleHits']=sorted(hits.items(),key=lambda pair:-pair[1])[:16]
     entry['profileInclusiveHits']=sorted(inclusive.items(),key=lambda pair:-pair[1])[:20]
    report['cases'].append(entry);print(json.dumps(entry),flush=True)
    context.close()
 browser.close()
report['publicUnchanged']=public_digest()==report['publicSha256']
report['result']='PASS' if report['cases'] and report['publicUnchanged'] and not report['errors'] and not report['unexpectedRequests'] else 'FAIL'
output.write_text(json.dumps(report,indent=2)+'\n')
assert report['result']=='PASS',report
