import fs from 'fs';
import path from 'path';
import { randomBytes } from 'crypto';
import { Meteor } from 'meteor/meteor';
import { DynamicSettings } from '../../common/Collections';
import { isValidThemeDensityScale, normalizeThemePropertyValue } from '../../common/themePropertyNormalization';

const { promises: fsp } = fs;

const THEME_LIBRARY_KEY = 'themeLibrary';
const ACTIVE_THEME_KEY = 'customTheme';
const DEFAULT_THEME_ID = 'mofacts-default';
const PUBLIC_THEME_ENV = process.env.MOFACTS_DEFAULT_THEME_DIR;

const FALLBACK_THEME = {
  id: DEFAULT_THEME_ID,
  themeName: 'Default',
  enabled: true,
  properties: {
    themeName: 'Default',
    app_background_color: '#F2F2F2',
    app_text_color: '#000000',
    app_page_header_text_color: '#000000',
    app_primary_action_surface_color: '#7ed957',
    app_primary_action_text_color: '#000000',
    app_accent_color: '#7ed957',
    app_secondary_surface_color: '#d9d9d9',
    app_secondary_text_color: '#000000',
    learning_card_audio_icon_disabled_color: '#6c757d',
    learning_card_audio_control_color: '#7ed957',
    feedback_correct_color: '#00cc00',
    feedback_error_color: '#ff0000',
    navigation_text_color: '#000000',
    navigation_surface_color: '#ffffff',
    learning_card_surface_color: '#ffffff',
    learning_card_stimulus_surface_color: '#ffffff',
    media_video_overlay_surface_color: 'color-mix(in srgb, var(--learning-card-surface-color) 98%, transparent)',
    media_video_overlay_backdrop_color: 'color-mix(in srgb, var(--app-text-color) 60%, transparent)',
    app_surface_shadow: '0 4px 12px color-mix(in srgb, var(--app-text-color) 18%, transparent)',
    learning_card_performance_divider_color: 'color-mix(in srgb, var(--app-text-color) 15%, transparent)',
    app_loading_overlay_color: 'color-mix(in srgb, var(--app-background-color) 95%, transparent)',
    learning_card_primary_action_surface_color: '#7FC89E',
    learning_card_primary_action_text_color: '#000000',
    practice_menu_accuracy_bar_fill_color: '#7ed957',
    practice_menu_accuracy_bar_track_color: 'color-mix(in srgb, var(--app-text-color) 12%, transparent)',
    practice_menu_underlay_image_url: '',
    practice_menu_welcome_html: '<h1>Welcome back!</h1><p>Access your teaching tools, resources, and system functions.</p>',
    practice_menu_first_practice_welcome_html: '<h1>Welcome!</h1><p>Choose a lesson below to begin your first practice session.</p>',
    brand_display_label: '',
    brand_logo_url: '/images/themes/brain-logo.png',
    brand_favicon_16_url: '/images/themes/brain-16.png',
    brand_favicon_32_url: '/images/themes/brain-32.png',
    brand_apple_touch_icon_url: '/images/themes/brain-apple-touch-180.png',
    brand_android_icon_192_url: '/images/themes/brain-android-192.png',
    brand_android_icon_512_url: '/images/themes/brain-android-512.png',
    brand_android_maskable_icon_192_url: '/images/themes/brain-maskable-192.png',
    brand_android_maskable_icon_512_url: '/images/themes/brain-maskable-512.png',
    auth_sign_in_description: 'A web-based adaptive learning system that uses spaced practice and retrieval to help you learn and retain information more effectively. Sign in to access your personalized learning experience.',
    app_border_radius_sm: '8px',
    app_border_radius_lg: '12px',
    app_transition_instant: '10ms',
    app_transition_fast: '100ms',
    app_transition_smooth: '200ms',
    app_font_stylesheet_url: '',
    app_font_family: 'system-ui, -apple-system, "Segoe UI", sans-serif',
    app_heading_font_family: 'var(--app-font-family)',
    app_font_size_base: '16px',
    app_density_scale: '1',
    app_button_height: '44px',
    app_text_input_height: '36px',
    app_button_border_darkness: 20,
    app_button_hover_darkness: 15
  },
  metadata: {
    name: 'Default',
    version: 1,
    author: 'system',
    origin: 'system',
    tags: ['default', 'baseline'],
    filename: 'mofacts-default.json',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  help: null
};
const FALLBACK_PROPERTIES = FALLBACK_THEME.properties || {};
const LEGACY_THEME_PROPERTY_RENAMES: Record<string, string> = {
  background_color: 'app_background_color',
  text_color: 'app_text_color',
  page_header_text_color: 'app_page_header_text_color',
  button_color: 'app_primary_action_surface_color',
  primary_button_text_color: 'app_primary_action_text_color',
  accent_color: 'app_accent_color',
  secondary_color: 'app_secondary_surface_color',
  secondary_text_color: 'app_secondary_text_color',
  audio_icon_disabled_color: 'learning_card_audio_icon_disabled_color',
  audio_control_color: 'learning_card_audio_control_color',
  success_color: 'feedback_correct_color',
  alert_color: 'feedback_error_color',
  navbar_text_color: 'navigation_text_color',
  neutral_color: 'navigation_surface_color',
  card_background_color: 'learning_card_surface_color',
  stimuli_box_color: 'learning_card_stimulus_surface_color',
  video_overlay_surface_color: 'media_video_overlay_surface_color',
  video_overlay_backdrop_color: 'media_video_overlay_backdrop_color',
  surface_shadow: 'app_surface_shadow',
  performance_divider_color: 'learning_card_performance_divider_color',
  loading_overlay_color: 'app_loading_overlay_color',
  main_button_color: 'learning_card_primary_action_surface_color',
  main_button_text_color: 'learning_card_primary_action_text_color',
  home_hero_image_url: 'practice_menu_underlay_image_url',
  home_welcome_html: 'practice_menu_welcome_html',
  home_no_practice_welcome_html: 'practice_menu_first_practice_welcome_html',
  brand_label: 'brand_display_label',
  logo_url: 'brand_logo_url',
  favicon_16_url: 'brand_favicon_16_url',
  favicon_32_url: 'brand_favicon_32_url',
  apple_touch_icon_url: 'brand_apple_touch_icon_url',
  android_icon_192_url: 'brand_android_icon_192_url',
  android_icon_512_url: 'brand_android_icon_512_url',
  android_maskable_icon_192_url: 'brand_android_maskable_icon_192_url',
  android_maskable_icon_512_url: 'brand_android_maskable_icon_512_url',
  signInDescription: 'auth_sign_in_description',
  border_radius_sm: 'app_border_radius_sm',
  border_radius_lg: 'app_border_radius_lg',
  transition_instant: 'app_transition_instant',
  transition_fast: 'app_transition_fast',
  transition_smooth: 'app_transition_smooth',
  font_stylesheet_url: 'app_font_stylesheet_url',
  font_family: 'app_font_family',
  heading_font_family: 'app_heading_font_family',
  font_size_base: 'app_font_size_base',
  button_height: 'app_button_height',
  button_border_darkness: 'app_button_border_darkness',
  button_hover_darkness: 'app_button_hover_darkness'
};
type DerivedThemeIconPropertyName =
  | 'brand_apple_touch_icon_url'
  | 'brand_android_icon_192_url'
  | 'brand_android_icon_512_url'
  | 'brand_android_maskable_icon_192_url'
  | 'brand_android_maskable_icon_512_url';

function clone<T = any>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function slugify(value: any): string {
  return (value || '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || `theme-${randomBytes(2).toString('hex')}`;
}

function sanitizeFilename(name: string | undefined) {
  // Strip .json extension if present before slugifying to prevent "json-json-json..." bug
  const nameWithoutExt = (name || 'theme').replace(/\.json$/i, '');
  const base = slugify(nameWithoutExt);
  return `${base}.json`;
}

function sanitizeHelp(help: any) {
  if (!help || typeof help !== 'object') {
    return null;
  }

  const markdown =
    typeof help.markdown === 'string' && help.markdown.trim().length
      ? help.markdown
      : typeof help.markdownContent === 'string' && help.markdownContent.trim().length
      ? help.markdownContent
      : '';

  const url = typeof help.url === 'string' && help.url.trim().length ? help.url.trim() : '';

  if (!markdown && !url) {
    return null;
  }

  return {
    enabled: help.enabled !== false,
    format: markdown ? 'markdown' : 'url',
    markdown: markdown,
    url: markdown ? '' : url,
    uploadedAt: help.uploadedAt || help.updatedAt || nowIso(),
    uploadedBy: help.uploadedBy || null,
    fileName: help.fileName || null,
    source: help.source || 'theme'
  };
}

function nowIso() {
  return new Date().toISOString();
}

function findDefaultThemeDirs() {
  const dirs = [];
  if (PUBLIC_THEME_ENV) {
    dirs.push(PUBLIC_THEME_ENV);
  }
  const cwd = process.cwd();
  dirs.push(path.join(cwd, 'public', 'themes'));
  dirs.push(path.join(cwd, '..', 'public', 'themes'));
  dirs.push(path.join(cwd, '..', 'app', 'public', 'themes'));
  dirs.push(path.join(cwd, '..', 'web.browser', 'app', 'themes'));
  dirs.push(path.join(cwd, '..', '..', 'web.browser', 'app', 'themes'));
  return [...new Set(dirs.filter((dir) => dir && fs.existsSync(dir)))];
}

const DERIVED_THEME_ICON_PATHS: Record<DerivedThemeIconPropertyName, string> = {
  brand_apple_touch_icon_url: 'apple-touch-180',
  brand_android_icon_192_url: 'android-192',
  brand_android_icon_512_url: 'android-512',
  brand_android_maskable_icon_192_url: 'maskable-192',
  brand_android_maskable_icon_512_url: 'maskable-512'
};

const BUNDLED_THEME_ASSET_ROOTS = [
  path.join(process.cwd(), 'public'),
  path.join(process.cwd(), '..', 'public'),
  path.join(process.cwd(), '..', 'app', 'public'),
  path.join(process.cwd(), '..', 'web.browser', 'app'),
  path.join(process.cwd(), '..', '..', 'web.browser', 'app'),
  '/opt/bundle/bundle/programs/web.browser/app',
  '/opt/bundle/bundle/programs/web.browser.legacy/app',
  '/opt/bundle/bundle/programs/web.cordova/app'
];

function asNonEmptyString(value: unknown) {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function extractBundledThemeStem(assetUrl: unknown) {
  const normalized = asNonEmptyString(assetUrl);
  if (!normalized) {
    return null;
  }

  const match = normalized.match(/^\/images\/themes\/([a-z0-9-]+?)-(?:logo|16|32|apple-touch-180|android-192|android-512|maskable-192|maskable-512)\.(?:png|svg|jpg|jpeg|webp)$/i);
  return match?.[1] || null;
}

function buildBundledThemeAssetPath(stem: string, suffix: string) {
  return `/images/themes/${stem}-${suffix}.png`;
}

function hasBundledThemeAsset(assetPath: string) {
  const relativeAssetPath = assetPath.replace(/^\/+/, '');
  for (const root of BUNDLED_THEME_ASSET_ROOTS) {
    const absolutePath = path.resolve(root, relativeAssetPath);
    const normalizedRoot = path.resolve(root);
    if (!absolutePath.startsWith(normalizedRoot)) {
      continue;
    }
    if (fs.existsSync(absolutePath)) {
      return true;
    }
  }
  return false;
}

function resolveThemeAssetStem(properties: Record<string, unknown>) {
  const candidateFields = [
    properties.brand_logo_url,
    properties.brand_favicon_32_url,
    properties.brand_favicon_16_url,
    properties.brand_apple_touch_icon_url,
    properties.brand_android_icon_192_url,
    properties.brand_android_icon_512_url
  ];

  for (const candidate of candidateFields) {
    const stem = extractBundledThemeStem(candidate);
    if (stem) {
      return stem;
    }
  }

  return null;
}

function normalizeThemeIconProperties(
  mergedProperties: Record<string, unknown>,
  sourceProperties: Record<string, unknown>
) {
  const normalizedProperties = { ...mergedProperties };
  const derivedStem = resolveThemeAssetStem(sourceProperties) || resolveThemeAssetStem(mergedProperties);
  if (!derivedStem) {
    return normalizedProperties;
  }

  for (const [propertyName, assetSuffix] of Object.entries(DERIVED_THEME_ICON_PATHS) as Array<[DerivedThemeIconPropertyName, string]>) {
    const expectedAssetPath = buildBundledThemeAssetPath(derivedStem, assetSuffix);
    if (!hasBundledThemeAsset(expectedAssetPath)) {
      continue;
    }

    const currentValue = asNonEmptyString(normalizedProperties[propertyName]);
    if (!currentValue) {
      normalizedProperties[propertyName] = expectedAssetPath;
      continue;
    }

    if (currentValue.startsWith('data:image/')) {
      continue;
    }

    const currentStem = extractBundledThemeStem(currentValue);
    if (currentStem && currentStem !== derivedStem) {
      normalizedProperties[propertyName] = expectedAssetPath;
      continue;
    }

    if (!(propertyName in sourceProperties) && currentValue === FALLBACK_PROPERTIES[propertyName] && expectedAssetPath !== currentValue) {
      normalizedProperties[propertyName] = expectedAssetPath;
    }
  }

  return normalizedProperties;
}

function migrateLegacyThemeProperties(properties: Record<string, unknown>) {
  const migrated: Record<string, unknown> = {};

  for (const [property, value] of Object.entries(properties)) {
    const renamedProperty = LEGACY_THEME_PROPERTY_RENAMES[property];
    if (!renamedProperty) {
      migrated[property] = value;
      continue;
    }

    if (renamedProperty in properties && properties[renamedProperty] !== value) {
      throw new Error(`Theme contains conflicting legacy and current values for ${property} and ${renamedProperty}`);
    }

    if (!(renamedProperty in migrated)) {
      migrated[renamedProperty] = value;
    }
  }

  return migrated;
}

function mergeWithFallbackProps(properties: any, derivedName: string) {
  const normalized = migrateLegacyThemeProperties(
    properties && typeof properties === 'object' ? properties : {}
  );
  if ('app_density_scale' in normalized && !isValidThemeDensityScale(normalized.app_density_scale)) {
    throw new Error('Theme property app_density_scale must be a number greater than 0 and no greater than 2');
  }
  if ('app_density_scale' in normalized) {
    normalized.app_density_scale = normalizeThemePropertyValue('app_density_scale', normalized.app_density_scale);
  }
  const merged = {
    ...FALLBACK_PROPERTIES,
    ...normalized,
    app_page_header_text_color: normalized.app_page_header_text_color || normalized.app_text_color || FALLBACK_PROPERTIES.app_page_header_text_color,
    themeName: normalized.themeName || derivedName
  };
  return normalizeThemeIconProperties(merged, normalized);
}

function sanitizeTheme(rawTheme: any, origin: string, fileName?: string) {
  const base = rawTheme && typeof rawTheme === 'object' ? clone(rawTheme) : {};
  const properties = base.properties && typeof base.properties === 'object' ? base.properties : {};
  const derivedName =
    (typeof base.themeName === 'string' && base.themeName.trim()) ||
    (typeof properties.themeName === 'string' && properties.themeName.trim()) ||
    (base.metadata && typeof base.metadata.name === 'string' && base.metadata.name.trim()) ||
    'Untitled Theme';

  const metadata = base.metadata && typeof base.metadata === 'object' ? clone(base.metadata) : {};
  const timestamp = nowIso();
  const mergedProperties = mergeWithFallbackProps(properties, derivedName);
  const sanitized: any = {
    id: base.id || metadata.id || slugify(derivedName),
    themeName: derivedName,
    enabled: base.enabled !== false,
    properties: mergedProperties,
    metadata: {
      ...metadata,
      id: base.id || metadata.id || slugify(derivedName),
      name: metadata.name || derivedName,
      version: metadata.version || 1,
      author: metadata.author || (origin === 'system' ? 'system' : 'unknown'),
      origin,
      tags: Array.isArray(metadata.tags) ? metadata.tags : [],
      filename: sanitizeFilename(metadata.filename || fileName || derivedName),
      createdAt: metadata.createdAt || timestamp,
      updatedAt: metadata.updatedAt || timestamp
    }
  };

  const help = sanitizeHelp(base.help);
  if (help) {
    sanitized.help = help;
  }
  return sanitized;
}

class ThemeRegistry {
  themes: Map<string, any> = new Map();
  publicDirs: string[] = [];

  constructor() {
    this.publicDirs = findDefaultThemeDirs();
  }

  async initialize() {
    await this.refreshFromDisk();
    await this.ensureActiveTheme();
  }

  async refreshFromDisk() {
    const previousThemes = this.themes;
    const previousPublicDirs = this.publicDirs;

    this.themes = new Map();
    try {
      this.publicDirs = findDefaultThemeDirs();
      for (const dir of this.publicDirs) {
        await this.loadDirectory(dir, 'system');
      }
      await this.loadStoredCustomThemes();
      await this.persistLibrarySetting();
    } catch (error) {
      this.themes = previousThemes;
      this.publicDirs = previousPublicDirs;
      throw error;
    }
  }

  async loadDirectory(dirPath: string, origin: string) {
    if (!dirPath || !fs.existsSync(dirPath)) {
      return;
    }

    const entries = await fsp.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.json')) {
        continue;
      }
      const absolutePath = path.join(dirPath, entry.name);
      try {
        const raw = JSON.parse(await fsp.readFile(absolutePath, 'utf8'));
        const sanitized = sanitizeTheme(raw, origin, entry.name);
        this.registerTheme(sanitized, origin === 'system', absolutePath);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to load theme file ${absolutePath}: ${message}`);
      }
    }
  }

  async loadStoredCustomThemes() {
    const existingLibrarySetting = await DynamicSettings.findOneAsync({ key: THEME_LIBRARY_KEY });
    const library = existingLibrarySetting?.value;
    if (!Array.isArray(library)) {
      return;
    }

    for (const theme of library) {
      if (theme?.metadata?.origin !== 'custom') {
        continue;
      }

      const sanitized = this.prepareStoredCustomTheme(theme);
      this.registerTheme(sanitized, false, null);
    }
  }

  prepareStoredCustomTheme(themeData: any) {
    const theme = sanitizeTheme(themeData, 'custom', themeData?.metadata?.filename);
    theme.metadata = {
      ...theme.metadata,
      filename: sanitizeFilename(theme.metadata?.filename || theme.themeName),
      origin: 'custom',
      updatedAt: theme.metadata?.updatedAt || nowIso()
    };
    return theme;
  }

  allocateThemeId(baseId: string) {
    const normalizedBaseId = slugify(baseId);
    let candidateId = normalizedBaseId;
    let counter = 1;
    while (this.themes.has(candidateId)) {
      candidateId = `${normalizedBaseId}-${counter++}`;
    }
    return candidateId;
  }

  registerTheme(themeData: any, readOnly: boolean, filePath: string | null) {
    const candidateId = themeData.id || slugify(themeData.themeName);
    if (this.themes.has(candidateId)) {
      const existing = this.themes.get(candidateId);
      const existingName = existing?.data?.metadata?.name || existing?.data?.themeName || 'unknown';
      const incomingName = themeData?.metadata?.name || themeData?.themeName || 'unknown';
      throw new Error(`Theme id collision for "${candidateId}" between "${existingName}" and "${incomingName}"`);
    }

    themeData.id = candidateId;
    themeData.metadata = themeData.metadata || {};
    themeData.metadata.id = candidateId;

    this.themes.set(candidateId, {
      id: candidateId,
      readOnly,
      filePath,
      data: themeData
    });
  }

  listThemes() {
    return Array.from(this.themes.values())
      .map((entry) => entry.data)
      .sort((a, b) => (a.metadata.name || '').localeCompare(b.metadata.name || ''));
  }

  getThemeEntry(themeId: string) {
    if (!themeId) {
      return null;
    }
    return this.themes.get(themeId) || null;
  }

  serializeActiveTheme(entry: any) {
    if (!entry) {
      return null;
    }
    const active = clone(entry.data);
    active.properties = mergeWithFallbackProps(
      active.properties,
      active.themeName || active.properties?.themeName || active.metadata?.name || 'Default'
    );
    active.activeThemeId = entry.id;
    return active;
  }

  async persistLibrarySetting() {
    const library = this.listThemes();
    await DynamicSettings.upsertAsync(
      { key: THEME_LIBRARY_KEY },
      { $set: { value: library } }
    );
    return library;
  }

  async ensureActiveTheme() {
    const existing = await DynamicSettings.findOneAsync({ key: ACTIVE_THEME_KEY });
    if (existing && existing.value) {
      // Legacy themes might not have ids; try to adopt them
      if (!existing.value.activeThemeId && existing.value.themeName) {
        await this.adoptLegacyTheme(existing.value);
        const refreshed = await DynamicSettings.findOneAsync({ key: ACTIVE_THEME_KEY });
        return refreshed?.value;
      }

      const activeId = existing.value.activeThemeId;
      if (activeId) {
        let entry = this.getThemeEntry(activeId);
        if (!entry) {
          entry = await this.ensureStoredThemeRegistered(existing.value);
          if (entry) {
            const stored = this.serializeActiveTheme(entry);
            await DynamicSettings.upsertAsync({ key: ACTIVE_THEME_KEY }, { $set: { value: stored } });
            return stored;
          }
        }
        if (entry) {
          const stored = this.serializeActiveTheme(entry);
          await DynamicSettings.upsertAsync({ key: ACTIVE_THEME_KEY }, { $set: { value: stored } });
          return stored;
        }
      }
      const safeExisting = clone(existing.value);
      safeExisting.properties = mergeWithFallbackProps(
        safeExisting.properties,
        safeExisting.themeName || safeExisting.properties?.themeName || safeExisting.metadata?.name || 'Default'
      );
      return safeExisting;
    }

    const fallbackEntry =
      this.getThemeEntry(DEFAULT_THEME_ID) ||
      this.listThemes()
        .map((data) => this.getThemeEntry(data.id))
        .find(Boolean);

    if (fallbackEntry) {
      const stored = this.serializeActiveTheme(fallbackEntry);
      await DynamicSettings.upsertAsync({ key: ACTIVE_THEME_KEY }, { $set: { value: stored } });
      return stored;
    }

    // As a last resort, store the built-in fallback
    const fallback: any = clone(FALLBACK_THEME);
    fallback.activeThemeId = fallback.id;
    await DynamicSettings.upsertAsync({ key: ACTIVE_THEME_KEY }, { $set: { value: fallback } });
    return fallback;
  }

  async adoptLegacyTheme(legacyValue: any) {
    const theme = this.prepareStoredCustomTheme(legacyValue);
    this.registerTheme(theme, false, null);
    await this.persistLibrarySetting();
    await DynamicSettings.upsertAsync(
      { key: ACTIVE_THEME_KEY },
      { $set: { value: this.serializeActiveTheme(this.getThemeEntry(theme.id)) } }
    );
  }

  async ensureStoredThemeRegistered(storedValue: any) {
    if (!storedValue) {
      return null;
    }

    const candidateId =
      storedValue.activeThemeId ||
      storedValue.id ||
      storedValue.metadata?.id ||
      slugify(storedValue.themeName || storedValue.properties?.themeName || 'theme');

    let entry = this.getThemeEntry(candidateId);
    if (entry) {
      return entry;
    }

    const sanitized = sanitizeTheme(
      {
        ...storedValue,
        id: candidateId,
        metadata: {
          ...(storedValue.metadata || {}),
          id: candidateId,
          name:
            storedValue.metadata?.name ||
            storedValue.properties?.themeName ||
            storedValue.themeName ||
            'Theme'
        },
        properties: storedValue.properties || {},
        help: storedValue.help || null
      },
      'custom',
      storedValue.metadata?.filename
    );

    sanitized.id = candidateId;
    sanitized.metadata.id = candidateId;
    const theme = this.prepareStoredCustomTheme(sanitized);
    this.registerTheme(theme, false, null);
    await this.persistLibrarySetting();
    return this.getThemeEntry(theme.id);
  }

  async setActiveTheme(themeId: string) {
    const entry = this.getThemeEntry(themeId);
    if (!entry) {
      throw new Meteor.Error('theme-not-found', 'Theme not found');
    }
    const stored = this.serializeActiveTheme(entry);
    await DynamicSettings.upsertAsync({ key: ACTIVE_THEME_KEY }, { $set: { value: stored } });
    return stored;
  }

  async createTheme({ name, baseThemeId, properties, author }: { name: string; baseThemeId?: string; properties?: Record<string, any>; author?: string }) {
    if (!name || !name.trim()) {
      throw new Meteor.Error('invalid-name', 'Theme name is required');
    }

    const baseEntry = baseThemeId ? this.getThemeEntry(baseThemeId) : this.getThemeEntry(DEFAULT_THEME_ID);
    const baseData = baseEntry ? baseEntry.data : FALLBACK_THEME;
    const themeId = this.allocateThemeId(name);
    const themeData = sanitizeTheme(
      {
        ...baseData,
        id: themeId,
        metadata: {
          ...baseData.metadata,
          id: themeId,
          name
        },
        properties: {
          ...baseData.properties,
          ...properties,
          themeName: properties?.themeName || name
        }
      },
      'custom'
    );
    themeData.metadata.author = author || 'admin';
    themeData.metadata.createdAt = nowIso();
    themeData.metadata.updatedAt = nowIso();
    const theme = this.prepareStoredCustomTheme(themeData);
    this.registerTheme(theme, false, null);
    await this.persistLibrarySetting();
    return theme;
  }

  async importTheme(themePayload: string | Record<string, any>) {
    const raw = typeof themePayload === 'string' ? JSON.parse(themePayload) : themePayload;
    const sanitized = sanitizeTheme(raw, 'custom', raw?.metadata?.filename);
    sanitized.id = this.allocateThemeId(`${slugify(sanitized.metadata.name)}-${randomBytes(2).toString('hex')}`);
    sanitized.metadata.id = sanitized.id;
    const theme = this.prepareStoredCustomTheme(sanitized);
    this.registerTheme(theme, false, null);
    await this.persistLibrarySetting();
    return theme;
  }

  async deleteTheme(themeId: string) {
    const entry = this.getThemeEntry(themeId);
    if (!entry) {
      throw new Meteor.Error('theme-not-found', 'Theme not found');
    }
    if (entry.readOnly) {
      throw new Meteor.Error('read-only-theme', 'System themes cannot be deleted');
    }

    this.themes.delete(themeId);
    await this.persistLibrarySetting();

    const active = await DynamicSettings.findOneAsync({ key: ACTIVE_THEME_KEY });
    if (active?.value?.activeThemeId === themeId) {
      await DynamicSettings.upsertAsync(
        { key: ACTIVE_THEME_KEY },
        { $set: { value: null } }
      );
      await this.ensureActiveTheme();
    }
  }

  async renameTheme(themeId: string, newName: string) {
    const entry = this.getThemeEntry(themeId);
    if (!entry) {
      throw new Meteor.Error('theme-not-found', 'Theme not found');
    }
    if (entry.readOnly) {
      throw new Meteor.Error('read-only-theme', 'System themes cannot be renamed');
    }

    entry.data.metadata.name = newName;
    entry.data.metadata.updatedAt = nowIso();

    await this.persistLibrarySetting();

    const active = await DynamicSettings.findOneAsync({ key: ACTIVE_THEME_KEY });
    if (active?.value?.activeThemeId === themeId) {
      const stored = this.serializeActiveTheme(entry);
      await DynamicSettings.upsertAsync(
        { key: ACTIVE_THEME_KEY },
        { $set: { value: stored } }
      );
    }

    return entry.data;
  }

  async ensureEditableTheme(themeId: string, userName = 'admin') {
    const entry = this.getThemeEntry(themeId);
    if (!entry) {
      throw new Meteor.Error('theme-not-found', 'Theme not found');
    }
    if (!entry.readOnly) {
      return entry;
    }
    const cloneName = `${entry.data.metadata.name || entry.data.themeName} Copy`;
    const clone = await this.createTheme({
      name: cloneName,
      baseThemeId: entry.id,
      properties: entry.data.properties,
      author: userName
    });
    await this.setActiveTheme(clone.id);
    return this.getThemeEntry(clone.id);
  }

  async updateTheme(themeId: string, mutator: (theme: any) => any) {
    const entry = this.getThemeEntry(themeId);
    if (!entry) {
      throw new Meteor.Error('theme-not-found', 'Theme not found');
    }
    if (entry.readOnly) {
      throw new Meteor.Error('read-only-theme', 'System themes cannot be edited directly');
    }
    const nextData = mutator(clone(entry.data));
    nextData.metadata.updatedAt = nowIso();
    entry.data = nextData;
    await this.persistLibrarySetting();
    return entry;
  }

  async exportTheme(themeId: string) {
    const entry = this.getThemeEntry(themeId);
    if (!entry) {
      throw new Meteor.Error('theme-not-found', 'Theme not found');
    }
    return JSON.stringify(entry.data, null, 2);
  }
}

export const themeRegistry = new ThemeRegistry();
