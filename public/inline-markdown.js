import { inlineParts } from './inline-render.js';
import { ARTICLE_BODY_LIMIT } from './writing-limits.js';

const literal = text => text.replace(/[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/g, '\\$&');
const contents = node => node.children || [{ type: 'text', text: node.text || '' }];
function normalize(nodes, active = new Set()) {
  const result = [];
  const append = node => {
    const previous = result.at(-1);
    if (previous && previous.type === node.type && ['text', 'code'].includes(node.type)) previous.text += node.text;
    else if (previous && previous.type === node.type && (['strong', 'em', 's'].includes(node.type) || node.type === 'a' && previous.href === node.href)) previous.children = normalize([...contents(previous), ...contents(node)], new Set([...active, node.type]));
    else result.push(node);
  };
  for (const source of nodes) {
    if (['text', 'code'].includes(source.type)) { if (source.text) append({ type: source.type, text: source.text }); continue; }
    const repeated = active.has(source.type) && source.type !== 'a';
    const children = normalize(contents(source), new Set([...active, source.type]));
    if (repeated) { children.forEach(append); continue; }
    if (['strong', 'em', 's'].includes(source.type)) {
      const leading = children[0]?.type === 'text' ? children[0].text.match(/^\s*/)[0] : '';
      if (leading) { children[0].text = children[0].text.slice(leading.length); if (!children[0].text) children.shift(); append({ type: 'text', text: leading }); }
      const last = children.at(-1), trailing = last?.type === 'text' ? last.text.match(/\s*$/)[0] : '';
      if (trailing) { last.text = last.text.slice(0, -trailing.length); if (!last.text) children.pop(); }
      if (children.length) append({ type: source.type, children });
      if (trailing) append({ type: 'text', text: trailing });
    } else append({ type: source.type, href: source.href, children });
  }
  return result;
}
function signature(nodes, flags = {}, result = []) {
  for (const node of nodes) {
    if (['strong', 'em', 's', 'a'].includes(node.type)) signature(contents(node), { ...flags, [node.type]: node.type === 'a' ? node.href : true }, result);
    else {
      const style = JSON.stringify({ strong: Boolean(flags.strong), em: Boolean(flags.em), s: Boolean(flags.s), a: (flags.a || '').replaceAll('(', '%28').replaceAll(')', '%29'), code: node.type === 'code' });
      if (result.at(-1)?.style === style) result.at(-1).text += node.text;
      else if (node.text) result.push({ text: node.text, style });
    }
  }
  return result;
}
function serialize(nodes) {
  return nodes.map(node => {
    if (node.type === 'text') return literal(node.text);
    if (node.type === 'code') {
      const longest = Math.max(0, ...Array.from(node.text.matchAll(/`+/g), match => match[0].length));
      const fence = '`'.repeat(longest + 1), pad = /^`|`$/.test(node.text) || /^ .* $/.test(node.text) && /\S/.test(node.text) ? ' ' : '';
      return fence + pad + node.text + pad + fence;
    }
    const content = serialize(contents(node));
    if (node.type === 'a') return '[' + content + '](' + node.href.replaceAll('(', '%28').replaceAll(')', '%29') + ')';
    const marker = node.type === 's' ? '~~' : node.type === 'strong' ? '**' : '*';
    return marker + content + marker;
  }).join('');
}
// Compare text, style, code, and link runs after parsing the generated Markdown.
// Ambiguous or excessive structures receive a visible plain-text fallback at import.
export function markdownFromInline(nodes) {
  const normalized = normalize(nodes), markdown = serialize(normalized);
  if (markdown.length > ARTICLE_BODY_LIMIT) throw new Error('The converted article exceeds 60,000 characters. Import a smaller selection; nothing was truncated.');
  if (JSON.stringify(signature(normalized)) === JSON.stringify(signature(inlineParts(markdown)))) return { markdown, simplified: false };
  const plain = parts => parts.map(node => node.type === 'a' ? plain(contents(node)) + ' (' + node.href + ')' : node.children ? plain(node.children) : node.text).join('');
  return { markdown: literal(plain(normalized)), simplified: true };
}
