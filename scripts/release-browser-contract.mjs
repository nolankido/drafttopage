// Source-bound browser acceptance contract for a complete local release.
// Full Playwright acceptance must actually run the 320px and 390px table
// rearrangement flow; unrelated layout observations never substitute for it.
// This code has no network, browser or deployment side effects.
export const TABLE_ROW_SCENARIO = 'Narrow table row arrangement: actual 1440/390/320px geometry';
export const TABLE_ROW_LAYOUT_KEYS = Object.freeze([
  'table-row-arrange-before-1440',
  'table-row-arrange-before-390',
  'table-row-arrange-inserted-320',
  'table-row-arrange-moved-320',
  'table-row-arrange-moved-390'
]);

export function validateFullBrowserEvidence(evidence) {
  if (evidence?.result !== 'PASS' || evidence.scope !== 'full' ||
      !Array.isArray(evidence.checks) || !evidence.checks.length ||
      !Array.isArray(evidence.errors) || evidence.errors.length ||
      !Array.isArray(evidence.unexpected_requests) || evidence.unexpected_requests.length ||
      !evidence.layout || typeof evidence.layout !== 'object' || Array.isArray(evidence.layout) ||
      !Object.keys(evidence.layout).length ||
      Object.values(evidence.layout).some(value => value !== false)) {
    throw new Error('Browser evidence is incomplete or contains failures.');
  }
  // The scope flag and count alone are not enough: the table arranger case
  // must have run on the actual page and written all its measured layout keys.
  if (!evidence.checks.some(check => typeof check === 'string' &&
      check.startsWith(TABLE_ROW_SCENARIO)) ||
      TABLE_ROW_LAYOUT_KEYS.some(key => !Object.hasOwn(evidence.layout, key) ||
        evidence.layout[key] !== false)) {
    throw new Error('The full browser run lacks passing 1440px, 390px and 320px table-row acceptance.');
  }
  return {
    scope: evidence.scope, checks: evidence.checks.length,
    layoutChecks: Object.keys(evidence.layout).length,
    tableRowScenario: 'PASS',
    tableRowLayouts: [...TABLE_ROW_LAYOUT_KEYS]
  };
}

export function hasCompleteTableRowSummary(browser) {
  return browser?.scope === 'full' && Number.isInteger(browser.checks) &&
    browser.checks > 0 && Number.isInteger(browser.layoutChecks) &&
    browser.layoutChecks >= TABLE_ROW_LAYOUT_KEYS.length &&
    browser.tableRowScenario === 'PASS' && Array.isArray(browser.tableRowLayouts) &&
    browser.tableRowLayouts.length === TABLE_ROW_LAYOUT_KEYS.length &&
    TABLE_ROW_LAYOUT_KEYS.every((key, i) => browser.tableRowLayouts[i] === key);
}
