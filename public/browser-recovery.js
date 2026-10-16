import { createWorkspaceBackup, parseWorkspaceBackup, MAX_BACKUP_BYTES } from './workspace.js';
import { compareWorkspaces } from './revisions.js';

export const RECOVERY_KEY = 'drafttopage.browser-recovery.v1';
export const RECOVERY_LOCK = 'drafttopage-browser-recovery-v1';
const bytes = text => new TextEncoder().encode(text).byteLength;
function date(value) {
  if (typeof value !== 'string' || value.length !== 24 || new Date(value).toISOString() !== value) throw new Error('Invalid recovery date.');
  return value;
}
export function createBrowserCopy(workspace, savedAt) {
  const checked = parseWorkspaceBackup(createWorkspaceBackup(workspace.source, workspace.draft));
  const content = JSON.stringify({ format: 'drafttopage-browser-recovery', version: 1, savedAt: date(savedAt), workspace: checked });
  if (bytes(content) > MAX_BACKUP_BYTES) throw new Error('This workspace is too large for browser recovery. Download a private backup.');
  return content;
}
export function parseBrowserCopy(content) {
  if (typeof content !== 'string' || bytes(content) > MAX_BACKUP_BYTES) throw new Error('The browser recovery copy is too large.');
  const value = JSON.parse(content), keys = ['format', 'version', 'savedAt', 'workspace'];
  if (!value || Array.isArray(value) || Object.keys(value).length !== keys.length || !keys.every(key => Object.hasOwn(value, key)) || value.format !== 'drafttopage-browser-recovery' || value.version !== 1) throw new Error('This browser recovery copy is not supported.');
  return { savedAt: date(value.savedAt), workspace: parseWorkspaceBackup(JSON.stringify(value.workspace)) };
}

// One opt-in writer holds an origin-scoped Web Lock. Other tabs cannot overwrite it.
// Storage errors retain the last good copy and stop saving. Nothing is uploaded.
export function createBrowserRecovery({ storage, locks, capture, restore, hasWork, isBusy = () => false, confirm = () => false, now = () => new Date().toISOString(), changed = () => {}, setTimer = setTimeout, clearTimer = clearTimeout }) {
  let enabled = false, pending = false, release = null, timer = null, lastRaw = null, signature = '', message = '', saving = false, generation = 0;
  function read() { return storage().getItem(RECOVERY_KEY); }
  function state() {
    let raw = null, record = null, error = '', supported = false;
    try { supported = typeof locks()?.request === 'function'; } catch { /* File recovery remains available. */ }
    try { raw = read(); if (raw !== null) record = parseBrowserCopy(raw); }
    catch { error = 'Browser recovery is unavailable or its saved copy cannot be read. Writing is unchanged. Use a private backup file.'; }
    return { enabled, pending, saving, available: raw !== null, valid: Boolean(record), savedAt: record?.savedAt ?? '', supported, error, message };
  }
  function notify(text = message) { message = text; changed(state()); }
  function cancelTimer() { if (timer !== null) clearTimer(timer); timer = null; saving = false; }
  function stop() { cancelTimer(); enabled = false; release?.(); release = null; }
  function fail(error) { stop(); pending = false; notify(error?.message || 'Browser saving failed. The last saved copy was kept. Download a private backup.'); }
  function flush() {
    cancelTimer();
    if (!enabled || pending) return false;
    if (isBusy()) { schedule(); return false; }
    try {
      if (read() !== lastRaw) throw new Error('The browser recovery copy changed outside this tab. Saving stopped to protect it. Download your current writing as a private backup.');
      const workspace = capture(), nextSignature = createWorkspaceBackup(workspace.source, workspace.draft);
      if (nextSignature !== signature) {
        const content = createBrowserCopy(workspace, now());
        storage().setItem(RECOVERY_KEY, content);
        if (read() !== content) throw new Error('The browser did not retain this recovery copy. Download a private backup.');
        lastRaw = content; signature = nextSignature;
      }
      notify('Recovery copy saved in this browser. Keep a downloaded backup for important work.'); return true;
    } catch (error) { fail(new Error(error.message + ' Saving is off; your open article is unchanged.')); return false; }
  }
  function schedule() {
    if (!enabled || pending) return;
    try {
      const value = capture(), next = createWorkspaceBackup(value.source, value.draft);
      if (next === signature) return;
      cancelTimer(); saving = true;
      notify('Changes waiting to be saved in this browser.');
      timer = setTimer(() => { timer = null; flush(); }, 600);
    } catch { fail(new Error('This edit cannot be saved as a valid recovery copy. The previous copy is kept. Download a private backup after correcting invalid fields.')); }
  }
  async function acquire(action, hold = false) {
    if (pending || isBusy()) { notify('Finish the current file operation before changing browser recovery.'); return false; }
    let manager;
    try { manager = locks(); } catch { /* Access can be denied by browser policy. */ }
    if (typeof manager?.request !== 'function') { notify('Safe browser recovery is not supported here. Use a private backup file.'); return false; }
    pending = true; notify();
    const requestedGeneration = generation;
    return new Promise(resolve => {
      try {
        manager.request(RECOVERY_LOCK, { ifAvailable: true }, async lock => {
          if (requestedGeneration !== generation) { resolve(false); return; }
          if (!lock) { pending = false; notify('Another Draft to Page tab is using browser recovery. Pause saving there or close that tab, then try again.'); resolve(false); return; }
          try {
            if (isBusy()) throw new Error('Finish the current file operation first. Writing is unchanged.');
            if (!action()) { pending = false; notify(); resolve(false); return; }
            if (!hold) { pending = false; notify(); resolve(true); return; }
            const held = new Promise(done => { release = done; });
            enabled = true; pending = false;
            if (!flush()) { resolve(false); return; }
            resolve(true); await held;
          } catch (error) { fail(error); resolve(false); }
        }).catch(error => { if (requestedGeneration === generation) fail(error); resolve(false); });
      } catch (error) { fail(error); resolve(false); }
    });
  }
  async function start() {
    if (enabled) return true;
    return acquire(() => {
      if (read() !== null) throw new Error('A browser copy already exists. Restore it or remove it explicitly before saving a different workspace.');
      lastRaw = null; signature = ''; return true;
    }, true);
  }
  function inspect() {
    const raw = read(), record = parseBrowserCopy(raw);
    return { raw, record, currentKey: JSON.stringify(capture()) };
  }
  async function resume(review) {
    if (enabled) return true;
    let expected, original;
    try {
      if (!review || typeof review.raw !== 'string' || typeof review.currentKey !== 'string') throw new Error('Review the saved browser copy first.');
      expected = review.raw; original = review.currentKey;
      if (read() !== expected || JSON.stringify(capture()) !== original) throw new Error('The saved copy or open writing changed.');
      parseBrowserCopy(expected);
    } catch { notify('Review the saved browser copy and current writing again before restoring. Both were kept.'); return false; }
    return acquire(() => {
      if (read() !== expected || JSON.stringify(capture()) !== original) throw new Error('The saved copy or open writing changed. Nothing was restored. Check both before trying again.');
      const record = parseBrowserCopy(expected);
      if (hasWork() && !confirm('Replace current writing and unsaved preparation with the saved browser copy? Previous valid writing is checkpointed in this tab. Download a private backup first to keep it after leaving.')) { message = 'Restore cancelled. Current writing and the browser copy are unchanged.'; return false; }
      restore(record.workspace);
      lastRaw = expected; signature = createWorkspaceBackup(record.workspace.source, record.workspace.draft);
      message = 'Browser copy restored. Review approval is cleared. Saving resumes only in this tab.';
      return true;
    }, true);
  }
  function pause() {
    if (pending) return;
    if (enabled && !flush()) {
      stop();
      notify(message + ' Paused without confirming the latest changes were saved. Keep this tab open and download a private backup.');
      return false;
    }
    stop(); notify('Browser saving paused. The saved copy remains on this browser until you remove it.');
    return true;
  }
  function removeOwned() {
    if (!enabled) return;
    if (read() !== lastRaw) { stop(); throw new Error('The stored copy changed. It was kept. Check browser recovery before clearing this workspace.'); }
    storage().removeItem(RECOVERY_KEY);
    if (read() !== null) throw new Error('The browser did not remove its recovery copy. Current writing was kept.');
    stop(); lastRaw = null; signature = ''; notify('Browser recovery copy removed. Saving is off.');
  }
  async function forget() {
    if (pending || isBusy()) return false;
    let expected; try { expected = read(); } catch { notify('Browser storage is unavailable. Use your browser site-data settings to remove saved data.'); return false; }
    if (expected === null) return true;
    if (!confirm('Remove the recovery copy stored in this browser and stop saving? This cannot be undone. Your open article and downloaded files stay unchanged.')) return false;
    const remove = () => {
      if (read() !== expected) throw new Error('The browser copy changed. It was kept; review it before trying again.');
      storage().removeItem(RECOVERY_KEY);
      if (read() !== null) throw new Error('The browser did not remove the saved copy. Use browser site-data settings.');
      lastRaw = null; signature = ''; message = 'Browser recovery copy removed. Saving is off. Open writing is unchanged.'; return true;
    };
    if (enabled) {
      try { remove(); stop(); notify(); return true; } catch (error) { fail(error); return false; }
    }
    return acquire(remove);
  }
  async function removeForClear() {
    try {
      if (enabled) { removeOwned(); return true; }
      const expected = read();
      if (expected === null) return true;
      return acquire(() => {
        if (read() !== expected) throw new Error('The stored copy changed. Clearing was cancelled to protect it.');
        storage().removeItem(RECOVERY_KEY);
        if (read() !== null) throw new Error('The browser copy could not be removed. Current writing was kept.');
        lastRaw = null; signature = ''; message = 'Browser recovery copy removed. Saving is off.'; return true;
      });
    } catch (error) { fail(error); return false; }
  }
  function externalChange() {
    if (enabled) { stop(); notify('Browser recovery changed in another tab or was removed. Saving stopped. Current writing is unchanged.'); }
    else notify();
  }
  return { state, start, inspect, resume, schedule, flush, pause, forget, removeOwned, removeForClear, externalChange, busy: () => pending, dispose: () => { if (enabled) flush(); stop(); pending = false; generation++; }, refresh: () => notify() };
}

export function installBrowserRecovery(options) {
  const $ = id => document.getElementById(id), panel = $('browser-recovery-panel');
  if (!panel) return null;
  let controller, wasEnabled = false, wasPending = null, inspection = null, comparison = [];
  function clearInspection() {
    inspection = null; comparison = [];
    $('browser-recovery-reviewed').checked = false;
    $('browser-recovery-preview').hidden = true;
    $('browser-recovery-fields').replaceChildren();
    $('browser-recovery-current').value = ''; $('browser-recovery-saved').value = '';
    $('browser-recovery-comparison').textContent = '';
  }
  function showField() {
    const field = comparison.find(field => field.id === $('browser-recovery-fields').value);
    $('browser-recovery-current').value = field?.current || '';
    $('browser-recovery-saved').value = field?.saved || '';
  }
  const render = state => {
    if (inspection && (state.enabled || inspection.currentKey !== JSON.stringify(options.capture()) || !state.available)) clearInspection();
    if (wasEnabled && !state.enabled) $('browser-recovery-consent').checked = false;
    wasEnabled = state.enabled;
    $('browser-recovery-summary').textContent = state.enabled ? state.saving ? 'Browser recovery: saving changes' : 'Browser recovery: on' : state.available ? 'Browser recovery: saved copy available' : 'Keep work on this browser, optional';
    $('browser-recovery-status').textContent = state.error || (!state.supported ? 'Safe browser recovery is not supported here. Use a downloaded private backup; browser site-data settings can remove an older copy.' : '') || state.message || (state.available ? 'A recovery copy is stored on this browser. It has not been opened in this workspace.' : 'Saving is off. Without browser recovery or a downloaded backup, refreshing or leaving can lose writing.');
    $('browser-recovery-date').textContent = state.savedAt ? 'Last saved: ' + new Date(state.savedAt).toLocaleString() + '. Browser storage can be cleared or evicted; this is not a guaranteed backup.' : '';
    $('browser-recovery-consent').disabled = state.enabled || state.pending || !state.supported;
    $('browser-recovery-start').hidden = state.available || state.enabled;
    $('browser-recovery-restore').hidden = !state.available || state.enabled;
    $('browser-recovery-start').disabled = !$('browser-recovery-consent').checked || state.pending || !state.supported;
    $('browser-recovery-restore').disabled = !$('browser-recovery-consent').checked || !$('browser-recovery-reviewed').checked || !inspection || state.pending || !state.valid || !state.supported;
    $('browser-recovery-inspect').hidden = !state.available || state.enabled;
    $('browser-recovery-inspect').disabled = state.pending || !state.valid;
    $('browser-recovery-reviewed').disabled = state.pending || !inspection;
    $('browser-recovery-pause').hidden = !state.enabled;
    $('browser-recovery-now').hidden = !state.enabled;
    $('browser-recovery-forget').hidden = !state.available;
    for (const id of ['browser-recovery-pause', 'browser-recovery-now', 'browser-recovery-forget']) $(id).disabled = state.pending;
    if (wasPending !== state.pending) {
      wasPending = state.pending;
      options.stateChanged?.(state.pending);
    }
  };
  controller = createBrowserRecovery({ ...options, storage: () => window.localStorage, locks: () => navigator.locks, confirm: text => window.confirm(text), changed: render });
  $('browser-recovery-consent').addEventListener('change', () => render(controller.state()));
  $('browser-recovery-reviewed').addEventListener('change', () => render(controller.state()));
  $('browser-recovery-fields').addEventListener('change', showField);
  $('browser-recovery-inspect').addEventListener('click', () => {
    if (controller.busy() || options.isBusy?.()) return;
    try {
      clearInspection(); inspection = controller.inspect();
      comparison = compareWorkspaces(inspection.record.workspace, options.capture()).map(field => field.id !== 'questions' ? field : {
        ...field, saved: JSON.stringify(inspection.record.workspace.draft?.questions || [], null, 2), current: JSON.stringify(options.capture().draft?.questions || [], null, 2), changed: JSON.stringify(inspection.record.workspace.draft?.questions || []) !== JSON.stringify(options.capture().draft?.questions || [])
      });
      $('browser-recovery-fields').replaceChildren(...comparison.map(field => {
        const option = document.createElement('option'); option.value = field.id;
        option.textContent = field.label + (field.changed ? ' (will change)' : ' (same)'); return option;
      }));
      $('browser-recovery-fields').value = 'body'; showField();
      const changed = comparison.filter(field => field.changed), emptied = changed.filter(field => field.current.length && !field.saved.length);
      $('browser-recovery-comparison').textContent = (changed.length ? 'Fields to replace: ' + changed.map(field => field.label).join(', ') + '.' : 'The saved copy matches current writing.') + (emptied.length ? ' Fields that will become empty: ' + emptied.map(field => field.label).join(', ') + '.' : '');
      $('browser-recovery-preview').hidden = false;
      render(controller.state());
      $('browser-recovery-preview-heading').focus();
    } catch {
      clearInspection(); render(controller.state());
      $('browser-recovery-status').textContent = 'The saved copy could not be compared. Current writing and stored data were kept. Download a private backup.';
    }
  });
  $('browser-recovery-start').addEventListener('click', () => { if ($('browser-recovery-consent').checked) controller.start(); });
  $('browser-recovery-restore').addEventListener('click', () => {
    if ($('browser-recovery-consent').checked && $('browser-recovery-reviewed').checked && inspection) controller.resume(inspection);
  });
  $('browser-recovery-pause').addEventListener('click', controller.pause);
  $('browser-recovery-now').addEventListener('click', controller.flush);
  $('browser-recovery-forget').addEventListener('click', controller.forget);
  window.addEventListener('storage', event => { if (event.key === RECOVERY_KEY || event.key === null) { clearInspection(); controller.externalChange(); } });
  panel.addEventListener('toggle', () => { if (!panel.open) { clearInspection(); render(controller.state()); } });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') controller.flush(); });
  window.addEventListener('pagehide', controller.dispose);
  window.addEventListener('pageshow', event => { if (event.persisted) controller.refresh(); });
  render(controller.state());
  if (controller.state().available) panel.open = true;
  return controller;
}

