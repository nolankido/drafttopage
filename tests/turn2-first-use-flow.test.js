import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { writingPages } from '../scripts/writing-pages.mjs';
import { renderPage } from '../scripts/site-shell.mjs';

const routes = ['write','word-to-wordpress','word-to-markdown','html-to-markdown','google-docs-to-wordpress','markdown-to-wordpress','markdown-to-html','markdown-to-word'];

function inspect() {
  const pages = Object.fromEntries(writingPages.filter(page => page.desk).map(page => [page.route, renderPage(page)]));
  return JSON.parse(execFileSync('python3', ['-c', String.raw`
import json,sys
from html.parser import HTMLParser
VOID=set('area base br col embed hr img input link meta param source track wbr'.split())
class P(HTMLParser):
 def __init__(self): super().__init__();self.nodes={};self.stack=[];self.index=0
 def handle_starttag(self,tag,attrs):
  attrs=dict(attrs);self.index+=1
  if 'id' in attrs:
   key=attrs['id'];assert key not in self.nodes,key
   self.nodes[key]={'tag':tag,'order':self.index,'attrs':attrs,'ancestors':[el[1].get('id') for el in self.stack]}
  if tag not in VOID:self.stack.append((tag,attrs))
 def handle_startendtag(self,tag,attrs):
  assert tag in VOID
  self.handle_starttag(tag,attrs)
 def handle_endtag(self,tag):
  assert self.stack and self.stack[-1][0]==tag,(tag,self.stack[-1] if self.stack else None)
  self.stack.pop()
out={}
for route,html in json.load(sys.stdin).items():
 p=P();p.feed(html);p.close();assert not p.stack,route
 out[route]=p.nodes
print(json.dumps(out))
`], { encoding: 'utf8', input: JSON.stringify(pages) }));
}

test('First use presents article input before optional backup and recovery panels',()=>{
 const pages=inspect();assert.equal(Object.keys(pages).length,8);
 for(const [route,n] of Object.entries(pages)){
  const article=n['article-heading'].order;
  for(const id of ['backup-controls','browser-recovery-panel']) assert.ok(n[id].order>article,route+': '+id+' must follow the article');
  assert.ok(n['import-panel'].order<article,route+': import still comes before article editor');
  if(route==='/write/'){
   for(const id of ['checkpoint-panel','draft-collection-panel']) assert.ok(n[id].order>article,route+': optional history follows writing');
  }else{
   for(const id of ['checkpoint-panel','draft-collection-panel']) assert.ok(n[id].ancestors.includes('editing-tools'),route+': history stays in collapsed editing tools');
   assert.equal(Object.hasOwn(n['editing-tools'].attrs,'open'),false,route+': advanced tools start closed');
  }
 }
});

test('Export decision and approval are above optional profiles in all eight workspaces',()=>{
 const pages=inspect();
 for(const [route,n] of Object.entries(pages)){
  const position=id=>n[id].order;
  assert.ok(position('export-heading')<position('publishing-destination'),route);
  assert.ok(position('publishing-destination')<position('export-content-panel'),route);
  assert.ok(position('export-content-panel')<position('export-format-review'),route);
  assert.ok(position('export-format-review')<position('reviewed'),route+': format review before approval');
  assert.ok(position('reviewed')<position('jump-to-primary-export'),route+': explicit review precedes shortcut');
  assert.ok(position('jump-to-primary-export')<position('export-extra-settings'),route);
  assert.equal(n['export-extra-settings'].tag,'details');
  assert.equal(Object.hasOwn(n['export-extra-settings'].attrs,'open'),false,route);
  assert.ok(n['publishing-checklist'].ancestors.includes('export-extra-settings'),route);
  assert.ok(n['publishing-profile-panel'].ancestors.includes('export-extra-settings'),route);
  assert.ok(n['reviewed'].ancestors.includes('export-essentials'),route);
  assert.equal(Object.hasOwn(n['jump-to-primary-export'].attrs,'disabled'),true,route+': cannot export without review');
  assert.ok(!n['reviewed'].ancestors.includes('export-extra-settings'),route+': approval cannot be hidden with optional settings');
 }
});

test('Small-screen review and optional panels have bounded responsive styling',async()=>{
 const css=await readFile(new URL('../public/desk.css',import.meta.url),'utf8');
 assert.ok(css.includes('.export-review-confirm'));
 assert.ok(css.includes('.export-extra-settings>summary'));
 assert.ok(css.includes('@media(max-width:600px)'));
});
