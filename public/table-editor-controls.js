import { revealDetails } from './disclosure.js';
import { TABLE_LIMITS, markdownTableRanges } from './markdown-table.js';
import { TABLE_CELL_LIMIT, TABLE_PAGE_ROWS, TABLE_CHOICE_LIMIT, copyEditableTable, tableEditTarget, newTableTarget, recheckTableTarget, changeEditableTable, planTableEdit } from './table-editing.js';
import { renderPreview } from './preview.js';
import { installPasteGuard } from './paste-guard.js';
import { revealArticleSelection } from './editing.js';

export function installTableEditor({ getBody, apply, workChanged, report, isBusy = () => false, confirmAction = message => confirm(message), reveal = revealArticleSelection, render = renderPreview, inspect = markdownTableRanges }) {
  const $ = id => document.getElementById(id);
  let target = null, cells = null, page = 0, preview = null, snapshot = null, tables = [], guards = [], generation = 0, message = 'Choose a table or create one at the article end.';
  const hasWork = () => Boolean(target);
  const dirty = () => Boolean(target && cells && JSON.stringify(cells) !== JSON.stringify(target.table));
  const inventoryVisible = () => {
    if (!$('table-editor-panel').open) return false;
    for (let parent = $('table-editor-panel').parentElement; parent; parent = parent.parentElement) {
      if (parent.tagName === 'DETAILS' && !parent.open) return false;
    }
    return true;
  };
  const status = text => { message = text; $('table-editor-status').textContent = text; };
  const selectedRange = () => { const value = $('table-select').value; return /^\d+$/.test(value) ? tables[Number(value)] : null; };
  function purgePreview() {
    preview = null; $('table-before').value = ''; $('table-after').value = ''; $('table-reading-preview').replaceChildren(); $('table-change-preview').hidden = true; $('table-change-summary').textContent = '';
  }
  function refresh() {
    const body = getBody(), busy = isBusy(), stale = target && target.body !== body;
    const visible = inventoryVisible();
    if (!visible && snapshot !== body) {
      // Keep an unchanged selection across closing, but never retain an old article list.
      snapshot = null; tables = []; $('table-select').replaceChildren();
    } else if (visible && snapshot !== body) {
      snapshot = body;
      try { tables = inspect(body); } catch { tables = []; }
      $('table-select').replaceChildren(...tables.slice(0, TABLE_CHOICE_LIMIT).map((table, index) => {
        const option = document.createElement('option'); option.value = String(index); option.textContent = 'Table ' + (index + 1) + ' on line ' + table.line + (table.supported ? ' · ' + table.table.head.length + ' columns, ' + table.table.rows.length + ' rows' : ' · source editing needed'); return option;
      }));
    }
    if (stale) purgePreview();
    $('table-list-status').textContent = !visible ? 'Open table editing to inspect the current article tables. Prepared cells are kept.' : tables.length + ' recognized pipe table(s).' + (tables.length > TABLE_CHOICE_LIMIT ? ' Showing the first 40; use the article cursor for later tables.' : '') + ' Code and other table formats are outside this list.';
    for (const id of ['start-table-editor','table-use-cursor','table-create']) $(id).disabled = busy;
    $('table-select').disabled = busy || !visible || !tables.length; $('table-open-selected').disabled = busy || !visible || !tables.length;
    $('table-recheck').disabled = busy || !target || !stale;
    $('table-recheck').textContent = target?.kind === 'append' ? 'Recheck article end, keep prepared cells' : 'Recheck selected table, keep prepared cells';
    $('table-target-status').textContent = !target ? 'Choose an existing table or create one.' : stale ? 'The article changed. Prepared cells are kept. Select the exact unchanged table and recheck, or recheck the article end for a new table.' : target.kind === 'append' ? 'New table will be added at the article end.' : 'Editing the complete table on line ' + target.line + '.';
    $('table-working').hidden = !cells;
    for (const control of $('table-grid').querySelectorAll('textarea,select,button')) control.disabled = busy || control.dataset.available === 'false';
    $('table-previous-page').disabled = busy || !cells || page === 0;
    $('table-next-page').disabled = busy || !cells || (page + 1) * TABLE_PAGE_ROWS >= cells.rows.length;
    $('table-add-row').disabled = busy || !cells || cells.rows.length >= TABLE_LIMITS.rows;
    $('table-add-column').disabled = busy || !cells || cells.head.length >= TABLE_LIMITS.columns;
    $('table-preview-change').disabled = busy || !target || Boolean(stale);
    $('table-preview-remove').disabled = busy || target?.kind !== 'edit' || Boolean(stale);
    $('table-apply').disabled = busy || !preview || Boolean(stale);
    $('table-apply').textContent = preview?.plan.mode === 'remove' ? 'Apply table removal' : 'Apply table change';
    $('table-discard').disabled = busy || !target;
    $('table-page-status').textContent = !cells ? '' : cells.rows.length ? 'Rows ' + (page * TABLE_PAGE_ROWS + 1) + ' to ' + Math.min((page + 1) * TABLE_PAGE_ROWS, cells.rows.length) + ' of ' + cells.rows.length + '. All rows are kept in preparation.' : 'Header only. Add a data row when needed.';
    $('table-editor-status').textContent = stale ? 'The article changed and its old table preview was cleared. Explicitly recheck the location before applying.' : message;
  }
  function field(id, labelText, value, update) {
    const currentGeneration = generation;
    const label = document.createElement('label'), input = document.createElement('textarea'); label.htmlFor = id; label.textContent = labelText;
    input.id = id; input.rows = 2; input.maxLength = TABLE_CELL_LIMIT; input.value = value; input.setAttribute('aria-describedby', 'table-cell-help');
    guards.push(installPasteGuard({ element: input, limit: TABLE_CELL_LIMIT, label: labelText, report: text => { if (text) { status(text); report(text); } } }));
    input.addEventListener('input', () => { if (isBusy() || currentGeneration !== generation) return; update(input.value); purgePreview(); status('Table cells changed. Preview again before applying.'); refresh(); workChanged(); });
    return [label, input];
  }
  function action(text, callback, available = true) {
    const currentGeneration = generation;
    const button = document.createElement('button'); button.type = 'button'; button.className = 'secondary'; button.textContent = text;
    button.dataset.available = String(available); button.addEventListener('click', () => { if (!isBusy() && available && currentGeneration === generation) callback(); }); return button;
  }
  function shape(actionName, index) {
    if (isBusy() || !cells) return;
    try {
      if (actionName === 'remove-row' && cells.rows[index]?.some(text => text.trim()) && !confirmAction('Remove data row ' + (index + 1) + ' from this table preparation? Its cell text will be discarded from preparation. The article is kept until you apply.')) return;
      if (actionName === 'remove-column' && [cells.head[index], ...cells.rows.map(row => row[index])].some(text => text?.trim()) && !confirmAction('Remove column ' + (index + 1) + ' and its cell text from this preparation? The article is kept until you apply.')) return;
      cells = changeEditableTable(cells, actionName, index);
      if (actionName === 'insert-row') page = Math.floor(index / TABLE_PAGE_ROWS);
      page = Math.max(0, Math.min(page, Math.ceil(cells.rows.length / TABLE_PAGE_ROWS) - 1));
      purgePreview(); grid(); status('Table structure changed in preparation. Preview before applying.'); refresh(); workChanged();
      $('table-grid').focus();
    } catch (failure) { status(failure.message); report(failure.message); }
  }
  function grid() {
    generation++;
    for (const guard of guards) guard.clear(); guards = [];
    const table = document.createElement('table'), caption = document.createElement('caption'), head = document.createElement('thead'), heading = document.createElement('tr'), corner = document.createElement('th');
    caption.textContent = 'Prepared table cells'; corner.textContent = 'Rows and columns'; corner.scope = 'col'; heading.append(corner);
    cells.head.forEach((text, column) => {
      const cell = document.createElement('th'); cell.scope = 'col';
      cell.append(...field('table-head-' + column, 'Column ' + (column + 1) + ' header', text, value => { cells.head[column] = value; }));
      const label = document.createElement('label'), align = document.createElement('select'); label.htmlFor = 'table-align-' + column; label.textContent = 'Column ' + (column + 1) + ' alignment'; align.id = label.htmlFor;
      for (const [value, title] of [['','Default'],['left','Left'],['center','Center'],['right','Right']]) { const option = document.createElement('option'); option.value = value; option.textContent = title; align.append(option); }
      const currentGeneration = generation;
      align.value = cells.align[column] || ''; align.addEventListener('change', () => { if (isBusy() || currentGeneration !== generation) return; cells.align[column] = align.value || null; purgePreview(); status('Column alignment changed. Preview before applying.'); refresh(); workChanged(); });
      cell.append(label, align, action('Insert column after ' + (column + 1), () => shape('insert-column', column + 1), cells.head.length < TABLE_LIMITS.columns), action('Remove column ' + (column + 1), () => shape('remove-column', column), cells.head.length > 1)); heading.append(cell);
    });
    head.append(heading); const body = document.createElement('tbody');
    for (let row = page * TABLE_PAGE_ROWS; row < Math.min((page + 1) * TABLE_PAGE_ROWS, cells.rows.length); row++) {
      const line = document.createElement('tr'), rowHead = document.createElement('th'); rowHead.scope = 'row';
      const label = document.createElement('span'); label.textContent = 'Row ' + (row + 1); rowHead.append(label, action('Insert row after ' + (row + 1), () => shape('insert-row', row + 1), cells.rows.length < TABLE_LIMITS.rows), action('Remove row ' + (row + 1), () => shape('remove-row', row))); line.append(rowHead);
      cells.rows[row].forEach((text, column) => { const cell = document.createElement('td'); cell.append(...field('table-cell-' + row + '-' + column, 'Row ' + (row + 1) + ', column ' + (column + 1), text, value => { cells.rows[row][column] = value; })); line.append(cell); }); body.append(line);
    }
    table.append(caption, head, body); $('table-grid').replaceChildren(table);
  }
  function load(next) {
    if (hasWork() && (dirty() || target.kind === 'append') && !confirmAction('Replace the current table preparation? Unsaved cell edits are excluded from backups and checkpoints. The article is kept.')) return false;
    target = next; cells = copyEditableTable(next.table); page = 0; purgePreview(); grid(); revealDetails($('table-editor-panel'));
    status('Table preparation ready. Edit cells, preview the result, then apply.'); refresh(); workChanged(); $('table-head-0').focus(); return true;
  }
  function choose(start, end = start) {
    if (isBusy()) return false;
    try { return load(tableEditTarget(getBody(), start, end)); }
    catch (failure) { status(failure.message); report(failure.message); return false; }
  }
  function clear() {
    target = null; cells = null; page = 0; generation++; purgePreview(); for (const guard of guards) guard.clear(); guards = []; $('table-grid').replaceChildren();
    status('Table preparation cleared. Article writing and approval are kept.'); refresh(); workChanged();
  }
  $('start-table-editor').addEventListener('click', () => {
    if (isBusy()) return; revealDetails($('table-editor-panel'));
    if (!target && !choose($('body').selectionStart, $('body').selectionEnd)) { refresh(); $('table-create').focus(); }
    else if (target) $('table-grid').focus();
  });
  $('table-use-cursor').addEventListener('click', () => choose($('body').selectionStart, $('body').selectionEnd));
  $('table-open-selected').addEventListener('click', () => {
    if (isBusy() || !inventoryVisible()) return; const range = selectedRange();
    if (snapshot !== getBody()) { refresh(); report('The article changed. Choose from the current table list.'); return; }
    if (range && !choose(range.start)) { $('body').focus(); $('body').setSelectionRange(range.start, range.end); try { reveal($('body')); } catch { /* Exact source stays selected. */ } }
  });
  $('table-create').addEventListener('click', () => { if (!isBusy()) { try { load(newTableTarget(getBody())); } catch (failure) { status(failure.message); report(failure.message); } } });
  $('table-recheck').addEventListener('click', () => {
    if (isBusy() || !target) return;
    try {
      if (snapshot !== getBody()) { refresh(); throw new Error('The article changed again. Select its current table before rechecking.'); }
      const range = selectedRange(); if (target.kind === 'edit' && !range) throw new Error('Select the exact unchanged table first.');
      target = recheckTableTarget(target, getBody(), range?.start); purgePreview(); status('Location explicitly rechecked. Prepared cells are kept. Preview again before applying.'); refresh(); workChanged();
    } catch (failure) { status(failure.message); report(failure.message); }
  });
  $('table-add-row').addEventListener('click', () => { if (cells) shape('insert-row', cells.rows.length); });
  $('table-add-column').addEventListener('click', () => { if (cells) shape('insert-column', cells.head.length); });
  for (const [id, delta] of [['table-previous-page',-1],['table-next-page',1]]) $(id).addEventListener('click', () => {
    if (isBusy() || !cells) return; const next = page + delta;
    if (next < 0 || next * TABLE_PAGE_ROWS >= cells.rows.length) return; page = next; grid(); refresh(); $('table-grid').focus();
  });
  function prepare(mode) {
    if (isBusy()) return; purgePreview();
    try {
      const plan = planTableEdit(target, cells, getBody(), mode); preview = { plan, cells: JSON.stringify(cells) };
      $('table-before').value = plan.before; $('table-after').value = plan.replacement;
      $('table-change-summary').textContent = mode === 'remove' ? 'The entire selected table will be removed. Pending cell edits are not used. Surrounding article text is kept.' : !plan.changed ? 'This table already matches. Writing and approval will be kept.' : cells.head.length + ' columns and ' + cells.rows.length + ' data rows. Cell edges are trimmed and pipes escaped. All article text outside this table is kept exactly.';
      if (mode !== 'remove') render($('table-reading-preview'), 'Prepared table', plan.markdown);
      $('table-reading-panel').hidden = mode === 'remove'; $('table-change-preview').hidden = false;
      status('Table preview ready. Inspect the prepared table and exact source before applying.');
    } catch (failure) { purgePreview(); status(failure.message); report(failure.message); }
    refresh();
  }
  $('table-preview-change').addEventListener('click', () => prepare('edit'));
  $('table-preview-remove').addEventListener('click', () => prepare('remove'));
  $('table-apply').addEventListener('click', () => {
    if (isBusy()) return;
    try {
      if (!preview || preview.cells !== JSON.stringify(cells)) throw new Error('Preview the current table preparation before applying.');
      const plan = planTableEdit(target, cells, getBody(), preview.plan.mode);
      if (plan.changed) apply(plan, plan.mode === 'remove' ? 'Before table removal' : 'Before table change');
      clear(); $('body').focus(); $('body').setSelectionRange(plan.selectionStart, plan.selectionEnd); try { reveal($('body')); } catch { /* Exact selection remains available. */ }
      const text = plan.changed ? 'Table ' + (plan.mode === 'remove' ? 'removed' : 'change applied') + '. Previous writing is in Revisions in this tab. Approval and the linked-image choice were cleared.' : 'The table already matches. Writing and approval were kept.';
      status(text); report(text);
    } catch (failure) { status(failure.message); report(failure.message); refresh(); }
  });
  $('table-discard').addEventListener('click', () => { if (!isBusy()) clear(); });
  $('table-editor-panel').addEventListener('toggle', () => { if (!$('table-editor-panel').open) purgePreview(); refresh(); });
  for (let parent = $('table-editor-panel').parentElement; parent; parent = parent.parentElement) {
    if (parent.tagName === 'DETAILS') parent.addEventListener('toggle', refresh);
  }
  refresh(); return { refresh, clear, hasWork, editTable: choose };
}
