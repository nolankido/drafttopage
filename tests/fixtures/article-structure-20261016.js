// Test-only frozen articleStructure from main 483e8b47f2406e619f5eea20687eaa2f61fe24f3.
// Keep its unconditional preview scan as an independent fast-path equivalence oracle.
import { ARTICLE_BODY_LIMIT } from '../../public/writing-limits.js';
import { previewPassages } from '../../public/preview.js';

export function baselineArticleStructure(body) {
  if (typeof body !== 'string' || body.length > ARTICLE_BODY_LIMIT) throw new Error('Draft checks support at most 60,000 article characters.');
  const lines = body.split('\n'), blocks = [];
  const semantic = new Map(previewPassages(body).filter(passage => ['hr'].includes(passage.blocks[0].type) || passage.blocks[0].headingStyle === 'setext').map(passage => [passage.start, passage]));
  let position = 0, paragraph = null, fence = null;
  const flush = () => { if (paragraph) blocks.push(paragraph); paragraph = null; };
  for (let index = 0; index < lines.length; index++) {
    const original = lines[index], text = original.replace(/\r$/, ''), end = position + original.length;
    const passage = semantic.get(position);
    if (!fence && passage) {
      flush();
      const block = passage.blocks[0];
      if (block.type === 'hr') blocks.push({ kind: 'separator', text, start: position, contentStart: position, end: passage.end, line: index + 1 });
      else {
        const underlineStart = body.lastIndexOf('\n', passage.end - 1), content = body.slice(position, underlineStart);
        const contentStart = position + content.match(/^\s*/)[0].length;
        blocks.push({ kind: 'heading', level: block.level, headingStyle: 'setext', text: content.trim(), start: position, contentStart, end: passage.end, line: index + 1 });
      }
      index = passage.endLine - 1; position = passage.end + 1; continue;
    }
    if (fence) {
      if (new RegExp('^ {0,3}' + (fence.char === '`' ? '\\x60' : '~') + '{' + fence.size + ',}\\s*$').test(text)) {
        fence.end = end; blocks.push(fence); fence = null;
      } else { fence.text += '\n' + text; fence.end = end; }
    } else {
      const opening = /^ {0,3}(\x60{3,}|~{3,})(.*)$/.exec(text);
      const heading = /^ {0,3}(#{1,6})(?:[ \t]+(.*)|$)/.exec(text);
      if (opening) { flush(); fence = { kind: 'code', char: opening[1][0], size: opening[1].length, text: '', start: position, end, line: index + 1, unclosed: false }; }
      else if (heading) {
        const label = heading[2] || '', contentStart = position + text.length - label.length + (label.match(/^\s*/)[0].length);
        flush(); blocks.push({ kind: 'heading', level: heading[1].length, text: label.replace(/[ \t]+#+[ \t]*$/, '').trim(), start: position, contentStart, end, line: index + 1 });
      } else if (!text.trim()) flush();
      else {
        if (!paragraph) paragraph = { kind: 'paragraph', text: original, start: position, contentStart: position, end, line: index + 1 };
        else { paragraph.text += '\n' + original; paragraph.end = end; }
      }
    }
    position = end + 1;
  }
  flush(); if (fence) { fence.unclosed = true; blocks.push(fence); }
  return blocks;
}
