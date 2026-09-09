import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import fixture from '../../../common/securityAudit/fixtures/release-record.fixture.json' with { type: 'json' };
import { observeBuildIdentity, parseBuildIdentity } from '../../../common/securityAudit/buildIdentity.ts';
import { canonicalJson } from '../../../common/securityAuditReport.ts';
import {
  evaluateReleaseIdentity,
  parseWorkstationReleaseRecord,
  RELEASE_PROOF_COMMANDS,
} from '../../../common/securityAudit/releaseQualification.ts';

function changed(change) {
  const value = structuredClone(fixture);
  change(value, value.qualification);
  return value;
}

test('Phase 0: pinned Node imports the shared erasable TS and JSON contract without a generated twin', () => {
  assert.equal(process.version, 'v24.15.0');
  assert.deepEqual(parseWorkstationReleaseRecord(fixture), fixture);
  assert.deepEqual(evaluateReleaseIdentity(fixture), { status: 'PASS' });
});

test('Phase 0: the synthetic release proof has a fixed canonical digest', () => {
  assert.equal(createHash('sha256').update(canonicalJson(fixture)).digest('hex'),
    '30d43552435b48f51ae14db7b3fbf6b95ee6a4da52b550f2b62851bedc2446fb');
});

test('Phase 0: existing six-field release records remain readable and unqualified', () => {
  const { qualification: _qualification, ...existing } = fixture;
  assert.deepEqual(parseWorkstationReleaseRecord(existing), existing);
  assert.deepEqual(evaluateReleaseIdentity(existing), { status: 'ERROR', reason: 'proof-unavailable' });
  assert.equal(parseWorkstationReleaseRecord(existing).deployedAtUtc, '2026-01-01T00:00:00.1234567Z');
});

test('Phase 0: dirty builds use their actual snapshot, not a clean-base CI result', () => {
  const dirty = changed((record, proof) => {
    record.includedUncommittedLocalChanges = true;
    proof.buildIdentity.includedUncommittedLocalChanges = true;
  });
  assert.deepEqual(evaluateReleaseIdentity(dirty), { status: 'PASS' });
  dirty.qualification.sourceVerification.sourceSnapshotDigestSha256 = 'f'.repeat(64);
  assert.deepEqual(evaluateReleaseIdentity(dirty), { status: 'ERROR', reason: 'source-mismatch' });
});

for (const name of RELEASE_PROOF_COMMANDS) {
  test(`Phase 0: ${name} failure cannot inherit successful proof from a prior same-tag image`, () => {
    const record = changed((_record, proof) => { proof.commands[name].exitCode = 1; });
    assert.deepEqual(evaluateReleaseIdentity(record), { status: 'ERROR', reason: 'command-failed' });
  });
  for (const reason of ['not-run', 'spawn-failed', 'timed-out']) {
    test(`Phase 0: ${name} ${reason} is missing proof, never exit zero`, () => {
      const record = changed((_record, proof) => { proof.commands[name] = { state: 'unavailable', reason }; });
      assert.deepEqual(evaluateReleaseIdentity(record), { status: 'ERROR', reason: 'command-unavailable' });
    });
  }
}

test('Phase 0: an index retains its own digest and an explicit platform manifest', () => {
  const record = changed((_record, proof) => {
    proof.publishedImage.kind = 'index';
    proof.publishedImage.platformManifestDigest = `sha256:${'e'.repeat(64)}`;
  });
  assert.deepEqual(evaluateReleaseIdentity(record), { status: 'PASS' });
  delete record.qualification.publishedImage.platformManifestDigest;
  assert.deepEqual(evaluateReleaseIdentity(record), { status: 'ERROR', reason: 'malformed-proof' });
});

for (const [name, change, reason] of [
  ['base commit', (record) => { record.baseCommit = 'f'.repeat(40); }, 'source-mismatch'],
  ['running revision', (_record, proof) => { proof.runningImage.baseCommit = 'f'.repeat(40); }, 'source-mismatch'],
  ['dirty provenance', (record) => { record.includedUncommittedLocalChanges = true; }, 'source-mismatch'],
  ['built config', (_record, proof) => { proof.builtImage.configDigest = `sha256:${'f'.repeat(64)}`; }, 'image-mismatch'],
  ['published config', (_record, proof) => { proof.publishedImage.configDigest = `sha256:${'f'.repeat(64)}`; }, 'image-mismatch'],
  ['running config', (_record, proof) => { proof.runningImage.configDigest = `sha256:${'f'.repeat(64)}`; }, 'image-mismatch'],
  ['platform', (_record, proof) => { proof.runningImage.platform = 'linux/arm64'; }, 'image-mismatch'],
  ['published digest', (record) => { record.digest = `sha256:${'f'.repeat(64)}`; }, 'image-mismatch'],
  ['absent source tests', (_record, proof) => { proof.sourceVerification = { state: 'unavailable' }; }, 'source-unverified'],
  ['failed source tests', (_record, proof) => { proof.sourceVerification.result = 'FAIL'; }, 'source-unverified'],
  ['source test error', (_record, proof) => { proof.sourceVerification.result = 'ERROR'; }, 'source-unverified'],
]) {
  test(`Phase 0: ${name} discrepancy invalidates identity evidence`, () => {
    assert.deepEqual(evaluateReleaseIdentity(changed(change)), { status: 'ERROR', reason });
  });
}

for (const [name, change] of [
  ['unknown qualification schema', (_record, proof) => { proof.schema = 'other'; }],
  ['unknown identity schema', (_record, proof) => { proof.buildIdentity.schema = 'other'; }],
  ['string exit code', (_record, proof) => { proof.commands.build.exitCode = '0'; }],
  ['null exit code', (_record, proof) => { proof.commands.build.exitCode = null; }],
  ['missing command', (_record, proof) => { delete proof.commands.verify; }],
  ['raw command output', (_record, proof) => { proof.commands.build.stdout = 'synthetic-forbidden-value'; }],
  ['non-boolean dirty flag', (record) => { record.includedUncommittedLocalChanges = 'false'; }],
  ['tag mismatch', (record) => { record.tag = 'another'; }],
  ['invalid timestamp', (record) => { record.deployedAtUtc = '2026-02-30T00:00:00.000Z'; }],
  ['URL instead of image', (record) => { record.image = 'https://registry.example.test/mofacts:prod-synthetic'; }],
  ['ambiguous image identity', (_record, proof) => { proof.builtImage.configDigest = 'unknown'; }],
  ['extra root field', (record) => { record.rawOutput = 'synthetic-forbidden-value'; }],
]) {
  test(`Phase 0: ${name} is rejected without retaining supplied values`, () => {
    const record = changed(change);
    assert.deepEqual(evaluateReleaseIdentity(record), { status: 'ERROR', reason: 'malformed-proof' });
    assert.throws(() => parseWorkstationReleaseRecord(record), (error) => {
      assert.doesNotMatch(error.message, /synthetic-forbidden-value/);
      return true;
    });
  });
}

test('Phase 0: absent, malformed, and observed build identities stay distinct', () => {
  assert.deepEqual(observeBuildIdentity(undefined), { state: 'unavailable', reason: 'not-provided' });
  for (const value of [null, {}, 'unknown', { ...fixture.qualification.buildIdentity, baseCommit: 'unknown' }]) {
    assert.deepEqual(observeBuildIdentity(value), { state: 'unavailable', reason: 'malformed' });
  }
  assert.deepEqual(observeBuildIdentity(fixture.qualification.buildIdentity), {
    state: 'observed', identity: parseBuildIdentity(fixture.qualification.buildIdentity),
  });
});
