import {meteorCallAsync} from '..';
import { haveMeteorUser } from './userIdentity';
import {instructContinue, unitHasLockout} from '../views/experiment/instructions';
import {Cookie} from './cookies';
import {displayify} from '../../common/globalHelpers';
import {selectTdf} from './lessonLaunchRunner';
import { buildActiveLessonRouteLocation } from './activeLessonRoute';
import {clientConsole} from '../index';
import { setIgnoreOutOfGrammarResponses } from '../views/experiment/svelte/services/audioRuntimeState';
import { Tracker } from 'meteor/tracker';
import {currentUserHasRole} from './roleUtils';
import { clearMappingRecordFromSession } from '../views/experiment/svelte/services/mappingRecordService';
import { ensureCurrentStimuliSetId } from '../views/experiment/svelte/services/mediaResolver';
import {
  assertIdInvariants,
  setActiveTdfContext,
  setExperimentParticipantContext,
} from './idContext';
import { legacyInt, legacyTrim } from '../../common/underscoreCompat';
import { getErrorMessage } from './errorUtils';
import { CARD_ENTRY_INTENT, setCardEntryIntent } from './cardEntryIntent';
import { isLaunchLoadingActive } from './launchLoading';
import {
  getManagementRoutePolicyByRouteName,
  getManagementRoutePolicyByTemplate,
  type ManagementRoutePresentationPolicy,
  type RouteAccessPolicy,
} from './adminUi/managementRoutePresentationPolicies';
import { managementRoutePresentation } from './adminUi/routePresentationState';
import { resolveSpeechIgnoreOutOfGrammarResponses } from './speechRecognitionConfig';
import { translatePlatformString } from './interfaceI18n';
import { getActiveUiLocale } from './interfaceLocaleState';
import { hasPublicCreatorDisplayName } from './contentCreatorIdentity';
import {
  LEARNING_ANALYTICS_DESTINATION,
  resolveNormalLoginDestination,
  type NormalLoginReturnDestination,
} from './normalLoginDestination';
import {
  getCourseAssignmentLaunchContext,
  setCourseAssignmentLaunchContext,
} from './courseAssignmentLaunchContext';
import { getPracticeLaunchMode, setPracticeLaunchMode } from './practiceLaunchMode';
import { resolveLessonRouteRequest, type LessonRouteRequest } from './lessonRoute';
import { publicExperienceText } from '../views/publicExperience/publicExperienceI18n';
import { isPublicDemoKind } from '../../common/publicDemoContract';
import { clearStoredPublicDemoSession, isPublicDemoAccount, publicDemoOverviewPath } from './publicDemoSession';
const { FlowRouter } = require('meteor/ostrio:flow-router-extra');
const Tdfs: any = (globalThis as any).Tdfs;
const COURSE_ASSIGNMENT_DIRECT_LAUNCH_DENIED_REASON = 'Launch this TDF through its active course assignment';

export {routeToSignin};

/* router.js - the routing logic we use for the application.

If you need to create a new route, note that you should specify a name and an
action (at a minimum). This is good practice, but it also works around a bug
in Chrome with certain versions of Iron Router (they routing engine we use).

IMPORTANT: If you are routing someone to the signin screen (i.e. they need to
log in) then you should call the routeToSignin function of calling Router.go
directly. This is important to make sure that both "normal" logins *and*
experimental participant (Mechanical Turk) logins function correctly.

The routes are self-explanatory, but "loginMode" requires a little explanation.
When a user enters the application via a URL of the form /experiment/{target}/{x}
they are placed in "experiment" mode. The following changes are made:

    * The session var "loginMode" is set to "experiment" (instead of "normal")
    * The session var "experimentTarget" is set to whatever is specified in
      {target} in the URL. This is required.
    * The session var "experimentXCond" is set to whatever is specified in {x}
      in the URL. This defaults to 0. The default value is used if the value
      given cannot be interpreted as an int.
    * The user is NOT shown the OAuth "Sign In With Google" screen. Instead a
      screen for user ID entry (which should be their Turk ID) is shown instead
    * The user isn't allowed to select a TDF - the TDF matching {target} is
      always chosen. (This is specified in the <experimentTarget> tag in the
      top TDF setspec section).

As an example, if a user navigates to
    https://mofacts.optimallearning.org/experiment/learning/1
then the following things will happen:

    * Session["loginMode"] == "experiment"
    * Session["experimentTarget"] == "learning"
    * Session["experimentXCond"] == "1"
    * The user is asked for an ID
    * After entering the ID, the user is taken to the TDF with
      <experimentTarget>learning</experimentTarget> in it's setspec

As an example of XCond defaults, the following URL's are ALL equivalent:

    * https://mofacts.optimallearning.org/experiment/learning/
    * https://mofacts.optimallearning.org/experiment/learning/0
    * https://mofacts.optimallearning.org/experiment/learning/abc

A major issue is that once a user enters in experiment mode, the routes (like
instructions and content) look the same. If the user uses the browser's refresh
function, our logic will take them to the "normal" sign in screen. Since we
allow login via Gmail account this could be confusing. As a result, we now use
a cookie scheme to insure experimental participants stay in experiment mode:

    * When a user first hits the URL /experiment/{target}/{x} we write cookies
      (with expiration set so that they outlast the current browser session)
    * Whenever routeToSignin is called, we check the cookies. If they are set
      then we reconstruct the experiment session variables as above.
    * If a user visits the root ("/") route, we reset all cookies back in order
      to allow "normal" login again.
*/

function clearAppLoadingUnlessLaunch(): void {
  if (!isLaunchLoadingActive()) {
    Session.set('appLoading', false);
  }
}

// Note that these three session variables aren't touched by the helpers in
// lib/sessionUtils.js. They are only set here in our client-side routing
Session.set('loginMode', 'normal');
Session.set('experimentTarget', '');
Session.set('experimentXCond', '');
clearMappingRecordFromSession();

// Flow Router doesn't need configure() - this.render() specifies layout per-route
let contentSubsWaitHandle: any = null;
let rootUserWaitHandle: any = null;
const pendingAuthRouteHandles: Record<string, any> = {};

type RouteAccessDecision = 'allow' | 'signin' | 'forbidden';
type UserWithLoginParams = Meteor.User & { loginParams?: { loginMode?: string } };
type UserWithAuthState = Meteor.User & {
  profile?: { experiment?: boolean | string };
  authState?: { primaryMethod?: string; emailVerificationRequired?: boolean; emailVerified?: boolean };
  emails?: Array<{ verified?: boolean; address?: string }>;
};
type PendingClassInvite = {
  teacherId: string;
  sectionId: string;
};

const PENDING_CLASS_INVITE_KEY = 'mofacts.pendingClassInvite.v1';

function getUserLoginMode(user: Meteor.User | null | undefined): string {
  return (user as UserWithLoginParams | null | undefined)?.loginParams?.loginMode || 'normal';
}

function shouldRedirectToVerifyEmail(user: Meteor.User | null | undefined): boolean {
  const currentUser = user as UserWithAuthState | null | undefined;
  if (!currentUser || currentUser?.profile?.experiment === true || currentUser?.profile?.experiment === 'true') {
    return false;
  }
  const primaryMethod = String(currentUser?.authState?.primaryMethod || '').toLowerCase();
  if (primaryMethod && primaryMethod !== 'password') {
    return false;
  }
  const verificationRequired = currentUser?.authState?.emailVerificationRequired === true;
  const emailVerified = currentUser?.authState?.emailVerified === true || currentUser?.emails?.[0]?.verified === true;
  return verificationRequired && !emailVerified;
}

function isAuthStateSettled() {
  return Session.get('authReady') === true;
}

function shouldWaitForAuthHydration() {
  const currentUserId = Meteor.userId();
  const currentUser = Meteor.user();
  return !isAuthStateSettled() || Meteor.loggingIn() || (!!currentUserId && !currentUser);
}

function userMatchesAllowedRoles(policy: RouteAccessPolicy): boolean {
  if (!policy.allowedRoles) {
    return true;
  }
  return currentUserHasRole(policy.allowedRoles);
}

function evaluateRouteAccess(policy: RouteAccessPolicy): RouteAccessDecision {
  if (!policy.requiresAuth) {
    return 'allow';
  }

  const userId = Meteor.userId();
  const user = Meteor.user();
  if (!userId || !user) {
    return 'signin';
  }

  if (!userMatchesAllowedRoles(policy)) {
    return 'forbidden';
  }

  return 'allow';
}

function routeDeniedUserToEntryPoint(): void {
  if (Meteor.userId()) {
    FlowRouter.go('/home');
    return;
  }

  routeToSignin();
}

function normalizeRouteParam(value: unknown): string {
  return String(value || '').trim();
}

function readPendingClassInvite(): PendingClassInvite | null {
  try {
    const raw = window.localStorage.getItem(PENDING_CLASS_INVITE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingClassInvite>;
    const teacherId = normalizeRouteParam(parsed.teacherId);
    const sectionId = normalizeRouteParam(parsed.sectionId);
    return teacherId && sectionId ? { teacherId, sectionId } : null;
  } catch {
    return null;
  }
}

function writePendingClassInvite(invite: PendingClassInvite): void {
  try {
    window.localStorage.setItem(PENDING_CLASS_INVITE_KEY, JSON.stringify(invite));
  } catch (error: unknown) {
    clientConsole(1, '[ROUTER] Failed to store class invitation before sign-in:', getErrorMessage(error));
  }
}

function clearPendingClassInvite(): void {
  try {
    window.localStorage.removeItem(PENDING_CLASS_INVITE_KEY);
  } catch (error: unknown) {
    clientConsole(1, '[ROUTER] Failed to clear pending class invitation:', getErrorMessage(error));
  }
}

async function acceptClassInvite(teacherId: string, sectionId: string): Promise<void> {
  const userId = Meteor.userId();
  if (!userId) {
    throw new Error('Class invitation requires a signed-in learner.');
  }

  const [teachers, sections] = await Promise.all([
    meteorCallAsync('getAllTeachers') as Promise<any[]>,
    meteorCallAsync('getAllCourseSections') as Promise<any[]>,
  ]);
  const teacher = Array.isArray(teachers)
    ? teachers.find((row: any) => normalizeRouteParam(row?._id) === teacherId)
    : null;
  const curClass = Array.isArray(sections)
    ? sections.find((row: any) => normalizeRouteParam(row?.sectionId) === sectionId)
    : null;

  await meteorCallAsync('addUserToTeachersClass', teacherId, sectionId);
  const assignedTdfIds = await meteorCallAsync('getTdfsAssignedToStudent', userId, sectionId);
  await meteorCallAsync(
    'setUserLoginData',
    'section-invite',
    Session.get('loginMode') || 'password',
    teacher || { _id: teacherId },
    curClass || { sectionId, teacherUserId: teacherId },
    assignedTdfIds
  );
  Session.set('curTeacher', teacher || { _id: teacherId });
  Session.set('curClass', curClass || { sectionId, teacherUserId: teacherId });
}

function consumePendingClassInvite(controller: any = null): boolean {
  const pendingInvite = readPendingClassInvite();
  if (!pendingInvite) return false;
  clearPendingClassInvite();
  renderLayout(controller, 'customLoading');
  void acceptClassInvite(pendingInvite.teacherId, pendingInvite.sectionId)
    .then(() => {
      FlowRouter.go('/courses');
    })
    .catch((error: unknown) => {
      clientConsole(1, '[ROUTER] Failed to accept class invitation:', getErrorMessage(error));
      Session.set('classSelectionRouteMessage', {
        variant: 'error',
        text: translatePlatformString(getActiveUiLocale(), 'route.classJoinFailed'),
      });
      FlowRouter.go('/classSelection');
    });
  return true;
}

// Load infrequently-used route modules on demand to keep the initial client bundle smaller.
const lazyTemplateLoaders: Record<string, any> = {
  content: () => import('../views/experiment/contentRoute'),
  experimentError: () => import('../views/experimentError'),
  sparcEdit: () => import('../views/experimentSetup/sparcEdit'),
};

const loadedLazyTemplates = new Set();

async function ensureTemplateModuleLoaded(templateName: any) {
  const loader = lazyTemplateLoaders[templateName];
  if (!loader || loadedLazyTemplates.has(templateName)) {
    return;
  }

  await loader();
  loadedLazyTemplates.add(templateName);
}

function currentRoutePath(): string {
  return `${window.location.pathname}${window.location.search}`;
}

function prepareManagementRoutePresentation(
  policy: ManagementRoutePresentationPolicy,
): number {
  const path = currentRoutePath();
  const current = managementRoutePresentation.get();
  if (
    current.status === 'loading'
    && current.routeName === policy.routeName
    && current.path === path
  ) {
    return current.navigationGeneration;
  }

  const generation = managementRoutePresentation.begin(policy, path, () => {
    FlowRouter.reload();
  });
  return generation;
}

async function renderRouteTemplate(controller: any, templateName: any) {
  const managementPolicy = getManagementRoutePolicyByTemplate(String(templateName));
  if (managementPolicy) {
    const generation = prepareManagementRoutePresentation(managementPolicy);
    try {
      await managementPolicy.load();
      if (!managementRoutePresentation.isCurrent(generation)) {
        return;
      }
      if (!Template[managementPolicy.template]) {
        throw new Error(`Loaded module did not register template ${managementPolicy.template}.`);
      }
      if (!managementRoutePresentation.resolve(generation)) {
        return;
      }
      renderLayout(controller, managementPolicy.template);
    } catch (error: unknown) {
      if (!managementRoutePresentation.fail(generation, getErrorMessage(error), true)) {
        return;
      }
      clientConsole(
        1,
        '[ROUTER] Failed to present management route',
        managementPolicy.routeName,
        getErrorMessage(error),
      );
      renderLayout(controller, 'managementRouteError');
    }
    return;
  }

  await ensureTemplateModuleLoaded(templateName);
  if (!Template[templateName]) {
    throw new Error(`Loaded module did not register template ${templateName}.`);
  }
  renderLayout(controller, templateName);
}

function renderLayout(controller: any, templateName: any) {
  clientConsole(2, '[ROUTER] renderLayout called with template:', templateName);
  const managementPolicy = getManagementRoutePolicyByTemplate(String(templateName));
  const isManagementPresentationFrame = templateName === 'managementRouteError';
  if (!managementPolicy && !isManagementPresentationFrame) {
    managementRoutePresentation.clear();
  }
  Session.set('currentTemplate', templateName);
  clientConsole(2, '[ROUTER] Session currentTemplate set to:', templateName);

  if (!Template[templateName]) {
    throw new Error(`Template ${templateName} is not registered.`);
  }
  if (!controller || typeof controller.render !== 'function') {
    throw new Error(`Route controller cannot render DefaultLayout for ${templateName}.`);
  }

  controller.render('DefaultLayout');
  clientConsole(2, '[ROUTER] Rendered DefaultLayout through the Flow Router controller');
}

function renderContentSubscriptionWaitOnlyWhenCold(controller: any): void {
  if (!Session.get('currentTemplate')) {
    renderLayout(controller, 'customLoading');
  }
}

function renderHomeForUser(controller: any, user: any) {
  if (isPublicDemoAccount(user)) {
    clientConsole(2, '[ROUTER] Public demo completed or exited, returning to overview');
    FlowRouter.go('/auth/logout');
    return;
  }

  const loginMode = getUserLoginMode(user);
  clientConsole(2, '[ROUTER] renderHomeForUser - loginMode:', loginMode);

  if (loginMode === 'experiment') {
    clientConsole(2, '[ROUTER] Experiment mode detected, redirecting to signIn');
    Cookie.set('isExperiment', '0', 1); // 1 day
    Cookie.set('experimentTarget', '', 1);
    Cookie.set('experimentXCond', '', 1);
    Session.set('curModule', 'signinoauth');
    FlowRouter.go('/auth/login');
    return;
  }

  if (shouldRedirectToVerifyEmail(user)) {
    clientConsole(2, '[ROUTER] Unverified password user detected, redirecting to verify-email');
    FlowRouter.go('/auth/verify-email');
    return;
  }

  if (consumePendingClassInvite(controller)) {
    return;
  }

  clientConsole(2, '[ROUTER] Normal mode, rendering home page');
  Session.set('curModule', 'home');
  renderLayout(controller, 'home');
  clientConsole(2, '[ROUTER] renderLayout returned, currentTemplate should be home');
  clientConsole(2, '[ROUTER] Session.get(currentTemplate):', Session.get('currentTemplate'));
}

function handleIndexRoute(controller: any, user: any) {
  if (user) {
    if (isPublicDemoAccount(user)) {
      FlowRouter.go('/auth/logout');
      return;
    }
    if (getUserLoginMode(user) === 'experiment') {
      routeToSignin();
      return;
    }
    FlowRouter.go('/home');
    return;
  }

  // If no user is logged in and they are navigating to "/" then we clear the
  // (possible) cookie keeping them in experiment mode.
  Cookie.set('isExperiment', '0', 1); // 1 day
  Cookie.set('experimentTarget', '', 1);
  Cookie.set('experimentXCond', '', 1);
  Session.set('curModule', 'signinoauth');
  renderLayout(controller, 'publicLanding');
}

function routeToSignin(returnTo?: NormalLoginReturnDestination) {
  // If the isExperiment cookie is set we always for experiment mode. This
  // handles an experimental participant refreshing the browser
  const expCookie = legacyInt(legacyTrim(Cookie.get('isExperiment')));
  if (expCookie) {
    Session.set('loginMode', 'experiment');
    Session.set('experimentTarget', Cookie.get('experimentTarget'));
    Session.set('experimentXCond', Cookie.get('experimentXCond'));
  }

  const loginMode = Session.get('loginMode');

  if (loginMode === 'experiment') {
    const routeParts = ['/experiment'];

    const target = Session.get('experimentTarget');
    if (target) {
      routeParts.push(target);
      const xcond = Session.get('experimentXCond');
      if (xcond) {
        routeParts.push(xcond);
      }
    }

    FlowRouter.go(routeParts.join('/'));
  } else if (returnTo) {
    FlowRouter.go('/auth/login', {}, { returnTo });
  } else { // Normal login mode
    FlowRouter.go('/auth/login');
  }
}

function ensureStimuliSetIdSessionInvariant() {
  const currentTdfId = Session.get('currentTdfId') || Session.get('currentRootTdfId');
  if (!currentTdfId) {
    return;
  }

  const currentTdfDoc = Tdfs?.findOne?.({ _id: currentTdfId });
  const tdfStimuliSetId = currentTdfDoc?.stimuliSetId;
  if (tdfStimuliSetId !== undefined && tdfStimuliSetId !== null && String(tdfStimuliSetId).trim() !== '') {
    setActiveTdfContext({
      currentRootTdfId: Session.get('currentRootTdfId'),
      currentTdfId: Session.get('currentTdfId') || Session.get('currentRootTdfId'),
      currentStimuliSetId: tdfStimuliSetId,
    }, 'router.ensureStimuliSetIdSessionInvariant');
    return;
  }
  ensureCurrentStimuliSetId(tdfStimuliSetId);
}

async function logoutCurrentUserForExperimentRoute() {
  if (!Meteor.userId()) {
    return;
  }
  await new Promise<void>((resolve) => {
    Meteor.logout((error?: unknown) => {
      if (error) {
        clientConsole(1, '[ROUTER] Logout before experiment sign-in failed:', getErrorMessage(error));
      }
      resolve();
    });
  });
}

FlowRouter.route('/experiment/:target?/:xcond?', {
  name: 'client.experiment',
  action: async function(params: any) {
    const target = params.target || '';
    const xcond = params.xcond || '';

    // Subscribe to TDF
    Meteor.subscribe('tdfByExperimentTarget', target);

    Session.set('useEmbeddedAPIKeys', true);
    Session.set('curModule', 'experiment');
    // We set our session variable and also set a cookie (so that we still
    // know they're an experimental participant after browser refresh)

    Session.set('loginMode', 'experiment');
    Session.set('experimentTarget', target);
    Session.set('experimentXCond', xcond);
    Session.set('tdfLaunchMode', 'root-random');
    Session.set('tdfFamilyRootTdfId', null);
    setExperimentParticipantContext({ experimentTarget: target }, 'router.experimentRoute');

    Cookie.set('isExperiment', '1', 21); // 21 days
    Cookie.set('experimentTarget', target, 21);
    Cookie.set('experimentXCond', xcond, 21);

    let tdf = Tdfs.findOne({"content.tdfs.tutor.setspec.experimentTarget": target});

    if(!tdf) tdf = await meteorCallAsync('getTdfByExperimentTarget', target);

    if (tdf) {

      if (tdf.content.tdfs.tutor.setspec.condition){
        Meteor.subscribe('tdfByExperimentTarget', target)
      }
      clientConsole(2, 'tdf found');
      // Security: Replace eval() with safe boolean check
      const experimentPasswordRequired =
        tdf.content.tdfs.tutor.setspec.experimentPasswordRequired === 'true' ||
        tdf.content.tdfs.tutor.setspec.experimentPasswordRequired === true;
      Session.set('experimentPasswordRequired', experimentPasswordRequired);
      Session.set('loginPrompt',tdf.content.tdfs.tutor.deliverySettings?.experimentLoginText || "Amazon Turk ID");
      clientConsole(2, 'experimentPasswordRequired:', experimentPasswordRequired);

      clientConsole(2, 'EXPERIMENT target:', target, 'xcond', xcond);

      clearMappingRecordFromSession();
      Session.set('suppressAuthenticatedChrome', false);
      clearAppLoadingUnlessLaunch();

      // Log out first, then render sign-in to avoid transient route/auth race states.
      await logoutCurrentUserForExperimentRoute();
      renderLayout(this, 'signIn');

    } else {
      clientConsole(1, 'tdf not found');
      alert(translatePlatformString(getActiveUiLocale(), 'route.experimentNotFound'));
      if (Meteor.user()) {
        Meteor.logout();
      }
      window.location.href = '/';
    }
  },
});

const restrictedRoutes = [
  'multiTdfSelect',
  'userAdmin',
  'tdfAssignmentEdit',
  'instructorReporting',
];

function getRouteAccessPolicy(routeName: string): RouteAccessPolicy {
  const policy = getManagementRoutePolicyByRouteName(routeName);
  if (policy) {
    return policy;
  }
  if (routeName === 'client.multiTdfSelect') {
    return { requiresAuth: true };
  }
  throw new Error(`No route access policy is registered for ${routeName}.`);
}

function waitForAuthenticatedRoute(
  controller: any,
  routeName: string,
  onReady: (user: any) => void | Promise<void>,
  policy: RouteAccessPolicy = { requiresAuth: true },
  signInReturnDestination?: NormalLoginReturnDestination
) {
  const managementPolicy = getManagementRoutePolicyByRouteName(routeName);
  if (managementPolicy) {
    prepareManagementRoutePresentation(managementPolicy);
  }
  const currentDecision = evaluateRouteAccess(policy);
  if (currentDecision === 'allow' && Session.get('themeReady') === true) {
    const user = Meteor.user();
    const existing = pendingAuthRouteHandles[routeName];
    if (existing) {
      existing.stop();
      delete pendingAuthRouteHandles[routeName];
    }
    void Promise.resolve(onReady(user as any)).catch((error: unknown) => {
      clientConsole(1, '[ROUTER] Auth-ready callback failed for', routeName, getErrorMessage(error));
    });
    return;
  }

  if (currentDecision === 'forbidden') {
    routeDeniedUserToEntryPoint();
    return;
  }

  if (
    !managementPolicy
    && currentDecision !== 'allow'
    && Session.get('themeReady') === true
  ) {
    renderLayout(controller, 'customLoading');
  }
  if (pendingAuthRouteHandles[routeName]) {
    return;
  }

  pendingAuthRouteHandles[routeName] = Tracker.autorun(() => {
    const currentRoute = FlowRouter.current()?.route?.name;
    if (currentRoute !== routeName) {
      pendingAuthRouteHandles[routeName]?.stop();
      delete pendingAuthRouteHandles[routeName];
      return;
    }

    const deferredDecision = evaluateRouteAccess(policy);
    if (deferredDecision === 'allow') {
      if (Session.get('themeReady') !== true) {
        return;
      }
      const currentUser = Meteor.user();
      pendingAuthRouteHandles[routeName]?.stop();
      delete pendingAuthRouteHandles[routeName];
      void Promise.resolve(onReady(currentUser)).catch((error: unknown) => {
        clientConsole(1, '[ROUTER] Deferred auth-ready callback failed for', routeName, getErrorMessage(error));
      });
      return;
    }

    if (deferredDecision === 'forbidden') {
      pendingAuthRouteHandles[routeName]?.stop();
      delete pendingAuthRouteHandles[routeName];
      routeDeniedUserToEntryPoint();
      return;
    }

    if (!Meteor.userId() && !Meteor.loggingIn()) {
      if (shouldWaitForAuthHydration()) return;
      pendingAuthRouteHandles[routeName]?.stop();
      delete pendingAuthRouteHandles[routeName];
      const currentPath = (FlowRouter.current() as { path?: string } | undefined)?.path;
      routeToSignin(signInReturnDestination ?? resolveNormalLoginDestination(currentPath));
    }
  });
}

function waitForPublicAuthHydration(
  controller: any,
  routeName: string,
  onReady: () => void
) {
  renderLayout(controller, 'customLoading');
  if (pendingAuthRouteHandles[routeName]) {
    return;
  }

  pendingAuthRouteHandles[routeName] = Tracker.autorun(() => {
    const currentRoute = FlowRouter.current()?.route?.name;
    if (currentRoute !== routeName) {
      pendingAuthRouteHandles[routeName]?.stop();
      delete pendingAuthRouteHandles[routeName];
      return;
    }

    if (shouldWaitForAuthHydration()) {
      return;
    }

    pendingAuthRouteHandles[routeName]?.stop();
    delete pendingAuthRouteHandles[routeName];
    onReady();
  });
}

const getRestrictedRouteAction = function(routeName: any) {
  return async function(this: any) {
    const fullRouteName = 'client.' + routeName;
    waitForAuthenticatedRoute(this, fullRouteName, async () => {
      await renderRouteTemplate(this, routeName);
    }, getRouteAccessPolicy(fullRouteName));
  };
};


// set up all routes with default behavior
for (const route of restrictedRoutes) {
  FlowRouter.route('/' + route, {
    name: 'client.' + route,
    action: getRestrictedRouteAction(route),
  });
}

async function renderSignInRoute(controller: any) {
  if (shouldWaitForAuthHydration()) {
    waitForPublicAuthHydration(controller, 'client.authLogin', () => {
      void renderSignInRoute(controller);
    });
    return;
  }

  const userId = Meteor.userId();
  const user = Meteor.user();
  if (userId && !user) {
    waitForPublicAuthHydration(controller, 'client.authLogin', () => {
      void renderSignInRoute(controller);
    });
    return;
  }
  if (user?.profile?.createdBy === 'publicDemo') {
    FlowRouter.go('/auth/logout');
    return;
  }
  if (user && getUserLoginMode(user) !== 'experiment') {
    FlowRouter.go('/home');
    return;
  }
  Session.set('curModule', 'signinoauth');
  renderLayout(controller, 'signIn');
}

function renderSignUpRoute(controller: any) {
  if (Meteor.userId()) {
    FlowRouter.go('/home');
    return;
  }
  renderLayout(controller, 'signUp');
}

function renderPasswordResetRoute(controller: any, mode: 'request' | 'reset') {
  Session.set('passwordResetMode', mode);
  renderLayout(controller, 'resetPassword');
}

//special routes
FlowRouter.route('/auth/signup', {
  name: 'client.authSignUp',
  action: function() {
    renderSignUpRoute(this);
  }
});

FlowRouter.route('/auth/login', {
  name: 'client.authLogin',
  action: function() {
    void renderSignInRoute(this);
  }
});

FlowRouter.route('/auth/forgot-password', {
  name: 'client.authForgotPassword',
  action: function() {
    renderPasswordResetRoute(this, 'request');
  }
});

FlowRouter.route('/auth/reset-password', {
  name: 'client.authResetPassword',
  action: function() {
    renderPasswordResetRoute(this, 'reset');
  }
});

FlowRouter.route('/auth/verify-email', {
  name: 'client.authVerifyEmail',
  action: function() {
    renderLayout(this, 'verifyEmail');
  }
});

FlowRouter.route('/auth/logout', {
  name: 'client.authLogout',
  action: async function() {
    try {
      await meteorCallAsync('recordSessionRevocation', 'auth-route-logout');
    } catch (error) {
      clientConsole(1, '[AUTH] Failed to record logout revocation event:', getErrorMessage(error));
    }
    await new Promise<void>((resolve) => Meteor.logout(() => resolve()));
    Session.set('loginMode', 'normal');
    Cookie.set('isExperiment', '0', 1);
    Cookie.set('experimentTarget', '', 1);
    Cookie.set('experimentXCond', '', 1);
    clearStoredPublicDemoSession();
    FlowRouter.go('/');
  }
});

FlowRouter.route('/demo/:kind', {
  name: 'client.publicDemo',
  action: function(params: any) {
    const kind = params?.kind;
    if (!isPublicDemoKind(kind)) {
      FlowRouter.go('/');
      return;
    }
    const renderDemo = () => {
      const user = Meteor.user();
      if (user && !isPublicDemoAccount(user)) {
        Session.set('uiMessage', {
          variant: 'info',
          text: publicExperienceText(getActiveUiLocale(), 'demoSignedIn'),
        });
        FlowRouter.go('/home');
        return;
      }
      if (isPublicDemoAccount(user)) {
        FlowRouter.go('/auth/logout');
        return;
      }
      FlowRouter.go(publicDemoOverviewPath(kind));
    };
    if (shouldWaitForAuthHydration()) {
      waitForPublicAuthHydration(this, 'client.publicDemo', renderDemo);
      return;
    }
    renderDemo();
  }
});

FlowRouter.route('/signup', {
  name: 'client.signUp',
  action: function() {
    FlowRouter.go('/auth/signup');
  }
});

FlowRouter.route('/signIn', {
  name: 'client.signIn',
  action: function() {
    FlowRouter.go('/auth/login');
  }
});

FlowRouter.route('/signin', {
  name: 'client.signin',
  action: function() {
    FlowRouter.go('/auth/login');
  }
});

FlowRouter.route('/resetPassword', {
  name: 'client.resetPassword',
  action: function() {
    const queryParams = FlowRouter.current()?.queryParams || {};
    const resetToken = queryParams.token;
    if (resetToken) {
      FlowRouter.go(`/auth/reset-password?${new URLSearchParams(queryParams as Record<string, string>).toString()}`);
      return;
    }
    FlowRouter.go('/auth/forgot-password');
  }
});

FlowRouter.route('/turkWorkflow', {
  name: 'client.turkWorkflow',
  action: getRestrictedRouteAction('turkWorkflow'),
})

FlowRouter.route('/dataDownload', {
  name: 'client.dataDownload',
  action: async function(this: any) {
    waitForAuthenticatedRoute(this, 'client.dataDownload', async () => {
      Session.set('curModule', 'dataDownload');
      await renderRouteTemplate(this, 'dataDownload');
    }, getRouteAccessPolicy('client.dataDownload'));
  }
})

FlowRouter.route('/accessDenied', {
  name: 'client.accessDenied',
  action: async function(this: any) {
    routeDeniedUserToEntryPoint();
  }
})

FlowRouter.route('/setTheme', {
  name: 'client.setTheme',
  action: function() {
    FlowRouter.go('/theme');
  }
})

FlowRouter.route('/experimentError', {
  name: 'client.experimentError',
  action: async function(this: any) {
    Session.set('curModule', 'experimentError');
    Session.set('suppressAuthenticatedChrome', true);
    clearAppLoadingUnlessLaunch();
    await renderRouteTemplate(this, 'experimentError');
  }
})

FlowRouter.route('/classSelection', {
  name: 'client.classSelection',
  action: function() {
    waitForAuthenticatedRoute(this, 'client.classSelection', async (_readyUser: any) => {
      Session.set('curModule', 'classSelection');
      await renderRouteTemplate(this, 'classSelection');
    });
  }
})

FlowRouter.route('/classes/:teacherId/:sectionId', {
  name: 'client.classInvite',
  action: function(params: { teacherId?: string; sectionId?: string }) {
    const teacherId = normalizeRouteParam(params.teacherId);
    const sectionId = normalizeRouteParam(params.sectionId);
    if (!teacherId || !sectionId) {
      Session.set('classSelectionRouteMessage', {
        variant: 'error',
        text: translatePlatformString(getActiveUiLocale(), 'route.classLinkMissingInfo'),
      });
      FlowRouter.go('/classSelection');
      return;
    }

    writePendingClassInvite({ teacherId, sectionId });
    if (!Meteor.userId() || !Meteor.user()) {
      routeToSignin();
      return;
    }

    consumePendingClassInvite(this);
  }
})

FlowRouter.route('/help', {
  name: 'client.help',
  action: async function() {
    Session.set('curModule', 'help');
    await renderRouteTemplate(this, 'help');
  }
})

FlowRouter.route('/courses', {
  name: 'client.courses',
  action: function() {
    waitForAuthenticatedRoute(this, 'client.courses', async () => {
      Session.set('curModule', 'courses');
      await renderRouteTemplate(this, 'courses');
    }, getRouteAccessPolicy('client.courses'));
  }
})

FlowRouter.route('/terms-of-service', {
  name: 'client.termsOfService',
  action: function() {
    Session.set('curModule', 'termsOfService');
    renderLayout(this, 'termsOfService');
  }
})

FlowRouter.route('/legal', {
  name: 'client.legal',
  action: function() {
    Session.set('curModule', 'legalHub');
    renderLayout(this, 'legalHub');
  }
})

FlowRouter.route('/audioSettings', {
  name: 'client.audioSettings',
  action: async function() {
    waitForAuthenticatedRoute(this, 'client.audioSettings', async () => {
      Session.set('curModule', 'audioSettings');
      await renderRouteTemplate(this, 'audioSettings');
    });
  }
})

FlowRouter.route('/', {
  name: 'client.index',
  action: function() {
    if (shouldWaitForAuthHydration()) {
      Session.set('currentTemplate', 'customLoading');
      renderLayout(this, 'customLoading');
      if (!rootUserWaitHandle) {
        const controller = this;
        rootUserWaitHandle = Tracker.autorun(() => {
          const isRootRoute = FlowRouter.current()?.route?.name === 'client.index';
          if (!isRootRoute) {
            rootUserWaitHandle?.stop();
            rootUserWaitHandle = null;
            return;
          }
          if (!shouldWaitForAuthHydration()) {
            rootUserWaitHandle?.stop();
            rootUserWaitHandle = null;
            handleIndexRoute(controller, Meteor.user());
          }
        });
      }
      return;
    }

    const userId = Meteor.userId();
    const user = Meteor.user();

    if (userId && !user) {
      Session.set('currentTemplate', 'customLoading');
      renderLayout(this, 'customLoading');
      if (!rootUserWaitHandle) {
        const controller = this;
        rootUserWaitHandle = Tracker.autorun(() => {
          const readyUser = Meteor.user();
          const isRootRoute = FlowRouter.current()?.route?.name === 'client.index';
          const isLoggedOut = !Meteor.userId();
          if ((readyUser || isLoggedOut) && isRootRoute) {
            rootUserWaitHandle.stop();
            rootUserWaitHandle = null;
            handleIndexRoute(controller, readyUser);
          } else if (!isRootRoute) {
            rootUserWaitHandle.stop();
            rootUserWaitHandle = null;
          }
        });
      }
      return;
    }

    handleIndexRoute(this, user);
  },
});

FlowRouter.route('/contentUpload', {
  name: 'client.contentUpload',
  action: async function(this: any) {
    waitForAuthenticatedRoute(this, 'client.contentUpload', async () => {
      await renderRouteTemplate(this, 'contentUpload');
    }, getRouteAccessPolicy('client.contentUpload'));
  }
})

FlowRouter.route('/contentCreate', {
  name: 'client.manualContentCreator',
  action: async function(this: any) {
    waitForAuthenticatedRoute(this, 'client.manualContentCreator', async (readyUser) => {
      if (!hasPublicCreatorDisplayName(readyUser)) {
        FlowRouter.go('/profile?contentCreator=required');
        return;
      }
      await renderRouteTemplate(this, 'manualContentCreator');
    }, getRouteAccessPolicy('client.manualContentCreator'));
  }
})

FlowRouter.route('/aiContentCreate', {
  name: 'client.aiContentCreator',
  action: async function(this: any) {
    waitForAuthenticatedRoute(this, 'client.aiContentCreator', async (readyUser) => {
      if (!hasPublicCreatorDisplayName(readyUser)) {
        FlowRouter.go('/profile?contentCreator=required');
        return;
      }
      await renderRouteTemplate(this, 'aiContentCreator');
    }, getRouteAccessPolicy('client.aiContentCreator'));
  }
})

FlowRouter.route('/contentEdit/:tdfId', {
  name: 'client.contentEdit',
  action: async function(params: any) {
    waitForAuthenticatedRoute(this, 'client.contentEdit', async () => {
      Session.set('editingTdfId', params.tdfId);
      await renderRouteTemplate(this, 'contentEdit');
    }, getRouteAccessPolicy('client.contentEdit'));
  }
})

FlowRouter.route('/sparcEdit/:tdfId', {
  name: 'client.sparcEdit',
  action: async function(params: any) {
    waitForAuthenticatedRoute(this, 'client.sparcEdit', async () => {
      Session.set('editingTdfId', params.tdfId);
      await renderRouteTemplate(this, 'sparcEdit');
    }, { requiresAuth: true });
  }
})

FlowRouter.route('/tdfEdit/:tdfId', {
  name: 'client.tdfEdit',
  action: async function(params: any) {
    waitForAuthenticatedRoute(this, 'client.tdfEdit', async () => {
      Session.set('editingTdfId', params.tdfId);
      await renderRouteTemplate(this, 'tdfEdit');
    }, getRouteAccessPolicy('client.tdfEdit'));
  }
})

FlowRouter.route('/adminControls', {
  name: 'client.adminControls',
  action: async function() {
    waitForAuthenticatedRoute(this, 'client.adminControls', async () => {
      await renderRouteTemplate(this, 'adminControls');
    }, getRouteAccessPolicy('client.adminControls'));
  }
})

FlowRouter.route('/admin/tests', {
  name: 'client.adminTests',
  action: async function() {
    waitForAuthenticatedRoute(this, 'client.adminTests', async () => {
      await renderRouteTemplate(this, 'testRunner');
    }, getRouteAccessPolicy('client.adminTests'));
  }
})

FlowRouter.route('/admin/backups', {
  name: 'client.adminBackups',
  action: async function() {
    waitForAuthenticatedRoute(this, 'client.adminBackups', async () => {
      await renderRouteTemplate(this, 'adminBackups');
    }, getRouteAccessPolicy('client.adminBackups'));
  }
})

FlowRouter.route('/admin/security-audits', {
  name: 'client.adminSecurityAudits',
  action: async function() {
    waitForAuthenticatedRoute(this, 'client.adminSecurityAudits', async () => {
      await renderRouteTemplate(this, 'adminSecurityAudits');
    }, getRouteAccessPolicy('client.adminSecurityAudits'));
  }
})

FlowRouter.route('/theme', {
  name: 'client.theme',
  action: async function() {
    waitForAuthenticatedRoute(this, 'client.theme', async () => {
      Session.set('curModule', 'theme');
      await renderRouteTemplate(this, 'theme');
    }, getRouteAccessPolicy('client.theme'));
  }
})

FlowRouter.route('/home', {
  name: 'client.home',
  action: function() {
    clientConsole(2, '[ROUTER] /home - rendering home');
    waitForAuthenticatedRoute(this, 'client.home', async (readyUser: any) => {
      renderHomeForUser(this, readyUser);
    });
  },
});

FlowRouter.route('/learning-analytics', {
  name: 'client.learningAnalytics',
  action: function() {
    waitForAuthenticatedRoute(this, 'client.learningAnalytics', async (readyUser: any) => {
      if (getUserLoginMode(readyUser) === 'experiment') {
        routeToSignin();
        return;
      }
      if (shouldRedirectToVerifyEmail(readyUser)) {
        FlowRouter.go('/auth/verify-email');
        return;
      }
      Session.set('curModule', 'learningAnalytics');
      await renderRouteTemplate(this, 'learningAnalytics');
    }, { requiresAuth: true }, LEARNING_ANALYTICS_DESTINATION);
  },
});

FlowRouter.route('/profile', {
  name: 'client.profile',
  action: async function() {
    waitForAuthenticatedRoute(this, 'client.profile', async () => {
      Session.set('curModule', 'profile');
      await renderRouteTemplate(this, 'profile');
    }, getRouteAccessPolicy('client.profile'));
  }
});

FlowRouter.route('/profileEdit', {
  name: 'client.profileEdit',
  action: function() {
    FlowRouter.go('/profile');
  }
});

FlowRouter.route('/classEdit', {
  name: 'client.classEdit',
  action: async function() {
    waitForAuthenticatedRoute(this, 'client.classEdit', async () => {
      await renderRouteTemplate(this, 'classEdit');
    }, getRouteAccessPolicy('client.classEdit'));
  }
});

async function bootstrapLessonRoute(
  controller: any,
  routeRequest: LessonRouteRequest,
  preserveColdContentBootstrap: boolean,
  requestedSurface: '/content' | '/instructions',
): Promise<boolean> {
  const tdfId = routeRequest.rootTdfId;
  let tdf: any = null;
  try {
    tdf = await meteorCallAsync('getTdfById', tdfId, {
      courseAssignment: routeRequest.courseAssignment,
    });
  } catch (error: unknown) {
    const message = (error as { reason?: string })?.reason || getErrorMessage(error);
    if (message === COURSE_ASSIGNMENT_DIRECT_LAUNCH_DENIED_REASON) {
      clientConsole(2, '[Router] Lesson route requires its course launch descriptor; redirecting to Courses', { tdfId });
      FlowRouter.go('/courses');
      return false;
    }
    throw error;
  }

  if (!tdf) {
    FlowRouter.go('/');
    return false;
  }

  const setspec = tdf.content.tdfs.tutor.setspec ? tdf.content.tdfs.tutor.setspec : null;
  const ignoreOutOfGrammarResponses = resolveSpeechIgnoreOutOfGrammarResponses(setspec);
  const speechOutOfGrammarFeedback = setspec.speechOutOfGrammarFeedback
    ? setspec.speechOutOfGrammarFeedback
    : translatePlatformString(getActiveUiLocale(), 'speech.outOfGrammarFeedback');

  renderLayout(controller, 'customLoading');
  Session.set('contentBootstrapInProgress', preserveColdContentBootstrap);
  try {
    const entryRoute = await selectTdf(
      tdfId,
      setspec.lessonname,
      tdf.stimuliSetId,
      ignoreOutOfGrammarResponses,
      speechOutOfGrammarFeedback,
      'Lesson route bootstrap',
      tdf.content.isMultiTdf,
      setspec,
      false,
      true,
      {
        courseAssignment: routeRequest.courseAssignment,
        practiceLaunchMode: routeRequest.practiceLaunchMode,
      },
    );
    if (!entryRoute) {
      FlowRouter.go('/home');
      return false;
    }
    setCardEntryIntent(CARD_ENTRY_INTENT.CARD_REFRESH_REBUILD, {
      source: 'router.lessonRoute.bootstrap',
    });
    // A saved lesson resumes through the content lifecycle, which restores its
    // persisted unit. Never render a cold instruction screen with partial state.
    if (requestedSurface === '/instructions' && entryRoute.route === '/content') {
      const location = buildActiveLessonRouteLocation('/content');
      FlowRouter.go(location.path, {}, location.queryParams);
      return false;
    }
  } finally {
    Session.set('contentBootstrapInProgress', false);
  }
  return true;
}

FlowRouter.route('/content/:tdfId?', {
  name: 'client.content',
  action: async function contentRouteAction(params: any) {
    const userId = Meteor.userId();
    const user = Meteor.user();
    if (!userId || !user) {
      const controller = this;
      waitForAuthenticatedRoute(this, 'client.content', async () => {
        await contentRouteAction.call(controller, params);
      });
      return;
    }

    let routeRequest: LessonRouteRequest;
    try {
      const queryParams = FlowRouter.current()?.queryParams || {};
      routeRequest = resolveLessonRouteRequest({
        routeTdfId: params?.tdfId,
        routeMode: queryParams.mode,
        routeCourseId: queryParams.courseId,
        routeAssignmentId: queryParams.assignmentId,
        routeProgressive: queryParams.progressive,
        routeProgressiveRevisionId: queryParams.progressiveRevisionId,
        routeProgressiveReverseOrder: queryParams.progressiveReverseOrder,
        activeRootTdfId: Session.get('currentRootTdfId'),
        activeCurrentTdfId: Session.get('currentTdfId'),
        activePracticeLaunchMode: getPracticeLaunchMode(),
        activeCourseAssignment: getCourseAssignmentLaunchContext(),
      });
    } catch (error) {
      clientConsole(1, '[Router] Refusing content route without a valid lesson descriptor:', getErrorMessage(error));
      FlowRouter.go('/home');
      return;
    }

    Session.set('suppressAuthenticatedChrome', false);
    clearAppLoadingUnlessLaunch();
    const refreshContentRequested = Boolean(FlowRouter.current()?.queryParams?.refreshContent);
    if (routeRequest.requiresBootstrap) {
      const preserveColdContentBootstrap = !Session.get('currentTdfId');
      if (!await bootstrapLessonRoute(this, routeRequest, preserveColdContentBootstrap, '/content')) {
        return;
      }
      // Re-enter the authenticated content action so the canonical content and
      // asset subscriptions reach readiness before the surface is mounted.
      await contentRouteAction.call(this, params);
      return;
    } else {
      setPracticeLaunchMode(routeRequest.practiceLaunchMode);
      setCourseAssignmentLaunchContext(routeRequest.courseAssignment ?? null);
      assertIdInvariants('router.content.entry', { requireCurrentTdfId: true, requireStimuliSetId: false });
      ensureStimuliSetIdSessionInvariant();
      const subs = [
        Meteor.subscribe('files.assets.all'),
        Meteor.subscribe('currentTdf', Session.get('currentTdfId')),
        Meteor.subscribe('tdfByExperimentTarget', Session.get('experimentTarget'), Session.get('experimentConditions')),
      ];
      const subsReady = subs.every((handle) => handle && handle.ready());
      if(subsReady){
        if (Meteor.user()) {
          // Restore SR grammar filtering from TDF on page refresh.
          const tdfFile = Session.get('currentTdfFile');
          if (tdfFile && tdfFile.tdfs && tdfFile.tdfs.tutor && tdfFile.tdfs.tutor.setspec) {
            const setspec = tdfFile.tdfs.tutor.setspec;
            const ignoreOutOfGrammarResponses = resolveSpeechIgnoreOutOfGrammarResponses(setspec);
            setIgnoreOutOfGrammarResponses(ignoreOutOfGrammarResponses);
            clientConsole(2, '[Router] Restored ignoreOutOfGrammarResponses from TDF:', ignoreOutOfGrammarResponses);
          }
          if (refreshContentRequested) {
            setCardEntryIntent(CARD_ENTRY_INTENT.CARD_REFRESH_REBUILD, {
              source: 'router.content.refreshQuery',
            });
          }
          Session.set('curModule', 'content');
          await renderRouteTemplate(this, 'content');
        } else {
          FlowRouter.go('/');
          return;
        }
      } else {
        renderContentSubscriptionWaitOnlyWhenCold(this);
        if (!contentSubsWaitHandle) {
          const controller = this;
          contentSubsWaitHandle = Tracker.autorun(() => {
            const ready = subs.every((handle) => handle && handle.ready());
            const user = Meteor.user();
            const isContentRoute = FlowRouter.current()?.route?.name === 'client.content';
            if (ready && user && isContentRoute) {
              contentSubsWaitHandle.stop();
              contentSubsWaitHandle = null;
              if (refreshContentRequested) {
                setCardEntryIntent(CARD_ENTRY_INTENT.CARD_REFRESH_REBUILD, {
                  source: 'router.content.refreshQuery.waited',
                });
              }
              Session.set('curModule', 'content');
              // contentRoute.js was already requested by lazyTemplateLoaders when this
              // route first fired, so the module should be cached by now.
              ensureTemplateModuleLoaded('content').then(() => {
                renderLayout(controller, 'content');
              });
            } else if (!isContentRoute) {
              contentSubsWaitHandle.stop();
              contentSubsWaitHandle = null;
            }
          });
        }
        return;
      }
    }
  },
});

// We track the start time for instructions, which means we need to track
// them here at the instruction route level
Session.set('instructionClientStart', 0);
FlowRouter.route('/instructions/:tdfId?', {
  name: 'client.instructions',
  action: async function instructionsRouteAction(params: any) {
    const userId = Meteor.userId();
    const user = Meteor.user();
    if (!userId || !user) {
      const controller = this;
      waitForAuthenticatedRoute(this, 'client.instructions', async () => {
        await instructionsRouteAction.call(controller, params);
      });
      return;
    }

    let routeRequest: LessonRouteRequest;
    try {
      const queryParams = FlowRouter.current()?.queryParams || {};
      routeRequest = resolveLessonRouteRequest({
        routeTdfId: params?.tdfId,
        routeMode: queryParams.mode,
        routeCourseId: queryParams.courseId,
        routeAssignmentId: queryParams.assignmentId,
        routeProgressive: queryParams.progressive,
        routeProgressiveRevisionId: queryParams.progressiveRevisionId,
        routeProgressiveReverseOrder: queryParams.progressiveReverseOrder,
        activeRootTdfId: Session.get('currentRootTdfId'),
        activeCurrentTdfId: Session.get('currentTdfId'),
        activePracticeLaunchMode: getPracticeLaunchMode(),
        activeCourseAssignment: getCourseAssignmentLaunchContext(),
      });
    } catch (error) {
      clientConsole(1, '[Router] Refusing instructions route without a valid lesson descriptor:', getErrorMessage(error));
      FlowRouter.go('/home');
      return;
    }

    if (routeRequest.requiresBootstrap) {
      if (!await bootstrapLessonRoute(this, routeRequest, false, '/instructions')) {
        return;
      }
      await instructionsRouteAction.call(this, params);
      return;
    }

    setPracticeLaunchMode(routeRequest.practiceLaunchMode);
    setCourseAssignmentLaunchContext(routeRequest.courseAssignment ?? null);
    assertIdInvariants('router.instructions.entry', { requireCurrentTdfId: true, requireStimuliSetId: false });
    ensureStimuliSetIdSessionInvariant();
    Meteor.subscribe('files.assets.all');
    Session.set('instructionClientStart', Date.now());
    Session.set('curModule', 'instructions');
    Session.set('fromInstructions', true);
    Session.set('suppressAuthenticatedChrome', false);
    clearAppLoadingUnlessLaunch();
    renderLayout(this, 'instructions');
  },
  triggersEnter: [function(context: any, redirect: any, stop: any) {
    ensureStimuliSetIdSessionInvariant();
    Meteor.subscribe('files.assets.all');
    if (!haveMeteorUser()) {
      clientConsole(2, 'No one logged in - allowing template to handle');
      return;
    }

    const unit: any = Session.get('currentTdfUnit');

    // IMPORTANT: If unit is not yet loaded, always show instructions page
    // to avoid race condition where instructions are skipped on first unit
    if (!unit) {
      clientConsole(2, 'Unit not yet loaded - showing instructions page to avoid race');
      return;
    }

    const lockout = Number(unitHasLockout()) > 0;
    const txt = unit.unitinstructions ? unit.unitinstructions.trim() : undefined;
    const pic = unit.picture ? unit.picture.trim() : undefined;
    if (!txt && !pic && !lockout) {
      clientConsole(2, 'Instructions empty: skipping', displayify(unit));
      Session.set('instructionClientStart', Date.now());
      instructContinue();
      if (typeof stop === 'function') {
        stop();
      }
    }
  }],
});
