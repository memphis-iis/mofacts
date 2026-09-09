import { expect } from 'chai';
import {
  appendProgressivePackage,
  filterAssignableTdfs,
  orderedRows,
  rowsFromAssignmentSnapshot,
  validateAssignmentRows,
  type AssignmentEditorRow,
} from './tdfAssignmentEditState';

function message(key: string, values?: Record<string, unknown>): string {
  return `${key}:${String(values?.title || '')}`;
}

function assignmentRow(
  overrides: Partial<Extract<AssignmentEditorRow, { assignmentType: 'lesson' }>> & { TDFId: string },
): AssignmentEditorRow {
  const { TDFId, ...rest } = overrides;
  return {
    assignmentId: `assignment-${TDFId}`,
    courseId: 'course-1',
    assignmentType: 'lesson',
    TDFId,
    title: 'Lesson',
    order: 0,
    releaseAt: null,
    dueAt: null,
    required: true,
    availability: 'available',
    createdAt: null,
    updatedAt: null,
    fileName: '',
    tags: [],
    ...rest,
  };
}

describe('tdfAssignmentEditState', function() {
  it('shapes assignment snapshots into editable rows', function() {
    const rows = rowsFromAssignmentSnapshot({
      packages: [],
      course: { courseId: 'course-1', timezone: 'America/Chicago' } as any,
      assignableTdfs: [{ TDFId: 'tdf-1', fileName: 'lesson.xml', tags: ['math'] }] as any,
      assignments: [{
        assignmentId: 'assignment-1',
        courseId: 'course-1',
        assignmentType: 'lesson',
        TDFId: 'tdf-1',
        title: 'Lesson',
        order: 7,
        releaseAt: '2026-01-02T03:04:00.000Z',
        dueAt: null,
        required: true,
        availability: 'available',
        createdAt: null,
        updatedAt: null,
      }] as any,
    });

    expect(rows[0]).to.include({
      assignmentId: 'assignment-1',
      fileName: 'lesson.xml',
      order: 0,
    });
    expect(rows[0]?.tags).to.deep.equal(['math']);
    expect(rows[0]?.releaseAt).to.be.instanceOf(Date);
  });

  it('filters assignable TDFs by selected rows and query', function() {
    const rows = [assignmentRow({ TDFId: 'tdf-selected' })];
    const result = filterAssignableTdfs([
      { TDFId: 'tdf-selected', displayName: 'Selected', fileName: 'selected.xml', tags: [] },
      { TDFId: 'tdf-match', displayName: 'Algebra', fileName: 'lesson.xml', tags: ['fractions'] },
      { TDFId: 'tdf-miss', displayName: 'Geometry', fileName: 'shape.xml', tags: [] },
    ] as any, rows, 'frac');

    expect(result.map((tdf) => tdf.TDFId)).to.deep.equal(['tdf-match']);
  });

  it('renumbers rows and validates duplicate/date errors', function() {
    const rows = orderedRows([
      assignmentRow({
        TDFId: 'tdf-1',
        title: 'Lesson',
        releaseAt: new Date('2026-01-02T10:00:00.000Z'),
        dueAt: new Date('2026-01-01T10:00:00.000Z'),
      }),
    ]);
    expect(rows[0]?.order).to.equal(0);
    expect(validateAssignmentRows(rows, message)).to.equal('courseAssignments.dueAfterVisibleDate:Lesson');

    const duplicateRows = [
      assignmentRow({ TDFId: 'tdf-1', title: 'A' }),
      assignmentRow({ TDFId: 'tdf-1', title: 'B' }),
    ];
    expect(validateAssignmentRows(duplicateRows, message)).to.equal('courseAssignments.duplicateLesson:B');
  });

  it('requires two progressive members and prevents reuse across assignment types', function() {
    const progressive = {
      assignmentId: 'progressive-1',
      courseId: 'course-1',
      assignmentType: 'progressive' as const,
      title: 'Cumulative review',
      memberTdfIds: ['tdf-1'],
      members: [],
      order: 0,
      releaseAt: null,
      dueAt: null,
      required: true,
      availability: 'available' as const,
      createdAt: null,
      updatedAt: null,
    };
    expect(validateAssignmentRows([progressive], message)).to.equal('Cumulative review requires at least two member lessons.');

    const twoMembers = { ...progressive, memberTdfIds: ['tdf-1', 'tdf-2'] };
    expect(validateAssignmentRows([twoMembers, assignmentRow({ TDFId: 'tdf-2', title: 'Repeated' })], message))
      .to.equal('courseAssignments.duplicateLesson:Repeated');
  });
});


describe('progressive package addition', function() {
  const row = { assignmentType: 'progressive', memberTdfIds: ['existing'], title: 'Stats' } as AssignmentEditorRow;
  const lessons = Array.from({ length: 34 }, (_, index) => ({
    TDFId: `u${index + 1}`, displayName: `Unit ${index + 1}`, fileName: `${index + 1}.json`, progressiveEligible: true,
  }));
  const batch = { packageAssetId: 'zip-1', fileName: 'stats.zip', lessonCount: 34,
    memberTdfIds: lessons.map((lesson) => lesson.TDFId).reverse(), blockedReason: null };

  it('appends all 34 in natural order, preserving existing order and excluding unrelated lessons', function() {
    const updated = appendProgressivePackage(row, [row], batch, [...lessons,
      { TDFId: 'unrelated', displayName: 'Unit 0', fileName: 'other.json', progressiveEligible: true }] as any);
    expect(updated.assignmentType === 'progressive' && updated.memberTdfIds)
      .to.deep.equal(['existing', ...lessons.map((lesson) => lesson.TDFId)]);
    expect(row.assignmentType === 'progressive' && row.memberTdfIds).to.deep.equal(['existing']);
  });

  it('rejects duplicates anywhere in the draft without changing any members', function() {
    expect(() => appendProgressivePackage(row, [row, assignmentRow({ TDFId: 'u20' })], batch, lessons as any))
      .to.throw('already assigned');
    expect(row.assignmentType === 'progressive' && row.memberTdfIds).to.deep.equal(['existing']);
  });

  it('rejects inaccessible, ineligible, incomplete, and blocked packages as whole batches', function() {
    expect(() => appendProgressivePackage(row, [row], batch, lessons.slice(1) as any)).to.throw('inaccessible');
    expect(() => appendProgressivePackage(row, [row], batch,
      lessons.map((lesson) => ({ ...lesson, progressiveEligible: lesson.TDFId !== 'u20' })) as any)).to.throw('ineligible');
    expect(() => appendProgressivePackage(row, [row], { ...batch, lessonCount: 35 }, lessons as any)).to.throw('complete package');
    expect(() => appendProgressivePackage(row, [row], { ...batch, blockedReason: 'No access' }, lessons as any)).to.throw('No access');
  });
});
