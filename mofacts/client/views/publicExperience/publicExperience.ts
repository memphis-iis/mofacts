import { Template } from 'meteor/templating';
import { ReactiveVar } from 'meteor/reactive-var';
import { Meteor } from 'meteor/meteor';
import { Session } from 'meteor/session';
import { FlowRouter } from 'meteor/ostrio:flow-router-extra';
import { PUBLIC_DEMO_DEFINITIONS, type PublicDemoKind } from '../../../common/publicDemoContract';
import { getActiveUiLocale } from '../../lib/interfaceLocaleState';
import { meteorCallAsync } from '../../lib/meteorAsync';
import { getErrorMessage } from '../../lib/errorUtils';
import { clientConsole } from '../../lib/clientLogger';
import { Cookie } from '../../lib/cookies';
import { setExperimentParticipantContext } from '../../lib/idContext';
import { completeExperimentSignIn } from '../login/signIn';
import {
  clearStoredPublicDemoSession,
  isPublicDemoAccount,
  readStoredPublicDemoSession,
  writeStoredPublicDemoSession,
} from '../../lib/publicDemoSession';
import type { PublicExperienceKey } from './publicExperienceI18n';
import {
  getDeploymentBrandName,
  getLocalizedBrandContent,
  readPublishedDeploymentBrandProfile,
} from '../../lib/deploymentBrandProfileRuntime';
import './publicLanding.html';
import './publicExperience.css';

type PublicDemoLaunchResult = {
  loginToken: string;
  launchPath: string;
  expiresAt: Date | string;
};

const PUBLIC_AUDIENCES = ['student', 'teacher', 'researcher'] as const;
type PublicAudience = typeof PUBLIC_AUDIENCES[number];

type PublicAudiencePresentation = {
  labelKey: PublicExperienceKey;
  titleKey: PublicExperienceKey;
  copyKey: PublicExperienceKey;
  actionKey: PublicExperienceKey;
  tabId: string;
  icon: string;
  secondaryIcon: string;
};

const PUBLIC_AUDIENCE_PRESENTATIONS: Record<PublicAudience, PublicAudiencePresentation> = {
  student: { labelKey: 'navStudents', titleKey: 'studentTitle', copyKey: 'studentCopy', actionKey: 'studentAction', tabId: 'publicAudienceStudent', icon: 'fa-graduation-cap', secondaryIcon: 'fa-line-chart' },
  teacher: { labelKey: 'navTeachers', titleKey: 'teacherTitle', copyKey: 'teacherCopy', actionKey: 'teacherAction', tabId: 'publicAudienceTeacher', icon: 'fa-comments', secondaryIcon: 'fa-pencil' },
  researcher: { labelKey: 'navResearchers', titleKey: 'researcherTitle', copyKey: 'researcherCopy', actionKey: 'researcherAction', tabId: 'publicAudienceResearcher', icon: 'fa-flask', secondaryIcon: 'fa-table' },
};

function isPublicAudience(value: unknown): value is PublicAudience {
  return typeof value === 'string' && PUBLIC_AUDIENCES.includes(value as PublicAudience);
}

function audienceFromHash(): PublicAudience {
  const hash = window.location.hash.replace(/^#/, '');
  if (hash === 'teachers') return 'teacher';
  if (hash === 'researchers') return 'researcher';
  return 'student';
}

function audienceHash(audience: PublicAudience): string {
  if (audience === 'teacher') return '#teachers';
  if (audience === 'researcher') return '#researchers';
  return '#students';
}

function currentPublicText(key: PublicExperienceKey): string {
  return getLocalizedBrandContent(getActiveUiLocale())?.[key] || '';
}

function systemName(): string {
  return getDeploymentBrandName();
}

function enabledAudiences(instance: any) {
  const profile = readPublishedDeploymentBrandProfile();
  if (!profile) return [];
  const selected = instance.selectedAudience.get() as PublicAudience;
  return PUBLIC_AUDIENCES
    .filter((audience) => profile.landing.audiences[audience].enabled)
    .sort((a, b) => profile.landing.audiences[a].order - profile.landing.audiences[b].order)
    .map((audience) => ({
      id: audience,
      hash: audienceHash(audience),
      current: selected === audience ? 'page' : false,
      selected: selected === audience ? 'true' : 'false',
      tabIndex: selected === audience ? '0' : '-1',
      tabId: PUBLIC_AUDIENCE_PRESENTATIONS[audience].tabId,
      icon: PUBLIC_AUDIENCE_PRESENTATIONS[audience].icon,
      label: currentPublicText(PUBLIC_AUDIENCE_PRESENTATIONS[audience].labelKey),
    }));
}

Template.publicLanding.onCreated(function(this: any) {
  this.selectedAudience = new ReactiveVar<PublicAudience>(audienceFromHash());
  this.launching = new ReactiveVar(false);
  this.launchError = new ReactiveVar('');
  const stored = readStoredPublicDemoSession();
  this.expired = new ReactiveVar(Boolean(stored && new Date(stored.expiresAt).getTime() <= Date.now()));
  if (this.expired.get()) clearStoredPublicDemoSession();
  this.autorun(() => {
    const profile = readPublishedDeploymentBrandProfile();
    if (!profile) return;
    const available = PUBLIC_AUDIENCES
      .filter((audience) => profile.landing.audiences[audience].enabled)
      .sort((a, b) => profile.landing.audiences[a].order - profile.landing.audiences[b].order);
    if (available.length > 0 && !available.includes(this.selectedAudience.get())) {
      this.selectedAudience.set(available[0]!);
    }
  });
});

Template.publicLanding.helpers({
  systemName,
  pt(key: PublicExperienceKey) { return currentPublicText(key); },
  landingSections() {
    const landing = readPublishedDeploymentBrandProfile()?.landing;
    if (!landing) return [];
    return landing.sectionOrder
      .filter((id) => id === 'hero' ? landing.heroEnabled : landing.audiencesEnabled)
      .map((id) => ({ id }));
  },
  isHeroSection(id: string) { return id === 'hero'; },
  showCreateAccount() { return readPublishedDeploymentBrandProfile()?.landing.showCreateAccount === true; },
  heroImageUrl() { return readPublishedDeploymentBrandProfile()?.landing.heroImageUrl || ''; },
  heroImageAlt() { return readPublishedDeploymentBrandProfile()?.landing.heroImageAltByLocale[getActiveUiLocale()] || ''; },
  heroAudienceHash() { return enabledAudiences(Template.instance() as any)[0]?.hash || ''; },
  heroAudienceId() { return enabledAudiences(Template.instance() as any)[0]?.id || ''; },
  enabledAudiences() { return enabledAudiences(Template.instance() as any); },
  footerCopyright() { return getLocalizedBrandContent(getActiveUiLocale())?.footerCopyright || ''; },
  legalLinkLabel() { return getLocalizedBrandContent(getActiveUiLocale())?.legalLinkLabel || ''; },
  audienceCurrent(audience: PublicAudience) { return (Template.instance() as any).selectedAudience.get() === audience ? 'page' : false; },
  audienceSelected(audience: PublicAudience) { return (Template.instance() as any).selectedAudience.get() === audience ? 'true' : 'false'; },
  audienceTabIndex(audience: PublicAudience) { return (Template.instance() as any).selectedAudience.get() === audience ? '0' : '-1'; },
  activeAudienceTabId() { return PUBLIC_AUDIENCE_PRESENTATIONS[(Template.instance() as any).selectedAudience.get() as PublicAudience].tabId; },
  activeAudienceLabel() { return currentPublicText(PUBLIC_AUDIENCE_PRESENTATIONS[(Template.instance() as any).selectedAudience.get() as PublicAudience].labelKey); },
  activeAudienceTitle() { return currentPublicText(PUBLIC_AUDIENCE_PRESENTATIONS[(Template.instance() as any).selectedAudience.get() as PublicAudience].titleKey); },
  activeAudienceCopy() { return currentPublicText(PUBLIC_AUDIENCE_PRESENTATIONS[(Template.instance() as any).selectedAudience.get() as PublicAudience].copyKey); },
  activeAudienceAction() { return currentPublicText(PUBLIC_AUDIENCE_PRESENTATIONS[(Template.instance() as any).selectedAudience.get() as PublicAudience].actionKey); },
  activeAudienceIcon() { return PUBLIC_AUDIENCE_PRESENTATIONS[(Template.instance() as any).selectedAudience.get() as PublicAudience].icon; },
  activePreviewSecondaryIcon() { return PUBLIC_AUDIENCE_PRESENTATIONS[(Template.instance() as any).selectedAudience.get() as PublicAudience].secondaryIcon; },
  launchError() { return (Template.instance() as any).launchError.get(); },
  expiredMessage() { return (Template.instance() as any).expired.get() ? currentPublicText('demoExpired') : ''; },
  startDisabled() {
    const instance = Template.instance() as any;
    const user = Meteor.user();
    return instance.launching.get() || Boolean(user && !isPublicDemoAccount(user));
  },
  startLabel() {
    const instance = Template.instance() as any;
    if (instance.launching.get()) return currentPublicText('demoStarting');
    const audience = instance.selectedAudience.get() as PublicAudience;
    const user = Meteor.user() as any;
    if (isPublicDemoAccount(user) && user?.profile?.publicDemoKind === audience) {
      return currentPublicText('demoResume');
    }
    return currentPublicText(PUBLIC_AUDIENCE_PRESENTATIONS[audience].actionKey);
  },
  launchStatus() { return (Template.instance() as any).launching.get() ? currentPublicText('demoStarting') : ''; },
});

function selectPublicAudience(template: any, audience: PublicAudience, shouldScroll: boolean): void {
  template.selectedAudience.set(audience);
  template.launchError.set('');
  template.expired.set(false);
  window.history.replaceState(window.history.state, '', audienceHash(audience));
  if (shouldScroll) {
    document.getElementById('publicAudiences')?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'start',
    });
  }
}

Template.publicLanding.events({
  'click [data-public-audience]'(event: Event, template: any) {
    const audience = (event.currentTarget as HTMLElement).dataset.publicAudience;
    if (!isPublicAudience(audience)) return;
    event.preventDefault();
    selectPublicAudience(template, audience, true);
  },
  'keydown [role="tab"]'(event: KeyboardEvent, template: any) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const available = enabledAudiences(template).map(({ id }) => id as PublicAudience);
    if (available.length === 0) return;
    const selected = template.selectedAudience.get() as PublicAudience;
    const currentIndex = Math.max(0, available.indexOf(selected));
    const inlineDirection = document.documentElement.dir === 'rtl' ? -1 : 1;
    const arrowOffset = event.key === 'ArrowRight' ? inlineDirection : -inlineDirection;
    const nextIndex = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? available.length - 1
        : (currentIndex + arrowOffset + available.length) % available.length;
    const nextAudience = available[nextIndex]!;
    selectPublicAudience(template, nextAudience, false);
    requestAnimationFrame(() => {
      document.getElementById(PUBLIC_AUDIENCE_PRESENTATIONS[nextAudience].tabId)?.focus();
    });
  },
  async 'click [data-public-demo-start]'(_event: Event, template: any) {
    const kind = template.selectedAudience.get() as PublicDemoKind;
    if (template.launching.get()) return;
    const currentUser = Meteor.user() as any;
    if (currentUser && !isPublicDemoAccount(currentUser)) {
      FlowRouter.go('/home');
      return;
    }
    const definition = PUBLIC_DEMO_DEFINITIONS[kind];
    if (isPublicDemoAccount(currentUser)) {
      if (currentUser?.profile?.publicDemoKind === kind) {
        FlowRouter.go(definition.launchPath);
      } else {
        template.launchError.set(currentPublicText('demoSignedIn'));
      }
      return;
    }
    template.launching.set(true);
    template.launchError.set('');
    template.expired.set(false);
    try {
      const result = await meteorCallAsync<PublicDemoLaunchResult>('startPublicDemo', { kind });
      if (!result?.loginToken) throw new Error(currentPublicText('demoFailed'));
      if (result.launchPath !== definition.launchPath) {
        throw new Error('The public demo launch contract returned an unexpected destination.');
      }
      Session.set('loginMode', 'experiment');
      Session.set('experimentTarget', definition.experimentTarget);
      Session.set('experimentXCond', '');
      Session.set('useEmbeddedAPIKeys', true);
      Session.set('curModule', 'experiment');
      setExperimentParticipantContext({ experimentTarget: definition.experimentTarget }, 'publicDemo.launch');
      Cookie.set('isExperiment', '1', 1);
      Cookie.set('experimentTarget', definition.experimentTarget, 1);
      Cookie.set('experimentXCond', '', 1);
      writeStoredPublicDemoSession({ kind, experimentTarget: definition.experimentTarget, expiresAt: String(result.expiresAt) });
      const loginWithTokenAsync = (Meteor as any).promisify((Meteor as any).loginWithToken);
      await loginWithTokenAsync(result.loginToken);
      await completeExperimentSignIn();
    } catch (error: unknown) {
      clientConsole(1, '[PUBLIC-DEMO] launch failed', getErrorMessage(error));
      template.launchError.set(currentPublicText('demoFailed'));
      template.launching.set(false);
    }
  },
});
