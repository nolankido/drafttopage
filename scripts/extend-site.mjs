import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { writingPages } from './writing-pages.mjs';
export const RELEASE = 'local-desk-20261008';
const esc = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
async function htmlFiles(root) {
  return (await Promise.all((await readdir(root, { withFileTypes: true })).map(e => e.isDirectory() ? htmlFiles(join(root, e.name)) : e.name.endsWith('.html') ? [join(root, e.name)] : []))).flat();
}
export async function extendSite(root = 'public') {
  // Share the actual generated navigation/footer rather than fork the site's visual shell.
  const home = await readFile(join(root, 'index.html'), 'utf8');
  const header = home.match(/<header class="site-header wrap">[\s\S]*?<\/header>/)?.[0];
  const footer = home.match(/<footer class="site-footer wrap">[\s\S]*?<\/footer>/)?.[0];
  assert.ok(header && footer, 'Expected the shared content shell; update the build deliberately if it changes.');
  for (const page of writingPages) {
    const directory = join(root, page.route.slice(1)); await mkdir(directory, { recursive: true });
    const html = `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(page.title)} | Draft to Page</title><meta name="description" content="${esc(page.description)}"><link rel="canonical" href="https://drafttopage.com${page.route}"><meta property="og:title" content="${esc(page.title)} | Draft to Page"><meta property="og:description" content="${esc(page.description)}"><meta property="og:type" content="website"><meta property="og:url" content="https://drafttopage.com${page.route}"><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/pilot.css"><link rel="stylesheet" href="/content.css"><link rel="stylesheet" href="/desk.css"></head><body><a class="skip-link" href="#main">Skip to content</a>${header}<main id="main" class="wrap content-main wide desk-main" data-release="${RELEASE}">${page.body}</main>${footer}${page.script ? `<script type="module" src="${page.script}"></script>` : ''}</body></html>\n`;
    await writeFile(join(directory, 'index.html'), html);
  }
  const files = await htmlFiles(root);
  for (const path of files) {
    let html = await readFile(path, 'utf8');
    if (!html.includes('href="/desk.css"')) html = html.replace('<link rel="stylesheet" href="/content.css">', '<link rel="stylesheet" href="/content.css"><link rel="stylesheet" href="/desk.css">');
    html = html.replace(/data-release="[^"]+"/, `data-release="${RELEASE}"`);
    if (!html.includes('data-local-desk-nav')) {
      html = html.replace('<nav aria-label="Main navigation">', '<nav aria-label="Main navigation"><a href="/write/" data-local-desk-nav>Write</a>');
    }
    if (path === join(root, 'write', 'index.html')) html = html.replace('href="/write/" data-local-desk-nav', 'href="/write/" data-local-desk-nav aria-current="page"');
    if (path === join(root, 'index.html') && !html.includes('id="writing-options"')) {
      html = html.replace('<section class="section wrap status"', '<section class="section wrap writing-options" id="writing-options"><p class="eyebrow">Start without an invitation</p><h2>Already have a draft? Finish it here.</h2><p>The local writing desk lets you edit your own article, preview basic formatting, save unfinished work to a private file, and export Markdown. No AI generation or account is involved.</p><div class="actions"><a class="button" href="/write/">Open the local writing desk</a><a href="/help/local-workspace/">Save and restore your writing</a></div></section><section class="section wrap status"');
    }
    if (path === join(root, 'privacy', 'index.html') && !html.includes('id="local-files"')) {
      html = html.replace('</main>', '<section id="local-files"><h2>Local writing and private workspace files</h2><p>The public writing desk does not upload writing or call AI. Edits remain in the open page; application code adds no persistent browser storage or autosave. The local desk and private pilot support an explicit private JSON backup containing notes, audience, purpose, article fields, and review questions. Application sign-in fields and approvals are excluded. A backup is unencrypted, can contain private material, and must be kept out of public repositories.</p><p>Restoring a backup reads a user-selected file locally and validates it before replacing writing. It clears approval and pilot AI consent. It does not upload the file or call the provider. Your device may sync downloaded files through its own services; that is outside this application. Check the saved file before leaving the workspace.</p></section></main>');
    }
    if (path === join(root, 'help', 'index.html') && !html.includes('id="local-help"')) {
      html = html.replace('</main>', '<section id="local-help"><h2>Work without AI, or resume a saved draft</h2><p><a href="/write/">Use the local writing desk</a> for your own article. The desk and pilot now offer explicit private workspace backups, not autosave or server history. <a href="/help/local-workspace/">Read the save-and-restore guide</a> before using a backup file.</p></section></main>');
    }
    html = html.replaceAll('Public examples, templates, and the sample editor need no account.', 'Public examples, templates, the sample editor, and the local writing desk need no account.');
    html = html.replaceAll('There is no recovery service or saved history. Keep original notes in your own document and download the reviewed article before leaving. Browser navigation can discard unsaved work.', 'There is no server recovery service or saved history. You can restore a private workspace backup that you deliberately downloaded earlier. Without a saved file or your own original document, discarded work may be unrecoverable.');
    await writeFile(path, html);
  }
  const sitemapPath = join(root, 'sitemap.xml');
  let map = await readFile(sitemapPath, 'utf8');
  for (const page of writingPages) if (!map.includes(`https://drafttopage.com${page.route}</loc>`)) map = map.replace('</urlset>', `  <url><loc>https://drafttopage.com${page.route}</loc></url>\n</urlset>`);
  await writeFile(sitemapPath, map);
  const publicPages = (map.match(/<url>/g) || []).length;
  await writeFile(join(root, 'release.json'), JSON.stringify({ release: RELEASE, publicPages, exampleType: 'illustrative', publicAIGeneration: false, localWritingDesk: true, workspaceBackups: true }) + '\n');
  console.log(`Local writing desk build complete: ${publicPages} indexable pages, plus 404. No AI calls or credentials.`);
}
