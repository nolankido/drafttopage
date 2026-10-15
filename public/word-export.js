import { articleIssues } from './authoring.js';
import { previewBlocks, inlineParts } from './preview.js';
import { createWordZip, WORD_PART_NAMES } from './zip.js';

export const WORD_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const P = 'http://schemas.openxmlformats.org/package/2006/relationships';
const declaration = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const xml = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
function validateXMLText(text) {
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/.test(text)) throw new Error('The Word export contains unsupported XML characters. Your writing is unchanged.');
  for (const char of text) { const point = char.codePointAt(0); if (point >= 0xd800 && point <= 0xdfff) throw new Error('The Word export contains an incomplete Unicode character. Your writing is unchanged.'); }
}
export function wordDocumentIssues(draft, { includeTitle = false } = {}) {
  if (typeof includeTitle !== 'boolean') return { title: 'Choose whether to include the title in the Word file.' };
  const issues = articleIssues(draft, includeTitle ? 'html' : 'body');
  if (!Object.keys(issues).length) {
    try { validateXMLText(draft.body); if (includeTitle) validateXMLText(draft.title); }
    catch (error) { issues.body = error.message; }
  }
  return issues;
}
const textRuns = (text, properties = '') => {
  // Tabs and authored line breaks are Word elements, never XML indentation or field instructions.
  const content = text.split(/([\t\n])/).map(piece => piece === '\t' ? '<w:tab/>' : piece === '\n' ? '<w:br/>' : piece ? '<w:t xml:space="preserve">' + xml(piece) + '</w:t>' : '').join('');
  return content ? '<w:r>' + (properties ? '<w:rPr>' + properties + '</w:rPr>' : '') + content + '</w:r>' : '';
};
const style = (id, name, size, extra = '') => '<w:style w:type="paragraph" w:styleId="' + id + '"><w:name w:val="' + name + '"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr>' + extra + '</w:pPr><w:rPr>' + (id.startsWith('Heading') ? '<w:b/>' : '') + '<w:color w:val="000000"/><w:sz w:val="' + size + '"/><w:szCs w:val="' + size + '"/></w:rPr></w:style>';
const styles = declaration + '<w:styles xmlns:w="' + W + '">' +
  '<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:color w:val="000000"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:widowControl/><w:spacing w:after="160" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>' +
  '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>' +
  style('Title', 'Title', 40, '<w:keepNext/><w:spacing w:before="0" w:after="240"/>') +
  Array.from({ length: 6 }, (_, i) => style('Heading' + (i + 1), 'heading ' + (i + 1), [32, 28, 25, 24, 23, 22][i], '<w:keepNext/><w:keepLines/><w:spacing w:before="240" w:after="120"/><w:outlineLvl w:val="' + i + '"/>')).join('') +
  style('Quote', 'Quote', 22, '<w:ind w:left="360" w:right="360"/>') +
  '<w:style w:type="paragraph" w:styleId="TableHeader"><w:name w:val="Table header"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:color w:val="000000"/></w:rPr></w:style>' +
  '<w:style w:type="paragraph" w:styleId="Code"><w:name w:val="Code"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="160" w:line="240" w:lineRule="auto"/></w:pPr><w:rPr><w:rFonts w:ascii="Courier New" w:hAnsi="Courier New"/><w:sz w:val="21"/><w:szCs w:val="21"/></w:rPr></w:style>' +
  '<w:style w:type="character" w:styleId="CodeChar"><w:name w:val="Inline code"/><w:rPr><w:rFonts w:ascii="Courier New" w:hAnsi="Courier New"/></w:rPr></w:style>' +
  '<w:style w:type="character" w:styleId="Hyperlink"><w:name w:val="Hyperlink"/><w:rPr><w:color w:val="244B40"/><w:u w:val="single"/></w:rPr></w:style></w:styles>';

function abstractNumbering(ordered) {
  return '<w:abstractNum w:abstractNumId="' + (ordered ? 1 : 0) + '"><w:multiLevelType w:val="hybridMultilevel"/>' + Array.from({ length: 6 }, (_, level) =>
    '<w:lvl w:ilvl="' + level + '"><w:start w:val="1"/><w:numFmt w:val="' + (ordered ? 'decimal' : 'bullet') + '"/><w:lvlText w:val="' + (ordered ? '%' + (level + 1) + '.' : ['•', '◦', '▪'][level % 3]) + '"/><w:lvlJc w:val="left"/><w:pPr><w:tabs><w:tab w:val="num" w:pos="' + (720 + level * 360) + '"/></w:tabs><w:ind w:left="' + (720 + level * 360) + '" w:hanging="360"/></w:pPr></w:lvl>'
  ).join('') + '</w:abstractNum>';
}

export function wordDocumentParts(draft, { includeTitle = false } = {}) {
  const issues = wordDocumentIssues(draft, { includeTitle });
  if (Object.keys(issues).length) throw new Error(Object.values(issues)[0]);
  const links = new Map(), numbers = [];
  const inline = text => inlineParts(text).map(part => {
    if (part.type === 'a') {
      if (!links.has(part.href)) links.set(part.href, 'rIdLink' + (links.size + 1));
      return '<w:hyperlink r:id="' + links.get(part.href) + '">' + textRuns(part.text, '<w:rStyle w:val="Hyperlink"/>') + '</w:hyperlink>';
    }
    const props = part.type === 'strong' ? '<w:b/>' : part.type === 'em' ? '<w:i/>' : part.type === 'code' ? '<w:rStyle w:val="CodeChar"/>' : '';
    return textRuns(part.text, props);
  }).join('');
  const paragraph = (content, props = '') => '<w:p>' + (props ? '<w:pPr>' + props + '</w:pPr>' : '') + content + '</w:p>';
  const list = (block, depth = 0) => {
    const id = numbers.length + 1, ordered = block.type === 'ol';
    numbers.push('<w:num w:numId="' + id + '"><w:abstractNumId w:val="' + (ordered ? 1 : 0) + '"/>' + (ordered ? '<w:lvlOverride w:ilvl="' + depth + '"><w:startOverride w:val="' + (block.start ?? 1) + '"/></w:lvlOverride>' : '') + '</w:num>');
    return block.items.map((text, index) => paragraph(inline(text), '<w:numPr><w:ilvl w:val="' + depth + '"/><w:numId w:val="' + id + '"/></w:numPr>') + (block.children?.[index] || []).map(child => list(child, depth + 1)).join('')).join('');
  };
  const table = block => {
    // Prefer wider narrative columns, bounded by a common page width and minimum cell width.
    const weights = block.head.map((header, col) => Math.max(4, Math.min(32, Math.max(header.length, ...block.rows.map(row => row[col].length)))));
    const remaining = 9360 - weights.length * 400, total = weights.reduce((sum, value) => sum + value, 0);
    const widths = weights.map(weight => 400 + Math.floor(remaining * weight / total)); widths[widths.length - 1] += 9360 - widths.reduce((sum, value) => sum + value, 0);
    const border = name => '<w:' + name + ' w:val="single" w:sz="4" w:color="D9D9D9"/>';
    const rows = [block.head, ...block.rows].map((cells, row) => '<w:tr>' + (!row ? '<w:trPr><w:tblHeader/></w:trPr>' : '') + cells.map((text, col) => '<w:tc><w:tcPr><w:tcW w:w="' + widths[col] + '" w:type="dxa"/>' + (!row ? '<w:shd w:val="clear" w:fill="E9EEF0"/>' : '') + '<w:vAlign w:val="center"/></w:tcPr>' + paragraph(inline(text), (!row ? '<w:pStyle w:val="TableHeader"/>' : '') + '<w:spacing w:after="80" w:line="276" w:lineRule="auto"/><w:jc w:val="' + (block.align[col] || 'left') + '"/>') + '</w:tc>').join('') + '</w:tr>').join('');
    return '<w:tbl><w:tblPr><w:tblW w:w="9360" w:type="dxa"/><w:tblBorders>' + ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(border).join('') + '</w:tblBorders><w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="100" w:type="dxa"/><w:left w:w="120" w:type="dxa"/><w:bottom w:w="100" w:type="dxa"/><w:right w:w="120" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>' + widths.map(width => '<w:gridCol w:w="' + width + '"/>').join('') + '</w:tblGrid>' + rows + '</w:tbl>';
  };
  const blocks = previewBlocks(draft.body);
  const body = (includeTitle ? paragraph(textRuns(draft.title.trim()), '<w:pStyle w:val="Title"/>') : '') + blocks.map(block => {
    if (block.items) return list(block);
    if (block.type === 'table') return table(block) + paragraph('', '<w:spacing w:before="0" w:after="0" w:line="120" w:lineRule="exact"/>');
    if (block.type === 'pre') return paragraph(textRuns(block.text), '<w:pStyle w:val="Code"/>');
    const style = block.level ? 'Heading' + block.level : block.type === 'blockquote' ? 'Quote' : '';
    return paragraph(inline(block.text), style ? '<w:pStyle w:val="' + style + '"/>' : '');
  }).join('');
  const document = declaration + '<w:document xmlns:w="' + W + '" xmlns:r="' + R + '"><w:body>' + body + '<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr></w:body></w:document>';
  const relationship = (id, type, target, external = false) => '<Relationship Id="' + id + '" Type="' + R + '/' + type + '" Target="' + xml(target) + '"' + (external ? ' TargetMode="External"' : '') + '/>';
  const parts = [
    declaration + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' + ['document', 'styles', 'numbering'].map(name => '<Override PartName="/word/' + name + '.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.' + (name === 'document' ? 'document.main' : name) + '+xml"/>').join('') + '</Types>',
    declaration + '<Relationships xmlns="' + P + '">' + relationship('rIdDocument', 'officeDocument', 'word/document.xml') + '</Relationships>',
    document,
    declaration + '<Relationships xmlns="' + P + '">' + relationship('rIdStyles', 'styles', 'styles.xml') + relationship('rIdNumbering', 'numbering', 'numbering.xml') + Array.from(links, ([href, id]) => relationship(id, 'hyperlink', href, true)).join('') + '</Relationships>',
    styles,
    declaration + '<w:numbering xmlns:w="' + W + '">' + abstractNumbering(false) + abstractNumbering(true) + numbers.join('') + '</w:numbering>'
  ];
  return WORD_PART_NAMES.map((name, index) => ({ name, content: parts[index] }));
}
export function createWordDocument(draft, options = {}) {
  return createWordZip(wordDocumentParts(draft, options));
}
