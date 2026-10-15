import { DRAFT_FIELDS, validateDraft } from './workspace.js';
import { suggestFilename } from './preview.js';

import { ARTICLE_LIMITS, MAX_IMPORT_BYTES } from './writing-limits.js';
export { MAX_IMPORT_BYTES };
const controls = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
const limits = ARTICLE_LIMITS;
function checkDraft(value) {
  const draft = validateDraft(value);
  for (const key of [...DRAFT_FIELDS, 'questions']) {
    const texts = key === 'questions' ? draft.questions : [draft[key]];
    if (texts.some(text => controls.test(text))) throw new Error('The import contains unsupported control characters.');
  }
  if (draft.slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(draft.slug)) throw new Error('The imported filename must use lowercase letters, digits, and separating hyphens.');
  return draft;
}
function scalar(value) {
  if (!value) return '';
  if (value.startsWith('"')) {
    let parsed;
    try { parsed = JSON.parse(value); } catch { throw new Error('Use valid JSON-quoted text in front matter.'); }
    if (typeof parsed !== 'string') throw new Error('Front-matter fields must be single-line text values.');
    return parsed;
  }
  if (value.startsWith("'")) {
    if (!value.endsWith("'") || /(^|[^'])'([^']|$)/.test(value.slice(1, -1))) throw new Error('Check the quoted front-matter value.');
    return value.slice(1, -1).replaceAll("''", "'");
  }
  if (/^[!&*{|>\[]/.test(value)) throw new Error('Structured YAML is not supported. Use single-line text fields or paste the article body directly.');
  return value;
}
function firstHeading(body) {
  const match = /^# +([^\n]+)(?:\n|$)/.exec(body);
  if (!match) return null;
  const title = match[1].replace(/\\([\\\x60*_{}\[\]()<>#!|])/g, '$1').trim();
  return { title, length: match[0].length };
}
export function parseArticleImport(raw, filename = '', format = 'auto') {
  if (typeof raw !== 'string' || new TextEncoder().encode(raw).byteLength > MAX_IMPORT_BYTES) throw new Error('Choose text no larger than 512 KiB.');
  if (controls.test(raw)) throw new Error('The import contains unsupported control characters.');
  if (!['auto', 'markdown', 'json'].includes(format)) throw new Error('Choose a supported import format.');
  let text = raw.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  if (!text.trim()) throw new Error('The import is empty.');
  const warnings = [];
  const fence = /^\s*\x60{3}(json|markdown|md)\s*\n([\s\S]*)\n\x60{3}\s*$/.exec(text);
  if (fence && (format === 'auto' || (format === 'json' && fence[1] === 'json') || (format === 'markdown' && fence[1] !== 'json'))) {
    text = fence[2]; warnings.push('The outer reply code fence was removed.');
  }
  if (format === 'json' || (format === 'auto' && text.trimStart().startsWith('{'))) {
    let value;
    try { value = JSON.parse(text); } catch { throw new Error('The article JSON is not valid. Current writing is unchanged.'); }
    if (value?.format === 'drafttopage-workspace') throw new Error('This is a private workspace backup. Use Save or restore this workspace instead.');
    let draft;
    try { draft = checkDraft(value); }
    catch (error) { throw new Error('Article JSON needs title, excerpt, description, slug, body, and questions within the editor limits. ' + error.message); }
    return { draft, warnings, unmapped: [], kind: 'Structured article' };
  }
  const draft = { title: '', excerpt: '', description: '', slug: '', body: '', questions: [] };
  const unmapped = [];
  let body = text;
  const lines = text.split('\n');
  if (lines[0].trim() === '---') {
    const end = lines.findIndex((line, index) => index > 0 && line.trim() === '---');
    if (end < 0) throw new Error('The front-matter block is not closed. Current writing is unchanged.');
    if (end > 64) throw new Error('Keep front matter to at most 64 lines.');
    const seen = new Set();
    for (const line of lines.slice(1, end)) {
      if (!line.trim() || line.trimStart().startsWith('#')) continue;
      const match = /^([A-Za-z][A-Za-z0-9_-]*)\s*:\s*(.*)$/.exec(line);
      if (!match) throw new Error('Only single-line front-matter fields are supported. Current writing is unchanged.');
      const [, key, rawValue] = match;
      if (seen.has(key)) throw new Error('The front matter contains a duplicate field.');
      seen.add(key);
      if (key === 'draft') {
        if (!['true', 'false'].includes(rawValue.trim())) throw new Error('The draft flag must be true or false.');
        if (rawValue.trim() === 'false') warnings.push('The source draft flag was false. Import does not approve or publish the article.');
        continue;
      }
      const value = scalar(rawValue.trim());
      if (Object.hasOwn(limits, key) && key !== 'body') draft[key] = value;
      else {
        if (key === 'constructor' || key === 'prototype' || value.length > 500 || unmapped.length >= 20) throw new Error('The front matter contains an unsupported field.');
        unmapped.push({ key, value });
      }
    }
    body = lines.slice(end + 1).join('\n');
  }
  body = body.replace(/^\n+|\n+$/g, '');
  const heading = firstHeading(body);
  if (heading) {
    const normalized = draft.title.replaceAll('\n', ' ').replaceAll('\r', '').trim();
    if (!draft.title || normalized === heading.title) {
      if (!draft.title) draft.title = heading.title;
      body = body.slice(heading.length).replace(/^\n+/, '');
      warnings.push('The opening title heading was moved to the title field.');
    } else warnings.push('The opening heading differs from the page title and stays in the article.');
  }
  draft.body = body;
  if (!draft.slug) draft.slug = suggestFilename(String(filename).replace(/\.(md|markdown|txt|json)$/i, '') || draft.title);
  const validated = checkDraft(draft);
  if (unmapped.length) warnings.push('Some front-matter fields are not mapped. They must be handled separately at the destination.');
  return { draft: validated, warnings, unmapped, kind: 'Markdown article' };
}
