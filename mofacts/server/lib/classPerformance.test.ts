import { expect } from 'chai';
import { getClassPerformanceByTdfWorkflow } from './classPerformance';

describe('class performance assignment exceptions', function() {
  it('uses the exact assignment exception and ignores old formats and other assignments', async function() {
    const date = new Date('2026-09-10T12:00:00Z');
    const unrelated = [
      { tdfId: 'lesson', classId: 'course', date },
      { TDFId: 'lesson', courseId: 'course', date },
      { assignmentId: 'other', courseId: 'course', TDFId: 'lesson', date },
    ];
    for (const includeCurrent of [false, true]) {
      let queries = 0;
      const exceptions = includeCurrent ? [...unrelated, {
        assignmentId: 'target', courseId: 'course', TDFId: 'lesson', date, createdAt: date, updatedAt: date,
      }] : unrelated;
      const result = await getClassPerformanceByTdfWorkflow('course', 'lesson', 1, {
        serverConsole: () => undefined,
        Sections: { find: () => ({ fetchAsync: async () => [{ _id: 'section' }] }) },
        SectionUserMap: { find: () => ({ fetchAsync: async () => [{ userId: 'student' }] }) },
        findUsersByIds: async () => [{ _id: 'student', dueDateExceptions: exceptions as any }],
        Histories: { rawCollection: () => ({ aggregate: () => ({ toArray: async () => (
          queries++ === 0 ? [{ _id: 'student', count: 1, numCorrect: 1, totalTime: 100 }] : []
        ) }) }) },
      }, { assignmentId: 'target' });
      expect(result.flat()).to.have.length(1);
      expect(result.flat()[0]!.exception).to.equal(includeCurrent ? date.toLocaleDateString() : false);
    }
  });
});
