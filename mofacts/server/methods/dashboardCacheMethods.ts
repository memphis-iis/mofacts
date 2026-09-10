import type {
  ComputePracticeTimeMs,
  DashboardHistoryRecord,
  DashboardTdfStats,
} from './dashboardCacheMethods.contracts';
import { createStimulusKey, isBlankIdentityValue } from '../../common/historyEnvelope';
import { curSemester } from '../../common/Definitions';
import {
  DASHBOARD_CACHE_VERSION,
  DASHBOARD_LEVEL_UNIT_TYPES,
  computeSummaryStats,
  computeUsageSummary,
  timestampValue,
} from './dashboardCacheShared';
import { createDashboardLearnerConfigMethods } from './dashboardLearnerConfigMethods';
import { createDashboardPracticeSnapshotMethods } from './dashboardPracticeSnapshotMethods';
import {
  createLessonFamilyResolver,
  getLessonFamilySetspec,
  LESSON_FAMILY_RESET_FIELDS,
} from '../lib/tdfLessonFamilyResolver';

const DASHBOARD_ADMIN_REFRESH_CONCURRENCY = 4;
const DASHBOARD_ADMIN_REFRESH_PROGRESS_INTERVAL = 10;
const DASHBOARD_HISTORY_REBUILD_BATCH_SIZE = 1000;
const DASHBOARD_HISTORY_REBUILD_PROGRESS_INTERVAL = 10000;
const DASHBOARD_HISTORY_FIELDS = {
  _id: 1,
  outcome: 1,
  CFEndLatency: 1,
  CFFeedbackLatency: 1,
  stimuliSetId: 1,
  stimulusKC: 1,
  recordedServerTime: 1,
  time: 1,
  TDFId: 1,
  userId: 1,
  levelUnitType: 1,
  modelEvidenceSource: 1,
};

type DashboardCacheDeps = {
  Meteor: any;
  Roles: any;
  Histories: any;
  GlobalExperimentStates?: any;
  Tdfs: any;
  Courses?: any;
  Assignments?: any;
  Sections?: any;
  SectionUserMap?: any;
  UserDashboardCache: any;
  usersCollection: any;
  DynamicSettings: any;
  decryptData?: (value: string) => string;
  serverConsole: (...args: any[]) => void;
  computePracticeTimeMs: ComputePracticeTimeMs;
  canViewDashboardTdf: (userId: unknown, tdf: any) => boolean;
  getAccessibleTdf: (userId: string, tdfId: string, options: any) => Promise<any>;
  redisBoundary: {
    enabled: boolean;
    withLock: <T>(key: string, ttlMs: number, work: () => Promise<T>) => Promise<T>;
  };
};

function historyRecordTimestamp(record: DashboardHistoryRecord): number {
  const rawTimestamp = record.recordedServerTime ?? record.time;
  if (!rawTimestamp) {
    return 0;
  }
  const timestamp = new Date(rawTimestamp).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function historyRecordSessionDateKey(record: DashboardHistoryRecord): string | null {
  const timestamp = historyRecordTimestamp(record);
  return timestamp > 0 ? new Date(timestamp).toDateString() : null;
}

function isAutoTutorRecord(record: DashboardHistoryRecord): boolean {
  return record.levelUnitType === 'autotutor';
}

function shouldCountDashboardHistoryRecord(record: DashboardHistoryRecord): boolean {
  if (record.levelUnitType === 'model' && record.modelEvidenceSource === 'assessment') {
    return false;
  }
  return true;
}

function resolveDashboardModelStimulusKey(record: DashboardHistoryRecord): string | null {
  if (
    record.levelUnitType !== 'model' ||
    record.modelEvidenceSource === 'assessment'
  ) {
    return null;
  }
  if (isBlankIdentityValue(record.stimuliSetId) || isBlankIdentityValue(record.stimulusKC)) {
    return null;
  }
  return createStimulusKey({
    stimuliSetId: record.stimuliSetId as string | number,
    stimulusKC: record.stimulusKC as string | number,
  });
}

function getHistoryPracticeTimeMs(
  record: DashboardHistoryRecord,
  computePracticeTimeMs: ComputePracticeTimeMs
): number {
  return computePracticeTimeMs(record.CFEndLatency, record.CFFeedbackLatency);
}

function dashboardHistorySelector(extraSelector: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    ...extraSelector,
    levelUnitType: { $in: DASHBOARD_LEVEL_UNIT_TYPES },
    $nor: [
      { levelUnitType: 'model', modelEvidenceSource: 'assessment' },
    ],
  };
}

export function computeCacheStats(
  history: DashboardHistoryRecord[],
  displayName: string | null | undefined,
  computePracticeTimeMs: ComputePracticeTimeMs
): DashboardTdfStats {
  const countableHistory = history.filter(shouldCountDashboardHistoryRecord);
  const stats: DashboardTdfStats = {
    displayName: displayName || 'Unnamed',
    totalTrials: countableHistory.length,
    correctTrials: 0,
    incorrectTrials: 0,
    totalTimeMs: 0,
    totalTimeMinutes: 0,
    itemsPracticedCount: 0,
    itemsPracticedApplies: false,
    practicedItemKeys: [],
    totalSessions: 0,
    sessionDateKeys: [],
    overallAccuracy: null,
    accuracyApplies: false,
    firstPracticeDate: null,
    lastPracticeDate: null,
    lastPracticeTimestamp: 0,
    lastProcessedHistoryId: null,
    lastProcessedTimestamp: null
  };

  const uniqueItems = new Set<string>();
  const sessions = new Set<string>();
  for (const record of countableHistory) {
    if (isAutoTutorRecord(record)) {
      // AutoTutor no longer has a dashboard accuracy percentage. Graduation is
      // expectation/misconception based, so keep trial/time counts but exclude
      // AutoTutor rows from accuracy aggregation.
    } else if (record.outcome === 'correct') {
      stats.correctTrials++;
    } else if (record.outcome === 'incorrect') {
      stats.incorrectTrials++;
    }

    stats.totalTimeMs += getHistoryPracticeTimeMs(record, computePracticeTimeMs);

    const stimulusKey = resolveDashboardModelStimulusKey(record);
    if (stimulusKey !== null) {
      stats.itemsPracticedApplies = true;
      uniqueItems.add(stimulusKey);
    }

    const timestamp = historyRecordTimestamp(record);
    if (timestamp > 0) {
      const date = new Date(timestamp);
      sessions.add(date.toDateString());

      if (!stats.firstPracticeDate || date < stats.firstPracticeDate) {
        stats.firstPracticeDate = date;
      }
      if (timestamp > stats.lastPracticeTimestamp) {
        stats.lastPracticeDate = date;
        stats.lastPracticeTimestamp = timestamp;
      }
    }

    stats.lastProcessedHistoryId = record._id ?? null;
    stats.lastProcessedTimestamp = record.recordedServerTime ?? record.time ?? null;
  }

  stats.itemsPracticedCount = uniqueItems.size;
  stats.practicedItemKeys = Array.from(uniqueItems);
  stats.totalSessions = sessions.size;
  stats.sessionDateKeys = Array.from(sessions);
  stats.totalTimeMinutes = Number((stats.totalTimeMs / 60000).toFixed(1));

  const answeredTrials = stats.correctTrials + stats.incorrectTrials;
  stats.accuracyApplies = answeredTrials > 0;
  stats.overallAccuracy = stats.accuracyApplies
    ? Number(((stats.correctTrials / answeredTrials) * 100).toFixed(1))
    : null;

  return stats;
}

function createEmptyDashboardTdfStats(displayName: string | null | undefined): DashboardTdfStats {
  return computeCacheStats([], displayName, () => 0);
}

export function applyDashboardHistoryRecordToStats(
  currentStats: DashboardTdfStats | null | undefined,
  historyRecord: DashboardHistoryRecord,
  displayName: string | null | undefined,
  computePracticeTimeMs: ComputePracticeTimeMs
): DashboardTdfStats {
  const stats = currentStats
    ? {
        ...currentStats,
        displayName: displayName || currentStats.displayName || 'Unnamed',
        practicedItemKeys: [...(currentStats.practicedItemKeys || [])],
        sessionDateKeys: [...(currentStats.sessionDateKeys || [])],
      }
    : createEmptyDashboardTdfStats(displayName);
  const practicedItemKeys = stats.practicedItemKeys ?? [];
  const sessionDateKeys = stats.sessionDateKeys ?? [];
  stats.practicedItemKeys = practicedItemKeys;
  stats.sessionDateKeys = sessionDateKeys;

  if (!shouldCountDashboardHistoryRecord(historyRecord)) {
    return stats;
  }

  stats.totalTrials += 1;
  if (!isAutoTutorRecord(historyRecord)) {
    if (historyRecord.outcome === 'correct') {
      stats.correctTrials += 1;
    } else if (historyRecord.outcome === 'incorrect') {
      stats.incorrectTrials += 1;
    }
  }

  stats.totalTimeMs += getHistoryPracticeTimeMs(historyRecord, computePracticeTimeMs);
  stats.totalTimeMinutes = Number((stats.totalTimeMs / 60000).toFixed(1));

  const stimulusKey = resolveDashboardModelStimulusKey(historyRecord);
  if (stimulusKey !== null) {
    stats.itemsPracticedApplies = true;
    if (!practicedItemKeys.includes(stimulusKey)) {
      practicedItemKeys.push(stimulusKey);
    }
  }
  stats.itemsPracticedCount = practicedItemKeys.length;

  const timestamp = historyRecordTimestamp(historyRecord);
  const sessionDateKey = historyRecordSessionDateKey(historyRecord);
  if (sessionDateKey && !sessionDateKeys.includes(sessionDateKey)) {
    sessionDateKeys.push(sessionDateKey);
  }
  stats.totalSessions = sessionDateKeys.length;

  if (timestamp > 0) {
    const date = new Date(timestamp);
    if (!stats.firstPracticeDate || date < new Date(stats.firstPracticeDate)) {
      stats.firstPracticeDate = date;
    }
    if (timestamp > stats.lastPracticeTimestamp) {
      stats.lastPracticeDate = date;
      stats.lastPracticeTimestamp = timestamp;
    }
  }

  stats.lastProcessedHistoryId = historyRecord._id ?? null;
  stats.lastProcessedTimestamp = historyRecord.recordedServerTime ?? historyRecord.time ?? null;

  const answeredTrials = stats.correctTrials + stats.incorrectTrials;
  stats.accuracyApplies = answeredTrials > 0;
  stats.overallAccuracy = stats.accuracyApplies
    ? Number(((stats.correctTrials / answeredTrials) * 100).toFixed(1))
    : null;

  return stats;
}

export { computeSummaryStats, computeUsageSummary } from './dashboardCacheShared';

export function createDashboardCacheMethods({
  getAccessibleTdf,
  Meteor,
  Roles,
  Histories,
  GlobalExperimentStates,
  Tdfs,
  Courses,
  Assignments,
  Sections,
  SectionUserMap,
  UserDashboardCache,
  usersCollection,
  DynamicSettings,
  decryptData,
  serverConsole,
  computePracticeTimeMs,
  canViewDashboardTdf,
  redisBoundary
}: DashboardCacheDeps) {
  const lessonFamilies = createLessonFamilyResolver({ tdfs: Tdfs });

  function addNonEmptyString(target: Set<string>, value: unknown) {
    if (typeof value !== 'string') {
      return;
    }
    const trimmed = value.trim();
    if (trimmed) {
      target.add(trimmed);
    }
  }

  async function mapWithBoundedConcurrency<T>(
    items: T[],
    concurrency: number,
    worker: (item: T, index: number) => Promise<void>,
    onProgress?: (completed: number, total: number) => void
  ) {
    let nextIndex = 0;
    let completed = 0;
    const workerCount = Math.min(Math.max(concurrency, 1), items.length);
    const runners = Array.from({ length: workerCount }, async () => {
      while (nextIndex < items.length) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        const item = items[currentIndex];
        if (item === undefined) {
          continue;
        }
        await worker(item, currentIndex);
        completed += 1;
        if (
          onProgress &&
          (completed === items.length || completed % DASHBOARD_ADMIN_REFRESH_PROGRESS_INTERVAL === 0)
        ) {
          onProgress(completed, items.length);
        }
      }
    });
    await Promise.all(runners);
  }

  async function collectLessonFamilyResetScope(tdfId: string) {
    function addTdfDocumentToResetScope(doc: any, params: { cache: boolean }) {
      addNonEmptyString(tdfIds, doc?._id);
      addNonEmptyString(tdfKeys, doc?._id);
      addNonEmptyString(tdfKeys, doc?.content?.fileName);
      addNonEmptyString(tdfKeys, doc?.content?.tdfs?.tutor?.setspec?.stimulusfile);
      if (params.cache) {
        addNonEmptyString(cacheTdfIds, doc?._id);
      }
    }

    const family = await lessonFamilies.resolveLessonFamilyForTdf(tdfId, LESSON_FAMILY_RESET_FIELDS);
    if (!family) {
      throw new Meteor.Error('not-found', 'TDF not found');
    }

    const tdfIds = new Set<string>();
    const tdfKeys = new Set<string>();
    const cacheTdfIds = new Set<string>();

    for (const root of family.roots) {
      addTdfDocumentToResetScope(root, { cache: true });

      const setspec = getLessonFamilySetspec(root);
      const canonicalConditionIds = Array.isArray(setspec.conditionTdfIds)
        ? setspec.conditionTdfIds.filter((conditionTdfId) => typeof conditionTdfId === 'string' && conditionTdfId.trim())
        : [];
      if (canonicalConditionIds.length > 0) {
        for (const conditionTdfId of canonicalConditionIds) {
          addNonEmptyString(tdfIds, conditionTdfId);
          addNonEmptyString(tdfKeys, conditionTdfId);
        }
      } else if (Array.isArray(setspec.condition)) {
        for (const conditionRef of setspec.condition) {
          addNonEmptyString(tdfKeys, conditionRef);
        }
      }
    }

    for (const child of family.children) {
      addTdfDocumentToResetScope(child, { cache: false });
    }

    return {
      tdfIds: Array.from(tdfIds),
      tdfKeys: Array.from(tdfKeys),
      cacheTdfIds: Array.from(cacheTdfIds)
    };
  }

  function normalizeOptionalId(value: unknown): string | null {
    const normalized = typeof value === 'string' ? value.trim() : '';
    return normalized || null;
  }

  async function assertNoAssignedCourseReset(userId: string, scope: { tdfIds: string[] }) {
    if (scope.tdfIds.length === 0) {
      return;
    }
    if (!Assignments?.find || !Courses?.find || !Sections?.find || !SectionUserMap?.find) {
      throw new Meteor.Error(
        'server-misconfigured',
        'Course assignment collections are required before resetting lesson progress.'
      );
    }
    const assignmentRows = await Assignments.find(
      { $or: [{ TDFId: { $in: scope.tdfIds } }, { memberTdfIds: { $in: scope.tdfIds } }] },
      { fields: { _id: 1, courseId: 1, TDFId: 1, memberTdfIds: 1 } }
    ).fetchAsync();
    const assignedCourseIds = [...new Set(
      assignmentRows
        .map((row: any) => normalizeOptionalId(row?.courseId))
        .filter((courseId: string | null): courseId is string => typeof courseId === 'string')
    )];
    if (assignedCourseIds.length === 0) {
      return;
    }

    const activeCourses = await Courses.find(
      { _id: { $in: assignedCourseIds }, semester: curSemester },
      { fields: { _id: 1 } }
    ).fetchAsync();
    const activeCourseIds = activeCourses
      .map((course: any) => normalizeOptionalId(course?._id))
      .filter((courseId: string | null): courseId is string => typeof courseId === 'string');
    if (activeCourseIds.length === 0) {
      return;
    }

    const sectionRows = await Sections.find(
      { courseId: { $in: activeCourseIds } },
      { fields: { _id: 1 } }
    ).fetchAsync();
    const sectionIds = sectionRows
      .map((section: any) => normalizeOptionalId(section?._id))
      .filter((sectionId: string | null): sectionId is string => typeof sectionId === 'string');
    if (sectionIds.length === 0) {
      return;
    }

    const enrollmentRows = await SectionUserMap.find(
      { userId, sectionId: { $in: sectionIds } },
      { fields: { _id: 1 } }
    ).fetchAsync();
    if (enrollmentRows.length > 0) {
      throw new Meteor.Error(
        'course-reset-blocked',
        'Cannot reset lesson progress for a TDF assigned through a course; course-scoped shared model reset is not implemented.'
      );
    }
  }

  async function removeLessonProgressFromCache(userId: string, cacheTdfIds: string[]) {
    const cache = await UserDashboardCache.findOneAsync({ userId });
    if (!cache?.tdfStats) {
      return false;
    }

    const nextTdfStats = { ...(cache.tdfStats || {}) };
    let changed = false;
    for (const cacheTdfId of cacheTdfIds) {
      if (Object.prototype.hasOwnProperty.call(nextTdfStats, cacheTdfId)) {
        delete nextTdfStats[cacheTdfId];
        changed = true;
      }
    }

    if (!changed) {
      return false;
    }

    await UserDashboardCache.updateAsync(
      { _id: cache._id },
      {
        $set: {
          tdfStats: nextTdfStats,
          summary: computeSummaryStats(nextTdfStats),
          usageSummary: computeUsageSummary(nextTdfStats),
          lastUpdated: new Date()
        }
      }
    );
    return true;
  }

  const practiceSnapshotMethods = createDashboardPracticeSnapshotMethods({
    Meteor,
    Tdfs,
    Assignments,
    Sections,
    SectionUserMap,
    UserDashboardCache,
    usersCollection,
    DynamicSettings,
    canViewDashboardTdf,
    ...(decryptData ? { decryptData } : {})
  });
  const learnerConfigMethods = createDashboardLearnerConfigMethods({
    getAccessibleTdf,
    Meteor,
    UserDashboardCache,
  });

  const methods = {
    ...practiceSnapshotMethods,
    ...learnerConfigMethods,

    initializeDashboardCache: async function(this: any, userId: string | null = null) {
      const targetUserId = userId || this.userId;
      if (!targetUserId) {
        throw new Meteor.Error('not-authorized', 'Must be logged in');
      }

      if (targetUserId !== this.userId) {
        const isAdmin = await Roles.userIsInRoleAsync(this.userId, ['admin']);
        if (!isAdmin) {
          throw new Meteor.Error('not-authorized', 'Cannot initialize cache for other users');
        }
      }

      return await redisBoundary.withLock(
        `dashboard-cache:initialize:${targetUserId}`,
        120000,
        async () => {
      serverConsole(`Initializing dashboard cache for user ${targetUserId}`);

      const targetUser = await usersCollection.findOneAsync(
        { _id: targetUserId },
        { fields: { _id: 1 } }
      );
      if (!targetUser) {
        throw new Meteor.Error('not-found', 'Cannot initialize cache for missing user');
      }

      const attemptedTdfIds = await Histories.rawCollection().distinct('TDFId', {
        userId: targetUserId,
        ...dashboardHistorySelector()
      });

      if (attemptedTdfIds.length === 0) {
        await UserDashboardCache.upsertAsync(
          { userId: targetUserId },
          {
            $set: {
              userId: targetUserId,
              tdfStats: {},
              summary: {
                totalTdfsAttempted: 0,
                totalTrialsAllTime: 0,
                totalTimeAllTime: 0,
                overallAccuracyAllTime: 0,
                lastActivityDate: null
              },
              usageSummary: computeUsageSummary({}),
              lastUpdated: new Date(),
              version: DASHBOARD_CACHE_VERSION
            },
            $setOnInsert: {
              createdAt: new Date()
            }
          }
        );
        return { success: true, tdfCount: 0 };
      }

      const attemptedTdfs = await Tdfs.find({
        _id: { $in: attemptedTdfIds }
      }, {
        fields: {
          _id: 1,
          'content.fileName': 1,
          'content.tdfs.tutor.setspec.lessonname': 1
        }
      }).fetchAsync();

      const rootTdfs = await lessonFamilies.findRootsForChildTdfs(attemptedTdfs as any[], {
        _id: 1,
        'content.tdfs.tutor.setspec.lessonname': 1,
        'content.tdfs.tutor.setspec.condition': 1,
        'content.tdfs.tutor.setspec.conditionTdfIds': 1
      });

      const childToRootMap = lessonFamilies.buildChildToRootMap(rootTdfs as any[], attemptedTdfs as any[]);
      const rootTdfMap: Map<any, any> = new Map();
      for (const rootTdf of rootTdfs as any[]) {
        rootTdfMap.set(rootTdf._id, rootTdf);
      }

      const tdfMap: Map<any, any> = new Map((attemptedTdfs as any[]).map((t: any) => [t._id, t]));
      const tdfStats: Record<string, any> = {};
      let lastHistoryId: unknown = null;
      let processedHistoryCount = 0;
      while (true) {
        const historySelector = {
          userId: targetUserId,
          TDFId: { $in: attemptedTdfIds },
          ...dashboardHistorySelector(),
          ...(lastHistoryId === null ? {} : { _id: { $gt: lastHistoryId } }),
        };
        const historyBatch: DashboardHistoryRecord[] = await Histories.find(historySelector, {
          fields: DASHBOARD_HISTORY_FIELDS,
          sort: { _id: 1 },
          limit: DASHBOARD_HISTORY_REBUILD_BATCH_SIZE,
        }).fetchAsync();
        if (historyBatch.length === 0) {
          break;
        }

        for (const record of historyBatch) {
          const tdf = tdfMap.get(record.TDFId);
          if (!tdf) continue;

          const fileName = tdf.content?.fileName as string | undefined;
          const rootTdfId =
            (fileName ? childToRootMap.get(fileName) : undefined) ||
            (record.TDFId ? childToRootMap.get(record.TDFId) : undefined);
          const targetTdfId = rootTdfId || record.TDFId;
          if (!targetTdfId) continue;

          const rootTdf = rootTdfMap.get(targetTdfId);
          const displayName = rootTdf?.content?.tdfs?.tutor?.setspec?.lessonname ||
            tdfMap.get(targetTdfId)?.content?.tdfs?.tutor?.setspec?.lessonname ||
            'Unnamed';
          tdfStats[targetTdfId] = applyDashboardHistoryRecordToStats(
            tdfStats[targetTdfId],
            record,
            displayName,
            computePracticeTimeMs
          );
        }

        processedHistoryCount += historyBatch.length;
        lastHistoryId = historyBatch[historyBatch.length - 1]?._id ?? null;
        if (lastHistoryId === null) {
          throw new Error('Dashboard history rebuild encountered a row without an _id');
        }
        if (processedHistoryCount % DASHBOARD_HISTORY_REBUILD_PROGRESS_INTERVAL === 0) {
          serverConsole(`[Cache] Processed ${processedHistoryCount} history rows for user ${targetUserId}`);
        }
        if (historyBatch.length < DASHBOARD_HISTORY_REBUILD_BATCH_SIZE) {
          break;
        }
      }

      const summary = computeSummaryStats(tdfStats);
      const usageSummary = computeUsageSummary(tdfStats);

      await UserDashboardCache.upsertAsync(
        { userId: targetUserId },
        {
          $set: {
            userId: targetUserId,
            tdfStats,
            summary,
            usageSummary,
            lastUpdated: new Date(),
            version: DASHBOARD_CACHE_VERSION
          },
          $setOnInsert: {
            createdAt: new Date()
          }
        }
      );

      serverConsole(`Cache initialized for user ${targetUserId}: ${Object.keys(tdfStats).length} TDFs`);
      return { success: true, tdfCount: Object.keys(tdfStats).length };
        }
      );
    },

    ensureDashboardCacheCurrent: async function(this: any) {
      if (!this.userId) {
        throw new Meteor.Error('not-authorized', 'Must be logged in');
      }

      const userId = this.userId;
      return await redisBoundary.withLock(
        `dashboard-cache:ensure:${userId}`,
        120000,
        async () => {
          const cache = await UserDashboardCache.findOneAsync({ userId });
          const cacheTdfCount = Object.keys(cache?.tdfStats || {}).length;
          if (!cache) {
            const result = await methods.initializeDashboardCache.call(this);
            return {
              success: true,
              action: 'refreshed',
              reason: 'missing',
              tdfCount: result.tdfCount
            };
          }

          const latestHistory = await Histories.findOneAsync(
            {
              userId,
              ...dashboardHistorySelector()
            },
            {
              fields: { recordedServerTime: 1, time: 1 },
              sort: { recordedServerTime: -1, time: -1 }
            }
          );
          const latestHistoryTimestamp = latestHistory ? historyRecordTimestamp(latestHistory) : 0;
          const cacheUpdatedTimestamp = timestampValue(cache.lastUpdated);

          if (latestHistoryTimestamp > cacheUpdatedTimestamp) {
            const result = await methods.initializeDashboardCache.call(this);
            return {
              success: true,
              action: 'refreshed',
              reason: 'history-newer',
              tdfCount: result.tdfCount
            };
          }

          if (cache.version !== DASHBOARD_CACHE_VERSION) {
            const result = await methods.initializeDashboardCache.call(this);
            return {
              success: true,
              action: 'refreshed',
              reason: 'version',
              tdfCount: result.tdfCount
            };
          }

          return {
            success: true,
            action: 'current',
            tdfCount: cacheTdfCount
          };
        }
      );
    },

    applyDashboardHistoryRecord: async function(this: any, historyRecord: DashboardHistoryRecord) {
      const userId = this.userId;
      if (!userId) {
        throw new Meteor.Error('not-authorized', 'Must be logged in');
      }
      if (historyRecord.userId !== userId) {
        throw new Meteor.Error('not-authorized', 'Dashboard history must belong to the current user');
      }
      const TDFId = normalizeOptionalId(historyRecord.TDFId);
      if (!TDFId) {
        throw new Meteor.Error('invalid-args', 'Dashboard history requires a TDFId');
      }
      if (!shouldCountDashboardHistoryRecord(historyRecord)) {
        return { success: true, action: 'ignored', newRecords: 0 };
      }

      const family = await lessonFamilies.resolveLessonFamilyForTdf(TDFId, {
        _id: 1,
        'content.fileName': 1,
        'content.tdfs.tutor.setspec.lessonname': 1,
        'content.tdfs.tutor.setspec.condition': 1,
        'content.tdfs.tutor.setspec.conditionTdfIds': 1,
      });
      if (!family) {
        return { success: false, error: 'TDF not found' };
      }

      const parentRoot = family.roots.find((root: any) => String(root?._id || '') !== TDFId);
      const targetTdf = parentRoot || family.target;
      const targetTdfId = String(targetTdf?._id || TDFId);
      const displayName = targetTdf?.content?.tdfs?.tutor?.setspec?.lessonname
        || family.target?.content?.tdfs?.tutor?.setspec?.lessonname
        || 'Unnamed';

      return await redisBoundary.withLock(
        `dashboard-cache:increment:${userId}`,
        120000,
        async () => {
          let cache = await UserDashboardCache.findOneAsync({ userId });
          if (!cache || cache.version !== DASHBOARD_CACHE_VERSION) {
            const rebuilt = await methods.initializeDashboardCache.call(this);
            return { success: true, action: 'rebuilt', newRecords: rebuilt.tdfCount };
          }

          const currentStats = cache.tdfStats?.[targetTdfId] as DashboardTdfStats | undefined;
          if (historyRecord._id && currentStats?.lastProcessedHistoryId === historyRecord._id) {
            return { success: true, action: 'duplicate', newRecords: 0 };
          }
          const stats = applyDashboardHistoryRecordToStats(
            currentStats,
            historyRecord,
            displayName,
            computePracticeTimeMs
          );
          const updatedTdfStats = {
            ...(cache.tdfStats || {}),
            [targetTdfId]: stats
          };

          await UserDashboardCache.upsertAsync(
            { userId },
            {
              $set: {
                userId,
                tdfStats: updatedTdfStats,
                summary: computeSummaryStats(updatedTdfStats),
                usageSummary: computeUsageSummary(updatedTdfStats),
                lastUpdated: new Date(),
                version: DASHBOARD_CACHE_VERSION
              },
              $setOnInsert: {
                createdAt: new Date()
              }
            }
          );

          return { success: true, action: 'updated', newRecords: 1 };
        }
      );
    },

    refreshDashboardCache: async function(this: any) {
      if (!this.userId) {
        throw new Meteor.Error('not-authorized');
      }

      await UserDashboardCache.removeAsync({ userId: this.userId });
      return await methods.initializeDashboardCache.call(this);
    },

    resetOwnLessonProgress: async function(this: any, tdfId: string) {
      if (!this.userId) {
        throw new Meteor.Error('not-authorized', 'Must be logged in');
      }
      if (!GlobalExperimentStates) {
        throw new Meteor.Error('server-misconfigured', 'Experiment state collection is unavailable');
      }
      const normalizedTdfId = typeof tdfId === 'string' ? tdfId.trim() : '';
      if (!normalizedTdfId) {
        throw new Meteor.Error('invalid-args', 'TDF ID is required');
      }

      const scope = await collectLessonFamilyResetScope(normalizedTdfId);
      if (scope.tdfKeys.length === 0) {
        throw new Meteor.Error('invalid-state', 'No lesson progress scope could be resolved');
      }
      await assertNoAssignedCourseReset(this.userId, scope);

      const historyRemoved = await Histories.removeAsync({
        userId: this.userId,
        TDFId: { $in: scope.tdfKeys }
      });
      const experimentStateRemoved = await GlobalExperimentStates.removeAsync({
        userId: this.userId,
        $or: [
          { TDFId: { $in: scope.tdfKeys } },
          { 'experimentState.currentRootTdfId': { $in: scope.tdfKeys } },
          { 'experimentState.currentTdfId': { $in: scope.tdfKeys } },
          { 'experimentState.conditionTdfId': { $in: scope.tdfKeys } }
        ]
      });
      const cacheChanged = await removeLessonProgressFromCache(this.userId, scope.cacheTdfIds);

      return {
        success: true,
        tdfIds: scope.tdfIds,
        cacheTdfIds: scope.cacheTdfIds,
        historyRemoved,
        experimentStateRemoved,
        cacheChanged
      };
    },

    refreshUserAdminUsageCaches: async function(this: any, userIds: unknown) {
      if (!this.userId) {
        throw new Meteor.Error('not-authorized', 'Must be logged in');
      }

      const isAdmin = await Roles.userIsInRoleAsync(this.userId, ['admin']);
      if (!isAdmin) {
        throw new Meteor.Error('not-authorized', 'Admin only');
      }

      if (!Array.isArray(userIds)) {
        throw new Meteor.Error('invalid-args', 'Expected an array of user IDs');
      }

      const normalizedUserIds = [...new Set(userIds
        .map((userId) => typeof userId === 'string' ? userId.trim() : '')
        .filter((userId) => userId.length > 0))];

      if (normalizedUserIds.length === 0) {
        throw new Meteor.Error('invalid-args', 'No valid user IDs were provided');
      }

      if (normalizedUserIds.length > 100) {
        throw new Meteor.Error('invalid-args', 'Refresh is limited to 100 users at a time');
      }

      const refreshed: Array<{ userId: string; tdfCount: number }> = [];
      const failed: Array<{ userId: string; error: string }> = [];

      serverConsole(`[Cache] Refreshing ${normalizedUserIds.length} user dashboard caches with concurrency ${DASHBOARD_ADMIN_REFRESH_CONCURRENCY}`);
      await mapWithBoundedConcurrency(normalizedUserIds, DASHBOARD_ADMIN_REFRESH_CONCURRENCY, async (targetUserId) => {
        try {
          const result = await methods.initializeDashboardCache.call(this, targetUserId);
          refreshed.push({ userId: targetUserId, tdfCount: result.tdfCount });
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : String(error);
          failed.push({ userId: targetUserId, error: message });
        }
      }, (completed, total) => {
        serverConsole(`[Cache] Refreshed ${completed}/${total} user dashboard caches`);
      });

      return {
        success: failed.length === 0,
        refreshed,
        failed
      };
    },

    removeTdfFromCache: async function(this: any, tdfId: string) {
      if (!this.userId) {
        throw new Meteor.Error('not-authorized');
      }

      const isAdmin = await Roles.userIsInRoleAsync(this.userId, ['admin']);
      if (!isAdmin) {
        throw new Meteor.Error('not-authorized', 'Admin only');
      }

      const caches = await UserDashboardCache.find(
        { [`tdfStats.${tdfId}`]: { $exists: true } },
        { fields: { tdfStats: 1 } }
      ).fetchAsync();

      let modified = 0;

      for (const cache of caches) {
        delete cache.tdfStats[tdfId];
        const summary = computeSummaryStats(cache.tdfStats || {});
        const usageSummary = computeUsageSummary(cache.tdfStats || {});
        await UserDashboardCache.updateAsync(
          { _id: cache._id },
          {
            $set: {
              tdfStats: cache.tdfStats,
              summary,
              usageSummary,
              lastUpdated: new Date()
            }
          }
        );
        modified++;
      }

      return { success: true, modified };
    }
  };

  return methods;
}
