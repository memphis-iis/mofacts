import { initializeLearnerSettingsHost, destroyLearnerSettingsHost, learnerSettingsEvents, flushLearnerSettings, type LearnerConfigState } from '../shared/learnerTdfSettings';
import { getLearnerTdfConfig, learnerConfigHasSetSpecAudioOverride } from '../../lib/learnerSettings';
import type { LearnerTdfConfig } from '../../../common/lib/learnerTdfConfig';
import {ReactiveVar} from 'meteor/reactive-var';
import './learningDashboard.html';
import './learningDashboard.css';
import '../shared/adminUi/adminUi';
import {getExperimentState} from '../experiment/svelte/services/experimentState';
import {meteorCallAsync, clientConsole} from '../..';
import {sessionCleanUp} from '../../lib/sessionUtils';
import {checkUserSession} from '../../lib/userSessionHelpers';
import { DelayedLoadingVisibility } from '../../lib/delayedLoadingVisibility';
const { FlowRouter } = require('meteor/ostrio:flow-router-extra');
import {
  setAudioPromptMode, setAudioPromptFeedbackView,
  setAudioEnabledView, setAudioEnabled,
  setAudioPromptFeedbackSpeakingRate, setAudioPromptQuestionSpeakingRate,
  setAudioPromptFeedbackSpeakingRateView, setAudioPromptQuestionSpeakingRateView,
  setAudioPromptVoice, setAudioPromptFeedbackVoice,
  setAudioPromptVoiceView, setAudioPromptFeedbackVoiceView,
  setAudioInputSensitivity, setAudioInputSensitivityView,
  setAudioPromptQuestionVolume, setAudioPromptFeedbackVolume
} from '../../lib/state/audioState';
import { getAudioLaunchPreparationPlan, prepareAudioForLaunchIfNeeded } from '../../lib/audioStartup';
import { unlockAppleMobileAudioForUserGesture } from '../../lib/audioUnlock';
import { shouldLockMultiTdfLaunchToCurrentUnit } from '../../lib/lessonLaunchLockPolicy';
import { formatItemsPracticed } from './practiceMetrics';
import { CARD_ENTRY_INTENT, setCardEntryIntent, type CardEntryIntent } from '../../lib/cardEntryIntent';
import { prepareLessonLaunchContext } from '../../lib/lessonLaunchInitializer';
import { resolvePracticeTtsIndicatorState } from './practiceAudioIndicators';
import {
  finishLaunchLoading,
  markLaunchLoadingTiming,
  setLaunchLoadingMessage,
  startLaunchLoading,
} from '../../lib/launchLoading';
import { getActiveUiLocale } from '../../lib/interfaceLocaleState';
import { translatePlatformString } from '../../lib/interfaceI18n';
import { formatActiveInterfaceDateTime } from '../../lib/interfaceFormatting';
import { getUserInitials } from '../../lib/userIdentity';
import {
  findProfileAvatarIcon,
  type ProfileAvatarType,
} from '../../../common/profileAvatar';
import { clearPracticeLaunchMode, setPracticeLaunchMode } from '../../lib/practiceLaunchMode';
import { buildActiveLessonRouteLocation } from '../../lib/activeLessonRoute';

declare const Template: any;
declare const Meteor: any;
declare const Session: any;
declare const $: any;

const PRACTICE_DASHBOARD_SNAPSHOT_VERSION = 4;
const PRACTICE_DASHBOARD_SEARCH_VERSION = 1;
const PRACTICE_TABLE_STATISTICS_PREFERENCE_KEY = 'practiceTableStatisticsExpanded';
const LESSON_COMMAND_FEEDBACK_SESSION_KEY = 'learningDashboardLessonCommandFeedback';

type LessonCommandFeedback = Readonly<{
  text: string;
  variant: 'info' | 'success' | 'warning' | 'error';
  urgent: boolean;
}>;

function lessonCommandFeedbackMap(): Record<string, LessonCommandFeedback> {
  const value = Session.get(LESSON_COMMAND_FEEDBACK_SESSION_KEY);
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function setLessonCommandFeedback(
  tdfId: string,
  text: string,
  variant: LessonCommandFeedback['variant'] = 'error',
): void {
  Session.set(LESSON_COMMAND_FEEDBACK_SESSION_KEY, {
    ...lessonCommandFeedbackMap(),
    [tdfId]: { text, variant, urgent: variant === 'error' },
  });
}

function clearLessonCommandFeedback(tdfId: string): void {
  const next = { ...lessonCommandFeedbackMap() };
  delete next[tdfId];
  Session.set(LESSON_COMMAND_FEEDBACK_SESSION_KEY, next);
}

function withLessonCommandFeedback(tdfs: any[]): any[] {
  const feedback = lessonCommandFeedbackMap();
  return tdfs.map((tdf) => ({ ...tdf, launchFeedback: feedback[String(tdf.TDFId)] || null }));
}

type PracticeDashboardCreator = {
  displayName: string;
  avatarType: ProfileAvatarType;
  avatarIconId: string | null;
  avatarImageData: string | null;
};

type PracticeDashboardSnapshot = {
  version: number;
  userId: string;
  generatedAt: number;
  creators: PracticeDashboardCreator[];
  lessons: any[];
};

function dashboardSnapshotStorageKey(userId: string) {
  if (!userId) {
    throw new Error('[LearningDashboard] Cannot build dashboard snapshot key without a user id');
  }
  return `mofacts.practiceDashboardSnapshot.v${PRACTICE_DASHBOARD_SNAPSHOT_VERSION}.${userId}`;
}

function dashboardSearchStorageKey(userId: string) {
  if (!userId) {
    throw new Error('[LearningDashboard] Cannot build dashboard search key without a user id');
  }
  return `mofacts.practiceDashboardSearch.v${PRACTICE_DASHBOARD_SEARCH_VERSION}.${userId}`;
}

function getPracticeDashboardUserId() {
  return String(Session.get('curStudentID') || Meteor.userId() || '');
}

function loadPracticeDashboardSearch(userId: string) {
  if (typeof window === 'undefined' || !window.localStorage) {
    return '';
  }
  const raw = window.localStorage.getItem(dashboardSearchStorageKey(userId));
  return raw === null ? '' : raw;
}

function savePracticeDashboardSearch(userId: string, search: string) {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  window.localStorage.setItem(dashboardSearchStorageKey(userId), search);
}

function applyLearningDashboardSearch(instance: any, search: string) {
  const normalizedSearch = String(search || '');
  instance.searchQuery.set(normalizedSearch);

  if (normalizedSearch.length === 0) {
    instance.searching.set(false);
    instance.filteredTdfsList.set(false);
    return;
  }

  const searchLower = normalizedSearch.toLowerCase();
  const filteredTdfs = instance.allTdfsList.get().filter((tdf: any) => {
    if (tdf.displayName.toLowerCase().includes(searchLower)) {
      return true;
    }
    if (String(tdf.creatorDisplayName || '').toLowerCase().includes(searchLower)) {
      return true;
    }
    return Boolean(tdf.tags && tdf.tags.some((tag: any) => tag.toLowerCase().includes(searchLower)));
  });

  instance.searching.set(true);
  instance.filteredTdfsList.set(filteredTdfs);
}

function loadLocalPracticeDashboardSnapshot(userId: string): PracticeDashboardSnapshot | null {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }
  const raw = window.localStorage.getItem(dashboardSnapshotStorageKey(userId));
  if (!raw) {
    return null;
  }
  const snapshot = JSON.parse(raw) as PracticeDashboardSnapshot;
  if (
    snapshot?.version !== PRACTICE_DASHBOARD_SNAPSHOT_VERSION ||
    snapshot.userId !== userId ||
    !Array.isArray(snapshot.creators) ||
    !Array.isArray(snapshot.lessons)
  ) {
    throw new Error('[LearningDashboard] Local practice dashboard snapshot has an invalid shape');
  }
  return snapshot;
}

function saveLocalPracticeDashboardSnapshot(snapshot: PracticeDashboardSnapshot) {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  const localSnapshot: PracticeDashboardSnapshot = {
    ...snapshot,
    creators: snapshot.creators.map((creator) => ({
      ...creator,
      avatarType: creator.avatarType === 'image' ? 'initials' : creator.avatarType,
      avatarImageData: null,
    })),
  };
  window.localStorage.setItem(dashboardSnapshotStorageKey(snapshot.userId), JSON.stringify(localSnapshot));
}

function formatSnapshotLesson(lesson: any, creators: PracticeDashboardCreator[]) {
  const lastPracticeTimestamp = Number(lesson.lastPracticeTimestamp || lesson.progress?.lastPracticedTimestamp || 0);
  const isUsed = Boolean(lesson.isUsed || Number(lesson.progress?.attempts || 0) > 0);
  const creator = Number.isInteger(lesson.creatorIndex)
    ? creators[lesson.creatorIndex]
    : null;
  const creatorDisplayName = typeof creator?.displayName === 'string'
    ? creator.displayName.trim() || null
    : null;
  const creatorAvatarIcon = creator?.avatarType === 'icon'
    ? findProfileAvatarIcon(creator.avatarIconId)
    : null;
  const creatorAvatarImageData = creator?.avatarType === 'image' && typeof creator.avatarImageData === 'string'
    ? creator.avatarImageData
    : null;
  return {
    ...lesson,
    creatorDisplayName,
    creatorAvatarImageData,
    creatorAvatarIsImage: Boolean(creatorAvatarImageData),
    creatorAvatarIsIcon: Boolean(creatorAvatarIcon),
    creatorAvatarIconClass: creatorAvatarIcon?.className || null,
    creatorAvatarInitials: creatorDisplayName
      ? getUserInitials({ profile: { displayName: creatorDisplayName } }, '?')
      : '',
    isUsed,
    hasBeenAttempted: Boolean(lesson.hasBeenAttempted || isUsed),
    totalTrials: lesson.totalTrials ?? lesson.progress?.attempts,
    overallAccuracy: lesson.overallAccuracy ?? lesson.progress?.accuracy,
    accuracyApplies: lesson.accuracyApplies ?? lesson.progress?.accuracyApplies,
    totalTimeMinutes: lesson.totalTimeMinutes ?? lesson.progress?.totalTimeMinutes,
    itemsPracticed: lesson.itemsPracticed ?? lesson.progress?.itemsPracticed,
    itemsPracticedApplies: lesson.itemsPracticedApplies ?? lesson.progress?.itemsPracticedApplies,
    totalPracticeItems: lesson.totalPracticeItems ?? lesson.progress?.totalPracticeItems,
    lastPracticeTimestamp: Number.isFinite(lastPracticeTimestamp) ? lastPracticeTimestamp : 0,
    lastPracticeDate: lesson.lastPracticeDate || (lesson.progress?.lastPracticed
      ? formatActiveInterfaceDateTime(lesson.progress.lastPracticed, { dateStyle: 'medium' })
      : undefined),
    totalSessions: lesson.totalSessions ?? lesson.progress?.sessionDays,
    tags: Array.isArray(lesson.tags) ? lesson.tags : [],
    conditions: Array.isArray(lesson.conditions) && lesson.conditions.length > 0 ? lesson.conditions : null,
    languageMetadataRows: buildDashboardLanguageMetadataRows(lesson),
  };
}

function dashboardText(key: Parameters<typeof translatePlatformString>[1], values?: Parameters<typeof translatePlatformString>[2]): string {
  return translatePlatformString(getActiveUiLocale(), key, values);
}

function dashboardTranslationStatusText(status: string): string {
  if (status === 'author-provided') return dashboardText('manualCreator.translationStatusAuthorProvided');
  if (status === 'not-translated') return dashboardText('manualCreator.translationStatusNotTranslated');
  if (status === 'draft') return dashboardText('manualCreator.translationStatusDraft');
  if (status === 'reviewed') return dashboardText('manualCreator.translationStatusReviewed');
  return status;
}

function buildDashboardLanguageMetadataRows(lesson: any): Array<{ label: string; value: string }> {
  const rows: Array<{ label: string; value: string }> = [];
  const contentLanguage = String(lesson?.contentLanguage || lesson?.setspec?.contentLanguage || '').trim();
  const recommendedUiLocales = Array.isArray(lesson?.recommendedUiLocales)
    ? lesson.recommendedUiLocales.map((locale: unknown) => String(locale || '').trim()).filter(Boolean)
    : Array.isArray(lesson?.setspec?.recommendedUiLocales)
      ? lesson.setspec.recommendedUiLocales.map((locale: unknown) => String(locale || '').trim()).filter(Boolean)
      : [];
  const translationStatus = String(lesson?.translationStatus || lesson?.setspec?.translationStatus || '').trim();

  if (contentLanguage) rows.push({ label: dashboardText('manualCreator.contentLanguage'), value: contentLanguage });
  if (recommendedUiLocales.length > 0) {
    rows.push({ label: dashboardText('manualCreator.recommendedUiLocales'), value: recommendedUiLocales.join(', ') });
  }
  if (translationStatus) {
    rows.push({ label: dashboardText('manualCreator.translationStatus'), value: dashboardTranslationStatusText(translationStatus) });
  }
  return rows;
}

function applyPracticeDashboardSnapshot(instance: any, snapshot: PracticeDashboardSnapshot) {
  if (snapshot.userId) {
    const learnerConfigs: Record<string, LearnerTdfConfig> = {};
    for (const lesson of snapshot.lessons || []) {
      if (lesson?.TDFId && lesson.learnerConfig) {
        learnerConfigs[String(lesson.TDFId)] = lesson.learnerConfig;
      }
    }
    Session.set('learnerTdfConfigOverrides', learnerConfigs);
  }
  const rows = (snapshot.lessons || []).map((lesson) => formatSnapshotLesson(lesson, snapshot.creators || []));
  const { used, unused } = splitTdfsByUsage(rows);
  const combinedTdfs = [...used, ...unused];
  Session.set('homeHasPracticeRecords', used.length > 0);
  instance.allTdfsList.set(combinedTdfs);
  applyLearningDashboardSearch(instance, instance.searchQuery.get());
  instance.isLoading.set(false);
  instance.loadingVisibility.setPending(false);
}

function getVisibleTdfs(instance: any) {
  const filtered = instance.filteredTdfsList.get();
  return filtered || instance.allTdfsList.get();
}

function sortUsedTdfsByRecency(tdfs: any[]) {
  return tdfs.sort((a, b) =>
    (b.lastPracticeTimestamp || 0) - (a.lastPracticeTimestamp || 0)
  );
}

function sortUnusedTdfsByName(tdfs: any[]) {
  return tdfs.sort((a, b) =>
    a.displayName.localeCompare(b.displayName, getActiveUiLocale(), {
      numeric: true,
      sensitivity: 'base'
    })
  );
}

function splitTdfsByUsage(tdfs: any[]) {
  return {
    used: sortUsedTdfsByRecency(tdfs.filter(tdf => tdf.isUsed)),
    unused: sortUnusedTdfsByName(tdfs.filter(tdf => !tdf.isUsed))
  };
}

function clearLessonProgressStats(tdf: any, affectedTdfIds: Set<string>) {
  if (!affectedTdfIds.has(String(tdf.TDFId))) {
    return tdf;
  }

  return {
    ...tdf,
    isUsed: false,
    hasBeenAttempted: false,
    totalTrials: undefined,
    overallAccuracy: undefined,
    accuracyApplies: undefined,
    totalTimeMinutes: undefined,
    itemsPracticed: undefined,
    lastPracticeTimestamp: undefined,
    lastPracticeDate: undefined,
    totalSessions: undefined
  };
}

function applyProgressResetToDashboardList(list: any[] | false, cacheTdfIds: string[]) {
  if (!Array.isArray(list)) {
    return list;
  }
  const affectedTdfIds = new Set(cacheTdfIds.map((id) => String(id)));
  const nextList = list.map((tdf) => clearLessonProgressStats(tdf, affectedTdfIds));
  const { used, unused } = splitTdfsByUsage(nextList);
  return [...used, ...unused];
}

function displayLabelForTdf(tdf: any) {
  return tdf.displayName;
}

function configForLessonCard(tdf: any) {
  const templateData = Template.parentData(1) as { learnerConfigState?: LearnerConfigState } | undefined;
  const state = templateData?.learnerConfigState;
  return shouldShowSettingsButton(tdf) && state?.tdfId === tdf.TDFId ? { ...state, location: 'card' } : null;
}

function configForLessonTable(tdf: any) {
  const templateData = Template.parentData(1) as { learnerConfigState?: LearnerConfigState } | undefined;
  const state = templateData?.learnerConfigState;
  return shouldShowSettingsButton(tdf) && state?.tdfId === tdf.TDFId ? { ...state, location: 'table' } : null;
}

function shouldShowSettingsButton(tdf: any): boolean {
  return Boolean(tdf.hasConfigurableSettings);
}

function parseBooleanLike(value: unknown): boolean {
  return value === true || value === 'true' || value === 1 || value === '1';
}

function getEffectiveSetSpecValue(tdf: any, key: 'audioInputEnabled' | 'audioPromptMode') {
  const override = getLearnerTdfConfig(String(tdf?.TDFId || ''))?.overrides?.setspec?.[key];
  return override !== undefined ? override : tdf?.[key];
}

function getUserAudioSettings() {
  return (Meteor.user() as any)?.audioSettings || {};
}

function getEffectiveTtsState(tdf: any) {
  const tdfId = String(tdf?.TDFId || '');
  const promptModeOverride = learnerConfigHasSetSpecAudioOverride(tdfId, 'audioPromptMode');
  const lessonPromptMode = getEffectiveSetSpecValue(tdf, 'audioPromptMode');
  const runtimePromptMode = promptModeOverride
    ? lessonPromptMode
    : getUserAudioSettings().audioPromptMode;
  return resolvePracticeTtsIndicatorState({
    lessonPromptMode,
    runtimePromptMode,
    keyAvailable: tdf?.hasTTSAPIKey === true,
  });
}

function getEffectiveSrState(tdf: any) {
  const tdfId = String(tdf?.TDFId || '');
  const tdfAudioEnabled = parseBooleanLike(getEffectiveSetSpecValue(tdf, 'audioInputEnabled'));
  const userAudioEnabled = getUserAudioSettings().audioInputMode === true;
  const keyAvailable = tdf?.hasSpeechAPIKey === true;
  const supported = parseBooleanLike(tdf?.audioInputEnabled) ||
    learnerConfigHasSetSpecAudioOverride(tdfId, 'audioInputEnabled');

  return {
    supported,
    active: supported && tdfAudioEnabled && userAudioEnabled && keyAvailable,
    tdfAudioEnabled,
    userAudioEnabled,
    keyAvailable,
  };
}

const lessonRowHelpers = {
  displayLabel(this: any): string {
    return displayLabelForTdf(this);
  },

  firstContentUnitIconClass(this: any): string {
    switch (this.firstContentUnitType) {
      case 'video':
        return 'fa-play-circle';
      case 'autotutor':
        return 'fa-comments';
      case 'assessment':
        return 'fa-question-circle';
      case 'learning':
        return 'fa-clone';
      case 'sparc':
        return 'fa-sitemap';
      case 'conditionPool':
        return 'fa-random';
      default:
        return '';
    }
  },

  firstContentUnitIconTitle(this: any): string {
    switch (this.firstContentUnitType) {
      case 'video':
        return dashboardText('dashboard.firstUnitVideo');
      case 'autotutor':
        return dashboardText('dashboard.firstUnitAutotutor');
      case 'assessment':
        return dashboardText('dashboard.firstUnitAssessment');
      case 'learning':
        return dashboardText('dashboard.firstUnitLearning');
      case 'sparc':
        return dashboardText('dashboard.firstUnitSparc');
      case 'conditionPool':
        return dashboardText('dashboard.multipleConditionTdfs');
      default:
        return '';
    }
  },

  ttsIconClass(this: any): string {
    const state = getEffectiveTtsState(this);
    if (state.active) return 'icon-configured';
    return state.keyAvailable ? 'icon-disabled' : 'icon-needs-config';
  },

  srIconClass(this: any): string {
    const state = getEffectiveSrState(this);
    if (state.active) return 'icon-configured';
    return state.keyAvailable ? 'icon-disabled' : 'icon-needs-config';
  },

  ttsIconTitle(this: any): string {
    const state = getEffectiveTtsState(this);
    if (state.active) return dashboardText('dashboard.ttsEnabled');
    if (!state.keyAvailable) return dashboardText('dashboard.ttsNeedsApiKey');
    if (!state.runtimePromptModeEnabled) return dashboardText('dashboard.ttsTurnedOff');
    return dashboardText('dashboard.ttsUnavailable');
  },

  srIconTitle(this: any): string {
    const state = getEffectiveSrState(this);
    if (state.active) return dashboardText('dashboard.srEnabled');
    if (!state.keyAvailable) return dashboardText('dashboard.srNeedsApiKey');
    if (!state.userAudioEnabled) return dashboardText('dashboard.srTurnedOff');
    return dashboardText('dashboard.srUnavailable');
  },

  showTtsIcon(this: any): boolean {
    return getEffectiveTtsState(this).visible;
  },

  showSrIcon(this: any): boolean {
    return getEffectiveSrState(this).supported;
  },

  accuracyDisplay(this: any): string {
    if (!this.isUsed || this.accuracyApplies === false || this.overallAccuracy === null || this.overallAccuracy === undefined) {
      return '-';
    }
    return `${this.overallAccuracy}%`;
  },

  accuracyBarWidth(this: any): string {
    if (!this.isUsed || this.accuracyApplies === false || this.overallAccuracy === null || this.overallAccuracy === undefined) {
      return '0%';
    }
    const value = Math.max(0, Math.min(100, Number(this.overallAccuracy)));
    return `${Number.isFinite(value) ? value : 0}%`;
  },

  itemsPracticedDisplay(this: any): string {
    return formatItemsPracticed(this);
  },

  accuracyBadgeLabel(this: any): string {
    if (!this.isUsed) {
      return dashboardText('dashboard.new');
    }
    if (this.accuracyApplies === false || this.overallAccuracy === null || this.overallAccuracy === undefined) {
      return dashboardText('dashboard.used');
    }
    return `${this.overallAccuracy}%`;
  },

  timeMinutesDisplay(this: any): string {
    return dashboardText('courses.minutes', { minutes: this.totalTimeMinutes || 0 });
  },

  accuracyBadgeClass(this: any): string {
    if (!this.isUsed) {
      return 'bg-secondary';
    }
    return this.accuracyApplies === false || this.overallAccuracy === null || this.overallAccuracy === undefined
      ? 'bg-secondary'
      : 'bg-success';
  },

  showSettingsButton(this: any): boolean {
    return shouldShowSettingsButton(this);
  },
};

Template.learningDashboard.onCreated(function(this: any) {
  this.allTdfsList = new ReactiveVar([]);
  this.filteredTdfsList = new ReactiveVar(false);
  this.searching = new ReactiveVar(false);
  this.searchQuery = new ReactiveVar('');
  this.statisticsExpanded = new ReactiveVar(false);
  this.statisticsPreferenceRevision = 0;
  this.isLoading = new ReactiveVar(true);
  this.showLoadingFeedback = new ReactiveVar(false);
  this.showSlowLoading = new ReactiveVar(false);
  this.loadingVisibility = new DelayedLoadingVisibility({
    onVisibilityChange: (visible) => this.showLoadingFeedback.set(visible),
    onSlowChange: (slow) => this.showSlowLoading.set(slow),
  });
  this.loadingVisibility.setPending(true);
  this.subscriptions = [];
  this.autoruns = [];
  this.searchDebounceTimer = null;
  initializeLearnerSettingsHost(this, {
    onProgressReset: (tdfIds) => {
      this.allTdfsList.set(applyProgressResetToDashboardList(this.allTdfsList.get(), tdfIds));
      const filtered = this.filteredTdfsList.get();
      if (Array.isArray(filtered)) this.filteredTdfsList.set(applyProgressResetToDashboardList(filtered, tdfIds));
    },
  });
  Session.set(LESSON_COMMAND_FEEDBACK_SESSION_KEY, {});
});

Template.learningDashboard.helpers({
  isLoading: () => {
    return ((Template.instance() as any) as any).isLoading.get();
  },

  showLoadingFeedback: () => {
    return (Template.instance() as any).showLoadingFeedback.get();
  },

  showSlowLoading: () => {
    return (Template.instance() as any).showSlowLoading.get();
  },

  loadingShellBusy: () => {
    const instance = Template.instance() as any;
    return instance.isLoading.get() || instance.showLoadingFeedback.get();
  },

  searchQuery: () => {
    return Template.instance().searchQuery.get();
  },

  hasSearchQuery: () => {
    return Template.instance().searchQuery.get().length > 0;
  },

  statisticsExpanded: () => {
    return Template.instance().statisticsExpanded.get();
  },

  recentUsedTdf: () => {
    return withLessonCommandFeedback(splitTdfsByUsage(getVisibleTdfs(Template.instance())).used)[0] || null;
  },

  lessonSummaryText: () => {
    const visible = getVisibleTdfs(Template.instance());
    const { used, unused } = splitTdfsByUsage(visible);
    if (!visible || visible.length === 0) {
      return dashboardText('dashboard.noLessonsAvailable');
    }
    return dashboardText('dashboard.lessonSummary', {
      total: visible.length,
      inProgress: used.length,
      newCount: unused.length,
    });
  },

  hasTdfs: () => {
    const list = getVisibleTdfs(Template.instance());
    return list && list.length > 0;
  },

  usedTdfsList: () => {
    return withLessonCommandFeedback(splitTdfsByUsage(getVisibleTdfs(Template.instance())).used);
  },

  unusedTdfsList: () => {
    return withLessonCommandFeedback(splitTdfsByUsage(getVisibleTdfs(Template.instance())).unused);
  },

  hasUsedTdfs: () => {
    return splitTdfsByUsage(getVisibleTdfs(Template.instance())).used.length > 0;
  },

  hasUnusedTdfs: () => {
    return splitTdfsByUsage(getVisibleTdfs(Template.instance())).unused.length > 0;
  },

  learnerConfigState: () => {
    return ((Template.instance() as any) as any).learnerConfigState.get();
  },

  loadingRows: () => {
    return [0, 1, 2];
  },

  loadingRowsShort: () => {
    return [0, 1];
  },

  displayLabel(this: any): string {
    return displayLabelForTdf(this);
  },

  accuracyDisplay(this: any): string {
    return lessonRowHelpers.accuracyDisplay.call(this);
  },

  accuracyBarWidth(this: any): string {
    return lessonRowHelpers.accuracyBarWidth.call(this);
  },

  itemsPracticedDisplay(this: any): string {
    return lessonRowHelpers.itemsPracticedDisplay.call(this);
  },

});

Template.learningDashboardLessonTable.helpers({
  ...lessonRowHelpers,

  statisticsExpanded() {
    const data = Template.instance().data;
    return data.allowStatistics === true && data.statisticsExpanded === true;
  },

  statisticsTableClass() {
    const data = Template.instance().data;
    return data.allowStatistics === true && data.statisticsExpanded === true
      ? 'is-statistics-expanded'
      : 'is-statistics-collapsed';
  },

  tableColumnCount() {
    const data = Template.instance().data;
    return data.allowStatistics === true && data.statisticsExpanded === true ? 10 : 4;
  },

  configForTableRow() {
    return configForLessonTable(this);
  },
});

Template.learningDashboardLessonCards.helpers({
  ...lessonRowHelpers,

  configForCardRow() {
    return configForLessonCard(this);
  },
});

Template.learningDashboard.events({
  ...learnerSettingsEvents,
  'input #learningDashboardSearch': function(event: any, instance: any) {
    const search = String(event.target.value || '');
    const userId = getPracticeDashboardUserId();
    if (userId) {
      savePracticeDashboardSearch(userId, search);
    }
    instance.searchQuery.set(search);

    // Debounce search to avoid excessive filtering on every keystroke
    if (instance.searchDebounceTimer) {
      clearTimeout(instance.searchDebounceTimer);
    }

    instance.searchDebounceTimer = setTimeout(() => {
      applyLearningDashboardSearch(instance, search);
    }, 200); // 200ms debounce
  },

  'click .learning-dashboard-search-clear': function(event: any, instance: any) {
    event.preventDefault();
    const userId = getPracticeDashboardUserId();
    if (userId) {
      savePracticeDashboardSearch(userId, '');
    }
    if (instance.searchDebounceTimer) {
      clearTimeout(instance.searchDebounceTimer);
      instance.searchDebounceTimer = null;
    }
    applyLearningDashboardSearch(instance, '');
    instance.$('#learningDashboardSearch').trigger('focus');
  },

  'click .learning-dashboard-statistics-toggle': async function(event: any, instance: any) {
    event.preventDefault();
    instance.statisticsPreferenceRevision += 1;
    const wasExpanded = instance.statisticsExpanded.get();
    const isExpanded = !wasExpanded;
    instance.statisticsExpanded.set(isExpanded);

    try {
      await meteorCallAsync(
        'setUserPreference',
        PRACTICE_TABLE_STATISTICS_PREFERENCE_KEY,
        isExpanded,
      );
    } catch (error) {
      instance.statisticsExpanded.set(wasExpanded);
      clientConsole(1, '[Dashboard] Practice table statistics preference could not be saved:', error);
    }
  },

  'click .continue-lesson': async function(event: any) {
    event.preventDefault();
    unlockAppleMobileAudioForUserGesture();
    const target = $(event.currentTarget);
    await safeSelectTdf(
      target.data('tdfid'),
      target.data('lessonname'),
      target.data('currentstimulisetid'),
      null,
      null,
      'Continue from practice menu',
      target.data('ismultitdf'),
      null,
    );
  },

  'click .start-lesson': async function(event: any) {
    event.preventDefault();
    unlockAppleMobileAudioForUserGesture();
    const target = $(event.currentTarget);
    await safeSelectTdf(
      target.data('tdfid'),
      target.data('lessonname'),
      target.data('currentstimulisetid'),
      null,
      null,
      'Start from practice menu',
      target.data('ismultitdf'),
      null,
    );
  },

  'click .start-blocks': async function(event: any) {
    event.preventDefault();
    unlockAppleMobileAudioForUserGesture();
    const target = $(event.currentTarget);
    await safeSelectTdf(
      target.data('tdfid'),
      target.data('lessonname'),
      target.data('currentstimulisetid'),
      null,
      null,
      'Blocks from practice menu',
      target.data('ismultitdf'),
      null,
      false,
      false,
      'blocks',
    );
  },

  'click .start-condition-root': async function(this: any, event: any) {
    event.preventDefault();
    unlockAppleMobileAudioForUserGesture();
    const row = $(event.currentTarget).closest('tr, .learning-dashboard-card');
    const selector = row.find('.condition-tdf-selector');
    const selectedId = selector.val() as string;
    const rootId = selector.data('roottdfid') as string;
    if (!selectedId) return;

    const isExplicitCondition = selectedId !== rootId;
    Session.set('preselectedConditionTdfId', isExplicitCondition ? selectedId : null);
    Session.set('tdfFamilyRootTdfId', rootId);

    // isOwnerLaunch = true: owner's session does not increment conditionCounts
    await safeSelectTdf(
      rootId,
      this.displayName || selectedId,
      this.currentStimuliSetId,
      null,
      null,
      'Owner condition launch from practice menu',
      this.isMultiTdf,
      null,
      false,
      true, // isOwnerLaunch
    );
  },

});

Template.learningDashboard.rendered = async function(this: any) {
  const instance = this;
  if (instance._dashboardSubscribed) {
    return;
  }
  instance._dashboardSubscribed = true;
  const dashboardRenderStart = typeof performance !== 'undefined' ? performance.now() : Date.now();
  let studentID = Session.get('curStudentID') || Meteor.userId();
  let restoredSearch = false;
  const tryRestoreSearch = (userId: string | null | undefined) => {
    if (!userId || restoredSearch) {
      return;
    }
    try {
      applyLearningDashboardSearch(instance, loadPracticeDashboardSearch(userId));
      restoredSearch = true;
    } catch (error) {
      clientConsole(1, '[Dashboard] Practice dashboard search could not be restored:', error);
    }
  };
  let renderedLocalSnapshot = false;
  const tryRenderLocalSnapshot = (userId: string | null | undefined) => {
    if (!userId || renderedLocalSnapshot) {
      return;
    }
    try {
      const localSnapshot = loadLocalPracticeDashboardSnapshot(userId);
      if (localSnapshot) {
        applyPracticeDashboardSnapshot(instance, localSnapshot);
        renderedLocalSnapshot = true;
        const firstLayoutPaintMs = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - dashboardRenderStart;
        (window as any).__mofactsDashboardLocalPaintMs = firstLayoutPaintMs;
        (window as any).__mofactsDashboardLocalSnapshotLessons = localSnapshot.lessons.length;
        clientConsole(2, '[Dashboard] Rendered local practice snapshot', {
          lessons: localSnapshot.lessons.length,
          ageMs: Date.now() - Number(localSnapshot.generatedAt || 0),
          firstLayoutPaintMs,
        });
      }
    } catch (error) {
      clientConsole(1, '[Dashboard] Local practice snapshot could not be used:', error);
    }
  };

  tryRestoreSearch(studentID);
  tryRenderLocalSnapshot(studentID);

  const statisticsPreferenceRevision = instance.statisticsPreferenceRevision;
  meteorCallAsync('getUserPreference', PRACTICE_TABLE_STATISTICS_PREFERENCE_KEY)
    .then((preference) => {
      if (instance.statisticsPreferenceRevision === statisticsPreferenceRevision) {
        instance.statisticsExpanded.set(preference === true);
      }
    })
    .catch((error) => {
      clientConsole(1, '[Dashboard] Practice table statistics preference could not be loaded:', error);
    });

  // sessionCleanUp() removed - it's already called in selectTdf() at the right time
  // Calling it here causes problems because rendered() can fire multiple times
  // due to reactivity, clearing session variables while card.js is using them
  await checkUserSession();
  Session.set('showSpeechAPISetup', true);

  studentID = Session.get('curStudentID') || Meteor.userId();
  if (!studentID) {
    throw new Error('[LearningDashboard] Cannot render practice dashboard without an authenticated user id');
  }

  tryRestoreSearch(studentID);
  tryRenderLocalSnapshot(studentID);

  meteorCallAsync('getPracticeDashboardSnapshot')
    .then((snapshot) => {
      const practiceSnapshot = snapshot as PracticeDashboardSnapshot;
      if (practiceSnapshot.userId !== studentID) {
        throw new Error('[LearningDashboard] Practice dashboard snapshot was returned for a different user');
      }
      applyPracticeDashboardSnapshot(instance, practiceSnapshot);
      try {
        saveLocalPracticeDashboardSnapshot(practiceSnapshot);
      } catch (error) {
        clientConsole(1, '[Dashboard] Local practice snapshot could not be refreshed:', error);
      }
      const backgroundSyncBytes = JSON.stringify(practiceSnapshot).length;
      (window as any).__mofactsDashboardSyncBytes = backgroundSyncBytes;
      (window as any).__mofactsDashboardSyncLessonCount = practiceSnapshot.lessons.length;
      clientConsole(2, '[Dashboard] Applied authoritative practice snapshot', {
        lessons: practiceSnapshot.lessons.length,
        bytes: backgroundSyncBytes,
      });
    })
    .catch((error) => {
      clientConsole(1, '[Dashboard] Failed to sync authoritative practice snapshot:', error);
      if (instance.isLoading.get()) {
        instance.isLoading.set(false);
        instance.loadingVisibility.setPending(false);
      }
    });

  // Ensure body styles from offcanvas are cleared before fade-in
  document.body.style.overflow = '';
  document.body.style.paddingRight = '';
};

Template.learningDashboard.onDestroyed(function(this: any) {
  this.loadingVisibility.destroy();
  // Clean up autoruns
  this.autoruns.forEach((ar: any) => ar.stop());

  // Clean up subscriptions
  this.subscriptions.forEach((sub: any) => sub.stop());

  // Clear search debounce timer
  if (this.searchDebounceTimer) {
    clearTimeout(this.searchDebounceTimer);
  }

  destroyLearnerSettingsHost(this);
});

function diagnoseAudioStartupFailure(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error || '');
  if (typeof window.isSecureContext === 'boolean' && !window.isSecureContext) {
    return 'Audio features require a secure connection. Use https:// or http://localhost instead of a plain-HTTP LAN address.';
  }
  if (message.includes('getUserMedia is not implemented')) {
    return 'This browser does not support microphone access. Use a modern browser over HTTPS or localhost.';
  }
  if (message.includes('timed out')) {
    return 'Audio startup timed out. Check your network connection and try again.';
  }
  return `Audio startup failed: ${message}`;
}

function handleLaunchAudioStartupFailure(error: unknown) {
  const userMessage = diagnoseAudioStartupFailure(error);
  clientConsole(1, '[LearningDashboard] Audio startup failed before lesson launch:', error);
  finishLaunchLoading('audio-startup-failed');
  const tdfId = String(Session.get('currentTdfId') || '');
  if (tdfId) setLessonCommandFeedback(tdfId, userMessage, 'error');
}

// Scenario 2: Warmup audio if TDF has embedded keys (before navigating to card)
async function checkAndWarmupAudioIfNeeded() {
  const currentTdfFile = Session.get('currentTdfFile');
  if (!currentTdfFile) {
    
    return;
  }

  const user = Meteor.user();
  if (!user) {
    
    return;
  }

  let userPersonalKeys = { hasSR: false, hasTTS: false };
  try {
    markLaunchLoadingTiming('hasUserPersonalKeys:start');
    userPersonalKeys = await (Meteor as any).callAsync('hasUserPersonalKeys', Session.get('currentTdfId'));
    markLaunchLoadingTiming('hasUserPersonalKeys:complete', userPersonalKeys);
  } catch (error) {
    clientConsole(1, '[LearningDashboard] Could not determine personal audio key availability during launch prep:', error);
  }

  const audioStartupUser = {
    ...user,
    speechAPIKey: userPersonalKeys.hasSR ? '__configured__' : user?.speechAPIKey,
    ttsAPIKey: userPersonalKeys.hasTTS ? '__configured__' : user?.ttsAPIKey,
  };
  Session.set('speechAPIKeyConfigured', userPersonalKeys.hasSR === true);
  Session.set('ttsAPIKeyConfigured', userPersonalKeys.hasTTS === true);

  const audioPreparationPlan = getAudioLaunchPreparationPlan(currentTdfFile, audioStartupUser);
  if (!audioPreparationPlan.requiresPreparation) {
    return;
  }

  setLaunchLoadingMessage(dashboardText('dashboard.preparingAudioFeatures'));
  markLaunchLoadingTiming('audioWarmup:start', audioPreparationPlan);
  await prepareAudioForLaunchIfNeeded(currentTdfFile, audioStartupUser);
  markLaunchLoadingTiming('audioWarmup:complete');
}

// Actual logic for selecting and starting a TDF
function goToActiveLessonSurface(surface: '/content' | '/instructions'): void {
  const location = buildActiveLessonRouteLocation(surface);
  FlowRouter.go(location.path, {}, location.queryParams);
}

async function safeSelectTdf(...args: Parameters<typeof selectTdf>) {
  const settingsHost = Template.instance();
  const tdfId = String(args[0] || '');
  clearLessonCommandFeedback(tdfId);
  try {
    await flushLearnerSettings(settingsHost);
    await selectTdf(...args);
  } catch (error) {
    clearPracticeLaunchMode();
    finishLaunchLoading('practice-launch-failed');
    clientConsole(1, '[LearningDashboard] Lesson launch failed:', error);
    setLessonCommandFeedback(
      tdfId,
      error instanceof Error && error.message ? error.message : dashboardText('dashboard.lessonStartFailed'),
      'error',
    );
  }
}

async function selectTdf(currentTdfId: any, lessonName: any, currentStimuliSetId: any, ignoreOutOfGrammarResponses: any,
  speechOutOfGrammarFeedback: any, how: any, isMultiTdf: any, setspec: any, isExperiment = false, isOwnerLaunch = false,
  practiceLaunchMode: 'normal' | 'blocks' = 'normal') {

  startLaunchLoading(dashboardText('dashboard.preparingLesson'), 'practiceMenu');
  markLaunchLoadingTiming('practiceMenuClick', { currentTdfId, lessonName, how, isMultiTdf });

  // make sure session variables are cleared from previous tests
  sessionCleanUp();
  setPracticeLaunchMode(practiceLaunchMode);
  if (isOwnerLaunch) Session.set('ownerDashboardLaunch', true);

  let preparedLaunch;
  try {
    preparedLaunch = await prepareLessonLaunchContext({
      currentTdfId,
      currentStimuliSetId,
      ignoreOutOfGrammarResponses,
      speechOutOfGrammarFeedback,
      source: 'practiceMenu.selectTdf',
      setLaunchLoadingMessage,
      markLaunchLoadingTiming,
    });
  } catch (error) {
    clientConsole(1, '[LearningDashboard] Failed to load launch-ready TDF:', currentTdfId, error);
    finishLaunchLoading('tdf-subscription-missing-content');
    throw new Error(dashboardText('dashboard.unableToLoadSelectedLesson'));
  }

  const curTdfContent = preparedLaunch.content;
  const curTdfTips = curTdfContent.tdfs.tutor.setspec.tips;
  Session.set('curTdfTips', curTdfTips);
  const { launchProgress, unitCount } = preparedLaunch;

  if (launchProgress.moduleCompleted) {
    clientConsole(2, '[LearningDashboard] Blocking lesson relaunch because persisted state is completed', {
      currentTdfId,
      unitCount,
      persistedUnitNumber: launchProgress.persistedUnitNumber,
      lastUnitCompleted: launchProgress.lastUnitCompleted,
    });
    setLessonCommandFeedback(String(currentTdfId), dashboardText('dashboard.lessonAlreadyCompleted'), 'warning');
    clearPracticeLaunchMode();
    finishLaunchLoading('module-completed');
    return;
  }

  // Record state to restore when we return to this page
  let audioPromptMode;
  let audioInputEnabled;
  let audioPromptFeedbackSpeakingRate;
  let audioPromptQuestionSpeakingRate;
  let audioPromptVoice;
  let audioInputSensitivity;
  let audioPromptQuestionVolume;
  let audioPromptFeedbackVolume;
  let audioPromptFeedbackVoice;
  const user = Meteor.user();
  const audioSettings = user?.audioSettings || {};

  if (isExperiment) {
    audioPromptMode = setspec.audioPromptMode || 'silent';
    audioInputEnabled = setspec.audioInputEnabled || false;
    audioPromptFeedbackSpeakingRate = setspec.audioPromptFeedbackSpeakingRate || 1;
    audioPromptQuestionSpeakingRate = setspec.audioPromptQuestionSpeakingRate || 1;
    audioPromptVoice = setspec.audioPromptVoice || 'en-US-Standard-A';
    audioInputSensitivity = audioSettings.audioInputSensitivity;
    audioPromptQuestionVolume = setspec.audioPromptQuestionVolume || 0;
    audioPromptFeedbackVolume = setspec.audioPromptFeedbackVolume || 0;
    audioPromptFeedbackVoice = setspec.audioPromptFeedbackVoice || 'en-US-Standard-A';
  } else {
    // Load from user's audioSettings if available, otherwise use defaults
    audioPromptMode = learnerConfigHasSetSpecAudioOverride(String(currentTdfId), 'audioPromptMode')
      ? curTdfContent.tdfs.tutor.setspec.audioPromptMode || 'silent'
      : audioSettings.audioPromptMode || 'silent';
    audioInputEnabled = learnerConfigHasSetSpecAudioOverride(String(currentTdfId), 'audioInputEnabled')
      ? curTdfContent.tdfs.tutor.setspec.audioInputEnabled === true || curTdfContent.tdfs.tutor.setspec.audioInputEnabled === 'true'
      : audioSettings.audioInputMode || false;
    
    audioPromptFeedbackSpeakingRate = audioSettings.audioPromptFeedbackSpeakingRate || 1;
    audioPromptQuestionSpeakingRate = audioSettings.audioPromptQuestionSpeakingRate || 1;
    audioPromptVoice = audioSettings.audioPromptVoice || 'en-US-Standard-A';
    audioInputSensitivity = learnerConfigHasSetSpecAudioOverride(String(currentTdfId), 'audioInputSensitivity')
      ? curTdfContent.tdfs.tutor.setspec.audioInputSensitivity
      : audioSettings.audioInputSensitivity;
    audioPromptQuestionVolume = audioSettings.audioPromptQuestionVolume || 0;
    audioPromptFeedbackVolume = audioSettings.audioPromptFeedbackVolume || 0;
    audioPromptFeedbackVoice = audioSettings.audioPromptFeedbackVoice || 'en-US-Standard-A';
  }

  setAudioPromptMode(audioPromptMode);
  setAudioPromptFeedbackView(audioPromptMode === 'feedback' || audioPromptMode === 'all');
  setAudioEnabledView(audioInputEnabled);
  setAudioPromptFeedbackSpeakingRateView(audioPromptFeedbackSpeakingRate);
  setAudioPromptQuestionSpeakingRateView(audioPromptQuestionSpeakingRate);
  setAudioPromptVoiceView(audioPromptVoice);
  setAudioInputSensitivityView(audioInputSensitivity);
  setAudioPromptQuestionVolume(audioPromptQuestionVolume);
  setAudioPromptFeedbackVolume(audioPromptFeedbackVolume);
  setAudioPromptFeedbackVoiceView(audioPromptFeedbackVoice);

  // Set values for card.js to use later, in experiment mode we'll default to the values in the tdf
  setAudioPromptFeedbackSpeakingRate(audioPromptFeedbackSpeakingRate);
  setAudioPromptQuestionSpeakingRate(audioPromptQuestionSpeakingRate);
  setAudioPromptVoice(audioPromptVoice);
  setAudioPromptFeedbackVoice(audioPromptFeedbackVoice);
  setAudioInputSensitivity(audioInputSensitivity);

  // If we're in experiment mode and the tdf file defines whether audio input is enabled
  // forcibly use that, otherwise go with whatever the user set the audio input toggle to
  const userAudioToggled = audioInputEnabled;
  const tdfAudioEnabled = curTdfContent.tdfs.tutor.setspec.audioInputEnabled ?
    curTdfContent.tdfs.tutor.setspec.audioInputEnabled == 'true' : false;
  const audioEnabled = !Session.get('experimentTarget') ? userAudioToggled : tdfAudioEnabled;
  setAudioEnabled(audioEnabled);

  let continueToCard = true;

  // Go directly to the card session - which will decide whether or
  // not to show instruction
  if (continueToCard) {
    // Scenario 2: Warmup audio if TDF has embedded keys (before navigating to card)
    try {
      await checkAndWarmupAudioIfNeeded();
    } catch (error) {
      handleLaunchAudioStartupFailure(error);
      return;
    }

    if (isMultiTdf) {
      await navigateForMultiTdf(launchProgress.intent);
    } else {
      setLaunchLoadingMessage(dashboardText('common.loadingContent'));
      setCardEntryIntent(launchProgress.intent, {
        source: 'practiceMenu.selectTdf',
      });
      goToActiveLessonSurface(preparedLaunch.entryRoute!.route);
    }
  }
}

async function navigateForMultiTdf(entryIntent: CardEntryIntent = CARD_ENTRY_INTENT.INITIAL_TDF_ENTRY) {
  setLaunchLoadingMessage(dashboardText('dashboard.restoringProgress'));
  markLaunchLoadingTiming('getExperimentState:start', { source: 'navigateForMultiTdf' });
  const experimentState: any = await getExperimentState();
  markLaunchLoadingTiming('getExperimentState:complete', { source: 'navigateForMultiTdf' });
  const lastUnitCompleted = experimentState.lastUnitCompleted || -1;
  const currentUnitNumber = typeof experimentState.currentUnitNumber === 'number'
    ? experimentState.currentUnitNumber
    : -1;
  let unitLocked = false;

  // If we haven't finished the unit yet, we may want to lock into the current unit
  // so the user can't mess up the data
  if (currentUnitNumber > lastUnitCompleted) {
    const unitList = Session.get('currentTdfFile')?.tdfs?.tutor?.unit;
    const curUnit = Array.isArray(unitList) ? unitList[currentUnitNumber] : null;
    unitLocked = shouldLockMultiTdfLaunchToCurrentUnit(curUnit);
  }
  // Only show selection if we're in a unit where it doesn't matter (infinite learning sessions)
  if (unitLocked) {
    setLaunchLoadingMessage(dashboardText('common.loadingContent'));
    setCardEntryIntent(entryIntent, {
      source: 'practiceMenu.navigateForMultiTdf',
    });
    goToActiveLessonSurface('/content');
  } else {
    finishLaunchLoading('multi-tdf-select');
    FlowRouter.go('/multiTdfSelect');
  }
}








