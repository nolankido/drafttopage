import { reviewExport, EXPORT_REVIEW_LIMIT } from './export-review.js';

export const WORDPRESS_REVIEW_LIMIT = EXPORT_REVIEW_LIMIT;
export const reviewWordPress = (draft, options = {}) => reviewExport(draft, { ...options, destination: 'wordpress' });

export function wordPressReviewText(draft, review = reviewWordPress(draft)) {
  return [
    'Draft to Page: WordPress handoff review', '',
    'Limited formatting and writing-pattern checks. This is not fact-checking, grammar checking, permissions review, or URL verification.',
    review.totalFindings ? review.totalFindings + ' item(s) to inspect.' : 'No items found by these limited checks. This does not certify the article.',
    ...(review.truncated ? ['Showing the first ' + WORDPRESS_REVIEW_LIMIT + ' items. Inspect the complete article.'] : []), '',
    ...review.findings.map(item => 'Line ' + item.line + ': ' + item.message), '',
    'Before publishing in WordPress:',
    '- Compare names, dates, claims, quotations, and uncertainty with your own source.',
    '- Check permissions for writing and images. Add and inspect images in WordPress.',
    '- Inspect supported formatting and any literal Markdown after returning to Visual editor.',
    '- Enter the title and optional excerpt, slug, and SEO description in their separate fields.',
    '- Check the actual post preview, mobile layout, and links before publishing yourself.', '',
    'Source notes and private review questions are excluded. Article text can still contain private information.'
  ].join('\n') + '\n';
}
