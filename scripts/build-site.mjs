// TEMPORARY native preview validation hook. NEVER MERGE.
import './build-content.mjs';
if (process.env.DTP_MANIFEST_CHILD !== '1') {
  await import('./temporary-manifest-validation.mjs');
}
