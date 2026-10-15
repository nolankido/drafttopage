import { compareWordPressText, TRANSFER_TEXT_LIMIT } from './wordpress-transfer.js';
import { installPasteGuard } from './paste-guard.js';

export function installWordPressTransfer({ getDraft, getWordPressOptions, report, isBusy }) {
  const $ = id => document.getElementById(id), panel = $('wordpress-transfer-panel');
  // Some embedded export-control callers do not include the optional public tool.
  if (!panel) return { update() {}, reset() {} };
  let signature = '';
  const state = () => JSON.stringify([getDraft().body, getWordPressOptions(), $('publishing-destination').value]);
  const say = message => { $('wordpress-transfer-status').textContent = message; if (message) report(message); };
  function clearResult() {
    $('wordpress-transfer-status').textContent = ''; $('wordpress-transfer-difference').hidden = true;
    $('wordpress-transfer-expected-excerpt').textContent = ''; $('wordpress-transfer-received-excerpt').textContent = '';
    $('wordpress-transfer-expected').value = ''; $('wordpress-transfer-inspection').open = false; $('wordpress-transfer-inspection').hidden = true;
  }
  function reset() { clearResult(); $('wordpress-transfer-input').value = ''; panel.open = false; signature = state(); }
  function update() {
    const next = state(), visible = $('publishing-destination').value === 'wordpress';
    if (next !== signature) {
      const hadResult = Boolean($('wordpress-transfer-status').textContent); clearResult(); signature = next;
      if (!visible) { $('wordpress-transfer-input').value = ''; panel.open = false; }
      else if (hadResult && $('wordpress-transfer-input').value) $('wordpress-transfer-status').textContent = 'The article or image choice changed. Compare again with the current article.';
    }
    $('wordpress-transfer-controls').disabled = isBusy() || !visible;
    $('compare-wordpress-text').disabled = isBusy() || !visible || !panel.open || !getDraft().body?.trim() || !$('wordpress-transfer-input').value.trim();
    if (!panel.open) { clearResult(); $('wordpress-transfer-input').value = ''; }
  }
  panel.addEventListener('toggle', update);
  installPasteGuard({ element: $('wordpress-transfer-input'), limit: TRANSFER_TEXT_LIMIT, label: 'The comparison text', report: message => { if (message) { clearResult(); say(message); } } });
  $('wordpress-transfer-input').addEventListener('input', () => { clearResult(); update(); });
  $('wordpress-transfer-inspection').addEventListener('toggle', () => {
    if (!$('wordpress-transfer-inspection').open) $('wordpress-transfer-expected').value = '';
    else if (!isBusy() && panel.open && $('publishing-destination').value === 'wordpress' && $('wordpress-transfer-status').textContent) {
      try { $('wordpress-transfer-expected').value = compareWordPressText(getDraft(), $('wordpress-transfer-input').value, getWordPressOptions()).expectedText; }
      catch { $('wordpress-transfer-expected').value = ''; }
    }
  });
  $('compare-wordpress-text').addEventListener('click', () => {
    if (isBusy() || !panel.open || $('publishing-destination').value !== 'wordpress') return;
    clearResult(); signature = state();
    try {
      const result = compareWordPressText(getDraft(), $('wordpress-transfer-input').value, getWordPressOptions());
      $('wordpress-transfer-inspection').hidden = false;
      if (!result.matches) {
        $('wordpress-transfer-difference').hidden = false;
        $('wordpress-transfer-expected-excerpt').textContent = result.expectedExcerpt;
        $('wordpress-transfer-received-excerpt').textContent = result.receivedExcerpt;
      }
      say((result.matches ? 'Text matches after whitespace is normalized.' : 'Text differs at normalized character ' + result.firstDifference.toLocaleString() + '.') + ' Expected ' + result.expectedCharacters.toLocaleString() + ' characters; received ' + result.receivedCharacters.toLocaleString() + '. ' + (result.imageCount ? result.imageCount + ' linked image(s) are excluded. ' : '') + 'This compares only the text you supplied. Inspect formatting, lists, links, images, code indentation, and the saved post in WordPress. Nothing was changed or published.');
    } catch (error) { say(error.message); }
    update();
  });
  $('clear-wordpress-text').addEventListener('click', () => {
    if (isBusy() || !panel.open || $('publishing-destination').value !== 'wordpress') return;
    clearResult(); $('wordpress-transfer-input').value = ''; update(); say('Comparison text and results cleared. The article is unchanged.'); $('wordpress-transfer-input').focus();
  });
  update();
  return { update, reset };
}
