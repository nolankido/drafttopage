import test from 'node:test';
import assert from 'node:assert/strict';
import { createPreviewRenderQueue } from '../public/preview-render-queue.js';

function harness() {
  let now=0, id=0;const jobs=new Map(), completed=[];
  const queue=createPreviewRenderQueue({
    now:()=>now,quietMs:70,deadlineMs:160,
    schedule:(fn,ms)=>{jobs.set(++id,{fn,at:now+ms});return id},
    cancel:token=>jobs.delete(token)
  });
  const advance=ms=>{
    now+=ms;
    for(const [key,item] of [...jobs].sort((a,b)=>a[1].at-b[1].at)) {
      if(item.at<=now){jobs.delete(key);item.fn();}
    }
  };
  return {queue,completed,advance,jobCount:()=>jobs.size};
}
test('One queued action wins across rapid typing and never runs overwritten source',()=>{
  const h=harness();
  for(let i=0;i<15;i++){h.queue.enqueue(()=>h.completed.push(i));h.advance(7)}
  assert.deepEqual(h.completed,[]);
  assert.equal(h.jobCount(),1);
  h.advance(60);
  assert.deepEqual(h.completed,[14]);
  assert.equal(h.jobCount(),0);
});
test('The deadline prevents perpetual postponement during continuous editing',()=>{
  const h=harness();
  for(let i=0;i<40;i++){h.queue.enqueue(()=>h.completed.push(i));h.advance(8)}
  assert.ok(h.completed.length>0);
  assert.equal(h.completed[0],19);
  assert.ok(h.queue.pending());
});
test('Explicit review flushes immediately; clearing discards all scheduled source',()=>{
  const h=harness();
  h.queue.enqueue(()=>h.completed.push('first'));
  assert.equal(h.queue.flush(),true);assert.deepEqual(h.completed,['first']);
  assert.equal(h.queue.flush(),false);
  h.queue.enqueue(()=>h.completed.push('stale'));
  h.queue.clear();h.advance(1000);
  assert.deepEqual(h.completed,['first']);assert.equal(h.jobCount(),0);
});
test('Queued callbacks are bounded and input contracts fail closed',()=>{
  const h=harness();
  assert.throws(()=>h.queue.enqueue(null),/callback/);
  assert.throws(()=>createPreviewRenderQueue({quietMs:170,deadlineMs:160}),/bounded/);
  h.queue.enqueue(()=>h.completed.push('fine'));h.advance(70);
  assert.deepEqual(h.completed,['fine']);
});
