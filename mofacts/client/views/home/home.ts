import {checkUserSession, clientConsole} from '../../lib/userSessionHelpers';
const { FlowRouter } = require('meteor/ostrio:flow-router-extra');
import { ReactiveVar } from 'meteor/reactive-var';
import DOMPurify from 'dompurify';
import { Cookie } from '../../lib/cookies';
import { currentUserHasRole } from '../../lib/roleUtils';
import { getUserDisplayName, getUserInitials } from '../../lib/userIdentity';
import { getErrorMessage } from '../../lib/errorUtils';
import { getActiveUiLocale, setActiveUiLocale } from '../../lib/interfaceLocaleState';
import { translatePlatformString } from '../../lib/interfaceI18n';
import type { PlatformStringKey } from '../../lib/interfaceI18nResources';
import { TARGET_LOCALE_DEFINITIONS, TARGET_UI_LOCALES } from '../../../common/lib/interfaceLocales';
import { applyThemeCSSProperties } from '../../lib/themeRuntime';
import {
  findAvailableUserTheme,
  getAvailableUserThemes,
  getThemeDisplayName,
  saveUserThemeSelection,
  serializeThemeSelection,
  type ThemeLibraryEntry,
} from '../../lib/userThemeSelection';
import { findProfileAvatarIcon, normalizeProfileAvatarType } from '../../../common/profileAvatar';
import { hydrateHomePracticeStateFromDashboardCache } from './homePracticeState';
import {
  createDisclosureController,
  type DisclosureController,
} from '../../lib/adminUi/disclosureController';
import { isLessonRoutePath } from '../../lib/lessonRoute';
import './home.html';
import './home.css';
import '../shared/adminUi/adminUi';

declare const Template: any;
declare const Session: any;
declare const Meteor: any;

const MeteorAny = Meteor as typeof Meteor & { callAsync: (name: string, ...args: any[]) => Promise<any> };

const MAIN_MENU_RETURN_TOUR_DURATION_MS = 5000;
const HOME_SIDEBAR_COLLAPSED_KEY = 'mofacts.home.sidebarCollapsed';
const PRACTICE_MENU_OPEN_KEY = 'mofacts.practice.menuOpen';
const HOME_WELCOME_ALLOWED_TAGS = ['h1', 'h2', 'h3', 'p', 'br', 'span', 'strong', 'em', 'b', 'i', 'u', 'a', 'ul', 'ol', 'li'];
const HOME_WELCOME_ALLOWED_ATTR = ['href', 'title', 'target', 'rel', 'class', 'style'];

type ThemeLibraryPresentation =
  | { status: 'loading' }
  | { status: 'ready' }
  | { status: 'error'; message: string };

type AppAccountMenuInstance = Blaze.TemplateInstance & {
  accountMenuOpen: ReactiveVar<boolean>;
  localeMenuOpen: ReactiveVar<boolean>;
  themeMenuOpen: ReactiveVar<boolean>;
  themeLibraryPresentation: ReactiveVar<ThemeLibraryPresentation>;
  localeFeedback: ReactiveVar<string>;
  themeFeedback: ReactiveVar<string>;
  accountDisclosure: DisclosureController;
  localeDisclosure: DisclosureController;
  themeDisclosure: DisclosureController;
  accountMenuDestroyed: boolean;
  _appAccountDocumentClickHandler?: ((event: Event) => void) | null;
};

type HomeTourStepId =
  | 'main-menu-return'
  | 'learning-dashboard'
  | 'content-manager'
  | 'download-data';
type HomeTourStep = {
  id: HomeTourStepId;
  textKey: PlatformStringKey;
  targetSelector: string;
  targetLabelKey: PlatformStringKey;
  placement: 'sidebar' | 'lesson-action';
};

const SIDEBAR_ACTION_ROUTES: Record<string, string> = {
  learningAnalyticsButton: '/learning-analytics',
  coursesButton: '/courses',
  contentUploadButton: '/contentUpload',
  classEditButton: '/classEdit',
  instructorReportingButton: '/instructorReporting',
  tdfAssignmentEditButton: '/tdfAssignmentEdit',
  dataDownloadButton: '/dataDownload',
  adminControlsBtn: '/adminControls',
  userAdminButton: '/userAdmin',
  mechTurkButton: '/turkWorkflow',
  themeButton: '/theme',
  adminTestsButton: '/admin/tests',
  adminBackupsButton: '/admin/backups',
  adminSecurityAuditsButton: '/admin/security-audits',
};

const PRACTICE_MENU_ACTION_ROUTES: Record<string, string> = {
  home: '/home',
  learningAnalytics: '/learning-analytics',
  courses: '/courses',
  contentUpload: '/contentUpload',
  dataDownload: '/dataDownload',
  classEdit: '/classEdit',
  instructorReporting: '/instructorReporting',
  tdfAssignmentEdit: '/tdfAssignmentEdit',
  adminControls: '/adminControls',
  userAdmin: '/userAdmin',
  turkWorkflow: '/turkWorkflow',
  theme: '/theme',
  adminTests: '/admin/tests',
  adminBackups: '/admin/backups',
  adminSecurityAudits: '/admin/security-audits',
};

const SIDEBAR_ACTIVE_MATCHERS: Record<string, string[]> = {
  home: ['/home', '/'],
  learningAnalytics: ['/learning-analytics'],
  courses: ['/courses'],
  content: ['/contentUpload', '/contentCreate', '/contentEdit', '/tdfEdit'],
  data: ['/dataDownload'],
  classEdit: ['/classEdit'],
  instructorReporting: ['/instructorReporting'],
  tdfAssignmentEdit: ['/tdfAssignmentEdit'],
  adminControls: ['/adminControls'],
  userAdmin: ['/userAdmin'],
  turkWorkflow: ['/turkWorkflow'],
  theme: ['/theme'],
  adminTests: ['/admin/tests'],
  adminBackups: ['/admin/backups'],
  adminSecurityAudits: ['/admin/security-audits'],
};

const HOME_TOUR_STEPS: HomeTourStep[] = [
  {
    id: 'main-menu-return',
    textKey: 'home.tourReturnToPractice',
    targetSelector: '#homePracticeButton',
    targetLabelKey: 'home.tourPracticeMenuButton',
    placement: 'sidebar',
  },
  {
    id: 'learning-dashboard',
    textKey: 'home.tourStartLesson',
    targetSelector: '.learning-dashboard-action-button.start-lesson, .learning-dashboard-action-button.continue-lesson, .learning-dashboard-action-button.start-condition-root',
    targetLabelKey: 'home.tourFirstLessonActionButton',
    placement: 'lesson-action',
  },
  {
    id: 'content-manager',
    textKey: 'home.tourCreateContent',
    targetSelector: '#contentUploadButton',
    targetLabelKey: 'home.tourCreateContentMenuButton',
    placement: 'sidebar',
  },
  {
    id: 'download-data',
    textKey: 'home.tourDetailedData',
    targetSelector: '#dataDownloadButton',
    targetLabelKey: 'home.tourDetailedDataMenuButton',
    placement: 'sidebar',
  },
];

function markSidebarToggleTransition(sidebar: HTMLElement | null): void {
  if (!sidebar || window.matchMedia('(max-width: 1024px)').matches) {
    return;
  }

  sidebar.classList.add('sidebar-toggle-transitioning');
  const clearTransitionState = () => {
    sidebar.classList.remove('sidebar-toggle-transitioning');
    sidebar.removeEventListener('transitionend', handleTransitionEnd);
  };
  const handleTransitionEnd = (event: TransitionEvent) => {
    if (event.target === sidebar && (event.propertyName === 'width' || event.propertyName === 'transform')) {
      clearTransitionState();
    }
  };

  sidebar.addEventListener('transitionend', handleTransitionEnd);
  window.setTimeout(clearTransitionState, 360);
}

function toggleDesktopSidebarCollapse(): void {
  const sidebar = document.getElementById('sidebar');
  const main = document.getElementById('homeMain');
  const nextCollapsed = !sidebar?.classList.contains('sidebar-collapsed');
  markSidebarToggleTransition(sidebar);
  sidebar?.classList.toggle('sidebar-collapsed', nextCollapsed);
  main?.classList.toggle('main-sidebar-collapsed', nextCollapsed);
  window.localStorage.setItem(HOME_SIDEBAR_COLLAPSED_KEY, nextCollapsed ? '1' : '0');
}

function closeMobileSidebar(): void {
  if (!window.matchMedia('(max-width: 1024px)').matches) {
    return;
  }
  const sidebar = document.getElementById('sidebar');
  if (!sidebar?.classList.contains('sidebar-mobile-open')) {
    return;
  }

  sidebar.classList.add('sidebar-mobile-closing');
  sidebar.classList.remove('sidebar-mobile-open');
  const clearClosingState = () => {
    sidebar.classList.remove('sidebar-mobile-closing');
    sidebar.removeEventListener('transitionend', handleTransitionEnd);
  };
  const handleTransitionEnd = (event: TransitionEvent) => {
    if (event.target === sidebar && event.propertyName === 'transform') {
      clearClosingState();
    }
  };
  sidebar.addEventListener('transitionend', handleTransitionEnd);
  window.setTimeout(clearClosingState, 320);
}

function scrollHomeToTop(): void {
  window.scrollTo({ top: 0, behavior: 'smooth' });
  document.querySelector('.content')?.scrollTo({ top: 0, behavior: 'smooth' });
}

async function leavePracticeFor(route: string): Promise<void> {
  if (isLessonRoutePath(document.location.pathname)) {
    const { leavePage } = await import('../experiment/svelte/services/navigationCleanup');
    await leavePage(route);
    return;
  }
  FlowRouter.go(route);
}

function openSidebarForTour(): number {
  const sidebar = document.getElementById('sidebar');
  const main = document.getElementById('homeMain');
  if (!sidebar) {
    return 0;
  }

  if (window.matchMedia('(max-width: 1024px)').matches) {
    sidebar.classList.remove('sidebar-mobile-closing');
    sidebar.classList.add('sidebar-mobile-open');
    return 260;
  }

  if (sidebar.classList.contains('sidebar-collapsed')) {
    sidebar.classList.remove('sidebar-collapsed');
    main?.classList.remove('main-sidebar-collapsed');
    window.localStorage.setItem(HOME_SIDEBAR_COLLAPSED_KEY, '0');
    return 320;
  }

  return 0;
}

function applyUserSelectedTheme(theme: ThemeLibraryEntry): void {
  const selectedTheme = serializeThemeSelection(theme);
  Session.set('userThemeOverrideActive', true);
  applyThemeCSSProperties(selectedTheme);
  saveUserThemeSelection(selectedTheme);
}

function reportThemeToggleError(instance: AppAccountMenuInstance, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  clientConsole(1, '[ThemeToggle] Failed to select theme:', message);
  instance.themeFeedback.set(message);
}

// //////////////////////////////////////////////////////////////////////////
// Template storage and helpers

Template.home.helpers({
  homeWelcomeHtml(): string {
    const theme = Session.get('curTheme');
    const hasPracticeRecords = Session.get('homeHasPracticeRecords');
    const html = hasPracticeRecords === false
      ? theme?.properties?.practice_menu_first_practice_welcome_html
      : theme?.properties?.practice_menu_welcome_html;
    if (typeof html !== 'string') {
      clientConsole(1, '[HOME] Missing required theme welcome property');
      return '';
    }

    const practiceMenuHtml = html
      .replace(/\bthe Learning Dashboard\b/g, 'the practice menu')
      .replace(/\bLearning Dashboard\b/g, 'practice menu')
      .replace(/\blearning dashboard\b/g, 'practice menu');

    return DOMPurify.sanitize(practiceMenuHtml, {
      ALLOWED_TAGS: HOME_WELCOME_ALLOWED_TAGS,
      ALLOWED_ATTR: HOME_WELCOME_ALLOWED_ATTR,
    });
  },

});

Template.appSidebar.helpers({
  sidebarActiveClass(action: string): string {
    const path = document.location.pathname;
    const matches = SIDEBAR_ACTIVE_MATCHERS[action] || [];
    return matches.some((candidate) => path === candidate || path.startsWith(`${candidate}/`)) ? 'active' : '';
  },
});

Template.appAccountMenu.helpers({
  accountMenuOpen(): boolean {
    return (Template.instance() as AppAccountMenuInstance).accountMenuOpen.get();
  },

  userInitials(): string {
    return getUserInitials(Meteor.user());
  },

  userAvatarClass(): string {
    const avatarType = normalizeProfileAvatarType(Meteor.user()?.profile?.avatarType);
    return `avatar-${avatarType}`;
  },

  userAvatarIsImage(): boolean {
    const user = Meteor.user();
    return normalizeProfileAvatarType(user?.profile?.avatarType) === 'image' &&
      typeof user?.profile?.avatarImageData === 'string' &&
      user.profile.avatarImageData.length > 0;
  },

  userAvatarImageData(): string {
    return String(Meteor.user()?.profile?.avatarImageData || '');
  },

  userAvatarIsIcon(): boolean {
    return normalizeProfileAvatarType(Meteor.user()?.profile?.avatarType) === 'icon' &&
      !!findProfileAvatarIcon(Meteor.user()?.profile?.avatarIconId);
  },

  userAvatarIconClass(): string {
    return findProfileAvatarIcon(Meteor.user()?.profile?.avatarIconId)?.className || 'fa-user';
  },

  userDisplayName(): string {
    return getUserDisplayName(Meteor.user());
  },

  userRoleLabel(): string {
    const uiLocale = getActiveUiLocale();
    if (currentUserHasRole('admin')) return translatePlatformString(uiLocale, 'home.admin');
    if (currentUserHasRole('teacher')) return translatePlatformString(uiLocale, 'home.teacher');
    return translatePlatformString(uiLocale, 'home.learner');
  },

  themeMenuOpen(): boolean {
    return (Template.instance() as AppAccountMenuInstance).themeMenuOpen.get();
  },

  localeMenuOpen(): boolean {
    return (Template.instance() as AppAccountMenuInstance).localeMenuOpen.get();
  },

  availableUiLocales(): Array<{ locale: string; label: string }> {
    return TARGET_UI_LOCALES.map((locale) => {
      const definition = TARGET_LOCALE_DEFINITIONS[locale];
      return {
        locale,
        label: `${definition.englishName} (${definition.nativeName})`,
      };
    });
  },

  isSelectedUiLocale(locale: string): boolean {
    return getActiveUiLocale() === locale;
  },

  localeSelectionActiveClass(locale: string): string {
    return getActiveUiLocale() === locale ? 'locale-selection-item-active' : '';
  },

  availableUserThemes(): ThemeLibraryEntry[] {
    return getAvailableUserThemes().map((theme) => ({
      ...theme,
      metadata: {
        ...theme.metadata,
        name: getThemeDisplayName(theme),
      },
    }));
  },

  hasAvailableThemes(): boolean {
    return getAvailableUserThemes().length > 0;
  },

  themeLibraryLoading(): boolean {
    return (Template.instance() as AppAccountMenuInstance).themeLibraryPresentation.get().status === 'loading';
  },

  themeLibraryError(): string {
    const state = (Template.instance() as AppAccountMenuInstance).themeLibraryPresentation.get();
    return state.status === 'error' ? state.message : '';
  },
  localeFeedback(): string {
    return (Template.instance() as AppAccountMenuInstance).localeFeedback.get();
  },
  themeFeedback(): string {
    return (Template.instance() as AppAccountMenuInstance).themeFeedback.get();
  },

  themeSelectionName(theme: ThemeLibraryEntry): string {
    return getThemeDisplayName(theme);
  },

  isSelectedTheme(themeId: string): boolean {
    return Session.get('curTheme')?.activeThemeId === themeId;
  },

  themeSelectionActiveClass(themeId: string): string {
    return Session.get('curTheme')?.activeThemeId === themeId ? 'theme-selection-item-active' : '';
  },
});

Template.appPracticeMenu.helpers({
  practiceMenuOpen(): boolean {
    return Session.get(PRACTICE_MENU_OPEN_KEY) === true;
  },
});

// //////////////////////////////////////////////////////////////////////////
// Template Events

Template.appSidebar.events({
  'click #homePracticeButton': function(event: any) {
    event.preventDefault();
    event.stopPropagation();
    closeMobileSidebar();
    if (document.location.pathname === '/home') {
      scrollHomeToTop();
      return;
    }
    FlowRouter.go('/home');
  },

  'click #sidebarToggle': function(event: any) {
    event.preventDefault();
    event.stopPropagation();
    const sidebar = document.getElementById('sidebar');
    if (
      window.matchMedia('(max-width: 1024px)').matches &&
      sidebar?.classList.contains('sidebar-mobile-open')
    ) {
      closeMobileSidebar();
      return;
    }

    toggleDesktopSidebarCollapse();
  },
});

Object.keys(SIDEBAR_ACTION_ROUTES).forEach((elementId) => {
  Template.appSidebar.events({
    [`click #${elementId}`]: function(event: any) {
      event.preventDefault();
      event.stopPropagation();
      closeMobileSidebar();
      FlowRouter.go(SIDEBAR_ACTION_ROUTES[elementId]);
    },
  });
});

function requireAccountMenuElement(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Account menu requires #${id}.`);
  }
  return element;
}

function closeNestedAccountDisclosures(instance: AppAccountMenuInstance): void {
  instance.localeDisclosure.close(false);
  instance.themeDisclosure.close(false);
}

function closeAccountMenu(
  instance: AppAccountMenuInstance,
  restoreFocus = false,
): void {
  closeNestedAccountDisclosures(instance);
  instance.accountDisclosure.close(restoreFocus);
}

Template.appAccountMenu.events({
  'click #userToggle': function(event: Event, instance: AppAccountMenuInstance) {
    event.preventDefault();
    event.stopPropagation();
    if (!instance.accountMenuOpen.get()) {
      closeMobileSidebar();
    }
    instance.accountDisclosure.toggle(
      event.currentTarget as HTMLElement,
      requireAccountMenuElement('userDropdown'),
    );
  },

  'keydown #userToggle': function(event: KeyboardEvent, instance: AppAccountMenuInstance) {
    if (!instance.accountMenuOpen.get()) {
      closeMobileSidebar();
    }
    instance.accountDisclosure.handleTriggerKeydown(
      event,
      event.currentTarget as HTMLElement,
      requireAccountMenuElement('userDropdown'),
    );
  },

  'keydown #userDropdown': function(event: KeyboardEvent, instance: AppAccountMenuInstance) {
    if (event.key !== 'Escape') {
      return;
    }
    if (instance.themeMenuOpen.get()) {
      instance.themeDisclosure.handlePanelKeydown(event);
      event.stopPropagation();
      return;
    }
    if (instance.localeMenuOpen.get()) {
      instance.localeDisclosure.handlePanelKeydown(event);
      event.stopPropagation();
      return;
    }
    instance.accountDisclosure.handlePanelKeydown(event);
  },

  'keydown [data-home-action="toggleTheme"]': function(event: KeyboardEvent, instance: AppAccountMenuInstance) {
    const handled = instance.themeDisclosure.handleTriggerKeydown(
      event,
      event.currentTarget as HTMLElement,
      requireAccountMenuElement('themeSelectionMenu'),
    );
    if (handled) {
      event.stopPropagation();
    }
  },

  'keydown [data-home-action="toggleLocale"]': function(event: KeyboardEvent, instance: AppAccountMenuInstance) {
    const handled = instance.localeDisclosure.handleTriggerKeydown(
      event,
      event.currentTarget as HTMLElement,
      requireAccountMenuElement('localeSelectionMenu'),
    );
    if (handled) {
      event.stopPropagation();
    }
  },

  'click [data-home-action]': function(event: any, instance: AppAccountMenuInstance) {
    event.preventDefault();
    event.stopPropagation();
    const action = event.currentTarget.getAttribute('data-home-action');
    if (action === 'toggleTheme') {
      instance.localeDisclosure.close(false);
      instance.themeDisclosure.toggle(
        event.currentTarget,
        requireAccountMenuElement('themeSelectionMenu'),
      );
      return;
    }
    if (action === 'toggleLocale') {
      instance.themeDisclosure.close(false);
      instance.localeDisclosure.toggle(
        event.currentTarget,
        requireAccountMenuElement('localeSelectionMenu'),
      );
      return;
    }
    closeAccountMenu(instance, false);

    if (action === 'tour') {
      FlowRouter.go('/home');
      window.setTimeout(() => {
        window.dispatchEvent(new CustomEvent('mofacts:startHomeTour'));
      }, 150);
      return;
    }
    if (action === 'documentation') {
      FlowRouter.go('/help');
      return;
    }
    if (action === 'logout') {
      Session.set('loginMode', 'normal');
      Cookie.set('isExperiment', '0', 1);
      Cookie.set('experimentTarget', '', 1);
      Cookie.set('experimentXCond', '', 1);
      Meteor.logout(() => {
        Session.set('curModule', 'signinoauth');
        Session.set('currentTemplate', 'signIn');
        Session.set('appLoading', false);
        FlowRouter.go('/');
      });
      return;
    }

    const routes: Record<string, string> = {
      profile: '/profile',
      audioSettings: '/audioSettings',
      classSelection: '/classSelection',
      help: '/help',
    };
    if (routes[action]) {
      FlowRouter.go(routes[action]);
    }
  },

  'click .theme-selection-item': function(event: any, instance: AppAccountMenuInstance) {
    event.preventDefault();
    event.stopPropagation();
    const themeId = event.currentTarget.getAttribute('data-theme-id');
    try {
      const selectedTheme = findAvailableUserTheme(themeId);
      if (!selectedTheme) {
        throw new Error(`Theme "${themeId || ''}" is not configured for selection.`);
      }
      applyUserSelectedTheme(selectedTheme);
      instance.themeFeedback.set('');
      closeAccountMenu(instance, true);
    } catch (error: unknown) {
      reportThemeToggleError(instance, error);
    }
  },

  async 'click .locale-selection-item'(event: any, instance: AppAccountMenuInstance) {
    event.preventDefault();
    event.stopPropagation();
    const nextLocale = event.currentTarget.getAttribute('data-ui-locale') || '';
    try {
      await MeteorAny.callAsync('updateOwnUiLocale', { uiLocale: nextLocale });
      setActiveUiLocale(nextLocale);
      instance.localeFeedback.set('');
      closeAccountMenu(instance, true);
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      clientConsole(1, '[LocaleMenu] Failed to select language:', message);
      instance.localeFeedback.set(message);
    }
  },
});

Template.appPracticeMenu.events({
  'click #practiceMenuToggle': function(event: any) {
    event.preventDefault();
    Session.set(PRACTICE_MENU_OPEN_KEY, Session.get(PRACTICE_MENU_OPEN_KEY) !== true);
  },

  async 'click [data-practice-menu-action]'(event: any) {
    event.preventDefault();
    const action = event.currentTarget.getAttribute('data-practice-menu-action');
    const route = PRACTICE_MENU_ACTION_ROUTES[action];
    if (!route) {
      clientConsole(1, '[PracticeMenu] Unknown action:', action);
      return;
    }
    Session.set(PRACTICE_MENU_OPEN_KEY, false);
    await leavePracticeFor(route);
  },
});

Template.home.events({
  'click #mainMenuReturnTour': function(_event: any, template: any) {
    advanceMainMenuTour(template);
  },
});

// We'll use this in card.js if audio input is enabled and user has provided a
// speech API key
Session.set('speechAPIKey', null);

function shouldShowMainMenuReturnTour(templateInstance?: any): boolean {
  return Boolean(templateInstance?._mainMenuTourActive) &&
    Session.get('loginMode') !== 'experiment';
}

function positionMainMenuReturnTour(overlay: HTMLElement, target: HTMLElement): void {
  const targetRect = target.getBoundingClientRect();
  overlay.hidden = false;
  overlay.style.visibility = 'hidden';

  const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
  const viewportHeight = document.documentElement.clientHeight || window.innerHeight;
  const overlayWidth = overlay.offsetWidth || 270;
  const overlayHeight = overlay.offsetHeight || 60;
  const stepId = overlay.dataset.tourStepId as HomeTourStepId | undefined;
  const step = HOME_TOUR_STEPS.find((candidate) => candidate.id === stepId);
  const isLessonActionStep = step?.placement === 'lesson-action';
  const targetPointX = isLessonActionStep
    ? targetRect.right
    : targetRect.right - 16;
  const targetPointY = isLessonActionStep
    ? targetRect.top + targetRect.height / 2
    : targetRect.top + targetRect.height / 2;
  const unclampedLeft = isLessonActionStep
    ? targetPointX + 64
    : targetRect.right + 48;
  const unclampedTop = isLessonActionStep
    ? targetPointY - overlayHeight - 44
    : targetPointY + 30;
  const overlayLeft = Math.min(
    Math.max(12, unclampedLeft),
    Math.max(12, viewportWidth - overlayWidth - 12)
  );
  const overlayTop = Math.min(
    Math.max(12, unclampedTop),
    Math.max(12, viewportHeight - overlayHeight - 12)
  );
  const arrowOriginX = targetPointX < overlayLeft ? 0 : overlayWidth;
  const arrowOriginY = targetPointY < overlayTop ? 0 : overlayHeight;
  const arrowDeltaX = targetPointX - (overlayLeft + arrowOriginX);
  const arrowDeltaY = targetPointY - (overlayTop + arrowOriginY);
  const arrowLength = Math.max(24, Math.hypot(arrowDeltaX, arrowDeltaY));
  const arrowAngle = Math.atan2(arrowDeltaY, arrowDeltaX);

  overlay.style.setProperty('--main-menu-tour-left', `${overlayLeft}px`);
  overlay.style.setProperty('--main-menu-tour-top', `${overlayTop}px`);
  overlay.style.setProperty('--main-menu-tour-arrow-origin-x', `${arrowOriginX}px`);
  overlay.style.setProperty('--main-menu-tour-arrow-origin-y', `${arrowOriginY}px`);
  overlay.style.setProperty('--main-menu-tour-arrow-length', `${arrowLength}px`);
  overlay.style.setProperty('--main-menu-tour-arrow-angle', `${arrowAngle}rad`);
  overlay.style.visibility = '';
}

function resolveHomeTourTarget(step: HomeTourStep): HTMLElement {
  const target = document.querySelector<HTMLElement>(step.targetSelector);
  const targetLabel = translatePlatformString(getActiveUiLocale(), step.targetLabelKey);
  if (!target) {
    throw new Error(`[HOME] Tour step "${step.id}" requires ${targetLabel} (${step.targetSelector}), but it was not found.`);
  }

  const targetRect = target.getBoundingClientRect();
  if (targetRect.width <= 0 || targetRect.height <= 0) {
    throw new Error(`[HOME] Tour step "${step.id}" requires visible ${targetLabel} (${step.targetSelector}), but it has no rendered size.`);
  }

  return target;
}

function hideMainMenuReturnTour(templateInstance?: any): void {
  const overlay = document.getElementById('mainMenuReturnTour') as HTMLElement | null;
  const highlightedTargets = document.querySelectorAll('.main-menu-return-tour-target');
  overlay?.classList.remove('is-visible');
  if (overlay) {
    overlay.hidden = true;
  }
  highlightedTargets.forEach((target) => target.classList.remove('main-menu-return-tour-target'));

  if (templateInstance?._mainMenuReturnTourTimeout) {
    clearTimeout(templateInstance._mainMenuReturnTourTimeout);
    templateInstance._mainMenuReturnTourTimeout = null;
  }
  if (templateInstance?._mainMenuReturnTourPositionHandler) {
    window.removeEventListener('resize', templateInstance._mainMenuReturnTourPositionHandler);
    window.removeEventListener('scroll', templateInstance._mainMenuReturnTourPositionHandler, true);
    templateInstance._mainMenuReturnTourPositionHandler = null;
  }

  if (templateInstance) {
    templateInstance._mainMenuTourActive = false;
    templateInstance._mainMenuTourStepIndex = 0;
    templateInstance._mainMenuTourManual = false;
  }
  Session.set('showMainMenuReturnTour', false);
}

function getCurrentTourStep(templateInstance: any): HomeTourStep | null {
  const index = Number(templateInstance?._mainMenuTourStepIndex || 0);
  return HOME_TOUR_STEPS[index] || null;
}

function showCurrentMainMenuTourStep(templateInstance: any): void {
  if (!shouldShowMainMenuReturnTour(templateInstance)) {
    return;
  }

  const overlay = document.getElementById('mainMenuReturnTour') as HTMLElement | null;
  const step = getCurrentTourStep(templateInstance);
  if (!overlay || !step) {
    hideMainMenuReturnTour(templateInstance);
    throw new Error('[HOME] Main menu tour cannot continue because the overlay or step is missing.');
  }

  let target: HTMLElement;
  try {
    target = resolveHomeTourTarget(step);
  } catch (error: unknown) {
    clientConsole(1, '[HOME] Main menu tour target invariant failed:', error);
    hideMainMenuReturnTour(templateInstance);
    throw error;
  }

  if (templateInstance._mainMenuReturnTourPositionHandler) {
    window.removeEventListener('resize', templateInstance._mainMenuReturnTourPositionHandler);
    window.removeEventListener('scroll', templateInstance._mainMenuReturnTourPositionHandler, true);
    templateInstance._mainMenuReturnTourPositionHandler = null;
  }
  if (templateInstance._mainMenuReturnTourTimeout) {
    clearTimeout(templateInstance._mainMenuReturnTourTimeout);
    templateInstance._mainMenuReturnTourTimeout = null;
  }

  overlay.dataset.tourStepId = step.id;
  const text = overlay.querySelector('.main-menu-return-tour-text');
  if (text) {
    text.textContent = translatePlatformString(getActiveUiLocale(), step.textKey);
  }

  document.querySelectorAll('.main-menu-return-tour-target')
    .forEach((existingTarget) => existingTarget.classList.remove('main-menu-return-tour-target'));

  const positionOverlay = () => positionMainMenuReturnTour(overlay, target);
  positionOverlay();
  target.classList.add('main-menu-return-tour-target');
  templateInstance._mainMenuReturnTourPositionHandler = positionOverlay;
  window.addEventListener('resize', positionOverlay);
  window.addEventListener('scroll', positionOverlay, true);

  requestAnimationFrame(() => {
    overlay.classList.add('is-visible');
  });

  templateInstance._mainMenuReturnTourTimeout = setTimeout(() => {
    advanceMainMenuTour(templateInstance);
  }, MAIN_MENU_RETURN_TOUR_DURATION_MS);
}

function advanceMainMenuTour(templateInstance: any): void {
  if (!templateInstance?._mainMenuTourActive) {
    hideMainMenuReturnTour(templateInstance);
    return;
  }
  const nextIndex = Number(templateInstance._mainMenuTourStepIndex || 0) + 1;
  if (nextIndex >= HOME_TOUR_STEPS.length) {
    hideMainMenuReturnTour(templateInstance);
    return;
  }

  const overlay = document.getElementById('mainMenuReturnTour') as HTMLElement | null;
  overlay?.classList.remove('is-visible');
  if (templateInstance._mainMenuReturnTourTimeout) {
    clearTimeout(templateInstance._mainMenuReturnTourTimeout);
    templateInstance._mainMenuReturnTourTimeout = null;
  }
  if (templateInstance._mainMenuReturnTourPositionHandler) {
    window.removeEventListener('resize', templateInstance._mainMenuReturnTourPositionHandler);
    window.removeEventListener('scroll', templateInstance._mainMenuReturnTourPositionHandler, true);
    templateInstance._mainMenuReturnTourPositionHandler = null;
  }

  templateInstance._mainMenuTourStepIndex = nextIndex;
  setTimeout(() => showCurrentMainMenuTourStep(templateInstance), 120);
}

function startMainMenuTour(templateInstance: any, options: { manual?: boolean } = {}): void {
  if (Session.get('loginMode') === 'experiment') {
    return;
  }
  if (!options.manual && Session.get('homeHasPracticeRecords') !== false) {
    return;
  }
  hideMainMenuReturnTour(templateInstance);
  templateInstance._mainMenuTourActive = true;
  templateInstance._mainMenuTourStepIndex = 0;
  templateInstance._mainMenuTourManual = Boolean(options.manual);
  Session.set('showMainMenuReturnTour', true);
  const sidebarDelay = openSidebarForTour();
  window.setTimeout(() => showCurrentMainMenuTourStep(templateInstance), sidebarDelay);
}

async function hydrateHomePracticeState(): Promise<void> {
  try {
    await hydrateHomePracticeStateFromDashboardCache(Meteor, Session);
  } catch (error: unknown) {
    clientConsole(1, '[HOME] Failed to hydrate practice state for welcome/tour:', error);
  }
}

function restoreHomeSidebarPreference(): void {
  const sidebar = document.getElementById('sidebar');
  const main = document.getElementById('homeMain');
  if (!sidebar || !main) {
    return;
  }
  const collapsed = window.localStorage.getItem(HOME_SIDEBAR_COLLAPSED_KEY) === '1';
  sidebar.classList.toggle('sidebar-collapsed', collapsed);
  main.classList.toggle('main-sidebar-collapsed', collapsed);
}

Template.appSidebar.onRendered(function() {
  restoreHomeSidebarPreference();
});

Template.appAccountMenu.onCreated(function(this: AppAccountMenuInstance) {
  this.accountMenuDestroyed = false;
  this.accountMenuOpen = new ReactiveVar(false);
  this.localeMenuOpen = new ReactiveVar(false);
  this.themeMenuOpen = new ReactiveVar(false);
  this.themeLibraryPresentation = new ReactiveVar<ThemeLibraryPresentation>({ status: 'loading' });
  this.localeFeedback = new ReactiveVar('');
  this.themeFeedback = new ReactiveVar('');
  this.accountDisclosure = createDisclosureController(({ open }) => {
    this.accountMenuOpen.set(open);
    if (!open) {
      closeNestedAccountDisclosures(this);
    }
  });
  this.localeDisclosure = createDisclosureController(({ open }) => {
    this.localeMenuOpen.set(open);
  });
  this.themeDisclosure = createDisclosureController(({ open }) => {
    this.themeMenuOpen.set(open);
  });
  this.subscribe('themeLibrary', {
    onReady: () => {
      if (!this.accountMenuDestroyed) {
        this.themeLibraryPresentation.set({ status: 'ready' });
      }
    },
    onStop: (error?: unknown) => {
      if (error && !this.accountMenuDestroyed) {
        this.themeLibraryPresentation.set({
          status: 'error',
          message: getErrorMessage(error),
        });
      }
    },
  });
});

Template.appAccountMenu.onRendered(function(this: AppAccountMenuInstance) {
  this._appAccountDocumentClickHandler = (event: Event) => {
    const target = event.target as HTMLElement | null;
    const root = document.getElementById('userAccountArea');
    if (root) {
      this.accountDisclosure.closeFromOutside(target, root);
    }
  };
  document.addEventListener('click', this._appAccountDocumentClickHandler);
});

Template.appAccountMenu.onDestroyed(function(this: AppAccountMenuInstance) {
  this.accountMenuDestroyed = true;
  this.accountDisclosure.destroy();
  this.localeDisclosure.destroy();
  this.themeDisclosure.destroy();
  if (this._appAccountDocumentClickHandler) {
    document.removeEventListener('click', this._appAccountDocumentClickHandler);
    this._appAccountDocumentClickHandler = null;
  }
});

Template.home.onRendered(async function(this: any) {
  
  clientConsole(2, '[HOME] Template.home.onRendered called');
  // Do not clean launch Session state here. rendered() can fire repeatedly due
  // to reactivity while card/instructions are still using those values.
  void checkUserSession()
    .then(() => {
      clientConsole(2, '[HOME] checkUserSession completed');
    })
    .catch((error: unknown) => {
      clientConsole(1, '[HOME] checkUserSession failed:', error);
    });

  Session.set('showSpeechAPISetup', true);
  Session.set('homeHasPracticeRecords', null);

  const templateInstance = this;
  void hydrateHomePracticeState();
  templateInstance._homeTourRequestHandler = () => startMainMenuTour(templateInstance, { manual: true });
  window.addEventListener('mofacts:startHomeTour', templateInstance._homeTourRequestHandler);
});

// Cleanup autoruns when template is destroyed to prevent zombie computations
Template.home.onDestroyed(function(this: any) {
  if (this._homeTourRequestHandler) {
    window.removeEventListener('mofacts:startHomeTour', this._homeTourRequestHandler);
    this._homeTourRequestHandler = null;
  }
  hideMainMenuReturnTour(this);
});
