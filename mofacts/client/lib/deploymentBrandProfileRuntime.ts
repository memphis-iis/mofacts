import { Meteor } from 'meteor/meteor';
import { Session } from 'meteor/session';
import { Tracker } from 'meteor/tracker';
import {
  DEPLOYMENT_BRAND_PROFILE_KEY,
  deploymentBrandSocialImageUrl,
  validateDeploymentBrandProfile,
  type DeploymentBrandProfile,
  type LocalizedBrandContent,
} from '../../common/deploymentBrandProfile';
import type { TargetUiLocale } from '../../common/lib/interfaceLocales';
import { clientConsole } from './clientLogger';

declare const DynamicSettings: {
  findOne: (selector: { key: string }) => { value?: unknown } | undefined;
};

function setMeta(selector: string, attributes: Record<string, string>, content: string) {
  let element = document.querySelector(selector) as HTMLMetaElement | null;
  if (!element) {
    element = document.createElement('meta');
    for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
    document.head.appendChild(element);
  }
  element.content = content;
}

function setLink(rel: string, href: string, sizes?: string) {
  const selector = `link[rel="${rel}"]${sizes ? `[sizes="${sizes}"]` : ':not([sizes])'}`;
  let link = document.querySelector(selector) as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.rel = rel;
    if (sizes) link.sizes = sizes;
    document.head.appendChild(link);
  }
  if (href) link.href = href;
  else link.removeAttribute('href');
}

export function readPublishedDeploymentBrandProfile(): DeploymentBrandProfile | null {
  const value = DynamicSettings.findOne({ key: DEPLOYMENT_BRAND_PROFILE_KEY })?.value;
  if (!value) return null;
  const validation = validateDeploymentBrandProfile(value);
  if (!validation.valid || !validation.profile) {
    clientConsole(0, `[Brand Profile] Invalid published profile: ${validation.errors.join('; ')}`);
    return null;
  }
  return validation.profile;
}

export function getDeploymentBrandName(): string {
  return readPublishedDeploymentBrandProfile()?.identity.name || '';
}

export function getLocalizedBrandContent(locale: TargetUiLocale): LocalizedBrandContent | null {
  return readPublishedDeploymentBrandProfile()?.locales[locale] || null;
}

export function applyDeploymentBrandProfile(profile: DeploymentBrandProfile, locale: TargetUiLocale) {
  const localized = profile.locales[locale];
  document.title = profile.identity.name;
  setMeta('meta[name="description"]', { name: 'description' }, localized.socialDescription);
  setMeta('meta[property="og:title"]', { property: 'og:title' }, localized.socialTitle);
  setMeta('meta[property="og:description"]', { property: 'og:description' }, localized.socialDescription);
  const socialImageUrl = deploymentBrandSocialImageUrl(profile);
  setMeta('meta[property="og:image"]', { property: 'og:image' }, socialImageUrl);
  setMeta('meta[property="og:image:alt"]', { property: 'og:image:alt' }, localized.socialImageAlt);
  setMeta('meta[name="twitter:title"]', { name: 'twitter:title' }, localized.socialTitle);
  setMeta('meta[name="twitter:description"]', { name: 'twitter:description' }, localized.socialDescription);
  setMeta('meta[name="twitter:image"]', { name: 'twitter:image' }, socialImageUrl);
  setLink('icon', profile.identity.favicon32Url, '32x32');
  setLink('icon', profile.identity.favicon16Url, '16x16');
  setLink('icon', profile.identity.favicon32Url);
  setLink('apple-touch-icon', profile.identity.appleTouchIconUrl, '180x180');
  setLink('manifest', `/site.webmanifest?v=${encodeURIComponent(profile.updatedAt)}`);
  Session.set('deploymentBrandProfile', profile);
  Session.set('brandProfileReady', true);
}

export function getCurrentDeploymentBrandProfile(getLocale: () => TargetUiLocale) {
  Session.set('brandProfileReady', false);
  const subscription = Meteor.subscribe('deploymentBrandProfile');
  Tracker.autorun(() => {
    if (!subscription.ready()) return;
    const profile = readPublishedDeploymentBrandProfile();
    if (!profile) {
      Session.set('brandProfileReady', false);
      return;
    }
    applyDeploymentBrandProfile(profile, getLocale());
  });
}
