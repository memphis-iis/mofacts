import {
  TARGET_UI_LOCALES,
  isTargetUiLocale,
  type TargetUiLocale,
} from './lib/interfaceLocales';

export const DEPLOYMENT_BRAND_PROFILE_KEY = 'deploymentBrandProfile';
export const DEPLOYMENT_BRAND_PROFILE_DRAFT_KEY = 'deploymentBrandProfileDraft';
export const DEPLOYMENT_BRAND_PROFILE_SCHEMA_VERSION = 2;
export const DEPLOYMENT_BRAND_SOCIAL_IMAGE_ROUTE = '/deployment-brand/social-image';

export const PUBLIC_EXPERIENCE_KEYS = [
  'brandTagline',
  'navStudents',
  'navTeachers',
  'navResearchers',
  'signIn',
  'createAccount',
  'eyebrow',
  'heroTitle',
  'heroCopy',
  'tryMofacts',
  'capabilitiesTitle',
  'capabilitiesCopy',
  'demosTitle',
  'demosCopy',
  'studentTitle',
  'studentCopy',
  'studentAction',
  'teacherTitle',
  'teacherCopy',
  'teacherAction',
  'researcherTitle',
  'researcherCopy',
  'researcherAction',
  'source',
  'project',
  'terms',
  'demoTemporary',
  'demoEnglish',
  'demoPrivacy',
  'demoStart',
  'demoStarting',
  'demoResume',
  'demoExpired',
  'demoFailed',
  'demoExit',
  'demoSignedIn',
  'researchDesign',
  'liveAi',
] as const;

export type PublicExperienceKey = typeof PUBLIC_EXPERIENCE_KEYS[number];
export type PublicDemoAudience = 'student' | 'teacher' | 'researcher';
export type LandingSection = 'hero' | 'audiences';

export type LocalizedBrandContent = Record<PublicExperienceKey, string> & {
  footerCopyright: string;
  legalLinkLabel: string;
  legalPageTitle: string;
  termsLinkLabel: string;
  privacyLinkLabel: string;
  supportLinkLabel: string;
  licenseSourceLinkLabel: string;
  socialTitle: string;
  socialDescription: string;
  socialImageAlt: string;
  signInDescription: string;
};

export type DeploymentBrandProfile = {
  schemaVersion: typeof DEPLOYMENT_BRAND_PROFILE_SCHEMA_VERSION;
  identity: {
    name: string;
    shortName: string;
    organizationName: string;
    logoUrl: string;
    favicon16Url: string;
    favicon32Url: string;
    appleTouchIconUrl: string;
    androidIcon192Url: string;
    androidIcon512Url: string;
    androidMaskableIcon192Url: string;
    androidMaskableIcon512Url: string;
    socialImageUrl: string;
  };
  defaultLocale: TargetUiLocale;
  locales: Record<TargetUiLocale, LocalizedBrandContent>;
  landing: {
    sectionOrder: LandingSection[];
    heroEnabled: boolean;
    audiencesEnabled: boolean;
    showCreateAccount: boolean;
    heroImageUrl: string;
    heroImageAltByLocale: Record<TargetUiLocale, string>;
    audiences: Record<PublicDemoAudience, { enabled: boolean; order: number }>;
  };
  legal: {
    termsUrl: string;
    privacyUrl: string;
    supportUrl: string;
    licenseSourceUrl: string;
  };
  updatedAt: string;
  updatedBy: string;
};

export type BrandProfileValidationResult = {
  valid: boolean;
  errors: string[];
  profile?: DeploymentBrandProfile;
};

export type DeploymentBrandProfileMigrationResult = {
  migrated: boolean;
  value: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function migrateDeploymentBrandProfile(value: unknown): DeploymentBrandProfileMigrationResult {
  if (!isRecord(value) || value.schemaVersion !== 1 || !isRecord(value.landing)) {
    return { migrated: false, value };
  }

  return {
    migrated: true,
    value: {
      ...value,
      schemaVersion: DEPLOYMENT_BRAND_PROFILE_SCHEMA_VERSION,
      landing: {
        ...value.landing,
        heroEnabled: true,
        audiencesEnabled: true,
      },
    },
  };
}

function requiredText(value: unknown, path: string, errors: string[], maxLength = 4000): string {
  if (typeof value !== 'string' || !value.trim()) {
    errors.push(`${path} is required`);
    return '';
  }
  const normalized = value.trim();
  if (normalized.length > maxLength) {
    errors.push(`${path} must not exceed ${maxLength} characters`);
  }
  return normalized;
}

function optionalText(value: unknown, path: string, errors: string[], maxLength = 10000): string {
  if (value == null || value === '') return '';
  if (typeof value !== 'string') {
    errors.push(`${path} must be text`);
    return '';
  }
  const normalized = value.trim();
  if (normalized.length > maxLength) {
    errors.push(`${path} must not exceed ${maxLength} characters`);
  }
  return normalized;
}

function safePublicUrl(
  value: unknown,
  path: string,
  errors: string[],
  required = false,
  allowDataImage = false,
): string {
  if (allowDataImage && typeof value === 'string' && value.startsWith('data:image/')) {
    if (!/^data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(value)) {
      errors.push(`${path} must be a base64-encoded PNG, JPEG, WebP, or GIF image data URL`);
      return '';
    }
    if (value.length > 7_000_000) {
      errors.push(`${path} image data must not exceed 5 MB`);
      return '';
    }
    return value;
  }
  const normalized = optionalText(value, path, errors, 2_000);
  if (!normalized) {
    if (required) errors.push(`${path} is required`);
    return '';
  }
  if (normalized.startsWith('/') && !normalized.startsWith('//') && !normalized.includes('..')) {
    return normalized;
  }
  try {
    const url = new URL(normalized);
    if (url.protocol === 'https:') return normalized;
  } catch (_error) {
    // Report the common validation error below.
  }
  errors.push(`${path} must be an HTTPS URL, an application-relative path, or an image data URL`);
  return '';
}

function requiredBoolean(value: unknown, path: string, errors: string[]): boolean {
  if (typeof value !== 'boolean') {
    errors.push(`${path} must be true or false`);
    return false;
  }
  return value;
}

function normalizeLocalizedContent(
  value: unknown,
  locale: TargetUiLocale,
  errors: string[],
): LocalizedBrandContent {
  const source = isRecord(value) ? value : {};
  if (!isRecord(value)) errors.push(`locales.${locale} is required`);
  const result: Record<string, string> = {};
  for (const key of PUBLIC_EXPERIENCE_KEYS) {
    result[key] = requiredText(source[key], `locales.${locale}.${key}`, errors);
  }
  for (const key of [
    'footerCopyright',
    'legalLinkLabel',
    'legalPageTitle',
    'termsLinkLabel',
    'privacyLinkLabel',
    'supportLinkLabel',
    'licenseSourceLinkLabel',
    'socialTitle',
    'socialDescription',
    'socialImageAlt',
    'signInDescription',
  ] as const) {
    result[key] = requiredText(source[key], `locales.${locale}.${key}`, errors);
  }
  return result as LocalizedBrandContent;
}

export function validateDeploymentBrandProfile(value: unknown): BrandProfileValidationResult {
  const errors: string[] = [];
  if (!isRecord(value)) return { valid: false, errors: ['Brand Profile must be an object'] };
  if (value.schemaVersion !== DEPLOYMENT_BRAND_PROFILE_SCHEMA_VERSION) {
    errors.push(`schemaVersion must be ${DEPLOYMENT_BRAND_PROFILE_SCHEMA_VERSION}`);
  }

  const identitySource = isRecord(value.identity) ? value.identity : {};
  if (!isRecord(value.identity)) errors.push('identity is required');
  const identity = {
    name: requiredText(identitySource.name, 'identity.name', errors, 160),
    shortName: requiredText(identitySource.shortName, 'identity.shortName', errors, 24),
    organizationName: requiredText(identitySource.organizationName, 'identity.organizationName', errors, 200),
    logoUrl: safePublicUrl(identitySource.logoUrl, 'identity.logoUrl', errors, true, true),
    favicon16Url: safePublicUrl(identitySource.favicon16Url, 'identity.favicon16Url', errors, true, true),
    favicon32Url: safePublicUrl(identitySource.favicon32Url, 'identity.favicon32Url', errors, true, true),
    appleTouchIconUrl: safePublicUrl(identitySource.appleTouchIconUrl, 'identity.appleTouchIconUrl', errors, true, true),
    androidIcon192Url: safePublicUrl(identitySource.androidIcon192Url, 'identity.androidIcon192Url', errors, true, true),
    androidIcon512Url: safePublicUrl(identitySource.androidIcon512Url, 'identity.androidIcon512Url', errors, true, true),
    androidMaskableIcon192Url: safePublicUrl(identitySource.androidMaskableIcon192Url, 'identity.androidMaskableIcon192Url', errors, true, true),
    androidMaskableIcon512Url: safePublicUrl(identitySource.androidMaskableIcon512Url, 'identity.androidMaskableIcon512Url', errors, true, true),
    socialImageUrl: safePublicUrl(identitySource.socialImageUrl, 'identity.socialImageUrl', errors, true, true),
  };

  const defaultLocale = typeof value.defaultLocale === 'string' && isTargetUiLocale(value.defaultLocale)
    ? value.defaultLocale
    : 'en';
  if (value.defaultLocale !== defaultLocale) errors.push('defaultLocale must be a supported interface locale');

  const localesSource = isRecord(value.locales) ? value.locales : {};
  if (!isRecord(value.locales)) errors.push('locales is required');
  const locales = Object.fromEntries(TARGET_UI_LOCALES.map((locale) => [
    locale,
    normalizeLocalizedContent(localesSource[locale], locale, errors),
  ])) as Record<TargetUiLocale, LocalizedBrandContent>;

  const landingSource = isRecord(value.landing) ? value.landing : {};
  if (!isRecord(value.landing)) errors.push('landing is required');
  const rawOrder = Array.isArray(landingSource.sectionOrder) ? landingSource.sectionOrder : [];
  const sectionOrder = rawOrder.filter((item): item is LandingSection => item === 'hero' || item === 'audiences');
  if (sectionOrder.length !== 2 || new Set(sectionOrder).size !== 2) {
    errors.push('landing.sectionOrder must contain hero and audiences exactly once');
  }
  const heroEnabled = requiredBoolean(landingSource.heroEnabled, 'landing.heroEnabled', errors);
  const audiencesEnabled = requiredBoolean(landingSource.audiencesEnabled, 'landing.audiencesEnabled', errors);
  if (!heroEnabled && !audiencesEnabled) errors.push('At least one landing section must be visible');
  const heroImageUrl = safePublicUrl(landingSource.heroImageUrl, 'landing.heroImageUrl', errors, false, true);
  const heroAltSource = isRecord(landingSource.heroImageAltByLocale) ? landingSource.heroImageAltByLocale : {};
  const heroImageAltByLocale = Object.fromEntries(TARGET_UI_LOCALES.map((locale) => [
    locale,
    heroImageUrl ? requiredText(heroAltSource[locale], `landing.heroImageAltByLocale.${locale}`, errors, 500) : '',
  ])) as Record<TargetUiLocale, string>;
  const audiencesSource = isRecord(landingSource.audiences) ? landingSource.audiences : {};
  const audiences = Object.fromEntries((['student', 'teacher', 'researcher'] as const).map((audience, index) => {
    const source = isRecord(audiencesSource[audience]) ? audiencesSource[audience] : {};
    const order = Number(source.order);
    if (!Number.isInteger(order) || order < 0 || order > 2) errors.push(`landing.audiences.${audience}.order must be 0, 1, or 2`);
    return [audience, {
      enabled: requiredBoolean(source.enabled, `landing.audiences.${audience}.enabled`, errors),
      order: Number.isInteger(order) ? order : index,
    }];
  })) as DeploymentBrandProfile['landing']['audiences'];
  const enabledOrders = Object.values(audiences).filter(({ enabled }) => enabled).map(({ order }) => order);
  if (audiencesEnabled && enabledOrders.length === 0) errors.push('At least one landing audience must be enabled');
  if (new Set(enabledOrders).size !== enabledOrders.length) errors.push('Enabled landing audiences must have unique order values');

  const legalSource = isRecord(value.legal) ? value.legal : {};
  if (!isRecord(value.legal)) errors.push('legal is required');
  const legal = {
    termsUrl: safePublicUrl(legalSource.termsUrl, 'legal.termsUrl', errors, true),
    privacyUrl: safePublicUrl(legalSource.privacyUrl, 'legal.privacyUrl', errors, true),
    supportUrl: safePublicUrl(legalSource.supportUrl, 'legal.supportUrl', errors, true),
    licenseSourceUrl: safePublicUrl(legalSource.licenseSourceUrl, 'legal.licenseSourceUrl', errors, true),
  };

  const profile: DeploymentBrandProfile = {
    schemaVersion: DEPLOYMENT_BRAND_PROFILE_SCHEMA_VERSION,
    identity,
    defaultLocale,
    locales,
    landing: {
      sectionOrder: sectionOrder.length === 2 ? sectionOrder : ['hero', 'audiences'],
      heroEnabled,
      audiencesEnabled,
      showCreateAccount: requiredBoolean(landingSource.showCreateAccount, 'landing.showCreateAccount', errors),
      heroImageUrl,
      heroImageAltByLocale,
      audiences,
    },
    legal,
    updatedAt: optionalText(value.updatedAt, 'updatedAt', errors, 100),
    updatedBy: optionalText(value.updatedBy, 'updatedBy', errors, 200),
  };
  return { valid: errors.length === 0, errors, ...(errors.length === 0 ? { profile } : {}) };
}

export function cloneDeploymentBrandProfile(profile: DeploymentBrandProfile): DeploymentBrandProfile {
  return JSON.parse(JSON.stringify(profile)) as DeploymentBrandProfile;
}

export function deploymentBrandSocialImageUrl(profile: DeploymentBrandProfile): string {
  return profile.identity.socialImageUrl.startsWith('data:image/')
    ? DEPLOYMENT_BRAND_SOCIAL_IMAGE_ROUTE
    : profile.identity.socialImageUrl;
}
