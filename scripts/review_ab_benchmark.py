#!/usr/bin/env python3
"""Offline ABBA browser timing of the exact three public modules changed by PR 116."""
import argparse, hashlib, json, os, shutil, statistics, subprocess, sys, tempfile
from pathlib import Path

BASE = "4338b5e2629c7764a8382cfe52fefaf8db27b08c"
AFTER = "642affa77efbe46f5158341f15816d1c0b5f4512"
BLOBS = {
 "draft-review.js": ("f9fb7ec6cc3f613e2a3a938da115f5f913dbdf80", "1a2a58f29c4cfa59b05c2c34934c3e8924691f48"),
 "export-review.js": ("8d72c3b37e81b2039547a236baa49205ae3247bc", "e3f77ee8eba5201f1c1751fedd7c890ae453ff02"),
 "wordpress-images.js": ("d18a3f96fb695eacd7f2c879c2ebc5fc036635fb", "a52fb8230c2a0dc7f2601801a3db6b087c9d43f7")
}
CASES = ("ordinary:wordpress:open", "rich:wordpress:open",
         "rich:word:open", "rich:html:open", "rich:markdown:open")

def sha_blob(data):
 return hashlib.sha1(b"blob " + str(len(data)).encode() + b"\0" + data).hexdigest()

def digest(public):
 h=hashlib.sha256()
 for f in sorted(p for p in public.rglob("*") if p.is_file()):
  h.update(str(f.relative_to(public.parent)).encode()+b"\0"+f.read_bytes()+b"\0")
 return h.hexdigest()

def persist(path, payload):
 path.parent.mkdir(parents=True, exist_ok=True)
 path.write_text(json.dumps(payload, indent=2, sort_keys=True)+"\n", encoding="utf-8")

def main():
 parser=argparse.ArgumentParser(description=__doc__)
 parser.add_argument("--samples", type=int, default=31)
 parser.add_argument("--cases", default=",".join(CASES))
 parser.add_argument("--output", default="test-results/review-ab-performance.json")
 args=parser.parse_args()
 selected=[x.strip() for x in args.cases.split(",")]
 if not 3<=args.samples<=100 or not selected or len(set(selected))!=len(selected) or any(x not in CASES for x in selected):
  parser.error("Choose 3-100 samples and distinct supported cases")
 root=Path.cwd().resolve()
 if json.loads((root/"package.json").read_text(encoding="utf-8"))["name"]!="drafttopage":
  parser.error("Run from the repository root")
 public=root/"public"; report_path=(root/args.output).resolve()
 if report_path.is_relative_to(public.resolve()):
  parser.error("Benchmark report cannot be written to deployed public assets")
 report_path.unlink(missing_ok=True)
 for name, (old_sha,new_sha) in BLOBS.items():
  old=root/"tests"/"fixtures"/"review-ab-before-116"/name
  new=public/name
  if not old.is_file() or sha_blob(old.read_bytes())!=old_sha:
   raise RuntimeError("Baseline source mismatch: "+name)
  if not new.is_file() or sha_blob(new.read_bytes())!=new_sha:
   raise RuntimeError("Candidate changed since PR 116; define a new comparison: "+name)
 initial=digest(public)
 head=subprocess.check_output(["git","rev-parse","HEAD"],cwd=root,text=True).strip()
 gitdir=subprocess.check_output(["git","rev-parse","--absolute-git-dir"],cwd=root,text=True).strip()
 report={"result":"RUNNING","scope":"Fictional near-limit Markdown in local Chromium, not real-user INP",
         "method":"serial ABBA order per case; only three pinned modules differ",
         "runnerCommit":head,"baselineCommit":BASE,"candidateCommit":AFTER,
         "moduleBlobs":BLOBS,"sampleCount":args.samples,"cases":selected,
         "publicBeforeSha256":initial,"publicUnchanged":None,"runs":[],"summary":[],"errors":[]}
 persist(report_path,report)
 try:
  with tempfile.TemporaryDirectory(prefix="dtp-ab-review-") as directory:
   temp=Path(directory)
   for version in ("before","after"):
    folder=temp/version/"public"
    shutil.copytree(public,folder)
    if version=="before":
     for name in BLOBS:
      shutil.copyfile(root/"tests"/"fixtures"/"review-ab-before-116"/name,folder/name)
   env=os.environ.copy()
   env.update({"GIT_DIR":gitdir,"GIT_WORK_TREE":str(root)})
   for case in selected:
    for order,version in enumerate(("before","after","after","before"),start=1):
     workspace=temp/version
     output=workspace/"test-results"/("run-%d.json"%order)
     command=[sys.executable,str(root/"scripts"/"editing_benchmark.py"),
              "--samples",str(args.samples),"--only",case,"--output",str(output)]
     result=subprocess.run(command,cwd=workspace,env=env,text=True,
                           stdout=subprocess.PIPE,stderr=subprocess.STDOUT,timeout=300)
     if result.returncode:
      raise RuntimeError("%s %s run %d failed: %s"%(case,version,order,result.stdout[-1800:]))
     evidence=json.loads(output.read_text(encoding="utf-8"))
     if evidence.get("result")!="PASS" or evidence.get("errors") or evidence.get("unexpectedRequests") or not evidence.get("publicUnchanged") or len(evidence.get("cases",[]))!=1:
      raise RuntimeError("Browser evidence invalid for "+case+" "+version)
     measured=evidence["cases"][0]
     if ":".join([measured["kind"],measured["destination"],measured["panels"]])!=case:
      raise RuntimeError("Unexpected benchmark case")
     record={"case":case,"version":version,"order":order,"browser":evidence["browser"],
             "characters":measured["characters"],"publicSha256":evidence["publicSha256"],
             "synchronousInputMs":measured["synchronousInputMs"],
             "inputToFrameMs":measured["inputToFrameMs"]}
     report["runs"].append(record); persist(report_path,report)
     print("ABBA",case,order,version,"median",record["synchronousInputMs"]["median"],
           "p95",record["synchronousInputMs"]["p95"],flush=True)
    rows=[row for row in report["runs"] if row["case"]==case]
    summary={"case":case}
    for metric in ("synchronousInputMs","inputToFrameMs"):
     summary[metric]={}
     for version in ("before","after"):
      data=[row[metric] for row in rows if row["version"]==version]
      summary[metric][version]={"medianOfMedians":round(statistics.median(r["median"] for r in data),2),
           "p95Range":[min(r["p95"] for r in data),max(r["p95"] for r in data)],
           "worst":max(r["max"] for r in data)}
    report["summary"].append(summary); persist(report_path,report)
  report["publicUnchanged"]=digest(public)==initial
  if not report["publicUnchanged"] or len(report["runs"])!=4*len(selected):
   raise RuntimeError("Source integrity or run-count failure")
  report["result"]="PASS"
 except Exception as error:
  report["result"]="FAIL";report["errors"].append(str(error))
  report["publicUnchanged"]=digest(public)==initial
 persist(report_path,report)
 print("ABBA benchmark: "+report["result"]+" (%d complete runs)"%len(report["runs"]),flush=True)
 if report["result"]!="PASS":
  print(report["errors"],file=sys.stderr)
 return 0 if report["result"]=="PASS" else 1

if __name__=="__main__":
 sys.exit(main())
