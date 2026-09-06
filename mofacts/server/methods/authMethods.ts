import { Meteor } from 'meteor/meteor';
import { ensurePublishedDeploymentBrandProfile } from '../lib/deploymentBrandProfileRegistry';
import { Accounts } from 'meteor/accounts-base';
import { check, Match } from 'meteor/check';
import { createHash, randomBytes } from 'crypto';
import { resolvePreferredApiKey, type ApiKeyResolutionDeps } from '../lib/apiKeyResolution';
import {
  requireUserMatchesOrHasRole,
  type MethodAuthorizationDeps,
} from '../lib/methodAuthorization';

type UnknownRecord = Record<string, unknown>;
type Logger = (...args: unknown[]) => void;
type MethodContext = {
  userId?: string | null;
  unblock?: () => void;
  connection?: { id?: string; clientAddress?: string | null } | null;
};
type AccountsPasswordApi = {
  setPasswordAsync?: (userId: string, newPassword: string) => Promise<unknown>;
  setPassword?: (userId: string, newPassword: string) => unknown;
};

const PASSWORD_RESET_RESPONSE_FLOOR_MS = 1000;

async function waitForPasswordResetResponseFloor(startedAtMs: number) {
  const remainingMs = PASSWORD_RESET_RESPONSE_FLOOR_MS - (Date.now() - startedAtMs);
  if (remainingMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, remainingMs));
  }
}

type AuthMethodsDeps = {
  serverConsole: Logger;
  ownerEmail: string;
  emailFrom: string;
  usersCollection: {
    findOneAsync: (selector: UnknownRecord, options?: UnknownRecord) => Promise<any>;
    updateAsync: (selector: UnknownRecord, modifier: UnknownRecord, options?: UnknownRecord) => Promise<unknown>;
    upsertAsync: (selector: UnknownRecord, modifier: UnknownRecord) => Promise<unknown>;
  };
  PasswordResetTokens: {
    find: (selector: UnknownRecord) => { countAsync: () => Promise<number> };
    findOneAsync: (selector: UnknownRecord) => Promise<any>;
    insertAsync: (document: UnknownRecord) => Promise<unknown>;
    updateAsync: (selector: UnknownRecord, modifier: UnknownRecord) => Promise<unknown>;
    removeAsync: (selector: UnknownRecord) => Promise<number>;
  };
  requireAdminUser: (
    userId: string | null | undefined,
    errMsg?: string,
    errorCode?: string | number
  ) => Promise<void>;
  getMethodAuthorizationDeps: () => MethodAuthorizationDeps;
  getUserRoleFlags: <RoleName extends string>(
    deps: MethodAuthorizationDeps,
    userId: string | null | undefined,
    roles: readonly RoleName[]
  ) => Promise<Record<RoleName, boolean>>;
  requireAllowPublicSignupSetting: () => boolean;
  getMemphisSamlClientConfig: () => { enabled: boolean; displayName: string };
  minPasswordLength: number;
  normalizeCanonicalEmail: (rawEmail: unknown) => { original: string; canonical: string };
  findNormalAccountUserByCanonicalEmail: (emailCanonical: string) => Promise<any>;
  applyMethodRateLimit: (
    action: string,
    ip: string,
    identifier: string,
    config: { ipLimit: number; identifierLimit: number; windowMs: number }
  ) => Promise<void>;
  getAuthClientIp: (source: { connection?: { clientAddress?: string | null } | null } | null | undefined) => string;
  sendEmail: (to: string, from: string, subject: string, text: string) => void;
  writeAuditLog: (
    action: string,
    actorUserId: string | null,
    targetUserId: string | null,
    details?: UnknownRecord
  ) => Promise<void>;
  assertStrongPassword: (password: string) => void;
  enforceCanonicalEmailIdentity: (
    userId: string,
    rawEmail?: unknown,
    options?: { actorUserId?: string | null; source?: string }
  ) => Promise<void>;
  syncUserAuthState: (userId: string, primaryMethodHint?: string) => Promise<void>;
  createUserWithRetry: (
    username: string,
    password: string,
    profile?: UnknownRecord,
    options?: { includeEmail?: boolean; emailOriginal?: string; emailCanonical?: string }
  ) => Promise<string>;
  withSignUpLock: <T>(username: string, work: () => Promise<T>) => Promise<T>;
  isEmailVerificationRequired: () => boolean;
  sendVerificationEmailForUser: (userId: string, actorUserId: string | null, source: string) => Promise<boolean>;
  normalizeAuthIdentifier: (rawValue: unknown) => string;
  getUserDisplayIdentifier: (user: any) => string;
  isNormalAccountUser: (user: any) => boolean;
  isUserEmailVerified: (user: any) => boolean;
  buildSessionAuthState: (loginMode: string, primaryFactor: string) => unknown;
  normalizeCanonicalId: (value: unknown) => string | null;
  syncUsernameCaches: (userId: string, nextUsername: string, previousUsername?: string) => void;
  encryptData: (value: string) => string;
  getUserPersonalApiKey: (
    deps: ApiKeyResolutionDeps,
    userId: string | null | undefined,
    kind: 'speech' | 'tts'
  ) => Promise<unknown>;
  getAccessibleTdfApiKey: (
    deps: ApiKeyResolutionDeps,
    params: { userId: string | null | undefined; tdfId: string; kind: 'speech' | 'tts' }
  ) => Promise<unknown>;
  getApiKeyResolutionDeps: () => ApiKeyResolutionDeps;
  getPasswordHashRuntimeInfo: () => unknown;
};

function requireCurrentUserId(userId: string | null | undefined, message = 'Must be logged in') {
  const normalizedUserId = typeof userId === 'string' ? userId.trim() : '';
  if (!normalizedUserId) {
    throw new Meteor.Error(401, message);
  }
  return normalizedUserId;
}

async function setPasswordForUser(userId: string, newPassword: string) {
  const accountsApi = Accounts as unknown as AccountsPasswordApi;
  if (typeof accountsApi.setPasswordAsync === 'function') {
    await accountsApi.setPasswordAsync(userId, newPassword);
    return;
  }

  if (typeof accountsApi.setPassword === 'function') {
    accountsApi.setPassword(userId, newPassword);
    return;
  }

  throw new Meteor.Error('accounts-set-password-unavailable', 'Server password update API is unavailable');
}

export function createAuthMethods(deps: AuthMethodsDeps) {
  return {
    getCurrentUserRoleFlags: async function(this: MethodContext) {
      const { admin, teacher } = await deps.getUserRoleFlags(
        deps.getMethodAuthorizationDeps(),
        this.userId,
        ['admin', 'teacher'] as const
      );
      return { admin: !!admin, teacher: !!teacher };
    },

    getAuthClientConfig: async function() {
      const memphisSamlConfig = deps.getMemphisSamlClientConfig();
      return {
        allowPublicSignup: deps.requireAllowPublicSignupSetting(),
        requireEmailVerification: deps.isEmailVerificationRequired(),
        minPasswordLength: deps.minPasswordLength,
        memphisSamlEnabled: memphisSamlConfig.enabled,
        memphisSamlDisplayName: memphisSamlConfig.displayName,
      };
    },

    setUserLoginData: async function(
      this: MethodContext,
      entryPoint: string,
      loginMode: string,
      curTeacher: unknown = undefined,
      curClass: unknown = undefined,
      assignedTdfs: unknown = undefined
    ) {
      deps.serverConsole('setUserLoginData called with:', entryPoint, loginMode, curTeacher, curClass, assignedTdfs);

      const userId = requireCurrentUserId(this.userId, 'Must be logged in to set login data');
      const user = await deps.usersCollection.findOneAsync({ _id: userId });
      deps.serverConsole('setUserLoginData account lookup completed:', { found: !!user });

      if (!user) {
        throw new Meteor.Error('user-not-found', 'User document not found');
      }

      const loginParams = user.loginParams || {};
      loginParams.entryPoint = entryPoint;
      loginParams.curTeacher = curTeacher;
      loginParams.curClass = curClass;
      loginParams.loginMode = loginMode;
      loginParams.assignedTdfs = assignedTdfs;
      loginParams.authSessionState = deps.buildSessionAuthState(
        loginMode,
        loginMode === 'google' || loginMode === 'microsoft' || loginMode === 'memphisSaml' ? 'federated' : 'password'
      );
      const normalizedAssignedTdfIds = Array.isArray(assignedTdfs)
        ? assignedTdfs
          .map((id: unknown) => deps.normalizeCanonicalId(id))
          .filter((id: string | null): id is string => typeof id === 'string')
        : [];

      deps.serverConsole('setUserLoginData updating with loginParams:', loginParams);
      const userUpdate: UnknownRecord = { $set: { loginParams } };
      if (normalizedAssignedTdfIds.length > 0) {
        userUpdate.$addToSet = { accessedTDFs: { $each: normalizedAssignedTdfIds } };
      }
      const result = await deps.usersCollection.updateAsync({ _id: userId }, userUpdate);
      deps.serverConsole('setUserLoginData update result:', result);

      return result;
    },

    requestPasswordReset: async function(this: MethodContext, email: string) {
      check(email, String);
      const normalizedEmail = deps.normalizeCanonicalEmail(email).canonical;
      await deps.applyMethodRateLimit('password-reset-request', deps.getAuthClientIp(this), normalizedEmail, {
        ipLimit: 5,
        identifierLimit: 3,
        windowMs: 60 * 60 * 1000,
      });
      const responseStartedAtMs = Date.now();
      try {
        const recentResets = await deps.PasswordResetTokens.find({
          email: normalizedEmail,
          createdAt: { $gt: new Date(Date.now() - 60000) },
        }).countAsync();

        if (recentResets >= 3) {
          throw new Meteor.Error('rate-limit', 'Too many reset requests. Please wait a minute.');
        }

        const user = await deps.findNormalAccountUserByCanonicalEmail(normalizedEmail);
        if (!user) {
          return { success: true };
        }

        const token = randomBytes(32).toString('hex');
        const tokenHash = createHash('sha256').update(token).digest('hex');
        const expiresAt = new Date(Date.now() + 3600000);
        await deps.PasswordResetTokens.insertAsync({
          email: normalizedEmail,
          userId: user._id,
          tokenHash,
          createdAt: new Date(),
          expiresAt,
          used: false,
        });

        const resetUrl = (Meteor.settings.ROOT_URL || Meteor.absoluteUrl()).replace(/\/$/, '') +
          '/auth/reset-password?email=' + encodeURIComponent(normalizedEmail) +
          '&token=' + encodeURIComponent(token);
        try {
          const brandName = (await ensurePublishedDeploymentBrandProfile()).identity.name;
          deps.sendEmail(
            normalizedEmail,
            deps.emailFrom,
            `${brandName} Password Reset`,
            'You requested a password reset.\n\n' +
              'Open this link to set a new password:\n' + resetUrl + '\n\n' +
              'This link expires in 1 hour.\n\n' +
              'If you did not request this reset, you can ignore this email.'
          );
        } catch {
          deps.serverConsole('Failed to send password reset message');
        }

        await deps.writeAuditLog('auth.passwordResetRequested', this.userId || null, user._id);

        return { success: true };
      } finally {
        await waitForPasswordResetResponseFloor(responseStartedAtMs);
      }
    },

    resetPasswordWithToken: async function(this: MethodContext, email: string, token: string, newPassword: string) {
      check(email, String);
      check(token, String);
      check(newPassword, String);
      const normalizedEmail = deps.normalizeCanonicalEmail(email).canonical;
      await deps.applyMethodRateLimit('password-reset-complete', deps.getAuthClientIp(this), normalizedEmail, {
        ipLimit: 10,
        identifierLimit: 5,
        windowMs: 60 * 60 * 1000,
      });

      deps.assertStrongPassword(newPassword);

      const tokenHash = createHash('sha256').update(token).digest('hex');
      const resetRecord = await deps.PasswordResetTokens.findOneAsync({
        email: normalizedEmail,
        tokenHash,
        used: false,
        expiresAt: { $gt: new Date() },
      });

      if (!resetRecord) {
        throw new Meteor.Error('invalid-token', 'Invalid or expired reset token');
      }

      await deps.PasswordResetTokens.updateAsync({ _id: resetRecord._id }, { $set: { used: true, usedAt: new Date() } });

      await setPasswordForUser(resetRecord.userId, newPassword);
      await deps.enforceCanonicalEmailIdentity(resetRecord.userId, normalizedEmail, {
        actorUserId: this.userId || null,
        source: 'resetPasswordWithToken',
      });
      await deps.syncUserAuthState(resetRecord.userId, 'password');

      await deps.writeAuditLog('auth.passwordResetCompleted', this.userId || null, resetRecord.userId);
      await deps.writeAuditLog('auth.sessionRevoked', this.userId || null, resetRecord.userId, {
        reason: 'password-reset',
      });
      deps.serverConsole('Password reset completed successfully');
      return { success: true };
    },

    cleanupExpiredPasswordResetTokens: async function(this: MethodContext) {
      await deps.requireAdminUser(this.userId, 'Admin access required');

      const deleted = await deps.PasswordResetTokens.removeAsync({
        expiresAt: { $lt: new Date() },
      });

      deps.serverConsole('Cleaned up', deleted, 'expired password reset tokens');
      return { deleted };
    },

    signUpUser: async function(this: MethodContext, newUserName: string, newUserPassword: string) {
      check(newUserName, String);
      check(newUserPassword, String);
      const allowPublicSignup = deps.requireAllowPublicSignupSetting();
      if (!allowPublicSignup) {
        throw new Meteor.Error('signup-disabled', 'Public signup is disabled');
      }

      const normalizedEmail = deps.normalizeCanonicalEmail(newUserName);
      await deps.applyMethodRateLimit('signup', deps.getAuthClientIp(this), normalizedEmail.canonical, {
        ipLimit: 8,
        identifierLimit: 3,
        windowMs: 60 * 60 * 1000,
      });

      deps.assertStrongPassword(newUserPassword);

      return await deps.withSignUpLock(normalizedEmail.canonical, async () => {
        await deps.writeAuditLog('auth.signupRequested', this.userId || null, null, {
          emailCanonical: normalizedEmail.canonical,
        });

        const existingUser = await deps.findNormalAccountUserByCanonicalEmail(normalizedEmail.canonical);
        if (existingUser) {
          throw new Meteor.Error('duplicate-user', 'User is already in use');
        }

        const createdId = await deps.createUserWithRetry(
          normalizedEmail.canonical,
          newUserPassword,
          { experiment: false, username: normalizedEmail.canonical },
          {
            emailOriginal: normalizedEmail.original,
            emailCanonical: normalizedEmail.canonical,
          }
        );
        await deps.enforceCanonicalEmailIdentity(createdId, normalizedEmail.original, {
          actorUserId: this.userId || null,
          source: 'signUpUser',
        });

        await deps.writeAuditLog('auth.signupCompleted', this.userId || null, createdId, {
          emailCanonical: normalizedEmail.canonical,
          loginType: 'password',
        });
        await deps.syncUserAuthState(createdId, 'password');
        if (deps.isEmailVerificationRequired()) {
          await deps.sendVerificationEmailForUser(createdId, this.userId || null, 'signup');
        }

        return { userExists: false, userId: createdId };
      });
    },

    populateSSOProfile: async function(this: MethodContext, userId: string) {
      await requireUserMatchesOrHasRole(deps.getMethodAuthorizationDeps(), {
        actingUserId: this.userId,
        subjectUserId: userId,
        roles: ['admin'],
        notLoggedInMessage: 'Must be logged in',
        notLoggedInCode: 401,
        forbiddenMessage: 'Can only populate your own SSO profile',
        forbiddenCode: 403,
      });

      const user = await deps.usersCollection.findOneAsync({ _id: userId });
      if (user && user.services) {
        const service = Object.keys(user.services)[0];
        if (!service) {
          return 'error: no service profile';
        }
        const serviceProfile = user.services[service];
        const serviceEmail = serviceProfile?.email ||
          serviceProfile?.mail ||
          serviceProfile?.userPrincipalName;
        if (!serviceEmail) {
          throw new Meteor.Error('oauth-email-missing', 'No email found for your OAuth account');
        }
        const profile = {
          email: serviceEmail,
          service,
          refreshToken: serviceProfile.refreshToken,
        };
        const normalizedEmail = deps.normalizeCanonicalEmail(serviceEmail);
        await deps.usersCollection.updateAsync({ _id: userId }, { $set: {
          profile: {
            ...profile,
            username: normalizedEmail.canonical,
          },
          username: normalizedEmail.canonical,
          email_original: normalizedEmail.original,
          email_canonical: normalizedEmail.canonical,
          'emails.0.address': normalizedEmail.canonical,
        } });
        deps.syncUsernameCaches(userId, normalizedEmail.canonical);
        const previousCanonical = deps.normalizeAuthIdentifier(
          user.email_canonical || user.emails?.[0]?.address || user.username || ''
        );
        if (previousCanonical && previousCanonical !== normalizedEmail.canonical) {
          await deps.writeAuditLog('auth.emailChanged', this.userId || null, userId, {
            previousEmailCanonical: previousCanonical,
            nextEmailCanonical: normalizedEmail.canonical,
            source: 'populateSSOProfile',
          });
        }
        return 'success: ' + serviceEmail;
      }
      return 'failure';
    },

    clearLoginData: async function(this: MethodContext) {
      const userId = requireCurrentUserId(this.userId, 'User must be logged in to clear login data');
      const user = await deps.usersCollection.findOneAsync({ _id: userId });
      if (!user) {
        throw new Meteor.Error(404, 'User not found');
      }
      const loginParams = user.loginParams || {};
      loginParams.entryPoint = null;
      loginParams.curTeacher = null;
      loginParams.curClass = null;
      loginParams.loginMode = null;
      loginParams.authSessionState = null;
      await deps.usersCollection.updateAsync({ _id: userId }, { $set: { loginParams } });
      await deps.writeAuditLog('auth.sessionRevoked', userId, userId, {
        reason: 'clearLoginData',
      });
    },

    getUserSpeechAPIKey: async function(this: MethodContext) {
      requireCurrentUserId(this.userId, 'Must be logged in to read speech API key status');
      return '';
    },

    isUserSpeechAPIKeySetup: async function(this: MethodContext) {
      const userId = typeof this.userId === 'string' ? this.userId.trim() : '';
      if (!userId) {
        return false;
      }
      const speechAPIKey = (await deps.usersCollection.findOneAsync({ _id: userId }))?.speechAPIKey;
      return !!speechAPIKey;
    },

    hasUserPersonalKeys: async function(this: MethodContext, tdfId?: string | null) {
      const userId = typeof this.userId === 'string' ? this.userId.trim() : '';
      if (!userId) {
        return { hasSR: false, hasTTS: false };
      }
      const user = await deps.usersCollection.findOneAsync({ _id: userId });
      if (!user) {
        return { hasSR: false, hasTTS: false };
      }
      const currentTdfId = typeof tdfId === 'string' && tdfId.trim() ? tdfId.trim() : null;
      const speechResolution = await resolvePreferredApiKey(deps.getApiKeyResolutionDeps(), {
        userId,
        tdfId: currentTdfId,
        kind: 'speech',
      });
      const ttsResolution = await resolvePreferredApiKey(deps.getApiKeyResolutionDeps(), {
        userId,
        tdfId: currentTdfId,
        kind: 'tts',
      });
      return {
        hasSR: Boolean(speechResolution.apiKey),
        hasTTS: Boolean(ttsResolution.apiKey),
        speechSource: speechResolution.source,
        ttsSource: ttsResolution.source,
      };
    },

    saveUserSpeechAPIKey: async function(this: MethodContext, key: string) {
      const userId = requireCurrentUserId(this.userId, 'User not found');
      await deps.usersCollection.upsertAsync({ _id: userId }, { $set: { speechAPIKey: deps.encryptData(key) } });
    },

    getTdfTTSAPIKey: async function(this: MethodContext, tdfId: string) {
      const key = await deps.getAccessibleTdfApiKey(deps.getApiKeyResolutionDeps(), {
        userId: this.userId,
        tdfId,
        kind: 'tts',
      });
      return { configured: Boolean(key) };
    },

    getTdfSpeechAPIKey: async function(this: MethodContext, tdfId: string) {
      const key = await deps.getAccessibleTdfApiKey(deps.getApiKeyResolutionDeps(), {
        userId: this.userId,
        tdfId,
        kind: 'speech',
      });
      return { configured: Boolean(key) };
    },

    setUserSessionId: async function(this: MethodContext, sessionId: string, sessionIdTimestamp: number) {
      deps.serverConsole('setUserSessionId request received');
      const userId = typeof this.userId === 'string' ? this.userId.trim() : '';
      if (!userId) {
        return;
      }
      await deps.usersCollection.updateAsync(
        { _id: userId },
        { $set: { lastSessionId: sessionId, lastSessionIdTimestamp: sessionIdTimestamp } }
      );
    },

    recordSessionRevocation: async function(this: MethodContext, reason: string) {
      check(reason, String);
      const userId = requireCurrentUserId(this.userId);
      await deps.writeAuditLog('auth.sessionRevoked', userId, userId, {
        reason: reason.trim() || 'unspecified',
      });
      return { success: true };
    },

    getPasswordHashRuntimeInfo: async function(this: MethodContext) {
      await deps.requireAdminUser(this.userId, 'Admin access required');
      return deps.getPasswordHashRuntimeInfo();
    },

    deleteUserSpeechAPIKey: async function(this: MethodContext) {
      const userId = typeof this.userId === 'string' ? this.userId.trim() : '';
      if (!userId) {
        return;
      }
      await deps.usersCollection.updateAsync({ _id: userId }, { $unset: { speechAPIKey: '' } });
    },

    resendVerificationEmail: async function(this: MethodContext, email: string | null = null) {
      check(email, Match.OneOf(String, null));
      if (typeof email !== 'string' && email !== null) {
        throw new Meteor.Error('invalid-email', 'A valid email address is required');
      }

      let targetUser = null;
      if (this.userId) {
        targetUser = await deps.usersCollection.findOneAsync({ _id: this.userId });
      } else if (email) {
        const normalizedEmail = deps.normalizeCanonicalEmail(email).canonical;
        targetUser = await deps.findNormalAccountUserByCanonicalEmail(normalizedEmail);
      }

      if (!targetUser || !deps.isNormalAccountUser(targetUser) || deps.isUserEmailVerified(targetUser)) {
        return { success: true };
      }

      await deps.applyMethodRateLimit(
        'verification-resend',
        deps.getAuthClientIp(this),
        deps.normalizeAuthIdentifier(deps.getUserDisplayIdentifier(targetUser)),
        {
          ipLimit: 5,
          identifierLimit: 3,
          windowMs: 60 * 60 * 1000,
        }
      );

      await deps.sendVerificationEmailForUser(targetUser._id, this.userId || null, 'resendVerificationEmail');
      return { success: true };
    },
  };
}
