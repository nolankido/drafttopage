// TEMPORARY read-only production asset check. Never merge or rerun acceptance here.
import { mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const expectedMerge='a905e971b0421bd03991bf93e651e42ba1388466';
const assets=[
 ['controller','export-preview-controls.js','f6b0f9a564708d2c2ea33cec9efa35bbf6a037b1'],
 ['helper','export-preview-reuse.js','ef8bb1ff7b5896045c4b844e61502a1923e345c0']
];
const escape=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const page=(name,value)=>{
 const text=JSON.stringify(value),dir='public/preview-reuse-live/'+name;
 mkdirSync(dir,{recursive:true});
 writeFileSync(dir+'/index.html','<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex,nofollow"><title>'+escape(text)+'</title></head><body><h1>Read-only production verification</h1><pre>'+escape(text)+'</pre></body></html>');
};
const records=[];
for(const [label,name,wanted] of assets){
 let record;
 try{
  const url='https://drafttopage.com/'+name;
  const response=await fetch(url,{signal:AbortSignal.timeout(20000),redirect:'error',headers:{'Cache-Control':'no-cache'}});
  const bytes=Buffer.from(await response.arrayBuffer());
  if(bytes.length>200000)throw Error('Unexpected asset size');
  const sha=createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex');
  record={url,status:response.status,bytes:bytes.length,gitBlob:sha,expectedGitBlob:wanted,result:response.ok&&sha===wanted?'PASS':'FAIL'};
 }catch(error){record={name,result:'FAIL',error:String(error.message||error)};}
 records.push(record);page(label,record);
}
const report={result:records.every(r=>r.result==='PASS')?'PASS':'FAIL',expectedMerge,observedAt:new Date().toISOString(),checkedAssets:records.length,scope:'Independent public HTTPS reads from a separate diagnostic build; not production interaction, field latency or new acceptance tests',assets:records};
page('index',{...report,assets:undefined});
writeFileSync('public/_dtp_preview_reuse_live_20261017.json',JSON.stringify(report,null,2)+'\n');
console.log('Read-only live asset verification '+report.result);
