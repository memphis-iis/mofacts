import { expect } from 'chai';
import {
  DEPLOYMENT_BRAND_PROFILE_SCHEMA_VERSION,
  PUBLIC_EXPERIENCE_KEYS,
  migrateDeploymentBrandProfile,
  validateDeploymentBrandProfile,
  type DeploymentBrandProfile,
  type LocalizedBrandContent,
} from './deploymentBrandProfile';
import { TARGET_UI_LOCALES, type TargetUiLocale } from './lib/interfaceLocales';

const supplementalKeys = [
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
] as const;

function localized(locale: TargetUiLocale): LocalizedBrandContent {
  return Object.fromEntries(
    [...PUBLIC_EXPERIENCE_KEYS, ...supplementalKeys].map((key) => [key, `${locale} ${key}`]),
  ) as LocalizedBrandContent;
}

function completeProfile(): DeploymentBrandProfile {
  return {
    schemaVersion: DEPLOYMENT_BRAND_PROFILE_SCHEMA_VERSION,
    identity: {
      name: 'Research Learning Lab',
      shortName: 'RLL',
      organizationName: 'Example University',
      logoUrl: '/brand/logo.png',
      favicon16Url: '/brand/favicon-16.png',
      favicon32Url: '/brand/favicon-32.png',
      appleTouchIconUrl: '/brand/apple.png',
      androidIcon192Url: '/brand/android-192.png',
      androidIcon512Url: '/brand/android-512.png',
      androidMaskableIcon192Url: '/brand/maskable-192.png',
      androidMaskableIcon512Url: '/brand/maskable-512.png',
      socialImageUrl: '/brand/social.png',
    },
    defaultLocale: 'en',
    locales: Object.fromEntries(TARGET_UI_LOCALES.map((locale) => [locale, localized(locale)])) as DeploymentBrandProfile['locales'],
    landing: {
      sectionOrder: ['hero', 'audiences'],
      heroEnabled: true,
      audiencesEnabled: true,
      showCreateAccount: true,
      heroImageUrl: '/brand/hero.png',
      heroImageAltByLocale: Object.fromEntries(TARGET_UI_LOCALES.map((locale) => [locale, `${locale} hero`])) as Record<TargetUiLocale, string>,
      audiences: {
        student: { enabled: true, order: 0 },
        teacher: { enabled: true, order: 1 },
        researcher: { enabled: true, order: 2 },
      },
    },
    legal: {
      termsUrl: '/terms-of-service',
      privacyUrl: '/privacy',
      supportUrl: 'https://support.example.edu',
      licenseSourceUrl: 'https://source.example.edu/project',
    },
    updatedAt: '',
    updatedBy: '',
  };
}

describe('deployment Brand Profile validation', function() {
  it('migrates version 1 profiles without changing their previously visible landing sections', function() {
    const versionOne = completeProfile() as unknown as {
      schemaVersion: number;
      landing: Partial<DeploymentBrandProfile['landing']>;
    };
    versionOne.schemaVersion = 1;
    delete versionOne.landing.heroEnabled;
    delete versionOne.landing.audiencesEnabled;

    const migration = migrateDeploymentBrandProfile(versionOne);
    const result = validateDeploymentBrandProfile(migration.value);

    expect(migration.migrated).to.equal(true);
    expect(result.valid, result.errors.join('\n')).to.equal(true);
    expect(result.profile?.landing.heroEnabled).to.equal(true);
    expect(result.profile?.landing.audiencesEnabled).to.equal(true);
  });

  it('accepts a complete deployment-wide profile', function() {
    const result = validateDeploymentBrandProfile(completeProfile());
    expect(result.valid, result.errors.join('\n')).to.equal(true);
    expect(result.profile?.identity.name).to.equal('Research Learning Lab');
  });

  it('requires every supported locale to be complete', function() {
    const profile = completeProfile();
    profile.locales.fr.heroTitle = '';
    const result = validateDeploymentBrandProfile(profile);
    expect(result.valid).to.equal(false);
    expect(result.errors).to.include('locales.fr.heroTitle is required');
  });

  it('rejects a landing page with no visible section', function() {
    const profile = completeProfile();
    profile.landing.heroEnabled = false;
    profile.landing.audiencesEnabled = false;
    const result = validateDeploymentBrandProfile(profile);
    expect(result.valid).to.equal(false);
    expect(result.errors).to.include('At least one landing section must be visible');
  });

  it('permits all demos to be disabled when the demo section is hidden', function() {
    const profile = completeProfile();
    profile.landing.audiencesEnabled = false;
    for (const audience of Object.values(profile.landing.audiences)) audience.enabled = false;
    const result = validateDeploymentBrandProfile(profile);
    expect(result.valid, result.errors.join('\n')).to.equal(true);
  });

  it('rejects unsafe public URLs', function() {
    const profile = completeProfile();
    profile.identity.logoUrl = 'javascript:alert(1)';
    const result = validateDeploymentBrandProfile(profile);
    expect(result.valid).to.equal(false);
    expect(result.errors.some((error) => error.startsWith('identity.logoUrl must be'))).to.equal(true);
  });
});
