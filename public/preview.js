import { ARTICLE_BODY_LIMIT } from './writing-limits.js';
import { inlineParts } from './inline-render.js';
export { inlineParts } from './inline-render.js';
import { readMarkdownTable } from './markdown-table.js';
import { readMarkdownList } from './markdown-list.js';
// A bounded reading aid. Only explicit web links become navigation; no resources load.
export function previewBlocks(body) {
  if (typeof body !== 'string' || body.length > ARTICLE_BODY_LIMIT) throw new Error('Preview supports at most 60,000 body characters.');
  const lines = body.replaceAll('\r', '').split('\n');
  const result = [];
  let paragraph = [];
  const flush = () => { if (paragraph.length) result.push({ type: 'p', text: paragraph.join('\n') }); paragraph = []; };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) { flush(); continue; }
    const fence = /^ {0,3}(\x60{3,}|~{3,})(.*)$/.exec(line);
    if (fence) {
      flush(); const text = [];
      const closing = new RegExp('^ {0,3}' + (fence[1][0] === '~' ? '~' : '\\x60') + '{' + fence[1].length + ',}\\s*$');
      while (++i < lines.length && !closing.test(lines[i])) text.push(lines[i]);
      result.push({ type: 'pre', text: text.join('\n') }); continue;
    }
    const heading = /^ {0,3}(#{1,6})(?:[ \t]+(.*)|$)/.exec(line);
    if (heading) { flush(); result.push({ type: 'h' + Math.min(6, heading[1].length + 2), level: heading[1].length, text: (heading[2] || '').replace(/[ \t]+#+[ \t]*$/, '').trim() }); continue; }
    const list = readMarkdownList(lines, i);
    if (list) {
      flush(); result.push(...(list.supported ? list.blocks : [{ type: 'p', text: lines.slice(i, list.end).join('\n') }]));
      i = list.end - 1; continue;
    }
    const quote = /^> ?(.*)$/.exec(line);
    if (quote) {
      flush(); const text = [quote[1]];
      while (i + 1 < lines.length && /^> ?/.test(lines[i + 1])) text.push(lines[++i].replace(/^> ?/, ''));
      result.push({ type: 'blockquote', text: text.join('\n') }); continue;
    }
    const table = readMarkdownTable(lines, i);
    if (table) {
      flush();
      result.push(table.supported ? table.table : { type: 'p', text: lines.slice(i, table.end).join('\n') });
      i = table.end - 1; continue;
    }
    paragraph.push(line);
  }
  flush(); return result;
}
function appendInline(node, text) {
  const append = (target, parts) => {
    for (const part of parts) {
      if (part.type === 'text') target.append(document.createTextNode(part.text));
      else {
        const child = document.createElement(part.type);
        if (part.children) append(child, part.children); else child.textContent = part.text;
        if (part.type === 'a') { child.href = part.href; child.target = '_blank'; child.rel = 'noopener noreferrer'; child.setAttribute('aria-label', part.text + ' (opens in a new tab)'); }
        target.append(child);
      }
    }
  };
  append(node, inlineParts(text));
}
export function renderPreview(target, title, body) {
  const fragment = document.createDocumentFragment();
  const heading = document.createElement('h3'); heading.textContent = title || 'Untitled article'; fragment.append(heading);
  const renderList = list => {
    const node = document.createElement(list.type);
    if (list.type === 'ol' && list.start !== undefined) node.setAttribute('start', String(list.start));
    list.items.forEach((text, index) => { const item = document.createElement('li'); appendInline(item, text); for (const child of list.children?.[index] || []) item.append(renderList(child)); node.append(item); });
    return node;
  };
  for (const block of previewBlocks(body)) {
    if (block.items) { fragment.append(renderList(block)); continue; }
    if (block.type === 'table') {
      const region = document.createElement('div'), table = document.createElement('table');
      region.className = 'article-table'; region.tabIndex = 0; region.setAttribute('role', 'region'); region.setAttribute('aria-label', 'Article table, scroll horizontally if needed');
      const section = (name, rows, header) => {
        const group = document.createElement(name);
        for (const cells of rows) {
          const row = document.createElement('tr');
          cells.forEach((text, column) => { const cell = document.createElement(header ? 'th' : 'td'); if (header) cell.setAttribute('scope', 'col'); if (block.align[column]) cell.className = 'has-text-align-' + block.align[column]; appendInline(cell, text); row.append(cell); });
          group.append(row);
        }
        table.append(group);
      };
      section('thead', [block.head], true); if (block.rows.length) section('tbody', block.rows, false);
      region.append(table); fragment.append(region); continue;
    }
    const node = document.createElement(block.type);
    if (block.type === 'pre') { const code = document.createElement('code'); code.textContent = block.text; node.append(code); }
    else appendInline(node, block.text);
    fragment.append(node);
  }
  target.replaceChildren(fragment);
}
export function suggestFilename(title) {
  return String(title).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80).replace(/-$/, '') || 'untitled-article';
}
