import { Meteor } from 'meteor/meteor';
import { Template } from 'meteor/templating';
import './tdfEdit.html';
import './tdfEdit.css';
import { ReactiveVar } from 'meteor/reactive-var';
import { Tracker } from 'meteor/tracker';

const FlowRouter = (globalThis as any).FlowRouter;
const TdfsCollection = (globalThis as any).Tdfs;
import { meteorCallAsync } from '../..';
import { clientConsole } from '../../lib/clientLogger';
import { TDF_TOOLTIPS, getTooltipMode, setTooltipMode, injectDescriptions, updateDescriptionsInPlace, buildDescriptionCache } from '../../lib/tooltipContent';
import { ValidatorEngine, ValidationContext } from '../../lib/validatorCore';
import { createValidationSummary, applyFieldErrors, initValidationUI } from '../../lib/validatorUI';
import { installSchemaApplicabilityControls, sortPropertiesModal } from '../../lib/schemaApplicabilityEditor';
import { ensureJsonEditor } from '../../lib/jsonEditorLoader';
import { prepareTutorSchemaForJsonEditor } from './tdfDraftSchema';
import { translatePlatformString } from '../../lib/interfaceI18n';
import { getActiveUiLocale } from '../../lib/interfaceLocaleState';
import { getErrorMessage } from '../../lib/errorUtils';
import { loadOpenRouterModelCatalog } from '../../lib/openRouterModelCatalogClient';
import {
    OPENROUTER_REASONING_LEVELS,
    getAllowedOpenRouterReasoningLevels,
    getDefaultOpenRouterReasoningLevel,
    getOpenRouterReasoningControlKind,
    normalizeOpenRouterReasoningLevel,
    type OpenRouterModelCatalogEntry,
    type OpenRouterReasoningLevel,
} from '../../../common/lib/openRouterModelCatalog';
import {
    rejectLoad,
    resolveLoad,
    startLoad,
    type LoadableState,
} from '../../lib/adminUi/loadableState';
import {
    createTemplateLifetime,
    type TemplateLifetime,
} from '../../lib/adminUi/templateLifetime';

type PlatformStringKey = Parameters<typeof translatePlatformString>[1];

function tdfEditorText(key: PlatformStringKey, values?: Parameters<typeof translatePlatformString>[2]): string {
    return translatePlatformString(getActiveUiLocale(), key, values);
}

/**
 * TDF Editor - Schema-driven editor using json-editor library
 *
 * Architecture: Client-only processing
 * - Server: Only used for initial TDF load and final save
 * - Client: All editing, validation, and UI rendering happens in browser
 */

// Cache the schema after first load
let cachedSchema: any = null;
const SAVE_SUCCESS_REDIRECT_DELAY_MS = 1000;

type OpenRouterCatalogLoadResult =
    | { catalog: OpenRouterModelCatalogEntry[]; error: null }
    | { catalog: null; error: string };

type TdfEditorLoadValue = Readonly<{ tdf: any | null }>;

function setEditorMessage(instance: any, type: string, title: string, text: string, scope = 'save') {
    instance.editorMessages.set({ ...instance.editorMessages.get(), [scope]: {
        type,
        title,
        text,
        icon: type === 'success' ? 'fa-check-circle' : type === 'warning' ? 'fa-exclamation-triangle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'
    } });
}

function clearEditorMessage(instance: any, scope: string) {
    const messages = { ...instance.editorMessages.get() };
    delete messages[scope];
    instance.editorMessages.set(messages);
}

function showSaveFeedbackAndRedirect(instance: any, message: string) {
    if (instance._saveRedirectTimer) {
        Meteor.clearTimeout(instance._saveRedirectTimer);
    }

    instance.saveFeedback.set(message);
    instance._saveRedirectTimer = Meteor.setTimeout(() => {
        FlowRouter.go('/contentUpload');
    }, SAVE_SUCCESS_REDIRECT_DELAY_MS);
}

Template.tdfEdit.onCreated(function(this: any) {
    const instance = this;

    // Get TDF ID from route
    instance.tdfId = FlowRouter.getParam('tdfId');

    // Subscribe to TDF data
    instance.lifetime = createTemplateLifetime() as TemplateLifetime;
    instance.loadState = new ReactiveVar<LoadableState<TdfEditorLoadValue>>({ status: 'idle' });

    // Reactive state
    instance.hasChanges = new ReactiveVar(false);
    instance.saving = new ReactiveVar(false);
    instance.saveFeedback = new ReactiveVar('');
    instance.editorMessages = new ReactiveVar({});
    instance.tooltipMode = new ReactiveVar(getTooltipMode());
    instance.editor = null;
    instance.originalTdf = null;
    instance._hasPendingChanges = false;

    // Initialize validator engine
    instance.validator = new ValidatorEngine({ type: 'tdf', debounceMs: 300 });
    instance.validationContext = null;

    void initializeTdfEditor(instance);
});

Template.tdfEdit.onDestroyed(function(this: any) {
    this.lifetime.destroy();
    // Clean up editor
    if (this.editor) {
        this.editor.destroy();
        this.editor = null;
    }
    // Clean up validator
    if (this.validator) {
        this.validator.destroy();
    }
    if (this.validationAutorun) {
        this.validationAutorun.stop();
        this.validationAutorun = null;
    }
    if (this.domObserver) {
        this.domObserver.disconnect();
        this.domObserver = null;
    }
    if (this.fieldObserver) {
        this.fieldObserver.disconnect();
        this.fieldObserver = null;
    }
    if (this.applicabilityController) {
        this.applicabilityController.destroy();
        this.applicabilityController = null;
    }
    if (this._inputHandler) {
        const container = document.getElementById('tdf-editor-container');
        if (container) {
            container.removeEventListener('input', this._inputHandler, true);
        }
        this._inputHandler = null;
    }
    if (this._blurHandler) {
        const container = document.getElementById('tdf-editor-container');
        if (container) {
            container.removeEventListener('blur', this._blurHandler, true);
        }
        this._blurHandler = null;
    }
    if (this._saveRedirectTimer) {
        Meteor.clearTimeout(this._saveRedirectTimer);
        this._saveRedirectTimer = null;
    }
});

Template.tdfEdit.helpers({
    editorReady() {
        return (Template.instance() as any).loadState.get().status === 'ready';
    },

    editorLoadError() {
        const state = (Template.instance() as any).loadState.get();
        return state.status === 'error' ? state.message : '';
    },

    noData() {
        return (Template.instance() as any).loadState.get().status === 'empty';
    },

    lessonName() {
        const tdf = TdfsCollection.findOne((Template.instance() as any).tdfId);
        return tdf?.content?.tdfs?.tutor?.setspec?.lessonname || tdfEditorText('tdfEditor.unknownLesson');
    },

    tdfEditorText(key: PlatformStringKey, options?: { hash?: Parameters<typeof translatePlatformString>[2] }) {
        return tdfEditorText(key, options?.hash);
    },

    editTitle() {
        const tdf = TdfsCollection.findOne((Template.instance() as any).tdfId);
        const lessonName = tdf?.content?.tdfs?.tutor?.setspec?.lessonname || tdfEditorText('tdfEditor.unknownLesson');
        return tdfEditorText('tdfEditor.editTitle', { lessonName });
    },

    conditionSummary(conditionInfo: any) {
        return tdfEditorText('tdfEditor.conditionInfo', {
            fileName: conditionInfo?.fileName ?? '',
            index: conditionInfo?.index ?? '',
            total: conditionInfo?.total ?? ''
        });
    },

    conditionInfo() {
        const tdfId = (Template.instance() as any).tdfId;
        const tdf = TdfsCollection.findOne({_id: tdfId});
        if (!tdf) return null;

        // Check if this TDF is referenced as a condition in any root TDF
        const rootTdf = TdfsCollection.findOne({ 'content.tdfs.tutor.setspec.conditionTdfIds': tdfId });

        if (!rootTdf) return null;

        const conditions = rootTdf.content.tdfs.tutor.setspec.condition || [];
        const conditionTdfIds = rootTdf.content.tdfs.tutor.setspec.conditionTdfIds || [];
        const index = conditionTdfIds.indexOf(tdfId);

        if (index === -1) return null;

        return {
            fileName: tdf.content.fileName,
            index: index + 1,  // 1-based for display
            total: conditions.length
        };
    },

    hasChanges() {
        return (Template.instance() as any).hasChanges.get();
    },

    saveFeedbackText() {
        return (Template.instance() as any).saveFeedback.get();
    },

    validationEditorMessage() {
        return (Template.instance() as any).editorMessages.get().validation || null;
    },
    catalogEditorMessage() {
        return (Template.instance() as any).editorMessages.get().catalog || null;
    },
    saveEditorMessage() {
        return (Template.instance() as any).editorMessages.get().save || null;
    },
    initializationEditorMessage() {
        return (Template.instance() as any).editorMessages.get().initialization || null;
    },

    saveDisabled() {
        return (Template.instance() as any).hasChanges.get() ? null : 'disabled';
    },

    noneChecked() {
        return (Template.instance() as any).tooltipMode.get() === 'none' ? 'checked' : null;
    },

    briefChecked() {
        return (Template.instance() as any).tooltipMode.get() === 'brief' ? 'checked' : null;
    },

    verboseChecked() {
        return (Template.instance() as any).tooltipMode.get() === 'verbose' ? 'checked' : null;
    }
});

Template.tdfEdit.events({
    'click .tdf-editor-retry'(event: Event, instance: any) {
        event.preventDefault();
        if (instance.editor) {
            instance.editor.destroy();
            instance.editor = null;
        }
        instance.applicabilityController?.destroy();
        instance.applicabilityController = null;
        document.getElementById('tdf-editor-container')?.replaceChildren();
        void initializeTdfEditor(instance);
    },

    // Handle tooltip mode toggle
    'change input[name="tooltipMode"]'(event: any, instance: any) {
        const newMode = event.target.value;
        setTooltipMode(newMode);
        instance.tooltipMode.set(newMode);

        // Update descriptions in place (much faster than recreating editor)
        const container = document.getElementById('tdf-editor-container');
        if (container) {
            updateDescriptionsInPlace(container, TDF_TOOLTIPS, newMode);
        }
    },

    async 'click .save-btn'(event: any, instance: any) {
        event.preventDefault();

        if (instance.saving.get() || !instance.editor) return;

        syncFieldEditorFromDom(instance, document.activeElement);

        // Get edited tutor from json-editor
        const editedTutor = instance.editor.getValue();

        // Run json-editor schema validation
        const schemaErrors = instance.editor.validate();
        if (schemaErrors.length > 0) {
            const errorMessages = schemaErrors.map((e: any) => `${e.path}: ${e.message}`).join('; ');
            setEditorMessage(instance, 'error', tdfEditorText('tdfEditor.schemaValidationErrors'), errorMessages, 'validation');
            return;
        }

        // Run our custom validators (immediate, no debounce)
        if (instance.validator) {
            instance.validator.validateNow();
            if (instance.validator.hasBlockingErrors()) {
                // Scroll to validation summary
                const summaryEl = document.getElementById('tdf-validation-summary');
                if (summaryEl) {
                    summaryEl.scrollIntoView({ behavior: 'smooth' });
                }
                setEditorMessage(instance, 'warning', tdfEditorText('tdfEditor.validationAttentionTitle'), tdfEditorText('tdfEditor.validationAttentionText'), 'validation');
                return;
            }
        }

        clearEditorMessage(instance, 'validation');
        clearEditorMessage(instance, 'save');
        instance.saving.set(true);

        try {
            // Handle API keys: if empty but had original, keep original encrypted value
            // If user entered new value, mark it for encryption on server
            const apiKeyUpdates: Record<string, any> = {};
            API_KEY_FIELDS.forEach((field: string) => {
                const newValue = editedTutor.setspec?.[field];
                const originalEncrypted = instance.originalApiKeys[field];

                if (!newValue && originalEncrypted) {
                    // User didn't change it - restore original encrypted value
                    if (editedTutor.setspec) {
                        editedTutor.setspec[field] = originalEncrypted;
                    }
                } else if (newValue && newValue !== originalEncrypted) {
                    // User entered new value - mark for encryption
                    apiKeyUpdates[field] = true;
                }
            });

            // Wrap back in the expected structure for storage
            // Editor edits tutor, content is { tdfs: { tutor: {...} } }
            const tdfContent = { tdfs: { tutor: editedTutor } };
            const removedTutorPaths = collectRemovedEditorPaths(instance._baselineValue, editedTutor);

            // Call server to save (server validates ownership, encrypts new API keys, and saves)
            await meteorCallAsync('saveTdfContent', instance.tdfId, tdfContent, apiKeyUpdates, removedTutorPaths);

            showSaveFeedbackAndRedirect(instance, tdfEditorText('tdfEditor.savedReturning'));
            instance.hasChanges.set(false);
            instance._hasPendingChanges = false;

        } catch (error: any) {
            clientConsole(1, '[TDF Edit] Error saving TDF:', error);
            setEditorMessage(instance, 'error', tdfEditorText('tdfEditor.errorSavingTdf'), error.reason || error.message, 'save');
        } finally {
            instance.saving.set(false);
        }
    }
});

/**
 * Load the TDF schema
 */
async function loadSchema(): Promise<any> {
    if (cachedSchema) {
        return cachedSchema;
    }

    try {
        // Fetch schema from public folder
        const response = await fetch('/tdfSchema.json');
        if (!response.ok) {
            throw new Error('Failed to load schema: ' + response.statusText);
        }
        cachedSchema = await response.json();
        return cachedSchema;
    } catch (error: any) {
        clientConsole(1, '[TDF Edit] Error loading TDF schema:', error);
        throw error;
    }
}

async function loadTdfEditorOpenRouterCatalog(): Promise<OpenRouterCatalogLoadResult> {
    try {
        return { catalog: await loadOpenRouterModelCatalog(), error: null };
    } catch (error: unknown) {
        return { catalog: null, error: getErrorMessage(error) };
    }
}

function getOpenRouterCatalogModelLabel(model: OpenRouterModelCatalogEntry): string {
    return model.name && model.name !== model.id
        ? `${model.name} (${model.id})`
        : model.id;
}

function configureOpenRouterEditorSchema(
    schema: any,
    catalog: OpenRouterModelCatalogEntry[] | null,
    currentModel: string,
): void {
    const fields = schema?.properties?.setspec?.properties;
    const modelField = fields?.openRouterModel;
    const reasoningField = fields?.openRouterReasoningLevel;
    if (!modelField || !reasoningField) return;

    if (!catalog) {
        modelField.readOnly = true;
        reasoningField.readOnly = true;
        return;
    }

    const catalogIds = new Set(catalog.map((model) => model.id));
    const modelValues = ['', ...catalog.map((model) => model.id)];
    const modelTitles = [
        tdfEditorText('profile.selectOpenRouterModel'),
        ...catalog.map(getOpenRouterCatalogModelLabel),
    ];
    if (currentModel && !catalogIds.has(currentModel)) {
        modelValues.push(currentModel);
        modelTitles.push(tdfEditorText('profile.savedModelUnavailable', { model: currentModel }));
    }
    modelField.enum = modelValues;
    modelField.options = {
        ...(modelField.options || {}),
        enum_titles: modelTitles,
    };
}

function reasoningLevelText(level: OpenRouterReasoningLevel): string {
    return tdfEditorText(`profile.reasoningLevel.${level}` as PlatformStringKey);
}

function syncOpenRouterEditorControls(instance: any): void {
    const catalog = instance.openRouterModelCatalog as OpenRouterModelCatalogEntry[] | null;
    if (!catalog || !instance.editor) return;

    const modelEditor = instance.editor.getEditor('root.setspec.openRouterModel');
    if (!modelEditor) return;
    const modelId = String(modelEditor.getValue() || '').trim();
    const model = catalog.find((entry) => entry.id === modelId);
    let reasoningEditor = instance.editor.getEditor('root.setspec.openRouterReasoningLevel');

    if (model?.reasoning?.mandatory && !reasoningEditor) {
        const setspecEditor = instance.editor.getEditor('root.setspec');
        if (typeof setspecEditor?.addObjectProperty === 'function') {
            setspecEditor.addObjectProperty('openRouterReasoningLevel');
            reasoningEditor = instance.editor.getEditor('root.setspec.openRouterReasoningLevel');
        }
    }
    if (!reasoningEditor) return;

    const input = reasoningEditor.input as HTMLSelectElement | undefined;
    const container = reasoningEditor.container as HTMLElement | undefined;
    if (!modelId) {
        if (reasoningEditor.getValue() !== 'none') {
            reasoningEditor.setValue('none');
        }
        if (input?.options) {
            const editorValues = Array.isArray(reasoningEditor.enum_values)
                ? reasoningEditor.enum_values
                : OPENROUTER_REASONING_LEVELS;
            Array.from(input.options).forEach((option, index) => {
                const level = editorValues[index] as OpenRouterReasoningLevel | undefined;
                if (!level) return;
                option.hidden = level !== 'none';
                option.disabled = level !== 'none';
                option.textContent = reasoningLevelText(level);
            });
            input.disabled = true;
        }
        if (container) container.style.display = 'none';
        return;
    }
    if (!model) {
        if (container) container.style.display = '';
        if (input) input.disabled = true;
        return;
    }

    const allowed = getAllowedOpenRouterReasoningLevels(model);
    const controlKind = getOpenRouterReasoningControlKind(model);
    let current: OpenRouterReasoningLevel;
    try {
        current = normalizeOpenRouterReasoningLevel(
            reasoningEditor.getValue(),
            'TDF OpenRouter reasoning level',
        );
    } catch {
        current = getDefaultOpenRouterReasoningLevel(model);
    }
    if (!allowed.includes(current)) {
        current = getDefaultOpenRouterReasoningLevel(model);
        reasoningEditor.setValue(current);
    }

    if (controlKind === 'hidden') {
        if (container) container.style.display = 'none';
        if (input) input.disabled = true;
        return;
    }
    if (container) container.style.display = '';

    if (input?.options) {
        const editorValues = Array.isArray(reasoningEditor.enum_values)
            ? reasoningEditor.enum_values
            : OPENROUTER_REASONING_LEVELS;
        Array.from(input.options).forEach((option, index) => {
            const level = editorValues[index] as OpenRouterReasoningLevel | undefined;
            if (!level) return;
            const isAllowed = allowed.includes(level);
            option.hidden = !isAllowed;
            option.disabled = !isAllowed;
            option.textContent = reasoningLevelText(level);
        });
        input.disabled = false;
    }
}

function waitForTdfSubscription(instance: any): Promise<void> {
    return new Promise((resolve, reject) => {
        let settled = false;
        instance.subscribe('tdfForEdit', instance.tdfId, {
            onReady: () => {
                if (!settled) {
                    settled = true;
                    resolve();
                }
            },
            onStop: (error?: unknown) => {
                if (settled) return;
                settled = true;
                if (error) reject(error);
                else resolve();
            },
        });
    });
}

function afterFlush(): Promise<void> {
    return new Promise((resolve) => Tracker.afterFlush(resolve));
}

async function initializeTdfEditor(instance: any): Promise<void> {
    const requestId = instance.lifetime.begin();
    instance.loadState.set(startLoad(instance.loadState.get(), requestId));
    try {
        const [, , catalogResult] = await Promise.all([
            loadSchema(),
            waitForTdfSubscription(instance),
            loadTdfEditorOpenRouterCatalog(),
        ]);
        instance.openRouterModelCatalog = catalogResult.catalog;
        instance.openRouterCatalogError = catalogResult.error;
        if (!instance.lifetime.isCurrent(requestId)) return;
        const tdf = TdfsCollection.findOne(instance.tdfId) || null;
        if (!tdf) {
            instance.loadState.set(resolveLoad(
                instance.loadState.get(),
                requestId,
                { tdf: null },
                (value: TdfEditorLoadValue) => value.tdf === null,
            ));
            return;
        }
        await afterFlush();
        if (!instance.lifetime.isCurrent(requestId)) return;
        await initEditor(instance, tdf);
        if (!instance.lifetime.isCurrent(requestId)) return;
        if (instance.openRouterCatalogError) {
            setEditorMessage(
                instance,
                'warning',
                tdfEditorText('profile.openRouterModel'),
                tdfEditorText('profile.openRouterModelsLoadFailed', {
                    error: instance.openRouterCatalogError,
                }),
                'catalog',
            );
        }
        instance.loadState.set(resolveLoad(
            instance.loadState.get(),
            requestId,
            { tdf },
            () => false,
        ));
    } catch (error: unknown) {
        if (!instance.lifetime.isCurrent(requestId)) return;
        clientConsole(1, '[TDF Edit] Failed to initialize editor:', error);
        instance.loadState.set(rejectLoad(instance.loadState.get(), requestId, {
            message: getErrorMessage(error),
            retryable: true,
        }));
    }
}

// API key fields that are stored encrypted - clear for display, allow re-entry
const API_KEY_FIELDS = ['speechAPIKey', 'textToSpeechAPIKey', 'openRouterApiKey'];

/**
 * Check if a value is considered "empty" for display purposes
 */
function isEmpty(value: any) {
    if (value === null || value === undefined || value === '') return true;
    if (Array.isArray(value) && value.length === 0) return true;
    if (typeof value === 'object' && Object.keys(value).length === 0) return true;
    return false;
}

/**
 * Recursively remove empty properties from an object
 * This makes json-editor only render fields that actually have data
 */
function removeEmptyProperties(obj: any): any {
    if (Array.isArray(obj)) {
        const cleaned: any[] = obj
            .map((item: any) => removeEmptyProperties(item))
            .filter((item: any) => !isEmpty(item));
        return cleaned.length > 0 ? cleaned : [];
    }
    if (obj !== null && typeof obj === 'object') {
        const cleaned: Record<string, any> = {};
        for (const [key, value] of Object.entries(obj)) {
            const cleanedValue = removeEmptyProperties(value);
            if (!isEmpty(cleanedValue)) {
                cleaned[key] = cleanedValue;
            }
        }
        return Object.keys(cleaned).length > 0 ? cleaned : {};
    }
    return obj;
}

function normalizeEditorValue(value: any) {
    return value && typeof value === 'object' ? value : {};
}

function cloneJsonLike(value: any): any {
    return value === undefined ? value : JSON.parse(JSON.stringify(value));
}

function collectRemovedEditorPaths(originalValue: any, editedValue: any, prefix = ''): string[] {
    if (!originalValue || typeof originalValue !== 'object' || Array.isArray(originalValue)) {
        return [];
    }
    const editedObject = editedValue && typeof editedValue === 'object' && !Array.isArray(editedValue)
        ? editedValue
        : {};
    const removedPaths: string[] = [];
    Object.keys(originalValue).forEach((key) => {
        const path = prefix ? `${prefix}.${key}` : key;
        if (!Object.prototype.hasOwnProperty.call(editedObject, key)) {
            removedPaths.push(path);
            return;
        }
        removedPaths.push(...collectRemovedEditorPaths(originalValue[key], editedObject[key], path));
    });
    return removedPaths;
}

function updateChangeState(instance: any, value: any) {
    if (!instance?.hasChanges) return;
    const baseline = instance._baselineSerialized || JSON.stringify({});
    const serialized = JSON.stringify(normalizeEditorValue(value));
    const hasChanges = serialized !== baseline;
    instance._hasPendingChanges = hasChanges;
    instance.hasChanges.set(hasChanges);
}

function syncFieldEditorFromDom(instance: any, target: any) {
    if (!instance?.editor || !target?.matches) return false;
    if (!target.matches('input[type="text"], textarea, select')) return false;
    if (target.closest('.je-modal')) return false;

    const schemaPath = target.closest('[data-schemapath]')?.getAttribute('data-schemapath');
    if (!schemaPath || schemaPath === 'root') return false;

    const fieldEditor = instance.editor.getEditor(schemaPath);
    if (!fieldEditor || typeof fieldEditor.getValue !== 'function' || typeof fieldEditor.setValue !== 'function') {
        return false;
    }

    const nextValue = target.value;
    if (fieldEditor.getValue() === nextValue) return false;

    fieldEditor.setValue(nextValue);
    return true;
}

/**
 * Convert long text inputs to expandable textareas and short textareas back to inputs
 * Makes it easier to edit fields with long content (like calculateProbability)
 * @param {HTMLElement} container - The container element
 * @param {JSONEditor} editor - The json-editor instance (optional, needed for textarea blur updates)
 */
function convertLongInputsToTextareas(container: any, editor: any, rootArg?: any) {
    const root = rootArg || container;
    if (!root) return;

    // Find all text inputs and convert to textarea if long
    const inputs = root.matches && root.matches('input[type="text"]')
        ? [root]
        : root.querySelectorAll('input[type="text"]');

    inputs.forEach((input: any) => {
        const value = input.value || '';
        const hasNewlines = value.includes('\n');
        const isLong = value.length > 50; // Threshold for "long" content (50 chars)

        // Convert to textarea if it has newlines or is long
        if (hasNewlines || isLong) {
            const textarea = document.createElement('textarea');

            // Copy attributes
            textarea.className = input.className;
            textarea.name = input.name;
            textarea.id = input.id;
            textarea.value = value;

            // Copy data attributes
            Array.from(input.attributes).forEach((attr: any) => {
                if (attr.name.startsWith('data-')) {
                    textarea.setAttribute(attr.name, attr.value);
                }
            });

            // Always start with 3 rows regardless of content length
            textarea.rows = 3;

            // Style the textarea
            textarea.style.resize = 'vertical';
            textarea.style.fontFamily = 'monospace';
            textarea.style.fontSize = '0.85em';
            textarea.style.overflow = 'hidden'; // Hide scrollbar for auto-expand

            // Replace input with textarea
            input.parentNode.replaceChild(textarea, input);

            // Add class to form-group to trigger full-width layout
            const formGroup = textarea.closest('.form-group');
            if (formGroup) {
                formGroup.classList.add('has-textarea');

                // Also add class to parent column div (Bootstrap grid)
                const colParent = formGroup.closest('[class*="col-"]');
                if (colParent) {
                    colParent.classList.add('has-textarea-parent');
                }
            }

            // Auto-expand/shrink function to adjust height based on content
            const autoExpand = () => {
                textarea.style.height = 'auto'; // Reset height
                const scrollHeight = textarea.scrollHeight;
                const minHeight = 50; // Minimum height (about 3 rows)
                const maxHeight = 400; // Maximum height before scrolling
                textarea.style.height = Math.min(Math.max(scrollHeight, minHeight), maxHeight) + 'px';

                // Show scrollbar if we hit max height
                if (scrollHeight > maxHeight) {
                    textarea.style.overflow = 'auto';
                } else {
                    textarea.style.overflow = 'hidden';
                }
            };

            // Auto-expand/shrink as user types (but don't expand initially)
            textarea.addEventListener('input', autoExpand);

            // On blur, update json-editor's internal value so it knows about changes
            // (Since we replaced the original input, json-editor lost its event listeners)
            // Mark as having blur listener to avoid duplicates
            if (editor && !textarea.dataset.hasBlurListener) {
                textarea.dataset.hasBlurListener = 'true';
                textarea.addEventListener('blur', () => {
                    const schemaPath = textarea.closest('[data-schemapath]')?.getAttribute('data-schemapath');
                    if (schemaPath) {
                        const fieldEditor = editor.getEditor(schemaPath);
                        if (fieldEditor && fieldEditor.setValue) {
                            // Only update if value actually changed
                            const currentValue = fieldEditor.getValue();
                            if (currentValue !== textarea.value) {
                                fieldEditor.setValue(textarea.value);
                            }
                        }
                    }
                });
            }
        }
    });

    // Find all textareas and convert back to input if short
    // Exclude textareas inside .je-modal (JSON edit modal)
    const textareas = root.matches && root.matches('textarea.form-control')
        ? [root]
        : root.querySelectorAll('textarea.form-control:not(.je-modal textarea)');

    textareas.forEach((textarea: any) => {
        // Skip JSON edit modal textareas
        if (textarea.closest('.je-modal')) return;

        const value = textarea.value || '';
        const hasNewlines = value.includes('\n');
        const isShort = value.length <= 50;

        // Convert back to input if it's short and has no newlines
        if (isShort && !hasNewlines) {
            const input = document.createElement('input');
            input.type = 'text';

            // Copy attributes
            input.className = textarea.className;
            input.name = textarea.name;
            input.id = textarea.id;
            input.value = value;

            // Copy data attributes
            Array.from(textarea.attributes).forEach((attr: any) => {
                if (attr.name.startsWith('data-')) {
                    input.setAttribute(attr.name, attr.value);
                }
            });

            // Replace textarea with input
            textarea.parentNode.replaceChild(input, textarea);

            // Remove classes from form-group and parent column
            const formGroup = input.closest('.form-group');
            if (formGroup) {
                formGroup.classList.remove('has-textarea');

                const colParent = formGroup.closest('[class*="col-"]');
                if (colParent) {
                    colParent.classList.remove('has-textarea-parent');
                }
            }

            // On blur, update json-editor's internal value so it knows about changes
            // (Since we replaced the original textarea, json-editor lost its event listeners)
            // Mark as having blur listener to avoid duplicates
            if (editor && !input.dataset.hasBlurListener) {
                input.dataset.hasBlurListener = 'true';
                input.addEventListener('blur', () => {
                    const schemaPath = input.closest('[data-schemapath]')?.getAttribute('data-schemapath');
                    if (schemaPath) {
                        const fieldEditor = editor.getEditor(schemaPath);
                        if (fieldEditor && fieldEditor.setValue) {
                            // Only update if value actually changed
                            const currentValue = fieldEditor.getValue();
                            if (currentValue !== input.value) {
                                fieldEditor.setValue(input.value);
                            }
                        }
                    }
                });
            }
        }
    });
}

/**
 * Move array field descriptions from before items to after items container
 * json-editor places <p> descriptions before array items, this moves them after
 */
function moveArrayDescriptionsToEnd(container: any) {
    // Find all array-type fields
    const arrayFields = container.querySelectorAll('[data-schematype="array"]');

    arrayFields.forEach((arrayEl: any) => {
        // Find the <p> description that's a direct child
        const descP = arrayEl.querySelector(':scope > p');
        if (!descP) return;

        // Find the items container (the card that holds array items)
        const itemsContainer = arrayEl.querySelector(':scope > .card.card-body');
        if (!itemsContainer) return;

        // Move description after the items container
        itemsContainer.after(descP);
    });
}

/**
 * Inject labels for form inputs that don't have them
 * Bootstrap 5 theme doesn't render labels, so we add them manually
 */
function injectLabelsForInputs(container: any, editor: any, rootArg?: any) {
    const root = rootArg || container;
    if (!root) return;

    // Find all inputs/selects/textareas in form-groups
    const formGroups = root.matches && root.matches('.form-group')
        ? [root]
        : root.querySelectorAll('.form-group');

    formGroups.forEach((formGroup: any) => {
        // Check if this form-group already has a label
        const existingLabel = formGroup.querySelector('label');
        if (existingLabel) return;  // Already has a label, skip

        // Find the input/select/textarea
        const input = formGroup.querySelector('input, select, textarea');
        if (!input) return;  // No input found, skip

        // Skip if input is in a table (table headers serve as labels)
        if (input.closest('td.compact')) return;

        // Get the schema path from the closest parent with data-schemapath
        const schemaPathElem = input.closest('[data-schemapath]');
        if (!schemaPathElem) return;

        const schemaPath = schemaPathElem.getAttribute('data-schemapath');
        if (!schemaPath) return;

        // Get the editor instance for this path to extract the title
        const editorInstance = editor.getEditor(schemaPath);
        if (!editorInstance || !editorInstance.schema) return;

        // Labels are registry-owned schema metadata. Missing titles indicate a schema generation bug.
        const title = editorInstance.schema.title;
        if (!title) {
            throw new Error(`[TDF Edit] Missing schema title for ${schemaPath}`);
        }

        // Create and inject the label
        const label = document.createElement('label');
        label.className = 'form-label';
        label.textContent = title;
        label.setAttribute('for', input.id);

        // Insert label before the input
        input.parentNode.insertBefore(label, input);
    });
}

/**
 * Initialize the json-editor
 */
async function initEditor(instance: any, tdf: any) {
    const container = document.getElementById('tdf-editor-container');
    if (!container || !cachedSchema) {
        throw new Error('TDF editor initialization requires its container and schema.');
    }

    // Apply hide-descriptions class if mode is 'none' on initial load
    const tooltipMode = instance.tooltipMode.get();
    if (tooltipMode === 'none') {
        container.classList.add('hide-descriptions');
    } else {
        container.classList.remove('hide-descriptions');
    }

    // Store original for comparison (keep encrypted values)
    instance.originalTdf = JSON.parse(JSON.stringify(tdf.content.tdfs));

    // Track which API keys had values (so we know to keep them if not re-entered)
    instance.originalApiKeys = {};
    API_KEY_FIELDS.forEach((field: string) => {
        if (tdf.content.tdfs.tutor?.setspec?.[field]) {
            instance.originalApiKeys[field] = tdf.content.tdfs.tutor.setspec[field];
        }
    });

    // Create a copy for editing with API keys cleared (they're encrypted gibberish)
    let tutorData = JSON.parse(JSON.stringify(tdf.content.tdfs.tutor));
    API_KEY_FIELDS.forEach((field: string) => {
        if (tutorData.setspec?.[field]) {
            tutorData.setspec[field] = ''; // Clear for display - user can re-enter
        }
    });
    // Remove empty properties so json-editor only shows populated fields
    // Users can add new fields via the Properties button
    tutorData = removeEmptyProperties(tutorData);

    // Extract the tutor schema (the main part we want to edit)
    const tutorSchema = prepareTutorSchemaForJsonEditor(cachedSchema.properties?.tutor || cachedSchema);

    // Inject tooltip descriptions based on current mode (brief or verbose)
    const schemaWithDescriptions = injectDescriptions(tutorSchema, TDF_TOOLTIPS, tooltipMode);
    configureOpenRouterEditorSchema(
        schemaWithDescriptions,
        instance.openRouterModelCatalog,
        String(tutorData.setspec?.openRouterModel || '').trim(),
    );

    // Configure json-editor options
    // Key: use startval to populate existing data (pre-filtered to remove empty values)
    const options = {
        schema: schemaWithDescriptions,
        startval: tutorData,
        theme: 'bootstrap5',
        iconlib: 'fontawesome4',
        disable_edit_json: false,
        disable_properties: false,   // Keep Properties button to add new fields
        disable_collapse: false,
        disable_array_add: false,
        disable_array_delete: false,
        disable_array_reorder: false,
        enable_array_copy: true,
        array_controls_top: true,
        no_additional_properties: true,
        required_by_default: false,
        display_required_only: false,
        show_opt_in: false,  // Don't need checkboxes - we pre-filter instead
        remove_empty_properties: true,   // Don't include empty in getValue()
        prompt_before_delete: true,
        object_layout: 'grid',  // Grid layout forces labels to show
        compact: false,  // Compact mode hides labels, so keep this false
        keep_oneof_values: false  // Don't keep values when switching types
    };

    let JSONEditorAny;
    try {
        JSONEditorAny = await ensureJsonEditor();
    } catch (error: any) {
        clientConsole(1, '[TDF Edit] JSONEditor failed to load:', error);
        setEditorMessage(instance, 'error', tdfEditorText('tdfEditor.editorLibraryNotLoaded'), tdfEditorText('tdfEditor.refreshContactSupport'), 'initialization');
        throw error;
    }

    instance.editor = new JSONEditorAny(container, options);
    instance.applicabilityController = installSchemaApplicabilityControls(container, instance.editor);

    // Flag to skip change detection during initialization
    let isInitializing = true;

    // After editor is ready, ensure all data is loaded
    const editorReady = new Promise<void>((resolve, reject) => {
    instance.editor.on('ready', () => {
      try {
        // Ensure the editor has initial data in case startval didn't populate
        const currentValue = instance.editor.getValue();
        if (!currentValue || Object.keys(currentValue).length === 0) {
            instance.editor.setValue(tutorData);
        }

        // Convert long text inputs to textareas for easier editing
        convertLongInputsToTextareas(container, instance.editor);

        // Inject labels for all form fields that don't have them
        // Bootstrap 5 theme doesn't render labels by default, so we add them manually
        injectLabelsForInputs(container, instance.editor);

        // Build description cache for instant mode switching
        buildDescriptionCache(container, TDF_TOOLTIPS);

        // Move array field descriptions to after the items container
        moveArrayDescriptionsToEnd(container);

        // Change "properties" button text to "Edit Properties"
        container.querySelectorAll('.json-editor-btntype-properties').forEach(btn => {
            const span = btn.querySelector('span');
            if (span && span.textContent.trim().toLowerCase() === 'properties') {
                span.textContent = ' Edit Properties';
            }
        });

        // Use editor's normalized value as the baseline for change detection
        // This prevents false "unsaved changes" due to json-editor normalizing data
        instance.originalTdf.tutor = instance.editor.getValue();
        const baselineValue = instance.editor.getValue();
        instance._baselineValue = cloneJsonLike(baselineValue);
        instance._baselineSerialized = JSON.stringify(normalizeEditorValue(baselineValue));
        updateChangeState(instance, baselineValue);

        // Initialize validator with editor and context
        instance.validationContext = new ValidationContext(instance);
        instance.validator.init(instance.editor, instance.validationContext);

        // Run initial validation
        instance.validator.validate();

        // Set up reactive validation UI updates
        instance.validationAutorun = Tracker.autorun(() => {
            const results = instance.validator.results.get();
            const errors = results.filter((r: any) => r.severity === 'error');
            const warnings = results.filter((r: any) => r.severity === 'warning');

            // Update summary panel
            const summaryContainer = document.getElementById('tdf-validation-summary');
            if (summaryContainer) {
                summaryContainer.innerHTML = createValidationSummary(errors, warnings);
                initValidationUI(summaryContainer, container);
            }

            // Apply field-level styling
            applyFieldErrors(container, results);
        });

        // Done initializing - now track real changes
        isInitializing = false;
        // Apply catalog requirements only after capturing the persisted baseline.
        // A mandatory reasoning default is therefore a real unsaved change that
        // the user must save, rather than a value that merely looks persisted.
        syncOpenRouterEditorControls(instance);
        updateChangeState(instance, instance.editor.getValue());
        instance.validator.validate();
        resolve();
      } catch (error: unknown) {
        reject(error);
      }
    });
    });

    // Listen for changes
    instance.editor.on('change', () => {
        // Skip change detection during initialization
        if (isInitializing) return;

        syncOpenRouterEditorControls(instance);

        updateChangeState(instance, instance.editor.getValue());

        // Run validation (debounced)
        instance.validator.validate();
        injectMCButtons(instance);
    });

    // Convert long inputs to textareas on-the-fly, and revert on blur if short
    const handleInput = (event: any) => {
        const target = event.target;
        if (target && target.matches && target.matches('input[type="text"]')) {
            convertLongInputsToTextareas(container, instance.editor, target);
        }

        if (syncFieldEditorFromDom(instance, target)) {
            updateChangeState(instance, instance.editor.getValue());
            instance.validator.validate();
        }
    };
    const handleBlur = (event: any) => {
        const target = event.target;
        if (target && target.matches && target.matches('textarea.form-control')) {
            if (!target.closest('.je-modal')) {
                convertLongInputsToTextareas(container, instance.editor, target);
            }
        }

        if (syncFieldEditorFromDom(instance, target)) {
            updateChangeState(instance, instance.editor.getValue());
            instance.validator.validate();
        }
    };
    container.addEventListener('input', handleInput, true);
    container.addEventListener('blur', handleBlur, true);
    instance._inputHandler = handleInput;
    instance._blurHandler = handleBlur;

    // Process newly-added fields only (avoid full-container rescans)
    let fieldObserverTimer: any = null;
    let pendingFieldNodes: any[] = [];
    const processFieldNodes = () => {
        const nodesToProcess = pendingFieldNodes;
        pendingFieldNodes = [];
        fieldObserverTimer = null;

        nodesToProcess.forEach((node: any) => {
            if (node.nodeType !== 1) return;
            convertLongInputsToTextareas(container, instance.editor, node);
            injectLabelsForInputs(container, instance.editor, node);
            syncOpenRouterEditorControls(instance);
        });
    };
    const fieldObserver = new MutationObserver((mutations) => {
        let sawActionable = false;
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (node.nodeType !== 1) continue;
                pendingFieldNodes.push(node);
                sawActionable = true;
            }
        }
        if (!sawActionable) return;
        if (fieldObserverTimer) return;
        fieldObserverTimer = setTimeout(processFieldNodes, 75);
    });
    fieldObserver.observe(container, { childList: true, subtree: true });
    instance.fieldObserver = fieldObserver;

    // Watch for modal opens and reorder property checkboxes
    // Available (unchecked) at top, in-use (checked) at bottom
    let modalObserverTimer: any = null;
    let pendingActionNodes: any[] = [];

    const processPendingNodes = () => {
        const nodesToProcess = pendingActionNodes;
        pendingActionNodes = [];
        modalObserverTimer = null;

        nodesToProcess.forEach((node: any) => {
            if (node.nodeType !== 1) return;

            // Fix "properties" button text in added nodes only
            const buttons = node.classList?.contains('json-editor-btntype-properties') ? [node] :
                (node.querySelectorAll ? node.querySelectorAll('.json-editor-btntype-properties') : []);
            buttons.forEach((btn: any) => {
                const span = btn.querySelector('span');
                if (span && span.textContent.trim().toLowerCase() === 'properties') {
                    span.textContent = ' Edit Properties';
                }
            });

            // Find je-modal in this specific added node
            const modals = node.classList?.contains('je-modal') ? [node] :
                (node.querySelectorAll ? Array.from(node.querySelectorAll('.je-modal')) : []);

            for (const modal of modals) {
                instance.applicabilityController?.sync(modal);
                // Skip if already processed
                if (modal.dataset.labelsProcessed) continue;
                modal.dataset.labelsProcessed = 'true';

                sortPropertiesModal(modal);
            }
        });
    };

    const observer = new MutationObserver((mutations) => {
        let sawActionable = false;
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (node.nodeType !== 1) continue;

                const nodeEl = node as any;
                const hasModal = nodeEl.classList?.contains('je-modal') || (nodeEl.querySelector && nodeEl.querySelector('.je-modal'));
                const hasPropsButton = nodeEl.classList?.contains('json-editor-btntype-properties') ||
                    (nodeEl.querySelector && nodeEl.querySelector('.json-editor-btntype-properties'));

                if (!hasModal && !hasPropsButton) continue;

                pendingActionNodes.push(node);
                sawActionable = true;
            }
        }

        if (!sawActionable) return;
        if (modalObserverTimer) return;

        modalObserverTimer = setTimeout(processPendingNodes, 75);
    });
    observer.observe(container, { childList: true, subtree: true });
    instance.domObserver = observer;

    // Inject MC toggle buttons for learning session units (after a short delay to ensure DOM is ready)
    setTimeout(() => injectMCButtons(instance), 200);
    await editorReady;
}

/**
 * Inject MC toggle buttons for each unit that has a learningsession
 * @param {Object} instance - Template instance with editor
 */
function injectMCButtons(instance: any) {
    if (!instance.editor) return;

    const unitsEditor = instance.editor.getEditor('root.unit');
    const units = unitsEditor ? unitsEditor.getValue() : (instance.editor.getValue()?.unit || []);
    if (!Array.isArray(units)) return;

    if (!instance._mcButtonState) {
        instance._mcButtonState = [];
    }

    units.forEach((unit: any, idx: any) => {
        // Only show button for units with learningsession
        if (!unit?.learningsession) {
            const unitEditor = instance.editor.getEditor(`root.unit.${idx}`);
            const unitContainer = unitEditor?.container;
            const unitHeader = unitContainer
                ? (unitContainer.querySelector(':scope > h3') ||
                   unitContainer.querySelector(':scope > .card-header') ||
                   unitContainer.querySelector(':scope > .je-header') ||
                   unitContainer.querySelector(':scope > .je-object__title') ||
                   unitContainer.querySelector(':scope > span > button')?.parentElement)
                : null;
            const existing = unitHeader?.querySelector('.mc-toggle-btn');
            if (existing) existing.remove();
            instance._mcButtonState[idx] = null;
            return;
        }

        // Use json-editor's getEditor API to find the unit's editor instance
        const unitEditor = instance.editor.getEditor(`root.unit.${idx}`);
        if (!unitEditor || !unitEditor.container) return;

        const unitContainer = unitEditor.container;

        // Find the header element - json-editor creates a header row for collapsible objects
        let unitHeader = unitContainer.querySelector(':scope > h3') ||
                         unitContainer.querySelector(':scope > .card-header') ||
                         unitContainer.querySelector(':scope > .je-header') ||
                         unitContainer.querySelector(':scope > .je-object__title') ||
                         unitContainer.querySelector(':scope > span > button')?.parentElement;
        if (!unitHeader) return;

        // Check current state
        const isEnabled = unit.buttontrial === 'true';
        const previousState = instance._mcButtonState[idx];
        const existing = unitHeader.querySelector('.mc-toggle-btn');

        if (existing && previousState === isEnabled) {
            return;
        }

        // Create or update toggle button
        const btn = existing || document.createElement('button');
        btn.className = `btn btn-sm mc-toggle-btn mc-toggle-action ${isEnabled ? 'btn-success' : 'btn-outline-secondary'}`;
        btn.type = 'button';
        btn.innerHTML = isEnabled
            ? '<i class="fa fa-check-square"></i> MC Mode'
            : '<i class="fa fa-square-o"></i> Text Mode';
        btn.title = isEnabled
            ? 'Click to switch to text input mode'
            : 'Click to enable multiple choice mode';

        if (!existing) {
            btn.onclick = (e: any) => {
                e.preventDefault();
                e.stopPropagation();
                toggleUnitMC(instance, idx);
            };
            unitHeader.appendChild(btn);
        }

        instance._mcButtonState[idx] = isEnabled;
    });
}

/**
 * Toggle MC mode for a specific unit
 * @param {Object} instance - Template instance with editor
 * @param {number} unitIndex - Index of the unit to toggle
 */
function toggleUnitMC(instance: any, unitIndex: any) {
    // Get the unit's editor instance
    const unitEditor = instance.editor.getEditor(`root.unit.${unitIndex}`);
    if (!unitEditor) return;

    // Get current value
    const unit = unitEditor.getValue();
    const newButtonTrial = unit.buttontrial === 'true' ? 'false' : 'true';

    // Add properties if they don't exist (enables them in json-editor)
    if (typeof unitEditor.addObjectProperty === 'function') {
        if (!Object.prototype.hasOwnProperty.call(unit, 'buttontrial')) {
            unitEditor.addObjectProperty('buttontrial');
        }
        if (!Object.prototype.hasOwnProperty.call(unit, 'buttonorder') && newButtonTrial === 'true') {
            unitEditor.addObjectProperty('buttonorder');
        }
    }

    // Set values using sub-editors
    const buttonTrialEditor = instance.editor.getEditor(`root.unit.${unitIndex}.buttontrial`);
    if (buttonTrialEditor) {
        buttonTrialEditor.setValue(newButtonTrial);
    }

    if (newButtonTrial === 'true') {
        const buttonOrderEditor = instance.editor.getEditor(`root.unit.${unitIndex}.buttonorder`);
        if (buttonOrderEditor) {
            buttonOrderEditor.setValue('random');
        }
    }

    // Mark as changed
    instance.hasChanges.set(true);

    // Re-inject buttons after editor updates
    setTimeout(() => injectMCButtons(instance), 100);
}




