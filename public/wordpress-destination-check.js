import { createWordPressArticle } from './wordpress-export.js';
import { previewBlocks } from './preview.js';
import { wordPressImageBlocks } from './wordpress-images.js';

export const WORDPRESS_DESTINATION_STEPS = [
  'title', 'paste', 'structure', 'optional-fields', 'saved-draft', 'reopened-draft', 'second-save'
];

// These are expectations from local output, not observations of WordPress.
// Private source notes and review questions are not included.
export function wordpressDestinationExpectations(draft, options = {}) {
  const article = createWordPressArticle(draft, options);
  const blocks = options.includeLinkedImages ? wordPressImageBlocks(draft.body) : previewBlocks(draft.body);
  const lastSource = Array.from(draft.body.trimEnd()).slice(-90).join('');
  return {
    blockCount: article.blockCount,
    headings: blocks.filter(b => Boolean(b.level)).length,
    lists: blocks.filter(b => Boolean(b.items)).length,
    tables: blocks.filter(b => b.type === 'table').length,
    links: (article.html.match(/<a\s+href="/g) || []).length,
    linkedImages: article.imageCount,
    titleProvided: Boolean(draft.title?.trim()),
    optionalFields: ['excerpt', 'slug', 'description'].filter(key => Boolean(draft[key]?.trim())),
    sourceEnding: lastSource,
    endingTruncated: Array.from(draft.body.trimEnd()).length > 90
  };
}
export function destinationStatus(totalChecked, total = WORDPRESS_DESTINATION_STEPS.length) {
  if (!totalChecked) return 'No WordPress steps confirmed. This checklist does not inspect the destination.';
  return totalChecked === total
    ? 'All ' + total + ' steps marked by you. Draft to Page cannot verify your WordPress draft; this is not independent destination acceptance.'
    : totalChecked + ' of ' + total + ' manually marked. Copying, pasting, saving and reopening are separate actions. Draft to Page cannot observe WordPress.';
}
export function destinationSummary(value) {
  return 'Local export expects ' + value.blockCount + ' body block(s), ' + value.headings + ' heading(s), ' + value.lists + ' list group(s), ' + value.tables + ' table(s), ' + value.links + ' web link(s), and ' + value.linkedImages + ' linked Image block(s). ' + (value.titleProvided ? 'Put the title in the separate WordPress title field.' : 'No title is set: supply the WordPress title separately.') + (value.optionalFields.length ? ' Optional fields: ' + value.optionalFields.join(', ') + '.' : ' No optional post fields supplied.');
}
