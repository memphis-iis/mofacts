import { Meteor } from 'meteor/meteor';
import { Session } from 'meteor/session';
import { getExperimentState } from '../views/experiment/svelte/services/experimentState';
import {
  CARD_ENTRY_INTENT,
  setCardEntryIntent,
  type CardEntryIntent,
} from './cardEntryIntent';
import { clientConsole } from './clientLogger';
import { prepareLessonLaunchContext } from './lessonLaunchInitializer';
import { shouldLockMultiTdfLaunchToCurrentUnit } from './lessonLaunchLockPolicy';
import { sessionCleanUp } from './sessionUtils';
import { setCourseAssignmentLaunchContext } from './courseAssignmentLaunchContext';
import type { CourseAssignmentHistoryContext } from '../../common/courseAssignments.contracts';
import { translatePlatformString } from './interfaceI18n';
import { getActiveUiLocale } from './interfaceLocaleState';
import { buildActiveLessonRouteLocation } from './activeLessonRoute';
import { setPracticeLaunchMode, type PracticeLaunchMode } from './practiceLaunchMode';
import {
  setAudioEnabled,
  setAudioEnabledView,
  setAudioInputSensitivity,
  setAudioInputSensitivityView,
  setAudioPromptFeedbackSpeakingRate,
  setAudioPromptFeedbackSpeakingRateView,
  setAudioPromptFeedbackView,
  setAudioPromptFeedbackVoice,
  setAudioPromptFeedbackVoiceView,
  setAudioPromptFeedbackVolume,
  setAudioPromptMode,
  setAudioPromptQuestionSpeakingRate,
  setAudioPromptQuestionSpeakingRateView,
  setAudioPromptQuestionVolume,
  setAudioPromptVoice,
  setAudioPromptVoiceView,
} from './state/audioState';

const { FlowRouter } = require('meteor/ostrio:flow-router-extra');

type SetSpecLike = Record<string, any>;

type LessonLaunchOptions = {
  courseAssignment?: CourseAssignmentHistoryContext | null;
  practiceLaunchMode?: PracticeLaunchMode;
};

function goToActiveLessonSurface(surface: '/content' | '/instructions'): void {
  const location = buildActiveLessonRouteLocation(surface);
  FlowRouter.go(location.path, {}, location.queryParams);
}

async function navigateForMultiTdf(entryIntent: CardEntryIntent = CARD_ENTRY_INTENT.INITIAL_TDF_ENTRY) {
  const experimentState: any = await getExperimentState();
  const lastUnitCompleted = experimentState.lastUnitCompleted || -1;
  const currentUnitNumber = typeof experimentState.currentUnitNumber === 'number'
    ? experimentState.currentUnitNumber
    : -1;
  let unitLocked = false;

  if (currentUnitNumber > lastUnitCompleted) {
    const unitList = Session.get('currentTdfFile')?.tdfs?.tutor?.unit;
    const curUnit = Array.isArray(unitList) ? unitList[currentUnitNumber] : null;
    unitLocked = shouldLockMultiTdfLaunchToCurrentUnit(curUnit);
  }

  if (unitLocked) {
    setCardEntryIntent(entryIntent, {
      source: 'lessonLaunch.navigateForMultiTdf',
    });
    goToActiveLessonSurface('/content');
  } else {
    FlowRouter.go('/multiTdfSelect');
  }
}

export async function selectTdf(
  currentTdfId: any,
  lessonName: any,
  currentStimuliSetId: any,
  ignoreOutOfGrammarResponses: any,
  speechOutOfGrammarFeedback: any,
  how: any,
  isMultiTdf: any,
  setspec: SetSpecLike,
  isExperiment = false,
  isRefresh = false,
  options: LessonLaunchOptions = {},
) {
  clientConsole(2, 'Starting Lesson:', lessonName, 'tdfId:', currentTdfId,
    'stimuliSetId:', currentStimuliSetId, 'isMultiTdf:', isMultiTdf, 'source:', how);

  sessionCleanUp();
  setPracticeLaunchMode(options.practiceLaunchMode ?? 'normal');
  setCourseAssignmentLaunchContext(options.courseAssignment ?? null);
  Session.set('uiMessage', null);

  let preparedLaunch;
  try {
    preparedLaunch = await prepareLessonLaunchContext({
      currentTdfId,
      currentStimuliSetId,
      ignoreOutOfGrammarResponses,
      speechOutOfGrammarFeedback,
      source: 'lessonLaunch.selectTdf',
      courseAssignment: options.courseAssignment ?? null,
    });
  } catch (error) {
    clientConsole(1, '[LessonLaunch] Failed to load launch-ready TDF:', currentTdfId, error);
    setCourseAssignmentLaunchContext(null);
    throw new Error(translatePlatformString(getActiveUiLocale(), 'dashboard.unableToLoadSelectedLesson'), { cause: error });
  }

  const curTdfContent = preparedLaunch.content;
  Session.set('showPageNumbers', setspec.showPageNumbers ? setspec.showPageNumbers : false);
  const { launchProgress, unitCount } = preparedLaunch;

  if (launchProgress.moduleCompleted) {
    clientConsole(2, '[LessonLaunch] Blocking lesson relaunch because persisted state is completed', {
      currentTdfId,
      unitCount,
      persistedUnitNumber: launchProgress.persistedUnitNumber,
      lastUnitCompleted: launchProgress.lastUnitCompleted,
    });
    Session.set('uiMessage', {
      text: 'This lesson has already been completed and cannot be reopened.',
      variant: 'warning',
    });
    setCourseAssignmentLaunchContext(null);
    return;
  }

  const user = Meteor.user() as any;
  const audioSettings = user?.audioSettings || {};
  let audioPromptMode;
  let audioInputEnabled;
  let audioPromptFeedbackSpeakingRate;
  let audioPromptQuestionSpeakingRate;
  let audioPromptVoice;
  let audioInputSensitivity;
  let audioPromptQuestionVolume;
  let audioPromptFeedbackVolume;
  let audioPromptFeedbackVoice;

  if (isExperiment) {
    audioPromptMode = setspec.audioPromptMode || 'silent';
    audioInputEnabled = setspec.audioInputEnabled || false;
    audioPromptFeedbackSpeakingRate = setspec.audioPromptFeedbackSpeakingRate || 1;
    audioPromptQuestionSpeakingRate = setspec.audioPromptQuestionSpeakingRate || 1;
    audioPromptVoice = setspec.audioPromptVoice || 'en-US-Standard-A';
    audioInputSensitivity = audioSettings.audioInputSensitivity;
    audioPromptQuestionVolume = setspec.audioPromptQuestionVolume || 0;
    audioPromptFeedbackVolume = setspec.audioPromptFeedbackVolume || 0;
    audioPromptFeedbackVoice = setspec.audioPromptFeedbackVoice || 'en-US-Standard-A';
  } else {
    audioPromptMode = audioSettings.audioPromptMode || 'silent';
    audioInputEnabled = audioSettings.audioInputMode || false;
    audioPromptFeedbackSpeakingRate = audioSettings.audioPromptFeedbackSpeakingRate || 1;
    audioPromptQuestionSpeakingRate = audioSettings.audioPromptQuestionSpeakingRate || 1;
    audioPromptVoice = audioSettings.audioPromptVoice || 'en-US-Standard-A';
    audioInputSensitivity = audioSettings.audioInputSensitivity;
    audioPromptQuestionVolume = audioSettings.audioPromptQuestionVolume || 0;
    audioPromptFeedbackVolume = audioSettings.audioPromptFeedbackVolume || 0;
    audioPromptFeedbackVoice = audioSettings.audioPromptFeedbackVoice || 'en-US-Standard-A';
  }

  setAudioPromptMode(audioPromptMode);
  setAudioPromptFeedbackView(audioPromptMode === 'feedback' || audioPromptMode === 'all');
  setAudioEnabledView(audioInputEnabled);
  setAudioPromptFeedbackSpeakingRateView(audioPromptFeedbackSpeakingRate);
  setAudioPromptQuestionSpeakingRateView(audioPromptQuestionSpeakingRate);
  setAudioPromptVoiceView(audioPromptVoice);
  setAudioInputSensitivityView(audioInputSensitivity);
  setAudioPromptQuestionVolume(audioPromptQuestionVolume);
  setAudioPromptFeedbackVolume(audioPromptFeedbackVolume);
  setAudioPromptFeedbackVoiceView(audioPromptFeedbackVoice);

  setAudioPromptFeedbackSpeakingRate(audioPromptFeedbackSpeakingRate);
  setAudioPromptQuestionSpeakingRate(audioPromptQuestionSpeakingRate);
  setAudioPromptVoice(audioPromptVoice);
  setAudioPromptFeedbackVoice(audioPromptFeedbackVoice);
  setAudioInputSensitivity(audioInputSensitivity);

  const userAudioToggled = audioInputEnabled;
  const tdfAudioEnabled = curTdfContent.tdfs.tutor.setspec.audioInputEnabled
    ? curTdfContent.tdfs.tutor.setspec.audioInputEnabled === 'true'
    : false;
  const audioEnabled = !Session.get('experimentTarget') ? userAudioToggled : tdfAudioEnabled;
  setAudioEnabled(audioEnabled);

  try {
    const keyStatus = await (Meteor as any).callAsync('hasUserPersonalKeys', Session.get('currentTdfId'));
    Session.set('speechAPIKeyConfigured', keyStatus?.hasSR === true);
    Session.set('ttsAPIKeyConfigured', keyStatus?.hasTTS === true);
  } catch (error) {
    clientConsole(1, '[LessonLaunch] Could not determine resolved audio key availability:', error);
  }

  if (!isRefresh) {
    if (isMultiTdf) {
      await navigateForMultiTdf(launchProgress.intent);
    } else {
      setCardEntryIntent(launchProgress.intent, {
        source: 'lessonLaunch.selectTdf',
      });
      goToActiveLessonSurface(preparedLaunch.entryRoute!.route);
    }
  }
  return preparedLaunch.entryRoute;
}
