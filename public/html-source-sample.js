import { htmlTreeToMarkdown } from './html-import.js';

// One fictional tree supplies the HTML and its actual converter output.
const text = value => ({ nodeType: 3, nodeValue: value, childNodes: [] });
const element = (name, nodes, attributes = {}) => ({ nodeType: 1, localName: name, childNodes: nodes.map(node => typeof node === 'string' ? text(node) : node),
  getAttribute: key => attributes[key] ?? null, hasAttribute: key => Object.hasOwn(attributes, key), attributes });
const root = { nodeType: 11, childNodes: [
  element('h1', ['A fictional garden plan']),
  element('p', ['Keep the ', element('strong', ['useful details']), ' and the ', element('a', ['source link'], { href: '/garden' }), '.']),
  element('h2', ['Next visit']),
  element('ol', [element('li', ['Check the seedlings']), element('li', ['Record what changed'])], { start: '4' }),
  element('hr', []),
  element('table', [element('tr', [element('th', ['Task']), element('th', ['When'])]), element('tr', [element('td', ['Water']), element('td', ['Morning'])])]),
  element('p', ['This example is fictional. Replace it with your own writing.'])
] };
const escape = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const serialize = node => node.nodeType === 3 ? escape(node.nodeValue) : '<' + node.localName + Object.entries(node.attributes).map(([key, value]) => ' ' + key + '="' + escape(value) + '"').join('') + '>' + (node.localName === 'hr' ? '' : node.childNodes.map(serialize).join('') + '</' + node.localName + '>');
const sourceURL = 'https://example.com/notes/plan';
export const HTML_SOURCE_SAMPLE = Object.freeze({ sourceURL, html: root.childNodes.map(serialize).join('\n'), markdown: htmlTreeToMarkdown(root, { sourceURL }).markdown });
