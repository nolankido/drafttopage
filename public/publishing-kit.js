import { articleIssues, ARTICLE_LIMITS, articleBody } from './authoring.js';
import { createReadingPage } from './html-export.js';
import { createMarkdown } from './markdown.js';
import { suggestFilename } from './preview.js';
import { createZip } from './zip.js';

export function publicationFields(draft) {
  const issues = articleIssues(draft, 'html');
  if (Object.keys(issues).length) throw new Error(Object.values(issues)[0]);
  // Only these page fields can reach public files. Never serialize a workspace object.
  const clean = {};
  for (const [key, max] of Object.entries(ARTICLE_LIMITS)) {
    const value = draft[key] === undefined ? '' : draft[key];
    if (typeof value !== 'string' || value.length > max || value.includes('\u0000')) throw new Error('Check the ' + key + ' field before preparing a publishing kit.');
    clean[key] = value;
  }
  return clean;
}
export function publishingKitFiles(draft, { includeTitleHeading = false } = {}) {
  const clean = publicationFields(draft);
  const filename = /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(clean.slug) ? clean.slug : suggestFilename(clean.title);
  const missing = Object.keys(articleIssues(clean));
  const files = [
    { name: 'article-body.md', content: articleBody(clean) + '\n', purpose: 'Article body without title or metadata.' },
    { name: 'reading-page.html', content: createReadingPage(clean), purpose: 'Standalone reading page; open locally in a browser.' },
    { name: 'page-details.json', content: JSON.stringify({ title: clean.title.trim(), excerpt: clean.excerpt.trim(), description: clean.description.trim(), slug: filename, draft: true }, null, 2) + '\n', purpose: 'Page fields for a manual handoff; empty fields remain empty.' }
  ];
  if (!missing.length) files.push({ name: 'page.md', content: createMarkdown(clean, { includeTitleHeading }), purpose: 'Complete page Markdown. ' + (includeTitleHeading ? 'Includes a title heading.' : 'Your website supplies the title heading.') });
  const notices = [];
  if (missing.length) notices.push('page.md is omitted. Complete these page fields to include it: ' + missing.join(', ') + '.');
  if (filename !== clean.slug) notices.push('The ZIP filename and page-details slug were suggested from the title because the filename field is empty or invalid. Your editor field was kept.');
  const readme = [
    'Draft to Page: publishing kit', '',
    'This is an article handoff, not a private workspace backup. Nothing has been published.',
    'Source notes, audience, purpose, article type, review questions, check results, and sign-in fields are excluded.',
    'The article itself can still contain private information. Review it before sharing files or adding them to a public repository.', '',
    'Files:', ...files.map(file => '- ' + file.name + ': ' + file.purpose), '', ...notices, '',
    'Next steps:',
    '1. Extract this ZIP into a local folder. Open reading-page.html and inspect the article.',
    '2. Choose one article format for your destination. Do not upload this whole kit as a website.',
    '3. For an editor: use Copy formatted article in the workspace, or use article-body.md when the editor accepts Markdown. Add the title separately unless you deliberately included it in the clipboard copy.',
    '4. For a Markdown website: use page.md only when included. Check the destination content directory, metadata requirements, title handling, and preview on a feature branch.',
    '5. For static HTML: manually add reading-page.html to a directory that serves HTML, after checking hosting and the preview. Choose its destination name yourself.',
    '6. Adapt page-details.json manually. It is a handoff document, not a universal CMS import format. Empty values need your decision.',
    '7. Review names, claims, uncertainty, permissions, links, and mobile layout in the actual destination before publishing.', '',
    'The reading renderer supports a limited Markdown subset. Source HTML, images, relative addresses, and unsupported links remain text. Deliberate HTTP(S) links use protected new-tab navigation.',
    'The draft flag is metadata, not a universal publication lock. There is no automatic upload or repository connection.',
    'Keep an explicit private workspace backup separately if you want to preserve source and review notes.', '',
    'Guidance: https://drafttopage.com/help/publishing-handoff/'
  ].join('\n') + '\n';
  files.push({ name: 'README.txt', content: readme, purpose: 'File choices and destination review steps.' });
  return { filename: filename + '-publishing-kit.zip', files, notices };
}
export function createPublishingKit(draft, options) {
  const kit = publishingKitFiles(draft, options);
  return { filename: kit.filename, bytes: createZip(kit.files), files: kit.files.map(({ name }) => name), notices: kit.notices };
}
