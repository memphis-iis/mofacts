import { Meteor } from 'meteor/meteor';
import { progressiveRevisionId, progressiveRevisionPrefix } from '../lib/progressiveAssignmentRevision';
import type { DueDateException } from '../../common/courseAssignments.contracts';
import { ensurePublishedDeploymentBrandProfile } from '../lib/deploymentBrandProfileRegistry';
import { curSemester } from '../../common/Definitions';
import { unitHasConfigurableRuntime } from '../../common/lib/learnerTdfConfig';
import type {
  CourseAssignmentEditorSnapshot,
  CourseAssignmentAvailability,
  CourseAssignmentSummary,
  CourseAssignmentTdfSummary,
  CourseVisibility,
  LearnerCoursesSnapshot,
  ProgressiveAssignmentLaunchPayload,
  SaveCourseAssignmentsInput,
} from '../../common/courseAssignments.contracts';
import {
  assignmentMemberTdfIds,
  MIN_PROGRESSIVE_MEMBERS,
  progressiveTdfIneligibilityReasons,
} from '../../common/progressiveAssignments';
import { getCourse } from '../orm';
import { normalizeOptionalString } from './dashboardCacheShared';
import {
  getUserRoleFlags,
  requireAuthenticatedUser,
  requireUserMatchesOrHasRole,
  requireUserWithRoles,
  type MethodAuthorizationDeps,
} from '../lib/methodAuthorization';
import { createCourseLearnerSnapshotCacheHelpers } from '../lib/courseLearnerSnapshotCache';
import { prepareStimuliSetForRuntime } from '../lib/stimulusLookup';

type UnknownRecord = Record<string, unknown>;
type Logger = (...args: unknown[]) => void;
type MethodContext = {
  userId?: string | null;
  unblock?: () => void;
  connection?: { id?: string; clientAddress?: string | null } | null;
};
const MAX_ASSIGNMENTS_PER_COURSE = 250;
const DEFAULT_COURSE_TIMEZONE = 'America/Chicago';
const DEFAULT_COURSE_SECTION_NAME = '001';

type Cursor<T = any> = {
  fetchAsync: () => Promise<T[]>;
  countAsync?: () => Promise<number>;
};

type CollectionLike = {
  find: (selector?: UnknownRecord, options?: UnknownRecord) => Cursor;
  findOneAsync: (selector: UnknownRecord, options?: UnknownRecord) => Promise<any>;
  insertAsync: (document: UnknownRecord) => Promise<unknown>;
  updateAsync: (selector: UnknownRecord, modifier: UnknownRecord, options?: UnknownRecord) => Promise<unknown>;
  removeAsync: (selector: UnknownRecord) => Promise<unknown>;
  rawCollection: () => { aggregate: (pipeline: unknown[]) => { toArray: () => Promise<any[]> } };
};

type CourseMethodsDeps = {
  serverConsole: Logger;
  Courses: CollectionLike;
  Sections: CollectionLike;
  SectionUserMap: CollectionLike;
  Assignments: CollectionLike;
  Tdfs: CollectionLike;
  DynamicAssets: Pick<CollectionLike, 'findOneAsync'>;
  UserDashboardCache?: CollectionLike;
  CourseLearnerSnapshotCache?: CollectionLike;
  Histories: {
    findOneAsync: (selector: UnknownRecord, options?: UnknownRecord) => Promise<any>;
  };
  itemSourceSentences: {
    find: (selector: UnknownRecord, options?: UnknownRecord) => any;
  };
  usersCollection: {
    find: (selector: UnknownRecord, options?: UnknownRecord) => Cursor;
    findOneAsync: (selector: UnknownRecord, options?: UnknownRecord) => Promise<any>;
    updateAsync: (selector: UnknownRecord, modifier: UnknownRecord, options?: UnknownRecord) => Promise<unknown>;
  };
  sendEmail: (to: string, from: string, subject: string, text: string) => void;
  emailFrom: string;
  thisServerUrl: string;
  getMethodAuthorizationDeps: () => MethodAuthorizationDeps;
  getUserDisplayIdentifier: (user: any) => string;
  normalizeCanonicalId: (value: unknown) => string | null;
  removeRuntimeTdfSecrets: <T>(tdf: T) => T;
};

function normalizeCourseVisibility(value: unknown): CourseVisibility {
  if (value === undefined || value === null || value === '') return 'private';
  if (value === 'private' || value === 'public') return value;
  throw new Meteor.Error(400, 'Course visibility must be private or public');
}

function normalizeCourseSections(value: unknown): string[] {
  const sections = Array.isArray(value)
    ? value.map((section) => String(section || '').trim()).filter(Boolean)
    : [];
  return sections.length > 0 ? sections : [DEFAULT_COURSE_SECTION_NAME];
}

function normalizeCourseName(value: unknown): string {
  return String(value || '').trim();
}

function assertKnownFields(payload: UnknownRecord, allowedFields: string[], label: string) {
  const allowed = new Set(allowedFields);
  for (const key of Object.keys(payload)) {
    if (!allowed.has(key)) {
      throw new Meteor.Error(400, `${label} contains unknown field: ${key}`);
    }
  }
}

function normalizeTimezone(value: unknown, allowLegacyDefault = false): string {
  const timezone = typeof value === 'string' ? value.trim() : '';
  if (!timezone) {
    if (allowLegacyDefault) return DEFAULT_COURSE_TIMEZONE;
    throw new Meteor.Error(400, 'Course timezone is required');
  }
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date());
  } catch {
    throw new Meteor.Error(400, 'Course timezone must be a valid IANA timezone');
  }
  return timezone;
}

function localDateTimeToUtcIso(value: string, timezone: string): string {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:T|\s)(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return value;
  const [, year, month, day, hour, minute, second = '00'] = match;
  const utcGuess = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second));
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(utcGuess));
  const partValue = (type: string) => Number(parts.find((part) => part.type === type)?.value || 0);
  const zonedAsUtc = Date.UTC(partValue('year'), partValue('month') - 1, partValue('day'), partValue('hour'), partValue('minute'), partValue('second'));
  return new Date(utcGuess - (zonedAsUtc - utcGuess)).toISOString();
}

function parseDateLike(value: unknown, fieldName: string, timezone: string): Date | null {
  if (value === undefined || value === null || value === '') return null;
  if (Array.isArray(value) || (typeof value === 'object' && !(value instanceof Date))) {
    throw new Meteor.Error(400, `${fieldName} must be a date string, Date, or null`);
  }
  if (value instanceof Date) {
    if (!Number.isFinite(value.getTime())) throw new Meteor.Error(400, `${fieldName} is invalid`);
    return value;
  }
  if (typeof value !== 'string' && typeof value !== 'number') {
    throw new Meteor.Error(400, `${fieldName} must be a date string, Date, or null`);
  }
  const raw = String(value).trim();
  if (!raw) return null;
  const hasExplicitZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(raw);
  const date = new Date(hasExplicitZone ? raw : localDateTimeToUtcIso(raw, timezone));
  if (!Number.isFinite(date.getTime())) throw new Meteor.Error(400, `${fieldName} is invalid`);
  return date;
}

function parseNullablePersistedDate(value: unknown): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value as string | number);
  return Number.isFinite(date.getTime()) ? date : null;
}

function normalizeCourseDates(payload: UnknownRecord, existingCourse?: any) {
  const timezone = normalizeTimezone(payload.timezone ?? existingCourse?.timezone, !!existingCourse);
  const beginDate = parseDateLike(payload.beginDate ?? existingCourse?.beginDate ?? null, 'Course begin date', timezone);
  const endDate = parseDateLike(payload.endDate ?? existingCourse?.endDate ?? null, 'Course end date', timezone);
  if (beginDate && endDate && endDate.getTime() < beginDate.getTime()) {
    throw new Meteor.Error(400, 'Course end date must be on or after begin date');
  }
  return { timezone, beginDate, endDate };
}

function getTdfSummary(tdf: any) {
  const setspec = tdf?.content?.tdfs?.tutor?.setspec || {};
  const fileName = normalizeOptionalString(tdf?.content?.fileName) || normalizeOptionalString(tdf?.tdfFileName) || String(tdf?._id || '');
  const displayName = normalizeOptionalString(setspec.lessonname) || fileName;
  const contentLanguage = normalizeOptionalString(setspec.contentLanguage) || '';
  const recommendedUiLocales = Array.isArray(setspec.recommendedUiLocales)
    ? setspec.recommendedUiLocales.map((locale: unknown) => normalizeOptionalString(locale)).filter(Boolean)
    : [];
  const translationStatus = normalizeOptionalString(setspec.translationStatus) || '';
  return {
    TDFId: String(tdf?._id || ''),
    fileName,
    displayName,
    title: displayName,
    tags: Array.isArray(setspec.tags) ? setspec.tags : [],
    contentLanguage,
    recommendedUiLocales,
    translationStatus,
    currentStimuliSetId: tdf?.stimuliSetId ?? null,
    hasConfigurableSettings: (tdf?.content?.tdfs?.tutor?.unit || []).some(unitHasConfigurableRuntime),
    ownerId: String(tdf?.ownerId || ''),
    isMultiTdf: Boolean(tdf?.content?.isMultiTdf),
  };
}

function getPrimaryUserEmail(user: any): string | null {
  const canonical = normalizeOptionalString(user?.email_canonical);
  if (canonical) return canonical;
  const firstEmail = Array.isArray(user?.emails)
    ? normalizeOptionalString(user.emails.find((email: any) => normalizeOptionalString(email?.address))?.address)
    : null;
  return firstEmail;
}

function normalizeAssignmentRow(
  row: any,
  index: number,
  tdfSummaryById: Map<string, CourseAssignmentTdfSummary>,
  now = new Date(),
): CourseAssignmentSummary | null {
  const assignmentId = normalizeOptionalString(row?._id);
  const courseId = normalizeOptionalString(row?.courseId);
  const assignmentType = row?.assignmentType;
  if (!assignmentId || !courseId || (assignmentType !== 'lesson' && assignmentType !== 'progressive')) return null;
  const releaseAt = parseNullablePersistedDate(row?.releaseAt);
  const rawOrder = Number(row?.order);
  const base = {
    assignmentId,
    courseId,
    assignmentType,
    title: '',
    order: Number.isInteger(rawOrder) && rawOrder >= 0 ? rawOrder : index,
    releaseAt,
    dueAt: parseNullablePersistedDate(row?.dueAt),
    required: row?.required !== false,
    availability: (releaseAt && releaseAt.getTime() > now.getTime() ? 'scheduled' : 'available') as CourseAssignmentAvailability,
    createdAt: parseNullablePersistedDate(row?.createdAt),
    updatedAt: parseNullablePersistedDate(row?.updatedAt),
  };
  if (assignmentType === 'lesson') {
    const TDFId = normalizeOptionalString(row?.TDFId);
    if (!TDFId) return null;
    return {
      ...base,
      assignmentType: 'lesson',
      TDFId,
      title: tdfSummaryById.get(TDFId)?.title || TDFId,
    };
  }
  const memberTdfIds = assignmentMemberTdfIds(row);
  const title = normalizeOptionalString(row?.title);
  if (!title || memberTdfIds.length < MIN_PROGRESSIVE_MEMBERS) return null;
  const members = memberTdfIds.map((tdfId) => tdfSummaryById.get(tdfId)).filter((summary): summary is CourseAssignmentTdfSummary => !!summary);
  if (members.length !== memberTdfIds.length) return null;
  return {
    ...base,
    assignmentType: 'progressive',
    title,
    memberTdfIds,
    members,
  };
}

function assignmentLanguageMetadata(summary: {
  contentLanguage?: string;
  recommendedUiLocales?: string[];
  translationStatus?: string;
}): { contentLanguage?: string; recommendedUiLocales?: string[]; translationStatus?: string } {
  const metadata: { contentLanguage?: string; recommendedUiLocales?: string[]; translationStatus?: string } = {};
  if (typeof summary.contentLanguage === 'string') {
    metadata.contentLanguage = summary.contentLanguage;
  }
  if (Array.isArray(summary.recommendedUiLocales)) {
    metadata.recommendedUiLocales = summary.recommendedUiLocales;
  }
  if (typeof summary.translationStatus === 'string') {
    metadata.translationStatus = summary.translationStatus;
  }
  return metadata;
}

function normalizeCourseDocumentForRead<T extends Record<string, any>>(course: T): T & {
  visibility: CourseVisibility;
  beginDate: Date | null;
  endDate: Date | null;
  timezone: string;
} {
  return {
    ...course,
    visibility: normalizeCourseVisibility(course?.visibility),
    beginDate: parseNullablePersistedDate(course?.beginDate),
    endDate: parseNullablePersistedDate(course?.endDate),
    timezone: normalizeTimezone(course?.timezone, true),
  };
}

function getSetAMinusB<T>(arrayA: T[], arrayB: T[]) {
  const a = new Set(arrayA);
  const b = new Set(arrayB);
  const difference = new Set([...a].filter((x) => !b.has(x)));
  return Array.from(difference);
}

function throwLoggedCourseOperationError(
  deps: CourseMethodsDeps,
  operation: string,
  error: unknown,
  ...context: unknown[]
): never {
  deps.serverConsole(`${operation} ERROR,`, ...context, error);
  if (error instanceof Meteor.Error) {
    throw error;
  }
  throw new Meteor.Error('course-operation-failed', `${operation} failed`);
}

export function createCourseMethods(deps: CourseMethodsDeps) {
  async function requireTeacherOrAdmin(thisArg: MethodContext) {
    const actingUserId = requireAuthenticatedUser(thisArg.userId, 'Must be logged in', 401);
    const roleFlags = await getUserRoleFlags(deps.getMethodAuthorizationDeps(), actingUserId, ['admin', 'teacher'] as const);
    if (!roleFlags.admin && !roleFlags.teacher) {
      throw new Meteor.Error(403, 'Teacher or admin access required');
    }
    return { actingUserId, roleFlags };
  }

  async function assertCanManageCourse(thisArg: MethodContext, courseId: string) {
    const { actingUserId, roleFlags } = await requireTeacherOrAdmin(thisArg);
    const normalizedCourseId = deps.normalizeCanonicalId(courseId);
    if (!normalizedCourseId) {
      throw new Meteor.Error(400, 'Course id is required');
    }
    const course = await deps.Courses.findOneAsync({ _id: normalizedCourseId });
    if (!course) {
      throw new Meteor.Error(404, 'Course not found');
    }
    if (!roleFlags.admin && String(course.teacherUserId || '') !== actingUserId) {
      throw new Meteor.Error(403, 'Can only manage your own course');
    }
    return { course, actingUserId, roleFlags };
  }

  async function assertUniqueCourseNameForTeacher(courseName: string, teacherUserId: string, semester: string, excludingCourseId?: string) {
    const normalizedCourseName = courseName.toLowerCase();
    const existingCourses = await deps.Courses.find(
      { teacherUserId, semester },
      { fields: { _id: 1, courseName: 1 } }
    ).fetchAsync();
    const duplicate = existingCourses.find((course: any) =>
      String(course?._id || '') !== String(excludingCourseId || '') &&
      normalizeCourseName(course?.courseName).toLowerCase() === normalizedCourseName
    );
    if (duplicate) {
      throw new Meteor.Error(400, 'A course with that name already exists for this instructor');
    }
  }

  async function resolveInstructorForCaller(thisArg: MethodContext, requestedInstructorId: string) {
    const { actingUserId, roleFlags } = await requireTeacherOrAdmin(thisArg);
    const normalizedInstructorId = deps.normalizeCanonicalId(requestedInstructorId) || actingUserId;
    if (!roleFlags.admin && normalizedInstructorId !== actingUserId) {
      throw new Meteor.Error(403, 'Can only access your own instructor data');
    }
    return normalizedInstructorId;
  }

  function requireCourseSnapshotDeps() {
    if (!deps.CourseLearnerSnapshotCache || !deps.UserDashboardCache) {
      throw new Meteor.Error(500, 'Course learner snapshot cache dependencies are not registered');
    }
    return {
      CourseLearnerSnapshotCache: deps.CourseLearnerSnapshotCache,
      UserDashboardCache: deps.UserDashboardCache,
    };
  }

  async function getTdfSummariesByIds(tdfIds: string[]) {
    if (tdfIds.length === 0) return new Map<string, ReturnType<typeof getTdfSummary>>();
    const tdfs = await deps.Tdfs.find(
      { _id: { $in: [...new Set(tdfIds)] } },
      {
        fields: {
          _id: 1,
          ownerId: 1,
          accessors: 1,
          stimuliSetId: 1,
          'content.fileName': 1,
          'content.isMultiTdf': 1,
          'content.tdfs.tutor.unit': 1,
          'content.tdfs.tutor.setspec.lessonname': 1,
          'content.tdfs.tutor.setspec.tags': 1,
          'content.tdfs.tutor.setspec.contentLanguage': 1,
          'content.tdfs.tutor.setspec.recommendedUiLocales': 1,
          'content.tdfs.tutor.setspec.translationStatus': 1,
        },
      }
    ).fetchAsync();
    return new Map(tdfs.map((tdf: any) => [String(tdf._id), getTdfSummary(tdf)]));
  }

  let courseSnapshotCache: ReturnType<typeof createCourseLearnerSnapshotCacheHelpers> | null = null;
  function getCourseSnapshotCache() {
    if (!courseSnapshotCache) {
      courseSnapshotCache = createCourseLearnerSnapshotCacheHelpers({
        ...requireCourseSnapshotDeps(),
        serverConsole: deps.serverConsole,
        Courses: deps.Courses,
        Sections: deps.Sections,
        SectionUserMap: deps.SectionUserMap,
        Assignments: deps.Assignments,
        Tdfs: deps.Tdfs,
        usersCollection: deps.usersCollection,
        getMethodAuthorizationDeps: deps.getMethodAuthorizationDeps,
        getUserDisplayIdentifier: deps.getUserDisplayIdentifier,
        normalizeCourseVisibility,
        normalizeTimezone,
        parseNullablePersistedDate,
        normalizeAssignmentRow,
        getTdfSummariesByIds,
      });
    }
    return courseSnapshotCache;
  }

  async function invalidateCourseSnapshotForUser(userId: string, reason: string) {
    return await getCourseSnapshotCache().invalidateCourseSnapshotForUser(userId, reason);
  }

  async function invalidateCourseSnapshotsForCourse(courseId: string, reason: string) {
    return await getCourseSnapshotCache().invalidateCourseSnapshotsForCourse(courseId, reason);
  }

  async function invalidateCourseSnapshotsForAssignment(assignmentId: string, reason: string) {
    return await getCourseSnapshotCache().invalidateCourseSnapshotsForAssignment(assignmentId, reason);
  }

  async function refreshCourseSnapshotAfterPractice(userId: string, TDFId: string) {
    return await getCourseSnapshotCache().refreshCourseSnapshotAfterPractice(userId, TDFId);
  }

  async function fetchNormalizedAssignmentSummaries(courseId: string) {
    const rows = await deps.Assignments.find(
      { courseId },
      { fields: { _id: 1, courseId: 1, assignmentType: 1, TDFId: 1, title: 1, memberTdfIds: 1, order: 1, releaseAt: 1, dueAt: 1, required: 1, createdAt: 1, updatedAt: 1 } }
    ).fetchAsync();
    const summariesById = await getTdfSummariesByIds(rows.flatMap(assignmentMemberTdfIds));
    return rows
      .map((row: any, index: number): CourseAssignmentSummary | null => {
        const normalized = normalizeAssignmentRow(row, index, summariesById);
        if (!normalized) return null;
        if (normalized.assignmentType === 'progressive') return normalized;
        const summary = summariesById.get(normalized.TDFId);
        return {
          ...normalized,
          ...(summary ? assignmentLanguageMetadata(summary) : {}),
        };
      })
      .filter((row: CourseAssignmentSummary | null): row is CourseAssignmentSummary => !!row)
      .sort((a: CourseAssignmentSummary, b: CourseAssignmentSummary) => a.order - b.order || a.title.localeCompare(b.title) || a.assignmentId.localeCompare(b.assignmentId));
  }

  async function getSourceSentences(stimuliSetId: string | number) {
    const sourceSentencesRet = deps.itemSourceSentences.find({ stimuliSetId });
    return sourceSentencesRet.sourceSentences;
  }

  async function getAllCourses(this: MethodContext) {
    await requireUserWithRoles(deps.getMethodAuthorizationDeps(), {
      userId: this.userId,
      roles: ['admin'],
      notLoggedInMessage: 'Must be logged in',
      notLoggedInCode: 401,
      forbiddenMessage: 'Admin access required',
      forbiddenCode: 403,
    });
    try {
      const coursesRet = await deps.Courses.find().fetchAsync();
      const courses = [];
      for (const course of coursesRet) {
        courses.push(getCourse(normalizeCourseDocumentForRead(course)));
      }
      return courses;
    } catch (e: unknown) {
      throwLoggedCourseOperationError(deps, 'getAllCourses', e);
    }
  }

  async function getAllCourseSections(this: MethodContext) {
    const actingUserId = requireAuthenticatedUser(this.userId, 'Must be logged in', 401);
    try {
      deps.serverConsole('getAllCourseSections');
      const roleFlags = await getUserRoleFlags(deps.getMethodAuthorizationDeps(), actingUserId, ['admin', 'teacher'] as const);
      const allSections = await deps.Courses.rawCollection().aggregate([
        {
          $match: { semester: curSemester },
        },
        {
          $lookup: {
            from: 'section',
            localField: '_id',
            foreignField: 'courseId',
            as: 'section',
          },
        },
        {
          $unwind: {
            path: '$section',
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $project: {
            _id: 0,
            sectionName: '$section.sectionName',
            courseId: '$_id',
            courseName: 1,
            teacherUserId: 1,
            semester: 1,
            visibility: { $ifNull: ['$visibility', 'private'] },
            beginDate: 1,
            endDate: 1,
            timezone: { $ifNull: ['$timezone', DEFAULT_COURSE_TIMEZONE] },
            sectionId: '$section._id',
          },
        },
      ]).toArray();
      if (roleFlags.admin || roleFlags.teacher) {
        return allSections;
      }
      const enrollmentRows = await deps.SectionUserMap.find(
        { userId: actingUserId },
        { fields: { sectionId: 1 } }
      ).fetchAsync();
      const enrolledSectionIds = new Set(enrollmentRows.map((row: any) => String(row?.sectionId || '')).filter(Boolean));
      return allSections.filter((section: any) =>
        section.visibility === 'public' ||
        enrolledSectionIds.has(String(section.sectionId || ''))
      );
    } catch (e: unknown) {
      throwLoggedCourseOperationError(deps, 'getAllCourseSections', e);
    }
  }

  async function getAllCoursesForInstructor(this: MethodContext, instructorId: string) {
    instructorId = await resolveInstructorForCaller(this, instructorId);
    deps.serverConsole('getAllCoursesForInstructor:', instructorId);
    const courses = await deps.Courses.find(
      { teacherUserId: instructorId, semester: curSemester },
      { fields: { _id: 1, courseName: 1, teacherUserId: 1, semester: 1, visibility: 1, beginDate: 1, endDate: 1, timezone: 1 } }
    ).fetchAsync();
    return courses.map(normalizeCourseDocumentForRead);
  }

  async function getAllCourseAssignmentsForInstructor(this: MethodContext, instructorId: string) {
    try {
      instructorId = await resolveInstructorForCaller(this, instructorId);
      deps.serverConsole('getAllCourseAssignmentsForInstructor:' + instructorId);
      return await deps.Assignments.rawCollection().aggregate([
        {
          $set: {
            effectiveTdfIds: {
              $cond: [
                { $eq: ['$assignmentType', 'progressive'] },
                '$memberTdfIds',
                ['$TDFId'],
              ],
            },
          },
        },
        { $unwind: '$effectiveTdfIds' },
        {
          $lookup: {
            from: 'tdfs',
            localField: 'effectiveTdfIds',
            foreignField: '_id',
            as: 'TDF',
          },
        },
        {
          $unwind: { path: '$TDF' },
        },
        {
          $lookup: {
            from: 'course',
            localField: 'courseId',
            foreignField: '_id',
            as: 'course',
          },
        },
        {
          $unwind: { path: '$course' },
        },
        {
          $match: {
            'course.teacherUserId': instructorId,
            'course.semester': curSemester,
          },
        },
        {
          $project: {
            _id: 0,
            fileName: '$TDF.content.fileName',
            courseName: '$course.courseName',
            courseId: '$course._id',
          },
        },
      ]).toArray();
    } catch (e: unknown) {
      throwLoggedCourseOperationError(deps, 'getAllCourseAssignmentsForInstructor', e, instructorId);
    }
  }

  async function sendCourseAssignmentEmail(userId: string, course: any, section: any) {
    const student = await deps.usersCollection.findOneAsync(
      { _id: userId },
      { fields: { username: 1, email_canonical: 1, emails: 1 } }
    );
    const to = getPrimaryUserEmail(student);
    if (!to) {
      throw new Meteor.Error(400, 'Cannot send course assignment email because the learner account has no email address');
    }
    const baseUrl = normalizeOptionalString(deps.thisServerUrl);
    if (!baseUrl) {
      throw new Meteor.Error(500, 'Cannot send course assignment email because ROOT_URL is not configured');
    }
    const from = normalizeOptionalString(deps.emailFrom);
    if (!from) {
      throw new Meteor.Error(500, 'Cannot send course assignment email because emailFrom is not configured');
    }
    const normalizedBaseUrl = baseUrl.replace(/\/+$/, '');
    const coursesUrl = `${normalizedBaseUrl}/courses`;
    const courseName = String(course?.courseName || 'your course');
    const sectionName = String(section?.sectionName || 'your section');
    const brandName = (await ensurePublishedDeploymentBrandProfile()).identity.name;
    const subject = `${brandName} course assignment: ${courseName}`;
    const displayName = deps.getUserDisplayIdentifier(student) || 'learner';
    const text = [
      `Hello ${displayName},`,
      '',
      `You have been assigned to ${courseName} (${sectionName}) in ${brandName}.`,
      '',
      `Open ${brandName}: ${normalizedBaseUrl}`,
      `Go directly to Courses: ${coursesUrl}`,
      '',
      'After signing in, choose Courses from the Learn menu. Your assigned course will appear at the top of the Courses page. Select Start or Continue on an assignment to begin practicing.',
      '',
      'If you do not see the course after signing in, contact your instructor.',
    ].join('\n');
    deps.sendEmail(to, from, subject, text);
  }

  async function getCourseAssignmentEditorSnapshot(this: MethodContext, courseId: string): Promise<CourseAssignmentEditorSnapshot> {
    const { course } = await assertCanManageCourse(this, courseId);
    const assignments = await fetchNormalizedAssignmentSummaries(String(course._id));
    const { actingUserId, roleFlags } = await requireTeacherOrAdmin(this);
    const tdfSelector = roleFlags.admin
      ? {}
      : { $or: [{ ownerId: actingUserId }, { accessors: actingUserId }, { 'accessors.userId': actingUserId }] };
    const assignableTdfs = await deps.Tdfs.find(
      tdfSelector,
      {
        fields: {
          _id: 1,
          ownerId: 1,
          accessors: 1,
          stimuliSetId: 1,
          packageAssetId: 1,
          tdfAvailability: 1,
          'content.fileName': 1,
          'content.isMultiTdf': 1,
          'content.tdfs.tutor.setspec.lessonname': 1,
          'content.tdfs.tutor.setspec.tags': 1,
          'content.tdfs.tutor.setspec.contentLanguage': 1,
          'content.tdfs.tutor.setspec.recommendedUiLocales': 1,
          'content.tdfs.tutor.setspec.translationStatus': 1,
          'content.tdfs.tutor.setspec.condition': 1,
          'content.tdfs.tutor.setspec.conditionTdfIds': 1,
          'content.tdfs.tutor.deliverySettings': 1,
          'content.tdfs.tutor.unit': 1,
          'rawStimuliFile.setspec.clusters': 1,
        },
      }
    ).fetchAsync();
    const packageIds = [...new Set<string>(assignableTdfs
      .map((tdf: any) => deps.normalizeCanonicalId(tdf.packageAssetId))
      .filter((id: string | null): id is string => id !== null))];
    const accessibleIds = new Set(assignableTdfs.map((tdf: any) => String(tdf._id)));
    const packages = await Promise.all(packageIds.map(async (packageAssetId) => {
      const [asset, members] = await Promise.all([
        deps.DynamicAssets.findOneAsync({ _id: packageAssetId }, { fields: { name: 1 } }),
        deps.Tdfs.find({ packageAssetId }, { fields: { _id: 1 } }).fetchAsync(),
      ]);
      const fileName = typeof asset?.name === 'string' ? asset.name.trim() : '';
      const memberTdfIds = members.map((member: any) => String(member._id));
      const inaccessible = memberTdfIds.some((id: string) => !accessibleIds.has(id));
      const ineligible = assignableTdfs.some((tdf: any) => tdf.packageAssetId === packageAssetId
        && progressiveTdfIneligibilityReasons(tdf).length > 0);
      return {
        packageAssetId,
        fileName,
        lessonCount: members.length,
        // Do not disclose identifiers of lessons the teacher cannot access.
        memberTdfIds: inaccessible ? [] : memberTdfIds,
        blockedReason: !fileName ? 'The uploaded package filename is unavailable.'
          : inaccessible ? 'This package contains lessons you cannot access.'
            : ineligible ? 'This package contains lessons that are not eligible for a progression.' : null,
      };
    }));
    return {
      course: {
        courseId: String(course._id),
        courseName: String(course.courseName || ''),
        visibility: normalizeCourseVisibility(course.visibility),
        teacherUserId: String(course.teacherUserId || ''),
        timezone: normalizeTimezone(course.timezone, true),
      },
      assignments,
      packages,
      assignableTdfs: assignableTdfs.map(getTdfSummary)
        .filter((tdf: any) => tdf.TDFId)
        .map((tdf: any) => ({
          TDFId: tdf.TDFId,
          fileName: tdf.fileName,
          displayName: tdf.displayName,
          tags: tdf.tags,
          contentLanguage: tdf.contentLanguage,
          recommendedUiLocales: tdf.recommendedUiLocales,
          translationStatus: tdf.translationStatus,
          ownerId: tdf.ownerId,
          currentStimuliSetId: tdf.currentStimuliSetId,
          title: tdf.displayName,
          progressiveEligible: progressiveTdfIneligibilityReasons(
            assignableTdfs.find((rawTdf: any) => String(rawTdf?._id || '') === tdf.TDFId),
          ).length === 0,
          progressiveIneligibilityReasons: progressiveTdfIneligibilityReasons(
            assignableTdfs.find((rawTdf: any) => String(rawTdf?._id || '') === tdf.TDFId),
          ),
        }))
        .sort((a: any, b: any) => a.displayName.localeCompare(b.displayName) || a.fileName.localeCompare(b.fileName)),
    };
  }

  function validateAssignmentInput(raw: unknown, index: number, timezone: string) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new Meteor.Error(400, `Assignment row ${index + 1} must be an object`);
    }
    const row = raw as UnknownRecord;
    assertKnownFields(row, ['assignmentId', 'assignmentType', 'TDFId', 'title', 'memberTdfIds', 'order', 'releaseAt', 'dueAt', 'required'], `Assignment row ${index + 1}`);
    if (row.assignmentType !== 'lesson' && row.assignmentType !== 'progressive') {
      throw new Meteor.Error(400, `Assignment row ${index + 1} requires assignmentType lesson or progressive`);
    }
    const releaseAt = parseDateLike(row.releaseAt ?? null, `Assignment row ${index + 1} release date`, timezone);
    const dueAt = parseDateLike(row.dueAt ?? null, `Assignment row ${index + 1} due date`, timezone);
    if (releaseAt && dueAt && dueAt.getTime() < releaseAt.getTime()) {
      throw new Meteor.Error(400, `Assignment row ${index + 1} due date must be on or after release date`);
    }
    const clientOrder = Number(row.order);
    if (!Number.isInteger(clientOrder) || clientOrder < 0) {
      throw new Meteor.Error(400, `Assignment row ${index + 1} order must be a non-negative integer`);
    }
    if (row.required !== true && row.required !== false) {
      throw new Meteor.Error(400, `Assignment row ${index + 1} required must be true or false`);
    }
    const base = {
      assignmentId: normalizeOptionalString(row.assignmentId),
      order: index,
      releaseAt,
      dueAt,
      required: row.required === true,
    };
    if (row.assignmentType === 'lesson') {
      if (row.title !== undefined || row.memberTdfIds !== undefined) {
        throw new Meteor.Error(400, `Lesson assignment row ${index + 1} must not contain progressive fields`);
      }
      const TDFId = normalizeOptionalString(row.TDFId);
      if (!TDFId) throw new Meteor.Error(400, `Assignment row ${index + 1} requires TDFId`);
      return { ...base, assignmentType: 'lesson' as const, TDFId };
    }
    if (row.TDFId !== undefined) {
      throw new Meteor.Error(400, `Progressive assignment row ${index + 1} must not contain TDFId`);
    }
    const title = normalizeOptionalString(row.title);
    if (!title) throw new Meteor.Error(400, `Progressive assignment row ${index + 1} requires a title`);
    if (title.length > 160) throw new Meteor.Error(400, `Progressive assignment row ${index + 1} title is too long`);
    if (!Array.isArray(row.memberTdfIds)) {
      throw new Meteor.Error(400, `Progressive assignment row ${index + 1} requires memberTdfIds`);
    }
    const memberTdfIds = row.memberTdfIds.map((value) => normalizeOptionalString(value));
    if (memberTdfIds.some((value) => !value)) {
      throw new Meteor.Error(400, `Progressive assignment row ${index + 1} contains an invalid member TDF id`);
    }
    const normalizedMemberIds = memberTdfIds as string[];
    if (normalizedMemberIds.length < MIN_PROGRESSIVE_MEMBERS) {
      throw new Meteor.Error(400, `Progressive assignment row ${index + 1} requires at least ${MIN_PROGRESSIVE_MEMBERS} lessons`);
    }
    if (new Set(normalizedMemberIds).size !== normalizedMemberIds.length) {
      throw new Meteor.Error(400, `Progressive assignment row ${index + 1} cannot contain the same lesson more than once`);
    }
    return { ...base, assignmentType: 'progressive' as const, title, memberTdfIds: normalizedMemberIds };
  }

  async function saveCourseAssignments(this: MethodContext, input: SaveCourseAssignmentsInput) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new Meteor.Error(400, 'Assignment save payload must be an object');
    }
    assertKnownFields(input as unknown as UnknownRecord, ['courseId', 'assignments'], 'Assignment save payload');
    const { course } = await assertCanManageCourse(this, input.courseId);
    const timezone = normalizeTimezone(course.timezone, true);
    if (!Array.isArray(input.assignments)) {
      throw new Meteor.Error(400, 'Assignments must be an array');
    }
    if (input.assignments.length > MAX_ASSIGNMENTS_PER_COURSE) {
      throw new Meteor.Error(400, `A course can have at most ${MAX_ASSIGNMENTS_PER_COURSE} assignments`);
    }
    const normalizedRows = input.assignments.map((row: unknown, index: number) => validateAssignmentInput(row, index, timezone));
    const allTdfIds = normalizedRows.flatMap(assignmentMemberTdfIds);
    const duplicateTdfIds = allTdfIds
      .filter((tdfId, index, all) => all.indexOf(tdfId) !== index);
    if (duplicateTdfIds.length > 0) {
      throw new Meteor.Error(400, `Duplicate TDF assignments are not allowed: ${[...new Set(duplicateTdfIds)].join(', ')}`);
    }
    const tdfSummaries = await getTdfSummariesByIds(allTdfIds);
    for (const tdfId of allTdfIds) {
      if (!tdfSummaries.has(tdfId)) throw new Meteor.Error(404, `Assignable TDF not found: ${tdfId}`);
    }
    const progressiveTdfIds = [...new Set(normalizedRows
      .filter((row) => row.assignmentType === 'progressive')
      .flatMap(assignmentMemberTdfIds))];
    const progressiveTdfs = progressiveTdfIds.length > 0
      ? await deps.Tdfs.find({ _id: { $in: progressiveTdfIds } }).fetchAsync()
      : [];
    const progressiveTdfById = new Map(progressiveTdfs.map((tdf: any) => [String(tdf?._id || ''), tdf]));
    for (const tdfId of progressiveTdfIds) {
      const reasons = progressiveTdfIneligibilityReasons(progressiveTdfById.get(tdfId));
      if (reasons.length > 0) {
        const lessonTitle = tdfSummaries.get(tdfId)?.displayName || tdfId;
        throw new Meteor.Error(400, `${lessonTitle} cannot be used in a progressive assignment: ${reasons.join(' ')}`);
      }
    }
    const existingRows = await deps.Assignments.find(
      { courseId: String(course._id) },
      { fields: { _id: 1, courseId: 1, assignmentType: 1, TDFId: 1, memberTdfIds: 1 } }
    ).fetchAsync();
    const existingById = new Map(existingRows.map((row: any) => [String(row._id), row]));
    const keepIds = new Set<string>();
    const now = new Date();
    const changedAssignmentIds = new Set<string>();

    for (const row of normalizedRows) {
      const existing = row.assignmentId ? existingById.get(row.assignmentId) : undefined;
      if (row.assignmentId && !existing) {
        throw new Meteor.Error(400, `Assignment id does not belong to this course: ${row.assignmentId}`);
      }
      if (existing) {
        keepIds.add(String(existing._id));
        changedAssignmentIds.add(String(existing._id));
        const assignmentFields = row.assignmentType === 'lesson'
          ? { assignmentType: 'lesson', TDFId: row.TDFId }
          : { assignmentType: 'progressive', title: row.title, memberTdfIds: row.memberTdfIds };
        await deps.Assignments.updateAsync(
          { _id: existing._id, courseId: String(course._id) },
          {
            $set: {
              ...assignmentFields,
              order: row.order,
              releaseAt: row.releaseAt,
              dueAt: row.dueAt,
              required: row.required,
              updatedAt: now,
            },
            $setOnInsert: {
              createdAt: now,
            },
            $unset: row.assignmentType === 'lesson'
              ? { title: '', memberTdfIds: '' }
              : { TDFId: '' },
          }
        );
      } else {
        const assignmentFields = row.assignmentType === 'lesson'
          ? { assignmentType: 'lesson', TDFId: row.TDFId }
          : { assignmentType: 'progressive', title: row.title, memberTdfIds: row.memberTdfIds };
        const insertedId = await deps.Assignments.insertAsync({
          courseId: String(course._id),
          ...assignmentFields,
          order: row.order,
          releaseAt: row.releaseAt,
          dueAt: row.dueAt,
          required: row.required,
          createdAt: now,
          updatedAt: now,
        });
        if (insertedId) changedAssignmentIds.add(String(insertedId));
      }
    }

    for (const existing of existingRows) {
      if (!keepIds.has(String(existing._id))) {
        changedAssignmentIds.add(String(existing._id));
        await deps.Assignments.removeAsync({ _id: existing._id, courseId: String(course._id) });
      }
    }

    await invalidateCourseSnapshotsForCourse(String(course._id), 'assignment-updated');
    for (const assignmentId of changedAssignmentIds) {
      await invalidateCourseSnapshotsForAssignment(assignmentId, 'assignment-updated');
    }
    return await getCourseAssignmentEditorSnapshot.call(this, String(course._id));
  }

  async function editCourseAssignments(this: MethodContext, newCourseAssignment: { courseId: string; tdfIds: string[] }) {
    try {
      await assertCanManageCourse(this, newCourseAssignment.courseId);
      if (!Array.isArray(newCourseAssignment.tdfIds)) {
        throw new Meteor.Error(400, 'Assignment payload requires a tdfIds array');
      }
      const tdfIds = [...new Set(newCourseAssignment.tdfIds.map((tdfId) => String(tdfId || '').trim()).filter(Boolean))];
      const result = await saveCourseAssignments.call(this, {
        courseId: newCourseAssignment.courseId,
        assignments: tdfIds.map((tdfId, order) => ({
          assignmentType: 'lesson' as const,
          TDFId: tdfId,
          order,
          releaseAt: null,
          dueAt: null,
          required: true,
        })),
      });
      return result;
    } catch (e: unknown) {
      throwLoggedCourseOperationError(deps, 'editCourseAssignments', e, newCourseAssignment.courseId);
    }
  }

  async function getTdfAssignmentsByCourseIdMap(this: MethodContext, instructorId: string) {
    instructorId = await resolveInstructorForCaller(this, instructorId);
    deps.serverConsole('getTdfAssignmentsByCourseIdMap', instructorId);
    const assignmentTdfs = await deps.Assignments.rawCollection().aggregate([
      {
        $lookup: {
          from: 'course',
          localField: 'courseId',
          foreignField: '_id',
          as: 'course',
        },
      },
      {
        $match: {
          'course.semester': curSemester,
          'course.teacherUserId': instructorId,
        },
      },
      {
        $set: {
          effectiveTdfIds: {
            $cond: [
              { $eq: ['$assignmentType', 'progressive'] },
              '$memberTdfIds',
              ['$TDFId'],
            ],
          },
        },
      },
      {
        $unwind: '$effectiveTdfIds',
      },
      {
        $lookup: {
          from: 'tdfs',
          localField: 'effectiveTdfIds',
          foreignField: '_id',
          as: 'TDF',
        },
      },
      {
        $unwind: {
          path: '$TDF',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          _id: 0,
          assignmentId: '$_id',
          content: '$TDF.content',
          TDFId: '$effectiveTdfIds',
          courseId: 1,
          dueAt: 1,
        },
      },
    ]).toArray();
    deps.serverConsole('Found', assignmentTdfs.length, 'assigned TDFs');

    const assignmentsByCourseId: Record<string, Array<{ assignmentId: string; TDFId: string; displayName: string; dueAt: unknown }>> = {};
    for (const assignment of assignmentTdfs) {
      const courseId = String(assignment.courseId);
      if (!assignmentsByCourseId[courseId]) {
        assignmentsByCourseId[courseId] = [];
      }
      assignmentsByCourseId[courseId]!.push({
        assignmentId: assignment._id || assignment.assignmentId,
        TDFId: assignment.TDFId,
        displayName: assignment.content.tdfs.tutor.setspec.lessonname,
        dueAt: assignment.dueAt || null,
      });
    }
    return assignmentsByCourseId;
  }

  async function resolveAssignedRootTdfIdsForUser(userId: string) {
    const enrollmentRows = await deps.SectionUserMap.find(
      { userId },
      { fields: { sectionId: 1 } }
    ).fetchAsync();
    const sectionIds: string[] = enrollmentRows
      .map((row: any) => deps.normalizeCanonicalId(row?.sectionId))
      .filter((id: string | null): id is string => typeof id === 'string');
    if (sectionIds.length === 0) {
      return [];
    }

    const uniqueSectionIds = [...new Set(sectionIds)];
    const sections = await deps.Sections.find(
      { _id: { $in: uniqueSectionIds } },
      { fields: { _id: 1, courseId: 1 } }
    ).fetchAsync();
    const courseIds = [...new Set(
      sections
        .map((section: any) => deps.normalizeCanonicalId(section?.courseId))
        .filter((courseId: string | null): courseId is string => typeof courseId === 'string')
    )];
    if (courseIds.length === 0) {
      return [];
    }

    const activeCourses = await deps.Courses.find(
      { _id: { $in: courseIds }, semester: curSemester },
      { fields: { _id: 1 } }
    ).fetchAsync();
    const activeCourseIds = activeCourses.map((course: any) => String(course?._id || '').trim()).filter(Boolean);
    if (activeCourseIds.length === 0) {
      return [];
    }

    const assignmentRows = await deps.Assignments.find(
      { courseId: { $in: activeCourseIds } },
      { fields: { assignmentType: 1, TDFId: 1, memberTdfIds: 1 } }
    ).fetchAsync();
    const assignedIdSet = new Set<string>();
    for (const row of assignmentRows) {
      for (const rawId of assignmentMemberTdfIds(row)) {
        const normalizedId = deps.normalizeCanonicalId(rawId);
        if (normalizedId) assignedIdSet.add(normalizedId);
      }
    }
    return Array.from(assignedIdSet);
  }

  async function getLearnerCoursesSnapshot(this: MethodContext): Promise<LearnerCoursesSnapshot> {
    const userId = requireAuthenticatedUser(this.userId, 'Must be logged in', 401);
    return await getCourseSnapshotCache().ensureLearnerCoursesSnapshot(userId);
  }

  async function getProgressiveAssignmentLaunch(
    this: MethodContext,
    assignmentId: string,
    endpointTdfId: string,
    revisionId?: string,
  ): Promise<ProgressiveAssignmentLaunchPayload> {
    const userId = requireAuthenticatedUser(this.userId, 'Must be logged in', 401);
    const normalizedAssignmentId = deps.normalizeCanonicalId(assignmentId);
    const normalizedEndpointId = deps.normalizeCanonicalId(endpointTdfId);
    if (!normalizedAssignmentId || !normalizedEndpointId) {
      throw new Meteor.Error(400, 'Progressive assignment and endpoint lesson are required');
    }
    const snapshot = await getCourseSnapshotCache().ensureLearnerCoursesSnapshot(userId);
    const visibleAssignments = [...snapshot.assignedCourses, ...snapshot.publicCourses]
      .flatMap((course) => course.assignments);
    const visibleAssignment = visibleAssignments.find((assignment) => assignment.assignmentId === normalizedAssignmentId);
    if (!visibleAssignment || visibleAssignment.assignmentType !== 'progressive') {
      throw new Meteor.Error(403, 'Progressive assignment is not available for this user');
    }
    if (visibleAssignment.availability !== 'available') {
      throw new Meteor.Error(403, 'Progressive assignment has not been released');
    }
    const assignment = await deps.Assignments.findOneAsync(
      { _id: normalizedAssignmentId, courseId: visibleAssignment.courseId, assignmentType: 'progressive' },
      { fields: { _id: 1, courseId: 1, assignmentType: 1, title: 1, memberTdfIds: 1, releaseAt: 1, progressiveRevisions: 1 } },
    );
    if (!assignment) throw new Meteor.Error(404, 'Progressive assignment no longer exists');
    const releaseAt = parseNullablePersistedDate(assignment.releaseAt);
    if (releaseAt && releaseAt.getTime() > Date.now()) {
      throw new Meteor.Error(403, 'Progressive assignment has not been released');
    }
    const memberTdfIds = assignmentMemberTdfIds(assignment);
    const endpointIndex = memberTdfIds.indexOf(normalizedEndpointId);
    if (revisionId === undefined && endpointIndex < 1) {
      throw new Meteor.Error(400, 'Progressive practice requires the second or a later member lesson');
    }
    const orderingRevisionId = revisionId === undefined ? progressiveRevisionId(memberTdfIds) : revisionId;
    const prefixTdfIds = revisionId === undefined
      ? memberTdfIds.slice(0, endpointIndex + 1)
      : progressiveRevisionPrefix(assignment, revisionId, normalizedEndpointId);
    if (!prefixTdfIds.every((id) => memberTdfIds.includes(id))) {
      throw new Meteor.Error(403, 'A lesson in this progressive session has been removed; launch again from Courses');
    }
    const tdfs = await deps.Tdfs.find({ _id: { $in: prefixTdfIds } }).fetchAsync();
    const tdfById = new Map(tdfs.map((tdf: any) => [String(tdf?._id || ''), tdf]));
    const orderedTdfs = prefixTdfIds.map((tdfId) => tdfById.get(tdfId));
    if (orderedTdfs.some((tdf) => !tdf)) {
      throw new Meteor.Error(404, 'A progressive assignment member lesson no longer exists');
    }
    for (const [index, tdf] of orderedTdfs.entries()) {
      const reasons = progressiveTdfIneligibilityReasons(tdf);
      if (reasons.length > 0) {
        throw new Meteor.Error(400, `Progressive member ${index + 1} is no longer eligible: ${reasons.join(' ')}`);
      }
    }
    const launchTdfs = orderedTdfs.map((tdf: any) => {
      const stimuliSetId = tdf.stimuliSetId;
      if (stimuliSetId === undefined || stimuliSetId === null || String(stimuliSetId).trim() === '') {
        throw new Meteor.Error(400, `Progressive member ${String(tdf._id)} is missing stimuliSetId`);
      }
      const stimuli = prepareStimuliSetForRuntime(tdf);
      if (!Array.isArray(stimuli) || stimuli.length === 0) {
        throw new Meteor.Error(400, `Progressive member ${String(tdf._id)} has no stimulus records`);
      }
      return deps.removeRuntimeTdfSecrets({
        _id: tdf._id,
        stimuliSetId,
        content: tdf.content,
        rawStimuliFile: tdf.rawStimuliFile,
        stimuli,
      });
    });
    if (revisionId === undefined) {
      // Match the order we read so an edit during launch cannot authorize a
      // different ordering. Identical orders share the same immutable snapshot.
      const updated = await deps.Assignments.updateAsync(
        { _id: normalizedAssignmentId, assignmentType: 'progressive', memberTdfIds, releaseAt: assignment.releaseAt ?? null },
        { $set: { [`progressiveRevisions.${orderingRevisionId}`]: memberTdfIds } },
      );
      if (!updated) throw new Meteor.Error(409, 'Assignment changed during launch; launch again from Courses');
    }
    return {
      progressiveRevisionId: orderingRevisionId,
      assignmentId: normalizedAssignmentId,
      courseId: visibleAssignment.courseId,
      title: String(assignment.title),
      endpointTdfId: normalizedEndpointId,
      memberTdfIds: prefixTdfIds,
      tdfs: launchTdfs,
    };
  }

  async function getTdfsAssignedToStudent(this: MethodContext, userId: string, curSectionId: string) {
    deps.serverConsole('getTdfsAssignedToStudent', userId, curSectionId);
    const actingUserId = requireAuthenticatedUser(this.userId, 'Must be logged in', 401);
    if (!userId || !curSectionId) {
      throw new Meteor.Error(400, 'User and section are required');
    }

    const roleFlags = await getUserRoleFlags(deps.getMethodAuthorizationDeps(), actingUserId, ['admin', 'teacher'] as const);
    const callerIsAdmin = roleFlags.admin;
    const callerIsTeacher = roleFlags.teacher;
    const isSelfRequest = actingUserId === userId;
    if (!isSelfRequest && !callerIsAdmin && !callerIsTeacher) {
      throw new Meteor.Error(403, 'Permission denied');
    }

    const pipeline = [
      { $match: { _id: curSectionId } },
      {
        $lookup: {
          from: 'course',
          let: { courseId: '$courseId' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$_id', '$$courseId'] },
                    { $eq: ['$semester', curSemester] },
                  ],
                },
              },
            },
          ],
          as: 'course',
        },
      },
      { $unwind: { path: '$course', preserveNullAndEmptyArrays: false } },
      {
        $lookup: {
          from: 'section_user_map',
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$sectionId', curSectionId] },
                    { $eq: ['$userId', userId] },
                  ],
                },
              },
            },
            { $limit: 1 },
          ],
          as: 'enrollment',
        },
      },
      {
        $lookup: {
          from: 'assessments',
          localField: 'course._id',
          foreignField: 'courseId',
          as: 'assignments',
        },
      },
      {
        $project: {
          'course.teacherUserId': 1,
          enrollment: 1,
          'assignments.assignmentType': 1,
          'assignments.TDFId': 1,
          'assignments.memberTdfIds': 1,
        },
      },
    ];

    const results = await deps.Sections.rawCollection().aggregate(pipeline).toArray();
    const result = results[0];
    if (!result) {
      const sectionExists = await deps.Sections.findOneAsync({ _id: curSectionId }, { fields: { _id: 1 } });
      if (!sectionExists) {
        throw new Meteor.Error(404, 'Section not found');
      }
      return [];
    }

    const enrolled = Array.isArray(result.enrollment) && result.enrollment.length > 0;
    const teacherOwnsCourse = callerIsTeacher &&
      String(result.course?.teacherUserId || '') === this.userId;
    if (!enrolled && !callerIsAdmin && !teacherOwnsCourse) {
      throw new Meteor.Error(403, 'User is not enrolled in this section');
    }

    const assignments = Array.isArray(result.assignments) ? result.assignments : [];
    const assignedIdSet = new Set<string>();
    for (const row of assignments) {
      for (const rawId of assignmentMemberTdfIds(row)) {
        const id = deps.normalizeCanonicalId(rawId);
        if (id) assignedIdSet.add(id);
      }
    }
    return Array.from(assignedIdSet);
  }

  async function getTdfNamesAssignedByInstructor(this: MethodContext, instructorID: string) {
    try {
      instructorID = await resolveInstructorForCaller(this, instructorID);
      let assignmentTdfFileNames = await deps.Courses.rawCollection().aggregate([
        {
          $lookup: {
            from: 'assessments',
            localField: '_id',
            foreignField: 'courseId',
            as: 'assessment',
          },
        },
        {
          $unwind: { path: '$assessment' },
        },
        {
          $lookup: {
            from: 'tdfs',
            localField: 'assessment.TDFId',
            foreignField: '_id',
            as: 'TDF',
          },
        },
        {
          $unwind: { path: '$TDF' },
        },
        {
          $match: {
            semester: curSemester,
            teacherUserId: instructorID,
          },
        },
        {
          $project: {
            _id: 0,
            fileName: '$TDF.content.fileName',
            TDFId: '$TDF._id',
          },
        },
      ]).toArray();
      assignmentTdfFileNames = [...new Set(assignmentTdfFileNames.map((item: { fileName?: string; TDFId?: string }) => item.fileName || item.TDFId))];
      deps.serverConsole('assignmentTdfFileNames', assignmentTdfFileNames);
      return assignmentTdfFileNames;
    } catch (e: unknown) {
      throwLoggedCourseOperationError(deps, 'getTdfNamesAssignedByInstructor', e);
    }
  }

  async function getTdfIdsByOwnerId(ownerId: string) {
    deps.serverConsole('getTdfIdsByOwnerId', ownerId);
    try {
      const tdfs = await deps.Tdfs.find({ ownerId }).fetchAsync();
      const ownedTdfIds = tdfs.map((tdf: { _id: string }) => String(tdf._id));
      deps.serverConsole('ownedTdfIds count:', ownedTdfIds.length);
      return ownedTdfIds;
    } catch (e: unknown) {
      throwLoggedCourseOperationError(deps, 'getTdfIdsByOwnerId', e);
    }
  }

  async function getAllTeachers(this: MethodContext) {
    const query = { roles: 'teacher' };
    deps.serverConsole('getAllTeachers', query);
    if (!this.userId) {
      throw new Meteor.Error(401, 'Must be logged in');
    }
    const allTeachers = await deps.usersCollection.find(query, {
      fields: {
        _id: 1,
        username: 1,
        email_canonical: 1,
        'emails.address': 1,
      },
    }).fetchAsync();

    return allTeachers.map((teacher: any) => ({
      ...teacher,
      username: deps.getUserDisplayIdentifier(teacher),
      displayIdentifier: deps.getUserDisplayIdentifier(teacher),
    }));
  }

  async function addCourse(this: MethodContext, mycourse: { sections: string[] } & UnknownRecord) {
    const { actingUserId, roleFlags } = await requireTeacherOrAdmin(this);
    assertKnownFields(mycourse, ['courseId', 'courseName', 'teacherUserId', 'semester', 'beginDate', 'endDate', 'timezone', 'visibility', 'sections'], 'Course');
    const { beginDate, endDate, timezone } = normalizeCourseDates(mycourse);
    const sections = normalizeCourseSections(mycourse.sections);
    const courseName = normalizeCourseName(mycourse.courseName);
    if (!courseName) {
      throw new Meteor.Error(400, 'Course name is required');
    }
    const adminTeacherUserId = deps.normalizeCanonicalId(mycourse.teacherUserId);
    const teacherUserId = roleFlags.admin && adminTeacherUserId
      ? adminTeacherUserId
      : actingUserId;
    const semester = normalizeOptionalString(mycourse.semester) || curSemester;
    await assertUniqueCourseNameForTeacher(courseName, teacherUserId, semester);
    const courseDoc = {
      courseName,
      teacherUserId,
      semester,
      beginDate,
      endDate,
      timezone,
      visibility: normalizeCourseVisibility(mycourse.visibility),
    };
    deps.serverConsole('addCourse:' + JSON.stringify(courseDoc));
    const courseId = await deps.Courses.insertAsync(courseDoc);
    for (const sectionName of sections) {
      await deps.Sections.insertAsync({ courseId, sectionName });
    }
    await invalidateCourseSnapshotsForCourse(String(courseId), 'course-added');
    return courseId;
  }

  async function editCourse(this: MethodContext, mycourse: { _id: string; courseId: string; sections: string[] } & UnknownRecord) {
    assertKnownFields(mycourse, ['_id', 'courseId', 'courseName', 'teacherUserId', 'semester', 'beginDate', 'endDate', 'timezone', 'visibility', 'sections'], 'Course');
    const targetCourseId = deps.normalizeCanonicalId(mycourse._id) || deps.normalizeCanonicalId(mycourse.courseId);
    const { course, actingUserId, roleFlags } = await assertCanManageCourse(this, targetCourseId || '');
    const { beginDate, endDate, timezone } = normalizeCourseDates(mycourse, course);
    const courseName = normalizeCourseName(mycourse.courseName);
    if (!courseName) {
      throw new Meteor.Error(400, 'Course name is required');
    }
    const adminTeacherUserId = deps.normalizeCanonicalId(mycourse.teacherUserId);
    const teacherUserId = roleFlags.admin && adminTeacherUserId
      ? adminTeacherUserId
      : (!roleFlags.admin ? actingUserId : course.teacherUserId);
    const semester = normalizeOptionalString(mycourse.semester) || course.semester || curSemester;
    await assertUniqueCourseNameForTeacher(courseName, teacherUserId, semester, targetCourseId || undefined);
    const visibility = mycourse.visibility === undefined
      ? normalizeCourseVisibility(course.visibility)
      : normalizeCourseVisibility(mycourse.visibility);
    const courseUpdate = {
      $set: {
        courseName,
        teacherUserId,
        semester,
        beginDate,
        endDate,
        timezone,
        visibility,
      },
    };
    deps.serverConsole('editCourse:' + JSON.stringify(courseUpdate));
    await deps.Courses.updateAsync({ _id: targetCourseId }, courseUpdate);
    const newSections = normalizeCourseSections(mycourse.sections);
    const curCourseSections = await deps.Sections.find({ courseId: targetCourseId }).fetchAsync();
    const oldSections = curCourseSections.map((section: { sectionName: string }) => section.sectionName);
    deps.serverConsole('old/new', oldSections, newSections);

    const sectionsAdded = getSetAMinusB(newSections, oldSections);
    const sectionsRemoved = getSetAMinusB(oldSections, newSections);
    deps.serverConsole('sectionsAdded,', sectionsAdded);
    deps.serverConsole('sectionsRemoved,', sectionsRemoved);

    for (const sectionName of sectionsAdded) {
      await deps.Sections.insertAsync({ courseId: targetCourseId, sectionName });
    }
    for (const sectionName of sectionsRemoved) {
      await deps.Sections.removeAsync({ courseId: targetCourseId, sectionName });
    }

    await invalidateCourseSnapshotsForCourse(String(targetCourseId), 'course-updated');
    return targetCourseId;
  }

  async function deleteCourse(this: MethodContext, courseId: string) {
    const targetCourseId = deps.normalizeCanonicalId(courseId);
    const { course } = await assertCanManageCourse(this, targetCourseId || '');
    const sectionRows = await deps.Sections.find({ courseId: targetCourseId }, { fields: { _id: 1 } }).fetchAsync();
    const sectionIds = sectionRows.map((section: any) => String(section?._id || '')).filter(Boolean);
    await invalidateCourseSnapshotsForCourse(String(course._id), 'course-deleted');
    const enrollmentRemoved = sectionIds.length > 0
      ? await deps.SectionUserMap.removeAsync({ sectionId: { $in: sectionIds } })
      : 0;
    const assignmentsRemoved = await deps.Assignments.removeAsync({ courseId: targetCourseId });
    const sectionsRemoved = await deps.Sections.removeAsync({ courseId: targetCourseId });
    const coursesRemoved = await deps.Courses.removeAsync({ _id: targetCourseId });
    deps.serverConsole('deleteCourse:', {
      courseId: targetCourseId,
      enrollmentRemoved,
      assignmentsRemoved,
      sectionsRemoved,
      coursesRemoved,
    });
    return true;
  }

  async function addUserToTeachersClass(this: MethodContext, teacherID: string, sectionId: string) {
    const userId = this.userId;
    deps.serverConsole('addUserToTeachersClass', userId, teacherID, sectionId);
    if (!userId) {
      throw new Meteor.Error(401, 'Must be logged in');
    }
    if (!teacherID || !sectionId) {
      throw new Meteor.Error(400, 'Teacher and section are required');
    }

    const section = await deps.Sections.findOneAsync({ _id: sectionId });
    if (!section) {
      throw new Meteor.Error(404, 'Section not found');
    }
    const course = await deps.Courses.findOneAsync({ _id: section.courseId });
    if (!course) {
      throw new Meteor.Error(404, 'Course not found');
    }
    const teacherUserId = String(course.teacherUserId || '');
    if (!teacherUserId || teacherUserId !== String(teacherID)) {
      throw new Meteor.Error(403, 'Teacher does not own this section');
    }

    const existingMappingCount = await deps.SectionUserMap.find({ sectionId, userId }).countAsync?.() || 0;
    deps.serverConsole('existingMapping', existingMappingCount);
    if (existingMappingCount === 0) {
      deps.serverConsole('new user, inserting into section_user_mapping', [sectionId, userId]);
      await deps.SectionUserMap.insertAsync({ sectionId, userId });
      await invalidateCourseSnapshotForUser(userId, 'membership-updated');
      await invalidateCourseSnapshotsForCourse(String(course._id), 'membership-updated');
      await sendCourseAssignmentEmail(userId, course, section);
    }

    return true;
  }

  async function resolveAssignmentForDueDateException(this: MethodContext, classId: string, tdfId: string, assignmentId: string) {
    await assertCanManageCourse(this, classId);
    if (!deps.normalizeCanonicalId(assignmentId)) throw new Meteor.Error(400, 'Assignment id is required');
    const assignment = await deps.Assignments.findOneAsync(
      { _id: assignmentId, courseId: classId },
      { fields: { _id: 1, courseId: 1, assignmentType: 1, TDFId: 1, memberTdfIds: 1 } },
    );
    if (!assignment || !assignmentMemberTdfIds(assignment).includes(tdfId)) {
      throw new Meteor.Error(404, 'Course assignment not found for due date exception');
    }
    return assignment;
  }

  async function addUserDueDateException(this: MethodContext, userId: string, tdfId: string, classId: string, date: string | number | Date, assignmentId: string) {
    const assignment = await resolveAssignmentForDueDateException.call(this, classId, tdfId, assignmentId);
    deps.serverConsole('addUserDueDateException', userId, tdfId, date, assignment._id);
    const now = new Date();
    const exception = {
      assignmentId: String(assignment._id),
      courseId: classId,
      TDFId: tdfId,
      date,
      createdAt: now,
      updatedAt: now,
    };
    const user = await deps.usersCollection.findOneAsync({ _id: userId });
    const dueDateExceptions = Array.isArray(user.dueDateExceptions) ? user.dueDateExceptions : [];
    const existingIndex = dueDateExceptions.findIndex((item: DueDateException) => item.assignmentId === exception.assignmentId);
    if (existingIndex >= 0) {
      dueDateExceptions[existingIndex] = {
        ...dueDateExceptions[existingIndex],
        ...exception,
        createdAt: dueDateExceptions[existingIndex].createdAt || now,
        updatedAt: now,
      };
    } else {
      dueDateExceptions.push(exception);
    }
    user.dueDateExceptions = dueDateExceptions;
    await deps.usersCollection.updateAsync({ _id: userId }, user);
  }

  async function checkForTDFData(tdfId: string) {
    const userId = Meteor.userId();
    deps.serverConsole('checkForTDFData', tdfId, userId);
    const tdf = await deps.Histories.findOneAsync({
      TDFId: tdfId,
      userId,
      $and: [
        { levelUnitType: { $ne: 'schedule' } },
        { levelUnitType: { $ne: 'Instruction' } },
      ],
    });
    return !!tdf;
  }

  async function checkForUserException(this: MethodContext, userId: string, assignmentId: string) {
    await requireUserMatchesOrHasRole(deps.getMethodAuthorizationDeps(), {
      actingUserId: this.userId,
      subjectUserId: userId,
      roles: ['admin'],
      notLoggedInMessage: 'Must be logged in',
      notLoggedInCode: 401,
      forbiddenMessage: 'Can only read your own due date exceptions',
      forbiddenCode: 403,
    });
    if (!deps.normalizeCanonicalId(assignmentId)) throw new Meteor.Error(400, 'Assignment id is required');
    const user = await deps.usersCollection.findOneAsync({ _id: userId });
    if (user.dueDateExceptions) {
      const exceptions = user.dueDateExceptions as DueDateException[];
      const exception = exceptions.find((item) => item.assignmentId === assignmentId);
      if (exception) {
        const exceptionDate = new Date(exception.date);
        return exceptionDate.toLocaleDateString();
      }
    }
    return false;
  }

  async function removeUserDueDateException(this: MethodContext, userId: string, tdfId: string, classId: string, assignmentId: string) {
    if (!classId || !assignmentId) throw new Meteor.Error(400, 'Course and assignment ids are required');
    const assignment = await resolveAssignmentForDueDateException.call(this, classId, tdfId, assignmentId);
    deps.serverConsole('removeUserDueDateException', userId, tdfId);
    const user = await deps.usersCollection.findOneAsync({ _id: userId });
    if (user.dueDateExceptions) {
      const exceptionIndex = (user.dueDateExceptions as DueDateException[]).findIndex((item: DueDateException) => (
        item.assignmentId === String(assignment._id) && item.courseId === classId
      ));
      if (exceptionIndex > -1) {
        user.dueDateExceptions.splice(exceptionIndex, 1);
      } else {
        deps.serverConsole('removeUserDueDateException ERROR, no exception found', userId, tdfId);
      }
    }
    await deps.usersCollection.updateAsync({ _id: userId }, user);
  }

  return {
    getSourceSentences,
    getAllCourses,
    getAllCourseSections,
    getAllCoursesForInstructor,
    getAllCourseAssignmentsForInstructor,
    getCourseAssignmentEditorSnapshot,
    saveCourseAssignments,
    editCourseAssignments,
    getTdfAssignmentsByCourseIdMap,
    resolveAssignedRootTdfIdsForUser,
    getLearnerCoursesSnapshot,
    getProgressiveAssignmentLaunch,
    invalidateCourseSnapshotForUser,
    invalidateCourseSnapshotsForCourse,
    invalidateCourseSnapshotsForAssignment,
    refreshCourseSnapshotAfterPractice,
    getTdfsAssignedToStudent,
    getTdfNamesAssignedByInstructor,
    getTdfIdsByOwnerId,
    getAllTeachers,
    addCourse,
    editCourse,
    deleteCourse,
    addUserToTeachersClass,
    addUserDueDateException,
    checkForTDFData,
    checkForUserException,
    removeUserDueDateException,
  };
}
