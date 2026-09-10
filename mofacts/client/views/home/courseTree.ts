import type {
  LearnerCourseSnapshotAssignment,
  LearnerCourseSnapshotLessonAssignment,
  LearnerCourseSnapshotCourse,
  LearnerCoursesSnapshot,
} from '../../../common/courseAssignments.contracts';

export type CourseTreeSection = 'assignedCourses' | 'publicCourses';
export type CourseTreeSort = 'course' | 'due' | 'recent';

export type CourseAssignmentDisplayRow = Omit<LearnerCourseSnapshotLessonAssignment, 'assignmentType'> & {
  assignmentType: 'lesson' | 'progressive';
  progressiveGroupTitle?: string;
  progressiveMemberIndex?: number;
  progressiveMemberCount?: number;
  rowType: 'assignment';
  rowId: string;
  parentRowId: string;
  courseName: string;
  teacherDisplayName: string;
  visibility: LearnerCourseSnapshotCourse['visibility'];
  beginDate: LearnerCourseSnapshotCourse['beginDate'];
  endDate: LearnerCourseSnapshotCourse['endDate'];
  timezone: string;
  membership: LearnerCourseSnapshotCourse['membership'];
};

export type CourseTreeCourseRow = Omit<LearnerCourseSnapshotCourse, 'assignments'> & {
  rowType: 'course';
  rowId: string;
  section: CourseTreeSection;
  expanded: boolean;
  assignmentCount: number;
  visibleAssignmentCount: number;
  assignmentCountLabel: string;
  assignments: CourseAssignmentDisplayRow[];
};

export type BuildCourseTreeOptions = {
  query: string;
  sort: CourseTreeSort;
  expandedCourseIds: Set<string>;
};

const FAR_FUTURE = 8640000000000000;

function normalizeQuery(query: string) {
  return query.trim().toLowerCase();
}

function courseSearchText(course: LearnerCourseSnapshotCourse) {
  return `${course.courseName} ${course.teacherDisplayName} ${course.membership} ${course.timezone}`.toLowerCase();
}

function assignmentSearchText(assignment: LearnerCourseSnapshotAssignment) {
  const members = assignment.assignmentType === 'progressive' ? assignment.members : [];
  return [
    assignment.title,
    ...members.flatMap((member) => [member.title, member.fileName, ...(member.tags || [])]),
    ...(assignment.assignmentType === 'lesson' ? [
      assignment.fileName,
      (assignment.tags || []).join(' '),
      assignment.contentLanguage || '',
      (assignment.recommendedUiLocales || []).join(' '),
      assignment.translationStatus || '',
    ] : []),
  ].join(' ').toLowerCase();
}

function assignmentDisplayRows(
  assignment: LearnerCourseSnapshotAssignment,
  course: LearnerCourseSnapshotCourse,
  parentRowId: string,
): CourseAssignmentDisplayRow[] {
  const courseFields = {
    rowType: 'assignment' as const,
    parentRowId,
    courseName: course.courseName,
    teacherDisplayName: course.teacherDisplayName,
    visibility: course.visibility,
    beginDate: course.beginDate,
    endDate: course.endDate,
    timezone: course.timezone,
    membership: course.membership,
  };
  if (assignment.assignmentType === 'lesson') {
    return [{
      ...assignment,
      ...courseFields,
      rowId: `${parentRowId}-assignment-${assignment.assignmentId}`,
    }];
  }
  return assignment.members.map((member, memberIndex) => ({
    assignmentId: assignment.assignmentId,
    courseId: assignment.courseId,
    assignmentType: 'progressive' as const,
    progressiveGroupTitle: assignment.title,
    progressiveMemberIndex: memberIndex,
    progressiveMemberCount: assignment.members.length,
    TDFId: member.TDFId,
    title: member.title,
    fileName: member.fileName,
    tags: member.tags,
    currentStimuliSetId: member.currentStimuliSetId,
    hasConfigurableSettings: member.hasConfigurableSettings === true,
    ...(member.contentLanguage !== undefined ? { contentLanguage: member.contentLanguage } : {}),
    ...(member.recommendedUiLocales !== undefined ? { recommendedUiLocales: member.recommendedUiLocales } : {}),
    ...(member.translationStatus !== undefined ? { translationStatus: member.translationStatus } : {}),
    progress: member.progress,
    isUsed: member.isUsed,
    hasBeenAttempted: member.hasBeenAttempted,
    order: assignment.order,
    releaseAt: assignment.releaseAt,
    dueAt: assignment.dueAt,
    required: assignment.required,
    availability: assignment.availability,
    createdAt: assignment.createdAt,
    updatedAt: assignment.updatedAt,
    ...courseFields,
    rowId: `${parentRowId}-assignment-${assignment.assignmentId}-member-${member.TDFId}`,
  }));
}

function dateTime(value: unknown, emptyValue: number) {
  if (!value) return emptyValue;
  const time = new Date(value as string | number | Date).getTime();
  return Number.isFinite(time) ? time : emptyValue;
}

function nearestDueTime(assignments: CourseAssignmentDisplayRow[]) {
  return assignments.reduce((nearest, assignment) => Math.min(nearest, dateTime(assignment.dueAt, FAR_FUTURE)), FAR_FUTURE);
}

function latestPracticeTime(assignments: CourseAssignmentDisplayRow[]) {
  return assignments.reduce((latest, assignment) => Math.max(latest, Number(assignment.progress?.lastPracticedTimestamp || 0)), 0);
}

function assignmentCountLabel(visibleAssignmentCount: number, assignmentCount: number, query: string) {
  const visibleLabel = `${visibleAssignmentCount} assignment${visibleAssignmentCount === 1 ? '' : 's'}`;
  if (query && visibleAssignmentCount !== assignmentCount) {
    return `${visibleLabel} shown of ${assignmentCount}`;
  }
  return visibleLabel;
}

export function normalizeCourseTreeSort(value: string): CourseTreeSort {
  return value === 'due' || value === 'recent' ? value : 'course';
}

export function buildCourseTreeRows(
  snapshot: LearnerCoursesSnapshot | null,
  section: CourseTreeSection,
  options: BuildCourseTreeOptions,
): CourseTreeCourseRow[] {
  const query = normalizeQuery(options.query);
  const courses = snapshot?.[section] || [];
  const rows = courses.flatMap((course): CourseTreeCourseRow[] => {
    const courseMatches = Boolean(query && courseSearchText(course).includes(query));
    const assignmentCount = course.assignments.reduce(
      (count, assignment) => count + (assignment.assignmentType === 'progressive' ? assignment.members.length : 1),
      0,
    );
    const visibleAssignments = course.assignments
      .filter((assignment) => !query || courseMatches || assignmentSearchText(assignment).includes(query))
      .flatMap((assignment) => assignmentDisplayRows(assignment, course, `course-tree-${section}-${course.courseId}`))
      .sort((a, b) => a.order - b.order
        || Number(a.progressiveMemberIndex ?? -1) - Number(b.progressiveMemberIndex ?? -1)
        || a.title.localeCompare(b.title));

    if (query && !courseMatches && visibleAssignments.length === 0) {
      return [];
    }

    const rowId = `course-tree-${section}-${course.courseId}`;
    return [{
      rowType: 'course',
      rowId,
      section,
      courseId: course.courseId,
      courseName: course.courseName,
      visibility: course.visibility,
      beginDate: course.beginDate,
      endDate: course.endDate,
      timezone: course.timezone,
      teacherUserId: course.teacherUserId,
      teacherDisplayName: course.teacherDisplayName,
      membership: course.membership,
      joinableSections: course.joinableSections || [],
      expanded: Boolean(query) || options.expandedCourseIds.has(course.courseId),
      assignmentCount,
      visibleAssignmentCount: visibleAssignments.length,
      assignmentCountLabel: assignmentCountLabel(visibleAssignments.length, assignmentCount, query),
      assignments: visibleAssignments,
    }];
  });

  return rows.sort((a, b) => {
    if (options.sort === 'due') {
      return nearestDueTime(a.assignments) - nearestDueTime(b.assignments) || a.courseName.localeCompare(b.courseName);
    }
    if (options.sort === 'recent') {
      return latestPracticeTime(b.assignments) - latestPracticeTime(a.assignments) || a.courseName.localeCompare(b.courseName);
    }
    return a.courseName.localeCompare(b.courseName);
  });
}
