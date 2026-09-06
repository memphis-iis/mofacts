import { Meteor } from 'meteor/meteor';
import { progressiveRevisionPrefix } from '../lib/progressiveAssignmentRevision';
import {
  requireAuthenticatedUser,
  requireUserMatchesOrHasRole,
  type MethodAuthorizationDeps,
} from '../lib/methodAuthorization';
import { decompressHistoryRecord } from '../../common/historyCompression';
import { assertCanonicalHistoryEnvelope, validateHistoryWirePayload } from '../../common/historyEnvelope';
import {
  recordStimulusCrowdOutcome,
  type StimulusCrowdStatsCollection,
} from '../lib/stimulusCrowdStats';
import { createAnalyticsConditionCountMethods } from './analyticsConditionCountMethods';
import { createAnalyticsDownloadMethods } from './analyticsDownloadMethods';
import type { LearningHistoryReadOptions } from '../../../learning-components/units/UnitEngineServerMethods';
import { curSemester } from '../../common/Definitions';
import { collectLessonFamilyRefs, createLessonFamilyResolver } from '../lib/tdfLessonFamilyResolver';
import { createStimulusKey } from '../../../learning-components/runtime/historyStimulusIdentity';
import { normalizeClusterKC } from '../../../learning-components/runtime/sharedModelPracticeIdentity';

type UnknownRecord = Record<string, unknown>;
type Logger = (...args: unknown[]) => void;
type MethodContext = {
  userId?: string | null;
  unblock?: () => void;
  connection?: { id?: string; clientAddress?: string | null } | null;
};

type AnalyticsMethodsDeps = {
  serverConsole: Logger;
  Histories: {
    find: (selector: UnknownRecord, options?: UnknownRecord) => { fetchAsync: () => Promise<any[]>; countAsync: () => Promise<number> };
    findOneAsync: (selector: UnknownRecord, options?: UnknownRecord) => Promise<any>;
    insertAsync: (document: UnknownRecord) => Promise<unknown>;
    rawCollection: () => { aggregate: (pipeline: unknown[]) => { toArray: () => Promise<any[]> } };
  };
  StimulusCrowdStats: StimulusCrowdStatsCollection;
  GlobalExperimentStates: {
    find: (selector: UnknownRecord, options?: UnknownRecord) => { fetchAsync: () => Promise<any[]> };
    findOneAsync: (selector: UnknownRecord, options?: UnknownRecord) => Promise<any>;
    updateAsync: (selector: UnknownRecord, modifier: UnknownRecord) => Promise<unknown>;
    insertAsync: (document: UnknownRecord) => Promise<unknown>;
  };
  Tdfs: {
    find: (selector: UnknownRecord, options?: UnknownRecord) => { fetchAsync: () => Promise<any[]> };
    findOneAsync: (selector: UnknownRecord, options?: UnknownRecord) => Promise<any>;
    updateAsync: (selector: UnknownRecord, modifier: UnknownRecord) => Promise<unknown>;
  };
  Assignments: {
    find: (selector: UnknownRecord, options?: UnknownRecord) => { fetchAsync: () => Promise<any[]> };
    findOneAsync: (selector: UnknownRecord, options?: UnknownRecord) => Promise<any>;
  };
  Courses: {
    find: (selector: UnknownRecord, options?: UnknownRecord) => { fetchAsync: () => Promise<any[]> };
  };
  Sections: {
    find: (selector: UnknownRecord, options?: UnknownRecord) => { fetchAsync: () => Promise<any[]> };
  };
  SectionUserMap: {
    find: (selector: UnknownRecord, options?: UnknownRecord) => { fetchAsync: () => Promise<any[]> };
  };
  usersCollection: {
    find: (selector: UnknownRecord, options?: UnknownRecord) => { fetchAsync: () => Promise<any[]> };
    findOneAsync: (selector: UnknownRecord, options?: UnknownRecord) => Promise<any>;
  };
  getMethodAuthorizationDeps: () => MethodAuthorizationDeps;
  normalizeCanonicalId: (value: unknown) => string | null;
  normalizeOptionalString: (value: unknown) => string | null;
  canViewDashboardTdf: (userId: string, tdf: any) => boolean | Promise<boolean>;
  resolveAssignedRootTdfIdsForUser: (userId: string) => Promise<string[]>;
  allocateNextEventId: () => number;
  syncUsernameCaches: (userId: string, nextUsername: string, previousUsername?: string) => void;
  createExperimentExport: (keys: unknown[], userId: string) => Promise<string>;
  createExperimentExportByTdfIds: (tdfIds: string[], userId: string) => Promise<string>;
  createExperimentExportFromHistories: (histories: any[]) => Promise<string>;
  getTdfIdsByOwnerId: (ownerId: string) => Promise<string[] | null>;
  assertUserOwnsTdfs: (userId: string, keys: unknown[]) => Promise<unknown>;
  canDownloadOwnedTdfData: (userId: string, tdf: any) => boolean;
  getClassPerformanceByTdfWorkflow: (
    classId: string,
    tdfId: string,
    date: number | false,
    deps: any,
    assignmentContext?: { assignmentId?: string | null; dueAt?: Date | number | string | null }
  ) => Promise<unknown>;
  getStimuliSetById: (stimuliSetId: string | number) => Promise<Array<{ clusterKC?: string | number; stimulusKC?: string | number }>>;
  hasMeaningfulProgressSignal: (experimentState: unknown) => boolean;
  onHistoryInserted?: (context: MethodContext, historyRecord: UnknownRecord) => Promise<void>;
};

const INSERT_HISTORY_TIMING_ENABLED = process.env.MOFACTS_INSERT_HISTORY_TIMING === '1';
const INSERT_HISTORY_DIAGNOSTIC_FIELD_LIMIT = 50;
const INSERT_HISTORY_EVENT_CATEGORIES = new Set(['model', 'schedule', 'autotutor', 'sparc']);

function elapsedMsSince(startTime: number): number {
  return Date.now() - startTime;
}

function historyDiagnosticMetadata(record: UnknownRecord) {
  const levelUnitType = typeof record.levelUnitType === 'string' && INSERT_HISTORY_EVENT_CATEGORIES.has(record.levelUnitType)
    ? record.levelUnitType
    : 'other';
  const schemaVersion = Number(record.historySchemaVersion);
  const fieldNames = Object.keys(record).sort().slice(0, INSERT_HISTORY_DIAGNOSTIC_FIELD_LIMIT);
  return {
    eventCategory: levelUnitType,
    historySchemaVersion: Number.isFinite(schemaVersion) ? schemaVersion : null,
    fieldCount: Object.keys(record).length,
    fieldNames,
    fieldNamesTruncated: Object.keys(record).length > fieldNames.length,
  };
}

function getExperimentStateTimestamp(stateDoc: { experimentState?: { lastActionTimeStamp?: unknown } } | null | undefined): number {
  const candidate = Number((stateDoc as any)?.experimentState?.lastActionTimeStamp);
  return Number.isFinite(candidate) ? candidate : 0;
}

function buildLearningHistoryScopeMatch(
  userId: string,
  TDFId: string,
  levelUnit: number,
  unitScopedOnly = false
) {
  const normalizedUnit = Number(levelUnit);
  return {
    userId,
    TDFId,
    levelUnitType: 'model',
    levelUnit: unitScopedOnly ? normalizedUnit : { $lte: normalizedUnit },
  };
}

export function createAnalyticsMethods(deps: AnalyticsMethodsDeps) {
  const lessonFamilies = createLessonFamilyResolver({ tdfs: deps.Tdfs });

  async function validateCourseEnrollmentForUser(userId: string, courseId: string) {
    const activeCourses = await deps.Courses.find(
      { _id: courseId, semester: curSemester },
      { fields: { _id: 1, visibility: 1 } }
    ).fetchAsync();
    if (activeCourses.length === 0) {
      throw new Meteor.Error(403, 'Course assignment history context is not active for current user');
    }
    const course = activeCourses[0];
    if (course?.visibility === 'public') {
      return;
    }

    const sectionRows = await deps.Sections.find(
      { courseId },
      { fields: { _id: 1 } }
    ).fetchAsync();
    const sectionIds = sectionRows
      .map((section: any) => deps.normalizeCanonicalId(section?._id))
      .filter((sectionId: string | null): sectionId is string => typeof sectionId === 'string');
    if (sectionIds.length === 0) {
      throw new Meteor.Error(403, 'Course assignment history context is not available for current user');
    }

    const enrollmentRows = await deps.SectionUserMap.find(
      { userId, sectionId: { $in: sectionIds } },
      { fields: { _id: 1 } }
    ).fetchAsync();
    if (enrollmentRows.length === 0) {
      throw new Meteor.Error(403, 'Course assignment history context is not available for current user');
    }
  }

  async function tdfBelongsToAssignedRoot(assignedTdfId: string, historyTdfId: string): Promise<boolean> {
    if (assignedTdfId === historyTdfId) {
      return true;
    }
    const rootTdf = await deps.Tdfs.findOneAsync(
      { _id: assignedTdfId },
      {
        fields: {
          _id: 1,
          'content.tdfs.tutor.setspec.condition': 1,
          'content.tdfs.tutor.setspec.conditionTdfIds': 1,
        },
      }
    );
    if (!rootTdf) {
      return false;
    }
    const childIds = new Set(
      (await lessonFamilies.resolveConditionChildIdsForRoots([rootTdf]))
        .map((id) => deps.normalizeCanonicalId(id))
        .filter((id): id is string => typeof id === 'string')
    );
    return childIds.has(historyTdfId);
  }

  async function validateCourseAssignmentHistoryContext(historyRecord: UnknownRecord, tdfId: string, userId: string) {
    const context = historyRecord.courseAssignment;
    if (context === undefined || context === null) return null;
    if (!context || typeof context !== 'object' || Array.isArray(context)) {
      throw new Meteor.Error(400, 'Course assignment history context must be an object');
    }
    const record = context as UnknownRecord;
    const assignmentId = deps.normalizeCanonicalId(record.assignmentId);
    const courseId = deps.normalizeCanonicalId(record.courseId);
    const contextTdfId = deps.normalizeCanonicalId(record.TDFId);
    const launchMode = record.launchMode;
    const endpointTdfId = deps.normalizeCanonicalId(record.progressiveEndpointTdfId);
    if (
      record.launchSource !== 'courses'
      || (launchMode !== 'individual' && launchMode !== 'progressive')
      || !assignmentId
      || !courseId
      || !contextTdfId
    ) {
      throw new Meteor.Error(400, 'Course assignment history context is incomplete');
    }
    const assignment = await deps.Assignments.findOneAsync(
      { _id: assignmentId, courseId },
      { fields: { _id: 1, assignmentType: 1, TDFId: 1, memberTdfIds: 1, releaseAt: 1, progressiveRevisions: 1 } }
    );
    if (!assignment) {
      throw new Meteor.Error(400, 'Course assignment history context does not match an assignment');
    }
    let memberTdfIds: string[] = assignment.assignmentType === 'progressive' && Array.isArray(assignment.memberTdfIds)
      ? assignment.memberTdfIds.map((id: unknown) => String(id || '').trim()).filter(Boolean)
      : [];
    if (launchMode === 'individual' && endpointTdfId) {
      throw new Meteor.Error(400, 'Individual course history must not include a progressive endpoint');
    }
    if (assignment.assignmentType === 'lesson') {
      const assignedTdfId = deps.normalizeCanonicalId(assignment.TDFId);
      if (!assignedTdfId || assignedTdfId !== contextTdfId || !await tdfBelongsToAssignedRoot(assignedTdfId, tdfId)) {
        throw new Meteor.Error(400, 'Course assignment history TDFId does not match launched TDFId');
      }
      if (launchMode !== 'individual') throw new Meteor.Error(400, 'Lesson assignments do not support progressive launch mode');
    } else if (assignment.assignmentType === 'progressive') {
      if (!memberTdfIds.includes(contextTdfId) || !memberTdfIds.includes(tdfId)
        || (launchMode === 'progressive' && !memberTdfIds.includes(endpointTdfId || ''))) {
        throw new Meteor.Error(403, 'Progressive source or endpoint is no longer assigned');
      }
      if (launchMode === 'progressive') {
        memberTdfIds = progressiveRevisionPrefix(assignment, record.progressiveRevisionId, endpointTdfId || '');
        memberTdfIds = memberTdfIds.filter((id) => assignment.memberTdfIds.includes(id));
      }
      if (!memberTdfIds.includes(contextTdfId) || !memberTdfIds.includes(tdfId)) {
        throw new Meteor.Error(400, 'Source TDF is outside the authorized progressive lessons');
      }
      if (launchMode === 'progressive' && (!endpointTdfId || !memberTdfIds.includes(endpointTdfId))) {
        throw new Meteor.Error(400, 'Progressive assignment endpoint is no longer a member');
      }
    } else {
      throw new Meteor.Error(400, 'Course assignment has an invalid assignment type');
    }
    const releaseAt = assignment.releaseAt ? new Date(assignment.releaseAt) : null;
    if (releaseAt && Number.isFinite(releaseAt.getTime()) && releaseAt.getTime() > Date.now()) {
      throw new Meteor.Error(403, 'Course assignment has not been released');
    }
    await validateCourseEnrollmentForUser(userId, courseId);
    return { assignment, courseId, contextTdfId, endpointTdfId, launchMode, memberTdfIds };
  }

  async function clusterKcsForTdfIds(tdfIds: string[]): Promise<string[]> {
    if (tdfIds.length === 0) return [];
    const tdfs = await deps.Tdfs.find(
      { _id: { $in: [...new Set(tdfIds)] } },
      { fields: { _id: 1, 'content.tdfs.tutor.unit': 1, 'rawStimuliFile.setspec.clusters': 1 } },
    ).fetchAsync();
    const clusterKcs = new Set<string>();
    for (const tdf of tdfs) {
      const clusterList = tdf?.content?.tdfs?.tutor?.unit?.[1]?.learningsession?.clusterlist;
      if (typeof clusterList !== 'string') continue;
      const indexes: number[] = [];
      for (const token of clusterList.trim().split(/\s+/)) {
        const [startRaw, endRaw] = token.split('-');
        const start = Number(startRaw);
        const end = endRaw === undefined ? start : Number(endRaw);
        if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start) continue;
        for (let index = start; index <= end; index += 1) indexes.push(index);
      }
      const clusters = tdf?.rawStimuliFile?.setspec?.clusters;
      if (!Array.isArray(clusters)) continue;
      for (const index of indexes) {
        const clusterKC = clusters[index]?.clusterKC;
        if (clusterKC !== undefined && clusterKC !== null && String(clusterKC).trim()) {
          clusterKcs.add(normalizeClusterKC(clusterKC));
        }
      }
    }
    return [...clusterKcs];
  }

  async function buildCourseLearningHistoryScopeMatch(
    userId: string,
    TDFId: string,
    options: LearningHistoryReadOptions,
  ): Promise<UnknownRecord> {
    const context = options.courseAssignment;
    if (!context || typeof context !== 'object' || Array.isArray(context)) {
      throw new Meteor.Error(400, 'Course-scoped learning history requires courseAssignment context');
    }
    const validated = await validateCourseAssignmentHistoryContext({ courseAssignment: context }, TDFId, userId);
    if (!validated) throw new Meteor.Error(400, 'Course-scoped learning history requires a valid assignment');
    const sourceTdfIds = validated.launchMode === 'progressive'
      ? validated.memberTdfIds.slice(0, validated.memberTdfIds.indexOf(validated.endpointTdfId!) + 1)
      : [validated.contextTdfId];
    const scopeTerms: UnknownRecord[] = [{ TDFId: { $in: sourceTdfIds } }];
    if (validated.launchMode === 'individual') {
      const clusterKcs = await clusterKcsForTdfIds(sourceTdfIds);
      if (clusterKcs.length === 0) {
        return { userId, levelUnitType: 'model', $or: scopeTerms };
      }
      scopeTerms.push({
        'courseAssignment.courseId': validated.courseId,
        clusterKC: { $in: clusterKcs },
      });
    }
    return {
      userId,
      levelUnitType: 'model',
      $or: scopeTerms,
    };
  }

  async function rejectMissingCourseAssignmentContextForAssignedTdf(
    userId: string,
    tdfId: string,
    context: unknown,
    reason: string,
  ) {
    if (context !== undefined && context !== null) {
      return;
    }
    if (await userHasReleasedProgressiveAccess(userId, tdfId)) {
      return;
    }
    const assignedRootTdfIds = await deps.resolveAssignedRootTdfIdsForUser(userId);
    for (const assignedRootTdfId of assignedRootTdfIds) {
      const normalizedAssignedRootTdfId = deps.normalizeCanonicalId(assignedRootTdfId);
      if (
        normalizedAssignedRootTdfId &&
        await tdfBelongsToAssignedRoot(normalizedAssignedRootTdfId, tdfId)
      ) {
        throw new Meteor.Error(403, reason);
      }
    }
  }

  async function userHasReleasedProgressiveAccess(userId: string, tdfId: string): Promise<boolean> {
    const rows = await deps.Assignments.find(
      {
        assignmentType: 'progressive',
        memberTdfIds: tdfId,
        $or: [{ releaseAt: null }, { releaseAt: { $exists: false } }, { releaseAt: { $lte: new Date() } }],
      },
      { fields: { courseId: 1 } },
    ).fetchAsync();
    for (const row of rows) {
      const courseId = deps.normalizeCanonicalId(row?.courseId);
      if (!courseId) continue;
      try {
        await validateCourseEnrollmentForUser(userId, courseId);
        return true;
      } catch (error) {
        if (!(error instanceof Meteor.Error) || error.error !== 403) throw error;
      }
    }
    return false;
  }

  const validatedExperimentAccessCache = new Map<string, number>();
  const assignedConditionAccessCache = new Map<string, { cachedAt: number; rootTdfId: string; experimentState: UnknownRecord }>();
  const EXPERIMENT_ACCESS_CACHE_TTL = 5 * 60 * 1000;

  function experimentAccessCacheKey(userId: string, rootTdfId: string) {
    return `${userId}:${rootTdfId}`;
  }

  function conditionAssignmentCacheKey(userId: string, conditionTdfId: string) {
    return `${userId}:${conditionTdfId}`;
  }

  async function validateExperimentStateMutation(
    actorUserId: string | null | undefined,
    rootTdfId: unknown,
    state: UnknownRecord = {},
    where = 'unknown'
  ) {
    const normalizedActorUserId = deps.normalizeCanonicalId(actorUserId);
    const normalizedRootTdfId = deps.normalizeCanonicalId(rootTdfId);
    if (!normalizedActorUserId) {
      throw new Meteor.Error(401, 'Must be logged in');
    }
    if (!normalizedRootTdfId) {
      throw new Meteor.Error(400, 'Invalid currentTdfId for experiment state mutation');
    }

    const cacheKey = experimentAccessCacheKey(normalizedActorUserId, normalizedRootTdfId);
    const cachedAt = validatedExperimentAccessCache.get(cacheKey);
    const conditionTdfId = deps.normalizeCanonicalId((state as any)?.conditionTdfId);
    const needsRootAccessCheck = !cachedAt || (Date.now() - cachedAt) > EXPERIMENT_ACCESS_CACHE_TTL;

    let rootTdf: any = null;
    if (needsRootAccessCheck || conditionTdfId) {
      rootTdf = await deps.Tdfs.findOneAsync(
        { _id: normalizedRootTdfId },
        { fields: { ownerId: 1, accessors: 1, 'content.tdfs.tutor.setspec': 1 } }
      );
      if (!rootTdf) {
        throw new Meteor.Error(404, 'Root TDF not found');
      }
    }

    if (needsRootAccessCheck) {
      const userDoc = await deps.usersCollection.findOneAsync(
        { _id: normalizedActorUserId },
        { fields: { profile: 1, loginParams: 1 } }
      );
      const assignedTdfIds = await deps.resolveAssignedRootTdfIdsForUser(normalizedActorUserId);
      const hasAssignedRootTdf = assignedTdfIds.includes(normalizedRootTdfId);
      const rootUserSelect = deps.normalizeOptionalString((rootTdf as any)?.content?.tdfs?.tutor?.setspec?.userselect);
      const rootIsSelfSelectable = rootUserSelect === 'true';
      const rootExperimentTarget = deps.normalizeOptionalString((rootTdf as any)?.content?.tdfs?.tutor?.setspec?.experimentTarget);
      const userExperimentTarget = deps.normalizeOptionalString((userDoc as any)?.profile?.experimentTarget);
      const stateExperimentTarget = deps.normalizeOptionalString((state as any)?.experimentTarget);
      const userLoginMode = deps.normalizeOptionalString((userDoc as any)?.loginParams?.loginMode);
      const experimentModeTargetMatch =
        userLoginMode === 'experiment' && !!rootExperimentTarget && (
          (userExperimentTarget === rootExperimentTarget) ||
          (stateExperimentTarget === rootExperimentTarget)
        );
      const existingStateForRoot = await deps.GlobalExperimentStates.findOneAsync(
        { userId: normalizedActorUserId, TDFId: normalizedRootTdfId },
        { fields: { _id: 1 } }
      );
      const canAccessRoot = await deps.canViewDashboardTdf(normalizedActorUserId, rootTdf)
        || hasAssignedRootTdf
        || rootIsSelfSelectable
        || (!!rootExperimentTarget && !!userExperimentTarget && rootExperimentTarget === userExperimentTarget)
        || experimentModeTargetMatch
        || !!existingStateForRoot;
      if (!canAccessRoot) {
        deps.serverConsole('validateExperimentStateMutation DENY root access', {
          where,
          userId: normalizedActorUserId,
          rootTdfId: normalizedRootTdfId,
          rootExperimentTarget: rootExperimentTarget || null,
          userExperimentTarget: userExperimentTarget || null,
          stateExperimentTarget: stateExperimentTarget || null,
          userLoginMode: userLoginMode || null,
          rootIsSelfSelectable,
          assignedTdfCount: assignedTdfIds.length,
          hasAssignedRootTdf,
          hasExistingStateForRoot: !!existingStateForRoot,
        });
        throw new Meteor.Error(403, 'Not authorized to mutate experiment state for this root TDF');
      }

      validatedExperimentAccessCache.set(cacheKey, Date.now());
    }

    if (conditionTdfId) {
      const conditionDoc = await deps.Tdfs.findOneAsync(
        { _id: conditionTdfId },
        { fields: { _id: 1, 'content.fileName': 1 } }
      );
      const conditionChildToRootMap = conditionDoc
        ? lessonFamilies.buildChildToRootMap([rootTdf], [conditionDoc])
        : new Map<string, string>();
      const isAllowedCondition = conditionChildToRootMap.get(conditionTdfId) === normalizedRootTdfId;
      if (!isAllowedCondition) {
        const conditionRefs = collectLessonFamilyRefs([rootTdf]);
        deps.serverConsole('validateExperimentStateMutation DENY condition', {
          where,
          userId: normalizedActorUserId,
          rootTdfId: normalizedRootTdfId,
          conditionTdfId,
          normalizedConditionRefs: conditionRefs.conditionFileNames,
          normalizedResolvedConditionIds: conditionRefs.conditionTdfIds,
          conditionFileName: deps.normalizeCanonicalId((conditionDoc as any)?.content?.fileName),
        });
        throw new Meteor.Error(403, 'conditionTdfId is not valid for current root TDF');
      }
    }

    deps.serverConsole('validateExperimentStateMutation', where, {
      userId: normalizedActorUserId,
      currentTdfId: normalizedRootTdfId,
      currentStimuliSetId: deps.normalizeCanonicalId((state as any)?.currentStimuliSetId),
      conditionTdfId: conditionTdfId || null,
      experimentTarget: deps.normalizeOptionalString((state as any)?.experimentTarget) || null,
    });
  }

  async function getExperimentState(userId: string, TDFId: string) {
    const experimentStateRet = await deps.GlobalExperimentStates.find({ userId, TDFId }).fetchAsync();
    if (experimentStateRet.length <= 1) {
      const doc = experimentStateRet[0];
      const state = doc?.experimentState || {};
      state.id = doc?._id || null;
      return state;
    }

    const sortedExperimentStates = [...experimentStateRet].sort((a: any, b: any) => {
      const tsDiff = getExperimentStateTimestamp(a) - getExperimentStateTimestamp(b);
      if (tsDiff !== 0) {
        return tsDiff;
      }
      return String(a?._id || '').localeCompare(String(b?._id || ''));
    });
    const mergedExperimentState: { experimentState?: UnknownRecord } = {};
    for (const experimentState of sortedExperimentStates) {
      mergedExperimentState.experimentState = Object.assign({}, mergedExperimentState.experimentState, experimentState.experimentState);
    }
    const experimentState = mergedExperimentState && mergedExperimentState.experimentState ? mergedExperimentState.experimentState : {};
    const newestDoc = sortedExperimentStates.length > 0
      ? sortedExperimentStates[sortedExperimentStates.length - 1]
      : null;
    experimentState.id = newestDoc ? newestDoc._id : null;
    return experimentState;
  }

  async function setExperimentState(
    userId: string,
    TDFId: string,
    experimentStateId: string,
    newExperimentState: UnknownRecord,
    where: string
  ) {
    await validateExperimentStateMutation(userId, TDFId, newExperimentState, where || 'setExperimentState');
    deps.serverConsole('setExperimentState:', where, {
      userId,
      currentTdfId: TDFId,
      currentStimuliSetId: (newExperimentState as any)?.currentStimuliSetId ?? null,
      conditionTdfId: (newExperimentState as any)?.conditionTdfId ?? null,
      experimentTarget: (newExperimentState as any)?.experimentTarget ?? null,
    });
    const experimentStateRet = await deps.GlobalExperimentStates.findOneAsync({ _id: experimentStateId });
    if (experimentStateRet != null) {
      const updatedExperimentState = Object.assign(experimentStateRet.experimentState, newExperimentState);
      await deps.GlobalExperimentStates.updateAsync({ _id: experimentStateId }, { $set: { experimentState: updatedExperimentState } });
      return updatedExperimentState;
    }
    await deps.GlobalExperimentStates.insertAsync({ userId, TDFId, experimentState: newExperimentState });

    return TDFId;
  }

  async function createExperimentState(
    this: MethodContext | undefined,
    curExperimentState: UnknownRecord & { currentRootTdfId?: string; currentTdfId?: string },
    actorUserId: string | null = null,
    options: { replaceExistingState?: boolean } = {},
  ) {
    const resolvedUserId = actorUserId || this?.userId || Meteor.userId();
    const rootTdfId = deps.normalizeCanonicalId((curExperimentState as any)?.currentRootTdfId)
      || deps.normalizeCanonicalId(curExperimentState.currentTdfId);
    if (!rootTdfId) {
      throw new Meteor.Error(400, 'createExperimentState requires currentRootTdfId/currentTdfId');
    }
    await validateExperimentStateMutation(resolvedUserId, rootTdfId, curExperimentState, 'createExperimentState');
    deps.serverConsole('createExperimentState', {
      userId: resolvedUserId,
      currentTdfId: rootTdfId,
      currentStimuliSetId: (curExperimentState as any)?.currentStimuliSetId ?? null,
      conditionTdfId: (curExperimentState as any)?.conditionTdfId ?? null,
      experimentTarget: (curExperimentState as any)?.experimentTarget ?? null,
    });
    const existingDoc = await deps.GlobalExperimentStates.findOneAsync({
      userId: resolvedUserId,
      TDFId: rootTdfId,
    });

    if (existingDoc?._id) {
      const nextExperimentState = options.replaceExistingState
        ? Object.assign({}, curExperimentState)
        : Object.assign({}, existingDoc.experimentState || {}, curExperimentState);
      await deps.GlobalExperimentStates.updateAsync(
        { _id: existingDoc._id },
        { $set: { experimentState: nextExperimentState } }
      );
      return Object.assign({}, nextExperimentState, { id: existingDoc._id });
    }

    try {
      const insertedId = await deps.GlobalExperimentStates.insertAsync({
        userId: resolvedUserId,
        TDFId: rootTdfId,
        experimentState: curExperimentState,
      });
      return Object.assign({}, curExperimentState, { id: insertedId });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      if (!/E11000|duplicate key/i.test(message)) {
        throw error;
      }

      const concurrentDoc = await deps.GlobalExperimentStates.findOneAsync({
        userId: resolvedUserId,
        TDFId: rootTdfId,
      });
      if (!concurrentDoc?._id) {
        throw error;
      }

      const nextExperimentState = options.replaceExistingState
        ? Object.assign({}, curExperimentState)
        : Object.assign({}, concurrentDoc.experimentState || {}, curExperimentState);
      await deps.GlobalExperimentStates.updateAsync(
        { _id: concurrentDoc._id },
        { $set: { experimentState: nextExperimentState } }
      );
      return Object.assign({}, nextExperimentState, { id: concurrentDoc._id });
    }
  }

  async function getUserLastFeedbackTypeFromHistory(tdfID: string) {
    const userHistory = await deps.Histories.findOneAsync(
      { TDFId: tdfID, userId: (Meteor as any).userId },
      { sort: { time: -1 } }
    );
    let feedbackType = 'undefined';
    if (userHistory && userHistory.feedbackType) {
      feedbackType = userHistory.feedbackType;
    }
    return feedbackType;
  }

  async function insertHistory(this: MethodContext, historyRecord: UnknownRecord) {
    const methodStartTime = Date.now();
    const actingUserId = requireAuthenticatedUser(this.userId, 'Must be logged in', 401);
    if (!historyRecord || typeof historyRecord !== 'object' || Array.isArray(historyRecord)) {
      throw new Meteor.Error(400, 'Invalid history record');
    }
    try {
      validateHistoryWirePayload(historyRecord);
    } catch (error: unknown) {
      throw new Meteor.Error(400, error instanceof Error ? error.message : String(error));
    }

    const decompressStartTime = Date.now();
    const decompressedRecord = decompressHistoryRecord(historyRecord);
    const decompressMs = elapsedMsSince(decompressStartTime);

    const sanitizeStartTime = Date.now();
    const requestedUserId = deps.normalizeCanonicalId(decompressedRecord.userId);
    if (requestedUserId && requestedUserId !== actingUserId) {
      throw new Meteor.Error(403, 'Can only insert history for the current user');
    }
    const tdfId = deps.normalizeCanonicalId(decompressedRecord.TDFId);
    if (!tdfId) {
      throw new Meteor.Error(400, 'History record requires a TDFId');
    }
    try {
      assertCanonicalHistoryEnvelope(decompressedRecord);
    } catch (error: unknown) {
      throw new Meteor.Error(400, error instanceof Error ? error.message : String(error));
    }
    await validateCourseAssignmentHistoryContext(decompressedRecord, tdfId, actingUserId);
    const sanitizeMs = elapsedMsSince(sanitizeStartTime);

    const authorizationStartTime = Date.now();
    await validateHistoryWriteAccess(actingUserId, tdfId, decompressedRecord);
    const authorizationMs = elapsedMsSince(authorizationStartTime);

    const recordBuildStartTime = Date.now();
    const sanitizedHistoryRecord = Object.assign({}, decompressedRecord, {
      userId: actingUserId,
      TDFId: tdfId,
      eventId: deps.allocateNextEventId(),
      dynamicTagFields: [],
      recordedServerTime: (new Date()).getTime(),
    });
    const recordBuildMs = elapsedMsSince(recordBuildStartTime);
    let rawPayloadBytes: number | undefined;
    let finalRecordBytes: number | undefined;
    if (INSERT_HISTORY_TIMING_ENABLED) {
      rawPayloadBytes = Buffer.byteLength(JSON.stringify(historyRecord), 'utf8');
      finalRecordBytes = Buffer.byteLength(JSON.stringify(sanitizedHistoryRecord), 'utf8');
    }

    const insertStartTime = Date.now();
    await deps.Histories.insertAsync(sanitizedHistoryRecord);
    const insertMs = elapsedMsSince(insertStartTime);
    const crowdStatsStartTime = Date.now();
    await recordStimulusCrowdOutcome(deps.StimulusCrowdStats, sanitizedHistoryRecord);
    const crowdStatsMs = elapsedMsSince(crowdStatsStartTime);
    if (deps.onHistoryInserted) {
      try {
        await deps.onHistoryInserted(this, sanitizedHistoryRecord);
      } catch (error) {
        deps.serverConsole('[insertHistory] Dashboard cache update failed after history insert', {
          ...historyDiagnosticMetadata(sanitizedHistoryRecord),
          errorType: error instanceof Error ? error.name : typeof error,
        });
      }
    }

    if (INSERT_HISTORY_TIMING_ENABLED) {
      deps.serverConsole('[insertHistory timing]', {
        ...historyDiagnosticMetadata(sanitizedHistoryRecord),
        rawPayloadBytes,
        finalRecordBytes,
        decompressMs,
        sanitizeMs,
        authorizationMs,
        recordBuildMs,
        insertMs,
        crowdStatsMs,
        totalMs: elapsedMsSince(methodStartTime),
      });
    }
  }

  async function getLastTDFAccessed(userId: string) {
    const lastExperimentStateUpdated = await deps.GlobalExperimentStates.findOneAsync(
      { userId },
      { sort: { 'experimentState.lastActionTimeStamp': -1 }, limit: 1 }
    );
    if (!lastExperimentStateUpdated?.TDFId) {
      return null;
    }
    return lastExperimentStateUpdated.TDFId;
  }

  async function getHistoryByTDFID(TDFId: string) {
    return await deps.Histories.find({ TDFId }).fetchAsync();
  }

  async function getStimulusCrowdStatsForDeck(
    this: MethodContext,
    TDFId: string,
    stimulusIdentities: unknown[],
    options: Pick<LearningHistoryReadOptions, 'courseAssignment'> = {},
  ) {
    const actorUserId = requireAuthenticatedUser(this.userId, 'Must be logged in', 401);
    const normalizedTdfId = deps.normalizeCanonicalId(TDFId);
    if (!normalizedTdfId) {
      throw new Meteor.Error(400, 'Invalid TDFId');
    }
    if (!Array.isArray(stimulusIdentities)) {
      throw new Meteor.Error(400, 'stimulusIdentities must be an array');
    }

    const normalizedIdentities = stimulusIdentities.map((value) => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Meteor.Error(400, 'stimulusIdentities must contain identity objects');
      }
      const record = value as UnknownRecord;
      const stimuliSetId = typeof record.stimuliSetId === 'number' && Number.isFinite(record.stimuliSetId)
        ? record.stimuliSetId
        : deps.normalizeOptionalString(record.stimuliSetId);
      const stimulusKC = typeof record.stimulusKC === 'number' && Number.isFinite(record.stimulusKC)
        ? record.stimulusKC
        : deps.normalizeOptionalString(record.stimulusKC);
      if (stimuliSetId === null || stimulusKC === null) {
        throw new Meteor.Error(400, 'Stimulus identities require stimuliSetId and stimulusKC');
      }
      return { stimuliSetId, stimulusKC };
    });
    if (normalizedIdentities.length === 0) {
      return [];
    }

    const tdf = await assertCrowdStatsReadAccess(actorUserId, normalizedTdfId, options);
    const anchorStimuliSetId = tdf?.stimuliSetId;
    if (anchorStimuliSetId === undefined || anchorStimuliSetId === null || (typeof anchorStimuliSetId === 'string' && anchorStimuliSetId.trim().length === 0)) {
      throw new Meteor.Error(400, 'TDF is missing stimuliSetId for stimulus crowd stats');
    }
    const allowedStimuliSetIds = new Set([String(anchorStimuliSetId)]);
    if (options.courseAssignment?.launchMode === 'progressive') {
      const validated = await validateCourseAssignmentHistoryContext(
        { courseAssignment: options.courseAssignment },
        normalizedTdfId,
        actorUserId,
      );
      if (!validated) throw new Meteor.Error(400, 'Progressive crowd stats require a valid assignment');
      const prefixIds = validated.memberTdfIds.slice(0, validated.memberTdfIds.indexOf(validated.endpointTdfId!) + 1);
      const prefixTdfs = await deps.Tdfs.find(
        { _id: { $in: prefixIds } },
        { fields: { stimuliSetId: 1 } },
      ).fetchAsync();
      for (const prefixTdf of prefixTdfs) {
        if (prefixTdf?.stimuliSetId !== undefined && prefixTdf?.stimuliSetId !== null) {
          allowedStimuliSetIds.add(String(prefixTdf.stimuliSetId));
        }
      }
    }
    for (const identity of normalizedIdentities) {
      if (!allowedStimuliSetIds.has(String(identity.stimuliSetId))) {
        throw new Meteor.Error(403, 'Stimulus identity is outside the authorized lesson scope');
      }
    }
    const stimulusKeys = [...new Set(normalizedIdentities.map(createStimulusKey))];
    const stats = await deps.StimulusCrowdStats.find(
      { stimulusKey: { $in: stimulusKeys } },
      {
        fields: {
          _id: 0,
          stimulusKey: 1,
          stimuliSetId: 1,
          stimulusKC: 1,
          KCId: 1,
          correctCount: 1,
          incorrectCount: 1,
          totalCount: 1,
        },
      }
    ).fetchAsync();

    return stats.map((stat) => ({
      stimulusKey: stat.stimulusKey,
      stimuliSetId: stat.stimuliSetId,
      stimulusKC: stat.stimulusKC,
      KCId: stat.KCId,
      correctCount: Number(stat.correctCount) || 0,
      incorrectCount: Number(stat.incorrectCount) || 0,
      totalCount: Number(stat.totalCount) || 0,
    }));
  }

  async function assertCrowdStatsReadAccess(
    actorUserId: string,
    tdfId: string,
    options: Pick<LearningHistoryReadOptions, 'courseAssignment'> = {},
  ) {
    const tdf = await deps.Tdfs.findOneAsync(
      { _id: tdfId },
      { fields: { _id: 1, ownerId: 1, accessors: 1, stimuliSetId: 1, 'content.tdfs.tutor.setspec': 1 } }
    );
    if (!tdf) {
      throw new Meteor.Error(404, 'TDF not found');
    }
    if (options.courseAssignment) {
      await validateCourseAssignmentHistoryContext({ courseAssignment: options.courseAssignment }, tdfId, actorUserId);
      return tdf;
    }
    if (await userHasReleasedProgressiveAccess(actorUserId, tdfId)) {
      return tdf;
    }
    await rejectMissingCourseAssignmentContextForAssignedTdf(
      actorUserId,
      tdfId,
      options.courseAssignment,
      'Course-assigned crowd stats require courseAssignment context',
    );
    if (await deps.canViewDashboardTdf(actorUserId, tdf)) {
      return tdf;
    }

    const assignedTdfIds = await deps.resolveAssignedRootTdfIdsForUser(actorUserId);
    if (assignedTdfIds.includes(tdfId)) {
      return tdf;
    }

    const setspec = (tdf as any)?.content?.tdfs?.tutor?.setspec || {};
    const rootUserSelect = deps.normalizeOptionalString(setspec.userselect);
    const rootExperimentTarget = deps.normalizeOptionalString(setspec.experimentTarget);
    const userDoc = await deps.usersCollection.findOneAsync(
      { _id: actorUserId },
      { fields: { profile: 1, loginParams: 1 } }
    );
    const userExperimentTarget = deps.normalizeOptionalString((userDoc as any)?.profile?.experimentTarget);
    const userLoginMode = deps.normalizeOptionalString((userDoc as any)?.loginParams?.loginMode);
    if (
      rootUserSelect === 'true'
      || (!!rootExperimentTarget && rootExperimentTarget === userExperimentTarget)
      || (userLoginMode === 'experiment' && !!rootExperimentTarget && rootExperimentTarget === userExperimentTarget)
    ) {
      return tdf;
    }

    const existingStateForTdf = await deps.GlobalExperimentStates.findOneAsync(
      {
        userId: actorUserId,
        $or: [
          { TDFId: tdfId },
          { 'experimentState.currentTdfId': tdfId },
          { 'experimentState.conditionTdfId': tdfId },
        ],
      },
      { fields: { _id: 1 } }
    );
    if (existingStateForTdf) {
      return tdf;
    }

    throw new Meteor.Error(403, 'Not authorized to access stimulus crowd stats for this TDF');
  }

  async function validateHistoryWriteAccess(
    actingUserId: string,
    tdfId: string,
    decompressedRecord: UnknownRecord
  ) {
    const courseAssignment = decompressedRecord.courseAssignment;
    if (courseAssignment && typeof courseAssignment === 'object' && !Array.isArray(courseAssignment)) {
      const assignedCourseRootTdfId = deps.normalizeCanonicalId((courseAssignment as UnknownRecord).TDFId);
      if (!assignedCourseRootTdfId) {
        throw new Meteor.Error(400, 'Course assignment history context is incomplete');
      }
      await validateCourseAssignmentHistoryContext(decompressedRecord, tdfId, actingUserId);
      return;
    }

    await rejectMissingCourseAssignmentContextForAssignedTdf(
      actingUserId,
      tdfId,
      courseAssignment,
      'Course-assigned history requires courseAssignment context',
    );

    const cacheKey = conditionAssignmentCacheKey(actingUserId, tdfId);
    const cachedAssignment = assignedConditionAccessCache.get(cacheKey);
    let assignedRootTdfId =
      cachedAssignment && (Date.now() - cachedAssignment.cachedAt) <= EXPERIMENT_ACCESS_CACHE_TTL
        ? cachedAssignment.rootTdfId
        : null;
    let assignedState = cachedAssignment?.experimentState || {};

    if (!assignedRootTdfId) {
      const assignmentDoc = await deps.GlobalExperimentStates.findOneAsync(
        {
          userId: actingUserId,
          $or: [
            { 'experimentState.conditionTdfId': tdfId },
            { 'experimentState.currentTdfId': tdfId },
          ],
        },
        {
          fields: {
            TDFId: 1,
            experimentState: 1,
          },
          sort: {
            'experimentState.lastActionTimeStamp': -1,
          },
        }
      );
      assignedRootTdfId = deps.normalizeCanonicalId(assignmentDoc?.TDFId);
      assignedState = (assignmentDoc?.experimentState || {}) as UnknownRecord;
      if (assignedRootTdfId) {
        assignedConditionAccessCache.set(cacheKey, {
          cachedAt: Date.now(),
          rootTdfId: assignedRootTdfId,
          experimentState: assignedState,
        });
      }
    }

    if (assignedRootTdfId && assignedRootTdfId !== tdfId) {
      await validateExperimentStateMutation(
        actingUserId,
        assignedRootTdfId,
        {
          ...assignedState,
          currentRootTdfId: assignedRootTdfId,
          currentTdfId: tdfId,
          conditionTdfId: tdfId,
          experimentTarget:
            deps.normalizeOptionalString((decompressedRecord as any).experimentTarget)
            || deps.normalizeOptionalString((assignedState as any).experimentTarget),
        },
        'methods.insertHistory.assignedCondition'
      );
      return;
    }

    await validateExperimentStateMutation(
      actingUserId,
      tdfId,
      {
        currentTdfId: tdfId,
        conditionTdfId: deps.normalizeCanonicalId((decompressedRecord as any).conditionTdfId),
        experimentTarget: deps.normalizeOptionalString((decompressedRecord as any).experimentTarget),
      },
      'methods.insertHistory'
    );
  }

  async function getUserRecentTDFs(userId: string) {
    const history = await deps.Histories.find({ userId }, { sort: { time: -1 }, limit: 5 }).fetchAsync();
    const recentTdfIds = history
      .map((historyRecord: any) => deps.normalizeCanonicalId(historyRecord?.TDFId))
      .filter((tdfId: string | null): tdfId is string => typeof tdfId === 'string');
    if (recentTdfIds.length === 0) {
      return [];
    }

    const recentTdfDocs = await deps.Tdfs.find({ _id: { $in: [...new Set(recentTdfIds)] } }).fetchAsync();
    const recentTdfById = new Map(
      recentTdfDocs.map((tdf: any) => [String(tdf?._id || ''), tdf])
    );
    return recentTdfIds.map((tdfId: string) => recentTdfById.get(tdfId));
  }

  async function getClassPerformanceByTDF(this: MethodContext, classId: string, tdfId: string, date: number | false = false) {
    if (!this.userId) {
      throw new Meteor.Error(401, 'Must be logged in');
    }
    const course = (await deps.Courses.find(
      { _id: classId },
      { fields: { teacherUserId: 1 } }
    ).fetchAsync())[0];
    if (!course) {
      throw new Meteor.Error(404, 'Course not found');
    }
    await requireUserMatchesOrHasRole(deps.getMethodAuthorizationDeps(), {
      actingUserId: this.userId,
      subjectUserId: course.teacherUserId,
      roles: ['admin'],
      notLoggedInMessage: 'Must be logged in',
      notLoggedInCode: 401,
      forbiddenMessage: 'Can only access performance for your own course',
      forbiddenCode: 403,
    });
    const assignment = await deps.Assignments.findOneAsync(
      { courseId: classId, $or: [{ TDFId: tdfId }, { assignmentType: 'progressive', memberTdfIds: tdfId }] },
      { fields: { _id: 1, dueAt: 1 } }
    );
    return deps.getClassPerformanceByTdfWorkflow(classId, tdfId, date, {
      serverConsole: deps.serverConsole,
      Sections: deps.Sections,
      SectionUserMap: deps.SectionUserMap,
      Histories: deps.Histories,
      findUsersByIds: (userIds: string[]) => deps.usersCollection.find(
        { _id: { $in: userIds } },
        { fields: { _id: 1, username: 1, dueDateExceptions: 1 } }
      ).fetchAsync(),
    }, assignment ? { assignmentId: String(assignment._id || ''), dueAt: assignment.dueAt ?? null } : undefined);
  }

  async function getStimSetFromLearningSessionByClusterList(stimuliSetId: string | number, clusterList: Array<string | number>) {
    deps.serverConsole('getStimSetFromLearningSessionByClusterList', stimuliSetId, clusterList);
    const itemRet = await deps.getStimuliSetById(stimuliSetId);
    const learningSessionItem: Array<string | number> = [];
    for (const item of itemRet) {
      const clusterKC = item.clusterKC;
      const stimulusKC = item.stimulusKC;
      if (
        typeof clusterKC !== 'undefined' &&
        typeof stimulusKC !== 'undefined' &&
        clusterList.includes(clusterKC) &&
        learningSessionItem.includes(stimulusKC) === false
      ) {
        learningSessionItem.push(stimulusKC);
      }
    }
    return learningSessionItem;
  }

  async function getStudentPerformanceByIdAndTDFIdFromHistory(userId: string, TDFId: string, returnRows: number | null = null) {
    const query: unknown[] = [
      {
        $match: { userId, TDFId, levelUnitType: 'model' },
      },
      {
        $addFields: {
          correct: {
            $cond: {
              if: { $eq: ['$outcome', 'correct'] },
              then: 1,
              else: 0,
            },
          },
          incorrect: {
            $cond: {
              if: { $eq: ['$outcome', 'incorrect'] },
              then: 1,
              else: 0,
            },
          },
          practiceDuration: { $sum: ['$CFFeedbackLatency', '$CFEndLatency'] },
        },
      },
      {
        $group: {
          _id: '$stimulusKC',
          numCorrect: { $sum: '$correct' },
          numIncorrect: { $sum: '$incorrect' },
          practiceDuration: { $sum: '$practiceDuration' },
        },
      },
      {
        $addFields: {
          introduced: 1,
        },
      },
      {
        $group: {
          _id: null,
          numCorrect: { $sum: '$numCorrect' },
          numIncorrect: { $sum: '$numIncorrect' },
          stimsIntroduced: { $sum: '$introduced' },
          practiceDuration: { $sum: '$practiceDuration' },
        },
      },
      {
        $project: {
          _id: 0,
        },
      },
    ];

    if (returnRows) {
      query.splice(1, 0, { $limit: returnRows });
      query.splice(1, 0, { $sort: { time: -1 } });
    }
    const studentPerformance = await deps.Histories.rawCollection().aggregate(query).toArray();
    if (!studentPerformance[0]) {
      return null;
    }

    const tdf = await deps.Tdfs.findOneAsync({ _id: TDFId }, { fields: { stimuli: 1 } });
    studentPerformance[0].totalStimCount = Array.isArray(tdf?.stimuli) ? tdf.stimuli.length : 0;
    return studentPerformance[0];
  }

  async function getStudentPerformanceForUnitFromHistory(
    userId: string,
    TDFId: string,
    levelUnit: number,
    unitScopedOnly = false
  ) {
    const query: unknown[] = [
      {
        $match: buildLearningHistoryScopeMatch(userId, TDFId, levelUnit, unitScopedOnly),
      },
      {
        $addFields: {
          correct: {
            $cond: {
              if: { $eq: ['$outcome', 'correct'] },
              then: 1,
              else: 0,
            },
          },
          incorrect: {
            $cond: {
              if: { $eq: ['$outcome', 'incorrect'] },
              then: 1,
              else: 0,
            },
          },
          practiceDuration: { $sum: ['$CFFeedbackLatency', '$CFEndLatency'] },
        },
      },
      {
        $group: {
          _id: '$stimulusKC',
          numCorrect: { $sum: '$correct' },
          numIncorrect: { $sum: '$incorrect' },
          totalPracticeDuration: { $sum: '$practiceDuration' },
          count: { $sum: 1 },
        },
      },
      {
        $addFields: {
          introduced: {
            $cond: {
              if: {
                $gt: [
                  { $add: ['$numCorrect', '$numIncorrect'] },
                  0,
                ],
              },
              then: 1,
              else: 0,
            },
          },
        },
      },
      {
        $group: {
          _id: null,
          numCorrect: { $sum: '$numCorrect' },
          numIncorrect: { $sum: '$numIncorrect' },
          totalPracticeDuration: { $sum: '$totalPracticeDuration' },
          stimsIntroduced: { $sum: '$introduced' },
          count: { $sum: '$count' },
        },
      },
      {
        $project: {
          _id: 0,
        },
      },
    ];

    const performance = await deps.Histories.rawCollection().aggregate(query).toArray();
    const current = performance[0];
    if (!current) {
      return {
        numCorrect: 0,
        numIncorrect: 0,
        totalPracticeDuration: 0,
        allTimeNumCorrect: 0,
        allTimeNumIncorrect: 0,
        allTimePracticeDuration: 0,
        stimsIntroduced: 0,
        count: 0,
      };
    }

    return {
      ...current,
      allTimeNumCorrect: current.numCorrect || 0,
      allTimeNumIncorrect: current.numIncorrect || 0,
      allTimePracticeDuration: current.totalPracticeDuration || 0,
    };
  }

  async function getAssessmentCompletedTrialCountFromHistory(
    userId: string,
    TDFId: string,
    levelUnit: number
  ) {
    return await deps.Histories.find({
      userId,
      TDFId,
      levelUnitType: 'schedule',
      levelUnit: Number(levelUnit),
      studentResponseType: 'ATTEMPT',
      outcome: { $in: ['correct', 'incorrect'] },
    }).countAsync();
  }

  async function getVideoCompletedCheckpointQuestionCountFromHistory(
    userId: string,
    TDFId: string,
    levelUnit: number
  ) {
    return await deps.Histories.find({
      userId,
      TDFId,
      levelUnitType: 'video',
      levelUnit: Number(levelUnit),
      studentResponseType: 'ATTEMPT',
      outcome: 'correct',
    }).countAsync();
  }

  async function getLearningHistoryForUnit(
    userId: string,
    TDFId: string,
    levelUnit: number,
    unitScopedOnly = false,
    options: LearningHistoryReadOptions = {}
  ) {
    await rejectMissingCourseAssignmentContextForAssignedTdf(
      userId,
      TDFId,
      options.courseAssignment,
      'Course-assigned learning history requires courseAssignment context',
    );
    const selector = options.courseAssignment
      ? await buildCourseLearningHistoryScopeMatch(userId, TDFId, options)
      : buildLearningHistoryScopeMatch(userId, TDFId, levelUnit, unitScopedOnly);
    return await deps.Histories.find(selector, {
      fields: {
        TDFId: 1,
        time: 1,
        problemStartTime: 1,
        outcome: 1,
        eventType: 1,
        levelUnitType: 1,
        stimuliSetId: 1,
        stimulusKC: 1,
        clusterKC: 1,
        KCCluster: 1,
        KCId: 1,
        CFCorrectAnswer: 1,
        responseKey: 1,
        responseDuration: 1,
        practiceDurationMs: 1,
        CFEndLatency: 1,
        CFFeedbackLatency: 1,
        responseValue: 1,
        sparc: 1,
      },
      sort: { time: 1 },
    }).fetchAsync();
  }

  async function getSparcHistoryForUnit(
    userId: string,
    TDFId: string,
    levelUnit: number,
    options: Pick<LearningHistoryReadOptions, 'courseAssignment'> = {}
  ) {
    await rejectMissingCourseAssignmentContextForAssignedTdf(
      userId,
      TDFId,
      options.courseAssignment,
      'Course-assigned SPARC history requires courseAssignment context',
    );
    let selector: UnknownRecord = {
      userId,
      TDFId,
      levelUnit: Number(levelUnit),
      eventType: 'sparc',
      levelUnitType: { $in: ['model', 'sparc'] },
    };
    if (options.courseAssignment) {
      await validateCourseAssignmentHistoryContext({ courseAssignment: options.courseAssignment }, TDFId, userId);
      const courseId = deps.normalizeCanonicalId(options.courseAssignment.courseId);
      if (!courseId) {
        throw new Meteor.Error(400, 'Course-scoped SPARC history requires courseId');
      }
      selector = {
        ...selector,
        'courseAssignment.courseId': courseId,
      };
    }
    return await deps.Histories.find(selector, {
      fields: {
        historySchemaVersion: 1,
        TDFId: 1,
        sessionID: 1,
        userId: 1,
        anonStudentId: 1,
        levelUnit: 1,
        levelUnitName: 1,
        levelUnitType: 1,
        time: 1,
        problemStartTime: 1,
        selection: 1,
        action: 1,
        outcome: 1,
        typeOfResponse: 1,
        responseValue: 1,
        input: 1,
        displayedStimulus: 1,
        eventType: 1,
        stimuliSetId: 1,
        stimulusKC: 1,
        clusterKC: 1,
        KCCluster: 1,
        KCDefault: 1,
        KCId: 1,
        responseKC: 1,
        responseKey: 1,
        responseDuration: 1,
        practiceDurationMs: 1,
        sparc: 1,
        recordedServerTime: 1,
        eventId: 1,
      },
      sort: { time: 1, recordedServerTime: 1, eventId: 1 },
    }).fetchAsync();
  }

  async function getAutoTutorHistoryForUnit(
    userId: string,
    TDFId: string,
    levelUnit: number
  ) {
    return await deps.Histories.find({
      userId,
      TDFId,
      levelUnitType: 'autotutor',
      levelUnit: Number(levelUnit),
      eventType: 'autotutor-turn',
    }, {
      fields: {
        time: 1,
        problemStartTime: 1,
        responseDuration: 1,
        input: 1,
        responseValue: 1,
        feedbackText: 1,
        CFNote: 1,
        CFStartLatency: 1,
        CFEndLatency: 1,
        CFFeedbackLatency: 1,
        eventType: 1,
      },
      sort: { time: 1, recordedServerTime: 1 },
    }).fetchAsync();
  }

  async function getHiddenStimulusKCsFromHistory(userId: string, TDFId: string) {
    const rows = await deps.Histories.find({
      userId,
      TDFId,
      levelUnitType: 'model',
      CFItemRemoved: true,
    }, {
      fields: {
        stimulusKC: 1,
        time: 1,
      },
      sort: { time: 1 },
    }).fetchAsync();

    const hiddenStimulusKCs: Array<string | number> = [];
    const seen = new Set<string>();
    for (const row of rows) {
      const stimulusKC = row?.stimulusKC;
      if (stimulusKC === null || stimulusKC === undefined || stimulusKC === '') {
        continue;
      }
      const key = String(stimulusKC);
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      hiddenStimulusKCs.push(stimulusKC);
    }

    return hiddenStimulusKCs;
  }

  async function getNumDroppedItemsByUserIDAndTDFId(userId: string, TDFId: string) {
    deps.serverConsole('getNumDroppedItemsByUserIDAndTDFId', userId, TDFId);
    return await deps.Histories.find({ userId, TDFId, CFItemRemoved: true, levelUnitType: 'model' }).countAsync();
  }

  async function getStudentPerformanceForClassAndTdfId(instructorId: string, date: number | null = null) {
    const courses = await deps.Courses.find({ teacherUserId: instructorId }).fetchAsync();
    if (courses.length === 0) {
      return [{}, {}];
    }
    const courseIds = courses.map((course: { _id: string }) => course._id);

    const sections = await deps.Sections.find({ courseId: { $in: courseIds } }).fetchAsync();
    if (sections.length === 0) {
      return [{}, {}];
    }
    const sectionIds = sections.map((section: { _id: string }) => section._id);
    const sectionToCourse: Record<string, string> = {};
    for (const section of sections) {
      sectionToCourse[section._id] = section.courseId;
    }

    const enrollments = await deps.SectionUserMap.find({ sectionId: { $in: sectionIds } }).fetchAsync();
    if (enrollments.length === 0) {
      return [{}, {}];
    }
    const enrolledUserIds = [...new Set(enrollments.map((enrollment: { userId: string }) => enrollment.userId))];
    const userSectionMap: Record<string, Array<{ sectionId: string; courseId: string }>> = {};
    for (const enrollment of enrollments) {
      const courseId = sectionToCourse[enrollment.sectionId];
      if (!courseId) {
        continue;
      }
      if (!userSectionMap[enrollment.userId]) {
        userSectionMap[enrollment.userId] = [];
      }
      userSectionMap[enrollment.userId]!.push({ sectionId: enrollment.sectionId, courseId });
    }

    const histMatch: Record<string, unknown> = {
      levelUnitType: 'model',
      userId: { $in: enrolledUserIds },
    };
    if (date) {
      histMatch.recordedServerTime = { $lt: date };
    }

    const pipeline = [
      { $match: histMatch },
      {
        $group: {
          _id: { userId: '$userId', TDFId: '$TDFId' },
          correct: { $sum: { $cond: [{ $eq: ['$outcome', 'correct'] }, 1, 0] } },
          incorrect: { $sum: { $cond: [{ $ne: ['$outcome', 'correct'] }, 1, 0] } },
          totalPracticeDuration: { $sum: { $add: [{ $ifNull: ['$CFEndLatency', 0] }, { $ifNull: ['$CFFeedbackLatency', 0] }] } },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id.userId',
          foreignField: '_id',
          as: '_user',
        },
      },
      {
        $addFields: {
          username: { $ifNull: [{ $arrayElemAt: ['$_user.username', 0] }, ''] },
        },
      },
      { $project: { _user: 0 } },
    ];

    const aggResults: Array<{
      _id: { userId: string; TDFId: string };
      correct: number;
      incorrect: number;
      totalPracticeDuration: number;
      username: string;
    }> = await deps.Histories.rawCollection().aggregate(pipeline).toArray();

    type ClassTotal = { count: number; totalTime: number; numCorrect: number; percentCorrect?: string; totalTimeDisplay?: string };
    type StudentTotal = ClassTotal & { username: string; userId: string };
    const studentPerformanceForClass: Record<string, Record<string, ClassTotal>> = {};
    const studentPerformanceForClassAndTdfIdMap: Record<string, Record<string, Record<string, StudentTotal>>> = {};

    for (const row of aggResults) {
      const userId = row._id.userId;
      const TDFId = row._id.TDFId;
      const correct = Number(row.correct);
      const incorrect = Number(row.incorrect);
      const totalPracticeDuration = Number(row.totalPracticeDuration);
      const count = correct + incorrect;
      const studentUsername = row.username || '';

      if (studentUsername) {
        deps.syncUsernameCaches(String(userId), studentUsername);
      }

      const userSections = userSectionMap[userId];
      if (!userSections) {
        continue;
      }

      for (const { courseId } of userSections) {
        if (!studentPerformanceForClass[courseId]) {
          studentPerformanceForClass[courseId] = {};
        }
        if (!studentPerformanceForClass[courseId][TDFId]) {
          studentPerformanceForClass[courseId][TDFId] = { count: 0, totalTime: 0, numCorrect: 0 };
        }
        const classTdf = studentPerformanceForClass[courseId][TDFId];
        if (classTdf) {
          classTdf.numCorrect += correct;
          classTdf.count += count;
          classTdf.totalTime += totalPracticeDuration;
        }

        if (!studentPerformanceForClassAndTdfIdMap[courseId]) {
          studentPerformanceForClassAndTdfIdMap[courseId] = {};
        }
        if (!studentPerformanceForClassAndTdfIdMap[courseId][TDFId]) {
          studentPerformanceForClassAndTdfIdMap[courseId][TDFId] = {};
        }
        if (!studentPerformanceForClassAndTdfIdMap[courseId][TDFId][userId]) {
          studentPerformanceForClassAndTdfIdMap[courseId][TDFId][userId] = {
            count: 0,
            totalTime: 0,
            numCorrect: 0,
            username: studentUsername,
            userId,
          };
        }
        const studentEntry = studentPerformanceForClassAndTdfIdMap[courseId][TDFId][userId];
        if (studentEntry) {
          studentEntry.numCorrect += correct;
          studentEntry.count += count;
          studentEntry.totalTime += totalPracticeDuration;
        }
      }
    }

    for (const courseId of Object.keys(studentPerformanceForClass)) {
      const courseTotals = studentPerformanceForClass[courseId];
      if (!courseTotals) {
        continue;
      }
      for (const tdfId of Object.keys(courseTotals)) {
        const tdfTotal = courseTotals[tdfId];
        if (!tdfTotal) {
          continue;
        }
        tdfTotal.percentCorrect = ((tdfTotal.numCorrect / tdfTotal.count) * 100).toFixed(2) + '%';
        tdfTotal.totalTimeDisplay = (tdfTotal.totalTime / (60 * 1000)).toFixed(1);
      }
    }
    for (const courseId of Object.keys(studentPerformanceForClassAndTdfIdMap)) {
      const courseTotals = studentPerformanceForClassAndTdfIdMap[courseId];
      if (!courseTotals) {
        continue;
      }
      for (const tdfId of Object.keys(courseTotals)) {
        const tdfTotals = courseTotals[tdfId];
        if (!tdfTotals) {
          continue;
        }
        for (const studentTotal of Object.values(tdfTotals)) {
          studentTotal.percentCorrect = ((studentTotal.numCorrect / studentTotal.count) * 100).toFixed(2) + '%';
          studentTotal.totalTimeDisplay = (studentTotal.totalTime / (60 * 1000)).toFixed(1);
        }
      }
    }
    return [studentPerformanceForClass, studentPerformanceForClassAndTdfIdMap];
  }

  function requireSelfScopedUserId(
    thisArg: MethodContext | undefined,
    requestedUserId: unknown,
    forbiddenMessage = 'Can only read learner data for the current user'
  ) {
    const actingUserId = requireAuthenticatedUser(thisArg?.userId, 'Must be logged in', 401);
    const normalizedRequestedUserId = deps.normalizeCanonicalId(requestedUserId) || actingUserId;
    if (normalizedRequestedUserId !== actingUserId) {
      throw new Meteor.Error(403, forbiddenMessage);
    }
    return actingUserId;
  }

  function requireNormalizedTdfId(TDFId: unknown) {
    const normalizedTdfId = deps.normalizeCanonicalId(TDFId);
    if (!normalizedTdfId) {
      throw new Meteor.Error(400, 'Invalid TDF');
    }
    return normalizedTdfId;
  }

  const downloadMethods = createAnalyticsDownloadMethods(deps);
  const conditionCountMethods = createAnalyticsConditionCountMethods(deps, { validateExperimentStateMutation });

  return {
    createExperimentState: async function(
      this: MethodContext,
      curExperimentState: UnknownRecord & { currentRootTdfId?: string; currentTdfId?: string },
      options: { replaceExistingState?: boolean } = {},
    ) {
      if (
        options === null
        || typeof options !== 'object'
        || Array.isArray(options)
        || Object.keys(options).some((key) => key !== 'replaceExistingState')
        || (options.replaceExistingState !== undefined && typeof options.replaceExistingState !== 'boolean')
      ) {
        throw new Meteor.Error(400, 'Invalid experiment state write options');
      }
      return await createExperimentState.call(this, curExperimentState, this.userId || null, options);
    },
    getClassPerformanceByTDF,
    getStudentPerformanceByIdAndTDFIdFromHistory: async function(
      this: MethodContext,
      userId: string,
      TDFId: string,
      returnRows: number | null = null
    ) {
      const scopedUserId = requireSelfScopedUserId(this, userId);
      return await getStudentPerformanceByIdAndTDFIdFromHistory(scopedUserId, requireNormalizedTdfId(TDFId), returnRows);
    },
    getStudentPerformanceForUnitFromHistory: async function(
      this: MethodContext,
      userId: string,
      TDFId: string,
      levelUnit: number,
      unitScopedOnly = false
    ) {
      const scopedUserId = requireSelfScopedUserId(this, userId);
      return await getStudentPerformanceForUnitFromHistory(scopedUserId, requireNormalizedTdfId(TDFId), levelUnit, unitScopedOnly);
    },
    getAssessmentCompletedTrialCountFromHistory: async function(
      this: MethodContext,
      userId: string,
      TDFId: string,
      levelUnit: number
    ) {
      const scopedUserId = requireSelfScopedUserId(this, userId);
      return await getAssessmentCompletedTrialCountFromHistory(scopedUserId, requireNormalizedTdfId(TDFId), levelUnit);
    },
    getVideoCompletedCheckpointQuestionCountFromHistory: async function(
      this: MethodContext,
      userId: string,
      TDFId: string,
      levelUnit: number
    ) {
      const scopedUserId = requireSelfScopedUserId(this, userId);
      return await getVideoCompletedCheckpointQuestionCountFromHistory(scopedUserId, requireNormalizedTdfId(TDFId), levelUnit);
    },
    getLearningHistoryForUnit: async function(
      this: MethodContext,
      userId: string,
      TDFId: string,
      levelUnit: number,
      unitScopedOnly = false,
      options: LearningHistoryReadOptions = {}
    ) {
      const scopedUserId = requireSelfScopedUserId(this, userId);
      return await getLearningHistoryForUnit(scopedUserId, requireNormalizedTdfId(TDFId), levelUnit, unitScopedOnly, options);
    },
    getSparcHistoryForUnit: async function(
      this: MethodContext,
      userId: string,
      TDFId: string,
      levelUnit: number,
      options: Pick<LearningHistoryReadOptions, 'courseAssignment'> = {}
    ) {
      const scopedUserId = requireSelfScopedUserId(this, userId);
      return await getSparcHistoryForUnit(scopedUserId, requireNormalizedTdfId(TDFId), levelUnit, options);
    },
    getAutoTutorHistoryForUnit: async function(
      this: MethodContext,
      userId: string,
      TDFId: string,
      levelUnit: number
    ) {
      const scopedUserId = requireSelfScopedUserId(this, userId);
      return await getAutoTutorHistoryForUnit(scopedUserId, requireNormalizedTdfId(TDFId), levelUnit);
    },
    getHiddenStimulusKCsFromHistory: async function(this: MethodContext, userId: string, TDFId: string) {
      const scopedUserId = requireSelfScopedUserId(this, userId);
      return await getHiddenStimulusKCsFromHistory(scopedUserId, requireNormalizedTdfId(TDFId));
    },
    getAdaptiveOutcomeRows: async function(this: MethodContext, userId: string, TDFId: string) {
      const actingUserId = requireAuthenticatedUser(this.userId, 'Must be logged in', 401);
      const requestedUserId = deps.normalizeCanonicalId(userId) || actingUserId;
      const normalizedTdfId = deps.normalizeCanonicalId(TDFId);
      if (!normalizedTdfId) {
        throw new Meteor.Error(400, 'Invalid TDF');
      }
      await requireUserMatchesOrHasRole(deps.getMethodAuthorizationDeps(), {
        actingUserId,
        subjectUserId: requestedUserId,
        roles: ['admin'],
        notLoggedInMessage: 'Must be logged in',
        notLoggedInCode: 401,
        forbiddenMessage: 'Can only read adaptive outcomes for the current user',
        forbiddenCode: 403,
      });
      if (requestedUserId === actingUserId) {
        await validateExperimentStateMutation(
          actingUserId,
          normalizedTdfId,
          { currentTdfId: normalizedTdfId },
          'methods.getAdaptiveOutcomeRows'
        );
      }
      return await deps.Histories.find(
        { userId: requestedUserId, TDFId: normalizedTdfId },
        {
          fields: { _id: 0, stimulusKC: 1, outcome: 1, recordedServerTime: 1, time: 1 },
          sort: { recordedServerTime: 1, time: 1 },
        }
      ).fetchAsync();
    },
    getNumDroppedItemsByUserIDAndTDFId: async function(this: MethodContext, userId: string, TDFId: string) {
      const scopedUserId = requireSelfScopedUserId(this, userId);
      return await getNumDroppedItemsByUserIDAndTDFId(scopedUserId, requireNormalizedTdfId(TDFId));
    },
    getStudentPerformanceForClassAndTdfId: async function(this: MethodContext, instructorId: string, date: number | null = null) {
      if (!this.userId) {
        throw new Meteor.Error(401, 'Must be logged in');
      }
      const requestedInstructorId = deps.normalizeCanonicalId(instructorId) || this.userId;
      await requireUserMatchesOrHasRole(deps.getMethodAuthorizationDeps(), {
        actingUserId: this.userId,
        subjectUserId: requestedInstructorId,
        roles: ['admin'],
        notLoggedInMessage: 'Must be logged in',
        notLoggedInCode: 401,
        forbiddenMessage: 'Can only access your own instructor performance data',
        forbiddenCode: 403,
      });
      return await getStudentPerformanceForClassAndTdfId(requestedInstructorId, date);
    },
    getStimSetFromLearningSessionByClusterList,
    getExperimentState: async function(this: MethodContext, userId: string, TDFId: string) {
      const scopedUserId = requireSelfScopedUserId(this, userId, 'Can only read experiment state for the current user');
      return await getExperimentState(scopedUserId, requireNormalizedTdfId(TDFId));
    },
    setExperimentState: async function(
      this: MethodContext,
      userId: string,
      TDFId: string,
      experimentStateId: string,
      newExperimentState: UnknownRecord,
      where: string
    ) {
      const scopedUserId = requireSelfScopedUserId(this, userId, 'Can only mutate experiment state for the current user');
      return await setExperimentState(
        scopedUserId,
        requireNormalizedTdfId(TDFId),
        experimentStateId,
        newExperimentState,
        where || 'methods.setExperimentState'
      );
    },
    getLastTDFAccessed: async function(this: MethodContext, userId: string | null = null) {
      const scopedUserId = requireSelfScopedUserId(this, userId, 'Can only read recent TDFs for the current user');
      return await getLastTDFAccessed(scopedUserId);
    },
    insertHistory,
    getHistoryByTDFID,
    getStimulusCrowdStatsForDeck,
    getUserRecentTDFs: async function(this: MethodContext, userId: string | null = null) {
      const scopedUserId = requireSelfScopedUserId(this, userId, 'Can only read recent TDFs for the current user');
      return await getUserRecentTDFs(scopedUserId);
    },
    getUserLastFeedbackTypeFromHistory,

    getLearnerProgressSignals: async function(this: MethodContext, targetUserId?: string) {
      const currentUserId = this.userId;
      if (!currentUserId) {
        throw new Meteor.Error('not-authorized', 'Must be logged in');
      }

      const requestedUserId = typeof targetUserId === 'string' && targetUserId.trim().length
        ? targetUserId.trim()
        : currentUserId;
      await requireUserMatchesOrHasRole(deps.getMethodAuthorizationDeps(), {
        actingUserId: currentUserId,
        subjectUserId: requestedUserId,
        roles: ['admin', 'teacher'],
        notLoggedInMessage: 'Must be logged in',
        notLoggedInCode: 'not-authorized',
        forbiddenMessage: 'Insufficient privileges to inspect another learner',
        forbiddenCode: 'not-authorized',
      });

      const docs = await deps.GlobalExperimentStates.find(
        { userId: requestedUserId },
        { fields: { TDFId: 1, experimentState: 1 } }
      ).fetchAsync();

      const attempted = new Set<string>();
      const meaningful = new Set<string>();
      for (const doc of docs) {
        const tdfId = typeof doc?.TDFId === 'string' ? doc.TDFId : null;
        if (!tdfId) {
          continue;
        }
        attempted.add(tdfId);
        if (deps.hasMeaningfulProgressSignal(doc?.experimentState)) {
          meaningful.add(tdfId);
        }
      }

      return {
        attemptedTdfIds: Array.from(attempted),
        meaningfulProgressTdfIds: Array.from(meaningful),
      };
    },

    updateExperimentState: async function(
      this: MethodContext,
      curExperimentState: UnknownRecord & { currentRootTdfId?: string; currentTdfId?: string },
      experimentId: string | null = null
    ) {
      let existingExperimentDoc: { userId?: string; TDFId?: string } | null = null;
      if (experimentId) {
        existingExperimentDoc = await deps.GlobalExperimentStates.findOneAsync(
          { _id: experimentId },
          { fields: { userId: 1, TDFId: 1 } }
        );
        if (!existingExperimentDoc) {
          throw new Meteor.Error(403, 'Not authorized to mutate this experiment state record');
        }
        await requireUserMatchesOrHasRole(deps.getMethodAuthorizationDeps(), {
          actingUserId: this.userId,
          subjectUserId: existingExperimentDoc.userId,
          forbiddenMessage: 'Not authorized to mutate this experiment state record',
          forbiddenCode: 403,
        });
      }
      const rootTdfId = deps.normalizeCanonicalId(existingExperimentDoc?.TDFId)
        || deps.normalizeCanonicalId((curExperimentState as any)?.currentRootTdfId)
        || deps.normalizeCanonicalId(curExperimentState?.currentTdfId);
      if (!rootTdfId) {
        throw new Meteor.Error(400, 'updateExperimentState requires a canonical root TDF context');
      }
      const conditionTdfId = deps.normalizeCanonicalId((curExperimentState as any)?.conditionTdfId);
      await validateExperimentStateMutation(this.userId, rootTdfId, curExperimentState, 'methods.updateExperimentState');
      deps.serverConsole('updateExperimentState', {
        userId: this.userId || null,
        rootTdfId,
        currentTdfId: deps.normalizeCanonicalId((curExperimentState as any)?.currentTdfId),
        currentStimuliSetId: deps.normalizeCanonicalId((curExperimentState as any)?.currentStimuliSetId),
        conditionTdfId: conditionTdfId || null,
        experimentTarget: deps.normalizeOptionalString((curExperimentState as any)?.experimentTarget),
      });
      if (experimentId) {
        return await setExperimentState(
          this.userId as string,
          rootTdfId,
          experimentId,
          curExperimentState,
          'methods.updateExperimentState'
        );
      }
      return await createExperimentState.call(this, curExperimentState, this.userId || null);
    },

    getOutcomesForAdaptiveLearning: async function(this: MethodContext, userId: string, TDFId: string) {
      const actingUserId = requireAuthenticatedUser(this.userId, 'Must be logged in', 401);
      const requestedUserId = deps.normalizeCanonicalId(userId) || actingUserId;
      const normalizedTdfId = deps.normalizeCanonicalId(TDFId);
      if (!normalizedTdfId) {
        throw new Meteor.Error(400, 'Invalid TDF');
      }
      await requireUserMatchesOrHasRole(deps.getMethodAuthorizationDeps(), {
        actingUserId,
        subjectUserId: requestedUserId,
        roles: ['admin'],
        notLoggedInMessage: 'Must be logged in',
        notLoggedInCode: 401,
        forbiddenMessage: 'Can only read adaptive outcomes for the current user',
        forbiddenCode: 403,
      });
      if (requestedUserId === actingUserId) {
        await validateExperimentStateMutation(
          actingUserId,
          normalizedTdfId,
          { currentTdfId: normalizedTdfId },
          'methods.getOutcomesForAdaptiveLearning'
        );
      }
      const history = await deps.Histories.find(
        { userId: requestedUserId, TDFId: normalizedTdfId },
        {
          fields: { _id: 0, stimulusKC: 1, outcome: 1, recordedServerTime: 1, time: 1 },
          sort: { recordedServerTime: 1, time: 1 },
        }
      ).fetchAsync();
      const outcomes: Record<string, boolean> = {};
      for (const historyRow of history as Array<{ stimulusKC?: number; outcome?: string }>) {
        if (historyRow.stimulusKC) {
          outcomes[historyRow.stimulusKC % 1000] = historyRow.outcome === 'correct';
        }
      }

      return outcomes;
    },

    ...downloadMethods,
    ...conditionCountMethods,
  };
}
