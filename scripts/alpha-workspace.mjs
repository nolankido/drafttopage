// Word and copied-document users review a reading view before opening source editing.
export function guidedWorkspace(body) {
  function take(startText, endText) {
    const start = body.indexOf(startText), end = body.indexOf(endText, start);
    if (start < 0 || end < start || body.indexOf(startText, start + startText.length) >= 0) throw new Error('The guided handoff needs one shared ' + startText);
    const region = body.slice(start, end + endText.length);
    body = body.slice(0, start) + body.slice(end + endText.length);
    return region;
  }
  const readiness = take('<div id="wordpress-readiness-summary">', '</div>');
  const review = take('<details id="wordpress-review-panel"', '</details>');
  const actions = take('<div id="wordpress-actions"', '</div>');
  const destination = take('<label for="publishing-destination">', '</select>');
  const approvalStart = body.indexOf('<label class="check"><input id="reviewed"'), approvalEnd = body.indexOf('</label>', approvalStart);
  if (approvalStart < 0 || approvalEnd < approvalStart) throw new Error('The guided handoff needs its shared approval control.');
  const approval = body.slice(approvalStart, approvalEnd + '</label>'.length);
  body = body.replace(approval, '<div id="wordpress-primary-review" role="group" aria-label="WordPress conversion checks">' + readiness + review + '</div>' + approval +
    '<div id="wordpress-primary-actions" role="group" aria-label="Copy or download WordPress blocks">' + actions + '<p class="small">Copy the body into the full WordPress Code editor. Add the title separately in WordPress, then return to Visual editor and inspect the post.</p></div>' +
    '<details id="other-export-formats"><summary>Use another export format</summary>' + destination + '</details>');
  body = body.replace('<h3 id="export-heading">3. Choose your export</h3>', '<h3 id="export-heading">3. Review and take your article</h3>')
    .replace('<h4 id="wordpress-heading">Continue in WordPress</h4>', '<h4 id="wordpress-heading">Finish in WordPress</h4>');
  // The manual destination step is part of the task, so keep it visible for document users.
  body = body.replace('<details id="wordpress-instructions">', '<details id="wordpress-instructions" open>');
  const article = body.indexOf('<section id="draft"');
  const result = body.indexOf('<section id="conversion-results"');
  const notes = body.indexOf('<aside class="paper source-editor"');
  if (article < 0 || result <= article || notes <= result) throw new Error('The guided workspace needs its shared article, result, and notes.');
  return body.slice(0, article) +
    body.slice(result, notes).replace('id="conversion-heading"', 'id="conversion-heading" tabindex="-1"') +
    '<details id="article-edit-panel" class="article-edit-panel"><summary>Edit article text and formatting</summary><p class="small">Editing is optional. This editor uses Markdown; the reading preview updates as you change it. Any change clears export approval.</p>' +
    body.slice(article, result) + '</details>' + body.slice(notes);
}
