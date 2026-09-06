import { Meteor } from 'meteor/meteor';
import { DynamicSettings } from '../../common/Collections';
import {
  DEPLOYMENT_BRAND_PROFILE_DRAFT_KEY,
  DEPLOYMENT_BRAND_PROFILE_KEY,
  DEPLOYMENT_BRAND_PROFILE_SCHEMA_VERSION,
  cloneDeploymentBrandProfile,
  migrateDeploymentBrandProfile,
  validateDeploymentBrandProfile,
  type DeploymentBrandProfile,
  type LocalizedBrandContent,
} from '../../common/deploymentBrandProfile';
import { TARGET_UI_LOCALES, type TargetUiLocale } from '../../common/lib/interfaceLocales';
import { resolveThemeBrandLabel } from '../../common/themeBranding';
import { DEFAULT_PUBLIC_EXPERIENCE_TRANSLATIONS } from '../../common/publicExperienceI18n';
import { themeRegistry } from './themeRegistry';

const DEFAULT_SOURCE_URL = 'https://github.com/memphis-iis/MoFaCTS';

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function replaceDefaultIdentity(value: string, brandName: string): string {
  return value.replace(/MoFaCTS/gi, () => brandName);
}

function supplementalLocaleContent(
  locale: TargetUiLocale,
  brandName: string,
  organizationName: string,
  signInDescription: string,
): Omit<LocalizedBrandContent, keyof typeof DEFAULT_PUBLIC_EXPERIENCE_TRANSLATIONS.en> {
  const defaults = DEFAULT_PUBLIC_EXPERIENCE_TRANSLATIONS[locale];
  return {
    footerCopyright: `Copyright ${new Date().getFullYear()} ${organizationName}.`,
    legalLinkLabel: defaults.terms,
    legalPageTitle: defaults.terms,
    termsLinkLabel: defaults.terms,
    privacyLinkLabel: 'Privacy',
    supportLinkLabel: 'Support',
    licenseSourceLinkLabel: defaults.source,
    socialTitle: `${brandName} | ${defaults.brandTagline}`,
    socialDescription: replaceDefaultIdentity(defaults.heroCopy, brandName),
    socialImageAlt: `${brandName} preview`,
    signInDescription,
  };
}

export async function buildInitialDeploymentBrandProfile(): Promise<DeploymentBrandProfile> {
  const activeTheme = await themeRegistry.ensureActiveTheme();
  const properties = activeTheme?.properties || {};
  const configuredName = Meteor.settings.public?.systemName;
  const name = resolveThemeBrandLabel(activeTheme, configuredName);
  const organizationName = 'University of Memphis';
  const signInDescription = asString(properties.auth_sign_in_description) ||
    'A web-based adaptive learning system. Sign in to access your learning experience.';
  const locales = Object.fromEntries(TARGET_UI_LOCALES.map((locale) => {
    const translated = Object.fromEntries(Object.entries(DEFAULT_PUBLIC_EXPERIENCE_TRANSLATIONS[locale]).map(
      ([key, value]) => [key, replaceDefaultIdentity(value, name)],
    ));
    return [locale, {
      ...translated,
      ...supplementalLocaleContent(locale, name, organizationName, signInDescription),
    }];
  })) as DeploymentBrandProfile['locales'];

  return {
    schemaVersion: DEPLOYMENT_BRAND_PROFILE_SCHEMA_VERSION,
    identity: {
      name,
      shortName: name.slice(0, 24),
      organizationName,
      logoUrl: asString(properties.brand_logo_url),
      favicon16Url: asString(properties.brand_favicon_16_url),
      favicon32Url: asString(properties.brand_favicon_32_url),
      appleTouchIconUrl: asString(properties.brand_apple_touch_icon_url),
      androidIcon192Url: asString(properties.brand_android_icon_192_url),
      androidIcon512Url: asString(properties.brand_android_icon_512_url),
      androidMaskableIcon192Url: asString(properties.brand_android_maskable_icon_192_url),
      androidMaskableIcon512Url: asString(properties.brand_android_maskable_icon_512_url),
      socialImageUrl: '/social-preview.png',
    },
    defaultLocale: 'en',
    locales,
    landing: {
      sectionOrder: ['hero', 'audiences'],
      heroEnabled: true,
      audiencesEnabled: true,
      showCreateAccount: true,
      heroImageUrl: '',
      heroImageAltByLocale: Object.fromEntries(TARGET_UI_LOCALES.map((locale) => [locale, ''])) as Record<TargetUiLocale, string>,
      audiences: {
        student: { enabled: true, order: 0 },
        teacher: { enabled: true, order: 1 },
        researcher: { enabled: true, order: 2 },
      },
    },
    legal: {
      termsUrl: '/terms-of-service',
      privacyUrl: '/terms-of-service',
      supportUrl: '/',
      licenseSourceUrl: asString(Meteor.settings.public?.sourceUrl) || DEFAULT_SOURCE_URL,
    },
    updatedAt: new Date().toISOString(),
    updatedBy: 'startup-migration',
  };
}

export async function ensurePublishedDeploymentBrandProfile(): Promise<DeploymentBrandProfile> {
  const existing = await DynamicSettings.findOneAsync({ key: DEPLOYMENT_BRAND_PROFILE_KEY });
  if (existing?.value) {
    const migration = migrateDeploymentBrandProfile(existing.value);
    const candidate = migration.migrated
      ? {
          ...(migration.value as Record<string, unknown>),
          updatedAt: new Date().toISOString(),
          updatedBy: 'startup-schema-migration',
        }
      : migration.value;
    const validation = validateDeploymentBrandProfile(candidate);
    if (!validation.valid || !validation.profile) {
      throw new Error(`Published Brand Profile is invalid: ${validation.errors.join('; ')}`);
    }
    if (migration.migrated) {
      await DynamicSettings.upsertAsync(
        { key: DEPLOYMENT_BRAND_PROFILE_KEY },
        { $set: { value: validation.profile } },
      );
    }
    return validation.profile;
  }

  const initial = await buildInitialDeploymentBrandProfile();
  const validation = validateDeploymentBrandProfile(initial);
  if (!validation.valid || !validation.profile) {
    throw new Error(`Initial Brand Profile is invalid: ${validation.errors.join('; ')}`);
  }
  await DynamicSettings.upsertAsync(
    { key: DEPLOYMENT_BRAND_PROFILE_KEY },
    { $set: { value: validation.profile } },
  );
  await DynamicSettings.upsertAsync(
    { key: DEPLOYMENT_BRAND_PROFILE_DRAFT_KEY },
    { $set: { value: cloneDeploymentBrandProfile(validation.profile) } },
  );
  return validation.profile;
}

export async function readDeploymentBrandProfileDraft(): Promise<unknown> {
  const draft = await DynamicSettings.findOneAsync({ key: DEPLOYMENT_BRAND_PROFILE_DRAFT_KEY });
  if (draft?.value) {
    const migration = migrateDeploymentBrandProfile(draft.value);
    if (!migration.migrated) return draft.value;
    const migratedDraft = {
      ...(migration.value as Record<string, unknown>),
      updatedAt: new Date().toISOString(),
      updatedBy: 'startup-schema-migration',
    };
    await DynamicSettings.upsertAsync(
      { key: DEPLOYMENT_BRAND_PROFILE_DRAFT_KEY },
      { $set: { value: migratedDraft } },
    );
    return migratedDraft;
  }
  return cloneDeploymentBrandProfile(await ensurePublishedDeploymentBrandProfile());
}

export async function saveDeploymentBrandProfileDraft(value: unknown, userId: string): Promise<unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Meteor.Error('invalid-brand-profile', 'Brand Profile draft must be an object');
  }
  const serialized = JSON.stringify(value);
  if (Buffer.byteLength(serialized, 'utf8') > 10 * 1024 * 1024) {
    throw new Meteor.Error('brand-profile-too-large', 'Brand Profile draft must be smaller than 10 MB');
  }
  const draft = {
    ...(value as Record<string, unknown>),
    updatedAt: new Date().toISOString(),
    updatedBy: userId,
  };
  await DynamicSettings.upsertAsync(
    { key: DEPLOYMENT_BRAND_PROFILE_DRAFT_KEY },
    { $set: { value: draft } },
  );
  return draft;
}

export async function publishDeploymentBrandProfile(_userId: string): Promise<DeploymentBrandProfile> {
  const draft = await readDeploymentBrandProfileDraft();
  const candidate = {
    ...(draft as Record<string, unknown>),
    updatedAt: new Date().toISOString(),
    updatedBy: 'administrator',
  };
  const validation = validateDeploymentBrandProfile(candidate);
  if (!validation.valid || !validation.profile) {
    throw new Meteor.Error('invalid-brand-profile', validation.errors.join('\n'));
  }
  await DynamicSettings.upsertAsync(
    { key: DEPLOYMENT_BRAND_PROFILE_KEY },
    { $set: { value: validation.profile } },
  );
  return validation.profile;
}
