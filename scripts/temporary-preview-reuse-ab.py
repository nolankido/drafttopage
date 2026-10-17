"""Temporary isolated unprofiled ABBA typing comparison; never merge."""
import hashlib,json,os,shutil,statistics,subprocess,sys,tempfile
from pathlib import Path
ROOT=Path.cwd().resolve()
BEFORE='a933b50c2dd93547ffb45909c8d840fc4de5ff98'
AFTER='f6b0f9a564708d2c2ea33cec9efa35bbf6a037b1'
BASE='3f3c0f9f0318c35b2858b6f24603d0b9a5d631a5'
FEATURE='2f1dba61ef781f0b4e7444d2fa07a1b98788df1f'
CASES=['rich:wordpress:open','rich:word:open','rich:html:open','rich:wordpress:closed','rich:markdown:closed']
def blob(data):return hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()
def digest(public):
 h=hashlib.sha256()
 for file in sorted(p for p in public.rglob('*') if p.is_file()):h.update(str(file.relative_to(public.parent)).encode()+b'\0'+file.read_bytes()+b'\0')
 return h.hexdigest()
def main():
 out=ROOT/'test-results/preview-reuse-ab.json';out.parent.mkdir(exist_ok=True);out.unlink(missing_ok=True)
 report={'result':'RUNNING','scope':'Synthetic Chromium, unique near-limit articles; no physical-device or field-INP result',
 'baselineCommit':BASE,'featureCommit':FEATURE,'beforeBlob':BEFORE,'afterBlob':AFTER,'samplesPerRun':31,'uniqueBlocks':True,
 'publicSha256':digest(ROOT/'public'),'publicUnchanged':None,'runs':[],'summary':[],'errors':[]}
 def save():out.write_text(json.dumps(report,indent=2)+'\n')
 save()
 try:
  before=ROOT/'scripts/preview-baseline/export-preview-controls.js'
  assert blob(before.read_bytes())==BEFORE
  assert blob((ROOT/'public/export-preview-controls.js').read_bytes())==AFTER
  source=(ROOT/'scripts/editing_benchmark.py').read_text()
  guard="if kind=='rich' and destination=='markdown' and panels=='closed':"
  assert source.count(guard)==1
  harness=source.replace(guard,'if False:')
  marker="report['cases'].append(entry);print(json.dumps(entry),flush=True)"
  assert harness.count(marker)==1
  harness=harness.replace(marker,"entry['rawSynchronousInputMs']=measures['sync'];entry['rawInputToFrameMs']=measures['frame'];"+marker)
  report['originalHarnessSha256']=hashlib.sha256(source.encode()).hexdigest()
  report['timingHarnessSha256']=hashlib.sha256(harness.encode()).hexdigest()
  with tempfile.TemporaryDirectory(prefix='dtp-preview-reuse-') as directory:
   temp=Path(directory);runner=temp/'benchmark.py';runner.write_text(harness)
   for version in ['before','after']:shutil.copytree(ROOT/'public',temp/version/'public')
   shutil.copyfile(before,temp/'before/public/export-preview-controls.js')
   env=os.environ.copy();env['GIT_DIR']=subprocess.check_output(['git','rev-parse','--absolute-git-dir'],cwd=ROOT,text=True).strip();env['GIT_WORK_TREE']=str(ROOT)
   for case in CASES:
    for order,version in enumerate(['before','after','after','before'],1):
     path=temp/version;output=path/'test-results'/('run-'+str(order)+'.json')
     command=[sys.executable,str(runner),'--samples','31','--unique-blocks','--only',case,'--output',str(output)]
     run=subprocess.run(command,cwd=path,env=env,text=True,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,timeout=300)
     if run.returncode:raise RuntimeError(case+' '+version+': '+run.stdout[-1800:])
     evidence=json.loads(output.read_text());assert evidence['result']=='PASS' and evidence['publicUnchanged'] and not evidence['errors'] and not evidence['unexpectedRequests'] and len(evidence['cases'])==1
     measured=evidence['cases'][0]
     assert ':'.join([measured['kind'],measured['destination'],measured['panels']])==case
     assert len(measured['rawSynchronousInputMs'])==31 and len(measured['rawInputToFrameMs'])==31 and measured['uniqueBlocks']
     report['runs'].append({'case':case,'version':version,'order':order,'browser':evidence['browser'],'assetSha256':evidence['publicSha256'],**measured});save()
     print('ABBA',case,version,order,measured['synchronousInputMs'],flush=True)
    rows=[r for r in report['runs'] if r['case']==case];summary={'case':case}
    for metric in ['synchronousInputMs','inputToFrameMs']:
     summary[metric]={}
     for version in ['before','after']:
      data=[row[metric] for row in rows if row['version']==version]
      summary[metric][version]={'medianOfMedians':round(statistics.median(r['median'] for r in data),2),'p95Range':[min(r['p95'] for r in data),max(r['p95'] for r in data)],'worst':max(r['max'] for r in data)}
    report['summary'].append(summary);save()
  report['publicUnchanged']=digest(ROOT/'public')==report['publicSha256']
  assert report['publicUnchanged'] and len(report['runs'])==20
  report['result']='PASS'
 except Exception as error:
  report['result']='FAIL';report['errors'].append(str(error));report['publicUnchanged']=digest(ROOT/'public')==report['publicSha256']
 save();print('Preview reuse ABBA:',report['result'],flush=True)
 if report['result']!='PASS':print(report['errors'],file=sys.stderr)
 return 0 if report['result']=='PASS' else 1
if __name__=='__main__':sys.exit(main())
