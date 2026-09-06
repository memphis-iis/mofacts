import { Meteor } from 'meteor/meteor';
import { check, Match } from 'meteor/check';
import {
  isThemeDensityScaleProperty,
  isValidThemeDensityScale,
  normalizeThemePropertyValue
} from '../../common/themePropertyNormalization';
import { themeRegistry } from '../lib/themeRegistry';
import {
  requireUserWithRoles,
  type MethodAuthorizationDeps,
} from '../lib/methodAuthorization';

type UnknownRecord = Record<string, unknown>;
type Logger = (...args: unknown[]) => void;
type MethodContext = {
  userId?: string | null;
  unblock?: () => void;
  connection?: { id?: string; clientAddress?: string | null } | null;
};
type ThemeMutable = {
  properties?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  help?: Record<string, unknown> | null;
  enabled?: boolean;
  themeName?: unknown;
  [key: string]: unknown;
};
type ThemeMutator = (theme: ThemeMutable) => ThemeMutable | void;

type ThemeSharedDeps = {
  serverConsole: Logger;
  DynamicSettings: {
    findOneAsync: (selector: UnknownRecord) => Promise<any>;
    upsertAsync: (selector: UnknownRecord, modifier: UnknownRecord) => Promise<unknown>;
  };
  usersCollection: {
    findOneAsync: (selector: UnknownRecord, options?: UnknownRecord) => Promise<any>;
  };
};

type ThemeMethodDeps = ThemeSharedDeps & {
  requireAdminUser: (
    userId: string | null | undefined,
    errMsg?: string,
    errorCode?: string | number
  ) => Promise<void>;
  getMethodAuthorizationDeps: () => MethodAuthorizationDeps;
  updateActiveThemeDocument: (
    userId: string | null | undefined,
    mutator: ThemeMutator
  ) => Promise<{ entry: unknown; serialized: unknown }>;
};

const themeConversionLocks = new Map<string, Promise<void>>();

export function createUpdateActiveThemeDocument(deps: ThemeSharedDeps) {
  return async function updateActiveThemeDocument(
    userId: string | null | undefined,
    mutator: ThemeMutator
  ) {
    let activeSetting = await deps.DynamicSettings.findOneAsync({ key: 'customTheme' });
    if (!activeSetting || !activeSetting.value) {
      await themeRegistry.ensureActiveTheme();
      activeSetting = await deps.DynamicSettings.findOneAsync({ key: 'customTheme' });
    }

    const activeThemeId = activeSetting?.value?.activeThemeId;
    if (!activeThemeId) {
      throw new Meteor.Error('theme-not-found', 'Active theme is not set');
    }

    let entry = themeRegistry.getThemeEntry(activeThemeId);
    if (!entry) {
      await themeRegistry.refreshFromDisk();
      entry = themeRegistry.getThemeEntry(activeThemeId);
    }

    if (!entry) {
      entry = await themeRegistry.ensureStoredThemeRegistered(activeSetting?.value);
    }

    if (!entry) {
      throw new Meteor.Error('theme-not-found', 'Unable to locate active theme');
    }

    if (entry.readOnly) {
      const lockKey = `theme-conversion-${entry.id}`;
      if (themeConversionLocks.has(lockKey)) {
        await themeConversionLocks.get(lockKey);

        activeSetting = await deps.DynamicSettings.findOneAsync({ key: 'customTheme' });
        const newActiveId = activeSetting?.value?.activeThemeId;
        entry = themeRegistry.getThemeEntry(newActiveId);

        if (!entry || entry.readOnly) {
          throw new Meteor.Error('theme-conversion-failed', 'Failed to convert theme to editable');
        }
      } else {
        let resolveConversion: (() => void) | undefined;
        const conversionPromise = new Promise<void>((resolve) => {
          resolveConversion = resolve;
        });
        themeConversionLocks.set(lockKey, conversionPromise);

        try {
          const userRecord = userId
            ? await deps.usersCollection.findOneAsync({ _id: userId }, { fields: { username: 1 } })
            : null;
          entry = await themeRegistry.ensureEditableTheme(entry.id, userRecord?.username || userId || 'admin');
          deps.serverConsole(`Converted read-only theme ${lockKey} to editable: ${entry.id}`);
        } finally {
          if (resolveConversion) {
            resolveConversion();
          }
          themeConversionLocks.delete(lockKey);
        }
      }
    }

    const updatedEntry = await themeRegistry.updateTheme(entry.id, (theme: ThemeMutable) => {
      const result = mutator(theme);
      return result || theme;
    });
    const serialized = themeRegistry.serializeActiveTheme(updatedEntry);
    await deps.DynamicSettings.upsertAsync({ key: 'customTheme' }, { $set: { value: serialized } });
    return { entry: updatedEntry, serialized };
  };
}

async function generateFaviconsFromLogoInternal(serverConsole: Logger, logoDataUrl: string) {
  const { exec } = require('child_process');
  const { promisify } = require('util');
  const execAsync = promisify(exec);
  const fsPromises = require('fs').promises;
  const pathMod = require('path');
  const os = require('os');

  const matches = logoDataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
  if (!matches) {
    throw new Meteor.Error('invalid-format', 'Invalid image data URL format');
  }

  const imageType = matches[1];
  const base64Data = matches[2];
  if (!imageType || !base64Data) {
    throw new Meteor.Error('invalid-format', 'Invalid image data URL format');
  }
  const imageBuffer = Buffer.from(base64Data, 'base64');

  const tmpDir = await fsPromises.mkdtemp(pathMod.join(os.tmpdir(), 'favicon-'));
  const inputPath = pathMod.join(tmpDir, `logo.${imageType}`);
  const favicon16Path = pathMod.join(tmpDir, 'favicon-16.png');
  const favicon32Path = pathMod.join(tmpDir, 'favicon-32.png');

  try {
    await fsPromises.writeFile(inputPath, imageBuffer);
    await execAsync(`convert "${inputPath}" -resize 16x16 -background transparent -flatten "${favicon16Path}"`);
    await execAsync(`convert "${inputPath}" -resize 32x32 -background transparent -flatten "${favicon32Path}"`);

    const favicon16Buffer = await fsPromises.readFile(favicon16Path);
    const favicon32Buffer = await fsPromises.readFile(favicon32Path);

    return {
      favicon_16: `data:image/png;base64,${favicon16Buffer.toString('base64')}`,
      favicon_32: `data:image/png;base64,${favicon32Buffer.toString('base64')}`,
    };
  } finally {
    try {
      await fsPromises.rm(tmpDir, { recursive: true, force: true });
    } catch (cleanupError: unknown) {
      const message = cleanupError instanceof Error ? cleanupError.message : String(cleanupError);
      serverConsole('Warning: Failed to clean up temp directory:', message);
    }
  }
}

export function createThemeMethods(deps: ThemeMethodDeps) {
  return {
    initializeCustomTheme: async function(this: MethodContext, themeName: string | undefined) {
      deps.serverConsole('initializeCustomTheme');

      await deps.requireAdminUser(this.userId, 'Only admins can initialize themes', 'unauthorized');

      const requestedName = typeof themeName === 'string' && themeName.trim() ? themeName.trim() : 'Default';

      if (requestedName === 'Default') {
        return await themeRegistry.setActiveTheme('mofacts-default');
      }

      const createPayload: { name: string; baseThemeId: string; properties: Record<string, never>; author?: string } = {
        name: requestedName,
        baseThemeId: 'mofacts-default',
        properties: {},
      };
      if (this.userId) {
        createPayload.author = this.userId;
      }
      const createdTheme = await themeRegistry.createTheme(createPayload);

      return await themeRegistry.setActiveTheme(createdTheme.id);
    },

    // PHASE 1.5 DEPRECATION: This method is deprecated in favor of 'theme' publication
    // Kept for backward compatibility - new code should use Meteor.subscribe('theme')
    setCustomThemeProperty: async function(this: MethodContext, property: string, value: unknown) {
      deps.serverConsole('setCustomThemeProperty', property);

      await requireUserWithRoles(deps.getMethodAuthorizationDeps(), {
        userId: this.userId,
        roles: ['admin'],
        notLoggedInMessage: 'Must be logged in to modify theme',
        notLoggedInCode: 'not-logged-in',
        forbiddenMessage: 'Only admins can modify theme settings',
        forbiddenCode: 'unauthorized',
      });
      if (typeof property !== 'string' || !property.trim()) {
        throw new Meteor.Error('invalid-property', 'Theme property name is required');
      }

      try {
        if (isThemeDensityScaleProperty(property) && !isValidThemeDensityScale(value)) {
          throw new Meteor.Error('invalid-theme-density', 'Theme density scale must be a number greater than 0 and no greater than 2');
        }
        const normalizedValue = normalizeThemePropertyValue(property, value);
        const updateResult = await deps.updateActiveThemeDocument(this.userId, (theme: ThemeMutable) => {
          theme.properties = theme.properties || {};
          (theme.properties as Record<string, unknown>)[property] = normalizedValue;
          if (property === 'themeName') {
            const normalizedThemeName = typeof normalizedValue === 'string' ? normalizedValue : String(normalizedValue ?? '');
            theme.themeName = normalizedThemeName;
            theme.metadata = theme.metadata || {};
            (theme.metadata as Record<string, unknown>).name = normalizedThemeName;
            (theme.properties as Record<string, unknown>).themeName = normalizedThemeName;
          }
          return theme;
        });

        const serializedTheme = updateResult.serialized;

        if (property === 'brand_logo_url' && value && typeof value === 'string' && value.startsWith('data:image')) {
          const capturedUserId = this.userId;
          const capturedLogoValue = value;
          Meteor.defer(async () => {
            try {
              const favicons = await generateFaviconsFromLogoInternal(deps.serverConsole, capturedLogoValue);
              const faviconUpdates: Record<string, string> = {};
              if (favicons.favicon_16) {
                faviconUpdates.brand_favicon_16_url = favicons.favicon_16;
              }
              if (favicons.favicon_32) {
                faviconUpdates.brand_favicon_32_url = favicons.favicon_32;
              }
              if (Object.keys(faviconUpdates).length) {
                await deps.updateActiveThemeDocument(capturedUserId, (theme: ThemeMutable) => {
                  theme.properties = theme.properties || {};
                  Object.assign(theme.properties as Record<string, unknown>, faviconUpdates);
                  return theme;
                });
              }
              deps.serverConsole('Auto-generated favicons from logo (deferred)');
            } catch (error: unknown) {
              const message = error instanceof Error ? error.message : String(error);
              deps.serverConsole('Warning: Failed to auto-generate favicons:', message);
            }
          });
        }

        return { success: true, property, value, theme: serializedTheme };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        deps.serverConsole('Error setting theme property:', error);
        throw new Meteor.Error('update-failed', 'Failed to update theme property: ' + message);
      }
    },

    generateFaviconsFromLogo: async function(this: MethodContext, logoDataUrl: string) {
      await deps.requireAdminUser(this.userId, 'Only admins can generate favicons', 'unauthorized');
      return await generateFaviconsFromLogoInternal(deps.serverConsole, logoDataUrl);
    },

    toggleCustomTheme: async function(this: MethodContext) {
      deps.serverConsole('toggleCustomTheme');
      await deps.requireAdminUser(this.userId, 'Only admins can toggle themes', 'unauthorized');

      const current = await themeRegistry.ensureActiveTheme();
      const wasEnabled = current?.enabled !== false;
      const nextState = {
        ...current,
        enabled: !wasEnabled,
      };

      await deps.DynamicSettings.upsertAsync({ key: 'customTheme' }, { $set: { value: nextState } });

      const entry = nextState?.activeThemeId ? themeRegistry.getThemeEntry(nextState.activeThemeId) : null;
      if (entry && !entry.readOnly) {
        await themeRegistry.updateTheme(entry.id, (theme: ThemeMutable) => {
          theme.enabled = nextState.enabled;
          return theme;
        });
      }

      deps.serverConsole('custom theme enabled:', nextState.enabled);
      return nextState;
    },

    createThemeFromBase: async function(
      this: MethodContext,
      options: { name: string; baseThemeId?: string; properties?: Record<string, unknown>; activate?: boolean }
    ) {
      deps.serverConsole('createThemeFromBase', options?.name);
      check(options, {
        name: String,
        baseThemeId: Match.Optional(String),
        properties: Match.Optional(Object),
        activate: Match.Optional(Boolean),
      });

      await deps.requireAdminUser(this.userId, 'Only admins can create themes', 'unauthorized');

      const themeCreatePayload: { name: string; baseThemeId: string; author?: string; properties?: Record<string, unknown> } = {
        name: options.name,
        baseThemeId: options.baseThemeId || 'mofacts-default',
      };
      if (this.userId) {
        themeCreatePayload.author = this.userId;
      }
      if (options.properties !== undefined) {
        themeCreatePayload.properties = options.properties;
      }
      const theme = await themeRegistry.createTheme(themeCreatePayload);

      if (options.activate === false) {
        return theme;
      }
      return await themeRegistry.setActiveTheme(theme.id);
    },

    duplicateTheme: async function(
      this: MethodContext,
      options: { sourceThemeId: string; name: string; activate?: boolean }
    ) {
      deps.serverConsole('duplicateTheme', options?.sourceThemeId, options?.name);
      check(options, {
        sourceThemeId: String,
        name: String,
        activate: Match.Optional(Boolean),
      });

      await deps.requireAdminUser(this.userId, 'Only admins can duplicate themes', 'unauthorized');

      const sourceEntry = themeRegistry.getThemeEntry(options.sourceThemeId);
      if (!sourceEntry) {
        throw new Meteor.Error('theme-not-found', 'Source theme not found');
      }

      const duplicatePayload: { name: string; baseThemeId: string; properties: Record<string, unknown>; author?: string } = {
        name: options.name,
        baseThemeId: sourceEntry.id,
        properties: sourceEntry.data.properties,
      };
      if (this.userId) {
        duplicatePayload.author = this.userId;
      }
      const theme = await themeRegistry.createTheme(duplicatePayload);

      if (options.activate === false) {
        return theme;
      }
      return await themeRegistry.setActiveTheme(theme.id);
    },

    importThemeFile: async function(this: MethodContext, payload: unknown, activate: boolean = true) {
      deps.serverConsole('importThemeFile');
      await deps.requireAdminUser(this.userId, 'Only admins can import themes', 'unauthorized');

      let parsedPayload = payload;
      if (typeof payload === 'string') {
        try {
          parsedPayload = JSON.parse(payload);
        } catch (_err: unknown) {
          throw new Meteor.Error('invalid-json', 'Uploaded theme is not valid JSON');
        }
      }

      if (!parsedPayload || typeof parsedPayload !== 'object') {
        throw new Meteor.Error('invalid-theme', 'Theme payload must be an object');
      }

      const theme = await themeRegistry.importTheme(parsedPayload);
      if (!activate) {
        return theme;
      }
      return await themeRegistry.setActiveTheme(theme.id);
    },

    exportThemeFile: async function(this: MethodContext, themeId: string) {
      deps.serverConsole('exportThemeFile', themeId);
      check(themeId, String);

      await deps.requireAdminUser(this.userId, 'Only admins can export themes', 'unauthorized');

      return await themeRegistry.exportTheme(themeId);
    },

    deleteTheme: async function(this: MethodContext, themeId: string) {
      deps.serverConsole('deleteTheme', themeId);
      check(themeId, String);

      await deps.requireAdminUser(this.userId, 'Only admins can delete themes', 'unauthorized');

      await themeRegistry.deleteTheme(themeId);
      return await themeRegistry.ensureActiveTheme();
    },

    renameTheme: async function(this: MethodContext, options: { themeId: string; newName: string }) {
      deps.serverConsole('renameTheme', options?.themeId, options?.newName);
      check(options, {
        themeId: String,
        newName: String,
      });

      await deps.requireAdminUser(this.userId, 'Only admins can rename themes', 'unauthorized');

      return await themeRegistry.renameTheme(options.themeId, options.newName);
    },

    setActiveTheme: async function(this: MethodContext, themeId: string) {
      deps.serverConsole('setActiveTheme', themeId);
      check(themeId, String);

      await deps.requireAdminUser(this.userId, 'Only admins can change the active theme', 'unauthorized');

      return await themeRegistry.setActiveTheme(themeId);
    },

    setCustomHelpPage: async function(this: MethodContext, markdownContent: string) {
      deps.serverConsole('setCustomHelpPage');

      await deps.requireAdminUser(this.userId, 'Only admins can set custom help page', 'unauthorized');

      if (typeof markdownContent !== 'string') {
        throw new Meteor.Error('invalid-help', 'Help content must be text');
      }

      if (markdownContent.length > 1048576) {
        throw new Meteor.Error('file-too-large', 'Help file must be less than 1MB');
      }

      const timestamp = new Date().toISOString();

      await deps.updateActiveThemeDocument(this.userId, (theme: ThemeMutable) => {
        theme.help = {
          enabled: true,
          format: 'markdown',
          markdown: markdownContent,
          url: '',
          uploadedAt: timestamp,
          uploadedBy: this.userId,
          source: 'admin',
        };
        return theme;
      });

      return { success: true };
    },

    getCustomHelpPage: async function() {
      deps.serverConsole('getCustomHelpPage');

      const activeTheme = await themeRegistry.ensureActiveTheme();
      const help = activeTheme?.help;

      if (!help || help.enabled === false) {
        return null;
      }

      if (help.markdown && help.markdown.length) {
        return help.markdown;
      }

      return null;
    },

    removeCustomHelpPage: async function(this: MethodContext) {
      deps.serverConsole('removeCustomHelpPage');

      await deps.requireAdminUser(this.userId, 'Only admins can remove custom help page', 'unauthorized');

      const timestamp = new Date().toISOString();

      await deps.updateActiveThemeDocument(this.userId, (theme: ThemeMutable) => {
        const existingHelp = (theme.help || {}) as Record<string, unknown>;
        theme.help = {
          enabled: false,
          format: existingHelp.format || 'markdown',
          markdown: '',
          url: '',
          uploadedAt: timestamp,
          uploadedBy: this.userId,
          source: 'admin',
        };
        return theme;
      });

      return { success: true };
    },

    getCustomHelpPageStatus: async function() {
      deps.serverConsole('getCustomHelpPageStatus');

      const activeTheme = await themeRegistry.ensureActiveTheme();
      const help = activeTheme?.help;

      if (!help || help.enabled === false || (!help.markdown && !help.url)) {
        return {
          enabled: false,
          uploadedAt: null,
          uploadedBy: null,
        };
      }

      return {
        enabled: true,
        uploadedAt: help.uploadedAt || null,
        uploadedBy: help.uploadedBy || null,
      };
    },
  };
}
