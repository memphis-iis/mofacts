/**
 * Canvas IMSCC Import Wizard
 * Client-side extraction and conversion for Canvas course export packages.
 */

import { Meteor } from 'meteor/meteor';
import { Template } from 'meteor/templating';
import { Session } from 'meteor/session';
import './imsccWizard.html';
import './imsccWizard.css';
import { ReactiveVar } from 'meteor/reactive-var';
import { Tracker } from 'meteor/tracker';
import './draftEditorWorkspace';
import { buildImportPackageFromDraftLessons } from '../../lib/importPackageBuilder';
import { sanitizeImportName } from '../../lib/importCompositionBuilder';
import { clientConsole } from '../..';
import { getUploadIntegrity } from '../../lib/uploadIntegrity';
import { uploadAndProcessPackage } from '../../lib/packageUploadClient';
import { translatePlatformString } from '../../lib/interfaceI18n';
import { getActiveUiLocale } from '../../lib/interfaceLocaleState';
import { formatActiveInterfaceDateTime } from '../../lib/interfaceFormatting';
import {
  createInlineConfirmationController,
  type InlineConfirmationController,
} from '../../lib/adminUi/inlineConfirmationController';
import '../shared/adminUi/adminUi';

declare const $: any;
declare const DynamicAssets: any;
type PlatformStringKey = Parameters<typeof translatePlatformString>[1];

function imsccText(key: PlatformStringKey, values?: Parameters<typeof translatePlatformString>[2]): string {
  return translatePlatformString(getActiveUiLocale(), key, values);
}

type ImsccConfirmationContext = { resolve: (confirmed: boolean) => void };

function closeImsccConfirmation(template: any, confirmed: boolean) {
  const controller = template.inlineConfirmationController as InlineConfirmationController<ImsccConfirmationContext>;
  const context = controller.getContext();
  const closed = confirmed ? controller.complete() : controller.cancel();
  if (closed) context?.resolve(confirmed);
}

function requestImsccConfirmation(template: any, plan: any): Promise<boolean> {
  closeImsccConfirmation(template, false);
  return new Promise((resolve) => {
    template.inlineConfirmationController.open({
      confirmationId: `imscc-package-${plan.uploadPlanId}`,
      title: imsccText('content.overwriteExistingContent'),
      message: plan.updates.map((entry: any) => imsccText('content.previousTdfOverwriteMessage', {
        filename: entry.lessonName || entry.fileName || entry.tdfId,
      })).join(' '),
      confirmLabel: imsccText('content.overwriteContent'),
      cancelLabel: imsccText('content.cancel'),
      severity: 'warning',
      context: { resolve },
    }, template.find('#upload-imscc-package'));
    Tracker.afterFlush(() => template.inlineConfirmationController.focusInitial());
  });
}

// Lazy-load imsccProcessor (and its jszip dependency) only when the wizard is
// actually used. Mirrors the dynamic-import pattern in apkgWizard.js.
let imsccProcessorPromise: Promise<any> | null = null;

async function getImsccProcessor() {
  if (!imsccProcessorPromise) {
    imsccProcessorPromise = import('../../lib/imsccProcessor');
  }
  return imsccProcessorPromise;
}

function resetWizardState(template: any) {
  template.wizardStep.set(1);
  template.completedSteps.set([]);
  template.selectedFile.set(null);
  template.selectedFileName.set(null);
  template.metadata.set(null);
  template.configs.set([]);
  template.draftLessons.set([]);
  template.analyzing.set(false);
  template.analyzeProgress.set(0);
  template.analyzeError.set(null);
  template.generating.set(false);
  template.generateProgress.set(0);
  template.generateError.set(null);
  template.generationResult.set(null);
  template.uploading.set(false);
  template.uploadStatus.set(null);
  template.uploadError.set(null);
  template.uploadComplete.set(false);
  template.joinMode.set(false);
  template.joinedConfig.set({ name: '', instructions: imsccText('imscc.defaultInstructions'), isValid: false, validationError: imsccText('imscc.tdfNameRequired') });
}

function seedJoinedConfigName(template: any) {
  const current = template.joinedConfig.get();
  if (current?.name?.trim()) {
    return;
  }

  const fileName = template.metadata.get()?.fileName || '';
  const baseName = sanitizeImportName(fileName.replace(/\.imscc$/i, ''), 'Canvas_Practice');
  template.joinedConfig.set({
    ...current,
    name: baseName,
    isValid: true,
    validationError: null
  });
}

Template.imsccWizard.onCreated(function(this: any) {
  this.wizardStep = new ReactiveVar(1);
  this.completedSteps = new ReactiveVar([]);

  this.selectedFile = new ReactiveVar(null);
  this.selectedFileName = new ReactiveVar(null);
  this.metadata = new ReactiveVar(null);
  this.configs = new ReactiveVar([]);
  this.draftLessons = new ReactiveVar([]);

  this.analyzing = new ReactiveVar(false);
  this.analyzeProgress = new ReactiveVar(0);
  this.analyzeError = new ReactiveVar(null);

  this.generating = new ReactiveVar(false);
  this.generateProgress = new ReactiveVar(0);
  this.generateError = new ReactiveVar(null);
  this.generationResult = new ReactiveVar(null);

  this.uploading = new ReactiveVar(false);
  this.uploadStatus = new ReactiveVar(null);
  this.uploadError = new ReactiveVar(null);
  this.uploadComplete = new ReactiveVar(false);
  this.inlineConfirmation = new ReactiveVar(null);
  this.inlineConfirmationController = createInlineConfirmationController<ImsccConfirmationContext>(
    (view) => this.inlineConfirmation.set(view.status === 'open' ? view : null),
    () => this.find('#close-imscc-wizard'),
  );

  this.joinMode = new ReactiveVar(false);
  this.joinedConfig = new ReactiveVar({ name: '', instructions: imsccText('imscc.defaultInstructions'), isValid: false, validationError: imsccText('imscc.tdfNameRequired') });
});

Template.imsccWizard.onDestroyed(function(this: any) {
  const context = this.inlineConfirmationController.getContext() as ImsccConfirmationContext | undefined;
  this.inlineConfirmationController.destroy();
  context?.resolve(false);
});

Template.imsccWizard.helpers({
  imsccText(key: PlatformStringKey, options?: { hash?: Parameters<typeof translatePlatformString>[2] }) {
    return imsccText(key, options?.hash);
  },

  inlineConfirmation() {
    return (Template.instance() as any).inlineConfirmation.get();
  },

  isStep(num: any) {
    return (Template.instance() as any).wizardStep.get() === num;
  },

  stepCompleted(num: any) {
    return (Template.instance() as any).completedSteps.get().includes(num);
  },

  selectedFileName() {
    return (Template.instance() as any).selectedFileName.get();
  },

  analyzing() {
    return (Template.instance() as any).analyzing.get();
  },

  analyzeProgress() {
    return (Template.instance() as any).analyzeProgress.get();
  },

  analyzeError() {
    return (Template.instance() as any).analyzeError.get();
  },

  metadata() {
    return (Template.instance() as any).metadata.get();
  },

  configs() {
    return (Template.instance() as any).configs.get();
  },

  selectedConfigCount() {
    return (Template.instance() as any).configs.get().filter((config: any) => config.selected).length;
  },

  selectedSupportedCount() {
    const configs = (Template.instance() as any).configs.get().filter((config: any) => config.selected);
    return configs.reduce((sum: any, config: any) => sum + (config.supportedCount || 0), 0);
  },

  analyzeDisabledAttr() {
    return (Template.instance() as any).selectedFileName.get() ? '' : 'disabled';
  },

  continueDisabledAttr() {
    const hasSelection = (Template.instance() as any).configs.get().some((config: any) => config.selected);
    return hasSelection ? '' : 'disabled';
  },

  generateDisabledAttr() {
    const template = (Template.instance() as any);
    const selected = template.configs.get().filter((config: any) => config.selected);
    if (template.joinMode.get()) {
      const hasSupported = selected.some((config: any) => config.supportedCount > 0);
      return hasSupported && template.joinedConfig.get().isValid ? '' : 'disabled';
    }
    const valid = selected.length > 0 && selected.every((config: any) => config.isValid);
    return valid ? '' : 'disabled';
  },

  backToConfigDisabledAttr() {
    return (Template.instance() as any).uploading.get() ? 'disabled' : '';
  },

  downloadDisabledAttr() {
    return (Template.instance() as any).generationResult.get() ? '' : 'disabled';
  },

  uploadDisabledAttr() {
    const template = (Template.instance() as any);
    return template.uploading.get() || !template.generationResult.get() ? 'disabled' : '';
  },

  selectedCheckedAttr() {
    return this?.selected ? 'checked' : '';
  },

  canContinueToConfig() {
    return (Template.instance() as any).configs.get().some((config: any) => config.selected);
  },

  canGenerate() {
    const template = (Template.instance() as any);
    const selected = template.configs.get().filter((config: any) => config.selected);
    if (template.joinMode.get()) {
      const hasSupported = selected.some((config: any) => config.supportedCount > 0);
      return hasSupported && template.joinedConfig.get().isValid;
    }
    return selected.length > 0 && selected.every((config: any) => config.isValid);
  },

  hasValidationError() {
    const template = (Template.instance() as any);
    if (template.joinMode.get()) {
      return false;
    }
    return template.configs.get().some((config: any) => config.selected && !config.isValid);
  },

  generating() {
    return (Template.instance() as any).generating.get();
  },

  generateProgress() {
    return (Template.instance() as any).generateProgress.get();
  },

  generateError() {
    return (Template.instance() as any).generateError.get();
  },

  generationResult() {
    return (Template.instance() as any).generationResult.get();
  },

  draftLessons() {
    return (Template.instance() as any).draftLessons.get();
  },

  updateDraftLessons() {
    const instance = Template.instance() as any;
    return (lessons: any) => {
      instance.draftLessons.set(lessons);
    };
  },

  backToSourceConfig() {
    const instance = Template.instance() as any;
    return () => {
      instance.wizardStep.set(2);
    };
  },

  saveDraftAndContinue() {
    const instance = Template.instance() as any;
    return async () => {
      const lessons = instance.draftLessons.get();
      if (!Array.isArray(lessons) || lessons.length === 0) {
        return;
      }

      instance.generating.set(true);
      instance.generateError.set(null);
      instance.generateProgress.set(0);
      instance.generationResult.set(null);

      try {
        instance.generateProgress.set(20);
        const result = await buildImportPackageFromDraftLessons(lessons);
        instance.generateProgress.set(100);
        instance.generationResult.set(result);

        const completed = instance.completedSteps.get();
        if (!completed.includes(3)) {
          instance.completedSteps.set([...completed, 3]);
        }
        // Navigate only after the result is ready so Step 4 never shows a
        // null result state.
        instance.wizardStep.set(4);
      } catch (error: any) {
        clientConsole(1, '[IMSCC WIZARD] Package build failed:', error);
        instance.generateError.set(error.reason || error.message || 'Failed to build package from edited drafts.');
        // Stay on Step 3 so the error is visible and the user can go back.
        instance.wizardStep.set(3);
      } finally {
        instance.generating.set(false);
      }
    };
  },

  uploadStatus() {
    return (Template.instance() as any).uploadStatus.get();
  },

  uploading() {
    return (Template.instance() as any).uploading.get();
  },

  uploadError() {
    return (Template.instance() as any).uploadError.get();
  },

  uploadComplete() {
    return (Template.instance() as any).uploadComplete.get();
  },

  formatDueDate(rawDate: any) {
    if (!rawDate) {
      return imsccText('imscc.noDueDate');
    }
    const date = new Date(rawDate);
    if (Number.isNaN(date.getTime())) {
      return rawDate;
    }
    return formatActiveInterfaceDateTime(date);
  },

  plusOne(index: any) {
    return index + 1;
  },

  unsupportedTypesLabel(types: any) {
    if (!Array.isArray(types) || !types.length) {
      return imsccText('imscc.none');
    }
    return types.join(', ');
  },

  unsupportedTypesSummary(types: any) {
    return imsccText('imscc.unsupportedTypes', {
      types: Array.isArray(types) && types.length ? types.join(', ') : imsccText('imscc.none')
    });
  },

  joinMode() {
    return (Template.instance() as any).joinMode.get();
  },

  joinModeToggleAttrs() {
    return (Template.instance() as any).joinMode.get() ? { checked: true } : {};
  },

  joinModeLabel() {
    return (Template.instance() as any).joinMode.get()
      ? imsccText('imscc.joinModeJoined')
      : imsccText('imscc.joinModeSeparate');
  },

  joinedConfig() {
    return (Template.instance() as any).joinedConfig.get();
  },

  joinedTotalSupported() {
    return (Template.instance() as any).configs.get()
      .filter((config: any) => config.selected)
      .reduce((sum: any, config: any) => sum + (config.supportedCount || 0), 0);
  },

  joinedBadgeLabel() {
    const template = Template.instance() as any;
    return imsccText('imscc.combinedBadge', {
      quizzes: template.configs.get().filter((config: any) => config.selected).length,
      questions: template.configs.get()
        .filter((config: any) => config.selected)
        .reduce((sum: any, config: any) => sum + (config.supportedCount || 0), 0)
    });
  },

  supportedCountLabel(count: any) {
    return imsccText('imscc.supportedCount', { count });
  },

  conversionSummaryLabel(config: any) {
    return imsccText('imscc.conversionSummaryCounts', {
      supported: config?.supportedCount || 0,
      unsupported: config?.unsupportedCount || 0
    });
  },

  manifestCardsLabel(count: any) {
    return imsccText('imscc.manifestCards', { count });
  },

  manifestSkippedLabel(count: any) {
    return imsccText('imscc.manifestSkipped', { count });
  },

  manifestMediaFilesLabel(count: any) {
    return imsccText('imscc.manifestMediaFiles', { count });
  }
});

Template.imsccWizard.events({
  'change #imscc-file-input': function(event: any, template: any) {
    const file = event.target.files[0];
    if (!file) {
      return;
    }
    template.selectedFile.set(file);
    template.selectedFileName.set(file.name);
    template.analyzeError.set(null);
    template.metadata.set(null);
    template.configs.set([]);
    template.draftLessons.set([]);
    template.generateError.set(null);
    template.generationResult.set(null);
    template.uploadError.set(null);
    template.uploadComplete.set(false);
  },

  'click #analyze-imscc': async function(event: any, template: any) {
    event.preventDefault();
    const file = template.selectedFile.get();
    if (!file) {
      template.analyzeError.set(imsccText('imscc.selectFileFirst'));
      return;
    }

    template.analyzing.set(true);
    template.analyzeProgress.set(0);
    template.analyzeError.set(null);
    template.generateError.set(null);
    template.uploadError.set(null);

    try {
      const { analyzeImscc, buildInitialImsccConfigs } = await getImsccProcessor();
      const metadata = await analyzeImscc(file, (progress: any) => {
        template.analyzeProgress.set(progress);
      });
      const configs = buildInitialImsccConfigs(metadata).map((config: any) => {
        const quiz = metadata.quizzes.find((q: any) => q.ident === config.ident);
        return {
          ...config,
          title: quiz?.title || config.title,
          dueAt: quiz?.dueAt,
          questionCount: quiz?.questionCount || 0,
          supportedCount: quiz?.supportedCount || 0,
          unsupportedCount: quiz?.unsupportedCount || 0,
          unsupportedTypes: quiz?.unsupportedTypes || []
        };
      });

      template.metadata.set(metadata);
      template.configs.set(configs);
      seedJoinedConfigName(template);
      template.wizardStep.set(2);
      const completed = template.completedSteps.get();
      if (!completed.includes(1)) {
        template.completedSteps.set([...completed, 1]);
      }
    } catch (error: any) {
      clientConsole(1, '[IMSCC WIZARD] Analyze failed:', error);
      template.analyzeError.set(error.reason || error.message || imsccText('imscc.analyzeFailed'));
    } finally {
      template.analyzing.set(false);
    }
  },

  'change .imscc-quiz-select': function(event: any, template: any) {
    const ident = event.currentTarget.dataset.ident;
    const checked = event.currentTarget.checked;
    const next = template.configs.get().map((config: any) => {
      if (config.ident !== ident) {
        return config;
      }
      return { ...config, selected: checked };
    });
    template.configs.set(next);
  },

  'input .imscc-tdf-name': function(event: any, template: any) {
    const ident = event.currentTarget.dataset.ident;
    const nextValue = event.currentTarget.value;

    const next = template.configs.get().map((config: any) => {
      if (config.ident !== ident) {
        return config;
      }
      const name = nextValue;
      const isValid = !!name.trim() && config.supportedCount > 0;
      const validationError = !name.trim()
        ? imsccText('imscc.tdfNameRequired')
        : (config.supportedCount <= 0 ? imsccText('imscc.noSupportedQuestionTypes') : null);

      return {
        ...config,
        name,
        isValid,
        validationError
      };
    });

    template.configs.set(next);
  },

  'input .imscc-instructions': function(event: any, template: any) {
    const ident = event.currentTarget.dataset.ident;
    const nextValue = event.currentTarget.value;

    const next = template.configs.get().map((config: any) => {
      if (config.ident !== ident) {
        return config;
      }
      return {
        ...config,
        instructions: nextValue
      };
    });

    template.configs.set(next);
  },

  'click #imscc-back-to-upload': function(event: any, template: any) {
    event.preventDefault();
    template.wizardStep.set(1);
  },

  'change #imscc-join-mode-toggle': function(event: any, template: any) {
    const isChecked = !!event.currentTarget.checked;
    template.joinMode.set(isChecked);
    if (isChecked) {
      seedJoinedConfigName(template);
    }
  },

  'input #imscc-joined-name': function(event: any, template: any) {
    const name = event.currentTarget.value;
    const current = template.joinedConfig.get();
    const isValid = !!name.trim();
    template.joinedConfig.set({ ...current, name, isValid, validationError: isValid ? null : imsccText('imscc.tdfNameRequired') });
  },

  'input #imscc-joined-instructions': function(event: any, template: any) {
    const instructions = event.currentTarget.value;
    const current = template.joinedConfig.get();
    template.joinedConfig.set({ ...current, instructions });
  },

  'click #open-imscc-draft-editor': async function(event: any, template: any) {
    event.preventDefault();
    const joinMode = template.joinMode.get();
    const metadata = template.metadata.get();
    const selectedConfigs = template.configs.get().filter((config: any) => config.selected);

    if (!metadata || !selectedConfigs.length) {
      template.generateError.set(imsccText('imscc.noQuizzesSelected'));
      return;
    }

    if (joinMode) {
      const joinedConfig = template.joinedConfig.get();
      if (!joinedConfig.isValid) {
        template.generateError.set(joinedConfig.validationError || imsccText('imscc.fixValidationBeforeGeneration'));
        return;
      }
      if (!selectedConfigs.some((config: any) => config.supportedCount > 0)) {
        template.generateError.set(imsccText('imscc.noSelectedSupportedQuestions'));
        return;
      }
    } else {
      if (selectedConfigs.some((config: any) => !config.isValid)) {
        template.generateError.set(imsccText('imscc.fixValidationBeforeGeneration'));
        return;
      }
    }

    template.generating.set(true);
    template.generateProgress.set(0);
    template.generateError.set(null);
    template.generationResult.set(null);
    template.draftLessons.set([]);
    template.uploadError.set(null);
    template.uploadComplete.set(false);

    try {
      if (joinMode) {
        const joinedConfig = template.joinedConfig.get();
        const validSelected = selectedConfigs.filter((config: any) => config.supportedCount > 0);
        const processConfigs = validSelected.map((config: any) => ({
          ident: config.ident,
          qtiPath: config.qtiPath,
          title: config.title
        }));
        const { buildJoinedDraftLessonFromImscc } = await getImsccProcessor();
        const lessons = await buildJoinedDraftLessonFromImscc(metadata, processConfigs, {
          name: joinedConfig.name,
          instructions: joinedConfig.instructions
        }, (progress: any) => {
          template.generateProgress.set(progress);
        });
        template.draftLessons.set(lessons);
      } else {
        const processConfigs = selectedConfigs.map((config: any) => ({
          ident: config.ident,
          qtiPath: config.qtiPath,
          title: config.title,
          name: config.name,
          instructions: config.instructions
        }));
        const { buildDraftLessonsFromImscc } = await getImsccProcessor();
        const lessons = await buildDraftLessonsFromImscc(metadata, processConfigs, (progress: any) => {
          template.generateProgress.set(progress);
        });
        template.draftLessons.set(lessons);
      }

      template.wizardStep.set(3);
      // Clear any stale packaging error from a previous Save and Continue attempt.
      template.generateError.set(null);
      const completed = template.completedSteps.get();
      if (!completed.includes(2)) {
        template.completedSteps.set([...completed, 2]);
      }
    } catch (error: any) {
      clientConsole(1, '[IMSCC WIZARD] Generation failed:', error);
      template.generateError.set(error.reason || error.message || imsccText('imscc.prepareDraftFailed'));
    } finally {
      template.generating.set(false);
    }
  },

  'click #imscc-back-to-config': function(event: any, template: any) {
    event.preventDefault();
    template.wizardStep.set(3);
  },

  'click #imscc-back-to-setup': function(event: any, template: any) {
    event.preventDefault();
    template.wizardStep.set(2);
  },

  'click #imscc-download-package': function(event: any, template: any) {
    event.preventDefault();
    const result = template.generationResult.get();
    if (!result?.zipBlob) {
      return;
    }

    const firstManifest = Array.isArray(result.manifest) && result.manifest.length > 0
      ? result.manifest[0]
      : null;
    const filename = result.mode === 'single' && firstManifest
      ? `${firstManifest.tdfName}.zip`
      : 'canvas-learning-package.zip';

    const url = URL.createObjectURL(result.zipBlob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  },

  'click #imscc-upload-to-mofacts': async function(event: any, template: any) {
    event.preventDefault();
    if (template.uploading.get()) {
      return;
    }

    const result = template.generationResult.get();
    if (!result?.zipBlob) {
      template.uploadError.set(imsccText('imscc.nothingToUpload'));
      return;
    }

    template.uploading.set(true);
    template.uploadError.set(null);
    template.uploadStatus.set({
      message: imsccText('imscc.preparingPackageUpload'),
      progress: 0
    });

    try {
      const firstManifest = Array.isArray(result.manifest) && result.manifest.length > 0
        ? result.manifest[0]
        : null;
      const baseName = result.mode === 'single' && firstManifest
        ? `${firstManifest.tdfName}.zip`
        : 'canvas-learning-package.zip';
      let uploadName = baseName;

      const existing = await (Meteor as any).callAsync('getUserAssetByName', uploadName);
      if (existing) {
        const stamp = Date.now();
        const ext = uploadName.endsWith('.zip') ? '.zip' : '';
        const stem = uploadName.replace(/\.zip$/i, '');
        uploadName = `${stem}_${stamp}${ext}`;
      }

      const file = new File([result.zipBlob], uploadName, { type: 'application/zip' });
      const { processing: processResult } = await uploadAndProcessPackage({
        dynamicAssets: DynamicAssets,
        file,
        getUploadIntegrity,
        callAsync: (Meteor as any).callAsync.bind(Meteor),
        userId: Meteor.userId(),
        onStart: () => template.uploadStatus.set({ message: imsccText('imscc.uploadingPackage'), progress: 5 }),
        onProgress: (progress) => template.uploadStatus.set({
          message: imsccText('imscc.uploadingPackage'),
          progress: Math.round(progress * 0.5)
        }),
        onProcessing: () => template.uploadStatus.set({ message: imsccText('imscc.processingPackage'), progress: 65 }),
        confirmUpdates: async (plan) => requestImsccConfirmation(template, plan),
      });
      for (const res of processResult.results) {
        if (!res?.result) {
          throw new Error(imsccText('imscc.packageUploadFailed', {
            error: res.errmsg || imsccText('imscc.unknownError')
          }));
        }
      }
      template.uploadStatus.set(null);
      template.uploadComplete.set(true);
      template.uploading.set(false);
      Session.set('assetsRefreshTrigger', Date.now());
    } catch (error: any) {
      clientConsole(1, '[IMSCC WIZARD] Upload setup failed:', error);
      template.uploadStatus.set(null);
      template.uploadError.set(error.reason || error.message || imsccText('imscc.packageProcessingFailed'));
      template.uploading.set(false);
    }
  },

  'click #close-imscc-wizard': function(event: any, template: any) {
    event.preventDefault();
    resetWizardState(template);
    const wizardContainer = $('#imscc-wizard-modal');
    if (wizardContainer.length && wizardContainer.is(':visible')) {
      wizardContainer.slideUp();
    }
  },

  'click #cancel-imscc-wizard': function(event: any, template: any) {
    event.preventDefault();
    resetWizardState(template);
    const wizardContainer = $('#imscc-wizard-modal');
    if (wizardContainer.length && wizardContainer.is(':visible')) {
      wizardContainer.slideUp();
    }
  },

  'click .admin-confirmation-cancel': function(event: any, template: any) {
    event.preventDefault();
    closeImsccConfirmation(template, false);
  },

  'click .admin-confirmation-confirm': function(event: any, template: any) {
    event.preventDefault();
    const controller = template.inlineConfirmationController as InlineConfirmationController<ImsccConfirmationContext>;
    if (!controller.getView().pending) closeImsccConfirmation(template, true);
  },

  'keydown #imscc-wizard-container': function(event: KeyboardEvent, template: any) {
    const controller = template.inlineConfirmationController as InlineConfirmationController<ImsccConfirmationContext>;
    const context = controller.getContext();
    if (controller.handleKeydown(event)) context?.resolve(false);
  }
});





