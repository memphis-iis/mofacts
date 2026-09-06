import { Meteor } from 'meteor/meteor';
import { Template } from 'meteor/templating';
import { Session } from 'meteor/session';
import { Tracker } from 'meteor/tracker';
import { ReactiveVar } from 'meteor/reactive-var';
import { getActiveUiLocale } from '../lib/interfaceLocaleState';
import { translatePlatformString } from '../lib/interfaceI18n';
import { formatActiveInterfaceDateTime } from '../lib/interfaceFormatting';
import {
    PUBLIC_EXPERIENCE_KEYS,
    type DeploymentBrandProfile,
    type PublicDemoAudience,
} from '../../common/deploymentBrandProfile';
import { TARGET_LOCALE_DEFINITIONS, TARGET_UI_LOCALES, type TargetUiLocale } from '../../common/lib/interfaceLocales';
import {
    isThemeLengthProperty,
    isThemeDensityScaleProperty,
    isValidThemeDensityScale,
    isThemeTransitionProperty,
    isValidThemeCssLength,
    isValidThemeCssTime,
    normalizeThemePropertyValue,
    themeEditorDisplayValue,
} from '../../common/themePropertyNormalization';
import { clientConsole } from '../lib/clientLogger';
import { createTemplateLifetime } from '../lib/adminUi/templateLifetime';
import { createScopedAsyncCommandRegistry } from '../lib/adminUi/scopedAsyncCommandRegistry';
import { createInlineConfirmationController } from '../lib/adminUi/inlineConfirmationController';
import './themeGenerationWizard';
import './shared/adminUi/adminUi';
import './theme.html';
import './theme.css';

declare const DynamicSettings: any;

const THEME_FONT_STYLESHEET_LINK_ID = 'mofacts-theme-font-stylesheet';
const THEME_IMPORT_MAX_FILE_BYTES = 10 * 1024 * 1024;
const HOME_UNDERLAY_MAX_FILE_BYTES = 5 * 1024 * 1024;
const MIN_ICON_CONTRAST_RATIO = 3;
const BRAND_PROFILE_SUPPLEMENTAL_LOCALE_KEYS = [
    'footerCopyright', 'legalLinkLabel', 'legalPageTitle', 'termsLinkLabel', 'privacyLinkLabel',
    'supportLinkLabel', 'licenseSourceLinkLabel', 'socialTitle', 'socialDescription', 'socialImageAlt',
    'signInDescription',
] as const;

function humanizeBrandField(key: string) {
    return key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (value) => value.toUpperCase());
}

function cloneJson<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
}

async function loadBrandProfileDraft(template: any) {
    try {
        const draft = await (Meteor as any).callAsync('getDeploymentBrandProfileDraft');
        template.brandProfileDraft.set(draft);
        template.brandProfileMessage.set(null);
    } catch (error: any) {
        template.brandProfileMessage.set({ level: 'error', text: error?.reason || error?.message || String(error) });
    }
}

function updateBrandProfileDraft(template: any, mutator: (draft: DeploymentBrandProfile) => void) {
    const current = template.brandProfileDraft.get() as DeploymentBrandProfile | null;
    if (!current) return;
    const next = cloneJson(current);
    mutator(next);
    template.brandProfileDraft.set(next);
}

function themeText(key: Parameters<typeof translatePlatformString>[1], values?: Parameters<typeof translatePlatformString>[2]) {
    return translatePlatformString(getActiveUiLocale(), key, values);
}

type RgbColor = {
    r: number;
    g: number;
    b: number;
};

function getPixelChannel(data: Uint8ClampedArray, index: number) {
    const value = data[index];
    if (value === undefined) {
        throw new Error(`Missing pixel channel at index ${index}`);
    }
    return value;
}

function srgbChannelToLinear(channel: number) {
    const normalized = channel / 255;
    return normalized <= 0.03928
        ? normalized / 12.92
        : Math.pow((normalized + 0.055) / 1.055, 2.4);
}

function getRelativeLuminance(color: RgbColor) {
    return (
        0.2126 * srgbChannelToLinear(color.r) +
        0.7152 * srgbChannelToLinear(color.g) +
        0.0722 * srgbChannelToLinear(color.b)
    );
}

function getContrastRatio(luminanceA: number, luminanceB: number) {
    const lighter = Math.max(luminanceA, luminanceB);
    const darker = Math.min(luminanceA, luminanceB);
    return (lighter + 0.05) / (darker + 0.05);
}

function toTwoDigitHex(channel: number) {
    return Math.max(0, Math.min(255, channel)).toString(16).padStart(2, '0').toUpperCase();
}

function normalizeColorPickerValue(rawValue: unknown): string | null {
    if (typeof rawValue !== 'string') {
        return null;
    }

    const value = rawValue.trim();
    const shortHex = /^#([0-9a-f]{3})$/i.exec(value);
    if (shortHex) {
        const channels = shortHex[1];
        if (!channels) {
            throw new Error(`Invalid short hex color: ${value}`);
        }
        return `#${channels[0]}${channels[0]}${channels[1]}${channels[1]}${channels[2]}${channels[2]}`.toUpperCase();
    }

    if (/^#[0-9a-f]{6}$/i.test(value)) {
        return value.toUpperCase();
    }

    try {
        const parsed = parseCssColor(value);
        return `#${toTwoDigitHex(parsed.r)}${toTwoDigitHex(parsed.g)}${toTwoDigitHex(parsed.b)}`;
    } catch (_err) {
        return null;
    }
}

function syncThemeColorPicker(inputEl: HTMLInputElement, themeProperties: Record<string, unknown>) {
    const propId = inputEl.getAttribute('data-id');
    if (!propId) {
        return;
    }

    const colorValue = normalizeColorPickerValue(themeProperties[propId]);
    if (!colorValue) {
        inputEl.disabled = true;
        inputEl.title = 'This value is not compatible with the native color picker. Edit the text field.';
        return;
    }

    inputEl.disabled = false;
    inputEl.title = '';
    inputEl.value = colorValue;
}

function syncThemeColorPickers(
    root: ParentNode = document,
    themeProperties: Record<string, unknown> | undefined = getServerActiveTheme()?.properties,
) {
    if (!themeProperties) {
        return;
    }

    root.querySelectorAll<HTMLInputElement>('.currentThemePropColor').forEach((inputEl) => {
        syncThemeColorPicker(inputEl, themeProperties);
    });
}

function parseCssColor(value: string): RgbColor {
    if (typeof CSS !== 'undefined' && !CSS.supports('color', value)) {
        throw new Error(`Invalid icon background color: ${value}`);
    }

    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
        throw new Error('Unable to create canvas context for color parsing');
    }

    ctx.fillStyle = '#000000';
    ctx.fillStyle = value;
    ctx.fillRect(0, 0, 1, 1);

    const colorData = ctx.getImageData(0, 0, 1, 1).data;
    return {
        r: getPixelChannel(colorData, 0),
        g: getPixelChannel(colorData, 1),
        b: getPixelChannel(colorData, 2)
    };
}

function getImageRelativeLuminance(img: HTMLImageElement) {
    const sampleSize = 96;
    const canvas = document.createElement('canvas');
    canvas.width = sampleSize;
    canvas.height = sampleSize;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    if (!ctx) {
        throw new Error('Unable to create canvas context for icon contrast sampling');
    }

    ctx.clearRect(0, 0, sampleSize, sampleSize);
    const scale = Math.min(sampleSize / img.width, sampleSize / img.height);
    const drawWidth = img.width * scale;
    const drawHeight = img.height * scale;
    const dx = (sampleSize - drawWidth) / 2;
    const dy = (sampleSize - drawHeight) / 2;
    ctx.drawImage(img, dx, dy, drawWidth, drawHeight);

    const pixels = ctx.getImageData(0, 0, sampleSize, sampleSize).data;
    let weightedLuminance = 0;
    let alphaWeight = 0;

    for (let i = 0; i < pixels.length; i += 4) {
        const alpha = getPixelChannel(pixels, i + 3) / 255;
        if (alpha <= 0.05) {
            continue;
        }

        weightedLuminance += getRelativeLuminance({
            r: getPixelChannel(pixels, i),
            g: getPixelChannel(pixels, i + 1),
            b: getPixelChannel(pixels, i + 2)
        }) * alpha;
        alphaWeight += alpha;
    }

    if (alphaWeight === 0) {
        throw new Error('Logo image has no visible pixels for icon contrast sampling');
    }

    return weightedLuminance / alphaWeight;
}

function getContrastingIconBackgroundColor(img: HTMLImageElement, preferredBackgroundColor: string) {
    const preferred = parseCssColor(preferredBackgroundColor);
    const logoLuminance = getImageRelativeLuminance(img);
    const preferredLuminance = getRelativeLuminance(preferred);

    if (getContrastRatio(logoLuminance, preferredLuminance) >= MIN_ICON_CONTRAST_RATIO) {
        return preferredBackgroundColor;
    }

    const whiteContrast = getContrastRatio(logoLuminance, 1);
    const blackContrast = getContrastRatio(logoLuminance, 0);
    return whiteContrast >= blackContrast ? '#FFFFFF' : '#000000';
}

function getThemeLibrary() {
    const library = DynamicSettings.findOne({key: 'themeLibrary'});
    return library?.value || [];
}

function getServerActiveTheme() {
    const setting = DynamicSettings.findOne({key: 'customTheme'});
    return setting?.value || null;
}

function getActiveThemeId() {
    const theme = getServerActiveTheme();
    return theme?.activeThemeId;
}

function isThemeActive(themeId: any) {
    const activeId = getActiveThemeId();
    return Boolean(activeId && themeId === activeId);
}

function themeExportFilename(themeName: unknown, fallbackId: unknown) {
    const baseName = typeof themeName === 'string' && themeName.trim()
        ? themeName.trim()
        : String(fallbackId || 'theme');
    const safeName = Array.from(baseName)
        .map((character) => {
            return character.charCodeAt(0) < 32 || '<>:"/\\|?*'.includes(character)
                ? '-'
                : character;
        })
        .join('')
        .replace(/\s+/g, ' ')
        .replace(/\.+$/g, '')
        .trim();
    return `${safeName || 'theme'}.json`;
}

function setThemeMessage(template: any, level: string, text: string, scope = 'library') {
    const messages = { ...(template?.themeMessages?.get?.() || {}) };
    messages[scope] = {
        level,
        text,
        icon: level === 'success' ? 'fa-check-circle' : level === 'warning' ? 'fa-exclamation-triangle' : level === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle',
        scope,
    };
    template?.themeMessages?.set?.(messages);
}

function clearThemeMessage(template: any, scope?: string) {
    if (!scope) {
        template?.themeMessages?.set?.({});
        return;
    }
    const messages = { ...(template?.themeMessages?.get?.() || {}) };
    delete messages[scope];
    template?.themeMessages?.set?.(messages);
}

function setThemeHelpStatus(template: any, level: 'info' | 'success' | 'error', text: string) {
    template.themeHelpStatus.set({ level, text });
}

function loadThemePublications(template: any) {
    const generation = template.themePublicationLifetime.begin();
    template.themePublicationState.set({ themeReady: false, libraryReady: false, error: null });

    const markReady = (key: 'themeReady' | 'libraryReady') => {
        if (!template.themePublicationLifetime.isCurrent(generation)) return;
        template.themePublicationState.set({
            ...template.themePublicationState.get(),
            [key]: true,
        });
    };
    const markError = (error: unknown) => {
        if (!error || !template.themePublicationLifetime.isCurrent(generation)) return;
        template.themePublicationState.set({
            ...template.themePublicationState.get(),
            error: error instanceof Error ? error.message : String(error),
        });
    };

    template.subscribe('theme', { onReady: () => markReady('themeReady'), onStop: markError });
    template.subscribe('themeLibrary', { onReady: () => markReady('libraryReady'), onStop: markError });
}

function requestThemeConfirmation(template: any, trigger: HTMLElement, options: any): Promise<boolean> {
    const existing = template.themeConfirmationController.getContext();
    if (existing?.resolve) existing.resolve(false);
    template.themeConfirmationController.cancel();
    clearThemeMessage(template, options.scope || 'library');

    return new Promise(resolve => {
        const scope = options.scope || 'library';
        const confirmationId = `theme-confirmation-${scope.replace(/[^A-Za-z0-9_-]/g, '-')}`;
        template.themeConfirmationController.open({
            confirmationId,
            title: options.title,
            message: options.message,
            confirmLabel: options.confirmLabel || 'Continue',
            cancelLabel: options.cancelLabel || themeText('theme.cancel'),
            severity: options.confirmClass === 'btn-warning' ? 'warning' : 'danger',
            context: { scope, resolve },
        }, trigger);
        Tracker.afterFlush(() => template.themeConfirmationController.focusInitial());
    });
}

async function downloadThemeJson(themeId: any, filenameFallback = 'theme.json') {
    const json = await (Meteor as any).callAsync('exportThemeFile', themeId);
    const blob = new Blob([json], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filenameFallback;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

async function downloadBrandProfileJson() {
    const json = await (Meteor as any).callAsync('exportDeploymentBrandProfile');
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'deployment-brand-profile.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

Template.theme.onCreated(function(this: any) {
    this.autoruns = [];

    // Memoization cache for contrast calculations
    // Key: "fg-bg", Value: result object
    this.contrastCache = new Map();
    this.themeMessages = new ReactiveVar({});
    this.themeCommandStates = new ReactiveVar({});
    this.themeCommandRegistry = createScopedAsyncCommandRegistry((scope, state) => {
        this.themeCommandStates.set({ ...this.themeCommandStates.get(), [scope]: state });
    });
    this.themeConfirmationView = new ReactiveVar(null);
    this.themeConfirmationController = createInlineConfirmationController(
        (view) => this.themeConfirmationView.set(view),
        () => this.find('[data-theme-confirmation-return-fallback]'),
    );
    this.themeHelpStatus = new ReactiveVar(null);
    this.themePublicationState = new ReactiveVar({ themeReady: false, libraryReady: false, error: null });
    this.themePublicationLifetime = createTemplateLifetime();
    this.themeFontLoadState = new ReactiveVar({ status: 'idle', href: '' });
    this.themeEditorDraftProperties = new ReactiveVar({});
    this.themePropertyRevisions = new Map();
    this.themeColorSaveTimeout = null;
    this.brandProfileDraft = new ReactiveVar<DeploymentBrandProfile | null>(null);
    this.brandProfileLocale = new ReactiveVar<TargetUiLocale>('en');
    this.brandProfileMessage = new ReactiveVar<{ level: string; text: string } | null>(null);
    loadThemePublications(this);
    void loadBrandProfileDraft(this);
});

Template.theme.onRendered(function(this: any) {
    this.autoruns.push(this.autorun(() => {
        const theme = getThemeEditorTheme(this);
        if (!theme?.properties) {
            return;
        }
        Tracker.afterFlush(() => syncThemeColorPickers(this.firstNode?.parentNode || document, theme.properties));
    }));
});

Template.theme.onDestroyed(function(this: any) {
    // Clean up autoruns
    this.autoruns.forEach((ar: any) => ar.stop());

    if (this.themeColorSaveTimeout) {
        clearTimeout(this.themeColorSaveTimeout);
        this.themeColorSaveTimeout = null;
    }

    // Clear contrast cache
    this.contrastCache.clear();
    this.themePropertyRevisions.clear();
    this.themePublicationLifetime.destroy();
    this.themeCommandRegistry.destroy();
    const confirmationContext = this.themeConfirmationController.getContext();
    confirmationContext?.resolve?.(false);
    this.themeConfirmationController.destroy();
});


Template.theme.helpers({
    'currentTheme': function() {
        return getThemeEditorTheme(Template.instance());
    },
    brandProfileDraft() {
        return (Template.instance() as any).brandProfileDraft.get();
    },
    brandProfileMessage() {
        return (Template.instance() as any).brandProfileMessage.get();
    },
    brandProfileLocaleOptions() {
        const instance = Template.instance() as any;
        const selected = instance.brandProfileLocale.get() as TargetUiLocale;
        return TARGET_UI_LOCALES.map((locale) => ({
            locale,
            label: `${TARGET_LOCALE_DEFINITIONS[locale].nativeName} (${TARGET_LOCALE_DEFINITIONS[locale].englishName})`,
            selected: locale === selected,
        }));
    },
    brandProfileDefaultLocaleOptions() {
        const draft = (Template.instance() as any).brandProfileDraft.get() as DeploymentBrandProfile | null;
        return TARGET_UI_LOCALES.map((locale) => ({
            locale,
            label: `${TARGET_LOCALE_DEFINITIONS[locale].nativeName} (${TARGET_LOCALE_DEFINITIONS[locale].englishName})`,
            selected: draft?.defaultLocale === locale,
        }));
    },
    brandProfileCompleteness() {
        const instance = Template.instance() as any;
        const draft = instance.brandProfileDraft.get() as DeploymentBrandProfile | null;
        if (!draft) return '';
        const incomplete = TARGET_UI_LOCALES.filter((locale) => {
            const content = draft.locales?.[locale] as unknown as Record<string, string> | undefined;
            return [...PUBLIC_EXPERIENCE_KEYS, ...BRAND_PROFILE_SUPPLEMENTAL_LOCALE_KEYS]
                .some((key) => !String(content?.[key] || '').trim())
                || (Boolean(draft.landing.heroImageUrl) && !String(draft.landing.heroImageAltByLocale?.[locale] || '').trim());
        });
        return incomplete.length === 0
            ? 'All supported languages are complete.'
            : `Incomplete languages: ${incomplete.map((locale) => TARGET_LOCALE_DEFINITIONS[locale].nativeName).join(', ')}`;
    },
    brandLocaleFields() {
        const instance = Template.instance() as any;
        const draft = instance.brandProfileDraft.get() as DeploymentBrandProfile | null;
        const locale = instance.brandProfileLocale.get() as TargetUiLocale;
        if (!draft) return [];
        return [...PUBLIC_EXPERIENCE_KEYS, ...BRAND_PROFILE_SUPPLEMENTAL_LOCALE_KEYS].map((key) => ({
            key,
            label: humanizeBrandField(key),
            value: draft.locales?.[locale]?.[key] || '',
            multiline: /copy|description|privacy|design|liveAi|copyright/i.test(key),
        }));
    },
    brandHeroAlt() {
        const instance = Template.instance() as any;
        const draft = instance.brandProfileDraft.get() as DeploymentBrandProfile | null;
        const locale = instance.brandProfileLocale.get() as TargetUiLocale;
        return draft?.landing.heroImageAltByLocale?.[locale] || '';
    },
    brandShowCreateAccount() {
        return (Template.instance() as any).brandProfileDraft.get()?.landing.showCreateAccount ? 'checked' : null;
    },
    brandHeroEnabled() {
        return (Template.instance() as any).brandProfileDraft.get()?.landing.heroEnabled ? 'checked' : null;
    },
    brandAudiencesEnabled() {
        return (Template.instance() as any).brandProfileDraft.get()?.landing.audiencesEnabled ? 'checked' : null;
    },
    brandPreview() {
        const instance = Template.instance() as any;
        const draft = instance.brandProfileDraft.get() as DeploymentBrandProfile | null;
        const locale = instance.brandProfileLocale.get() as TargetUiLocale;
        if (!draft) return null;
        return {
            name: draft.identity.name,
            logoUrl: draft.identity.logoUrl,
            eyebrow: draft.locales[locale].eyebrow,
            title: draft.locales[locale].heroTitle,
            copy: draft.locales[locale].heroCopy,
            heroImageUrl: draft.landing.heroImageUrl,
            heroImageAlt: draft.landing.heroImageAltByLocale[locale],
        };
    },
    brandHeroFirst() {
        return (Template.instance() as any).brandProfileDraft.get()?.landing.sectionOrder?.[0] === 'hero' ? 'checked' : null;
    },
    brandAudienceRows() {
        const draft = (Template.instance() as any).brandProfileDraft.get() as DeploymentBrandProfile | null;
        if (!draft) return [];
        return (['student', 'teacher', 'researcher'] as const).map((id) => ({
            id,
            label: humanizeBrandField(id),
            enabled: draft.landing.audiences[id].enabled ? 'checked' : null,
            order: draft.landing.audiences[id].order,
        }));
    },
    'themeEditorValue': function(propId: any) {
        const theme = getThemeEditorTheme(Template.instance());
        if (!theme || !theme.properties || !propId) {
            return '';
        }
        return themeEditorDisplayValue(String(propId), theme.properties[propId]);
    },
    'themeColorPickerValue': function(propId: any) {
        const theme = getThemeEditorTheme(Template.instance());
        return normalizeColorPickerValue(theme?.properties?.[propId]) || '#000000';
    },
    'availableThemes': function() {
        return getThemeLibrary();
    },
    'hasThemeLibrary': function() {
        return getThemeLibrary().length > 0;
    },
    'isThemeActive': function(themeId: any) {
        return isThemeActive(themeId);
    },
    'themePillModifier': function(themeId: any) {
        return isThemeActive(themeId) ? 'theme-pill-active' : '';
    },
    'themeActivateButtonLabel': function(themeId: any) {
        return isThemeActive(themeId) ? themeText('theme.active') : themeText('theme.activate');
    },
    'themeActivateButtonClass': function(themeId: any) {
        return isThemeActive(themeId) ? 'btn-secondary' : '';
    },
    'themeOrigin': function(origin: any) {
        return origin === 'system' ? themeText('theme.systemDefault') : themeText('theme.custom');
    },
    'isSystemTheme': function(origin: any) {
        return origin === 'system';
    },
    'themeActivationAttrs': function(themeId: any) {
        return isThemeActive(themeId)
            ? { disabled: true, 'aria-disabled': true }
            : {};
    },
    'customHelpPageEnabled': function() {
        const theme = getServerActiveTheme();
        const help = theme?.help;
        if (!help || help.enabled === false) {
            return false;
        }
        return Boolean(help.markdown?.length || help.url?.length);
    },
    'customHelpPageUploadedAt': function() {
        const theme = getServerActiveTheme();
        return theme?.help?.uploadedAt || null;
    },
    'formatDate': function(date: any) {
        if (!date) return '';
        return formatActiveInterfaceDateTime(date);
    },
    'getContrastInfo': function(fgProp: any, bgProp: any) {
        const instance = Template.instance() as any;
        const theme = getThemeEditorTheme(instance);
        if (!theme || !theme.properties) return null;

        const fg = theme.properties[fgProp];
        const bg = theme.properties[bgProp];

        if (!fg || !bg) return null;

        // Use memoization cache to avoid recalculating same color pairs
        const cacheKey = `${fg}-${bg}`;
        if (instance.contrastCache.has(cacheKey)) {
            return instance.contrastCache.get(cacheKey);
        }

        const ratio = calculateContrastRatio(fg, bg);
        const level = ratio >= 7 ? 'AAA' : ratio >= 4.5 ? 'AA' : 'Fail';
        const badgeClass = ratio >= 7 ? 'success' : ratio >= 4.5 ? 'warning' : 'danger';

        const result = {
            ratio: ratio.toFixed(1),
            level: level,
            badgeClass: badgeClass,
            passes: ratio >= 4.5
        };

        // Cache the result
        instance.contrastCache.set(cacheKey, result);

        return result;
    },
    'themeMessage': function(scope = 'library') {
        const instance = Template.instance() as any;
        const commandState = instance.themeCommandStates.get()[scope];
        if (commandState?.status === 'pending') {
            return { level: 'info', text: themeText('common.loading') };
        }
        if (commandState?.status === 'error') {
            return { level: 'error', text: commandState.message };
        }
        if (commandState?.status === 'success' && commandState.result?.message) {
            return { level: commandState.result.level || 'success', text: commandState.result.message };
        }
        return instance.themeMessages.get()[scope] || null;
    },
    'themeConfirmationFor': function(scope: string) {
        const instance = Template.instance() as any;
        return instance.themeConfirmationController.getContext()?.scope === scope
            ? instance.themeConfirmationView.get()
            : null;
    },
    'themeScope': function(themeId: string) {
        return `theme:${themeId}`;
    },
    'themeRowCommandAttrs': function(themeId: string) {
        const state = (Template.instance() as any).themeCommandStates.get()[`theme:${themeId}`];
        return state?.status === 'pending' ? { disabled: true, 'aria-busy': 'true' } : {};
    },
    'themeHelpStatus': function() {
        return (Template.instance() as any).themeHelpStatus.get();
    },
    'themeLoading': function() {
        const state = (Template.instance() as any).themePublicationState.get();
        return !state.error && (!state.themeReady || !state.libraryReady);
    },
    'themeLoadError': function() {
        const state = (Template.instance() as any).themePublicationState.get();
        if (!state.error) return null;
        return themeText('theme.errorSavingField', {
            field: themeText('theme.settingsTitle'),
            error: state.error,
        });
    },
    'themeFontLoadError': function() {
        const state = (Template.instance() as any).themeFontLoadState.get();
        if (state.status !== 'error') return null;
        return themeText('theme.errorSavingField', {
            field: themeText('theme.webFontStylesheetUrl'),
            error: state.error || state.href,
        });
    },
    'themeText': function(key: Parameters<typeof translatePlatformString>[1], options?: { hash?: Parameters<typeof translatePlatformString>[2] }) {
        return themeText(key, options?.hash);
    }
});

// Contrast calculation helper functions
function hexToRgb(hex: any) {
    // Remove # if present
    hex = hex.replace(/^#/, '');

    // Handle short form (e.g., #fff)
    if (hex.length === 3) {
        hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }

    const bigint = parseInt(hex, 16);
    return {
        r: (bigint >> 16) & 255,
        g: (bigint >> 8) & 255,
        b: bigint & 255
    };
}

function relativeLuminance(rgb: any) {
    const rsRGB = rgb.r / 255;
    const gsRGB = rgb.g / 255;
    const bsRGB = rgb.b / 255;

    const r = rsRGB <= 0.03928 ? rsRGB / 12.92 : Math.pow((rsRGB + 0.055) / 1.055, 2.4);
    const g = gsRGB <= 0.03928 ? gsRGB / 12.92 : Math.pow((gsRGB + 0.055) / 1.055, 2.4);
    const b = bsRGB <= 0.03928 ? bsRGB / 12.92 : Math.pow((bsRGB + 0.055) / 1.055, 2.4);

    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function calculateContrastRatio(fgHex: any, bgHex: any) {
    try {
        const fgRgb = hexToRgb(fgHex);
        const bgRgb = hexToRgb(bgHex);

        const fgLum = relativeLuminance(fgRgb);
        const bgLum = relativeLuminance(bgRgb);

        const lighter = Math.max(fgLum, bgLum);
        const darker = Math.min(fgLum, bgLum);

        return (lighter + 0.05) / (darker + 0.05);
    } catch (e) {
        return 0;
    }
}

function validateThemePropInput(inputEl: any, propId: any, rawValue: any) {
    let value = typeof rawValue === 'string' ? rawValue.trim() : rawValue;
    let valid = true;

    if (isThemeTransitionProperty(propId)) {
        value = normalizeThemePropertyValue(propId, value);
        valid = typeof value === 'string' && isValidThemeCssTime(value);
    }

    if (propId === 'app_font_family' || propId === 'app_heading_font_family') {
        valid = typeof value === 'string' && value.length > 0;
    }

    if (propId === 'app_font_stylesheet_url') {
        valid = typeof value === 'string';
    }

    if (isThemeDensityScaleProperty(propId)) {
        value = normalizeThemePropertyValue(propId, value);
        valid = isValidThemeDensityScale(value);
    } else if (propId === 'app_font_size_base' || isThemeLengthProperty(propId)) {
        value = normalizeThemePropertyValue(propId, value);
        valid = typeof value === 'string' && isValidThemeCssLength(value);
    }

    if (inputEl) {
        if (valid) {
            inputEl.classList.remove('is-invalid');
        } else {
            inputEl.classList.add('is-invalid');
        }
    }

    return { valid, value };
}

function applyThemeCssVariable(property: string, rawValue: unknown) {
    const propConverted = '--' + property.replace(/_/g, '-');
    const normalizedValue = normalizeThemePropertyValue(property, rawValue);
    const normalizedText = typeof normalizedValue === 'string' ? normalizedValue.trim() : normalizedValue;

    if (normalizedText == null || normalizedText === '') {
        document.documentElement.style.removeProperty(propConverted);
        return;
    }

    document.documentElement.style.setProperty(propConverted, String(normalizedText));
}

function setThemeFontLoadState(template: any, state: { status: 'idle' | 'loading' | 'ready' | 'error'; href: string; error?: string }) {
    template?.themeFontLoadState?.set?.(state);
}

function applyThemeFontStylesheet(rawValue: unknown, template?: any) {
    const href = typeof rawValue === 'string' ? rawValue.trim() : '';
    const existingLink = document.getElementById(THEME_FONT_STYLESHEET_LINK_ID) as HTMLLinkElement | null;

    if (!href) {
        existingLink?.remove();
        setThemeFontLoadState(template, { status: 'idle', href: '' });
        return;
    }

    const link = existingLink || document.createElement('link');
    link.id = THEME_FONT_STYLESHEET_LINK_ID;
    link.rel = 'stylesheet';

    if (!existingLink) {
        document.head.appendChild(link);
    }

    if (link.getAttribute('href') === href) {
        const status = link.dataset.themeFontLoadState === 'error' ? 'error' : 'ready';
        const error = link.dataset.themeFontLoadError;
        setThemeFontLoadState(template, {
            status,
            href,
            ...(error ? { error } : {}),
        });
        return;
    }

    link.dataset.themeFontLoadState = 'loading';
    delete link.dataset.themeFontLoadError;
    setThemeFontLoadState(template, { status: 'loading', href });
    link.onload = () => {
        link.dataset.themeFontLoadState = 'ready';
        setThemeFontLoadState(template, { status: 'ready', href });
    };
    link.onerror = () => {
        const error = 'The stylesheet could not be loaded.';
        link.dataset.themeFontLoadState = 'error';
        link.dataset.themeFontLoadError = error;
        setThemeFontLoadState(template, { status: 'error', href, error });
    };
    link.href = href;
}

function applyThemePropertyPreview(property: string, value: unknown, template?: any) {
    applyThemeCssVariable(property, value);
    if (property === 'app_font_stylesheet_url') {
        applyThemeFontStylesheet(value, template);
    }
}

function applyThemeState(themeData: any, template?: any) {
    if (!themeData?.properties) {
        throw new Error('[Theme] Active theme payload is missing properties');
    }

    Session.set('serverActiveTheme', themeData);
    Session.set('themeReady', true);
    if (Session.get('userThemeOverrideActive') !== true) {
        Session.set('curTheme', themeData);
        Object.entries(themeData.properties).forEach(([property, value]) => {
            applyThemePropertyPreview(property, value, template);
        });
    }
    syncThemeColorPickers(document, themeData.properties);
}

function getThemeEditorDraftProperties(template: any): Record<string, unknown> {
    return template?.themeEditorDraftProperties?.get?.() || {};
}

function getThemeEditorTheme(template: any) {
    const confirmedTheme = getServerActiveTheme();
    if (!confirmedTheme?.properties) {
        return confirmedTheme;
    }

    return {
        ...confirmedTheme,
        properties: {
            ...confirmedTheme.properties,
            ...getThemeEditorDraftProperties(template),
        },
    };
}

function applyThemeEditorDraftPreview(template: any) {
    const draftProperties = getThemeEditorDraftProperties(template);
    for (const [property, value] of Object.entries(draftProperties)) {
        if (Session.get('userThemeOverrideActive') !== true) {
            applyThemePropertyPreview(property, value, template);
        }
    }
    syncThemeColorPickers(template?.firstNode?.parentNode || document, getThemeEditorTheme(template)?.properties);
}

function clearThemeEditorDraft(template: any) {
    template.themeEditorDraftProperties.set({});
    template.themePropertyRevisions.clear();
    if (template.themeColorSaveTimeout) {
        clearTimeout(template.themeColorSaveTimeout);
        template.themeColorSaveTimeout = null;
    }
}

function stageThemePropertyDraft(template: any, property: string, value: unknown) {
    const revision = (template.themePropertyRevisions.get(property) || 0) + 1;
    template.themePropertyRevisions.set(property, revision);
    template.themeEditorDraftProperties.set({
        ...getThemeEditorDraftProperties(template),
        [property]: value,
    });
    applyThemeEditorDraftPreview(template);
    return revision;
}

async function persistThemePropertyDraft(template: any, property: string, value: unknown, revision: number, messageScope = 'property'): Promise<boolean> {
    try {
        const response = await saveThemeProperty(property, value);
        if (template.themePropertyRevisions.get(property) !== revision) {
            return false;
        }

        const { [property]: _savedDraftValue, ...remainingDraftProperties } = getThemeEditorDraftProperties(template);
        template.themeEditorDraftProperties.set(remainingDraftProperties);
        if (!response?.theme?.properties) {
            throw new Error('Theme update did not return the confirmed theme state');
        }
        applyThemeState(response.theme, template);
        applyThemeEditorDraftPreview(template);
        return true;
    } catch (err: any) {
        if (template.themePropertyRevisions.get(property) !== revision) {
            return false;
        }

        const { [property]: _failedDraftValue, ...remainingDraftProperties } = getThemeEditorDraftProperties(template);
        template.themeEditorDraftProperties.set(remainingDraftProperties);
        const confirmedTheme = getServerActiveTheme();
        if (confirmedTheme?.properties) {
            applyThemeState(confirmedTheme, template);
        }
        applyThemeEditorDraftPreview(template);
        clientConsole(1, `[Theme] Error auto-saving ${property}:`, err);
        setThemeMessage(template, 'error', themeText('theme.errorSavingField', { field: property, error: err }), messageScope);
        return false;
    }
}

async function saveThemeProperty(property: string, value: unknown) {
    return await (Meteor as any).callAsync('setCustomThemeProperty', property, value);
}

function commitThemePropInput(inputEl: HTMLInputElement | HTMLTextAreaElement, template: any) {
    const dataId = inputEl.getAttribute('data-id');
    if (!dataId) {
        throw new Error('[Theme] Editable theme field is missing data-id');
    }

    const { valid, value } = validateThemePropInput(inputEl, dataId, inputEl.value);
    if (!valid) {
        return;
    }

    const revision = stageThemePropertyDraft(template, dataId, value);
    void persistThemePropertyDraft(template, dataId, value, revision);
}

function getThemeIconBackgroundColor() {
    const theme = getServerActiveTheme();
    const themeProps = theme?.properties || {};
    const backgroundCandidates = [
        themeProps.app_background_color,
        themeProps.navigation_surface_color,
        themeProps.learning_card_surface_color
    ];

    for (const candidate of backgroundCandidates) {
        if (typeof candidate === 'string' && candidate.trim().length > 0) {
            return candidate.trim();
        }
    }

    return '#F2F2F2';
}

function createPngDataUrlFromImage(
    img: HTMLImageElement,
    size: number,
    options: {
        backgroundColor?: string;
        paddingRatio?: number;
    } = {}
) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
        throw new Error('Unable to create canvas context for icon generation');
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.clearRect(0, 0, size, size);

    if (options.backgroundColor) {
        ctx.fillStyle = options.backgroundColor;
        ctx.fillRect(0, 0, size, size);
    }

    const paddingRatio = Math.max(0, Math.min(options.paddingRatio ?? 0, 0.45));
    const maxDrawSize = size * (1 - paddingRatio * 2);
    const widthScale = maxDrawSize / img.width;
    const heightScale = maxDrawSize / img.height;
    const scale = Math.min(widthScale, heightScale);
    const drawWidth = img.width * scale;
    const drawHeight = img.height * scale;
    const dx = (size - drawWidth) / 2;
    const dy = (size - drawHeight) / 2;

    ctx.drawImage(img, dx, dy, drawWidth, drawHeight);

    return canvas.toDataURL('image/png');
}

Template.theme.events({
    'change [data-brand-image-upload]': function(event: any, template: any) {
        const target = event.currentTarget.getAttribute('data-brand-image-upload');
        const file = event.currentTarget.files?.[0] as File | undefined;
        if (!target || !file) return;
        const maximumBytes = target === 'logo' ? 2 * 1024 * 1024 : 5 * 1024 * 1024;
        if (file.size > maximumBytes) {
            template.brandProfileMessage.set({
                level: 'error',
                text: target === 'logo' ? 'Logo images must be smaller than 2 MB.' : 'Brand images must be smaller than 5 MB.',
            });
            return;
        }
        if (target !== 'hero' && file.type !== 'image/png') {
            template.brandProfileMessage.set({ level: 'error', text: 'Logo and social preview uploads must be PNG files.' });
            return;
        }
        if (target === 'hero' && !['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type)) {
            template.brandProfileMessage.set({ level: 'error', text: 'Hero images must be PNG, JPEG, WebP, or GIF files.' });
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            const dataUrl = String(reader.result || '');
            if (target === 'logo') {
                const image = new Image();
                image.onload = () => {
                    const backgroundColor = getContrastingIconBackgroundColor(image, getThemeIconBackgroundColor());
                    updateBrandProfileDraft(template, (draft) => {
                        draft.identity.logoUrl = dataUrl;
                        draft.identity.favicon16Url = createPngDataUrlFromImage(image, 16);
                        draft.identity.favicon32Url = createPngDataUrlFromImage(image, 32);
                        draft.identity.appleTouchIconUrl = createPngDataUrlFromImage(image, 180, { backgroundColor, paddingRatio: 0.10 });
                        draft.identity.androidIcon192Url = createPngDataUrlFromImage(image, 192, { backgroundColor, paddingRatio: 0.10 });
                        draft.identity.androidIcon512Url = createPngDataUrlFromImage(image, 512, { backgroundColor, paddingRatio: 0.10 });
                        draft.identity.androidMaskableIcon192Url = createPngDataUrlFromImage(image, 192, { backgroundColor, paddingRatio: 0.18 });
                        draft.identity.androidMaskableIcon512Url = createPngDataUrlFromImage(image, 512, { backgroundColor, paddingRatio: 0.18 });
                    });
                };
                image.onerror = () => template.brandProfileMessage.set({ level: 'error', text: 'The logo image could not be read.' });
                image.src = dataUrl;
                return;
            }
            updateBrandProfileDraft(template, (draft) => {
                if (target === 'hero') {
                    draft.landing.heroImageUrl = dataUrl;
                } else {
                    draft.identity.socialImageUrl = dataUrl;
                }
            });
        };
        reader.onerror = () => template.brandProfileMessage.set({ level: 'error', text: 'The selected image could not be read.' });
        reader.readAsDataURL(file);
    },
    'change [data-brand-locale]': function(event: any, template: any) {
        template.brandProfileLocale.set(event.currentTarget.value as TargetUiLocale);
    },
    'change [data-brand-default-locale]': function(event: any, template: any) {
        updateBrandProfileDraft(template, (draft) => {
            draft.defaultLocale = event.currentTarget.value as TargetUiLocale;
        });
    },
    'input [data-brand-identity]': function(event: any, template: any) {
        const key = event.currentTarget.getAttribute('data-brand-identity');
        if (!key) return;
        updateBrandProfileDraft(template, (draft) => {
            (draft.identity as unknown as Record<string, string>)[key] = event.currentTarget.value;
        });
    },
    'input [data-brand-legal]': function(event: any, template: any) {
        const key = event.currentTarget.getAttribute('data-brand-legal');
        if (!key) return;
        updateBrandProfileDraft(template, (draft) => {
            (draft.legal as unknown as Record<string, string>)[key] = event.currentTarget.value;
        });
    },
    'input [data-brand-locale-field]': function(event: any, template: any) {
        const key = event.currentTarget.getAttribute('data-brand-locale-field');
        const locale = template.brandProfileLocale.get() as TargetUiLocale;
        if (!key) return;
        updateBrandProfileDraft(template, (draft) => {
            (draft.locales[locale] as unknown as Record<string, string>)[key] = event.currentTarget.value;
        });
    },
    'input [data-brand-hero-alt]': function(event: any, template: any) {
        const locale = template.brandProfileLocale.get() as TargetUiLocale;
        updateBrandProfileDraft(template, (draft) => {
            draft.landing.heroImageAltByLocale[locale] = event.currentTarget.value;
        });
    },
    'input [data-brand-landing-text]': function(event: any, template: any) {
        const key = event.currentTarget.getAttribute('data-brand-landing-text');
        if (!key) return;
        updateBrandProfileDraft(template, (draft) => {
            (draft.landing as unknown as Record<string, unknown>)[key] = event.currentTarget.value;
        });
    },
    'change [data-brand-landing-boolean]': function(event: any, template: any) {
        const key = event.currentTarget.getAttribute('data-brand-landing-boolean');
        if (!key) return;
        updateBrandProfileDraft(template, (draft) => {
            (draft.landing as unknown as Record<string, unknown>)[key] = event.currentTarget.checked;
        });
    },
    'change [data-brand-hero-first]': function(event: any, template: any) {
        updateBrandProfileDraft(template, (draft) => {
            draft.landing.sectionOrder = event.currentTarget.checked
                ? ['hero', 'audiences']
                : ['audiences', 'hero'];
        });
    },
    'change [data-brand-audience-enabled]': function(event: any, template: any) {
        const audience = event.currentTarget.getAttribute('data-brand-audience-enabled') as PublicDemoAudience;
        updateBrandProfileDraft(template, (draft) => {
            draft.landing.audiences[audience].enabled = event.currentTarget.checked;
        });
    },
    'change [data-brand-audience-order]': function(event: any, template: any) {
        const audience = event.currentTarget.getAttribute('data-brand-audience-order') as PublicDemoAudience;
        updateBrandProfileDraft(template, (draft) => {
            draft.landing.audiences[audience].order = Number(event.currentTarget.value);
        });
    },
    'click [data-brand-save]': async function(_event: any, template: any) {
        const draft = template.brandProfileDraft.get();
        if (!draft) return;
        try {
            const saved = await (Meteor as any).callAsync('saveDeploymentBrandProfileDraft', draft);
            template.brandProfileDraft.set(saved);
            template.brandProfileMessage.set({ level: 'success', text: 'Brand Profile draft saved.' });
        } catch (error: any) {
            template.brandProfileMessage.set({ level: 'error', text: error?.reason || error?.message || String(error) });
        }
    },
    'click [data-brand-publish]': async function(_event: any, template: any) {
        const draft = template.brandProfileDraft.get();
        if (!draft) return;
        try {
            await (Meteor as any).callAsync('saveDeploymentBrandProfileDraft', draft);
            const published = await (Meteor as any).callAsync('publishDeploymentBrandProfile');
            template.brandProfileDraft.set(cloneJson(published));
            template.brandProfileMessage.set({ level: 'success', text: 'Brand Profile published.' });
        } catch (error: any) {
            template.brandProfileMessage.set({ level: 'error', text: error?.reason || error?.message || String(error) });
        }
    },
    'click [data-brand-export]': async function(_event: any, template: any) {
        try {
            await downloadBrandProfileJson();
        } catch (error: any) {
            template.brandProfileMessage.set({ level: 'error', text: error?.reason || error?.message || String(error) });
        }
    },
    'change [data-brand-import]': function(event: any, template: any) {
        const input = event.currentTarget as HTMLInputElement;
        const file = input.files?.[0];
        if (!file) return;
        if (file.size > 10 * 1024 * 1024) {
            template.brandProfileMessage.set({ level: 'error', text: 'Brand Profile files must be smaller than 10 MB.' });
            input.value = '';
            return;
        }
        const reader = new FileReader();
        reader.onload = async () => {
            try {
                const imported = await (Meteor as any).callAsync('importDeploymentBrandProfileDraft', String(reader.result || ''));
                template.brandProfileDraft.set(imported);
                template.brandProfileMessage.set({ level: 'success', text: 'Brand Profile imported as a draft.' });
            } catch (error: any) {
                template.brandProfileMessage.set({ level: 'error', text: error?.reason || error?.message || String(error) });
            } finally {
                input.value = '';
            }
        };
        reader.onerror = () => template.brandProfileMessage.set({ level: 'error', text: 'The Brand Profile file could not be read.' });
        reader.readAsText(file);
    },
    'click [data-theme-retry]': function(_event: any, template: any) {
        loadThemePublications(template);
    },
    'click .set-active-theme': async function(event: any, template: any) {
        event.preventDefault();
        const themeId = event.currentTarget.getAttribute('data-id');
        if (!themeId) {
            return;
        }
        const scope = `theme:${themeId}`;
        clearThemeMessage(template, scope);
        await template.themeCommandRegistry.run(scope, async () => {
            const activeTheme = await (Meteor as any).callAsync('setActiveTheme', themeId);
            clearThemeEditorDraft(template);
            applyThemeState(activeTheme, template);
            return { message: '' };
        }, { getErrorMessage: (err: any) => themeText('theme.errorActivatingTheme', { error: err?.message || err }) });
    },
    'click .duplicate-theme': async function(event: any, template: any) {
        event.preventDefault();
        const themeId = event.currentTarget.getAttribute('data-id');
        const themeName = event.currentTarget.getAttribute('data-name') || 'New Theme';
        const proposedName = `${themeName} Copy`;
        const newName = prompt('Name for duplicated theme', proposedName);
        if (!newName) {
            return;
        }
        const scope = `theme:${themeId}`;
        clearThemeMessage(template, scope);
        await template.themeCommandRegistry.run(scope, async () => {
            await (Meteor as any).callAsync('duplicateTheme', {
                sourceThemeId: themeId,
                name: newName
            });
            return { message: '' };
        }, { getErrorMessage: (err: any) => themeText('theme.errorDuplicatingTheme', { error: err?.message || err }) });
    },
    'click .rename-theme': async function(event: any, template: any) {
        event.preventDefault();
        const themeId = event.currentTarget.getAttribute('data-id');
        const currentName = event.currentTarget.getAttribute('data-name') || 'this theme';
        if (!themeId) {
            return;
        }
        const newName = prompt('Enter new theme name', currentName);
        if (!newName || newName === currentName) {
            return;
        }
        const scope = `theme:${themeId}`;
        clearThemeMessage(template, scope);
        await template.themeCommandRegistry.run(scope, async () => {
            await (Meteor as any).callAsync('renameTheme', {
                themeId: themeId,
                newName: newName
            });
            return { message: '' };
        }, { getErrorMessage: (err: any) => themeText('theme.errorRenamingTheme', { error: err?.message || err }) });
    },
    'click .delete-theme': async function(event: any, template: any) {
        event.preventDefault();
        const themeId = event.currentTarget.getAttribute('data-id');
        const themeName = event.currentTarget.getAttribute('data-name') || 'this theme';
        if (!themeId) {
            return;
        }
        const confirmed = await requestThemeConfirmation(template, event.currentTarget as HTMLElement, {
            title: themeText('theme.deleteThemeTitle', { themeName }),
            message: themeText('theme.deleteThemeMessage'),
            confirmLabel: themeText('theme.deleteTheme'),
            scope: `theme:${themeId}`,
        });
        if (!confirmed) {
            return;
        }
        const scope = `theme:${themeId}`;
        clearThemeMessage(template, scope);
        await template.themeCommandRegistry.run(scope, async () => {
            await (Meteor as any).callAsync('deleteTheme', themeId);
            return { message: themeText('theme.deleted', { name: themeName }) };
        }, {
            getErrorMessage: (err: any) => themeText('theme.errorDeletingTheme', { error: err?.message || err }),
            onSuccess: (result: any) => setThemeMessage(template, 'success', result.message, 'library'),
        });
    },
    'click .export-theme': async function(event: any, template: any) {
        event.preventDefault();
        const themeId = event.currentTarget.getAttribute('data-id');
        const themeName = event.currentTarget.getAttribute('data-name');
        if (!themeId) {
            return;
        }
        const scope = `theme:${themeId}`;
        clearThemeMessage(template, scope);
        await template.themeCommandRegistry.run(scope, async () => {
            await downloadThemeJson(themeId, themeExportFilename(themeName, themeId));
            return { message: '' };
        }, { getErrorMessage: (err: any) => themeText('theme.errorExportingTheme', { error: err?.message || err }) });
    },
    'click #exportActiveTheme': async function(event: any, template: any) {
        const activeId = getActiveThemeId();
        if (!activeId) {
            setThemeMessage(template, 'warning', themeText('theme.noActiveThemeSelected'));
            return;
        }
        const theme = getServerActiveTheme();
        const filename = themeExportFilename(theme?.metadata?.name || theme?.properties?.themeName, activeId);
        try {
            await downloadThemeJson(activeId, filename);
        } catch (err: any) {
            setThemeMessage(template, 'error', themeText('theme.errorExportingTheme', { error: err?.message || err }));
        }
    },
    'click #themeImportButton': async function(event: any, template: any) {
        event.preventDefault();
        const fileInput = template.find('#themeImportInput');
        const file = fileInput?.files?.[0];
        if (!file) {
            setThemeMessage(template, 'warning', themeText('theme.selectThemeJsonFile'));
            return;
        }
        if (file.size > THEME_IMPORT_MAX_FILE_BYTES) {
            setThemeMessage(template, 'warning', themeText('theme.themeFileSizeLessThanTenMb'));
            return;
        }
        try {
            const text = await file.text();
            await (Meteor as any).callAsync('importThemeFile', text, true);
            fileInput.value = '';
            setThemeMessage(template, 'success', themeText('theme.imported'));
        } catch (err: any) {
            setThemeMessage(template, 'error', themeText('theme.errorImportingTheme', { error: err?.message || err }));
        }
    },
    'click #themeResetButton': async function(event: any, template: any) {
        try {
            const activeTheme = await (Meteor as any).callAsync('initializeCustomTheme', 'Default');
            clearThemeEditorDraft(template);
            applyThemeState(activeTheme, template);
            setThemeMessage(template, 'success', themeText('theme.resetToDefault'));
        } catch (err: any) {
            setThemeMessage(template, 'error', themeText('theme.errorResettingTheme', { error: err?.message || err }));
        }
    },
    'input .currentThemeProp': function(event: any, template: any) {
        const dataId = event.currentTarget.getAttribute('data-id');
        if (!dataId) {
            throw new Error('[Theme] Editable theme field is missing data-id');
        }
        const { valid, value } = validateThemePropInput(event.currentTarget, dataId, event.currentTarget.value);
        if (valid && isThemeDensityScaleProperty(dataId) && Session.get('userThemeOverrideActive') !== true) {
            applyThemePropertyPreview(dataId, value, template);
        }
    },
    'keydown .currentThemeProp': function(event: KeyboardEvent, template: any) {
        if (event.key !== 'Enter' || event.shiftKey || event.currentTarget instanceof HTMLTextAreaElement) {
            return;
        }

        event.preventDefault();
        commitThemePropInput(event.currentTarget as HTMLInputElement, template);
    },
    // Native mobile color pickers can open before focus has synchronized the value.
    'pointerdown .currentThemePropColor, focus .currentThemePropColor': function(event: any, instance: any) {
        const theme = getThemeEditorTheme(instance);
        if (theme && theme.properties) {
            syncThemeColorPicker(event.currentTarget, theme.properties);
        }
    },
    'input .currentThemePropColor': function(event: any, instance: any) {
        const data_id = event.currentTarget.getAttribute('data-id');
        if (!data_id) {
            throw new Error('[Theme] Color editor field is missing data-id');
        }
        const value = normalizeColorPickerValue(event.currentTarget.value);
        if (!value) {
            clientConsole(1, `[Theme] Native color picker produced an invalid value for ${data_id}`);
            return;
        }
        const textInput = instance.find(`.currentThemeProp[data-id="${data_id}"]`) as HTMLInputElement | null;
        if (textInput) {
            textInput.value = value;
        }

        // Clear contrast cache since colors changed
        if (instance.contrastCache) {
            instance.contrastCache.clear();
        }

        const revision = stageThemePropertyDraft(instance, data_id, value);

        // Auto-save with debounce (prevents network thrashing during color picker drag)
        if (instance.themeColorSaveTimeout) {
            clearTimeout(instance.themeColorSaveTimeout);
        }
        instance.themeColorSaveTimeout = setTimeout(async () => {
            instance.themeColorSaveTimeout = null;
            await persistThemePropertyDraft(instance, data_id, value, revision);
        }, 300);
    },
    'change .currentThemeProp': function(event: any, template: any) {
        commitThemePropInput(event.currentTarget, template);
    },
    'change #homeUnderlayUpload': function(event: any, template: any) {
        const fileInput = event.target;
        const file = fileInput.files?.[0];
        if (!file) {
            return;
        }

        if (!file.type.startsWith('image/')) {
            setThemeMessage(template, 'warning', themeText('theme.selectImageFile'), 'underlay');
            fileInput.value = '';
            return;
        }

        if (file.size > HOME_UNDERLAY_MAX_FILE_BYTES) {
            setThemeMessage(template, 'warning', themeText('theme.underlayFileSizeLessThanFiveMb'), 'underlay');
            fileInput.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = async function(e: any) {
            const base64Data = e.target.result;
            const revision = stageThemePropertyDraft(template, 'practice_menu_underlay_image_url', base64Data);
            const saved = await persistThemePropertyDraft(template, 'practice_menu_underlay_image_url', base64Data, revision, 'underlay');
            if (saved) {
                fileInput.value = '';
                setThemeMessage(template, 'success', themeText('theme.homeUnderlayUploaded'), 'underlay');
            }
        };
        reader.onerror = function() {
            setThemeMessage(template, 'error', themeText('theme.homeUnderlayReadError'), 'underlay');
            fileInput.value = '';
        };
        reader.readAsDataURL(file);
    },
    'click #clearHomeUnderlay': async function(event: any, template: any) {
        const revision = stageThemePropertyDraft(template, 'practice_menu_underlay_image_url', '');
        const saved = await persistThemePropertyDraft(template, 'practice_menu_underlay_image_url', '', revision, 'underlay');
        if (saved) {
            const fileInput = template.find('#homeUnderlayUpload') as HTMLInputElement | null;
            const urlInput = template.find('.currentThemeProp[data-id="practice_menu_underlay_image_url"]') as HTMLInputElement | null;
            if (fileInput) fileInput.value = '';
            if (urlInput) urlInput.value = '';
            setThemeMessage(template, 'success', themeText('theme.homeUnderlayCleared'), 'underlay');
        }
    },
    // Custom Help Page Upload
    'click #uploadHelpFileButton': function(_event: any, template: any) {
        const fileInput = template.find('#helpFileUpload') as HTMLInputElement | null;
        const file = fileInput?.files?.[0];

        if (!file) {
            setThemeHelpStatus(template, 'error', themeText('theme.selectFileFirst'));
            return;
        }

        // Validate file extension
        if (!file.name.endsWith('.md')) {
            setThemeHelpStatus(template, 'error', themeText('theme.selectMarkdownFile'));
            return;
        }

        // Validate file size (1MB max)
        if (file.size > 1048576) {
            setThemeHelpStatus(template, 'error', themeText('theme.fileSizeLessThanOneMb'));
            return;
        }

        setThemeHelpStatus(template, 'info', themeText('theme.uploading'));

        // Read file as text
        const reader = new FileReader();
        reader.onload = async function(e: any) {
            const markdownContent = e.target.result;

                try {
                    await (Meteor as any).callAsync('setCustomHelpPage', markdownContent);
                    setThemeHelpStatus(template, 'success', themeText('theme.customHelpUploaded'));
                    if (fileInput) fileInput.value = '';
                } catch (err: any) {
                    setThemeHelpStatus(template, 'error', themeText('theme.errorWithMessage', { error: err.message }));
                }
        };

        reader.onerror = function() {
            setThemeHelpStatus(template, 'error', themeText('theme.errorReadingFile'));
        };

        reader.readAsText(file);
    },

    'click #removeHelpFileButton': async function(event: any, template: any) {
        const confirmed = await requestThemeConfirmation(template, event.currentTarget as HTMLElement, {
            title: themeText('theme.removeCustomHelpTitle'),
            message: themeText('theme.removeCustomHelpMessage'),
            confirmLabel: themeText('theme.removeHelpPage'),
            scope: 'help',
        });
        if (confirmed) {
            setThemeHelpStatus(template, 'info', themeText('theme.removing'));

            try {
                await (Meteor as any).callAsync('removeCustomHelpPage');
                setThemeHelpStatus(template, 'success', themeText('theme.customHelpRemovedUsingWiki'));
            } catch (err: any) {
                setThemeHelpStatus(template, 'error', themeText('theme.errorWithMessage', { error: err.message }));
            }
        }
    },

    'click .admin-confirmation-cancel': function(event: any, template: any) {
        event.preventDefault();
        const context = template.themeConfirmationController.getContext();
        if (template.themeConfirmationController.cancel()) context?.resolve?.(false);
    },

    'click .admin-confirmation-confirm': function(event: any, template: any) {
        event.preventDefault();
        const context = template.themeConfirmationController.getContext();
        if (template.themeConfirmationController.complete()) context?.resolve?.(true);
    },

    'keydown .admin-inline-confirmation': function(event: KeyboardEvent, template: any) {
        const context = template.themeConfirmationController.getContext();
        if (template.themeConfirmationController.handleKeydown(event)) context?.resolve?.(false);
    }
});




