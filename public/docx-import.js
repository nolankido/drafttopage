import { readDocxXML } from './docx-archive.js';
import { htmlTreeToMarkdown } from './html-import.js';
import { parseArticleImport } from './article-import.js';
import { safeWebLink } from './markdown-inline.js';
import { wordImageReference } from './word-image-reference.js';
import { createWordNotes } from './word-notes.js';
import { ARTICLE_BODY_LIMIT } from './writing-limits.js';
import { inspectWordTextRevisions } from './word-revisions.js';

export const WORD_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const REL_NS = 'http://schemas.openxmlformats.org/package/2006/relationships';
const OFFICE_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/';
const TYPE_NS = 'http://schemas.openxmlformats.org/package/2006/content-types';
const MAIN_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml';
const elements = n => Array.from(n?.childNodes || []).filter(c => c.nodeType === 1);
const is = (n, name) => n?.namespaceURI === WORD_NS && n.localName === name;
const children = (n, name) => elements(n).filter(c => is(c, name));
const child = (n, name) => children(n, name)[0];
const val = n => n?.getAttributeNS(WORD_NS, 'val');
const on = n => n && !['0', 'false', 'off'].includes(val(n));
const unsupported = detail => new Error(detail + ' Simplify the Word document or import a formatted selection. Current writing is unchanged.');

export function parseWordXML(source) {
  if (typeof source !== 'string' || /<!DOCTYPE|<!ENTITY/i.test(source) || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(source) || source.length > 2 * 1024 * 1024) throw unsupported('Unsupported Word XML.');
  const doc = new DOMParser().parseFromString(source, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length || !doc.documentElement) throw unsupported('The Word XML is not valid.');
  return doc.documentElement;
}

// XML and generated HTML trees stay detached. Source elements never enter the page.
export function wordTreesToMarkdown(parts, options = {}, create = name => document.createElement(name)) {
  const revisions = inspectWordTextRevisions(parts, options.textRevisions);
  const documentRoot = parts.get('word/document.xml'), body = child(documentRoot, 'body');
  if (!is(documentRoot, 'document') || !body || children(documentRoot, 'body').length !== 1) throw unsupported('Only standard WordprocessingML documents are supported.');
  const types = parts.get('[Content_Types].xml');
  if (types?.namespaceURI !== TYPE_NS || types.localName !== 'Types') throw unsupported('Invalid Word content types.');
  const overrides = elements(types).filter(n => n.namespaceURI === TYPE_NS && n.localName === 'Override' && n.getAttribute('PartName') === '/word/document.xml');
  if (overrides.length !== 1 || overrides[0].getAttribute('ContentType') !== MAIN_TYPE || elements(types).some(n => /macroEnabled|vbaProject/i.test(n.getAttribute('ContentType') || ''))) throw unsupported('Choose a plain .docx without macros.');
  function relationships(root) {
    const map = new Map();
    if (!root) return map;
    if (root.namespaceURI !== REL_NS || root.localName !== 'Relationships') throw unsupported('Invalid Word relationships.');
    for (const n of elements(root)) {
      const id = n.getAttribute('Id');
      if (n.namespaceURI !== REL_NS || n.localName !== 'Relationship' || !id || map.has(id)) throw unsupported('Ambiguous Word relationships.');
      map.set(id, { type: n.getAttribute('Type'), target: n.getAttribute('Target'), mode: n.getAttribute('TargetMode') });
    }
    return map;
  }
  const packageRels = relationships(parts.get('_rels/.rels'));
  const mains = [...packageRels.values()].filter(r => r.type === OFFICE_REL + 'officeDocument');
  if (mains.length !== 1 || !['word/document.xml', '/word/document.xml'].includes(mains[0].target) || mains[0].mode && mains[0].mode !== 'Internal') throw unsupported('This document uses an unsupported main part.');
  const rels = relationships(parts.get('word/_rels/document.xml.rels'));
  for (const name of ['styles', 'numbering']) {
    const links = [...rels.values()].filter(r => r.type === OFFICE_REL + name);
    if (links.length > 1 || parts.has('word/' + name + '.xml') && links.length !== 1 || links.some(r => ![name + '.xml', '/word/' + name + '.xml'].includes(r.target) || r.mode && r.mode !== 'Internal' || !parts.has('word/' + name + '.xml'))) throw unsupported('This document uses unsupported ' + name + ' parts.');
  }
  const notes = createWordNotes(parts, rels, types, relationships);
  let activeRelationships = rels, activeNote = null, noteMarks = 0;
  const notices = new Set(['The main article and supported referenced notes are imported. Headers, footers, document metadata, fonts, colors, page layout, and embedded files are not retained. Comments stay out of article text; use the separate comment recovery action to inspect or keep them privately. Keep your original Word file.']);
  const wordImages = []; let imageCount = 0;
  const warn = text => notices.add(text);
  const h = (name, content = [], attributes = {}) => {
    const node = create(name); for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
    node.append(...content); return node;
  };
  const styleRoot = parts.get('word/styles.xml'), styleMap = new Map();
  if (styleRoot && !is(styleRoot, 'styles')) throw unsupported('Invalid Word styles.');
  for (const s of children(styleRoot, 'style')) {
    const id = s.getAttributeNS(WORD_NS, 'styleId');
    if (!id || styleMap.has(id) || styleMap.size >= 512) throw unsupported('Too many or duplicate Word styles.');
    styleMap.set(id, s);
  }
  const defaults = child(styleRoot, 'docDefaults');
  const defaultRun = child(child(defaults, 'rPrDefault'), 'rPr'), defaultPara = child(child(defaults, 'pPrDefault'), 'pPr');
  const defaultParagraph = [...styleMap.values()].find(s => s.getAttributeNS(WORD_NS, 'type') === 'paragraph' && s.getAttributeNS(WORD_NS, 'default') === '1')?.getAttributeNS(WORD_NS, 'styleId');
  function chain(id) {
    const result = [], seen = new Set();
    while (id) {
      if (seen.has(id) || result.length >= 16) throw unsupported('Cyclic or deeply inherited Word styles.');
      seen.add(id); const style = styleMap.get(id);
      if (!style) { warn('An unavailable style was simplified; inspect paragraph and text formatting.'); break; }
      result.unshift(style); id = val(child(style, 'basedOn'));
    }
    return result;
  }
  function properties(list) {
    const result = {};
    for (const p of list.filter(Boolean)) {
      for (const key of ['b', 'i', 'vanish', 'webHidden']) if (child(p, key)) result[key] = on(child(p, key));
      if (child(p, 'outlineLvl')) result.outline = val(child(p, 'outlineLvl'));
      const num = child(p, 'numPr');
      if (num) { if (child(num, 'numId')) result.numId = val(child(num, 'numId')); if (child(num, 'ilvl')) result.level = val(child(num, 'ilvl')); }
      if (child(p, 'u') || child(p, 'strike') || child(p, 'dstrike') || child(p, 'vertAlign')) warn('Some inline formatting was simplified to ordinary text.');
    }
    return result;
  }
  const numbering = parts.get('word/numbering.xml'), abstracts = new Map(), nums = new Map();
  if (numbering && !is(numbering, 'numbering')) throw unsupported('Invalid Word numbering.');
  for (const a of children(numbering, 'abstractNum')) { const id = a.getAttributeNS(WORD_NS, 'abstractNumId'); if (!id || abstracts.has(id)) throw unsupported('Ambiguous Word numbering.'); abstracts.set(id, a); }
  for (const n of children(numbering, 'num')) { const id = n.getAttributeNS(WORD_NS, 'numId'); if (!id || nums.has(id)) throw unsupported('Ambiguous Word numbering.'); nums.set(id, n); }
  function levelFor(id, level) {
    if (!/^[0-5]$/.test(level)) throw unsupported('Lists support at most six ordinary levels.');
    const num = nums.get(id), abstract = abstracts.get(val(child(num, 'abstractNumId')));
    const overrides = children(num, 'lvlOverride').filter(n => n.getAttributeNS(WORD_NS, 'ilvl') === level);
    if (overrides.length > 1 || children(abstract, 'lvl').filter(n => n.getAttributeNS(WORD_NS, 'ilvl') === level).length !== 1) throw unsupported('Ambiguous Word list levels.');
    const override = overrides[0];
    if (child(override, 'lvl') || child(abstract, 'numStyleLink') || child(abstract, 'styleLink')) throw unsupported('Custom list numbering cannot be preserved.');
    const def = children(abstract, 'lvl').find(n => n.getAttributeNS(WORD_NS, 'ilvl') === level), format = val(child(def, 'numFmt'));
    if (!def || !['bullet', 'decimal'].includes(format) || child(def, 'lvlRestart') || on(child(def, 'isLgl')) || format === 'decimal' && val(child(def, 'lvlText')) !== '%' + (Number(level) + 1) + '.') throw unsupported('Only ordinary bullets and decimal lists are supported.');
    const start = val(child(override, 'startOverride')) ?? val(child(def, 'start')) ?? '1';
    if (!/^\d{1,9}$/.test(start)) throw unsupported('Unsupported list starting number.');
    return { ordered: format === 'decimal', start: Number(start) };
  }
  function inline(node, inherited = {}) {
    if (node.namespaceURI !== WORD_NS) throw unsupported('Equations or other non-text content cannot be preserved.');
    const name = node.localName;
    if (name === 'ins' || name === 'del') return revisions.keep(node) ? elements(node).flatMap(n => inline(n, inherited)) : [];
    if (name === 'delText' && revisions.isDeletedText(node)) return [node.textContent];
    if (['pPr', 'rPr', 'bookmarkStart', 'bookmarkEnd', 'proofErr', 'lastRenderedPageBreak', 'commentRangeStart', 'commentRangeEnd', 'commentReference'].includes(name)) return [];
    if (['drawing', 'pict', 'object'].includes(name)) {
      if (activeNote) throw unsupported('Images and embedded objects inside notes need review in Word first.');
      warn('Images and embedded objects became numbered text placeholders. No image or external resource was loaded. Recover supported Word images explicitly before applying the import.');
      const image = wordImageReference(node, rels, types, ++imageCount);
      if (wordImages.length < 200) wordImages.push(image);
      else warn('Image recovery maps only the first 200 visible image or object positions. Inspect the remaining placeholders in Word.');
      return [image.placeholder];
    }
    if (['footnoteReference', 'endnoteReference'].includes(name)) {
      if (activeNote) throw unsupported('Nested note references cannot be preserved.');
      return [notes.reference(node)];
    }
    if (['footnoteRef', 'endnoteRef'].includes(name)) {
      if (name !== activeNote + 'Ref' || ++noteMarks > 1 || elements(node).length) throw unsupported('Unexpected or repeated note reference marks cannot be preserved.');
      return [];
    }
    if (['fldChar', 'instrText', 'fldSimple', 'altChunk', 'sym'].includes(name)) throw unsupported('Fields and special symbols need review in Word first.');
    if (name === 't') return [node.textContent];
    if (name === 'tab') { warn('Tabs were simplified to spaces.'); return [' ']; }
    if (name === 'br' || name === 'cr') { if (node.getAttributeNS(WORD_NS, 'type') && node.getAttributeNS(WORD_NS, 'type') !== 'textWrapping') warn('Page or column breaks became ordinary line breaks.'); return [h('br')]; }
    if (name === 'noBreakHyphen') return ['\u2011'];
    if (name === 'softHyphen') return ['\u00ad'];
    if (name === 'r') {
      const rp = child(node, 'rPr'), style = chain(val(child(rp, 'rStyle')));
      const props = { ...inherited, ...properties(style.map(s => child(s, 'rPr')).concat(rp)) };
      if (props.vanish || props.webHidden) { warn('Explicitly hidden text was omitted.'); return []; }
      let content = elements(node).flatMap(n => inline(n, props));
      if (props.b) content = [h('strong', content)];
      if (props.i) content = [h('em', content)];
      return content;
    }
    if (name === 'hyperlink') {
      const content = elements(node).flatMap(n => inline(n, inherited));
      const rel = activeRelationships.get(node.getAttributeNS(OFFICE_REL.slice(0, -1), 'id'));
      const url = rel?.type === OFFICE_REL + 'hyperlink' && rel.mode === 'External' && safeWebLink(rel.target);
      if (!url) { warn('Unsafe, internal, or unsupported links lost their targets; link text was kept.'); return content; }
      return [h('a', content, { href: url })];
    }
    throw unsupported('Unsupported content appears inside a Word paragraph.');
  }
  function paragraph(p) {
    const pp = child(p, 'pPr'), id = val(child(pp, 'pStyle')) || defaultParagraph, styles = chain(id);
    const props = properties([defaultPara, ...styles.map(s => child(s, 'pPr')), pp]);
    const run = properties([defaultRun, ...styles.map(s => child(s, 'rPr')), child(pp, 'rPr')]);
    const content = elements(p).filter(n => !is(n, 'pPr')).flatMap(n => inline(n, run));
    let tag = 'p';
    if (props.outline !== undefined && props.outline !== '9') { if (!/^[0-5]$/.test(props.outline)) throw unsupported('Headings deeper than level six cannot be preserved.'); tag = 'h' + (Number(props.outline) + 1); }
    else if (styles.some(s => /^(Title|Heading[1-6])$/i.test(s.getAttributeNS(WORD_NS, 'styleId') || ''))) {
      const titleStyle = [...styles].reverse().find(s => /^(Title|Heading[1-6])$/i.test(s.getAttributeNS(WORD_NS, 'styleId') || ''))?.getAttributeNS(WORD_NS, 'styleId') || '';
      tag = /^title$/i.test(titleStyle) ? 'h1' : /^heading[1-6]$/i.test(titleStyle) ? 'h' + titleStyle.slice(-1) : 'p';
    }
    if (props.numId && props.numId !== '0' && tag !== 'p') throw unsupported('Numbered headings cannot be preserved.');
    const borders = children(pp, 'pBdr'), border = borders[0], bottom = child(border, 'bottom');
    if (borders.length === 1 && elements(border).length === 1 && bottom && val(bottom) === 'single' && tag === 'p' && (!props.numId || props.numId === '0') && content.every(part => typeof part === 'string' && !part.trim())) {
      tag = 'hr'; warn('An empty paragraph with one single bottom border became a thematic break. Border styling is not retained.');
    } else if (borders.length) warn('Paragraph borders were not retained.');
    return { content, tag, numId: props.numId && props.numId !== '0' ? props.numId : null, level: props.level ?? '0' };
  }
  const counters = new Map();
  function blocks(container, inCell = false) {
    const result = [], listStack = []; let items = 0;
    for (const node of elements(container)) {
      if (is(node, 'sectPr')) continue;
      if (is(node, 'p')) {
        const p = paragraph(node);
        if (p.tag === 'hr' && inCell) throw unsupported('A separator inside a table cell needs review in Word first.');
        if (!p.numId) { listStack.length = 0; items = 0; result.push(h(p.tag, p.content)); continue; }
        if (inCell) throw unsupported('Lists in table cells cannot be preserved.');
        const def = levelFor(p.numId, p.level), depth = Number(p.level);
        if (depth > listStack.length || ++items > 200) throw unsupported('This list has missing parent levels or more than 200 items.');
        listStack.length = Math.min(listStack.length, depth + 1);
        if (listStack[depth]?.id !== p.numId) listStack.length = depth;
        const key = p.numId + ':' + depth, current = counters.get(key) ?? def.start;
        if (current > 999999999) throw unsupported('Unsupported list number.');
        if (!listStack[depth]) {
          const list = h(def.ordered ? 'ol' : 'ul', [], def.ordered ? { start: current } : {});
          if (depth) listStack[depth - 1].last.append(list); else result.push(list);
          listStack[depth] = { node: list, last: null, id: p.numId };
        }
        const li = h('li', p.content); listStack[depth].node.append(li); listStack[depth].last = li;
        counters.set(key, current + 1);
        for (let d = depth + 1; d < 6; d++) counters.delete(p.numId + ':' + d);
      } else if (is(node, 'tbl')) {
        listStack.length = 0; items = 0;
        if (inCell) throw unsupported('Nested tables cannot be preserved.');
        if (elements(node).some(n => !['tblPr', 'tblGrid', 'tr'].some(name => is(n, name)))) throw unsupported('Unsupported table structure.');
        const rows = children(node, 'tr');
        if (!rows.length || rows.length > 101) throw unsupported('Tables need a header and at most 100 data rows.');
        const table = h('table'); let columns = null;
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i], cells = children(row, 'tc'), tr = h('tr');
          if (elements(row).some(n => !is(n, 'trPr') && !is(n, 'tc'))) throw unsupported('Unsupported table row structure.');
          if (!cells.length || cells.length > 12 || columns !== null && cells.length !== columns || child(child(row, 'trPr'), 'gridBefore') || child(child(row, 'trPr'), 'gridAfter')) throw unsupported('Tables need the same one to twelve cells in every row.');
          columns = cells.length;
          for (const cell of cells) {
            const cp = child(cell, 'tcPr');
            if (child(cp, 'vMerge') || child(cp, 'hMerge') || child(cp, 'gridSpan') && val(child(cp, 'gridSpan')) !== '1') throw unsupported('Merged table cells cannot be preserved.');
            const holder = { childNodes: elements(cell).filter(n => !is(n, 'tcPr')) };
            tr.append(h(i === 0 && on(child(child(row, 'trPr'), 'tblHeader')) ? 'th' : 'td', blocks(holder, true)));
          }
          table.append(tr);
        }
        result.push(table);
      } else throw unsupported('Unsupported content appears in the main Word document.');
    }
    return result;
  }
  const converted = htmlTreeToMarkdown({ nodeType: 11, childNodes: blocks(body) }, options);
  const noteSections = notes.sections((paragraphs, group) => {
    activeRelationships = group.relationships; activeNote = group.kind; noteMarks = 0;
    try {
      const content = paragraphs.map(node => {
        const p = paragraph(node);
        if (p.numId || p.tag !== 'p') throw unsupported('Lists and headings inside notes need review in Word first.');
        return h('p', p.content);
      });
      return htmlTreeToMarkdown({ nodeType: 11, childNodes: content }, options);
    } finally { activeRelationships = rels; activeNote = null; }
  });
  const markdown = converted.markdown + (noteSections.markdown ? '\n\n' + noteSections.markdown : '');
  if (markdown.length > ARTICLE_BODY_LIMIT) throw unsupported('The article and its notes exceed 60,000 converted characters. Nothing was truncated.');
  return { markdown, warnings: [...new Set([...revisions.warnings, ...notices, ...converted.warnings, ...noteSections.warnings])], wordImages, wordRevisions: revisions.summary };
}

export async function parseDocxArticle(bytes, filename = '', options = {}) {
  const xml = await readDocxXML(bytes), parts = new Map();
  for (const [name, text] of xml) parts.set(name, parseWordXML(text));
  const converted = wordTreesToMarkdown(parts, options);
  const result = parseArticleImport(converted.markdown, filename.replace(/\.docx$/i, ''), 'markdown');
  return { ...result, kind: 'Word document', warnings: [...converted.warnings, ...result.warnings], requiresAck: true, wordImages: converted.wordImages, wordRevisions: converted.wordRevisions };
}
