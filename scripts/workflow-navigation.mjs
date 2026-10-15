export function workflowNavigation(kind = 'desk') {
  const word = kind === 'word-import', copied = kind === 'copied';
  const id = word ? 'start-word-file' : copied ? 'start-copied-paste' : 'start-draft';
  const bring = word ? 'Open Word' : copied ? 'Paste writing' : 'Add writing';
  const firstLabel = word ? '1. Open Word document' : copied ? '1. Paste writing from Google Docs' : '1. Add writing';
  const thirdLabel = kind === 'word' ? '3. Export to Word' : kind === 'html' ? '3. Export to HTML source' : kind === 'desk' ? '3. Choose export options' : '3. Export to WordPress';
  const status = word ? 'Choose a Word document to begin.' : copied ? 'Paste a copied selection to begin.' : 'Add your article to begin.';
  return `<nav id="workflow-steps" class="workflow-steps" aria-label="Article preparation steps" aria-describedby="workflow-status"><ol>
<li><button id="${id}" type="button" class="secondary workflow-step" data-workflow-step="bring" aria-current="step" aria-controls="${word || copied ? 'import-panel' : 'draft'}" aria-label="${firstLabel}"><span class="workflow-number" aria-hidden="true">1</span><span>${bring}</span></button></li>
<li><button id="start-review" type="button" class="secondary workflow-step" data-workflow-step="review" aria-controls="preview-panel" aria-label="2. Review the article"><span class="workflow-number" aria-hidden="true">2</span><span>Review</span></button></li>
<li><button id="start-handoff" type="button" class="secondary workflow-step" data-workflow-step="export" aria-controls="exports" aria-label="${thirdLabel}"><span class="workflow-number" aria-hidden="true">3</span><span>Export</span></button></li>
</ol><p id="workflow-status" class="small">${status} Navigation never approves or publishes writing.</p></nav>`;
}
