// TEMPORARY manually invoked preview validation hook, DO NOT MERGE.
// Production remains the original deterministic build-content import only.
import './build-content.mjs';
if (process.env.DTP_MANUAL_VALIDATION_CHILD !== '1') {
  await import('./temporary-active-review-validation.mjs');
}
