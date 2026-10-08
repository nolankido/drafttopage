// Deliberately small text-only preview. Never parses HTML or creates links/images.
export function previewBlocks(body) {
  if (typeof body !== 'string' || body.length > 12000) throw new Error('Preview supports at most 12,000 body characters.');
  return body.replaceAll('\r', '').split(/\n\s*\n/).filter(Boolean).map(block => {
    const heading = /^(#{1,3}) ([^\n]+)$/.exec(block);
    if (heading) return { type: heading[1].length === 1 ? 'h3' : 'h4', text: heading[2] };
    const lines = block.split('\n');
    if (lines.every(line => /^[-*] +/.test(line))) return { type: 'ul', items: lines.map(line => line.replace(/^[-*] +/, '')) };
    if (lines.every(line => /^\d+\. +/.test(line))) return { type: 'ol', items: lines.map(line => line.replace(/^\d+\. +/, '')) };
    return { type: 'p', text: block };
  });
}
export function renderPreview(target, title, body) {
  const fragment = document.createDocumentFragment();
  const heading = document.createElement('h3'); heading.textContent = title || 'Untitled article'; fragment.append(heading);
  for (const block of previewBlocks(body)) {
    const node = document.createElement(block.type);
    if (block.items) for (const text of block.items) { const item = document.createElement('li'); item.textContent = text; node.append(item); }
    else node.textContent = block.text;
    fragment.append(node);
  }
  target.replaceChildren(fragment);
}
export function suggestFilename(title) {
  return String(title).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80).replace(/-$/, '') || 'untitled-article';
}
