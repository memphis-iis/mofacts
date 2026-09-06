import {ENTER_KEY} from '../common/Definitions';
import '../common/Collections';
import '../common/globalHelpers';
import {sessionCleanUp} from './lib/sessionUtils';
import './lib/authStorage';
import {
  isRecording,
  isWaitingForTranscription,
} from './views/experiment/svelte/services/audioRuntimeState';
import { getCurrentScore } from './views/experiment/svelte/services/scoreRuntimeState';
import {
  incrementPausedLocks,
  isEnterKeyLocked,
  isInputReady,
  setEnterKeyLock,
} from './views/experiment/svelte/services/trialReadinessState';
import { setDisplayFeedback } from './views/experiment/svelte/services/feedbackRuntimeState';
import { ExperimentStateStore } from './lib/state/experimentStateStore';
import {instructContinue} from './views/experiment/instructions';
import { shouldSuppressAuthenticatedChrome } from './lib/authenticatedChromePolicy';
import {routeToSignin} from './lib/router';
import { resolveNormalLoginDestination } from './lib/normalLoginDestination';
import { FlowRouter } from 'meteor/ostrio:flow-router-extra';
import { Tracker } from 'meteor/tracker';
import {
  getCurrentTheme
} from './lib/themeRuntime';
import { translatePlatformString, getPlatformTextDirection, setPlatformBrandNameResolver } from './lib/interfaceI18n';
import {
  getCurrentDeploymentBrandProfile,
  getDeploymentBrandName,
  getLocalizedBrandContent,
  readPublishedDeploymentBrandProfile,
} from './lib/deploymentBrandProfileRuntime';
import { applyActiveUiLocaleToDocument, getActiveUiLocale } from './lib/interfaceLocaleState';
import {
  formatActiveInterfaceDateTime,
  formatActiveInterfaceNumber,
  formatActiveInterfacePercent,
} from './lib/interfaceFormatting';
import type { PlatformStringKey } from './lib/interfaceI18nResources';
import DOMPurify from 'dompurify';
import {audioManager} from './lib/audioContextManager';
import {
  clientConsole,
  initTabDetection,
  loadClientSettings,
  startSessionCheckInterval,
  stopSessionCheckInterval,
} from './lib/userSessionHelpers';
import {Cookie} from './lib/cookies';
import {currentUserHasRole, hasRoleFromAuthFlags} from './lib/roleUtils';
import { managementRoutePresentation } from './lib/adminUi/routePresentationState';
import './views/shared/adminUi/adminUi';
import { getErrorMessage } from './lib/errorUtils';
import { hideBootstrapModal } from './lib/bootstrapModal';
import './index.html';
import { getPracticeLaunchMode } from './lib/practiceLaunchMode';
import { isLessonRoutePath } from './lib/lessonRoute';
import { clearStoredPublicDemoSession, readStoredPublicDemoSession } from './lib/publicDemoSession';

// =============================================================================
// Blaze Template Registration
// rspack only bundles files reachable from the import graph. Under the old
// Meteor bundler every file in client/ was auto-included; with rspack we must
// explicitly import each template module so its HTML + helpers/events are
// registered before the router tries to render them.
// =============================================================================

// -- Home / Auth --
import './views/home/home';
import './views/home/learningDashboard';
import './views/home/learningAnalytics/learningAnalytics';
import { getLearningAnalyticsStrings } from './views/home/learningAnalytics/learningAnalyticsI18n';
import './views/home/profileDebugToggles';
import './views/login/signIn';
import './views/login/signUp';
import './views/login/resetPassword';
import './views/login/verifyEmail';
import './views/publicExperience/publicExperience';
import './views/footer.html';
import './views/termsOfService';

// -- Experiment --
import './views/experiment/multiTdfSelect';
// Lazily loaded route modules are loaded from client/lib/router.js:
// - admin/help/theme/turk/user/test pages
// - experiment setup editor/upload pages
// - experiment reporting pages

// Security: HTML sanitization for user-generated content
// Allow safe formatting tags but block scripts, iframes, and event handlers
function sanitizeHTML(dirty: string | null | undefined) {
  if (!dirty) return '';

  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'u', 'br', 'p', 'span', 'div',
                   'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
                   'table', 'tr', 'td', 'th', 'thead', 'tbody',
                   'ul', 'ol', 'li', 'center', 'a', 'img', 'audio', 'source'],
    ALLOWED_ATTR: ['style', 'class', 'id', 'border', 'href', 'src', 'alt', 'width', 'height', 'controls', 'preload', 'data-audio-id'],
    ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|blob):|[^a-z]|[a-z+.-]+(?:[^a-z+.-:]|$))/i,
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur']
  });
}

export { clientConsole };

const PRACTICE_SHELL_TEMPLATES = new Set([
  'content',
  'instructions',
]);

const HOME_SHELL_TEMPLATES = new Set([
  'home',
  'learningAnalytics',
]);

type AuthenticatedChromeMode = 'none' | 'app' | 'practice';

async function leavePracticeForHome(): Promise<boolean> {
  const currentPath = document.location.pathname;
  if (!isLessonRoutePath(currentPath)) {
    return false;
  }

  const { leavePage } = await import('./views/experiment/svelte/services/navigationCleanup');
  await leavePage('/home');
  return true;
}

function getPracticeLessonTitle(): string {
  const tdfFile = Session.get('currentTdfFile') as any;
  const title = tdfFile?.tdfs?.tutor?.setspec?.lessonname || Session.get('currentLessonName');
  return typeof title === 'string' && title.trim() ? title.trim() : 'Practice';
}

function getAuthenticatedChromeMode(): AuthenticatedChromeMode {
  if (Meteor.userId() === null) {
    return 'none';
  }
  const user = Meteor.user() as any;
  if (shouldSuppressAuthenticatedChrome({
    explicitlySuppressed: Session.get('suppressAuthenticatedChrome') === true,
    loginMode: Session.get('loginMode'),
    userCreatedBy: user?.profile?.createdBy,
  })) {
    return 'none';
  }

  const currentTemplate = String(Session.get('currentTemplate') || '');
  const currentModule = String(Session.get('curModule') || '');
  const currentPath = FlowRouter.current()?.path || window.location.pathname || '';
  if (
    PRACTICE_SHELL_TEMPLATES.has(currentTemplate) ||
    PRACTICE_SHELL_TEMPLATES.has(currentModule) ||
    isPracticeRoutePath(currentPath)
  ) {
    return 'practice';
  }
  if (HOME_SHELL_TEMPLATES.has(currentTemplate)) {
    return 'app';
  }
  const routePresentation = managementRoutePresentation.get();
  if (routePresentation.status !== 'idle') {
    return routePresentation.chromeMode;
  }
  return 'none';
}

function getSystemName() {
  return getDeploymentBrandName();
}

// This redirects to the SSL version of the page if we're not on it
const forceSSL = Meteor.settings.public.forceSSL || false;
// forceSSL setting logged via clientConsole after it's defined
if (location.protocol !== 'https:' && forceSSL) {
  location.href = location.href.replace(/^http:/, 'https:');
}

// PHASE 1.5: Initialize theme subscription after Meteor is ready
Meteor.startup(() => {
  setPlatformBrandNameResolver(getDeploymentBrandName);
  getCurrentDeploymentBrandProfile(getActiveUiLocale);
  getCurrentTheme();
  Tracker.autorun(() => {
    applyActiveUiLocaleToDocument();
  });

});

let resizeDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let mobilePracticeReturnInProgress = false;

function isMobilePracticeDisplay(): boolean {
  return window.matchMedia('(hover: none) and (pointer: coarse)').matches;
}

function isPracticeRoutePath(path: string): boolean {
  return isLessonRoutePath(path);
}

async function returnMobilePracticeDisplayToMenu(reason: string): Promise<void> {
  if (mobilePracticeReturnInProgress || !isMobilePracticeDisplay()) {
    return;
  }

  // Blocks is a two-panel pointer game.  A transient browser blur is expected
  // while dragging or switching input focus and must not terminate its run.
  if (getPracticeLaunchMode() === 'blocks') {
    return;
  }

  const currentPath = document.location.pathname;
  if (!isPracticeRoutePath(currentPath)) {
    return;
  }

  mobilePracticeReturnInProgress = true;
  clientConsole(1, '[PRACTICE] Mobile practice display lost focus; returning to practice menu:', reason);
  try {
    const leftPractice = await leavePracticeForHome();
    if (!leftPractice) {
      clientConsole(1, '[PRACTICE] Practice return invariant failed; active route was not a practice route:', document.location.pathname);
    }
  } catch (error: unknown) {
    clientConsole(1, '[PRACTICE] Failed to return mobile practice display to menu:', getErrorMessage(error));
  } finally {
    setTimeout(() => {
      mobilePracticeReturnInProgress = false;
    }, 1000);
  }
}

function isResizeSensitivePhase() {
  // SR/trial-active phases are sensitive to repeated resize work and can race SR callbacks.
  return isRecording() ||
    isInputReady() ||
    isWaitingForTranscription();
}

function scheduleResizeWork(source: string) {
  const resizeSensitive = isResizeSensitivePhase();
  const debounceMs = resizeSensitive ? 350 : 90;
  if (resizeDebounceTimer) {
    clearTimeout(resizeDebounceTimer);
  }

  resizeDebounceTimer = setTimeout(() => {
    resizeDebounceTimer = null;
    clientConsole(2, `[RESIZE DEBUG] Coalesced resize (${source}) at ${Date.now()} | ${window.innerWidth}x${window.innerHeight} | sensitive=${resizeSensitive}`);
    // Skip image layout thrash while SR/trial input is active.
    if (!resizeSensitive) {
      redoCardImage();
    }
  }, debounceMs);
}

// Update on resize (orientation change, window resize)
window.addEventListener('resize', function() {
  scheduleResizeWork('window');
});

// Update on orientation change (mobile rotation)
window.addEventListener('orientationchange', () => {
  // Small delay to let browser finish orientation change
  setTimeout(() => scheduleResizeWork('orientationchange'), 100);
});

window.addEventListener('blur', () => {
  void returnMobilePracticeDisplayToMenu('window-blur');
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    void returnMobilePracticeDisplayToMenu('document-hidden');
  }
});

// Register the isInRole helper for templates (Meteor 3.0 compatibility)
// Check roles synchronously on client using user.roles array (reactively published)
// Supports comma-separated role lists (e.g., 'admin,teacher')
Session.setDefault('authReady', false);
Session.setDefault('authRoles', { admin: false, teacher: false });
Session.setDefault('authRolesHydrated', false);
Session.setDefault('authRolesSyncedUserId', null);
const AUTH_ROLE_CACHE_KEY = 'mofacts.authRoles.v1';
const STARTUP_DIAGNOSTIC_GRACE_MS = 2500;
const STARTUP_DIAGNOSTIC_VISIBLE_DELAY_MS = 250;

let authSyncSeq = 0;
let lastAuthSyncedUserId: string | null = null;
let startupDiagnosticsStartedAt = Date.now();
let startupDiagnosticPendingKey: string | null = null;
let startupDiagnosticPendingSince: number | null = null;
let startupDiagnosticVisibilityTimer: ReturnType<typeof setTimeout> | null = null;

function loadCachedAuthRoles() {
  try {
    const raw = localStorage.getItem(AUTH_ROLE_CACHE_KEY);
    if (!raw) {
      return;
    }
    const parsed = JSON.parse(raw);
    const cachedRoles = {
      admin: !!parsed?.admin,
      teacher: !!parsed?.teacher
    };
    Session.set('authRoles', cachedRoles);
  } catch (_error) {
    // Ignore malformed cache and continue with server sync.
  }
}

function cacheAuthRoles(authRoles: { admin: boolean; teacher: boolean }) {
  try {
    localStorage.setItem(AUTH_ROLE_CACHE_KEY, JSON.stringify({
      admin: !!authRoles.admin,
      teacher: !!authRoles.teacher
    }));
  } catch (_error) {
    // Ignore storage failures (private mode, quota, etc.).
  }
}

async function syncAuthRolesFromServer(reason: string) {
  const userId = Meteor.userId();
  if (!userId) {
    lastAuthSyncedUserId = null;
    const clearedRoles = { admin: false, teacher: false };
    Session.set('authRoles', clearedRoles);
    cacheAuthRoles(clearedRoles);
    Session.set('authRolesSyncedUserId', null);
    Session.set('authRolesHydrated', true);
    Session.set('authReady', true);
    return;
  }

  const seq = ++authSyncSeq;
  Session.set('authRolesHydrated', false);
  Session.set('authRolesSyncedUserId', null);
  try {
    const roleFlags = await MeteorAny.callAsync('getCurrentUserRoleFlags');
    if (seq !== authSyncSeq || Meteor.userId() !== userId) {
      return;
    }
    const syncedRoles = {
      admin: !!roleFlags?.admin,
      teacher: !!roleFlags?.teacher
    };
    Session.set('authRoles', syncedRoles);
    cacheAuthRoles(syncedRoles);
  } catch (error: unknown) {
    clientConsole(1, '[AUTH] Failed to sync role flags from server:', reason, getErrorMessage(error));
    if (seq !== authSyncSeq || Meteor.userId() !== userId) {
      return;
    }
    const failedRoles = { admin: false, teacher: false };
    Session.set('authRoles', failedRoles);
    cacheAuthRoles(failedRoles);
  } finally {
    if (seq === authSyncSeq && Meteor.userId() === userId) {
      lastAuthSyncedUserId = userId;
      Session.set('authRolesSyncedUserId', userId);
      Session.set('authRolesHydrated', true);
      Session.set('authReady', true);
    }
  }
}

Template.registerHelper('isInRole', function(role: string) {
  // Once hydrated, role flags are authoritative to prevent post-paint role pop-in.
  if (Session.get('authRolesHydrated') === true) {
    return hasRoleFromAuthFlags(role);
  }
  return currentUserHasRole(role);
});

import { meteorCallAsync } from './lib/meteorAsync';

import { legacyDisplay } from '../common/underscoreCompat';

export { meteorCallAsync };
const MeteorAny = Meteor as any;
const SessionAny = Session as any;
const windowAny = window as any;

// Make clientConsole globally available for Meteor packages
window.clientConsole = clientConsole;
// Expose FlowRouter for debugging in console
windowAny.FlowRouter = FlowRouter;

// function meteorCallAsync(funcName, ...rest) {
//   const promisedMeteorCall = Promise.promisify(Meteor.call);
//   return promisedMeteorCall.apply(null, [funcName, rest]);
// }

// This will be setup for window resize, but is made global so that the
// card template page can hook it up as well
function redoCardImage() {
  clientConsole(2, `[RESIZE DEBUG] 🖼️  redoCardImage called at ${Date.now()}`);
  // Early exit if no image element exists - prevents unnecessary layout queries on text trials
  const imgElement = $('#cardQuestionImg')[0];
  if (!imgElement) {
    clientConsole(2, `[RESIZE DEBUG]   - Skipped: no #cardQuestionImg element`);
    return;
  }

  clientConsole(2, `[RESIZE DEBUG]   - Image element found, querying window dimensions`);
  // Note that just in case we can't get the height on the window we punt
  // with a default that is reasonable a lot of the time
  const wid = $(window).width() || 640;
  const hgt = $(window).height() || 480;
  clientConsole(2, `[RESIZE DEBUG]   - Window: ${wid}x${hgt}`);
  let heightStr;
  let widthStr;

  if (wid > hgt) {
    // Landscape - assume that we want the image to fit entirely along
    // with the answer box on a fairly sane screen
    heightStr = legacyDisplay(Math.floor(hgt * 0.45)) + 'px';
    widthStr = 'auto';
  } else {
    // Portrait - set the image to be the width of the screen. They'll
    // probably need to scroll for tall images
    heightStr = 'auto';
    widthStr = '90%';
  }

  clientConsole(2, `[RESIZE DEBUG]   - Setting image dimensions: ${widthStr} x ${heightStr}`);
  $('#cardQuestionImg').css('height', heightStr).css('width', widthStr);
  clientConsole(2, `[RESIZE DEBUG]   - ✓ Image resize complete`);
}

//change the theme of the page onlogin
Accounts.onLogin(function() {
  // Use Tracker to wait for user data to be fully loaded
  Tracker.autorun((computation) => {
    const user = Meteor.user();

    // Wait for user AND profile to be loaded
    if (user && user.profile) {
      computation.stop(); // Only run once

      if (user.profile.experiment === true || user.profile.createdBy === 'provisionExperimentUser') {
        return;
      }

      // Check if the user has a profile with an email, first name, and last name
      if (!user.profile.username) {
        (async () => {
          try {
            const result = await MeteorAny.callAsync('populateSSOProfile', Meteor.userId());
            clientConsole(2, 'populateSSOProfile result:', result);
          } catch (error) {
            clientConsole(1, 'populateSSOProfile error:', error);
          }
        })();
      }
    }
  });
});

Accounts.onLogout(function() {
  authSyncSeq++;
  lastAuthSyncedUserId = null;
  const clearedRoles = { admin: false, teacher: false };
  Session.set('authRoles', clearedRoles);
  cacheAuthRoles(clearedRoles);
  Session.set('authRolesSyncedUserId', null);
  Session.set('authRolesHydrated', true);
  Session.set('authReady', true);
  stopSessionCheckInterval('accounts logout');
  Session.set('lastSessionId', null);
  Session.set('lastSessionIdTimestamp', null);
});

const PUBLIC_LOGOUT_PATHS = new Set([
  '/',
  '/auth/login',
  '/auth/signup',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/verify-email',
  '/auth/logout',
  '/signup',
  '/resetPassword',
  '/help',
  '/signIn',
  '/signin',
]);

const PUBLIC_LOGOUT_PREFIXES = [
  '/experiment',
];

function isPublicLogoutPath(path: string | null | undefined) {
  const cleanPath = (path || '').split('?')[0];
  if (!cleanPath) {
    return false;
  }
  if (PUBLIC_LOGOUT_PATHS.has(cleanPath)) {
    return true;
  }
  return PUBLIC_LOGOUT_PREFIXES.some((prefix) => cleanPath.startsWith(prefix));
}

function handleUnexpectedLogout(currentPath: string) {
  if (isPublicLogoutPath(currentPath)) {
    return;
  }

  if (readStoredPublicDemoSession()) {
    clientConsole(1, '[AUTH] Public demo session ended, returning to overview from', currentPath);
    Session.set('loginMode', 'normal');
    Cookie.set('isExperiment', '0', 1);
    Cookie.set('experimentTarget', '', 1);
    Cookie.set('experimentXCond', '', 1);
    clearStoredPublicDemoSession();
    Session.set('curModule', 'signinoauth');
    Session.set('appLoading', false);
    sessionCleanUp();
    Session.set('uiMessage', {
      variant: 'warning',
      text: getLocalizedBrandContent(getActiveUiLocale())?.demoExpired || '',
    });
    FlowRouter.go('/');
    return;
  }

  const expCookie = parseInt(Cookie.get('isExperiment') || '0', 10);
  const isExperiment = Session.get('loginMode') === 'experiment' || expCookie === 1;
  if (!isExperiment) {
    Session.set('loginMode', 'normal');
    Cookie.set('isExperiment', '0', 1);
    Cookie.set('experimentTarget', '', 1);
    Cookie.set('experimentXCond', '', 1);
  }

  clientConsole(1, '[AUTH] Session ended, redirecting to sign-in from', currentPath);
  Session.set('curModule', 'signinoauth');
  Session.set('currentTemplate', 'signIn');
  Session.set('appLoading', false);
  sessionCleanUp();
  routeToSignin(isExperiment ? undefined : resolveNormalLoginDestination(currentPath));
}

let lastKnownUserId: string | null = null;
let pendingUnexpectedLogoutTimer: ReturnType<typeof setTimeout> | null = null;
let authObserverStartedAt = Date.now();

Meteor.startup(function() {

  Session.set('debugging', true);
  startupDiagnosticsStartedAt = Date.now();
  sessionCleanUp();
  loadCachedAuthRoles();

  // Subscribe to user audio settings so they're available on the client
  Tracker.autorun(function() {
    if (Meteor.userId()) {
      Meteor.subscribe('userAudioSettings');
    }
  });

  Accounts.onLoginFailure(function(error: unknown) {
    clientConsole(1, '[AUTH] Login failure:', error);
  });

  // Initialize multi-tab detection
  initTabDetection();

  // Keep a session check running whenever a user is logged in (all routes).
  Tracker.autorun(() => {
    const currentUserId = Meteor.userId();
    if (currentUserId) {
      startSessionCheckInterval('user logged in');
    } else {
      stopSessionCheckInterval('user logged out');
    }
  });

  Tracker.autorun(() => {
    const currentUserId = Meteor.userId();
    const currentUser = Meteor.user();
    const loggingIn = Meteor.loggingIn();

    if (loggingIn && !currentUserId) {
      Session.set('authReady', false);
      Session.set('authRolesHydrated', false);
      Session.set('authRolesSyncedUserId', null);
      return;
    }

    if (!currentUserId) {
      lastAuthSyncedUserId = null;
      const clearedRoles = { admin: false, teacher: false };
      Session.set('authRoles', clearedRoles);
      cacheAuthRoles(clearedRoles);
      Session.set('authRolesHydrated', true);
      Session.set('authRolesSyncedUserId', null);
      Session.set('authReady', true);
      return;
    }

    if (!currentUser) {
      Session.set('authReady', false);
      Session.set('authRolesHydrated', false);
      Session.set('authRolesSyncedUserId', null);
      return;
    }

    // Fast path: user doc exists, so UI/routes can proceed immediately.
    if (Session.get('authReady') !== true) {
      Session.set('authReady', true);
    }

    // Background role verification; do not block paint or routing.
    if (lastAuthSyncedUserId !== currentUserId) {
      void syncAuthRolesFromServer('startup-tracker');
    }
  });

  Tracker.autorun(() => {
    const currentUserId = Meteor.userId();
    const currentPath = FlowRouter.current()?.path || window.location.pathname || '';
    const connected = Meteor.status?.().connected ?? true;
    const authReady = Session.get('authReady') === true;
    const observerGraceElapsed = Date.now() - authObserverStartedAt > 5000;

    // Never force logout redirects while reconnecting or while auth state is still settling.
    if (!connected || !authReady || !observerGraceElapsed) {
      if (pendingUnexpectedLogoutTimer) {
        clearTimeout(pendingUnexpectedLogoutTimer);
        pendingUnexpectedLogoutTimer = null;
      }
      lastKnownUserId = currentUserId;
      return;
    }

    if (lastKnownUserId && !currentUserId && !Meteor.loggingIn()) {
      if (pendingUnexpectedLogoutTimer) {
        clearTimeout(pendingUnexpectedLogoutTimer);
      }
      // Final debounce before redirecting; prevents transient auth races.
      pendingUnexpectedLogoutTimer = setTimeout(() => {
        pendingUnexpectedLogoutTimer = null;
        const stillConnected = Meteor.status?.().connected ?? true;
        const stillAuthReady = Session.get('authReady') === true;
        if (stillConnected && stillAuthReady && !Meteor.userId() && !Meteor.loggingIn()) {
          handleUnexpectedLogout(currentPath);
        }
      }, 1500);
    } else if (pendingUnexpectedLogoutTimer) {
      clearTimeout(pendingUnexpectedLogoutTimer);
      pendingUnexpectedLogoutTimer = null;
    }
    lastKnownUserId = currentUserId;
  });

  // Include any special jQuery handling we need (shared debounced scheduler).
  $(window).on('resize', function() {
    scheduleResizeWork('jquery');
  });
});

Template.DefaultLayout.onRendered(function(this: any) {
  this._stopClientSettings = loadClientSettings();
  const instance = this;
  if (!instance._appShellDocumentClickHandler) {
    instance._appShellDocumentClickHandler = (event: Event) => {
      const target = event.target as HTMLElement | null;
      if (
        window.matchMedia('(max-width: 1024px)').matches &&
        !target?.closest('#sidebar') &&
        !target?.closest('#mobileSidebarToggle')
      ) {
        document.getElementById('sidebar')?.classList.remove('sidebar-mobile-open');
      }
    };
    document.addEventListener('click', instance._appShellDocumentClickHandler);
  }
  instance._errorReportingModalHiddenHandler = () => {
    clientConsole(2, 'error reporting modal hidden');
  };
  document.getElementById('errorReportingModal')?.addEventListener(
    'hidden.bs.modal',
    instance._errorReportingModalHiddenHandler,
  );

  instance._startupDiagnosticInterval = Meteor.setInterval(() => {
    Session.set('startupDiagnosticTick', Date.now());
  }, 1000);
  //load css into head based on user's preferences
  instance._helpModalHiddenHandler = () => {
    const currentAudio = audioManager.getCurrentAudio();
    if (currentAudio) {
      currentAudio.play();
    }
  };
  document.getElementById('helpModal')?.addEventListener(
    'hidden.bs.modal',
    instance._helpModalHiddenHandler,
  );

  // Global handler for continue buttons
  instance._appShellKeypressHandler = function(e: JQuery.KeyPressEvent) {
    const key = e.keyCode || e.which;
    if (key == ENTER_KEY && (e.target as any).tagName != 'INPUT') {
      windowAny.keypressEvent = e;
      const curPage = document.location.pathname;
      clientConsole(2, 'global enter key, curPage:', curPage);

      if (!isEnterKeyLocked()) {
        setEnterKeyLock(true);
        clientConsole(2, 'grabbed enterKeyLock on global enter handler');
        if (isLessonRoutePath(curPage, '/instructions')) {
          e.preventDefault();
          instructContinue();
        } else if (isLessonRoutePath(curPage, '/content')) {
          // Enter key on the content route is handled by the content runtime.
        }
      }
    }
  };
  $(window).on('keypress.mofactsDefaultLayout', instance._appShellKeypressHandler);
});

Template.DefaultLayout.onDestroyed(function(this: any) {
  this._stopClientSettings?.();
  if (this._appShellDocumentClickHandler) {
    document.removeEventListener('click', this._appShellDocumentClickHandler);
  }
  if (this._errorReportingModalHiddenHandler) {
    document.getElementById('errorReportingModal')?.removeEventListener(
      'hidden.bs.modal',
      this._errorReportingModalHiddenHandler,
    );
  }
  if (this._helpModalHiddenHandler) {
    document.getElementById('helpModal')?.removeEventListener(
      'hidden.bs.modal',
      this._helpModalHiddenHandler,
    );
  }
  if (this._startupDiagnosticInterval) {
    Meteor.clearInterval(this._startupDiagnosticInterval);
  }
  if (this._appShellKeypressHandler) {
    $(window).off('keypress.mofactsDefaultLayout', this._appShellKeypressHandler);
  }
});

Template.DefaultLayout.events({
  'click [data-management-route-retry]': function(event: JQuery.TriggeredEvent) {
    event.preventDefault();
    managementRoutePresentation.retry();
  },
  'click [data-ui-message-clear]': function(event: JQuery.TriggeredEvent) {
    event.preventDefault();
    Session.set('uiMessage', null);
  },
  'click #mobileSidebarToggle': function(event: JQuery.TriggeredEvent) {
    event.preventDefault();
    document.getElementById('sidebar')?.classList.toggle('sidebar-mobile-open', true);
  },
  'click #saveReturnPracticeMenuButton': async function(event: JQuery.TriggeredEvent) {
    event.preventDefault();
    await leavePracticeForHome();
  },
  'click #helpButton': function(event: JQuery.TriggeredEvent) {
    event.preventDefault();
    incrementPausedLocks();
    Session.set('errorReportStart', new Date());
    audioManager.pauseCurrentAudio();
  },
  'click #helpCloseButton': function(event: JQuery.TriggeredEvent) {
    event.preventDefault();
    hideBootstrapModal('errorReportingModal');
  },

  'click #errorReportButton': function(event: JQuery.TriggeredEvent) {
    event.preventDefault();
    incrementPausedLocks();
    Session.set('errorReportStart', new Date());
    //set the modalTemplate session variable to the reportError template
    const templateObject = {
      template: 'errorReportModal',
      title: translatePlatformString(getActiveUiLocale(), 'common.reportAnError'),
    }
    Session.set('modalTemplate', templateObject);
    clientConsole(2, 'modalTemplate:', Session.get('modalTemplate'));
  },

  'click #resetFeedbackSettingsButton': function(event: JQuery.TriggeredEvent) {
    event.preventDefault();
    incrementPausedLocks();
    setDisplayFeedback(true);
    Session.set('resetFeedbackSettingsFromIndex', true);
  }, 
  'click #errorReportingSaveButton': function(event: JQuery.TriggeredEvent) {
    event.preventDefault();
    clientConsole(2, 'save error reporting button pressed');
    const errorDescription = $('#errorDescription').val();
    //if error description is empty, alert the user to enter a description
    if (errorDescription === '') {
      alert(translatePlatformString(getActiveUiLocale(), 'errorReport.descriptionRequired'));
      return;
    }
    const curUser = Meteor.userId();
    const curPage = document.location.pathname;
    const sessionVars = SessionAny.all();
    const userAgent = navigator.userAgent;
    const logs = (console as any).logs;
    const currentExperimentState = ExperimentStateStore.get();
    MeteorAny.callAsync('sendUserErrorReport', curUser, errorDescription, curPage, sessionVars,
        userAgent, logs, currentExperimentState);
    hideBootstrapModal('errorReportingModal');
    $('#errorDescription').val('');
  },

});

// Global template helpers
Template.registerHelper('currentTheme', function() {
  return Session.get('curTheme');
});
Template.registerHelper('systemName', function() {
  return getSystemName();
});
Template.registerHelper('licenseSourceUrl', function() {
  return readPublishedDeploymentBrandProfile()?.legal.licenseSourceUrl || '';
});
Template.registerHelper('deploymentBrandProfile', function() {
  return readPublishedDeploymentBrandProfile();
});
Template.registerHelper('brandText', function(key: string) {
  const localized = getLocalizedBrandContent(getActiveUiLocale()) as unknown as Record<string, string> | null;
  return localized?.[key] || '';
});
Template.registerHelper('brandLegalUrl', function(key: string) {
  const legal = readPublishedDeploymentBrandProfile()?.legal as unknown as Record<string, string> | undefined;
  return legal?.[key] || '';
});
Template.registerHelper('uiLocale', function() {
  return getActiveUiLocale();
});
Template.registerHelper('uiTextDirection', function() {
  return getPlatformTextDirection(getActiveUiLocale());
});
Template.registerHelper('t', function(key: string, options?: { hash?: Record<string, string | number | boolean> }) {
  return translatePlatformString(getActiveUiLocale(), key as PlatformStringKey, options?.hash);
});
Template.registerHelper('formatUiNumber', function(value: number) {
  return formatActiveInterfaceNumber(Number(value));
});
Template.registerHelper('formatUiPercent', function(value: number) {
  return formatActiveInterfacePercent(Number(value));
});
Template.registerHelper('formatUiDateTime', function(value: Date | number | string) {
  return formatActiveInterfaceDateTime(value);
});
Template.registerHelper('currentTemplate', function() {
  return Session.get('currentTemplate');
});
Template.registerHelper('modalTemplate', function() {
  const modalTemplate = Session.get('modalTemplate');
  clientConsole(2, 'modalTemplate:', JSON.stringify(modalTemplate));
  return modalTemplate.template;
});
Template.registerHelper('isLoggedIn', function() {
  return Meteor.userId() !== null;
});
Template.registerHelper('showAuthenticatedAppChrome', function() {
  return getAuthenticatedChromeMode() !== 'none';
});
Template.registerHelper('themeBootstrapClass', function() {
  return Session.get('themeReady') === true
    ? 'theme-bootstrap-ready'
    : 'theme-bootstrap-pending';
});
Template.registerHelper('isPracticeChrome', function() {
  return getAuthenticatedChromeMode() === 'practice';
});
Template.registerHelper('showAppFooter', function() {
  if (getAuthenticatedChromeMode() === 'practice') {
    return false;
  }
  const routePresentation = managementRoutePresentation.get();
  const currentTemplate = String(Session.get('currentTemplate') || '');
  if (routePresentation.status === 'idle') {
    return currentTemplate === 'home';
  }
  if (routePresentation.status === 'ready') {
    return currentTemplate === routePresentation.targetTemplate;
  }
  return routePresentation.status === 'error'
    && currentTemplate === 'managementRouteError';
});
Template.registerHelper('appChromeClass', function() {
  const mode = getAuthenticatedChromeMode();
  if (mode === 'practice') return 'practice-app';
  if (mode === 'app') return 'tool-app';
  return '';
});
Template.registerHelper('appMainClass', function() {
  return getAuthenticatedChromeMode() === 'practice' ? 'practice-main' : '';
});
Template.registerHelper('appHeaderClass', function() {
  return getAuthenticatedChromeMode() === 'practice' ? 'practice-top-header' : '';
});
Template.registerHelper('appContentClass', function() {
  return getAuthenticatedChromeMode() === 'practice' ? 'practice-content' : 'tool-content';
});
Template.registerHelper('appShellTitle', function() {
  if (getAuthenticatedChromeMode() === 'practice') {
    return getPracticeLessonTitle();
  }
  if (Session.get('currentTemplate') === 'learningAnalytics') {
    return getLearningAnalyticsStrings(getActiveUiLocale()).title;
  }
  const routePresentation = managementRoutePresentation.get();
  if (routePresentation.status === 'idle') {
    return translatePlatformString(getActiveUiLocale(), 'home.practice');
  }
  return translatePlatformString(getActiveUiLocale(), routePresentation.titleKey);
});
Template.registerHelper('managementRouteErrorMessage', function() {
  const routePresentation = managementRoutePresentation.get();
  return routePresentation.status === 'error' ? routePresentation.message : '';
});
Template.registerHelper('managementRouteCanRetry', function() {
  const routePresentation = managementRoutePresentation.get();
  return routePresentation.status === 'error' && routePresentation.retryable;
});
Template.registerHelper('appShellUnderlayStyle', function() {
  const theme = Session.get('curTheme') as any;
  const url = theme?.properties?.practice_menu_underlay_image_url;
  if (typeof url !== 'string' || url.trim().length === 0) {
    return '';
  }
  const escapedUrl = url.trim().replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `--practice-menu-underlay-image: url("${escapedUrl}");`;
});
Template.registerHelper('showPageNumbers', function() {
  return Session.get('showPageNumbers');
})
Template.registerHelper('currentUnitNumber', function() {
  if(Session.get('currentUnitNumber'))
    return parseInt(Session.get('currentUnitNumber')) + 1;
  return 0;
})
Template.registerHelper('lastUnitNumber', function() {
  if(Session.get('currentTdfFile'))
    return Session.get('currentTdfFile').tdfs.tutor.unit.length + 1;
  return 0;
})
Template.registerHelper('currentScore', function() {
  return getCurrentScore();
});

Template.registerHelper('isNormal', function() {
  return Session.get('loginMode') !== 'experiment';
});
Template.registerHelper('curStudentPerformance', function() {
  return Session.get('curStudentPerformance');
});
Template.registerHelper('isInTrial', function() {
  return Session.get('curModule') == 'content' || Session.get('curModule') == 'instructions';
});
Template.registerHelper('isInInstructions', function() {
  return Session.get('curModule') == 'instructions';
});
Template.registerHelper('isInSession', function() {
  return (Session.get('curModule') == 'profile');
});
// Memoization cache for curTdfTips to avoid re-sanitizing unchanged tips
let _lastTipsRaw: string[] | null = null;
let _lastTipsSanitized: string[] = [];

Template.registerHelper('curTdfTips', function() {
  const tips = Session.get('curTdfTips');
  if (!tips || tips.length === 0) {
    _lastTipsRaw = null;
    _lastTipsSanitized = [];
    return [];
  }
  // Only re-sanitize if tips array has changed (shallow comparison)
  if (_lastTipsRaw !== tips) {
    _lastTipsRaw = tips;
    _lastTipsSanitized = tips.map((tip: string) => sanitizeHTML(tip));
  }
  return _lastTipsSanitized;
});
Template.registerHelper('and',(a: unknown, b: unknown)=>{
  return a && b;
});
Template.registerHelper('or',(a: unknown, b: unknown)=>{
  return a || b;
});

// Global app loading state for elegant transitions (dashboard → first trial)
Template.registerHelper('appLoading', function() {
  return Session.get('appLoading');
});
Template.registerHelper('appLoadingMessage', function() {
  return Session.get('appLoadingMessage') || translatePlatformString(getActiveUiLocale(), 'common.loading');
});
Template.registerHelper('uiMessage', function() {
  const uiMessage = Session.get('uiMessage');
  if (!uiMessage) {
    return null;
  }
  return {
    variant: uiMessage.variant || 'danger',
    text: uiMessage.text || ''
  };
});

function getStartupDiagnosticCandidate(): { variant: string; text: string } | null {
  const connected = Meteor.status?.().connected ?? true;
  if (!connected) {
    return {
      variant: 'warning',
      text: translatePlatformString(getActiveUiLocale(), 'startup.waitingRealtimeConnection')
    };
  }

  if (Session.get('themeReady') !== true) {
    return {
      variant: 'info',
      text: translatePlatformString(getActiveUiLocale(), 'startup.loadingSiteAppearance')
    };
  }

  if (Session.get('authReady') !== true || Meteor.loggingIn()) {
    return {
      variant: 'info',
      text: translatePlatformString(getActiveUiLocale(), 'startup.checkingSignInStatus')
    };
  }

  const userId = Meteor.userId();
  if (userId && Session.get('authRolesHydrated') !== true) {
    return {
      variant: 'info',
      text: translatePlatformString(getActiveUiLocale(), 'startup.loadingAccountPermissions')
    };
  }

  if (userId && Session.get('authRolesSyncedUserId') !== userId) {
    return {
      variant: 'info',
      text: translatePlatformString(getActiveUiLocale(), 'startup.refreshingAccountPermissions')
    };
  }

  return null;
}

function resetStartupDiagnosticDelay(): void {
  startupDiagnosticPendingKey = null;
  startupDiagnosticPendingSince = null;
  if (startupDiagnosticVisibilityTimer) {
    clearTimeout(startupDiagnosticVisibilityTimer);
    startupDiagnosticVisibilityTimer = null;
  }
}

Template.registerHelper('startupDiagnostic', function() {
  Session.get('startupDiagnosticTick');
  const elapsed = Date.now() - startupDiagnosticsStartedAt;
  if (elapsed < STARTUP_DIAGNOSTIC_GRACE_MS) {
    resetStartupDiagnosticDelay();
    return null;
  }

  const diagnostic = getStartupDiagnosticCandidate();
  if (!diagnostic) {
    resetStartupDiagnosticDelay();
    return null;
  }

  const diagnosticKey = `${diagnostic.variant}:${diagnostic.text}`;
  if (startupDiagnosticPendingKey !== diagnosticKey || startupDiagnosticPendingSince === null) {
    startupDiagnosticPendingKey = diagnosticKey;
    startupDiagnosticPendingSince = Date.now();
  }

  const visibleDelayElapsed = Date.now() - startupDiagnosticPendingSince;
  if (visibleDelayElapsed < STARTUP_DIAGNOSTIC_VISIBLE_DELAY_MS) {
    if (!startupDiagnosticVisibilityTimer) {
      startupDiagnosticVisibilityTimer = setTimeout(() => {
        startupDiagnosticVisibilityTimer = null;
        Session.set('startupDiagnosticTick', Date.now());
      }, STARTUP_DIAGNOSTIC_VISIBLE_DELAY_MS - visibleDelayElapsed);
    }
    return null;
  }

  return diagnostic;
});


