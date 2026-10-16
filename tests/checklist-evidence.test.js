import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

test('Independent checklist evidence rejects flattened nesting, moved children and changed states in saved posts', () => {
  const result = execFileSync('python3', ['-c', String.raw`
import copy,sys
from pathlib import Path
sys.path.insert(0,str(Path('scripts').resolve()))
from document_benchmark import ArticleHTML
from wordpress_roundtrip import check_post
good_html='<ul><li>[Checked] done</li><li>[Unchecked] todo<ul><li>[Checked] done</li><li>[Unchecked] todo</li></ul></li><li>[Unchecked] todo</li></ul>'
expected=[{'path':[0,0],'text':'[Checked] done'},{'path':[0,1],'text':'[Unchecked] todo'},{'path':[0,1,0],'text':'[Checked] done'},{'path':[0,1,1],'text':'[Unchecked] todo'},{'path':[0,2],'text':'[Unchecked] todo'}]
assert ArticleHTML(good_html).list_paths==expected
case={'title':'Fictional checklist','text':'[Checked] done [Unchecked] todo [Checked] done [Unchecked] todo [Unchecked] todo','listPaths':expected}
good={'status':'draft','title':{'raw':case['title']},'content':{'raw':good_html,'rendered':good_html}}
assert check_post(good,case,[])==good_html
wrong=[
 '<ul><li>[Checked] done</li><li>[Unchecked] todo</li><li>[Checked] done</li><li>[Unchecked] todo</li><li>[Unchecked] todo</li></ul>',
 '<ul><li>[Checked] done<ul><li>[Unchecked] todo</li><li>[Checked] done</li><li>[Unchecked] todo</li></ul></li><li>[Unchecked] todo</li></ul>',
 good_html.replace('[Checked]','[Unchecked]',1)
]
for html in wrong:
 for target in ['raw','rendered']:
  post=copy.deepcopy(good);post['content'][target]=html
  try:check_post(post,case,[])
  except AssertionError:pass
  else:raise AssertionError('Changed checklist evidence was accepted')
print('6 corrupted checklist save/reopen results rejected')
`], { encoding: 'utf8' });
  assert.equal(result.trim(), '6 corrupted checklist save/reopen results rejected');
});

test('The pinned Google Docs capture independently declares five source states and levels', () => {
  const result = execFileSync('python3', ['-c', String.raw`
import json
from html.parser import HTMLParser
from pathlib import Path
class Source(HTMLParser):
 def __init__(self):super().__init__();self.states=[];self.markers=[];self.words=[]
 def handle_starttag(self,tag,attributes):
  attrs=dict(attributes)
  if tag=='li':self.states.append([attrs.get('role'),attrs.get('aria-checked'),attrs.get('aria-level')])
  if tag=='img':self.markers.append([attrs.get('aria-roledescription'),attrs.get('alt')])
 def handle_data(self,text):
  if text.strip():self.words.append(text.strip())
p=Source();p.feed(Path('tests/fixtures/documents/google-checklist.html').read_text())
assert p.states==[['checkbox','true','1'],['checkbox','false','1'],['checkbox','true','2'],['checkbox','false','2'],['checkbox','false','1']]
assert p.markers==[['checkbox','checked'],['checkbox','unchecked'],['checkbox','checked'],['checkbox','unchecked'],['checkbox','unchecked']]
assert p.words==['done','todo','done','todo','todo']
print('Pinned source states and text verified without the product parser')
`], { encoding: 'utf8' });
  assert.equal(result.trim(), 'Pinned source states and text verified without the product parser');
});
