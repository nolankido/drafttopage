import { ARTICLE_BODY_LIMIT } from './writing-limits.js';
import { TABLE_LIMITS, readMarkdownTable, markdownTableRanges } from './markdown-table.js';
import { articleStructure } from './draft-review.js';

export const TABLE_CELL_LIMIT = 2000;
export const TABLE_PAGE_ROWS = 10;
export const TABLE_CHOICE_LIMIT = 40;
function validBody(body) {
  if (typeof body !== 'string' || body.length > ARTICLE_BODY_LIMIT || body.includes('\0')) throw new Error('The article supports at most 60,000 characters and no null characters.');
}
function boundary(body, position) {
  return Number.isInteger(position) && position >= 0 && position <= body.length && !(position > 0 && position < body.length && ((/[\uD800-\uDBFF]/.test(body[position - 1]) && /[\uDC00-\uDFFF]/.test(body[position])) || (body[position - 1] === '\r' && body[position] === '\n')));
}
export function copyEditableTable(value, { trim = false } = {}) {
  if (!value || !Array.isArray(value.head) || !Array.isArray(value.align) || !Array.isArray(value.rows) || value.head.length < 1 || value.head.length > TABLE_LIMITS.columns || value.align.length !== value.head.length || value.rows.length > TABLE_LIMITS.rows || value.align.some(align => ![null, 'left', 'center', 'right'].includes(align))) throw new Error('Use 1 to 12 columns, up to 100 data rows, and supported column alignment.');
  const row = cells => {
    if (!Array.isArray(cells) || cells.length !== value.head.length) throw new Error('Every table row must have the same column count.');
    return cells.map(text => {
      if (typeof text !== 'string' || text.length > TABLE_CELL_LIMIT || /[\r\n\0\u2028\u2029]/.test(text)) throw new Error('Each table cell supports one line of up to 2,000 characters. Edit larger or multiline cells directly in the article.');
      return trim ? text.trim() : text;
    });
  };
  return { head: row(value.head), align: [...value.align], rows: value.rows.map(row) };
}
export function emptyEditableTable() { return { head: ['', ''], align: [null, null], rows: [['', ''], ['', '']] }; }
const contentEnd = (body, range) => range.end - (body[range.end - 1] === '\r' ? 1 : 0);
export function tableEditTarget(body, start, end = start) {
  validBody(body);
  if (!boundary(body, start) || !boundary(body, end) || end < start) throw new Error('Choose a complete table or place the article cursor inside one.');
  const range = markdownTableRanges(body).find(item => start >= item.start && end <= item.end);
  if (!range) throw new Error('Choose a table from the list, place the article cursor inside a table, or create one at the article end.');
  if (!range.supported) throw new Error(range.reason + ' Edit this unsupported table directly; its source is kept.');
  const finish = contentEnd(body, range);
  return { kind: 'edit', body, start: range.start, end: finish, before: body.slice(range.start, finish), table: copyEditableTable(range.table), line: range.line };
}
export function newTableTarget(body) {
  validBody(body);
  if (articleStructure(body).at(-1)?.unclosed) throw new Error('Close the article code fence before adding a table at the end.');
  return { kind: 'append', body, start: body.length, end: body.length, before: '', table: emptyEditableTable(), line: body.split('\n').length };
}
export function recheckTableTarget(target, body, selectedStart) {
  if (!target) throw new Error('Choose or create a table first.');
  if (target.kind === 'append') return newTableTarget(body);
  const next = tableEditTarget(body, selectedStart);
  if (next.before !== target.before) throw new Error('The selected table has different source. Prepared cells are kept. Choose the exact unchanged table or start a new edit explicitly.');
  return next;
}
export function editableTableMarkdown(value, newline = '\n') {
  if (!['\n', '\r\n'].includes(newline)) throw new Error('Choose a supported line ending.');
  const table = copyEditableTable(value, { trim: true });
  if (table.head.some(text => !text)) throw new Error('Give every column a header before previewing a changed or new table.');
  const row = cells => '| ' + cells.map(text => text.replaceAll('|', '\\|')).join(' | ') + ' |';
  const marks = table.align.map(align => align === 'center' ? ':---:' : align === 'right' ? '---:' : align === 'left' ? ':---' : '---');
  const source = [row(table.head), row(marks), ...table.rows.map(row)].join(newline);
  if (source.length > ARTICLE_BODY_LIMIT) throw new Error('This table exceeds the 60,000-character article limit. Shorten its cells first.');
  const parsed = readMarkdownTable(source.split('\n'), 0);
  if (!parsed?.supported || parsed.end !== source.split('\n').length || JSON.stringify(copyEditableTable(parsed.table)) !== JSON.stringify(table)) throw new Error('These cell contents cannot round-trip through the table format. Check literal pipes and preceding backslashes; nothing was changed.');
  return source;
}
export function changeEditableTable(value, action, index) {
  const table = copyEditableTable(value);
  if (!Number.isInteger(index) || index < 0) throw new Error('Choose a valid table row or column.');
  if (action === 'insert-row') {
    if (table.rows.length >= TABLE_LIMITS.rows || index > table.rows.length) throw new Error('Tables support at most 100 data rows.');
    table.rows.splice(index, 0, Array(table.head.length).fill(''));
  } else if (action === 'remove-row') {
    if (index >= table.rows.length) throw new Error('Choose a current data row.');
    table.rows.splice(index, 1);
  } else if (action === 'insert-column') {
    if (table.head.length >= TABLE_LIMITS.columns || index > table.head.length) throw new Error('Tables support at most 12 columns.');
    table.head.splice(index, 0, ''); table.align.splice(index, 0, null); for (const row of table.rows) row.splice(index, 0, '');
  } else if (action === 'remove-column') {
    if (table.head.length <= 1 || index >= table.head.length) throw new Error('Keep at least one column. Use table removal to remove the whole table.');
    table.head.splice(index, 1); table.align.splice(index, 1); for (const row of table.rows) row.splice(index, 1);
  } else throw new Error('Choose an available table operation.');
  return table;
}
export function planTableEdit(target, value, body, mode = 'edit') {
  if (!target || body !== target.body) throw new Error('The article changed. Explicitly recheck the selected table or article end before applying. Prepared cells are kept.');
  if (!['edit', 'remove'].includes(mode) || !['edit', 'append'].includes(target.kind)) throw new Error('Choose a table edit or removal.');
  const current = target.kind === 'edit' ? tableEditTarget(body, target.start, target.end) : newTableTarget(body);
  if (current.start !== target.start || current.end !== target.end || current.before !== target.before) throw new Error('The table location changed. Choose it again.');
  if (mode === 'remove' && target.kind !== 'edit') throw new Error('Choose an existing article table before removing it.');
  let markdown = '', replacement = '';
  if (mode === 'edit') {
    const normalized = copyEditableTable(value, { trim: true });
    const same = target.kind === 'edit' && JSON.stringify(normalized) === JSON.stringify(copyEditableTable(current.table, { trim: true }));
    if (same) { markdown = current.before; replacement = current.before; }
    else {
      const newline = body.includes('\r\n') ? '\r\n' : '\n'; markdown = editableTableMarkdown(normalized, newline);
      if (target.kind === 'append') {
        const count = (body.match(/(?:\r?\n[ \t]*)+$/)?.[0].match(/\n/g) || []).length;
        replacement = (body.length ? newline.repeat(Math.max(0, 2 - count)) : '') + markdown;
      } else replacement = markdown;
    }
  }
  const result = body.slice(0, current.start) + replacement + body.slice(current.end);
  if (result.length > ARTICLE_BODY_LIMIT) throw new Error('The table change would exceed the 60,000-character article limit. Shorten the article first.');
  const prefix = target.kind === 'append' ? replacement.length - markdown.length : 0, selectionStart = current.start + prefix, selectionEnd = current.start + replacement.length;
  if (mode === 'edit' && !markdownTableRanges(result).some(range => range.supported && range.start === selectionStart && contentEnd(result, range) === selectionEnd)) throw new Error('The table cannot be placed here without changing its structure. The article is kept.');
  return { body: result, before: current.before, replacement, markdown, selectionStart, selectionEnd, mode, changed: result !== body };
}
