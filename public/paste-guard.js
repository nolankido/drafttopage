// Let accepted pastes use the browser's native edit and undo behavior.
// Reject the entire paste before maxlength can silently discard its ending.
export function pastedTextFits(current, start, end, pasted, limit, maxBytes = Infinity) {
  if (typeof current !== 'string' || typeof pasted !== 'string' || !Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || end > current.length || !Number.isInteger(limit) || limit < 0) return false;
  const text = pasted.replace(/\r\n?/g, '\n');
  const length = current.length - (end - start) + text.length;
  if (length > limit || text.includes('\u0000')) return false;
  return !Number.isFinite(maxBytes) || new TextEncoder().encode(current.slice(0, start) + text + current.slice(end)).byteLength <= maxBytes;
}

export function installPasteGuard({ element, limit, maxBytes, label, report, skipPaste = () => false }) {
  // Mobile WebKit and other editors may provide readable clipboardData in
  // paste, then no dataTransfer in beforeinput for the same native insertion.
  // Permit ONLY that already inspected insertion; do not relax size limits.
  let checkedPaste = null;
  const signature = () => [element.value, element.selectionStart, element.selectionEnd];
  const clear = () => { checkedPaste = null; report(''); };
  const reject = (event, message) => {
    checkedPaste = null;
    event.preventDefault();
    report(message + ' Current text is unchanged. The original remains in your clipboard or source file.');
  };
  const readText = transfer => {
    if (!transfer || typeof transfer.getData !== 'function') return null;
    try { return transfer.getData('text/plain'); } catch { return null; }
  };
  const inspect = (event, transfer) => {
    if (!transfer) { reject(event, 'This browser did not provide plain text to check. Use a UTF-8 file import instead.'); return null; }
    const text = readText(transfer);
    if (text === null) { reject(event, 'The pasted text could not be checked. Use a UTF-8 file import instead.'); return null; }
    if (!text) { reject(event, 'Paste plain text or Markdown. Images and rich formatting are not imported.'); return null; }
    if (!pastedTextFits(element.value, element.selectionStart, element.selectionEnd, text, limit, maxBytes)) {
      reject(event, label + ' accepts up to ' + limit.toLocaleString('en-US') + ' characters' + (maxBytes ? ' and ' + (maxBytes / 1024) + ' KiB of UTF-8 text' : '') + '. This paste would exceed a limit or contains a null character. Shorten it in the source, or select text to replace before pasting.');
      return null;
    }
    clear();
    return text;
  };
  element.addEventListener('paste', event => {
    checkedPaste = null;
    if (skipPaste(event)) return;
    const text = inspect(event, event.clipboardData);
    if (text !== null) checkedPaste = { state: signature(), text: text.replace(/\r\n?/g, '\n') };
  });
  // Covers dropped text and bulk insertions exposed through beforeinput.
  element.addEventListener('beforeinput', event => {
    if (!['insertFromPaste', 'insertFromDrop'].includes(event.inputType) && !(event.inputType === 'insertText' && typeof event.data === 'string' && event.data.length > 1)) return;
    if (!event.cancelable) { checkedPaste = null; return; } // Browser maxlength remains the final bound.
    const transfer = event.dataTransfer || (typeof event.data === 'string' ? { getData: () => event.data } : null);
    const state = signature();
    const sameSelection = checkedPaste && checkedPaste.state.every((item, i) => item === state[i]);
    if (event.inputType === 'insertFromPaste' && sameSelection) {
      const beforeText = readText(transfer);
      if (beforeText !== null && beforeText && beforeText.replace(/\r\n?/g, '\n') !== checkedPaste.text) {
        reject(event, 'The paste payload changed between browser events. Try pasting again.');
        return;
      }
      // One-use permit. The earlier paste event checked the entire replacement
      // including its UTF-8 bytes. Never auto-insert text or change selection.
      checkedPaste = null; return;
    }
    checkedPaste = null;
    inspect(event, transfer);
  });
  element.addEventListener('input', clear);
  element.addEventListener('blur', () => { checkedPaste = null; });
  return { clear };
}
