// Read-only, deliberately invoked local alpha promotion gate.
// PASS from verify-release is a software check, not live alpha authorization.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { sourceDigest } from './source-snapshot.mjs';

export const ALPHA_REQUIRED_STEPS = Object.freeze(['build', 'tests', 'static', 'browser', 'source snapshot']);
export const ALPHA_REAL_WORLD_GATES = Object.freeze([
  'word_source', 'google_docs_source', 'hosted_wordpress', 'keyboard_device',
  'mobile_device', 'screen_reader', 'latency', 'private_support'
]);
const sha = s => typeof s === 'string' && /^[a-f0-9]{40}$/.test(s);
const digest = s => typeof s === 'string' && /^[a-f0-9]{64}$/.test(s);
const cloudflareVersion = s => typeof s === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(s);
const ref = s => typeof s === 'string' && /^[A-Za-z0-9_-]{4,80}$/.test(s);

export function evaluateAlphaRelease({ currentHead, sourceSha256, branch, clean, local, attestation }) {
  const blockers = [];
  const block = name => { if (!blockers.includes(name)) blockers.push(name); };
  if (!sha(currentHead) || branch !== 'main' || clean !== true) block('main_clean_checkout_required');
  if (!digest(sourceSha256)) block('source_snapshot_missing');
  if (local?.result !== 'PASS' || local.head !== currentHead || local.sourceSha256 !== sourceSha256 ||
      !Array.isArray(local.steps) || ALPHA_REQUIRED_STEPS.some(name => !local.steps.some(s => s.name === name && s.result === 'PASS')) ||
      local.browser?.scope !== 'full' || !Number.isInteger(local.browser?.checks) || local.browser.checks < 1 ||
      !Number.isInteger(local.browser?.layoutChecks) || local.browser.layoutChecks < 1) block('fresh_complete_local_validation_required');
  if (local?.wordpress?.result !== 'PASS') block('local_wordpress_save_reopen_required');
  if (attestation?.format !== 'drafttopage-alpha-release-record' || attestation.version !== 1 ||
      attestation.release_commit !== currentHead || attestation.source_sha256 !== sourceSha256)
    block('current_release_record_required');
  if (!attestation?.deployment || attestation.deployment.commit !== currentHead ||
      !cloudflareVersion(attestation.deployment.version_id) || attestation.deployment.status !== 'SUCCESS' ||
      attestation.deployment.production_verified !== true)
    block('production_version_and_live_verification_required');
  if (!attestation?.rollback || !sha(attestation.rollback.commit) ||
      attestation.rollback.commit === currentHead ||
      !cloudflareVersion(attestation.rollback.version_id) ||
      attestation.rollback.manual_recovery_checked !== true)
    block('last_known_good_rollback_pin_required');
  for (const name of ALPHA_REAL_WORLD_GATES) {
    const item = attestation?.acceptance?.[name];
    if (item?.status !== 'OBSERVED_PASS' || item.commit !== currentHead ||
        item.evidence_type !== 'HUMAN_OBSERVATION' || !ref(item.evidence_ref))
      block('unverified_' + name);
  }
  return {
    format: 'drafttopage-alpha-release-decision', version: 1,
    release_commit: sha(currentHead) ? currentHead : null,
    source_sha256: digest(sourceSha256) ? sourceSha256 : null,
    result: blockers.length ? 'BLOCKED' : 'READY_FOR_OWNER_INVITATION_DECISION',
    // This is a manual evidence index, not proof of remote state or a launch.
    evidence_type: 'LOCAL_VALIDATION_AND_OWNER_RECORDED_OBSERVATIONS',
    blockers
  };
}

export function examineAlphaRelease({
  root = process.cwd(), read = readFileSync,
  git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }),
  snapshot = sourceDigest
} = {}) {
  root = resolve(root);
  const get = path => { try { return JSON.parse(read(resolve(root, path), 'utf8')); } catch { return null; } };
  if (get('package.json')?.name !== 'drafttopage') throw new Error('Use the Draft to Page repository.');
  const command = args => { try { return String(git(args)).trim(); } catch { return ''; } };
  const currentHead = command(['rev-parse', 'HEAD']);
  const branch = command(['branch', '--show-current']);
  const clean = command(['status', '--porcelain', '--untracked-files=normal']) === '';
  let sourceSha256 = null;
  try { sourceSha256 = snapshot(root); } catch { /* Missing snapshot is an explicit blocker. */ }
  const decision = evaluateAlphaRelease({
    currentHead, branch, clean, sourceSha256,
    local: get('test-results/release-results.json'),
    attestation: get('test-results/alpha-release-record.json')
  });
  return decision;
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    const result = examineAlphaRelease();
    mkdirSync('test-results', { recursive: true });
    writeFileSync('test-results/alpha-release-decision.json', JSON.stringify(result, null, 2) + '\n');
    console.log(result.result + ': ' + result.blockers.join(', '));
    process.exitCode = result.result === 'BLOCKED' ? 1 : 0;
  } catch (error) {
    console.error('Alpha gate error: ' + error.message);
    process.exitCode = 1;
  }
}
