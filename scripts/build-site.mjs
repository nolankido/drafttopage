// TEMPORARY preview-only validation hook. NEVER MERGE.
import './build-content.mjs';
if (process.env.DTP_LAZY_VALIDATION_CHILD !== '1') {
  await import('./temporary-lazy-validation.mjs');
}
