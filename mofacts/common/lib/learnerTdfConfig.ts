import {
  DELIVERY_SETTINGS_DEFAULTS,
  DELIVERY_SETTINGS_APPLICABILITY,
  DELIVERY_SETTINGS_FIELD_REGISTRY,
  DELIVERY_SETTINGS_LEARNER_CONFIGURABLE_KEYS,
  DELIVERY_DISPLAY_SETTINGS_APPLICABILITY,
  DELIVERY_DISPLAY_SETTINGS_RUNTIME_DEFAULTS,
  DELIVERY_DISPLAY_SETTINGS_LEARNER_CONFIGURABLE_KEYS,
  coerceAndValidateDeliveryDisplaySetting,
  createTdfSchemaFromRegistry,
  createTdfValidatorMap,
  normalizeDeliverySettingsSource,
  normalizeDeliverySettingValue as normalizeRegistryDeliverySettingValue
} from '../fieldRegistry';
import {
  detectTdfUnitType,
  unitTypeApplies,
  type TdfUnitType,
} from '../fieldApplicability';

type LearnerTdfScope = 'setspec' | 'unit';
type LearnerTdfFamily = 'deliverySettings';
type LearnerTdfControl = 'toggle' | 'select' | 'slider' | 'number' | 'text';
type JsonRecord = Record<string, unknown>;

export type LearnerTdfSourceMetadata = {
  tdfId?: string;
  tdfUpdatedAt?: string;
  unitCount: number;
  unitSignature: string[];
};

export type LearnerTdfOverrides = {
  setspec?: {
    audioPromptMode?: string;
    audioInputEnabled?: string;
    audioInputSensitivity?: number;
  };
  deliverySettings?: Record<string, unknown>;
  unit?: Record<string, {
    deliverySettings?: Record<string, unknown>;
  }>;
};

export type LearnerTdfConfig = {
  source?: LearnerTdfSourceMetadata;
  overrides?: LearnerTdfOverrides;
};

type LearnerTdfFieldDefinition = {
  id: LearnerTdfFieldId;
  scope: LearnerTdfScope;
  family: LearnerTdfFamily;
  label: string;
  tdfPath: string;
  control: LearnerTdfControl;
  defaultValue: string | number | boolean;
  options?: Array<{ value: string; label: string }>;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  displayScale?: number;
  displaySuffix?: string;
  lowerLabel?: string;
  upperLabel?: string;
  appliesToUnitTypes?: readonly TdfUnitType[];
};

type LearnerTdfFieldId = string;

type LearnerTdfValidationResult = {
  valid: boolean;
  errors: string[];
  staleUnitOverrides: boolean;
};

type LearnerTdfApplyResult<T> = {
  tdf: T;
  applied: boolean;
  warnings: string[];
};

const TDF_SCHEMA = createTdfSchemaFromRegistry();
const TDF_VALIDATORS = createTdfValidatorMap();

function schemaProperties(schema: unknown): Record<string, unknown> {
  return asRecord(asRecord(schema).properties);
}

function getTutorSchema(): JsonRecord {
  return asRecord(schemaProperties(TDF_SCHEMA).tutor);
}

function getSetSpecSchemaProperty(key: string): JsonRecord {
  return asRecord(schemaProperties(asRecord(schemaProperties(getTutorSchema()).setspec))[key]);
}

function getDeliverySettingsSchemaProperty(key: string): JsonRecord {
  const deliverySettings = asRecord(schemaProperties(getTutorSchema()).deliverySettings);
  return asRecord(schemaProperties(deliverySettings)[key]);
}

function getSchemaDefault(schema: JsonRecord, fallback: string | number | boolean): string | number | boolean {
  const value = schema.default;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  return fallback;
}

function humanizeKey(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (char) => char.toUpperCase());
}

function firstNumericValidator(path: string) {
  return TDF_VALIDATORS[path]?.validators.find((entry) => entry.type === 'range');
}

function schemaEnumValues(schema: JsonRecord): string[] {
  return Array.isArray(schema.enum) ? schema.enum.filter((value): value is string => typeof value === 'string') : [];
}

function schemaHasType(schema: JsonRecord, type: string): boolean {
  if (schema.type === type) return true;
  const anyOf = Array.isArray(schema.anyOf) ? schema.anyOf : [];
  return anyOf.some((entry) => asRecord(entry).type === type);
}

function fieldDefinitionFromSchema(args: {
  id: string;
  scope: LearnerTdfScope;
  family: LearnerTdfFamily;
  tdfPath: string;
  key: string;
  schema: JsonRecord;
  defaultValue: unknown;
  label?: string;
}): LearnerTdfFieldDefinition {
  const enumValues = schemaEnumValues(args.schema);
  const numericValidator = firstNumericValidator(args.tdfPath);
  const isBoolean = schemaHasType(args.schema, 'boolean');
  const isNumber = schemaHasType(args.schema, 'number') || schemaHasType(args.schema, 'integer');
  const defaultValue = typeof args.defaultValue === 'string' || typeof args.defaultValue === 'number' || typeof args.defaultValue === 'boolean'
    ? args.defaultValue
    : isBoolean
      ? false
      : isNumber
        ? 0
        : '';
  const label = args.label || (typeof args.schema.title === 'string' ? args.schema.title.trim() : '');
  if (!label) {
    throw new Error(`Missing learner-config schema title for ${args.tdfPath}`);
  }

  return {
    id: args.id,
    scope: args.scope,
    family: args.family,
    label,
    tdfPath: args.tdfPath,
    control: isBoolean ? 'toggle' : enumValues.length ? 'select' : isNumber ? 'number' : 'text',
    defaultValue,
    ...(enumValues.length ? { options: enumValues.map((value) => ({ value, label: humanizeKey(value) })) } : {}),
    ...(isNumber && typeof numericValidator?.min === 'number' ? { min: numericValidator.min } : {}),
    ...(isNumber && typeof numericValidator?.max === 'number' ? { max: numericValidator.max } : {}),
    ...(isNumber ? { step: schemaHasType(args.schema, 'integer') ? 1 : 0.1 } : {}),
    ...(Array.isArray(args.schema['x-appliesToUnitTypes'])
      ? { appliesToUnitTypes: args.schema['x-appliesToUnitTypes'] as readonly TdfUnitType[] }
      : {})
  };
}

function deliveryFieldDefinition(scope: LearnerTdfScope, key: string): LearnerTdfFieldDefinition | null {
  const registry = DELIVERY_SETTINGS_FIELD_REGISTRY[key];
  if (!registry) return null;
  const label = registry.tooltip.brief.trim();
  if (!label) {
    throw new Error(`Missing delivery-setting learner-config label for ${key}`);
  }
  const tdfPath = scope === 'unit' ? `unit[].deliverySettings.${key}` : `deliverySettings.${key}`;
  const enumValues = registry.authoring.enum || [];
  const isBoolean = registry.authoring.type === 'booleanString';
  const isNumber = registry.authoring.type === 'integer' || registry.authoring.type === 'number';
  const validator = firstNumericValidator(tdfPath);
  const validationMin = registry.validation.kind === 'nonNegativeInteger'
    ? 0
    : registry.validation.kind === 'range'
      ? registry.validation.min
      : validator?.min;
  const validationMax = registry.validation.kind === 'range'
    ? registry.validation.max
    : validator?.max;
  const defaultValue = DELIVERY_SETTINGS_DEFAULTS[key];
  const safeDefault = typeof defaultValue === 'string' || typeof defaultValue === 'number' || typeof defaultValue === 'boolean'
    ? defaultValue
    : isBoolean
      ? false
      : isNumber
        ? 0
        : '';

  return {
    id: tdfPath,
    scope,
    family: 'deliverySettings',
    label,
    tdfPath,
    control: isBoolean ? 'toggle' : enumValues.length ? 'select' : isNumber ? 'number' : 'text',
    defaultValue: safeDefault,
    ...(enumValues.length ? { options: enumValues.map((value) => ({ value, label: humanizeKey(value) })) } : {}),
    ...(isNumber && typeof validationMin === 'number' ? { min: validationMin } : {}),
    ...(isNumber && typeof validationMax === 'number' ? { max: validationMax } : {}),
    ...(isNumber ? { step: registry.authoring.type === 'integer' ? 1 : 0.1 } : {}),
    ...(DELIVERY_SETTINGS_APPLICABILITY[key] ? { appliesToUnitTypes: DELIVERY_SETTINGS_APPLICABILITY[key] } : {})
  };
}

function uiFieldDefinition(scope: LearnerTdfScope, key: string): LearnerTdfFieldDefinition {
  const schema = getDeliverySettingsSchemaProperty(key);
  const definition = fieldDefinitionFromSchema({
    id: `${scope === 'unit' ? 'unit[].' : ''}deliverySettings.${key}`,
    scope,
    family: 'deliverySettings',
    tdfPath: `${scope === 'unit' ? 'unit[].' : ''}deliverySettings.${key}`,
    key,
    schema,
    defaultValue: DELIVERY_DISPLAY_SETTINGS_RUNTIME_DEFAULTS[key]
  });
  const controlOverride = key === 'displayUserAnswerInFeedback'
    ? {
      control: 'select' as const,
      options: [
        { value: 'onIncorrect', label: 'Incorrect answers only' },
        { value: 'true', label: 'All answers' },
        { value: 'false', label: 'Never' },
        { value: 'onCorrect', label: 'Correct answers only' },
      ],
    }
    : {};
  return {
    ...definition,
    ...controlOverride,
    ...(DELIVERY_DISPLAY_SETTINGS_APPLICABILITY[key] ? { appliesToUnitTypes: DELIVERY_DISPLAY_SETTINGS_APPLICABILITY[key] } : {}),
  };
}

function getAudioPromptOptions() {
  const schema = getSetSpecSchemaProperty('audioPromptMode');
  const values = Array.isArray(schema.enum) ? schema.enum.filter((value): value is string => typeof value === 'string') : [];
  return (values.length ? values : ['silent', 'question', 'feedback', 'all']).map((value) => ({
    value,
    label: {
      silent: 'Silent',
      question: 'Question only',
      feedback: 'Feedback only',
      all: 'Question and feedback'
    }[value] || value
  }));
}

const LEARNER_TDF_UNIT_DELIVERY_SETTING_KEYS = Object.freeze([
  'optimalThreshold',
  'fontsize',
  'studyFirst',
  'drill',
  'reviewstudy',
] as const);

const LEARNER_TDF_UNIT_DISPLAY_SETTING_KEYS = Object.freeze([
  'displayTimeoutCountdown',
  'displayTimeoutBar',
  'displayPerformance',
  'stimuliPosition',
  'displayUserAnswerInFeedback',
] as const);

const LEARNING_UNIT_TYPES = Object.freeze(['learning'] as const);

function learningOnlyLearnerField(field: LearnerTdfFieldDefinition): LearnerTdfFieldDefinition {
  return {
    ...field,
    appliesToUnitTypes: LEARNING_UNIT_TYPES
  };
}

export const LEARNER_TDF_FIELD_DEFINITIONS: readonly LearnerTdfFieldDefinition[] = [
  {
    id: 'setspec.audioPromptMode',
    scope: 'setspec',
    family: 'deliverySettings',
    label: 'Spoken audio mode',
    tdfPath: 'setspec.audioPromptMode',
    control: 'select',
    defaultValue: getSchemaDefault(getSetSpecSchemaProperty('audioPromptMode'), 'silent'),
    options: getAudioPromptOptions()
  },
  {
    id: 'setspec.audioInputEnabled',
    scope: 'setspec',
    family: 'deliverySettings',
    label: 'Speech recognition mode',
    tdfPath: 'setspec.audioInputEnabled',
    control: 'select',
    defaultValue: getSchemaDefault(getSetSpecSchemaProperty('audioInputEnabled'), 'false'),
    options: [
      { value: 'false', label: 'Disabled' },
      { value: 'true', label: 'Enabled' },
    ]
  },
  ...LEARNER_TDF_UNIT_DISPLAY_SETTING_KEYS.map((key) => learningOnlyLearnerField(uiFieldDefinition('unit', key))),
  ...LEARNER_TDF_UNIT_DELIVERY_SETTING_KEYS
    .map((key) => deliveryFieldDefinition('unit', key))
    .map((field) => field?.id === 'unit[].deliverySettings.optimalThreshold'
      ? {
        ...field,
        label: 'Optimal threshold',
        control: 'slider' as const,
        min: 0.7,
        max: 0.9,
        step: 0.01,
        defaultValue: 0.8,
        displayScale: 100,
        displaySuffix: '%',
        lowerLabel: 'More new items',
        upperLabel: 'Mastery first',
      }
      : field)
    .filter((field): field is LearnerTdfFieldDefinition => Boolean(field))
    .map((field) => learningOnlyLearnerField(field))
];

const AUDIO_PROMPT_MODES = new Set(['silent', 'question', 'feedback', 'all']);
const SPEECH_RECOGNITION_MODES = new Set(['false', 'true']);

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function asRecord(value: unknown): JsonRecord {
  return isRecord(value) ? value : {};
}

function getTutorRoot(tdf: unknown): JsonRecord {
  const record = asRecord(tdf);
  const nestedTutor = asRecord(asRecord(asRecord(record.tdfs).tutor));
  if (Object.keys(nestedTutor).length > 0) {
    return nestedTutor;
  }
  return record;
}

function getUnitArray(tdf: unknown): JsonRecord[] {
  const units = getTutorRoot(tdf).unit;
  return Array.isArray(units) ? units.filter(isRecord) : [];
}

export function learnerTdfFieldAppliesToUnit(
  field: Pick<LearnerTdfFieldDefinition, 'appliesToUnitTypes'>,
  unit: unknown
): boolean {
  return unitTypeApplies(field.appliesToUnitTypes, detectTdfUnitType(unit));
}

function learnerConfigurableKeyAppliesToUnit(
  family: LearnerTdfFamily,
  key: string,
  unit: unknown
): boolean {
  const unitType = detectTdfUnitType(unit);
  const applicability = DELIVERY_SETTINGS_LEARNER_CONFIGURABLE_KEYS.includes(key)
    ? DELIVERY_SETTINGS_APPLICABILITY[key]
    : DELIVERY_DISPLAY_SETTINGS_APPLICABILITY[key];
  return unitTypeApplies(applicability, unitType);
}

function learnerUnitOverrideKeyAppliesToUnit(
  family: LearnerTdfFamily,
  key: string,
  unit: unknown
): boolean {
  const tdfPath = family === 'deliverySettings'
    ? `unit[].deliverySettings.${key}`
    : '';
  const definition = LEARNER_TDF_FIELD_DEFINITIONS.find((field) => field.tdfPath === tdfPath);
  if (!definition) {
    return learnerConfigurableKeyAppliesToUnit(family, key, unit);
  }
  return learnerTdfFieldAppliesToUnit(definition, unit);
}

function getTdfUpdatedAt(tdf: unknown): string | undefined {
  const record = asRecord(tdf);
  const candidates = [
    record.updatedAt,
    record.lastUpdated,
    asRecord(record.content).updatedAt,
    asRecord(record.content).lastUpdated
  ];

  for (const candidate of candidates) {
    if (candidate instanceof Date) {
      return candidate.toISOString();
    }
    if (typeof candidate === 'string' && candidate.trim()) {
      const date = new Date(candidate);
      return Number.isNaN(date.getTime()) ? candidate : date.toISOString();
    }
  }

  return undefined;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  if (isRecord(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function unitSignatureEntry(unit: JsonRecord): string {
  const deliverySettings = asRecord(unit.deliverySettings);
  const normalizedDeliverySettings = normalizeDeliverySettingsSource(deliverySettings);
  const allowedDeliverySettings: Record<string, unknown> = {};
  for (const key of DELIVERY_SETTINGS_LEARNER_CONFIGURABLE_KEYS) {
    if (normalizedDeliverySettings[key] !== undefined) {
      allowedDeliverySettings[key] = normalizedDeliverySettings[key];
    }
  }
  for (const key of DELIVERY_DISPLAY_SETTINGS_LEARNER_CONFIGURABLE_KEYS) {
    if (deliverySettings[key] !== undefined) {
      allowedDeliverySettings[key] = deliverySettings[key];
    }
  }

  return stableStringify({
    unitname: unit.unitname ?? unit.name ?? '',
    deliverySettings: allowedDeliverySettings
  });
}

function pruneUnitOverridesToCurrentTdf(
  tdf: unknown,
  unitOverrides: LearnerTdfOverrides['unit'] | undefined
): LearnerTdfOverrides['unit'] | undefined {
  if (!unitOverrides) return undefined;

  const units = getUnitArray(tdf);
  const applicable: NonNullable<LearnerTdfOverrides['unit']> = {};
  for (const [unitIndex, unitConfig] of Object.entries(unitOverrides)) {
    const index = Number(unitIndex);
    const unit = units[index];
    if (!Number.isInteger(index) || index < 0 || index >= units.length || !unit) {
      continue;
    }

    const deliverySettings = asRecord(unitConfig.deliverySettings);
    const applicableDeliverySettings: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(deliverySettings)) {
      if (learnerUnitOverrideKeyAppliesToUnit('deliverySettings', key, unit)) {
        applicableDeliverySettings[key] = value;
      }
    }

    if (Object.keys(applicableDeliverySettings).length) {
      applicable[unitIndex] = { deliverySettings: applicableDeliverySettings };
    }
  }

  return Object.keys(applicable).length ? applicable : undefined;
}

function normalizeDeliveryDisplaySettingValue(path: string, value: unknown, errors: string[]): unknown {
  const fieldName = path.split('.').pop() || '';
  const result = coerceAndValidateDeliveryDisplaySetting(fieldName, value);
  if (!result.valid) {
    errors.push(`${path} is not a valid delivery setting value`);
    return undefined;
  }
  return result.value;
}

function normalizeAudioPromptMode(value: unknown, path: string, errors: string[]): string | undefined {
  if (typeof value !== 'string' || !AUDIO_PROMPT_MODES.has(value)) {
    errors.push(`${path} must be one of silent, question, feedback, all`);
    return undefined;
  }
  return value;
}

function normalizeSpeechRecognitionMode(value: unknown, path: string, errors: string[]): string | undefined {
  const normalized = typeof value === 'boolean' ? String(value) : String(value ?? '').trim().toLowerCase();
  if (!SPEECH_RECOGNITION_MODES.has(normalized)) {
    errors.push(`${path} must be enabled or disabled`);
    return undefined;
  }
  return normalized;
}

function getBaseSetSpecValue(tdf: unknown, key: string): unknown {
  const setspec = asRecord(getTutorRoot(tdf).setspec);
  if (key === 'setspec.audioPromptMode') {
    return typeof setspec.audioPromptMode === 'string' ? setspec.audioPromptMode : 'silent';
  }
  if (key === 'setspec.audioInputEnabled') {
    return setspec.audioInputEnabled === 'true' || setspec.audioInputEnabled === true ? 'true' : 'false';
  }
  if (key === 'setspec.audioInputSensitivity') {
    const value = Number(setspec.audioInputSensitivity);
    return Number.isFinite(value) ? value : 60;
  }
  return undefined;
}

function normalizeDeliverySettingValue(key: string, value: unknown, errors?: string[], path?: string): unknown {
  if (DELIVERY_SETTINGS_LEARNER_CONFIGURABLE_KEYS.includes(key)) {
    const normalizedValue = normalizeRegistryDeliverySettingValue(key, value);
    if (key === 'optimalThreshold') {
      const threshold = Number(normalizedValue);
      if (!Number.isFinite(threshold) || threshold < 0.7 || threshold > 0.9) {
        errors?.push(`${path || 'deliverySettings.optimalThreshold'} must be between 70% and 90%`);
        return undefined;
      }
    }
    return normalizedValue;
  }
  if (DELIVERY_DISPLAY_SETTINGS_LEARNER_CONFIGURABLE_KEYS.includes(key)) {
    return normalizeDeliveryDisplaySettingValue(path || `deliverySettings.${key}`, value, errors || []);
  }
  return value;
}

function getDefaultDeliverySettingValue(key: string): unknown {
  if (DELIVERY_SETTINGS_LEARNER_CONFIGURABLE_KEYS.includes(key)) {
    return DELIVERY_SETTINGS_DEFAULTS[key];
  }
  if (DELIVERY_DISPLAY_SETTINGS_LEARNER_CONFIGURABLE_KEYS.includes(key)) {
    return DELIVERY_DISPLAY_SETTINGS_RUNTIME_DEFAULTS[key];
  }
  return undefined;
}

function getBaseDeliverySettingsValue(source: JsonRecord | undefined, key: string): unknown {
  const sourceDeliverySettings = DELIVERY_SETTINGS_LEARNER_CONFIGURABLE_KEYS.includes(key)
    ? normalizeDeliverySettingsSource(asRecord(source?.deliverySettings))
    : asRecord(source?.deliverySettings);
  const value = sourceDeliverySettings[key];
  return value !== undefined ? normalizeDeliverySettingValue(key, value) : getDefaultDeliverySettingValue(key);
}

function getBaseTutorDeliverySettingsValue(tdf: unknown, key: string): unknown {
  return getBaseDeliverySettingsValue(getTutorRoot(tdf), key);
}

function hasDeliverySettingsValue(source: JsonRecord | undefined, key: string): boolean {
  const deliverySettings = asRecord(source?.deliverySettings);
  if (DELIVERY_SETTINGS_LEARNER_CONFIGURABLE_KEYS.includes(key)) {
    return normalizeDeliverySettingsSource(deliverySettings)[key] !== undefined;
  }
  return deliverySettings[key] !== undefined;
}

function getBaseUnitDeliverySettingsValue(tdf: unknown, unitIndex: string, key: string): unknown {
  const index = Number(unitIndex);
  const unit = getUnitArray(tdf)[index];
  return hasDeliverySettingsValue(unit, key)
    ? getBaseDeliverySettingsValue(unit, key)
    : getBaseTutorDeliverySettingsValue(tdf, key);
}

function pruneRecordByBase(
  values: Record<string, unknown> | undefined,
  getBaseValue: (key: string) => unknown
): Record<string, unknown> | undefined {
  if (!values) return undefined;
  const pruned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== getBaseValue(key)) {
      pruned[key] = value;
    }
  }
  return Object.keys(pruned).length ? pruned : undefined;
}

function setSpecOverridesEqualBase(tdf: unknown, overrides: Required<LearnerTdfOverrides>['setspec']): LearnerTdfOverrides['setspec'] {
  const pruned: LearnerTdfOverrides['setspec'] = {};

  if (overrides.audioPromptMode !== undefined && overrides.audioPromptMode !== getBaseSetSpecValue(tdf, 'setspec.audioPromptMode')) {
    pruned.audioPromptMode = overrides.audioPromptMode;
  }
  if (overrides.audioInputEnabled !== undefined && overrides.audioInputEnabled !== getBaseSetSpecValue(tdf, 'setspec.audioInputEnabled')) {
    pruned.audioInputEnabled = overrides.audioInputEnabled;
  }
  if (overrides.audioInputSensitivity !== undefined && overrides.audioInputSensitivity !== getBaseSetSpecValue(tdf, 'setspec.audioInputSensitivity')) {
    pruned.audioInputSensitivity = overrides.audioInputSensitivity;
  }
  return Object.keys(pruned).length ? pruned : undefined;
}

function pruneDeliverySettingsOverrides(tdf: unknown, deliverySettings: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  return pruneRecordByBase(deliverySettings, (key) => getBaseTutorDeliverySettingsValue(tdf, key));
}

function pruneUnitOverrides(tdf: unknown, unitOverrides: NonNullable<LearnerTdfOverrides['unit']>): LearnerTdfOverrides['unit'] | undefined {
  const prunedUnits: NonNullable<LearnerTdfOverrides['unit']> = {};

  for (const [unitIndex, unitConfig] of Object.entries(unitOverrides)) {
    const prunedDeliverySettings = pruneRecordByBase(
      unitConfig.deliverySettings,
      (key) => getBaseUnitDeliverySettingsValue(tdf, unitIndex, key)
    );
    if (prunedDeliverySettings) {
      prunedUnits[unitIndex] = { deliverySettings: prunedDeliverySettings };
    }
  }

  return Object.keys(prunedUnits).length ? prunedUnits : undefined;
}

function cloneWithTutor<T>(tdf: T, mutateTutor: (tutor: JsonRecord) => void): T {
  const root = asRecord(tdf);
  if (isRecord(root.tdfs) && isRecord(root.tdfs.tutor)) {
    const clonedTutor = { ...root.tdfs.tutor };
    const clonedTdfs = { ...root.tdfs, tutor: clonedTutor };
    const clonedRoot = { ...root, tdfs: clonedTdfs };
    mutateTutor(clonedTutor);
    return clonedRoot as T;
  }

  const clonedRoot = { ...root };
  mutateTutor(clonedRoot);
  return clonedRoot as T;
}

function applySetSpecOverrides(tutor: JsonRecord, overrides: NonNullable<LearnerTdfOverrides['setspec']>): void {
  const setspec = { ...asRecord(tutor.setspec) };
  if (overrides.audioPromptMode !== undefined) {
    setspec.audioPromptMode = overrides.audioPromptMode;
  }
  if (overrides.audioInputEnabled !== undefined) {
    setspec.audioInputEnabled = overrides.audioInputEnabled;
  }
  if (overrides.audioInputSensitivity !== undefined) {
    setspec.audioInputSensitivity = overrides.audioInputSensitivity;
  }
  tutor.setspec = setspec;
}

function applyUnitOverrides(tutor: JsonRecord, overrides: NonNullable<LearnerTdfOverrides['unit']>): void {
  const units = Array.isArray(tutor.unit) ? [...tutor.unit] : [];
  for (const [unitIndex, unitConfig] of Object.entries(overrides)) {
    const index = Number(unitIndex);
    const unit = asRecord(units[index]);
    const deliverySettings = unitConfig.deliverySettings;
    units[index] = {
      ...unit,
      ...(deliverySettings && Object.keys(deliverySettings).length
        ? { deliverySettings: { ...asRecord(unit.deliverySettings), ...deliverySettings } }
        : {})
    };
  }
  tutor.unit = units;
}

export function buildLearnerTdfSourceMetadata(tdf: unknown, tdfId?: string): LearnerTdfSourceMetadata {
  const units = getUnitArray(tdf);
  const updatedAt = getTdfUpdatedAt(tdf);
  const metadata: LearnerTdfSourceMetadata = {
    unitCount: units.length,
    unitSignature: units.map(unitSignatureEntry)
  };
  if (tdfId) {
    metadata.tdfId = tdfId;
  }
  if (updatedAt) {
    metadata.tdfUpdatedAt = updatedAt;
  }
  return metadata;
}

export function normalizeLearnerTdfOverrides(tdf: unknown, overrides: unknown): LearnerTdfOverrides {
  const errors: string[] = [];
  const normalized = normalizeLearnerTdfOverridesWithErrors(tdf, overrides, errors);
  if (errors.length) {
    throw new Error(errors.join('; '));
  }
  return normalized;
}

function normalizeLearnerTdfOverridesWithErrors(tdf: unknown, overrides: unknown, errors: string[]): LearnerTdfOverrides {
  const input = asRecord(overrides);
  const normalized: LearnerTdfOverrides = {};
  const allowedTopLevel = new Set(['setspec', 'deliverySettings', 'unit']);
  for (const key of Object.keys(input)) {
    if (!allowedTopLevel.has(key)) {
      errors.push(`${key} is not a configurable learner TDF scope`);
    }
  }

  if (input.setspec !== undefined) {
    const setspec = asRecord(input.setspec);
    const allowedSetSpec = new Set(['audioPromptMode', 'audioInputEnabled', 'audioInputSensitivity']);
    for (const key of Object.keys(setspec)) {
      if (!allowedSetSpec.has(key)) {
        errors.push(`setspec.${key} is not learner configurable`);
      }
    }

    const normalizedSetSpec: NonNullable<LearnerTdfOverrides['setspec']> = {};
    if (setspec.audioPromptMode !== undefined) {
      const audioPromptMode = normalizeAudioPromptMode(setspec.audioPromptMode, 'setspec.audioPromptMode', errors);
      if (audioPromptMode !== undefined) {
        normalizedSetSpec.audioPromptMode = audioPromptMode;
      }
    }
    if (setspec.audioInputEnabled !== undefined) {
      const audioInputEnabled = normalizeSpeechRecognitionMode(setspec.audioInputEnabled, 'setspec.audioInputEnabled', errors);
      if (audioInputEnabled !== undefined) {
        normalizedSetSpec.audioInputEnabled = audioInputEnabled;
      }
    }
    if (setspec.audioInputSensitivity !== undefined) {
      const audioInputSensitivity = Number(setspec.audioInputSensitivity);
      if (!Number.isFinite(audioInputSensitivity) || audioInputSensitivity < 20 || audioInputSensitivity > 80) {
        errors.push('setspec.audioInputSensitivity must be a number between 20 and 80');
      } else {
        normalizedSetSpec.audioInputSensitivity = audioInputSensitivity;
      }
    }
    const prunedSetSpec = setSpecOverridesEqualBase(tdf, normalizedSetSpec);
    if (prunedSetSpec) {
      normalized.setspec = prunedSetSpec;
    }
  }

  if (input.deliverySettings !== undefined) {
    const deliverySettings = asRecord(input.deliverySettings);
    const normalizedDeliverySettings: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(deliverySettings)) {
      if (!DELIVERY_SETTINGS_LEARNER_CONFIGURABLE_KEYS.includes(key) && !DELIVERY_DISPLAY_SETTINGS_LEARNER_CONFIGURABLE_KEYS.includes(key)) {
        errors.push(`deliverySettings.${key} is not learner configurable`);
        continue;
      }
      const normalizedValue = normalizeDeliverySettingValue(key, value, errors, `deliverySettings.${key}`);
      if (normalizedValue !== undefined) {
        normalizedDeliverySettings[key] = normalizedValue;
      }
    }
    const prunedDeliverySettings = pruneDeliverySettingsOverrides(tdf, normalizedDeliverySettings);
    if (prunedDeliverySettings) {
      normalized.deliverySettings = prunedDeliverySettings;
    }
  }

  if (input.unit !== undefined) {
    const units = getUnitArray(tdf);
    const unitInput = asRecord(input.unit);
    const normalizedUnit: NonNullable<LearnerTdfOverrides['unit']> = {};
    for (const [unitIndex, unitConfigValue] of Object.entries(unitInput)) {
      const index = Number(unitIndex);
      if (!Number.isInteger(index) || index < 0 || index >= units.length || String(index) !== unitIndex) {
        errors.push(`unit.${unitIndex} is not a valid TDF unit index`);
        continue;
      }

      const unitConfig = asRecord(unitConfigValue);
      const sourceUnit = units[index];
      for (const key of Object.keys(unitConfig)) {
        if (key !== 'deliverySettings') {
          errors.push(`unit.${unitIndex}.${key} is not learner configurable`);
        }
      }

      const deliverySettings = asRecord(unitConfig.deliverySettings);
      const normalizedDeliverySettings: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(deliverySettings)) {
        if (!DELIVERY_SETTINGS_LEARNER_CONFIGURABLE_KEYS.includes(key) && !DELIVERY_DISPLAY_SETTINGS_LEARNER_CONFIGURABLE_KEYS.includes(key)) {
          errors.push(`unit.${unitIndex}.deliverySettings.${key} is not learner configurable`);
          continue;
        }
        if (!learnerConfigurableKeyAppliesToUnit('deliverySettings', key, sourceUnit)) {
          errors.push(`unit.${unitIndex}.deliverySettings.${key} does not apply to this unit type`);
          continue;
        }
        const normalizedValue = normalizeDeliverySettingValue(key, value, errors, `unit.${unitIndex}.deliverySettings.${key}`);
        if (normalizedValue !== undefined) {
          normalizedDeliverySettings[key] = normalizedValue;
        }
      }

      if (Object.keys(normalizedDeliverySettings).length) {
        normalizedUnit[unitIndex] = { deliverySettings: normalizedDeliverySettings };
      }
    }

    const prunedUnits = pruneUnitOverrides(tdf, normalizedUnit);
    if (prunedUnits) {
      normalized.unit = prunedUnits;
    }
  }

  return normalized;
}

export function unitHasConfigurableRuntime(unit: unknown): boolean {
  const unitType = detectTdfUnitType(unit);
  return unitType === 'learning' || unitType === 'autotutor' || unitType === 'sparc';
}

export function buildLearnerTdfConfig(tdf: unknown, tdfId: string, overrides: unknown): LearnerTdfConfig {
  return {
    source: buildLearnerTdfSourceMetadata(tdf, tdfId),
    overrides: normalizeLearnerTdfOverrides(tdf, overrides)
  };
}

export function validateLearnerTdfConfig(tdf: unknown, config: LearnerTdfConfig | undefined): LearnerTdfValidationResult {
  const errors: string[] = [];
  const overrides = {
    ...(config?.overrides ?? {}),
    unit: pruneUnitOverridesToCurrentTdf(tdf, config?.overrides?.unit)
  };
  normalizeLearnerTdfOverridesWithErrors(tdf, overrides, errors);

  return {
    valid: errors.length === 0,
    errors,
    staleUnitOverrides: false
  };
}

export function applyLearnerTdfConfig<T>(tdf: T, config: LearnerTdfConfig | undefined): LearnerTdfApplyResult<T> {
  const overrides = config?.overrides;
  if (!overrides || (!overrides.setspec && !overrides.deliverySettings && !overrides.unit)) {
    return { tdf, applied: false, warnings: [] };
  }

  const errors: string[] = [];
  const applicableOverrides = {
    ...overrides,
    unit: pruneUnitOverridesToCurrentTdf(tdf, overrides.unit)
  };
  const normalized = normalizeLearnerTdfOverridesWithErrors(tdf, applicableOverrides, errors);
  if (errors.length) {
    throw new Error(errors.join('; '));
  }

  const applicableUnitOverrides = normalized.unit;
  const warnings: string[] = [];

  if (!normalized.setspec && !normalized.deliverySettings && !applicableUnitOverrides) {
    return { tdf, applied: false, warnings };
  }

  const configured = cloneWithTutor(tdf, (tutor) => {
    if (normalized.setspec) {
      applySetSpecOverrides(tutor, normalized.setspec);
    }
    if (normalized.deliverySettings) {
      tutor.deliverySettings = {
        ...asRecord(tutor.deliverySettings),
        ...normalized.deliverySettings
      };
    }
    if (applicableUnitOverrides) {
      applyUnitOverrides(tutor, applicableUnitOverrides);
    }
  });

  return { tdf: configured, applied: true, warnings };
}
