import type {
  CourseAssignmentEditorSnapshot,
  CourseAssignmentSummary,
} from '../../../common/courseAssignments.contracts';

export type AssignableTdf = CourseAssignmentEditorSnapshot['assignableTdfs'][number];

export type AssignmentEditorRow = CourseAssignmentSummary & {
  fileName?: string;
  tags?: string[];
};

export function assignmentToEditorRow(
  assignment: CourseAssignmentSummary,
  tdf: AssignableTdf | undefined,
): AssignmentEditorRow {
  return {
    ...assignment,
    ...(assignment.assignmentType === 'lesson' ? {
      fileName: tdf?.fileName || '',
      tags: tdf?.tags || [],
    } : {}),
    releaseAt: assignment.releaseAt ? new Date(assignment.releaseAt) : null,
    dueAt: assignment.dueAt ? new Date(assignment.dueAt) : null,
  };
}

export function rowsFromAssignmentSnapshot(snapshot: CourseAssignmentEditorSnapshot): AssignmentEditorRow[] {
  const tdfById = new Map(snapshot.assignableTdfs.map((tdf) => [tdf.TDFId, tdf]));
  return snapshot.assignments.map((assignment, order) => ({
    ...assignmentToEditorRow(assignment, assignment.assignmentType === 'lesson' ? tdfById.get(assignment.TDFId) : undefined),
    order,
  }));
}

export function orderedRows(rows: AssignmentEditorRow[]): AssignmentEditorRow[] {
  return rows.map((row, order) => ({ ...row, order }));
}

export function validateAssignmentRows(
  rows: AssignmentEditorRow[],
  message: (key: string, values?: Record<string, unknown>) => string,
): string | null {
  const seen = new Set<string>();
  for (const row of rows) {
    const memberIds = row.assignmentType === 'lesson' ? [row.TDFId] : row.memberTdfIds;
    if (row.assignmentType === 'progressive') {
      if (!row.title.trim()) return 'Progressive assignments require a title.';
      if (row.memberTdfIds.length < 2) return `${row.title} requires at least two member lessons.`;
    }
    for (const tdfId of memberIds) {
      if (seen.has(tdfId)) return message('courseAssignments.duplicateLesson', { title: row.title });
      seen.add(tdfId);
    }
    const releaseTime = row.releaseAt ? new Date(row.releaseAt).getTime() : null;
    const dueTime = row.dueAt ? new Date(row.dueAt).getTime() : null;
    if (releaseTime !== null && !Number.isFinite(releaseTime)) {
      return message('courseAssignments.invalidVisibleDate', { title: row.title });
    }
    if (dueTime !== null && !Number.isFinite(dueTime)) {
      return message('courseAssignments.invalidDueDate', { title: row.title });
    }
    if (releaseTime !== null && dueTime !== null && dueTime < releaseTime) {
      return message('courseAssignments.dueAfterVisibleDate', { title: row.title });
    }
  }
  return null;
}

export function filterAssignableTdfs(
  assignableTdfs: AssignableTdf[],
  rows: AssignmentEditorRow[],
  query: string,
): AssignableTdf[] {
  const normalizedQuery = query.toLowerCase();
  const selected = new Set(rows.flatMap((row) => row.assignmentType === 'lesson' ? [row.TDFId] : row.memberTdfIds));
  return assignableTdfs
    .filter((tdf) => !selected.has(tdf.TDFId))
    .filter((tdf) => {
      const haystack = `${tdf.displayName} ${tdf.fileName} ${(tdf.tags || []).join(' ')}`.toLowerCase();
      return !normalizedQuery || haystack.includes(normalizedQuery);
    });
}

export function appendProgressivePackage(
  row: AssignmentEditorRow,
  rows: AssignmentEditorRow[],
  selectedPackage: CourseAssignmentEditorSnapshot['packages'][number],
  tdfs: AssignableTdf[],
): AssignmentEditorRow {
  if (row.assignmentType !== 'progressive') throw new Error('Choose a progressive assignment.');
  if (selectedPackage.blockedReason) throw new Error(selectedPackage.blockedReason);
  const ids = selectedPackage.memberTdfIds;
  if (!ids.length || ids.length !== selectedPackage.lessonCount || new Set(ids).size !== ids.length) {
    throw new Error('The complete package membership is unavailable. Reload assignments and try again.');
  }
  const selected = new Set(rows.flatMap((item) => item.assignmentType === 'lesson' ? [item.TDFId] : item.memberTdfIds));
  const byId = new Map(tdfs.map((tdf) => [tdf.TDFId, tdf]));
  for (const id of ids) {
    const tdf = byId.get(id);
    if (!tdf || !tdf.progressiveEligible) throw new Error('This package contains inaccessible or ineligible lessons.');
    if (selected.has(id)) throw new Error('A lesson from this package is already assigned in this course. Nothing was added.');
  }
  const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });
  const sorted = [...ids].sort((a, b) => {
    const left = byId.get(a)!;
    const right = byId.get(b)!;
    return collator.compare(left.displayName, right.displayName)
      || collator.compare(left.fileName, right.fileName) || a.localeCompare(b);
  });
  return { ...row, memberTdfIds: [...row.memberTdfIds, ...sorted] };
}
