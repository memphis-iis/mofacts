import './learnerTdfSettings.html';
import './learnerTdfSettings.css';
import './adminUi/adminUi';
import { ReactiveVar } from 'meteor/reactive-var';
import { Template } from 'meteor/templating';
import { Meteor } from 'meteor/meteor';
import { Session } from 'meteor/session';
import { meteorCallAsync } from '../../lib/meteorAsync';
import { clientConsole } from '../../lib/clientLogger';
import { getActiveUiLocale } from '../../lib/interfaceLocaleState';
import { translatePlatformString } from '../../lib/interfaceI18n';
import { getLearnerTdfConfig, setLocalLearnerTdfConfig, loadLearnerTdfConfig } from '../../lib/learnerSettings';
import type { CourseAssignmentHistoryContext } from '../../../common/courseAssignments.contracts';
import {
  LEARNER_TDF_FIELD_DEFINITIONS,
  applyLearnerTdfConfig,
  learnerTdfFieldAppliesToUnit,
  unitHasConfigurableRuntime,
  type LearnerTdfConfig
} from '../../../common/lib/learnerTdfConfig';

declare const $: JQueryStatic;
function dashboardText(key: Parameters<typeof translatePlatformString>[1]): string {
  return translatePlatformString(getActiveUiLocale(), key);
}
export type LearnerConfigState = {
  tdfId: string | null;
  courseAssignment?: CourseAssignmentHistoryContext | null;
  canResetProgress?: boolean;
  loading: boolean;
  error: string | null;
  step: 'scope' | 'settings';
  content: any | null;
  scope: 'setspec' | 'unit' | null;
  unitIndex: number | null;
  family: 'deliverySettings' | null;
  saving: boolean;
  closing: boolean;
  dirty: boolean;
  resetConfirming: boolean;
  resettingProgress: boolean;
  resultMessage: string | null;
};

const EMPTY_CONFIG_STATE: LearnerConfigState = {
  tdfId: null,
  loading: false,
  error: null,
  step: 'scope',
  content: null,
  scope: null,
  unitIndex: null,
  family: null,
  saving: false,
  closing: false,
  dirty: false,
  resetConfirming: false,
  resettingProgress: false,
  resultMessage: null,
};

const LEARNER_CONFIG_CLOSE_FALLBACK_MS = 200;
const LEARNER_CONFIG_AUTOSAVE_DELAY_MS = 500;
const LEARNER_CONFIG_SLIDER_DISPLAY_SESSION_KEY = 'learnerConfigSliderDisplayValues';
function parseCssDurationMs(rawValue: string | null | undefined) {
  const value = String(rawValue || '').trim();
  if (!value) {
    return LEARNER_CONFIG_CLOSE_FALLBACK_MS;
  }
  if (value.endsWith('ms')) {
    const ms = Number(value.slice(0, -2));
    return Number.isFinite(ms) ? ms : LEARNER_CONFIG_CLOSE_FALLBACK_MS;
  }
  if (value.endsWith('s')) {
    const seconds = Number(value.slice(0, -1));
    return Number.isFinite(seconds) ? seconds * 1000 : LEARNER_CONFIG_CLOSE_FALLBACK_MS;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : LEARNER_CONFIG_CLOSE_FALLBACK_MS;
}

function getLearnerConfigCloseDurationMs() {
  if (typeof window === 'undefined') {
    return LEARNER_CONFIG_CLOSE_FALLBACK_MS;
  }
  const transition = window.getComputedStyle(document.documentElement).getPropertyValue('--app-transition-smooth');
  return parseCssDurationMs(transition) + 20;
}

function clearLearnerConfigCloseTimer(instance: any) {
  if (instance.learnerConfigCloseTimer) {
    clearTimeout(instance.learnerConfigCloseTimer);
    instance.learnerConfigCloseTimer = null;
  }
}

function clearLearnerConfigAutosaveTimer(instance: any) {
  if (instance.learnerConfigAutosaveTimer) {
    clearTimeout(instance.learnerConfigAutosaveTimer);
    instance.learnerConfigAutosaveTimer = null;
  }
}

async function saveLearnerConfigPatch(
  instance: any,
  tdfId: string,
  patch: any,
  saveRevision: number
) {
  const current = instance.learnerConfigState.get() as LearnerConfigState;
  if (current.tdfId === tdfId) {
    instance.learnerConfigState.set({ ...current, saving: true, error: null });
  }

  try {
    const result = await meteorCallAsync('saveLearnerTdfConfig', tdfId, patch, { courseAssignment: current.courseAssignment }) as { config?: LearnerTdfConfig | null };
    setLocalLearnerTdfConfig(tdfId, result?.config || null);
    const latest = instance.learnerConfigState.get() as LearnerConfigState;
    if (latest.tdfId === tdfId && instance.learnerConfigSaveRevision === saveRevision) {
      instance.learnerConfigState.set({ ...latest, saving: false, dirty: false, error: null });
    }
  } catch (error: any) {
    clientConsole(1, '[Learner Settings] Failed to autosave learner TDF config:', error);
    const latest = instance.learnerConfigState.get() as LearnerConfigState;
    if (latest.tdfId === tdfId) {
      instance.learnerConfigState.set({
        ...latest,
        saving: false,
        dirty: true,
        error: error?.reason || error?.message || 'Unable to save settings.'
      });
    }
    throw error;
  } finally {
    if (instance.learnerConfigPendingSave?.saveRevision === saveRevision) {
      instance.learnerConfigPendingSave = null;
    }
  }
}

function closeLearnerConfigPanel(instance: any) {
  const current = instance.learnerConfigState.get() as LearnerConfigState;
  if (!current.tdfId) {
    instance.learnerConfigState.set(EMPTY_CONFIG_STATE);
    return;
  }
  if (current.closing) {
    return;
  }

  clearLearnerConfigCloseTimer(instance);
  instance.learnerConfigState.set({ ...current, closing: true });
  instance.learnerConfigCloseTimer = setTimeout(() => {
    clearLearnerConfigSliderDisplayValues(current.tdfId);
    instance.learnerConfigState.set(EMPTY_CONFIG_STATE);
    instance.learnerConfigCloseTimer = null;
  }, getLearnerConfigCloseDurationMs());
}

function markLearnerConfigDirty(instance: any) {
  const current = instance.learnerConfigState.get() as LearnerConfigState;
  if (!current.tdfId || current.closing) {
    return;
  }
  if (!current.dirty) {
    instance.learnerConfigState.set({ ...current, dirty: true });
  }
}

function scheduleLearnerConfigAutosave(instance: any, form: JQuery<HTMLElement>) {
  const current = instance.learnerConfigState.get() as LearnerConfigState;
  if (!current.tdfId || current.closing || current.step !== 'settings') {
    return;
  }

  const tdfId = current.tdfId;
  const patch = buildConfigPatchFromForm(form, current);
  const saveRevision = (instance.learnerConfigSaveRevision || 0) + 1;
  instance.learnerConfigSaveRevision = saveRevision;
  instance.learnerConfigPendingSave = {
    tdfId,
    patch,
    saveRevision,
  };
  markLearnerConfigDirty(instance);
  clearLearnerConfigAutosaveTimer(instance);

  instance.learnerConfigAutosaveTimer = setTimeout(async () => {
    instance.learnerConfigAutosaveTimer = null;
    try {
      instance.learnerConfigSavePromise = saveLearnerConfigPatch(
        instance,
        tdfId,
        patch,
        saveRevision
      ).finally(() => {
        instance.learnerConfigSavePromise = null;
      });
      await instance.learnerConfigSavePromise;
    } catch {
      // Error state is set by saveLearnerConfigPatch.
    }
  }, LEARNER_CONFIG_AUTOSAVE_DELAY_MS);
}

function getConfigurableContent(state: LearnerConfigState) {
  return state.content ? applyLearnerTdfConfig(state.content, getLearnerTdfConfig(String(state.tdfId))).tdf : null;
}

function getTutorUnits(content: any) {
  const units = content?.tdfs?.tutor?.unit;
  return Array.isArray(units) ? units : [];
}

function unitHasLearnerConfigurableFields(unit: any) {
  return LEARNER_TDF_FIELD_DEFINITIONS.some((field) => {
    if (field.scope === 'setspec') {
      return false;
    }
    return learnerTdfFieldAppliesToUnit(field, unit);
  });
}

function getConfigurableRuntimeUnitIndexes(content: any) {
  return getTutorUnits(content)
    .map((unit: any, index: number) => unitHasConfigurableRuntime(unit) ? index : -1)
    .filter((index: number) => index >= 0);
}

function getLearnerConfigurableUnitIndexes(content: any) {
  return getTutorUnits(content)
    .map((unit: any, index: number) => unitHasLearnerConfigurableFields(unit) ? index : -1)
    .filter((index: number) => index >= 0);
}

function tdfHasConfigurableRuntime(content: any) {
  return getConfigurableRuntimeUnitIndexes(content).length > 0;
}

function tdfHasLearnerConfigurableFields(content: any) {
  return getLearnerConfigurableUnitIndexes(content).length > 0;
}

function getPrimaryConfigurableUnitIndex(state: LearnerConfigState) {
  return getLearnerConfigurableUnitIndexes(state.content)[0] ?? null;
}

function getLearnerConfigurableFieldsForState(state: LearnerConfigState) {
  const primaryConfigurableUnitIndex = getPrimaryConfigurableUnitIndex(state);
  const primaryConfigurableUnit = primaryConfigurableUnitIndex === null
    ? null
    : getTutorUnits(state.content)[primaryConfigurableUnitIndex];

  return LEARNER_TDF_FIELD_DEFINITIONS.filter((field) => {
    if (field.scope === 'setspec') {
      return true;
    }
    return Boolean(primaryConfigurableUnit) && learnerTdfFieldAppliesToUnit(field, primaryConfigurableUnit);
  });
}

function getPathValue(source: any, path: string, unitIndex: number | null = null) {
  const tutor = source?.tdfs?.tutor;
  if (path.startsWith('setspec.')) {
    return path.split('.').slice(1).reduce((acc, part) => acc?.[part], tutor?.setspec);
  }
  if (path.startsWith('deliverySettings.')) {
    return path.split('.').slice(1).reduce((acc, part) => acc?.[part], tutor?.deliverySettings);
  }
  if (path.startsWith('unit[].') && unitIndex !== null) {
    const key = path.startsWith('unit[].deliverySettings.') ? path.split('.').pop() : null;
    const unitValue = path.split('.').slice(1).reduce((acc, part) => acc?.[part], tutor?.unit?.[unitIndex]);
    if (unitValue !== undefined || !key) {
      return unitValue;
    }
    return tutor?.deliverySettings?.[key];
  }
  return undefined;
}

function getDefaultForField(field: any, state: LearnerConfigState) {
  const unitIndex = field.scope === 'unit' ? getPrimaryConfigurableUnitIndex(state) : null;
  return getPathValue(state.content, field.tdfPath, unitIndex) ?? field.defaultValue;
}

function getEffectiveForField(field: any, state: LearnerConfigState) {
  const unitIndex = field.scope === 'unit' ? getPrimaryConfigurableUnitIndex(state) : null;
  return getPathValue(getConfigurableContent(state), field.tdfPath, unitIndex) ?? field.defaultValue;
}

function isFieldCustomized(field: any, state: LearnerConfigState) {
  return getEffectiveForField(field, state) !== getDefaultForField(field, state);
}

function getFieldDisplayScale(field: any) {
  const scale = Number(field.displayScale);
  return Number.isFinite(scale) && scale > 0 ? scale : 1;
}

function toFieldInputValue(field: any, value: unknown) {
  const numeric = Number(value);
  if (Number.isFinite(numeric) && getFieldDisplayScale(field) !== 1) {
    return Math.round(numeric * getFieldDisplayScale(field) * 1000) / 1000;
  }
  return value;
}

function fromFieldInputValue(field: any, value: unknown) {
  const numeric = Number(value);
  if (Number.isFinite(numeric) && getFieldDisplayScale(field) !== 1) {
    return Math.round((numeric / getFieldDisplayScale(field)) * 1000) / 1000;
  }
  return numeric;
}

function appendValueSuffix(value: unknown, suffix: string) {
  return suffix === '%' ? `${value}%` : `${value}${suffix ? ` ${suffix}` : ''}`;
}

function getLearnerConfigSliderDisplayKey(tdfId: string | null | undefined, fieldId: string) {
  return `${tdfId || ''}:${fieldId}`;
}

function getLearnerConfigSliderDisplayValues(): Record<string, string> {
  const values = Session.get(LEARNER_CONFIG_SLIDER_DISPLAY_SESSION_KEY);
  return values && typeof values === 'object' ? values : {};
}

function setLearnerConfigSliderDisplayValue(tdfId: string | null | undefined, fieldId: string, displayValue: string) {
  if (!tdfId || !fieldId) {
    return;
  }
  Session.set(LEARNER_CONFIG_SLIDER_DISPLAY_SESSION_KEY, {
    ...getLearnerConfigSliderDisplayValues(),
    [getLearnerConfigSliderDisplayKey(tdfId, fieldId)]: displayValue,
  });
}

function clearLearnerConfigSliderDisplayValues(tdfId: string | null | undefined) {
  if (!tdfId) {
    return;
  }
  const nextValues = { ...getLearnerConfigSliderDisplayValues() };
  const prefix = `${tdfId}:`;
  for (const key of Object.keys(nextValues)) {
    if (key.startsWith(prefix)) {
      delete nextValues[key];
    }
  }
  Session.set(LEARNER_CONFIG_SLIDER_DISPLAY_SESSION_KEY, nextValues);
}

function formatFieldDisplayValue(field: any, value: unknown) {
  const suffix = field.displaySuffix || field.unit || '';
  const inputValue = toFieldInputValue(field, value);
  return appendValueSuffix(inputValue, suffix);
}

function buildConfigPatchFromForm(container: JQuery<HTMLElement>, state: LearnerConfigState) {
  const patch: any = { setspec: {}, unit: {} };
  const configurableUnitIndexes = getLearnerConfigurableUnitIndexes(state.content);
  const fields = getSettingFields(state);

  for (const field of fields) {
    const input = container.find(`[data-config-field="${field.id}"]`);
    if (!input.length) continue;

    let value: string | number | boolean;
    if (field.control === 'toggle') {
      value = Boolean((input.get(0) as HTMLInputElement).checked);
    } else if (field.control === 'slider') {
      value = fromFieldInputValue(field, input.val()) as number;
    } else if (field.control === 'number' || field.id === 'setspec.audioInputSensitivity') {
      value = Number(input.val());
    } else {
      value = String(input.val());
    }

    if (field.id === 'setspec.audioPromptMode') {
      patch.setspec.audioPromptMode = value;
    } else if (field.id === 'setspec.audioInputEnabled') {
      patch.setspec.audioInputEnabled = value;
    } else if (field.id === 'setspec.audioInputSensitivity') {
      patch.setspec.audioInputSensitivity = value;
    } else if (field.tdfPath.startsWith('deliverySettings.')) {
      const key = field.tdfPath.split('.').pop();
      if (key) {
        for (const index of configurableUnitIndexes) {
          const unitIndex = String(index);
          patch.unit[unitIndex] ||= { deliverySettings: {} };
          patch.unit[unitIndex].deliverySettings[key] = value;
        }
      }
    } else if (field.tdfPath.startsWith('unit[].deliverySettings.')) {
      const key = field.tdfPath.split('.').pop();
      if (key) {
        for (const index of configurableUnitIndexes) {
          const unitIndex = String(index);
          patch.unit[unitIndex] ||= { deliverySettings: {} };
          patch.unit[unitIndex].deliverySettings[key] = value;
        }
      }
    }
  }

  return patch;
}

function getSettingFields(state: LearnerConfigState) {
  if (!tdfHasLearnerConfigurableFields(state.content)) {
    return [];
  }
  return getLearnerConfigurableFieldsForState(state);
}

Template.learnerTdfConfigPanel.helpers({
  learnerConfigPanelClass() {
    return this.closing ? 'learner-config-panel is-closing' : 'learner-config-panel';
  },

  learnerConfigSaveStatus() {
    if (this.saving) return dashboardText('dashboard.saving');
    if (this.dirty) return dashboardText('dashboard.waitingToSave');
    return dashboardText('dashboard.changesSaveAutomatically');
  },

  isConfigStep(step: string) {
    return this.step === step;
  },

  selectedConfigLabel() {
    return dashboardText('dashboard.lessonSettings');
  },

  settingFields() {
    const sliderDisplayValues = getLearnerConfigSliderDisplayValues();
    return getSettingFields(this as LearnerConfigState).slice().sort((left, right) =>
      left.label.localeCompare(right.label, undefined, {
        numeric: true,
        sensitivity: 'base',
      })
    ).map((field) => {
      const effectiveValue = getEffectiveForField(field, this as LearnerConfigState);
      const defaultValue = getDefaultForField(field, this as LearnerConfigState);
      const value = field.control === 'select'
        ? String(effectiveValue)
        : field.control === 'slider'
          ? toFieldInputValue(field, effectiveValue)
          : effectiveValue;
      const defaultInputValue = field.control === 'select'
        ? String(defaultValue)
        : field.control === 'slider'
          ? toFieldInputValue(field, defaultValue)
          : defaultValue;
      const displayValue = field.control === 'slider'
        ? sliderDisplayValues[getLearnerConfigSliderDisplayKey(this.tdfId, field.id)]
          || formatFieldDisplayValue(field, effectiveValue)
        : field.unit
          ? `${value} ${field.unit}`
          : String(value);
      const displaySuffix = field.displaySuffix || field.unit;
      const displayScale = getFieldDisplayScale(field);
      return {
        ...field,
        value,
        defaultInputValue,
        displayValue,
        displaySuffix,
        checked: Boolean(value),
        options: field.options?.map((option) => ({
          ...option,
          selected: option.value === String(value)
        })),
        customized: isFieldCustomized(field, this as LearnerConfigState),
        inputMax: field.max === undefined ? undefined : toFieldInputValue(field, field.max),
        inputMin: field.min === undefined ? undefined : toFieldInputValue(field, field.min),
        inputStep: field.step === undefined ? undefined : toFieldInputValue(field, field.step),
        displayScale,
        isToggle: field.control === 'toggle',
        isSelect: field.control === 'select',
        isSlider: field.control === 'slider',
        isNumber: field.control === 'number',
        isText: field.control === 'text'
      };
    });
  },

  hasSettingFields() {
    return getSettingFields(this as LearnerConfigState).length > 0;
  },

  canResetOwnProgress() {
    return Boolean(Meteor.userId()) && this.canResetProgress === true;
  },

  resetProgressButtonLabel() {
    if (this.resettingProgress) return dashboardText('dashboard.resetting');
    return this.resetConfirming ? dashboardText('dashboard.confirmReset') : dashboardText('dashboard.resetTestProgress');
  },
});

export function initializeLearnerSettingsHost(instance: any, options: {
  courseContext?: (row: any) => CourseAssignmentHistoryContext | null;
  onProgressReset?: (tdfIds: string[]) => void | Promise<void>;
} = {}) {
  instance.learnerConfigCloseTimer = null;
  instance.learnerConfigAutosaveTimer = null;
  instance.learnerConfigSaveRevision = 0;
  instance.learnerConfigState = new ReactiveVar(EMPTY_CONFIG_STATE);
  instance.settingsCourseContext = options.courseContext || (() => null);
  instance.settingsProgressReset = options.onProgressReset;
}

export function destroyLearnerSettingsHost(instance: any) {
  clearLearnerConfigCloseTimer(instance);
  clearLearnerConfigAutosaveTimer(instance);
}

export async function flushLearnerSettings(instance: any): Promise<void> {
  clearLearnerConfigAutosaveTimer(instance);
  if (instance.learnerConfigSavePromise) await instance.learnerConfigSavePromise;
  const pending = instance.learnerConfigPendingSave;
  if (pending) await saveLearnerConfigPatch(instance, pending.tdfId, pending.patch, pending.saveRevision);
  if (instance.learnerConfigState.get().dirty) throw new Error('Save lesson settings before starting practice.');
}

export const learnerSettingsEvents = {
  'click .configure-lesson': async function(event: any, instance: any) {
    event.preventDefault();
    const target = $(event.currentTarget);
    const tdfId = String(target.data('tdfid') || '');
    const courseAssignment = instance.settingsCourseContext(this);
    const existingState = instance.learnerConfigState.get() as LearnerConfigState;
    try { await flushLearnerSettings(instance); } catch { return; }
    if (existingState.tdfId === tdfId
      && existingState.courseAssignment?.assignmentId === courseAssignment?.assignmentId) {
      closeLearnerConfigPanel(instance);
      return;
    }

    clearLearnerConfigSliderDisplayValues(existingState.tdfId);
    clearLearnerConfigCloseTimer(instance);
    instance.learnerConfigState.set({
      ...EMPTY_CONFIG_STATE,
      tdfId,
      courseAssignment,
      loading: true
    });

    try {
      const [tdfDoc] = await Promise.all([
        meteorCallAsync('getTdfById', tdfId, { courseAssignment }) as Promise<any>,
        loadLearnerTdfConfig(tdfId),
      ]);
      if (instance.learnerConfigState.get().tdfId !== tdfId) return;
      const content = tdfDoc?.content;
      if (!Array.isArray(content?.tdfs?.tutor?.unit)) {
        instance.learnerConfigState.set({
          ...EMPTY_CONFIG_STATE,
          tdfId,
          courseAssignment,
          error: dashboardText('dashboard.chooseConcreteCondition')
        });
        return;
      }
      if (!tdfHasConfigurableRuntime(content)) {
        instance.learnerConfigState.set({
          ...EMPTY_CONFIG_STATE,
          tdfId,
          courseAssignment,
          error: dashboardText('dashboard.settingsNeedConfigurableUnits')
        });
        return;
      }
      instance.learnerConfigState.set({
        ...EMPTY_CONFIG_STATE,
        tdfId,
        content,
        courseAssignment,
        canResetProgress: Boolean(instance.settingsProgressReset),
        step: 'settings',
        scope: 'setspec',
        family: 'deliverySettings'
      });
    } catch (error) {
      if (instance.learnerConfigState.get().tdfId !== tdfId) return;
      clientConsole(1, '[Learner Settings] Failed to load full TDF:', error);
      instance.learnerConfigState.set({
        ...EMPTY_CONFIG_STATE,
        tdfId,
        courseAssignment,
        error: dashboardText('dashboard.unableToLoadSettings')
      });
    }
  },

  'click .learner-config-reset-field': function(event: any, instance: any) {
    const button = $(event.currentTarget);
    const fieldId = button.data('fieldid');
    const container = button.closest('.learner-config-panel');
    const input = container.find(`[data-config-field="${fieldId}"]`);
    if (!input.length) return;
    const defaultValue = button.data('defaultvalue');
    if ((input.get(0) as HTMLInputElement).type === 'checkbox') {
      (input.get(0) as HTMLInputElement).checked = defaultValue === true || defaultValue === 'true';
    } else {
      input.val(defaultValue);
    }
    const valueTarget = container.find(`[data-config-value-for="${fieldId}"]`);
    if (valueTarget.length) {
      const suffix = input.data('value-suffix') || '';
      const state = instance.learnerConfigState.get() as LearnerConfigState;
      setLearnerConfigSliderDisplayValue(state.tdfId, fieldId, appendValueSuffix(input.val(), suffix));
    }
    scheduleLearnerConfigAutosave(instance, button.closest('.learner-config-form'));
  },

  'change [data-config-field]': function(_event: any, instance: any) {
    if ($(_event.currentTarget).hasClass('learner-config-slider')) {
      return;
    }
    scheduleLearnerConfigAutosave(instance, $(_event.currentTarget).closest('.learner-config-form'));
  },

  'input [data-config-field]': function(_event: any, instance: any) {
    if ($(_event.currentTarget).hasClass('learner-config-slider')) {
      return;
    }
    scheduleLearnerConfigAutosave(instance, $(_event.currentTarget).closest('.learner-config-form'));
  },

  'input .learner-config-slider': function(event: any, instance: any) {
    const input = $(event.currentTarget);
    const fieldId = input.data('config-field');
    const suffix = input.data('value-suffix') || '';
    const state = instance.learnerConfigState.get() as LearnerConfigState;
    setLearnerConfigSliderDisplayValue(state.tdfId, fieldId, appendValueSuffix(input.val(), suffix));
    scheduleLearnerConfigAutosave(instance, input.closest('.learner-config-form'));
  },

  'click .learner-config-reset-progress': async function(event: any, instance: any) {
    event.preventDefault();
    const current = instance.learnerConfigState.get() as LearnerConfigState;
    if (!current.tdfId || current.resettingProgress) {
      return;
    }

    if (!current.resetConfirming) {
      instance.learnerConfigState.set({ ...current, resetConfirming: true, error: null });
      return;
    }

    instance.learnerConfigState.set({ ...current, resettingProgress: true, error: null });
    try {
      const result = await meteorCallAsync('resetOwnLessonProgress', current.tdfId) as {
        cacheTdfIds?: string[];
      };
      if (!Array.isArray(result?.cacheTdfIds) || result.cacheTdfIds.length === 0) {
        throw new Error('Reset completed without a practice refresh scope');
      }
      await instance.settingsProgressReset(result.cacheTdfIds);
      closeLearnerConfigPanel(instance);
    } catch (error: any) {
      clientConsole(1, '[Dashboard Config] Failed to reset admin lesson progress:', error);
      const latest = instance.learnerConfigState.get() as LearnerConfigState;
      instance.learnerConfigState.set({
        ...latest,
        resetConfirming: false,
        resettingProgress: false,
        error: error?.reason || error?.message || dashboardText('dashboard.unableToResetProgress')
      });
    }
  },

  'click .learner-config-reset-progress-cancel': function(event: any, instance: any) {
    event.preventDefault();
    const current = instance.learnerConfigState.get() as LearnerConfigState;
    if (!current.tdfId || current.resettingProgress) {
      return;
    }
    instance.learnerConfigState.set({ ...current, resetConfirming: false });
  },

  'submit .learner-config-form': function(event: any) {
    event.preventDefault();
  },
};
