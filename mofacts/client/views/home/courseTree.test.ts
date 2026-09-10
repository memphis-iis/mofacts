import { expect } from 'chai';
import { buildCourseTreeRows } from './courseTree';
import type { LearnerCoursesSnapshot, LearnerCourseSnapshotAssignment } from '../../../common/courseAssignments.contracts';

function assignment(overrides: any): LearnerCourseSnapshotAssignment {
  return {
    assignmentId: overrides.assignmentId,
    courseId: overrides.courseId,
    assignmentType: 'lesson',
    TDFId: overrides.TDFId || `${overrides.assignmentId}-tdf`,
    title: overrides.title,
    order: overrides.order ?? 0,
    releaseAt: null,
    dueAt: overrides.dueAt ?? null,
    required: true,
    availability: 'available' as const,
    createdAt: null,
    updatedAt: null,
    fileName: overrides.fileName || `${overrides.title}.json`,
    tags: overrides.tags || [],
    currentStimuliSetId: null,
    progress: {
      attempts: overrides.attempts || 0,
      accuracy: null,
      accuracyApplies: false,
      itemsPracticed: null,
      itemsPracticedApplies: false,
      totalPracticeItems: null,
      sessionDays: 0,
      totalTimeMinutes: 0,
      lastPracticed: overrides.lastPracticed || null,
      lastPracticedTimestamp: overrides.lastPracticedTimestamp || 0,
    },
    isUsed: Boolean(overrides.isUsed),
    hasBeenAttempted: Boolean(overrides.isUsed),
  };
}

function snapshot(): LearnerCoursesSnapshot {
  return {
    version: 4,
    userId: 'student-1',
    generatedAt: 1,
    invalidatedAt: null,
    source: 'rebuilt',
    assignedCourses: [
      {
        courseId: 'course-b',
        courseName: 'Biology',
        visibility: 'private',
        beginDate: null,
        endDate: null,
        timezone: 'America/Chicago',
        teacherUserId: 'teacher-1',
        teacherDisplayName: 'Dr. Bee',
        membership: 'assigned',
        joinableSections: [],
        assignments: [
          assignment({ assignmentId: 'b-2', courseId: 'course-b', title: 'Cells', order: 2, dueAt: '2026-07-10T00:00:00.000Z' }),
          assignment({ assignmentId: 'b-1', courseId: 'course-b', title: 'Genetics', order: 1, dueAt: '2026-07-02T00:00:00.000Z', lastPracticedTimestamp: 30 }),
        ],
      },
      {
        courseId: 'course-a',
        courseName: 'Algebra',
        visibility: 'private',
        beginDate: null,
        endDate: null,
        timezone: 'America/Chicago',
        teacherUserId: 'teacher-2',
        teacherDisplayName: 'Dr. Al',
        membership: 'assigned',
        joinableSections: [],
        assignments: [
          assignment({ assignmentId: 'a-1', courseId: 'course-a', title: 'Linear Equations', order: 1, dueAt: '2026-07-01T00:00:00.000Z', lastPracticedTimestamp: 10 }),
        ],
      },
    ],
    publicCourses: [],
  };
}

describe('course tree rows', function() {
  it('groups assignments under sorted course rows', function() {
    const rows = buildCourseTreeRows(snapshot(), 'assignedCourses', {
      query: '',
      sort: 'course',
      expandedCourseIds: new Set(['course-b']),
    });

    expect(rows.map((row) => row.courseName)).to.deep.equal(['Algebra', 'Biology']);
    const biology = rows[1];
    if (!biology) throw new Error('Expected Biology row');
    expect(biology.expanded).to.equal(true);
    expect(biology.assignments.map((row) => row.title)).to.deep.equal(['Genetics', 'Cells']);
  });

  it('auto-expands courses when search reveals assignment matches', function() {
    const rows = buildCourseTreeRows(snapshot(), 'assignedCourses', {
      query: 'cells',
      sort: 'course',
      expandedCourseIds: new Set(),
    });

    expect(rows).to.have.length(1);
    const row = rows[0];
    if (!row) throw new Error('Expected search result row');
    expect(row.courseName).to.equal('Biology');
    expect(row.expanded).to.equal(true);
    expect(row.assignmentCountLabel).to.equal('1 assignment shown of 2');
    expect(row.assignments.map((assignmentRow) => assignmentRow.title)).to.deep.equal(['Cells']);
  });

  it('shows all assignments when the course itself matches search', function() {
    const rows = buildCourseTreeRows(snapshot(), 'assignedCourses', {
      query: 'biology',
      sort: 'course',
      expandedCourseIds: new Set(),
    });

    expect(rows).to.have.length(1);
    const row = rows[0];
    if (!row) throw new Error('Expected course search result row');
    expect(row.assignments.map((assignmentRow) => assignmentRow.title)).to.deep.equal(['Genetics', 'Cells']);
  });

  it('sorts parent courses by nearest due date and latest practice', function() {
    const dueRows = buildCourseTreeRows(snapshot(), 'assignedCourses', {
      query: '',
      sort: 'due',
      expandedCourseIds: new Set(),
    });
    const recentRows = buildCourseTreeRows(snapshot(), 'assignedCourses', {
      query: '',
      sort: 'recent',
      expandedCourseIds: new Set(),
    });

    expect(dueRows.map((row) => row.courseName)).to.deep.equal(['Algebra', 'Biology']);
    expect(recentRows.map((row) => row.courseName)).to.deep.equal(['Biology', 'Algebra']);
  });

  it('expands progressive groups into ordered member rows with member-only progress', function() {
    const data = snapshot();
    const biology = data.assignedCourses[0]!;
    const first = assignment({ assignmentId: 'p-first', courseId: biology.courseId, TDFId: 'tdf-first', title: 'First', attempts: 4 });
    const second = assignment({ assignmentId: 'p-second', courseId: biology.courseId, TDFId: 'tdf-second', title: 'Second', attempts: 7 });
    biology.assignments = [{
      assignmentId: 'progressive-1',
      courseId: biology.courseId,
      assignmentType: 'progressive',
      title: 'Cumulative review',
      memberTdfIds: ['tdf-first', 'tdf-second'],
      members: [first, second].map((member: any) => ({
        TDFId: member.TDFId,
        title: member.title,
        fileName: member.fileName,
        tags: member.tags,
        currentStimuliSetId: member.currentStimuliSetId,
        hasConfigurableSettings: true,
        progress: member.progress,
        isUsed: member.isUsed,
        hasBeenAttempted: member.hasBeenAttempted,
      })),
      order: 0,
      releaseAt: null,
      dueAt: null,
      required: true,
      availability: 'available',
      createdAt: null,
      updatedAt: null,
    }];

    const rows = buildCourseTreeRows(data, 'assignedCourses', {
      query: '',
      sort: 'course',
      expandedCourseIds: new Set([biology.courseId]),
    });
    const result = rows.find((row) => row.courseId === biology.courseId)!;
    expect(result.assignmentCount).to.equal(2);
    expect(result.assignments.map((row) => row.hasConfigurableSettings)).to.deep.equal([true, true]);
    expect(result.assignments.map((row) => [row.title, row.progress.attempts, row.progressiveMemberIndex])).to.deep.equal([
      ['First', 4, 0],
      ['Second', 7, 1],
    ]);
  });
});
