import test from 'node:test';
import assert from 'node:assert/strict';
import { activateOnEnterRelease } from '../public/keyboard-action.js';

class Events {
  constructor(){this.events=new Map();}
  addEventListener(type,fn){if(!this.events.has(type))this.events.set(type,new Set());this.events.get(type).add(fn);}
  removeEventListener(type,fn){this.events.get(type)?.delete(fn);}
  fire(type,extra={}){const event={key:'Enter',repeat:false,isComposing:false,prevented:false,preventDefault(){this.prevented=true;},...extra};for(const fn of [...this.events.get(type)||[]])fn(event);return event;}
  count(type){return this.events.get(type)?.size||0;}
}
function setup(){
  const doc=new Events(),view=new Events(),button=new Events();doc.defaultView=view;doc.activeElement=button;
  let clicks=0;Object.assign(button,{ownerDocument:doc,isConnected:true,disabled:false,hidden:false,matches:()=>button.disabled,closest:()=>button.hidden?button:null,click:()=>{clicks++;}});
  const cancel=activateOnEnterRelease(button);return{doc,view,button,cancel,clicks:()=>clicks};
}
test('Enter is prevented on press/repeat, activates once after release, then drops temporary listeners',()=>{
  const x=setup();assert.ok(x.button.fire('keydown').prevented);assert.ok(x.button.fire('keydown',{repeat:true}).prevented);assert.equal(x.clicks(),0);
  assert.equal(x.doc.count('pointerdown'),1);assert.equal(x.view.count('blur'),1);
  assert.ok(x.button.fire('keyup').prevented);assert.equal(x.clicks(),1);assert.equal(x.doc.count('pointerdown'),0);assert.equal(x.view.count('blur'),0);
  x.button.fire('keyup');assert.equal(x.clicks(),1);
});
test('A repeated Enter arriving without an owned initial press cannot activate',()=>{
  const x=setup();x.button.fire('keydown',{repeat:true});x.button.fire('keyup');assert.equal(x.clicks(),0);
});
test('Blur, a pointer action anywhere and window blur cancel held-key activation',()=>{
  for(const signal of ['control','pointer','window']){
    const x=setup();x.button.fire('keydown');
    if(signal==='control')x.button.fire('blur');else if(signal==='pointer')x.doc.fire('pointerdown');else x.view.fire('blur');
    x.button.fire('keyup');assert.equal(x.clicks(),0,signal);assert.equal(x.doc.count('pointerdown'),0);assert.equal(x.view.count('blur'),0);
  }
});
test('A moved, disabled, disconnected or hidden restore button cannot activate on release',()=>{
  for(const state of ['moved','disabled','detached','hidden']){
    const x=setup();x.button.fire('keydown');
    if(state==='moved')x.doc.activeElement={};if(state==='disabled')x.button.disabled=true;if(state==='detached')x.button.isConnected=false;if(state==='hidden')x.button.hidden=true;
    x.button.fire('keyup');assert.equal(x.clicks(),0,state);
  }
});
test('Composition and other keys are not reinterpreted as restore gestures',()=>{
  const x=setup();assert.equal(x.button.fire('keydown',{isComposing:true}).prevented,false);x.button.fire('keyup',{isComposing:true});assert.equal(x.clicks(),0);
  for(const key of [' ','Space','Tab','Escape']){assert.equal(x.button.fire('keydown',{key}).prevented,false);assert.equal(x.button.fire('keyup',{key}).prevented,false);}
  x.button.click();assert.equal(x.clicks(),1,'Ordinary click stays independent');
});
test('Cancellation keeps subsequent gestures usable and never turns pointer activation into a double restore',()=>{
  const x=setup();x.button.fire('keydown');x.doc.fire('pointerdown');x.button.click();x.button.fire('keyup');assert.equal(x.clicks(),1);
  x.button.fire('keydown');x.cancel();x.button.fire('keyup');assert.equal(x.clicks(),1);
  x.button.fire('keydown');x.button.fire('keyup');assert.equal(x.clicks(),2);
});
