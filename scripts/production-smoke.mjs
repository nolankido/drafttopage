// Manually invoked, read-only verification of fixed public application routes.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
export const PRODUCTION_ORIGIN = 'https://drafttopage.com';
export const PRODUCTION_PATHS = Object.freeze([
  '/release.json', '/word-to-wordpress/', '/google-docs-to-wordpress/',
  '/markdown-to-wordpress/', '/help/alpha-support/',
  '/preview-navigation.js', '/preview-render-queue.js'
]);
const validRelease = name => typeof name === 'string' && /^alpha-release-[a-z0-9-]{1,64}$/.test(name);
function validateHeaders(headers) {
  const csp=headers.get('content-security-policy') || '';
  const mime=headers.get('x-content-type-options') || '';
  for (const directive of ["script-src 'self'", "connect-src 'none'", "object-src 'none'", "frame-ancestors 'none'"]) {
    if (!csp.split(';').some(part=>part.trim()===directive)) throw new Error('Missing restrictive production CSP.');
  }
  if (mime.toLowerCase().trim() !== 'nosniff') throw new Error('Expected nosniff security header.');
}
export async function inspectProduction({ expectedRelease, fetcher = fetch } = {}) {
  if (!validRelease(expectedRelease)) throw new Error('Supply the exact locally built alpha release label.');
  const routes=[];
  for (const path of PRODUCTION_PATHS) {
    try {
      const response=await fetcher(PRODUCTION_ORIGIN+path,{
        method:'GET',redirect:'error',credentials:'omit',cache:'no-store',
        signal: AbortSignal.timeout(12_000)
      });
      if (!response?.ok || response.status !== 200) throw new Error('Non-200 production response.');
      validateHeaders(response.headers);
      const mime=response.headers.get('content-type') || '';
      const body=await response.text();
      if (body.length > 250000) throw new Error('Oversized public response.');
      if (path.endsWith('.js')) {
        if (!/javascript/.test(mime)) throw new Error('Incorrect JavaScript content type.');
        if (path.endsWith('preview-render-queue.js') && !body.includes('createPreviewRenderQueue'))
          throw new Error('Bounded preview asset is absent.');
      } else if (path.endsWith('.json')) {
        if (!/json/.test(mime)) throw new Error('Incorrect JSON content type.');
        let data;
        try { data=JSON.parse(body); } catch { throw new Error('Invalid public release JSON.'); }
        if (data.release !== expectedRelease || !Number.isInteger(data.publicPages) || data.publicPages < 10)
          throw new Error('Public release differs from current built source.');
      } else {
        if (!/text\/html/.test(mime)) throw new Error('Incorrect HTML content type.');
        if (!body.includes('data-release="'+expectedRelease+'"'))
          throw new Error('Public page release label differs from current built source.');
        if (!/<main\b/.test(body) || !/<h1\b/.test(body))
          throw new Error('Missing page structure.');
        if (path === '/help/alpha-support/' && !body.includes('alpha-diagnostic-converter'))
          throw new Error('Expected support route controls absent.');
      }
      routes.push({path,result:'PASS'});
    } catch {
      // Never echo provider/network error messages, which may contain secrets.
      routes.push({path,result:'FAIL'});
    }
  }
  const result=routes.every(row=>row.result==='PASS')?'PASS':'FAIL';
  return {format:'drafttopage-production-smoke',version:1,result,expectedRelease,
    scope:'Public routes and security headers only; not a signed deployment, browser journey or hosted WordPress test.',routes};
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const expected=JSON.parse(readFileSync(resolve('public/release.json'),'utf8')).release;
    const result=await inspectProduction({expectedRelease:expected});
    mkdirSync('test-results',{recursive:true});
    writeFileSync('test-results/production-smoke.json',JSON.stringify(result,null,2)+'\n');
    console.log('Public production smoke: '+result.result+'. '+result.routes.filter(x=>x.result==='PASS').length+'/'+result.routes.length+' routes passed.');
    if(result.result!=='PASS')process.exitCode=1;
  } catch {
    console.error('Production smoke unavailable or failed. Build the local public files first; no remote changes were made.');
    process.exitCode=1;
  }
}
