import {Roles} from 'meteor/alanning:roles';
import { ReactiveDict } from 'meteor/reactive-dict';
import { Tracker } from 'meteor/tracker';
import {
  shuffle,
  haveMeteorUser,
  getCurrentDeliveryParams,
  setStudentPerformance,
  getStimCount,
  getStimCluster,
  createStimClusterMapping,
  getAllCurrentStimAnswers,
  getTestType,
} from '../../lib/currentTestingHelpers';
import {
  initializePlyr,
  playerController,
  destroyPlyr
} from '../../lib/plyrHelper.js'
import {meteorCallAsync, redoCardImage, clientConsole} from '../../index';
import {DialogueUtils, dialogueContinue, dialogueLoop, initiateDialogue} from './dialogueUtils';
import {SCHEDULE_UNIT, ENTER_KEY} from '../../../common/Definitions';
import {secsIntervalString, displayify, stringifyIfExists} from '../../../common/globalHelpers';
import {routeToSignin} from '../../lib/router';
import {createScheduleUnit, createModelUnit, createEmptyUnit} from './unitEngine';
import {Answers} from './answerAssess';
import {sessionCleanUp} from '../../lib/sessionUtils';
import {checkUserSession} from '../../index'
import {instructContinue, unitHasLockout, checkForFileImage} from './instructions';
import {sanitizeHTML, nextChar, levenshteinDistance} from '../../lib/stringUtils';
import {parseSchedItemCondition} from '../../lib/tdfUtils';
import {
  getPhoneticCodes,
  buildPhoneticIndex,
  findPhoneticConflictsWithCorrectAnswer,
  filterPhoneticConflicts,
  findPhoneticMatch,
  tryPhoneticMatch
} from '../../lib/phoneticUtils';
import {
  registerTimeout,
  registerInterval,
  clearRegisteredTimeout,
  clearAllRegisteredTimeouts,
  listActiveTimeouts,
  elapsedSecs,
  clearCardTimeout,
  clearAndFireTimeout,
  beginMainCardTimeout,
  resetMainCardTimeout,
  restartMainCardTimeoutIfNecessary,
  getDisplayTimeouts,
  setDispTimeoutText,
  varLenDisplayTimeout,
  getReviewTimeout
} from './modules/cardTimeouts';

// Helper function to check if audio input mode is enabled
function checkAudioInputMode() {
  // SR should only be enabled if BOTH user has it toggled on AND TDF supports it
  const userAudioToggled = Meteor.user()?.audioInputMode || false;
  const tdfAudioEnabled = Session.get('currentTdfFile')?.tdfs?.tutor?.setspec?.audioInputEnabled === 'true';
  return userAudioToggled && tdfAudioEnabled;
}

// Scenario 2: Warmup audio if TDF has embedded keys (before first trial)
async function checkAndWarmupAudioIfNeeded() {
  const currentTdfFile = Session.get('currentTdfFile');
  if (!currentTdfFile) {
    clientConsole(2, '[Audio] No currentTdfFile, skipping Scenario 2 warmup');
    return;
  }

  const user = Meteor.user();
  if (!user) {
    clientConsole(2, '[Audio] No user, skipping Scenario 2 warmup');
    return;
  }

  clientConsole(2, '[Audio] Checking Scenario 2 warmup needs...');
  const promises = [];

  // Check TTS warmup (Scenario 2: TDF has embedded key)
  if (currentTdfFile.tdfs?.tutor?.setspec?.textToSpeechAPIKey) {
    const audioPromptMode = user.audioSettings?.audioPromptMode;
    if (audioPromptMode && audioPromptMode !== 'silent' && !cardState.get('ttsWarmedUp')) {
      clientConsole(2, '[TTS] TDF has embedded key, warming up before first trial (Scenario 2)');

      // Set flag immediately to prevent duplicate warmups
      cardState.set('ttsWarmedUp', true);

      // Make async warmup call
      const startTime = performance.now();
      const ttsPromise = Meteor.callAsync('makeGoogleTTSApiCall',
        Session.get('currentTdfId'),
        'warmup',
        1.0,
        0.0
      ).then(result => {
        const duration = performance.now() - startTime;
        clientConsole(2, `[TTS] ✅ Warmup complete in ${duration.toFixed(0)}ms`);
        return result;
      }).catch(error => {
        clientConsole(2, '[TTS] Warmup failed:', error);
        throw error;
      });
      promises.push(ttsPromise);
    }
  }

  // Check SR warmup (Scenario 2: TDF has embedded key)
  if (currentTdfFile.tdfs?.tutor?.setspec?.speechAPIKey) {
    if (checkAudioInputMode() && !cardState.get('srWarmedUp')) {
      clientConsole(2, '[SR] TDF has embedded key, warming up before first trial (Scenario 2)');

      // Set flag immediately to prevent duplicate warmups
      cardState.set('srWarmedUp', true);

      // Make async warmup call
      const startTime2 = performance.now();
      const srPromise = Meteor.callAsync('makeGoogleSpeechAPICall',
        Session.get('currentTdfId'),
        'warmup'
      ).then(result => {
        const duration = performance.now() - startTime2;
        clientConsole(2, `[SR] ✅ Warmup complete in ${duration.toFixed(0)}ms`);
        return result;
      }).catch(error => {
        clientConsole(2, '[SR] Warmup failed:', error);
        throw error;
      });
      promises.push(srPromise);
    }
  }

  // Wait for all warmups to complete
  if (promises.length > 0) {
    console.log(`[Audio] Starting Scenario 2 warmup with ${promises.length} API(s), showing spinner...`);
    cardState.set('audioWarmupInProgress', true);
    try {
      await Promise.all(promises);
      console.log('[Audio] Scenario 2 warmup complete, hiding spinner');
    } catch (err) {
      console.log('[Audio] Scenario 2 warmup error:', err);
    } finally {
      cardState.set('audioWarmupInProgress', false);
    }
  } else {
    console.log('[Audio] No warmup needed - promises.length:', promises.length);
    console.log('[Audio] ttsWarmedUp:', cardState.get('ttsWarmedUp'), 'srWarmedUp:', cardState.get('srWarmedUp'));
  }
}

export {
  speakMessageIfAudioPromptFeedbackEnabled,
  startRecording,
  stopRecording,
  getExperimentState,
  updateExperimentState,
  restartMainCardTimeoutIfNecessary,
  getCurrentClusterAndStimIndices,
  initCard,
  unitIsFinished,
  revisitUnit,
  gatherAnswerLogRecord,
  newQuestionHandler,
  checkAudioInputMode,
};

// Main GUI logic for MoFaCTS with TDF/Stim abstraction via currentTestingHelpers.js. Trial timeouts: purestudy (study display), drill (answer time), reviewstudy (incorrect feedback), correctprompt (correct feedback). Admin/teacher simulation via simTimeout/simCorrectProb TDF params. Scrollable history enabled via <showhistory>true</deliveryparams>.

// Global variables and helper functions for them

// PHASE 2: Scoped Reactive State - Use ReactiveDict for card-specific state to prevent memory leaks and improve performance
const cardState = new ReactiveDict('cardState');
// M3: Additional scoped ReactiveDict instances for specialized state management
const srState = new ReactiveDict('speechRecognition'); // Speech recognition state
const trialState = new ReactiveDict('trialStateMachine'); // Trial FSM state
const timeoutState = new ReactiveDict('timeouts'); // Timeout tracking

let engine = null; // The unit engine for display (i.e. model or schedule)
const hark = require('../../lib/hark');
cardState.set('buttonList', []);
const scrollList = new Mongo.Collection(null); // local-only - no database
cardState.set('scrollListCount', 0);
Session.set('currentDeliveryParams', {});
Session.set('inResume', false);
cardState.set('wasReportedForRemoval', false);
Session.set('hiddenItems', []);
cardState.set('numVisibleCards', 0);
cardState.set('recordingLocked', false);
// M3: Track if waiting for Google Speech API response (converted to reactive state)
srState.set('waitingForTranscription', false);
let cachedSyllables = null;
let cachedSuccessColor = null;
let cachedAlertColor = null;
// M3: Audio input mode flag (converted to reactive state)
srState.set('audioInputModeEnabled', false);
// Cache speech recognition answer grammar and phonetic index per unit (invalidate when currentStimuliSet changes)
let cachedAnswerGrammar = null;
let cachedPhoneticIndex = null;
let lastCachedUnitNumber = null;
let speechTranscriptionTimeoutsSeen = 0;
let timeoutsSeen = 0; // Reset to zero on resume or non-timeout
let trialStartTimestamp = 0;
let trialEndTimeStamp = 0;
let afterFeedbackCallbackBind = null;
cardState.set('trialStartTimestamp', trialStartTimestamp);
let firstKeypressTimestamp = 0;
let currentSound = null; // See later in this file for sound functions
let userFeedbackStart = null;
let player = null;
// M3: Track timeout state reactively (name/ID for clear/reset, function/delay for reset); Functions cannot be stored in ReactiveDict - timeout vars moved to cardTimeouts.js module (Phase 1)
let simTimeoutName = null; // Kept here - used by checkSimulation (will move to cardUtils in Phase 3)
let userAnswer = null;
let lastlogicIndex = 0;

// Timeout functions extracted to cardTimeouts.js module (Phase 1): register/clear/reset timeouts, intervals, display helpers; clearCardTimeout aliased to avoid wrapper conflict

// Wrapper adds simTimeoutName clearing to module clearCardTimeout; temporary until checkSimulation migrates to cardUtils (Phase 3)
function clearCardTimeoutWrapper() {
  // Import from module is aliased; first clear simTimeoutName if present
  if (simTimeoutName) {
    try {
      Meteor.clearTimeout(simTimeoutName);
    } catch (e) {
      clientConsole(1, 'Error clearing sim timeout', e);
    }
    simTimeoutName = null;
  }
  // Then call module function with required parameters
  clearCardTimeout(timeoutState, cardState);
}

// Simulation timeout handler (migrates to cardUtils.js in Phase 3)
function checkSimulation() {
  if (!Session.get('runSimulation') ||
        !(Meteor.user() && Meteor.user().roles && (['admin', 'teacher']).some(role => Meteor.user().roles.includes(role)))) {
    return;
  }

  const setspec = Session.get('currentTdfFile').tdfs.tutor.setspec;

  const simTimeout = parseInt(setspec.simTimeout || 0);
  const simCorrectProb = parseFloat(setspec.simCorrectProb || 0);

  if (simTimeout <= 0 || simCorrectProb <= 0.0) {
    return;
  }

  // If we are here, set timeout to simulate a correct answer
  const correct = Math.random() <= simCorrectProb;
  clientConsole(2, 'SIM: will simulate response with correct=', correct, 'in', simTimeout);
  simTimeoutName = Meteor.setTimeout(function() {
    clientConsole(2, 'SIM: Fired!');
    simTimeoutName = null;
    handleUserInput({}, 'simulation', correct);
  }, simTimeout);
}

// Clean up on navigation away from page
async function leavePage(dest) {
  if (isNavigatingAway) {
    clientConsole(2, 'leavePage already in progress, ignoring duplicate request for dest:', typeof dest === 'function' ? 'function' : dest);
    return;
  }
  isNavigatingAway = true;
  clientConsole(2, 'leaving page for dest:', dest);
  if (dest != '/card' && dest != '/instructions' && document.location.pathname != '/instructions') {
    Session.set('currentExperimentState', undefined);
    clientConsole(2, 'resetting subtdfindex, dest:', dest);
    Session.set('subTdfIndex', null);
    sessionCleanUp();

    // Clean up session check interval
    const sessionCheckInterval = Session.get('sessionCheckInterval');
    if (sessionCheckInterval) {
      Meteor.clearInterval(sessionCheckInterval);
      Session.set('sessionCheckInterval', undefined);
    }

    if (window.AudioContext) {
      clientConsole(2, 'closing audio context');
      stopRecording();
      clearAudioContextAndRelatedVariables();
    } else {
      clientConsole(2, 'NOT closing audio context');
    }
  } else if (dest === '/instructions') {
    let unit = Session.get('currentTdfUnit');
    if(!unit){
      let experimentState = await getExperimentState()
      unit = experimentState.currentTdfFile.tdfs.tutor.unit[Session.get('currentUnitNumber')];
    }
    const lockout = unitHasLockout() > 0;
    const txt = unit.unitinstructions ? unit.unitinstructions.trim() : undefined;
    const pic = unit.picture ? unit.picture.trim() : undefined;
    const instructionsq = unit.unitinstructionsquestion ? unit.unitinstructionsquestion.trim() : undefined;
    if (!txt && !pic && !instructionsq && !lockout) {
      clientConsole(2, 'Instructions empty and no lockout: skipping');
      instructContinue();
      return;
    }
  }

  // Clean up all audio sources to prevent audio bleeding into other pages
  clientConsole(2, '[Audio] Cleaning up all audio sources');

  // Stop Google TTS audio (if playing)
  if (window.currentAudioObj) {
    clientConsole(2, '[Audio]   Stopping Google TTS audio');
    window.currentAudioObj.pause();
    window.currentAudioObj.onended = null;
    window.currentAudioObj = undefined;
  }

  // Cancel browser TTS (if active)
  if (window.speechSynthesis && window.speechSynthesis.speaking) {
    clientConsole(2, '[Audio]   Cancelling browser TTS');
    window.speechSynthesis.cancel();
  }

  // Destroy Plyr video player (if active)
  if (playerController && playerController.player) {
    clientConsole(2, '[Audio]   Destroying Plyr player');
    try {
      destroyPlyr();
    } catch (e) {
      clientConsole(1, '[Audio]   Error destroying Plyr:', e);
    }
  }

  clearCardTimeoutWrapper();
  clearPlayingSound();
  if (typeof dest === 'function') {
    dest();
  } else {
    Router.go(dest);
  }
}

// PHASE 2: Batch DOM updates via Tracker.autorun to prevent unnecessary re-renders
Template.card.onCreated(function() {
  const template = this;

  // Cache SR icon colors from CSS to avoid repeated getComputedStyle calls
  Tracker.afterFlush(function() {
    const root = document.documentElement;
    cachedSuccessColor = getComputedStyle(root).getPropertyValue('--success-color').trim() || '#00cc00';
    cachedAlertColor = getComputedStyle(root).getPropertyValue('--alert-color').trim() || '#ff0000';
  });

  // Compute audio input mode reactively once per change; Tracker.nonreactive prevents cascade invalidation
  template.autorun(function() {
    // Explicitly track only the dependencies we care about
    const userAudioToggled = Meteor.user()?.audioSettings?.audioInputMode;
    const tdfFile = Session.get('currentTdfFile');

    // Compute in non-reactive context to prevent cascade
    Tracker.nonreactive(function() {
      const tdfAudioEnabled = tdfFile?.tdfs?.tutor?.setspec?.audioInputEnabled === 'true';
      const enabled = (userAudioToggled || false) && tdfAudioEnabled;
      srState.set('audioInputModeEnabled', enabled);
      clientConsole(2, '[Card] Reactive SR icon update - userAudioToggled:', userAudioToggled, 'audioInputModeEnabled:', enabled);
    });
  });

  // Autorun manages feedback visibility (RESTORED after 40-90% perf regression from manual jQuery DOM updates violating Blaze reactivity)
  template.autorun(function() {
    const inFeedback = cardState.get('inFeedback');
    const feedbackPosition = cardState.get('feedbackPosition');

    Tracker.afterFlush(function() {
      if (inFeedback && feedbackPosition) {
        // Show feedback in correct position
        if (feedbackPosition === 'top') {
          $('#userInteractionContainer').removeAttr('hidden');
          $('#feedbackOverrideContainer').attr('hidden', '');
        } else if (feedbackPosition === 'middle') {
          $('#feedbackOverrideContainer').removeAttr('hidden');
          $('#userInteractionContainer').attr('hidden', '');
        } else if (feedbackPosition === 'bottom') {
          $('#feedbackOverrideContainer').attr('hidden', '');
          $('#userInteractionContainer').attr('hidden', '');
        }
      } else {
        // Hide all feedback containers when not in feedback
        $('#userInteractionContainer').attr('hidden', '');
        $('#feedbackOverrideContainer').attr('hidden', '');
      }
    });
  });

  // M3: Auto-stop recording when leaving PRESENTING_AWAITING state (fail-safe against wrong-state recording)
  template.autorun(function() {
    const currentState = trialState.get('current');
    const recording = cardState.get('recording');

    // Auto-stop recording when leaving PRESENTING_AWAITING state
    if (recording && currentState !== TRIAL_STATES.PRESENTING_AWAITING) {
      clientConsole(2, '[SR] Auto-stopping recording - state changed to:', currentState);
      Tracker.afterFlush(function() {
        stopRecording();
      });
    }
  });

  // M3: Auto-restart recording after TTS completes when in PRESENTING_AWAITING state (centralized coordination prevents manual sync errors)
  template.autorun(function() {
    const locked = cardState.get('recordingLocked');
    const ttsRequested = cardState.get('ttsRequested');
    const currentState = trialState.get('current');
    const recording = cardState.get('recording');
    const audioInputEnabled = srState.get('audioInputModeEnabled');
    const waitingForTranscription = srState.get('waitingForTranscription');

    // Auto-restart recording when: not locked (TTS finished), no TTS requested, in PRESENTING_AWAITING, not already recording, audio enabled, not processing speech
    if (!locked && !ttsRequested && currentState === TRIAL_STATES.PRESENTING_AWAITING && !recording && audioInputEnabled && !waitingForTranscription) {
      clientConsole(2, '[SR] Auto-restarting recording - TTS complete, conditions met');
      Tracker.afterFlush(function() {
        startRecording();
      });
    }
  });

  // M3: Auto-enable inputs in AWAITING/STUDY states, disable elsewhere; auto-focus text input when enabled
  template.autorun(function() {
    const currentState = trialState.get('current');

    // Enable input when in states that accept input
    const acceptsInput = currentState === TRIAL_STATES.PRESENTING_AWAITING ||
                        currentState === TRIAL_STATES.STUDY_SHOWING;

    Tracker.afterFlush(function() {
      const userAnswerEl = document.getElementById('userAnswer');
      if (userAnswerEl) {
        if (acceptsInput && userAnswerEl.disabled) {
          clientConsole(2, '[M3] Auto-enabling input - state:', currentState);
          userAnswerEl.disabled = false;
          // Auto-focus text input when enabled (not for button trials)
          const isButtonTrial = cardState.get('buttonTrial');
          if (!isButtonTrial) {
            try {
              userAnswerEl.focus();
              clientConsole(2, '[M3] Auto-focused input field');
            } catch (e) {
              // Ignore - focus may fail if element not in DOM
            }
          }
        } else if (!acceptsInput && !userAnswerEl.disabled) {
          clientConsole(2, '[M3] Auto-disabling input - state:', currentState);
          userAnswerEl.disabled = true;
        }
      }
    });
  });

  // M3/MO5: Apply TDF-configurable styles via CSS custom properties (CSP-compliant alternative to inline styles)
  template.autorun(function() {
    // Font size from TDF settings (replaces getFontSizeStyle helper)
    const deliveryParams = Session.get('currentDeliveryParams');
    const fontsize = deliveryParams && deliveryParams.fontsizePX;
    if (fontsize) {
      document.documentElement.style.setProperty('--card-font-size', fontsize + 'px');
    } else {
      document.documentElement.style.removeProperty('--card-font-size');
    }

    // Stimuli box background color from TDF UI settings (replaces stimuliBoxStyle helper)
    const uiSettings = Session.get('curTdfUISettings');
    if (uiSettings && uiSettings.showStimuliBox) {
      const colorValue = uiSettings.stimuliBoxColor || 'alert-bg';
      if (!colorValue.startsWith('alert-')) {
        document.documentElement.style.setProperty('--stimuli-box-bg-color', colorValue);
      } else {
        document.documentElement.style.removeProperty('--stimuli-box-bg-color');
      }
    } else {
      document.documentElement.style.removeProperty('--stimuli-box-bg-color');
    }

    // Image button backgrounds from data-image-url attribute (CSP compliance, replaces inline style)
    Tracker.afterFlush(function() {
      document.querySelectorAll('.btn-image[data-image-url]').forEach(button => {
        const imageUrl = button.getAttribute('data-image-url');
        if (imageUrl && !button.style.backgroundImage) {
          button.style.backgroundImage = `url(${imageUrl})`;
        }
      });
    });
  });

  // Initialize card state defaults
  cardState.set('inFeedback', false);
  cardState.set('feedbackPosition', null);
  cardState.set('displayReady', false);
  cardState.set('inputReady', false);
});

Template.card.onDestroyed(function() {
  clientConsole(2, '[Lifecycle] card template destroyed, running cleanup');
  if (!isNavigatingAway) {
    // leavePage() hasn't been called yet - need to clean up ALL audio resources
    clientConsole(2, '[Lifecycle] Direct navigation detected, cleaning up all audio');

    // Stop Google TTS audio (if playing)
    if (window.currentAudioObj) {
      clientConsole(2, '[Lifecycle]   Stopping Google TTS audio');
      window.currentAudioObj.pause();
      window.currentAudioObj.onended = null;
      window.currentAudioObj = undefined;
    }

    // Cancel browser TTS (if active)
    if (window.speechSynthesis && window.speechSynthesis.speaking) {
      clientConsole(2, '[Lifecycle]   Cancelling browser TTS');
      window.speechSynthesis.cancel();
    }

    // Destroy Plyr video player (if active)
    if (playerController && playerController.player) {
      clientConsole(2, '[Lifecycle]   Destroying Plyr player');
      try {
        destroyPlyr();
      } catch (e) {
        clientConsole(1, '[Lifecycle]   Error destroying Plyr:', e);
      }
    }

    // Clean up speech recognition audio context
    if (window.AudioContext) {
      stopRecording();
      clearAudioContextAndRelatedVariables();
    }

    // Clean up sound effects
    clearPlayingSound();
  }
});


Template.card.rendered = initCard;

async function initCard() {
  isNavigatingAway = false;
  const tdfResponse = Session.get('currentTdfFile');
  const curTdfTips = tdfResponse.tdfs.tutor.setspec.tips || [];
  const formattedTips = []
  if(curTdfTips){
    for(const tip of curTdfTips){
      formattedTips.push(checkForFileImage(tip))
    }
  }
  Session.set('curTdfTips', formattedTips)
  await checkUserSession();

  // Backup 1-second multi-tab detection (primary: BroadcastChannel)
  if (!Session.get('sessionCheckInterval')) {
    const sessionCheckInterval = Meteor.setInterval(async function() {
      await checkUserSession();
    }, 1000); // Check every 1 second
    Session.set('sessionCheckInterval', sessionCheckInterval);
  }

  // Intercept navigation (back button) for cleanup via onpopstate
  window.onpopstate = function() {
    if (document.location.pathname == '/card') {
      leavePage('/card');
    }
  };
  cardState.set('scoringEnabled', undefined);

  if (!Session.get('stimDisplayTypeMap')) {
    const stimDisplayTypeMap = await meteorCallAsync('getStimDisplayTypeMap');
    Session.set('stimDisplayTypeMap', stimDisplayTypeMap);
  }

  // Enable audio input if: user toggled SR on, TDF audioInputEnabled='true', and API key exists (user or TDF)
  const userAudioToggled = Meteor.user()?.audioSettings?.audioInputMode || false;
  const tdfAudioEnabled = Session.get('currentTdfFile').tdfs.tutor.setspec.audioInputEnabled === 'true';
  let audioInputEnabled = userAudioToggled && tdfAudioEnabled;
  clientConsole(2, '[Card] SR Icon Check - userAudioToggled:', userAudioToggled, 'tdfAudioEnabled:', tdfAudioEnabled, 'audioInputEnabled:', audioInputEnabled);

  if (audioInputEnabled) {
    // Check for API key availability
    const tdfHasKey = !!Session.get('currentTdfFile').tdfs.tutor.setspec.speechAPIKey;
    const userHasKey = !!Session.get('speechAPIKey');

    if (!tdfHasKey && !userHasKey) {
      console.warn('Audio input requested but no API key available (user or TDF)');
      // Don't initialize audio without API key
      audioInputEnabled = false;
    } else if (!Session.get('audioInputSensitivity')) {
      // Default to 60 (very sensitive) if TDF doesn't specify audioInputSensitivity
      const audioInputSensitivity = parseInt(Session.get('currentTdfFile').tdfs.tutor.setspec.audioInputSensitivity) || 60;
      Session.set('audioInputSensitivity', audioInputSensitivity);
    }
  }

  const audioOutputEnabled = Session.get('enableAudioPromptAndFeedback');
  if (audioOutputEnabled) {
    if (!Session.get('audioPromptSpeakingRate')) {
      // Default to 1 if TDF doesn't specify audioInputSilenceDelay
      const audioPromptSpeakingRate = parseFloat(Session.get('currentTdfFile').tdfs.tutor.setspec.audioPromptSpeakingRate) || 1;
      Session.set('audioPromptSpeakingRate', audioPromptSpeakingRate);
    }
  }
  // Get hidden items list from DB on card load
  const hiddenItems = ComponentStates.find({componentType: 'stimulus', showItem: false}).fetch();
  Session.set('hiddenItems', hiddenItems);

  window.AudioContext = window.webkitAudioContext || window.AudioContext;
  window.URL = window.URL || window.webkitURL;

  // Check if audio recorder pre-initialized during warmup
  if (window.audioRecorderContext) {
    clientConsole(2, '[Audio] Using pre-initialized audio context from warmup');
    audioContext = window.audioRecorderContext;
  } else {
    const audioContextConfig = {
      // FIX: Lower sample rate to 16kHz (Google Speech API recommendation) to reduce payload and improve latency
      sampleRate: 16000,
    }
    audioContext = new AudioContext(audioContextConfig);
  }

  // Initialize web audio if user enabled audio input (redirects through voice interstitial)

  $('#userLowerInteraction').html('');

  if (audioInputEnabled) {
    // Check if audio stream was pre-initialized during warmup
    if (window.preInitializedAudioStream && cardState.get('audioRecorderInitialized')) {
      clientConsole(2, '[Audio] Using pre-initialized audio stream from warmup - skipping getUserMedia');
      // Use the pre-initialized stream directly
      await startUserMedia(window.preInitializedAudioStream);
      // Clear the flag so we don't reuse it
      window.preInitializedAudioStream = null;
      cardState.set('audioRecorderInitialized', false);
    } else {
      await initializeAudio();
    }
  } else {
    cardStart();
  }
};

Template.card.events({
  'focus #userAnswer': function() {
    // Not much right now
  },

  'keypress #userAnswer': function(e) {
    const key = e.keyCode || e.which;
    if (key == ENTER_KEY && !cardState.get('submmissionLock')) {
      cardState.set('submmissionLock', true);
    }
    handleUserInput(e, 'keypress');
  },

  'click #removeQuestion': async function(e) {
    // Check if question was already reported before firing button
    if(!cardState.get('wasReportedForRemoval')) {
      await removeCardByUser();
      cardState.set('wasReportedForRemoval', true);
      await afterAnswerFeedbackCallback(Date.now(), trialStartTimestamp, 'removal', "", false, false, false);
    }
  },

  'click #dialogueIntroExit': function() {
    dialogueContinue();
  },

  'keypress #dialogueUserAnswer': function(e) {
    const key = e.keyCode || e.which;
    if (key == ENTER_KEY) {
      if (!cardState.get('enterKeyLock')) {
        cardState.set('enterKeyLock', true);
        $('#dialogueUserAnswer').prop('disabled', true);
        const answer = JSON.parse(JSON.stringify(_.trim($('#dialogueUserAnswer').val()).toLowerCase()));
        $('#dialogueUserAnswer').val('');
        const dialogueContext = DialogueUtils.updateDialogueState(answer);
        clientConsole(2, 'getDialogFeedbackForAnswer - context created');
        Meteor.callAsync('getDialogFeedbackForAnswer', dialogueContext, dialogueLoop);
      }
    }
  },

  'keypress #userForceCorrect': function(e) {
    handleUserForceCorrectInput(e, 'keypress');
  },
  'click #skipUnit': function() {
    if(Meteor.isDevelopment){
      unitIsFinished('Skipped by admin');
    }
  },
  'click #giveAnser': function() {
    if(Meteor.isDevelopment){
      giveAnswer();
    }
  },
  'click #giveWrongAnser': function() {
    if(Meteor.isDevelopment){
      giveWrongAnswer();
    }
  },
  'click #confirmFeedbackSelection': function() {
    cardState.set('displayFeedback', false);
    processUserTimesLog();  
  },
  'click #confirmFeedbackSelectionFromIndex': function(){
    cardState.set('displayFeedback', false);
    cardState.set('pausedLocks', cardState.get('pausedLocks')-1);
    Session.set('resetFeedbackSettingsFromIndex', false);
  },
  'click #overlearningButton': function(event) {
    event.preventDefault();
    leavePage('/home');
  },

  'click .multipleChoiceButton': function(event) {
    event.preventDefault();
    clientConsole(2, "multipleChoiceButton clicked");
    if(!cardState.get('submmissionLock')){
      if(!Session.get('curTdfUISettings').displayConfirmButton){
        cardState.set('submmissionLock', true);
        handleUserInput(event, 'buttonClick');
      } else {
        clientConsole(2, "multipleChoiceButton clicked (waiting for confirm)");
        //for all multipleChoiceButtons, make the selected one have class btn-selected, remove btn-selected from all others
        const selectedButton = event.currentTarget;
        $('.multipleChoiceButton').each(function(){
          $(this).removeClass('btn-secondary').addClass('btn-primary')
                 .attr('aria-checked', 'false');
        });
        $(selectedButton).addClass('btn-secondary')
                         .attr('aria-checked', 'true');
        //enable confirmButton
        $('#confirmButton').prop('disabled', false).attr('aria-disabled', 'false');
      }
    }
  },

  'keydown .multipleChoiceButton': function(event) {
    const key = event.keyCode || event.which;
    const currentButton = event.currentTarget;
    const allButtons = $('.multipleChoiceButton').toArray();
    const currentIndex = allButtons.indexOf(currentButton);

    let targetIndex = currentIndex;

    // Arrow key navigation (Left/Up = previous, Right/Down = next)
    if (key === 37 || key === 38) { // Left or Up arrow
      event.preventDefault();
      targetIndex = currentIndex > 0 ? currentIndex - 1 : allButtons.length - 1;
    } else if (key === 39 || key === 40) { // Right or Down arrow
      event.preventDefault();
      targetIndex = currentIndex < allButtons.length - 1 ? currentIndex + 1 : 0;
    } else if (key === 32 || key === 13) { // Space or Enter
      event.preventDefault();
      $(currentButton).click();
      return;
    }

    if (targetIndex !== currentIndex) {
      allButtons[targetIndex].focus();
      // For confirm button mode, also update selection visually
      if (Session.get('curTdfUISettings').displayConfirmButton) {
        $('.multipleChoiceButton').removeClass('btn-secondary').addClass('btn-primary')
                                  .attr('aria-checked', 'false');
        $(allButtons[targetIndex]).addClass('btn-secondary')
                                  .attr('aria-checked', 'true');
        $('#confirmButton').prop('disabled', false).attr('aria-disabled', 'false');
      }
    }
  },
  'click #confirmButton': function(event) {
    event.preventDefault();``
    clientConsole(2, "displayConfirmButton clicked");
    $('#confirmButton').addClass('hidden');
    if(!cardState.get('submmissionLock')){
      if(cardState.get('buttonTrial')){
        const selectedButton = $('.btn-secondary, .multipleChoiceButton');
        //change this event to a buttonClick event for that button
        event.currentTarget = selectedButton;
        handleUserInput(event, 'confirmButton');
      } else {
        //get user answer target element
        const userAnswer = document.getElementById('userAnswer');
        event.currentTarget = userAnswer;
        event.keyCode = ENTER_KEY;
        handleUserInput(event, 'confirmButton');
      }
    }

  },
  

  'click #continueStudy': function(event) {
    event.preventDefault();
    const timeout = cardState.get('CurTimeoutId')
    cardState.set('CurTimeoutId', undefined)
    Meteor.clearTimeout(timeout)
    afterFeedbackCallbackBind();
    engine.updatePracticeTime(Date.now() - cardState.get('trialEndTimeStamp'))
  },

  'click .instructModalDismiss': function(event) {
    event.preventDefault();
    $('#finalInstructionsDlg').modal('hide');
    if (Meteor.user().loginParams.loginMode === 'experiment') {
      // Experiment user - no where to go?
      leavePage(routeToSignin);
    } else {
      // "regular" logged-in user - go back to home page
      leavePage('/home');
    }
  },

  'click #continueButton': function(event) {
    event.preventDefault();
    //hide the continue button
    if($("#videoUnitContainer").length){
      destroyPlyr();
    }
    $("#continueBar").attr('hidden', '');
    $('#continueButton').prop('disabled', true);
    unitIsFinished('Continue Button Pressed');
  },

  'click #lastUnitModalDismiss': async function(event) {
    $("#lastUnitModal").modal('show')
    await initializePlyr();
  },

  'click #stepBackButton': function(event) {
    event.preventDefault();
    //check if the current unit has instructions and if so, show them
    if(Session.get('currentTdfUnit').unitinstructions){
      leaveTarget = '/instructions';
      Router.go('/instructions');
    } else {
      //get the current unit number and decrement it by 1
      let curUnit = Session.get('currentUnitNumber');
      let newUnitNumber = curUnit - 1;
      revisitUnit(newUnitNumber);
    }
  },
});

Template.card.helpers({
  'isExperiment': () => Meteor.user().loginParams.loginMode === 'experiment',

  'experimentLoginText': () => curTdfUISettings.experimentLoginText || "Amazon Turk ID",

  'isNormal': () => Meteor.user().loginParams.loginMode !== 'experiment',

  'isNotInDialogueLoopStageIntroOrExit': () => cardState.get('dialogueLoopStage') != 'intro' && cardState.get('dialogueLoopStage') != 'exit',

  'audioInputModeEnabled': function() {
    // Use reactive state value (updated by autorun, prevents duplicate TDF checks)
    return srState.get('audioInputModeEnabled');
  },

  'microphoneColorClass': function() {
    // Check if API key is configured in TDF (green) or if user needs to provide it (dark gray)
    const tdfFile = Session.get('currentTdfFile');
    const tdfHasKey = !!(tdfFile?.tdfs?.tutor?.setspec?.speechAPIKey);
    const tdfAudioEnabled = tdfFile?.tdfs?.tutor?.setspec?.audioInputEnabled === 'true';

    // Only apply color classes if audio input is enabled in TDF
    if (!tdfAudioEnabled) {
      return ''; // No special color if feature not enabled
    }

    // Green if TDF has API key, dark gray if user needs to provide key
    return tdfHasKey ? 'icon-configured' : 'icon-needs-config';
  },

  'voiceTranscriptionStatusMsg': function() {
    if(cardState.get('recording')){
      return 'Say skip or answer';
    } else {
      return 'Please wait...';
    }
  },

  'shouldShowSpeechRecognitionUI': function() {
    // Only show SR UI when awaiting input to prevent FOUC of red 'waiting' state
    const state = cardState.get('_debugTrialState');

    return state === TRIAL_STATES.PRESENTING_AWAITING;
  },

  'isImpersonating': function(){
    const user = Meteor.user();
    return user && user.profile ? user.profile.impersonating : false;
  },

  'displayFeedback': () => cardState.get('displayFeedback') && Session.get('currentDeliveryParams').allowFeedbackTypeSelect,

  'resetFeedbackSettingsFromIndex': () => Session.get('resetFeedbackSettingsFromIndex'),

  'username': function() {
    if (!haveMeteorUser()) {
      clientConsole(1, '!haveMeteorUser');
      leavePage(routeToSignin);
    } else {
      return Meteor.user().username;
    }
  },

  'ReviewStudyCountdown': () => cardState.get('ReviewStudyCountdown'),

  'subWordClozeCurrentQuestionExists': function() {
    const experimentState = Session.get('currentExperimentState');
    return typeof(experimentState.clozeQuestionParts) != 'undefined' && experimentState.clozeQuestionParts !== null;
  },

  // For now we're going to assume syllable hints are contiguous. TODO: make this more generalizable
  'subWordParts': function() {
    const experimentState = Session.get('currentExperimentState');
    // Security: Sanitize HTML to prevent XSS while allowing safe formatting
    return sanitizeHTML(experimentState.clozeQuestionParts);
  },

  'ifClozeDisplayTextExists': function (){
    const currentDisplay = cardState.get('currentDisplay');
    const experimentState = Session.get('currentExperimentState');
    const clozeText = currentDisplay ? currentDisplay.clozeText : undefined;
    const text = currentDisplay ? currentDisplay.text : undefined;
    const subWordCloze = experimentState.clozeQuestionParts ? experimentState.clozeQuestionParts : undefined;
    let display = false;
    if((typeof clozeText != "undefined" && clozeText != "") || (typeof subWordCloze != "undefined" && subWordCloze != "") || (typeof text != "undefined" && text != "")){
      display = true;
    }
    return display;
  },

  'clozeText': function() {
    const currentDisplay = cardState.get('currentDisplay');
    // Security: Sanitize HTML to prevent XSS while allowing safe formatting
    return currentDisplay ? sanitizeHTML(currentDisplay.clozeText) : undefined;
  },

  'text': function() {
    const currentDisplay = cardState.get('currentDisplay');
    // Security: Sanitize HTML to prevent XSS while allowing safe formatting
    return currentDisplay ? sanitizeHTML(currentDisplay.text) : undefined;
  },

  'videoUnitDisplayText': function() {
    const curUnit = Session.get('currentTdfUnit');
    // Security: Sanitize HTML to prevent XSS while allowing safe formatting
    return sanitizeHTML(curUnit.videosession.displayText);
  },

  'dialogueText': function() {
    const text = cardState.get('dialogueDisplay') ? cardState.get('dialogueDisplay').text : undefined;
    // Security: Sanitize HTML to prevent XSS while allowing safe formatting
    return sanitizeHTML(text);
  },

  'curImgSrc': function() {
    const currentDisplay = cardState.get('currentDisplay');
    const curImgSrc = currentDisplay ? currentDisplay.imgSrc : undefined;
    if (curImgSrc && imagesDict[curImgSrc]) {
      return imagesDict[curImgSrc].src;
    } else {
      return '';
    }
  },

  'curImgWidth': function() {
    const currentDisplay = cardState.get('currentDisplay');
    const curImgSrc = currentDisplay ? currentDisplay.imgSrc : undefined;
    if (curImgSrc && imagesDict[curImgSrc]) {
      return imagesDict[curImgSrc].naturalWidth || '';
    }
    return '';
  },

  'curImgHeight': function() {
    const currentDisplay = cardState.get('currentDisplay');
    const curImgSrc = currentDisplay ? currentDisplay.imgSrc : undefined;
    if (curImgSrc && imagesDict[curImgSrc]) {
      return imagesDict[curImgSrc].naturalHeight || '';
    }
    return '';
  },

  'curVideoSrc': function() {
    const currentDisplay = cardState.get('currentDisplay');
    return currentDisplay ? currentDisplay.videoSrc : undefined;
  },

  'displayAnswer': function() {
    return Answers.getDisplayAnswerText(cardState.get('currentAnswer'));
  },

  'rawAnswer': ()=> cardState.get('currentAnswer'),

  'currentProgress': () => Session.get('questionIndex'),

  'displayReady': function() {
    return cardState.get('displayReady');
  },

  'inputReady': function() {
    return cardState.get('inputReady');
  },

  'readyPromptString': () => Session.get('currentDeliveryParams').readyPromptString,

  'displayReadyPromptString': function() {
    const deliveryParams = Session.get('currentDeliveryParams');
    return !cardState.get('displayReady') && deliveryParams.readyPromptString
  },

  'isDevelopment': () => Meteor.isDevelopment,

  'displayReadyConverter': function(displayReady) {
    return displayReady ? '' : 'none';
  },

  'textCard': function() {
    const currentDisplay = cardState.get('currentDisplay');
    return !!currentDisplay && !!currentDisplay.text;
  },

  'audioCard': function() {
    const currentDisplay = cardState.get('currentDisplay');
    return !!currentDisplay && !!currentDisplay.audioSrc;
  },

  'audioIconColorClass': function() {
    // Check if audio output is configured (audio files) or if user needs to provide it (TTS only)
    const tdfFile = Session.get('currentTdfFile');
    const tdfAudioPromptMode = tdfFile?.tdfs?.tutor?.setspec?.audioPromptMode;
    const audioOutputEnabled = tdfAudioPromptMode && tdfAudioPromptMode !== 'silent';

    // Only apply color classes if audio output is enabled in TDF
    if (!audioOutputEnabled) {
      return ''; // No special color if feature not enabled
    }

    // Green if TDF has audioPromptMode configured (TDF provides the setting)
    // This means the TDF is set up to use audio output
    return 'icon-configured';
  },

  'speakerCardPosition': function() {
    //centers the speaker icon if there are no displays.
    const currentDisplay = cardState.get('currentDisplay');
    if(currentDisplay &&
        !currentDisplay.imgSrc &&
        !currentDisplay.videoSrc &&
        !currentDisplay.clozeText &&
        !currentDisplay.text)
      return `col-md-12 text-center`;
    return `col-md-1`
  },

  'imageCard': function() {
    const currentDisplay = cardState.get('currentDisplay');
    return !!currentDisplay && !!currentDisplay.imgSrc;
  },

  'videoCard': function() {
    const currentDisplay = cardState.get('currentDisplay');
    return !!currentDisplay && !!currentDisplay.videoSrc;
  },

  'clozeCard': function() {
    const currentDisplay = cardState.get('currentDisplay');
    return !!currentDisplay && !!currentDisplay.clozeText;
  },

  'textOrClozeCard': function() {
    const currentDisplay = cardState.get('currentDisplay');
    return !!currentDisplay &&
      (!!currentDisplay.text || !!currentDisplay.clozeText);
  },

  'anythingButAudioCard': function() {
    const currentDisplay = cardState.get('currentDisplay');
    return !!currentDisplay &&
            (!!currentDisplay.text ||
            !!currentDisplay.clozeText ||
            !!currentDisplay.imgSrc ||
            !!currentDisplay.videoSrc);
  },

  'imageResponse': function() {
    const rt = getResponseType();
    return rt === 'image';
  },

  'isVideoSession': () => Session.get('isVideoSession'),

  'isYoutubeVideo': function() {
    return (Session.get('isVideoSession') && cardState.get('videoSource') && cardState.get('videoSource').includes('http'))
  },

  'videoId': function() {
    return cardState.get('videoSource')
  },

  'videoSource': function() {
    return Session.get('isVideoSession') && cardState.get('videoSource') ? cardState.get('videoSource') : '';
  },

  'test': function() {
    return getTestType() === 't';
  },

  'study': function() {
    const type = getTestType();
    return type === 's' || type === 'f';
  },

  'drill': function() {
    const type = getTestType();
    return type === 'd' || type === 'm' || type === 'n' || type === 'i';
  },

  'trial': function() {
    const type = getTestType();
    return type === 'd' || type === 's' || type === 'f' || type === 't' || type === 'm' || type === 'n' || type === 'i';
  },

  'testordrill': function() {
    const type = getTestType();
    return type === 'd' || type === 't' || type === 'm' || type === 'n' || type === 'i';
  },

  'hideResponse': function() {
    return getTestType() !== 'f';
  },

  'fontSizeClass': function() {
    // Take advantage of Bootstrap h1-h5 classes
    const params = Session.get('currentDeliveryParams');
    // Safely handle undefined params or fontsize
    const fontSize = (params && params.fontsize != null) ? params.fontsize : 2;
    const hSize = fontSize.toString();
    return 'h' + hSize;
  },

  'getFontSizeStyle': function() {
    const fontsize = Session.get('currentDeliveryParams') && Session.get('currentDeliveryParams').fontsizePX;
    if (fontsize) {
      return 'font-size: ' + fontsize + 'px;';
    }
    return '';
  },

  'skipstudy': function() {
    let parms = Session.get('currentDeliveryParams').skipstudy
    if(parms){
      const testType = getTestType();
      if (testType === 's') {
        return true;
      }
      if(testType === 'd' && cardState.get('inFeedback')){
        return true;
      }
    }
    return false;
  },

  'buttonTrial': () => cardState.get('buttonTrial'),

  'inFeedback': () => cardState.get('inFeedback'),

  'notButtonTrialOrInDialogueLoop': () => !cardState.get('buttonTrial') || DialogueUtils.isUserInDialogueLoop(),

  'buttonList': function() {
    return cardState.get('buttonList');
  },

  'buttonListImageRows': function() {
    const items = cardState.get('buttonList');
    const numColumns = Session.get('currentDeliveryParams').numButtonListImageColumns;
    const numRows = Math.ceil(items.length / numColumns);
    const arrayHolder = [];
    for (let i=0; i<numRows; i++) {
      arrayHolder.push([]);
    }
    for (let i=0; i<items.length; i++) {
      const arrayIndex = Math.floor(i / numColumns);
      arrayHolder[arrayIndex].push(items[i]);
    }

    return arrayHolder;
  },

  'haveScrollList': function() {
    return _.intval(cardState.get('scrollListCount')) > 0;
  },

  'scrollList': function() {
    return scrollList.find({'temp': 1, 'justAdded': 0}, {sort: {idx: 1}});
  },

  'currentScore': () => cardState.get('currentScore'),

  'haveDispTimeout': function() {
    const disp = getDisplayTimeouts();
    return (disp.minSecs > 0 || disp.maxSecs > 0);
  },

  'userInDiaglogue': () => cardState.get('showDialogueText') && cardState.get('dialogueDisplay'),

  'audioEnabled': () => {
    // Use reactive state value (updated by autorun, prevents duplicate TDF checks)
    return srState.get('audioInputModeEnabled');
  },

  'showDialogueHints': function() {
    if(Meteor.isDevelopment){
      return true;
    }
    return cardState.get('showDialogueHints')
  },

  'dialogueCacheHint': () => cardState.get('dialogueCacheHint'),

  'questionIsRemovable': () => cardState.get('numVisibleCards') > 3 && Session.get('currentDeliveryParams').allowstimulusdropping,

  'debugParms': () => cardState.get('debugParms'),

  'probabilityParameters': function(){
    probParms = [];
    parms = Session.get('currentStimProbFunctionParameters');
    keys = Object.keys(parms);
    for(key of keys){
      probParms.push({
        'parameter': key,
        'value': parms[key]
      });
    }
    return probParms;
  },
  'UIsettings': () => Session.get('curTdfUISettings'),

  'stimuliBoxClasses': function() {
    const uiSettings = Session.get('curTdfUISettings');
    if (!uiSettings.showStimuliBox) {
      return 'alert alert-transparent';
    }
    
    const baseClasses = 'alert';
    const colorValue = uiSettings.stimuliBoxColor || 'alert-bg';
    
    if (colorValue.startsWith('alert-')) {
      return baseClasses + ' ' + colorValue;
    } else {
      return baseClasses + ' alert-bg';
    }
  },

  'stimuliBoxStyle': function() {
    const uiSettings = Session.get('curTdfUISettings');
    if (!uiSettings.showStimuliBox) {
      return '';
    }
    
    const colorValue = uiSettings.stimuliBoxColor || 'alert-bg';
    
    if (!colorValue.startsWith('alert-')) {
      return 'background-color: ' + colorValue + ' !important;';
    }
    
    return '';
  },

  'allowGoBack': function() {
    //check if this is allowed
    if(Session.get('currentDeliveryParams').allowRevistUnit || Session.get('currentTdfFile').tdfs.tutor.setspec.allowRevistUnit){
      //get the current unit number and decrement it by 1, and see if it exists
      let curUnitNumber = Session.get('currentUnitNumber');
      let newUnitNumber = curUnitNumber - 1;
      if(newUnitNumber >= 0 && Session.get('currentTdfFile').tdfs.tutor.unit.length >= newUnitNumber){
        return true;
      } else {
        return false;
      }
    } else {
      return false;
    }
  },

  // TEMPLATE OPTIMIZATION HELPERS - Flatten nested conditionals and replace inline class logic

  /**
   * Checks if sub-word cloze should be displayed
   * Replaces 6-level deep conditional nesting
   */
  'shouldShowSubWordCloze': function() {
    // Check trial type
    const type = getTestType();
    const trial = type === 'd' || type === 's' || type === 'f' || type === 't' || type === 'm' || type === 'n' || type === 'i';

    // Check anythingButAudioCard
    const currentDisplay = cardState.get('currentDisplay');
    const anythingButAudioCard = !!currentDisplay &&
            (!!currentDisplay.text ||
            !!currentDisplay.clozeText ||
            !!currentDisplay.imgSrc ||
            !!currentDisplay.videoSrc);

    // Check ifClozeDisplayTextExists
    const experimentState = Session.get('currentExperimentState');
    const clozeText = currentDisplay ? currentDisplay.clozeText : undefined;
    const text = currentDisplay ? currentDisplay.text : undefined;
    const subWordCloze = experimentState.clozeQuestionParts ? experimentState.clozeQuestionParts : undefined;
    const ifClozeDisplayTextExists = (typeof clozeText != "undefined" && clozeText != "") || (typeof subWordCloze != "undefined" && subWordCloze != "") || (typeof text != "undefined" && text != "");

    // Check textOrClozeCard
    const textOrClozeCard = !!currentDisplay && (!!currentDisplay.text || !!currentDisplay.clozeText);

    // Check subWordClozeCurrentQuestionExists
    const subWordClozeCurrentQuestionExists = !!subWordCloze;

    return trial && anythingButAudioCard && ifClozeDisplayTextExists &&
           textOrClozeCard && subWordClozeCurrentQuestionExists;
  },

  /**
   * Checks if standard cloze/text should be displayed
   * Replaces 6-level deep conditional nesting
   */
  'shouldShowStandardCloze': function() {
    // Check trial type
    const type = getTestType();
    const trial = type === 'd' || type === 's' || type === 'f' || type === 't' || type === 'm' || type === 'n' || type === 'i';

    // Check anythingButAudioCard
    const currentDisplay = cardState.get('currentDisplay');
    const anythingButAudioCard = !!currentDisplay &&
            (!!currentDisplay.text ||
            !!currentDisplay.clozeText ||
            !!currentDisplay.imgSrc ||
            !!currentDisplay.videoSrc);

    // Check ifClozeDisplayTextExists
    const experimentState = Session.get('currentExperimentState');
    const clozeText = currentDisplay ? currentDisplay.clozeText : undefined;
    const text = currentDisplay ? currentDisplay.text : undefined;
    const subWordCloze = experimentState.clozeQuestionParts ? experimentState.clozeQuestionParts : undefined;
    const ifClozeDisplayTextExists = (typeof clozeText != "undefined" && clozeText != "") || (typeof subWordCloze != "undefined" && subWordCloze != "") || (typeof text != "undefined" && text != "");

    // Check textOrClozeCard
    const textOrClozeCard = !!currentDisplay && (!!currentDisplay.text || !!currentDisplay.clozeText);

    // Check subWordClozeCurrentQuestionExists
    const subWordClozeCurrentQuestionExists = !!subWordCloze;

    return trial && anythingButAudioCard && ifClozeDisplayTextExists &&
           textOrClozeCard && !subWordClozeCurrentQuestionExists;
  },

  /**
   * Returns correctness class for answer display
   * Replaces: {{#if userCorrect}}bg-success{{/if}} {{#unless userCorrect}}bg-danger{{/unless}}
   */
  'correctnessClass': function(isCorrect) {
    return isCorrect ? 'bg-success' : 'bg-danger';
  },

  /**
   * Returns video session specific classes
   * Replaces: {{#if isVideoSession}}questionContainer position-absolute z-1{{/if}}
   */
  'videoSessionClasses': function(isVideoSession) {
    return isVideoSession ? 'questionContainer position-absolute z-1' : '';
  },

  /**
   * Returns study display class
   * Replaces: {{#if study}} {{UIsettings.textInputDisplay}} {{/if}}
   */
  'studyDisplayClass': function(isStudy, uiSettings) {
    return isStudy ? (uiSettings.textInputDisplay || '') : '';
  },

  /**
   * Returns video session overflow classes for MC container
   * Replaces: {{#if isVideoSession}} max-vh-30 overflow-scroll {{/if}}
   */
  'videoMCClasses': function(isVideoSession) {
    return isVideoSession ? 'max-vh-30 overflow-scroll' : '';
  },
});

function getResponseType() {
  // If we get called too soon, we just use the first cluster
  const clusterIndex = Session.get('clusterIndex') || 0;
  const cluster = getStimCluster(clusterIndex);
  const type = cluster.stims[0].itemResponseType || 'text';

  return ('' + type).toLowerCase();
}

// Read CSS --transition-smooth variable to sync JavaScript timing with CSS transitions
function getTransitionDuration() {
  // Read --transition-smooth CSS variable from root element for FADING_IN/FADING_OUT transitions
  const rootStyles = getComputedStyle(document.documentElement);
  const cssValue = rootStyles.getPropertyValue('--transition-smooth').trim();

  // Parse the value (could be "200ms" or "0.2s")
  if (cssValue.endsWith('ms')) {
    return parseInt(cssValue);
  } else if (cssValue.endsWith('s')) {
    return parseFloat(cssValue) * 1000;
  }

  // Fallback if CSS variable not found (shouldn't happen)
  console.warn('Could not read --transition-smooth CSS variable, using fallback 200ms');
  return 200;
}

// STATE MACHINE: FADE-IN helpers encapsulate PRESENTING.FADING_IN → DISPLAYING transition

function shouldSkipFadeIn() {
  const displayReady = cardState.get('displayReady');
  const isVideoSession = Session.get('isVideoSession');
  return displayReady || isVideoSession;
}

function beginFadeIn(reason) {
  clientConsole(2, '[SM] Starting fade-in:', reason);
  transitionTrialState(TRIAL_STATES.PRESENTING_FADING_IN, reason);
  cardState.set('displayReady', true);

  // Hide global loading spinner after first trial is ready (elegant transition from dashboard)
  const currentState = Session.get('currentExperimentState');
  const numAnswered = currentState?.numQuestionsAnswered || 0;
  if (numAnswered === 0 && Session.get('appLoading')) {
    clientConsole(2, '[UI] First trial ready - hiding global spinner');
    Session.set('appLoading', false);
  }
}

function completeFadeIn() {
  transitionTrialState(TRIAL_STATES.PRESENTING_DISPLAYING, 'Fade-in complete, content visible');
}

// STATE MACHINE: Trial flows - Study: PRESENTING→STUDY→TRANSITION, Drill: PRESENTING→AWAITING→FEEDBACK→TRANSITION, Test: PRESENTING→AWAITING→TRANSITION

const TRIAL_STATES = {
  // PRESENTING PHASE - User sees question (drill/test share this, 15-30s for input)
  PRESENTING_LOADING: 'PRESENTING.LOADING',          // Selecting card, loading assets (50-500ms)
  PRESENTING_FADING_IN: 'PRESENTING.FADING_IN',      // New content appearing (uses --transition-smooth)
  PRESENTING_DISPLAYING: 'PRESENTING.DISPLAYING',    // Visible, input disabled (brief ~10ms)
  PRESENTING_AWAITING: 'PRESENTING.AWAITING',        // Input enabled, waiting (drill/test only)

  // STUDY PHASE - Study trials only (separate from presenting/feedback, purestudy timeout)
  STUDY_SHOWING: 'STUDY.SHOWING',                    // Display stimulus+answer (study only)

  // FEEDBACK PHASE - Drill trials only (shows correctness, 2-5s duration)
  FEEDBACK_SHOWING: 'FEEDBACK.SHOWING',              // Display correct/incorrect (drill only)

  // TRANSITION PHASE - Between trials (all types, ~440ms total with default settings)
  TRANSITION_START: 'TRANSITION.START',              // Brief cleanup (10ms)
  TRANSITION_FADING_OUT: 'TRANSITION.FADING_OUT',    // Old content disappearing (uses --transition-smooth)
  TRANSITION_CLEARING: 'TRANSITION.CLEARING',        // Clearing DOM while invisible (40ms)

  // Special states
  IDLE: 'IDLE',                                      // Initial page load only
  ERROR: 'ERROR'                                     // Error recovery
};

// Helper: Check if this trial type shows feedback (FEEDBACK phase only, not STUDY)
function trialShowsFeedback() {
  const testType = getTestType();
  return testType === 'd'; // Drill only (NOT study/test)
}

// Helper: Check if this trial type uses STUDY phase
function trialUsesStudyPhase() {
  const testType = getTestType();
  return testType === 's';
}

// Track current state (M3: Converted to reactive state)
trialState.set('current', TRIAL_STATES.IDLE);

// Valid state transitions (varies by trial type)
const VALID_TRANSITIONS = {
  [TRIAL_STATES.IDLE]: [
    TRIAL_STATES.PRESENTING_LOADING,  // Normal: prepareCard() starts trial
    TRIAL_STATES.PRESENTING_FADING_IN // Initial page load: first trial starts directly
  ],

  // PRESENTING phase transitions
  [TRIAL_STATES.PRESENTING_LOADING]: [TRIAL_STATES.PRESENTING_FADING_IN],
  [TRIAL_STATES.PRESENTING_FADING_IN]: [TRIAL_STATES.PRESENTING_DISPLAYING],
  [TRIAL_STATES.PRESENTING_DISPLAYING]: [
    TRIAL_STATES.PRESENTING_AWAITING,  // For drill/test
    TRIAL_STATES.STUDY_SHOWING         // For study (skips AWAITING, goes to STUDY phase)
  ],
  [TRIAL_STATES.PRESENTING_AWAITING]: [
    TRIAL_STATES.FEEDBACK_SHOWING,     // For drill (shows feedback)
    TRIAL_STATES.TRANSITION_START      // For test (skips feedback)
  ],

  // STUDY phase transitions (study trials only)
  [TRIAL_STATES.STUDY_SHOWING]: [TRIAL_STATES.TRANSITION_START],

  // FEEDBACK phase transitions (drill trials only)
  [TRIAL_STATES.FEEDBACK_SHOWING]: [TRIAL_STATES.TRANSITION_START],

  // TRANSITION phase transitions
  [TRIAL_STATES.TRANSITION_START]: [TRIAL_STATES.TRANSITION_FADING_OUT],
  [TRIAL_STATES.TRANSITION_FADING_OUT]: [TRIAL_STATES.TRANSITION_CLEARING],
  [TRIAL_STATES.TRANSITION_CLEARING]: [TRIAL_STATES.PRESENTING_LOADING], // Loop

  // Error recovery
  [TRIAL_STATES.ERROR]: [] // Terminal state
};

/**
 * Transition to a new trial state with logging and validation
 * @param {string} newState - The state to transition to (from TRIAL_STATES)
 * @param {string} reason - Human-readable reason for transition
 */
function transitionTrialState(newState, reason = '') {
  const previousState = trialState.get('current');
  const trialNum = (Session.get('currentExperimentState')?.numQuestionsAnswered || 0) + 1;

  // Validate transition
  const validNextStates = VALID_TRANSITIONS[previousState] || [];
  if (!validNextStates.includes(newState) && newState !== TRIAL_STATES.ERROR) {
    console.error(
      `[SM] ❌ [Trial ${trialNum}] INVALID STATE TRANSITION: ${previousState} → ${newState}`,
      `\n   Valid transitions from ${previousState}: ${validNextStates.join(', ')}`,
      reason ? `\n   Reason: ${reason}` : ''
    );
    // STATE MACHINE: Don't throw on invalid transition - log only, allow transition for now
  }

  // Log transition
  clientConsole(2,
    `[SM] ✓ [Trial ${trialNum}] STATE: ${previousState} → ${newState}`,
    reason ? `(${reason})` : ''
  );

  trialState.set('current', newState);

  // Optional: Store in Session for debugging/visibility
  cardState.set('_debugTrialState', newState);

  // ACCESSIBILITY: Announce important state changes to screen readers
  announceTrialStateToScreenReader(newState, trialNum);
}

/**
 * Announce trial state changes to screen readers via ARIA live region
 * Only announces user-facing states (not internal loading states)
 */
function announceTrialStateToScreenReader(state, trialNum) {
  const announcer = $('#trialStateAnnouncer');
  if (!announcer.length) return;

  let message = '';

  // Only announce states that matter to users
  switch(state) {
    case TRIAL_STATES.PRESENTING_DISPLAYING:
      message = `Question ${trialNum} displayed`;
      break;
    case TRIAL_STATES.PRESENTING_AWAITING:
      message = `Question ${trialNum} ready for your answer`;
      break;
    case TRIAL_STATES.STUDY_SHOWING:
      message = `Study card ${trialNum} displayed`;
      break;
    case TRIAL_STATES.FEEDBACK_SHOWING:
      message = `Feedback for question ${trialNum}`;
      break;
    case TRIAL_STATES.TRANSITION_START:
      message = `Moving to next question`;
      break;
    // Don't announce loading/internal states (LOADING, FADING_IN, CLEARING, etc)
    default:
      return; // No announcement for internal states
  }

  if (message) {
    announcer.text(message);
  }
}

let soundsDict = {};
let imagesDict = {};
let isNavigatingAway = false;
const onEndCallbackDict = {};
let pollMediaDevicesInterval = null;
function pollMediaDevices() {
  navigator.mediaDevices.enumerateDevices().then(function(devices) {
    if (selectedInputDevice != null) {
      if (devices.filter((x) => x.deviceId == selectedInputDevice).length == 0) {
        clientConsole(1, 'input device lost!!!');
        reinitializeMediaDueToDeviceChange();
      }
    }
  });
}

function clearAudioContextAndRelatedVariables() {
  if (streamSource) {
    streamSource.disconnect();
  }
  const tracks = userMediaStream ? userMediaStream.getTracks() : [];
  for (let i=0; i<tracks.length; i++) {
    const track = tracks[i];
    track.stop();
  }
  selectedInputDevice = null;
  userMediaStream = null;
  streamSource = null;
  Meteor.clearInterval(pollMediaDevicesInterval);
  pollMediaDevicesInterval = null;
}

function reinitializeMediaDueToDeviceChange() {
  // This will be decremented on startUserMedia and the main card timeout will be reset due to card being reloaded
  cardState.set('pausedLocks', cardState.get('pausedLocks')+1);
  audioContext.close();
  clearAudioContextAndRelatedVariables();
  const errMsg = 'It appears you may have unplugged your microphone.  \
    Please plug it back then click ok to reinitialize audio input.';
  alert(errMsg);
  initializeAudio().catch(function(err) {
    clientConsole(1, 'Error reinitializing audio after device change', err);
  });
}

async function initializeAudio() {
  try {
    // Older browsers might not implement mediaDevices at all, so we set an empty object first
    if (navigator.mediaDevices === undefined) {
      clientConsole(2, 'media devices undefined');
      navigator.mediaDevices = {};
    }

    // Browser compat: Some browsers partially implement mediaDevices, can't overwrite with assignment
    if (navigator.mediaDevices.getUserMedia === undefined) {
      navigator.mediaDevices.getUserMedia = function(constraints) {
        // First get ahold of the legacy getUserMedia, if present
        const getUserMedia = navigator.webkitGetUserMedia || navigator.mozGetUserMedia ||
          navigator.msGetUserMedia || navigator.getUserMedia;

        // Browser compat: Return rejected promise for consistent interface if getUserMedia not implemented
        if (!getUserMedia) {
          return Promise.reject(new Error('getUserMedia is not implemented in this browser'));
        }

        // Otherwise, wrap the call to the old navigator.getUserMedia with a Promise
        return new Promise(function(resolve, reject) {
          getUserMedia.call(navigator, constraints, resolve, reject);
        });
      };
    }

    const stream = await navigator.mediaDevices.getUserMedia({audio: true, video: false});
    await startUserMedia(stream);
  } catch (err) {
    console.error('[SR] Error getting user media:', err.name, err.message);
    console.warn('[SR] Speech recognition disabled - continuing without audio input');
    console.warn('[SR] Note: getUserMedia requires HTTPS for remote connections');
    // Continue card initialization even if audio fails
    cardStart();
  }
}

function preloadVideos() {
  if (Session.get('currentTdfUnit') && 
  Session.get('currentTdfUnit').videosession &&
  Session.get('currentTdfUnit').videosession.videosource) {
    if(Session.get('currentTdfUnit').videosession.videosource.includes('http')){
      cardState.set('videoSource', Session.get('currentTdfUnit').videosession.videosource);
    } else {
      cardState.set('videoSource', DynamicAssets.findOne({name: Session.get('currentTdfUnit').videosession.videosource}).link());
    }
  }
}

function preloadImages() {
  const curStimImgSrcs = getCurrentStimDisplaySources('imageStimulus');
  imagesDict = {};
  const imageLoadPromises = [];
  let img;
  for (let src of curStimImgSrcs) {
    const loadPromise = new Promise((resolve, reject) => {
      if(!src.includes('http')){
        const asset = DynamicAssets.findOne({name: src});
        if (!asset) {
          clientConsole(1, 'Image asset not found:', src);
          resolve();
          return;
        }
        link = asset.link();

        // Convert absolute URLs to relative paths for remote/LAN access compatibility
        const pathMatch = link.match(/^https?:\/\/[^/]+(\/.+)$/);
        if (pathMatch) {
          link = pathMatch[1]; // Use relative path
        } else {
          clientConsole(1, 'Failed to convert URL to relative:', link);
        }

        img = new Image();
        img.onload = () => {
          resolve();
        };
        img.onerror = () => {
          clientConsole(1, 'img failed to load:', src);
          resolve(); // Resolve anyway to not block the UI
        };
        img.src = link;
        imagesDict[src] = img;
      } else {
        img = new Image();
        img.onload = () => {
          clientConsole(2, 'img loaded:', src);
          resolve();
        };
        img.onerror = () => {
          clientConsole(1, 'img failed to load:', src);
          resolve(); // Resolve anyway to not block the UI
        };
        img.src = src;
        imagesDict[src] = img;
      }
    });
    imageLoadPromises.push(loadPromise);
  }
  // Return promise that resolves when all images are loaded
  return Promise.all(imageLoadPromises);
}

// Wait for DOM image to be fully loaded and painted before fading in
function waitForDOMImageReady() {
  return new Promise((resolve) => {
    const currentDisplay = cardState.get('currentDisplay');

    // Only wait if this is an image card
    if (!currentDisplay || !currentDisplay.imgSrc) {
      resolve();
      return;
    }

    // Find the stimulus image element in the DOM
    const imgElement = document.querySelector('.stimulus-image');

    if (!imgElement) {
      clientConsole(2, '[Image UX] No image element found in DOM, skipping wait');
      resolve();
      return;
    }

    // If image is already complete (loaded and decoded), resolve immediately
    if (imgElement.complete && imgElement.naturalHeight !== 0) {
      clientConsole(2, '[Image UX] Image already loaded and ready');
      resolve();
      return;
    }

    clientConsole(2, '[Image UX] Waiting for image to be fully loaded before fade-in...');

    // Set up timeout fallback (max 500ms wait)
    const timeoutId = setTimeout(() => {
      clientConsole(1, '[Image UX] Image load timeout after 500ms, proceeding anyway');
      imgElement.removeEventListener('load', onLoad);
      imgElement.removeEventListener('error', onError);
      resolve();
    }, 500);

    const onLoad = () => {
      clearTimeout(timeoutId);
      imgElement.removeEventListener('error', onError);
      clientConsole(2, '[Image UX] Image loaded successfully, ready for fade-in');
      resolve();
    };

    const onError = () => {
      clearTimeout(timeoutId);
      imgElement.removeEventListener('load', onLoad);
      clientConsole(1, '[Image UX] Image failed to load, proceeding with fade-in anyway');
      resolve();
    };

    // MO4: Passive listeners for better performance (no preventDefault needed)
    imgElement.addEventListener('load', onLoad, {passive: true});
    imgElement.addEventListener('error', onError, {passive: true});
  });
}

function getCurrentStimDisplaySources(filterPropertyName='clozeStimulus') {
  const displaySrcs = [];
  const stims = Session.get('currentStimuliSet');
  for (const stim of stims) {
    if (stim[filterPropertyName]) {
      displaySrcs.push(stim[filterPropertyName]);
    }
  }
  return displaySrcs;
}

async function preloadStimuliFiles() {
  clientConsole(2, '[SM] preloadStimuliFiles called in state:', trialState.get('current'));
  // Pre-load sounds to be played into soundsDict to avoid audio lag issues
  if (curStimHasSoundDisplayType()) {
    clientConsole(2, 'Sound type questions detected, pre-loading sounds');
  } else {
    clientConsole(2, 'Non sound type detected');
  }
  if (curStimHasImageDisplayType()) {
    clientConsole(2, 'image type questions detected, pre-loading images');
    await preloadImages();
    clientConsole(2, 'All images preloaded');
  } else {
    clientConsole(2, 'Non image type detected');
  }

  // TTS warmup now in audioSettings.js for better UX (delay when accessing settings, not trial 1)
}

function checkUserAudioConfigCompatability(){
  // Check if TTS would actually be enabled based on both user preference AND TDF settings
  const userAudioPromptMode = Meteor.user()?.audioSettings?.audioPromptMode;
  const tdfAudioPromptMode = Session.get('currentTdfFile')?.tdfs?.tutor?.setspec?.audioPromptMode;
  const tdfSupportsAudioPrompts = tdfAudioPromptMode && tdfAudioPromptMode !== 'silent';
  const userWantsAudioPrompts = userAudioPromptMode && userAudioPromptMode !== 'silent';

  // Only check compatibility if TTS would actually be active
  const audioPromptMode = (tdfSupportsAudioPrompts && userWantsAudioPrompts) ? userAudioPromptMode : 'silent';

  if (curStimHasImageDisplayType() && ((audioPromptMode == 'all' || audioPromptMode == 'question'))) {
    clientConsole(1, 'PANIC: Unable to process TTS for image response', Session.get('currentRootTdfId'));
    alert('Question reading not supported on this TDF. Please disable and try again.');
    leavePage('/home');
  }
}

function curStimHasSoundDisplayType() {
  const currentStimuliSetId = Session.get('currentStimuliSetId');
  const stimDisplayTypeMap = Session.get('stimDisplayTypeMap');
  // Defensive check: map might exist but not have entry for this specific stimuliSetId
  return currentStimuliSetId && stimDisplayTypeMap && stimDisplayTypeMap[currentStimuliSetId]
    ? stimDisplayTypeMap[currentStimuliSetId].hasAudio
    : false;
}

function curStimHasImageDisplayType() {
  const currentStimuliSetId = Session.get('currentStimuliSetId');
  const stimDisplayTypeMap = Session.get('stimDisplayTypeMap');

  // Check if the map exists AND has entry for this stimuliSetId
  if (currentStimuliSetId && stimDisplayTypeMap && stimDisplayTypeMap[currentStimuliSetId]) {
    return stimDisplayTypeMap[currentStimuliSetId].hasImage;
  }

  // Fallback: If map not populated for this set, check if there are actual image stimuli
  const imageSrcs = getCurrentStimDisplaySources('imageStimulus');
  return imageSrcs && imageSrcs.length > 0;
}



// Button config: buttonorder (fixed/random), buttonOptions (labels), wrongButtonLimit (count of wrong buttons)
function setUpButtonTrial() {
  const currUnit = Session.get('currentTdfUnit');
  const deliveryParams = Session.get('currentDeliveryParams');
  let buttonChoices = [];
  const buttonOrder = currUnit.buttonorder ? currUnit.buttonorder.trim().toLowerCase() : "";
  const buttonOptions = currUnit.buttonOptions ? currUnit.buttonOptions.trim() : "";
  let correctButtonPopulated = null;

  if (buttonOptions) {
    if(typeof buttonOptions == "object"){
      buttonChoices = buttonOptions
    }
    else{
      buttonChoices = buttonOptions.split(',');
    }
    correctButtonPopulated = true;
    clientConsole(2, 'buttonChoices==buttonOptions', buttonChoices);
  } else {
    const currentFalseResponses = getCurrentFalseResponses();

    for (const falseResponse of currentFalseResponses) {
      buttonChoices.push(falseResponse);

    }
    correctButtonPopulated = false;
  }
  if (correctButtonPopulated === null) {
    clientConsole(1, 'No correct button');
    throw new Error('Bad TDF/Stim file - no buttonOptions and no false responses');
  }

  const currentAnswer = Session.get('currentExperimentState').originalAnswer;
  const correctAnswer = Answers.getDisplayAnswerText(currentAnswer);
  const wrongButtonLimit = deliveryParams.falseAnswerLimit;
  if (wrongButtonLimit) {
    let foundIsCurrentAnswer = undefined;
    let correctAnswerIndex = undefined;
    if (correctButtonPopulated) {
      correctAnswerIndex = buttonChoices.findIndex(function(answer) {
        if (answer === currentAnswer) {
          foundIsCurrentAnswer = true;
          return true;
        } else if (answer === correctAnswer) {
          foundIsCurrentAnswer = false;
          return true;
        }
      });
      if (correctAnswerIndex != -1) buttonChoices.splice(correctAnswerIndex, 1);
      else correctAnswerIndex = undefined;
    }

    const numberOfWrongButtonsToPrune = buttonChoices.length-wrongButtonLimit;
    for (let i=0; i<numberOfWrongButtonsToPrune; i++) {
      const randomIndex = Math.floor(Math.random()*buttonChoices.length);
      buttonChoices.splice(randomIndex, 1);
    }

    if (correctAnswerIndex) buttonChoices.unshift(foundIsCurrentAnswer ? currentAnswer : correctAnswer);
  }

  if (!correctButtonPopulated) {
    buttonChoices.unshift(correctAnswer);
  }

  if (buttonOrder === 'random') {
    shuffle(buttonChoices);
  }
  let curChar = 'a';

  const curButtonList = [];
  _.each(buttonChoices, function(val, idx) {
    curButtonList.push({
      verbalChoice: curChar,
      buttonName: val, // Currently, name and value are the same
      // Security: Sanitize HTML to prevent XSS while allowing safe formatting
      buttonValue: sanitizeHTML(val),
    });
    curChar = nextChar(curChar);
  });
  cardState.set('buttonList', curButtonList);
}

// Return the list of false responses corresponding to the current question/answer
function getCurrentFalseResponses() {
  const {curClusterIndex, curStimIndex} = getCurrentClusterAndStimIndices();
  const cluster = getStimCluster(curClusterIndex);
  clientConsole(2, 'getCurrentFalseResponses', curClusterIndex, curStimIndex);

  // Check for missing cluster, stims, or stim index out of bounds
  if (
    !cluster ||
    !Array.isArray(cluster.stims) ||
    typeof curStimIndex !== 'number' ||
    curStimIndex < 0 ||
    curStimIndex >= cluster.stims.length
  ) {
    return [];
  }

  const stim = cluster.stims[curStimIndex];
  // Return empty array if incorrectResponses is missing, null, or empty string
  if (
    !stim.hasOwnProperty('incorrectResponses') ||
    stim.incorrectResponses == null ||
    stim.incorrectResponses === ''
  ) {
    return [];
  }

  if (typeof stim.incorrectResponses === 'string') {
    // Split and filter out empty strings
    return stim.incorrectResponses.split(',').map(s => s.trim()).filter(Boolean);
  }
  if (Array.isArray(stim.incorrectResponses)) {
    return stim.incorrectResponses;
  }
  // Fallback: not a string or array, return empty array
  return [];
}

function getCurrentClusterAndStimIndices() {
  let curClusterIndex = null;
  let curStimIndex = null;

  if (!engine) {
    curClusterIndex = Session.get('clusterIndex');
  } else {
    const currentQuest = engine.findCurrentCardInfo();
    curClusterIndex = currentQuest.clusterIndex;
    curStimIndex = currentQuest.whichStim;
  }

  return {curClusterIndex, curStimIndex};
}

// Stop previous sound
function clearPlayingSound() {
  try {
    currentSound.stop();
  } catch (e) {
    // Do nothing
  }
  currentSound = null;
}

// Play a sound matching the current question
function playCurrentSound(onEndCallback) {
  // We currently only play one sound at a time
  let currentAudioSrc = cardState.get('currentDisplay').audioSrc;
  clientConsole(2, 'currentAudioSrc:', currentAudioSrc);
  if(!currentAudioSrc.includes('http')){
    try {
      currentAudioSrc = DynamicAssets.findOne({name: currentAudioSrc}).link();
    }
    catch (e) {
      console.error('Error getting audio file: ' + e);
      alert('Could not load audio file: ' + currentAudioSrc + '. ')
      Router.go('/home')
    }
  }
  let currentSound = new Audio(currentAudioSrc);
  // Reset sound and play it
  currentSound.play();
  // MO4: Passive listener for better performance
  currentSound.addEventListener('ended', function() {
    if (onEndCallback) {
      onEndCallback();
    }
    clientConsole(2, 'Sound completed');
  }, {passive: true})
}

function handleUserForceCorrectInput(e, source) {
  const key = e.keyCode || e.which;
  if (key == ENTER_KEY || source === 'voice') {
    clientConsole(2, 'handleUserForceCorrectInput');
    $('#userForceCorrect').prop('disabled', true);
    stopRecording();
    // Enter key - see if gave us the correct answer
    const entry = _.trim($('#userForceCorrect').val()).toLowerCase();
    if (getTestType() === 'n') {
      if (entry.length < 4) {
        const oldPrompt = $('#forceCorrectGuidance').text();
        $('#userForceCorrect').prop('disabled', false);
        $('#userForceCorrect').val('');
        $('#forceCorrectGuidance').text(oldPrompt + ' (4 character minimum)');
      } else {
        // Clear simTimeoutName (still in card.js)
        if (simTimeoutName) {
          Meteor.clearTimeout(simTimeoutName);
          simTimeoutName = null;
        }
        // Clear and fire the main timeout immediately
        clearAndFireTimeout(timeoutState, cardState);
      }
    } else {
      const answer = Answers.getDisplayAnswerText(Session.get('currentExperimentState').currentAnswer).toLowerCase();
      const originalAnswer = Answers.getDisplayAnswerText(Session.get('currentExperimentState').originalAnswer).toLowerCase();
      if (entry === answer || entry === originalAnswer) {
        clientConsole(2, 'force correct, correct answer');
        const afterUserFeedbackForceCorrectCbHolder = afterUserFeedbackForceCorrectCb;
        afterUserFeedbackForceCorrectCb = undefined;
        afterUserFeedbackForceCorrectCbHolder();
      } else {
        clientConsole(2, 'force correct, wrong answer');
        $('#userForceCorrect').prop('disabled', false);
        $('#userForceCorrect').val('');
        $('#forceCorrectGuidance').text('Incorrect - please enter \'' + answer + '\'');
        speakMessageIfAudioPromptFeedbackEnabled('Incorrect - please enter \'' + answer + '\'', 'feedback');
        startRecording();
      }
    }
  } else if (getTestType() === 'n') {
    // "Normal" keypress - reset the timeout period
    resetMainCardTimeout(cardState, timeoutState);
  }
}

function handleUserInput(e, source, simAnswerCorrect) {
  clientConsole(2, '[SM] handleUserInput called in state:', trialState.get('current'), 'source:', source);
  let isTimeout = false;
  let isSkip = false;
  let key;
  if (source === 'timeout') {
    key = ENTER_KEY;
    isTimeout = true;
  } else if (source === 'keypress') {
    key = e.keyCode || e.which;
    // Do we need to capture the first keypress timestamp?
    if (!firstKeypressTimestamp) {
      firstKeypressTimestamp = Date.now();
    }
  } else if (source === 'buttonClick' || source === 'simulation' || source === 'voice' || source === 'confirmButton') {
    // to save space we will just go ahead and act like it was a key press.
    key = ENTER_KEY;
    Session.set('userAnswerSubmitTimestamp', Date.now());
  }
  if (e.currentTarget ? e.currentTarget.id === 'continueStudy' : false) {
    key = ENTER_KEY;
    isSkip = true;
    clientConsole(2, 'skipped study');
  }

  // If no correct keypress seen yet, reset timeout and leave
  if (key != ENTER_KEY) {
    resetMainCardTimeout(cardState, timeoutState);
    return;
  }

  const testType = getTestType();
  if(!(testType === 't' || testType === 'i'))
    $('#helpButton').prop("disabled",true);

  
  // Stop current timeout and stop user input
  stopUserInput();
  // Entered input before timeout - decrement pausedLocks to track error report modal state
  if (timeoutState.get('name')) {
    if (cardState.get('pausedLocks')>0) {
      const numRemainingLocks = cardState.get('pausedLocks')-1;
      cardState.set('pausedLocks', numRemainingLocks);
    }
  }
  clearCardTimeoutWrapper();

  if(testType === 's'){
    userAnswer = '' //no response for study trial
  } else if (isTimeout) {
    userAnswer =  _.trim($('#userAnswer').val()).toLowerCase() + ' [timeout]';
  } else if (source === 'keypress') {
    userAnswer = _.trim($('#userAnswer').val()).toLowerCase();
  } else if (source === 'buttonClick') {
    //if the source was the button name continueStudy, get the last answer from the experiment state
    if(e.currentTarget ? e.currentTarget.name === 'continueStudy' : false){
      userAnswer = Session.get('currentExperimentState').currentAnswer;
    } else {
      userAnswer = e.currentTarget.name;
    }
  } else if (source === "confirmButton"){
    userAnswer = $('.btn-secondary')[0].name;
  } else if (source === 'simulation') {
    userAnswer = simAnswerCorrect ? 'SIM: Correct Answer' : 'SIM: Wrong Answer';
  } else if (source === 'voice') {
    const isButtonTrial = getButtonTrial();
    if (isButtonTrial) {
      userAnswer = e.answer.name;
    } else {
      userAnswer = _.trim($('#userAnswer').val()).toLowerCase();
    }
  } 

  const trialEndTimeStamp = Date.now();
  cardState.set('trialEndTimeStamp', trialEndTimeStamp);
  cardState.set('trialStartTimestamp', trialStartTimestamp);
  Session.set('source', source);
  cardState.set('userAnswer', userAnswer);

  // Show user feedback and determine correctness (userAnswerFeedback displays text/media)
  userAnswerFeedback(userAnswer, isSkip , isTimeout, simAnswerCorrect);
}

// Handle user feedback - simCorrect indicates simulation (true/false) vs real answer (undefined/null)
async function userAnswerFeedback(userAnswer, isSkip, isTimeout, simCorrect) {
  const isButtonTrial = getButtonTrial();
  const setspec = !isButtonTrial ? Session.get('currentTdfFile').tdfs.tutor.setspec : undefined;
  let isCorrectAccumulator = null;
  let feedbackForAnswer = null;
  let userAnswerWithTimeout = null;
  // Nothing to evaluate for a study - just pretend they answered correctly
  if (getTestType() === 's' || getTestType() === 'f') {
    isCorrectAccumulator = true;
    isTimeout = false;
    feedbackForAnswer = 'Please study the answer';
  } else if (isTimeout) {
    // Evaluate answer correctness (only update historyUserAnswer if not 'standard')
    isCorrectAccumulator = false;
    userAnswerWithTimeout = '';
  } else if (typeof simCorrect === 'boolean') {
    // Simulation! We know what they did
    isCorrectAccumulator = simCorrect;
    feedbackForAnswer = 'Simulation';
  } else {
    userAnswerWithTimeout = userAnswer;
  }

  // Make sure to record what they just did (and set justAdded)
  await writeCurrentToScrollList(userAnswer, isTimeout, simCorrect, 1);
  cardState.set('isTimeout', isTimeout);
  cardState.set('userAnswer', userAnswer);
  cardState.set('isCorrectAccumulator', isCorrectAccumulator);
  cardState.set('feedbackForAnswer', feedbackForAnswer);

  // Answer assessment ->
  let correctAndText = null;
  if (userAnswerWithTimeout != null) {
    displayAnswer = "";
    if(Session.get('hintLevel') && Session.get('currentExperimentState').currentAnswerSyllables){
      displayedHintLevel = Session.get('hintLevel') || 0;
      answerSyllables = Session.get('currentExperimentState').currentAnswerSyllables.syllableArray || "";
      displayAnswer = answerSyllables.slice(0, displayedHintLevel).join("");
    }
    correctAndText = await Answers.answerIsCorrect(userAnswerWithTimeout, Session.get('currentExperimentState').currentAnswer, Session.get('currentExperimentState').originalAnswer,
    displayAnswer,setspec); 
  }
  determineUserFeedback(userAnswer, isSkip, isCorrectAccumulator, feedbackForAnswer, correctAndText);
}

async function writeCurrentToScrollList(userAnswer, isTimeout, simCorrect, justAdded) {
  // We only store scroll history if it has been turned on in the TDF
  const params = Session.get('currentDeliveryParams');
  if (!params.showhistory) {
    return;
  }

  let isCorrect = null;
  let historyUserAnswer = '';
  let historyCorrectMsg = null;

  let setspec = null;
  if (!getButtonTrial()) {
    setspec = Session.get('currentTdfFile').tdfs.tutor.setspec;
  }

  const trueAnswer = Answers.getDisplayAnswerText(Session.get('currentExperimentState').currentAnswer);

  let userAnswerWithTimeout = null;

  if (getTestType() === 's' || getTestType() === 'f') {
    // Study trial
    isCorrect = true;
    historyUserAnswer = 'You answered ' + _.trim(userAnswer) + '.';
    historyCorrectMsg = trueAnswer;
  } else if (isTimeout) {
    // Timeout
    userAnswerWithTimeout = '';
    isCorrect = false;
    historyUserAnswer = 'You didn\'t answer in time.';
  } else if (typeof simCorrect === 'boolean') {
    // Simulation! We know what they did
    isCorrect = simCorrect;
    historyUserAnswer = 'Simulated answer where correct==' + simCorrect;
    historyCorrectMsg = Answers.getDisplayAnswerText(Session.get('currentExperimentState').currentAnswer);
  } else {
    // "Regular" answers
    userAnswerWithTimeout = userAnswer;
    isCorrect = null;
    historyUserAnswer = 'You answered ' + _.trim(userAnswer) + '.';
  }

  const afterAnswerAssessment = function(correctAndText) {
    if (correctAndText) {
      if (historyCorrectMsg == null) {
        historyCorrectMsg = correctAndText.matchText;
      }
      if (isCorrect == null) {
        isCorrect = correctAndText.isCorrect;
      }
    }

    const currCount = _.intval(cardState.get('scrollListCount'));
    const currentQuestion = cardState.get('currentDisplay').text || cardState.get('currentDisplay').clozeText;

    scrollList.insert({
      'temp': 1, // Deleted when clearing
      'justAdded': justAdded, // All 1's set to 0 on next question
      'idx': currCount, // Our ordering field
      'userAnswer': historyUserAnswer,
      'answer': trueAnswer,
      'shownToUser': historyCorrectMsg,
      'question': currentQuestion,
      'userCorrect': isCorrect,
    }, function(err) {
      if (err) {
        clientConsole(1, 'ERROR inserting scroll list member:', displayify(err));
      }
      cardState.set('scrollListCount', currCount + 1);
    });
  };

  if (userAnswerWithTimeout != null) {
    const correctAndText = await Answers.answerIsCorrect(userAnswerWithTimeout, Session.get('currentExperimentState').currentAnswer, Session.get('currentExperimentState').originalAnswer,
    "",setspec, afterAnswerAssessment);
    afterAnswerAssessment(correctAndText);
  } else {
    afterAnswerAssessment(null);
  }
}

function clearScrollList() {
  scrollList.remove({'temp': 1});
  cardState.set('scrollListCount', 0);
}


function determineUserFeedback(userAnswer, isSkip, isCorrect, feedbackForAnswer, correctAndText) {
  cardState.set('isRefutation', undefined);
  if (isCorrect == null && correctAndText != null) {
    isCorrect = correctAndText.isCorrect;
    if (userAnswer.includes('[timeout]') != '' && !isCorrect && correctAndText.matchText.split(' ')[0] != 'Incorrect.'){
      cardState.set('isRefutation', true);
    }
  }

  // Handle video session checkpoint logic
  if (Session.get('isVideoSession') && playerController) {
    playerController.handleQuestionResponse(isCorrect);
  }

  const currentDeliveryParams = Session.get('currentDeliveryParams')
  if (currentDeliveryParams.scoringEnabled) {
    // Track score in user progress object, copy to Session for template updates
    const {correctscore, incorrectscore} = currentDeliveryParams;

    const oldScore = cardState.get('currentScore');
    const newScore = oldScore + (isCorrect ? correctscore : -incorrectscore);
    cardState.set('currentScore', newScore);
  }
  const testType = getTestType();
  // Drill types all show feedback: 'd' = standard, 'm' = mandatory correction, 'n' = timed prompt
  const isDrill = (testType === 'd' || testType === 'm' || testType === 'n');
  if (isDrill) {
    if (feedbackForAnswer == null && correctAndText != null) {
      feedbackForAnswer = correctAndText.matchText;
    }
    if (currentDeliveryParams.feedbackType == 'dialogue' && !isCorrect) {
      speechTranscriptionTimeoutsSeen = 0;
      initiateDialogue(userAnswer, afterAnswAerFeedbackCbBound, Session.get('currentExperimentState'), showUserFeedback(isCorrect, feedbackForAnswer, userAnswer.includes('[timeout]'), isSkip));
    } else {
      showUserFeedback(isCorrect, feedbackForAnswer, userAnswer.includes('[timeout]'), isSkip);
    }
  } else {
    userFeedbackStart = null;
    let trialEndTimeStamp = cardState.get('trialEndTimeStamp');
    let trialStartTimeStamp = cardState.get('trialStartTimestamp');
    let source = Session.get('source');
    let isTimeout = cardState.get('isTimeout');
    afterAnswerFeedbackCallback(trialEndTimeStamp, trialStartTimeStamp, source, userAnswer, isTimeout, isSkip, isCorrect);
  }
}

async function showUserFeedback(isCorrect, feedbackMessage, isTimeout, isSkip) {
  clientConsole(2, '[SM] showUserFeedback called in state:', trialState.get('current'));

  // NOTE: Don't call stopRecording() here - destroys audio buffer before SR API processes it

  // STATE MACHINE: Transition to FEEDBACK.SHOWING (drill only, test skips feedback)
  if (trialShowsFeedback()) {
    transitionTrialState(TRIAL_STATES.FEEDBACK_SHOWING, `Showing feedback (${isCorrect ? 'correct' : 'incorrect'})`);
  }

  // FIX: Stop recording when entering FEEDBACK phase (Layer 1 of 3-layer defense)
  if (recorder && cardState.get('recording')) {
    clientConsole(2, '[SR] Stopping recording - entered FEEDBACK phase');
    stopRecording();
  }

  // Cache frequently accessed Session variables
  const uiSettings = Session.get('curTdfUISettings');
  const deliveryParams = Session.get('currentDeliveryParams');
  const experimentState = Session.get('currentExperimentState');

  if (uiSettings.suppressFeedbackDisplay) {
    // Do not display any feedback, but still advance the schedule
    let trialEndTimeStamp = cardState.get('trialEndTimeStamp');
    let trialStartTimeStamp = cardState.get('trialStartTimestamp');
    let source = Session.get('source');
    let isCorrectVal = isCorrect;
    let isSkipVal = isSkip;
    let isTimeoutVal = isTimeout;
    afterAnswerFeedbackCallback(trialEndTimeStamp, trialStartTimeStamp, source, cardState.get('userAnswer'), isTimeoutVal, isSkipVal, isCorrectVal);
    return;
  }
  userFeedbackStart = Date.now();
  const isButtonTrial = getButtonTrial();
  feedbackDisplayPosition = uiSettings.feedbackDisplayPosition;
  // For button trials with images where they get the answer wrong, assume incorrect feedback is an image path
  if (!isCorrect && isButtonTrial && getResponseType() == 'image') {
    const buttonImageFeedback = 'Incorrect.  The correct response is displayed below.';
    const correctImageSrc = experimentState.originalAnswer;

    // MO8: SECURITY - Use DOM createElement instead of HTML strings to prevent XSS, proper img with alt
    const userInteractionEl = document.getElementById('UserInteraction');
    userInteractionEl.innerHTML = ''; // Clear existing content

    // Create feedback text
    const feedbackText = document.createElement('p');
    feedbackText.className = 'text-align alert';
    feedbackText.textContent = buttonImageFeedback; // textContent prevents XSS
    userInteractionEl.appendChild(feedbackText);

    // Create image element with proper attributes for mobile excellence
    const feedbackImage = document.createElement('img');
    feedbackImage.src = correctImageSrc; // Proper img element, not CSS background
    feedbackImage.alt = 'Correct answer image'; // Accessibility
    feedbackImage.className = 'btn-alt btn-block btn-image btn-responsive';
    feedbackImage.loading = 'eager'; // Appears immediately after answer, should load fast
    feedbackImage.decoding = 'sync'; // Small feedback image, want immediate display
    feedbackImage.fetchpriority = 'high'; // User just answered, this is critical feedback

    // Get image dimensions from imagesDict if available (prevents CLS)
    if (imagesDict && imagesDict[correctImageSrc]) {
      const imgData = imagesDict[correctImageSrc];
      if (imgData.naturalWidth) feedbackImage.width = imgData.naturalWidth;
      if (imgData.naturalHeight) feedbackImage.height = imgData.naturalHeight;
    }

    userInteractionEl.appendChild(feedbackImage);
    $(userInteractionEl).removeAttr('hidden');
  } else {
    //check if the feedback has the word "incorrect" or "correct" in it, if so, encase it in a bold tag and a new line before it and after it
      singleLineFeedback = uiSettings.singleLineFeedback;
      uiCorrectColor = uiSettings.correctColor;
      uiIncorrectColor = uiSettings.incorrectColor;
      displayCorrectAnswerInCenter = uiSettings.displayCorrectAnswerInCenter;
      if(singleLineFeedback || feedbackDisplayPosition == "middle"){
        feedbackMessage = feedbackMessage.replace("Incorrect.", "<b style='color:" + uiIncorrectColor + ";'>Incorrect.</b>");
        feedbackMessage = feedbackMessage.replace("Correct.", "<b style='color:" + uiCorrectColor + ";'>Correct.</b>");
      } else {
        feedbackMessage = feedbackMessage.replace("Incorrect.", "<br><b style='color:" + uiIncorrectColor + ";'>Incorrect.</b><br>");
        feedbackMessage = feedbackMessage.replace("Correct.", "<br><b style='color:" + uiCorrectColor + ";'>Correct.</b><br>");
      }
      if(uiSettings.simplefeedbackOnCorrect && isCorrect){
        feedbackMessage = "<b style='color:" + uiCorrectColor + ";'>Correct.</b>";
      }
      if(uiSettings.simplefeedbackOnIncorrect && !isCorrect){
        feedbackMessage = "<b style='color:" + uiIncorrectColor + ";'>Incorrect.</b>";
      }
    $('.hints').addClass('hidden');
    const hSize = deliveryParams ? deliveryParams.fontsize.toString() : 2;
    //if userAnswer is [timeout], feedbackMessage should be "<b style='color:" + uiIncorrectColor + ";'>Incorrect.</b> " + feedbackMessage
    if(isTimeout){
      //if displayCorrectAnswerInCenter is true, then we will only display simple feedback
      if(displayCorrectAnswerInCenter){
        feedbackMessage = "<b style='color:" + uiIncorrectColor + ";'>Incorrect.</b> ";
      } else {
        feedbackMessage = "<b style='color:" + uiIncorrectColor + ";'>Incorrect.</b><br>" + feedbackMessage;
      }
    }
    const displayCorrectFeedback = uiSettings.displayUserAnswerInCorrectFeedback && isCorrect;
    const displayIncorrectFeedback = uiSettings.displayUserAnswerInIncorrectFeedback && !isCorrect;
    if(displayCorrectFeedback || displayIncorrectFeedback){
      //prepend the user answer to the feedback message
      feedbackMessage =  "Your answer: " + userAnswer + '. ' + feedbackMessage;
    }
    if(!singleLineFeedback){
      feedbackMessage = "<br>" + feedbackMessage;
    }
    // Feedback display options: top (#userInteraction), bottom (#userLowerInteraction) - set reactive state
    cardState.set('feedbackPosition', feedbackDisplayPosition);
    cardState.set('inFeedback', true);

    switch(feedbackDisplayPosition){
      case "top":
        target = "#UserInteraction";
        // DOM updates handled by autorun in Template.card.onCreated()
        break;
      case "middle":
        target = "#feedbackOverride";
        // DOM updates handled by autorun in Template.card.onCreated()
        break;
      case "bottom":
        target = "#userLowerInteraction";
        // DOM updates handled by autorun, add fontSize class to target
        const hSizeBottom = deliveryParams ? deliveryParams.fontsize.toString() : 2;
        $(target).addClass('h' + hSizeBottom);
        break;
    }
    //remove the first <br> tag from feedback message if it exists
    if(feedbackMessage.startsWith("<br>")){
      feedbackMessage = feedbackMessage.substring(4);
    }
    //encapsulate the message in a span tag
    feedbackMessage = "<span>" + feedbackMessage + "</span>";

    // Batch DOM updates in single animation frame to reduce reflows/repaints
    requestAnimationFrame(() => {
      $('#multipleChoiceContainer').addClass('hidden');
      $('.input-box').addClass('hidden');
      $('#displayContainer').removeClass('col-md-6').addClass('mx-auto');
      $('#displaySubContainer').addClass(uiSettings.textInputDisplay);
    });

    //if the displayOnlyCorrectAnswerAsFeedbackOverride is set to true, then we will display the correct answer in feedbackOverride div
    if (displayCorrectAnswerInCenter) {
      const correctAnswer = Answers.getDisplayAnswerText(experimentState.currentAnswer);
      // Batch: single chain for both operations
      $('#correctAnswerDisplayContainer').html(correctAnswer).removeClass('d-none');
    }
          if(isTimeout && !uiSettings.displayUserAnswerInFeedback){
            feedbackMessage =  ". " + feedbackMessage;
          }
          if(!isSkip){
            if(!isCorrect){
              // inFeedback already set via cardState, batch DOM update with single write
              const existingContent = $(target).html() || '';
              const newContent = existingContent + feedbackMessage;
              $(target)
            .html(newContent)
            .removeAttr('hidden')
            var countDownStart = new Date().getTime();
            let dialogueHistory;
            if (cardState.get('dialogueHistory')) {
              dialogueHistory = JSON.parse(JSON.stringify(cardState.get('dialogueHistory')));
            }
            countDownStart += getReviewTimeout(getTestType(), deliveryParams, isCorrect, dialogueHistory, isTimeout, isSkip, cardState);
            var originalnow = new Date().getTime();
            var originalDist = countDownStart - originalnow;
            var originalSecs = Math.ceil((originalDist % (1000 * 60)) / 1000);

            // Cache for interval closure
            const displayReviewTimeoutMode = uiSettings.displayReviewTimeoutAsBarOrText;
            const displayCardTimeoutMode = uiSettings.displayCardTimeoutAsBarOrText;

            var CountdownTimerInterval = Meteor.setInterval(function() {
              var now = new Date().getTime()
              var distance = countDownStart - now;
              var seconds = Math.ceil((distance % (1000 * 60)) / 1000);
              var percent = 100 - ((seconds / originalSecs) * 100);
              const timerElement = document.getElementById("CountdownTimerText");
              if (!timerElement) {
                // FIX: Element doesn't exist - clear interval and set CurIntervalId to undefined (prevents infinite wait)
                Meteor.clearInterval(CountdownTimerInterval);
                cardState.set('CurIntervalId', undefined);
                return;
              }
              if(displayReviewTimeoutMode == "text" || displayReviewTimeoutMode == "both"){

                timerElement.innerHTML = 'Continuing in: ' + seconds + "s";
              } else {
                timerElement.innerHTML = '';
              }
              if(displayReviewTimeoutMode == "bar" || displayCardTimeoutMode == "both"){
                //add the progress bar class
                $('#progressbar').addClass('progress-bar');
                document.getElementById("progressbar").style.width = percent + "%";
              } else {
                //set width to 0% 
                document.getElementById("progressbar").style.width = 0 + "%";
                //remove progress bar class
                $('#progressbar').removeClass('progress-bar');
              }
              


              // If the count down is finished, end interval - DON'T clear visible elements (let fade-out handle)
              if (distance < 0) {
                // FIX: Don't clear feedback elements here - they should remain visible during fade-out transition
                // All cleanup now happens in cleanupTrialContent() AFTER fade-out completes
                Meteor.clearInterval(CountdownTimerInterval);
                cardState.set('CurIntervalId', undefined);
                // FIX: Don't set inFeedback=false here - let afterAnswerFeedbackCallback() handle after both countdown AND TTS
              }
            }, 250); // Reduced from 100ms - 4fps is smooth enough, saves CPU
            cardState.set('CurIntervalId', CountdownTimerInterval);
          } else {
            //remove progress bar class
            $('#progressbar').removeClass('progress-bar');
            //set width to 0%
            document.getElementById("progressbar").style.width = 0 + "%";
            uiCorrectColor = uiSettings.correctColor;
            $(target)
            .html(feedbackMessage)
            .removeAttr('hidden')
          }
        }
  }

  speakMessageIfAudioPromptFeedbackEnabled(feedbackMessage, 'feedback');

  // Replay sound after optional audio feedback delay if incorrect drill answer (not after dialogue loop)
  if (!!(cardState.get('currentDisplay').audioSrc) && !isCorrect) {
    const delay = Session.get('currentDeliveryParams').timeuntilaudiofeedback;
    registerTimeout('audioFeedbackReplay', function() {
      clientConsole(2, 'playing sound after timeuntilaudiofeedback', new Date());
      playCurrentSound();
    }, delay, 'Replay audio after incorrect answer');
  }

  // forceCorrection: clear textbox always, show only if wrong answer + forceCorrection enabled + not sim

  // Call doClearForceCorrect non-reactively to prevent infinite loop (was Tracker.afterFlush causing loop)
  Tracker.nonreactive(() => {
    // Trial type 'm' = mandatory correction (must re-type), 'n' = timed prompt/hint (auto-continues)
    const isForceCorrectTrial = getTestType() === 'm' || getTestType() === 'n';
    const doForceCorrect = (!isCorrect && !Session.get('runSimulation') &&
      (Session.get('currentDeliveryParams').forceCorrection || isForceCorrectTrial));
    const trialEndTimeStamp = cardState.get('trialEndTimeStamp');
    const trialStartTimeStamp = cardState.get('trialStartTimestamp');
    const source = Session.get('source');

    doClearForceCorrect(doForceCorrect, trialEndTimeStamp, trialStartTimeStamp, source, userAnswer, isTimeout, isCorrect, isSkip);
  });
}

// Note the execution thread will finish in the keypress event above for userForceCorrect
let afterUserFeedbackForceCorrectCb = undefined;
function doClearForceCorrect(doForceCorrect, trialEndTimeStamp, trialStartTimeStamp, source, userAnswer, isTimeout, isCorrect, isSkip) {
  if (doForceCorrect) {
    $('#forceCorrectionEntry').removeAttr('hidden');

    // Type 'n': Show timed prompt/hint, then auto-continue (no re-entry required)
    if (getTestType() === 'n') {
      const prompt = Session.get('currentDeliveryParams').forcecorrectprompt;
      $('#forceCorrectGuidance').text(prompt);
      speakMessageIfAudioPromptFeedbackEnabled(prompt, 'feedback');

      const forcecorrecttimeout = Session.get('currentDeliveryParams').forcecorrecttimeout;
      beginMainCardTimeout(forcecorrecttimeout, afterAnswerFeedbackCallback(trialEndTimeStamp, trialStartTimeStamp, source, userAnswer, isTimeout, false, isCorrect), cardState, timeoutState, srState, leavePage);
    } else {
      // Type 'm' (or forceCorrection=true): Require re-entry of correct answer
      const prompt = 'Please enter the correct answer to continue';
      $('#forceCorrectGuidance').text(prompt);
      speakMessageIfAudioPromptFeedbackEnabled(prompt, 'feedback');

      afterUserFeedbackForceCorrectCb = afterAnswerFeedbackCallback(trialEndTimeStamp, trialStartTimeStamp, source, userAnswer, isTimeout, false, isCorrect);
    }

    $('#userForceCorrect').prop('disabled', false);
    $('#userForceCorrect').val('').focus();
    startRecording();
  } else {
    $('#forceCorrectGuidance').text('');
    $('#userForceCorrect').prop('disabled', true);
    $('#userForceCorrect').val('');
    afterAnswerFeedbackCallback(trialEndTimeStamp, trialStartTimeStamp, source, userAnswer, isTimeout, isSkip, isCorrect);
  }
}

async function giveAnswer(){
  if(Meteor.isDevelopment){
    curAnswer = Session.get('currentExperimentState').currentAnswer.split('~')[0];
    handleUserInput({keyCode: ENTER_KEY, currentTarget: { name: curAnswer } }, 'buttonClick');
  }
}

async function giveWrongAnswer(){
  if(Meteor.isDevelopment){
    curAnswer = Session.get('currentExperimentState').currentAnswer + '123456789321654986321';
    $('#userAnswer').val(curAnswer);
    cardState.set('skipTimeout', true)
    handleUserInput({keyCode: ENTER_KEY}, 'keypress');
  }
}

async function afterAnswerFeedbackCallback(trialEndTimeStamp, trialStartTimeStamp, source, userAnswer, isTimeout, isSkip, isCorrect) {
  cardState.set('showDialogueText', false);
  //if the user presses the removal button after answering we need to shortcut the timeout
  const wasReportedForRemoval = source == 'removal'

  const testType = getTestType();
  const deliveryParams = Session.get('currentDeliveryParams')

  if (testType !== 'i' && testType !== 's') {
    const overallOutcomeHistory = Session.get('overallOutcomeHistory') || [];
    overallOutcomeHistory.push(isCorrect ? 1 : 0);
    Session.set('overallOutcomeHistory', overallOutcomeHistory);
  }

  const overallStudyHistory = Session.get('overallStudyHistory') || [];
  if (testType === 's') {
    overallStudyHistory.push(1);
  }
  if (testType === 'd') {
    overallStudyHistory.push(0);
  }
  Session.set('overallStudyHistory', overallStudyHistory);
  
  let dialogueHistory;
  if (cardState.get('dialogueHistory')) {
    dialogueHistory = JSON.parse(JSON.stringify(cardState.get('dialogueHistory')));
  }
  const reviewTimeout = wasReportedForRemoval ? 2000 : getReviewTimeout(testType, deliveryParams, isCorrect, dialogueHistory, isTimeout, isSkip, cardState);

  // Stop previous timeout, log response data, and clear up any other vars for next question
  clearCardTimeoutWrapper();

  // FIX: Clear stale countdown interval from previous trial (correct answers don't create one, prevents infinite wait)
  cardState.set('CurIntervalId', undefined);

  cardState.set('feedbackTimeoutBegins', Date.now())
  const answerLogRecord = gatherAnswerLogRecord(trialEndTimeStamp, trialStartTimeStamp, source, userAnswer, isCorrect,
      testType, deliveryParams, dialogueHistory, wasReportedForRemoval);
  afterFeedbackCallbackBind = afterFeedbackCallback.bind(null, trialEndTimeStamp, trialStartTimeStamp, isTimeout, isSkip, isCorrect, testType, deliveryParams, answerLogRecord, 'card')
  const timeout = Meteor.setTimeout(async function() {
    await afterFeedbackCallbackBind()
    engine.updatePracticeTime(Date.now() - trialEndTimeStamp)
  }, reviewTimeout)
  cardState.set('CurTimeoutId', timeout)
  let {responseDuration, startLatency, endLatency, feedbackLatency} = getTrialTime(trialEndTimeStamp, trialStartTimeStamp, trialEndTimeStamp + reviewTimeout, testType)
  let practiceTime = endLatency;
  if (testType === 's') {
    practiceTime = feedbackLatency;
  }
  engine.cardAnswered(isCorrect, practiceTime);

  if(!Session.get('isVideoSession')){
    if(Session.get('unitType') == "model")
    engine.calculateIndices().then(function(res, err) {
      Session.set('engineIndices', res );
    })
    else
      Session.set('engineIndices', undefined);
  }
}

async function afterFeedbackCallback(trialEndTimeStamp, trialStartTimeStamp, isTimeout, isSkip, isCorrect, testType, deliveryParams, answerLogRecord, callLocation) {
  afterFeedbackCallbackBind = undefined;
  clientConsole(2, '[SM] afterFeedbackCallback called in state:', trialState.get('current'));
  cardState.set('CurTimeoutId', null)
  const userLeavingTrial = callLocation != 'card';
  let reviewEnd = Date.now();
      
  let {responseDuration, startLatency, endLatency, feedbackLatency} = getTrialTime(trialEndTimeStamp, trialStartTimeStamp, reviewEnd, testType);

  //answerLogAction can be 'answer', 'timeout', or 'skip' depending on userAnswer, isTimeout, and isSkip
  if(isTimeout){
    answerLogAction = '[timeout]';
  } else if (isSkip) {
    answerLogAction = '[skip]';
  } else {
    answerLogAction = '[answer]';
  }
  //if dialogueStart is set that means the user went through interactive dialogue
  cardState.set('dialogueTotalTime', undefined);
  cardState.set('dialogueHistory', undefined);
  const newExperimentState = {
    lastAction: answerLogAction,
  };

  newExperimentState.overallOutcomeHistory = Session.get('overallOutcomeHistory');
  clientConsole(2, 'writing answerLogRecord to history - stimIndex:', answerLogRecord.stimIndex);
  if(Meteor.user() === undefined || !Meteor.user().impersonating){
    try {
      answerLogRecord.responseDuration = responseDuration;
      answerLogRecord.CFStartLatency = startLatency;
      answerLogRecord.CFEndLatency = endLatency;
      answerLogRecord.CFFeedbackLatency = feedbackLatency;
      await Meteor.callAsync('insertHistory', answerLogRecord);
      await updateExperimentState(newExperimentState, 'card.afterAnswerFeedbackCallback');
    } catch (e) {
      clientConsole(1, 'error writing history record:', e);
      throw new Error('error inserting history/updating state:', e);
    }
  } else {
    clientConsole(2, 'no history saved. impersonation mode.');
  }

  if(!userLeavingTrial){
    // Auto-stop: Count consecutive timeouts, leave page if autostopTimeoutThreshold reached
    if (!isTimeout) {
      timeoutsSeen = 0; // Reset count
    } else {
      timeoutsSeen++;

      // autostopTimeoutThreshold defaults to 0, must be >= 1 to enable feature
      const threshold = deliveryParams.autostopTimeoutThreshold;

      if (threshold > 0 && timeoutsSeen >= threshold) {
        clientConsole(2, 'Hit timeout threshold', threshold, 'Quitting');
        leavePage('/home');
        return; // We are totally done
      }
    }

    // FIX: Wait for BOTH countdown AND TTS to complete before transitioning (prevents TTS bleeding into next trial)
    clientConsole(2, '[SM] afterAnswerFeedbackCallback: Waiting for countdown and TTS to complete');

    // Wait for countdown to finish (if not already finished)
    const waitForCountdown = new Promise(resolve => {
      const countdownId = cardState.get('CurIntervalId');
      if (!countdownId) {
        clientConsole(2, '[SM] Countdown already finished');
        resolve(); // Already finished
      } else {
        clientConsole(2, '[SM] Waiting for countdown to finish...');
        const countdownStartTime = Date.now();
        const checkInterval = Meteor.setInterval(() => {
          if (!cardState.get('CurIntervalId')) {
            const countdownDuration = Date.now() - countdownStartTime;
            clientConsole(2, `[SM] ⏱️ Countdown finished after ${countdownDuration}ms`);
            Meteor.clearInterval(checkInterval);
            resolve();
          }
        }, 100);
      }
    });

    // FIX: Wait for TTS request completion via cardState.get('ttsRequested') for async Google TTS API
    const waitForTTS = new Promise(resolve => {
      if (cardState.get('ttsRequested')) {
        clientConsole(2, '[SM] 🎤 TTS was requested, waiting for it to complete...');
        const ttsStartTime = Date.now();

        // Poll every 50ms until TTS request completes (ttsRequested becomes false)
        const checkTTS = Meteor.setInterval(() => {
          if (!cardState.get('ttsRequested')) {
            Meteor.clearInterval(checkTTS);
            Meteor.clearTimeout(timeoutId); // FIX: Clear timeout when TTS completes normally
            const ttsDuration = Date.now() - ttsStartTime;
            clientConsole(2, `[SM] 🎤 TTS request complete after ${ttsDuration}ms`);
            resolve();
          }
        }, 50);

        // Failsafe: timeout after 30 seconds (network issues, API errors)
        const timeoutId = Meteor.setTimeout(() => {
          if (cardState.get('ttsRequested')) {
            Meteor.clearInterval(checkTTS);
            clientConsole(1, '[SM] ⚠️ TTS timeout (30s), forcing continue');

            // FIX: Stop any playing/pending audio to prevent bleed into next trial
            if (window.currentAudioObj) {
              clientConsole(1, '[SM]   Stopping orphaned TTS audio from timeout');
              window.currentAudioObj.pause();
              window.currentAudioObj.onended = null; // Remove event listener
              window.currentAudioObj = undefined;
            }

            cardState.set('ttsRequested', false);
            cardState.set('recordingLocked', false); // Unlock recording in case TTS had locked it
            resolve();
          }
        }, 30000);
      } else {
        clientConsole(2, '[SM] No TTS requested');
        resolve(); // No TTS
      }
    });

    // Wait for whichever completes LAST (countdown or TTS) to extend reviewstudy timeout if needed
    const startWait = Date.now();
    await Promise.all([waitForCountdown, waitForTTS]);
    const waitDuration = Date.now() - startWait;
    clientConsole(2, `[SM] ✅ Both countdown and TTS complete (waited ${waitDuration}ms), transitioning to next trial`);

    // NOW safe to transition to next trial
    cardState.set('inFeedback', false);
    await cardEnd();
  }
}

async function cardEnd() {
  clientConsole(2, '[SM] cardEnd called in state:', trialState.get('current'));
  // STATE MACHINE: Begin TRANSITION phase
  transitionTrialState(TRIAL_STATES.TRANSITION_START, 'Trial complete, beginning transition');

  // FIX: Don't clear feedback elements before fade-out - they should remain visible during transition
  // hideUserFeedback() now called in cleanupTrialContent() AFTER fade-out completes
  cardState.set('inFeedback', false);
  // Don't update #CountdownTimerText or clear feedback - let them fade out with current content
  $('#userAnswer').val('');
  cardState.set('feedbackTimeoutEnds', Date.now())

  // STATE MACHINE: Transition happens in prepareCard via FADING_OUT → CLEARING → LOADING
  await prepareCard();
}

function getTrialTime(trialEndTimeStamp, trialStartTimeStamp, reviewEnd, testType) {
  let feedbackLatency;
  if(cardState.get('dialogueTotalTime')){
    feedbackLatency = cardState.get('dialogueTotalTime');
  }
  else if(userFeedbackStart){
    feedbackLatency = reviewEnd - userFeedbackStart;
  }
  else{
    feedbackLatency = 0;
  }

  const firstActionTimestamp = firstKeypressTimestamp || trialEndTimeStamp;
  let responseDuration = trialEndTimeStamp - firstActionTimestamp;
  let startLatency = firstActionTimestamp - trialStartTimeStamp;
  let endLatency = trialEndTimeStamp - trialStartTimeStamp;
  if( !firstActionTimestamp || !trialEndTimeStamp || !trialStartTimeStamp || 
    firstActionTimestamp < 0 || trialEndTimeStamp < 0 || trialStartTimeStamp < 0 || endLatency < 0){
    //something broke. The user probably didnt start answering the questing in 1970.
    alert('Something went wrong with your trial. Please restart the chapter.');
    const errorDescription = `One or more timestamps were set to 0 or null. 
    firstActionTimestamp: ${firstActionTimestamp}
    trialEndTimeStamp: ${trialEndTimeStamp}
    trialStartTimeStamp: ${trialStartTimeStamp}`
    clientConsole(1, `responseDuration: ${responseDuration}
    startLatency: ${startLatency}
    endLatency: ${endLatency}
    firstKeypressTimestamp: ${firstKeypressTimestamp}
    trialEndTimeStamp: ${trialEndTimeStamp}
    trialStartTimeStamp: ${trialStartTimeStamp}`)
    const curUser = Meteor.userId();
    const curPage = document.location.pathname;
    const sessionVars = Session.all();
    const userAgent = navigator.userAgent;
    const logs = console.logs;
    const currentExperimentState = Session.get('currentExperimentState');
    Meteor.callAsync('sendUserErrorReport', curUser, errorDescription, curPage, sessionVars,
        userAgent, logs, currentExperimentState);
    leavePage('/home');
    return;
  }
  // Don't count test type trials in progress reporting
  if (testType === 't') {
    endLatency = 0;
    feedbackLatency = -1;
  } else if (testType === 's') {
    // Study - we ONLY have review latency, but it is in endLatency
    feedbackLatency = endLatency;
    endLatency = -1;
    startLatency = -1;
  }
  return {responseDuration, startLatency, endLatency, feedbackLatency};
}

function ensureClusterStateForLogging() {
  const experimentState = Session.get('currentExperimentState') || {};
  let clusterMapping = Session.get('clusterMapping');
  if (!Array.isArray(clusterMapping) || clusterMapping.length === 0) {
    if (Array.isArray(experimentState.clusterMapping) && experimentState.clusterMapping.length) {
      clusterMapping = experimentState.clusterMapping;
      Session.set('clusterMapping', clusterMapping);
    } else {
      clientConsole(1, 'Cluster mapping missing when attempting to log answer - aborting log until restored');
      throw new Error('Cluster mapping not initialized');
    }
  }

  let clusterIndex = Session.get('clusterIndex');
  const expShufIndex = (typeof experimentState.shufIndex === 'number')
    ? experimentState.shufIndex
    : experimentState.clusterIndex;
  if (typeof clusterIndex === 'undefined' && typeof expShufIndex === 'number') {
    Session.set('clusterIndex', expShufIndex);
    clusterIndex = expShufIndex;
  }

  if (typeof clusterIndex !== 'number') {
    clientConsole(1, 'Cluster index missing when attempting to log answer - aborting log until restored');
    throw new Error('Cluster index not initialized');
  }

  if (typeof clusterMapping[clusterIndex] === 'undefined') {
    clientConsole(1, 'Cluster mapping out of range for current index - aborting log until mapping restored',
        clusterIndex, clusterMapping);
    throw new Error('Cluster mapping mismatch');
  }
}

// eslint-disable-next-line max-len
function gatherAnswerLogRecord(trialEndTimeStamp, trialStartTimeStamp, source, userAnswer, isCorrect, 
  testType, deliveryParams, dialogueHistory, wasReportedForRemoval) {
  ensureClusterStateForLogging();

  // Figure out button trial entries
  let buttonEntries = '';
  const wasButtonTrial = !!cardState.get('buttonTrial');
  if (wasButtonTrial) {
    const wasDrill = (testType === 'd' || testType === 'm' || testType === 'n');
    // If we had a dialogue interaction restore this from the session variable as the screen was wiped
    if (deliveryParams.feedbackType == 'dialogue' && !isCorrect && wasDrill) {
      buttonEntries = JSON.parse(JSON.stringify(cardState.get('buttonEntriesTemp')));
    } else {
      buttonEntries = _.map(cardState.get('buttonList'), (val) => val.buttonValue).join(',');
    }
    cardState.set('buttonEntriesTemp', undefined);
  }

  let currentAnswerSyllables = {
    syllableArray: [],
    count: 0,
    displaySyllableIndices: [],
  };
  const sessCurrentAnswerSyllables = Session.get('currentExperimentState').currentAnswerSyllables;
  if (typeof(sessCurrentAnswerSyllables) != 'undefined') {
    currentAnswerSyllables = {
      syllableArray: sessCurrentAnswerSyllables.syllableArray,
      count: sessCurrentAnswerSyllables.syllableArray.length,
      displaySyllableIndices: sessCurrentAnswerSyllables.displaySyllableIndices,
    };
  }

  let clusterIndex = Session.get('clusterIndex');
  let {whichStim, probabilityEstimate} = engine.findCurrentCardInfo();
  const cluster = getStimCluster(clusterIndex);
  const {_id, clusterKC, stimulusKC} = cluster.stims[whichStim];
  const responseType = ('' + cluster.stims[0].itemResponseType || 'text').toLowerCase()
  // Commented out: let curKCBase = getStimKCBaseForCurrentStimuliSet(); let stimulusKC = whichStim + curKCBase;

  const curTdf = Session.get('currentTdfFile');
  const unitName = _.trim(curTdf.tdfs.tutor.unit[Session.get('currentUnitNumber')].unitname);

  const problemName = Session.get('currentExperimentState').originalDisplay;
  const stepName = problemName;
  // Commented out: let stepCount = (state.stepNameSeen[stepName] || 0) + 1; state.stepNameSeen[stepName] = stepCount; stepName = stepCount + ' ' + stepName;
  const isStudy = testType === 's';
  let shufIndex = clusterIndex;
  const rawClusterIndex = typeof cluster.clusterIndex === 'number' ? cluster.clusterIndex : clusterIndex;
  let stimFileIndex = rawClusterIndex;
  let schedCondition = 'N/A';
  if (engine.unitType == SCHEDULE_UNIT) {
    const sched = Session.get('schedule');
    if (sched && sched.q && sched.q.length) {
      const schedItemIndex = Session.get('questionIndex') - 1;
      shufIndex = schedItemIndex;
      if (schedItemIndex >= 0 && schedItemIndex < sched.q.length) {
        schedCondition = parseSchedItemCondition(sched.q[schedItemIndex].condition);
        stimFileIndex = sched.q[schedItemIndex].clusterIndex;
      }
    }
  } else {
    shufIndex = cluster.shufIndex;
    stimFileIndex = rawClusterIndex;
  }
  const originalAnswer = Session.get('currentExperimentState').originalAnswer;
  const currentAnswer = Session.get('currentExperimentState').currentAnswer;
  const fullAnswer = (typeof(originalAnswer) == 'undefined' || originalAnswer == '') ? currentAnswer : originalAnswer;
  const temp = _.trim((fullAnswer || '')).split('~');
  const correctAnswer = temp[0];
  const whichHintLevel = parseInt(Session.get('hintLevel')) || 0;

  const currentDisplayRaw = cardState.get('currentDisplay');
  if (!currentDisplayRaw) {
    clientConsole(1, 'ERROR: currentDisplay is undefined in gatherAnswerLogRecord');
    return {};
  }
  const filledInDisplay = JSON.parse(JSON.stringify(currentDisplayRaw));
  let hintsDisplayed = "";
  let hintIndeces = null;
   
  if(whichHintLevel != 0){
    hintIndeces = currentAnswerSyllables.syllableArray.slice(0,whichHintLevel);
    hintsDisplayed = hintIndeces;
  }

  if (filledInDisplay.clozeText) {
    filledInDisplay.clozeText = filledInDisplay.clozeText.replace(/___+/g, correctAnswer);
  }

  if (!probabilityEstimate) {
    probabilityEstimate = null;
  }

  // hack
  const sessionID = (new Date(trialStartTimeStamp)).toUTCString().substr(0, 16) + ' ' + Session.get('currentTdfName');
  let outcome = '';
  if (isStudy)
    outcome = 'study';
  else if (isCorrect) 
    outcome = 'correct';
  else
    outcome = 'incorrect';
  const answerLogRecord = {
    'itemId': _id,
    'KCId': stimulusKC,
    'hintLevel': parseInt(Session.get('hintLevel')) || 0,
    'userId': Meteor.userId(),
    'TDFId': Session.get('currentTdfId'),
    'outcome': outcome,
    'probabilityEstimate': probabilityEstimate,
    'typeOfResponse': responseType,
    'responseValue': _.trim(userAnswer),
    'displayedStimulus': filledInDisplay,
    'sectionId': Session.get('curSectionId'),
    'teacherId': Session.get('curTeacher')?._id,
    'anonStudentId': Meteor.user().username,
    'sessionID': sessionID,

    'conditionNameA': 'tdf file',
    // Note: we use this to enrich the history record server side, change both places if at all
    'conditionTypeA': Session.get('currentTdfName'),
    'conditionNameB': 'xcondition',
    'conditionTypeB': Session.get('experimentXCond') || null,
    'conditionNameC': 'schedule condition',
    'conditionTypeC': schedCondition,
    'conditionNameD': 'how answered',
    'conditionTypeD': _.trim(source),
    'conditionNameE': 'section',
    'conditionTypeE': Meteor.user().loginParams.entryPoint && 
        Meteor.user().loginParams.entryPoint !== 'direct' ? Meteor.user().loginParams.entryPoint : null,

    'responseDuration': null,

    'levelUnit': Session.get('currentUnitNumber'),
    'levelUnitName': unitName,
    'levelUnitType': Session.get('unitType'),
    'problemName': problemName,
    'stepName': stepName, // this is no longer a valid field as we don't restore state one step at a time
    'time': trialStartTimeStamp,
    'selection': '',
    'action': '',
    'input': _.trim(userAnswer),
    'studentResponseType': isStudy ? 'HINT_REQUEST' : 'ATTEMPT',
    'studentResponseSubtype': _.trim(findQTypeSimpified()),
    'tutorResponseType': isStudy ? 'HINT_MSG' : 'RESULT',
    'KCDefault': stimulusKC,
    'KCCategoryDefault': '',
    'KCCluster': clusterKC,
    'KCCategoryCluster': '',
    'CFAudioInputEnabled': checkAudioInputMode(), // Use shared check that verifies both user pref AND TDF support
    'CFAudioOutputEnabled': Session.get('enableAudioPromptAndFeedback'),
    'CFDisplayOrder': Session.get('questionIndex'),
    'CFStimFileIndex': stimFileIndex,
    'CFSetShuffledIndex': shufIndex,
    'CFAlternateDisplayIndex': cardState.get('alternateDisplayIndex') || null,
    'CFStimulusVersion': whichStim,
    'CFCorrectAnswer': correctAnswer,
    'CFCorrectAnswerSyllables': currentAnswerSyllables.syllableArray,
    'CFCorrectAnswerSyllablesCount': currentAnswerSyllables.count,
    'CFDisplaySyllableIndices': hintIndeces,
    'CFDisplayedHintSyllables': hintsDisplayed,
    'CFOverlearning': false,
    'CFResponseTime': trialEndTimeStamp,
    'CFStartLatency': null,
    'CFEndLatency': null,
    'CFFeedbackLatency': null,
    'CFReviewEntry': _.trim($('#userForceCorrect').val()),
    'CFButtonOrder': buttonEntries,
    'CFItemRemoved': wasReportedForRemoval,
    'CFNote': '',
    'feedbackText': $('#UserInteraction').text() || '',
    'feedbackType': deliveryParams.feedbackType,
    'dialogueHistory': dialogueHistory || null,
    'instructionQuestionResult': Session.get('instructionQuestionResult') || false,
    'hintLevel': whichHintLevel,
    'entryPoint': Meteor.user().loginParams.entryPoint
  };
  return answerLogRecord;
}

function findQTypeSimpified() {
  const currentDisplay = cardState.get('currentDisplay');
  let QTypes = '';

  if (currentDisplay.text) QTypes = QTypes + 'T'; // T for Text
  if (currentDisplay.imgSrc) QTypes = QTypes + 'I'; // I for Image
  if (currentDisplay.audioSrc) QTypes = QTypes + 'A'; // A for Audio
  if (currentDisplay.clozeText) QTypes = QTypes + 'C'; // C for Cloze
  if (currentDisplay.videoSrc) QTypes = QTypes + 'V'; // V for video

  if (QTypes == '') QTypes = 'NA'; // NA for Not Applicable

  return QTypes;
}


function hideUserFeedback() {
  clientConsole(2, '[SM] hideUserFeedback called in state:', trialState.get('current'));
  // Don't use .hide() - let displayReady fade-out handle visibility (prevents instant flash)
  $('#UserInteraction').removeClass('text-align alert').html('');
  $('#feedbackOverride').html('');
  $('#userLowerInteraction').html('');
  $('#userForceCorrect').val(''); // text box - see inputF.html
  // Don't hide forceCorrectionEntry or removeQuestion - let fade-out handle them
}

// Comprehensive cleanup mimicking {{#if displayReady}} teardown - only clear VALUES/non-reactive HTML, not Blaze-managed content
function cleanupTrialContent() {
  clientConsole(2, '[SM] cleanupTrialContent called in state:', trialState.get('current'));

  // FIX: Clear all feedback elements AFTER fade-out (moved from cardEnd for synchronized cleanup)
  hideUserFeedback();

  // FIX: Stop orphaned TTS audio as safety measure (normally Promise.all waits, this catches edge cases)
  if (window.currentAudioObj) {
    clientConsole(2, '[SM]   Stopping orphaned TTS audio during cleanup');
    window.currentAudioObj.pause();
    // Remove event listeners to prevent them from firing after cleanup
    window.currentAudioObj.onended = null;
    window.currentAudioObj = undefined;
  }

  // Clear input VALUES only (not HTML, Blaze handles that) - #userAnswer already cleared in cardEnd()
  $('#userAnswer').val('');
  $('#userForceCorrect').val('');

  // Reset input styling to prevent border color flash (black→red) during fade-in
  $('#userAnswer').removeClass('is-invalid is-valid'); // Bootstrap validation classes
  $('#userAnswer').css('border-color', ''); // Reset any inline border styles
  $('#userAnswer').css('border', ''); // Reset full border property

  // Clear non-reactive HTML (countdown timer, progress bar, correct answer display)
  $('#correctAnswerDisplayContainer').html('');
  $('#CountdownTimerText').text('');
  $('#userLowerInteraction').html(''); // Clear bottom feedback area

  // Reset CSS classes (NOT feedback classes - already done)
  $('#displayContainer').removeClass('mx-auto');
  $('#correctAnswerDisplayContainer').addClass('d-none');

  // Reset inline styles and classes for progress bar
  $('#progressbar').css('width', '0%').removeClass('progress-bar');

  // Hide elements that need to be hidden (using attr not .hide() to work with Blaze)
  $('#userInteractionContainer').attr('hidden', '');
  $('#feedbackOverrideContainer').attr('hidden', '');
  $('#forceCorrectionEntry').attr('hidden', '');
  $('#confirmButton').prop('disabled', true).attr('aria-disabled', 'true');

  // CRITICAL: Re-show .input-box (was hidden during feedback, nothing shows it again otherwise)
  $('.input-box').removeClass('hidden');
  $('#multipleChoiceContainer').removeClass('hidden');

  cardState.set('inputReady', false);

  // NOTE: Don't clear Session vars here (done in prepareCard/newQuestionHandler), don't clear Blaze-managed HTML
}


//Called to revisit a previous unit in the current session.
async function revisitUnit(unitNumber) {
  clientConsole(2, 'REVIST UNIT:', unitNumber);
  clearCardTimeoutWrapper();
  destroyPlyr();

  const curTdf = Session.get('currentTdfFile');
  const curUnitNum = Session.get('currentUnitNumber');
  //check if the curUnitNum is the furthest unit the student has reached
  let furthestUnit = Session.get('furthestUnit') || 0;
  if(curUnitNum > furthestUnit){
    furthestUnit = curUnitNum;
  } 
  Session.set('furthestUnit', furthestUnit);
  const newUnitNum = parseInt(unitNumber)
  const curTdfUnit = curTdf.tdfs.tutor.unit[newUnitNum];

  //if the current page is not instructions, then we need to log the revisitUnit action
  if(document.location.pathname != '/instructions'){
      logRecord = gatherAnswerLogRecord(Date.now(), Session.get('currentUnitStartTime'), 'revisitUnit', '', true, 'r', Session.get('currentDeliveryParams'), undefined, false);
      Meteor.callAsync('insertHistory', logRecord);
  }
  Session.set('questionIndex', 0);
  Session.set('clusterIndex', undefined);
  Session.set('currentUnitNumber', newUnitNum);
  Session.set('currentTdfUnit', curTdfUnit);
  Session.set('resetSchedule', true);
  Session.set('currentDeliveryParams', getCurrentDeliveryParams());
  Session.set('currentUnitStartTime', Date.now());
  cardState.set('feedbackUnset', true);
  cardState.set('feedbackTypeFromHistory', undefined);
  Session.set('curUnitInstructionsSeen', false);

  //get the old experiment state
  const oldExperimentState = Session.get('currentExperimentState');

  //update the experiment state
  const newExperimentState = {
    questionIndex: 0,
    clusterIndex: 0,
    shufIndex: 0,
    whichHintLevel: 0,
    whichStim: 0,
    lastUnitCompleted: oldExperimentState.lastUnitCompleted,
    lastUnitStarted: oldExperimentState.lastUnitStarted,
    currentUnitNumber: newUnitNum,
    currentTdfUnit: curTdfUnit,
    lastAction: 'unit-revisit',
  };

  //update the experiment state
  await updateExperimentState(newExperimentState, 'revisitUnit');


  let leaveTarget;
  if (newUnitNum < curTdf.tdfs.tutor.unit.length || curTdf.tdfs.tutor.unit[newUnitNum] > 0) {
    // Revisiting unit requires restart with instructions - check for learning session assessment
    clientConsole(2, 'REVISIT UNIT: show instructions for unit', newUnitNum);
      const rootTDFBoxed = Tdfs.findOne({_id: Session.get('currentRootTdfId')});
      const rootTDF = rootTDFBoxed.content;
      const setspec = rootTDF.tdfs.tutor.setspec;
    leaveTarget = '/instructions';
    Router.go(leaveTarget);
  }

}

// Called when current unit is done (either unit-defined via prepareCard or user-initiated via continue button)
async function unitIsFinished(reason) {
  clearCardTimeoutWrapper();

  const curTdf = Session.get('currentTdfFile');
  if (!curTdf) {
    clientConsole(1, 'ERROR: currentTdfFile not found in session');
    return;
  }
  const adaptive = curTdf.tdfs.tutor.unit[Session.get('currentUnitNumber')].adaptive
  const adaptiveLogic = curTdf.tdfs.tutor.unit[Session.get('currentUnitNumber')].adaptiveLogic
  let curUnitNum = Session.get('currentUnitNumber');
  const prevUnit = curTdf.tdfs.tutor.unit[curUnitNum];
  let newUnitNum = curUnitNum + 1;
  let countCompletion = prevUnit.countcompletion
  const curExperimentState = await getExperimentState();
  // if the last unit was adaptive, we may need to update future units
  if(adaptive){
    if(engine.adaptiveQuestionLogic){
      logic = engine.adaptiveQuestionLogic.curUnit.adaptiveLogic;
      if(logic != '' && logic != undefined){
        clientConsole(2, 'adaptive schedule');
        for(let adaptiveUnitIndex in adaptive){
          let newUnitIndex = adaptive[adaptiveUnitIndex].split(',')[0];
          let isTemplate = adaptive[adaptiveUnitIndex].split(',')[1] == 't';
          let adaptiveQuestionTimes = []
          let adaptiveQuestions = []
          for(let logic of adaptiveLogic[newUnitIndex]){
            let logicOutput = await engine.adaptiveQuestionLogic.evaluate(logic);
            if(logicOutput?.conditionResult){
              adaptiveQuestionTimes.push(logicOutput.when)
              adaptiveQuestions.push(...logicOutput.questions)
            }
          }
          if(isTemplate) {
            adaptiveTemplate = curTdf.tdfs.tutor.setspec.unitTemplate[adaptiveUnitIndex]
            let unit = engine.adaptiveQuestionLogic.unitBuilder(adaptiveTemplate, adaptiveQuestionTimes, adaptiveQuestions);
            countCompletion = prevUnit.countcompletion
            curTdf.tdfs.tutor.unit.splice(newUnitIndex - 1, 0, unit);
          } else {
            let unit = await engine.adaptiveQuestionLogic.modifyUnit(adaptiveLogic[adaptiveUnitIndex], unit);
            curTdf.tdfs.tutor.unit[newUnitIndex] = unit;
          }
        }
      }
      //add new question to current unit
      if(engine.adaptiveQuestionLogic.when == Session.get("currentUnitNumber")){
        playerController.addStimToSchedule(curTdfUnit);
      }
    }
    Session.set('currentTdfFile', curTdf);
    curExperimentState.currentTdfFile = curTdf;
    await updateExperimentState(curExperimentState, 'card.unitIsFinished');
  }
  let curTdfUnit = curTdf.tdfs.tutor.unit[newUnitNum];
  

  Session.set('questionIndex', 0);
  Session.set('clusterIndex', undefined);
  Session.set('currentUnitNumber', newUnitNum);
  Session.set('currentTdfUnit', curTdfUnit);
  Session.set('resetSchedule', true);
  Session.set('currentDeliveryParams', getCurrentDeliveryParams());
  Session.set('currentUnitStartTime', Date.now());
  cardState.set('feedbackUnset', true);
  cardState.set('feedbackTypeFromHistory', undefined);
  Session.set('curUnitInstructionsSeen', false);

  const resetStudentPerformance = Session.get('currentDeliveryParams').resetStudentPerformance
  let leaveTarget;
  if (newUnitNum < curTdf.tdfs.tutor.unit.length) {
    // Just hit a new unit - we need to restart with instructions
    clientConsole(2, 'UNIT FINISHED: show instructions for next unit', newUnitNum);
      let rootTDFBoxed = Tdfs.findOne({_id: Session.get('currentRootTdfId')});
      if (!rootTDFBoxed) {
        clientConsole(1, 'Root TDF not found in client collection, fetching from server:', Session.get('currentRootTdfId'));
        rootTDFBoxed = await meteorCallAsync('getTdfById', Session.get('currentRootTdfId'));
        if (!rootTDFBoxed) {
          clientConsole(1, 'Could not find root TDF:', Session.get('currentRootTdfId'));
          alert('Unfortunately, the root TDF could not be loaded. Please contact your administrator.');
          leavePage('/home');
          return;
        }
      }
      const rootTDF = rootTDFBoxed.content;
      const setspec = rootTDF.tdfs.tutor.setspec;
      if((setspec.loadbalancing && setspec.countcompletion == newUnitNum) || (setspec.loadbalancing && countCompletion && !setspec.countcompletion)){
        const curConditionFileName = Session.get('currentTdfFile').fileName;
        //get the condition number from the rootTDF
        const curConditionNumber = setspec.condition.indexOf(curConditionFileName);
        //increment the completion count for the current condition
        rootTDFBoxed.conditionCounts[curConditionNumber] = rootTDFBoxed.conditionCounts[curConditionNumber] + 1;
        const conditionCounts = rootTDFBoxed.conditionCounts;
        //update the rootTDF
        await Meteor.callAsync('updateTdfConditionCounts', Session.get('currentRootTdfId'), conditionCounts);
      }
    leaveTarget = '/instructions';
  } else {
    // We have run out of units - return home for now
    clientConsole(2, 'UNIT FINISHED: No More Units');
    //if loadbalancing is enabled and countcompletion is "end" then we need to increment the completion count of the current condition in the root tdf
    const rootTDFBoxed = Tdfs.findOne({_id: Session.get('currentRootTdfId')});
    const rootTDF = rootTDFBoxed.content;
    const setspec = rootTDF.tdfs.tutor.setspec;
    if(setspec.countcompletion == "end" && setspec.loadbalancing || (setspec.loadbalancing && countCompletion && !setspec.countcompletion)){
        const curConditionFileName = Session.get('currentTdfFile').fileName;
        //get the condition number from the rootTDF
        const curConditionNumber = setspec.condition.indexOf(curConditionFileName);
        rootTDFBoxed.conditionCounts[curConditionNumber] = rootTDFBoxed.conditionCounts[curConditionNumber] + 1;
        const conditionCounts = rootTDFBoxed.conditionCounts;
        //update the rootTDF
        await Meteor.callAsync('updateTdfConditionCounts', Session.get('currentRootTdfId'), conditionCounts);
    }

    leaveTarget = '/profile';
    
  }

  const newExperimentState = {
    questionIndex: 0,
    clusterIndex: 0,
    shufIndex: 0,
    whichHintLevel: 0,
    whichStim: 0,
    lastUnitCompleted: curUnitNum,
    lastUnitStarted: newUnitNum,
    currentUnitNumber: newUnitNum,
    currentTdfUnit: curTdfUnit,
    lastAction: 'unit-end',
  };

  if (curTdfUnit && curTdfUnit.learningsession) {
    newExperimentState.schedule = null;
  } else {
    // nothing for now
  }

  if(resetStudentPerformance){
    const studentUsername = Session.get('studentUsername') || Meteor.user().username;
    await meteorCallAsync('clearCurUnitProgress', Meteor.userId(), Session.get('currentTdfId'));
    await setStudentPerformance(Meteor.userId(), studentUsername, Session.get('currentTdfId'));
  }

  const res = await updateExperimentState(newExperimentState, 'card.unitIsFinished');
  clientConsole(2, 'unitIsFinished,updateExperimentState', res);
  leavePage(leaveTarget);  
}

function getButtonTrial() {
  const curUnit = Session.get('currentTdfUnit');
  // Default to value given in the unit

  let isButtonTrial

  if (typeof curUnit.isButtonTrial === 'string' || typeof curUnit.buttonTrial === 'string') 
    isButtonTrial = (curUnit.isButtonTrial === 'true' || curUnit.buttonTrial === 'true');
  if (typeof curUnit.isButtonTrial === 'undefined' || typeof curUnit.buttonTrial === 'undefined') 
    isButtonTrial = false;
  else
    isButtonTrial = (curUnit.isButtonTrial || curUnit.buttonTrial);

  const curCardInfo = engine.findCurrentCardInfo();
  const curStimulus = Session.get('currentStimuliSet')[engine.findCurrentCardInfo().clusterIndex]
  if (curCardInfo.forceButtonTrial) {
    // Did this question specifically override button trial?
    isButtonTrial = true;
  } else if (curStimulus && curStimulus.incorrectResponses && curStimulus.incorrectResponses.length > 0) {
    isButtonTrial = true;
  }
  else {
    // An entire schedule can override a button trial
    const schedButtonTrial = Session.get('schedule') ? Session.get('schedule').isButtonTrial : false;
    if (schedButtonTrial) {
      isButtonTrial = true; // Entire schedule is a button trial
    }
  }

  return isButtonTrial;
}

function cardStart() {
  // Reset resizing for card images (see also index.js)
  $('#cardQuestionImg').load(function(evt) {
    redoCardImage();
  });
  $('#userLowerInteraction').html('');

  // Hide global loading spinner when card starts (fallback for video sessions which skip beginFadeIn)
  if (Session.get('appLoading')) {
    clientConsole(2, '[UI] Card start - hiding global spinner');
    Session.set('appLoading', false);
  }

  // Always hide the final instructions box
  $('#finalInstructionsDlg').modal('hide');
  // the card loads frequently, but we only want to set this the first time
  if (Session.get('inResume')) {
    cardState.set('buttonTrial', false);
    cardState.set('buttonList', []);

    clientConsole(2, 'cards template rendered => Performing resume');
    let curExperimentState = Session.get('currentExperimentState') || {};
    curExperimentState.showOverlearningText = false;
    Session.set('currentExperimentState', curExperimentState);

    Session.set('inResume', false); // Turn this off to keep from re-resuming
    resumeFromComponentState();
  }
}

async function prepareCard(isResume = false) {
  const trialNum = (Session.get('currentExperimentState')?.numQuestionsAnswered || 0) + 1;
  clientConsole(2, '[SM] === prepareCard START (Trial #' + trialNum + ', isResume=' + isResume + ') ===');
  // Call stack logging removed (too verbose)
  clientConsole(2, '[SM]   displayReady before:', cardState.get('displayReady'));

  // STATE MACHINE: Handle transition to fade-out based on current state
  if (trialState.get('current') === TRIAL_STATES.IDLE) {
    // First trial - no need to fade out, will go straight to LOADING after clearing
    clientConsole(2, '[SM]   First trial (IDLE state), skipping fade-out');
  } else if (trialState.get('current') === TRIAL_STATES.TRANSITION_START) {
    transitionTrialState(TRIAL_STATES.TRANSITION_FADING_OUT, 'Fade-out previous trial content');
  } else if (trialState.get('current') === TRIAL_STATES.TRANSITION_CLEARING) {
    // Already in CLEARING (called from processUserTimesLog), skip fade-out
    clientConsole(2, '[SM]   Already in CLEARING state, skipping fade-out');
  } else if (trialState.get('current') === TRIAL_STATES.PRESENTING_AWAITING ||
             trialState.get('current') === TRIAL_STATES.STUDY_SHOWING) {
    // FIX: Unit transition (e.g., instruction-only → first real trial) - properly exit current state
    clientConsole(2, '[SM]   Transitioning from', trialState.get('current'), 'to TRANSITION.START before prepareCard');
    transitionTrialState(TRIAL_STATES.TRANSITION_START, 'Unit transition - exiting current trial state');
    transitionTrialState(TRIAL_STATES.TRANSITION_FADING_OUT, 'Fade-out previous unit content');
  } else {
    // Called from somewhere unexpected - transition to fade-out anyway
    transitionTrialState(TRIAL_STATES.TRANSITION_FADING_OUT, 'prepareCard() starting fade-out from unexpected state');
  }

  Meteor.logoutOtherClients();
  cardState.set('wasReportedForRemoval', false);

  // Start fade-out with OLD content still visible - cleanup happens AFTER fade completes
  clientConsole(2, '[SM]   Setting displayReady=false to fade out (old content remains visible during fade)');
  cardState.set('displayReady', false);
  cardState.set('inputReady', false);

  // Wait for fade-out transition to complete
  const fadeDelay = getTransitionDuration();
  clientConsole(2, `[SM]   Waiting ${fadeDelay}ms for fade-out to complete...`);
  await new Promise(resolve => registerTimeout('fadeOutTransition', resolve, fadeDelay, 'Wait for CSS fade-out transition'));
  clientConsole(2, '[SM]   Fade-out complete, now cleaning up WHILE INVISIBLE');

  // Clean up feedback/input styling AFTER fade-out while opacity=0 to prevent visible flashing
  cleanupTrialContent();

  // STATE MACHINE: Transition to CLEARING
  if (trialState.get('current') === TRIAL_STATES.TRANSITION_FADING_OUT) {
    transitionTrialState(TRIAL_STATES.TRANSITION_CLEARING, 'Clearing previous trial content');
  }

  cardState.set('submmissionLock', false);
  // CRITICAL: Clear currentDisplay while invisible (opacity=0) to prevent old image briefly appearing during new content fade-in
  cardState.set('currentDisplay', {});

  // Don't set buttonTrial to undefined - causes input flash/paint delay (updated in newQuestionHandler instead)
  cardState.set('buttonList', []);
  $('#helpButton').prop("disabled",false);
  if (await engine.unitFinished()) {
    unitIsFinished('Unit Engine');
  } else if (Session.get('isVideoSession')) {
    let indices = Session.get('engineIndices');
    if(!indices){
      indices = {
        'clusterIndex': 0,
        'stimIndex': 0
      }
      Session.set('engineIndices', indices);
      if(Session.get("currentUnitNumber") + 1 == Session.get("currentTdfFile").tdfs.tutor.unit.length){
        $('#lastUnitModal').modal('show');
        return;
      } else {
        await initializePlyr();
      }
    } else {
      playerController.playNextCard();
    }
  } else {
    // STATE MACHINE: Transition to PRESENTING.LOADING
    transitionTrialState(TRIAL_STATES.PRESENTING_LOADING, isResume ? 'Resuming existing card' : 'Starting card selection');

    // Resume path: card selected, skip selectNextCard() - Normal path: select from engine
    if (!isResume) {
      await engine.selectNextCard(Session.get('engineIndices'), Session.get('currentExperimentState'));
    } else {
      clientConsole(2, '[SM] prepareCard: Skipping selectNextCard (resume path, card already selected)');
    }

    // Set buttonTrial BEFORE newQuestionHandler so Blaze renders atomically when displayReady=true (prevents input field painting after image)
    const isButtonTrial = getButtonTrial();
    cardState.set('buttonTrial', isButtonTrial);
    clientConsole(2, '[SM] prepareCard: Set buttonTrial =', isButtonTrial, 'before content display');

    await newQuestionHandler();
    cardState.set('cardStartTimestamp', Date.now());
    Session.set('engineIndices', undefined);
  }
}

// TODO: this probably no longer needs to be separate from prepareCard
async function newQuestionHandler() {
  clientConsole(2, '=== newQuestionHandler START ===');
  clientConsole(2, '[SM] newQuestionHandler called in state:', trialState.get('current'));

  // Cache frequently accessed Session variables
  const experimentState = Session.get('currentExperimentState');

  scrollList.update(
      {'justAdded': 1},
      {'$set': {'justAdded': 0}},
      {'multi': true},
      function(err, numrecs) {
        if (err) clientConsole(1, 'UDPATE ERROR:', displayify(err));
      },
  );

  cardState.set('buttonList', []);
  speechTranscriptionTimeoutsSeen = 0;

  // buttonTrial now set BEFORE newQuestionHandler (in prepareCard) for atomic Blaze render
  const isButtonTrial = cardState.get('buttonTrial');
  clientConsole(2, 'newQuestionHandler, isButtonTrial', isButtonTrial, 'displayReady', cardState.get('displayReady'));

  if (isButtonTrial) {
    setUpButtonTrial();
  }

  // For study-trial cloze, construct question to display actual info using regex for global replace of 3+ underscores
  if ((getTestType() === 's' || getTestType() === 'f') && !!(experimentState.currentDisplayEngine.clozeText)) {
    const currentDisplay = experimentState.currentDisplayEngine;
    const clozeQuestionFilledIn = Answers.clozeStudy(currentDisplay.clozeText, experimentState.currentAnswer);
    currentDisplay.clozeText = clozeQuestionFilledIn;
    const newExperimentState = {currentDisplayEngine: currentDisplay};
    await updateExperimentState(newExperimentState, 'card.newQuestionHandler');
    experimentState.currentDisplayEngine = currentDisplay;
  }

  startQuestionTimeout();
  checkSimulation();

  if (experimentState.showOverlearningText) {
    $('#overlearningRow').removeAttr('hidden');
  }
}

function startQuestionTimeout() {
  stopUserInput(); // No user input (re-enabled below) and reset keypress timestamp.
  clearCardTimeoutWrapper(); // No previous timeout now

  const deliveryParams = Session.get('currentDeliveryParams');
  if (!deliveryParams) {
    throw new Error('No delivery params');
  }
  clientConsole(2, 'startQuestionTimeout deliveryParams');

  let delayMs = 0;
  if (getTestType() === 's' || getTestType() === 'f') { // Study
    delayMs = _.intval(deliveryParams.purestudy);
  } else { // Not study - must be drill or test
    delayMs = _.intval(deliveryParams.drill);
  }

  if (delayMs < 1) {
    throw new Error('Could not find appropriate question timeout');
  }

  // We do this little shuffle of session variables so the display will update all at the same time
  const currentExperimentState = Session.get('currentExperimentState');
  if (!currentExperimentState) {
    clientConsole(1, 'ERROR: currentExperimentState not found in startQuestionTimeout');
    return;
  }
  const currentDisplayEngine = currentExperimentState.currentDisplayEngine;

  // displayReady toggled false→true per trial to control CSS opacity transitions (DOM stays in place, only visibility changes)

  let readyPromptTimeout = 0;
  if(Session.get('currentDeliveryParams').readyPromptStringDisplayTime && Session.get('currentDeliveryParams').readyPromptStringDisplayTime > 0){
    readyPromptTimeout = Session.get('currentDeliveryParams').readyPromptStringDisplayTime
  }
  trialStartTimestamp = Date.now();
  cardState.set('trialStartTimestamp', trialStartTimestamp);
  registerTimeout('readyPrompt', () => {
    const beginQuestionAndInitiateUserInputBound = beginQuestionAndInitiateUserInput.bind(null, delayMs, deliveryParams);
    const state = Session.get('currentExperimentState');
    const clozeQuestionParts = state ? state.clozeQuestionParts : undefined;
    const pipeline = checkAndDisplayTwoPartQuestion.bind(null,
        deliveryParams, currentDisplayEngine, clozeQuestionParts, beginQuestionAndInitiateUserInputBound);
    checkAndDisplayPrestimulus(deliveryParams, pipeline);
  }, readyPromptTimeout, 'Ready prompt display time');
  registerInterval('readyPromptCountdown', () => {
    const timeLeft = Math.max(0, readyPromptTimeout - (Date.now() - trialStartTimestamp));
    const timeLeftSecs = Math.ceil(timeLeft / 1000);
    const progressbarElem = document.getElementById("progressbar");
    if(timeLeft <= 0){
      clearRegisteredTimeout('readyPromptCountdown');
    } else {
      if(Session.get('curTdfUISettings').displayReadyPromptTimeoutAsBarOrText == "bar" || Session.get('curTdfUISettings').displayCardTimeoutAsBarOrText == "both"){
        //add the progress bar class
        $('#progressbar').addClass('progress-bar');
        if (progressbarElem) {
          progressbarElem.style.width = percent + "%";
        }
      } else {
        //set width to 0%
        if (progressbarElem) {
          progressbarElem.style.width = 0 + "%";
        }
        //remove progress bar class
        $('#progressbar').removeClass('progress-bar');
      }
     if(Session.get('curTdfUISettings').displayReadyPromptTimeoutAsBarOrText == "text" || Session.get('curTdfUISettings').displayReadyPromptTimeoutAsBarOrText == "both"){
      $('#CountdownTimerText').text("Continuing in: " + timeLeftSecs + "s.");
     } else {
      $('#CountdownTimerText').text("");
     }
      

    }
  }, 1000);
}
async function checkAndDisplayPrestimulus(deliveryParams, nextStageCb) {
  clientConsole(2, '[SM] checkAndDisplayPrestimulus called in state:', trialState.get('current'));

  const prestimulusDisplay = Session.get('currentTdfFile').tdfs.tutor.setspec.prestimulusDisplay;
  if (!prestimulusDisplay) {
    clientConsole(2, '[SM] No prestimulus display, continuing to next stage');
    await nextStageCb();
    return;
  }

  clientConsole(2, '[SM] Displaying prestimulus:', prestimulusDisplay);
  cardState.set('currentDisplay', {'text': prestimulusDisplay});

  const afterFadeIn = () => {
    const displayTime = deliveryParams.prestimulusdisplaytime;
    clientConsole(2, `[SM] Prestimulus displayed, waiting ${displayTime}ms before continuing`);
    registerTimeout('prestimulusDisplay', async () => {
      clientConsole(2, '[SM] Prestimulus display complete, continuing to question');
      await nextStageCb();
    }, displayTime, 'Prestimulus display time (TDF parameter)');
  };

  if (shouldSkipFadeIn()) {
    clientConsole(2, '[SM] Skipping fade-in (already visible or video session)');
    afterFadeIn();
  } else {
    beginFadeIn('Prestimulus fade-in');
    registerTimeout('prestimulusFadeIn', () => {
      completeFadeIn();
      afterFadeIn();
    }, getTransitionDuration(), 'Wait for prestimulus fade-in transition');
  }
}

async function checkAndDisplayTwoPartQuestion(deliveryParams, currentDisplayEngine, closeQuestionParts, nextStageCb) {
  clientConsole(2, '[SM] checkAndDisplayTwoPartQuestion called in state:', trialState.get('current'));

  cardState.set('currentDisplay', currentDisplayEngine);
  const currentExperimentState = Session.get('currentExperimentState');
  if (!currentExperimentState) {
    clientConsole(1, 'ERROR: currentExperimentState not found in session');
    nextStageCb();
    return;
  }
  currentExperimentState.clozeQuestionParts = closeQuestionParts;

  const handleTwoPartQuestion = () => {
    const currentExperimentState = Session.get('currentExperimentState');
    if (!currentExperimentState) {
      nextStageCb();
      return;
    }
    const questionPart2 = currentExperimentState.currentQuestionPart2;
    if (!questionPart2) {
      nextStageCb();
      return;
    }

    const initialViewDelay = deliveryParams.initialview;
    clientConsole(2, `[SM] Two-part question: waiting ${initialViewDelay}ms before showing part 2`);
    registerTimeout('twoPartQuestionDelay', () => {
      clientConsole(2, '[SM] Displaying question part 2');
      cardState.set('currentDisplay', {'text': questionPart2});
      const state = Session.get('currentExperimentState');
      if (state) {
        state.currentQuestionPart2 = undefined;
      }
      redoCardImage();
      nextStageCb();
    }, initialViewDelay, 'Two-part question initial view delay (TDF parameter)');
  };

  if (shouldSkipFadeIn()) {
    clientConsole(2, '[SM] Skipping fade-in (already visible or video session)');
    cardState.set('inputReady', true);
    handleTwoPartQuestion();
  } else {
    // CRITICAL: Wait one frame for Blaze to finish computing buttonTrial visibility classes before fade-in (prevents input flash/repaint mid-transition)
    requestAnimationFrame(async () => {
      // FLICKER FIX: Set input disabled state AND focus BEFORE fade-in while opacity=0 (eliminates visible flicker)
      const isButtonTrial = cardState.get('buttonTrial');
      if (!isButtonTrial) {
        // Text input trial: enable input and focus it before fade-in so it's ready when visible
        $('#userAnswer').prop('disabled', false);
        inputDisabled = false;
        // Focus now (while opacity=0) so cursor is ready when input fades in
        try {
          $('#userAnswer').focus();
        } catch (e) {
          // Ignore - focus may fail if element not ready
        }
      } else {
        // Button trial: enable buttons before fade-in
        $('#multipleChoiceContainer button').prop('disabled', false);
        inputDisabled = false;
      }

      // IMAGE UX FIX: Wait for image fully loaded and painted before fading in (prevents empty box then late image)
      await waitForDOMImageReady();

      cardState.set('inputReady', true);

      beginFadeIn('Question fade-in');
      registerTimeout('questionFadeIn', () => {
        completeFadeIn();
        handleTwoPartQuestion();
      }, getTransitionDuration(), 'Wait for question fade-in transition');
    });
  }
}

function beginQuestionAndInitiateUserInput(delayMs, deliveryParams) {
  firstKeypressTimestamp = 0;
  const currentDisplay = cardState.get('currentDisplay');

  if (!currentDisplay) {
    clientConsole(1, 'ERROR: currentDisplay is undefined in beginQuestionAndInitiateUserInput');
    return;
  }

  if (currentDisplay.audioSrc) {
    const timeuntilaudio = deliveryParams.timeuntilaudio;
    registerTimeout('audioPlayDelay', function() {
      clientConsole(2, 'playing audio: ', new Date());
      // We don't allow user input until the sound is finished playing
      playCurrentSound(function() {
        allowUserInput();
        beginMainCardTimeout(delayMs, function() {
          clientConsole(2, 'stopping input after ' + delayMs + ' ms');
          stopUserInput();
          handleUserInput({}, 'timeout');
        }, cardState, timeoutState, srState, leavePage);
      });
    }, timeuntilaudio, 'Time until audio plays (TDF parameter)');
  } else { // Not a sound - can unlock now for data entry now
    const questionToSpeak = currentDisplay.clozeText || currentDisplay.text;
    // Speak prompt only for appropriate question types (button trials: speak question but not A/B/C/D labels)
    if (questionToSpeak) {
      clientConsole(2, 'text to speak playing prompt: ', new Date());
      speakMessageIfAudioPromptFeedbackEnabled(questionToSpeak, 'question');
    }
    allowUserInput();
    beginMainCardTimeout(delayMs, function() {
      clientConsole(2, 'stopping input after ' + delayMs + ' ms');
      stopUserInput();
      handleUserInput({}, 'timeout');
    }, cardState, timeoutState, srState, leavePage);
  }
}

function allowUserInput() {
  clientConsole(2, '[SR] ========== allowUserInput() CALLED ==========');
  clientConsole(2, 'allow user input');
  clientConsole(2, '[SM] allowUserInput called in state:', trialState.get('current'));

  // STATE MACHINE: Transition to AWAITING (drill/test) or STUDY.SHOWING (study) after fade-in completes
  if (trialUsesStudyPhase()) {
    // Study trials: transition to STUDY.SHOWING phase
    transitionTrialState(TRIAL_STATES.STUDY_SHOWING, 'Study trial showing stimulus+answer');
  } else {
    // Drill/Test trials: transition to AWAITING user input
    transitionTrialState(TRIAL_STATES.PRESENTING_AWAITING, 'Ready for user input');
  }

  // Don't need show() - CSS wrapper (#trialContentWrapper) handles visibility via displayReady and opacity

  // SR should not activate for button trials (multiple choice) - only for text input
  if (!getButtonTrial()) {
    clientConsole(2, '[SR] About to call startRecording()...');
    startRecording();
    clientConsole(2, '[SR] startRecording() call completed');
  } else {
    clientConsole(2, '[SR] Button trial detected - skipping startRecording()');
  }
  clientConsole(2, '[SR] ==========================================');

  // FLICKER FIX: Input disabled state already set in prepareCard() - only update flag here for safety
  if (inputDisabled !== false) {
    inputDisabled = false;
  }

  // REPAINT FIX: Batch remaining DOM updates in single requestAnimationFrame (focus already happened before fade-in)
  requestAnimationFrame(() => {
    // Show confirm button
    $('#confirmButton').removeClass('hidden');

    // ACCESSIBILITY: Announce trial state to screen readers
    const currentDisplay = cardState.get('currentDisplay');
    const questionText = currentDisplay?.clozeText || currentDisplay?.text || '';
    const isButtonTrial = cardState.get('buttonTrial');
    const inputInstruction = isButtonTrial ?
      'Select an answer using arrow keys and space, or click a button' :
      'Type your answer and press enter';

    // Update ARIA live region for screen readers
    const announcement = questionText ?
      `${questionText}. ${inputInstruction}.` :
      `Question ready. ${inputInstruction}.`;
    $('#trialStateAnnouncer').text(announcement);

    // Note: Focus removed from here - now happens before fade-in to eliminate flash
  });
}


// inputDisabled flag records synchronous enable/disable state to prevent race conditions between stopUserInput and allowUserInput
let inputDisabled = undefined;
function stopUserInput() {
  clientConsole(2, 'stop user input');
  clientConsole(2, '[SM] stopUserInput called in state:', trialState.get('current'));
  // Don't hide #userAnswer - CSS wrapper handles visibility via opacity (would break input on subsequent trials)
  inputDisabled = true;
  // stopRecording(); // COMMENTED OUT - destroys audio buffer before API can process it

  // Delay disabling inputs to sync with CSS fade transition (prevents visible button state changes, inputDisabled guards race conditions)
  registerTimeout('stopUserInputDelay', function() {
    clientConsole(2, 'after delay, stopping user input');
    // Only disable if inputDisabled is still true (allowUserInput may have set it to false)
    if (inputDisabled === true) {
      $('#userAnswer, #multipleChoiceContainer button').prop('disabled', true);
    }
  }, getTransitionDuration(), 'Delay input disable to sync with fade-out transition');
}

// BEGIN WEB AUDIO section

// Audio prompt/feedback
async function speakMessageIfAudioPromptFeedbackEnabled(msg, audioPromptSource) {
  const userAudioPromptMode = Meteor.user()?.audioSettings?.audioPromptMode;
  const tdfAudioPromptMode = Session.get('currentTdfFile')?.tdfs?.tutor?.setspec?.audioPromptMode;

  // TTS activates only if: (1) TDF audioPromptMode != 'silent' AND (2) User preference != 'silent'
  const tdfSupportsAudioPrompts = tdfAudioPromptMode && tdfAudioPromptMode !== 'silent';
  const userWantsAudioPrompts = userAudioPromptMode && userAudioPromptMode !== 'silent';
  const enableAudioPromptAndFeedback = tdfSupportsAudioPrompts && userWantsAudioPrompts;
  const audioPromptMode = enableAudioPromptAndFeedback ? userAudioPromptMode : 'silent';
  let synthesis = window.speechSynthesis;

  clientConsole(2, '[SR] speakMessage:', audioPromptSource, 'enabled:', enableAudioPromptAndFeedback);

  if (enableAudioPromptAndFeedback) {
    if (audioPromptSource === audioPromptMode || audioPromptMode === 'all') {
      // Recording lock moved inside TTS success callback (avoids permanent lock on errors), replace underscores in speech text
      msg = msg.replace(/(&nbsp;)+/g, 'blank');
      // Remove all HTML
      msg = msg.replace( /(<([^>]+)>)/ig, '');
      if (Session.get('currentTdfFile').tdfs.tutor.setspec.textToSpeechAPIKey) {
        let audioPromptSpeakingRate = Session.get('audioPromptFeedbackSpeakingRate');
        let audioPromptVolume = Session.get('audioPromptFeedbackVolume')
        let audioPromptVoice = Session.get('audioPromptFeedbackVoice')
        if (audioPromptSource == 'question'){
          audioPromptSpeakingRate = Session.get('audioPromptQuestionSpeakingRate');
          audioPromptVolume = Session.get('audioPromptQuestionVolume')
          audioPromptVoice = Session.get('audioPromptVoice')
        }

        // FIX: Track ttsRequested state to prevent feedback advancing before TTS completes (critical when correctprompt=0)
        cardState.set('ttsRequested', true);
        clientConsole(2, '[SR] 🎤 TTS request started (ttsRequested=true)');

        (async () => {
          try {
            const res = await Meteor.callAsync('makeGoogleTTSApiCall', Session.get('currentTdfId'), msg, audioPromptSpeakingRate, audioPromptVolume, audioPromptVoice);

            if(res == undefined){
              clientConsole(2, '[SR]   ❌ TTS API returned undefined, NOT locking recording');
              cardState.set('ttsRequested', false);
              clientConsole(2, '[SR] 🎤 TTS request complete (undefined) (ttsRequested=false)');
            }
            else{
            // FIX: Check if request is still active (timeout may have fired)
            if (!cardState.get('ttsRequested')) {
              clientConsole(1, '[SR]   ⚠️ TTS audio received but request was already cancelled (timeout), ignoring');
              return;
            }

            clientConsole(2, '[SR]   ✅ TTS audio received, LOCKING RECORDING');
            const audioObj = new Audio('data:audio/ogg;base64,' + res)
            cardState.set('recordingLocked', true);
            if (window.currentAudioObj) {
              window.currentAudioObj.pause();
            }
            window.currentAudioObj = audioObj;
            // MO4: Passive listener for better performance
            window.currentAudioObj.addEventListener('ended', (event) => {
              clientConsole(2, '[SR]   ✅ TTS audio ended, unlocking recording');
              window.currentAudioObj = undefined;
              cardState.set('recordingLocked', false);
              cardState.set('ttsRequested', false);
              clientConsole(2, '[SR] 🎤 TTS request complete (audio ended) (ttsRequested=false)');

              // FIX: Only restart recording if we're still in a state that accepts input (Layer 2)
              if (trialState.get('current') === TRIAL_STATES.PRESENTING_AWAITING) {
                startRecording();
              } else {
                clientConsole(2, '[SR] TTS ended but state is', trialState.get('current'), '- not restarting recording');
              }
            }, {passive: true});
            clientConsole(2, 'inside callback, playing audioObj:');
            window.currentAudioObj.play().catch((err) => {
              clientConsole(2, err)
              cardState.set('ttsRequested', false);
              clientConsole(2, '[SR] 🎤 TTS request complete (play error, using fallback) (ttsRequested=false)');
              let utterance = new SpeechSynthesisUtterance(msg);
              // MO4: Passive listeners for better performance
              utterance.addEventListener('end', (event) => {
                clientConsole(2, '[SR]   ✅ TTS fallback utterance ended, unlocking recording');
                cardState.set('recordingLocked', false);

                // FIX: Only restart recording if we're still in a state that accepts input (Layer 2)
                if (trialState.get('current') === TRIAL_STATES.PRESENTING_AWAITING) {
                  startRecording();
                } else {
                  clientConsole(2, '[SR] TTS fallback ended but state is', trialState.get('current'), '- not restarting recording');
                }
              }, {passive: true});
              utterance.addEventListener('error', (event) => {
                clientConsole(2, '[SR]   ❌ TTS fallback utterance error, unlocking recording');
                clientConsole(2, event);
                cardState.set('recordingLocked', false);
              }, {passive: true});
              synthesis.speak(utterance);
            });
          }
          } catch (err) {
            clientConsole(2, '[SR]   ❌ TTS API error, NOT locking recording:', err);
            cardState.set('ttsRequested', false);
            clientConsole(2, '[SR] 🎤 TTS request complete (error) (ttsRequested=false)');
          }
        })();
        clientConsole(2, '[SR] Using Google TTS (async)');
      } else {
        // Native MDN Speech Synthesis (synchronous-ish, no API call)
        clientConsole(2, '[SR] Using MDN Speech Synthesis, locking recording');

        // FIX: Track TTS intent for native speech synthesis too
        cardState.set('ttsRequested', true);
        clientConsole(2, '[SR] 🎤 TTS request started (native) (ttsRequested=true)');

        cardState.set('recordingLocked', true);
        let utterance = new SpeechSynthesisUtterance(msg);
        // MO4: Passive listeners for better performance
        utterance.addEventListener('end', (event) => {
          clientConsole(2, '[SR]   ✅ MDN TTS ended, unlocking recording');
          cardState.set('recordingLocked', false);
          cardState.set('ttsRequested', false);
          clientConsole(2, '[SR] 🎤 TTS request complete (native ended) (ttsRequested=false)');

          // FIX: Only restart recording if we're still in a state that accepts input (Layer 2)
          if (trialState.get('current') === TRIAL_STATES.PRESENTING_AWAITING) {
            startRecording();
          } else {
            clientConsole(2, '[SR] MDN TTS ended but state is', trialState.get('current'), '- not restarting recording');
          }
        }, {passive: true});
        utterance.addEventListener('error', (event) => {
          clientConsole(2, '[SR]   ❌ MDN TTS error, unlocking recording');
          clientConsole(2, event);
          cardState.set('recordingLocked', false);
          cardState.set('ttsRequested', false);
          clientConsole(2, '[SR] 🎤 TTS request complete (native error) (ttsRequested=false)');

          // FIX: Only restart recording if we're still in a state that accepts input (Layer 2)
          if (trialState.get('current') === TRIAL_STATES.PRESENTING_AWAITING) {
            startRecording();
          } else {
            clientConsole(2, '[SR] MDN TTS error but state is', trialState.get('current'), '- not restarting recording');
          }
        }, {passive: true});
        synthesis.speak(utterance);
      }
    }
  }
}

// Speech recognition: process audio data when web worker buffer fills
async function processLINEAR16(data) {
  clientConsole(2, '[SR] ========== processLINEAR16 CALLED ==========');
  clientConsole(2, '[SR] Audio data received, processing...');
  clientConsole(2, '[SR] Data parameter:', data ? `${data.length} bytes` : 'UNDEFINED/NULL');

  // Set flag to prevent timeout from triggering while waiting for transcription
  srState.set('waitingForTranscription', true);
  clientConsole(2, '[SR] Set waitingForTranscription=true to block timeout');

  if (resetMainCardTimeout && !inputDisabled) {
    resetMainCardTimeout(cardState, timeoutState); // Give ourselves a bit more time for the speech api to return results
  } else {
    clientConsole(2, '[SR] not resetting during processLINEAR16');
  }
  recorder.clear();
  const userAnswer = $('#forceCorrectionEntry').is(':visible') ?
      document.getElementById('userForceCorrect') : document.getElementById('userAnswer');
  const isButtonTrial = getButtonTrial();

  clientConsole(2, '[SR] userAnswer:', !!userAnswer, 'isButtonTrial:', isButtonTrial, 'inDialogue:', DialogueUtils.isUserInDialogueLoop());

  if (userAnswer || isButtonTrial || DialogueUtils.isUserInDialogueLoop()) {
    speechTranscriptionTimeoutsSeen += 1;
    const maxAttempts = Session.get('currentDeliveryParams').autostopTranscriptionAttemptLimit;
    clientConsole(2, `[SR] Attempt ${speechTranscriptionTimeoutsSeen} of ${maxAttempts}`);

    // Check if already exceeded maxAttempts before API call - if so, skip API and force incorrect
    if (speechTranscriptionTimeoutsSeen > maxAttempts) {
      clientConsole(2, `[SR] ⚠️ Exceeded maxAttempts (${speechTranscriptionTimeoutsSeen} > ${maxAttempts}), skipping API call and forcing incorrect feedback`);

      // Clear waiting flag
      srState.set('waitingForTranscription', false);

      // Simulate empty/incorrect answer and go to feedback (bypassing speechAPICallback logic)
      if (getButtonTrial()) {
        handleUserInput({answer: {'answer': {'name': 'a'}}}, 'voice');
      } else if (DialogueUtils.isUserInDialogueLoop()) {
        DialogueUtils.setDialogueUserAnswerValue('');
        const answer = DialogueUtils.getDialogueUserAnswerValue();
        handleUserInput(answer, 'voice');
      } else {
        const userAnswerElem = document.getElementById('userAnswer');
        if (userAnswerElem) {
          userAnswerElem.value = ''; // Empty answer = incorrect
        }
        handleUserInput({answer: userAnswerElem}, 'voice');
      }

      return; // Exit early - don't make API call
    }

    const sampleRate = cardState.get('sampleRate');
    const setSpec = Session.get('currentTdfFile').tdfs.tutor.setspec;
    let speechRecognitionLanguage = setSpec.speechRecognitionLanguage;
    if (!speechRecognitionLanguage) {
      clientConsole(2, '[SR] no speechRecognitionLanguage in set spec, defaulting to en-US');
      speechRecognitionLanguage = 'en-US';
    } else {
      speechRecognitionLanguage = speechRecognitionLanguage[0];
    }

    let phraseHints = [];
    let answerGrammar = [];

    if (isButtonTrial) {
      let curChar = 'a';
      phraseHints.push(curChar);
      for (let i=1; i<26; i++) {
        curChar = nextChar(curChar);
        phraseHints.push(curChar);
      }
      answerGrammar = phraseHints;
    } else if (!DialogueUtils.isUserInDialogueLoop()) {
      // PERF: Cache answer grammar per UNIT (all possible answers for currentStimuliSet, only changes on unit change, saves 100+ms)
      const {curClusterIndex, curStimIndex} = getCurrentClusterAndStimIndices();
      const currentUnitNumber = Session.get('currentTdfUnit')?.unitnumber;

      // Check if cache is valid (same unit)
      const cacheValid = (cachedAnswerGrammar !== null && lastCachedUnitNumber === currentUnitNumber);

      if (cacheValid) {
        // Use cached answer grammar - instant!
        answerGrammar = cachedAnswerGrammar;
        clientConsole(2, `[SR] ✅ Using cached answer grammar (${answerGrammar.length} items)`);
      } else {
        // Cache miss - compute once per unit
        answerGrammar = getAllCurrentStimAnswers(false);
        cachedAnswerGrammar = answerGrammar;
        lastCachedUnitNumber = currentUnitNumber;
        clientConsole(2, `[SR] 📦 Cached answer grammar for unit ${currentUnitNumber} (${answerGrammar.length} items)`);
      }

      // Get correct answer for THIS trial to filter phonetic conflicts (from Session.currentExperimentState)
      const experimentState = Session.get('currentExperimentState');
      const correctAnswer = experimentState?.currentAnswer;

      // Initialize phonetic conflicts array (will be populated if we find conflicts)
      let phoneticConflicts = [];

      // Only perform phonetic conflict filtering if we have a valid correct answer
      if (correctAnswer && typeof correctAnswer === 'string' && correctAnswer.trim()) {
        // Build or reuse phonetic index for conflict detection
        let phoneticIndexForConflicts = null;
        if (answerGrammar.length > 10) {
          // Reuse cached phonetic index if available for this unit
          if (cachedPhoneticIndex !== null && lastCachedUnitNumber === currentUnitNumber) {
            phoneticIndexForConflicts = cachedPhoneticIndex;
          } else {
            // Will be built later for validation, but we need it now for conflict detection
            phoneticIndexForConflicts = buildPhoneticIndex(answerGrammar);
            cachedPhoneticIndex = phoneticIndexForConflicts;
          }
        }

        // Find phonetically conflicting words with correct answer (e.g., 'anguilla' conflicts with 'angola')
        const [correctPrimary, correctSecondary] = getPhoneticCodes(correctAnswer);
        clientConsole(2, `[SR] 🔍 Correct answer "${correctAnswer}" phonetic codes: primary="${correctPrimary}", secondary="${correctSecondary || 'none'}"`);

        phoneticConflicts = findPhoneticConflictsWithCorrectAnswer(
          correctAnswer,
          answerGrammar,
          phoneticIndexForConflicts
        );

        // Remove phonetic conflicts from answer grammar to force clearer pronunciation (conflicting words won't match)
        if (phoneticConflicts.length > 0) {
          answerGrammar = answerGrammar.filter(word => phoneticConflicts.indexOf(word) === -1);
          clientConsole(2, `[SR] 🚫 Removed ${phoneticConflicts.length} phonetic conflict(s) from answer grammar: [${phoneticConflicts.join(', ')}]`);

          // CRITICAL: Rebuild phonetic index with FILTERED grammar (cached index has removed conflicts, causes false matches like 'guinea'→'ghana')
          cachedPhoneticIndex = buildPhoneticIndex(answerGrammar);
          clientConsole(2, `[SR] 🔄 Rebuilt phonetic index with filtered grammar (${answerGrammar.length} items)`);
        } else {
          clientConsole(2, `[SR] ✓ No phonetic conflicts found with "${correctAnswer}"`);
        }
      } else {
        clientConsole(2, `[SR] ⚠️ No valid correct answer found, skipping phonetic conflict filtering`);
      }

      // Phrase hints need per-trial filtering (exclusion list varies by stim)
      const curSpeechHintExclusionListText =
          getStimCluster(curClusterIndex).stims[curStimIndex].speechHintExclusionList || '';
      const tdfExclusionList = curSpeechHintExclusionListText.split(',').filter(x => x.trim());

      // Combine TDF exclusions with phonetic conflicts for phrase hints
      const fullExclusionList = [...tdfExclusionList, ...phoneticConflicts];

      // Build phrase hints excluding both TDF exclusions and phonetic conflicts
      phraseHints = answerGrammar.filter((el) => fullExclusionList.indexOf(el) === -1);
    }

    clientConsole(2, '[SR] Sending audio to Google Speech API...');
    const request = generateRequestJSON(sampleRate, speechRecognitionLanguage, phraseHints, data);

    // Always allow 'skip' command for non-dialogue trials
    if (!DialogueUtils.isUserInDialogueLoop()) {
      answerGrammar.push('skip');
    }

    let tdfSpeechAPIKey;
    if(Session.get('useEmbeddedAPIKeys')){
      tdfSpeechAPIKey = await meteorCallAsync('getTdfSpeechAPIKey', Session.get('currentTdfId'));
    } else {
      tdfSpeechAPIKey = '';
    }
    // Make the actual call to the google speech api with the audio data for transcription
    try {
      let res;
      if (tdfSpeechAPIKey && tdfSpeechAPIKey != '') {
        clientConsole(2, '[SR] Using TDF-embedded API key');
        res = await Meteor.callAsync('makeGoogleSpeechAPICall', Session.get('currentTdfId'), "", request, answerGrammar);
      } else {
        // Load user API key if TDF doesn't provide one (shouldn't reach here without key)
        clientConsole(2, '[SR] Using user-provided API key');
        res = await Meteor.callAsync('makeGoogleSpeechAPICall', Session.get('currentTdfId'), Session.get('speechAPIKey'), request, answerGrammar);
      }
      speechAPICallback(null, res);
    } catch (err) {
      speechAPICallback(err, null);
    }
  } else {
    clientConsole(2, '[SR] processLINEAR16 userAnswer not defined');
  }
}

function speechAPICallback(err, data){
  // Clear the waiting flag now that transcription has returned (success or error)
  srState.set('waitingForTranscription', false);
  clientConsole(2, '[SR] speechAPICallback received, set waitingForTranscription=false');

  // FIX: Check still in valid input state (Layer 3 of 3-layer defense against late transcriptions)
  if (trialState.get('current') !== TRIAL_STATES.PRESENTING_AWAITING) {
    clientConsole(2, '[SR] ⚠️ Transcription arrived too late - trial state is:', trialState.get('current'));
    clientConsole(2, '[SR] Discarding transcription to prevent state machine violation');

    // Clear the "waiting for transcription" message if still showing
    const userAnswer = document.getElementById('userAnswer');
    if (userAnswer && userAnswer.value === 'waiting for transcription') {
      userAnswer.value = '';
    }

    return; // EXIT EARLY - don't process this transcription
  }

  let answerGrammar = [];
  let response = {};

  // Handle Meteor method errors (network, timeout, server exception)
  if (err) {
    console.error('[SR] Meteor method error:', err);
    const errorMsg = err.reason || err.message || 'Unknown error';
    clientConsole(2, '[SR] Error details:', errorMsg);
    answerGrammar = [];
    response = {}; // Empty response to trigger "NO TRANSCRIPT/SILENCE" path
  } else if (data) {
    [answerGrammar, response] = data;
  }

  // PERF: Cache phonetic index per UNIT (building is expensive 100+ms, doesn't change within unit)
  let phoneticIndex = null;
  if (answerGrammar && answerGrammar.length > 10) {
    const currentUnitNumber = Session.get('currentTdfUnit')?.unitnumber;

    // Check if we can reuse cached phonetic index (same unit as grammar)
    if (cachedPhoneticIndex !== null && lastCachedUnitNumber === currentUnitNumber) {
      phoneticIndex = cachedPhoneticIndex;
      clientConsole(2, `[SR] ✅ Using cached phonetic index (${phoneticIndex.size} codes)`);
    } else {
      // Build and cache phonetic index for this unit
      phoneticIndex = buildPhoneticIndex(answerGrammar);
      cachedPhoneticIndex = phoneticIndex;
      clientConsole(2, `[SR] 📦 Cached phonetic index (${phoneticIndex.size} codes)`);
    }
  }

  let transcript = '';
  let ignoreOutOfGrammarResponses = cardState.get('ignoreOutOfGrammarResponses');

  // Fallback: read from TDF if not in Session (happens on page refresh)
  if (ignoreOutOfGrammarResponses === undefined) {
    const tdfFile = Session.get('currentTdfFile');
    if (tdfFile && tdfFile.tdfs && tdfFile.tdfs.tutor && tdfFile.tdfs.tutor.setspec) {
      const setspec = tdfFile.tdfs.tutor.setspec;
      ignoreOutOfGrammarResponses = setspec.speechIgnoreOutOfGrammarResponses ?
        setspec.speechIgnoreOutOfGrammarResponses.toLowerCase() === 'true' : false;
      cardState.set('ignoreOutOfGrammarResponses', ignoreOutOfGrammarResponses); // Cache it
    } else {
      ignoreOutOfGrammarResponses = false; // Safe default
    }
  }

  clientConsole(2, '[SR] ignoreOutOfGrammarResponses setting:', ignoreOutOfGrammarResponses);
  const speechOutOfGrammarFeedback = 'Please try again or press enter or say skip';
  // Session.get("speechOutOfGrammarFeedback");//TODO: change this in tdfs and not hardcoded
  let ignoredOrSilent = false;

  // Check for Google API errors (returned in response.error field)
  if (response && response.error) {
    clientConsole(2, '[SR] Google Speech API error object:', response.error);
    const errorCode = response.error.code;
    const errorMessage = response.error.message || '';
    clientConsole(2, `[SR] Google API error - Code: ${errorCode}, Message: ${errorMessage}`);

    if (errorCode === 403 || errorMessage.toLowerCase().includes('api key')) {
      transcript = 'Invalid API key. Please check your settings.';
    } else if (errorCode === 429 || errorMessage.toLowerCase().includes('quota')) {
      transcript = 'API quota exceeded. Please try again later.';
    } else if (errorMessage.toLowerCase().includes('timeout')) {
      transcript = 'Speech recognition timed out. Please try again.';
    } else {
      transcript = `API Error: ${errorMessage}`;
    }
    ignoredOrSilent = true;
  } else if (response && response['results'] && response['results'].length > 0) {
    // Successfully got response - collect ALL alternatives from ALL results (Google spreads them across multiple)
    let alternatives = [];
    for (let resultIdx = 0; resultIdx < response['results'].length; resultIdx++) {
      const result = response['results'][resultIdx];
      if (result['alternatives'] && result['alternatives'].length > 0) {
        for (let altIdx = 0; altIdx < result['alternatives'].length; altIdx++) {
          const alt = result['alternatives'][altIdx];
          if (alt['transcript']) {
            alternatives.push(alt);
          }
        }
      }
    }

    if (alternatives.length === 0) {
      clientConsole(2, '[SR] NO VALID ALTERNATIVES found in any result');
      transcript = 'Silence detected';
      ignoredOrSilent = true;
    } else {

    // Try to find a grammar match in alternatives (best strategy)
    let foundGrammarMatch = false;
    if (ignoreOutOfGrammarResponses) {
      // First pass: Look for exact match
      for (let i = 0; i < alternatives.length; i++) {
        const alt = alternatives[i];
        if (alt['transcript']) {
          const altTranscript = alt['transcript'].toLowerCase();
          if (answerGrammar.indexOf(altTranscript) !== -1 || altTranscript === 'skip') {
            transcript = altTranscript;
            foundGrammarMatch = true;
            break;
          }
        }
      }
      if (foundGrammarMatch) {
        clientConsole(2, `[SR] ✅ FOUND EXACT GRAMMAR MATCH: "${transcript}"`);
      }

      // Second pass: Phonetic matching for homophones (Mali/Molly, Palau/pull out) - only for 3+ char words to avoid false positives
      if (!foundGrammarMatch && alternatives.length > 0 && alternatives[0]['transcript']) {
        const bestAlternative = alternatives[0]['transcript'].toLowerCase();

        if (bestAlternative.length >= 3) {
          const phoneticMatch = findPhoneticMatch(bestAlternative, answerGrammar, phoneticIndex);

          if (phoneticMatch) {
            transcript = phoneticMatch;
            foundGrammarMatch = true;
            clientConsole(2, `[SR] ✅ FOUND PHONETIC MATCH: "${bestAlternative}" → "${transcript}"`);
          }
        } else {
          clientConsole(2, `[SR] Skipping phonetic match - word too short: "${bestAlternative}" (${bestAlternative.length} chars)`);
        }
      }
    }

    // If no grammar match found in any alternative, use first alternative
    if (!foundGrammarMatch) {
      const firstAlternative = alternatives[0];

      // Check if transcript exists (Google sometimes returns empty alternative objects)
      if (!firstAlternative['transcript']) {
        clientConsole(2, '[SR] NO TRANSCRIPT in first alternative (empty object)');
        transcript = 'Silence detected';
        ignoredOrSilent = true;
      } else {
        transcript = firstAlternative['transcript'].toLowerCase();
        clientConsole(2, '[SR] No grammar match found, using first alternative: "' + transcript + '"');
      }
    }

    // Grammar checking (will only reject if no grammar match was found in alternatives)
    if (ignoreOutOfGrammarResponses && !ignoredOrSilent && !foundGrammarMatch) {
      clientConsole(2, '[SR] Checking grammar - transcript:', transcript);
      if (transcript == 'enter') {
        clientConsole(2, '[SR] Transcript is "enter" - allowing');
        ignoredOrSilent = false;
      } else if (answerGrammar.indexOf(transcript) == -1) {
        clientConsole(2, '[SR] ❌ ANSWER OUT OF GRAMMAR, IGNORING. Transcript "' + transcript + '" not in grammar list');
        transcript = speechOutOfGrammarFeedback;
        ignoredOrSilent = true;
      } else {
        clientConsole(2, '[SR] ✅ Answer IN GRAMMAR - accepting');
      }
    } else if (!ignoredOrSilent) {
      if (foundGrammarMatch) {
        clientConsole(2, '[SR] ✅ Using grammar match from alternatives');
      } else {
        clientConsole(2, '[SR] ignoreOutOfGrammarResponses is FALSE - accepting all transcripts');
      }
    }
    } // Close the "if (!alternatives)" else block
  } else {
    clientConsole(2, '[SR] NO TRANSCRIPT/SILENCE - No valid results in response');
    transcript = 'Silence detected';
    ignoredOrSilent = true;
  }

  const inUserForceCorrect = $('#forceCorrectionEntry').is(':visible');
  if (getButtonTrial()) {
    userAnswer = $('[verbalChoice=\'' + transcript + '\']')[0];
    if (!userAnswer) {
      clientConsole(2, 'Choice couldn\'t be found');
      ignoredOrSilent = true;
    }
  } else if (DialogueUtils.isUserInDialogueLoop()) {
    if (DialogueUtils.isUserInDialogueIntroExit()) {
      speechTranscriptionTimeoutsSeen = 0;
    } else {
      // Only set input field for valid transcripts, not error/status messages
      if (!ignoredOrSilent) {
        DialogueUtils.setDialogueUserAnswerValue(transcript);
      }
    }
  } else {
    userAnswer = inUserForceCorrect ? document.getElementById('userForceCorrect') :
        document.getElementById('userAnswer');
    // Only set input field for valid transcripts, not error/status messages
    if (!ignoredOrSilent) {
      userAnswer.value = transcript;
    }
  }

  // Check if reached maxAttempts AFTER this attempt - if so, force feedback instead of retrying
  const maxAttempts = Session.get('currentDeliveryParams').autostopTranscriptionAttemptLimit;
  if (speechTranscriptionTimeoutsSeen >= maxAttempts && ignoredOrSilent) {
    clientConsole(2, `[SR] ⚠️ Reached maxAttempts (${speechTranscriptionTimeoutsSeen} >= ${maxAttempts}) in callback, forcing incorrect feedback instead of retry`);

    // Force incorrect answer by setting empty value and submitting
    ignoredOrSilent = false; // Don't retry

    if (getButtonTrial()) {
      userAnswer = {'answer': {'name': 'a'}};
    } else if (DialogueUtils.isUserInDialogueLoop()) {
      DialogueUtils.setDialogueUserAnswerValue('');
    } else if (!inUserForceCorrect) {
      const userAnswerElem = document.getElementById('userAnswer');
      if (userAnswerElem) {
        userAnswerElem.value = '';
      }
    }
  }

  if (ignoredOrSilent) {
    startRecording();
    // Status messages are shown in SR icon/message display, not in input field
  } else {
    // FIX: Clear timeout when SR completes successfully (prevents race: timeout fires after SR, appends ' [timeout]' to transcript)
    clearCardTimeoutWrapper();

    // Only simulate enter key press if picked up transcribable/in-grammar audio (better UX)
    if (getButtonTrial()) {
      handleUserInput({answer: userAnswer}, 'voice');
    } else if (DialogueUtils.isUserInDialogueLoop()) {
      speechTranscriptionTimeoutsSeen = 0;
      if (DialogueUtils.isUserInDialogueIntroExit()) {
        if (transcript === 'continue') {
          dialogueContinue();
        } else {
          startRecording(); // continue trying to see if they do voice continue
        }
      } else {
        const answer = DialogueUtils.getDialogueUserAnswerValue();
        const dialogueContext = DialogueUtils.updateDialogueState(answer);
        clientConsole(2, 'getDialogFeedbackForAnswer2', dialogueContext);
        Meteor.callAsync('getDialogFeedbackForAnswer', dialogueContext, dialogueLoop);
      }
    } else {
      if (inUserForceCorrect) {
        handleUserForceCorrectInput({}, 'voice');
      } else {
        handleUserInput({
          answer: userAnswer
        }, 'voice');
      }
    }
  }
}

function generateRequestJSON(sampleRate, speechRecognitionLanguage, phraseHints, data) {
  clientConsole(2, '[SR] generateRequestJSON - data type:', typeof data, 'constructor:', data?.constructor?.name, 'isArray:', Array.isArray(data));

  const request = {
    'config': {
      'encoding': 'LINEAR16',
      'sampleRateHertz': sampleRate,
      'languageCode': speechRecognitionLanguage,
      'maxAlternatives': 5,  // Get top 5 alternatives to find grammar match
      'profanityFilter': false,
      'enableAutomaticPunctuation': false,  // Disable to get cleaner alternatives
      'model': 'command_and_search',  // Optimized for short queries/commands
      'useEnhanced': true,  // Use enhanced model for better accuracy
      'speechContexts': [
        {
          'phrases': phraseHints,
          'boost': 5  // Low bias - forces Google to return alternatives by keeping confidence lower
        },
      ],
    },
    'audio': {
      'content': data,
    },
  };

  clientConsole(2, '[SR] generateRequestJSON - request.audio.content type:', typeof request.audio.content);

  // Request config with phrase hints omitted from logs (too large)
  clientConsole(2, '[SR] Request config: encoding:', request.config.encoding,
              'sampleRate:', request.config.sampleRateHertz,
              'language:', request.config.languageCode,
              'maxAlternatives:', request.config.maxAlternatives,
              'phraseHints:', request.config.speechContexts?.[0]?.phrases?.length || 0);

  return request;
}

let recorder = null;
let audioContext = null;
window.audioContext = audioContext;
let selectedInputDevice = null;
let userMediaStream = null;
let streamSource = null;
let speechEvents = null;

// The callback used in initializeAudio when an audio data stream becomes available
async function startUserMedia(stream) {
  userMediaStream = stream;
  const tracks = stream.getTracks();
  selectedInputDevice = tracks[0].getSettings().deviceId;
  pollMediaDevicesInterval = Meteor.setInterval(pollMediaDevices, 2000);
  clientConsole(2, 'START USER MEDIA');
  const input = audioContext.createMediaStreamSource(stream);
  window.audioContext = audioContext;
  streamSource = input;
  // Firefox hack https://support.mozilla.org/en-US/questions/984179
  window.firefox_audio_hack = input;
  // Capture the sampling rate for later use in google speech api as input
  cardState.set('sampleRate', input.context.sampleRate);
  const audioRecorderConfig = {errorCallback: function(x) {
    clientConsole(2, 'Error from recorder: ' + x);
  }};
  // eslint-disable-next-line no-undef
  recorder = new Recorder(input, audioRecorderConfig);

  try {
    await recorder.ready;
  } catch (err) {
    clientConsole(1, '[SR] Recorder initialization failed', err);
    alert('Speech recognition could not start because the microphone setup failed. The lesson will continue without voice input.');
    cardStart();
    return;
  }

  // Set process callback for when speech end detected (will process audio data)
  recorder.setProcessCallback(processLINEAR16);

  // Voice activity detection config: audioInputSensitivity (0-100, default 60 = -60 dB threshold)
  const sensitivity = Session.get('audioInputSensitivity') || 60;
  const harkOptions = {
    threshold: -1 * sensitivity,  // Convert to negative dB value (e.g., -20 dB)
    interval: 50,  // Check every 50ms (default) for responsive detection of short utterances
    history: 5,  // Silence detection: needs 5 consecutive silent samples to stop (5 * 50ms = 250ms)
    smoothing: 0.1  // Smoothing time constant for audio analysis (reduces noise spikes)
  };
  clientConsole(2, '[SR] Initializing Hark with options:', harkOptions);
  speechEvents = hark(stream, harkOptions);

  let recordingStartTime = null;

  // Volume monitoring removed - floods console with volume_change events

  speechEvents.on('speaking', function() {
    recordingStartTime = Date.now(); // Track when voice starts
    if (!cardState.get('recording')) {
      clientConsole(2, '[SR] NOT RECORDING, VOICE START');
      return;
    } else {
      clientConsole(2, '[SR] VOICE START');
      if (resetMainCardTimeout) {
        if (cardState.get('recording')) {
          clientConsole(2, '[SR] voice_start resetMainCardTimeout');
          resetMainCardTimeout(cardState, timeoutState);
        } else {
          clientConsole(2, '[SR] NOT RECORDING');
        }
      } else {
        clientConsole(2, '[SR] RESETMAINCARDTIMEOUT NOT DEFINED');
      }
    }
  });

  speechEvents.on('stopped_speaking', function() {
    if (!cardState.get('recording') || cardState.get('pausedLocks')>0) {
      if (document.location.pathname != '/card' && document.location.pathname != '/instructions') {
        leavePage(function() {
          clientConsole(2, '[SR] cleaning up page after nav away from card, voice_stop');
        });
        return;
      } else {
        clientConsole(2, '[SR] NOT RECORDING, VOICE STOP');
        return;
      }
    } else {
      // CRITICAL: Only process voice stop if voice actually started
      if (!recordingStartTime) {
        clientConsole(2, '[SR] VOICE STOP IGNORED - voice never started (speaking event never fired)');
        return;
      }

      // Prevent stopping too quickly if voice never started properly
      const timeSinceStart = Date.now() - recordingStartTime;
      if (timeSinceStart < 200) {
        clientConsole(2, `[SR] VOICE STOP TOO QUICK (${timeSinceStart}ms) - ignoring`);
        return;
      }

      clientConsole(2, `[SR] VOICE STOP (after ${timeSinceStart}ms)`);
      recorder.stop();
      cardState.set('recording', false);
      // CRITICAL: Set flag BEFORE exporting to prevent autorun from restarting recording
      srState.set('waitingForTranscription', true);
      clientConsole(2, '[SR] Set waitingForTranscription=true (voice stop, about to process)');
      recorder.exportToProcessCallback();
      recordingStartTime = null;
    }
  });

  clientConsole(2, '[SR] Audio recorder ready');
  cardStart();
}

function startRecording() {
  if (recorder && !cardState.get('recordingLocked') && Meteor.user()?.audioSettings?.audioInputMode) {
    cardState.set('recording', true);
    recorder.record();
    clientConsole(2, '[SR] RECORDING START');
  } else {
    clientConsole(2, '[SR] ❌ RECORDING BLOCKED:',
      !recorder ? 'NO RECORDER' : '',
      cardState.get('recordingLocked') ? 'RECORDING LOCKED' : '',
      !Meteor.user()?.audioInputMode ? 'AUDIO INPUT MODE OFF' : ''
    );
  }
}

function stopRecording() {
  clientConsole(2, '[SR] stopRecording', recorder, cardState.get('recording'));
  if (recorder && cardState.get('recording')) {
    recorder.stop();
    cardState.set('recording', false);

    recorder.clear();
    clientConsole(2, '[SR] RECORDING END');
  }
}

// END WEB AUDIO SECTION

async function getExperimentState() {
  let curExperimentState = await meteorCallAsync('getExperimentState', Meteor.userId(), Session.get('currentRootTdfId'));
  clientConsole(2, 'getExperimentState:', curExperimentState);
  Session.set('currentExperimentState', curExperimentState);
  return curExperimentState || {};
}

async function updateExperimentState(newState, codeCallLocation, unitEngineOverride = {}) {
  let curExperimentState = Session.get('currentExperimentState') || await getExperimentState();
  newState.lastActionTimeStamp = Date.now();
  clientConsole(2, 'currentExperimentState:', curExperimentState);
  if (unitEngineOverride && Object.keys(unitEngineOverride).length > 0)
    curExperimentState = unitEngineOverride;
  if (curExperimentState.currentTdfId === undefined || newState.currentTdfId === undefined) {
    newState.currentTdfId = Session.get('currentRootTdfId')
  }
  if(Object.keys(curExperimentState).length === 0){
    curExperimentState = Object.assign(JSON.parse(JSON.stringify(curExperimentState)), newState);
    await Meteor.callAsync('createExperimentState', curExperimentState);
  } else {
    curExperimentState = Object.assign(JSON.parse(JSON.stringify(curExperimentState)), newState);
    await Meteor.callAsync('updateExperimentState', curExperimentState, curExperimentState.id);
  }
  clientConsole(2, 'updateExperimentState', codeCallLocation, '\nnew:', curExperimentState);
  Session.set('currentExperimentState', curExperimentState);
  return curExperimentState.currentTdfId;
}

// Re-initialize User Progress and Card Probabilities from user times log (processUserTimesLog callback ensures server-side experimental conditions complete)
async function resumeFromComponentState() {
  if (Session.get('inResume')) {
    clientConsole(2, 'RESUME DENIED - already running in resume');
    return;
  }
  Session.set('inResume', true);

  clientConsole(2, 'Resuming from previous componentState info (if any)');

  // Clear any previous permutation and/or timeout call
  timeoutsSeen = 0;
  firstKeypressTimestamp = 0;
  trialStartTimestamp = 0;
  cardState.set('trialStartTimestamp', trialStartTimestamp);
  clearScrollList();
  clearCardTimeoutWrapper();

  // Disallow continuing (it will be turned on somewhere else)
  setDispTimeoutText('');
  $('#continueButton').prop('disabled', true);

  // Use ROOT tdf to find if experimental condition selection needed (will update currentTdfId and currentStimuliSetId)
  let rootTDFBoxed = Tdfs.findOne({_id: Session.get('currentRootTdfId')});
  if (!rootTDFBoxed) {
    clientConsole(1, 'Root TDF not found in client collection, fetching from server:', Session.get('currentRootTdfId'));
    rootTDFBoxed = await meteorCallAsync('getTdfById', Session.get('currentRootTdfId'));
    if (!rootTDFBoxed) {
      clientConsole(1, 'PANIC: Unable to load the root TDF for learning', Session.get('currentRootTdfId'));
      alert('Unfortunately, the root TDF could not be loaded. Please contact your administrator.');
      leavePage('/home');
      return;
    }
  }
  let curTdf = rootTDFBoxed;
  let rootTDF = rootTDFBoxed.content;
  if (!rootTDF) {
    clientConsole(2, 'PANIC: Root TDF has no content', Session.get('currentRootTdfId'));
    alert('Unfortunately, something is broken and this lesson cannot continue');
    leavePage('/home');
    return;
  }
  const setspec = rootTDF.tdfs.tutor.setspec;
  const needExpCondition = (setspec.condition && setspec.condition.length);

  let curExperimentState = await getExperimentState();
  Session.set('currentExperimentState', curExperimentState);
  const newExperimentState = JSON.parse(JSON.stringify(curExperimentState));

  // We must always check for experiment condition
  if (needExpCondition) {
    clientConsole(2, 'Experimental condition is required: searching');
    const prevCondition = curExperimentState.conditionTdfId;

    let conditionTdfId = null;

    if (prevCondition) {
      // Use previous condition and log a notification that we did so
      clientConsole(2, 'Found previous experimental condition: using that');
      conditionTdfId = prevCondition;
    } else {
      if(!setspec.loadbalancing){
        // Select condition and save it
        clientConsole(2, 'No previous experimental condition: Selecting from ' + setspec.condition.length);
        const randomConditionFileName =  _.sample(setspec.condition)
        let conditionTdf = Tdfs.findOne({"content.fileName": randomConditionFileName});
        if (!conditionTdf) {
          clientConsole(1, 'Condition TDF not found in client collection, fetching from server:', randomConditionFileName);
          conditionTdf = await meteorCallAsync('getTdfByFileName', randomConditionFileName);
          if (!conditionTdf) {
            clientConsole(1, 'Could not find condition TDF:', randomConditionFileName);
            alert('Unfortunately, the experiment condition TDF could not be found. Please contact your administrator.');
            leavePage('/home');
            return;
          }
        }
        conditionTdfId = conditionTdf._id;
        newExperimentState.conditionTdfId = conditionTdfId;
        newExperimentState.conditionNote = 'Selected from ' + _.display(setspec.condition.length) + ' conditions';
        clientConsole(2, 'Exp Condition', conditionTdfId, newExperimentState.conditionNote);
      } else {
        let conditionCounts = rootTDFBoxed.conditionCounts;
        if(setspec.loadbalancing == "max"){
          //we check the conditionCounts and select randomly from the conditions with a count less than the max
          let max = 0;
          let maxConditions = [];
          for(const condition in setspec.condition){
            if(conditionCounts[condition] > max){
              max = conditionCounts[condition];
            }
          }
          for(const condition in setspec.condition){
            if(conditionCounts[condition] < max){
              maxConditions.push(setspec.condition[condition]);
            }
          }
          //if the maxConditions array is empty, we select randomly from all conditions
          if(maxConditions.length == 0){
            maxConditions = setspec.condition;
          }
          const randomConditionFileName =  _.sample(maxConditions)
          let conditionTdf = Tdfs.findOne({"content.fileName": randomConditionFileName});
          if (!conditionTdf) {
            clientConsole(1, 'Condition TDF not found in client collection, fetching from server:', randomConditionFileName);
            conditionTdf = await meteorCallAsync('getTdfByFileName', randomConditionFileName);
            if (!conditionTdf) {
              clientConsole(1, 'Could not find condition TDF:', randomConditionFileName);
              alert('Unfortunately, the experiment condition TDF could not be found. Please contact your administrator.');
              leavePage('/home');
              return;
            }
          }
          conditionTdfId = conditionTdf._id;
        } else if(setspec.loadbalancing == "min"){
          //we check the conditionCounts and select randomly from the conditions with a count equal to the min
          let min = 1000000000;
          let minConditions = [];
          for(const condition in setspec.condition){
            if(conditionCounts[condition] < min){
              min = conditionCounts[condition];
            }
          }
          for(const condition in setspec.condition){
            if(conditionCounts[condition] == min){
              minConditions.push(setspec.condition[condition]);
            }
          }
          //if the minConditions array is empty, we select randomly from all conditions
          if(minConditions.length == 0){
            minConditions = setspec.condition;
          }
          const randomConditionFileName =  _.sample(minConditions)
          conditionTdf = Tdfs.findOne({"content.fileName": randomConditionFileName});
          if (!conditionTdf) {
            clientConsole(1, 'Condition TDF not found in client collection, fetching from server:', randomConditionFileName);
            conditionTdf = await meteorCallAsync('getTdfByFileName', randomConditionFileName);
            if (!conditionTdf) {
              clientConsole(1, 'Could not find condition TDF:', randomConditionFileName);
              alert('Unfortunately, the experiment condition TDF could not be found. Please contact your administrator.');
              leavePage('/home');
              return;
            }
          }
          conditionTdfId = conditionTdf._id;
          clientConsole(2, 'conditionTdf, conditionTdfId', conditionTdf, conditionTdf._id);
      } else {
        clientConsole(2, 'Invalid loadbalancing parameter');
        alert('Unfortunately, something is broken and this lesson cannot continue');
        leavePage('/home');
        return;
      }
    }
    if (setspec.countcompletion == "beginning") {
      //reload the conditionCounts from the rootTDF
      rootTDFBoxed = Tdfs.findOne({_id: Session.get('currentRootTdfId')});
      const conditionCounts = rootTDFBoxed.conditionCounts;
      const conditions = rootTDF.tdfs.tutor.setspec.condition;
      //iterate the conditionCounts for the condition we selected
      const conditionFileName = Tdfs.findOne({_id: conditionTdfId}).content.fileName;
      for(const condition in conditions){
        if(conditions[condition] == conditionFileName){
          conditionCounts[condition] = conditionCounts[condition] + 1;
          break;
        }
      }

      await Meteor.callAsync('updateTdfConditionCounts', Session.get('currentRootTdfId'), conditionCounts);
    }

    newExperimentState.conditionTdfId = conditionTdfId;
    await updateExperimentState(newExperimentState, 'setExpCondition');
  }

    if (!conditionTdfId) {
      clientConsole(2, 'No experimental condition could be selected!');
      alert('Unfortunately, something is broken and this lesson cannot continue');
      leavePage('/home');
      return;
    } 

    // Now we have a different current TDF (but root stays the same)
    Session.set('currentTdfId', conditionTdfId);

    curTdf = Tdfs.findOne({_id: conditionTdfId});
    if (!curTdf) {
      clientConsole(1, 'Condition TDF not found by ID in client collection, fetching from server:', conditionTdfId);
      curTdf = await meteorCallAsync('getTdfById', conditionTdfId);
      if (!curTdf) {
        clientConsole(1, 'Could not find condition TDF by ID:', conditionTdfId);
        alert('Unfortunately, the experiment condition TDF could not be loaded. Please contact your administrator.');
        leavePage('/home');
        return;
      }
    }
    Session.set('currentTdfFile', curTdf.content);
    Session.set('currentTdfName', curTdf.content.fileName);

    // Read new stimulus file (exception allowed to kill if current tdf broken with no stimulus file)
    Session.set('currentStimuliSetId', curTdf.stimuliSetId);
    clientConsole(2, 'condition stimuliSetId', curTdf);
  } else {
    //if currentTdfFile is not set, we are resuming from a previous state and need to set it
    if(!Session.get('currentTdfFile')){
      Session.set('currentTdfFile', rootTDF);
      Session.set('currentTdfName', rootTDF.fileName);
      Session.set('currentTdfId', Session.get('currentRootTdfId'));
      Session.set('currentStimuliSetId', rootTDFBoxed.stimuliSetId);
    } 
    
    // Just notify that we're skipping
    clientConsole(2, 'No Experimental condition is required: continuing', rootTDFBoxed);
  }

  if(curTdf.content.tdfs.tutor.setspec.unitTemplate){
    //tdf has dynamic units. need to check component state for current unit
    if(curExperimentState.currentTdfFile){
      curTdf.content = curExperimentState.currentTdfFile;
      //found dynamic tdf units
      Session.set('currentTdfFile', curTdf.content);
      Session.set('currentTdfName', curTdf.content.fileName);

      // Read new stimulus file (exception allowed to kill if current tdf broken with no stimulus file)
      Session.set('currentStimuliSetId', curTdf.stimuliSetId);
      clientConsole(2, 'condition stimuliSetId', curTdf);
    }
  }

  const stimuliSet = curTdf.stimuli

  Session.set('currentStimuliSet', stimuliSet);
  cardState.set('feedbackUnset', Session.get('fromInstructions') || cardState.get('feedbackUnset'));
  Session.set('fromInstructions', false);

  await preloadStimuliFiles();
  checkUserAudioConfigCompatability();

  // Root TDF can specify xcond parameter for deliveryParms is system-assigned (vs URL-specified)
  if (setspec.randomizedDelivery && setspec.randomizedDelivery.length) {
    clientConsole(2, 'xcond for delivery params is sys assigned: searching');
    const prevExperimentXCond = curExperimentState.experimentXCond;

    let experimentXCond;

    if (prevExperimentXCond) {
      // Found it!
      clientConsole(2, 'Found previous xcond for delivery');
      experimentXCond = prevExperimentXCond;
    } else {
      // Not present - we need to select one
      clientConsole(2, 'NO previous xcond for delivery - selecting one');
      const xcondCount = _.intval(_.first(setspec.randomizedDelivery));
      experimentXCond = Math.floor(Math.random() * xcondCount);
      newExperimentState.experimentXCond = experimentXCond;
    }

    clientConsole(2, 'Setting XCond from sys-selection', experimentXCond);
    Session.set('experimentXCond', experimentXCond);
  }

  // Find or create cluster mapping (must wait until exp condition selected for correct TDF)
  const stimCount = getStimCount();
  let clusterMapping = curExperimentState.clusterMapping;
  if (!clusterMapping) {
    // No cluster mapping - create it by processing shuffle/swap pairs and store for resume
    const setSpec = Session.get('currentTdfFile').tdfs.tutor.setspec;

    // Default single no-op to ensure at least build default cluster mapping
    const shuffles = setSpec.shuffleclusters ? setSpec.shuffleclusters.trim().split(" ") : [''];
    const swaps = setSpec.swapclusters ? setSpec.swapclusters.trim().split(" ") : [''];
    clusterMapping = [];
    clientConsole(2, 'shuffles.length', shuffles.length);
    clientConsole(2, 'swaps.length', swaps.length);
    clusterMapping = createStimClusterMapping(stimCount, shuffles || [], swaps || [], clusterMapping)
    newExperimentState.clusterMapping = clusterMapping;
    clientConsole(2, 'Cluster mapping created', clusterMapping);
  } else {
    // Found the cluster mapping record - extract the embedded mapping
    clientConsole(2, 'Cluster mapping found', clusterMapping);
  }

  if (!clusterMapping || !clusterMapping.length || clusterMapping.length !== stimCount) {
    clientConsole(2, 'Invalid cluster mapping', stimCount, clusterMapping);
    throw new Error('The cluster mapping is invalid - can not continue');
  }
  // Go ahead and save the cluster mapping we found/created
  Session.set('clusterMapping', clusterMapping);

  if (curExperimentState.currentUnitNumber) {
    Session.set('currentUnitNumber', curExperimentState.currentUnitNumber);
  } else {
    Session.set('currentUnitNumber', 0);
    newExperimentState.currentUnitNumber = 0;
    newExperimentState.lastUnitStarted = 0; 
  }

  //if this unit number is greater than the number of units in the tdf, we need to send the user to the profile page
  if(curExperimentState.currentUnitNumber > curTdf.content.tdfs.tutor.unit.length - 1){
    alert('You have completed all the units in this lesson.');
    leavePage('/home');
  }

  const curTdfUnit = curTdf.content.tdfs.tutor.unit[Session.get('currentUnitNumber')];
  if (curTdfUnit.videosession) { 
    Session.set('isVideoSession', true)
    clientConsole(2, 'video type questions detected, pre-loading video');
    preloadVideos();
  } else
    Session.set('isVideoSession', false)
  Session.set('currentTdfUnit', curTdfUnit);
  clientConsole(2, 'resume, currentTdfUnit:', curTdfUnit);

  if (curExperimentState.questionIndex) {
    Session.set('questionIndex', curExperimentState.questionIndex);
  } else {
    Session.set('questionIndex', 0);
    newExperimentState.questionIndex = 0;
  }

  await updateExperimentState(newExperimentState, 'card.resumeFromComponentState');

  // Custom UI settings from TDF setspec (unit and individual question can override)
  const curTdfUISettings = rootTDF.tdfs.tutor.setspec.uiSettings ? rootTDF.tdfs.tutor.setspec.uiSettings : false;
  const curUnitUISettions = curTdfUnit.uiSettings ? curTdfUnit.uiSettings : false;
  
  //show which settings are being used
  if(curTdfUISettings){
    clientConsole(2, 'using tdf ui settings')
  } else if(curUnitUISettions){
    clientConsole(2, 'using unit ui settings')
  } else {
    clientConsole(2, 'using default ui settings')
  }
  // priority is card, then unit, then tdf. 
  var UIsettings = curUnitUISettions || curTdfUISettings || false;

  const displayPresets = {
    default:{
      "displayReviewTimeoutAsBarOrText": "false",
      "displayReadyPromptTimeoutAsBarOrText": "false",
      "displayCardTimeoutAsBarOrText": false,
      "displayTimeOutDuringStudy": true,
      "displayUserAnswerInFeedback": "onIncorrect",
      "displayPerformanceDuringStudy": false,
      "displayPerformanceDuringTrial": true,
      "displayCorrectAnswerInCenter": false,
      "singleLineFeedback" : false,
      "feedbackDisplayPosition" : "middle",
      "stimuliPosition" : "top",
      "choiceButtonCols": 1,
      "onlyShowSimpleFeedback": "onCorrect",
      "suppressFeedbackDisplay": false,
      "incorrectColor": "darkorange",
      "correctColor": "green",
      'instructionsTitleDisplay': "headerOnly",
      'displayConfirmButton': false,
      'continueButtonText': "Continue",
      'lastVideoModalText': "This is the last video, do not progress unless finished with this lesson.",
      'skipStudyButtonText': "Skip",
      'inputPlaceholderText': "Type your answer here...",
      'showStimuliBox': true,
      'stimuliBoxColor': 'alert-bg', // Can be Bootstrap class (alert-primary) or color (#ff0000, red, etc.)
    },
  }
  // Interpret stimulus and input position settings to set column widths (4 combinations: top/bottom, left/right)
  

  // If curTdfUISettings is string, check if preset - otherwise treat as object and fill missing keys with defaults
  if(UIsettings){
    if(typeof UIsettings === 'string'){
      if(displayPresets[UIsettings]){
       UIsettings = displayPresets[UIsettings]
      } else {
        UIsettings = displayPresets['default']
      }
    } else {
      //fill in the missing keys with the default values
      for(const key in displayPresets['default']){
        if(!UIsettings.hasOwnProperty(key)){
          UIsettings[key] = displayPresets['default'][key]
        }
      }
    }
  } else {
    UIsettings = displayPresets['default']
  }
  //get if the current card is a button trial
  switch(UIsettings.stimuliPosition){
    case 'top':
      UIsettings.choiceColWidth = 'col-12';
      UIsettings.displayColWidth = 'col-12';
      UIsettings.textInputDisplay = "";
      UIsettings.textInputDisplay2 = "";
      break;
    case 'left':
      UIsettings.choiceColWidth = 'col-6';
      UIsettings.displayColWidth = 'col-6';
      UIsettings.textInputDisplay = "justify-content-end";
      UIsettings.textInputDisplay2 = "justify-content-start";
  }
  //convert UIsettings.simplefeedbackOnCorrect to string
  if(UIsettings.simplefeedbackOnCorrect){
    UIsettings.simplefeedbackOnCorrect = "true";
  } else {
    UIsettings.simplefeedbackOnCorrect = "false";
  }
  
  //convert UIsettings.simplefeedbackOnIncorrect to string
  if(UIsettings.simplefeedbackOnIncorrect){
    UIsettings.simplefeedbackOnIncorrect = "true";
  } else {
    UIsettings.simplefeedbackOnIncorrect = "false";
  }

  //switch for simple feedback
  if(UIsettings.onlyShowSimpleFeedback == "onCorrect"){
    UIsettings.simplefeedbackOnCorrect = true;
    UIsettings.simplefeedbackOnIncorrect = false;
  } else if(UIsettings.onlyShowSimpleFeedback == "onIncorrect"){
    UIsettings.simplefeedbackOnCorrect = false;
    UIsettings.simplefeedbackOnIncorrect = true;
  } else if(UIsettings.onlyShowSimpleFeedback || UIsettings.onlyShowSimpleFeedback == "true"){
    UIsettings.simplefeedbackOnCorrect = true;
    UIsettings.simplefeedbackOnIncorrect = true;
  } else if(!UIsettings.onlyShowSimpleFeedback || UIsettings.onlyShowSimpleFeedback == "false"){
    UIsettings.simplefeedbackOnCorrect = false;
    UIsettings.simplefeedbackOnIncorrect = false;
  }

  //switch for displayUserAnswerInFeedback
  if(UIsettings.displayUserAnswerInFeedback == "onCorrect"){
    UIsettings.displayUserAnswerInCorrectFeedback = true;
    UIsettings.displayUserAnswerInIncorrectFeedback = false;
  } else if(UIsettings.displayUserAnswerInFeedback == "onIncorrect"){
    UIsettings.displayUserAnswerInCorrectFeedback = false;
    UIsettings.displayUserAnswerInIncorrectFeedback = true;
  } else if(UIsettings.displayUserAnswerInFeedback || UIsettings.displayUserAnswerInFeedback == "true"){
    UIsettings.displayUserAnswerInCorrectFeedback = true;
    UIsettings.displayUserAnswerInIncorrectFeedback = true;
  } else if(!UIsettings.displayUserAnswerInFeedback || UIsettings.displayUserAnswerInFeedback == "false"){
    UIsettings.displayUserAnswerInCorrectFeedback = false;
    UIsettings.displayUserAnswerInIncorrectFeedback = false;
  }

  //switch for displayInstructionsTitle
  if(UIsettings.instructionsTitleDisplay == "headerOnly"){
    UIsettings.displayInstructionsTitle = true;
    UIsettings.displayUnitNameInInstructions = false;
  } else if(UIsettings.instructionsTitleDisplay == true) {
    UIsettings.displayInstructionsTitle = true;
    UIsettings.displayUnitNameInInstructions = true;
  } else if(UIsettings.instructionsTitleDisplay == false){
    UIsettings.displayInstructionsTitle = false;
    UIsettings.displayUnitNameInInstructions = false;
  }

  Session.set('curTdfUISettings', UIsettings);


  // curTdfUISettings object logging removed (too large)

  if (cardState.get('feedbackUnset')){
    getFeedbackParameters();
    cardState.set('feedbackUnset', false);
  }
  
  // Always log condition data, then call processUserTimesLog after server returns
  if(!cardState.get('displayFeedback')){
    processUserTimesLog();
  }
}


async function getFeedbackParameters(){
  if(Session.get('currentDeliveryParams').allowFeedbackTypeSelect){
    cardState.set('displayFeedback',true);
  } 
}

async function removeCardByUser() {
  Meteor.clearTimeout(cardState.get('CurTimeoutId'));
  Meteor.clearInterval(cardState.get('CurIntervalId'));
  cardState.set('CurTimeoutId', undefined);
  cardState.set('CurIntervalId', undefined);
  $('#CountdownTimer').text('');
  $('#removalFeedback').removeAttr('hidden');

  let clusterIndex = Session.get('clusterIndex');
  let stims = getStimCluster(clusterIndex).stims; 
  let whichStim = engine.findCurrentCardInfo().whichStim;
  const userId = Meteor.userId();
  const tdfId = Session.get('currentTdfId');
  Meteor.callAsync('insertHiddenItem', userId, stims[whichStim].stimulusKC, tdfId)
  let hiddenItems = Session.get('hiddenItems');
  hiddenItems.push(stims[whichStim].stimulusKC);
  
  cardState.set('numVisibleCards', cardState.get('numVisibleCards') - 1);
  Session.set('hiddenItems', hiddenItems);
}

async function processUserTimesLog() {
// Get TDF info
  const tdfFile = Session.get('currentTdfFile');
  const curExperimentState = Session.get('currentExperimentState');
  clientConsole(2, 'tdfFile', tdfFile);

  Session.set('overallOutcomeHistory', curExperimentState.overallOutcomeHistory || []);

  Session.set('schedule', curExperimentState.schedule);
  Session.set('currentUnitStartTime', Date.now());

  // shufIndex is mapped, clusterIndex is raw
  if(typeof curExperimentState.shufIndex !== "undefined"){
      Session.set('clusterIndex', curExperimentState.shufIndex);
  } else {
      Session.set('clusterIndex', curExperimentState.clusterIndex);  
  } 
  Session.set('clozeQuestionParts', curExperimentState.clozeQuestionParts || undefined);
  Session.set('testType', curExperimentState.testType);
  cardState.set('originalQuestion', curExperimentState.originalQuestion);
  cardState.set('currentAnswer', curExperimentState.currentAnswer);
  Session.set('subTdfIndex', curExperimentState.subTdfIndex);
  cardState.set('alternateDisplayIndex', curExperimentState.alternateDisplayIndex);

  cardState.set('currentDisplay', undefined);

  let resumeToQuestion = false;

  // prepareCard handles new unit instructions but misses first unit instructions
  let needFirstUnitInstructions = !Session.get('curUnitInstructionsSeen'); 

  // Possible clicked Continue on final unit - need to act as if done
  let moduleCompleted = false;

  // Reset current engine
  async function resetEngine(curUnitNum) {
    const curExperimentData = {
      cachedSyllables,
      curExperimentState,
    };

    if (tdfFile.tdfs.tutor.unit[curUnitNum].assessmentsession) {
      engine = await createScheduleUnit(curExperimentData);
      Session.set('unitType', 'schedule')
    } else if (tdfFile.tdfs.tutor.unit[curUnitNum].learningsession || tdfFile.tdfs.tutor.unit[curUnitNum].videosession) {
      engine = await createModelUnit(curExperimentData);
      Session.set('unitType', 'model')
    } else {
      engine = await createEmptyUnit(curExperimentData); // used for instructional units
      Session.set('unitType', undefined)
    }
    window.engine = engine;
  }
  clearScrollList();

  const newExperimentState = {};
  const newUnitNum = curExperimentState.currentUnitNumber;
  const checkUnit = Session.get('currentUnitNumber');
  const lastUnitCompleted = curExperimentState.lastUnitCompleted;

  switch (curExperimentState.lastAction) {
    case 'instructions':
      needFirstUnitInstructions = false;
      break;
    case 'unit-end':
      // Logged unit completion - if final unit, also know TDF completed
      if ((!!newUnitNum && !!checkUnit) && checkUnit === newUnitNum) {
        if (lastUnitCompleted >= tdfFile.tdfs.tutor.unit.length) {
          moduleCompleted = true; // TODO: what do we do for multiTdfs? Depends on structure of template parentTdf
        }
      } else {
        needFirstUnitInstructions = tdfFile.tdfs.tutor.unit && tdfFile.tdfs.tutor.unit.unitinstructions;
      }
      break;
      // Commented out: case 'schedule': break;
    case 'question':
      resumeToQuestion = true;
      break;
    case 'answer':
    case '[timeout]':
      // TODO: resumeToQuestion = true; writeCurrentToScrollList(entry.answer, action === '[timeout]', simCorrect, 0); - restore scroll list state
      break;
  }

  if (moduleCompleted) {
    // They are DONE!determineUserFeedback
    clientConsole(2, 'TDF already completed - leaving for profile page.');
    if (Meteor.user().loginParams.loginMode === 'experiment') {
      // Experiment users don't *have* a normal page
      leavePage(routeToSignin);
    } else {
      // "Normal" user - they just go back to their root page
      leavePage('/home');
    }
  } else {
    await resetEngine(Session.get('currentUnitNumber'));
    newExperimentState.unitType = engine.unitType;
    newExperimentState.TDFId = Session.get('currentTdfId');

    // Depends on unitType being set in initialized unit engine
    Session.set('currentDeliveryParams', getCurrentDeliveryParams());
    cardState.set('scoringEnabled', Session.get('currentDeliveryParams').scoringEnabled);

    await updateExperimentState(newExperimentState, 'card.processUserTimesLog');
    await engine.loadComponentStates();

    // If reached here, no resume needed until something else happens

    Session.set('inResume', false);

    // Initialize client side student performance
    const curUser = Meteor.user();
    const currentTdfId = Session.get('currentTdfId');
    const curTdf = Session.get('currentTdfFile');
    const curTdfUnit = curTdf.tdfs.tutor.unit[Session.get('currentUnitNumber')];
    await setStudentPerformance(curUser._id, curUser.username, currentTdfId);
    
    if(Session.get('isVideoSession')){
      let indices = Session.get('engineIndices');
      if(!indices){
        indices = {
          'clusterIndex': 0,
          'stimIndex': 0
        }
      }
      Session.set('engineIndices', indices);
      if(Session.get("currentUnitNumber") + 1 == Session.get("currentTdfFile").tdfs.tutor.unit.length){
        $('#lastUnitModal').modal('show');
        return;
      } else {
        await initializePlyr();
      }
    } else if (resumeToQuestion) {
      // FIX: Question outstanding - go through proper cleanup/transitions before display (was calling newQuestionHandler directly, bypassing state machine)
      clientConsole(2, 'RESUME FINISHED: preparing and displaying current question');
      await prepareCard(true); // isResume=true skips selectNextCard, but still does cleanup
    } else if (needFirstUnitInstructions && typeof curTdfUnit.unitinstructions !== 'undefined') {
      // They haven't seen our first instruction yet
      clientConsole(2, 'RESUME FINISHED: displaying initial instructions');
      leavePage('/instructions');
    } else {
      // If unit engine thinks finished, might need instructions IF lockout period hasn't finished (prepareCard won't handle)
      if (await engine.unitFinished()) {
        let lockoutMins = Session.get('currentDeliveryParams').lockoutminutes;
        user = Meteor.user();
        isAdmin = Roles.userIsInRoleAsync(user, 'admin');
        if (lockoutMins > 0 &&  !isAdmin) {
          let unitStartTimestamp = Session.get('currentUnitStartTime');
          if(Meteor.user().lockouts && Meteor.user().lockouts[Session.get('currentTdfId')] && 
          Meteor.user().lockouts[Session.get('currentTdfId')].currentLockoutUnit == Session.get('currentUnitNumber')){
            unitStartTimestamp = Meteor.user().lockouts[Session.get('currentTdfId')].lockoutTimeStamp;
            lockoutMins = Meteor.user().lockouts[Session.get('currentTdfId')].lockoutMinutes;
          }
          lockoutFreeTime = unitStartTimestamp + (lockoutMins * (60 * 1000)); // minutes to ms
          if (Date.now() < lockoutFreeTime && (typeof curTdfUnit.unitinstructions !== 'undefined') ){
            clientConsole(2, 'RESUME FINISHED: showing lockout instructions');
            leavePage('/instructions');
            return;
          }
        }
      }
      clientConsole(2, 'RESUME FINISHED: next-question logic to commence');

      if(Session.get('unitType') == "model")
        Session.set('engineIndices', await engine.calculateIndices());
      else
        Session.set('engineIndices', undefined);
      await prepareCard();
    }
    }
  }
