import test from 'node:test';
import assert from 'node:assert/strict';
import { articleProtectionMask } from '../public/search-protection.js';
import { articleSearchResults, findArticleMatches, previewArticleReplacements, replaceArticleMatch } from '../public/article-search.js';

const protectedScope = { scope: 'protected' };
test('Protected replacement keeps exact code, links, reference definitions and markup while editing eligible prose', () => {
  const untouched = [
    '`old` and ``old ` old``',
    '```js\r\nconst old = "old";\r\n```',
    '~~~~\r\nold ~~~ old\r\n~~~~',
    '> - ```\r\n>   old\r\n>   ```',
    '    old indented\r\n\told tabbed',
    '[old](relative/old "old") ![old](images/old.png) [old][ref] [old][] [old]',
    '[ref]: /old\r\n  "old title"\r\nold continuation',
    'https://fictional.example/old ftp://fictional.example/old www.fictional.example/old mailto:old@example.invalid',
    '<!-- old --> <?old?> <![CDATA[old]]> <old@example.invalid>',
    '<script>old</script> <STYLE>old</STYLE> <pre>old</pre> <textarea>old</textarea> <code>old</code>'
  ].join('\r\n\r\n');
  const body = '😀 old **old**\r\n\r\n' + untouched + '\r\n\r\n<a title="old > old" href="/old">old</a>\r\nold ending';
  const plan = previewArticleReplacements(body, 'old', '$&', protectedScope);
  assert.equal(plan.changedCount, 4);
  assert.equal(plan.body, '😀 $& **$&**\r\n\r\n' + untouched + '\r\n\r\n<a title="old > old" href="/old">$&</a>\r\n$& ending');
  for (const match of findArticleMatches(body, 'old', protectedScope)) assert.equal(body.slice(match.start, match.end), 'old');
  assert.equal(findArticleMatches(body, 'old')[0].start, 3);
  assert.ok(findArticleMatches(body, 'old').length > plan.changedCount);
});
test('Protection handles nested brackets, escaped delimiters, balanced destinations and code-span run lengths', () => {
  for (const fragment of [
    '[old [old] old](path(old)/old "old ) title")',
    '[old \\] old](old)',
    '[`old ]` old](old)',
    '![old](old)',
    '[old] [old reference]',
    '``old ` old``',
    '`old\r\nold`',
    '<span title="old > old">',
    '\\[old\\]'
  ]) {
    const results = articleSearchResults('old ' + fragment + ' old', 'old', protectedScope);
    // An escaped literal bracket is not a link. Its ordinary inner text remains editable.
    const expected = fragment === '\\[old\\]' ? 3 : 2;
    assert.equal(results.matches.length, expected, fragment);
    assert.equal(results.totalCount, results.matches.length + results.protectedCount + results.partialCount);
  }
  assert.equal(findArticleMatches('before \\* after *', '*', protectedScope).length, 1);
});
test('Conservative protection skips literal brackets and entire phrases that touch protected source', () => {
  assert.equal(findArticleMatches('old [old aside] old', 'old', protectedScope).length, 2);
  assert.equal(findArticleMatches('old `code` old', 'old `code`', protectedScope).length, 0);
  assert.equal(findArticleMatches('old [label](old) old', '[label]', protectedScope).length, 0);
  assert.equal(findArticleMatches('![old](old)', '!', protectedScope).length, 0);
  const changed = replaceArticleMatch('😀 `old` old', 'old', 'new', 0, protectedScope);
  assert.deepEqual(changed, { body: '😀 `old` new', selectionStart: 9, selectionEnd: 12, changedCount: 1 });
});
test('Unclosed syntax fails conservatively and never falls back to full-source replacement', () => {
  for (const fragment of ['` old', '[old', '[label](old', '<span title="old', '<!-- old', '<script>old', '```\nold', '~~~~\nold']) {
    const body = 'old\n\n' + fragment + '\n\nold ending';
    assert.equal(previewArticleReplacements(body, 'old', 'new', protectedScope).body, 'new\n\n' + fragment + '\n\nold ending', fragment);
    assert.ok(previewArticleReplacements(body, 'old', 'new', { scope: 'source' }).changedCount > 1);
  }
});
test('Whole-word filtering uses Unicode neighbors and keeps exact UTF-16 offsets', () => {
  const body = 'foo food seafood _foo foo_ éfoo fooé 2foo foo2 foo\u0301 foo\u200d 𐐀foo foo𐐀 foo-bar foo\'s 😀foo😀 FOO';
  const result = articleSearchResults(body, 'foo', { wholeWords: true });
  assert.deepEqual(result.matches.map(match => match.text), ['foo', 'foo', 'foo', 'foo', 'FOO']);
  assert.equal(result.partialCount, 12);
  for (const match of result.matches) assert.equal(body.slice(match.start, match.end), match.text);
  assert.equal(findArticleMatches('café caféine CAFÉ', 'café', { wholeWords: true }).length, 2);
  assert.equal(findArticleMatches('日本語 日本', '日本', { wholeWords: true }).length, 1);
  assert.equal(findArticleMatches('a b a bc', 'a b', { wholeWords: true }).length, 1);
  assert.equal(findArticleMatches('foo FOO', 'foo', { wholeWords: true, matchCase: true }).length, 1);
});
test('Filtered counts are disjoint and source mode remains a deliberate literal alternative', () => {
  const body = 'old older `old older` [old] old';
  const result = articleSearchResults(body, 'old', { scope: 'protected', wholeWords: true });
  assert.deepEqual({ ...result, matches: result.matches.length }, { matches: 2, protectedCount: 2, partialCount: 2, totalCount: 6 });
  assert.equal(previewArticleReplacements(body, 'old', 'new', { scope: 'source' }).body, 'new newer `new newer` [new] new');
  assert.deepEqual(articleSearchResults('`unclosed', '', protectedScope), { matches: [], protectedCount: 0, partialCount: 0, totalCount: 0 });
  for (const options of [{ scope: 'prose' }, { wholeWords: 'yes' }, { matchCase: 1 }]) assert.throws(() => articleSearchResults(body, 'old', options));
});
test('Maximum-size ambiguous and deeply nested inputs stay bounded without rewriting source', () => {
  for (const body of [
    '['.repeat(30000) + ']'.repeat(30000),
    '`'.repeat(29999) + 'x' + '`'.repeat(30000),
    ('<a title="old">old</a> ').repeat(2608).slice(0, 60000),
    'x\n'.repeat(30000),
    ('[old](x "old") `old` old\r\n').repeat(2400).slice(0, 60000)
  ]) {
    const mask = articleProtectionMask(body);
    assert.equal(mask.length, body.length);
    const result = articleSearchResults(body, 'old', protectedScope);
    for (const match of result.matches) assert.equal(body.slice(match.start, match.end), 'old');
    assert.equal(previewArticleReplacements(body, 'old', 'old', protectedScope).body, body);
  }
  assert.throws(() => articleProtectionMask('x'.repeat(60001)));
  assert.throws(() => articleProtectionMask(null));
});
