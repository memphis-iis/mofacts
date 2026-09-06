import { Meteor } from 'meteor/meteor';
import { Accounts } from 'meteor/accounts-base';
import { Roles } from 'meteor/alanning:roles';
import { ServiceConfiguration } from 'meteor/service-configuration';
import { WebApp } from 'meteor/webapp';
import { curSemester } from '../../common/Definitions';
import { displayify } from '../../common/globalHelpers';
import type { NextFunction } from 'connect';
import type { IncomingMessage, ServerResponse } from 'http';
import _ from 'underscore';
import { themeRegistry } from '../lib/themeRegistry';
import { ensurePublishedDeploymentBrandProfile } from '../lib/deploymentBrandProfileRegistry';
import {
  extractMemphisSamlEmail,
  isMemphisSamlAccountUser,
} from '../lib/memphisSaml';
import { createPerformanceIndexes } from '../migrations/add_performance_indexes';
import { backfillPackageAssetIds } from '../migrations/backfill_package_asset_ids';
import { backfillConditionTdfIds } from '../migrations/backfill_condition_tdf_ids';
import { cleanExperimentStateDupesAndAddUniqueIndex } from '../migrations/clean_experiment_state_dupes';
import { migrateLoggingSettings } from '../migrations/migrate_logging_settings';
import { runStartupCleanupMigrations } from '../migrations/startup_cleanup_migrations';
import { migrateSparcHistoryPageIdentity } from '../migrations/migrate_sparc_history_page_identity';
import { migrateSparcAuthoredPageIdentity } from '../migrations/migrate_sparc_authored_page_identity';
import { migrateDynamicAssetLocalPaths } from '../migrations/migrate_dynamic_asset_local_paths';
import { purgeLearnerUnitAnalyticsCache } from '../migrations/purge_learner_unit_analytics_cache';
import { getLocalStoragePaths, getStorageBackend } from '../lib/storageBoundary';
import { sendScheduledTurkMessages } from '../turk_methods';
import { bootstrapPrivateRepoContentIfNeeded } from './bootstrapPrivateRepoContent';
import { startConfiguredMofactsCronJobs } from './mofactsCronRuntime';
import { reconcileInterruptedTdfMutationJobs } from '../lib/tdfMutationRecovery';
import { formatMongoConnectionValidation, validateMongoConnection } from '../lib/mongoConnectionValidation';
import { applyDdpContainment } from '../lib/ddpContainment';
import {
  createFailedPasswordResponseEnvelope,
  createPasswordTimingDefense,
  extractPasswordFromLoginArguments,
  extractPasswordLoginQuery,
  type MeteorPasswordLoginQuery,
  wrapPasswordLoginMethodWithResponseEnvelope,
} from '../lib/passwordTimingDefense';

const LEGACY_AI_CONTENT_DRAFT_TYPE = 'ai-content-creator';

type UnknownRecord = Record<string, unknown>;
type Logger = (...args: unknown[]) => void;

type RunServerStartupDeps = {
  serverConsole: Logger;
  DynamicSettings: {
    find: (selector: UnknownRecord, options?: UnknownRecord) => { fetchAsync: () => Promise<any[]> };
    findOneAsync: (selector: UnknownRecord) => Promise<any>;
    removeAsync: (selector: UnknownRecord) => Promise<number>;
    upsertAsync: (selector: UnknownRecord, modifier: UnknownRecord) => Promise<unknown>;
  };
  Courses: {
    find: (selector: UnknownRecord, options?: UnknownRecord) => { fetchAsync: () => Promise<any[]> };
    updateAsync: (selector: UnknownRecord, modifier: UnknownRecord, options?: UnknownRecord) => Promise<number>;
  };
  Assignments: {
    find: (selector?: UnknownRecord, options?: UnknownRecord) => { fetchAsync: () => Promise<any[]> };
    updateAsync: (selector: UnknownRecord, modifier: UnknownRecord, options?: UnknownRecord) => Promise<number>;
  };
  CourseLearnerSnapshotCache: {
    updateAsync: (selector: UnknownRecord, modifier: UnknownRecord, options?: UnknownRecord) => Promise<number>;
  };
  usersCollection: {
    findOneAsync: (selector: UnknownRecord, options?: UnknownRecord) => Promise<any>;
    updateAsync: (selector: UnknownRecord, modifier: UnknownRecord, options?: UnknownRecord) => Promise<number>;
    find: (selector: UnknownRecord, options?: UnknownRecord) => { fetchAsync: () => Promise<any[]> };
  };
  ManualContentDrafts: {
    find: (selector: UnknownRecord, options?: UnknownRecord) => { fetchAsync: () => Promise<any[]> };
    removeAsync: (selector: UnknownRecord) => Promise<unknown>;
    rawCollection: () => { createIndex: (keys: UnknownRecord, options?: UnknownRecord) => Promise<unknown> };
  };
  TdfMutationJobs: {
    rawCollection: () => any;
    insertAsync: (document: UnknownRecord) => Promise<unknown>;
    find: (selector: UnknownRecord, options?: UnknownRecord) => { fetchAsync: () => Promise<any[]> };
    updateAsync: (selector: UnknownRecord, modifier: UnknownRecord) => Promise<number>;
  };
  DynamicAssets: {
    removeAsync: (selector: UnknownRecord) => Promise<unknown>;
    collection: {
      find: (selector: UnknownRecord, options?: UnknownRecord) => { fetchAsync: () => Promise<any[]> };
      updateAsync: (selector: UnknownRecord, modifier: UnknownRecord) => Promise<unknown>;
      rawCollection: () => { createIndex: (keys: UnknownRecord, options?: UnknownRecord) => Promise<unknown> };
    };
  };
  ScheduledTurkMessages: {
    rawCollection: () => { createIndex: (keys: UnknownRecord, options?: UnknownRecord) => Promise<unknown> };
  };
  AuthThrottleState: {
    removeAsync: (selector: UnknownRecord) => Promise<unknown>;
    rawCollection: () => { createIndex: (keys: UnknownRecord, options?: UnknownRecord) => Promise<unknown> };
  };
  Tdfs: {
    rawDatabase: () => {
      databaseName?: string;
      command(command: UnknownRecord): Promise<UnknownRecord>;
      dropCollection(name: string): Promise<boolean>;
    };
    findOneAsync: (selector: UnknownRecord, options?: UnknownRecord) => Promise<any>;
    find: (selector?: UnknownRecord, options?: UnknownRecord) => {
      countAsync: () => Promise<number>;
      fetchAsync: () => Promise<any[]>;
    };
    updateAsync: (selector: UnknownRecord, modifier: UnknownRecord) => Promise<number>;
    removeAsync: (selector: UnknownRecord) => Promise<number>;
  };
  Histories: {
    findOneAsync: (selector: UnknownRecord, options?: UnknownRecord) => Promise<any>;
    find: (selector: UnknownRecord, options?: UnknownRecord) => { fetchAsync: () => Promise<any[]> };
    updateAsync: (selector: UnknownRecord, modifier: UnknownRecord) => Promise<number>;
  };
  StimulusCrowdStats: {
    rawCollection: () => { createIndex: (keys: UnknownRecord, options?: UnknownRecord) => Promise<unknown> };
  };
  AssetsAny: { getTextAsync: (path: string) => Promise<string> };
  updateActiveThemeDocument: (userId: string | null | undefined, mutator: (theme: any) => any) => Promise<unknown>;
  upsertStimFile: (filename: string, json: unknown, ownerId: string) => Promise<string | number | null | undefined>;
  importPrivateRepoTdfBatch: (records: any[], ownerId: string) => Promise<Array<{ tdfId: string; stimuliSetId?: number | string | null }>>;
  updateStimDisplayTypeMap: (stimuliSetIds: unknown[] | null) => Promise<unknown>;
  sendErrorReportSummaries: () => Promise<unknown>;
  sendEmail: (to: string, from: string, subject: string, text: string) => void;
  getDiskUsageInfo: (path?: string) => { free: number; total: number } | null;
  ownerEmail: string;
  emailFrom: string;
  emailReplyTo?: string;
  isProd: boolean;
  thisServerUrl: string;
  enforceCanonicalEmailIdentity: (userId: string, rawEmail?: unknown, options?: UnknownRecord) => Promise<void>;
  syncUserAuthState: (userId: string, primaryMethodHint?: string) => Promise<void>;
  writeAuditLog: (action: string, actorUserId: string | null, targetUserId: string | null, details?: UnknownRecord) => Promise<void>;
  getAuthClientIp: (source: { connection?: { clientAddress?: string | null } | null } | null | undefined) => string;
  buildSessionAuthState: (loginMode: string, primaryFactor: string) => unknown;
  extractLoginAttemptIdentifier: (attempt: any) => string;
  assertSoftLock: (lockKey: string) => Promise<void>;
  assertAuthThrottle: (action: string, bucket: string, limit: number, windowMs: number) => Promise<void>;
  recordAuthThrottle: (bucket: string) => Promise<void>;
  recordSoftLockFailure: (lockKey: string, failureBucketKey: string, threshold: number, windowMs: number, lockMs: number) => Promise<void>;
  clearAuthThrottle: (bucket: string) => Promise<void>;
  normalizeCanonicalEmail: (rawEmail: unknown) => { original: string; canonical: string };
  isValidEmailAddress: (value: string) => boolean;
  buildAccountAuthState: (user: any, primaryMethodHint?: string) => unknown;
  syncUsernameCaches: (userId: string, nextUsername: string, previousUsername?: string) => void;
  isArgon2Enabled: () => boolean;
  getPasswordHashRuntimeInfo: () => unknown;
  setRuntimeCounters: (values: { nextStimuliSetId: number; nextEventId: number }) => void;
  setServerVerbosityLevel: (level: 0 | 1 | 2) => void;
};

const WebAppAny = WebApp as unknown as {
  handlers: {
    use: (handler: (req: IncomingMessage, res: ServerResponse<IncomingMessage>, next: NextFunction) => void) => void;
  };
};

function registerSecurityHeaders() {
  WebAppAny.handlers.use((req: IncomingMessage, res: ServerResponse<IncomingMessage>, next: NextFunction) => {
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(self)');
    if (req.url === '/stimSchema.json' || req.url === '/tdfSchema.json') {
      res.setHeader('Cache-Control', 'public, max-age=86400');
    }
    next();
  });
}

async function checkDriveSpace(deps: RunServerStartupDeps) {
  deps.serverConsole('checkDriveSpace');
  try {
    const info = deps.getDiskUsageInfo('/');
    if (!info) {
      deps.serverConsole('disk usage unavailable, skipping disk space check');
      return;
    }
    const percentFree = (info.free / info.total) * 100;
    deps.serverConsole('freeSpace: ' + info.free + ', totalSpace: ' + info.total + ', percentFree: ' + percentFree);
    if (percentFree < 10) {
      deps.serverConsole('Low disk space: ' + percentFree + '%');
      const brandName = (await ensurePublishedDeploymentBrandProfile()).identity.name;
      const subject = `${brandName} Low Disk Space - ${deps.thisServerUrl}`;
      const text = 'Low disk space: ' + percentFree + '%';
      deps.sendEmail(deps.ownerEmail, deps.emailFrom, subject, text);
    }
  } catch (error: unknown) {
    deps.serverConsole(error);
  }
}

function getUserEmailRecipient(user: any) {
  const candidates = [
    user?.email_canonical,
    user?.emails?.[0]?.address,
    user?.email_original,
    user?.username,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && isEmailLike(candidate)) {
      return candidate.trim().toLowerCase();
    }
  }
  return null;
}

function isEmailLike(value: string) {
  return /.+@.+\..+/.test(value.trim());
}

async function getRestartEmailRecipients(deps: RunServerStartupDeps, roleSettings: { admins?: unknown[]; teachers?: unknown[] }) {
  const recipients = [
    deps.ownerEmail,
    ...(Array.isArray(roleSettings.teachers) ? roleSettings.teachers.map((value) => String(value)) : []),
    ...(Array.isArray(roleSettings.admins) ? roleSettings.admins.map((value) => String(value)) : []),
  ];

  const roleAssignment = (Meteor as any).roleAssignment;
  const roleAssignments = roleAssignment
    ? await roleAssignment.find({ 'inheritedRoles._id': { $in: ['admin', 'teacher'] } }).fetchAsync()
    : [];
  const roleUserIds = [...new Set(
    roleAssignments
      .map((assignment: any) => String(assignment?.user?._id || '').trim())
      .filter(Boolean)
  )];

  if (roleUserIds.length > 0) {
    const roleUsers = await deps.usersCollection.find(
      { _id: { $in: roleUserIds } },
      { fields: { username: 1, email_canonical: 1, email_original: 1, emails: 1 } }
    ).fetchAsync();
    for (const user of roleUsers) {
      const email = getUserEmailRecipient(user);
      if (email) {
        recipients.push(email);
      }
    }
  }

  return recipients
    .filter((value) => typeof value === 'string' && value.trim().length > 0)
    .map((value) => value.trim().toLowerCase())
    .filter((value) => isEmailLike(value))
    .filter((value, index, array) => array.indexOf(value) === index);
}

async function findUserByName(deps: RunServerStartupDeps, username: string) {
  if (!username || username.length < 1) {
    return null;
  }
  const normalizedUsername = username.trim();
  const lookupSelector = deps.isValidEmailAddress(normalizedUsername)
    ? {
        $or: [
          { username: normalizedUsername.toLowerCase() },
          { email_canonical: normalizedUsername.toLowerCase() },
          { 'emails.address': normalizedUsername.toLowerCase() },
        ],
      }
    : {
        $or: [
          { username: normalizedUsername },
          { email_canonical: normalizedUsername },
          { 'emails.address': normalizedUsername },
        ],
      };
  return await deps.usersCollection.findOneAsync(lookupSelector);
}

async function purgeLegacyAiContentDraftStorage(deps: RunServerStartupDeps) {
  const legacyDrafts = await deps.ManualContentDrafts.find(
    { draftType: LEGACY_AI_CONTENT_DRAFT_TYPE },
    { fields: { _id: 1 } }
  ).fetchAsync();
  await deps.DynamicAssets.removeAsync({ 'meta.uploadPurpose': 'ai-draft-media' });
  await deps.ManualContentDrafts.removeAsync({ draftType: LEGACY_AI_CONTENT_DRAFT_TYPE });
  if (legacyDrafts.length > 0) deps.serverConsole(`[AI CONTENT CREATOR] Removed ${legacyDrafts.length} obsolete server-side working record(s).`);
}

function getExistingAccountMethod(user: any): 'password' | 'google' | 'microsoft' | 'memphisSaml' | 'different-method' {
  if (user?.services?.password) return 'password';
  if (user?.services?.google) return 'google';
  if (user?.services?.microsoft) return 'microsoft';
  if (isMemphisSamlAccountUser(user)) return 'memphisSaml';
  return 'different-method';
}

function throwOAuthExistingAccountError(existingUser: any, attemptedProvider: string, deps: RunServerStartupDeps) {
  const existingMethod = getExistingAccountMethod(existingUser);
  deps.serverConsole('[ACCOUNTS] OAuth sign-in blocked by existing account method', {
    attemptedProvider,
    existingMethod,
  });
  if (existingMethod === 'password') {
    throw new Meteor.Error('oauth-account-exists-password', 'This email is already registered with a password. Sign in with your password or reset it.');
  }
  if (existingMethod === 'google') {
    throw new Meteor.Error('oauth-account-exists-google', 'This email is already registered with Google sign-in.');
  }
  if (existingMethod === 'microsoft') {
    throw new Meteor.Error('oauth-account-exists-microsoft', 'This email is already registered with Microsoft sign-in.');
  }
  if (existingMethod === 'memphisSaml') {
    throw new Meteor.Error('oauth-account-exists-memphis-saml', 'This email is already registered with institutional sign-in.');
  }
  throw new Meteor.Error('oauth-account-exists-different-method', 'This email is already registered with a different sign-in method.');
}

function summarizeAccountLookupForLog(user: any) {
  if (!user) {
    return null;
  }
  return {
    found: true,
    services: user?.services ? Object.keys(user.services).sort() : [],
    existingMethod: getExistingAccountMethod(user),
  };
}

function isRealUserDocument(user: any): user is { _id: string } {
  return !!user && typeof user._id === 'string' && user._id.trim().length > 0;
}

function findExistingUserByCanonicalEmail(canonicalEmail: string) {
  const accountsUserByEmail = Accounts.findUserByEmail(canonicalEmail);
  const accountsUserByUsername = Accounts.findUserByUsername(canonicalEmail);
  const existingUserByEmail = isRealUserDocument(accountsUserByEmail) ? accountsUserByEmail : null;
  const existingUserByUsername = isRealUserDocument(accountsUserByUsername) ? accountsUserByUsername : null;
  return {
    accountsUserByEmail,
    accountsUserByUsername,
    existingUserByEmail,
    existingUserByUsername,
    existingUser: existingUserByEmail || existingUserByUsername,
  };
}

export async function runServerStartup(deps: RunServerStartupDeps) {
  const meteor35Mode = applyDdpContainment(
    (Meteor as unknown as { server?: { options: { disconnectGracePeriod?: number } } }).server,
    process.env,
  );
  deps.serverConsole(
    `[DDP] ${meteor35Mode.transport} transport with disconnect grace period 0; ` +
    `Mongo reactivity ${meteor35Mode.reactivityOrder}` +
    (meteor35Mode.qualificationMode
      ? ' (isolated Change Streams qualification)'
      : ' (Change Streams required)'),
  );

  const mongoConnection = await validateMongoConnection(deps.Tdfs.rawDatabase(), process.env);
  deps.serverConsole(1, `[MongoDB] ${formatMongoConnectionValidation(mongoConnection)}`);

  await purgeLearnerUnitAnalyticsCache({
    database: deps.Tdfs.rawDatabase(),
    DynamicSettings: deps.DynamicSettings,
    serverConsole: deps.serverConsole,
  });

  await migrateDynamicAssetLocalPaths({
    DynamicAssets: deps.DynamicAssets,
    DynamicSettings: deps.DynamicSettings,
    serverConsole: deps.serverConsole,
    storageBackend: getStorageBackend(Meteor.settings),
    storageRoot: getLocalStoragePaths(Meteor.settings, process.env).dynamicAssetsPath,
  });

  const recovery = await reconcileInterruptedTdfMutationJobs({
    TdfMutationJobs: deps.TdfMutationJobs,
    Tdfs: deps.Tdfs,
    DynamicAssets: deps.DynamicAssets,
    serverConsole: deps.serverConsole,
  });
  if (recovery.scanned > 0) {
    deps.serverConsole('[TDF mutation recovery] startup reconciliation', recovery);
  }
  registerSecurityHeaders();
  await themeRegistry.initialize();
  await ensurePublishedDeploymentBrandProfile();
  await runStartupCleanupMigrations({
    DynamicSettings: deps.DynamicSettings,
    Courses: deps.Courses,
    Assignments: deps.Assignments,
    CourseLearnerSnapshotCache: deps.CourseLearnerSnapshotCache,
    usersCollection: deps.usersCollection,
    serverConsole: deps.serverConsole,
    updateActiveThemeDocument: deps.updateActiveThemeDocument,
  });
  await migrateSparcAuthoredPageIdentity({
    Tdfs: deps.Tdfs,
    DynamicSettings: deps.DynamicSettings,
    serverConsole: deps.serverConsole,
  });
  await migrateSparcHistoryPageIdentity({
    Histories: deps.Histories,
    Tdfs: deps.Tdfs,
    DynamicSettings: deps.DynamicSettings,
    serverConsole: deps.serverConsole,
  });
  let packageAssetBackfillSucceeded = false;
  try {
    await backfillPackageAssetIds();
    packageAssetBackfillSucceeded = true;
  } catch (error: unknown) {
    deps.serverConsole('Warning: Package asset id backfill failed:', error instanceof Error ? error.message : String(error));
  }
  if (packageAssetBackfillSucceeded) {
    try {
      await backfillConditionTdfIds({
        Tdfs: deps.Tdfs,
        TdfMutationJobs: deps.TdfMutationJobs,
        DynamicSettings: deps.DynamicSettings,
        serverConsole: deps.serverConsole,
      });
    } catch (error: unknown) {
      deps.serverConsole('Warning: TDF identity migration v2 failed; invalid roots remain blocked:', error instanceof Error ? error.message : String(error));
    }
  } else {
    deps.serverConsole('[TDF identity migration] deferred because package asset id backfill did not complete');
  }
  try {
    await createPerformanceIndexes();
  } catch (error: unknown) {
    deps.serverConsole('Warning: Performance index creation failed:', error instanceof Error ? error.message : String(error));
  }
  try {
    await cleanExperimentStateDupesAndAddUniqueIndex();
  } catch (error: unknown) {
    deps.serverConsole('Warning: Experiment state dedup migration failed:', error instanceof Error ? error.message : String(error));
  }

  const highestStimuliSetDoc = await deps.Tdfs.findOneAsync({}, { sort: { stimuliSetId: -1 }, limit: 1 });
  const latestHistory = await deps.Histories.findOneAsync({}, { limit: 1, sort: { eventId: -1 } });
  deps.setRuntimeCounters({
    nextEventId: (Number(latestHistory?.eventId) || 0) + 1,
    nextStimuliSetId: highestStimuliSetDoc?.stimuliSetId ? parseInt(String(highestStimuliSetDoc.stimuliSetId), 10) + 1 : 1,
  });

  const loggingSettings = await migrateLoggingSettings(deps.DynamicSettings);
  deps.setServerVerbosityLevel(loggingSettings.serverVerbosityLevel);
  if (loggingSettings.removedDuplicateDocuments > 0) {
    deps.serverConsole(
      `Consolidated ${loggingSettings.removedDuplicateDocuments} duplicate logging setting document(s)`,
    );
  }
  const removedTestLoginSettings = await deps.DynamicSettings.removeAsync({ key: 'testLoginsEnabled' });
  if (removedTestLoginSettings > 0) {
    deps.serverConsole('Removed deprecated testLoginsEnabled setting');
  }

  deps.serverConsole('Configuring Google OAuth service...');
  const google = (Meteor.settings as any)?.google;
  const serviceConfigurations = ServiceConfiguration.configurations as unknown as {
    upsertAsync: (selector: UnknownRecord, modifier: UnknownRecord) => Promise<unknown>;
  };
  await serviceConfigurations.upsertAsync({ service: 'google' }, { $set: { clientId: google?.clientId, secret: google?.secret } });
  deps.serverConsole('Google OAuth service configured');

  if ((Meteor.settings as any).microsoft) {
    deps.serverConsole('Configuring Microsoft OAuth service...');
    await serviceConfigurations.upsertAsync(
      { service: 'microsoft' },
      { $set: { clientId: (Meteor.settings as any).microsoft.clientId, secret: (Meteor.settings as any).microsoft.secret, tenant: 'common', refreshToken: true } }
    );
    deps.serverConsole('Microsoft OAuth service configured');
  } else {
    deps.serverConsole('WARNING: No Microsoft OAuth configuration found in settings');
  }

  Accounts.onLogin(async (loginInfo: {
    type?: string;
    user?: { _id?: string; emails?: Array<{ address?: string }>; email?: string; username?: string };
    methodName?: string;
    allowed?: boolean;
    connection?: { clientAddress?: string | null };
  }) => {
    deps.serverConsole('[ACCOUNTS.ONLOGIN] Login detected:', {
      type: loginInfo.type,
      methodName: loginInfo.methodName,
      allowed: loginInfo.allowed,
    });
    if (!loginInfo.user || !loginInfo.allowed) {
      return;
    }

    const userId = loginInfo.user._id;
    const userEmail = loginInfo.user.emails?.[0]?.address || loginInfo.user.email || loginInfo.user.username;
    const normalizedUserEmail = typeof userEmail === 'string' ? userEmail.trim().toLowerCase() : '';
    const isOAuthLogin = loginInfo.type === 'google' || loginInfo.type === 'microsoft' || loginInfo.type === 'memphisSaml';

    deps.serverConsole('[ACCOUNTS.ONLOGIN] Processing allowed login:', { type: loginInfo.type });
    if (userId) {
      try {
        await deps.enforceCanonicalEmailIdentity(userId, userEmail, { actorUserId: userId, source: 'accounts.onLogin' });
        await deps.syncUserAuthState(userId, isOAuthLogin ? String(loginInfo.type || 'password') : 'password');
      } catch {
        deps.serverConsole('[ACCOUNTS.ONLOGIN] Failed to enforce canonical account identity');
      }
    }

    const initRoles = (Meteor.settings as any)?.initRoles;
    if (initRoles && normalizedUserEmail && userId) {
      const admins = (initRoles?.admins || []).map((value: unknown) => String(value).trim().toLowerCase()).filter(Boolean);
      const teachers = (initRoles?.teachers || []).map((value: unknown) => String(value).trim().toLowerCase()).filter(Boolean);
      if (admins.includes(normalizedUserEmail)) {
        deps.serverConsole('[ACCOUNTS.ONLOGIN] Matching initRoles.admins entry found; assigning admin role');
        try {
          await Roles.addUsersToRolesAsync(userId, 'admin');
          deps.serverConsole('[ACCOUNTS.ONLOGIN] Admin role assigned successfully');
        } catch (error: unknown) {
          deps.serverConsole('[ACCOUNTS.ONLOGIN] ERROR assigning admin role:', error);
        }
      }
      if (teachers.includes(normalizedUserEmail)) {
        deps.serverConsole('[ACCOUNTS.ONLOGIN] Matching initRoles.teachers entry found; assigning teacher role');
        try {
          await Roles.addUsersToRolesAsync(userId, 'teacher');
          deps.serverConsole('[ACCOUNTS.ONLOGIN] Teacher role assigned successfully');
        } catch (error: unknown) {
          deps.serverConsole('[ACCOUNTS.ONLOGIN] ERROR assigning teacher role:', error);
        }
      }
    }

    await deps.writeAuditLog('auth.loginSuccess', userId || null, userId || null, {
      loginType: loginInfo.type || 'password',
      ip: deps.getAuthClientIp(loginInfo),
    });

    if (isOAuthLogin && userId) {
      const loginMode = String(loginInfo.type || 'password');
      deps.serverConsole('[ACCOUNTS.ONLOGIN] Setting OAuth loginParams:', { mode: loginMode });
      try {
        await deps.usersCollection.updateAsync(
          { _id: userId },
          {
            $set: {
              'loginParams.entryPoint': 'direct',
              'loginParams.loginMode': loginMode,
              'loginParams.lastLoginTime': new Date(),
              'loginParams.authSessionState': deps.buildSessionAuthState(loginMode, 'federated'),
            },
          }
        );
        deps.serverConsole('[ACCOUNTS.ONLOGIN] loginParams set successfully');
      } catch (error: unknown) {
        deps.serverConsole('[ACCOUNTS.ONLOGIN] ERROR setting loginParams:', error);
      }
    }
  });
  deps.serverConsole('Accounts.onLogin hook registered for OAuth handling and role assignment');

  Accounts.urls.verifyEmail = function(token: string) {
    const baseUrl = (Meteor.settings.ROOT_URL || Meteor.absoluteUrl()).replace(/\/$/, '');
    return `${baseUrl}/auth/verify-email?token=${encodeURIComponent(token)}`;
  };
  Accounts.emailTemplates.siteName = (await ensurePublishedDeploymentBrandProfile()).identity.name;
  Accounts.emailTemplates.from = deps.emailFrom;
  if (deps.emailReplyTo) {
    (Accounts.emailTemplates as unknown as { headers?: Record<string, string> }).headers = {
      'Reply-To': deps.emailReplyTo,
    };
  }
  Accounts.emailTemplates.verifyEmail = {
    subject() {
      return `${Accounts.emailTemplates.siteName} account verification`;
    },
    text(_user: unknown, url: string) {
      return [
        `Verify your email address for ${Accounts.emailTemplates.siteName}.`,
        '',
        `Open this link to verify your email: ${url}`,
        '',
        'If you did not create this account, you can ignore this email.',
      ].join('\n');
    },
  };

  (Accounts as any).config({
    loginExpirationInDays: 30,
    ambiguousErrorMessages: true,
    argon2Enabled: deps.isArgon2Enabled(),
  });
  const meteorMethodHandlers = (Meteor as unknown as {
    server?: {
      method_handlers?: Record<string, (this: unknown, ...methodArguments: unknown[]) => Promise<unknown>>;
    };
  }).server?.method_handlers;
  const passwordLoginMethod = meteorMethodHandlers?.login;
  if (!meteorMethodHandlers || typeof passwordLoginMethod !== 'function') {
    throw new Error('Meteor login method handler is unavailable');
  }
  let failedPasswordEnvelopeCount = 0;
  let failedPasswordEnvelopeOverrunCount = 0;
  const failedPasswordResponseEnvelope = createFailedPasswordResponseEnvelope({
    onFailureComplete(sample) {
      failedPasswordEnvelopeCount += 1;
      if (!sample.envelopeExceeded) return;
      failedPasswordEnvelopeOverrunCount += 1;
      if (failedPasswordEnvelopeOverrunCount === 1 || failedPasswordEnvelopeOverrunCount % 100 === 0) {
        deps.serverConsole('[AUTH] Failed-password timing envelope overrun aggregate', {
          failedPasswordEnvelopeCount,
          failedPasswordEnvelopeOverrunCount,
        });
      }
    },
  });
  meteorMethodHandlers.login = wrapPasswordLoginMethodWithResponseEnvelope(
    passwordLoginMethod,
    failedPasswordResponseEnvelope,
  );
  deps.serverConsole('Failed-password response timing envelope registered');
  const meteorPasswordVerifier = (Accounts as unknown as {
    _checkPasswordAsync?: Parameters<typeof createPasswordTimingDefense>[0];
  })._checkPasswordAsync;
  if (typeof meteorPasswordVerifier !== 'function') {
    throw new Error('Meteor accounts-password verifier is unavailable');
  }
  const meteorAccounts = Accounts as unknown as {
    _selectorForFastCaseInsensitiveLookup?: (fieldName: string, value: string) => UnknownRecord;
  };
  if (typeof meteorAccounts._selectorForFastCaseInsensitiveLookup !== 'function') {
    throw new Error('Meteor case-insensitive account selector is unavailable');
  }
  const runCaseInsensitivePasswordUserLookup = async (query: MeteorPasswordLoginQuery) => {
    const fieldName = 'email' in query ? 'emails.address' : 'username';
    const fieldValue = 'email' in query ? query.email : query.username;
    const selector = meteorAccounts._selectorForFastCaseInsensitiveLookup!(fieldName, fieldValue);
    await deps.usersCollection.find(selector, {
      fields: { _id: 1 },
      limit: 2,
    }).fetchAsync();
  };
  const passwordTimingDefense = createPasswordTimingDefense(
    meteorPasswordVerifier,
    runCaseInsensitivePasswordUserLookup,
  );

  Accounts.validateLoginAttempt(async (attempt: {
    allowed?: boolean;
    type?: string;
    user?: {
      _id?: string;
      services?: { password?: { bcrypt?: string; argon2?: string } };
    };
    connection?: { clientAddress?: string | null };
    error?: { error?: string; reason?: string; message?: string };
    methodArguments?: unknown[];
  }) => {
    const identifier = deps.extractLoginAttemptIdentifier(attempt);
    const clientIp = deps.getAuthClientIp(attempt);
    if (attempt.type === 'password') {
      await deps.assertSoftLock(`login-lock:${identifier || clientIp}`);
      await deps.assertAuthThrottle('login', `login:ip:${clientIp}`, 20, 15 * 60 * 1000);
      if (identifier) {
        await deps.assertAuthThrottle('login', `login:id:${identifier}`, 10, 15 * 60 * 1000);
      }
    }
    if (!attempt.allowed) {
      if (attempt.type === 'password') {
        const password = extractPasswordFromLoginArguments(attempt.methodArguments);
        if (password) {
          const loginQuery = extractPasswordLoginQuery(attempt.methodArguments);
          await passwordTimingDefense.equalizeFailedPasswordAttempt(attempt.user, password, loginQuery);
        }
        await deps.recordAuthThrottle(`login:ip:${clientIp}`);
        if (identifier) {
          const failureBucket = `login:id:${identifier}`;
          await deps.recordAuthThrottle(failureBucket);
          await deps.recordSoftLockFailure(`login-lock:${identifier}`, failureBucket, 8, 15 * 60 * 1000, 15 * 60 * 1000);
        }
      }
      Meteor.defer(() => {
        void deps.writeAuditLog('auth.loginFailure', attempt.user?._id || null, attempt.user?._id || null, {
          loginType: attempt.type || 'password',
          ip: clientIp,
          errorCode: attempt.error?.error || '',
        });
      });
      return false;
    }
    if (identifier) {
      await deps.clearAuthThrottle(`login:id:${identifier}`);
      await deps.AuthThrottleState.removeAsync({ key: `login-lock:${identifier}` });
    }
    return true;
  });

  const adminUser = await findUserByName(deps, String((Meteor.settings as any)?.owner || ''));
  await Roles.createRoleAsync('admin', { unlessExists: true });
  await Roles.createRoleAsync('teacher', { unlessExists: true });

  const adminUserId = adminUser?._id || '';
  if (adminUserId) {
    await Roles.addUsersToRolesAsync(adminUserId, 'admin');
    deps.serverConsole('Configured owner account found and assigned the admin role');
  } else if (deps.isProd) {
    deps.serverConsole('Warning: configured owner account could not be found. adminUser=', displayify(adminUser || 'null'));
    deps.serverConsole('Warning: no owner is available for system TDFs until the configured owner account exists');
  } else {
    deps.serverConsole('Configured owner account is not present yet; owner-bound bootstrap is skipped until that account exists');
  }

  const roleSettings = ((Meteor.settings as any)?.initRoles || {}) as { admins?: unknown[]; teachers?: unknown[] };
  const roleAdd = async (memberName: 'admins' | 'teachers', roleName: 'admin' | 'teacher') => {
    const requested = Array.isArray(roleSettings[memberName]) ? roleSettings[memberName] as unknown[] : [];
    deps.serverConsole('Role', roleName, '- found', requested.length);
    for (const username of requested) {
      const user = await findUserByName(deps, String(username || ''));
      if (!user || !user._id) {
        const messagePrefix = deps.isProd ? 'Warning: role assignment target missing' : 'Role assignment target not present yet';
        deps.serverConsole(messagePrefix, { role: roleName });
        continue;
      }
      await Roles.addUsersToRolesAsync(user._id, roleName);
      deps.serverConsole('Configured role assignment completed:', { role: roleName });
    }
  };
  await roleAdd('admins', 'admin');
  await roleAdd('teachers', 'teacher');

  if (await deps.Tdfs.find().countAsync() === 0) {
    await bootstrapPrivateRepoContentIfNeeded({
      isProd: deps.isProd,
      adminUserId,
      curSemester,
      serverConsole: deps.serverConsole,
      AssetsAny: deps.AssetsAny,
      upsertStimFile: deps.upsertStimFile,
      importPrivateRepoTdfBatch: deps.importPrivateRepoTdfBatch,
      updateStimDisplayTypeMap: deps.updateStimDisplayTypeMap,
    });
  }

  Accounts.onCreateUser(function(options: { profile?: {} | undefined }, user: Meteor.User) {
    deps.serverConsole('[ACCOUNTS] onCreateUser called');
    deps.serverConsole('[ACCOUNTS] User services:', Object.keys(user.services || {}));

    if (options.profile) {
      user.profile = _.extend(user.profile || {}, options.profile as Record<string, unknown>);
    }
    if (user.profile?.experiment) {
      deps.serverConsole('Experiment participant account created');
      return user;
    }

    let email = '';
    let serviceName = 'password';
    let emailVerified = !!user.emails?.[0]?.verified;

    if (user.services?.google) {
      serviceName = 'google';
      email = (user.services.google.email || '').trim().toLowerCase();
      emailVerified = true;
    } else if (user.services?.microsoft) {
      serviceName = 'microsoft';
      const msEmail = user.services.microsoft.mail;
      const msUserPrincipalName = user.services.microsoft.userPrincipalName;
      const msOidcEmail = user.services.microsoft.email;
      email = (msOidcEmail || msEmail || msUserPrincipalName || '').trim().toLowerCase();
      emailVerified = true;
      deps.serverConsole('[ACCOUNTS] Microsoft account profile received');
    } else if (user.services?.memphisSaml) {
      serviceName = 'memphisSaml';
      email = extractMemphisSamlEmail(user.services.memphisSaml);
      emailVerified = true;
      deps.serverConsole('[ACCOUNTS] Memphis SAML account profile received');
    } else if (user.services?.password) {
      const userRecord = user as unknown as UnknownRecord;
      const passwordEmailSource = user.emails?.[0]?.address || userRecord.email_canonical || userRecord.email_original || user.username || '';
      email = String(passwordEmailSource).trim().toLowerCase();
    }

    if (!email) {
      deps.serverConsole('[ACCOUNTS] WARNING: No email found for account creation branch:', serviceName);
      if (serviceName === 'password') {
        throw new Meteor.Error('password-email-missing', 'No email found for password account creation');
      }
      throw new Meteor.Error('oauth-email-missing', 'No email found for your OAuth account');
    }

    const normalizedEmail = deps.normalizeCanonicalEmail(email);
    if (serviceName !== 'password') {
      const {
        accountsUserByEmail,
        accountsUserByUsername,
        existingUserByEmail,
        existingUserByUsername,
        existingUser,
      } = findExistingUserByCanonicalEmail(normalizedEmail.canonical);
      deps.serverConsole('[ACCOUNTS] OAuth existing-account lookup', {
        attemptedProvider: serviceName,
        accountsEmailMatch: summarizeAccountLookupForLog(accountsUserByEmail),
        accountsNameMatch: summarizeAccountLookupForLog(accountsUserByUsername),
        appEmailMatch: summarizeAccountLookupForLog(existingUserByEmail),
        appNameMatch: summarizeAccountLookupForLog(existingUserByUsername),
      });
      if (existingUser && !(existingUser as any)?.services?.[serviceName]) {
        throwOAuthExistingAccountError(existingUser, serviceName, deps);
      }
    }

    user.username = normalizedEmail.canonical;
    const userRecord = user as unknown as UnknownRecord;
    userRecord.email_original = normalizedEmail.original;
    userRecord.email_canonical = normalizedEmail.canonical;
    user.emails = [{ address: normalizedEmail.canonical, verified: emailVerified }];
    user.profile = user.profile || {};
    user.profile.username = normalizedEmail.canonical;
    userRecord.authState = deps.buildAccountAuthState(user, serviceName?.toLowerCase() || 'password');
    deps.serverConsole(`[ACCOUNTS] Creating new ${serviceName} account`);

    const normalizedUsername = user.username || '';
    if (normalizedUsername) {
      deps.syncUsernameCaches(user._id, normalizedUsername);
    }
    return user;
  });

  deps.serverConsole('Password hash runtime info:', deps.getPasswordHashRuntimeInfo());

  await deps.ScheduledTurkMessages.rawCollection().createIndex({ sent: 1, scheduled: 1 });
  await deps.AuthThrottleState.rawCollection().createIndex({ key: 1 }, { unique: true });
  await deps.AuthThrottleState.rawCollection().createIndex({ updatedAt: 1 });
  await deps.ManualContentDrafts.rawCollection().createIndex({ ownerId: 1, updatedAt: -1 });
  await deps.ManualContentDrafts.rawCollection().createIndex({ ownerId: 1, draftType: 1, phase: 1, updatedAt: -1 });
  await deps.TdfMutationJobs.rawCollection().createIndex({ status: 1, updatedAt: 1 });
  await deps.TdfMutationJobs.rawCollection().createIndex({ actorUserId: 1, status: 1, confirmationExpiresAt: 1 });
  await deps.TdfMutationJobs.rawCollection().createIndex({ cleanupAt: 1 }, { expireAfterSeconds: 0, sparse: true });
  await purgeLegacyAiContentDraftStorage(deps);
  await deps.StimulusCrowdStats.rawCollection().createIndex({ stimulusKey: 1 }, { unique: true });
  await deps.StimulusCrowdStats.rawCollection().createIndex({ stimuliSetId: 1, KCId: 1 });
  await deps.StimulusCrowdStats.rawCollection().createIndex({ stimuliSetId: 1 });

  await startConfiguredMofactsCronJobs({
    Meteor,
    isProd: deps.isProd,
    serverConsole: deps.serverConsole,
    sendScheduledTurkMessages,
    sendErrorReportSummaries: deps.sendErrorReportSummaries,
    checkDriveSpace: async () => checkDriveSpace(deps),
  });

  const allEmails = await getRestartEmailRecipients(deps, roleSettings);
  deps.serverConsole('restart notification recipient count:', allEmails.length);
  for (const emailaddr of allEmails) {
    let server = Meteor.absoluteUrl().split('//')[1] || Meteor.absoluteUrl();
    server = server.substring(0, server.length - 1);
    const brandName = (await ensurePublishedDeploymentBrandProfile()).identity.name;
    deps.sendEmail(emailaddr, deps.emailFrom, `${brandName} Deployed on ${server}`, `The server has restarted.\nServer: ${server}`);
  }
}
