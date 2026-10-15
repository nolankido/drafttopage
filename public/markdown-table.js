import { ARTICLE_BODY_LIMIT } from './writing-limits.js';
// A bounded pipe-table subset. Rejected tables keep every source line as text.
export const TABLE_LIMITS = Object.freeze({ columns: 12, rows: 100 });
const startsBlock = line => /^(?: {4}|\t)|^ {0,3}(?:>|#{1,6}(?:\s|$)|[-*+]\s+|\d+[.)]\s+|\x60{3,}|~{3,})/.test(line);

export function tableCells(line) {
  if (typeof line !== 'string' || line.length > ARTICLE_BODY_LIMIT) throw new Error('Table rows support at most 60,000 characters.');
  const cells = []; let cell = '', separators = 0, leading = false, trailing = false;
  const text = line.trim();
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\\' && text[i + 1] === '\\') { cell += '\\\\'; i++; trailing = false; continue; }
    if (text[i] === '\\' && text[i + 1] === '|') { cell += '|'; i++; trailing = false; continue; }
    if (text[i] === '|') {
      if (i === 0) leading = true;
      cells.push(cell.trim()); cell = ''; separators++; trailing = i === text.length - 1;
    } else { cell += text[i]; trailing = false; }
  }
  cells.push(cell.trim());
  if (!separators) return null;
  if (leading) cells.shift();
  if (trailing) cells.pop();
  return cells;
}

export function readMarkdownTable(lines, index) {
  const header = lines[index]?.replace(/\r$/, ''), delimiter = lines[index + 1]?.replace(/\r$/, '');
  if (!header || !delimiter || startsBlock(header) || startsBlock(delimiter)) return null;
  const head = tableCells(header), marks = tableCells(delimiter);
  if (!head?.length || !marks?.length || !marks.every(cell => /^:?-+:?$/.test(cell))) return null;
  const align = marks.map(cell => cell.startsWith(':') && cell.endsWith(':') ? 'center' : cell.endsWith(':') ? 'right' : cell.startsWith(':') ? 'left' : null);
  let reason = head.length !== marks.length ? 'The header and delimiter have different column counts.' : marks.some(cell => !/^:?-{3,}:?$/.test(cell)) ? 'Use at least three dashes in each delimiter cell.' : head.length > TABLE_LIMITS.columns ? 'This table exceeds the 12-column limit.' : '';
  const rows = []; let end = index + 2;
  while (end < lines.length) {
    const line = lines[end].replace(/\r$/, '');
    if (!line.trim()) break;
    if (/^(?: {4}|\t)/.test(line) && tableCells(line)) {
      if (!reason) reason = 'Indented table rows are outside this table subset.';
      end++; continue;
    }
    if (startsBlock(line)) break;
    const cells = tableCells(line);
    if (!cells) break;
    if (cells.length !== head.length && !reason) reason = 'Every data row must have the same column count as the header; no cells are dropped or invented.';
    if (rows.length < TABLE_LIMITS.rows) rows.push(cells);
    else if (!reason) reason = 'This table exceeds the 100-data-row limit.';
    end++;
  }
  return { supported: !reason, reason, end, table: { type: 'table', head, align, rows } };
}

export function markdownTableRanges(body) {
  if (typeof body !== 'string' || body.length > ARTICLE_BODY_LIMIT) throw new Error('Tables support at most 60,000 article characters.');
  const lines = body.split('\n'), ranges = []; let position = 0, fence = null;
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index].replace(/\r$/, '');
    if (fence) {
      if (new RegExp('^ {0,3}' + (fence[0] === '~' ? '~' : '\\x60') + '{' + fence.length + ',}\\s*$').test(line)) fence = null;
    } else {
      const opening = /^ {0,3}(\x60{3,}|~{3,})/.exec(line);
      if (opening) fence = opening[1];
      else {
        const result = readMarkdownTable(lines, index);
        if (result) {
          const start = position, lineNumber = index + 1, source = lines.slice(index, result.end).join('\n');
          ranges.push({ ...result, start, end: start + source.length, headerEnd: start + line.length, line: lineNumber });
          position += source.length + 1; index = result.end - 1; continue;
        }
      }
    }
    position += lines[index].length + 1;
  }
  return ranges;
}

// Inline content is rendered by the same safe, escaped formatter as the article.
export function tableHTML(table, inline, { wordpress = false, portable = false } = {}) {
  const row = (cells, header = false) => '<tr>' + cells.map((text, column) => {
    const tag = header ? 'th' : 'td', align = ['left', 'center', 'right'].includes(table.align[column]) ? table.align[column] : null;
    return '<' + tag + (header ? ' scope="col"' : '') + (align ? ' class="has-text-align-' + align + '" data-align="' + align + '"' : '') + (portable ? ' style="text-align:' + (align || 'left') + '"' : '') + '>' + inline(text) + '</' + tag + '>';
  }).join('') + '</tr>';
  const html = '<table' + (wordpress ? ' class="has-fixed-layout"' : '') + '><thead>' + row(table.head, true) + '</thead>' + (table.rows.length ? '<tbody>' + table.rows.map(cells => row(cells)).join('') + '</tbody>' : '') + '</table>';
  return wordpress ? '<figure class="wp-block-table">' + html + '</figure>' : '<div class="article-table" role="region" aria-label="Article table, scroll horizontally if needed" tabindex="0"' + (portable ? ' style="max-width:100%;overflow-x:auto"' : '') + '>' + html + '</div>';
}
