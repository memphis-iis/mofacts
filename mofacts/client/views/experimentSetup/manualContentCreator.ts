import { Meteor } from 'meteor/meteor';
import { Session } from 'meteor/session';
import { Template } from 'meteor/templating';
import { ReactiveVar } from 'meteor/reactive-var';
import { Tracker } from 'meteor/tracker';
import { Random } from 'meteor/random';
import './manualContentCreator.html';
import './manualContentCreator.css';
import './draftEditorWorkspace';
import { buildImportPackageFromDraftLessons } from '../../lib/importPackageBuilder';
import { getUploadIntegrity } from '../../lib/uploadIntegrity';
import { uploadAndProcessPackage } from '../../lib/packageUploadClient';
import {
  buildManualDraftLesson,
  createDefaultManualCreatorState,
  createStarterRow,
  type ManualCreatorState,
  type PromptType,
  type ResponseType,
  type StarterRow,
  type TopBarMode
} from '../../lib/manualDraftBuilder';
import {
  getMediaLabel,
  getSeedColumnLabels,
  isMediaPromptEnabled,
  isPromptTextEnabled,
  parseSeedTableText,
  structureIncludesInstructions,
} from '../../lib/manualContentCreatorUtils';
import {
  parsePositiveInteger,
  resolveSeedRowsForValidation,
  validateManualCreatorStep,
} from '../../lib/manualContentCreatorValidation';
import { clientConsole } from '../..';
import { getErrorMessage } from '../../lib/errorUtils';
import { translatePlatformString } from '../../lib/interfaceI18n';
import { getActiveUiLocale } from '../../lib/interfaceLocaleState';
import { createInlineConfirmationController } from '../../lib/adminUi/inlineConfirmationController';
import '../shared/adminUi/adminUi';

const FlowRouter = (globalThis as any).FlowRouter;
declare const DynamicAssets: any;

type PlatformStringKey = Parameters<typeof translatePlatformString>[1];

type StepItem = {
  number: number;
  label: string;
  isActive: boolean;
  isComplete: boolean;
};

type DraftMessageLevel = 'info' | 'success' | 'warning' | 'error';

type ManualContentDraftRecord = {
  _id: string;
  lessonName?: string;
  currentStep?: number;
  state?: Partial<ManualCreatorState>;
  draftLessons?: any[];
  updatedAt?: Date | string | null;
};

const STEP_LABEL_KEYS: PlatformStringKey[] = [
  'manualCreator.lessonBasics',
  'manualCreator.cardFormat',
  'manualCreator.audioAndDisplay',
  'manualCreator.starterContent',
  'manualCreator.editDraft'
];

function manualText(key: PlatformStringKey, values?: Parameters<typeof translatePlatformString>[2]): string {
  return translatePlatformString(getActiveUiLocale(), key, values);
}

function cloneJson<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

function cloneState(state: ManualCreatorState): ManualCreatorState {
  return {
    ...state,
    rows: state.rows.map((row) => ({ ...row }))
  };
}

function updateState(instance: any, updater: (state: ManualCreatorState) => ManualCreatorState) {
  const current = cloneState(instance.state.get());
  const next = updater(current);
  instance.state.set(next);
}

function clearGeneratedArtifacts(instance: any, options: { keepDraft?: boolean } = {}) {
  if (!options.keepDraft) {
    instance.draftLessons.set([]);
  }
  instance.generationResult.set(null);
  instance.packageError.set(null);
  instance.uploadStatus.set(null);
  instance.uploadError.set(null);
  instance.uploadComplete.set(false);
}

function getDraftIdFromRoute() {
  const draftId = FlowRouter.current()?.queryParams?.draftId;
  return typeof draftId === 'string' && draftId.trim() ? draftId.trim() : '';
}

function setDraftMessage(instance: any, text: string | null, level: DraftMessageLevel = 'info') {
  instance.draftPersistenceMessage.set(text);
  instance.draftPersistenceLevel.set(level);
}

function clearSuccessDraftMessage(instance: any) {
  if (instance.draftPersistenceLevel.get() !== 'error') {
    instance.draftPersistenceMessage.set(null);
    instance.draftPersistenceLevel.set('info');
  }
}

function getDraftMessageClass(level: DraftMessageLevel) {
  if (level === 'success') return 'success';
  if (level === 'warning') return 'warning';
  if (level === 'error') return 'error';
  return 'info';
}

function clearManualConfirmation(instance: any) {
  const context = instance.manualConfirmationController?.getContext?.();
  if (instance.manualConfirmationController?.cancel?.()) context?.resolve?.(false);
}

function requestManualConfirmation(instance: any, trigger: HTMLElement, options: any): Promise<boolean> {
  clearManualConfirmation(instance);

  return new Promise((resolve) => {
    const placement = options.placement || 'header';
    instance.manualConfirmationController.open({
      confirmationId: `manual-confirmation-${placement}`,
      title: options.title,
      message: options.message,
      confirmLabel: options.confirmLabel || manualText('common.continue'),
      cancelLabel: manualText('manualCreator.cancel'),
      severity: options.confirmClass === 'btn-warning' ? 'warning' : 'danger',
      context: { placement, resolve },
    }, trigger);
    Tracker.afterFlush(() => instance.manualConfirmationController.focusInitial());
  });
}

function normalizeLoadedState(rawState: Partial<ManualCreatorState> | undefined): ManualCreatorState {
  const defaultState = createDefaultManualCreatorState();
  const sourceState = rawState && typeof rawState === 'object' ? rawState : {};
  const rawRows = Array.isArray(sourceState.rows) ? sourceState.rows : [];

  return {
    ...defaultState,
    ...sourceState,
    cardCount: parsePositiveInteger(sourceState.cardCount) || defaultState.cardCount,
    rows: rawRows.map((row: Partial<StarterRow>) => {
      const draftRowId = typeof row?.id === 'string' && row.id.trim() ? row.id.trim() : Random.id();
      return {
        ...createStarterRow(draftRowId),
        ...(row || {}),
        id: draftRowId
      };
    })
  };
}

function normalizeLoadedStep(value: unknown) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (Number.isFinite(parsed) && parsed >= 1 && parsed <= STEP_LABEL_KEYS.length) {
    return parsed;
  }
  return 1;
}

function applyLoadedDraft(instance: any, draft: ManualContentDraftRecord) {
  const normalizedState = normalizeLoadedState(draft.state);
  let nextStep = normalizeLoadedStep(draft.currentStep);
  let nextDraftLessons = Array.isArray(draft.draftLessons) ? cloneJson(draft.draftLessons) : [];

  if (nextStep >= 5 && nextDraftLessons.length === 0) {
    try {
      nextDraftLessons = [buildManualDraftLesson(normalizedState)];
    } catch (error: unknown) {
      clientConsole(1, '[MANUAL CREATOR] Saved draft fallback build failed:', error);
      nextStep = 4;
    }
  }

  instance.state.set(normalizedState);
  instance.stepErrors.set([]);
  clearGeneratedArtifacts(instance, { keepDraft: true });
  instance.draftLessons.set(nextDraftLessons);
  instance.wizardStep.set(nextStep);
  instance.currentDraftId.set(String(draft._id || ''));
  setDraftMessage(
    instance,
    manualText('manualCreator.loadedDraft', { lessonName: draft.lessonName || normalizedState.lessonName || manualText('manualCreator.untitled') }),
    'info'
  );
}

function buildDraftSavePayload(instance: any) {
  return {
    draftId: instance.currentDraftId.get() || null,
    currentStep: instance.wizardStep.get(),
    state: cloneState(instance.state.get()),
    draftLessons: cloneJson(instance.draftLessons.get())
  };
}

async function saveCurrentDraft(instance: any) {
  instance.draftPersistenceBusy.set(true);
  setDraftMessage(instance, manualText('manualCreator.savingDraft'), 'info');

  try {
    const result = await (Meteor as any).callAsync('saveManualContentDraft', buildDraftSavePayload(instance));
    const nextDraftId = String(result?.draftId || '');
    instance.currentDraftId.set(nextDraftId);
    if (nextDraftId && typeof window !== 'undefined' && window.history?.replaceState) {
      const nextUrl = `/contentCreate?draftId=${encodeURIComponent(nextDraftId)}`;
      if (`${window.location.pathname}${window.location.search}` !== nextUrl) {
        window.history.replaceState({}, '', nextUrl);
      }
    }
    setDraftMessage(
      instance,
      manualText('manualCreator.savedDraft', { lessonName: result?.lessonName || instance.state.get().lessonName || manualText('manualCreator.untitled') }),
      'success'
    );
  } catch (error: unknown) {
    clientConsole(1, '[MANUAL CREATOR] Save draft failed:', error);
    setDraftMessage(instance, getErrorMessage(error), 'error');
  } finally {
    instance.draftPersistenceBusy.set(false);
  }
}

async function deleteCurrentDraft(instance: any, options: { redirectToContent?: boolean; silent?: boolean } = {}) {
  const draftId = String(instance.currentDraftId.get() || '');
  if (!draftId) {
    return;
  }

  try {
    await (Meteor as any).callAsync('deleteManualContentDraft', draftId);
    instance.currentDraftId.set('');
    if (typeof window !== 'undefined' && window.history?.replaceState) {
      window.history.replaceState({}, '', '/contentCreate');
    }
    if (!options.silent) {
      setDraftMessage(instance, manualText('manualCreator.savedDraftDeleted'), 'success');
    }
    if (options.redirectToContent) {
      FlowRouter.go('/contentUpload');
    }
  } catch (error: unknown) {
    clientConsole(1, '[MANUAL CREATOR] Delete draft failed:', error);
    if (!options.silent) {
      setDraftMessage(instance, getErrorMessage(error), 'error');
    }
  }
}

function getPromptSummary(promptType: PromptType) {
  switch (promptType) {
    case 'text':
      return manualText('manualCreator.text');
    case 'image':
      return manualText('manualCreator.image');
    case 'audio':
      return manualText('manualCreator.audio');
    case 'video':
      return manualText('manualCreator.video');
    case 'text-image':
      return manualText('manualCreator.textImage');
    default:
      return manualText('manualCreator.text');
  }
}

function getResponseSummary(responseType: ResponseType) {
  return responseType === 'multiple-choice' ? manualText('manualCreator.multipleChoice') : manualText('manualCreator.typedResponse');
}

function getStructureSummary(structure: ManualCreatorState['structure']) {
  switch (structure) {
    case 'learning-only':
      return manualText('manualCreator.learningOnly');
    case 'instructions-learning':
      return manualText('manualCreator.instructionsLearning');
    case 'assessment-only':
      return manualText('manualCreator.assessmentOnly');
    case 'instructions-assessment':
      return manualText('manualCreator.instructionsAssessment');
    default:
      return manualText('manualCreator.instructionsLearning');
  }
}

function getTopBarSummary(topBarMode: TopBarMode) {
  switch (topBarMode) {
    case 'time':
      return manualText('manualCreator.time');
    case 'score':
      return manualText('manualCreator.score');
    case 'time-score':
      return manualText('manualCreator.timeScore');
    default:
      return manualText('manualCreator.neither');
  }
}

function getVisibilitySummary(visibility: ManualCreatorState['visibility']) {
  return visibility === 'public' ? manualText('content.public') : manualText('content.private');
}

function initializeRowsIfNeeded(instance: any) {
  updateState(instance, (state) => {
    if (state.rows.length > 0) {
      return state;
    }

    if (state.seedMode === 'paste-table') {
      return state;
    }

    const rowCount = state.seedMode === 'example-duplicate'
      ? 1
      : (parsePositiveInteger(state.cardCount) || 1);
    return {
      ...state,
      rows: Array.from({ length: rowCount }, () => createStarterRow(Random.id()))
    };
  });
}

Template.manualContentCreator.onCreated(function(this: any) {
  this.wizardStep = new ReactiveVar(1);
  this.state = new ReactiveVar(createDefaultManualCreatorState());
  this.stepErrors = new ReactiveVar([]);
  this.draftLessons = new ReactiveVar([]);
  this.generationResult = new ReactiveVar(null);
  this.packageError = new ReactiveVar(null);
  this.uploadStatus = new ReactiveVar(null);
  this.uploadError = new ReactiveVar(null);
  this.uploadComplete = new ReactiveVar(false);
  this.currentDraftId = new ReactiveVar(getDraftIdFromRoute());
  this.draftPersistenceMessage = new ReactiveVar(null);
  this.draftPersistenceLevel = new ReactiveVar('info');
  this.draftPersistenceBusy = new ReactiveVar(false);
  this.manualConfirmation = new ReactiveVar(null);
  this.manualConfirmationController = createInlineConfirmationController(
    (view) => this.manualConfirmation.set(view.status === 'open' ? view : null),
    () => document.getElementById('manual-save-draft'),
  );

  const routeDraftId = this.currentDraftId.get();
  if (routeDraftId) {
    this.draftPersistenceBusy.set(true);
    setDraftMessage(this, manualText('manualCreator.loadingDraft'), 'info');
    void (Meteor as any).callAsync('getManualContentDraft', routeDraftId)
      .then((draft: ManualContentDraftRecord) => {
        applyLoadedDraft(this, draft);
      })
      .catch((error: unknown) => {
        clientConsole(1, '[MANUAL CREATOR] Load draft failed:', error);
        this.currentDraftId.set('');
        if (typeof window !== 'undefined' && window.history?.replaceState) {
          window.history.replaceState({}, '', '/contentCreate');
        }
        setDraftMessage(this, getErrorMessage(error), 'error');
      })
      .finally(() => {
        this.draftPersistenceBusy.set(false);
      });
  }
});

Template.manualContentCreator.helpers({
  state() {
    return (Template.instance() as any).state.get();
  },

  stepItems() {
    const currentStep = (Template.instance() as any).wizardStep.get();
    return STEP_LABEL_KEYS.map((labelKey, index) => ({
      number: index + 1,
      label: manualText(labelKey),
      isActive: currentStep === index + 1,
      isComplete: currentStep > index + 1
    })) as StepItem[];
  },

  manualText(key: PlatformStringKey, options?: { hash?: Parameters<typeof translatePlatformString>[2] }) {
    return manualText(key, options?.hash);
  },

  isStep(stepNumber: number) {
    return (Template.instance() as any).wizardStep.get() === stepNumber;
  },

  selectedIf(value: unknown, expected: unknown) {
    return value === expected ? 'selected' : null;
  },

  checkedIf(value: unknown, expected: unknown) {
    return value === expected ? 'checked' : null;
  },

  boolChecked(value: unknown) {
    return value ? 'checked' : null;
  },

  hasSavedDraft() {
    return !!(Template.instance() as any).currentDraftId.get();
  },

  saveDraftLabel() {
    return (Template.instance() as any).currentDraftId.get() ? manualText('manualCreator.updateDraft') : manualText('manualCreator.saveDraft');
  },

  draftPersistenceMessage() {
    return (Template.instance() as any).draftPersistenceMessage.get();
  },

  draftPersistenceBusy() {
    return !!(Template.instance() as any).draftPersistenceBusy.get();
  },

  manualConfirmation() {
    return (Template.instance() as any).manualConfirmation.get();
  },

  draftPersistenceAttrs() {
    return (Template.instance() as any).draftPersistenceBusy.get() ? { disabled: true } : {};
  },

  stepErrors() {
    return (Template.instance() as any).stepErrors.get();
  },

  stepHasErrors() {
    const errors = (Template.instance() as any).stepErrors.get();
    return Array.isArray(errors) && errors.length > 0;
  },

  canGoBack() {
    return (Template.instance() as any).wizardStep.get() > 1;
  },

  nextButtonLabel() {
    const currentStep = (Template.instance() as any).wizardStep.get();
    if (currentStep === 4) return manualText('manualCreator.openDraft');
    return manualText('manualCreator.next');
  },

  draftPersistenceStatus() {
    const instance = Template.instance() as any;
    const text = instance.draftPersistenceMessage.get();
    if (!text) return null;
    const variant = getDraftMessageClass(instance.draftPersistenceLevel.get());
    return { text, variant, urgent: variant === 'error' };
  },

  draftWorkspaceHeading() {
    return manualText('manualCreator.editDraftFinalize');
  },

  draftWorkspaceSaveContinueLabel() {
    return manualText('manualCreator.validateAndFinalize');
  },

  promptSummary() {
    const state = (Template.instance() as any).state.get();
    return getPromptSummary(state.promptType);
  },

  responseSummary() {
    const state = (Template.instance() as any).state.get();
    return getResponseSummary(state.responseType);
  },

  structureSummary() {
    const state = (Template.instance() as any).state.get();
    return getStructureSummary(state.structure);
  },

  topBarSummary() {
    const state = (Template.instance() as any).state.get();
    return getTopBarSummary(state.topBarMode);
  },

  visibilitySummary() {
    const state = (Template.instance() as any).state.get();
    return getVisibilitySummary(state.visibility);
  },

  showPromptTextColumn() {
    const state = (Template.instance() as any).state.get();
    return isPromptTextEnabled(state.promptType);
  },

  showPromptMediaColumn() {
    const state = (Template.instance() as any).state.get();
    return isMediaPromptEnabled(state.promptType);
  },

  promptMediaLabel() {
    const state = (Template.instance() as any).state.get();
    return getMediaLabel(state.promptType);
  },

  promptTextLabel() {
    const state = (Template.instance() as any).state.get();
    return state.promptType === 'text-image' ? manualText('manualCreator.promptText') : manualText('manualCreator.prompt');
  },

  structureIncludesInstructions() {
    const state = (Template.instance() as any).state.get();
    return structureIncludesInstructions(state.structure);
  },

  isMultipleChoice() {
    const state = (Template.instance() as any).state.get();
    return state.responseType === 'multiple-choice';
  },

  isSeedMode(expectedMode: ManualCreatorState['seedMode']) {
    const state = (Template.instance() as any).state.get();
    return state.seedMode === expectedMode;
  },

  seedColumnHint() {
    const state = (Template.instance() as any).state.get();
    return getSeedColumnLabels(state).join(' | ');
  },

  seedTablePlaceholder() {
    const state = (Template.instance() as any).state.get();
    return manualText('manualCreator.pasteRowsPlaceholder', { columns: getSeedColumnLabels(state).join(' | ') });
  },

  expectedColumnsText() {
    const state = (Template.instance() as any).state.get();
    return manualText('manualCreator.expectedColumns', { columns: getSeedColumnLabels(state).join(' | ') });
  },

  rowsRequestedText() {
    const state = (Template.instance() as any).state.get();
    const rows = Array.isArray(state.rows) ? state.rows.length : 0;
    return manualText('manualCreator.rowsRequested', { rows, requested: state.cardCount });
  },

  rows() {
    const state = (Template.instance() as any).state.get();
    return state.rows.map((row: StarterRow, index: number) => ({
      ...row,
      rowNumber: index + 1
    }));
  },

  rowsCount() {
    const state = (Template.instance() as any).state.get();
    return Array.isArray(state.rows) ? state.rows.length : 0;
  },

  experimentLinkPreview() {
    const state = (Template.instance() as any).state.get();
    const slug = String(state.experimentTarget || '').trim();
    if (!slug) return '';
    return `/experiment/${slug}`;
  },

  experimentLinkPreviewText() {
    const state = (Template.instance() as any).state.get();
    const slug = String(state.experimentTarget || '').trim();
    const preview = slug ? `/experiment/${slug}` : manualText('manualCreator.pendingName');
    return manualText('manualCreator.preview', { preview });
  },

  draftLessons() {
    return (Template.instance() as any).draftLessons.get();
  },

  updateDraftLessons() {
    const instance = Template.instance() as any;
    return (lessons: any) => {
      instance.draftLessons.set(lessons);
      clearSuccessDraftMessage(instance);
    };
  },

  backToStarterContent() {
    const instance = Template.instance() as any;
    return () => {
      instance.generationResult.set(null);
      instance.packageError.set(null);
      instance.uploadStatus.set(null);
      instance.uploadError.set(null);
      instance.uploadComplete.set(false);
      clearSuccessDraftMessage(instance);
      instance.wizardStep.set(4);
    };
  },

  saveDraftAndContinue() {
    const instance = Template.instance() as any;
    return async () => {
      const lessons = instance.draftLessons.get();
      if (!Array.isArray(lessons) || lessons.length === 0) {
        instance.packageError.set(manualText('manualCreator.generateBeforeFinalizing'));
        return;
      }

      instance.packageError.set(null);
      instance.uploadStatus.set(null);
      instance.uploadError.set(null);
      instance.uploadComplete.set(false);

      try {
        const result = await buildImportPackageFromDraftLessons(lessons);
        instance.generationResult.set(result);
      } catch (error: unknown) {
        clientConsole(1, '[MANUAL CREATOR] Package build failed:', error);
        instance.packageError.set(getErrorMessage(error));
      }
    };
  },

  generationResult() {
    return (Template.instance() as any).generationResult.get();
  },

  packageReady() {
    return !!(Template.instance() as any).generationResult.get();
  },

  packageError() {
    return (Template.instance() as any).packageError.get();
  },

  uploadStatus() {
    return (Template.instance() as any).uploadStatus.get();
  },

  uploadError() {
    return (Template.instance() as any).uploadError.get();
  },

  uploadComplete() {
    return (Template.instance() as any).uploadComplete.get();
  },
  headerManualConfirmation() {
    const instance = Template.instance() as any;
    const confirmation = instance.manualConfirmation.get();
    return instance.manualConfirmationController.getContext()?.placement === 'header' ? confirmation : null;
  },
  uploadManualConfirmation() {
    const instance = Template.instance() as any;
    const confirmation = instance.manualConfirmation.get();
    return instance.manualConfirmationController.getContext()?.placement === 'upload' ? confirmation : null;
  },

  statusSummary() {
    const instance = Template.instance() as any;
    if (instance.uploadComplete.get()) return manualText('manualCreator.uploaded');
    const uploadStatus = instance.uploadStatus.get();
    if (uploadStatus?.message) return uploadStatus.message;
    if (instance.generationResult.get()) return manualText('manualCreator.packageReady');
    const draftLessons = instance.draftLessons.get();
    if (Array.isArray(draftLessons) && draftLessons.length > 0) return manualText('manualCreator.draftReady');
    const currentStep = instance.wizardStep.get();
    if (currentStep < 4) return manualText('manualCreator.setup');
    if (currentStep === 4) return manualText('manualCreator.starterContentStatus');
    return manualText('manualCreator.editDraftStatus');
  }
});

Template.manualContentCreator.onDestroyed(function(this: any) {
  const context = this.manualConfirmationController.getContext();
  context?.resolve?.(false);
  this.manualConfirmationController.destroy();
});

Template.manualContentCreator.events({
  'click #manual-save-draft'(event: any, instance: any) {
    event.preventDefault();
    void saveCurrentDraft(instance);
  },

  async 'click #manual-delete-draft'(event: any, instance: any) {
    event.preventDefault();
    const lessonName = String(instance.state.get()?.lessonName || manualText('manualCreator.untitled')).trim() || manualText('manualCreator.untitled');
    const confirmed = await requestManualConfirmation(instance, event.currentTarget as HTMLElement, {
      title: manualText('manualCreator.deleteDraftTitle', { lessonName }),
      message: manualText('manualCreator.deleteDraftMessage'),
      confirmLabel: manualText('manualCreator.deleteDraftConfirm')
    });
    if (!confirmed) {
      return;
    }
    void deleteCurrentDraft(instance, { redirectToContent: true });
  },

  'click #manual-content-back'(event: any, instance: any) {
    event.preventDefault();
    const currentStep = instance.wizardStep.get();
    if (currentStep <= 1) return;
    instance.stepErrors.set([]);
    clearManualConfirmation(instance);
    clearSuccessDraftMessage(instance);
    instance.wizardStep.set(currentStep - 1);
  },

  'click #manual-content-cancel'(event: any, _instance: any) {
    event.preventDefault();
    FlowRouter.go('/contentUpload');
  },

  'click #manual-content-next'(event: any, instance: any) {
    event.preventDefault();
    const currentStep = instance.wizardStep.get();
    const state = instance.state.get();
    const errors = validateManualCreatorStep(currentStep, state, () => Random.id());
    instance.stepErrors.set(errors);

    if (errors.length > 0) {
      return;
    }

    if (currentStep === 3) {
      initializeRowsIfNeeded(instance);
      clearSuccessDraftMessage(instance);
      instance.wizardStep.set(4);
      return;
    }

    if (currentStep === 4) {
      try {
        const normalizedState = state.seedMode === 'paste-table'
          ? {
              ...state,
              rows: resolveSeedRowsForValidation(state, () => Random.id())
            }
          : state;
        const lesson = buildManualDraftLesson(normalizedState);
        instance.draftLessons.set([lesson]);
        instance.generationResult.set(null);
        instance.packageError.set(null);
        instance.uploadStatus.set(null);
        instance.uploadError.set(null);
        instance.uploadComplete.set(false);
        clearSuccessDraftMessage(instance);
        instance.wizardStep.set(5);
      } catch (error: unknown) {
        clientConsole(1, '[MANUAL CREATOR] Draft build failed:', error);
        instance.stepErrors.set([getErrorMessage(error)]);
      }
      return;
    }

    if (currentStep < 4) {
      clearSuccessDraftMessage(instance);
      instance.wizardStep.set(currentStep + 1);
    }
  },

  'input [data-field], change [data-field]'(event: any, instance: any) {
    const field = String(event.currentTarget.dataset.field || '');
    if (!field) return;

    let value: any;
    if (event.currentTarget.type === 'checkbox') {
      value = !!event.currentTarget.checked;
    } else if (field === 'cardCount') {
      value = Number.parseInt(String(event.currentTarget.value || ''), 10) || 0;
    } else {
      value = event.currentTarget.value;
    }

    updateState(instance, (state) => ({
      ...state,
      [field]: value
    }));

    if (field === 'seedMode') {
      updateState(instance, (state) => {
        if (state.seedMode === 'example-duplicate' && state.rows.length === 0) {
          return {
            ...state,
            rows: [createStarterRow(Random.id())]
          };
        }
        return state;
      });
    }

    instance.stepErrors.set([]);
    clearManualConfirmation(instance);
    clearGeneratedArtifacts(instance);
    clearSuccessDraftMessage(instance);
  },

  'click #add-starter-row'(event: any, instance: any) {
    event.preventDefault();
    updateState(instance, (state) => ({
      ...state,
      rows: [...state.rows, createStarterRow(Random.id())]
    }));
    instance.stepErrors.set([]);
    clearManualConfirmation(instance);
    clearGeneratedArtifacts(instance);
    clearSuccessDraftMessage(instance);
  },

  'click .duplicate-starter-row'(event: any, instance: any) {
    event.preventDefault();
    const rowId = String(event.currentTarget.dataset.rowId || '');
    if (!rowId) return;

    updateState(instance, (state) => {
      const nextRows: StarterRow[] = [];
      state.rows.forEach((row) => {
        nextRows.push({ ...row });
        if (row.id === rowId) {
          nextRows.push({
            ...row,
            id: Random.id()
          });
        }
      });
      return {
        ...state,
        rows: nextRows
      };
    });
    instance.stepErrors.set([]);
    clearManualConfirmation(instance);
    clearGeneratedArtifacts(instance);
    clearSuccessDraftMessage(instance);
  },

  'click .delete-starter-row'(event: any, instance: any) {
    event.preventDefault();
    const rowId = String(event.currentTarget.dataset.rowId || '');
    if (!rowId) return;

    updateState(instance, (state) => ({
      ...state,
      rows: state.rows.filter((row) => row.id !== rowId)
    }));
    instance.stepErrors.set([]);
    clearManualConfirmation(instance);
    clearGeneratedArtifacts(instance);
    clearSuccessDraftMessage(instance);
  },

  'input .starter-row-input, change .starter-row-input'(event: any, instance: any) {
    const rowId = String(event.currentTarget.dataset.rowId || '');
    const field = String(event.currentTarget.dataset.field || '');
    if (!rowId || !field) return;

    updateState(instance, (state) => ({
      ...state,
      rows: state.rows.map((row) => (
        row.id === rowId
          ? { ...row, [field]: event.currentTarget.value }
          : row
      ))
    }));
    instance.stepErrors.set([]);
    clearManualConfirmation(instance);
    clearGeneratedArtifacts(instance);
    clearSuccessDraftMessage(instance);
  },

  'input #manual-seed-table-text, change #manual-seed-table-text'(event: any, instance: any) {
    const seedTableText = String(event.currentTarget.value || '');
    updateState(instance, (state) => ({
      ...state,
      seedTableText,
      rows: parseSeedTableText({
        ...state,
        seedTableText
      }, () => Random.id())
    }));
    instance.stepErrors.set([]);
    clearGeneratedArtifacts(instance);
    clearSuccessDraftMessage(instance);
  },

  'click #manual-edit-draft'(event: any, instance: any) {
    event.preventDefault();
    instance.generationResult.set(null);
    instance.packageError.set(null);
    instance.uploadStatus.set(null);
    instance.uploadError.set(null);
    instance.uploadComplete.set(false);
  },

  'click #manual-download-package'(event: any, instance: any) {
    event.preventDefault();
    const result = instance.generationResult.get();
    if (!result?.zipBlob) {
      return;
    }

    const firstManifest = Array.isArray(result.manifest) && result.manifest.length > 0
      ? result.manifest[0]
      : null;
    const fileName = firstManifest ? `${firstManifest.tdfName}.zip` : 'manual-learning-content.zip';

    const url = URL.createObjectURL(result.zipBlob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  },

  'click #manual-upload-package'(event: any, instance: any) {
    event.preventDefault();
    const uploadTrigger = event.currentTarget as HTMLElement;
    const result = instance.generationResult.get();
    if (!result?.zipBlob || instance.uploadStatus.get()) {
      return;
    }

    instance.uploadError.set(null);

    const firstManifest = Array.isArray(result.manifest) && result.manifest.length > 0
      ? result.manifest[0]
      : null;
    const fileName = firstManifest ? `${firstManifest.tdfName}.zip` : 'manual-learning-content.zip';

    const startUpload = async () => {
      try {
        const existingFile = await (Meteor as any).callAsync('getUserAssetByName', fileName);
        if (existingFile) {
          const confirmed = await requestManualConfirmation(instance, uploadTrigger, {
            title: manualText('content.overwriteExistingPackage'),
            message: manualText('content.packageOverwriteMessage', { filename: fileName }),
            confirmLabel: manualText('content.overwritePackage'),
            placement: 'upload',
          });
          if (!confirmed) {
            return;
          }
          await (Meteor as any).callAsync('removeAssetById', existingFile._id);
        }

        const file = new File([result.zipBlob], fileName, { type: 'application/zip' });
        const { processing: processResult } = await uploadAndProcessPackage({
          dynamicAssets: DynamicAssets,
          file,
          getUploadIntegrity,
          callAsync: (Meteor as any).callAsync.bind(Meteor),
          userId: Meteor.userId(),
          onStart: () => instance.uploadStatus.set({
            message: manualText('content.uploadingFile', { filename: fileName }),
            progress: 5
          }),
          onProgress: (progress) => instance.uploadStatus.set({
            message: manualText('content.uploadingFile', { filename: fileName }),
            progress: Math.round(progress * 0.5)
          }),
          onProcessing: () => instance.uploadStatus.set({ message: manualText('content.processingPackage'), progress: 65 }),
          confirmUpdates: async (plan) => requestManualConfirmation(instance, uploadTrigger, {
            title: manualText('content.overwriteExistingContent'),
            message: plan.updates.map((entry: any) => manualText('content.previousTdfOverwriteMessage', {
              filename: entry.lessonName || entry.fileName || entry.tdfId,
            })).join(' '),
            confirmLabel: manualText('content.overwriteContent'),
            placement: 'upload',
          }),
        });
        for (const res of processResult.results || []) {
          if (!res?.result) {
            throw new Error(manualText('content.packageProcessingFailed', { error: res?.errmsg || 'unknown error' }));
          }
        }
        instance.uploadStatus.set(null);
        instance.uploadComplete.set(true);
        Session.set('assetsRefreshTrigger', Date.now());
        if (instance.currentDraftId.get()) await deleteCurrentDraft(instance, { silent: true });
      } catch (error: unknown) {
        clientConsole(1, '[MANUAL CREATOR] Upload setup failed:', error);
        instance.uploadStatus.set(null);
        instance.uploadError.set(getErrorMessage(error));
      }
    };

    void startUpload();
  },

  'click #manual-return-to-content'(event: any, _instance: any) {
    event.preventDefault();
    FlowRouter.go('/contentUpload');
  },

  'click .admin-confirmation-cancel'(event: any, instance: any) {
    event.preventDefault();
    clearManualConfirmation(instance);
  },

  'keydown .admin-inline-confirmation'(event: KeyboardEvent, instance: any) {
    const context = instance.manualConfirmationController.getContext();
    if (instance.manualConfirmationController.handleKeydown(event)) {
      context?.resolve?.(false);
    }
  },

  'click .admin-confirmation-confirm'(event: any, instance: any) {
    event.preventDefault();
    const context = instance.manualConfirmationController.getContext();
    context?.resolve?.(true);
    instance.manualConfirmationController.complete();
  }
});
