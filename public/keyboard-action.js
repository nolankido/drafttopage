// A restore can move focus into an editor. Keep the entire activating Enter
// gesture on its button so its keypress/repeats cannot edit restored writing.
export function activateOnEnterRelease(button) {
  const doc = button.ownerDocument || document, view = doc.defaultView;
  let armed = false;
  const cancel = () => {
    armed = false;
    doc.removeEventListener('pointerdown', cancel, true);
    view?.removeEventListener('blur', cancel);
  };
  button.addEventListener('keydown', event => {
    if (event.key !== 'Enter' || event.isComposing) return;
    event.preventDefault();
    if (event.repeat) return;
    cancel(); armed = true;
    doc.addEventListener('pointerdown', cancel, true);
    view?.addEventListener('blur', cancel);
  });
  button.addEventListener('keyup', event => {
    if (event.key !== 'Enter') return;
    const ready = armed; cancel();
    if (!event.isComposing) event.preventDefault();
    if (!ready) return;
    if (!event.isComposing && doc.activeElement === button && button.isConnected && !button.matches(':disabled') && !button.closest('[hidden]')) button.click();
  });
  button.addEventListener('blur', cancel);
  return cancel;
}
