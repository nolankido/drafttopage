"""Manual offline browser contracts for selected-export DOM reuse. No production requests."""
import hashlib, json, mimetypes, os, shutil
from pathlib import Path
from urllib.parse import urlparse, unquote
from playwright.sync_api import sync_playwright, expect

root = Path.cwd().resolve()
output = root / 'test-results/export-preview-reuse-browser.json'
output.parent.mkdir(exist_ok=True); output.unlink(missing_ok=True)
origin = 'https://drafttopage.test'
csp = next(line.split(':', 1)[1].strip() for line in (root/'public/_headers').read_text().splitlines() if 'Content-Security-Policy:' in line)
def digest():
 h=hashlib.sha256()
 for f in sorted(p for p in (root/'public').rglob('*') if p.is_file()):
  h.update(str(f.relative_to(root)).encode()+b'\0'+f.read_bytes()+b'\0')
 return h.hexdigest()
report={'result':'RUNNING','scope':'Offline Chromium, exact real-renderer DOM parity and native-input contracts; not production or device acceptance',
        'publicSha256':digest(),'errors':[],'unexpectedRequests':[]}
try:
 with sync_playwright() as p:
  options={'headless':True,'args':['--no-sandbox','--disable-dev-shm-usage']}
  binary=os.environ.get('CHROMIUM_EXECUTABLE') or shutil.which('chromium') or shutil.which('chromium-browser')
  if binary:options['executable_path']=binary
  browser=p.chromium.launch(**options)
  report['browser']=browser.version
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
  page=context.new_page();page.set_default_timeout(15000)
  page.on('pageerror',lambda error:report['errors'].append(str(error)))
  page.goto(origin+'/write/');expect(page.locator('#desk-status')).to_contain_text('ready')
  report['parity']=page.evaluate(r"""async()=>{
    const {prepareExportPreview,renderExportPreview}=await import('/export-preview.js');
    const {createExportPreviewRenderer}=await import('/export-preview-reuse.js');
    const target=document.createElement('div'), oracle=document.createElement('div');
    document.body.append(target);
    let renders=0, comparisons=0;
    const ui=createExportPreviewRenderer(target,(to,model)=>{renders++;renderExportPreview(to,model);});
    const assert=(value,message)=>{if(!value)throw Error(message);};
    const compare=(draft,options)=>{
      const model=prepareExportPreview(draft,options),snapshot=JSON.stringify(model);
      ui.render(model);renderExportPreview(oracle,model);
      assert(target.isEqualNode(oracle),'Incremental preview differs from full renderer');
      assert(JSON.stringify(model)===snapshot,'Renderer changed prepared source');
      assert(!target.querySelector('img,script,iframe,object'),'Preview loaded executable/resource content');
      comparisons++;
    };
    const bodies=[
      'Simple source.', 'Same.\n\nSame.\n\nSame.',
      '# Heading\r\n\r\n日本語 😀 café.\r\n\r\n[Link](https://example.test/a)',
      'One **bold** and *italic* with ~~old~~ and `code`.\n\n[Unsafe](javascript:alert(1))',
      '1. One\n  - Nested\n2. Two\n\n> Quoted writing.',
      '| A | B |\n| --- | ---: |\n| Left | Right |',
      '| A | B |\n| --- | --- |\n| One | Two | EXTRA |',
      '~~~html\n<script>literal()</script>\n~~~\n\n<div>Literal source</div>',
      'Title\n===\n\nA paragraph.\n\n---\n\n## Later',
      '![Visible](https://example.test/a.png)\n\n![](https://example.test/b.png)',
      '## Ends\n\n[Word image 2]\n\n[Reference][id]\n\n[id]: https://example.test/'
    ];
    const options=[{destination:'wordpress'},{destination:'wordpress',includeLinkedImages:true},
      {destination:'word'},{destination:'word',includeTitle:true},{destination:'html'},
      {destination:'html',includeTitle:true},{destination:'markdown'},{destination:'markdown',includeTitle:true}];
    for(const option of options)for(const body of bodies){
      for(const source of [body,body+'\n\nAdded paragraph.','Inserted.\n\n'+body,body])compare({title:'Fictional title',body:source},option);
    }
    const base={title:'',body:'[Kept link](https://example.test/)\n\nMiddle.\n\nTail.'};
    compare(base,{destination:'wordpress'});
    const nodes=[...target.childNodes],link=target.querySelector('a');link.focus();
    const count=renders;
    compare({...base,body:base.body+' changed'},{destination:'wordpress'});
    assert(renders===count+1,'Unchanged content was re-rendered');
    assert(target.childNodes[0]===nodes[0]&&target.childNodes[1]===nodes[1],'Unchanged prefix replaced');
    assert(target.lastChild!==nodes[2],'Changed tail retained stale node');
    assert(document.activeElement===link,'Unrelated edit lost focused link');
    const first=target.firstChild;ui.clear();assert(!target.childNodes.length,'Clear retained output');
    compare(base,{destination:'wordpress'});assert(target.firstChild!==first,'Clear retained old entry');
    target.replaceChildren(document.createTextNode('Discarded foreign content'));
    compare(base,{destination:'wordpress'});
    const longBody=Array.from({length:1150},(_,i)=>'Fictional preview paragraph with identifier '+i+'.').join('\n\n');
    compare({title:'',body:longBody},{destination:'html'});
    const longNodes=[...target.childNodes],before=renders;
    compare({title:'',body:longBody+'x'},{destination:'html'});
    assert(renders===before+1,'Near-limit append rebuilt more than one block');
    assert(longNodes.slice(0,-1).every((node,i)=>node===target.childNodes[i]),'Near-limit unchanged nodes lost');
    ui.clear();target.remove();
    return {result:'PASS',comparisons,focusedLinkPreserved:true,nearLimitBlocks:longNodes.length,characters:longBody.length,appendRenderedBlocks:1,clearPurgesEntries:true,externalRootReplacement:true};
  }""")
  body='\n\n'.join('Fictional native paragraph '+str(i)+'.' for i in range(900))
  page.fill('#title','Fictional native preview');page.fill('#body',body)
  page.evaluate("""()=>{const panel=document.getElementById('export-content-panel');panel.open=true;for(let p=panel.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;}""")
  expect(page.locator('#export-content-preview > p')).to_have_count(900)
  page.evaluate("window.previewOldNodes=[...document.getElementById('export-content-preview').childNodes]")
  page.check('#reviewed');page.locator('#body').focus();page.keyboard.press('Control+End');page.keyboard.insert_text('x')
  assert not page.locator('#reviewed').is_checked()
  assert page.locator('#body').input_value()==body+'x'
  report['nativeInput']=page.evaluate("""async()=>{
    const target=document.getElementById('export-content-preview'),old=window.previewOldNodes;
    const kept=old.filter((node,i)=>target.childNodes[i]===node).length;
    if(kept!==899||target.childNodes.length!==900)throw Error('Native input replaced untouched nodes');
    const {prepareExportPreview,renderExportPreview}=await import('/export-preview.js');
    const oracle=document.createElement('div');renderExportPreview(oracle,prepareExportPreview({title:document.getElementById('title').value,body:document.getElementById('body').value},{destination:'wordpress'}));
    if(target.innerHTML!==oracle.innerHTML)throw Error('Native controller preview differs from full renderer');
    return {result:'PASS',blocks:900,unchangedNodesKept:kept,changedNodes:1,exactMarkup:true,approvalCleared:true};
  }""")
  page.evaluate("document.getElementById('export-content-panel').open=false")
  expect(page.locator('#export-content-preview')).to_be_empty()
  page.evaluate("document.getElementById('export-content-panel').open=true")
  expect(page.locator('#export-content-preview > p')).to_have_count(900)
  assert page.evaluate("window.previewOldNodes.every(n=>!n.isConnected)")
  page.fill('#body','')
  expect(page.locator('#export-content-preview')).to_be_empty()
  report['closedReopenAndInvalidClear']=True
  report['layout']={}
  for width in [1440,390,320]:
   page.set_viewport_size({'width':width,'height':900})
   overflow=page.evaluate('document.documentElement.scrollWidth>innerWidth')
   report['layout'][str(width)]=overflow;assert not overflow
  context.close();browser.close()
 report['publicUnchanged']=digest()==report['publicSha256']
 assert report['publicUnchanged'] and not report['errors'] and not report['unexpectedRequests']
 report['result']='PASS'
except Exception as error:
 report['result']='FAIL';report['failure']=str(error);report['publicUnchanged']=digest()==report['publicSha256']
finally:
 output.write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
if report['result']!='PASS':raise SystemExit(1)
