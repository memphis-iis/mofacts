import { expect } from 'chai';
import { createDashboardLearnerConfigMethods } from './dashboardLearnerConfigMethods';

describe('learner settings access', function() {
  function fixture() {
    const content = { tdfs: { tutor: { setspec: {}, unit: [
      { unitname: 'Instructions', unitinstructions: 'Read' },
      { unitname: 'Practice', learningsession: { clusterlist: '0' }, deliverySettings: { drill: 10000 } },
    ] } } };
    const courseAssignment = { assignmentId: 'assignment', courseId: 'course', TDFId: 'lesson', launchSource: 'courses', launchMode: 'individual' };
    let saved: any;
    const reads: any[] = [];
    const methods = createDashboardLearnerConfigMethods({
      Meteor: { Error: class extends Error { constructor(code: string, reason: string) { super(`${code}: ${reason}`); } } },
      getAccessibleTdf: async (userId, tdfId, options) => {
        expect(userId).to.equal('enrolled-learner');
        expect(tdfId).to.equal('lesson');
        if (options.courseAssignment?.assignmentId !== courseAssignment.assignmentId) throw new Error('Course access denied');
        return { _id: 'lesson', content };
      },
      UserDashboardCache: {
        findOneAsync: async (selector: any, options: any) => {
          reads.push({ selector, options });
          return { learnerTdfConfigs: saved?.learnerTdfConfigs || { other: { overrides: { setspec: {} } } } };
        },
        upsertAsync: async (selector: any, modifier: any) => {
          expect(selector).to.deep.equal({ userId: 'enrolled-learner' });
          saved = modifier.$set;
        },
      },
    });
    return { methods, courseAssignment, reads, getSaved: () => saved };
  }

  it('saves and reads the caller settings using the course access boundary', async function() {
    const f = fixture();
    const result = await f.methods.saveLearnerTdfConfig.call({ userId: 'enrolled-learner' }, 'lesson',
      { unit: { '1': { deliverySettings: { drill: 2500 } } } }, { courseAssignment: f.courseAssignment });
    expect(result.config.overrides?.unit?.['1']?.deliverySettings?.drill).to.equal(2500);
    expect(f.getSaved().learnerTdfConfigs).to.have.property('other');
    expect(await f.methods.getLearnerTdfConfig.call({ userId: 'enrolled-learner' }, 'lesson')).to.deep.equal(result.config);
    expect(f.reads.at(-1)).to.deep.equal({ selector: { userId: 'enrolled-learner' }, options: { fields: { learnerTdfConfigs: 1 } } });
  });

  it('does not save when the shared lesson-access check denies the course context', async function() {
    const f = fixture();
    try {
      await f.methods.saveLearnerTdfConfig.call({ userId: 'enrolled-learner' }, 'lesson',
        { unit: { '1': { deliverySettings: { drill: 2500 } } } }, { courseAssignment: { assignmentId: 'unrelated' } });
      expect.fail('Expected denial');
    } catch (error: any) { expect(error.message).to.equal('Course access denied'); }
    expect(f.getSaved()).to.equal(undefined);
  });

  it('rejects unauthenticated reads and writes before accessing storage', async function() {
    const f = fixture();
    for (const call of [
      () => f.methods.getLearnerTdfConfig.call({}, 'lesson'),
      () => f.methods.saveLearnerTdfConfig.call({}, 'lesson', {}),
      () => f.methods.resetLearnerTdfConfig.call({}, 'lesson'),
    ]) {
      try { await call(); expect.fail('Expected authentication failure'); }
      catch (error: any) { expect(error.message).to.include('Must be logged in'); }
    }
    expect(f.reads).to.have.length(0);
  });

  it('returns no settings for an absent lesson or inherited object property', async function() {
    const f = fixture();
    expect(await f.methods.getLearnerTdfConfig.call({ userId: 'enrolled-learner' }, 'absent')).to.equal(null);
    expect(await f.methods.getLearnerTdfConfig.call({ userId: 'enrolled-learner' }, '__proto__')).to.equal(null);
  });
});
