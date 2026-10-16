// Ordinary Word notes become explicit article text, never native CMS footnotes.
const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/';
const T = 'http://schemas.openxmlformats.org/package/2006/content-types';
export const MAX_WORD_NOTES = 100, MAX_WORD_NOTE_DEFINITIONS = 200;
export const MAX_WORD_NOTE_REFERENCES = 1000, MAX_WORD_NOTE_CHARACTERS = 4000, MAX_WORD_NOTE_PARAGRAPHS = 10;
const elements = node => Array.from(node?.childNodes || []).filter(n => n.nodeType === 1);
const is = (node, name) => node?.namespaceURI === W && node.localName === name;
const fail = detail => { throw new Error('Unsupported Word notes: ' + detail + ' Simplify the notes in Word or import a smaller formatted selection. Current writing is unchanged.'); };

export function createWordNotes(parts, mainRelationships, types, readRelationships) {
  let definitions = 0, used = 0, references = 0;
  const groups = ['footnote', 'endnote'].map(kind => {
    const name = kind + 's', path = 'word/' + name + '.xml', root = parts.get(path);
    const links = [...mainRelationships.values()].filter(r => r.type === R + name);
    if (links.length > 1 || root && links.length !== 1 || links.some(r => ![name + '.xml', '/' + path].includes(r.target) || r.mode && r.mode !== 'Internal' || !root)) fail('the ' + name + ' part relationship is missing or unsupported.');
    const noteMap = new Map(), ids = new Set(), relationshipRoot = parts.get('word/_rels/' + name + '.xml.rels');
    if (relationshipRoot && !root) fail('a note relationship part has no notes.');
    if (root) {
      const declarations = elements(types).filter(n => n.namespaceURI === T && n.localName === 'Override' && n.getAttribute('PartName') === '/' + path);
      if (!is(root, name) || declarations.length !== 1 || declarations[0].getAttribute('ContentType') !== 'application/vnd.openxmlformats-officedocument.wordprocessingml.' + name + '+xml') fail('the ' + name + ' root or content type is invalid.');
      for (const note of elements(root)) {
        const id = note.getAttributeNS(W, 'id'), type = note.getAttributeNS(W, 'type') || 'normal';
        if (!is(note, kind) || !/^-?(?:0|[1-9]\d{0,8})$/.test(id || '') || id === '-0' || ids.has(id)) fail('note identifiers are missing, duplicate, or unsupported.');
        ids.add(id);
        if (['separator', 'continuationSeparator', 'continuationNotice'].includes(type)) continue;
        if (type !== 'normal' || id.startsWith('-') || ++definitions > MAX_WORD_NOTE_DEFINITIONS) fail('use at most 200 ordinary note definitions with nonnegative identifiers.');
        noteMap.set(id, note);
      }
    }
    return { kind, name, notes: noteMap, selected: new Map(), relationships: readRelationships(relationshipRoot), label: kind === 'footnote' ? 'Word footnote' : 'Word endnote' };
  });
  function reference(node) {
    const group = groups.find(g => node.localName === g.kind + 'Reference');
    const id = node.getAttributeNS(W, 'id'), custom = node.getAttributeNS(W, 'customMarkFollows');
    if (!group || !/^(?:0|[1-9]\d{0,8})$/.test(id || '') || !group.notes.has(id) || elements(node).length || custom && !['0', 'false', 'off'].includes(custom)) fail('a reference is missing its ordinary note or uses a custom mark.');
    if (++references > MAX_WORD_NOTE_REFERENCES) fail('use at most 1,000 visible note references.');
    if (!group.selected.has(id)) {
      if (++used > MAX_WORD_NOTES) fail('use at most 100 referenced notes.');
      group.selected.set(id, group.selected.size + 1);
    }
    return '[' + group.label + ' ' + group.selected.get(id) + ']';
  }
  function sections(render) {
    const output = [], warnings = [];
    for (const group of groups) {
      if (group.selected.size) {
        output.push('## Imported Word ' + group.name);
        for (const [id, number] of group.selected) {
          const paragraphs = elements(group.notes.get(id));
          if (!paragraphs.length || paragraphs.length > MAX_WORD_NOTE_PARAGRAPHS || paragraphs.some(p => !is(p, 'p'))) fail('each referenced note needs one to ten ordinary paragraphs, without tables or wrappers.');
          let result;
          try { result = render(paragraphs, group); }
          catch (error) { throw new Error(group.label + ' ' + number + ': ' + error.message); }
          if (!result.markdown.trim() || result.markdown.length > MAX_WORD_NOTE_CHARACTERS) fail('each referenced note needs visible text and at most 4,000 converted characters.');
          output.push('### ' + group.label + ' ' + number, result.markdown);
          warnings.push(...result.warnings);
        }
        warnings.push('Converted ' + group.selected.size + ' referenced ' + (group.selected.size === 1 ? group.kind : group.name) + ' to an appended note section with visible labels.');
      }
      if (group.notes.size > group.selected.size) warnings.push('Unreferenced ' + group.name + ' were excluded; only notes reached by visible article references are imported.');
    }
    if (used) warnings.push('Word note labels are numbered by first visible reference, not the original Word numbering. Notes are ordinary article text and are included in article exports, without automatic numbering, clickable note links, or page-bottom placement. Compare every marker and note before importing; recheck labels when combining or editing articles.');
    return { markdown: output.join('\n\n'), warnings, count: used };
  }
  return { reference, sections };
}
