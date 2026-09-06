import {
  TARGET_UI_LOCALES,
  type TargetUiLocale,
  getTextDirectionForLocale,
  requireTargetUiLocale,
} from '../../common/lib/interfaceLocales';
import {
  PLATFORM_LOCALE_RESOURCES,
  PLATFORM_STRING_KEYS,
  type LocaleResource,
  type PlatformStringKey,
} from './interfaceI18nResources';

export type TranslationValues = Record<string, string | number | boolean>;

let platformBrandNameResolver: (() => string) | null = null;

export function setPlatformBrandNameResolver(resolver: () => string): void {
  platformBrandNameResolver = resolver;
}

export function assertCompletePlatformLocaleResources(
  resources: Record<TargetUiLocale, LocaleResource> = PLATFORM_LOCALE_RESOURCES
): void {
  for (const locale of TARGET_UI_LOCALES) {
    const localeResource = resources[locale];
    if (!localeResource) {
      throw new Error(`Missing platform locale resource for "${locale}"`);
    }

    for (const key of PLATFORM_STRING_KEYS) {
      const value = localeResource[key];
      if (typeof value !== 'string' || !value.trim()) {
        throw new Error(`Missing platform translation "${key}" for locale "${locale}"`);
      }
    }
  }
}

function interpolateTemplate(template: string, values: TranslationValues | undefined): string {
  const interpolationValues = values ?? {};

  return template.replace(/\{([A-Za-z0-9_.-]+)\}/g, (match, token: string) => {
    if (!Object.prototype.hasOwnProperty.call(interpolationValues, token)) {
      throw new Error(`Missing interpolation value "${token}" for platform translation`);
    }
    return String(interpolationValues[token]);
  });
}

export function translatePlatformString(
  localeInput: string,
  key: PlatformStringKey,
  values?: TranslationValues
): string {
  const locale = requireTargetUiLocale(localeInput);
  const localeResource = PLATFORM_LOCALE_RESOURCES[locale];
  const template = localeResource[key];
  if (typeof template !== 'string' || !template.trim()) {
    throw new Error(`Missing platform translation "${key}" for locale "${locale}"`);
  }

  const interpolated = interpolateTemplate(template, values);
  const brandName = platformBrandNameResolver?.().trim();
  return brandName ? interpolated.replace(/mofacts/gi, () => brandName) : interpolated;
}

export function getPlatformTextDirection(localeInput: string): 'ltr' | 'rtl' {
  return getTextDirectionForLocale(localeInput);
}
