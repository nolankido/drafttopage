import { publishingKitFiles, publicationFields } from './publishing-kit.js';
import { createWordPressArticle } from './wordpress-export.js';
import { wordPressReviewText } from './wordpress-review.js';
import { createZip } from './zip.js';
import { suggestFilename } from './preview.js';

export function wordPressKitSummary(draft) {
  const clean = publicationFields(draft);
  const slug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(clean.slug) ? clean.slug : suggestFilename(clean.title);
  const notices = [];
  if (slug !== clean.slug) notices.push('The kit uses a safe slug suggested from the title. Your editor filename is unchanged. Review the suggestion in WordPress.');
  const absent = ['excerpt', 'description'].filter(key => !clean[key].trim());
  if (absent.length) notices.push('Optional fields left empty: ' + absent.join(', ') + '. The kit does not invent them.');
  return { filename: slug + '-wordpress-kit.zip', notices };
}

export function wordPressKitFiles(draft) {
  // Reuse the existing strict, whitelisted article-field boundary. Never serialize a workspace.
  const base = publishingKitFiles(draft), article = createWordPressArticle(draft);
  const original = name => base.files.find(file => file.name === name);
  const fields = JSON.parse(original('page-details.json').content);
  const { filename, notices } = wordPressKitSummary(draft);
  const files = [
    { name: 'wordpress-blocks.html', content: article.html, purpose: 'Paste this source into the full WordPress Code editor, then inspect in Visual editor.' },
    { ...original('article-body.md'), content: draft.body, purpose: 'Exact original Markdown body for further editing and review line numbers; not the WordPress block source.' },
    { ...original('reading-page.html'), purpose: 'Open in a browser to review. Your WordPress theme can render differently.' },
    { ...original('page-details.json'), purpose: 'Title and optional excerpt, slug, and description for separate fields. Not a CMS import file.' },
    { name: 'REVIEW.txt', content: wordPressReviewText(draft), purpose: 'Current line-specific handoff findings and the final publishing checklist.' }
  ];
  files.push({ name: 'README.txt', purpose: 'WordPress destination instructions and field mapping.', content: [
    'Draft to Page: WordPress publishing kit', '',
    'A manual article handoff. Nothing has been uploaded or published. This is not a workspace backup.',
    'The kit excludes source notes, audience, purpose, article type, private review questions, revisions, and sign-in fields.',
    'Article text and page fields can still contain private information. Inspect every file before sharing.', '',
    'Files:', ...files.map(file => '- ' + file.name + ': ' + file.purpose), '', ...notices, '',
    'WordPress steps:',
    '1. Extract the ZIP locally. Read REVIEW.txt and open reading-page.html to inspect the article.',
    '   REVIEW.txt line numbers refer to the exact original body in article-body.md, not to generated HTML.',
    '2. Create a new, empty draft post in the WordPress block editor. Enter page-details.json title in the title field.',
    '3. Open wordpress-blocks.html in a TEXT EDITOR. Copy all source, including block comments. Opening it in a browser only shows a reading view.',
    '4. In WordPress, open Options > Code editor and paste the source in the post body. Do not paste into a Custom HTML block or the Classic Editor.',
    '5. Return to Visual editor. Check headings, lists, quotes, code, tables, and links. Rebuild images, malformed or oversized tables or lists, and unsupported syntax yourself.',
    '6. Add optional page fields: excerpt goes in the post Excerpt setting; slug goes in the post Slug/permalink setting when available; description goes in your SEO tool only if it offers that field. Do not paste these fields into the article body.',
    '7. Choose categories, featured image, and other site settings yourself. Preview the actual post and its mobile view. Publish only after your own review.', '',
    'Body H1 headings become H2. Numbered lists preserve their starting value. Single-line nested lists support six levels and 200 items per continuous group, with two or four additional spaces per level. Inconsistent numbering, indentation, and multiline item blocks stay intact as text. Source HTML, images, and unsupported Markdown stay text. Safe absolute HTTP(S) links and simple pipe tables are supported. Tables allow 12 columns and 100 data rows, with matching cell counts; malformed or oversized tables stay complete as text.',
    'An excerpt is optional and its display depends on your theme. A description is not a universal WordPress post field. No plugin or paid service is required by this kit.',
    'The draft flag in page-details.json is a reminder, not a publication lock. This ZIP is not an automatic WordPress import or an API integration.',
    'Keep a private workspace backup separately to preserve source and review notes.', '',
    'Help: https://drafttopage.com/help/publishing-handoff/#wordpress-kit',
    'Official field help: https://wordpress.org/documentation/article/page-post-settings-sidebar/'
  ].join('\n') + '\n' });
  return { filename, files, notices };
}
export function createWordPressKit(draft) {
  const kit = wordPressKitFiles(draft);
  return { filename: kit.filename, bytes: createZip(kit.files), files: kit.files.map(file => file.name), notices: kit.notices };
}
