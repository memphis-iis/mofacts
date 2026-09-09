import {Roles} from 'meteor/alanning:roles';
// import * as ElaboratedFeedback from './lib/CachedElaboratedFeedback';
// import * as DefinitionalFeedback from '../server/lib/DefinitionalFeedback.js';
// import * as ClozeAPI from '../server/lib/ClozeAPI.js';
import {createExperimentExport, createExperimentExportByTdfIds, createExperimentExportFromHistories} from './experiment_times';
import {getNewItemFormat} from './conversions/convert';
import { legacyTrim } from '../common/underscoreCompat';
import _ from 'underscore';
const underscoreAny = _ as {
  trim?: (str: unknown) => string;
  intval?: (val: unknown) => number;
  display?: (val: unknown) => string;
};

// The npm 'underscore' package (used in Meteor 3 / rspack builds) does not include trim/intval/display helpers.
if (typeof underscoreAny.trim !== 'function') {
  underscoreAny.trim = function(str: unknown) {
    return str == null ? '' : String(str).trim();
  };
}
if (typeof underscoreAny.intval !== 'function') {
  underscoreAny.intval = function(val: unknown) {
    return parseInt(String(val), 10) || 0;
  };
}
if (typeof underscoreAny.display !== 'function') {
  underscoreAny.display = function(val: unknown) {
    return val == null ? '' : String(val);
  };
}
import { BackupJobs, TdfMutationJobs } from '../common/Collections';
import { runServerStartup } from './startup/serverStartup';
import { createStorageBoundary, getLocalStoragePaths } from './lib/storageBoundary';
import { createRedisBoundary } from './lib/redisBoundary';
import { registerServerRuntime } from './runtime/serverRuntime';
import { getResponseKCAnswerKey } from '../common/lib/responseKCAnswerKey';
import { validateAutoTutorContent } from '../common/lib/autoTutorContract';
import { computePracticeTimeMs } from '../lib/practiceTime';
import { createServerUtilityHelpers } from './lib/serverUtilities';
import { createTdfRuntimeLifecycleHelpers } from './lib/tdfRuntimeLifecycle';
import { createStimulusLookupHelpers } from './lib/stimulusLookup';
import { createAccessMethods } from './methods/accessMethods';
import { createAdminMethods } from './methods/adminMethods';
import { createAnalyticsMethods } from './methods/analyticsMethods';
import { createAuthMethods } from './methods/authMethods';
import { createContentMethods } from './methods/contentMethods';
import { createCourseMethods } from './methods/courseMethods';
import type { CourseAssignmentHistoryContext } from '../common/courseAssignments.contracts';
import { createDashboardCacheMethods } from './methods/dashboardCacheMethods';
import { createLearnerAnalyticsMethods } from './methods/learnerAnalyticsMethods';
import { createDeploymentReadinessMethods } from './methods/deploymentReadinessMethods';
import { createBackupMethods, createBackupRegistry } from './methods/backupMethods';
import { createSecurityAuditMethods } from './methods/securityAuditMethods';
import { reconcileInterruptedBackupJobs } from './lib/backup/backupService';
import { ensureSecurityAuditIndexes, SecurityAuditReports } from './securityAudit/securityAuditStorage';
import { createExperimentMethods } from './methods/experimentMethods';
import { createExperimentTargetFamilyResolver } from './lib/experimentTargetFamilyResolver';
import { createPackageMethods } from './methods/packageMethods';
import {
  createOpenRouterCatalogMethods,
  createOpenRouterModelCatalogService,
} from './methods/openRouterCatalogMethods';
import { createOpenRouterMethods } from './methods/openRouterMethods';
import { createProfileMethods } from './methods/profileMethods';
import { createSpeechMethods } from './methods/speechMethods';
import { createSystemMethods } from './methods/systemMethods';
import { createTurkWorkflowMethods } from './methods/turkWorkflowMethods';
import { createTdfIdentityMigrationMethods } from './methods/tdfIdentityMigrationMethods';
import {
  createThemeMethods,
  createUpdateActiveThemeDocument,
} from './methods/themeMethods';
import { createDeploymentBrandProfileMethods } from './methods/deploymentBrandProfileMethods';
import { getOrBuildCurrentPackageAsset } from './lib/packageExport';
import { getClassPerformanceByTdfWorkflow } from './lib/classPerformance';
import { createAuthSupport } from './lib/authSupport';
import { createMediaReferenceHelpers } from './lib/mediaReferences';
import { getMemphisSamlClientConfig } from './lib/memphisSaml';
import { createTdfLookupHelpers } from './lib/tdfLookup';
import {
  hasMeaningfulProgressSignal,
} from './lib/mappingPolicyClassifier';
import {
  canAccessContentUploadTdf,
  canDownloadOwnedTdfData,
  canViewDashboardTdf,
  hasSharedTdfAccess,
  isTdfOwner,
} from './lib/contentAccessPolicy';
import {
  ADMIN_API_KEY_SETTINGS_KEY,
  getAccessibleTdfApiKey,
  getUserPersonalApiKey,
  type ApiKeyResolutionDeps,
} from './lib/apiKeyResolution';
import {
  clearStimDisplayTypeMap,
  getStimDisplayTypeMap as getStimDisplayTypeMapSnapshot,
  getStimDisplayTypeMapVersion as getStimDisplayTypeMapSnapshotVersion,
  rebuildStimDisplayTypeMapSnapshot,
  updateStimDisplayTypeMap as refreshStimDisplayTypeMap,
} from './lib/stimDisplayTypeMap';
import {
  requireAuthenticatedUser,
  requireUserWithRoles,
  getUserRoleFlags,
  type MethodAuthorizationDeps,
} from './lib/methodAuthorization';
import { encryptData, decryptData } from './lib/encryption';
import {
  SERVER_VERBOSITY_SETTING,
  type LoggingVerbosityLevel,
  parseLoggingVerbosityLevel,
  shouldEmitLogMessage,
} from '../common/loggingSettings';
import { createServerVerbosityObserverCallbacks } from './lib/serverVerbosityObserver';
import { ensurePublicDemoCleanupIndex, purgeExpiredPublicDemoUsers } from './lib/publicDemoCleanup';

const MeteorAny = Meteor as any;

const AssetsAny = Assets as unknown as { getTextAsync: (path: string) => Promise<string> };
const PapaAny = (globalThis as unknown as {
  Papa?: { parse: (csv: string) => { data: unknown[] } };
}).Papa;




export { getTdfById, getHistoryByTDFID, getStimuliSetById, serverConsole, decryptData };

/* jshint sub:true*/

// The jshint inline option above suppresses a warning about using sqaure
// brackets instead of dot notation - that's because we prefer square brackets
// for creating some MongoDB queries
let serverVerbosityLevel: LoggingVerbosityLevel = SERVER_VERBOSITY_SETTING.defaultValue;
let serverVerbosityObserverHandle: { stop(): void } | undefined;
let publicDemoCleanupInterval: ReturnType<typeof setInterval> | undefined;

function setServerVerbosityLevel(value: unknown): void {
  serverVerbosityLevel = parseLoggingVerbosityLevel(value);
}

type UnknownRecord = Record<string, unknown>;
type MethodContext = {
  userId?: string | null;
  unblock?: () => void;
  connection?: { id?: string; clientAddress?: string | null } | null;
};
const AuthThrottleStateAny = (globalThis as any).AuthThrottleState as {
  findOneAsync(selector: UnknownRecord): Promise<UnknownRecord | null>;
  upsertAsync(selector: UnknownRecord, modifier: UnknownRecord): Promise<unknown>;
  updateAsync(selector: UnknownRecord, modifier: UnknownRecord): Promise<unknown>;
  removeAsync(selector: UnknownRecord): Promise<unknown>;
  rawCollection(): { createIndex(keys: UnknownRecord, options?: UnknownRecord): Promise<unknown> };
};

function getApiKeyResolutionDeps(): ApiKeyResolutionDeps {
  return {
    getUserById: async (userId: string) => await MeteorAny.users.findOneAsync({ _id: userId }),
    getTdfById: async (tdfId: string) => await Tdfs.findOneAsync({ _id: tdfId }),
    getAdminApiKeySettings: async () => await DynamicSettings.findOneAsync({ key: ADMIN_API_KEY_SETTINGS_KEY }),
    hasHistoryWithTdf: async (userId: string, tdfId: string) =>
      await Histories.findOneAsync({ userId, TDFId: tdfId }),
    userIsInRoleAsync: async (userId: string, roles: string[]) =>
      await Roles.userIsInRoleAsync(userId, roles),
    decryptData,
  };
}

function getApiKeyResolutionErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function getMethodAuthorizationDeps(): MethodAuthorizationDeps {
  return {
    userIsInRoleAsync: async (userId: string, roles: string[]) =>
      await Roles.userIsInRoleAsync(userId, roles),
  };
}

function isPlainRecord(value: unknown): value is UnknownRecord {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function cloneJsonLike<T>(value: T): T {
  if (value === undefined) {
    return value;
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

function removeRuntimeTdfSecrets<T>(tdf: T): T {
  const copy = cloneJsonLike(tdf) as any;
  const setspec = copy?.content?.tdfs?.tutor?.setspec;
  if (setspec && typeof setspec === 'object') {
    delete setspec.speechAPIKey;
    delete setspec.textToSpeechAPIKey;
    delete setspec.openRouterApiKey;
  }
  return copy;
}

const authSupport = createAuthSupport({
  usersCollection: MeteorAny.users,
  AuditLog,
  AuthThrottleState: AuthThrottleStateAny,
  serverConsole,
  getMethodAuthorizationDeps,
});
const {
  minPasswordLength,
  experimentUsernameRegex,
  normalizeAccountUsername,
  normalizeCanonicalEmail,
  isEmailVerificationRequired,
  isArgon2Enabled,
  getPasswordHashRuntimeInfo,
  buildAccountAuthState,
  buildSessionAuthState,
  syncUserAuthState,
  normalizeAuthIdentifier,
  getAuthClientIp,
  assertAuthThrottle,
  recordAuthThrottle,
  clearAuthThrottle,
  assertSoftLock,
  recordSoftLockFailure,
  applyMethodRateLimit,
  extractLoginAttemptIdentifier,
  exactCaseInsensitiveRegex,
  findNormalAccountUserByCanonicalEmail,
  isNormalAccountUser,
  isUserEmailVerified,
  getUserDisplayIdentifier,
  syncUsernameCaches,
  enforceCanonicalEmailIdentity,
  sendVerificationEmailForUser,
  escapeRegexLiteral,
  assertStrongPassword,
  isValidEmailAddress,
  createUserWithRetry,
  withSignUpLock,
  writeAuditLog,
  requireAdminUser,
  assertRequiredMeteorSettings,
  requireAllowPublicSignupSetting,
} = authSupport;

assertRequiredMeteorSettings();
const storageBoundary = createStorageBoundary(Meteor.settings);
const redisBoundary = createRedisBoundary(Meteor.settings);

// SECURITY FIX: Removed insecure TLS configuration
// Setting NODE_TLS_REJECT_UNAUTHORIZED = 0 disables certificate verification
// for ALL outbound HTTPS connections, making the app vulnerable to MITM attacks.
// This app should never disable TLS verification globally.



let nextStimuliSetId = 1;
let nextEventId = 1;

process.env.MAIL_URL = Meteor.settings.MAIL_URL;
const adminUsers = Meteor.settings.initRoles?.admins || [];
const ownerEmail = Meteor.settings.owner;
const emailFrom = Meteor.settings.emailFrom;
const emailReplyTo = Meteor.settings.emailReplyTo;
const isProd = Meteor.settings.prod || false;
serverConsole('isProd: ' + isProd);

const thisServerUrl = Meteor.settings.ROOT_URL;
serverConsole('thisServerUrl: ' + thisServerUrl);

// const clozeGeneration = require('./lib/Process.js');

const serverUtilities = createServerUtilityHelpers({
  ErrorReports,
  findUsersByIds: (userIds) => MeteorAny.users.find(
    { _id: { $in: userIds } },
    { fields: { _id: 1, username: 1, emails: 1 } }
  ).fetchAsync(),
  adminUsers,
  ownerEmail,
  emailFrom,
  emailReplyTo,
  thisServerUrl,
  isProd,
  serverConsole,
});
const {
  getDiskUsageInfo,
  buildDiskUsageStatus,
  sendEmail,
  sendErrorReportSummaries,
} = serverUtilities;

const stimulusLookupHelpers = createStimulusLookupHelpers({
  Tdfs,
  serverConsole,
  refreshStimDisplayTypeMap,
  getStimDisplayTypeMapSnapshot,
  getStimDisplayTypeMapSnapshotVersion,
});
const {
  getStimDisplayTypeMapDeps,
  updateStimDisplayTypeMap,
  getStimDisplayTypeMap,
  getStimDisplayTypeMapVersion,
  getStimuliSetById,
  getStimuliSetIdByFilename,
} = stimulusLookupHelpers;

const updateActiveThemeDocument = createUpdateActiveThemeDocument({
  serverConsole,
  DynamicSettings,
  usersCollection: MeteorAny.users,
});

const courseMethods = createCourseMethods({
  DynamicAssets,
  serverConsole,
  Courses,
  Sections,
  SectionUserMap,
  Assignments,
  Tdfs,
  UserDashboardCache,
  CourseLearnerSnapshotCache,
  Histories,
  itemSourceSentences,
  usersCollection: MeteorAny.users,
  sendEmail,
  emailFrom,
  thisServerUrl,
  getMethodAuthorizationDeps,
  getUserDisplayIdentifier,
  normalizeCanonicalId,
  removeRuntimeTdfSecrets,
});

const {
  resolveAssignedRootTdfIdsForUser: resolveAssignedRootTdfIdsForUserMethod,
  invalidateCourseSnapshotForUser: _invalidateCourseSnapshotForUser,
  invalidateCourseSnapshotsForCourse: _invalidateCourseSnapshotsForCourse,
  invalidateCourseSnapshotsForAssignment: _invalidateCourseSnapshotsForAssignment,
  refreshCourseSnapshotAfterPractice: refreshCourseSnapshotAfterPracticeMethod,
  getTdfIdsByOwnerId: getTdfIdsByOwnerIdMethod,
  getSourceSentences: _getSourceSentences,
  checkForTDFData: _checkForTDFData,
  ...publicCourseMethods
} = courseMethods as Record<string, unknown>;
const resolveAssignedRootTdfIdsForUser = resolveAssignedRootTdfIdsForUserMethod as (userId: string) => Promise<string[]>;
const invalidateCourseSnapshotsForCourse = _invalidateCourseSnapshotsForCourse as (courseId: string, reason: string) => Promise<unknown>;
const invalidateCourseSnapshotsForAssignment = _invalidateCourseSnapshotsForAssignment as (assignmentId: string, reason: string) => Promise<unknown>;
const refreshCourseSnapshotAfterPractice = refreshCourseSnapshotAfterPracticeMethod as (userId: string, TDFId: string) => Promise<void>;
const getTdfIdsByOwnerId = getTdfIdsByOwnerIdMethod as (ownerId: string) => Promise<string[] | null>;

const {
  deleteTdfRuntimeData,
} = createTdfRuntimeLifecycleHelpers({
  Assignments,
  Histories,
  GlobalExperimentStates,
  invalidateCourseSnapshotsForCourse,
  invalidateCourseSnapshotsForAssignment,
});

const tdfLookupHelpers = createTdfLookupHelpers({
  serverConsole,
  Tdfs,
  usersCollection: MeteorAny.users,
  GlobalExperimentStates,
  Assignments,
  Courses,
  Sections,
  SectionUserMap,
  normalizeCanonicalId,
  resolveAssignedRootTdfIdsForUser,
  canViewDashboardTdf,
  canAccessContentUploadTdf,
  isTdfOwner,
  hasSharedTdfAccess,
});
const {
  getTdfById,
  userCanManageTdf,
  assertUserOwnsTdfs,
} = tdfLookupHelpers;

const mediaReferenceHelpers = createMediaReferenceHelpers({
  DynamicAssets,
  serverConsole,
});
const {
  normalizeUploadedMediaLookupKey,
  extractSrcFromHtml,
  getMimeTypeForAssetName,
  getStimuliSetIdCandidates,
  parseLocalMediaReference,
  toCanonicalDynamicAssetPath,
  findDynamicAssetScoped,
  findDynamicAssetsScopedBatch,
  processAudioFilesForTDF,
  canonicalizeStimDisplayMediaRefs,
  canonicalizeFlatStimuliMediaRefs,
} = mediaReferenceHelpers;

const packageMethods = createPackageMethods({
  Tdfs,
  TdfMutationJobs,
  usersCollection: MeteorAny.users,
  DynamicAssets,
  ManualContentDrafts,
  storageBoundary,
  UserUploadQuota,
  AuditLog,
  ownerEmail,
  serverConsole,
  sendEmail,
  getCurrentUser: () => MeteorAny.userAsync(),
  userIsInRoleAsync: (userId, roles) => Roles.userIsInRoleAsync(userId, roles),
  normalizeCanonicalId,
  getResponseKCAnswerKey,
  getStimuliSetIdByFilename,
  userCanManageTdf,
  allocateNextStimuliSetId: () => {
    const stimuliSetId = nextStimuliSetId;
    nextStimuliSetId += 1;
    return stimuliSetId;
  },
  getNewItemFormat,
  legacyTrim,
  encryptData,
  getApiKeyResolutionDeps,
  updateStimDisplayTypeMap,
  rebuildStimDisplayTypeMapSnapshot,
  getStimDisplayTypeMapDeps,
  getMimeTypeForAssetName,
  parseLocalMediaReference,
  findDynamicAssetScoped,
  toCanonicalDynamicAssetPath,
  normalizeUploadedMediaLookupKey,
  processAudioFilesForTDF,
  canonicalizeStimDisplayMediaRefs,
  canonicalizeFlatStimuliMediaRefs,
});
const {
  getResponseKCMapForTdf,
  processPackageUpload,
  confirmPackageUpload,
  cancelPackageUpload,
  saveAiGeneratedPackageContent,
  saveTdfStimuli,
  saveTdfContent,
  copyTdf,
  upsertStimFile,
  importPrivateRepoTdfBatch,
  normalizeOptionalString,
} = packageMethods;

const dashboardCacheMethods = createDashboardCacheMethods({
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
  usersCollection: MeteorAny.users,
  DynamicSettings,
  decryptData,
  serverConsole,
  computePracticeTimeMs,
  canViewDashboardTdf,
  redisBoundary
});
const {
  applyDashboardHistoryRecord,
  ...publicDashboardCacheMethods
} = dashboardCacheMethods;

const learnerAnalyticsMethods = createLearnerAnalyticsMethods({
  Meteor,
  Tdfs,
  Histories,
  StimulusCrowdStats,
  getPracticeDashboardSnapshot: async (context) => (
    await dashboardCacheMethods.getPracticeDashboardSnapshot.call(context)
  ),
  getStimuliSetById,
  getResponseKCMapForTdf,
  now: () => Date.now(),
});

const analyticsMethods = createAnalyticsMethods({
  serverConsole,
  Histories,
  StimulusCrowdStats,
  GlobalExperimentStates,
  Tdfs,
  Assignments,
  Courses,
  Sections,
  SectionUserMap,
  usersCollection: MeteorAny.users,
  getMethodAuthorizationDeps,
  normalizeCanonicalId,
  normalizeOptionalString,
  canViewDashboardTdf,
  resolveAssignedRootTdfIdsForUser,
  allocateNextEventId: () => {
    const eventId = nextEventId;
    nextEventId += 1;
    return eventId;
  },
  syncUsernameCaches,
  createExperimentExport,
  createExperimentExportByTdfIds,
  createExperimentExportFromHistories,
  getTdfIdsByOwnerId,
  assertUserOwnsTdfs,
  canDownloadOwnedTdfData,
  getClassPerformanceByTdfWorkflow,
  getStimuliSetById,
  hasMeaningfulProgressSignal,
  onHistoryInserted: async (context, historyRecord) => {
    const tdfId = normalizeCanonicalId(historyRecord?.TDFId);
    if (!tdfId) {
      throw new Error('History insert completed without a TDFId for dashboard cache update');
    }
    await applyDashboardHistoryRecord.call(context, historyRecord);
    if (historyRecord?.userId) {
      await refreshCourseSnapshotAfterPractice(String(historyRecord.userId), tdfId);
    }
  },
});

const {
  getHistoryByTDFID: getHistoryByTDFIDMethod,
  getStimSetFromLearningSessionByClusterList: _getStimSetFromLearningSessionByClusterList,
  getUserLastFeedbackTypeFromHistory: _getUserLastFeedbackTypeFromHistory,
  ...publicAnalyticsMethods
} = analyticsMethods as Record<string, unknown>;
const getHistoryByTDFID = getHistoryByTDFIDMethod as (TDFId: string) => Promise<any[]>;

const speechMethods = createSpeechMethods({
  serverConsole,
  getApiKeyResolutionDeps,
  getApiKeyResolutionErrorMessage,
});

const openRouterModelCatalogService = createOpenRouterModelCatalogService({
  serverConsole,
});

export const resolveExperimentTargetFamily = createExperimentTargetFamilyResolver({ Tdfs });

const experimentMethods = createExperimentMethods({
  serverConsole,
  Tdfs,
  GlobalExperimentStates,
  usersCollection: MeteorAny.users,
  experimentUsernameRegex,
  normalizeAccountUsername,
  escapeRegexLiteral,
  withSignUpLock,
  createUserWithRetry,
  writeAuditLog,
  resolveExperimentTargetFamily,
});
const {
  getTdfByExperimentTarget: getTdfByExperimentTargetRaw,
  ...publicExperimentMethods
} = experimentMethods;

const turkWorkflowMethods = createTurkWorkflowMethods({
  serverConsole,
  Tdfs,
  ScheduledTurkMessages,
  usersCollection: MeteorAny.users,
  getCurrentUser: () => MeteorAny.userAsync(),
  getMethodAuthorizationDeps,
  encryptData,
});

// Published to all clients (even without subscription calls)
Meteor.publish(null, function() {
  // Only valid way to get the user ID for publications
  const userId = this.userId;

  // The default data published to every connected client: selected fields
  // from the current user's account document.
  const defaultData = [
    MeteorAny.users.find({_id: userId}, {
      fields: {
        username: 1,
        profile: 1,
        loginParams: 1,
        authState: 1,
        emails: 1,
        email_canonical: 1,
        email_original: 1,
        verificationEmailLastSentAt: 1
      }
    }),
  ];

  return defaultData;
});

function serverConsole(...args: unknown[]) {
  const pendingArgs = [...args];
  let messageLevel: LoggingVerbosityLevel = 1;
  const requestedLevel = pendingArgs[0];
  if (requestedLevel === 0 || requestedLevel === 1 || requestedLevel === 2) {
    messageLevel = requestedLevel;
    pendingArgs.shift();
  }
  if (!shouldEmitLogMessage(serverVerbosityLevel, messageLevel)) return;
  const disp: unknown[] = [(new Date()).toString()];
  for (let i = 0; i < pendingArgs.length; ++i) {
    disp.push(pendingArgs[i]);
  }
  console.log(...disp);
}

function normalizeCanonicalId(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

export const methods: any = {
  ...createSystemMethods({
    serverConsole,
    ScheduledTurkMessages,
    usersCollection: MeteorAny.users,
    ErrorReports,
    DynamicSettings,
    getMethodAuthorizationDeps,
    requireAdminUser,
    buildDiskUsageStatus,
    sendErrorReportSummaries,
    sendEmail,
    getCurrentUser: () => MeteorAny.userAsync(),
    setVerbosityLevel: setServerVerbosityLevel,
  }),

  ...publicExperimentMethods,

  ...createAccessMethods({
    serverConsole,
    Tdfs,
    usersCollection: MeteorAny.users,
    getMethodAuthorizationDeps,
    isTdfOwner,
    getUserDisplayIdentifier,
    exactCaseInsensitiveRegex,
    isValidEmailAddress,
    normalizeCanonicalId,
  }),

  ...createAdminMethods({
    serverConsole,
    csvParser: PapaAny,
    usersCollection: MeteorAny.users,
    Tdfs,
    DynamicAssets,
    Courses,
    DynamicSettings,
    Histories,
    GlobalExperimentStates,
    SectionUserMap,
    UserTimesLog,
    UserMetrics,
    PasswordResetTokens,
    UserDashboardCache,
    UserUploadQuota,
    requireAdminUser,
    normalizeCanonicalEmail,
    assertStrongPassword,
    withSignUpLock,
    findNormalAccountUserByCanonicalEmail,
    createUserWithRetry,
    enforceCanonicalEmailIdentity,
    writeAuditLog,
    syncUserAuthState,
    isEmailVerificationRequired,
    sendVerificationEmailForUser,
    getUserDisplayIdentifier,
    syncUsernameCaches,
    deleteTdfRuntimeData,
    clearStimDisplayTypeMap,
    encryptData,
    decryptData,
    openRouterModelCatalogService,
  }),
  ...createAuthMethods({
    serverConsole,
    ownerEmail,
    emailFrom,
    usersCollection: MeteorAny.users,
    PasswordResetTokens,
    requireAdminUser,
    getMethodAuthorizationDeps,
    getUserRoleFlags,
    requireAllowPublicSignupSetting,
    getMemphisSamlClientConfig,
    minPasswordLength,
    normalizeCanonicalEmail,
    findNormalAccountUserByCanonicalEmail,
    applyMethodRateLimit,
    getAuthClientIp,
    sendEmail,
    writeAuditLog,
    assertStrongPassword,
    enforceCanonicalEmailIdentity,
    syncUserAuthState,
    createUserWithRetry,
    withSignUpLock,
    isEmailVerificationRequired,
    sendVerificationEmailForUser,
    normalizeAuthIdentifier,
    getUserDisplayIdentifier,
    isNormalAccountUser,
    isUserEmailVerified,
    buildSessionAuthState,
    normalizeCanonicalId,
    syncUsernameCaches,
    encryptData,
    getUserPersonalApiKey,
    getAccessibleTdfApiKey,
    getApiKeyResolutionDeps,
    getPasswordHashRuntimeInfo,
  }),

  ...createContentMethods({
    ManualContentDrafts,
    Tdfs,
    Stims,
    DynamicAssets,
    usersCollection: MeteorAny.users,
    UserUploadQuota,
    AuditLog,
    serverConsole,
    isPlainRecord,
    cloneJsonLike,
    normalizeCanonicalId,
    canAccessContentUploadTdf,
    getOrBuildCurrentPackageAsset,
    storageBoundary,
    parseLocalMediaReference,
    extractSrcFromHtml,
    getStimuliSetIdCandidates,
    findDynamicAssetsScopedBatch,
    decryptData,
    deleteTdfRuntimeData,
    updateStimDisplayTypeMap,
    rebuildStimDisplayTypeMapSnapshot,
    getStimDisplayTypeMapDeps,
    getMethodAuthorizationDeps,
  }),

  ...createThemeMethods({
    serverConsole,
    DynamicSettings,
    usersCollection: MeteorAny.users,
    requireAdminUser,
    getMethodAuthorizationDeps,
    updateActiveThemeDocument,
  }),

  ...createDeploymentBrandProfileMethods({
    requireAdminUser,
  }),

  ...createProfileMethods({
    usersCollection: MeteorAny.users,
    Tdfs,
    encryptData,
    decryptData,
    openRouterModelCatalogService,
  }),
}

function getStimuliSetIdCandidatesForMethod(stimuliSetId: string | number) {
  const candidates = new Set<string | number>();
  if (typeof stimuliSetId === 'number' && Number.isFinite(stimuliSetId)) {
    candidates.add(stimuliSetId);
    candidates.add(String(stimuliSetId));
  } else if (typeof stimuliSetId === 'string') {
    const trimmed = stimuliSetId.trim();
    if (trimmed) {
      candidates.add(trimmed);
      const numeric = Number(trimmed);
      if (Number.isFinite(numeric)) {
        candidates.add(numeric);
      }
    }
  }
  return Array.from(candidates);
}

async function getTdfByIdPublic(this: MethodContext, TDFId: string, options?: unknown) {
  const userId = requireAuthenticatedUser(this.userId, 'Must be logged in to access TDF content', 401);
  const tdf = await getTdfById.call({ userId }, TDFId, options as any);
  return tdf ? removeRuntimeTdfSecrets(tdf) : tdf;
}

function requireRelationshipGraph(value: unknown): Record<string, Record<string, number>> {
  if (!isPlainRecord(value)) {
    throw new Meteor.Error(400, 'AutoTutor expectation relationships must be an object');
  }
  const graph: Record<string, Record<string, number>> = {};
  for (const [sourceId, rawTargets] of Object.entries(value)) {
    if (!isPlainRecord(rawTargets)) {
      throw new Meteor.Error(400, `AutoTutor expectation relationships.${sourceId} must be an object`);
    }
    graph[sourceId] = {};
    for (const [targetId, rawScore] of Object.entries(rawTargets)) {
      if (typeof rawScore !== 'number' || !Number.isFinite(rawScore) || rawScore < 0 || rawScore > 1) {
        throw new Meteor.Error(400, `AutoTutor expectation relationship ${sourceId}.${targetId} must be a number from 0 to 1`);
      }
      graph[sourceId]![targetId] = rawScore;
    }
  }
  return graph;
}

async function persistAutoTutorExpectationRelationships(
  this: MethodContext,
  tdfId: string,
  clusterIndex: number,
  scriptId: string,
  expectationRelationships: unknown,
  expectationRelationshipProvenance: unknown,
) {
  const userId = requireAuthenticatedUser(this.userId, 'Must be logged in to update AutoTutor derived data', 401);
  const normalizedTdfId = normalizeCanonicalId(tdfId);
  if (!normalizedTdfId) {
    throw new Meteor.Error(400, 'TDF id is required');
  }
  if (!Number.isInteger(clusterIndex) || clusterIndex < 0) {
    throw new Meteor.Error(400, 'AutoTutor cluster index must be a non-negative integer');
  }
  if (typeof scriptId !== 'string' || !scriptId.trim()) {
    throw new Meteor.Error(400, 'AutoTutor script id is required');
  }
  const accessibleTdf = await getTdfById.call({ userId }, normalizedTdfId);
  if (!accessibleTdf) {
    throw new Meteor.Error(403, 'You do not have access to this AutoTutor content');
  }
  const rawStimuliFile = cloneJsonLike(accessibleTdf.rawStimuliFile);
  const clusters = isPlainRecord(rawStimuliFile?.setspec) && Array.isArray(rawStimuliFile.setspec.clusters)
    ? rawStimuliFile.setspec.clusters
    : null;
  const cluster = clusters?.[clusterIndex];
  const firstStim = isPlainRecord(cluster) && Array.isArray(cluster.stims) ? cluster.stims[0] : null;
  const autoTutor = isPlainRecord(firstStim) && isPlainRecord(firstStim.autoTutor) ? firstStim.autoTutor : null;
  if (!autoTutor || autoTutor.id !== scriptId) {
    throw new Meteor.Error(400, 'AutoTutor script id does not match the requested TDF cluster');
  }

  autoTutor.expectationRelationships = requireRelationshipGraph(expectationRelationships);
  if (!isPlainRecord(expectationRelationshipProvenance)) {
    throw new Meteor.Error(400, 'AutoTutor expectation relationship provenance must be an object');
  }
  autoTutor.expectationRelationshipProvenance = expectationRelationshipProvenance;

  const validation = validateAutoTutorContent({
    tdf: accessibleTdf.content?.tdfs,
    stimuli: rawStimuliFile,
  });
  if (!validation.valid) {
    throw new Meteor.Error('invalid-autotutor-content', validation.errors.join('; '));
  }

  const stimulusFileName = accessibleTdf.stimulusFileName ||
    accessibleTdf.content?.tdfs?.tutor?.setspec?.stimulusfile ||
    'unknown';
  const responseKCMap = await getResponseKCMapForTdf(normalizedTdfId);
  const stimuli = getNewItemFormat({
    fileName: stimulusFileName,
    stimuli: rawStimuliFile,
    owner: accessibleTdf.ownerId || userId,
    source: 'autotutor-derived-data',
  }, stimulusFileName, accessibleTdf.stimuliSetId, responseKCMap);

  await Tdfs.updateAsync({ _id: normalizedTdfId }, {
    $set: {
      rawStimuliFile,
      stimuli,
    },
    $inc: { tdfRevision: 1 },
  });
  if (accessibleTdf.stimuliSetId !== undefined && accessibleTdf.stimuliSetId !== null) {
    await updateStimDisplayTypeMap([accessibleTdf.stimuliSetId]);
  }
  return { success: true, stimuliCount: stimuli.length };
}

function buildPublicExperimentEntry(tdf: any) {
  const tutor = isPlainRecord(tdf?.content?.tdfs?.tutor)
    ? tdf.content.tdfs.tutor
    : {};
  const setspec = isPlainRecord(tutor.setspec)
    ? tutor.setspec
    : {};
  const publicSetSpec: UnknownRecord = {};
  for (const key of [
    'lessonname',
    'condition',
    'experimentTarget',
    'experimentPasswordRequired',
    'speechIgnoreOutOfGrammarResponses',
    'srfilterclose',
    'speechOutOfGrammarFeedback',
    'showPageNumbers',
    'audioPromptMode',
    'audioInputEnabled',
    'audioPromptFeedbackSpeakingRate',
    'audioPromptQuestionSpeakingRate',
    'audioPromptVoice',
    'audioPromptQuestionVolume',
    'audioPromptFeedbackVolume',
    'audioPromptFeedbackVoice',
  ]) {
    if (Object.prototype.hasOwnProperty.call(setspec, key)) {
      publicSetSpec[key] = cloneJsonLike((setspec as UnknownRecord)[key]);
    }
  }
  const tutorDeliverySettings = isPlainRecord((tutor as UnknownRecord).deliverySettings)
    ? (tutor as { deliverySettings?: UnknownRecord }).deliverySettings
    : null;
  const publicDeliverySettings =
    tutorDeliverySettings && typeof tutorDeliverySettings.experimentLoginText === 'string'
      ? { experimentLoginText: tutorDeliverySettings.experimentLoginText }
      : undefined;

  return {
    _id: tdf?._id || null,
    stimuliSetId: tdf?.stimuliSetId ?? null,
    content: {
      isMultiTdf: tdf?.content?.isMultiTdf ?? null,
      tdfs: {
        tutor: {
          setspec: publicSetSpec,
          ...(publicDeliverySettings ? { deliverySettings: publicDeliverySettings } : {}),
        },
      },
    },
  };
}

async function getTdfByExperimentTargetPublic(this: MethodContext, experimentTarget: string) {
  const normalizedTarget = typeof experimentTarget === 'string'
    ? experimentTarget.trim().toLowerCase()
    : '';
  if (!normalizedTarget) {
    return null;
  }

  const tdf = await getTdfByExperimentTargetRaw(normalizedTarget);
  if (!tdf) {
    return null;
  }

  const userId = typeof this.userId === 'string' && this.userId.trim()
    ? this.userId.trim()
    : null;
  if (userId && tdf?._id) {
    try {
      return await getTdfById.call({ userId }, String(tdf._id));
    } catch (error: unknown) {
      if (!(error instanceof Meteor.Error) || (error.error !== 401 && error.error !== 403)) {
        throw error;
      }
    }
  }

  return buildPublicExperimentEntry(tdf);
}

async function getStimuliSetByIdPublic(this: MethodContext, stimuliSetId: string | number) {
  const userId = requireAuthenticatedUser(this.userId, 'Must be logged in to access stimulus content', 401);
  const candidates = getStimuliSetIdCandidatesForMethod(stimuliSetId);
  if (candidates.length === 0) {
    throw new Meteor.Error(400, 'Invalid stimuli set id');
  }

  const tdfs = await Tdfs.find(
    { stimuliSetId: { $in: candidates } },
    { fields: { _id: 1, stimuliSetId: 1 } }
  ).fetchAsync();
  if (tdfs.length === 0) {
    return [];
  }

  for (const tdf of tdfs) {
    const tdfId = normalizeCanonicalId(tdf?._id);
    if (!tdfId) {
      continue;
    }
    try {
      await getTdfById.call({ userId }, tdfId);
      return await getStimuliSetById(tdf.stimuliSetId ?? stimuliSetId);
    } catch (error: unknown) {
      if (error instanceof Meteor.Error && (error.error === 403 || error.error === 401)) {
        continue;
      }
      throw error;
    }
  }

  throw new Meteor.Error(403, 'Not authorized to access this stimulus set');
}

async function getResponseKCMapForTdfPublic(
  this: MethodContext,
  tdfId: string,
  options: { courseAssignment?: CourseAssignmentHistoryContext | null } = {},
) {
  const userId = requireAuthenticatedUser(this.userId, 'Must be logged in to access response mappings', 401);
  await getTdfById.call({ userId }, tdfId, options);
  return await getResponseKCMapForTdf(tdfId);
}

async function updateStimDisplayTypeMapPublic(this: MethodContext, stimuliSetIds: unknown[] | null = null) {
  await requireUserWithRoles(getMethodAuthorizationDeps(), {
    userId: this.userId,
    roles: ['admin'],
    notLoggedInMessage: 'Must be logged in',
    notLoggedInCode: 401,
    forbiddenMessage: 'Admin access required to update stimulus display map',
    forbiddenCode: 403,
  });
  if (!Array.isArray(stimuliSetIds) || stimuliSetIds.length === 0) {
    return await rebuildStimDisplayTypeMapSnapshot(getStimDisplayTypeMapDeps());
  }
  return await updateStimDisplayTypeMap(stimuliSetIds);
}

async function getStimDisplayTypeMapPublic() {
  return await getStimDisplayTypeMap();
}

async function getStimDisplayTypeMapVersionPublic() {
  return await getStimDisplayTypeMapVersion();
}

export const asyncMethods: Record<string, unknown> = {
  ...createTdfIdentityMigrationMethods({
    Tdfs,
    UserTimesLog,
    ScheduledTurkMessages,
    AuditLog,
    userIsInRoleAsync: (userId, roles) => Roles.userIsInRoleAsync(userId, roles),
    serverConsole,
  }),
  getTdfByExperimentTarget: getTdfByExperimentTargetPublic,
  ...turkWorkflowMethods,

  ...publicAnalyticsMethods,
  ...publicCourseMethods,

  getStimDisplayTypeMap: getStimDisplayTypeMapPublic,
  getStimDisplayTypeMapVersion: getStimDisplayTypeMapVersionPublic,
  getStimuliSetById: getStimuliSetByIdPublic,
  updateStimDisplayTypeMap: updateStimDisplayTypeMapPublic,

  saveAiGeneratedPackageContent,

  getResponseKCMapForTdf: getResponseKCMapForTdfPublic,
  processPackageUpload,
  confirmPackageUpload,
  cancelPackageUpload,

  saveTdfStimuli, saveTdfContent,
  persistAutoTutorExpectationRelationships,
  copyTdf,

  getTdfById: getTdfByIdPublic,

  ...speechMethods,

  ...createOpenRouterMethods({
    serverConsole,
    getApiKeyResolutionDeps,
    getMethodAuthorizationDeps,
    openRouterModelCatalogService,
    assertPublicDemoAiQuota: async (userId: string, clientAddress: string) => {
      const user = await MeteorAny.users.findOneAsync(
        { _id: userId },
        { fields: { 'profile.createdBy': 1, 'profile.demoExpiresAt': 1 } },
      );
      if (user?.profile?.createdBy !== 'publicDemo') return;
      const expiresAt = user?.profile?.demoExpiresAt instanceof Date
        ? user.profile.demoExpiresAt
        : new Date(user?.profile?.demoExpiresAt);
      if (!Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
        throw new Meteor.Error('public-demo-expired', 'This public demonstration has expired');
      }
      await applyMethodRateLimit('public-demo-openrouter', clientAddress, userId, {
        ipLimit: 60,
        identifierLimit: 60,
        windowMs: 60 * 60 * 1000,
      });
    },
  }),

  ...createOpenRouterCatalogMethods(openRouterModelCatalogService),

  ...publicDashboardCacheMethods,
  ...learnerAnalyticsMethods,

  ...createDeploymentReadinessMethods({
    Roles,
    Tdfs,
    usersCollection: MeteorAny.users,
    redisBoundary
  }),

  ...createBackupMethods({
    settings: Meteor.settings || {},
    backupJobs: createBackupRegistry(BackupJobs),
    rawDatabase: () => Tdfs.rawDatabase(),
    usersCollection: MeteorAny.users,
    auditLog: AuditLog,
    requireAdminUser: authSupport.requireAdminUser,
  }),

  ...createSecurityAuditMethods({
    reports: SecurityAuditReports,
    requireAdminUser: authSupport.requireAdminUser,
  }),
}

// Server-side startup logic
Meteor.methods({...methods, ...asyncMethods});

registerServerRuntime({
  DynamicAssets,
  storageBoundary,
  storageRoot: getLocalStoragePaths(Meteor.settings, process.env).dynamicAssetsPath,
  serverConsole,
});

Meteor.startup(async function() {
  await ensureSecurityAuditIndexes();
  const publicDemoCleanupDeps = {
    usersCollection: MeteorAny.users,
    Histories,
    GlobalExperimentStates,
    SectionUserMap,
    UserTimesLog,
    UserMetrics,
    PasswordResetTokens,
    UserDashboardCache,
    UserUploadQuota,
    AuditLog,
    syncUsernameCaches,
    writeAuditLog,
    serverConsole,
  };
  await ensurePublicDemoCleanupIndex(publicDemoCleanupDeps);
  await purgeExpiredPublicDemoUsers(publicDemoCleanupDeps);
  publicDemoCleanupInterval = setInterval(() => {
    void purgeExpiredPublicDemoUsers(publicDemoCleanupDeps).catch((error: unknown) => {
      serverConsole('[PUBLIC-DEMO] expiration cleanup failed', error instanceof Error ? error.message : String(error));
    });
  }, 60 * 60 * 1000);
  const interruptedBackupCount = await reconcileInterruptedBackupJobs({
    backupJobs: createBackupRegistry(BackupJobs),
  });
  if (interruptedBackupCount > 0) {
    serverConsole(0, `[Backups] Marked ${interruptedBackupCount} interrupted backup job(s) as failed after server startup.`);
  }
  await runServerStartup({
    serverConsole,
    DynamicSettings,
    Courses,
    Assignments,
    CourseLearnerSnapshotCache,
    usersCollection: MeteorAny.users,
    ManualContentDrafts,
    TdfMutationJobs,
    DynamicAssets,
    ScheduledTurkMessages,
    AuthThrottleState: AuthThrottleStateAny,
    Tdfs,
    Histories,
    StimulusCrowdStats,
    AssetsAny,
    updateActiveThemeDocument,
    upsertStimFile,
    importPrivateRepoTdfBatch,
    updateStimDisplayTypeMap,
    sendErrorReportSummaries,
    sendEmail,
    getDiskUsageInfo,
    ownerEmail,
    emailFrom,
    emailReplyTo,
    isProd,
    thisServerUrl,
    enforceCanonicalEmailIdentity,
    syncUserAuthState,
    writeAuditLog,
    getAuthClientIp,
    buildSessionAuthState,
    extractLoginAttemptIdentifier,
    assertSoftLock,
    assertAuthThrottle,
    recordAuthThrottle,
    recordSoftLockFailure,
    clearAuthThrottle,
    normalizeCanonicalEmail,
    isValidEmailAddress,
    buildAccountAuthState,
    syncUsernameCaches,
    isArgon2Enabled,
    getPasswordHashRuntimeInfo,
    setServerVerbosityLevel,
    setRuntimeCounters: ({ nextStimuliSetId: nextStimuliSetIdValue, nextEventId: nextEventIdValue }) => {
      nextStimuliSetId = nextStimuliSetIdValue;
      nextEventId = nextEventIdValue;
    }
  });

  serverVerbosityObserverHandle?.stop();
  serverVerbosityObserverHandle = await DynamicSettings.find(
    { _id: SERVER_VERBOSITY_SETTING.id },
    { fields: { value: 1 } },
  ).observeChanges(createServerVerbosityObserverCallbacks(setServerVerbosityLevel));
  if (!serverVerbosityObserverHandle || typeof serverVerbosityObserverHandle.stop !== 'function') {
    throw new Error('Server verbosity Change Streams observer did not provide a stop handle');
  }
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    serverVerbosityObserverHandle?.stop();
    serverVerbosityObserverHandle = undefined;
    if (publicDemoCleanupInterval) {
      clearInterval(publicDemoCleanupInterval);
      publicDemoCleanupInterval = undefined;
    }
  });
}
