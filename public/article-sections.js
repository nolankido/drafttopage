import { articleStructure } from './draft-review.js';

// Sections start at an ATX heading and include every deeper subsection.
export function articleSections(body) {
  const blocks = articleStructure(body);
  const headings = blocks.filter(block => block.kind === 'heading');
  const stack = [], sections = [], siblings = new Map();
  headings.forEach((heading, index) => {
    while (stack.length && sections[stack.at(-1)].level >= heading.level) sections[stack.pop()].sectionEnd = heading.start;
    const parent = stack.at(-1) ?? null;
    const section = { ...heading, parent, sectionEnd: body.length, up: null, down: null };
    const key = parent + ':' + heading.level, previous = siblings.get(key);
    if (previous !== undefined && sections[previous].sectionEnd === heading.start) {
      section.up = previous; sections[previous].down = index;
    }
    siblings.set(key, index); sections.push(section);
    stack.push(index);
  });
  return { sections, movable: !blocks.some(block => block.kind === 'code' && block.unclosed) };
}

export function moveArticleSection(body, headingStart, direction) {
  if (!Number.isInteger(headingStart) || !['up', 'down'].includes(direction)) throw new Error('Choose a current section and a move direction.');
  const { sections, movable } = articleSections(body);
  if (!movable) throw new Error('Close the unfinished code fence before moving sections. Current writing is unchanged.');
  const section = sections.find(item => item.start === headingStart);
  if (!section) throw new Error('The section outline changed. Choose its current heading.');
  const neighbor = sections[section[direction]];
  if (!neighbor) throw new Error('This section has no adjacent section at the same level within its parent.');
  const first = direction === 'up' ? neighbor : section, second = direction === 'up' ? section : neighbor;
  // Leave inter-section and final line breaks in their original slots. This
  // keeps the article length and final newline intact even for a final section
  // without a newline, while moving each section's writing without rewriting it.
  const split = item => {
    const text = body.slice(item.start, item.sectionEnd), gap = /(?:\r?\n)+$/.exec(text)?.[0] ?? '';
    return { text: text.slice(0, text.length - gap.length), gap };
  };
  const a = split(first), b = split(second);
  const result = body.slice(0, first.start) + b.text + a.gap + a.text + b.gap + body.slice(second.sectionEnd);
  const start = direction === 'up' ? first.start : first.start + b.text.length + a.gap.length;
  const lineEnd = result.indexOf('\n', start);
  return { body: result, selectionStart: start, selectionEnd: lineEnd < 0 ? result.length : lineEnd, heading: section.text };
}
