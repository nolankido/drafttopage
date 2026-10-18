import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { installPasteGuard, pastedTextFits } from '../public/paste-guard.js';

function setup({ value = 'Before. Ending.', selectionStart = 8, selectionEnd = 8, limit = 100, maxBytes } = {}) {
  const events = new Map(), messages = [], element = { value, selectionStart, selectionEnd, addEventListener(type,fn){events.set(type,fn);} };
  const guard = installPasteGuard({ element, limit, maxBytes, label: 'The article', report: msg => messages.push(msg) });
  const fire = (type, fields = {}) => {
    const event = { inputType: 'insertFromPaste', cancelable: true, prevented: false, preventDefault(){this.prevented=true;}, ...fields };
    events.get(type)?.(event); return event;
  };
  const transfer = text => ({ getData: key => key === 'text/plain' ? text : '' });
  return { fire, transfer, element, guard, messages };
}
test('A readable paste followed by mobile beforeinput without a payload is admitted only once', () => {
  const x=setup();
  assert.equal(x.fire('paste',{clipboardData:x.transfer('Inserted. ')}).prevented,false);
  assert.equal(x.fire('beforeinput',{dataTransfer:null,data:null}).prevented,false);
  assert.equal(x.fire('beforeinput',{dataTransfer:null,data:null}).prevented,true);
  assert.equal(x.element.value,'Before. Ending.','The guard does not simulate the browser edit');
});
test('No prior paste, stale selection, and intervening input cannot bypass the limit', () => {
  const x=setup();
  assert.equal(x.fire('beforeinput',{dataTransfer:null,data:null}).prevented,true);
  x.fire('paste',{clipboardData:x.transfer('Safe')});x.element.selectionStart=0;
  assert.equal(x.fire('beforeinput',{dataTransfer:null,data:null}).prevented,true);
  x.element.selectionStart=8;
  x.fire('paste',{clipboardData:x.transfer('Safe')});x.fire('input');
  assert.equal(x.fire('beforeinput',{dataTransfer:null,data:null}).prevented,true);
});
test('Oversize, null characters, and unreadable clipboard data are rejected at paste, even if beforeinput is empty', () => {
  for(const text of ['x'.repeat(101),'bad\u0000text']){
    const x=setup({limit:40});
    assert.equal(x.fire('paste',{clipboardData:x.transfer(text)}).prevented,true);
    assert.equal(x.fire('beforeinput',{dataTransfer:null,data:null}).prevented,true);
  }
  const x=setup();
  assert.equal(x.fire('paste',{clipboardData:{getData(){throw new Error('PRIVATE')}}}).prevented,true);
  assert.equal(x.fire('beforeinput',{dataTransfer:null,data:null}).prevented,true);
  assert.doesNotMatch(x.messages.join('\n'),/PRIVATE/);
});
test('Changed clipboard payload during beforeinput fails closed without inserting',()=>{
  const x=setup();
  x.fire('paste',{clipboardData:x.transfer('Approved')});
  assert.equal(x.fire('beforeinput',{dataTransfer:x.transfer('Different')}).prevented,true);
  assert.match(x.messages.at(-1),/changed between browser events/);
});
test('CRLF-normalized paste, Unicode bounds and native drop use normal guards',()=>{
  const x=setup({limit:30});
  x.fire('paste',{clipboardData:x.transfer('A\r\nB')});
  assert.equal(x.fire('beforeinput',{dataTransfer:x.transfer('A\nB')}).prevented,false);
  assert.equal(pastedTextFits('',0,0,'😀'.repeat(10),10),false);
  assert.equal(pastedTextFits('',0,0,'😀'.repeat(10),20),true);
  assert.equal(x.fire('beforeinput',{inputType:'insertFromDrop',dataTransfer:null}).prevented,true);
});
test('Focus loss and formatted-paste interception invalidate one-use native paste approval',()=>{
  const x=setup();x.fire('paste',{clipboardData:x.transfer('Safe')});x.fire('blur');
  assert.equal(x.fire('beforeinput',{dataTransfer:null,data:null}).prevented,true);
  const events=new Map();
  const element={value:'',selectionStart:0,selectionEnd:0,addEventListener(k,v){events.set(k,v)}};
  installPasteGuard({element,limit:40,label:'Source',report:()=>{},skipPaste:()=>true});
  events.get('paste')({clipboardData:x.transfer('Safe'),preventDefault(){}});
  const input={inputType:'insertFromPaste',cancelable:true,data:null,prevented:false,preventDefault(){this.prevented=true;}};
  events.get('beforeinput')(input);assert.equal(input.prevented,true);
});
test('Clipboard denial provides an exact-source fallback whose disclosure receives focus',async()=>{
  const code=await readFile(new URL('../public/export-controls.js',import.meta.url),'utf8');
  const html=await readFile(new URL('../scripts/writing-desk.html',import.meta.url),'utf8');
  assert.match(code,/copies\.state\(\)\.outcome === 'failure'/);
  assert.match(code,/panel\.open = true;\s+update\(\)/);
  assert.match(code,/focusWorkflowTarget\(summary/);
  assert.match(html,/id="wordpress-code-preview"[^>]*readonly/);
  assert.match(html,/id="wordpress-code-panel"/);
});
test('Paste errors have one announcing status and retain field-level description',async()=>{
  const desk=await readFile(new URL('../scripts/writing-desk.html',import.meta.url),'utf8');
  const importPanel=await readFile(new URL('../scripts/import-panel.html.inc',import.meta.url),'utf8');
  assert.match(desk,/id="desk-status"[^>]+role="status"/);
  assert.match(desk,/aria-describedby="body-help body-count body-error body-paste-status"/);
  assert.match(importPanel,/aria-describedby="import-file-help import-html-help import-paste-status"/);
  assert.doesNotMatch(desk,/id="body-paste-status"[^>]*aria-live/);
  assert.doesNotMatch(importPanel,/id="import-paste-status"[^>]*role="status"/);
});

test('Import preview focus and mobile paste help are shared by every workspace',async()=>{
  const controller=await readFile(new URL('../public/desk.js',import.meta.url),'utf8');
  const html=await readFile(new URL('../scripts/writing-desk.html',import.meta.url),'utf8');
  const guide=await readFile(new URL('../scripts/publishing-handoff-help.html.inc',import.meta.url),'utf8');
  assert.match(controller,/focusPreview: true, pasteFirst: copiedPasteTool/);
  assert.match(controller,/focusImportPreview: heading => focusWorkflowTarget\(heading/);
  assert.match(html,/use the native Paste menu after tapping/);
  assert.match(guide,/phone\/tablet and use its native Paste menu/);
});
