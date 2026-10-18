import { MAX_IMPORT_BYTES } from './writing-limits.js';

const kept = ' Current writing and any previous import preview are kept.';

// Call from installPasteGuard's skipPaste during the native paste event.
// true consumes the event; false leaves plain-text insertion to that guard.
// Only this event's HTML is read. Source stays opaque until the shared importer
// parses it; this router never renders markup, reads the clipboard API or edits.
// canPreview must not mutate state. preview must be synchronous, parse before
// replacing preparation, and never apply to the article. Return true when staged
// or false after reporting a failure that leaves existing work unchanged.
export function routeFormattedPaste(event, { canPreview = () => false, preview, report = () => {} } = {}) {
  if (event.defaultPrevented) return true;
  const clipboard = event.clipboardData;
  // The existing plain-text guard handles missing or unavailable clipboard data.
  if (!clipboard || typeof clipboard.getData !== 'function') return false;
  let html;
  try { html = clipboard.getData('text/html'); }
  catch {
    event.preventDefault();
    report('The copied formatting could not be read. Try pasting again or use Paste without formatting.' + kept);
    return true;
  }
  if (html === '') return false;
  // Never insert a plain-text rendition after an HTML paste was identified,
  // including when its preview is blocked, oversized or unsupported.
  event.preventDefault();
  if (typeof html !== 'string' || !html.trim()) {
    report('The clipboard did not provide a readable formatted selection. Copy the writing again or use Paste without formatting.' + kept);
    return true;
  }
  if (html.length > MAX_IMPORT_BYTES || new TextEncoder().encode(html).byteLength > MAX_IMPORT_BYTES) {
    report('The copied formatting exceeds 512 KiB. Copy a smaller section or use Paste without formatting.' + kept);
    return true;
  }
  try {
    if (!canPreview()) {
      report('Finish or clear the current import or file operation before previewing another formatted selection.' + kept);
      return true;
    }
    const staged = preview({ format: 'html', text: html });
    if (staged !== true && staged !== false) throw new Error('Expected a synchronous preview result.');
  } catch {
    report('This formatted selection could not be previewed. Use Import formatted writing to inspect its conversion, or use Paste without formatting.' + kept);
  }
  return true;
}
