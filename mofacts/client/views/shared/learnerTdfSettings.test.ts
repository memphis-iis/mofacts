import { expect } from 'chai';
import sinon from 'sinon';
import { Meteor } from 'meteor/meteor';
import { Session } from 'meteor/session';
import { initializeLearnerSettingsHost, destroyLearnerSettingsHost, flushLearnerSettings } from './learnerTdfSettings';

describe('shared learner settings save-before-launch', function() {
  afterEach(function() { sinon.restore(); Session.set('learnerTdfConfigOverrides', {}); });

  function host() {
    const instance: any = {};
    initializeLearnerSettingsHost(instance);
    const courseAssignment = { assignmentId: 'p', courseId: 'c', TDFId: 'a', launchSource: 'courses', launchMode: 'individual' };
    instance.learnerConfigState.set({ ...instance.learnerConfigState.get(), tdfId: 'a', courseAssignment, dirty: true });
    instance.learnerConfigSaveRevision = 1;
    instance.learnerConfigPendingSave = { tdfId: 'a', patch: { unit: { '1': { deliverySettings: { drill: 2000 } } } }, saveRevision: 1 };
    return { instance, courseAssignment };
  }

  it('flushes an unsent edit with its original course context before allowing launch', async function() {
    const { instance, courseAssignment } = host();
    const patch = instance.learnerConfigPendingSave.patch;
    const call = sinon.stub(Meteor as any, 'callAsync').resolves({ config: { overrides: patch } });
    await flushLearnerSettings(instance);
    expect(call.calledOnceWithExactly('saveLearnerTdfConfig', 'a', patch, { courseAssignment })).to.equal(true);
    expect(instance.learnerConfigState.get()).to.include({ dirty: false, saving: false });
    expect(instance.learnerConfigPendingSave).to.equal(null);
    destroyLearnerSettingsHost(instance);
  });

  it('rejects launch and retains an inline error when saving fails', async function() {
    const { instance } = host();
    sinon.stub(Meteor as any, 'callAsync').rejects(new Error('Settings access denied'));
    try { await flushLearnerSettings(instance); expect.fail('Expected save rejection'); }
    catch (error: any) { expect(error.message).to.equal('Settings access denied'); }
    expect(instance.learnerConfigState.get()).to.include({ dirty: true, error: 'Settings access denied' });
    destroyLearnerSettingsHost(instance);
  });
});
