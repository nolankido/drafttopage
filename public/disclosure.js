// Open the complete disclosure path before a shortcut moves keyboard focus.
// No writing, approval, or export settings change when a panel is revealed.
export function revealDetails(panel) {
  if (!panel) return;
  panel.open = true;
  for (let parent = panel.parentElement; parent; parent = parent.parentElement) {
    if (parent.tagName === 'DETAILS') parent.open = true;
  }
}
