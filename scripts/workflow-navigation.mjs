export function workflowNavigation(kind = 'desk') {
  const word = kind === 'word-import' || kind === 'word-markdown', copied = kind === 'copied', source = kind === 'html-markdown';
  const id = word ? 'start-word-file' : copied ? 'start-copied-paste' : source ? 'start-html-source' : 'start-draft';
  const bring = word ? 'Open Word' : copied ? 'Paste writing' : source ? 'Paste HTML' : 'Add writing';
  const firstLabel = word ? '1. Open Word document' : copied ? '1. Paste writing from Google Docs' : source ? '1. Paste HTML source' : '1. Add writing';
  const thirdLabel = kind === 'word-markdown' || source ? '3. Export to Markdown' : kind === 'word' ? '3. Export to Word' : kind === 'html' ? '3. Export to HTML source' : kind === 'desk' ? '3. Choose export options' : '3. Export to WordPress';
  const status = word ? 'Choose a Word document to begin.' : copied ? 'Paste a copied selection to begin.' : source ? 'Paste HTML source or choose an HTML file to begin.' : 'Add your article to begin.';
  return `<div id="workspace-resume" class="workspace-resume" hidden><p>A saved draft is available in this browser.</p><button id="workspace-resume-review" type="button" class="secondary" aria-controls="browser-recovery-panel">Review saved draft</button></div>
<nav id="workflow-steps" class="workflow-steps" aria-label="Article preparation steps" aria-describedby="workflow-status"><ol>
<li><button id="${id}" type="button" class="secondary workflow-step" data-workflow-step="bring" aria-current="step" aria-controls="${word || copied || source ? 'import-panel' : 'draft'}" aria-label="${firstLabel}"><span class="workflow-number" aria-hidden="true">1</span><span>${bring}</span></button></li>
<li><button id="start-review" type="button" class="secondary workflow-step" data-workflow-step="review" aria-controls="preview-panel" aria-label="2. Review the article"><span class="workflow-number" aria-hidden="true">2</span><span>Review</span></button></li>
<li><button id="start-handoff" type="button" class="secondary workflow-step" data-workflow-step="export" aria-controls="exports" aria-label="${thirdLabel}"><span class="workflow-number" aria-hidden="true">3</span><span>Export</span></button></li>
</ol><div class="workflow-message"><p id="workflow-status" class="small">${status} Navigation never approves or publishes writing.</p><button id="workflow-edit" type="button" class="secondary workflow-edit" hidden>Edit article</button></div></nav>
<details id="workspace-layout-options" class="workspace-layout-options"><summary>Layout options</summary>
<div id="workspace-layout" class="workspace-layout" hidden>
<div><label for="workspace-layout-choice">Workspace layout</label><select id="workspace-layout-choice" aria-describedby="workspace-layout-status workspace-layout-help"><option value="stacked">Full-width panels</option><option value="compare">Side by side on wide screens</option></select></div>
<div><p id="workspace-layout-status" class="small"></p><p id="workspace-layout-help" class="small">This changes the view in this tab. Your writing and export approval are kept. <a href="/help/local-workspace/#workspace-layout" target="_blank" rel="noopener">Layout and navigation help (new tab)</a></p></div>
</div></details>`;
}
