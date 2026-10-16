import { ARTICLE_BODY_LIMIT } from './writing-limits.js';
import { articleStructure } from './draft-review.js';
import { validateDraft } from './workspace.js';

function validBody(body) {
  if (typeof body !== 'string' || body.length > ARTICLE_BODY_LIMIT || body.includes('\0')) throw new Error('The article supports at most 60,000 characters and no null characters.');
}
function validPosition(body, at) {
  return Number.isInteger(at) && at >= 0 && at <= body.length && !(at > 0 && at < body.length && ((/[\uD800-\uDBFF]/.test(body[at - 1]) && /[\uDC00-\uDFFF]/.test(body[at])) || (body[at - 1] === '\r' && body[at] === '\n')));
}
export function articleInsertionTarget(body, start, end = start) {
  validBody(body);
  if (!validPosition(body, start) || !validPosition(body, end) || end < start) throw new Error('Choose a valid current article selection.');
  const blocks = articleStructure(body);
  for (const at of [start, end]) {
    if (blocks.some(block => {
      const finish = block.end - (body[block.end - 1] === '\r' ? 1 : 0);
      return (at > block.start && at < finish) || (block.unclosed && at > block.start);
    })) throw new Error('Place the cursor between complete paragraphs or blocks, or select complete blocks. Do not split a paragraph, list, table, or code fence. Close unfinished code before appending. Current writing is kept.');
  }
  return { body, start, end, before: body.slice(start, end) };
}
const literalHeading = text => text.replace(/[\r\n\u2028\u2029]+/g, ' ').replace(/[\\`*_[\]<>!#~]/g, '\\$&');
export function planArticleInsertion(target, body, draft, { includeTitle = false } = {}) {
  if (!target || target.body !== body) throw new Error('The article changed. Preview the insertion at the current selection or article end again. The converted import is kept.');
  const current = articleInsertionTarget(body, target.start, target.end);
  if (current.before !== target.before) throw new Error('The selected article source changed. Preview its current location again.');
  if (typeof includeTitle !== 'boolean') throw new Error('Choose whether to include the imported title.');
  const imported = validateDraft(draft);
  const newline = body.includes('\r\n') ? '\r\n' : '\n';
  let fragment = imported.body.replace(/\r\n?/g, '\n').replace(/^\n+|\n+$/g, '');
  if (includeTitle && imported.title.trim()) fragment = '## ' + literalHeading(imported.title.trim()) + (fragment ? '\n\n' + fragment : '');
  if (!fragment.trim()) throw new Error('There is no imported body to insert. Include its title as a section heading, or choose another import.');
  if (articleStructure(fragment).some(block => block.unclosed)) throw new Error('Close the imported code fence before inserting. Current writing is kept.');
  fragment = fragment.replaceAll('\n', newline);
  const before = body.slice(0, target.start), after = body.slice(target.end);
  const count = text => (text.match(/\n/g) || []).length;
  const leading = before ? newline.repeat(Math.max(0, 2 - count(before.match(/(?:\r?\n[ \t]*)+$/)?.[0] || ''))) : '';
  const trailing = after ? newline.repeat(Math.max(0, 2 - count(after.match(/^(?:[ \t]*\r?\n)+/)?.[0] || ''))) : '';
  const replacement = leading + fragment + trailing;
  const result = before + replacement + after;
  if (result.length > ARTICLE_BODY_LIMIT) throw new Error('The combined article would exceed 60,000 characters. Shorten it or choose a smaller import; nothing was inserted.');
  return { body: result, before: target.before, replacement, fragment, start: target.start, end: target.end, selectionStart: target.start + leading.length, selectionEnd: target.start + leading.length + fragment.length, changed: result !== body };
}
