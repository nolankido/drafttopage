import { articleIssues } from './authoring.js';
import { publicationFields } from './publishing-kit.js';
import { wordPressKitSummary } from './wordpress-kit.js';
import { suggestFilename } from './preview.js';

// File-list metadata only. Never render article files, reviews or ZIP bytes here.
// The authoritative serializers remain unchanged; parity tests pin this catalog
// to their filenames, order, purposes, optional files, notices and field guards.
const generalFiles = [
  ['article-body.md', 'Article body without title or metadata.'],
  ['reading-page.html', 'Standalone reading page; open locally in a browser.'],
  ['page-details.json', 'Page fields for a manual handoff; empty fields remain empty.']
];
const wordPressFiles = [
  ['wordpress-blocks.html', 'Open in a text editor, copy all source, and paste into the empty paragraph below the title in WordPress Visual editor.'],
  ['article-body.md', 'Exact original Markdown body for further editing and review line numbers; not the WordPress block source.'],
  ['reading-page.html', 'Open in a browser to review. Your WordPress theme can render differently.'],
  ['page-details.json', 'Title and optional excerpt, slug, and description for separate fields. Not a CMS import file.'],
  ['REVIEW.txt', 'Current findings, complete image handoff notes, and the final publishing checklist.'],
  ['README.txt', 'WordPress destination instructions and field mapping.']
];
const describe = entries => entries.map(([name, purpose]) => ({ name, purpose }));

export function publishingKitManifest(draft, { includeTitleHeading = false } = {}) {
  const clean = publicationFields(draft);
  const slug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(clean.slug) ? clean.slug : suggestFilename(clean.title);
  const missing = Object.keys(articleIssues(clean));
  const files = describe(generalFiles), notices = [];
  if (!missing.length) files.push({ name: 'page.md', purpose: 'Complete page Markdown. ' + (includeTitleHeading ? 'Includes a title heading.' : 'Your website supplies the title heading.') });
  if (missing.length) notices.push('page.md is omitted. Complete these page fields to include it: ' + missing.join(', ') + '.');
  if (slug !== clean.slug) notices.push('The ZIP filename and page-details slug were suggested from the title because the filename field is empty or invalid. Your editor field was kept.');
  files.push({ name: 'README.txt', purpose: 'File choices and destination review steps.' });
  return { filename: slug + '-publishing-kit.zip', files, notices };
}

export function wordPressKitManifest(draft, options = {}) {
  const summary = wordPressKitSummary(draft, options);
  return { ...summary, files: describe(wordPressFiles) };
}
