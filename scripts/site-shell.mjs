export const RELEASE = 'alpha-release-turn9-20261017';
export const escapeHTML = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const converters = [['/word-to-wordpress/', 'Word to WordPress'], ['/word-to-markdown/', 'Word to Markdown'], ['/html-to-markdown/', 'HTML to Markdown'], ['/google-docs-to-wordpress/', 'Google Docs to WordPress'], ['/markdown-to-wordpress/', 'Markdown to WordPress'], ['/markdown-to-html/', 'Markdown to HTML'], ['/markdown-to-word/', 'Markdown to Word']];
const workspaceRoutes = new Set(['/write/', ...converters.map(([href]) => href)]);
const currentDestinations = [['wordpress', 'WordPress blocks'], ['markdown', 'Markdown article'], ['html', 'HTML source'], ['word', 'Word document']];
const sourceTabCue = '<span data-workspace-new-tab-cue hidden> (new tab)</span>';

// Annotate only authored page links at build time. Reading previews and other
// visitor-provided content never participate in workspace navigation.
function annotateWorkspaceLinks(body, route) {
  return body.replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi, (anchor, attributes, label) => {
    const href = attributes.match(/(?:^|\s)href\s*=\s*(["'])(.*?)\1/i)?.[2];
    if (!href || href.trim().startsWith('#') || /(?:^|\s)(?:download|data-workspace-source-link)(?:\s|=|$)/i.test(attributes)) return anchor;
    let destination;
    try { destination = new URL(href, 'https://drafttopage.com' + route); } catch { return anchor; }
    if (destination.origin !== 'https://drafttopage.com') return anchor;
    const alreadyNewTab = /\btarget\s*=\s*(["'])_blank\1/i.test(attributes);
    if (!workspaceRoutes.has(destination.pathname.replace(/\/?$/, '/'))) {
      if (destination.pathname !== '/' && !/^\/(?:help|getting-started|about|access|privacy|examples|templates|pilot)(?:\/|$)/.test(destination.pathname)) return anchor;
      if (alreadyNewTab) return anchor;
      const rel = attributes.match(/\srel\s*=\s*(["'])(.*?)\1/i)?.[2] || '';
      const relations = [...new Set([...rel.split(/\s+/).filter(Boolean), 'noopener'])].join(' ');
      const retained = attributes.replace(/\s(?:target|rel)\s*=\s*(["']).*?\1/gi, '');
      return '<a' + retained + ' target="_blank" rel="' + escapeHTML(relations) + '">' + label + (/\(new tab\)/i.test(label) ? '' : ' (new tab)') + '</a>';
    }
    const cue = alreadyNewTab ? (/\(new tab\)/i.test(label) ? '' : '<span data-workspace-new-tab-cue> (new tab)</span>') : sourceTabCue;
    return '<a' + attributes + ' data-workspace-source-link>' + label + cue + '</a>';
  });
}

export function renderPage({ route, title, description, body, script = '', wide = false, desk = false, converter = false }) {
  const keepWriting = desk || route === '/demo/';
  const navLink = ([href, label], { source = false, id = '' } = {}) => {
    const newTab = keepWriting && !source && href !== '/write/';
    return '<a href="' + href + '"' + (id ? ' id="' + id + '"' : '') + (route === href ? ' aria-current="page"' : '') + (desk && source ? ' data-workspace-source-link' : '') + (newTab ? ' target="_blank" rel="noopener"' : '') + '>' + label + (newTab ? ' (new tab)' : desk && source ? sourceTabCue : '') + '</a>';
  };
  const converterLinks = converters.map(link => navLink(link, { source: true })).join('');
  const converterMenu = desk ? '<div id="workspace-current-tools" role="group" aria-labelledby="workspace-current-label" hidden><h2 id="workspace-current-label" class="nav-tools-heading">Use this draft</h2>' + currentDestinations.map(([value, label]) => '<button type="button" class="secondary workspace-destination" data-current-destination="' + value + '" aria-controls="exports">' + label + '</button>').join('') + '</div><div id="workspace-converter-links" role="group" aria-labelledby="workspace-converter-label"><h2 id="workspace-converter-label" class="nav-tools-heading">Choose a converter</h2>' + converterLinks + '</div>' : converterLinks;
  const writingLink = navLink(['/write/', 'Writing desk'], { id: desk ? 'workspace-writing-link' : '' });
  const workspaceActions = desk ? '<button id="workspace-edit-current" type="button" class="secondary workspace-nav-action" aria-controls="draft" hidden>Edit current draft</button>' + writingLink + '<button id="workspace-save-current" type="button" class="secondary workspace-nav-action" aria-controls="browser-recovery-panel" hidden>Save options</button>' : writingLink;
  const current = '<details class="nav-converters' + (converters.some(([href]) => route === href) ? ' current-converter' : '') + '"><summary>Convert</summary><div class="nav-tools-menu">' + converterMenu + '</div></details>' + workspaceActions + [['/examples/', 'Examples'], ['/help/', 'Help']].map(link => navLink(link)).join('');
  const footerLinks = [['/getting-started/', 'Getting started'], ['/templates/', 'Templates'], ['/about/', 'About &amp; support'], ['/access/', 'Access &amp; status'], ['/privacy/', 'Data use'], ['/pilot', 'Private pilot']].map(link => navLink(link)).join('');
  const homeAttributes = keepWriting ? ' target="_blank" rel="noopener"' : '';
  const homeCue = keepWriting ? '<span class="nav-tab-cue"> (new tab)</span>' : '';
  const canonical = 'https://drafttopage.com' + route;
  return '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<meta name="msvalidate.01" content="C8901580367B9254B6493BF68534AF35" />' +
    '<title>' + escapeHTML(title) + ' | Draft to Page</title><meta name="description" content="' + escapeHTML(description) + '">' +
    '<meta name="theme-color" content="#244b40"><link rel="canonical" href="' + canonical + '">' +
    '<meta property="og:title" content="' + escapeHTML(title) + ' | Draft to Page"><meta property="og:description" content="' + escapeHTML(description) + '">' +
    '<meta property="og:type" content="website"><meta property="og:url" content="' + canonical + '"><meta property="og:image" content="https://drafttopage.com/social-card.png">' +
    '<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="Draft to Page. Your ideas, ready for your website.">' +
    '<meta name="twitter:card" content="summary_large_image"><link rel="icon" type="image/svg+xml" href="/favicon.svg">' +
    '<link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/pilot.css"><link rel="stylesheet" href="/content.css"><link rel="stylesheet" href="/desk.css">' +
    (route === '/404.html' ? '<meta name="robots" content="noindex">' : '') +
    '</head><body><a class="skip-link" href="#main">Skip to content</a><header class="site-header wrap"><a class="brand" href="/"' + homeAttributes + '>Draft to Page<span aria-hidden="true">.</span>' + homeCue + '</a>' +
    '<nav aria-label="Main navigation"' + (desk ? ' class="workspace-navigation"' : '') + '>' + current + '</nav></header><main id="main" class="' +
    (route === '/' ? '' : 'wrap content-main' + (wide ? ' wide' : '') + (desk ? ' desk-main' : '') + (converter ? ' converter-main' : '')) +
    '" data-release="' + RELEASE + '">' + (desk ? annotateWorkspaceLinks(body, route) : body) + '</main>' +
    '<footer class="site-footer wrap"><div><a class="brand" href="/"' + homeAttributes + '>Draft to Page.' + homeCue + '</a><p>Your ideas. Your voice. Your approval.</p></div>' +
    '<nav aria-label="Footer navigation">' + footerLinks + '</nav><span class="badge">In development</span></footer>' +
    (script ? '<script type="module" src="' + script + '"></script>' : '') + '</body></html>\n';
}
