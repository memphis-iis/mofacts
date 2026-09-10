import { expect } from 'chai';
import sinon from 'sinon';
import { Meteor } from 'meteor/meteor';
import { Session } from 'meteor/session';
import { buildLearnerTdfConfig } from '../../common/lib/learnerTdfConfig';
import { loadLaunchReadyTdf } from './launchReadyTdf';
import { applyLearnerSettingsForLaunch, getLearnerTdfConfig } from './learnerSettings';

declare const Tdfs: any;

function lesson(id: string, drill: number) {
  return {
    _id: id, stimuliSetId: `set-${id}`,
    content: { fileName: `${id}.json`, tdfs: { tutor: { setspec: { lessonname: id }, unit: [
      { unitname: 'Instructions', unitinstructions: 'Read' },
      { unitname: `${id} practice`, learningsession: { clusterlist: '0', unitMode: 'distance' }, deliverySettings: { drill, practiceseconds: 0 } },
    ] } } },
    rawStimuliFile: { setspec: { clusters: [{ clusterKC: id, stims: [{ stimulusKC: id }] }] } },
    stimuli: [{ stimulusKC: id, clusterKC: id, stimuliSetId: `set-${id}` }],
  };
}

describe('shared learner settings launch wiring', function() {
  afterEach(function() { sinon.restore(); Session.set('learnerTdfConfigOverrides', {}); });

  it('loads current settings without visiting Practice and replaces stale local values', async function() {
    sinon.stub(Meteor, 'userId').returns('learner');
    const tdf = lesson('a', 10000);
    const config = buildLearnerTdfConfig(tdf.content, 'a', { unit: { '1': { deliverySettings: { drill: 2500 } } } });
    const call = sinon.stub(Meteor as any, 'callAsync').resolves(config);
    Session.set('learnerTdfConfigOverrides', { a: { overrides: { unit: { '1': { deliverySettings: { drill: 999 } } } } } });
    expect((await applyLearnerSettingsForLaunch(tdf.content, 'a')).tdfs.tutor.unit[1]!.deliverySettings!.drill).to.equal(2500);
    expect(call.calledOnceWithExactly('getLearnerTdfConfig', 'a')).to.equal(true);
    expect(tdf.content.tdfs.tutor.unit[1]!.deliverySettings!.drill).to.equal(10000);
    call.resolves(null);
    expect((await applyLearnerSettingsForLaunch(tdf.content, 'a')).tdfs.tutor.unit[1]!.deliverySettings!.drill).to.equal(10000);
    expect(getLearnerTdfConfig('a')).to.equal(undefined);
  });

  it('uses only endpoint settings in the active progressive loader and preserves reversed identities', async function() {
    sinon.stub(Meteor, 'userId').returns('learner');
    const a = lesson('a', 10000), b = lesson('b', 20000);
    const config = buildLearnerTdfConfig(b.content, 'b', { unit: { '1': { deliverySettings: { drill: 3000, optimalThreshold: 0.7 } } } });
    const call = sinon.stub(Meteor as any, 'callAsync');
    call.withArgs('getProgressiveAssignmentLaunch', 'p', 'b', 'revision').resolves({
      progressiveRevisionId: 'revision', assignmentId: 'p', courseId: 'c', endpointTdfId: 'b', title: 'Progressive', memberTdfIds: ['a', 'b'], tdfs: [a, b],
    });
    call.withArgs('getLearnerTdfConfig', 'b').resolves(config);
    const result = await loadLaunchReadyTdf('b', { courseAssignment: {
      assignmentId: 'p', courseId: 'c', TDFId: 'b', launchSource: 'courses', launchMode: 'progressive',
      progressiveEndpointTdfId: 'b', progressiveRevisionId: 'revision', progressiveReverseOrder: true,
    } });
    expect(call.calledWith('getLearnerTdfConfig', 'a')).to.equal(false);
    expect(result.content.tdfs.tutor.unit[1].deliverySettings).to.include({ drill: 3000, optimalThreshold: 0.7, practiceseconds: 0 });
    expect(result.content.tdfs.tutor.unit[1].learningsession).to.include({ maxTrials: 0, clusterlist: '0-1' });
    expect(result.content.stimuli.map((stim: any) => stim.progressiveSourceTdfId)).to.deep.equal(['b', 'a']);
    expect(b.content.tdfs.tutor.unit[1]!.deliverySettings!.drill).to.equal(20000);
  });

  it('applies settings to a normal course launch from the same loader used by reloads', async function() {
    sinon.stub(Meteor, 'userId').returns('learner');
    const tdf = lesson('a', 10000);
    sinon.stub(Meteor, 'subscribe').returns({ ready: () => true, stop: () => {} } as any);
    sinon.stub(Tdfs, 'findOne').returns(tdf);
    sinon.stub(Meteor as any, 'callAsync').withArgs('getLearnerTdfConfig', 'a').resolves(
      buildLearnerTdfConfig(tdf.content, 'a', { unit: { '1': { deliverySettings: { drill: 4500 } } } }),
    );
    const result = await loadLaunchReadyTdf('a', { courseAssignment: {
      assignmentId: 'p', courseId: 'c', TDFId: 'a', launchSource: 'courses', launchMode: 'individual',
    } });
    expect(result.content.tdfs.tutor.unit[1].deliverySettings.drill).to.equal(4500);
    expect(result.tdfDoc.content).to.equal(result.content);
  });
});
