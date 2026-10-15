import { publishingKitFiles, publicationFields } from './publishing-kit.js';
import { createWordPressArticle } from './wordpress-export.js';
import { wordPressReviewText, reviewWordPress } from './wordpress-review.js';
import { wordPressImagePlan } from './wordpress-images.js';
import { createZip } from './zip.js';
import { suggestFilename } from './preview.js';

export function wordPressKitSummary(draft, { includeLinkedImages = false } = {}) {
  if (typeof includeLinkedImages !== 'boolean') throw new Error('Choose whether to prepare linked images.');
  const clean = publicationFields(draft);
  const slug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(clean.slug) ? clean.slug : suggestFilename(clean.title);
  const notices = [];
  if (includeLinkedImages) notices.push('Linked image preparation is on for WordPress blocks. Opening those blocks can request image URLs; the reading page keeps image syntax as text.');
  if (slug !== clean.slug) notices.push('The kit uses a safe slug suggested from the title. Your editor filename is unchanged. Review the suggestion in WordPress.');
  const absent = ['excerpt', 'description'].filter(key => !clean[key].trim());
  if (absent.length) notices.push('Optional fields left empty: ' + absent.join(', ') + '. The kit does not invent them.');
  return { filename: slug + '-wordpress-kit.zip', notices };
}

export function wordPressKitFiles(draft, options = {}) {
  // Reuse the existing strict, whitelisted article-field boundary. Never serialize a workspace.
  const base = publishingKitFiles(draft), article = createWordPressArticle(draft, options);
  const original = name => base.files.find(file => file.name === name);
  const fields = JSON.parse(original('page-details.json').content);
  const { filename, notices } = wordPressKitSummary(draft, options);
  const files = [
    { name: 'wordpress-blocks.html', content: article.html, purpose: 'Paste this source into the full WordPress Code editor, then inspect in Visual editor.' },
    { ...original('article-body.md'), content: draft.body, purpose: 'Exact original Markdown body for further editing and review line numbers; not the WordPress block source.' },
    { ...original('reading-page.html'), purpose: 'Open in a browser to review. Your WordPress theme can render differently.' },
    { ...original('page-details.json'), purpose: 'Title and optional excerpt, slug, and description for separate fields. Not a CMS import file.' },
    { name: 'REVIEW.txt', content: wordPressReviewText(draft, reviewWordPress(draft, options)) + '\n' + wordPressImagePlan(draft.body, options), purpose: 'Current findings, complete image handoff notes, and the final publishing checklist.' }
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
    '5. Return to Visual editor. Check headings, lists, quotes, code, tables, links, and image blocks. Rebuild images left as text, malformed or oversized tables or lists, and unsupported syntax yourself.',
    '6. Add optional page fields: excerpt goes in the post Excerpt setting; slug goes in the post Slug/permalink setting when available; description goes in your SEO tool only if it offers that field. Do not paste these fields into the article body.',
    '7. Choose categories, featured image, and other site settings yourself. Preview the actual post and its mobile view. Publish only after your own review.', '',
    'Body H1 headings become H2. Numbered lists preserve their starting value. Single-line nested lists support six levels and 200 items per continuous group, with two or four additional spaces per level. Inconsistent numbering, indentation, and multiline item blocks stay intact as text. Source HTML, unselected or unsupported images, and unsupported Markdown stay text. Safe absolute HTTP(S) links and simple pipe tables are supported. Tables allow 12 columns and 100 data rows, with matching cell counts; malformed or oversized tables stay complete as text.',
    'Image mode: ' + (options.includeLinkedImages ? article.imageCount + ' supported standalone HTTPS image reference(s) became linked Image blocks.' : 'Image conversion is off. Every image reference stays literal text in the blocks.'),
    'Linked images are URL references, not uploaded files. Opening wordpress-blocks.html in a browser or WordPress can request those URLs. No image was loaded, verified, or uploaded by Draft to Page. Use public files you have permission to publish. In WordPress, inspect alternative text, including empty decorative text, and use Upload to Media Library if you want a copy on your site.',
    'reading-page.html remains an inert text/format preview with image syntax as text, even when WordPress Image blocks are selected. It is not an image preview. REVIEW.txt includes all recognized image references and the selected mode. No attachments, captions, dimensions, featured image, or Media Library IDs are invented.',
    'An excerpt is optional and its display depends on your theme. A description is not a universal WordPress post field. No plugin or paid service is required by this kit.',
    'The draft flag in page-details.json is a reminder, not a publication lock. This ZIP is not an automatic WordPress import or an API integration.',
    'Keep a private workspace backup separately to preserve source and review notes.', '',
    'Help: https://drafttopage.com/help/publishing-handoff/#wordpress-kit',
    'Official field help: https://wordpress.org/documentation/article/page-post-settings-sidebar/'
  ].join('\n') + '\n' });
  return { filename, files, notices };
}
export function createWordPressKit(draft, options = {}) {
  const kit = wordPressKitFiles(draft, options);
  return { filename: kit.filename, bytes: createZip(kit.files), files: kit.files.map(file => file.name), notices: kit.notices };
}
