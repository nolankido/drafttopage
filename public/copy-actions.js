// One clipboard request at a time. Browser writes cannot be cancelled safely.
// Call write synchronously inside the explicit user gesture, before any await.
export function createCopyActions({ snapshot, report, changed = () => {} }) {
  let pending = false, version = 0, previous, feedback = '', destination = '', outcome = 'idle';
  function refresh() {
    const next = snapshot();
    if (next !== previous) { previous = next; version++; feedback = ''; outcome = pending ? 'pending' : 'idle'; }
    return { pending, feedback, destination, outcome };
  }
  function publish(message, target, result) {
    feedback = message; destination = target; outcome = result;
    report(message); changed();
  }
  return {
    state: refresh,
    notice(message, target) { refresh(); publish(message, target, 'notice'); },
    async run({ write, destination: target, label, success, fallback }) {
      if (pending) return false;
      refresh(); const started = version;
      pending = true;
      try {
        const request = write();
        publish('Copying ' + label + '. Wait for confirmation before pasting. Downloads remain available.', target, 'pending');
        await request;
        refresh();
        if (version !== started) {
          publish('An earlier export was copied. Writing, destination, or review options changed while copying. Review and copy the current version before pasting.', target, 'stale');
          return false;
        }
        publish(success, target, 'success'); return true;
      } catch {
        refresh();
        publish(version !== started ? 'An earlier copy request failed after writing, destination, or review options changed. Review the current export and try again, or use its download.' : fallback, target, version !== started ? 'stale' : 'failure');
        return false;
      } finally { pending = false; changed(); }
    }
  };
}
