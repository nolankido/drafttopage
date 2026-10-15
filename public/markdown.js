import { ARTICLE_LIMITS } from './writing-limits.js';
// Markdown is exported as a file, never injected into HTML or automatically published.
export function createMarkdown(draft, { includeTitleHeading = true } = {}) {
  if (!draft || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(draft.slug || '') || draft.slug.length > 80) {
    throw new Error('Use a filename containing lowercase letters, digits, and separating hyphens.');
  }
  for (const [name, max] of Object.entries(ARTICLE_LIMITS).filter(([name]) => name !== 'slug')) {
    if (typeof draft[name] !== 'string' || !draft[name].trim() || draft[name].length > max) throw new Error(`Check the ${name} field before exporting.`);
  }
  // JSON-quoted scalars are valid YAML and stop metadata/newline injection.
  const scalar = value => JSON.stringify(value.replaceAll('\r', '').trim());
  const title = draft.title.trim().replaceAll('\n', ' ').replaceAll('\r', '')
    .replace(/[\\`*_{}\[\]()<>#!|]/g, '\\$&');
  return `---\ntitle: ${scalar(draft.title)}\nexcerpt: ${scalar(draft.excerpt)}\ndescription: ${scalar(draft.description)}\ndraft: true\n---\n\n${includeTitleHeading ? '# ' + title + '\n\n' : ''}${draft.body.trim()}\n`;
}
