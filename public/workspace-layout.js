// Layout is a view preference for this open tab. It never reads or stores writing.
export function installWorkspaceLayout() {
  const root = document.getElementById('main');
  const panel = document.getElementById('workspace-layout');
  const choice = document.getElementById('workspace-layout-choice');
  const status = document.getElementById('workspace-layout-status');
  if (!root || !panel || !choice || !status) return null;
  let layout = 'stacked';
  function select(value) {
    if (!['stacked', 'compare'].includes(value)) { choice.value = layout; return false; }
    layout = value;
    root.dataset.workspaceLayout = layout;
    choice.value = layout;
    status.textContent = layout === 'stacked'
      ? 'The editor, reading preview, and export controls use full-width panels. Use the numbered steps to move between them.'
      : 'The editor and preview sit beside each other on wide screens. On narrow screens, panels stay in one column.';
    return true;
  }
  choice.addEventListener('change', () => select(choice.value));
  select('stacked'); panel.hidden = false;
  return { select };
}
