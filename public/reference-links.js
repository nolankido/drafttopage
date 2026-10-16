import { ARTICLE_BODY_LIMIT } from './writing-limits.js';
import { previewPassages } from './preview.js';
import { inlineTokens, walkInlineTokens, safeWebLink } from './markdown-inline.js';

export const REFERENCE_LIMITS = Object.freeze({ definitions: 200, uses: 1000, identifier: 80, label: 300, url: 2048, examples: 5, findings: 40 });
const identifier = text => /^[A-Za-z0-9][A-Za-z0-9 ._\-\t]{0,79}$/.test(text.trim()) ? text.trim().replace(/[ \t]+/g, ' ').toLowerCase() : null;
const candidate = /^(?:[ \t]*>[ \t]*)?[ \t]*(?:[-+*][ \t]+|\d+[.)][ \t]+)?\[([^\]\r\n]+)\]:/;
export const hasReferenceLinks = body => typeof body === 'string' && /(^|\n)[ \t]*(?:>[ \t]*)?\[[^\]\r\n]+\]:|(?:^|[^\\])\[[^\[\]\r\n]+\]\[[^\[\]\r\n]*\]/.test(body);
function validate(body) {
  if (typeof body !== 'string' || body.length > ARTICLE_BODY_LIMIT || body.includes('\0')) throw new Error('Reference conversion supports at most 60,000 article characters and no null characters.');
}
function bracket(text, start) {
  let depth = 1, nested = false;
  for (let i = start + 1; i < text.length; i++) {
    if (text[i] === '\\') { i++; continue; }
    if (text[i] === '[') { depth++; nested = true; }
    if (text[i] === ']' && --depth === 0) return { text: text.slice(start + 1, i), end: i + 1, nested };
  }
  return null;
}
export function planReferenceLinks(body, { removeDefinitions = true } = {}) {
  validate(body);
  if (typeof removeDefinitions !== 'boolean') throw new Error('Choose whether to remove converted definitions.');
  const passages = previewPassages(body), definitions = [], byKey = new Map(), definitionLines = new Set(), lines = [];
  let offset = 0, passageIndex = 0;
  for (const [index, original] of body.split('\n').entries()) {
    const text = original.replace(/\r$/, ''), end = offset + original.length;
    while (passageIndex < passages.length && offset > passages[passageIndex].end) passageIndex++;
    const passage = passages[passageIndex], inPassage = passage && offset >= passage.start && offset <= passage.end;
    lines.push({ text, original, start: offset, end, next: Math.min(body.length, end + 1), line: index + 1, passage: inPassage ? passage : null });
    offset = end + 1;
  }
  const findings = [], changes = [], examples = [];
  let unresolvedCount = 0, uses = 0, converted = 0;
  const note = (line, message) => { unresolvedCount++; if (findings.length < REFERENCE_LIMITS.findings) findings.push({ line, message }); };
  if (lines.some(line => line.passage?.blocks[0].type !== 'pre' && !/^(?: {4}|\t)/.test(line.text) && /^ {0,3}<(?:\/?[A-Za-z][A-Za-z0-9-]*(?:[\s/>])|!|\?)/.test(line.text))) throw new Error('Source HTML blocks need manual review before reference conversion. Convert or remove that markup first. Current writing is unchanged.');
  for (const line of lines) {
    if (line.passage?.blocks[0].type === 'pre' || /^(?: {4}|\t)/.test(line.text)) continue;
    const match = candidate.exec(line.text);
    if (!match) continue;
    if (definitions.length >= REFERENCE_LIMITS.definitions) throw new Error('Reference conversion supports at most 200 definition candidates. Nothing was changed.');
    definitionLines.add(line.line);
    const key = identifier(match[1]), record = { ...line, key, target: null, reason: '', converted: 0, retain: false };
    const group = line.passage;
    const standalone = group?.blocks.length === 1 && group.blocks[0].type === 'p' &&
      lines.slice(group.line - 1, group.endLine).every(item => /^\[[^\]\r\n]+\]:/.test(item.text));
    const definition = /^\[([^\]\r\n]+)\]:[ \t]*(\S+)[ \t]*$/.exec(line.text);
    if (!key) record.reason = 'Use an ASCII reference identifier of up to 80 characters: letters, digits, spaces, periods, hyphens, or underscores.';
    else if (!standalone || !definition) record.reason = 'Keep single-line definitions at the left edge in a separate paragraph; multiline definitions, titles, and container definitions need manual editing.';
    else {
      const raw = definition[2], target = raw.startsWith('<') && raw.endsWith('>') ? raw.slice(1, -1) : raw;
      const href = target.length <= REFERENCE_LIMITS.url ? safeWebLink(target) : null;
      record.target = href?.replaceAll('(', '%28').replaceAll(')', '%29').replaceAll('|', '%7C') || null;
      if (!record.target || record.target.length > REFERENCE_LIMITS.url) { record.target = null; record.reason = 'Use an absolute HTTP or HTTPS destination of up to 2,048 characters, without credentials, spaces, or a quoted title.'; }
    }
    definitions.push(record);
    if (key) { if (!byKey.has(key)) byKey.set(key, []); byKey.get(key).push(record); }
  }
  for (const records of byKey.values()) if (records.length > 1) for (const record of records) { record.target = null; record.reason = 'Duplicate reference identifiers are ambiguous in this converter. Keep one definition before converting.'; }
  for (const record of definitions) if (record.reason) note(record.line, record.reason);

  for (const line of lines) {
    if (line.passage?.blocks[0].type === 'pre' || definitionLines.has(line.line) || /^(?: {4}|\t)/.test(line.text) || /<[^>\n]*>/.test(line.text)) continue;
    const text = line.text, protectedRanges = [...walkInlineTokens(inlineTokens(text))].filter(token => ['code', 'link', 'image'].includes(token.type)).sort((a,b) => a.start - b.start || b.end - a.end);
    let rangeIndex = 0;
    for (let at = 0; at < text.length;) {
      while (rangeIndex < protectedRanges.length && protectedRanges[rangeIndex].end <= at) rangeIndex++;
      const protectedRange = protectedRanges[rangeIndex];
      if (protectedRange && at >= protectedRange.start && at < protectedRange.end) { at = protectedRange.end; continue; }
      if (text[at] === '\\') { at += 2; continue; }
      const image = text[at] === '!' && text[at + 1] === '[', open = at + (image ? 1 : 0);
      if (text[open] !== '[') { at++; continue; }
      const label = bracket(text, open);
      if (!label) throw new Error('Multiline or unclosed brackets need manual review before reference conversion. Current writing is unchanged.');
      let finish = label.end, reference = null;
      if (text[finish] === '[') { reference = bracket(text, finish); if (!reference) throw new Error('Multiline or unclosed reference identifiers need manual review. Current writing is unchanged.'); finish = reference.end; }
      // Inline links, even malformed ones, are not shortcut reference candidates.
      if (!reference && text[label.end] === '(') throw new Error('Resolve the malformed inline link before converting references. Current writing is unchanged.');
      const key = identifier(reference?.text || label.text), records = key ? byKey.get(key) : null;
      const explicit = Boolean(reference);
      if (!explicit && !records) { at = finish; continue; }
      if (++uses > REFERENCE_LIMITS.uses) throw new Error('Reference conversion supports at most 1,000 reference uses. Nothing was changed.');
      const record = records?.length === 1 ? records[0] : null;
      const retain = () => { for (const item of records || []) item.retain = true; };
      if (image || label.nested || reference?.nested || !label.text.trim() || label.text.length > REFERENCE_LIMITS.label || !record?.target) {
        retain();
        note(line.line, image ? 'Reference-style images stay unchanged. Keep their definitions and prepare images separately.' : label.nested || reference?.nested || label.text.length > REFERENCE_LIMITS.label ? 'Nested or oversized reference labels stay unchanged; use a simple label of up to 300 characters.' : 'This reference has no single supported definition. Its source is kept unchanged.');
        at = finish; continue;
      }
      const replacement = '[' + label.text + '](' + record.target + ')', tokens = inlineTokens(replacement);
      if (tokens.length !== 1 || tokens[0].type !== 'link' || !tokens[0].href || tokens[0].end !== replacement.length || tokens[0].target !== record.target) {
        retain(); note(line.line, 'This label cannot be preserved as one supported inline link. Edit it directly.'); at = finish; continue;
      }
      const change = { start: line.start + at, end: line.start + finish, replacement, line: line.line };
      changes.push(change); converted++; record.converted++;
      if (examples.length < REFERENCE_LIMITS.examples) examples.push({ line: line.line, before: text.slice(at, finish), after: replacement });
      at = finish;
    }
  }
  const assemble = edits => {
    let result = '', from = 0;
    for (const change of [...edits].sort((a,b) => a.start - b.start)) {
      if (change.start < from) throw new Error('These reference changes overlap. Edit the article directly.');
      result += body.slice(from, change.start) + change.replacement; from = change.end;
    }
    return result + body.slice(from);
  };
  // Retain a definition whenever bracket syntax still mentions it, including
  // images, code examples, unsupported HTML/container positions, and malformed uses.
  const editsByLine = new Map();
  for (const change of changes) { if (!editsByLine.has(change.line)) editsByLine.set(change.line, []); editsByLine.get(change.line).push(change); }
  for (const line of lines) {
    if (definitionLines.has(line.line)) continue;
    let text = line.text;
    const atomic = [...walkInlineTokens(inlineTokens(text))].filter(token => ['link','image'].includes(token.type));
    const convertedRanges = (editsByLine.get(line.line) || []).map(change => ({ start: change.start - line.start, end: change.end - line.start }));
    for (const token of [...atomic, ...convertedRanges]) text = text.slice(0,token.start) + ' '.repeat(token.end-token.start) + text.slice(token.end);
    for (const match of text.matchAll(/\[([^\[\]\r\n]{1,80})\]/g)) for (const record of byKey.get(identifier(match[1])) || []) record.retain = true;
  }
  let removed = 0;
  if (removeDefinitions) for (const record of definitions) if (record.target && record.converted && !record.retain) {
    changes.push({ start: record.start, end: record.next, replacement: '', line: record.line }); removed++;
  }
  const result = assemble(changes);
  if (result.length > ARTICLE_BODY_LIMIT) throw new Error('Expanding references would exceed the 60,000-character article limit. Shorten the article first. Nothing was truncated.');
  return { original: body, body: result, converted, removed, keptDefinitions: definitions.length - removed, unresolvedCount, findings, examples, changed: result !== body, removeDefinitions };
}
