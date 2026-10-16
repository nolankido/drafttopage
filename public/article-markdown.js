import { articleIssues, ARTICLE_LIMITS } from './authoring.js';
import { markdownFromInline } from './inline-markdown.js';

// Article text only. Authored Markdown is kept exactly, with a final newline
// when needed. A separate title is literal text, never authored Markdown.
export function createArticleMarkdown(draft, { includeTitle = false } = {}) {
  if (typeof includeTitle !== 'boolean') throw new Error('Choose whether to include the title in Markdown.');
  const issues = articleIssues(draft, 'body');
  if (Object.keys(issues).length) throw new Error(Object.values(issues)[0]);
  let heading = '';
  if (includeTitle && draft.title !== undefined) {
    if (typeof draft.title !== 'string' || draft.title.length > ARTICLE_LIMITS.title || draft.title.includes('\u0000')) throw new Error('Check the article title before including it in Markdown.');
    const title = draft.title.replace(/[\r\n]/g, ' ').trim();
    if (title) heading = '# ' + markdownFromInline([{ type: 'text', text: title }]).markdown + '\n\n';
  }
  return heading + draft.body + (draft.body.endsWith('\n') ? '' : '\n');
}
