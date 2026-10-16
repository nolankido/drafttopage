const WORD_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
export const MAX_WORD_TEXT_REVISIONS = 200;
export const WORD_REVISION_MODES = Object.freeze(['require-clean', 'proposed', 'previous']);
const elements = node => Array.from(node?.childNodes || []).filter(child => child.nodeType === 1);
const is = (node, name) => node?.namespaceURI === WORD_NS && node.localName === name;
const hasLooseText = node => Array.from(node?.childNodes || []).some(child => child.nodeType === 3 && child.textContent.trim());
const tracked = name => /^(?:(?:customXml|conflict)?(?:ins|del|moveFrom|moveTo)(?:RangeStart|RangeEnd)?|cellIns|cellDel|cellMerge)$/i.test(name) || name.endsWith('PrChange') || name === 'numberingChange';
const fail = detail => { throw new Error(detail + ' Resolve complex revisions in Word and save a new .docx. Current writing is unchanged.'); };

// Validate both kept and omitted revisions before converting either version.
// Paragraph marks, moves, formatting, nested revisions and note revisions are
// intentionally refused. No detached XML node is rewritten or attached to UI.
export function inspectWordTextRevisions(parts, mode = 'require-clean') {
  if (!WORD_REVISION_MODES.includes(mode)) throw new Error('Choose a valid Word text revision version.');
  const allowed = new WeakSet(), deletedText = new WeakSet();
  const summary = { mode, insertions: 0, deletions: 0 };
  let nodes = 0;
  for (const [part, root] of parts) {
    const stack = [[root, null, 0]];
    while (stack.length) {
      const [node, parent, depth] = stack.pop();
      if (++nodes > 30000 || depth > 40) throw new Error('The Word XML is too complex. Current writing is unchanged.');
      if (node.namespaceURI === WORD_NS && tracked(node.localName)) {
        if (mode === 'require-clean') throw new Error('Unresolved tracked changes were found. Choose Proposed text or Previous text under Word text revisions, then preview again, or resolve the changes in Word. Current writing is unchanged.');
        if (part !== 'word/document.xml' || !['ins', 'del'].includes(node.localName) || !['p', 'hyperlink'].some(name => is(parent, name))) fail('Only ordinary inline text insertions and deletions in the main article are supported.');
        const runs = elements(node), textName = is(node, 'del') ? 'delText' : 't';
        if (!runs.length || hasLooseText(node) || runs.some(run => !is(run, 'r'))) fail('A text revision contains unsupported or nested content.');
        for (const run of runs) {
          const content = elements(run);
          if (hasLooseText(run) || content.filter(child => is(child, 'rPr')).length > 1) fail('A text revision has malformed text or ambiguous run properties.');
          for (const child of content) {
            if (!['rPr', textName, 'tab', 'br', 'cr', 'noBreakHyphen', 'softHyphen'].some(name => is(child, name))) fail('A text revision contains fields, images, references, or other unsupported content.');
            if (!is(child, 'rPr') && elements(child).length) fail('A text revision contains malformed text.');
            if (is(child, 'delText')) deletedText.add(child);
          }
        }
        allowed.add(node);
        if (is(node, 'ins')) summary.insertions++; else summary.deletions++;
        if (summary.insertions + summary.deletions > MAX_WORD_TEXT_REVISIONS) fail('Use at most 200 text insertion and deletion groups.');
      }
      if (is(node, 'delText') && !deletedText.has(node)) fail('Deleted text appears outside a supported deletion group.');
      for (const child of elements(node)) stack.push([child, node, depth + 1]);
    }
  }
  const hasChanges = summary.insertions + summary.deletions > 0;
  const description = mode === 'proposed' ? 'Proposed text keeps insertions and omits deletions.' : 'Previous text keeps deletions and omits insertions.';
  return {
    summary,
    keep(node) {
      if (!allowed.has(node)) fail('An unsupported revision cannot be converted.');
      return is(node, mode === 'proposed' ? 'ins' : 'del');
    },
    isDeletedText: node => deletedText.has(node),
    warnings: hasChanges ? [summary.insertions + ' tracked text insertion group(s) and ' + summary.deletions + ' deletion group(s) found. ' + description + ' This is a flattened article version, not a Word revision review or a historical original. Author names, dates, and revision history are not retained. Compare with the original Word file before importing.'] : []
  };
}
