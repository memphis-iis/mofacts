import type { PracticeDashboardProgressStats } from '../server/methods/dashboardCacheMethods.contracts';

export type CourseVisibility = 'private' | 'public';
export type CourseAssignmentAvailability = 'available' | 'scheduled' | 'unavailable';
export type CourseAssignmentType = 'lesson' | 'progressive';

export interface DueDateException {
  assignmentId: string;
  courseId: string;
  TDFId: string;
  date: string | number | Date;
  createdAt: Date;
  updatedAt: Date;
}

interface CourseAssignmentInputBase {
  assignmentId?: string;
  order: number;
  releaseAt?: string | Date | null;
  dueAt?: string | Date | null;
  required: boolean;
}

export interface LessonCourseAssignmentInput extends CourseAssignmentInputBase {
  assignmentType: 'lesson';
  TDFId: string;
}

export interface ProgressiveCourseAssignmentInput extends CourseAssignmentInputBase {
  assignmentType: 'progressive';
  title: string;
  memberTdfIds: string[];
}

export type CourseAssignmentInput = LessonCourseAssignmentInput | ProgressiveCourseAssignmentInput;

export interface SaveCourseAssignmentsInput {
  courseId: string;
  assignments: CourseAssignmentInput[];
}

export interface CourseAssignmentTdfSummary {
  TDFId: string;
  title: string;
  fileName: string;
  tags: string[];
  currentStimuliSetId: string | number | null;
  contentLanguage?: string;
  recommendedUiLocales?: string[];
  translationStatus?: string;
}

interface CourseAssignmentSummaryBase {
  assignmentId: string;
  courseId: string;
  assignmentType: CourseAssignmentType;
  title: string;
  order: number;
  releaseAt: Date | null;
  dueAt: Date | null;
  required: boolean;
  availability: CourseAssignmentAvailability;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface LessonCourseAssignmentSummary extends CourseAssignmentSummaryBase {
  assignmentType: 'lesson';
  TDFId: string;
  contentLanguage?: string;
  recommendedUiLocales?: string[];
  translationStatus?: string;
}

export interface ProgressiveCourseAssignmentSummary extends CourseAssignmentSummaryBase {
  assignmentType: 'progressive';
  memberTdfIds: string[];
  members: CourseAssignmentTdfSummary[];
}

export type CourseAssignmentSummary = LessonCourseAssignmentSummary | ProgressiveCourseAssignmentSummary;

export interface LearnerCourseSnapshotLessonAssignment extends LessonCourseAssignmentSummary {
  fileName: string;
  tags: string[];
  currentStimuliSetId: string | number | null;
  progress: PracticeDashboardProgressStats;
  isUsed: boolean;
  hasBeenAttempted: boolean;
}

export interface LearnerProgressiveAssignmentMember extends CourseAssignmentTdfSummary {
  progress: PracticeDashboardProgressStats;
  isUsed: boolean;
  hasBeenAttempted: boolean;
}

export interface LearnerCourseSnapshotProgressiveAssignment extends ProgressiveCourseAssignmentSummary {
  members: LearnerProgressiveAssignmentMember[];
}

export type LearnerCourseSnapshotAssignment =
  | LearnerCourseSnapshotLessonAssignment
  | LearnerCourseSnapshotProgressiveAssignment;

export interface LearnerCourseSnapshotCourse {
  courseId: string;
  courseName: string;
  visibility: CourseVisibility;
  beginDate: Date | null;
  endDate: Date | null;
  timezone: string;
  teacherUserId: string;
  teacherDisplayName: string;
  membership: 'assigned' | 'public' | 'teacher' | 'admin';
  joinableSections: Array<{
    sectionId: string;
    sectionName: string;
  }>;
  assignments: LearnerCourseSnapshotAssignment[];
}

export interface LearnerCoursesSnapshot {
  version: 3;
  userId: string;
  generatedAt: number;
  assignedCourses: LearnerCourseSnapshotCourse[];
  publicCourses: LearnerCourseSnapshotCourse[];
  invalidatedAt: Date | null;
  source: 'cache' | 'rebuilt';
}

export interface CourseAssignmentPackage {
  packageAssetId: string;
  fileName: string;
  lessonCount: number;
  memberTdfIds: string[];
  blockedReason: string | null;
}

export interface CourseAssignmentEditorSnapshot {
  packages: CourseAssignmentPackage[];
  course: {
    courseId: string;
    courseName: string;
    visibility: CourseVisibility;
    teacherUserId: string;
    timezone: string;
  };
  assignments: CourseAssignmentSummary[];
  assignableTdfs: Array<CourseAssignmentTdfSummary & {
    displayName: string;
    ownerId: string;
    progressiveEligible: boolean;
    progressiveIneligibilityReasons: string[];
  }>;
}

export interface CourseAssignmentHistoryContext {
  assignmentId: string;
  courseId: string;
  TDFId: string;
  launchSource: 'courses';
  launchMode: 'individual' | 'progressive';
  progressiveEndpointTdfId?: string;
  progressiveRevisionId?: string;
  /** Presentation order only; omitted/false keeps the authored prefix order. */
  progressiveReverseOrder?: boolean;
}

export interface ProgressiveAssignmentLaunchPayload {
  progressiveRevisionId: string;
  assignmentId: string;
  courseId: string;
  title: string;
  endpointTdfId: string;
  memberTdfIds: string[];
  tdfs: any[];
}
