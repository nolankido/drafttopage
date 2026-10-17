export const RELEASE = 'html-relative-links-20261016';
export const escapeHTML = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const converters = [['/word-to-wordpress/', 'Word to WordPress'], ['/word-to-markdown/', 'Word to Markdown'], ['/html-to-markdown/', 'HTML to Markdown'], ['/google-docs-to-wordpress/', 'Google Docs to WordPress'], ['/markdown-to-wordpress/', 'Markdown to WordPress'], ['/markdown-to-html/', 'Markdown to HTML'], ['/markdown-to-word/', 'Markdown to Word']];
export function renderPage({ route, title, description, body, script = '', wide = false, desk = false, converter = false }) {
  const keepWriting = desk || route === '/demo/';
  const navLink = ([href, label]) => {
    const newTab = keepWriting && /^\/(?:help|getting-started|about|access|privacy)(?:\/|$)/.test(href);
    return '<a href="' + href + '"' + (route === href ? ' aria-current="page"' : '') + (newTab ? ' target="_blank" rel="noopener"' : '') + '>' + label + (newTab ? ' (new tab)' : '') + '</a>';
  };
  const current = '<details class="nav-converters' + (converters.some(([href]) => route === href) ? ' current-converter' : '') + '"><summary>Convert</summary><div class="nav-tools-menu">' + converters.map(navLink).join('') + '</div></details>' + [['/write/', 'Writing desk'], ['/examples/', 'Examples'], ['/help/', 'Help']].map(navLink).join('');
  const footerLinks = [['/getting-started/', 'Getting started'], ['/templates/', 'Templates'], ['/about/', 'About &amp; support'], ['/access/', 'Access &amp; status'], ['/privacy/', 'Data use'], ['/pilot', 'Private pilot']].map(navLink).join('');
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
    '</head><body><a class="skip-link" href="#main">Skip to content</a><header class="site-header wrap"><a class="brand" href="/">Draft to Page<span aria-hidden="true">.</span></a>' +
    '<nav aria-label="Main navigation">' + current + '</nav></header><main id="main" class="' +
    (route === '/' ? '' : 'wrap content-main' + (wide ? ' wide' : '') + (desk ? ' desk-main' : '') + (converter ? ' converter-main' : '')) +
    '" data-release="' + RELEASE + '">' + body + '</main>' +
    '<footer class="site-footer wrap"><div><a class="brand" href="/">Draft to Page.</a><p>Your ideas. Your voice. Your approval.</p></div>' +
    '<nav aria-label="Footer navigation">' + footerLinks + '</nav><span class="badge">In development</span></footer>' +
    (script ? '<script type="module" src="' + script + '"></script>' : '') + '</body></html>\n';
}
