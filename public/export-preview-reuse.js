// Reuse only the current preview's unchanged prefix and suffix. No edit history,
// timer or cross-workspace cache. The supplied original renderer owns all HTML.
export function createExportPreviewRenderer(target, renderOriginal) {
  let entries = [], context = null;
  function clear() {
    entries = []; context = null; target.replaceChildren();
  }
  function render(model) {
    // Keep the original full-render path for older or partial DOM environments.
    if (!target.childNodes || typeof target.insertBefore !== 'function' || typeof target.removeChild !== 'function') {
      entries = []; context = null; renderOriginal(target, model); return;
    }
    const nextContext = JSON.stringify([model.destination, model.kind]);
    const parts = model.kind === 'source' ? [{ kind: 'source', source: model.source }] : [
      ...(model.title ? [{ kind: 'document', title: model.title, blocks: [] }] : []),
      ...model.blocks.map(block => ({ kind: 'document', title: '', blocks: [block] }))
    ];
    const keys = parts.map(part => JSON.stringify(part));
    const owned = context === nextContext && target.childNodes.length === entries.length &&
      entries.every((entry, index) => target.childNodes[index] === entry.node);
    const old = owned ? entries : [];
    let prefix = 0, suffix = 0;
    while (prefix < old.length && prefix < keys.length && old[prefix].key === keys[prefix]) prefix++;
    while (suffix < old.length - prefix && suffix < keys.length - prefix &&
      old[old.length - 1 - suffix].key === keys[keys.length - 1 - suffix]) suffix++;
    const doc = target.ownerDocument || document, fragment = doc.createDocumentFragment(), fresh = [];
    // Prepare every changed node off-DOM before replacing anything. A rendering
    // failure cannot publish a partially updated preview or commit its signature.
    for (let index = prefix; index < keys.length - suffix; index++) {
      const holder = doc.createDocumentFragment();
      renderOriginal(holder, parts[index]);
      if (holder.childNodes.length !== 1) throw new Error('Could not prepare the current export preview block.');
      const node = holder.firstChild;
      fresh.push({ key: keys[index], node }); fragment.append(node);
    }
    if (!owned) target.replaceChildren(fragment);
    else {
      const anchor = suffix ? old[old.length - suffix].node : null;
      for (let index = prefix; index < old.length - suffix; index++) target.removeChild(old[index].node);
      if (fresh.length) target.insertBefore(fragment, anchor);
    }
    entries = [...old.slice(0, prefix), ...fresh, ...(suffix ? old.slice(old.length - suffix) : [])];
    context = nextContext;
  }
  return { render, clear };
}
