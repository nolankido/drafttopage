import { compareArticleLines, DIFF_GROUP_LIMIT } from './revision-diff.js';

export function installRevisionDiff({ getComparison, compare = compareArticleLines }) {
  const $ = id => document.getElementById(id);
  let saved = null, current = null, rendered = false;
  const status = text => { if ($('article-diff-status').textContent !== text) $('article-diff-status').textContent = text; };
  function refresh() {
    const pair = getComparison();
    if (!pair) {
      saved = current = null; rendered = false; $('article-diff-groups').replaceChildren();
      status('Save a checkpoint and use valid article text to compare versions.'); return;
    }
    if (pair.saved !== saved || pair.current !== current) {
      saved = pair.saved; current = pair.current; rendered = false; $('article-diff-groups').replaceChildren();
    }
    if (!$('article-diff-panel').open || !$('checkpoint-panel').open) {
      if (!rendered) status('Open Article changes to compare the selected checkpoint with your current article.'); return;
    }
    if (rendered) return;
    try {
      const result = compare(saved, current), changes = result.groups.filter(group => group.kind !== 'same');
      status(changes.length ? result.added + ' added line(s); ' + result.removed + ' removed line(s). Unchanged lines are omitted.' + (result.coarse ? ' Large changed region grouped: matching lines inside it may also appear as added and removed.' : '') + (changes.length > DIFF_GROUP_LIMIT ? ' Showing the first ' + DIFF_GROUP_LIMIT + ' change groups. Use the complete saved/current fields to review the rest.' : '') : 'The saved and current article bodies match exactly. Other workspace fields may still differ.');
      $('article-diff-groups').replaceChildren(...changes.slice(0, DIFF_GROUP_LIMIT).map(group => {
        const li = document.createElement('li'), label = document.createElement('p'), text = document.createElement('pre');
        li.className = 'article-diff-' + group.kind;
        const start = group.kind === 'removed' ? group.savedLine : group.currentLine;
        label.textContent = (group.kind === 'removed' ? 'Removed from saved article' : 'Added in current article') + ': ' + (group.lineCount === 1 ? 'line ' + start : 'lines ' + start + '–' + (start + group.lineCount - 1)) + (group.text.trim() ? '' : ' (whitespace only)');
        text.textContent = group.text;
        li.append(label, text);
        if (group.text.includes('\r') || !group.text.endsWith('\n')) {
          const note = document.createElement('p'); note.className = 'small';
          note.textContent = (group.text.includes('\r\n') ? 'Contains CRLF line breaks. ' : '') + (!group.text.endsWith('\n') ? 'No final line break in this passage.' : '');
          li.append(note);
        }
        return li;
      }));
      rendered = true;
    } catch (error) { $('article-diff-groups').replaceChildren(); status(error.message + ' Use the complete saved/current fields below.'); }
  }
  $('article-diff-panel').addEventListener('toggle', refresh);
  $('checkpoint-panel').addEventListener('toggle', refresh);
  refresh();
  return { refresh };
}
