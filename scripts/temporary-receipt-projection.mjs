// Temporary read-only projection of immutable synthetic evidence. NEVER MERGE.
import { mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
const source='https://8ea165b7-drafttopage.nolankido.workers.dev/_dtp_kit_manifest_probe_20261016.json';
const escape=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const page=(name,value)=>{
 const title=typeof value==='string'?value:JSON.stringify(value);
 const dir='public/receipt/'+name;mkdirSync(dir,{recursive:true});
 writeFileSync(dir+'/index.html','<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex,nofollow"><title>'+escape(title)+'</title></head><body><h1>Synthetic validation receipt</h1><pre>'+escape(title)+'</pre></body></html>');
};
try{
 const response=await fetch(source,{signal:AbortSignal.timeout(30000),redirect:'error'});
 if(!response.ok)throw Error('Receipt HTTP '+response.status);
 const raw=Buffer.from(await response.arrayBuffer());if(raw.length>500000)throw Error('Unexpected receipt size');
 const report=JSON.parse(raw.toString('utf8'));
 if(!['PASS','FAIL'].includes(report.result))throw Error('No explicit result');
 if(report.result==='PASS'&&(report.featureHead!=='9e9829fbe69eb74903d837279a2b6066f3f77465'||report.release?.head!=='0a5b848af421d8062fa5ef6836457351da696d14'))throw Error('Identity mismatch');
 const zipped=gzipSync(raw,{level:9}).toString('base64'),chunks=[];
 for(let i=0;i<zipped.length;i+=600)chunks.push(zipped.slice(i,i+600));
 const sha256=createHash('sha256').update(raw).digest('hex');
 page('index',{result:report.result,error:report.error||null,bytes:raw.length,sha256,compressedChunks:chunks.length,feature:report.featureHead,diagnostic:report.release?.head});
 page('browser',report.browser);page('wordpress',report.wordpress);page('release',report.release);
 for(const [index,value] of (report.stages||[]).entries())page('stage-'+index,value);
 for(const [index,value] of (report.study?.summary||[]).entries())page('summary-'+index,value);
 for(const [index,value] of (report.study?.mechanism||[]).entries()){
  page('mechanism-'+index,{version:value.version,result:value.result,nativeEdits:value.nativeEdits,typingCompilerCalls:value.typingCompilerCalls,liveFindingKept:value.liveFindingKept,invalidTitleClearsFiles:value.invalidTitleClearsFiles,errors:value.errors,unexpectedRequests:value.unexpectedRequests});
  for(const [kind,result] of Object.entries(value.downloads||{}))page('download-'+index+'-'+kind,result);
 }
 chunks.forEach((chunk,index)=>page('part-'+index,'GZIP_BASE64 '+index+' '+chunk));
 mkdirSync('public/receipt',{recursive:true});writeFileSync('public/receipt/original.json',raw);
 console.log('Receipt projection '+report.result+' '+sha256+' '+chunks.length+' parts.');
}catch(error){page('index',{result:'PROJECTION_FAILED',error:String(error.message||error)});console.error(error.message);}
