// Pure view-state policy for the temporary Word image handoff.
// No original bytes or private document text are retained by this module.
export function summarizeWordImageHandoff(candidate, kit = null) {
  const positions = candidate?.wordImages?.length || 0;
  if (!positions) return '';
  if (!kit) return positions + ' numbered image/object position(s) in this Word import. Prepare the image package to identify recoverable and unresolved placements.';
  const recovered = (kit.placements || []).filter(p => Boolean(p.filename)).length;
  const files = (kit.images || []).length;
  const unresolved = Math.max(0, positions - recovered);
  const reused = Math.max(0, recovered - files);
  return positions + ' placement(s): ' + files + ' distinct file(s) recoverable, ' + recovered + ' placement(s) mapped, ' + unresolved + ' unresolved and ' + reused + ' repeated placement(s). Inspect each original image and its alternative text.';
}
export function wordImageDecisionReady(candidate, choice, kit, requested, confirmed) {
  if (!candidate?.wordImages?.length) return true;
  if (choice === 'placeholders') return true;
  return choice === 'kit' && Boolean(kit?.bytes && requested && confirmed);
}
export function wordImageDecisionStatus(candidate, choice, kit, requested, confirmed) {
  if (!candidate?.wordImages?.length) return '';
  if (choice === 'placeholders') return 'You will continue with numbered placeholders and add images manually later. Keep the original Word document. No image file will be retained by the import.';
  if (choice !== 'kit') return 'Choose how to handle these images before importing. An image package is not retained after import.';
  if (!kit) return 'Prepare the image package, review the image and metadata warnings, then request its download.';
  if (!kit.bytes) return 'No supported image files were recovered. Choose Continue with placeholders, or fix your Word document and preview again.';
  if (!requested) return 'Review the original-image and metadata warnings, then request the ZIP download. Import remains disabled.';
  if (!confirmed) return 'Download requested, not verified as saved. Check your device Downloads and open the ZIP, then confirm you have the package before importing.';
  return 'You confirmed the ZIP is saved. The app cannot verify this. Map each numbered placement manually; images are not uploaded or published.';
}
export function wordImageAfterApply(candidate, choice, kit) {
  if (!candidate?.wordImages?.length) return '';
  const total = candidate.wordImages.length;
  if (choice === 'placeholders') return total + ' Word image/object placeholder(s) remain as text. Revisit the original Word file and add images manually at the destination.';
  const unresolved = Math.max(0, total - (kit?.placements || []).filter(p => Boolean(p.filename)).length);
  return 'You confirmed the Word image ZIP on your device. Use image-map.json and the original Word file to match each numbered placeholder, including repeated placements. ' + unresolved + ' unresolved placement(s) need separate attention. Upload and review images manually; nothing was published.';
}
