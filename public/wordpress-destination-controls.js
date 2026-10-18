import { wordpressDestinationExpectations, destinationSummary, destinationStatus, WORDPRESS_DESTINATION_STEPS } from './wordpress-destination-check.js';

// Local, ephemeral self-check only. Never stores an article, a destination URL,
// WordPress credentials, evidence or user action history.
export function installWordPressDestinationCheck({ $, getDraft, getWordPressOptions, isBusy }) {
  const panel = $('wordpress-destination-check'), status = $('wordpress-destination-status');
  const controls = WORDPRESS_DESTINATION_STEPS.map(id => $('wp-destination-' + id));
  let signature = '', expectations = null;
  function reset() {
    signature = ''; expectations = null;
    controls.forEach(node => { node.checked = false; node.disabled = true; });
    $('wordpress-destination-expectations').textContent = '';
    $('wordpress-destination-ending').textContent = '';
    status.textContent = destinationStatus(0);
  }
  function update() {
    if ($('publishing-destination').value !== 'wordpress') { reset(); return; }
    const draft = getDraft(), options = getWordPressOptions();
    const current = JSON.stringify([draft.title, draft.body, draft.excerpt, draft.slug, draft.description, options, $('reviewed').checked]);
    if (current !== signature) {
      reset();
      signature = current;
    }
    // Do not build a potentially large export while this optional checklist is closed.
    if (!panel.open) return;
    if (!expectations) {
      try { expectations = wordpressDestinationExpectations(draft, options); }
      catch { /* Incomplete article: destination checks stay unavailable. */ }
    }
    $('wordpress-destination-expectations').textContent = expectations ? destinationSummary(expectations) : 'Complete the article before checking its WordPress handoff.';
    $('wordpress-destination-ending').textContent = expectations
      ? (expectations.endingTruncated ? '…' : '') + expectations.sourceEnding
      : '';
    const enabled = Boolean(expectations && $('reviewed').checked && !isBusy());
    controls.forEach(node => { node.disabled = !enabled; });
    status.textContent = destinationStatus(controls.filter(n => n.checked).length);
  }
  panel.addEventListener('toggle', update);
  for (const control of controls) control.addEventListener('change', update);
  reset();
  return { update, reset };
}
