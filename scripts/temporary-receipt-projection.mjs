// Read the existing immutable synthetic receipt. No test rerun or production write.
// The extractor currently drops JSON body text; give it short static title fields.
// NEVER MERGE THIS FILE OR ITS GENERATED RECEIPT PAGES.
import { mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
const origin='https://8ea165b7-drafttopage.nolankido.workers.dev';
const source=origin+'/_dtp_kit_manifest_probe_20261016.json';
const escape=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const page=(name,value)=>{
 const title=typeof value==='string'?value:JSON.stringify(value);
 const dir='public/receipt/'+name;mkdirSync(dir,{recursive:true});
 writeFileSync(dir+'/index.html','<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex,nofollow"><title>'+escape(title)+'</title></head><body><h1>Synthetic validation receipt</h1><p>Read-only projection of an existing immutable test receipt, not new validation.</p><pre>'+escape(title)+'</pre></body></html>');
};
try{
 const response=await fetch(source,{signal:AbortSignal.timeout(30000),redirect:'error'});
 if(!response.ok)throw Error('Receipt HTTP '+response.status);
 const raw=Buffer.from(await response.arrayBuffer());if(raw.length>500000)throw Error('Unexpected receipt size');
 const report=JSON.parse(raw.toString('utf8'));
 if(!['PASS','FAIL'].includes(report.result))throw Error('No explicit receipt result');
 if(report.result==='PASS'&&(report.featureHead!=='9e9829fbe69eb74903d837279a2b6066f3f77465'||report.release?.head!=='0a5b848af421d8062fa5ef6836457351da696d14'))throw Error('Source identity mismatch');
 const zipped=gzipSync(raw,{level:9}).toString('base64'),chunks=[];
 for(let i=0;i<zipped.length;i+=3000)chunks.push(zipped.slice(i,i+3000));
 const sha256=createHash('sha256').update(raw).digest('hex');
 page('index',{source,result:report.result,error:report.error||null,bytes:raw.length,sha256,compressedChunks:chunks.length,feature:report.featureHead,diagnostic:report.release?.head});
 page('acceptance',{result:report.result,featureHead:report.featureHead,release:report.release,browser:report.browser,wordpress:report.wordpress,stages:report.stages,error:report.error||null});
 page('summary',{result:report.study?.result,publicUnchanged:report.study?.publicUnchanged,errors:report.study?.errors,summary:report.study?.summary,partial:report.partialStudy});
 page('mechanism',report.study?.mechanism||report.partialStudy?.mechanism||[]);
 page('profiles',report.study?.profiles||report.partialStudy?.profiles||[]);
 chunks.forEach((chunk,index)=>page('chunk-'+index,'GZIP_BASE64 '+index+' '+chunk));
 mkdirSync('public/receipt',{recursive:true});writeFileSync('public/receipt/original.json',raw);
 console.log('Read-only receipt projection '+report.result+'; SHA256 '+sha256+'; '+chunks.length+' compressed chunks.');
}catch(error){page('index',{result:'PROJECTION_FAILED',error:String(error.message||error)});console.error('Receipt projection failed: '+error.message);}
