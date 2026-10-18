// A bounded single-task queue for expensive visible preview rebuilding.
// It retains only a callback in this tab, not article history or DOM content.
export function createPreviewRenderQueue({
  schedule = (callback, ms) => setTimeout(callback, ms),
  cancel = handle => clearTimeout(handle),
  now = () => Date.now(),
  quietMs = 70,
  deadlineMs = 160
} = {}) {
  if (!Number.isFinite(quietMs) || quietMs < 0 || !Number.isFinite(deadlineMs) || deadlineMs < quietMs)
    throw new Error('Choose a bounded preview update interval.');
  let handle = null, firstAt = null, task = null;
  function clear() {
    if (handle !== null) cancel(handle);
    handle = null; firstAt = null; task = null;
  }
  function flush() {
    if (task === null) return false;
    const work = task;
    clear();
    work();
    return true;
  }
  function enqueue(work) {
    if (typeof work !== 'function') throw new Error('A preview update needs a callback.');
    if (firstAt === null) firstAt = now();
    if (handle !== null) cancel(handle);
    task = work;
    const remaining = Math.max(0, deadlineMs - Math.max(0, now() - firstAt));
    handle = schedule(flush, Math.min(quietMs, remaining));
  }
  return { enqueue, flush, clear, pending: () => task !== null };
}
