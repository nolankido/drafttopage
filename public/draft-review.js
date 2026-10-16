import { ARTICLE_BODY_LIMIT } from './writing-limits.js';
import { inlineTokens, walkInlineTokens, inlineVisibleText } from './markdown-inline.js';
import { previewPassages } from './preview.js';
import { setextLevel, thematicBreak } from './markdown-block-syntax.js';

export const REVIEW_LIMIT = 40;
export const PARAGRAPH_WORDS = 120;
const wordsIn = text => (text.match(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu) || []).length;
const visibleText = tokens => inlineVisibleText(tokens);
// Character positions use the unchanged editor string, including CRLF and Unicode.
export function articleStructure(body, { readPassages = previewPassages } = {}) {
  if (typeof body !== 'string' || body.length > ARTICLE_BODY_LIMIT) throw new Error('Draft checks support at most 60,000 article characters.');
  const lines = body.split('\n'), blocks = [];
  // With no possible separator/underline line, the full preview cannot add semantics.
  // Any candidate, even inside code or a container, keeps the existing complete scan.
  // The cheap native test is a superset, not another grammar: eligible lines
  // contain only these marker characters and horizontal whitespace.
  const needsSemantics = /^ {0,3}[-=*_][-=*_ \t]*$/m.test(body.replaceAll('\r', '')) && lines.some(line => {
    const previewLine = line.replaceAll('\r', '');
    return setextLevel(previewLine) || thematicBreak(previewLine);
  });
  const semantic = new Map((needsSemantics ? readPassages(body) : []).filter(passage => ['hr'].includes(passage.blocks[0].type) || passage.blocks[0].headingStyle === 'setext').map(passage => [passage.start, passage]));
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
export function articleWordCount(body) {
  return articleStructure(body).reduce((count, block) => count + (block.kind === 'code' ? 0 : wordsIn(visibleText(inlineTokens(block.text)))), 0);
}

export const WORD_COUNT_CACHE_LIMIT = 512;
// One workspace's current article only, never an edit history. Re-read structure
// after every source change so fences and heading edits cannot reuse wrong blocks.
// The stateless count above remains the independent definition used by exports.
export function createArticleWordCounter({ readStructure = articleStructure, countInline = text => wordsIn(visibleText(inlineTokens(text))) } = {}) {
  let snapshot = null, total = 0, cache = new Map();
  return body => {
    if (typeof body !== 'string' || body.length > ARTICLE_BODY_LIMIT) throw new Error('Draft checks support at most 60,000 article characters.');
    if (body === snapshot) return total;
    if (!body) { snapshot = ''; total = 0; cache.clear(); return 0; }
    const next = new Map();
    let words = 0;
    for (const block of readStructure(body)) {
      if (block.kind === 'code') continue;
      const value = next.has(block.text) ? next.get(block.text) : cache.has(block.text) ? cache.get(block.text) : countInline(block.text);
      words += value;
      if (next.size < WORD_COUNT_CACHE_LIMIT) next.set(block.text, value);
    }
    // Failed parsing/counting never replaces the last complete snapshot.
    snapshot = body; total = words; cache = next;
    return words;
  };
}
export function analyzeDraft(draft, { imageFindings = true } = {}) {
  const body = draft?.body, title = draft?.title || '';
  if (typeof title !== 'string' || title.length > 160) throw new Error('Check the article title before reviewing.');
  const blocks = articleStructure(body), headings = [], links = [], findings = [], seen = new Map();
  let words = 0, totalFindings = 0;
  const add = (block, kind, message, start = block.start, end = block.end) => {
    totalFindings++;
    if (findings.length < REVIEW_LIMIT) findings.push({ kind, message, line: block.line + (body.slice(block.start, start).match(/\n/g) || []).length, start, end });
  };
  for (let index = 0; index < blocks.length; index++) {
    const block = blocks[index];
    if (block.kind === 'separator') continue;
    if (block.kind === 'code') {
      if (block.unclosed) add(block, 'fence', 'Close this code fence, or the rest of the article may appear as code.');
      continue;
    }
    const tokens = inlineTokens(block.text);
    const visible = visibleText(tokens);
    words += wordsIn(visible);
    if (block.kind === 'heading') {
      const previous = headings.at(-1); headings.push({ ...block });
      if (!block.text) add(block, 'heading', 'Give this heading a label.');
      if ((previous && block.level > previous.level + 1) || (!previous && block.level > 2)) add(block, 'heading', 'This heading skips a level. Check the article structure.');
      if (title.trim() && block.text.toLocaleLowerCase() === title.trim().toLocaleLowerCase()) add(block, 'title', 'This heading repeats the title field. Check that your destination will not show two titles.');
      const next = blocks[index + 1];
      if (!next || (next.kind === 'heading' && next.level <= block.level)) add(block, 'empty-section', 'This section has no content. Add the missing passage or remove the heading.');
    } else {
      const key = visible.trim().replace(/\s+/gu, ' ').toLocaleLowerCase();
      if (wordsIn(key) >= 8) {
        if (seen.has(key)) add(block, 'repeat', 'This passage repeats the one on line ' + seen.get(key) + '. Decide whether to keep both.');
        else seen.set(key, block.line);
      }
      if (!/^ {0,3}(?:[-*+] |\d+[.)] |>)/m.test(block.text) && wordsIn(visible) > PARAGRAPH_WORDS) add(block, 'paragraph', 'This paragraph exceeds ' + PARAGRAPH_WORDS + ' approximate words. Consider a break for easier reading.');
    }
    // Ignore inline code when identifying editorial placeholders.
    for (const token of walkInlineTokens(tokens)) {
      if (token.type === 'code') continue;
      for (const match of (token.children ? '' : token.text).matchAll(/\b(?:TODO|TBD|TK)\b|\[(?:insert|add|check|verify|source|citation needed|placeholder)\b[^\]\n]*\]|\{\{[^{}\n]+\}\}|\bLorem ipsum\b/gi)) {
        // Text tokens have exact offsets; formatted labels use the whole block.
        const exact = token.type === 'text', start = exact ? block.contentStart + token.start + match.index : block.start;
        add(block, 'placeholder', 'Possible unfinished text: ' + match[0].slice(0, 100) + '. Resolve it before publishing.', start, exact ? start + match[0].length : block.end);
      }
      if (token.type === 'link' || token.type === 'image') {
        const start = block.contentStart + token.start, end = block.contentStart + token.end;
        links.push({ ...token, start, end, line: block.line + (block.text.slice(0, token.start).match(/\n/g) || []).length });
        if (token.type === 'image' && imageFindings) add(block, 'image', 'Images remain text in the reading page. Add and inspect the image in your destination.', start, end);
        else if (token.type === 'image') continue;
        else if (!token.href) add(block, 'link', 'This link stays text in the reading page. Use a non-empty label and an absolute http:// or https:// URL without credentials.', start, end);
        else if (/^(?:click here|here|read more|link)$/i.test(inlineVisibleText(token.children || [token]).trim())) add(block, 'link-label', 'Give this link a descriptive label so readers know where it leads.', start, end);
      }
    }
  }
  return { words, readingMinutes: words ? Math.max(1, Math.ceil(words / 200)) : 0, headings, links, findings, totalFindings, truncated: totalFindings > REVIEW_LIMIT };
}
