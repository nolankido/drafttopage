export const WORD_COMMENT_GUIDANCE = 'Private feedback only. Plain comment text is listed in file order, including unanchored comments and possible replies. IDs are file identifiers, not Word display numbers. Anchors, thread relationships, resolved status, authors, dates, formatting, hyperlink targets, and visibility settings are not reproduced. Text hidden by Word styling can be included. Compare with the original document before keeping or sharing this file.';

export function wordCommentNotes(model) {
  if (!model?.comments?.length || model.comments.length > 12) return null;
  const notes = model.comments.map(comment => 'Word comment ID ' + comment.id + '\n' + comment.text);
  return notes.every(note => note.length <= 500) ? notes : null;
}
export function wordCommentsReport(model) {
  return ['Draft to Page: private Word comments', WORD_COMMENT_GUIDANCE, model.comments.length + ' comment(s).',
    ...model.comments.flatMap(comment => ['Word comment ID ' + comment.id, comment.text]), 'End of private comment report.'].join('\n\n') + '\n';
}
