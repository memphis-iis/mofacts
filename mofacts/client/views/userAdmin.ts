import { Meteor } from 'meteor/meteor';
import { Template } from 'meteor/templating';
import { ReactiveVar } from 'meteor/reactive-var';
import { Tracker } from 'meteor/tracker';
import { _ as underscore } from 'meteor/underscore';
const _ = underscore as any;
import './userAdmin.html';
import './shared/adminUi/adminUi';
import { Mongo } from 'meteor/mongo';
import { userHasRole } from '../lib/roleUtils';
import { getErrorMessage } from '../lib/errorUtils';
import { getActiveUiLocale } from '../lib/interfaceLocaleState';
import { translatePlatformString } from '../lib/interfaceI18n';
import { formatActiveInterfaceDateTime, formatActiveInterfaceNumber } from '../lib/interfaceFormatting';
import { getDeploymentBrandName } from '../lib/deploymentBrandProfileRuntime';
import { loadOpenRouterModelCatalog } from '../lib/openRouterModelCatalogClient';
import {
  createScopedAsyncCommandRegistry,
  type ScopedAsyncCommandRegistry,
} from '../lib/adminUi/scopedAsyncCommandRegistry';
import type { AsyncCommandState } from '../lib/adminUi/asyncCommandState';
import { createInlineConfirmationController } from '../lib/adminUi/inlineConfirmationController';
import {
  getAllowedOpenRouterReasoningLevels,
  getDefaultOpenRouterReasoningLevel,
  getOpenRouterReasoningControlKind,
  normalizeOpenRouterReasoningLevel,
  type OpenRouterModelCatalogEntry,
  type OpenRouterReasoningLevel,
} from '../../common/lib/openRouterModelCatalog';

import { legacyTrim } from '../../common/underscoreCompat';

// Client-side collection for user counts
const UserCounts = new Mongo.Collection('user_counts');
const FilteredUserPageIds = new Mongo.Collection('filtered_user_page_ids');
const MeteorCompat = Meteor as typeof Meteor & { callAsync: (name: string, ...args: any[]) => Promise<any> };
declare const UserDashboardCache: Mongo.Collection<any>;

const USERS_PER_PAGE = 50;
function newsEmailSubject() {
  return `${getDeploymentBrandName()} News`;
}

function newsEmailBody() {
  const brandName = getDeploymentBrandName();
  return ['Hello,', '', `Here is the latest ${brandName} news:`, '', '- ', '', 'Best,', `The ${brandName} Team`].join('\n');
}

type SortDirection = 'asc' | 'desc';
type RoleName = 'admin' | 'teacher';
type RoleFlags = Record<RoleName, boolean>;
type RoleStateOverrides = Record<string, Partial<RoleFlags>>;
type AdminApiKeyMetadata = {
  openRouter?: {
    configured?: boolean;
    unusable?: boolean;
    keyUpdatedAt?: unknown;
    modelUpdatedAt?: unknown;
    reasoningLevelUpdatedAt?: unknown;
    updatedBy?: unknown;
    model?: string;
    reasoningLevel?: OpenRouterReasoningLevel;
    prefixCachingEnabled?: boolean;
    prefixCachingUpdatedAt?: unknown;
  };
  googleTts?: { configured?: boolean; unusable?: boolean; keyUpdatedAt?: unknown; updatedBy?: unknown };
  googleSpeech?: { configured?: boolean; unusable?: boolean; keyUpdatedAt?: unknown; updatedBy?: unknown };
};
type UserAdminRoleChangeResult = {
  targetUserId?: unknown;
  targetRoles?: Partial<Record<RoleName, unknown>>;
};
type UserRowCommandResult = Readonly<{ message: string }>;
type UserRowCommandStates = Record<string, AsyncCommandState<UserRowCommandResult>>;
type ApiKeyFeedback = Readonly<{ text: string; variant: 'info' | 'success' | 'error' }>;

function apiKeyCommandScope(provider: string): string {
  return `api-key:${provider}`;
}

function setApiKeyFeedback(instance: any, provider: string, feedback: ApiKeyFeedback | null): void {
  const messages = { ...instance.apiKeyMessages.get() };
  if (feedback) messages[provider] = feedback;
  else delete messages[provider];
  instance.apiKeyMessages.set(messages);
}

function providerApiKeyBusy(instance: any, provider: string): boolean {
  return instance.apiKeyCommandStates.get()[apiKeyCommandScope(provider)]?.status === 'pending';
}

function roleCommandScope(userId: string): string {
  return `user:role:${userId}`;
}

function deleteCommandScope(userId: string): string {
  return `user:delete:${userId}`;
}

function rowCommandPresentation(
  state: AsyncCommandState<UserRowCommandResult> | undefined,
  pendingText: string,
  id = '',
): { id: string; text: string; variant: 'info' | 'success' | 'error'; urgent: boolean } | null {
  if (!state || state.status === 'idle') return null;
  if (state.status === 'pending') return { id, text: pendingText, variant: 'info', urgent: false };
  if (state.status === 'success') return { id, text: state.result.message, variant: 'success', urgent: false };
  return { id, text: state.message, variant: 'error', urgent: true };
}

function userAdminText(key: Parameters<typeof translatePlatformString>[1], values?: Parameters<typeof translatePlatformString>[2]): string {
  return translatePlatformString(getActiveUiLocale(), key, values);
}

function messageIcon(messageType: string): string {
  if (messageType === 'success') return 'fa-check-circle';
  if (messageType === 'warning') return 'fa-exclamation-triangle';
  if (messageType === 'danger' || messageType === 'error') return 'fa-times-circle';
  return 'fa-info-circle';
}

function getPagedUserIds(): string[] {
  return FilteredUserPageIds.find({}, { sort: { userId: 1 } })
    .fetch()
    .map((doc: any) => doc.userId)
    .filter((id: unknown): id is string => typeof id === 'string' && id.trim().length > 0);
}

function buildNewsEmailMailto(emails: string[]): string {
  const params = [
    `bcc=${encodeURIComponent(emails.join(','))}`,
    `subject=${encodeURIComponent(newsEmailSubject())}`,
    `body=${encodeURIComponent(newsEmailBody())}`,
  ].join('&');
  return `mailto:?${params}`;
}

function getDisplayIdentifier(user: any): { displayIdentifier: string; hasIdentifierInvariantViolation: boolean } {
  const identifierRaw = String(user?.email_canonical || user?.emails?.[0]?.address || user?.username || '').trim();
  const hasIdentifierInvariantViolation = identifierRaw.length === 0;
  return {
    displayIdentifier: hasIdentifierInvariantViolation
      ? `[MISSING USER IDENTIFIER] userId=${String(user?._id || 'unknown')}`
      : identifierRaw,
    hasIdentifierInvariantViolation
  };
}

function formatOneDecimal(value: unknown): string {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toFixed(1) : '0.0';
}

function formatWholeNumber(value: unknown): string {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? formatActiveInterfaceNumber(Math.round(numeric)) : formatActiveInterfaceNumber(0);
}

function formatMinutes(value: unknown): string {
  const minutes = Number(value);
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return userAdminText('admin.minutesShort', { minutes: 0 });
  }
  const roundedMinutes = Math.round(minutes);
  const hours = Math.floor(roundedMinutes / 60);
  const remainingMinutes = roundedMinutes % 60;
  if (hours > 0 && remainingMinutes > 0) {
    return userAdminText('admin.hoursMinutesShort', { hours, minutes: remainingMinutes });
  }
  if (hours > 0) {
    return userAdminText('admin.hoursShort', { hours });
  }
  return userAdminText('admin.minutesShort', { minutes: remainingMinutes });
}

function formatDate(value: unknown): string {
  if (!value) {
    return userAdminText('admin.noDate');
  }
  const date = new Date(value as any);
  if (Number.isNaN(date.getTime())) {
    return userAdminText('admin.invalidDate');
  }
  return formatActiveInterfaceDateTime(date, { dateStyle: 'medium' });
}

function formatStatusDate(value: unknown): string {
  if (!value) {
    return userAdminText('admin.noDate');
  }
  return formatDate(value);
}

function rowTargetLabel(user: any): string {
  return String(user?.displayIdentifier || user?._id || '').trim();
}

function rowActionLabel(actionKey: Parameters<typeof translatePlatformString>[1], user: any): string {
  const action = userAdminText(actionKey);
  const target = rowTargetLabel(user);
  return target ? `${action}: ${target}` : action;
}

function apiKeyMetadata(instance: any): AdminApiKeyMetadata {
  return instance.apiKeyMetadata.get() || {};
}

function getPublishedRoleFlags(userId: string): RoleFlags {
  return {
    admin: userHasRole({ _id: userId }, 'admin'),
    teacher: userHasRole({ _id: userId }, 'teacher'),
  };
}

function getDisplayedRoleFlag(userId: string, roleName: RoleName, roleStateOverrides: RoleStateOverrides): boolean {
  const overriddenValue = roleStateOverrides[userId]?.[roleName];
  return typeof overriddenValue === 'boolean'
    ? overriddenValue
    : getPublishedRoleFlags(userId)[roleName];
}

function applyConfirmedRoleState(instance: any, result: UserAdminRoleChangeResult): void {
  const targetUserId = typeof result?.targetUserId === 'string' ? result.targetUserId.trim() : '';
  const targetRoles = result?.targetRoles;
  if (!targetUserId || typeof targetRoles?.admin !== 'boolean' || typeof targetRoles?.teacher !== 'boolean') {
    throw new Error('Role change completed without authoritative role state.');
  }

  const currentOverrides = instance.roleStateOverrides.get() as RoleStateOverrides;
  instance.roleStateOverrides.set({
    ...currentOverrides,
    [targetUserId]: {
      admin: targetRoles.admin,
      teacher: targetRoles.teacher,
    },
  });
}

function clearSyncedRoleStateOverrides(instance: any): void {
  const currentOverrides = instance.roleStateOverrides.get() as RoleStateOverrides;
  const nextOverrides: RoleStateOverrides = {};
  let changed = false;

  for (const [userId, roles] of Object.entries(currentOverrides)) {
    const publishedRoles = getPublishedRoleFlags(userId);
    const remainingRoles: Partial<RoleFlags> = {};

    for (const roleName of ['admin', 'teacher'] as RoleName[]) {
      if (typeof roles[roleName] !== 'boolean') {
        continue;
      }
      if (roles[roleName] === publishedRoles[roleName]) {
        changed = true;
      } else {
        remainingRoles[roleName] = roles[roleName];
      }
    }

    if (Object.keys(remainingRoles).length > 0) {
      nextOverrides[userId] = remainingRoles;
    }
  }

  if (changed) {
    instance.roleStateOverrides.set(nextOverrides);
  }
}

function applyAdminOpenRouterMetadata(instance: any, metadata: any): void {
  instance.apiKeyMetadata.set(metadata);
  instance.openRouterSelectedModel.set(String(metadata?.openRouter?.model || '').trim());
  instance.openRouterSelectedReasoningLevel.set(normalizeOpenRouterReasoningLevel(
    metadata?.openRouter?.reasoningLevel,
    'Stored admin OpenRouter reasoning level',
  ));
  instance.openRouterPrefixCachingEnabled.set(metadata?.openRouter?.prefixCachingEnabled === true);
  syncAdminReasoningSelectionForModel(instance);
}

async function refreshAdminApiKeyMetadata(instance: any): Promise<void> {
  try {
    const metadata = await MeteorCompat.callAsync('getAdminApiKeyAlternativeMetadata');
    applyAdminOpenRouterMetadata(instance, metadata);
    instance.apiKeyMetadataLoaded.set(true);
  } catch (error: unknown) {
    instance.apiKeyMetadataLoaded.set(false);
    setApiKeyFeedback(instance, 'openrouter', {
      variant: 'error',
      text: userAdminText('admin.apiKeysLoadFailed', { error: getErrorMessage(error) }),
    });
  }
}

function findAdminCatalogModel(instance: any): OpenRouterModelCatalogEntry | undefined {
  const modelId = String(instance.openRouterSelectedModel.get() || '').trim();
  return (instance.openRouterModelCatalog.get() as OpenRouterModelCatalogEntry[])
    .find((model) => model.id === modelId);
}

function syncAdminReasoningSelectionForModel(instance: any): void {
  if (!String(instance.openRouterSelectedModel.get() || '').trim()) {
    instance.openRouterSelectedReasoningLevel.set('none');
    return;
  }
  const model = findAdminCatalogModel(instance);
  if (!model) {
    return;
  }
  const currentLevel = normalizeOpenRouterReasoningLevel(
    instance.openRouterSelectedReasoningLevel.get(),
    'Admin OpenRouter reasoning level',
  );
  const allowedLevels = getAllowedOpenRouterReasoningLevels(model);
  if (!allowedLevels.includes(currentLevel)) {
    instance.openRouterSelectedReasoningLevel.set(getDefaultOpenRouterReasoningLevel(model));
  }
}

async function loadAdminOpenRouterModelCatalog(instance: any): Promise<void> {
  instance.openRouterModelCatalogState.set('loading');
  instance.openRouterModelCatalogError.set('');
  try {
    instance.openRouterModelCatalog.set(await loadOpenRouterModelCatalog());
    instance.openRouterModelCatalogState.set('ready');
    syncAdminReasoningSelectionForModel(instance);
  } catch (error: unknown) {
    instance.openRouterModelCatalogState.set('error');
    instance.openRouterModelCatalogError.set(getErrorMessage(error));
  }
}

async function saveAdminOpenRouterSelection(
  instance: any,
  apiKeyInput?: HTMLInputElement | null,
): Promise<void> {
  setApiKeyFeedback(instance, 'openrouter', {
    variant: 'info', text: userAdminText('admin.savingOpenRouterAlternative'),
  });
  await instance.apiKeyCommandRegistry.run(apiKeyCommandScope('openrouter'), async () => {
    const result = await MeteorCompat.callAsync('saveAdminApiKeyAlternative', 'openrouter', {
      apiKey: apiKeyInput?.value || '',
      model: String(instance.openRouterSelectedModel.get() || ''),
      reasoningLevel: instance.openRouterSelectedReasoningLevel.get(),
      prefixCachingEnabled: instance.openRouterPrefixCachingEnabled.get() === true,
    });
    applyAdminOpenRouterMetadata(instance, result);
    if (apiKeyInput) apiKeyInput.value = '';
  }, {
    getErrorMessage: (error: unknown) => userAdminText('admin.saveOpenRouterAlternativeFailed', { error: getErrorMessage(error) }),
    onSuccess: () => setApiKeyFeedback(instance, 'openrouter', {
      variant: 'success', text: userAdminText('admin.savedOpenRouterAlternative'),
    }),
    onFailure: (error: unknown) => setApiKeyFeedback(instance, 'openrouter', {
      variant: 'error',
      text: userAdminText('admin.saveOpenRouterAlternativeFailed', { error: getErrorMessage(error) }),
    }),
  });
}

function adminReasoningLevelLabel(level: OpenRouterReasoningLevel): string {
  return userAdminText(`profile.reasoningLevel.${level}` as Parameters<typeof translatePlatformString>[1]);
}

function getTimeValue(value: unknown): number {
  if (!value) {
    return 0;
  }
  const date = new Date(value as any);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function buildUsageDisplay(user: any) {
  const cache = UserDashboardCache.findOne({ userId: user._id }) as any;
  const noCache = userAdminText('admin.noCache');
  if (!cache) {
    return {
      usageStatus: 'missing-cache',
      usageCellClass: 'text-muted',
      totalTrialsDisplay: noCache,
      accuracyDisplay: noCache,
      totalTimeDisplay: noCache,
      averageSessionDaysDisplay: noCache,
      averageItemsPracticedDisplay: noCache,
      lastActivityDisplay: noCache,
      cacheUpdatedDisplay: noCache,
      usageSort: {
        totalTrials: Number.NEGATIVE_INFINITY,
        weightedAccuracy: Number.NEGATIVE_INFINITY,
        totalTimeMinutes: Number.NEGATIVE_INFINITY,
        averageSessionDays: Number.NEGATIVE_INFINITY,
        averageItemsPracticed: Number.NEGATIVE_INFINITY,
        lastActivityDate: Number.NEGATIVE_INFINITY,
        cacheUpdated: Number.NEGATIVE_INFINITY
      }
    };
  }

  const usageSummary = cache.usageSummary;
  const refreshNeeded = userAdminText('admin.refreshNeeded');
  if (!usageSummary) {
    return {
      usageStatus: 'needs-refresh',
      usageCellClass: 'text-warning',
      totalTrialsDisplay: refreshNeeded,
      accuracyDisplay: refreshNeeded,
      totalTimeDisplay: refreshNeeded,
      averageSessionDaysDisplay: refreshNeeded,
      averageItemsPracticedDisplay: refreshNeeded,
      lastActivityDisplay: refreshNeeded,
      cacheUpdatedDisplay: formatDate(cache.lastUpdated),
      usageSort: {
        totalTrials: Number.NEGATIVE_INFINITY,
        weightedAccuracy: Number.NEGATIVE_INFINITY,
        totalTimeMinutes: Number.NEGATIVE_INFINITY,
        averageSessionDays: Number.NEGATIVE_INFINITY,
        averageItemsPracticed: Number.NEGATIVE_INFINITY,
        lastActivityDate: Number.NEGATIVE_INFINITY,
        cacheUpdated: getTimeValue(cache.lastUpdated)
      }
    };
  }

  return {
    usageStatus: 'ready',
    usageCellClass: '',
    totalTrialsDisplay: formatWholeNumber(usageSummary.totalTrials),
    accuracyDisplay: `${formatOneDecimal(usageSummary.weightedAccuracy)}%`,
    totalTimeDisplay: formatMinutes(usageSummary.totalTimeMinutes),
    averageSessionDaysDisplay: formatOneDecimal(usageSummary.averageSessionDays),
    averageItemsPracticedDisplay: formatOneDecimal(usageSummary.averageItemsPracticed),
    lastActivityDisplay: formatDate(usageSummary.lastActivityDate),
    cacheUpdatedDisplay: formatDate(cache.lastUpdated),
    usageSort: {
      totalTrials: Number(usageSummary.totalTrials || 0),
      weightedAccuracy: Number(usageSummary.weightedAccuracy || 0),
      totalTimeMinutes: Number(usageSummary.totalTimeMinutes || 0),
      averageSessionDays: Number(usageSummary.averageSessionDays || 0),
      averageItemsPracticed: Number(usageSummary.averageItemsPracticed || 0),
      lastActivityDate: getTimeValue(usageSummary.lastActivityDate),
      cacheUpdated: getTimeValue(cache.lastUpdated)
    }
  };
}

Template.userAdmin.onCreated(function(this: any) {
  this.filter = new ReactiveVar('');
  this.currentPage = new ReactiveVar(0);
  this.isLoading = new ReactiveVar(true);
  this.isRefreshingUsage = new ReactiveVar(false);
  this.usageRefreshMessage = new ReactiveVar('');
  this.usageRefreshMessageType = new ReactiveVar('info');
  this.isPreparingNewsEmail = new ReactiveVar(false);
  this.newsEmailMessage = new ReactiveVar('');
  this.newsEmailMessageType = new ReactiveVar('info');
  this.importMessage = new ReactiveVar('');
  this.importMessageType = new ReactiveVar('info');
  this.userListMessage = new ReactiveVar('');
  this.userListMessageType = new ReactiveVar('info');
  this.rowCommandStates = new ReactiveVar({} as UserRowCommandStates);
  this.rowCommandRegistry = createScopedAsyncCommandRegistry<UserRowCommandResult>((scope, state) => {
    const current = this.rowCommandStates.get() as UserRowCommandStates;
    this.rowCommandStates.set({ ...current, [scope]: state });
  }) as ScopedAsyncCommandRegistry<UserRowCommandResult>;
  this.selectedDeleteUser = new ReactiveVar(null);
  this.deleteConfirmationState = new ReactiveVar(null);
  this.deleteConfirmationController = createInlineConfirmationController(
    (view) => {
      this.deleteConfirmationState.set(view);
      if (view.status === 'closed') this.selectedDeleteUser.set(null);
    },
    () => document.querySelector<HTMLElement>('.user-admin-sort-button, #prevPage, #nextPage'),
  );
  this.apiKeyMetadata = new ReactiveVar(null);
  this.apiKeyMetadataLoaded = new ReactiveVar(false);
  this.apiKeyMessages = new ReactiveVar({});
  this.apiKeyCommandStates = new ReactiveVar({});
  this.apiKeyCommandRegistry = createScopedAsyncCommandRegistry((scope, state) => {
    this.apiKeyCommandStates.set({ ...this.apiKeyCommandStates.get(), [scope]: state });
  });
  this.openRouterModelCatalog = new ReactiveVar([] as OpenRouterModelCatalogEntry[]);
  this.openRouterModelCatalogState = new ReactiveVar('loading');
  this.openRouterModelCatalogError = new ReactiveVar('');
  this.openRouterSelectedModel = new ReactiveVar('');
  this.openRouterSelectedReasoningLevel = new ReactiveVar('none' as OpenRouterReasoningLevel);
  this.openRouterPrefixCachingEnabled = new ReactiveVar(false);
  this.sortField = new ReactiveVar('identifier');
  this.sortDirection = new ReactiveVar('asc' as SortDirection);
  this.roleStateOverrides = new ReactiveVar({} as RoleStateOverrides);
  this.autoruns = [];

  // Debounce timer for filter changes
  this.filterDebounceTimer = null;
});

Template.userAdmin.onRendered(function(this: any) {
  const instance = this;
  void refreshAdminApiKeyMetadata(instance);
  void loadAdminOpenRouterModelCatalog(instance);

  // Autorun to reactively subscribe when filter or page changes
  const autorun = this.autorun(() => {
    const filter = instance.filter.get();
    const page = instance.currentPage.get();

    // Keep readiness tied to the active subscription handles only.
    // This avoids stale onReady callbacks from a prior stopped subscription.
    const usersSub = instance.subscribe('filteredUsers', filter, page, USERS_PER_PAGE);
    const countSub = instance.subscribe('filteredUsersCount', filter);
    const usageUserIds = getPagedUserIds();
    const usageSub = usageUserIds.length > 0
      ? instance.subscribe('userAdminDashboardUsage', usageUserIds)
      : { ready: () => true };
    instance.isLoading.set(!(usersSub.ready() && countSub.ready() && usageSub.ready()));
  });
  instance.autoruns.push(autorun);

  const roleStateAutorun = this.autorun(() => {
    (Meteor as any).roleAssignment?.find({}).fetch();
    clearSyncedRoleStateOverrides(instance);
  });
  instance.autoruns.push(roleStateAutorun);
});

Template.userAdmin.onDestroyed(function(this: any) {
  this.rowCommandRegistry.destroy();
  this.apiKeyCommandRegistry.destroy();
  this.deleteConfirmationController.destroy();
  // Clean up autoruns
  this.autoruns.forEach((ar: any) => ar.stop());

  // Clear debounce timer
  if (this.filterDebounceTimer) {
    clearTimeout(this.filterDebounceTimer);
  }
});

function buildUserRoleEditRows(instance: any): any[] {
  // Establish reactive dependency on role-assignment collection so the helper
  // reruns on both add AND remove (not just remove).
  (Meteor as any).roleAssignment?.find({}).fetch();
  const canManageUsers = userHasRole(Meteor.user(), 'admin');
  const sortField = String(instance.sortField.get() || 'identifier');
  const sortDirection = instance.sortDirection.get() as SortDirection;
  const pagedUserIds = getPagedUserIds();
  const roleStateOverrides = instance.roleStateOverrides.get() as RoleStateOverrides;

  if (pagedUserIds.length === 0) {
    return [];
  }

  // Only render the users explicitly included in the active paged subscription.
  const users = Meteor.users.find({ _id: { $in: pagedUserIds } }).fetch();

  return users.map((user: any) => {
    const { displayIdentifier, hasIdentifierInvariantViolation } = getDisplayIdentifier(user);
    const usageDisplay = buildUsageDisplay(user);
    user.teacher = false;
    user.admin = false;
    user.canManageUsers = canManageUsers;
    user.displayIdentifier = displayIdentifier;
    user.hasIdentifierInvariantViolation = hasIdentifierInvariantViolation;
    Object.assign(user, usageDisplay);

    user.teacher = getDisplayedRoleFlag(user._id, 'teacher', roleStateOverrides);
    user.admin = getDisplayedRoleFlag(user._id, 'admin', roleStateOverrides);
    return user;
  }).sort((a: any, b: any) => {
    const aViolation = !!a.hasIdentifierInvariantViolation;
    const bViolation = !!b.hasIdentifierInvariantViolation;
    if (aViolation !== bViolation) {
      return aViolation ? 1 : -1;
    }
    let compareValue = 0;
    if (sortField === 'identifier') {
      compareValue = String(a.displayIdentifier || '').localeCompare(String(b.displayIdentifier || ''));
    } else {
      compareValue = Number(a.usageSort?.[sortField] ?? Number.NEGATIVE_INFINITY) -
        Number(b.usageSort?.[sortField] ?? Number.NEGATIVE_INFINITY);
    }
    return sortDirection === 'asc' ? compareValue : -compareValue;
  });
}

Template.userAdmin.helpers({
  canManageUsers: function() {
    const currentUser = Meteor.user();
    return userHasRole(currentUser, 'admin');
  },

  userAdminText: function(key: Parameters<typeof translatePlatformString>[1]) {
    return userAdminText(key);
  },

  hasIdentifierInvariantViolations: function() {
    const pagedUserIds = getPagedUserIds();
    const users = pagedUserIds.length > 0
      ? Meteor.users.find({ _id: { $in: pagedUserIds } }).fetch()
      : [];
    return users.some((user: any) => {
      return getDisplayIdentifier(user).hasIdentifierInvariantViolation;
    });
  },

  usageAggregateSummary: function() {
    const pagedUserIds = getPagedUserIds();
    const users = pagedUserIds.length > 0
      ? Meteor.users.find({ _id: { $in: pagedUserIds } }).fetch()
      : [];
    let usersWithIdentifiers = 0;
    let usersWithUsageCache = 0;
    let usersNeedingRefresh = 0;
    let totalTrials = 0;
    let activeUsers = 0;

    for (const user of users) {
      if (getDisplayIdentifier(user).hasIdentifierInvariantViolation) {
        continue;
      }
      usersWithIdentifiers++;
      const cache = UserDashboardCache.findOne({ userId: user._id }) as any;
      if (!cache) {
        continue;
      }
      if (!cache.usageSummary) {
        usersNeedingRefresh++;
        continue;
      }
      usersWithUsageCache++;
      totalTrials += Number(cache.usageSummary.totalTrials || 0);
      if (cache.usageSummary.lastActivityDate) {
        activeUsers++;
      }
    }

    const needsRefresh = usersNeedingRefresh > 0
      ? userAdminText('admin.usageAggregateNeedsRefresh', { count: formatActiveInterfaceNumber(usersNeedingRefresh) })
      : '';
    return userAdminText('admin.usageAggregateSummary', {
      cached: formatActiveInterfaceNumber(usersWithUsageCache),
      total: formatActiveInterfaceNumber(usersWithIdentifiers),
      trials: formatActiveInterfaceNumber(totalTrials),
      active: formatActiveInterfaceNumber(activeUsers),
      needsRefresh,
    });
  },

  isRefreshingUsage: function() {
    return (Template.instance() as any).isRefreshingUsage.get();
  },

  usageRefreshMessage: function() {
    return (Template.instance() as any).usageRefreshMessage.get();
  },

  usageRefreshAlertClass: function() {
    return (Template.instance() as any).usageRefreshMessageType.get();
  },

  usageRefreshIcon: function() {
    return messageIcon((Template.instance() as any).usageRefreshMessageType.get());
  },

  refreshUsageAttrs: function() {
    const isRefreshing = (Template.instance() as any).isRefreshingUsage.get();
    return isRefreshing ? { disabled: true } : {};
  },

  isPreparingNewsEmail: function() {
    return (Template.instance() as any).isPreparingNewsEmail.get();
  },

  newsEmailMessage: function() {
    return (Template.instance() as any).newsEmailMessage.get();
  },

  newsEmailAlertClass: function() {
    return (Template.instance() as any).newsEmailMessageType.get();
  },

  newsEmailIcon: function() {
    return messageIcon((Template.instance() as any).newsEmailMessageType.get());
  },

  newsEmailAttrs: function() {
    const isPreparing = (Template.instance() as any).isPreparingNewsEmail.get();
    return isPreparing ? { disabled: true } : {};
  },

  providerApiKeyFeedback: function(provider: string) {
    return (Template.instance() as any).apiKeyMessages.get()[provider] || null;
  },

  importMessage: function() {
    return (Template.instance() as any).importMessage.get();
  },

  importMessageVariant: function() {
    const type = (Template.instance() as any).importMessageType.get();
    return type === 'danger' ? 'error' : type;
  },

  importMessageUrgent: function() {
    return (Template.instance() as any).importMessageType.get() === 'danger';
  },

  userListMessage: function() {
    return (Template.instance() as any).userListMessage.get();
  },

  userListMessageVariant: function() {
    const type = (Template.instance() as any).userListMessageType.get();
    return type === 'danger' ? 'error' : type;
  },

  userListMessageUrgent: function() {
    return (Template.instance() as any).userListMessageType.get() === 'danger';
  },

  selectedDeleteUser: function() {
    return (Template.instance() as any).selectedDeleteUser.get();
  },

  apiKeyActionAttrs: function(provider: string) {
    const instance = Template.instance() as any;
    const pending = providerApiKeyBusy(instance, provider);
    return pending || !instance.apiKeyMetadataLoaded.get()
      ? { disabled: true, ...(pending ? { 'aria-busy': 'true' } : {}) }
      : {};
  },

  adminOpenRouterModel: function() {
    return String((Template.instance() as any).openRouterSelectedModel.get() || '');
  },

  adminOpenRouterReasoningLevel: function() {
    return normalizeOpenRouterReasoningLevel(
      (Template.instance() as any).openRouterSelectedReasoningLevel.get(),
      'Admin OpenRouter reasoning level',
    );
  },

  adminOpenRouterModelOptions: function() {
    const instance = Template.instance() as any;
    const selectedModel = String(instance.openRouterSelectedModel.get() || '');
    const catalog = instance.openRouterModelCatalog.get() as OpenRouterModelCatalogEntry[];
    const options: Array<{ value: string; label: string; selectedAttrs: Record<string, boolean> }> = [{
      value: '',
      label: userAdminText('profile.selectOpenRouterModel'),
      selectedAttrs: selectedModel ? {} : { selected: true },
    }];
    if (selectedModel && !catalog.some((model) => model.id === selectedModel)) {
      options.push({
        value: selectedModel,
        label: userAdminText('profile.savedModelUnavailable', { model: selectedModel }),
        selectedAttrs: { selected: true },
      });
    }
    for (const model of catalog) {
      options.push({
        value: model.id,
        label: model.name === model.id ? model.id : `${model.name} (${model.id})`,
        selectedAttrs: model.id === selectedModel ? { selected: true } : {},
      });
    }
    return options;
  },

  adminOpenRouterModelSelectAttrs: function() {
    const instance = Template.instance() as any;
    return instance.openRouterModelCatalogState.get() === 'ready' && !providerApiKeyBusy(instance, 'openrouter')
      ? {}
      : { disabled: true };
  },

  openRouterModelCatalogMessage: function() {
    const instance = Template.instance() as any;
    const state = instance.openRouterModelCatalogState.get();
    if (state === 'loading') {
      return userAdminText('profile.loadingOpenRouterModels');
    }
    if (state === 'error') {
      return userAdminText('profile.openRouterModelsLoadFailed', {
        error: instance.openRouterModelCatalogError.get(),
      });
    }
    return '';
  },

  adminOpenRouterModelDescribedBy: function() {
    return (Template.instance() as any).openRouterModelCatalogState.get() === 'ready'
      ? 'adminOpenRouterModelStatus'
      : 'adminOpenRouterModelStatus adminOpenRouterCatalogStatus';
  },

  openRouterModelCatalogAlertClass: function() {
    return (Template.instance() as any).openRouterModelCatalogState.get() === 'error'
      ? 'danger'
      : 'info';
  },

  openRouterModelCatalogIcon: function() {
    return (Template.instance() as any).openRouterModelCatalogState.get() === 'error'
      ? 'fa-times-circle'
      : 'fa-info-circle';
  },

  showAdminOpenRouterReasoningLevel: function() {
    const instance = Template.instance() as any;
    const model = findAdminCatalogModel(instance);
    return model ? getOpenRouterReasoningControlKind(model) === 'effort' : false;
  },

  showAdminOpenRouterReasoningToggle: function() {
    const model = findAdminCatalogModel(Template.instance() as any);
    return model ? getOpenRouterReasoningControlKind(model) === 'toggle' : false;
  },

  adminOpenRouterReasoningLevelOptions: function() {
    const instance = Template.instance() as any;
    const selectedLevel = normalizeOpenRouterReasoningLevel(
      instance.openRouterSelectedReasoningLevel.get(),
      'Admin OpenRouter reasoning level',
    );
    const model = findAdminCatalogModel(instance);
    const levels = model
      ? getAllowedOpenRouterReasoningLevels(model)
      : [selectedLevel];
    return levels.map((level) => ({
      value: level,
      label: adminReasoningLevelLabel(level),
      selectedAttrs: level === selectedLevel ? { selected: true } : {},
    }));
  },

  adminOpenRouterReasoningSelectAttrs: function() {
    const instance = Template.instance() as any;
    return instance.openRouterModelCatalogState.get() === 'ready'
      && Boolean(findAdminCatalogModel(instance))
      && !providerApiKeyBusy(instance, 'openrouter')
      ? {}
      : { disabled: true };
  },

  adminOpenRouterReasoningToggleAttrs: function() {
    const instance = Template.instance() as any;
    const selectedLevel = normalizeOpenRouterReasoningLevel(
      instance.openRouterSelectedReasoningLevel.get(),
      'Admin OpenRouter reasoning level',
    );
    const disabled = instance.openRouterModelCatalogState.get() !== 'ready'
      || !findAdminCatalogModel(instance)
      || providerApiKeyBusy(instance, 'openrouter');
    return {
      ...(selectedLevel === 'default' ? { checked: true } : {}),
      ...(disabled ? { disabled: true } : {}),
    };
  },

  adminOpenRouterPrefixCachingAttrs: function() {
    const instance = Template.instance() as any;
    return {
      ...(instance.openRouterPrefixCachingEnabled.get() === true ? { checked: true } : {}),
      ...(providerApiKeyBusy(instance, 'openrouter') || !instance.apiKeyMetadataLoaded.get()
        ? { disabled: true }
        : {}),
    };
  },

  openRouterKeyPlaceholder: function() {
    const data = apiKeyMetadata(Template.instance()).openRouter;
    return data?.configured || data?.unusable
      ? userAdminText('admin.configuredEnterToReplace')
      : userAdminText('admin.enterOpenRouterKey');
  },

  openRouterKeyStatus: function() {
    const data = apiKeyMetadata(Template.instance()).openRouter;
    if (data?.unusable) return userAdminText('admin.storedKeyCannotDecrypt', { label: 'OpenRouter' });
    return data?.configured
      ? userAdminText('admin.configuredKeyUpdated', { date: formatStatusDate(data.keyUpdatedAt) })
      : userAdminText('admin.noAdminOpenRouterKey');
  },

  openRouterModelStatus: function() {
    const data = apiKeyMetadata(Template.instance()).openRouter;
    return data?.model
      ? userAdminText('admin.modelUpdated', { date: formatStatusDate(data.modelUpdatedAt) })
      : userAdminText('admin.noAdminOpenRouterModel');
  },

  googleTtsKeyPlaceholder: function() {
    const data = apiKeyMetadata(Template.instance()).googleTts;
    return data?.configured || data?.unusable
      ? userAdminText('admin.configuredEnterToReplace')
      : userAdminText('admin.enterGoogleTtsKey');
  },

  googleTtsKeyStatus: function() {
    const data = apiKeyMetadata(Template.instance()).googleTts;
    if (data?.unusable) return userAdminText('admin.storedKeyCannotDecrypt', { label: 'Google TTS' });
    return data?.configured
      ? userAdminText('admin.configuredKeyUpdated', { date: formatStatusDate(data.keyUpdatedAt) })
      : userAdminText('admin.noAdminGoogleTtsKey');
  },

  googleSpeechKeyPlaceholder: function() {
    const data = apiKeyMetadata(Template.instance()).googleSpeech;
    return data?.configured || data?.unusable
      ? userAdminText('admin.configuredEnterToReplace')
      : userAdminText('admin.enterGoogleSpeechKey');
  },

  googleSpeechKeyStatus: function() {
    const data = apiKeyMetadata(Template.instance()).googleSpeech;
    if (data?.unusable) return userAdminText('admin.storedKeyCannotDecrypt', { label: 'Google Speech Recognition' });
    return data?.configured
      ? userAdminText('admin.configuredKeyUpdated', { date: formatStatusDate(data.keyUpdatedAt) })
      : userAdminText('admin.noAdminGoogleSrKey');
  },

  isLoading: function() {
    return (Template.instance() as any).isLoading.get();
  },

  userAdminTableLabel: function() {
    return userAdminText('admin.userList');
  },

  userAdminTableData: function() {
    const instance = Template.instance() as any;
    return {
      rows: buildUserRoleEditRows(instance),
      canManageUsers: userHasRole(Meteor.user(), 'admin'),
      isLoading: instance.isLoading.get(),
      selectedDeleteUser: instance.selectedDeleteUser.get(),
      deleteConfirmationView: instance.deleteConfirmationState.get(),
      rowCommandStates: instance.rowCommandStates.get(),
      sortField: String(instance.sortField.get() || 'identifier'),
      sortDirection: instance.sortDirection.get() as SortDirection,
    };
  },

  currentFilter: function() {
    return (Template.instance() as any).filter.get();
  },

  currentPage: function() {
    return (Template.instance() as any).currentPage.get() + 1; // 1-indexed for display
  },

  totalPages: function() {
    const countDoc = UserCounts.findOne('filtered') as any;
    if (!countDoc) return 1;
    return Math.ceil(countDoc.count / USERS_PER_PAGE) || 1;
  },

  totalUsers: function() {
    const countDoc = UserCounts.findOne('filtered') as any;
    return countDoc ? countDoc.count : 0;
  },

  hasPrevPage: function() {
    return (Template.instance() as any).currentPage.get() > 0;
  },

  hasNextPage: function() {
    const countDoc = UserCounts.findOne('filtered') as any;
    if (!countDoc) return false;
    const totalPages = Math.ceil(countDoc.count / USERS_PER_PAGE);
    return (Template.instance() as any).currentPage.get() < totalPages - 1;
  },

  // Return disabled attribute object for Blaze (can't use {{#unless}} in attributes)
  prevPageAttrs: function() {
    const hasPrev = (Template.instance() as any).currentPage.get() > 0;
    return hasPrev ? {} : { disabled: true };
  },

  nextPageAttrs: function() {
    const countDoc = UserCounts.findOne('filtered') as any;
    if (!countDoc) return { disabled: true };
    const totalPages = Math.ceil(countDoc.count / USERS_PER_PAGE);
    const hasNext = (Template.instance() as any).currentPage.get() < totalPages - 1;
    return hasNext ? {} : { disabled: true };
  },

  showingUsersText: function() {
    const instance = Template.instance() as any;
    const page = instance.currentPage.get();
    const countDoc = UserCounts.findOne('filtered') as any;
    const total = countDoc ? countDoc.count : 0;
    const start = total > 0 ? page * USERS_PER_PAGE + 1 : 0;
    const end = Math.min((page + 1) * USERS_PER_PAGE, total);
    return userAdminText('admin.showingUsers', {
      start: formatActiveInterfaceNumber(start),
      end: formatActiveInterfaceNumber(end),
      total: formatActiveInterfaceNumber(total),
    });
  },

  pageOfText: function() {
    const instance = Template.instance() as any;
    const countDoc = UserCounts.findOne('filtered') as any;
    const totalPages = countDoc ? Math.ceil(countDoc.count / USERS_PER_PAGE) || 1 : 1;
    return userAdminText('admin.pageOf', { page: instance.currentPage.get() + 1, total: totalPages });
  },

});

Template.userAdminTable.helpers({
  userAdminText: function(key: Parameters<typeof translatePlatformString>[1]) {
    return userAdminText(key);
  },

  userAdminTableColumnCount: function(canManageUsers: boolean) {
    return canManageUsers ? 10 : 9;
  },

  roleTogglesLabel: function(user: any) {
    const target = rowTargetLabel(user);
    const label = userAdminText('admin.roleToggles');
    return target ? `${label}: ${target}` : label;
  },

  roleToggleLabel: function(key: Parameters<typeof translatePlatformString>[1], user: any) {
    return rowActionLabel(key, user);
  },

  deleteUserActionLabel: function(user: any) {
    return rowActionLabel('admin.deleteUser', user);
  },

  deleteUserConfirmationOpen: function(userId: string) {
    return Template.instance().data?.selectedDeleteUser?.userId === userId;
  },

  deleteUserConfirmationView: function(userId: string) {
    const data = Template.instance().data;
    return data?.selectedDeleteUser?.userId === userId ? data.deleteConfirmationView : null;
  },

  hasUserRowFeedback: function(userId: string) {
    const data = Template.instance().data;
    const states = data?.rowCommandStates as UserRowCommandStates | undefined;
    return Boolean(
      data?.selectedDeleteUser?.userId === userId
      || rowCommandPresentation(states?.[roleCommandScope(userId)], userAdminText('common.loading'))
      || rowCommandPresentation(states?.[deleteCommandScope(userId)], userAdminText('common.loading'))
    );
  },

  roleCommandFeedback: function(userId: string) {
    const states = Template.instance().data?.rowCommandStates as UserRowCommandStates | undefined;
    return rowCommandPresentation(
      states?.[roleCommandScope(userId)],
      userAdminText('common.loading'),
      `user-role-feedback-${userId}`,
    );
  },

  deleteCommandFeedback: function(userId: string) {
    const states = Template.instance().data?.rowCommandStates as UserRowCommandStates | undefined;
    return rowCommandPresentation(
      states?.[deleteCommandScope(userId)],
      userAdminText('common.loading'),
      `user-delete-feedback-${userId}`,
    );
  },

  roleActionAttrs: function(userId: string) {
    const states = Template.instance().data?.rowCommandStates as UserRowCommandStates | undefined;
    const pending = states?.[roleCommandScope(userId)]?.status === 'pending';
    const hasFeedback = states?.[roleCommandScope(userId)]?.status !== undefined
      && states?.[roleCommandScope(userId)]?.status !== 'idle';
    return {
      ...(pending ? { disabled: true } : {}),
      'aria-busy': pending ? 'true' : 'false',
      ...(hasFeedback ? { 'aria-describedby': `user-role-feedback-${userId}` } : {}),
    };
  },

  deleteActionAttrs: function(userId: string) {
    const data = Template.instance().data;
    const states = data?.rowCommandStates as UserRowCommandStates | undefined;
    const state = states?.[deleteCommandScope(userId)];
    const pending = state?.status === 'pending';
    const expanded = data?.selectedDeleteUser?.userId === userId;
    return {
      ...(pending ? { disabled: true } : {}),
      'aria-busy': pending ? 'true' : 'false',
      ...(expanded ? {
        'aria-controls': `user-delete-confirmation-${userId}`,
        'aria-expanded': 'true',
      } : {}),
      ...(state?.status && state.status !== 'idle'
        ? { 'aria-describedby': `user-delete-feedback-${userId}` }
        : {}),
    };
  },

});

Template.userAdminSortableHeader.helpers({
  sortAria: function(field: string) {
    if (this.sortField !== field) {
      return 'none';
    }
    return this.sortDirection === 'desc' ? 'descending' : 'ascending';
  },

  sortIndicator: function(field: string) {
    if (this.sortField !== field) {
      return '';
    }
    return this.sortDirection === 'desc' ? 'v' : '^';
  },
});

Template.userAdmin.events({
  'input #filter': function(event: any, instance: any) {
    event.preventDefault();
    const value = event.target.value;

    // Debounce filter changes to avoid excessive re-subscriptions
    if (instance.filterDebounceTimer) {
      clearTimeout(instance.filterDebounceTimer);
    }

    instance.filterDebounceTimer = setTimeout(() => {
      instance.filter.set(value);
      instance.currentPage.set(0); // Reset to first page on filter change
      instance.usageRefreshMessage.set('');
      instance.newsEmailMessage.set('');
    }, 300);
  },

  'click .user-admin-sort-button': function(event: any, instance: any) {
    event.preventDefault();
    const sortField = legacyTrim((event.currentTarget as HTMLElement).dataset.sortfield);
    if (!sortField) {
      return;
    }
    if (instance.sortField.get() === sortField) {
      instance.sortDirection.set(instance.sortDirection.get() === 'asc' ? 'desc' : 'asc');
    } else {
      instance.sortField.set(sortField);
      instance.sortDirection.set(sortField === 'identifier' ? 'asc' : 'desc');
    }
  },

  'click #prevPage': function(event: any, instance: any) {
    event.preventDefault();
    const current = instance.currentPage.get();
    if (current > 0) {
      instance.currentPage.set(current - 1);
      instance.usageRefreshMessage.set('');
      instance.newsEmailMessage.set('');
    }
  },

  'click #nextPage': function(event: any, instance: any) {
    event.preventDefault();
    const countDoc = UserCounts.findOne('filtered') as any;
    if (!countDoc) return;

    const totalPages = Math.ceil(countDoc.count / USERS_PER_PAGE);
    const current = instance.currentPage.get();

    if (current < totalPages - 1) {
      instance.currentPage.set(current + 1);
      instance.usageRefreshMessage.set('');
      instance.newsEmailMessage.set('');
    }
  },

  'click #composeNewsEmail': async function(event: any, instance: any) {
    event.preventDefault();
    instance.isPreparingNewsEmail.set(true);
    instance.newsEmailMessageType.set('info');
    instance.newsEmailMessage.set(userAdminText('admin.preparingNewsEmailRecipients'));

    try {
      const result = await MeteorCompat.callAsync('userAdminNewsEmailRecipients');
      const emails = Array.isArray(result?.emails)
        ? result.emails.filter((email: unknown): email is string => typeof email === 'string' && email.includes('@'))
        : [];

      if (emails.length === 0) {
        instance.newsEmailMessageType.set('warning');
        instance.newsEmailMessage.set(userAdminText('admin.noUserEmailsFound'));
        return;
      }

      window.location.href = buildNewsEmailMailto(emails);
      instance.newsEmailMessageType.set('success');
      instance.newsEmailMessage.set(userAdminText('admin.openedNewsEmailCompose', { count: emails.length }));
    } catch (error: unknown) {
      instance.newsEmailMessageType.set('danger');
      instance.newsEmailMessage.set(userAdminText('admin.prepareNewsEmailFailed', { error: getErrorMessage(error) }));
    } finally {
      instance.isPreparingNewsEmail.set(false);
    }
  },

  'click #refreshUsageCaches': async function(event: any, instance: any) {
    event.preventDefault();
    const userIds = getPagedUserIds();
    if (userIds.length === 0) {
      instance.usageRefreshMessageType.set('warning');
      instance.usageRefreshMessage.set(userAdminText('admin.noUsersToRefresh'));
      return;
    }

    instance.isRefreshingUsage.set(true);
    instance.usageRefreshMessageType.set('info');
    instance.usageRefreshMessage.set(userAdminText('admin.refreshingUsageCaches', { count: userIds.length }));

    try {
      const result = await MeteorCompat.callAsync('refreshUserAdminUsageCaches', userIds);
      const refreshedCount = Array.isArray(result?.refreshed) ? result.refreshed.length : 0;
      const failedCount = Array.isArray(result?.failed) ? result.failed.length : 0;
      if (failedCount > 0) {
        instance.usageRefreshMessageType.set('warning');
        instance.usageRefreshMessage.set(userAdminText('admin.refreshedUsersSomeFailed', {
          refreshed: refreshedCount,
          failed: failedCount,
          userId: result.failed[0].userId,
          error: result.failed[0].error,
        }));
      } else {
        instance.usageRefreshMessageType.set('success');
        instance.usageRefreshMessage.set(userAdminText('admin.refreshedUsageCaches', { count: refreshedCount }));
      }
    } catch (error: unknown) {
      instance.usageRefreshMessageType.set('danger');
      instance.usageRefreshMessage.set(userAdminText('admin.refreshUsageCachesFailed', { error: getErrorMessage(error) }));
    } finally {
      instance.isRefreshingUsage.set(false);
    }
  },

  'click #saveAdminOpenRouterAlternative': async function(event: any, instance: any) {
    event.preventDefault();
    const apiKeyInput = document.getElementById('adminOpenRouterKey') as HTMLInputElement | null;
    await saveAdminOpenRouterSelection(instance, apiKeyInput);
  },

  'change #adminOpenRouterModel': async function(event: any, instance: any) {
    instance.openRouterSelectedModel.set(String((event.currentTarget as HTMLSelectElement).value || ''));
    syncAdminReasoningSelectionForModel(instance);
    await saveAdminOpenRouterSelection(instance);
  },

  'change #adminOpenRouterReasoningLevel': async function(event: any, instance: any) {
    instance.openRouterSelectedReasoningLevel.set(normalizeOpenRouterReasoningLevel(
      (event.currentTarget as HTMLSelectElement).value,
      'Admin OpenRouter reasoning level',
    ));
    await saveAdminOpenRouterSelection(instance);
  },

  'change #adminOpenRouterReasoningEnabled': async function(event: any, instance: any) {
    instance.openRouterSelectedReasoningLevel.set(
      (event.currentTarget as HTMLInputElement).checked ? 'default' : 'none',
    );
    await saveAdminOpenRouterSelection(instance);
  },

  'change #adminOpenRouterPrefixCachingEnabled': async function(event: any, instance: any) {
    instance.openRouterPrefixCachingEnabled.set(
      (event.currentTarget as HTMLInputElement).checked,
    );
    await saveAdminOpenRouterSelection(instance);
  },

  'click .btn-admin-api-key-save': async function(event: any, instance: any) {
    event.preventDefault();
    const provider = legacyTrim($(event.currentTarget).data('provider'));
    const inputSelector = legacyTrim($(event.currentTarget).data('input'));
    const input = inputSelector ? document.querySelector(inputSelector) as HTMLInputElement | null : null;
    setApiKeyFeedback(instance, provider, {
      variant: 'info', text: userAdminText('admin.savingApiKeyAlternative'),
    });
    await instance.apiKeyCommandRegistry.run(apiKeyCommandScope(provider), async () => {
      const result = await MeteorCompat.callAsync('saveAdminApiKeyAlternative', provider, {
        apiKey: input?.value || '',
      });
      instance.apiKeyMetadata.set(result);
      if (input) input.value = '';
    }, {
      getErrorMessage: (error: unknown) => userAdminText('admin.saveApiKeyAlternativeFailed', { error: getErrorMessage(error) }),
      onSuccess: () => setApiKeyFeedback(instance, provider, {
        variant: 'success', text: userAdminText('admin.savedApiKeyAlternative'),
      }),
      onFailure: (error: unknown) => setApiKeyFeedback(instance, provider, {
        variant: 'error', text: userAdminText('admin.saveApiKeyAlternativeFailed', { error: getErrorMessage(error) }),
      }),
    });
  },

  'click .btn-admin-api-key-delete': async function(event: any, instance: any) {
    event.preventDefault();
    const provider = legacyTrim($(event.currentTarget).data('provider'));
    setApiKeyFeedback(instance, provider, {
      variant: 'info', text: userAdminText('admin.deletingApiKeyAlternative'),
    });
    await instance.apiKeyCommandRegistry.run(apiKeyCommandScope(provider), async () => {
      const result = await MeteorCompat.callAsync('deleteAdminApiKeyAlternative', provider);
      instance.apiKeyMetadata.set(result);
      const inputId = provider === 'openrouter'
        ? 'adminOpenRouterKey'
        : provider === 'googleTts'
          ? 'adminGoogleTtsKey'
          : 'adminGoogleSpeechKey';
      const input = document.getElementById(inputId) as HTMLInputElement | null;
      if (input) input.value = '';
    }, {
      getErrorMessage: (error: unknown) => userAdminText('admin.deleteApiKeyAlternativeFailed', { error: getErrorMessage(error) }),
      onSuccess: () => setApiKeyFeedback(instance, provider, {
        variant: 'success', text: userAdminText('admin.deletedApiKeyAlternative'),
      }),
      onFailure: (error: unknown) => setApiKeyFeedback(instance, provider, {
        variant: 'error', text: userAdminText('admin.deleteApiKeyAlternativeFailed', { error: getErrorMessage(error) }),
      }),
    });
  },

  'click #doUploadUsers': function(event: any) {
    event.preventDefault();
    doFileUpload('#upload-users', 'USERS', Template.instance());
  },

  'change #upload-users': function(event: any) {
    const input = $(event.currentTarget);
    $('#users-file-info').html(input.val());
  },

  // Need admin and teacher buttons
  'click .btn-user-change': async function(event: any, instance: any) {
    event.preventDefault();

    const btnTarget = $(event.currentTarget);
    const userId = legacyTrim(btnTarget.data('userid'));
    const roleAction = legacyTrim(btnTarget.data('roleaction'));
    const roleName = legacyTrim(btnTarget.data('rolename'));

    

    await instance.rowCommandRegistry.run(
      roleCommandScope(userId),
      async () => {
        const result = await MeteorCompat.callAsync('userAdminRoleChange', userId, roleAction, roleName);
        applyConfirmedRoleState(instance, result as UserAdminRoleChangeResult);
        return { message: userAdminText('admin.updatedRoleForUser', { role: roleName }) };
      },
      { getErrorMessage: (error: unknown) => userAdminText('admin.requestFailed', { error: getErrorMessage(error) }) },
    );
  },

  'click .btn-user-delete': function(event: any, instance: any) {
    event.preventDefault();

    const btnTarget = $(event.currentTarget);
    const userId = legacyTrim(btnTarget.data('userid'));
    const displayIdentifier = legacyTrim(btnTarget.data('displayidentifier'));
    instance.selectedDeleteUser.set({ userId, displayIdentifier });
    instance.deleteConfirmationController.open({
      confirmationId: `user-delete-confirmation-${userId}`,
      title: userAdminText('admin.deleteUser'),
      message: userAdminText('admin.deleteUserMessage', { identifier: displayIdentifier }),
      confirmLabel: userAdminText('admin.deleteUser'),
      cancelLabel: userAdminText('content.cancel'),
      severity: 'danger',
      context: { userId, displayIdentifier },
    }, event.currentTarget as HTMLElement);
    Tracker.afterFlush(() => instance.deleteConfirmationController.focusInitial());
  },

  'click .admin-confirmation-cancel': function(event: any, instance: any) {
    event.preventDefault();
    instance.deleteConfirmationController.cancel();
  },

  'keydown .admin-inline-confirmation': function(event: KeyboardEvent, instance: any) {
    instance.deleteConfirmationController.handleKeydown(event);
  },

  'click .admin-confirmation-confirm': async function(event: any, instance: any) {
    event.preventDefault();
    const context = instance.deleteConfirmationController.getContext();
    const userId = legacyTrim(context?.userId);
    if (!userId || instance.deleteConfirmationController.getView().pending) return;
    instance.deleteConfirmationController.setPending(true);

    await instance.rowCommandRegistry.run(
      deleteCommandScope(userId),
      async () => {
        await MeteorCompat.callAsync('userAdminDeleteUser', userId);
        return { message: userAdminText('admin.userDeleted') };
      },
      {
        getErrorMessage: (error: unknown) => userAdminText('admin.deleteUserFailed', { error: getErrorMessage(error) }),
        onSuccess: () => {
          instance.deleteConfirmationController.complete();
          instance.userListMessageType.set('success');
          instance.userListMessage.set(userAdminText('admin.userDeleted'));
          instance.rowCommandRegistry.remove(deleteCommandScope(userId));
          instance.rowCommandRegistry.remove(roleCommandScope(userId));
          Tracker.afterFlush(() => document.querySelector<HTMLElement>('.user-admin-sort-button, #prevPage, #nextPage')?.focus());
        },
        onFailure: () => instance.deleteConfirmationController.setPending(false),
      },
    );
  },

    
  });

async function doFileUpload(fileElementSelector: string, fileDescrip: string, instance: any): Promise<void> {
  _.each($(fileElementSelector).prop('files'), function(file: any) {
    const name = file.name;
    const fileReader = new FileReader();

    fileReader.onload = async function() {
      

      try {
        const result = await MeteorCompat.callAsync('insertNewUsers', name, fileReader.result);
        
        if (result.length > 0) {
          instance.importMessageType.set('danger');
          instance.importMessage.set(userAdminText('admin.userFileNotSaved', { fileDescription: fileDescrip, error: JSON.stringify(result) }));
        } else {
          instance.importMessageType.set('success');
          instance.importMessage.set(userAdminText('admin.userFileSaved', { fileDescription: fileDescrip }));
          // Now we can clear the selected file
          $(fileElementSelector).val('');
          $(fileElementSelector).parent().find('.file-info').html('');
          // No need to manually refresh - Meteor reactivity handles it automatically!
        }
      } catch (error: unknown) {
        instance.importMessageType.set('danger');
        instance.importMessage.set(userAdminText('admin.userFileCriticalSaveFailed', { fileDescription: fileDescrip, error: getErrorMessage(error) }));
      }
    };

    fileReader.readAsBinaryString(file);
  });

  
}







