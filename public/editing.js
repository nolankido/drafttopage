export function formatMarkdown(body, start, end, action) {
  if (typeof body !== 'string' || body.length > 12000 || !Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || end > body.length) throw new Error('Choose a valid selection in the article.');
  const inline = { bold: '**', italic: '*', code: '\x60' };
  let replacement, from = start, to = end, selectedStart, selectedEnd;
  if (Object.hasOwn(inline, action)) {
    const mark = inline[action];
    const value = body.slice(start, end) || (action === 'code' ? 'code' : action === 'bold' ? 'bold text' : 'italic text');
    if (body.slice(start - mark.length, start) === mark && body.slice(end, end + mark.length) === mark) {
      from = start - mark.length; to = end + mark.length; replacement = value;
      selectedStart = from; selectedEnd = from + value.length;
    } else {
      replacement = mark + value + mark;
      selectedStart = start + mark.length; selectedEnd = selectedStart + value.length;
    }
  } else if (['heading', 'list', 'numbered'].includes(action)) {
    from = body.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
    if (start === 0) from = 0;
    const last = end > start && body[end - 1] === '\n' ? end - 1 : end;
    const next = body.indexOf('\n', last);
    to = next < 0 ? body.length : next;
    const lines = body.slice(from, to).split('\n');
    replacement = lines.map((line, index) => {
      const clean = line.replace(/^(?:#{1,6} +|[-*] +|\d+\. +)/, '');
      return (action === 'heading' ? '## ' : action === 'list' ? '- ' : (index + 1) + '. ') + (clean || (action === 'heading' ? 'Heading' : 'List item'));
    }).join('\n');
    selectedStart = from; selectedEnd = from + replacement.length;
  } else throw new Error('Choose an available formatting tool.');
  const result = body.slice(0, from) + replacement + body.slice(to);
  if (result.length > 12000) throw new Error('Formatting would exceed 12,000 characters. Current writing is unchanged.');
  return { body: result, selectionStart: selectedStart, selectionEnd: selectedEnd };
}
// Failure of an optional editor module must leave the existing desk usable.
export async function loadEditingTool(load, install, unavailable) {
  try { install(await load()); return true; }
  catch { unavailable(); return false; }
}

