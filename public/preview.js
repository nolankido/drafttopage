import { ARTICLE_BODY_LIMIT } from './writing-limits.js';
import { inlineParts } from './inline-render.js';
export { inlineParts } from './inline-render.js';
import { readMarkdownTable } from './markdown-table.js';
import { readMarkdownList } from './markdown-list.js';
import { thematicBreak, setextLevel, setextParagraph } from './markdown-block-syntax.js';
// A bounded reading aid. Only explicit web links become navigation; no resources load.
export function previewPassages(body) {
  if (typeof body !== 'string' || body.length > ARTICLE_BODY_LIMIT) throw new Error('Preview supports at most 60,000 body characters.');
  const original = body.split('\n'), lines = original.map(line => line.replaceAll('\r', ''));
  const offsets = []; let offset = 0;
  for (const line of original) { offsets.push(offset); offset += line.length + 1; }
  const result = [];
  const add = (start, end, blocks) => result.push({ start: offsets[start], end: offsets[end] + original[end].length, line: start + 1, endLine: end + 1, blocks });
  let paragraph = [], paragraphStart = 0, paragraphEligible = true;
  const flush = () => { if (paragraph.length) add(paragraphStart, paragraphStart + paragraph.length - 1, [{ type: 'p', text: paragraph.join('\n') }]); paragraph = []; paragraphEligible = true; };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) { flush(); continue; }
    const fence = /^ {0,3}(\x60{3,}|~{3,})(.*)$/.exec(line);
    if (fence) {
      flush(); const start = i, text = [];
      const closing = new RegExp('^ {0,3}' + (fence[1][0] === '~' ? '~' : '\\x60') + '{' + fence[1].length + ',}\\s*$');
      while (++i < lines.length && !closing.test(lines[i])) text.push(lines[i]);
      add(start, Math.min(i, lines.length - 1), [{ type: 'pre', text: text.join('\n') }]); continue;
    }
    const heading = /^ {0,3}(#{1,6})(?:[ \t]+(.*)|$)/.exec(line);
    if (heading) { flush(); add(i, i, [{ type: 'h' + Math.min(6, heading[1].length + 2), level: heading[1].length, text: (heading[2] || '').replace(/[ \t]+#+[ \t]*$/, '').trim() }]); continue; }
    const level = setextLevel(line);
    if (level && paragraph.length && paragraphEligible) {
      add(paragraphStart, i, [{ type: 'h' + (level + 2), level, text: paragraph.join('\n').trim(), headingStyle: 'setext' }]); paragraph = []; paragraphEligible = true; continue;
    }
    if (thematicBreak(line)) { flush(); add(i, i, [{ type: 'hr', text: '' }]); continue; }
    const list = readMarkdownList(lines, i);
    if (list) {
      flush(); add(i, list.end - 1, list.supported ? list.blocks : [{ type: 'p', text: lines.slice(i, list.end).join('\n') }]);
      i = list.end - 1; continue;
    }
    const quote = /^> ?(.*)$/.exec(line);
    if (quote) {
      flush(); const start = i, text = [quote[1]];
      while (i + 1 < lines.length && /^> ?/.test(lines[i + 1])) text.push(lines[++i].replace(/^> ?/, ''));
      add(start, i, [{ type: 'blockquote', text: text.join('\n') }]); continue;
    }
    const table = readMarkdownTable(lines, i);
    if (table) {
      flush();
      add(i, table.end - 1, [table.supported ? table.table : { type: 'p', text: lines.slice(i, table.end).join('\n') }]);
      i = table.end - 1; continue;
    }
    if (!paragraph.length) paragraphStart = i;
    paragraph.push(line); paragraphEligible &&= setextParagraph([line]);
  }
  flush(); return result;
}
export function previewBlocks(body) { return previewPassages(body).flatMap(passage => passage.blocks); }
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
// A shared inert DOM renderer. Source markup is always text, and images never load.
export function renderPreviewBlock(block) {
  if (block.type === 'hr') return document.createElement('hr');
  if (block.items) {
    if (!['ul', 'ol'].includes(block.type)) throw new Error('Unsupported preview list.');
    const node = document.createElement(block.type);
    if (block.type === 'ol' && block.start !== undefined) node.setAttribute('start', String(block.start));
    block.items.forEach((text, index) => { const item = document.createElement('li'); appendInline(item, text); for (const child of block.children?.[index] || []) item.append(renderPreviewBlock(child)); node.append(item); });
    return node;
  }
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
    region.append(table); return region;
  }
  if (!['p', 'pre', 'blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(block.type)) throw new Error('Unsupported preview block.');
  const node = document.createElement(block.type);
  if (block.type === 'pre') { const code = document.createElement('code'); code.textContent = block.text; node.append(code); }
  else appendInline(node, block.text);
  return node;
}
export function renderPreview(target, title, body, { wrapPassage } = {}) {
  const fragment = document.createDocumentFragment();
  const heading = document.createElement('h3'); heading.textContent = title || 'Untitled article'; fragment.append(heading);
  for (const [index, passage] of previewPassages(body).entries()) {
    const wrapper = wrapPassage?.(passage, index), destination = wrapper || fragment;
    if (wrapper) fragment.append(wrapper);
    for (const block of passage.blocks) destination.append(renderPreviewBlock(block));
  }
  target.replaceChildren(fragment);
}
export function suggestFilename(title) {
  return String(title).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80).replace(/-$/, '') || 'untitled-article';
}
