// Word and copied-document users review a reading view before opening source editing.
export function guidedWorkspace(body) {
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
