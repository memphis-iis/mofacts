import type { CourseAssignmentHistoryContext } from '../../common/courseAssignments.contracts';
import type { PracticeLaunchMode } from './practiceLaunchMode';

export type LessonRouteSurface = '/content' | '/instructions';

export type LessonRouteDescriptor = {
  rootTdfId: string;
  practiceLaunchMode: PracticeLaunchMode;
  courseAssignment?: CourseAssignmentHistoryContext | null;
};

export type LessonRouteLocation = {
  path: string;
  queryParams: Record<string, string>;
};

export type LessonRouteRequest = Omit<LessonRouteDescriptor, 'courseAssignment'> & {
  courseAssignment: CourseAssignmentHistoryContext | null;
  requiresBootstrap: boolean;
};

function requireNonEmptyRouteValue(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`[Lesson Route] Missing ${fieldName}`);
  }
  return value.trim();
}

function readOptionalQueryValue(value: unknown, fieldName: string): string | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  if (typeof value !== 'string') {
    throw new Error(`[Lesson Route] Invalid ${fieldName}`);
  }
  return value.trim() || null;
}

function readPracticeLaunchMode(value: unknown): PracticeLaunchMode {
  const normalized = readOptionalQueryValue(value, 'mode');
  if (normalized === null || normalized === 'normal') {
    return 'normal';
  }
  if (normalized === 'blocks') {
    return 'blocks';
  }
  throw new Error(`[Lesson Route] Unsupported practice mode "${normalized}"`);
}

export function buildLessonRouteLocation(
  surface: LessonRouteSurface,
  descriptor: LessonRouteDescriptor,
): LessonRouteLocation {
  const rootTdfId = requireNonEmptyRouteValue(descriptor.rootTdfId, 'root TDF id');
  const queryParams: Record<string, string> = {};

  if (descriptor.practiceLaunchMode === 'blocks') {
    queryParams.mode = 'blocks';
  } else if (descriptor.practiceLaunchMode !== 'normal') {
    throw new Error(`[Lesson Route] Unsupported practice mode "${String(descriptor.practiceLaunchMode)}"`);
  }

  if (descriptor.courseAssignment) {
    if (descriptor.courseAssignment.TDFId !== rootTdfId) {
      throw new Error('[Lesson Route] Course assignment TDF does not match the route root TDF');
    }
    queryParams.courseId = requireNonEmptyRouteValue(descriptor.courseAssignment.courseId, 'course id');
    queryParams.assignmentId = requireNonEmptyRouteValue(descriptor.courseAssignment.assignmentId, 'assignment id');
    if (descriptor.courseAssignment.launchMode === 'progressive') {
      if (descriptor.courseAssignment.progressiveEndpointTdfId !== rootTdfId) {
        throw new Error('[Lesson Route] Progressive endpoint does not match the route root TDF');
      }
      queryParams.progressive = '1';
      queryParams.progressiveRevisionId = requireNonEmptyRouteValue(descriptor.courseAssignment.progressiveRevisionId, 'progressive revision');
    }
  }

  return {
    path: `${surface}/${encodeURIComponent(rootTdfId)}`,
    queryParams,
  };
}

export function resolveLessonRouteRequest(input: {
  routeTdfId: unknown;
  routeMode: unknown;
  routeCourseId: unknown;
  routeAssignmentId: unknown;
  routeProgressive?: unknown;
  routeProgressiveRevisionId?: unknown;
  activeRootTdfId: unknown;
  activeCurrentTdfId: unknown;
  activePracticeLaunchMode: PracticeLaunchMode;
  activeCourseAssignment?: CourseAssignmentHistoryContext | null;
}): LessonRouteRequest {
  const rootTdfId = requireNonEmptyRouteValue(input.routeTdfId, 'root TDF id');
  const practiceLaunchMode = readPracticeLaunchMode(input.routeMode);
  const courseId = readOptionalQueryValue(input.routeCourseId, 'course id');
  const assignmentId = readOptionalQueryValue(input.routeAssignmentId, 'assignment id');
  const progressiveValue = readOptionalQueryValue(input.routeProgressive, 'progressive');
  if (progressiveValue !== null && progressiveValue !== '1') {
    throw new Error('[Lesson Route] Progressive query value must be 1');
  }

  if (Boolean(courseId) !== Boolean(assignmentId)) {
    throw new Error('[Lesson Route] Course id and assignment id must be supplied together');
  }

  const courseAssignment: CourseAssignmentHistoryContext | null = courseId && assignmentId
    ? {
        assignmentId,
        courseId,
        TDFId: rootTdfId,
        launchSource: 'courses',
        launchMode: progressiveValue === '1' ? 'progressive' : 'individual',
        ...(progressiveValue === '1' ? {
          progressiveEndpointTdfId: rootTdfId,
          progressiveRevisionId: requireNonEmptyRouteValue(input.routeProgressiveRevisionId, 'progressive revision'),
        } : {}),
      }
    : null;
  const activeRootTdfId = typeof input.activeRootTdfId === 'string'
    ? input.activeRootTdfId.trim()
    : '';
  const activeCurrentTdfId = typeof input.activeCurrentTdfId === 'string'
    ? input.activeCurrentTdfId.trim()
    : '';
  const activeCourseAssignment = input.activeCourseAssignment ?? null;
  let courseAssignmentMatches = activeCourseAssignment === null;
  if (courseAssignment !== null) {
    courseAssignmentMatches = activeCourseAssignment !== null
      && activeCourseAssignment.assignmentId === courseAssignment.assignmentId
      && activeCourseAssignment.courseId === courseAssignment.courseId
      && activeCourseAssignment.TDFId === courseAssignment.TDFId;
    if (courseAssignmentMatches) {
      courseAssignmentMatches = activeCourseAssignment!.launchMode === courseAssignment.launchMode
        && activeCourseAssignment!.progressiveEndpointTdfId === courseAssignment.progressiveEndpointTdfId
        && activeCourseAssignment!.progressiveRevisionId === courseAssignment.progressiveRevisionId;
    }
  }

  return {
    rootTdfId,
    practiceLaunchMode,
    courseAssignment,
    requiresBootstrap:
      !activeCurrentTdfId
      || activeRootTdfId !== rootTdfId
      || input.activePracticeLaunchMode !== practiceLaunchMode
      || !courseAssignmentMatches,
  };
}

export function isLessonRoutePath(path: unknown, surface?: LessonRouteSurface): boolean {
  if (typeof path !== 'string') {
    return false;
  }
  const pathname = path.split('?')[0]?.replace(/\/+$/, '') || '';
  const surfaces = surface ? [surface] : ['/content', '/instructions'];
  return surfaces.some((candidate) => pathname.startsWith(`${candidate}/`) && pathname.length > candidate.length + 1);
}
