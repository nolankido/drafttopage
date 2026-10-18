import test from 'node:test';
import assert from 'node:assert/strict';
import { createWordPressArticle } from '../public/wordpress-export.js';
import { publishingKitFiles } from '../public/publishing-kit.js';
import { installPublishingExports } from '../public/export-controls.js';
import { QUICK_SAMPLE } from '../public/quick-sample.js';

function node() {
  const listeners = new Map();
  return {
    value: '', checked: false, disabled: false, open: false, hidden: false,
    textContent: '', children: [], attributes: {},
    setAttribute(key,value) { this.attributes[key] = value; },
    addEventListener(name,handler) { listeners.set(name,handler); },
    fire(name) { return listeners.get(name)?.(); },
    replaceChildren(...items) { this.children = items; },
    append(...items) { this.children.push(...items); },
  };
}
const ids = [
  'markdown-handoff','markdown-include-title','copy-article-markdown','download-article-markdown',
  'article-markdown-preview','markdown-source-panel','article-markdown-readiness',
  'additional-exports','word-handoff','word-readiness','word-include-title','download-word',
  'export-format','reviewed','publishing-destination','wordpress-handoff','copy-wordpress',
  'download-wordpress','copy-wordpress-title','wordpress-readiness','wordpress-notices',
  'wordpress-code-panel','wordpress-code-preview','html-source-handoff','html-source-readiness',
  'html-include-title','copy-html-source','download-html-source','html-source-code-panel',
  'html-source-preview','copy-formatted','copy-title','download-kit','kit-readiness',
  'publishing-kit-panel','kit-files','wordpress-review-status','wordpress-review-panel',
  'wordpress-findings','copy-wordpress-excerpt','copy-wordpress-slug',
  'copy-wordpress-description','wordpress-fields-status','download-wordpress-kit',
  'wordpress-kit-status','wordpress-kit-panel','wordpress-kit-files','wordpress-edit-fields',
  'page-details','excerpt','body','wordpress-destination-check','wordpress-destination-status','wordpress-destination-expectations','wordpress-destination-ending','wp-destination-title','wp-destination-paste','wp-destination-structure','wp-destination-optional-fields','wp-destination-saved-draft','wp-destination-reopened-draft','wp-destination-second-save','copy-brief','copy-questions'
];
function withExports(run) {
  const original = globalThis.document, nodes=Object.fromEntries(ids.map(id=>[id,node()]));
  nodes['publishing-destination'].value = 'wordpress';
  nodes['export-format'].value = 'page';
  nodes['additional-exports'].open = true; // Main writing desk starts with more exports open.
  let draft={...QUICK_SAMPLE, body: 'A fictional paragraph. We are writing only, not publishing.'};
  let blockBuilds=0, kitBuilds=0, approvalCalls=0;
  globalThis.document={
    getElementById: id=>nodes[id],
    createElement: ()=>node(),
    createTextNode: text=>({textContent:text})
  };
  let ui;
  try {
    ui=installPublishingExports({
      getDraft:()=>draft,
      getCopySnapshot:()=>({draft}),
      approved:()=>{approvalCalls++;if(!nodes.reviewed.checked)throw Error('Review first.');},
      changed:()=>{nodes.reviewed.checked=false; ui.update();},
      report:()=>{},
      isBusy:()=>false,
      prepareWordPressBlocks:(current,options)=>{blockBuilds++;return createWordPressArticle(current,options);},
      prepareGeneralKitFiles:(current,options)=>{kitBuilds++;return publishingKitFiles(current,options);}
    });
    return run({
      nodes,ui,
      getDraft:()=>draft,
      setDraft:next=>{draft=next;},
      counts:()=>({blockBuilds,kitBuilds,approvalCalls})
    });
  } finally {globalThis.document=original;}
}

test('Live unapproved WordPress edits do not serialize blocks or hidden publishing kits',()=>withExports(({nodes,ui,setDraft,counts})=>{
  for(let i=0;i<6;i++){
    setDraft({...QUICK_SAMPLE,body:'Fictional long article '+i+'. '+('safe text. '.repeat(3600))});
    nodes.reviewed.checked=false; ui.update();
    assert.deepEqual(counts(),{blockBuilds:0,kitBuilds:0,approvalCalls:0});
    assert.equal(nodes['copy-wordpress'].disabled,true);
    assert.equal(nodes['download-wordpress'].disabled,true);
    assert.equal(nodes['wordpress-code-preview'].value,'');
    assert.equal(nodes['download-kit'].disabled,true);
    assert.equal(nodes['kit-readiness'].textContent,'');
    assert.equal(nodes['kit-files'].children.length,0);
  }
  assert.match(nodes['wordpress-readiness'].textContent,/check approval to prepare WordPress blocks/);
  nodes['publishing-destination'].value='html';nodes.reviewed.checked=true;ui.update();
  assert.equal(counts().blockBuilds,0);
}));

test('WordPress blocks and notices are fresh when approved, and cleared immediately on edit',()=>withExports(({nodes,ui,setDraft,counts})=>{
  const body='## A fictional heading\n\n![Image](https://example.test/fiction.png)\n\nOrdinary text.';
  setDraft({...QUICK_SAMPLE,body});
  nodes['wordpress-code-panel'].open=true;
  nodes.reviewed.checked=true;ui.update();
  assert.equal(counts().blockBuilds,1);
  assert.equal(nodes['copy-wordpress'].disabled,false);
  assert.equal(nodes['download-wordpress'].disabled,false);
  assert.equal(nodes['wordpress-code-preview'].value,createWordPressArticle({body}).html);
  assert.match(nodes['wordpress-readiness'].textContent,/top-level blocks prepared/);
  assert.match(nodes['wordpress-notices'].children.map(x=>x.textContent).join(' '),/syntax may remain literal/);
  setDraft({...QUICK_SAMPLE,body:'Changed before another export.'});
  nodes.reviewed.checked=false;ui.update();
  assert.equal(counts().blockBuilds,1);
  assert.equal(nodes['wordpress-code-preview'].value,'');
  assert.equal(nodes['wordpress-notices'].children.length,0);
  assert.equal(nodes['copy-wordpress'].disabled,true);
  nodes.reviewed.checked=true;ui.update();
  assert.equal(counts().blockBuilds,2);
  assert.equal(nodes['wordpress-code-preview'].value,createWordPressArticle({body:'Changed before another export.'}).html);
  assert.doesNotMatch(nodes['wordpress-code-preview'].value,/fiction.png/);
}));

test('Complete kit preparation runs only while its panel is open and recomputes current content',()=>withExports(({nodes,ui,setDraft,counts})=>{
  ui.update();assert.equal(counts().kitBuilds,0);
  nodes['publishing-kit-panel'].open=true;nodes['publishing-kit-panel'].fire('toggle');
  assert.equal(counts().kitBuilds,1);
  assert.equal(nodes['download-kit'].disabled,true); // Approval is still required.
  assert.ok(nodes['kit-files'].children.length>0);
  assert.match(nodes['kit-readiness'].textContent,/Includes/);
  nodes.reviewed.checked=true;ui.update();
  assert.equal(nodes['download-kit'].disabled,false);
  nodes['publishing-kit-panel'].open=false;nodes['publishing-kit-panel'].fire('toggle');
  const saved=counts().kitBuilds;
  assert.equal(nodes['kit-files'].children.length,0);
  assert.equal(nodes['kit-readiness'].textContent,'');
  assert.equal(nodes['download-kit'].disabled,true);
  setDraft({...QUICK_SAMPLE,body:'New draft content.'});
  nodes.reviewed.checked=false;ui.update();ui.update();
  assert.equal(counts().kitBuilds,saved);
  nodes['publishing-kit-panel'].open=true;nodes['publishing-kit-panel'].fire('toggle');
  assert.equal(counts().kitBuilds,saved+1);
  assert.equal(nodes['download-kit'].disabled,true);
  assert.match(nodes['kit-readiness'].textContent,/Includes/);
  assert.equal(counts().approvalCalls,0);
}));

test('Invalid or failed approved WordPress preparation cannot enable copying old blocks',()=>withExports(({nodes,ui,setDraft,counts})=>{
  nodes['wordpress-code-panel'].open=true;
  nodes.reviewed.checked=true;ui.update();
  assert.equal(counts().blockBuilds,1);
  setDraft({...QUICK_SAMPLE,body:'\u0000bad'});
  nodes.reviewed.checked=true;ui.update();
  assert.equal(nodes['copy-wordpress'].disabled,true);
  assert.equal(nodes['download-wordpress'].disabled,true);
  assert.equal(nodes['wordpress-code-preview'].value,'');
  assert.equal(nodes['wordpress-notices'].children.length,0);
  assert.match(nodes['wordpress-readiness'].textContent,/Paste an article first/);
}));
