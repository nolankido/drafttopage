import { activateOnEnterRelease } from './keyboard-action.js';

const DESTINATIONS = new Set(['wordpress', 'markdown', 'html', 'word']);

// Current-draft actions reuse the open desk. Authored source links stay native
// links and open separately while this tab contains work or a file operation.
export function installWorkspaceNavigation({ hasWork, isBusy = () => false, getImportState = () => ({}), chooseDestination, editCurrent, saveCurrent, reviewImport, report = () => {}, document: doc = globalThis.document }) {
  const $ = id => doc.getElementById(id);
  const tools = $('workspace-current-tools'), label = $('workspace-converter-label');
  const writing = $('workspace-writing-link'), edit = $('workspace-edit-current'), save = $('workspace-save-current');
  if (!tools || !label || !writing || !edit || !save) return null;
  const destinations = [...tools.querySelectorAll('[data-current-destination]')];
  const current = [...destinations, edit, save];
  const summary = tools.closest('details')?.querySelector('summary');
  const links = [...new Set([...doc.querySelectorAll('[data-workspace-source-link]'), writing])].map(link => {
    const cue = link.querySelector('[data-workspace-new-tab-cue]');
    return { link, cue, hidden: cue?.hidden, target: link.getAttribute('target'), rel: link.getAttribute('rel') };
  });
  function attribute(node, name, value) {
    if (value === null) { if (node.hasAttribute(name)) node.removeAttribute(name); }
    else if (node.getAttribute(name) !== value) node.setAttribute(name, value);
  }
  function update() {
    const busy = Boolean(isBusy()), active = Boolean(hasWork()) || busy, focused = doc.activeElement;
    const focusedCurrent = current.some(control => control.contains(focused));
    const writingWillHide = active && writing.contains(focused);
    tools.hidden = !active; edit.hidden = !active; save.hidden = !active; writing.hidden = active;
    tools.setAttribute('aria-busy', String(busy));
    for (const button of destinations) button.disabled = busy || !DESTINATIONS.has(button.dataset.currentDestination);
    edit.disabled = busy; save.disabled = busy;
    const heading = active ? 'Start another conversion' : 'Choose a converter';
    if (label.textContent !== heading) label.textContent = heading;
    for (const { link, cue, hidden, target, rel } of links) {
      attribute(link, 'target', active ? '_blank' : target);
      attribute(link, 'rel', active ? [...new Set([...(rel || '').split(/\s+/).filter(Boolean), 'noopener'])].join(' ') : rel);
      if (cue) cue.hidden = active ? false : hidden;
    }
    // Re-rendering save status must not move the visitor's cursor. Move focus
    // only when a navigation control itself becomes hidden or disabled.
    if (!active && focusedCurrent) writing.focus();
    else if (writingWillHide || busy && focusedCurrent) (busy ? summary : edit)?.focus();
  }
  function run(action, checkImport = true) {
    if (isBusy()) {
      report('Wait for the current operation before using these controls. Your writing is kept.');
      update(); return;
    }
    if (!hasWork()) { update(); return; }
    if (checkImport && getImportState()?.pending) {
      reviewImport(); update(); return;
    }
    action(); update();
  }
  for (const button of destinations) {
    activateOnEnterRelease(button);
    button.addEventListener('click', () => {
      const destination = button.dataset.currentDestination;
      if (DESTINATIONS.has(destination)) run(() => chooseDestination(destination));
    });
  }
  activateOnEnterRelease(edit); activateOnEnterRelease(save);
  edit.addEventListener('click', () => run(editCurrent));
  // Opening save options is read-only. Existing recovery controls decide which
  // saving or replacement actions are allowed while an import is pending.
  save.addEventListener('click', () => run(saveCurrent, false));
  for (const { link } of links) link.addEventListener('click', update);
  update();
  return { update };
}
