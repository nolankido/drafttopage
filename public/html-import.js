import { ARTICLE_BODY_LIMIT, MAX_IMPORT_BYTES } from './writing-limits.js';
import { htmlLinkResolver } from './html-link-context.js';
import { markdownFromInline } from './inline-markdown.js';

const MAX_NODES = 12000, MAX_DEPTH = 32, MAX_TAGS = 6000;
const controls = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
const omitted = new Set('head title meta link script style template noscript iframe object embed svg math canvas audio video source track input button select textarea form'.split(' '));
const blocks = new Set('html body div section article main header footer nav aside figure figcaption address p h1 h2 h3 h4 h5 h6 ul ol li table pre blockquote hr'.split(' '));
const tag = node => node.nodeType === 1 ? node.localName.toLowerCase() : '';
const children = node => Array.from(node.childNodes || []);
const attr = (node, name) => node.nodeType === 1 ? node.getAttribute(name) : null;
const escapeText = text => text.replace(/[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/g, '\\$&');
const whitespace = text => text.replace(/[\s\u00a0]+/gu, ' ');
function styles(node) {
  const result = new Map();
  for (const entry of (attr(node, 'style') || '').split(';')) {
    const colon = entry.indexOf(':');
    if (colon > 0) result.set(entry.slice(0, colon).trim().toLowerCase(), entry.slice(colon + 1).trim().toLowerCase().replace(/\s*!important$/, ''));
  }
  return result;
}
function inlineDecoration(node) {
  let value, important = false;
  for (const entry of (attr(node, 'style') || '').split(';')) {
    const colon = entry.indexOf(':'), key = entry.slice(0, colon).trim().toLowerCase();
    if (colon < 1 || !['text-decoration', 'text-decoration-line'].includes(key)) continue;
    const raw = entry.slice(colon + 1).trim().toLowerCase(), priority = /\s*!important$/.test(raw);
    if (important && !priority) continue;
    value = raw.replace(/\s*!important$/, ''); important = priority;
  }
  return value;
}

// Only detached template contents are parsed. No source node is ever attached to the page.
export function parseHTMLArticle(source, options = {}) {
  if (typeof source !== 'string' || new TextEncoder().encode(source).byteLength > MAX_IMPORT_BYTES) throw new Error('Choose formatted HTML no larger than 512 KiB.');
  if (controls.test(source)) throw new Error('The HTML contains unsupported control characters.');
  if ((source.match(/<[A-Za-z]/g) || []).length > MAX_TAGS) throw new Error('The HTML has too many elements. Copy a smaller article selection.');
  const template = document.createElement('template');
  template.innerHTML = source;
  return htmlTreeToMarkdown(template.content, options);
}

// The tree converter is independent of browser parsing so its limits and losses can be tested.
export function htmlTreeToMarkdown(root, { firstRowHeaders = false, sourceURL = '' } = {}) {
  const resolveLink = htmlLinkResolver(sourceURL);
  let count = 0;
  const stack = [[root, 0]], blockDescendants = new WeakSet();
  while (stack.length) {
    const [node, depth] = stack.pop();
    if (++count > MAX_NODES || depth > MAX_DEPTH) throw new Error('The HTML is too complex. Copy a smaller article selection.');
    if (node.nodeType === 3 && controls.test(node.nodeValue)) throw new Error('The decoded HTML contains unsupported control characters.');
    for (const child of children(node)) stack.push([child, depth + 1]);
  }
  function mark(node) {
    let hasBlock = false;
    for (const child of children(node)) if (mark(child) || blocks.has(tag(child))) hasBlock = true;
    if (hasBlock) blockDescendants.add(node);
    return hasBlock;
  }
  mark(root);
  const notices = new Map();
  const warn = message => notices.set(message, (notices.get(message) || 0) + 1);
  const checkboxRole = node => (attr(node, 'role') || '').trim().toLowerCase().split(/\s+/).includes('checkbox');
  function skip(node) {
    const name = tag(node);
    if (name === 'base') { warn('Source HTML base URLs were ignored. Only the source page URL you supply is used for relative links.'); return true; }
    if (omitted.has(name)) { warn('Embedded, interactive, or document-only content was omitted.'); return true; }
    const style = styles(node);
    if (node.nodeType === 1 && (node.hasAttribute('hidden') || attr(node, 'aria-hidden')?.toLowerCase() === 'true' || style.get('display') === 'none' || style.get('visibility') === 'hidden')) {
      warn('Explicitly hidden content was omitted.'); return true;
    }
    if (name !== 'li' && (checkboxRole(node) || attr(node, 'aria-checked') !== null)) throw new Error('Checkbox state outside a list item cannot be preserved. Choose a supported checklist selection before importing.');
    if (name === 'ins' || name === 'del') throw new Error('Resolve tracked changes before importing this HTML. Current writing is unchanged.');
    return false;
  }
  function rejectFlattenedChecklist(node) {
    if (tag(node) === 'li' && (checkboxRole(node) || attr(node, 'aria-checked') !== null)) throw new Error('Checklist items inside this container cannot be preserved. Move the checklist into the main article before importing.');
  }
  function plain(node) {
    if (node.nodeType === 3) return node.nodeValue;
    if (node.nodeType !== 1 && node.nodeType !== 11) return '';
    if (skip(node)) return '';
    rejectFlattenedChecklist(node);
    if (tag(node) === 'br') return '\n';
    if (tag(node) === 'img') { warn('Images were replaced with text placeholders; no image was loaded.'); return '[Image: ' + (attr(node, 'alt') || 'no description supplied') + ']'; }
    return children(node).map(plain).join('');
  }
  function strikeFormatting(node, style = styles(node), decoration = inlineDecoration(node)) {
    let strike = decoration !== undefined ? /(?:^|\s)line-through(?:\s|$)/.test(decoration) : tag(node) === 's' || tag(node) === 'strike';
    if (strike && (style.get('text-decoration-style') === 'double' || /(?:^|\s)double(?:\s|$)/.test(decoration || ''))) { strike = false; warn('Double strikethrough was simplified to plain text.'); }
    else if (strike && /(?:dotted|dashed|wavy)/.test(style.get('text-decoration-style') || decoration || '')) warn('Strikethrough line styling was simplified to a single ordinary line.');
    return strike;
  }
  // Carry explicit normal-weight overrides through the enclosing bold style
  // before serializing; a simple nested span cannot cancel a parent <strong>.
  const resolveWeight = value => value === 'bold' || Number(value) >= 600;
  function reconcileWeightOverrides(nodes) {
    const hasOverride = parts => parts.some(p => p.type === 'unstrong' || p.children && hasOverride(p.children));
    if (!hasOverride(nodes)) return nodes;
    const runs = [];
    const walk = (parts, state) => {
      for (const part of parts) {
        if (part.type === 'unstrong') { walk(part.children, { ...state, strong: false }); continue; }
        if (['strong', 'em', 's'].includes(part.type)) { walk(part.children, { ...state, [part.type]: true }); continue; }
        if (part.type === 'a') { walk(part.children, { ...state, href: part.href }); continue; }
        if (['text', 'code'].includes(part.type)) runs.push({ text: part.text, type: part.type, ...state });
      }
    };
    walk(nodes, { strong: false, em: false, s: false, href: '' });
    const result = []; let active = [], targets = [result];
    for (const run of runs) {
      const path = [
        ...(run.s ? [{ type: 's' }] : []),
        ...(run.strong ? [{ type: 'strong' }] : []),
        ...(run.em ? [{ type: 'em' }] : []),
        ...(run.href ? [{ type: 'a', href: run.href }] : [])
      ];
      let common = 0;
      while (common < path.length && common < active.length && path[common].type === active[common].type && path[common].href === active[common].href) common++;
      active.length = common; targets.length = common + 1;
      for (const item of path.slice(common)) {
        const target = { ...item, children: [] };
        targets.at(-1).push(target); targets.push(target.children); active.push(item);
      }
      targets.at(-1).push({ type: run.type, text: run.text });
    }
    return result;
  }
  const boldWithin = (node, inherited = false) => {
    const style = styles(node);
    if (style.has('font-weight')) return resolveWeight(style.get('font-weight'));
    return inherited || ['strong', 'b'].includes(tag(node));
  };
  const inheritedInline = (node, bold) => writeInline(bold ? [{ type: 'strong', children: inlineNodes(node) }] : inlineNodes(node));
  function inlineNodes(node, inLink = false) {
    const text = value => [{ type: 'text', text: value }];
    if (node.nodeType === 3) return text(whitespace(node.nodeValue));
    if (node.nodeType !== 1 && node.nodeType !== 11 || skip(node)) return [];
    rejectFlattenedChecklist(node);
    const name = tag(node);
    if (name === 'img') { warn('Images were replaced with text placeholders; no image was loaded.'); return text('[Image: ' + whitespace(attr(node, 'alt') || 'no description supplied') + ']'); }
    if (name === 'br') return text('\n');
    if (name === 'code') {
      const raw = children(node).map(plain).join('');
      if (/[\r\n]/.test(raw)) { warn('Inline code with line breaks was kept as plain text.'); return text(whitespace(raw)); }
      return [{ type: 'code', text: raw }];
    }
    let content = children(node).flatMap(child => inlineNodes(child, inLink || name === 'a'));
    if (name === 'a') {
      const label = whitespace(children(node).map(plain).join('')).trim(), resolved = resolveLink(attr(node, 'href')), href = resolved.href;
      if (!href || inLink) { warn('Unsafe, unresolved relative, missing, or nested link targets were omitted; their text was kept.'); return content; }
      if (resolved.relative) warn('A relative link target was resolved using your source page URL. Inspect the resulting article URLs before sharing; they have not been fetched or verified.');
      if (!label || /[\[\]\\]/.test(label) || content.some(part => part.type === 'text' && /[\r\n]/.test(part.text))) {
        warn('A link label could not be represented as a Markdown link; its safe URL was kept as text.');
        return text((label ? label + ' ' : '') + '(' + href + ')');
      }
      content = [{ type: 'a', href, children: content }];
    }
    const style = styles(node), weight = style.get('font-weight');
    const bold = weight === undefined ? name === 'strong' || name === 'b' : resolveWeight(weight);
    const italic = style.has('font-style') ? style.get('font-style') === 'italic' : name === 'em' || name === 'i';
    const decoration = inlineDecoration(node);
    const strike = strikeFormatting(node, style, decoration);
    if (['sup', 'sub', 'u', 'mark'].includes(name) || decoration && /(?:^|\s)(?:underline|overline)(?:\s|$)/.test(decoration)) warn('Some inline formatting was simplified to plain text.');
    if ((bold || italic || strike) && /[\r\n]/.test(children(node).map(plain).join(''))) { warn('Multiline emphasis was simplified.'); return content; }
    if (bold) content = [{ type: 'strong', children: content }];
    else if (weight !== undefined) content = [{ type: 'unstrong', children: content }];
    if (italic) content = [{ type: 'em', children: content }];
    if (strike) content = [{ type: 's', children: content }];
    return content;
  }
  function writeInline(nodes) {
    const result = markdownFromInline(reconcileWeightOverrides(nodes));
    if (result.simplified) warn('Ambiguous or overly complex inline formatting was simplified to literal text with safe link URLs.');
    return result.markdown;
  }
  const inline = node => writeInline(inlineNodes(node));
  function flattened(nodes, strike = false) {
    const pieces = nodes.flatMap(node => {
      if (blocks.has(tag(node))) { warn('Paragraph breaks inside a list item or table cell were simplified.'); return [...inlineNodes(node), { type: 'text', text: ' ' }]; }
      return inlineNodes(node);
    });
    const simplify = parts => parts.map(part => {
      if (part.type === 'text' || part.type === 'code') {
        if (/[\r\n]/.test(part.text)) warn('Line breaks inside a list item or table cell were simplified.');
        return { ...part, text: whitespace(part.text) };
      }
      return { ...part, children: simplify(part.children) };
    });
    const content = simplify(pieces);
    return writeInline(strike ? [{ type: 's', children: content }] : content).trim();
  }
  function checkboxState(item, depth, explicitLevel = false) {
    const role = (attr(item, 'role') || '').trim().toLowerCase(), checked = attr(item, 'aria-checked');
    if (role !== 'checkbox') {
      if (checked !== null || explicitLevel || checkboxRole(item)) throw new Error('Checklist state needs a checkbox list item with explicit true or false aria-checked. Correct the source before importing.');
      return null;
    }
    const state = checked?.trim().toLowerCase();
    if (!['true', 'false'].includes(state)) throw new Error('Checklist state must be explicitly true or false. Mixed or missing states cannot be preserved.');
    const level = attr(item, 'aria-level');
    if (level === null ? explicitLevel : !/^[1-6]$/.test(level.trim()) || Number(level) !== depth) throw new Error('Checklist levels must match their list depth. Nested sibling lists need explicit aria-level values on every checkbox item.');
    return state;
  }
  const checkboxMarker = node => tag(node) === 'img' && (attr(node, 'aria-roledescription') || '').trim().toLowerCase() === 'checkbox';
  function checklistText(nodes, state) {
    // A marker is redundant only when its literal accessible label agrees with
    // the item's explicit state. Its src is never read, loaded, or decoded.
    function inspect(node) {
      if (skip(node)) return;
      if (checkboxMarker(node)) {
        const expected = state === 'true' ? 'checked' : 'unchecked';
        if ((attr(node, 'alt') || '').trim().toLowerCase() !== expected) throw new Error('A checkbox image marker has an unknown or conflicting state. Compare it with the explicit checklist state before importing.');
      }
      for (const child of children(node)) inspect(child);
    }
    for (const node of nodes) inspect(node);
    const leading = nodes.find(node => !(node.nodeType === 3 && !node.nodeValue.trim()) && node.nodeType !== 8 && !skip(node));
    return checkboxMarker(leading || {}) ? nodes.filter(node => node !== leading) : nodes;
  }
  function list(node, depth, budget, explicitLevels = false) {
    if (depth > 6) throw new Error('Lists support at most six levels. Simplify this list before importing.');
    const ordered = tag(node) === 'ol';
    if (node.hasAttribute('reversed') || (ordered && attr(node, 'type') && attr(node, 'type') !== '1') || (ordered && styles(node).has('list-style-type') && styles(node).get('list-style-type') !== 'decimal')) throw new Error('Reversed or lettered lists are not supported. Use an ordinary numbered list.');
    const startText = attr(node, 'start');
    if (ordered && startText !== null && !/^\d{1,9}$/.test(startText)) throw new Error('Ordered list starts must be integers from 0 to 999999999.');
    const start = ordered && startText !== null ? Number(startText) : 1;
    const items = []; let preceding = null;
    for (const child of children(node)) {
      if (child.nodeType === 3 && !child.nodeValue.trim() || child.nodeType === 8) continue;
      // A hidden item must not make its following sibling list attach to an
      // earlier visible item. Keep that boundary even though its text is omitted.
      if (skip(child)) { preceding = null; continue; }
      if (tag(child) === 'li') { preceding = { node: child, siblings: [] }; items.push(preceding); }
      else if (!ordered && tag(child) === 'ul' && preceding) {
        checkboxState(preceding.node, depth, true);
        preceding.siblings.push(child); explicitLevels = true;
      } else throw new Error('This list has unsupported structure. Simplify it before importing.');
    }
    if (!items.length) throw new Error('This list has unsupported structure. Simplify it before importing.');
    // Google's sibling-list form is accepted only as an explicit checklist.
    // Plan its hierarchy without reparenting or otherwise changing source nodes.
    const states = items.map(item => checkboxState(item.node, depth, explicitLevels));
    const lines = [];
    for (let index = 0; index < items.length; index++) {
      if (++budget.items > 200 || (ordered && start + index > 999999999)) throw new Error('A list supports at most 200 items and nine-digit numbers.');
      const item = items[index].node, state = states[index];
      if (attr(item, 'value') !== null) throw new Error('Per-item numbering is not supported. Use consecutive list numbers.');
      const own = [], nestedLists = []; let childSeen = false;
      for (const child of children(item)) {
        if (tag(child) === 'ol' || tag(child) === 'ul') { childSeen = true; nestedLists.push(child); }
        else if (childSeen && plain(child).trim()) throw new Error('Text after a nested list cannot be preserved. Move it before the nested list.');
        else {
          const queue = [child];
          while (queue.length) { const node = queue.pop(); if (['ul', 'ol', 'table', 'pre'].includes(tag(node))) throw new Error('Wrapped lists, tables, or code blocks inside list text are not supported.'); queue.push(...children(node)); }
          own.push(child);
        }
      }
      const visibleOwn = state === null ? own : checklistText(own, state);
      const text = flattened(visibleOwn, state !== null && strikeFormatting(item));
      if (!text) throw new Error('Empty list items cannot be preserved. Add text before importing.');
      nestedLists.push(...items[index].siblings);
      if (nestedLists.length > 1) throw new Error('Multiple nested lists in one item cannot be preserved separately. Combine or simplify them before importing.');
      const label = state === null ? '' : writeInline([{ type: 'text', text: state === 'true' ? '[Checked] ' : '[Unchecked] ' }]);
      if (state !== null) warn('Checklist states were kept as [Checked] and [Unchecked] text labels. These labels are not interactive checkboxes.');
      if (items[index].siblings.length) warn('Nested checklist levels were reconstructed from explicit source levels. Compare the hierarchy with your original document.');
      lines.push('  '.repeat(depth - 1) + (ordered ? start + index + '. ' : '- ') + label + text);
      for (const child of nestedLists) if (!skip(child)) lines.push(...list(child, depth + 1, budget, explicitLevels));
    }
    return lines;
  }
  function table(node) {
    const rows = [], captions = [];
    for (const child of children(node)) {
      if (tag(child) === 'caption') captions.push(inline(child).trim());
      else if (tag(child) === 'tr') rows.push(child);
      else if (['thead', 'tbody', 'tfoot'].includes(tag(child)) && !skip(child)) rows.push(...children(child).filter(n => tag(n) === 'tr'));
    }
    if (!rows.length || rows.length > 101) throw new Error('Tables need a header and at most 100 data rows.');
    const visibleRows = rows.filter(row => !skip(row));
    if (!visibleRows.length) throw new Error('This table has no visible rows.');
    const cells = visibleRows.map(row => children(row).filter(n => tag(n) === 'th' || tag(n) === 'td'));
    const columns = cells[0].length;
    if (!columns || columns > 12 || cells.some(row => row.length !== columns)) throw new Error('Tables need one to twelve columns and the same number of cells in every row.');
    if (!cells[0].every(cell => tag(cell) === 'th')) {
      if (!firstRowHeaders) throw new Error('This table has no explicit header row. Check “Use the first table row as headers” and preview again if that row contains column names.');
      warn('The first table row was used as headers by your explicit choice.');
    }
    for (const row of cells) for (const cell of row) {
      if (['colspan', 'rowspan'].some(key => attr(cell, key) !== null && attr(cell, key) !== '1')) throw new Error('Merged table cells are not supported. Unmerge them before importing.');
      const queue = children(cell);
      while (queue.length) { const child = queue.pop(); if (['table', 'ul', 'ol', 'pre'].includes(tag(child))) throw new Error('Nested tables, lists, and code blocks inside table cells are not supported.'); queue.push(...children(child)); }
    }
    if (cells.slice(1).some(row => row.some(cell => tag(cell) === 'th'))) warn('Row headers were simplified to data cells; review the table.');
    const align = cells[0].map(cell => styles(cell).get('text-align') || attr(cell, 'align'));
    const line = row => '| ' + row.map(cell => skip(cell) ? '' : flattened(children(cell))).join(' | ') + ' |';
    return [...captions.filter(Boolean), line(cells[0]), '| ' + align.map(value => value === 'center' ? ':---:' : value === 'right' ? '---:' : value === 'left' ? ':---' : '---').join(' | ') + ' |', ...cells.slice(1).map(line)].join('\n');
  }
  function render(node, ancestorBold = false) {
    if (skip(node)) return '';
    const name = tag(node), currentBold = boldWithin(node, ancestorBold);
    if (/^h[1-6]$/.test(name)) {
      const hasStrike = nodes => nodes.some(part => part.type === 's' || part.children && hasStrike(part.children));
      if (name === 'h1' && hasStrike(inlineNodes(node))) warn('Strikethrough in a level-one heading was kept as plain text. Title fields do not retain inline formatting.');
      const content = name === 'h1' ? escapeText(whitespace(plain(node)).trim()) : inheritedInline(node, ancestorBold && !styles(node).has('font-weight')).trim();
      if (/[\r\n]/.test(content)) warn('Line breaks in a heading became spaces.');
      return '#'.repeat(Number(name[1])) + ' ' + content.replace(/\r\n?|\n/g, ' ');
    }
    if (name === 'ul' || name === 'ol') return list(node, 1, { items: 0 }).join('\n');
    if (name === 'table') return table(node);
    if (name === 'pre') {
      const text = children(node).map(plain).join('').replace(/\r\n?/g, '\n');
      let fenceLength = 3;
      for (const match of text.matchAll(/`+/g)) fenceLength = Math.max(fenceLength, match[0].length + 1);
      const fence = '`'.repeat(fenceLength);
      return fence + '\n' + text + (text.endsWith('\n') ? '' : '\n') + fence;
    }
    if (name === 'blockquote') {
      warn('Blockquote structure was simplified to quoted text.');
      const quoted = children(node).map(child => plain(child) + (blocks.has(tag(child)) ? '\n' : '')).join('').trim();
      return quoted.split('\n').map(line => '> ' + escapeText(whitespace(line))).join('\n');
    }
    if (name === 'hr') return '***';
    if (name === 'li') throw new Error('A list item is outside its list. Correct the source before importing.');
    if (blockDescendants.has(node)) return flow(node, currentBold);
    return inheritedInline(node, ancestorBold && !styles(node).has('font-weight')).trim();
  }
  function flow(node, ancestorBold = false) {
    const result = []; let run = [];
    const flush = () => { const value = writeInline(run).trim(); if (value) result.push(value); run = []; };
    for (const child of children(node)) {
      if (blocks.has(tag(child)) || blockDescendants.has(child)) { flush(); const value = render(child, ancestorBold); if (value) result.push(value); }
      else run.push(...(ancestorBold ? [{ type: 'strong', children: inlineNodes(child) }] : inlineNodes(child)));
    }
    flush(); return result.join('\n\n');
  }
  const markdown = flow(root).trim();
  if (!markdown) throw new Error('No supported article text was found. Current writing is unchanged.');
  if (markdown.length > ARTICLE_BODY_LIMIT) throw new Error('The converted article exceeds 60,000 characters. Import a smaller selection; nothing was truncated.');
  const warnings = ['Review this conversion: fonts, colors, page layout, and unsupported formatting are not retained.'];
  for (const [message, occurrences] of notices) warnings.push(message + (occurrences > 1 ? ' (' + occurrences + ' occurrences)' : ''));
  return { markdown, warnings };
}
