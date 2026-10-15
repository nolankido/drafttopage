// Let accepted pastes use the browser's native edit and undo behavior.
// Reject the entire paste before maxlength can silently discard its ending.
export function pastedTextFits(current, start, end, pasted, limit, maxBytes = Infinity) {
  if (typeof current !== 'string' || typeof pasted !== 'string' || !Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || end > current.length || !Number.isInteger(limit) || limit < 0) return false;
  const text = pasted.replace(/\r\n?/g, '\n');
  const length = current.length - (end - start) + text.length;
  if (length > limit || text.includes('\u0000')) return false;
  return !Number.isFinite(maxBytes) || new TextEncoder().encode(current.slice(0, start) + text + current.slice(end)).byteLength <= maxBytes;
}

export function installPasteGuard({ element, limit, maxBytes, label, report }) {
  const clear = () => report('');
  const reject = (event, message) => { event.preventDefault(); report(message + ' Current text is unchanged. The original remains in your clipboard or source file.'); };
  const inspect = (event, transfer) => {
    if (!transfer) return reject(event, 'This browser did not provide plain text to check. Use a UTF-8 file import instead.');
    let text;
    try { text = transfer.getData('text/plain'); }
    catch { return reject(event, 'The pasted text could not be checked. Use a UTF-8 file import instead.'); }
    if (!text) return reject(event, 'Paste plain text or Markdown. Images and rich formatting are not imported.');
    if (!pastedTextFits(element.value, element.selectionStart, element.selectionEnd, text, limit, maxBytes)) {
      return reject(event, label + ' accepts up to ' + limit.toLocaleString('en-US') + ' characters' + (maxBytes ? ' and ' + (maxBytes / 1024) + ' KiB of UTF-8 text' : '') + '. This paste would exceed a limit or contains a null character. Shorten it in the source, or select text to replace before pasting.');
    }
    clear();
  };
  element.addEventListener('paste', event => inspect(event, event.clipboardData));
  // Covers dropped text and bulk insertions exposed through beforeinput.
  element.addEventListener('beforeinput', event => {
    if (!['insertFromPaste', 'insertFromDrop'].includes(event.inputType) && !(event.inputType === 'insertText' && typeof event.data === 'string' && event.data.length > 1)) return;
    if (!event.cancelable) return; // maxlength remains the browser's final typing bound.
    inspect(event, event.dataTransfer || (typeof event.data === 'string' ? { getData: () => event.data } : null));
  });
  element.addEventListener('input', clear);
  return { clear };
}
