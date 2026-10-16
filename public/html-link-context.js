import { safeWebLink } from './markdown-inline.js';

export const HTML_SOURCE_URL_LIMIT = 2048;
// The author supplies context. Source <base> elements and this site's URL are never used.
export function htmlLinkResolver(sourceURL = '') {
  if (typeof sourceURL !== 'string' || sourceURL.length > HTML_SOURCE_URL_LIMIT) throw new Error('Keep the source page URL to at most 2,048 characters.');
  const supplied = sourceURL.trim(), base = supplied ? safeWebLink(supplied) : '';
  if (supplied && !base) throw new Error('Enter an absolute http:// or https:// source page URL without credentials, spaces, or backslashes, or leave it blank.');
  return target => {
    const absolute = safeWebLink(target);
    if (absolute) return { href: absolute, relative: false };
    // Do not repair malformed absolute URLs, unsafe schemes, whitespace, or backslashes.
    if (!base || typeof target !== 'string' || !target || /[\s\u0000-\u001f\u007f<>"\\]/u.test(target) || /^[A-Za-z][A-Za-z\d+.-]*:|^\/{3,}/.test(target)) return { href: null, relative: false };
    try {
      const href = safeWebLink(new URL(target, base).href);
      return { href, relative: Boolean(href) };
    } catch { return { href: null, relative: false }; }
  };
}
