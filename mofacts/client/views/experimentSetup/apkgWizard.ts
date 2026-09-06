/**
 * Anki .apkg Import Wizard
 * Multi-step wizard for configuring and generating MoFaCTS TDFs from Anki decks
 *
 * All processing is done client-side using JSZip and sql.js (WebAssembly SQLite)
 * Only the final ZIP package is uploaded to the server
 */

import { Meteor } from 'meteor/meteor';
import { Template } from 'meteor/templating';
import './apkgWizard.html';
import './apkgWizard.css';
import { Session } from 'meteor/session';
import { ReactiveVar } from 'meteor/reactive-var';
import { Tracker } from 'meteor/tracker';
import { clientConsole } from '../..';
import { getErrorMessage } from '../../lib/errorUtils';
import { getImportIndexSelectionCount, parseImportIndexSpec } from '../../lib/importRangeUtils';
import { getUploadIntegrity } from '../../lib/uploadIntegrity';
import { uploadAndProcessPackage } from '../../lib/packageUploadClient';
import { translatePlatformString } from '../../lib/interfaceI18n';
import { getActiveUiLocale } from '../../lib/interfaceLocaleState';
import './draftEditorWorkspace';
import { buildImportPackageFromDraftLessons } from '../../lib/importPackageBuilder';
import {
  createInlineConfirmationController,
  type InlineConfirmationController,
} from '../../lib/adminUi/inlineConfirmationController';
import '../shared/adminUi/adminUi';

declare const $: any;
declare const DynamicAssets: any;

type PlatformStringKey = Parameters<typeof translatePlatformString>[1];

function apkgText(key: PlatformStringKey, values?: Parameters<typeof translatePlatformString>[2]): string {
  return translatePlatformString(getActiveUiLocale(), key, values);
}

let apkgProcessorPromise: Promise<any> | null = null;

async function getApkgProcessor() {
  if (!apkgProcessorPromise) {
    apkgProcessorPromise = import('../../lib/apkgProcessor');
  }
  return apkgProcessorPromise;
}

function setWizardMessage(template: any, type: string, title: string, text: string) {
  template.wizardMessageStep.set(template.wizardStep.get());
  template.wizardMessage.set({
    type,
    title,
    text,
    icon: type === 'success' ? 'fa-check-circle' : type === 'warning' ? 'fa-exclamation-triangle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'
  });
}

function clearWizardMessage(template: any) {
  template.wizardMessage.set(null);
}

type ApkgConfirmationContext = {
  resolve: (confirmed: boolean) => void;
};

function closeInlineConfirmation(template: any, confirmed: boolean) {
  const context = template.inlineConfirmationController.getContext() as ApkgConfirmationContext | undefined;
  const closed = confirmed
    ? template.inlineConfirmationController.complete()
    : template.inlineConfirmationController.cancel();
  if (closed) {
    context?.resolve(confirmed);
  }
}

function requestApkgConfirmation(template: any, options: any): Promise<boolean> {
  closeInlineConfirmation(template, false);
  clearWizardMessage(template);

  return new Promise(resolve => {
    const trigger = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : template.find('#apkg-wizard-container');
    template.inlineConfirmationController.open({
      confirmationId: `apkg-confirmation-${options.id}`,
      title: options.title,
      message: options.message,
      confirmLabel: options.confirmLabel || apkgText('common.continue'),
      cancelLabel: apkgText('apkg.cancel'),
      severity: options.confirmClass === 'btn-primary' ? 'warning' : 'danger',
      context: { resolve },
    }, trigger);
    Tracker.afterFlush(() => template.inlineConfirmationController.focusInitial(template.firstNode?.parentNode || document));
  });
}

// Template created hook - initialize reactive state
Template.apkgWizard.onCreated(function(this: any) {
  // Wizard state
  this.wizardStep = new ReactiveVar(1);
  this.completedSteps = new ReactiveVar([]);
  this.wizardMessage = new ReactiveVar(null);
  this.wizardMessageStep = new ReactiveVar(1);
  this.inlineConfirmation = new ReactiveVar(null);
  this.inlineConfirmationController = createInlineConfirmationController<ApkgConfirmationContext>(
    (view) => this.inlineConfirmation.set(view.status === 'open' ? view : null),
    () => this.find('#close-wizard'),
  );

  // File and metadata
  this.selectedFile = new ReactiveVar(null);
  this.selectedFileName = new ReactiveVar(null);
  this.deckMetadata = new ReactiveVar(null);

  // Analysis state
  this.analyzing = new ReactiveVar(false);
  this.analyzeError = new ReactiveVar(null);

  // Configuration state
  this.tdfConfigs = new ReactiveVar([{
    name: '',
    prompt: { field: null, fieldName: '', type: 'auto' },
    response: { field: null, fieldName: '', type: 'auto' },
    sourceRange: '',
    validationError: null,
    isValid: false
  }]);
  this.draftLessons = new ReactiveVar([]);

  // Generation state
  this.generating = new ReactiveVar(false);
  this.generationProgress = new ReactiveVar(0);
  this.currentGenerationStep = new ReactiveVar('');
  this.generateError = new ReactiveVar(null);
  this.generationComplete = new ReactiveVar(false);
  this.generationResult = new ReactiveVar(null);

  // Upload state
  this.uploadComplete = new ReactiveVar(false);
  this.uploadStatus = new ReactiveVar(null); // { message: string, progress: number, hint?: string }
  this.uploadError = new ReactiveVar(null);
});

// Template rendered hook - set select values from data attributes
Template.apkgWizard.onRendered(function(this: any) {
  // Set select values once on initial render (not reactively)
  // This allows user to change selections without them being reset
  Tracker.afterFlush(() => {
    $('.prompt-field, .response-field').each(function(this: any) {
      const selected = $(this).data('selected');
      if (selected !== null && selected !== undefined && selected !== '') {
        $(this).val(selected);
      }
    });
  });
});

Template.apkgWizard.onDestroyed(function(this: any) {
  const context = this.inlineConfirmationController.getContext() as ApkgConfirmationContext | undefined;
  this.inlineConfirmationController.destroy();
  context?.resolve(false);
});

// Helper functions
Template.apkgWizard.helpers({
  apkgText(key: PlatformStringKey, options?: { hash?: Parameters<typeof translatePlatformString>[2] }) {
    return apkgText(key, options?.hash);
  },

  // Step navigation
  isStep(num: any) {
    return (Template.instance() as any).wizardStep.get() === num;
  },

  stepCompleted(num: any) {
    return (Template.instance() as any).completedSteps.get().includes(num);
  },

  // Step 1: Upload
  selectedFileName() {
    return (Template.instance() as any).selectedFileName.get();
  },

  analyzing() {
    return (Template.instance() as any).analyzing.get();
  },

  analyzeError() {
    return (Template.instance() as any).analyzeError.get();
  },

  // Step 2: Preview
  deckMetadata() {
    return (Template.instance() as any).deckMetadata.get();
  },

  importableNoteCount() {
    const metadata = (Template.instance() as any).deckMetadata.get();
    return getImportableNoteCount(metadata);
  },

  fieldTypeBadge(type: any) {
    const badges = {
      'text': 'text',
      'image': 'image',
      'mixed': 'mixed',
      'audio': 'audio'
    };
    return (badges as any)[type] || 'text';
  },

  joinSamples(samples: any) {
    if (!samples || samples.length === 0) return apkgText('apkg.noSamples');
    const sampleText = samples
      .map((s: any) => s.replace(/<[^>]+>/g, '').substring(0, 50))
      .join(', ');
    return apkgText('apkg.samples', { samples: sampleText });
  },

  eq(a: any, b: any) {
    return a === b;
  },

  // Step 3: Configure
  tdfConfigs() {
    return (Template.instance() as any).tdfConfigs.get();
  },

  isMultipleMode() {
    return (Template.instance() as any).tdfConfigs.get().length > 1;
  },

  isSingleMode() {
    return (Template.instance() as any).tdfConfigs.get().length === 1;
  },

  configCount() {
    return (Template.instance() as any).tdfConfigs.get().length;
  },

  totalCards() {
    const metadata = (Template.instance() as any).deckMetadata.get();
    const configs = (Template.instance() as any).tdfConfigs.get();
    if (!metadata) return 0;
    return configs.reduce((sum: number, config: any) => sum + getConfigNoteCount(config, metadata), 0);
  },

  totalMedia() {
    const metadata = (Template.instance() as any).deckMetadata.get();
    const configs = (Template.instance() as any).tdfConfigs.get();
    if (!metadata) return 0;

    let total = 0;
    configs.forEach((config: any) => {
      if (config.prompt.field !== null) {
        const field = metadata.fields[config.prompt.field];
        if (field && field.hasImages) {
          total += getConfigNoteCount(config, metadata);
        }
      }
    });
    return total;
  },

  allConfigsValid() {
    const configs = (Template.instance() as any).tdfConfigs.get();
    return configs.every((c: any) => c.isValid && !c.validationError);
  },

  deckFields() {
    const metadata = (Template.instance() as any).deckMetadata.get();
    return metadata ? metadata.fields : [];
  },

  plusOne(index: any) {
    return index + 1;
  },

  hideAddButton() {
    return (Template.instance() as any).tdfConfigs.get().length >= 10;
  },

  selectedNoteCount(config: any) {
    const metadata = (Template.instance() as any).deckMetadata.get();
    return metadata ? getConfigNoteCount(config, metadata) : 0;
  },

  selectedNoteSummary(config: any) {
    const metadata = (Template.instance() as any).deckMetadata.get();
    const selected = metadata ? getConfigNoteCount(config, metadata) : 0;
    const total = getImportableNoteCount(metadata);
    const key = metadata && selected !== metadata.noteCount ? 'apkg.usesImportableNotesSubset' : 'apkg.usesImportableNotes';
    return apkgText(key, { selected, total });
  },

  usingSubset(config: any) {
    const metadata = (Template.instance() as any).deckMetadata.get();
    return metadata ? getConfigNoteCount(config, metadata) !== metadata.noteCount : false;
  },

  tdfConfiguredSummary() {
    const count = (Template.instance() as any).tdfConfigs.get().length;
    return apkgText('apkg.tdfConfigured', { count, plural: count === 1 ? '' : 's' });
  },

  totalCardsGeneratedSummary() {
    const metadata = (Template.instance() as any).deckMetadata.get();
    const configs = (Template.instance() as any).tdfConfigs.get();
    const count = metadata ? configs.reduce((sum: number, config: any) => sum + getConfigNoteCount(config, metadata), 0) : 0;
    return apkgText('apkg.totalCardsGenerated', { count });
  },

  mediaFilesIncludedSummary() {
    const metadata = (Template.instance() as any).deckMetadata.get();
    const configs = (Template.instance() as any).tdfConfigs.get();
    let count = 0;
    if (metadata) {
      configs.forEach((config: any) => {
        if (config.prompt.field !== null) {
          const field = metadata.fields[config.prompt.field];
          if (field && field.hasImages) {
            count += getConfigNoteCount(config, metadata);
          }
        }
      });
    }
    return apkgText('apkg.mediaFilesIncluded', { count });
  },

  // Step 4: Generate
  generating() {
    return (Template.instance() as any).generating.get();
  },

  generationProgress() {
    return (Template.instance() as any).generationProgress.get();
  },

  currentGenerationStep() {
    return (Template.instance() as any).currentGenerationStep.get();
  },

  generateError() {
    return (Template.instance() as any).generateError.get();
  },

  generationComplete() {
    return (Template.instance() as any).generationComplete.get();
  },

  generationResult() {
    return (Template.instance() as any).generationResult.get();
  },

  step4Title() {
    const instance = Template.instance() as any;
    return apkgText(instance.generationComplete.get() ? 'apkg.step4TitleReady' : 'apkg.step4TitleGenerating');
  },

  generatingTdfsLabel() {
    const count = (Template.instance() as any).tdfConfigs.get().length;
    return apkgText('apkg.generatingTdfs', { plural: count === 1 ? '' : 's' });
  },

  skippedCardsSummary() {
    const result = (Template.instance() as any).generationResult.get();
    return apkgText('apkg.skippedCards', { count: result?.totalSkipped ?? 0 });
  },

  generatedManifestLine(entry: any) {
    const media = entry?.mediaCount ? apkgText('apkg.generatedFileMedia', { count: entry.mediaCount }) : '';
    const skipped = entry?.skippedCount ? apkgText('apkg.generatedFileSkipped', { count: entry.skippedCount }) : '';
    return apkgText('apkg.generatedFileLine', {
      tdfName: entry?.tdfName ?? '',
      cards: entry?.cardCount ?? 0
    }) + media + skipped;
  },

  generatedTotalLine() {
    const result = (Template.instance() as any).generationResult.get();
    const skipped = result?.totalSkipped ? apkgText('apkg.generatedFileSkipped', { count: result.totalSkipped }) : '';
    return apkgText('apkg.generatedTotal', {
      cards: result?.totalCards ?? 0,
      media: result?.totalMedia ?? 0,
      skipped
    });
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
      instance.generationProgress.set(0);
      instance.currentGenerationStep.set(apkgText('apkg.packagingEditedDraft'));

      try {
        const result = await buildImportPackageFromDraftLessons(lessons);
        instance.generationProgress.set(100);
        instance.currentGenerationStep.set(apkgText('apkg.packageReady'));
        instance.generationResult.set(result);
        instance.generationComplete.set(true);
        // Navigate only after the result is ready so Step 4 never shows an
        // empty/null result state.
        instance.wizardStep.set(4);
      } catch (error: unknown) {
        clientConsole(1, 'Error packaging edited APKG draft:', error);
        const reason = typeof error === 'object' && error !== null && 'reason' in error && typeof (error as { reason?: unknown }).reason === 'string'
          ? (error as { reason?: string }).reason
          : undefined;
        instance.generateError.set(reason || getErrorMessage(error));
        // Stay on Step 3 so the user can see the error and go back.
        instance.wizardStep.set(3);
      } finally {
        instance.generating.set(false);
      }
    };
  },

  mediaFileCount(mediaFiles: any) {
    return mediaFiles ? Object.keys(mediaFiles).length : 0;
  },

  uploadComplete() {
    return (Template.instance() as any).uploadComplete.get();
  },

  uploadStatus() {
    return (Template.instance() as any).uploadStatus.get();
  },

  uploadError() {
    return (Template.instance() as any).uploadError.get();
  },

  wizardMessage() {
    return (Template.instance() as any).wizardMessage.get();
  },

  inlineConfirmation() {
    return (Template.instance() as any).inlineConfirmation.get();
  },

  stepWizardMessage(step: number) {
    const instance = Template.instance() as any;
    return instance.wizardMessageStep.get() === Number(step) ? instance.wizardMessage.get() : null;
  },

  stepInlineConfirmation(step: number) {
    const instance = Template.instance() as any;
    return instance.wizardStep.get() === Number(step) ? instance.inlineConfirmation.get() : null;
  },

  analyzeDisabled() {
    return !(Template.instance() as any).selectedFileName.get();
  }
});

// Event handlers
Template.apkgWizard.events({
  // Step 1: Upload & Analyze
  'change #apkg-file-input': function(event: any, template: any) {
    const file = event.target.files[0];
    if (file) {
      clearWizardMessage(template);
      closeInlineConfirmation(template, false);
      template.selectedFile.set(file);
      template.selectedFileName.set(file.name);
      template.analyzeError.set(null);
    }
  },

  'click #analyze-deck': async function(event: any, template: any) {
    const file = template.selectedFile.get();
    if (!file) return;

    template.analyzing.set(true);
    template.analyzeError.set(null);

    try {
      const { analyzeApkg } = await getApkgProcessor();
      // Analyze file entirely client-side (no upload needed)
      const metadata = await analyzeApkg(file, (_progress: any) => {
        // Could update a progress bar here if desired
        
      });

      // Store metadata for later use
      template.deckMetadata.set(metadata);

      // Mark step 1 complete and advance
      const completed = template.completedSteps.get();
      if (!completed.includes(1)) {
        template.completedSteps.set([...completed, 1]);
      }
      template.wizardStep.set(2);

    } catch (error: unknown) {
      clientConsole(1, 'Error analyzing .apkg:', error);
      const reason = typeof error === 'object' && error !== null && 'reason' in error && typeof (error as { reason?: unknown }).reason === 'string'
        ? (error as { reason?: string }).reason
        : undefined;
      template.analyzeError.set(reason || getErrorMessage(error));
    } finally {
      template.analyzing.set(false);
    }
  },

  'click #cancel-wizard': async function(event: any, template: any) {
    event.preventDefault();
    const confirmed = await requestApkgConfirmation(template, {
      id: 'cancel-wizard',
      title: apkgText('apkg.cancelImportTitle'),
      message: apkgText('apkg.cancelImportMessage'),
      confirmLabel: apkgText('apkg.cancelImportConfirm')
    });

    if (confirmed) {
      // Reset wizard
      template.wizardStep.set(1);
      template.completedSteps.set([]);
      template.selectedFile.set(null);
      template.selectedFileName.set(null);
      template.deckMetadata.set(null);
      closeInlineConfirmation(template, false);
    }
  },

  // Step 2: Preview
  'click #back-to-upload': function(event: any, template: any) {
    template.wizardStep.set(1);
  },

  // Step 2: Configure
  'input .tdf-name': function(event: any, template: any) {
    const index = parseInt(event.target.dataset.index);
    const name = event.target.value;
    const configs = template.tdfConfigs.get();
    configs[index].name = name;
    validateConfig(configs[index], template.deckMetadata.get());
    template.tdfConfigs.set(configs);
  },

  'input .source-range': function(event: any, template: any) {
    const index = parseInt(event.target.dataset.index);
    const configs = template.tdfConfigs.get();
    configs[index].sourceRange = event.target.value;
    validateConfig(configs[index], template.deckMetadata.get());
    template.tdfConfigs.set(configs);
  },

  'change .prompt-field': function(event: any, template: any) {
    const index = parseInt(event.target.dataset.index);
    const fieldIndex = parseInt(event.target.value);
    const configs = template.tdfConfigs.get();
    const metadata = template.deckMetadata.get();

    if (!isNaN(fieldIndex) && metadata) {
      const field = metadata.fields[fieldIndex];
      configs[index].prompt = {
        field: fieldIndex,
        fieldName: field.name,
        type: field.type
      };
    } else {
      configs[index].prompt = { field: null, fieldName: '', type: 'auto' };
    }

    validateConfig(configs[index], metadata);
    template.tdfConfigs.set(configs);
  },

  'change .response-field': function(event: any, template: any) {
    const index = parseInt(event.target.dataset.index);
    const fieldIndex = parseInt(event.target.value);
    const configs = template.tdfConfigs.get();
    const metadata = template.deckMetadata.get();

    if (!isNaN(fieldIndex) && metadata) {
      const field = metadata.fields[fieldIndex];
      configs[index].response = {
        field: fieldIndex,
        fieldName: field.name,
        type: field.type
      };
    } else {
      configs[index].response = { field: null, fieldName: '', type: 'auto' };
    }

    validateConfig(configs[index], metadata);
    template.tdfConfigs.set(configs);
  },

  'click #add-tdf-config': function(event: any, template: any) {
    clearWizardMessage(template);
    closeInlineConfirmation(template, false);
    const configs = template.tdfConfigs.get();
    const newConfig = {
      name: '',
      prompt: { field: null, fieldName: '', type: 'auto' },
      response: { field: null, fieldName: '', type: 'auto' },
      sourceRange: '',
      validationError: null,
      isValid: false
    };
    configs.push(newConfig);
    template.tdfConfigs.set(configs);
  },

  'click .remove-config': async function(event: any, template: any) {
    const index = parseInt(event.currentTarget.dataset.index);
    const configs = template.tdfConfigs.get();

    if (configs.length === 1) {
      setWizardMessage(template, 'warning', apkgText('apkg.configRequiredTitle'), apkgText('apkg.configRequiredMessage'));
      return;
    }

    const confirmed = await requestApkgConfirmation(template, {
      id: `remove-config-${index}`,
      title: apkgText('apkg.removeConfigTitle'),
      message: apkgText('apkg.removeConfigMessage'),
      confirmLabel: apkgText('apkg.removeConfiguration')
    });

    if (confirmed) {
      configs.splice(index, 1);
      template.tdfConfigs.set(configs);
      closeInlineConfirmation(template, false);
    }
  },

  'click #open-draft-editor': async function(event: any, template: any) {
    const configs = template.tdfConfigs.get();
    const metadata = template.deckMetadata.get();

    if (!metadata || !configs.every((c: any) => c.isValid)) return;

    template.generating.set(true);
    template.generateError.set(null);
    template.generationProgress.set(0);
    template.currentGenerationStep.set(apkgText('apkg.preparingGeneration'));

    try {
      // Prepare configs for processing
      const processConfigs = configs.map((c: any) => ({
        name: c.name,
        sourceRange: c.sourceRange,
        prompt: {
          field: c.prompt.field,
          type: c.prompt.type
        },
        response: {
          field: c.response.field,
          type: c.response.type
        }
      }));

      template.currentGenerationStep.set(apkgText('apkg.generatingTdfsProgress'));

      const { buildDraftLessonsFromApkg } = await getApkgProcessor();
      const result = await buildDraftLessonsFromApkg(metadata, processConfigs, (progress: any) => {
        template.generationProgress.set(progress);
      });

      template.generationProgress.set(100);
      template.currentGenerationStep.set(apkgText('apkg.draftReady'));

      template.draftLessons.set(result);

      // Mark step complete and advance; clear any stale packaging error from
      // a previous Save and Continue attempt.
      template.generateError.set(null);
      template.wizardStep.set(3);

    } catch (error: unknown) {
      clientConsole(1, 'Error generating APKG draft lessons:', error);
      const reason = typeof error === 'object' && error !== null && 'reason' in error && typeof (error as { reason?: unknown }).reason === 'string'
        ? (error as { reason?: string }).reason
        : undefined;
      template.generateError.set(reason || getErrorMessage(error));
    } finally {
      template.generating.set(false);
    }
  },

  'click #back-to-config-error': function(event: any, template: any) {
    template.wizardStep.set(2);
    template.generateError.set(null);
  },

  // Step 4: Generate & Upload
  'click #download-package': async function(event: any, template: any) {
    const result = template.generationResult.get();
    if (!result?.zipBlob) return;

    try {
      // Trigger download
      const url = URL.createObjectURL(result.zipBlob);
      const a = document.createElement('a');
      a.href = url;
      const firstManifest = Array.isArray(result.manifest) && result.manifest.length > 0 ? result.manifest[0] : null;
      a.download = result.mode === 'single' && firstManifest
        ? `${firstManifest.tdfName}.zip`
        : 'learning-package.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

    } catch (error: unknown) {
      clientConsole(1, 'Error downloading package:', error);
      setWizardMessage(template, 'error', apkgText('apkg.errorCreatingDownload'), getErrorMessage(error));
    }
  },

  'click #upload-to-mofacts': async function(event: any, template: any) {
    const result = template.generationResult.get();
    if (!result?.zipBlob) return;

    // Clear any previous error
    template.uploadError.set(null);

    try {
      const firstManifest = Array.isArray(result.manifest) && result.manifest.length > 0 ? result.manifest[0] : null;
      const filename = result.mode === 'single' && firstManifest
        ? `${firstManifest.tdfName}.zip`
        : 'learning-package.zip';

      // Create File object from blob
      const file = new File([result.zipBlob], filename, { type: 'application/zip' });

      // Upload using DynamicAssets (same pattern as doPackageUpload)
      const existingFile = await DynamicAssets.findOne({ name: file.name, userId: Meteor.userId() });
      if (existingFile) {
        const confirmed = await requestApkgConfirmation(template, {
          id: 'overwrite-package',
          title: apkgText('apkg.overwritePackageTitle'),
          message: apkgText('apkg.overwritePackageMessage'),
          confirmLabel: apkgText('apkg.overwriteAndUpload')
        });

        if (confirmed) {
          await (Meteor as any).callAsync('removeAssetById', existingFile._id);
          closeInlineConfirmation(template, false);
        } else {
          return;
        }
      }

      const { processing: processResult } = await uploadAndProcessPackage({
        dynamicAssets: DynamicAssets,
        file,
        getUploadIntegrity,
        callAsync: (Meteor as any).callAsync.bind(Meteor),
        userId: Meteor.userId(),
        onStart: () => template.uploadStatus.set({ message: apkgText('apkg.uploadingPackage'), progress: 0 }),
        onProgress: (progress) => template.uploadStatus.set({
          message: apkgText('apkg.uploadingPackage'),
          progress: Math.round(progress * 0.5)
        }),
        onProcessing: () => template.uploadStatus.set({
          message: apkgText('apkg.extractingValidatingTdfs'),
          progress: 65,
          hint: apkgText('apkg.largePackageHint')
        }),
        confirmUpdates: async (plan) => requestApkgConfirmation(template, {
          id: `overwrite-package-${plan.uploadPlanId}`,
          title: apkgText('apkg.overwriteTdfTitle'),
          message: plan.updates.map((entry: any) => apkgText('content.previousTdfOverwriteMessage', {
            filename: entry.lessonName || entry.fileName || entry.tdfId,
          })).join(' '),
          confirmLabel: apkgText('apkg.overwriteContent'),
        }),
      });
      template.uploadStatus.set({ message: apkgText('apkg.finalizingUpload'), progress: 85 });
      for (const res of processResult.results) {
        if (!res.result) {
          throw new Error(apkgText('apkg.packageUploadFailed', { error: res.errmsg }));
        }
      }
      template.uploadStatus.set(null);
      template.uploadComplete.set(true);
      Session.set('assetsRefreshTrigger', Date.now());

    } catch (error: unknown) {
      clientConsole(1, 'Error uploading package:', error);
      template.uploadError.set(apkgText('apkg.uploadingError', { error: getErrorMessage(error) }));
    }
  },
  'click #close-wizard': async function(event: any, template: any) {
    event.preventDefault();
    // Reset wizard and close
    const confirmed = await requestApkgConfirmation(template, {
      id: 'close-wizard',
      title: apkgText('apkg.closeWizardTitle'),
      message: apkgText('apkg.closeWizardMessage'),
      confirmLabel: apkgText('apkg.closeWizard'),
      confirmClass: 'btn-primary',
      icon: 'fa-check-circle'
    });

    if (confirmed) {
      location.reload();
    }
  },

  'click .admin-confirmation-cancel': function(event: any, template: any) {
    event.preventDefault();
    closeInlineConfirmation(template, false);
  },

  'click .admin-confirmation-confirm': function(event: any, template: any) {
    event.preventDefault();
    const controller = template.inlineConfirmationController as InlineConfirmationController<ApkgConfirmationContext>;
    if (controller.getView().pending) {
      return;
    }
    closeInlineConfirmation(template, true);
  },

  'keydown #apkg-wizard-container': function(event: KeyboardEvent, template: any) {
    const controller = template.inlineConfirmationController as InlineConfirmationController<ApkgConfirmationContext>;
    const context = controller.getContext();
    if (controller.handleKeydown(event)) {
      context?.resolve(false);
    }
  }
});

// Helper function to validate a config
function validateConfig(config: any, metadata: any) {
  if (!metadata) {
    config.validationError = apkgText('apkg.validationMetadataNotLoaded');
    config.isValid = false;
    return;
  }

  // Check name
  if (!config.name || config.name.trim() === '') {
    config.validationError = apkgText('apkg.validationTdfNameRequired');
    config.isValid = false;
    return;
  }

  // Check prompt field
  if (config.prompt.field === null || config.prompt.field === undefined) {
    config.validationError = apkgText('apkg.validationPromptRequired');
    config.isValid = false;
    return;
  }

  // Check response field
  if (config.response.field === null || config.response.field === undefined) {
    config.validationError = apkgText('apkg.validationResponseRequired');
    config.isValid = false;
    return;
  }

  // Check they're different
  if (config.prompt.field === config.response.field) {
    config.validationError = apkgText('apkg.validationDifferentFields');
    config.isValid = false;
    return;
  }

  const parsedRange = parseImportIndexSpec(config.sourceRange, getImportableNoteCount(metadata));
  if (!parsedRange.valid) {
    config.validationError = apkgText('apkg.validationInvalidNoteRange');
    config.isValid = false;
    return;
  }

  if (parsedRange.indexes && parsedRange.indexes.length === 0) {
    config.validationError = apkgText('apkg.validationEmptyNoteRange');
    config.isValid = false;
    return;
  }

  // All valid
  config.validationError = null;
  config.isValid = true;

  // Set media info
  const promptField = metadata.fields[config.prompt.field];
  config.hasMedia = promptField && promptField.hasImages;
  config.mediaType = promptField ? promptField.type : 'unknown';
}

function getConfigNoteCount(config: any, metadata: any) {
  const totalCount = getImportableNoteCount(metadata);
  if (!totalCount) return 0;
  return getImportIndexSelectionCount(config?.sourceRange, totalCount);
}

function getImportableNoteCount(metadata: any) {
  return Number(metadata?._primaryModelNoteCount || metadata?.importableNoteCount || metadata?.noteCount || 0);
}





