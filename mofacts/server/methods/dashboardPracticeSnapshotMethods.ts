import {
  buildLearnerTdfConfig,
  LEARNER_TDF_FIELD_DEFINITIONS,
  learnerTdfFieldAppliesToUnit,
  unitHasConfigurableRuntime,
  type LearnerTdfConfig,
} from '../../common/lib/learnerTdfConfig';
import { detectTdfUnitType } from '../../common/fieldApplicability';
import {
  findProfileAvatarIcon,
  normalizeProfileAvatarType,
} from '../../common/profileAvatar';
import type {
  DashboardTdfStats,
  PracticeDashboardCreator,
  PracticeDashboardSnapshotLesson,
} from './dashboardCacheMethods.contracts';
import {
  buildDashboardStatsProjection,
  normalizeOptionalString,
  PRACTICE_DASHBOARD_SNAPSHOT_VERSION,
  resolveDashboardTdfFileName,
} from './dashboardCacheShared';
import { ADMIN_API_KEY_SETTINGS_KEY } from '../lib/apiKeyResolution';
import { validateConditionFamilyTutor } from '../../common/lib/tdfIdentityContract';
import { assignmentMemberTdfIds } from '../../common/progressiveAssignments';

type DashboardPracticeSnapshotDeps = {
  Meteor: any;
  Tdfs: any;
  Assignments?: any;
  Sections?: any;
  SectionUserMap?: any;
  UserDashboardCache: any;
  usersCollection: {
    findOneAsync: (selector: Record<string, unknown>, options?: Record<string, unknown>) => Promise<any>;
    find: (
      selector: Record<string, unknown>,
      options?: Record<string, unknown>,
    ) => { fetchAsync: () => Promise<any[]> };
  };
  DynamicSettings: any;
  decryptData?: (value: string) => string;
  canViewDashboardTdf: (userId: unknown, tdf: any) => boolean;
};

type FirstContentUnitType = 'video' | 'autotutor' | 'assessment' | 'learning' | 'sparc' | 'conditionPool' | null;

async function resolveAssignedRootTdfIdsForUser({
  Assignments,
  Sections,
  SectionUserMap,
}: Pick<DashboardPracticeSnapshotDeps, 'Assignments' | 'Sections' | 'SectionUserMap'>, userId: string) {
  if (!Assignments || !Sections || !SectionUserMap) {
    throw new Error('Practice dashboard snapshot requires Assignments, Sections, and SectionUserMap dependencies');
  }
  const enrollmentRows = await SectionUserMap.find(
    { userId },
    { fields: { sectionId: 1 } }
  ).fetchAsync();
  const sectionIds = enrollmentRows
    .map((row: any) => normalizeOptionalString(row?.sectionId))
    .filter((id: string | null): id is string => !!id);
  if (sectionIds.length === 0) return [];

  const sections = await Sections.find(
    { _id: { $in: sectionIds } },
    { fields: { courseId: 1 } }
  ).fetchAsync();
  const courseIds = sections
    .map((section: any) => normalizeOptionalString(section?.courseId))
    .filter((id: string | null): id is string => !!id);
  if (courseIds.length === 0) return [];

  const assignmentRows = await Assignments.find(
    { courseId: { $in: [...new Set(courseIds)] } },
    { fields: { assignmentType: 1, TDFId: 1, memberTdfIds: 1, releaseAt: 1 } }
  ).fetchAsync();
  return assignmentRows
    .flatMap((row: any) => {
      const releaseAt = row.assignmentType === 'progressive' && row.releaseAt ? new Date(row.releaseAt) : null;
      if (releaseAt && Number.isFinite(releaseAt.getTime()) && releaseAt.getTime() > Date.now()) return [];
      return assignmentMemberTdfIds(row);
    })
    .map((id: string) => normalizeOptionalString(id))
    .filter((id: string | null): id is string => !!id);
}

async function getDashboardVisibleTdfs(deps: DashboardPracticeSnapshotDeps, userId: string) {
  const [assignedRootIds, user, adminApiKeySettings] = await Promise.all([
    resolveAssignedRootTdfIdsForUser(deps, userId),
    deps.usersCollection.findOneAsync(
      { _id: userId },
      { fields: { accessedTDFs: 1, speechAPIKey: 1, textToSpeechAPIKey: 1, ttsAPIKey: 1 } }
    ),
    deps.DynamicSettings.findOneAsync({ key: ADMIN_API_KEY_SETTINGS_KEY })
  ]);

  const explicitDashboardIds = [
    ...new Set([
      ...assignedRootIds,
      ...(Array.isArray(user?.accessedTDFs) ? user.accessedTDFs : [])
        .map((id: unknown) => normalizeOptionalString(id))
        .filter((id: string | null): id is string => !!id)
    ])
  ];
  const visibilityTerms: any[] = [
    { ownerId: userId },
    { 'accessors.userId': userId },
    { 'content.tdfs.tutor.setspec.userselect': 'true' },
  ];
  if (explicitDashboardIds.length > 0) {
    visibilityTerms.push({ _id: { $in: explicitDashboardIds } });
  }

  const projection = {
    _id: 1,
    stimuliSetId: 1,
    ownerId: 1,
    accessors: 1,
    conditionCounts: 1,
    tdfFileName: 1,
    'content.fileName': 1,
    'content.isMultiTdf': 1,
    'content.tdfs.tutor.setspec.lessonname': 1,
    'content.tdfs.tutor.setspec.tags': 1,
    'content.tdfs.tutor.setspec.contentLanguage': 1,
    'content.tdfs.tutor.setspec.recommendedUiLocales': 1,
    'content.tdfs.tutor.setspec.translationStatus': 1,
    'content.tdfs.tutor.setspec.condition': 1,
    'content.tdfs.tutor.setspec.conditionTdfIds': 1,
    'content.tdfs.tutor.setspec.audioInputEnabled': 1,
    'content.tdfs.tutor.setspec.srfilterclose': 1,
    'content.tdfs.tutor.setspec.audioPromptMode': 1,
    'content.tdfs.tutor.setspec.speechAPIKey': 1,
    'content.tdfs.tutor.setspec.textToSpeechAPIKey': 1,
    'content.tdfs.tutor.unit.learningsession': 1,
    'content.tdfs.tutor.unit.autotutorsession': 1,
    'content.tdfs.tutor.unit.assessmentsession': 1,
    'content.tdfs.tutor.unit.videosession': 1,
    'content.tdfs.tutor.unit.sparcsession': 1,
    'content.tdfs.tutor.unit.unitinstructions': 1,
  };

  const accessibleRoots = await deps.Tdfs.find(
    { $or: visibilityTerms },
    {
      fields: {
        _id: 1,
        'content.fileName': 1,
        'content.tdfs.tutor.setspec.condition': 1,
        'content.tdfs.tutor.setspec.conditionTdfIds': 1,
        tdfAvailability: 1,
      }
    }
  ).fetchAsync();

  const conditionTdfIds = new Set<string>();
  for (const root of accessibleRoots) {
    const validation = validateConditionFamilyTutor(root?.content?.tdfs?.tutor, { requireCanonicalIds: true });
    if (validation.errors.length === 0) {
      validation.conditionTdfIds.forEach((conditionTdfId: string) => conditionTdfIds.add(conditionTdfId));
    }
  }

  if (conditionTdfIds.size > 0) {
    visibilityTerms.push({ _id: { $in: Array.from(conditionTdfIds) } });
  }

  const tdfs = await deps.Tdfs.find({ $or: visibilityTerms }, { fields: projection }).fetchAsync();
  const ownerIds: string[] = [...new Set<string>(
    tdfs
      .map((tdf: any) => normalizeOptionalString(tdf?.ownerId))
      .filter((ownerId: string | null): ownerId is string => !!ownerId)
  )];
  const owners = ownerIds.length > 0
    ? await deps.usersCollection.find(
        { _id: { $in: ownerIds } },
        {
          fields: {
            'profile.displayName': 1,
            'profile.avatarType': 1,
            'profile.avatarIconId': 1,
            'profile.avatarImageData': 1,
          },
        }
      ).fetchAsync()
    : [];
  const ownerById = new Map<string, any>();
  for (const owner of owners) {
    const ownerId = normalizeOptionalString(owner?._id);
    if (ownerId) {
      ownerById.set(ownerId, owner);
    }
  }
  const creators: PracticeDashboardCreator[] = [];
  const creatorIndexByOwnerId = new Map<string, number>();
  for (const ownerId of ownerIds) {
    const owner = ownerById.get(ownerId);
    const displayName = normalizeOptionalString(owner?.profile?.displayName);
    if (!displayName) continue;

    const requestedAvatarType = normalizeProfileAvatarType(owner?.profile?.avatarType);
    const avatarIcon = requestedAvatarType === 'icon'
      ? findProfileAvatarIcon(owner?.profile?.avatarIconId)
      : null;
    const avatarImageData = requestedAvatarType === 'image'
      ? normalizeOptionalString(owner?.profile?.avatarImageData)
      : null;
    const avatarType = requestedAvatarType === 'icon' && avatarIcon
      ? 'icon'
      : requestedAvatarType === 'image' && avatarImageData
        ? 'image'
        : 'initials';

    creatorIndexByOwnerId.set(ownerId, creators.length);
    creators.push({
      displayName,
      avatarType,
      avatarIconId: avatarType === 'icon' ? avatarIcon?.id || null : null,
      avatarImageData: avatarType === 'image' ? avatarImageData : null,
    });
  }
  return {
    tdfs,
    creators,
    creatorIndexByOwnerId,
    hasSpeechAPIKey: Boolean(user?.speechAPIKey && String(user.speechAPIKey).trim()),
    hasTTSAPIKey: Boolean(
      (user?.ttsAPIKey && String(user.ttsAPIKey).trim()) ||
      (user?.textToSpeechAPIKey && String(user.textToSpeechAPIKey).trim())
    ),
    hasAdminSpeechAPIKey: adminApiKeyIsUsable(deps, adminApiKeySettings, 'googleSpeech'),
    hasAdminTTSAPIKey: adminApiKeyIsUsable(deps, adminApiKeySettings, 'googleTts')
  };
}

function getTdfConfigSource(tdf: any) {
  return {
    ...(tdf?.content || {}),
    updatedAt: tdf?.updatedAt,
    lastUpdated: tdf?.lastUpdated
  };
}

function getTutorUnits(tdfObject: any): any[] {
  const units = tdfObject?.tdfs?.tutor?.unit;
  return Array.isArray(units) ? units : [];
}

function tdfSetSpecHasKey(setspec: any, key: 'speechAPIKey' | 'textToSpeechAPIKey') {
  return Boolean(setspec?.[key] && String(setspec[key]).trim());
}

function adminApiKeyIsUsable(
  deps: Pick<DashboardPracticeSnapshotDeps, 'decryptData'>,
  adminApiKeySettings: any,
  provider: 'googleSpeech' | 'googleTts'
) {
  const encryptedKey = adminApiKeySettings?.value?.[provider]?.keyEncrypted;
  if (!(typeof encryptedKey === 'string' && encryptedKey.trim())) {
    return false;
  }
  if (!deps.decryptData) {
    return true;
  }
  try {
    return deps.decryptData(encryptedKey).trim().length > 0;
  } catch (_error) {
    return false;
  }
}

function getFirstContentUnitType(units: any[]): FirstContentUnitType {
  for (const unit of units) {
    const unitType = detectTdfUnitType(unit);
    if (!unitType || unitType === 'instructions') {
      continue;
    }
    if (unitType === 'video' || unitType === 'autotutor' || unitType === 'assessment' || unitType === 'learning' || unitType === 'sparc') {
      return unitType;
    }
    return null;
  }
  return null;
}

function getDashboardFeatureUnitType(setspec: any, units: any[]): FirstContentUnitType {
  if (Array.isArray(setspec?.condition) && setspec.condition.length > 0) {
    return 'conditionPool';
  }
  return getFirstContentUnitType(units);
}

function unitHasLearnerConfigurableFields(unit: any): boolean {
  return LEARNER_TDF_FIELD_DEFINITIONS.some((field) => (
    field.scope === 'unit' && learnerTdfFieldAppliesToUnit(field, unit)
  ));
}

function isBlocksEligible(tdf: any, setspec: any, units: any[]): boolean {
  if (tdf?.tdfAvailability === 'repair-required' || tdf?.content?.isMultiTdf) return false;
  if (Array.isArray(setspec?.condition) && setspec.condition.length > 0) return false;
  const runnableUnits = units.filter((unit) => detectTdfUnitType(unit) !== 'instructions');
  return runnableUnits.length > 0 && runnableUnits.every((unit) => detectTdfUnitType(unit) === 'learning');
}

function buildPracticeDashboardLesson(
  userId: string,
  tdf: any,
  creatorIndex: number | null,
  stats: DashboardTdfStats | undefined,
  learnerConfig: LearnerTdfConfig | null,
  hasSpeechAPIKey: boolean,
  hasTTSAPIKey: boolean,
  hasAdminSpeechAPIKey: boolean,
  hasAdminTTSAPIKey: boolean
): PracticeDashboardSnapshotLesson | null {
  const TDFId = normalizeOptionalString(tdf?._id);
  const tdfObject = tdf?.content;
  const setspec = tdfObject?.tdfs?.tutor?.setspec;
  if (!TDFId || !setspec) return null;
  const units = getTutorUnits(tdfObject);

  const fileName = resolveDashboardTdfFileName(tdf);
  const displayName = normalizeOptionalString(setspec.lessonname) || fileName || TDFId;
  const contentLanguage = normalizeOptionalString(setspec.contentLanguage) || '';
  const recommendedUiLocales = Array.isArray(setspec.recommendedUiLocales)
    ? setspec.recommendedUiLocales.map((locale: unknown) => normalizeOptionalString(locale)).filter(Boolean)
    : [];
  const translationStatus = normalizeOptionalString(setspec.translationStatus) || '';
  const totalPracticeItems = null;
  const statsProjection = buildDashboardStatsProjection(stats, totalPracticeItems);
  const conditions = tdf.ownerId === userId && Array.isArray(setspec.condition) && setspec.condition.length > 0
    ? (setspec.condition as string[]).map((conditionFileName: string, index: number) => ({
        fileName: conditionFileName,
        tdfId: Array.isArray(setspec.conditionTdfIds) && typeof setspec.conditionTdfIds[index] === 'string'
          ? setspec.conditionTdfIds[index]
          : null,
        count: Array.isArray(tdf.conditionCounts) && typeof tdf.conditionCounts[index] === 'number'
          ? tdf.conditionCounts[index]
          : 0
      }))
    : null;

  return {
    TDFId,
    displayName,
    creatorIndex,
    fileName: fileName || '',
    tags: Array.isArray(setspec.tags) ? setspec.tags : [],
    contentLanguage,
    recommendedUiLocales,
    translationStatus,
    availability: tdf.tdfAvailability === 'repair-required' ? 'repair-required' : 'available',
    currentStimuliSetId: tdf.stimuliSetId ?? null,
    learnerConfig,
    completed: false,
    locked: false,
    hidden: false,
    audioInputEnabled: String(setspec.audioInputEnabled || '').toLowerCase() === 'true',
    audioPromptMode: typeof setspec.audioPromptMode === 'string' ? setspec.audioPromptMode : 'silent',
    hasSpeechAPIKey: hasSpeechAPIKey || hasAdminSpeechAPIKey || tdfSetSpecHasKey(setspec, 'speechAPIKey'),
    hasTTSAPIKey: hasTTSAPIKey || hasAdminTTSAPIKey || tdfSetSpecHasKey(setspec, 'textToSpeechAPIKey'),
    firstContentUnitType: getDashboardFeatureUnitType(setspec, units),
    hasConfigurableSettings: units.some(unitHasConfigurableRuntime),
    hasLearnerConfigurableSettings: units.some(unitHasLearnerConfigurableFields),
    isMultiTdf: Boolean(tdfObject.isMultiTdf),
    isOwner: tdf.ownerId === userId,
    blocksEligible: isBlocksEligible(tdf, setspec, units),
    conditions,
    ...statsProjection
  };
}

export function createDashboardPracticeSnapshotMethods(deps: DashboardPracticeSnapshotDeps) {
  return {
    getPracticeDashboardSnapshot: async function(this: any) {
      if (!this.userId) {
        throw new deps.Meteor.Error('not-authorized', 'Must be logged in');
      }

      const userId = this.userId;
      const [{
        tdfs,
        creators,
        creatorIndexByOwnerId,
        hasSpeechAPIKey,
        hasTTSAPIKey,
        hasAdminSpeechAPIKey,
        hasAdminTTSAPIKey,
      }, cache] = await Promise.all([
        getDashboardVisibleTdfs(deps, userId),
        deps.UserDashboardCache.findOneAsync({ userId })
      ]);

      const conditionChildIds = new Set<string>();
      for (const tdf of tdfs) {
        const validation = validateConditionFamilyTutor(tdf?.content?.tdfs?.tutor, { requireCanonicalIds: true });
        if (validation.errors.length === 0) {
          validation.conditionTdfIds.forEach((conditionTdfId: string) => conditionChildIds.add(conditionTdfId));
        }
      }

      const lessons: PracticeDashboardSnapshotLesson[] = [];
      for (const tdf of tdfs) {
        const TDFId = normalizeOptionalString(tdf?._id);
        if (!TDFId) continue;
        if (conditionChildIds.has(TDFId)) {
          continue;
        }
        const lesson = buildPracticeDashboardLesson(
          userId,
          tdf,
          creatorIndexByOwnerId.get(normalizeOptionalString(tdf?.ownerId) || '') ?? null,
          cache?.tdfStats?.[TDFId],
          cache?.learnerTdfConfigs?.[TDFId] || null,
          hasSpeechAPIKey,
          hasTTSAPIKey,
          hasAdminSpeechAPIKey,
          hasAdminTTSAPIKey
        );
        if (lesson && !lesson.hidden) {
          lessons.push(lesson);
        }
      }

      return {
        version: PRACTICE_DASHBOARD_SNAPSHOT_VERSION,
        userId,
        generatedAt: Date.now(),
        creators,
        lessons
      };
    }
  };
}

export function buildLearnerTdfConfigForDashboard(tdf: any, tdfId: string, configPatch: any) {
  return buildLearnerTdfConfig(getTdfConfigSource(tdf), tdfId, configPatch);
}

export function getDashboardTdfConfigSource(tdf: any) {
  return getTdfConfigSource(tdf);
}
