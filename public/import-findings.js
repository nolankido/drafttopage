// Display guidance only. Imported content and decisions remain unchanged.
export function summarizeImportFindings(candidate) {
  const warningCount = candidate?.warnings?.length || 0;
  const omittedFields = candidate?.unmapped?.length || 0;
  const imagePositions = candidate?.wordImages?.length || 0;
  const parts = [warningCount ? `${warningCount} conversion note(s) to inspect.` : 'No conversion notes were reported by these limited checks.'];
  if (omittedFields) parts.push(`${omittedFields} unmapped page field(s) need a separate decision.`);
  if (imagePositions) parts.push(`${imagePositions} numbered image or object position(s) need an image handoff decision.`);
  parts.push('Compare headings, tables, images and links with your original. This preview does not verify facts or guarantee formatting.');
  return parts.join(' ');
}
export function guidanceForImportWarning(warning) {
  const text = String(warning || '');
  if (/image|picture|object|figure/i.test(text)) return 'Check the numbered placeholder in the reading preview. For a Word file, use Keep the Word images below before applying; otherwise restore the image at the publishing destination.';
  if (/table|column|row|cell/i.test(text)) return 'Compare the table and its headers with the original. If the first row is a header, choose that option above and preview again; otherwise correct the source or import and edit.';
  if (/heading|title/i.test(text)) return 'Compare the article title with the first heading in the reading preview. Correct the source and preview again or use Import and edit.';
  if (/link|url|relative|target/i.test(text)) return 'Inspect the affected links in the preview. For relative HTML links, set the original page URL above and preview again. Verify every destination in the published editor.';
  if (/front.matter|unmapped|field/i.test(text)) return 'Inspect the unmapped fields below and decide how to carry their values into your destination before importing.';
  if (/revision|inserted|deleted|tracked/i.test(text)) return 'Compare the selected text version with Word. Switch versions above and preview again if needed; history is not carried into the article.';
  return 'Compare this change with your original. Fix the source and preview again, or import and edit before exporting.';
}
