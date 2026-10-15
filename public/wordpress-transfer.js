import { wordPressArticleText } from './wordpress-export.js';

export const TRANSFER_TEXT_LIMIT = 120000;
const normalize = text => text.replace(/\s+/gu, ' ').trim();

/** A linear, text-only comparison. No pasted markup is parsed or executed. */
export function compareWordPressText(draft, received, options) {
  if (typeof received !== 'string' || received.length > TRANSFER_TEXT_LIMIT || received.includes('\u0000')) throw new Error('Use post body text up to 120,000 characters without null characters. Nothing was compared.');
  const expected = wordPressArticleText(draft, options), expectedText = normalize(expected.text), receivedText = normalize(received);
  if (!expectedText) throw new Error('This article has no exported body text to compare. Inspect its images directly in WordPress.');
  if (!receivedText) throw new Error('Paste the post body copied from the WordPress Visual editor first.');
  const left = Array.from(expectedText), right = Array.from(receivedText);
  let first = 0;
  while (first < left.length && first < right.length && left[first] === right[first]) first++;
  const excerpt = chars => (first > 40 ? '…' : '') + chars.slice(Math.max(0, first - 40), first + 80).join('') + (chars.length > first + 80 ? '…' : '');
  const matches = first === left.length && first === right.length;
  return { matches, expectedText: expected.text, expectedCharacters: left.length, receivedCharacters: right.length, firstDifference: matches ? null : first + 1, expectedExcerpt: matches ? '' : excerpt(left), receivedExcerpt: matches ? '' : excerpt(right), imageCount: expected.imageCount };
}
