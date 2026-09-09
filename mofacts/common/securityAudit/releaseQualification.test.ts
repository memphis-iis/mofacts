import { expect } from 'chai';
import fixture from './fixtures/release-record.fixture.json' with { type: 'json' };
import { observeBuildIdentity } from './buildIdentity.ts';
import { evaluateReleaseIdentity, parseWorkstationReleaseRecord } from './releaseQualification.ts';
import { canonicalJson } from '../securityAuditReport.ts';

// The ordinary Meteor common-test discovery owns this parity check. Node tests
// exercise the same .ts modules and JSON fixture; no Meteor run is implied.
describe('Phase 0 release proof Node/Meteor contract parity', function() {
  it('imports erasable TypeScript and JSON attributes and preserves the fixture', function() {
    expect(parseWorkstationReleaseRecord(fixture)).to.deep.equal(fixture);
    expect(evaluateReleaseIdentity(fixture)).to.deep.equal({ status: 'PASS' });
  });

  it('matches the Node golden digest under the Meteor test runtime', async function() {
    const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonicalJson(fixture)));
    const hex = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
    expect(hex).to.equal('30d43552435b48f51ae14db7b3fbf6b95ee6a4da52b550f2b62851bedc2446fb');
  });

  it('retains old records and represents missing build proof without throwing', function() {
    const { qualification: _qualification, ...existingRecord } = fixture;
    expect(parseWorkstationReleaseRecord(existingRecord)).to.deep.equal(existingRecord);
    expect(evaluateReleaseIdentity(existingRecord)).to.deep.equal({ status: 'ERROR', reason: 'proof-unavailable' });
    expect(observeBuildIdentity(undefined)).to.deep.equal({ state: 'unavailable', reason: 'not-provided' });
  });

  it('does not make dirty source a deployment or identity-policy denial', function() {
    const dirty = structuredClone(fixture);
    dirty.includedUncommittedLocalChanges = true;
    dirty.qualification.buildIdentity.includedUncommittedLocalChanges = true;
    expect(evaluateReleaseIdentity(dirty)).to.deep.equal({ status: 'PASS' });
  });
});
