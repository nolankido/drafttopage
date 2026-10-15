// Single-line items, bounded nesting, and no silent loss when a candidate fails.
export const LIST_LIMITS = Object.freeze({ depth: 6, items: 200 });
const marker = line => {
  const match = /^( *)(?:([-*+])|(\d{1,9})[.)])[ \t]+(\S.*)$/.exec(line);
  return match ? { indent: match[1].length, type: match[2] ? 'ul' : 'ol', number: match[3] === undefined ? null : Number(match[3]), text: match[4] } : null;
};

export function readMarkdownList(lines, index) {
  const first = marker(lines[index]?.replace(/\r$/, '') || '');
  if (!first || first.indent) return null;
  const blocks = [], stack = [], numbered = [];
  let end = index, count = 0, reason = '';
  const create = (token, parent = null) => {
    const list = { type: token.type, items: [] };
    if (token.type === 'ol' && token.number !== 1) list.start = token.number;
    if (parent) {
      parent.list.children ||= [];
      (parent.list.children[parent.list.items.length - 1] ||= []).push(list);
    } else blocks.push(list);
    const frame = { list, indent: token.indent, parent, numbers: [] };
    if (token.type === 'ol') numbered.push(frame);
    return frame;
  };
  while (end < lines.length) {
    const line = lines[end].replace(/\r$/, ''), token = marker(line);
    if (!line.trim()) break;
    if (!token) {
      const malformed = /^ *(?:[-*+]|\d+[.)])(?:[ \t]|$)/.test(line);
      if (!malformed && !/^[ \t]+\S/.test(line)) break;
      if (!reason) reason = malformed ? 'Use nonempty items and ordered markers of at most nine digits.' : 'Multiline items, tabs, and blocks inside list items are outside this subset. Keep each item on one line.';
      end++; continue;
    }
    count++;
    if (count > LIST_LIMITS.items && !reason) reason = 'This list group exceeds the 200-item limit.';
    if (!reason) {
      if (!token.indent) {
        if (!stack.length || stack[0].list.type !== token.type) stack.splice(0, stack.length, create(token));
        else stack.length = 1;
      } else {
        const active = stack.at(-1);
        if (token.indent > active.indent) {
          if (![2, 4].includes(token.indent - active.indent)) reason = 'Each new nesting level needs two or four additional spaces.';
          else if (stack.length >= LIST_LIMITS.depth) reason = 'This list exceeds the six-level nesting limit.';
          else stack.push(create(token, active));
        } else {
          const level = stack.findIndex(frame => frame.indent === token.indent);
          if (level < 0) reason = 'This indentation does not match an active parent level.';
          else {
            stack.length = level + 1;
            if (stack[level].list.type !== token.type) stack[level] = create(token, stack[level].parent);
          }
        }
      }
      if (!reason) { const frame = stack.at(-1); frame.list.items.push(token.text); if (token.type === 'ol') frame.numbers.push(token.number); }
    }
    end++;
  }
  if (!reason) for (const frame of numbered) {
    const start = frame.numbers[0];
    if (!frame.numbers.every((n, i) => n === start + i) && !(start === 1 && frame.numbers.every(n => n === 1))) {
      reason = 'Ordered items need consecutive numbers, or repeated 1 markers. Inconsistent numbers stay intact as text.'; break;
    }
  }
  return { supported: !reason, reason, end, blocks };
}

export function markdownListRanges(body) {
  if (typeof body !== 'string' || body.length > 12000) throw new Error('Lists support at most 12,000 article characters.');
  const lines = body.split('\n'), ranges = []; let position = 0, fence = null;
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index].replace(/\r$/, '');
    if (fence) {
      if (new RegExp('^ {0,3}' + (fence[0] === '~' ? '~' : '\\x60') + '{' + fence.length + ',}\\s*$').test(line)) fence = null;
    } else {
      const opening = /^ {0,3}(\x60{3,}|~{3,})/.exec(line);
      if (opening) fence = opening[1];
      else {
        const result = readMarkdownList(lines, index);
        if (result) {
          const start = position, source = lines.slice(index, result.end).join('\n');
          ranges.push({ ...result, start, end: start + source.length, headerEnd: start + line.length, line: index + 1 });
          position += source.length + 1; index = result.end - 1; continue;
        }
      }
    }
    position += lines[index].length + 1;
  }
  return ranges;
}

export function listHTML(list, inline, { wordpress = false } = {}) {
  const block = (name, html, attrs = '') => '<!-- wp:' + name + attrs + ' -->\n' + html + '\n<!-- /wp:' + name + ' -->';
  const items = list.items.map((text, index) => {
    const nested = (list.children?.[index] || []).map(child => listHTML(child, inline, { wordpress })).join('\n');
    const html = '<li>' + inline(text) + nested + '</li>';
    return wordpress ? block('list-item', html) : html;
  }).join(wordpress ? '\n' : '');
  const start = list.type === 'ol' && list.start !== undefined ? ' start="' + list.start + '"' : '';
  const html = '<' + list.type + (wordpress ? ' class="wp-block-list"' : '') + start + '>' + items + '</' + list.type + '>';
  const attributes = list.type === 'ol' ? ' ' + JSON.stringify({ ordered: true, ...(list.start === undefined ? {} : { start: list.start }) }) : '';
  return wordpress ? block('list', html, attributes) : html;
}

export function listText(list, inline, depth = 0) {
  return list.items.map((text, index) => '  '.repeat(depth) + (list.type === 'ol' ? ((list.start ?? 1) + index) + '. ' : '- ') + inline(text) +
    (list.children?.[index]?.length ? '\n' + list.children[index].map(child => listText(child, inline, depth + 1)).join('\n') : '')).join('\n');
}
