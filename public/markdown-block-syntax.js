// Shared top-level syntax. Container blocks keep their existing limited parser.
export function thematicBreak(line) {
  const text = String(line ?? '').replace(/\r$/, '').replace(/^ {0,3}/, '');
  const marker = text[0];
  if (!marker || !'*_-'.includes(marker)) return false;
  let count = 0;
  for (const character of text) {
    if (character === marker) count++;
    else if (character !== ' ' && character !== '\t') return false;
  }
  return count >= 3;
}
export function setextLevel(line) {
  const match = /^ {0,3}(=+|-+)[ \t]*\r?$/.exec(String(line ?? ''));
  return match ? match[1][0] === '=' ? 1 : 2 : 0;
}
export function setextParagraph(lines) {
  return lines.length > 0 && lines.every(line => line.trim() && !/^(?: {4}|\t)|^ {0,3}(?:>|#{1,6}(?:[ \t]|$)|[-+*](?:[ \t]|$)|\d{1,9}[.)](?:[ \t]|$)|`{3,}|~{3,}|<(?:\/?[A-Za-z][A-Za-z0-9-]*(?:[\s/>])|!|\?)|\[[^\]\n]+\]:)/.test(line));
}
