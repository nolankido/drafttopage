#!/usr/bin/env python3
"""Temporary isolated ABBA timing, never merge: exactly one module changed."""
import hashlib,json,os,shutil,statistics,subprocess,sys,tempfile
from pathlib import Path
ROOT=Path.cwd().resolve()
CASES=["rich:wordpress:closed","rich:wordpress:open","rich:markdown:closed","rich:html:open"]
BEFORE_SHA="5104563466d3e73f42c059f3302b792754416530"
AFTER_SHA="b2300ecfc32f625b1fe519a94a12a232522b9632"
BASE_COMMIT="50b8e04eefd06a032557d5ac1c28c5c079bcdf66"
FEATURE_COMMIT="c3d0c8b68f87e26d144bbe0fad46e0efa12098e7"
def blob(data):
 return hashlib.sha1(b"blob "+str(len(data)).encode()+b"\0"+data).hexdigest()
def public_digest(path):
 h=hashlib.sha256()
 for f in sorted(p for p in path.rglob("*") if p.is_file()):
  h.update(str(f.relative_to(path.parent)).encode()+b"\0"+f.read_bytes()+b"\0")
 return h.hexdigest()
def stats(items,key):
 return {"medianOfMedians":round(statistics.median(x[key]["median"] for x in items),2),
         "p95Range":[min(x[key]["p95"] for x in items),max(x[key]["p95"] for x in items)],
         "worst":max(x[key]["max"] for x in items)}
def main():
 baseline=ROOT/"scripts"/"temporary-export-before.js"
 current=ROOT/"public"/"export-controls.js"
 if blob(baseline.read_bytes())!=BEFORE_SHA or blob(current.read_bytes())!=AFTER_SHA:
  raise RuntimeError("Source Git blob mismatch. Refuse unpinned comparison.")
 before_public=public_digest(ROOT/"public")
 report={"result":"RUNNING","scope":"Synthetic near-limit browser only; no real device, user or field INP",
         "baseCommit":BASE_COMMIT,"featureCommit":FEATURE_COMMIT,
         "beforeBlob":BEFORE_SHA,"afterBlob":AFTER_SHA,"browser":None,
         "publicBeforeSha256":before_public,"publicUnchanged":None,
         "samples":31,"cases":CASES,"runs":[],"summary":[],"errors":[]}
 out=ROOT/"test-results"/"lazy-export-ab.json";out.parent.mkdir(exist_ok=True)
 def save():out.write_text(json.dumps(report,indent=2)+"\n",encoding="utf-8")
 save()
 try:
  with tempfile.TemporaryDirectory(prefix="dtp-export-typing-ab-") as path:
   tmp=Path(path)
   for version in ("before","after"):
    shutil.copytree(ROOT/"public",tmp/version/"public")
   shutil.copyfile(baseline,tmp/"before"/"public"/"export-controls.js")
   env=os.environ.copy()
   env["GIT_DIR"]=subprocess.check_output(["git","rev-parse","--absolute-git-dir"],text=True,cwd=ROOT).strip()
   env["GIT_WORK_TREE"]=str(ROOT)
   for case in CASES:
    for index,version in enumerate(("before","after","after","before"),1):
     work=tmp/version
     output=work/"test-results"/("run-"+str(index)+".json")
     cmd=[sys.executable,str(ROOT/"scripts"/"editing_benchmark.py"),"--samples","31",
          "--only",case,"--output",str(output)]
     completed=subprocess.run(cmd,cwd=work,env=env,stdout=subprocess.PIPE,
                              stderr=subprocess.STDOUT,text=True,timeout=300)
     if completed.returncode:
      raise RuntimeError(case+" "+version+" run "+str(index)+": "+completed.stdout[-1200:])
     evidence=json.loads(output.read_text(encoding="utf-8"))
     if evidence.get("result")!="PASS" or evidence.get("errors") or evidence.get("unexpectedRequests") or not evidence.get("publicUnchanged") or len(evidence.get("cases",[]))!=1:
      raise RuntimeError("Bad timing evidence: "+case+" "+version)
     row=evidence["cases"][0]
     if ":".join([row["kind"],row["destination"],row["panels"]])!=case:
      raise RuntimeError("Wrong case returned")
     item={"case":case,"version":version,"order":index,"browser":evidence["browser"],
           "sourceSha256":evidence["publicSha256"],
           "characters":row["characters"],"synchronousInputMs":row["synchronousInputMs"],
           "inputToFrameMs":row["inputToFrameMs"]}
     report["runs"].append(item);report["browser"]=evidence["browser"];save()
     print("ABBA",case,index,version,"median",item["synchronousInputMs"]["median"],"p95",item["synchronousInputMs"]["p95"],flush=True)
    rows=[r for r in report["runs"] if r["case"]==case]
    summary={"case":case}
    for metric in ("synchronousInputMs","inputToFrameMs"):
     summary[metric]={version:stats([r for r in rows if r["version"]==version],metric)
                      for version in ("before","after")}
    report["summary"].append(summary)
    save()
  report["publicUnchanged"]=public_digest(ROOT/"public")==before_public
  if len(report["runs"])!=4*len(CASES) or not report["publicUnchanged"]:
   raise RuntimeError("Incomplete controlled comparison or mutated source")
  report["result"]="PASS"
 except Exception as exc:
  report["result"]="FAIL";report["errors"].append(str(exc))
  report["publicUnchanged"]=public_digest(ROOT/"public")==before_public
 save()
 print("Source-bound export ABBA: "+report["result"],flush=True)
 if report["result"]!="PASS":print(report["errors"],file=sys.stderr)
 return 0 if report["result"]=="PASS" else 1
if __name__=="__main__":sys.exit(main())
