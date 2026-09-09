import { Session } from 'meteor/session';
import type { CourseAssignmentHistoryContext } from '../../common/courseAssignments.contracts';

const COURSE_ASSIGNMENT_LAUNCH_CONTEXT_KEY = 'courseAssignmentLaunchContext';

function requireNonEmptyString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`[CourseLaunch] Invalid course assignment launch context: missing ${fieldName}`);
  }
  return value.trim();
}

export function readCourseAssignmentLaunchContext(value: unknown): CourseAssignmentHistoryContext | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('[CourseLaunch] Invalid course assignment launch context');
  }
  const record = value as Record<string, unknown>;
  if (record.progressiveReverseOrder !== undefined
    && (typeof record.progressiveReverseOrder !== 'boolean' || record.launchMode !== 'progressive')) {
    throw new Error('[CourseLaunch] progressiveReverseOrder requires a boolean on a progressive launch');
  }
  if (record.launchSource !== 'courses') {
    throw new Error('[CourseLaunch] Invalid course assignment launch context: launchSource must be courses');
  }
  if (record.launchMode !== 'individual' && record.launchMode !== 'progressive') {
    throw new Error('[CourseLaunch] Invalid course assignment launch context: launchMode must be individual or progressive');
  }
  const progressiveEndpointTdfId = record.launchMode === 'progressive'
    ? requireNonEmptyString(record.progressiveEndpointTdfId, 'progressiveEndpointTdfId')
    : undefined;
  if (record.launchMode === 'individual' && record.progressiveEndpointTdfId !== undefined) {
    throw new Error('[CourseLaunch] Individual launch context must not contain progressiveEndpointTdfId');
  }
  return {
    assignmentId: requireNonEmptyString(record.assignmentId, 'assignmentId'),
    courseId: requireNonEmptyString(record.courseId, 'courseId'),
    TDFId: requireNonEmptyString(record.TDFId, 'TDFId'),
    launchSource: 'courses',
    launchMode: record.launchMode,
    ...(progressiveEndpointTdfId ? {
      progressiveEndpointTdfId,
      progressiveRevisionId: requireNonEmptyString(record.progressiveRevisionId, 'progressiveRevisionId'),
      ...(record.progressiveReverseOrder !== undefined ? { progressiveReverseOrder: record.progressiveReverseOrder as boolean } : {}),
    } : {}),
  };
}

export function setCourseAssignmentLaunchContext(context: CourseAssignmentHistoryContext | null) {
  Session.set(COURSE_ASSIGNMENT_LAUNCH_CONTEXT_KEY, context);
}

export function clearCourseAssignmentLaunchContext() {
  setCourseAssignmentLaunchContext(null);
}

export function getCourseAssignmentLaunchContext(): CourseAssignmentHistoryContext | null {
  return readCourseAssignmentLaunchContext(Session.get(COURSE_ASSIGNMENT_LAUNCH_CONTEXT_KEY));
}

export function restoreCourseAssignmentLaunchContextFromState(
  experimentState: Record<string, unknown> | null | undefined,
): CourseAssignmentHistoryContext | null {
  if (
    !experimentState
    || !Object.prototype.hasOwnProperty.call(experimentState, COURSE_ASSIGNMENT_LAUNCH_CONTEXT_KEY)
  ) {
    return getCourseAssignmentLaunchContext();
  }
  const context = readCourseAssignmentLaunchContext(experimentState.courseAssignmentLaunchContext);
  setCourseAssignmentLaunchContext(context);
  return context;
}

export function courseAssignmentContextForStateWrite(params: {
  existingState?: Record<string, unknown> | null | undefined;
  partialState?: Record<string, unknown> | null | undefined;
}): CourseAssignmentHistoryContext | null {
  const partialState = params.partialState || {};
  if (Object.prototype.hasOwnProperty.call(partialState, COURSE_ASSIGNMENT_LAUNCH_CONTEXT_KEY)) {
    return readCourseAssignmentLaunchContext(partialState.courseAssignmentLaunchContext);
  }
  const activeSessionValue = Session.get(COURSE_ASSIGNMENT_LAUNCH_CONTEXT_KEY);
  if (activeSessionValue !== undefined) {
    return readCourseAssignmentLaunchContext(activeSessionValue);
  }
  return readCourseAssignmentLaunchContext(params.existingState?.courseAssignmentLaunchContext);
}

export function applyCourseAssignmentLaunchContext<T extends Record<string, unknown>>(historyRecord: T): T {
  const context = getCourseAssignmentLaunchContext();
  if (!context) return historyRecord;
  const tdfId = String(historyRecord.TDFId || '');
  const rootTdfId = String(Session.get('currentRootTdfId') || '');
  const currentTdfId = String(Session.get('currentTdfId') || rootTdfId);
  const matchesAssignedTdf = tdfId === context.TDFId;
  const matchesActiveResolvedTdf = rootTdfId === context.TDFId && tdfId === currentTdfId;
  if (context.launchMode === 'progressive') {
    if (!tdfId) throw new Error('[CourseLaunch] Progressive history record requires source TDFId');
    return {
      ...historyRecord,
      courseAssignment: {
        ...context,
        TDFId: tdfId,
      },
    };
  }
  if (!matchesAssignedTdf && !matchesActiveResolvedTdf) {
    throw new Error('[CourseLaunch] History TDFId does not match course assignment launch context');
  }
  return {
    ...historyRecord,
    courseAssignment: context,
  };
}
