import test from 'node:test';
import assert from 'node:assert/strict';
import { articleLinks, articleLinkNotes } from '../public/link-editing.js';
import { inlineTokens } from '../public/markdown-inline.js';
import { baselineArticleLinks } from './fixtures/article-links-20261016.js';

const link='[日本語 😀](https://example.test/path?x=1&y=2)';
test('Articles without an opening bracket skip inline inspection without changing results',()=>{
  const body='## Plain heading\n\nOrdinary **bold**, *italic*, ~~strike~~, `code` and https://example.test/.\n\n- List item\n- Second\n\n| Header |\n| --- |\n| Value |\n\n> Quote\n\n---';
  assert.deepEqual(articleLinks(body,{readTokens:()=>{assert.fail('Impossible block reached inline parsing');}}),baselineArticleLinks(body));
});
test('Every literal bracket candidate retains the authoritative parser, including escaped and invalid forms',()=>{
  for(const body of ['[','\\[literal\\]',link,'**'+link+'**','~~'+link+'~~','`'+link+'`','![image](https://example.test/a)','[bad](javascript:bad())','[reference][id]','<b>[literal]</b>']){
    let calls=0;const result=articleLinks(body,{readTokens:text=>{calls++;return inlineTokens(text);}});
    assert.deepEqual(result,baselineArticleLinks(body));assert.equal(calls,1,body);
  }
  assert.deepEqual(articleLinks('~~~\n'+link+'\n~~~',{readTokens:()=>{assert.fail('Fenced code reached inline parsing');}}),[]);
});
test('Complete Unicode/CRLF records, tables, formatted labels and emphasis remain exact',()=>{
  const body='😀 Intro\r\n\r\n## '+link+'\r\n\r\n- **'+link+'**\r\n\r\n| Resource |\r\n| --- |\r\n| '+link+' |\r\n\r\n[**styled**](https://example.test/)\r\n[bad](javascript:bad())';
  const expected=baselineArticleLinks(body);assert.deepEqual(articleLinks(body),expected);
  assert.equal(expected.length,5);assert.equal(expected.filter(item=>item.inTable).length,1);
  for(const item of expected)assert.equal(item.line,body.slice(0,item.start).split('\n').length);
});
test('Five thousand mixed editing states match the frozen starting reader without any retained state',()=>{
  const pieces=[link,'## '+link,'**'+link+'**','~~'+link+'~~','`'+link+'`','~~~','> '+link,'- '+link,'| Head |\n| --- |\n| '+link+' |','---','===','[ref][id]','[id]: https://example.test/','[bad](javascript:bad())','[**styled**](https://example.test/)','<b>literal</b>','😀 café',''];
  let seed=7361;const next=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed;};
  for(let i=0;i<5000;i++){
    const body=Array.from({length:1+next()%9},()=>pieces[next()%pieces.length]).join(i%3?'\n\n':'\r\n');
    assert.deepEqual(articleLinks(body),baselineArticleLinks(body),'editing state '+i);
  }
});
test('Near-limit all-linked and mostly impossible articles preserve every link and complete notes',()=>{
  const bodies=[Array.from({length:900},(_,i)=>'[Resource '+i+'](https://example.test/'+i+')').join('\n\n'),'a'.repeat(60000-link.length-4)+'\r\n\r\n'+link];
  for(const body of bodies){assert.ok(body.length<=60000);assert.deepEqual(articleLinks(body),baselineArticleLinks(body));}
  assert.match(articleLinkNotes(bodies[0]),/Resource 899/);assert.equal(bodies[1].length,60000);
});
test('Body validation runs before shortcuts and parser errors leave later reads unchanged',()=>{
  for(const body of [null,{},'bad\0text','x'.repeat(60001)])assert.throws(()=>articleLinks(body),/60,000/);
  assert.throws(()=>articleLinks(link,{readTokens:()=>{throw Error('Fixture failure');}}),/Fixture failure/);
  assert.deepEqual(articleLinks(''),[]);assert.deepEqual(articleLinks(link),baselineArticleLinks(link));
});
