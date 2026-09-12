import { Meteor } from 'meteor/meteor';
import { Template } from 'meteor/templating';
import { Session } from 'meteor/session';
import { ReactiveVar } from 'meteor/reactive-var';
import { Tracker } from 'meteor/tracker';
import './audioSettings.html';
import './audioSettings.css';
import './shared/adminUi/adminUi';
import {
  setTtsWarmedUp,
  getSrWarmedUp,
  setSrWarmedUp,
  setAudioInputSensitivity,
  setAudioInputSensitivityView,
  setAudioPromptMode,
  setAudioPromptFeedbackView,
  setAudioPromptQuestionVolume,
  setAudioPromptFeedbackVolume,
  setAudioPromptQuestionSpeakingRate,
  setAudioPromptFeedbackSpeakingRate,
  setAudioPromptQuestionSpeakingRateView,
  setAudioPromptFeedbackSpeakingRateView,
  setAudioPromptVoice,
  setAudioPromptFeedbackVoice,
  setAudioPromptVoiceView,
  setAudioPromptFeedbackVoiceView,
} from '../lib/state/audioState';
import { getErrorMessage } from '../lib/errorUtils';
import { evaluateSrAvailability } from '../lib/audioAvailability';
import { resolveExplicitTtsLanguageCode } from '../lib/audioLanguage';
import { resolveSpeechRecognitionLanguage } from '../lib/speechRecognitionConfig';
import { clientConsole } from '../lib/userSessionHelpers';
import { getActiveUiLocale } from '../lib/interfaceLocaleState';
import { translatePlatformString } from '../lib/interfaceI18n';
import {
  createAsyncCommandController,
  type AsyncCommandController,
  type AsyncCommandState,
} from '../lib/adminUi/asyncCommandState';
import { createScopedAsyncCommandRegistry, type ScopedAsyncCommandRegistry } from '../lib/adminUi/scopedAsyncCommandRegistry';
import {
  rejectLoad,
  resolveLoad,
  startLoad,
  type LoadableState,
} from '../lib/adminUi/loadableState';
import { createTemplateLifetime, type TemplateLifetime } from '../lib/adminUi/templateLifetime';
import {
  createInlineConfirmationController,
  type InlineConfirmationController,
  type InlineConfirmationView,
} from '../lib/adminUi/inlineConfirmationController';
import {
  AUDIO_INPUT_SENSITIVITY_MAX,
  AUDIO_INPUT_SENSITIVITY_MIN,
  normalizeAudioInputSensitivity,
  normalizeAudioSettings,
  parsePublishedAudioSettings,
  promptControlsVisible,
  promptFeedbackEnabled,
  promptModeFromToggles,
  promptQuestionEnabled,
  rangeProgress,
  type AudioSettingsForm,
} from './audioSettingsState';

type AudioSettingsMessage = Readonly<{
  level: 'success' | 'error';
  text: string;
}>;
type AudioSettingsScope = 'tts' | 'speech-input' | 'speech-api-key';
type AudioSettingsCommandScope = Exclude<AudioSettingsScope, 'speech-api-key'>;

type AudioSettingsInstance = Blaze.TemplateInstance & {
  settingsPresentation: ReactiveVar<LoadableState<AudioSettingsForm>>;
  keyPresentation: ReactiveVar<LoadableState<boolean>>;
  settingsCommandStates: ReactiveVar<Partial<Record<AudioSettingsCommandScope, AsyncCommandState<void>>>>;
  keyCommandState: ReactiveVar<AsyncCommandState<void>>;
  audioSettingsMessages: ReactiveVar<Partial<Record<AudioSettingsScope, AudioSettingsMessage>>>;
  volumeDraft: ReactiveVar<number>;
  sensitivityDraft: ReactiveVar<number>;
  speechApiDraft: ReactiveVar<string>;
  settingsCommandRegistry: ScopedAsyncCommandRegistry<void>;
  keyCommand: AsyncCommandController<void>;
  confirmationState: ReactiveVar<InlineConfirmationView>;
  confirmationController: InlineConfirmationController<'delete-speech-api-key'>;
  settingsLifetime: TemplateLifetime;
  keyLifetime: TemplateLifetime;
  nextSettingsRequestId: number;
  nextKeyRequestId: number;
};

function audioText(
  key: Parameters<typeof translatePlatformString>[1],
  values?: Parameters<typeof translatePlatformString>[2],
): string {
  return translatePlatformString(getActiveUiLocale(), key, values);
}

function sharedVolume(settings: AudioSettingsForm): number {
  return settings.audioPromptQuestionVolume || settings.audioPromptFeedbackVolume || 0;
}

function sharedSpeakingRate(settings: AudioSettingsForm): number {
  return settings.audioPromptQuestionSpeakingRate || settings.audioPromptFeedbackSpeakingRate || 1;
}

function sharedVoice(settings: AudioSettingsForm): string {
  return settings.audioPromptVoice || settings.audioPromptFeedbackVoice || 'en-US-Standard-A';
}

function readySettings(instance: AudioSettingsInstance): AudioSettingsForm | null {
  const state = instance.settingsPresentation.get();
  return state.status === 'ready' || state.status === 'refreshing' || state.status === 'refresh-error'
    ? state.value
    : null;
}

function publishReadySettings(instance: AudioSettingsInstance, settings: AudioSettingsForm): void {
  instance.settingsPresentation.set({ status: 'ready', value: settings });
}

function applyRuntimeAudioSettings(settings: AudioSettingsForm): void {
  const volume = sharedVolume(settings);
  const speakingRate = sharedSpeakingRate(settings);
  const voice = sharedVoice(settings);
  setAudioPromptMode(settings.audioPromptMode);
  setAudioPromptFeedbackView(promptFeedbackEnabled(settings));
  setAudioPromptQuestionVolume(volume);
  setAudioPromptFeedbackVolume(volume);
  setAudioPromptQuestionSpeakingRate(speakingRate);
  setAudioPromptFeedbackSpeakingRate(speakingRate);
  setAudioPromptQuestionSpeakingRateView(speakingRate);
  setAudioPromptFeedbackSpeakingRateView(speakingRate);
  setAudioPromptVoice(voice);
  setAudioPromptVoiceView(voice);
  setAudioPromptFeedbackVoice(voice);
  setAudioPromptFeedbackVoiceView(voice);
  setAudioInputSensitivity(settings.audioInputSensitivity);
  setAudioInputSensitivityView(settings.audioInputSensitivity);
}

function settingSaveError(error: unknown): string {
  return audioText('audio.failedSaveAudioSettings', { error: getErrorMessage(error) });
}

function setAudioSettingsMessage(
  instance: AudioSettingsInstance,
  scope: AudioSettingsScope,
  message: AudioSettingsMessage | null,
): void {
  const messages = { ...instance.audioSettingsMessages.get() };
  if (message) messages[scope] = message;
  else delete messages[scope];
  instance.audioSettingsMessages.set(messages);
}

async function saveSettings(
  instance: AudioSettingsInstance,
  nextSettings: AudioSettingsForm,
  scope: 'tts' | 'speech-input',
  onActivated?: () => void,
): Promise<void> {
  const previousSettings = readySettings(instance);
  if (!previousSettings) return;

  setAudioSettingsMessage(instance, scope, null);
  await instance.settingsCommandRegistry.run(scope, async () => {
    publishReadySettings(instance, nextSettings);
    applyRuntimeAudioSettings(nextSettings);
    onActivated?.();
    await (Meteor as typeof Meteor & { callAsync: (name: string, ...args: unknown[]) => Promise<void> })
      .callAsync('saveAudioSettings', nextSettings);
  }, {
    getErrorMessage: settingSaveError,
    onFailure: (error: unknown) => {
      publishReadySettings(instance, previousSettings);
      instance.volumeDraft.set(sharedVolume(previousSettings));
      instance.sensitivityDraft.set(previousSettings.audioInputSensitivity);
      applyRuntimeAudioSettings(previousSettings);
      setAudioSettingsMessage(instance, scope, { level: 'error', text: settingSaveError(error) });
    },
  });
}

async function loadSpeechApiKeyStatus(instance: AudioSettingsInstance): Promise<void> {
  const requestId = ++instance.nextKeyRequestId;
  const generation = instance.keyLifetime.begin();
  instance.keyPresentation.set(startLoad(instance.keyPresentation.get(), requestId));
  try {
    const configured = await (Meteor as typeof Meteor & {
      callAsync: (name: string) => Promise<unknown>;
    }).callAsync('isUserSpeechAPIKeySetup');
    if (!instance.keyLifetime.isCurrent(generation)) return;
    instance.keyPresentation.set(resolveLoad(
      instance.keyPresentation.get(),
      requestId,
      configured === true,
      () => false,
    ));
  } catch (error: unknown) {
    if (!instance.keyLifetime.isCurrent(generation)) return;
    instance.keyPresentation.set(rejectLoad(
      instance.keyPresentation.get(),
      requestId,
      {
        message: audioText('audio.speechApiKeyStatusFailed', { error: getErrorMessage(error) }),
        retryable: true,
      },
    ));
  }
}

function loadAudioSettings(instance: AudioSettingsInstance): void {
  const requestId = ++instance.nextSettingsRequestId;
  const generation = instance.settingsLifetime.begin();
  instance.settingsPresentation.set(startLoad(instance.settingsPresentation.get(), requestId));
  instance.subscribe('userAudioSettings', {
    onReady: () => {
      if (!instance.settingsLifetime.isCurrent(generation)) return;
      const user = Meteor.user() as { speechAPIKey?: string; audioSettings?: unknown } | null;
      let settings: AudioSettingsForm;
      try {
        settings = parsePublishedAudioSettings(user?.audioSettings);
      } catch (error: unknown) {
        instance.settingsPresentation.set(rejectLoad(
          instance.settingsPresentation.get(),
          requestId,
          {
            message: audioText('audio.settingsLoadFailed', { error: getErrorMessage(error) }),
            retryable: true,
          },
        ));
        return;
      }
      instance.settingsPresentation.set(resolveLoad(
        instance.settingsPresentation.get(),
        requestId,
        settings,
        () => false,
      ));
      instance.volumeDraft.set(sharedVolume(settings));
      instance.sensitivityDraft.set(settings.audioInputSensitivity);
      applyRuntimeAudioSettings(settings);

      const srAvailability = evaluateSrAvailability({
        user: {
          ...(user?.speechAPIKey ? { speechAPIKey: user.speechAPIKey } : {}),
          audioSettings: { audioInputMode: settings.audioInputMode },
        },
        tdfFile: Session.get('currentTdfFile'),
        sessionSpeechApiKey: Session.get('speechAPIKey'),
        serverSpeechConfigured: Session.get('speechAPIKeyConfigured'),
      });
      clientConsole(2, '[Audio Settings] SR availability evaluated', srAvailability);
      if (instance.keyPresentation.get().status === 'idle') {
        void loadSpeechApiKeyStatus(instance);
      }
    },
    onStop: (error?: unknown) => {
      if (!error || !instance.settingsLifetime.isCurrent(generation)) return;
      instance.settingsPresentation.set(rejectLoad(
        instance.settingsPresentation.get(),
        requestId,
        {
          message: audioText('audio.settingsLoadFailed', { error: getErrorMessage(error) }),
          retryable: true,
        },
      ));
    },
  });
}

function setRangeProgress(element: HTMLInputElement, value: number, minimum: number, maximum: number): void {
  element.style.setProperty('--audio-range-progress', `${rangeProgress(value, minimum, maximum)}%`);
}

Template.audioSettings.onCreated(function(this: AudioSettingsInstance) {
  this.settingsPresentation = new ReactiveVar<LoadableState<AudioSettingsForm>>({ status: 'idle' });
  this.keyPresentation = new ReactiveVar<LoadableState<boolean>>({ status: 'idle' });
  this.settingsCommandStates = new ReactiveVar({});
  this.keyCommandState = new ReactiveVar<AsyncCommandState<void>>({ status: 'idle' });
  this.audioSettingsMessages = new ReactiveVar({});
  this.volumeDraft = new ReactiveVar(0);
  this.sensitivityDraft = new ReactiveVar(60);
  this.speechApiDraft = new ReactiveVar('');
  this.settingsLifetime = createTemplateLifetime();
  this.keyLifetime = createTemplateLifetime();
  this.nextSettingsRequestId = 0;
  this.nextKeyRequestId = 0;
  this.settingsCommandRegistry = createScopedAsyncCommandRegistry((scope, state) => {
    this.settingsCommandStates.set({ ...this.settingsCommandStates.get(), [scope]: state });
  });
  this.keyCommand = createAsyncCommandController((state) => this.keyCommandState.set(state));
  this.confirmationController = createInlineConfirmationController<'delete-speech-api-key'>(
    (view) => this.confirmationState.set(view),
    () => document.getElementById('speechAPIKey'),
  );
  this.confirmationState = new ReactiveVar(this.confirmationController.getView());
  loadAudioSettings(this);
});

Template.audioSettings.onDestroyed(function(this: AudioSettingsInstance) {
  this.settingsLifetime.destroy();
  this.keyLifetime.destroy();
  this.settingsCommandRegistry.destroy();
  this.keyCommand.destroy();
  this.confirmationController.destroy();
});

Template.audioSettings.events({
  'click #audioPromptQuestionOn'(event: Event, instance: AudioSettingsInstance) {
    event.preventDefault();
    const current = readySettings(instance);
    if (!current) return;
    const nextMode = promptModeFromToggles(!promptQuestionEnabled(current), promptFeedbackEnabled(current));
    void saveSettings(instance, { ...current, audioPromptMode: nextMode }, 'tts', () => {
      if (nextMode !== 'silent') void warmupGoogleTTS();
    });
  },

  'click #audioPromptFeedbackOn'(event: Event, instance: AudioSettingsInstance) {
    event.preventDefault();
    const current = readySettings(instance);
    if (!current) return;
    const nextMode = promptModeFromToggles(promptQuestionEnabled(current), !promptFeedbackEnabled(current));
    void saveSettings(instance, { ...current, audioPromptMode: nextMode }, 'tts', () => {
      if (nextMode !== 'silent') void warmupGoogleTTS();
    });
  },

  'click #audioInputOn'(event: Event, instance: AudioSettingsInstance) {
    event.preventDefault();
    const current = readySettings(instance);
    if (!current) return;
    const audioInputMode = !current.audioInputMode;
    void saveSettings(instance, { ...current, audioInputMode }, 'speech-input', () => {
      if (audioInputMode) void warmupGoogleSpeechRecognition();
    });
  },

  'input #audioPromptVolume'(event: Event, instance: AudioSettingsInstance) {
    const input = event.currentTarget as HTMLInputElement;
    const value = Number.parseFloat(input.value);
    instance.volumeDraft.set(value);
    setRangeProgress(input, value, -6, 6);
  },

  'change #audioPromptVolume'(event: Event, instance: AudioSettingsInstance) {
    const current = readySettings(instance);
    if (!current) return;
    const value = Number.parseFloat((event.currentTarget as HTMLInputElement).value);
    void saveSettings(instance, {
      ...current,
      audioPromptQuestionVolume: value,
      audioPromptFeedbackVolume: value,
    }, 'tts');
  },

  'change #audioPromptSpeakingRate'(event: Event, instance: AudioSettingsInstance) {
    const current = readySettings(instance);
    if (!current) return;
    const value = Number.parseFloat((event.currentTarget as HTMLSelectElement).value);
    void saveSettings(instance, {
      ...current,
      audioPromptQuestionSpeakingRate: value,
      audioPromptFeedbackSpeakingRate: value,
    }, 'tts');
  },

  'change #audioPromptVoice'(event: Event, instance: AudioSettingsInstance) {
    const current = readySettings(instance);
    if (!current) return;
    const value = (event.currentTarget as HTMLSelectElement).value;
    void saveSettings(instance, {
      ...current,
      audioPromptVoice: value,
      audioPromptFeedbackVoice: value,
    }, 'tts');
  },

  'input #audioInputSensitivity'(event: Event, instance: AudioSettingsInstance) {
    const input = event.currentTarget as HTMLInputElement;
    const value = normalizeAudioInputSensitivity(input.value);
    instance.sensitivityDraft.set(value);
    setRangeProgress(input, value, AUDIO_INPUT_SENSITIVITY_MIN, AUDIO_INPUT_SENSITIVITY_MAX);
  },

  'change #audioInputSensitivity'(event: Event, instance: AudioSettingsInstance) {
    const current = readySettings(instance);
    if (!current) return;
    const value = normalizeAudioInputSensitivity((event.currentTarget as HTMLInputElement).value);
    void saveSettings(instance, { ...current, audioInputSensitivity: value }, 'speech-input');
  },

  'input #speechAPIKey'(event: Event, instance: AudioSettingsInstance) {
    instance.speechApiDraft.set((event.currentTarget as HTMLInputElement).value);
  },

  'click #speechAPISubmit'(event: Event, instance: AudioSettingsInstance) {
    event.preventDefault();
    const key = instance.speechApiDraft.get();
    setAudioSettingsMessage(instance, 'speech-api-key', null);
    void instance.keyCommand.run(async () => {
      await (Meteor as typeof Meteor & {
        callAsync: (name: string, key: string) => Promise<void>;
      }).callAsync('saveUserSpeechAPIKey', key);
    }, {
      getErrorMessage: (error: unknown) => audioText('audio.changesNotSaved', { error: getErrorMessage(error) }),
      onSuccess: () => {
        instance.keyPresentation.set({ status: 'ready', value: true });
        instance.speechApiDraft.set('');
        setAudioSettingsMessage(instance, 'speech-api-key', { level: 'success', text: audioText('audio.speechApiKeySaved') });
      },
      onFailure: (error: unknown) => {
        setAudioSettingsMessage(instance, 'speech-api-key', {
          level: 'error',
          text: audioText('audio.changesNotSaved', { error: getErrorMessage(error) }),
        });
      },
    });
  },

  'click #speechAPIDelete'(event: Event, instance: AudioSettingsInstance) {
    event.preventDefault();
    instance.confirmationController.open({
      confirmationId: 'audio-delete-speech-api-key',
      title: audioText('audio.deleteKey'),
      message: audioText('audio.deleteKeyConfirmation'),
      confirmLabel: audioText('audio.deleteKey'),
      cancelLabel: audioText('content.cancel'),
      severity: 'danger',
      context: 'delete-speech-api-key',
    }, event.currentTarget as HTMLElement);
    Tracker.afterFlush(() => instance.confirmationController.focusInitial());
  },

  'click .admin-confirmation-cancel'(_event: Event, instance: AudioSettingsInstance) {
    instance.confirmationController.cancel();
  },

  'keydown .admin-inline-confirmation'(event: KeyboardEvent, instance: AudioSettingsInstance) {
    instance.confirmationController.handleKeydown(event);
  },

  'click .admin-confirmation-confirm'(event: Event, instance: AudioSettingsInstance) {
    event.preventDefault();
    const view = instance.confirmationController.getView();
    if (
      view.status !== 'open'
      || view.pending
      || instance.confirmationController.getContext() !== 'delete-speech-api-key'
    ) {
      return;
    }
    instance.confirmationController.setPending(true);
    setAudioSettingsMessage(instance, 'speech-api-key', null);
    void instance.keyCommand.run(async () => {
      await (Meteor as typeof Meteor & { callAsync: (name: string) => Promise<void> })
        .callAsync('deleteUserSpeechAPIKey');
    }, {
      getErrorMessage: (error: unknown) => audioText('audio.changesNotSaved', { error: getErrorMessage(error) }),
      onSuccess: () => {
        instance.keyPresentation.set({ status: 'ready', value: false });
        instance.speechApiDraft.set('');
        instance.confirmationController.complete();
        setAudioSettingsMessage(instance, 'speech-api-key', { level: 'success', text: audioText('audio.speechApiKeyDeleted') });
      },
      onFailure: (error: unknown) => {
        instance.confirmationController.setPending(false);
        setAudioSettingsMessage(instance, 'speech-api-key', {
          level: 'error',
          text: audioText('audio.changesNotSaved', { error: getErrorMessage(error) }),
        });
      },
    });
  },

  'click [data-audio-key-status-retry]'(event: Event, instance: AudioSettingsInstance) {
    event.preventDefault();
    void loadSpeechApiKeyStatus(instance);
  },

  'click [data-audio-settings-retry]'(event: Event, instance: AudioSettingsInstance) {
    event.preventDefault();
    loadAudioSettings(instance);
  },

  'click #audioPromptVoiceTest'(event: Event, instance: AudioSettingsInstance) {
    event.preventDefault();
    const current = readySettings(instance);
    if (!current) return;
    const audio = new Audio(`https://cloud.google.com/text-to-speech/docs/audio/${sharedVoice(current)}.wav`);
    void audio.play();
  },
});

Template.audioSettings.helpers({
  audioText,

  audioVoiceLabel(gender: 'male' | 'female', number: number) {
    return audioText(gender === 'female' ? 'audio.femaleVoice' : 'audio.maleVoice', { number });
  },

  audioSettingsLoadError(): string {
    const state = (Template.instance() as AudioSettingsInstance).settingsPresentation.get();
    return state.status === 'error' || state.status === 'refresh-error' ? state.message : '';
  },

  audioSettingsReady(): boolean {
    return readySettings(Template.instance() as AudioSettingsInstance) !== null;
  },

  ttsSettingsMessage(): AudioSettingsMessage | null {
    return (Template.instance() as AudioSettingsInstance).audioSettingsMessages.get().tts || null;
  },

  speechInputSettingsMessage(): AudioSettingsMessage | null {
    return (Template.instance() as AudioSettingsInstance).audioSettingsMessages.get()['speech-input'] || null;
  },

  speechApiKeyMessage(): AudioSettingsMessage | null {
    return (Template.instance() as AudioSettingsInstance).audioSettingsMessages.get()['speech-api-key'] || null;
  },

  settingsBusy(): boolean {
    return Object.values((Template.instance() as AudioSettingsInstance).settingsCommandStates.get())
      .some((state) => state?.status === 'pending');
  },

  ttsSettingsDisabled(): boolean {
    const instance = Template.instance() as AudioSettingsInstance;
    return readySettings(instance) === null || instance.settingsCommandStates.get().tts?.status === 'pending';
  },

  speechInputSettingsDisabled(): boolean {
    const instance = Template.instance() as AudioSettingsInstance;
    return readySettings(instance) === null || instance.settingsCommandStates.get()['speech-input']?.status === 'pending';
  },

  audioPromptQuestionOn(): boolean {
    const settings = readySettings(Template.instance() as AudioSettingsInstance);
    return settings ? promptQuestionEnabled(settings) : false;
  },

  audioPromptFeedbackOn(): boolean {
    const settings = readySettings(Template.instance() as AudioSettingsInstance);
    return settings ? promptFeedbackEnabled(settings) : false;
  },

  showAudioPromptControls(): boolean {
    const settings = readySettings(Template.instance() as AudioSettingsInstance);
    return settings ? promptControlsVisible(settings) : false;
  },

  audioInputOn(): boolean {
    return readySettings(Template.instance() as AudioSettingsInstance)?.audioInputMode === true;
  },

  audioPromptVolume(): number {
    return (Template.instance() as AudioSettingsInstance).volumeDraft.get();
  },

  audioPromptVolumeProgress(): number {
    return rangeProgress((Template.instance() as AudioSettingsInstance).volumeDraft.get(), -6, 6);
  },

  audioPromptSpeakingRateSelected(value: string): string | null {
    const settings = readySettings(Template.instance() as AudioSettingsInstance);
    return settings && sharedSpeakingRate(settings) === Number.parseFloat(value) ? 'selected' : null;
  },

  audioPromptVoiceSelected(value: string): string | null {
    const settings = readySettings(Template.instance() as AudioSettingsInstance);
    return settings && sharedVoice(settings) === value ? 'selected' : null;
  },

  audioInputSensitivity(): number {
    return (Template.instance() as AudioSettingsInstance).sensitivityDraft.get();
  },

  audioInputSensitivityProgress(): number {
    return rangeProgress(
      (Template.instance() as AudioSettingsInstance).sensitivityDraft.get(),
      AUDIO_INPUT_SENSITIVITY_MIN,
      AUDIO_INPUT_SENSITIVITY_MAX,
    );
  },

  showSpeechAPISetup(): boolean {
    return !Session.get('useEmbeddedAPIKeys') && Session.get('showSpeechAPISetup') === true;
  },

  keyStatusLoading(): boolean {
    const status = (Template.instance() as AudioSettingsInstance).keyPresentation.get().status;
    return status === 'idle' || status === 'loading' || status === 'refreshing';
  },

  keyStatusError(): string {
    const state = (Template.instance() as AudioSettingsInstance).keyPresentation.get();
    return state.status === 'error' || state.status === 'refresh-error' ? state.message : '';
  },

  speechAPIKeyIsSetup(): boolean {
    const state = (Template.instance() as AudioSettingsInstance).keyPresentation.get();
    return (state.status === 'ready' || state.status === 'refreshing' || state.status === 'refresh-error')
      && state.value;
  },

  speechAPIKeyPlaceholder(): string {
    const instance = Template.instance() as AudioSettingsInstance;
    const state = instance.keyPresentation.get();
    const configured = (state.status === 'ready' || state.status === 'refreshing' || state.status === 'refresh-error')
      && state.value;
    return configured
      ? audioText('audio.enterNewKeyReplaceSaved')
      : audioText('audio.enterYourApiKey');
  },

  speechApiDraft(): string {
    return (Template.instance() as AudioSettingsInstance).speechApiDraft.get();
  },

  keyCommandBusy(): boolean {
    return (Template.instance() as AudioSettingsInstance).keyCommandState.get().status === 'pending';
  },

  audioConfirmationView(): InlineConfirmationView {
    return (Template.instance() as AudioSettingsInstance).confirmationState.get();
  },
});

function getUserAudioSettings(): AudioSettingsForm {
  return normalizeAudioSettings((Meteor.user() as { audioSettings?: unknown } | null)?.audioSettings);
}

export async function warmupGoogleTTS() {
  const tdfFile = Session.get('currentTdfFile');
  const settings = getUserAudioSettings();
  const voice = tdfFile?.tdfs?.tutor?.setspec?.audioPromptFeedbackVoice ||
    settings.audioPromptFeedbackVoice ||
    settings.audioPromptVoice ||
    '';

  try {
    const ttsLanguage = resolveExplicitTtsLanguageCode({
      configuredLanguage: tdfFile?.tdfs?.tutor?.setspec?.textToSpeechLanguage,
      requestedVoice: voice,
      contextLabel: 'Audio Settings TTS warmup',
    });
    await (Meteor as any).callAsync('makeGoogleTTSApiCall',
      Session.get('currentTdfId'),
      'warmup',
      1.0,
      0.0,
      voice || '',
      ttsLanguage,
    );
    setTtsWarmedUp(true);
  } catch (_err) {
    setTtsWarmedUp(false);
  }
}

export async function warmupGoogleSpeechRecognition() {
  if (getSrWarmedUp()) {
    return;
  }

  const silentAudioBytes = new Uint8Array(3200).fill(0);
  const base64Audio = btoa(String.fromCharCode.apply(null, Array.from(silentAudioBytes) as any));
  const speechRecognitionLanguage = resolveSpeechRecognitionLanguage(
    Session.get('currentTdfFile')?.tdfs?.tutor?.setspec,
    getActiveUiLocale(),
  );

  const request = {
    config: {
      encoding: 'LINEAR16',
      sampleRateHertz: 16000,
      languageCode: speechRecognitionLanguage,
      maxAlternatives: 1,
      profanityFilter: false,
      enableAutomaticPunctuation: false,
      model: 'latest_short',
      useEnhanced: true,
      speechContexts: [{ phrases: ['warmup'], boost: 5 }],
    },
    audio: { content: base64Audio },
  };

  try {
    await (Meteor as any).callAsync(
      'makeGoogleSpeechAPICall',
      Session.get('currentTdfId'),
      '',
      request,
      ['warmup'],
    );
    setSrWarmedUp(true);
  } catch (_err) {
    setSrWarmedUp(false);
  }
}
