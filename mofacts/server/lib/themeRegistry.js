import fs from 'fs';
import path from 'path';
import { randomBytes } from 'crypto';
import { Meteor } from 'meteor/meteor';

const { promises: fsp } = fs;

const THEME_LIBRARY_KEY = 'themeLibrary';
const ACTIVE_THEME_KEY = 'customTheme';
const DEFAULT_THEME_ID = 'mofacts-default';
const PUBLIC_THEME_ENV = process.env.MOFACTS_DEFAULT_THEME_DIR;
const CUSTOM_THEME_DIR = process.env.MOFACTS_THEME_DIR || path.join(process.cwd(), 'theme-library');

const FALLBACK_THEME = {
  id: DEFAULT_THEME_ID,
  themeName: 'MoFaCTS',
  enabled: true,
  properties: {
    themeName: 'MoFaCTS',
    background_color: '#F2F2F2',
    text_color: '#000000',
    button_color: '#7ed957',
    primary_button_text_color: '#000000',
    accent_color: '#7ed957',
    secondary_color: '#d9d9d9',
    secondary_text_color: '#000000',
    audio_alert_color: '#06723e',
    audio_icon_color: '#00cc00',
    audio_icon_disabled_color: '#6c757d',
    success_color: '#00cc00',
    navbar_text_color: '#000000',
    navbar_alignment: 'left',
    neutral_color: '#ffffff',
    alert_color: '#ff0000',
    main_button_color: '#7FC89E',
    main_button_text_color: '#000000',
    main_button_hover_color: '#6BB089',
    teacher_button_color: '#7CB8F5',
    teacher_button_text_color: '#000000',
    teacher_button_hover_color: '#6AA5E0',
    shared_button_color: '#7BC5D3',
    shared_button_text_color: '#000000',
    shared_button_hover_color: '#68B0BD',
    admin_button_color: '#F5B57C',
    admin_button_text_color: '#000000',
    admin_button_hover_color: '#E0A366',
    logo_url: '/images/brain-logo.png',
    favicon_16_url: '/images/favicon-16x16.png',
    favicon_32_url: '/images/favicon-32x32.png',
    signInDescription: 'A web-based adaptive learning system that uses spaced practice and retrieval to help you learn and retain information more effectively. Sign in to access your personalized learning experience.',
    border_radius_sm: '8px',
    border_radius_lg: '12px',
    transition_instant: '10ms',
    transition_fast: '100ms',
    transition_smooth: '200ms'
  },
  metadata: {
    name: 'MoFaCTS Default',
    description: 'Baseline MoFaCTS look and feel.',
    version: 1,
    author: 'MoFaCTS',
    origin: 'system',
    tags: ['default', 'baseline'],
    filename: 'mofacts-default.json',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  help: null
};

const log = (...args) => console.log('[ThemeRegistry]', ...args);

function ensureDir(dirPath) {
  if (!dirPath) {
    return;
  }
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function slugify(value) {
  return (value || '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || `theme-${randomBytes(2).toString('hex')}`;
}

function sanitizeFilename(name) {
  const base = slugify(name || 'theme');
  return `${base}.json`;
}

function sanitizeHelp(help) {
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

function sanitizeTheme(rawTheme, origin, fileName) {
  const base = rawTheme && typeof rawTheme === 'object' ? clone(rawTheme) : {};
  const properties = base.properties && typeof base.properties === 'object' ? base.properties : {};
  const derivedName =
    (typeof base.themeName === 'string' && base.themeName.trim()) ||
    (typeof properties.themeName === 'string' && properties.themeName.trim()) ||
    (base.metadata && typeof base.metadata.name === 'string' && base.metadata.name.trim()) ||
    'Untitled Theme';

  const metadata = base.metadata && typeof base.metadata === 'object' ? clone(base.metadata) : {};
  const timestamp = nowIso();
  const sanitized = {
    id: base.id || metadata.id || slugify(derivedName),
    themeName: derivedName,
    enabled: base.enabled !== false,
    properties: {
      ...properties,
      themeName: properties.themeName || derivedName
    },
    metadata: {
      ...metadata,
      id: base.id || metadata.id || slugify(derivedName),
      name: metadata.name || derivedName,
      description: metadata.description || '',
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
  constructor() {
    this.themes = new Map();
    this.publicDirs = findDefaultThemeDirs();
    ensureDir(CUSTOM_THEME_DIR);
  }

  async initialize() {
    await this.refreshFromDisk();
    await this.ensureActiveTheme();
  }

  async refreshFromDisk() {
    this.themes.clear();
    this.publicDirs = findDefaultThemeDirs();
    for (const dir of this.publicDirs) {
      await this.loadDirectory(dir, 'system');
    }
    await this.loadDirectory(CUSTOM_THEME_DIR, 'custom');
    await this.persistLibrarySetting();
  }

  async loadDirectory(dirPath, origin) {
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
        log('Failed to load theme file', absolutePath, error.message);
      }
    }
  }

  registerTheme(themeData, readOnly, filePath) {
    let candidateId = themeData.id || slugify(themeData.themeName);
    let counter = 1;
    while (this.themes.has(candidateId)) {
      candidateId = `${themeData.id}-${counter++}`;
    }

    if (candidateId !== themeData.id) {
      themeData.id = candidateId;
      themeData.metadata.id = candidateId;
      if (readOnly) {
        themeData.metadata.filename = sanitizeFilename(candidateId);
      }
    }

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

  getThemeEntry(themeId) {
    if (!themeId) {
      return null;
    }
    return this.themes.get(themeId) || null;
  }

  serializeActiveTheme(entry) {
    if (!entry) {
      return null;
    }
    const active = clone(entry.data);
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
      }
      return existing.value;
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
    const fallback = clone(FALLBACK_THEME);
    fallback.activeThemeId = fallback.id;
    await DynamicSettings.upsertAsync({ key: ACTIVE_THEME_KEY }, { $set: { value: fallback } });
    return fallback;
  }

  async adoptLegacyTheme(legacyValue) {
    const legacyData = sanitizeTheme(legacyValue, 'custom', legacyValue?.metadata?.filename);
    const { theme, filePath } = await this.writeThemeToDisk(legacyData);
    this.registerTheme(theme, false, filePath);
    await this.persistLibrarySetting();
    await DynamicSettings.upsertAsync(
      { key: ACTIVE_THEME_KEY },
      { $set: { value: this.serializeActiveTheme(this.getThemeEntry(theme.id)) } }
    );
  }

  async ensureStoredThemeRegistered(storedValue) {
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
            'Theme',
          description: storedValue.metadata?.description || ''
        },
        properties: storedValue.properties || {},
        help: storedValue.help || null
      },
      'custom',
      storedValue.metadata?.filename
    );

    sanitized.id = candidateId;
    sanitized.metadata.id = candidateId;
    const { theme, filePath } = await this.writeThemeToDisk(sanitized);
    this.registerTheme(theme, false, filePath);
    await this.persistLibrarySetting();
    return this.getThemeEntry(theme.id);
  }

  async writeThemeToDisk(themeData) {
    const theme = clone(themeData);
    const filename = sanitizeFilename(theme.metadata?.filename || theme.themeName);
    const filePath = path.join(CUSTOM_THEME_DIR, filename);
    theme.metadata = {
      ...theme.metadata,
      filename,
      origin: 'custom',
      updatedAt: nowIso()
    };
    await fsp.writeFile(filePath, JSON.stringify(theme, null, 2), 'utf8');
    return { theme, filePath };
  }

  async setActiveTheme(themeId) {
    const entry = this.getThemeEntry(themeId);
    if (!entry) {
      throw new Meteor.Error('theme-not-found', 'Theme not found');
    }
    const stored = this.serializeActiveTheme(entry);
    await DynamicSettings.upsertAsync({ key: ACTIVE_THEME_KEY }, { $set: { value: stored } });
    return stored;
  }

  async createTheme({ name, description, baseThemeId, properties, author }) {
    if (!name || !name.trim()) {
      throw new Meteor.Error('invalid-name', 'Theme name is required');
    }

    const baseEntry = baseThemeId ? this.getThemeEntry(baseThemeId) : this.getThemeEntry(DEFAULT_THEME_ID);
    const baseData = baseEntry ? baseEntry.data : FALLBACK_THEME;
    const themeData = sanitizeTheme(
      {
        ...baseData,
        metadata: {
          ...baseData.metadata,
          name,
          description: description || baseData.metadata?.description || ''
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
    const { theme, filePath } = await this.writeThemeToDisk(themeData);
    this.registerTheme(theme, false, filePath);
    await this.persistLibrarySetting();
    return theme;
  }

  async importTheme(themePayload) {
    const raw = typeof themePayload === 'string' ? JSON.parse(themePayload) : themePayload;
    const sanitized = sanitizeTheme(raw, 'custom', raw?.metadata?.filename);
    sanitized.id = `${slugify(sanitized.metadata.name)}-${randomBytes(2).toString('hex')}`;
    sanitized.metadata.id = sanitized.id;
    const { theme, filePath } = await this.writeThemeToDisk(sanitized);
    this.registerTheme(theme, false, filePath);
    await this.persistLibrarySetting();
    return theme;
  }

  async deleteTheme(themeId) {
    const entry = this.getThemeEntry(themeId);
    if (!entry) {
      throw new Meteor.Error('theme-not-found', 'Theme not found');
    }
    if (entry.readOnly) {
      throw new Meteor.Error('read-only-theme', 'System themes cannot be deleted');
    }

    await fsp.rm(entry.filePath, { force: true });
    this.themes.delete(themeId);
    await this.persistLibrarySetting();

    const active = await DynamicSettings.findOneAsync({ key: ACTIVE_THEME_KEY });
    if (active?.value?.activeThemeId === themeId) {
      await this.ensureActiveTheme();
    }
  }

  async ensureEditableTheme(themeId, userName = 'admin') {
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
      description: entry.data.metadata.description,
      baseThemeId: entry.id,
      properties: entry.data.properties,
      author: userName
    });
    await this.setActiveTheme(clone.id);
    return this.getThemeEntry(clone.id);
  }

  async updateTheme(themeId, mutator) {
    const entry = this.getThemeEntry(themeId);
    if (!entry) {
      throw new Meteor.Error('theme-not-found', 'Theme not found');
    }
    if (entry.readOnly) {
      throw new Meteor.Error('read-only-theme', 'System themes cannot be edited directly');
    }
    const nextData = mutator(clone(entry.data));
    nextData.metadata.updatedAt = nowIso();
    await fsp.writeFile(entry.filePath, JSON.stringify(nextData, null, 2), 'utf8');
    entry.data = nextData;
    await this.persistLibrarySetting();
    return entry;
  }

  async exportTheme(themeId) {
    const entry = this.getThemeEntry(themeId);
    if (!entry) {
      throw new Meteor.Error('theme-not-found', 'Theme not found');
    }
    return JSON.stringify(entry.data, null, 2);
  }
}

export const themeRegistry = new ThemeRegistry();
