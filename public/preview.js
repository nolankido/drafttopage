// A bounded reading aid. Source markup is always data; links and images remain text.
export function previewBlocks(body) {
  if (typeof body !== 'string' || body.length > 12000) throw new Error('Preview supports at most 12,000 body characters.');
  const lines = body.replaceAll('\r', '').split('\n');
  const result = [];
  let paragraph = [];
  const flush = () => { if (paragraph.length) result.push({ type: 'p', text: paragraph.join('\n') }); paragraph = []; };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) { flush(); continue; }
    const fence = /^(\x60{3,}|~{3,})([^ ]*)\s*$/.exec(line);
    if (fence) {
      flush(); const text = [];
      const closing = new RegExp('^' + (fence[1][0] === '~' ? '~' : '\\x60') + '{' + fence[1].length + ',}\\s*$');
      while (++i < lines.length && !closing.test(lines[i])) text.push(lines[i]);
      result.push({ type: 'pre', text: text.join('\n') }); continue;
    }
    const heading = /^(#{1,6}) +(.+)$/.exec(line);
    if (heading) { flush(); result.push({ type: 'h' + Math.min(6, heading[1].length + 2), text: heading[2] }); continue; }
    const unordered = /^[-*] +(.+)$/.exec(line);
    const ordered = /^\d+\. +(.+)$/.exec(line);
    if (unordered || ordered) {
      flush(); const pattern = unordered ? /^[-*] +(.+)$/ : /^\d+\. +(.+)$/;
      const items = [(unordered || ordered)[1]];
      while (i + 1 < lines.length && pattern.test(lines[i + 1])) items.push(pattern.exec(lines[++i])[1]);
      result.push({ type: unordered ? 'ul' : 'ol', items }); continue;
    }
    const quote = /^> ?(.*)$/.exec(line);
    if (quote) {
      flush(); const text = [quote[1]];
      while (i + 1 < lines.length && /^> ?/.test(lines[i + 1])) text.push(lines[++i].replace(/^> ?/, ''));
      result.push({ type: 'blockquote', text: text.join('\n') }); continue;
    }
    paragraph.push(line);
  }
  flush(); return result;
}
export function inlineParts(text) {
  // No recursion, raw markup execution, URL parsing, or remote resources.
  const pattern = /(\x60([^\x60\n]+)\x60|\*\*([^*\n]+)\*\*|\*([^*\n]+)\*|_([^_\n]+)_)/g;
  const parts = []; let offset = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > offset) parts.push({ type: 'text', text: text.slice(offset, match.index) });
    parts.push({ type: match[2] ? 'code' : match[3] ? 'strong' : 'em', text: match[2] || match[3] || match[4] || match[5] });
    offset = match.index + match[0].length;
  }
  if (offset < text.length) parts.push({ type: 'text', text: text.slice(offset) });
  return parts;
}
function appendInline(node, text) {
  for (const part of inlineParts(text)) {
    if (part.type === 'text') node.append(document.createTextNode(part.text));
    else { const child = document.createElement(part.type); child.textContent = part.text; node.append(child); }
  }
}
export function renderPreview(target, title, body) {
  const fragment = document.createDocumentFragment();
  const heading = document.createElement('h3'); heading.textContent = title || 'Untitled article'; fragment.append(heading);
  for (const block of previewBlocks(body)) {
    const node = document.createElement(block.type);
    if (block.items) for (const text of block.items) { const item = document.createElement('li'); appendInline(item, text); node.append(item); }
    else if (block.type === 'pre') { const code = document.createElement('code'); code.textContent = block.text; node.append(code); }
    else appendInline(node, block.text);
    fragment.append(node);
  }
  target.replaceChildren(fragment);
}
export function suggestFilename(title) {
  return String(title).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80).replace(/-$/, '') || 'untitled-article';
}
