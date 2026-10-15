export const RELEASE = 'formatted-import-20261014';
export const escapeHTML = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const navigation = [['/write/', 'Write'], ['/markdown-to-wordpress/', 'WordPress tool'], ['/markdown-to-html/', 'HTML tool'], ['/examples/', 'Examples'], ['/templates/', 'Templates'], ['/help/', 'Help']];
export function renderPage({ route, title, description, body, script = '', wide = false, desk = false }) {
  const current = navigation.map(([href, label]) => '<a href="' + href + '"' + (route === href ? ' aria-current="page"' : '') + '>' + label + '</a>').join('');
  const canonical = 'https://drafttopage.com' + route;
  return '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
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
    (route === '/' ? '' : 'wrap content-main' + (wide ? ' wide' : '') + (desk ? ' desk-main' : '')) +
    '" data-release="' + RELEASE + '">' + body + '</main>' +
    '<footer class="site-footer wrap"><div><a class="brand" href="/">Draft to Page.</a><p>Your ideas. Your voice. Your approval.</p></div>' +
    '<nav aria-label="Footer navigation"><a href="/getting-started/">Getting started</a><a href="/about/">About &amp; support</a><a href="/access/">Access &amp; status</a><a href="/privacy/">Data use</a><a href="/pilot">Private pilot</a></nav><span class="badge">In development</span></footer>' +
    (script ? '<script type="module" src="' + script + '"></script>' : '') + '</body></html>\n';
}
