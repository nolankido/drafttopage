// User-invoked and content-free. No network calls, content reads or storage.
export const REPORT_ROUTES = Object.freeze({
  '/word-to-wordpress/': 'Word to WordPress',
  '/google-docs-to-wordpress/': 'Google Docs to WordPress',
  '/markdown-to-wordpress/': 'Markdown to WordPress',
  '/word-to-markdown/': 'Word to Markdown',
  '/html-to-markdown/': 'HTML to Markdown',
  '/markdown-to-word/': 'Markdown to Word',
  '/markdown-to-html/': 'Markdown to HTML',
  '/write/': 'Writing desk',
  '/help/alpha-support/': 'Alpha support'
});
export function coarseBrowser(agent = '') {
  if (typeof agent !== 'string') return 'Unknown';
  if (/\bEdg\//.test(agent)) return 'Edge';
  if (/\b(Firefox|FxiOS)\//.test(agent)) return 'Firefox';
  if (/\b(CriOS|Chrome)\//.test(agent)) return 'Chrome';
  if (/\bSafari\//.test(agent)) return 'Safari';
  return 'Other/unknown';
}
export function diagnosticSummary({ release, route, agent } = {}) {
  const build = typeof release === 'string' && /^alpha-release-[a-z0-9-]{1,64}$/.test(release) ? release : 'unidentified';
  const converter = Object.hasOwn(REPORT_ROUTES, route) ? REPORT_ROUTES[route] : 'Unspecified';
  return 'Product: Draft to Page\nBuild: ' + build + '\nConverter: ' + converter +
    '\nBrowser family: ' + coarseBrowser(agent) + '\nPrivate content: not collected';
}
export function installAlphaDiagnostics({ doc = document, nav = navigator } = {}) {
  const $ = id => doc.getElementById(id);
  const text = $('alpha-diagnostic-text'), status = $('alpha-diagnostic-status'), button = $('alpha-diagnostic-copy');
  if (!text || !status || !button) return null;
  text.value = diagnosticSummary({ release: $('main')?.dataset?.release, route: '/help/alpha-support/', agent: nav?.userAgent });
  button.addEventListener('click', async () => {
    try {
      if (typeof nav?.clipboard?.writeText !== 'function') throw new Error('Clipboard unavailable');
      await nav.clipboard.writeText(text.value);
      status.textContent = 'Diagnostic summary copied. Review it before sharing. No report was sent.';
    } catch {
      status.textContent = 'Copy unavailable. Select and copy the read-only summary. Nothing was sent.';
      text.focus(); text.select();
    }
  });
  return { summary: () => text.value };
}
if (typeof document !== 'undefined') installAlphaDiagnostics();
