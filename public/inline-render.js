import { inlineTokens, decodeMarkdownEscapes } from './markdown-inline.js';

const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
export function inlineParts(text) {
  const convert = nodes => nodes.map(node => {
    if (node.type === 'image' || node.type === 'link' && !node.href) return { type: 'text', text: text.slice(node.start, node.end) };
    const children = node.children ? convert(node.children) : null;
    const part = { type: node.type === 'link' ? 'a' : node.type, text: children ? children.map(child => child.text).join('') : node.type === 'code' ? node.text : decodeMarkdownEscapes(node.text) };
    if (node.type === 'link') part.href = node.href;
    if (children?.some(child => child.type !== 'text')) part.children = children;
    return part;
  });
  return convert(inlineTokens(text));
}
export function inlineHTML(text, { accessibleLinks = false, lineBreaks = false } = {}) {
  const render = parts => parts.map(part => {
    const content = part.children ? render(part.children) : escape(part.text);
    if (part.type === 'text') return content;
    if (part.type === 'a') return '<a href="' + escape(part.href) + '" target="_blank" rel="noopener noreferrer"' + (accessibleLinks ? ' aria-label="' + escape(part.text + ' (opens in a new tab)') + '"' : '') + '>' + content + '</a>';
    return '<' + part.type + '>' + content + '</' + part.type + '>';
  }).join('');
  const html = render(inlineParts(text));
  return lineBreaks ? html.replaceAll('\n', '<br>') : html;
}
export function inlinePlainText(text, { linkURLs = false } = {}) {
  const render = parts => parts.map(part => (part.children ? render(part.children) : part.text) + (linkURLs && part.type === 'a' ? ' (' + part.href + ')' : '')).join('');
  return render(inlineParts(text));
}
