// Manually invoked, read-only verification of fixed public application routes.
import { readFileSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
export const PRODUCTION_ORIGIN = 'https://drafttopage.com';
export const PRODUCTION_PATHS = Object.freeze([
  '/release.json', '/word-to-wordpress/', '/google-docs-to-wordpress/',
  '/markdown-to-wordpress/', '/help/alpha-support/',
  '/preview-navigation.js', '/preview-render-queue.js'
]);
const validRelease = name => typeof name === 'string' && /^alpha-release-[a-z0-9-]{1,64}$/.test(name);
export const PRODUCTION_WORKSPACES = Object.freeze({
  '/word-to-wordpress/': 'word-to-wordpress',
  '/google-docs-to-wordpress/': 'google-docs',
  '/markdown-to-wordpress/': 'wordpress'
});
// A first CSP directive wins in browsers. Checking for a later, safe duplicate
// would certify an unsafe effective policy; reject duplicates of ANY directive.
export function validateProductionHeaders(headers) {
  const csp=headers.get('content-security-policy') || '';
  const mime=headers.get('x-content-type-options') || '';
  const found=new Map();
  for(const fragment of csp.split(';')){
    const token=fragment.trim();
    if(!token) continue;
    const match=/^([a-z][a-z0-9-]*)(?:\s+(.+))?$/i.exec(token);
    if(!match) throw new Error('Invalid production CSP directive.');
    const name=match[1].toLowerCase();
    if(found.has(name)) throw new Error('Duplicate CSP directive.');
    found.set(name,(match[2]||'').trim().replace(/\s+/g,' '));
  }
  for(const [name,value] of Object.entries({
    'script-src':"'self'", 'connect-src':"'none'",
    'object-src':"'none'", 'frame-ancestors':"'none'"
  })){
    if(found.get(name)!==value) throw new Error('Expected restrictive production CSP.');
  }
  if(mime.toLowerCase().trim()!=='nosniff') throw new Error('Expected nosniff security header.');
}
export function productionMediaType(value) {
  return String(value||'').split(';',1)[0].trim().toLowerCase();
}
const JAVASCRIPT_MEDIA_TYPES=new Set([
  'text/javascript','application/javascript','text/ecmascript','application/ecmascript'
]);
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
      validateProductionHeaders(response.headers);
      const mime=productionMediaType(response.headers.get('content-type'));
      const body=await response.text();
      if (body.length > 250000) throw new Error('Oversized public response.');
      if (path.endsWith('.js')) {
        if (!JAVASCRIPT_MEDIA_TYPES.has(mime)) throw new Error('Incorrect JavaScript content type.');
        if (path.endsWith('preview-render-queue.js') && !/export\s+function\s+createPreviewRenderQueue\s*\(/.test(body))
          throw new Error('Bounded preview export is absent.');
        if (path.endsWith('preview-navigation.js') && !/export\s+function\s+installPreviewNavigation\s*\(/.test(body))
          throw new Error('Preview navigation export is absent.');
      } else if (path.endsWith('.json')) {
        if (mime!=='application/json') throw new Error('Incorrect JSON content type.');
        let data;
        try { data=JSON.parse(body); } catch { throw new Error('Invalid public release JSON.'); }
        if (data.release !== expectedRelease || !Number.isInteger(data.publicPages) || data.publicPages < 10)
          throw new Error('Public release differs from current built source.');
      } else {
        if (mime!=='text/html') throw new Error('Incorrect HTML content type.');
        if (!body.includes('data-release="'+expectedRelease+'"'))
          throw new Error('Public page release label differs from current built source.');
        if (!/<main\b/.test(body) || !/<h1\b/.test(body))
          throw new Error('Missing page structure.');
        if (path === '/help/alpha-support/' && !body.includes('id="alpha-diagnostic-converter"'))
          throw new Error('Expected support route controls absent.');
        const workspace=PRODUCTION_WORKSPACES[path];
        if(workspace && (!new RegExp('<header\\b[^>]*\\bdata-workspace="'+workspace+'"').test(body) ||
            !body.includes('id="body"') ||
            (path==='/word-to-wordpress/' && !body.includes('id="import-file"')) ||
            (path==='/google-docs-to-wordpress/' && !body.includes('id="import-text"'))))
          throw new Error('Wrong converter was served for this public route.');
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
  const destination=resolve('test-results/production-smoke.json');
  try {
    mkdirSync(resolve('test-results'),{recursive:true});
    // Invalidate last invocation BEFORE parsing local build metadata or trying
    // the network. A failed preflight must never leave an old PASS on disk.
    rmSync(destination,{force:true});
    const expected=JSON.parse(readFileSync(resolve('public/release.json'),'utf8')).release;
    const result=await inspectProduction({expectedRelease:expected});
    writeFileSync(destination,JSON.stringify(result,null,2)+'\n');
    console.log('Public production smoke: '+result.result+'. '+result.routes.filter(x=>x.result==='PASS').length+'/'+result.routes.length+' routes passed.');
    if(result.result!=='PASS') process.exitCode=1;
  } catch {
    writeFileSync(destination,JSON.stringify({
      format:'drafttopage-production-smoke',version:1,result:'FAIL',
      scope:'Preflight failed. No successful production observation is claimed.',routes:[]
    },null,2)+'\n');
    console.error('Production smoke unavailable or failed. Build the local public files first; no remote changes were made.');
    process.exitCode=1;
  }
}
