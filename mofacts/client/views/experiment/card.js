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
import {meteorCallAsync, redoCardImage} from '../../index';
import {DialogueUtils, dialogueContinue, dialogueLoop, initiateDialogue} from './dialogueUtils';
import {SCHEDULE_UNIT, ENTER_KEY} from '../../../common/Definitions';
import {secsIntervalString, displayify, stringifyIfExists} from '../../../common/globalHelpers';
import {routeToSignin} from '../../lib/router';
import {createScheduleUnit, createModelUnit, createEmptyUnit} from './unitEngine';
import {Answers} from './answerAssess';
import {sessionCleanUp} from '../../lib/sessionUtils';
import {checkUserSession} from '../../index'
import {instructContinue, unitHasLockout, checkForFileImage} from './instructions';

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
};

/*
* card.js - the implementation behind card.html (and thus
the main GUI implementation for MoFaCTS).

There is quite a bit of logic in this file, but most of it is commented locally.
One note to keep in mind that much of the direct access to the TDF and Stim
files has been abstracted out to places like currentTestingHelpers.js

This is important because that abstraction is used to do things like support
multiple deliveryParam (the x-condition logic) and centralize some of the
checks that we do to make sure everything is functioning correctly.


Timeout logic overview
------------------------

Currently we use the appropriate deliveryparams section. For scheduled trials
we use the deliveryparams of the current unit. Note that "x-conditions" can be
used to select from multiple deliveryparams in any unit.

All timeouts are specified in milliseconds and should be at least one (1).

There are two settings that correspond to what most people think of as the
"trial timeout". That is the amount of time that may elapse from the beginning
of a trial before the user runs out of time to answer (see the function
startQuestionTimeout):

purestudy - The amount of time a "study" trial is displayed

drill     - The amount of time a user has to answer a drill or test trial

There are two "timeouts" that are used after the user has answered (see
the function handleUserInput):

reviewstudy   - If a user answers a drill trial incorrectly, the correct
                answer is displayed for this long

correctprompt - If a user gets a drill trial correct, the amount of time
                the feedback message is shown

Note that if the trial is "test", feedback is show for neither correct nor
incorrect responses.

Some TDF's contain legacy timeouts. For instance,
timebeforefeedback is not currently implemented.


Simulation Overview
----------------------

If the current user is an admin or teacher, they may check the "Simulate if
TDF param present?" checkbox on the profile screen (located above the buttons
for the various user-visible TDF's). Doing so sets the runSimulation session
variable.

For each question displayed here, if the runSimulation session variable is
true, if the user is an admin or teacher, and if the TDF has the appropriate
parameters set then a simulation timeout will be set. When that timeout fires,
the system will simulate an answer. This behavior is controlled by the two TDF
parameters (which should be in the top-level setspec):

    * simTimeout - (integer) the number of milliseconds to wait before the
      answer is given.
    * simCorrectProb - (float) probability (0.0 < p <= 1.0) that the correct
      answer is given.

Then no simulation will take place if either parameter is:

    * Missing
    * Invalid (not interpretable as a number)
    * Less than or equal to zero


History Scrolling Overview
----------------------------

We provide scrollable history for units (it is turned off by default). To
turn it on, you need to set <showhistory>true</showhistory> in the
<deliveryparams> section of the unit where you want it on.
*/

// //////////////////////////////////////////////////////////////////////////
// Global variables and helper functions for them

let engine = null; // The unit engine for display (i.e. model or schedule)
const hark = require('../../lib/hark');
Session.set('buttonList', []);
const scrollList = new Mongo.Collection(null); // local-only - no database
Session.set('scrollListCount', 0);
Session.set('currentDeliveryParams', {});
Session.set('inResume', false);
Session.set('wasReportedForRemoval', false);
Session.set('hiddenItems', []);
Session.set('numVisibleCards', 0);
Session.set('recordingLocked', false);
let cachedSyllables = null;
let speechTranscriptionTimeoutsSeen = 0;
let timeoutsSeen = 0; // Reset to zero on resume or non-timeout
let trialStartTimestamp = 0;
let trialEndTimeStamp = 0;
let afterFeedbackCallbackBind = null;
Session.set('trialStartTimestamp', trialStartTimestamp);
let firstKeypressTimestamp = 0;
let currentSound = null; // See later in this file for sound functions
let userFeedbackStart = null;
let player = null;
// We need to track the name/ID for clear and reset. We need the function and
// delay used for reset
let timeoutName = null;
let timeoutFunc = null;
let timeoutDelay = null;
let simTimeoutName = null;
let countdownInterval = null;
let userAnswer = null;
let lastlogicIndex = 0;

// ===== PHASE 2: Scoped Reactive State =====
// Use ReactiveDict for card-specific state instead of global Session
// This prevents memory leaks and improves performance
const cardState = new ReactiveDict('cardState');

// Helper - return elapsed seconds since unit started. Note that this is
// technically seconds since unit RESUME began (when we set currentUnitStartTime)
function elapsedSecs() {
  return (Date.now() - Session.get('currentUnitStartTime')) / 1000.0;
}

function nextChar(c) {
  return String.fromCharCode(c.charCodeAt(0) + 1);
}

// Note that this isn't just a convenience function - it should be called
// before we route to other templates so that the timeout doesn't fire over
// and over
function clearCardTimeout() {
  const safeClear = function(clearFunc, clearParm) {
    try {
      if (clearParm) {
        clearFunc(clearParm);
      }
    } catch (e) {
      console.log('Error clearing meteor timeout/interval', e);
    }
  };
  safeClear(Meteor.clearTimeout, timeoutName);
  safeClear(Meteor.clearTimeout, simTimeoutName);
  safeClear(Meteor.clearInterval, Session.get('varLenTimeoutName'));
  safeClear(Meteor.clearInterval, countdownInterval);
  timeoutName = null;
  timeoutFunc = null;
  timeoutDelay = null;
  simTimeoutName = null;
  countdownInterval = null;
  Session.set('varLenTimeoutName', null);
}

// Start a timeout count
// Note we reverse the params for Meteor.setTimeout - makes calling code much cleaner
function beginMainCardTimeout(delay, func) {
  console.log('beginMainCardTimeout', func);
  clearCardTimeout();

  // Cache UI settings at function start
  const uiSettings = Session.get('curTdfUISettings');
  const displayMode = uiSettings.displayCardTimeoutAsBarOrText;

  timeoutFunc = function() {
    const numRemainingLocks = Session.get('pausedLocks');
    if (numRemainingLocks > 0) {
      console.log('timeout reached but there are ' + numRemainingLocks + ' locks outstanding');
    } else {
      if (document.location.pathname != '/card') {
        leavePage(function() {
          console.log('cleaning up page after nav away from card');
        });
      } else if (typeof func === 'function') {
        func();
      } else {
        console.log('function!!!: ' + JSON.stringify(func));
      }
    }
  };
  timeoutDelay = delay;
  const mainCardTimeoutStart = new Date();
  Session.set('mainCardTimeoutStart', mainCardTimeoutStart);
  console.log('mainCardTimeoutStart', mainCardTimeoutStart);
  timeoutName = Meteor.setTimeout(timeoutFunc, timeoutDelay);
  cardStartTime = Date.now();
 if(displayMode == "text" || displayMode == "both"){
  //set the countdown timer text
  $('#CountdownTimerText').removeAttr('hidden');
 } else {
   $('#CountdownTimerText').attr('hidden', '');
 }
  countdownInterval = Meteor.setInterval(function() {
    const remaining = Math.round((timeoutDelay - (Date.now() - cardStartTime)) / 1000);
    const progressbarElem = document.getElementById("progressbar");
    if (remaining <= 0) {
      Meteor.clearInterval(countdownInterval);
      countdownInterval = null;
      //reset the progress bar
      $('#progressbar').removeClass('progress-bar');
      if (progressbarElem) {
        progressbarElem.style.width = 0 + "%";
      }
      $('#lowerInteraction').html('');
    } else {
      $('#CountdownTimerText').text("Continuing in: " + secsIntervalString(remaining));
      percent = 100 - (remaining * 1000 / timeoutDelay * 100);
      if(displayMode == "bar" || displayMode == "both"){
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
    }
  }, 1000);
  Session.set('varLenTimeoutName', Meteor.setInterval(varLenDisplayTimeout, 400));
}

// Reset the previously set timeout counter
function resetMainCardTimeout() {
  console.log('RESETTING MAIN CARD TIMEOUT');
  const savedFunc = timeoutFunc;
  const savedDelay = timeoutDelay;
  clearCardTimeout();
  timeoutFunc = savedFunc;
  timeoutDelay = savedDelay;
  const mainCardTimeoutStart = new Date();
  Session.set('mainCardTimeoutStart', mainCardTimeoutStart);
  console.log('reset, mainCardTimeoutStart:', mainCardTimeoutStart);
  timeoutName = Meteor.setTimeout(savedFunc, savedDelay);
  Session.set('varLenTimeoutName', Meteor.setInterval(varLenDisplayTimeout, 400));
}

// TODO: there is a minor bug here related to not being able to truly pause on
// re-entering a tdf for the first trial
function restartMainCardTimeoutIfNecessary() {
  console.log('restartMainCardTimeoutIfNecessary');
  const mainCardTimeoutStart = Session.get('mainCardTimeoutStart');
  if (!mainCardTimeoutStart) {
    const numRemainingLocks = Session.get('pausedLocks')-1;
    Session.set('pausedLocks', numRemainingLocks);
    return;
  }
  const errorReportStart = Session.get('errorReportStart');
  Session.set('errorReportStart', null);
  const usedDelayTime = errorReportStart - mainCardTimeoutStart;
  const remainingDelay = timeoutDelay - usedDelayTime;
  timeoutDelay = remainingDelay;
  const rightNow = new Date();
  Session.set('mainCardTimeoutStart', rightNow);
  function wrappedTimeout() {
    const numRemainingLocks = Session.get('pausedLocks')-1;
    Session.set('pausedLocks', numRemainingLocks);
    if (numRemainingLocks <= 0) {
      if (timeoutFunc) timeoutFunc();
    } else {
      console.log('timeout reached but there are ' + numRemainingLocks + ' locks outstanding');
    }
  }
  timeoutName = Meteor.setTimeout(wrappedTimeout, remainingDelay);
  Session.set('varLenTimeoutName', Meteor.setInterval(varLenDisplayTimeout, 400));
}

// Set a special timeout to handle simulation if necessary
function checkSimulation() {
  if (!Session.get('runSimulation') ||
        !Roles.userIsInRole(Meteor.user(), ['admin', 'teacher'])) {
    return;
  }

  const setspec = Session.get('currentTdfFile').tdfs.tutor.setspec;

  const simTimeout = parseInt(setspec.simTimeout || 0);
  const simCorrectProb = parseFloat(setspec.simCorrectProb || 0);

  if (simTimeout <= 0 || simCorrectProb <= 0.0) {
    return;
  }

  // If we we are here, then we should set a timeout to sim a correct answer
  const correct = Math.random() <= simCorrectProb;
  console.log('SIM: will simulate response with correct=', correct, 'in', simTimeout);
  simTimeoutName = Meteor.setTimeout(function() {
    console.log('SIM: Fired!');
    simTimeoutName = null;
    handleUserInput({}, 'simulation', correct);
  }, simTimeout);
}

// Min and Max display seconds: if these are enabled, they determine
// potential messages, the continue button functionality, and may even move
// the screen forward.  This is nearly identical to the function of the same
// name in instructions.js (where we use two similar parameters)
function getDisplayTimeouts() {
  const curUnit = Session.get('currentTdfUnit');
  const session = curUnit.learningsession || null;
  return {
    'minSecs': parseInt((session ? session.displayminseconds : 0) || 0),
    'maxSecs': parseInt((session ? session.displaymaxseconds : 0) || 0),
  };
}

function setDispTimeoutText(txt) {
  let msg = _.trim(txt || '');
  if (msg.length > 0) {
    msg = ' (' + msg + ')';
  }
  $('#displayTimeoutMsg').text(msg);
}

function varLenDisplayTimeout() {
  const display = getDisplayTimeouts();
  if (!(display.minSecs > 0.0 || display.maxSecs > 0.0)) {
    // No variable display parameters - we can stop the interval
    $('#continueButton').prop('disabled', false);
    setDispTimeoutText('');
    Meteor.clearInterval(Session.get('varLenTimeoutName'));
    Session.set('varLenTimeoutName', null);
    return;
  }

  const elapsed = elapsedSecs();
  if (elapsed <= display.minSecs) {
    // Haven't reached min yet
    $('#continueButton').prop('disabled', true);
    const dispLeft = display.minSecs - elapsed;
    if (dispLeft >= 1.0) {
      setDispTimeoutText('You can continue in: ' + secsIntervalString(dispLeft));
    } else {
      setDispTimeoutText(''); // Don't display 0 secs
    }
  } else if (elapsed <= display.maxSecs) {
    // Between min and max
    $('#continueButton').prop('disabled', false);
    const dispLeft = display.maxSecs - elapsed;
    if (dispLeft >= 1.0) {
      setDispTimeoutText('Time remaining: ' + secsIntervalString(dispLeft));
    } else {
      setDispTimeoutText('');
    }
  } else if (display.maxSecs > 0.0) {
    // Past max and a max was specified - it's time to go
    $('#continueButton').prop('disabled', true);
    setDispTimeoutText('');
    unitIsFinished('DisplaMaxSecs exceeded');
  } else {
    // Past max and no valid maximum - they get a continue button
    $('#continueButton').prop('disabled', false);
    setDispTimeoutText('You can continue whenever you want');
  }
}

// Clean up things if we navigate away from this page
async function leavePage(dest) {
  console.log('leaving page for dest: ' + dest);
  if (dest != '/card' && dest != '/instructions' && document.location.pathname != '/instructions') {
    Session.set('currentExperimentState', undefined);
    console.log('resetting subtdfindex, dest: ' + dest);
    Session.set('subTdfIndex', null);
    sessionCleanUp();
    if (window.AudioContext) {
      console.log('closing audio context');
      stopRecording();
      clearAudioContextAndRelatedVariables();
    } else {
      console.log('NOT closing audio context');
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
      console.log('Instructions empty and no lockout: skipping', displayify(unit));
      instructContinue();
      return;
    }
  }
  clearCardTimeout();
  clearPlayingSound();
  if (typeof dest === 'function') {
    dest();
  } else {
    Router.go(dest);
  }
}

// ===== PHASE 2: Centralized DOM Updates =====
// Use Tracker.autorun to batch DOM updates reactively
// This prevents multiple unnecessary re-renders
Template.card.onCreated(function() {
  const template = this;

  // Autorun for feedback container visibility
  template.autorun(function() {
    const inFeedback = cardState.get('inFeedback');
    const feedbackPosition = cardState.get('feedbackPosition');

    if (inFeedback && feedbackPosition) {
      // Centralized DOM update based on reactive state
      // This runs once per state change instead of scattered throughout code
      Tracker.afterFlush(function() {
        if (feedbackPosition === 'top') {
          $('#userInteractionContainer').removeAttr('hidden');
          $('#feedbackOverrideContainer').attr('hidden', '');
        } else if (feedbackPosition === 'middle') {
          $('#feedbackOverrideContainer').removeAttr('hidden');
          $('#userInteractionContainer').attr('hidden', '');
        } else if (feedbackPosition === 'bottom') {
          $('#feedbackOverrideContainer').attr('hidden', '');
        }
      });
    }
  });

  // Initialize card state defaults
  cardState.set('inFeedback', false);
  cardState.set('feedbackPosition', null);
  cardState.set('displayReady', false);
});

Template.card.rendered = initCard;

async function initCard() {
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
  console.log('RENDERED----------------------------------------------');
  // Catch page navigation events (like pressing back button) so we can call our cleanup method
  window.onpopstate = function() {
    if (document.location.pathname == '/card') {
      leavePage('/card');
    }
  };
  Session.set('scoringEnabled', undefined);

  if (!Session.get('stimDisplayTypeMap')) {
    const stimDisplayTypeMap = await meteorCallAsync('getStimDisplayTypeMap');
    Session.set('stimDisplayTypeMap', stimDisplayTypeMap);
  }

  const audioInputEnabled = Meteor.user().audioInputMode;
  if (audioInputEnabled) {
    if (!Session.get('audioInputSensitivity')) {
      // Default to 20 in case tdf doesn't specify and we're in an experiment
      const audioInputSensitivity = parseInt(Session.get('currentTdfFile').tdfs.tutor.setspec.audioInputSensitivity) || 20;
      Session.set('audioInputSensitivity', audioInputSensitivity);
    }
  }

  const audioOutputEnabled = Session.get('enableAudioPromptAndFeedback');
  if (audioOutputEnabled) {
    if (!Session.get('audioPromptSpeakingRate')) {
      // Default to 1 in case tdf doesn't specify and we're in an experiment
      const audioPromptSpeakingRate = parseFloat(Session.get('currentTdfFile').tdfs.tutor.setspec.audioPromptSpeakingRate) || 1;
      Session.set('audioPromptSpeakingRate', audioPromptSpeakingRate);
    }
  }
  //Gets the list of hidden items from the db on load of card. 
  const hiddenItems = ComponentStates.find({componentType: 'stimulus', showItem: false}).fetch();
  Session.set('hiddenItems', hiddenItems);

  window.AudioContext = window.webkitAudioContext || window.AudioContext;
  window.URL = window.URL || window.webkitURL;
  const audioContextConfig = {
    sampleRate: 48000,
  }
  audioContext = new AudioContext(audioContextConfig);
  // If user has enabled audio input initialize web audio (this takes a bit)
  // (this will eventually call cardStart after we redirect through the voice
  // interstitial and get back here again)

  $('#userLowerInteraction').html('');

  if (audioInputEnabled) {
    initializeAudio();
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
    if (key == ENTER_KEY && !Session.get('submmissionLock')) {
      Session.set('submmissionLock', true);
    }
    handleUserInput(e, 'keypress');
  },

  'click #removeQuestion': function(e) {
    // check if the question was already reported.
    // This button only needs to fire if the user hasnt answered the question already.
    if(!Session.get('wasReportedForRemoval'))
      removeCardByUser();
      Session.set('wasReportedForRemoval', true)
      afterAnswerFeedbackCallback(Date.now(), trialStartTimestamp, 'removal', "", false, false, false);
  },

  'click #dialogueIntroExit': function() {
    dialogueContinue();
  },

  'keypress #dialogueUserAnswer': function(e) {
    const key = e.keyCode || e.which;
    if (key == ENTER_KEY) {
      if (!Session.get('enterKeyLock')) {
        Session.set('enterKeyLock', true);
        $('#dialogueUserAnswer').prop('disabled', true);
        const answer = JSON.parse(JSON.stringify(_.trim($('#dialogueUserAnswer').val()).toLowerCase()));
        $('#dialogueUserAnswer').val('');
        const dialogueContext = DialogueUtils.updateDialogueState(answer);
        console.log('getDialogFeedbackForAnswer', dialogueContext);
        Meteor.call('getDialogFeedbackForAnswer', dialogueContext, dialogueLoop);
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
    Session.set('displayFeedback', false);
    processUserTimesLog();  
  },
  'click #confirmFeedbackSelectionFromIndex': function(){
    Session.set('displayFeedback', false);
    Session.set('pausedLocks', Session.get('pausedLocks')-1);
    Session.set('resetFeedbackSettingsFromIndex', false);
  },
  'click #overlearningButton': function(event) {
    event.preventDefault();
    leavePage('/profile');
  },

  'click .multipleChoiceButton': function(event) {
    event.preventDefault();
    console.log("multipleChoiceButton clicked");
    if(!Session.get('submmissionLock')){
      if(!Session.get('curTdfUISettings').displayConfirmButton){
        Session.set('submmissionLock', true);
        handleUserInput(event, 'buttonClick');
      } else {
        console.log("multipleChoiceButton clicked (waiting for confirm)");
        //for all multipleChoiceButtons, make the selected one have class btn-selected, remove btn-selected from all others
        const selectedButton = event.currentTarget;
        console.log("selectedButton", selectedButton, "event.currentTarget", event.currentTarget);
        $('.multipleChoiceButton').each(function(){
          $(this).removeClass('btn-secondary').addClass('btn-primary');
        });
        $(selectedButton).addClass('btn-secondary');
        //enable confirmButton
        $('#confirmButton').prop('disabled', false);
      }
    }
  },
  'click #confirmButton': function(event) {
    event.preventDefault();``
    console.log("displayConfirmButton clicked");
    $('#confirmButton').hide();
    if(!Session.get('submmissionLock')){
      if(Session.get('buttonTrial')){
        const selectedButton = $('.btn-secondary, .multipleChoiceButton');
        //change this event to a buttonClick event for that button
        event.currentTarget = selectedButton;
        console.log("selectedButton", selectedButton, "event.currentTarget", event.currentTarget);
        handleUserInput(event, 'confirmButton');
      } else {
        //get user answer target element
        const userAnswer = document.getElementById('userAnswer');
        event.currentTarget = userAnswer;
        event.keyCode = ENTER_KEY;
        console.log("userAnswer", userAnswer, "event.currentTarget", event.currentTarget);
        handleUserInput(event, 'confirmButton');
      }
    }

  },
  

  'click #continueStudy': function(event) {
    event.preventDefault();
    const timeout = Session.get('CurTimeoutId')
    Session.set('CurTimeoutId', undefined)
    Meteor.clearTimeout(timeout)
    afterFeedbackCallbackBind();
    engine.updatePracticeTime(Date.now() - Session.get('trialEndTimeStamp'))
  },

  'click .instructModalDismiss': function(event) {
    event.preventDefault();
    $('#finalInstructionsDlg').modal('hide');
    if (Meteor.user().loginParams.loginMode === 'experiment') {
      // Experiment user - no where to go?
      leavePage(routeToSignin);
    } else {
      // "regular" logged-in user - go back to home page
      leavePage('/profile');
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

  'isNotInDialogueLoopStageIntroOrExit': () => Session.get('dialogueLoopStage') != 'intro' && Session.get('dialogueLoopStage') != 'exit',

  'voiceTranscriptionImgSrc': function() {
    if(Session.get('recording')){
      //Change graphic path;
      return 'images/mic_on.png';
    } else {
      //Change graphic path;
      return 'images/mic_off.png';
    }
    
  }, 
  'isImpersonating': function(){
    return Meteor.user() ? Meteor.user().profile.impersonating : false;
  },

  'voiceTranscriptionPromptMsg': function() {
    if(!Session.get('recording')){
      if(Session.get('buttonTrial')){
        return 'Let me select that.';
      } else {
        if(Session.get('recordingLocked')){
          return 'I am waiting for audio to finish. Please do not speak until I am ready.';
        } else {
        return 'Let me transcribe that.';
      }}
    } else {
      return 'I am listening.';
    }
  },

  'displayFeedback': () => Session.get('displayFeedback') && Session.get('currentDeliveryParams').allowFeedbackTypeSelect,

  'resetFeedbackSettingsFromIndex': () => Session.get('resetFeedbackSettingsFromIndex'),

  'username': function() {
    if (!haveMeteorUser()) {
      console.log('!haveMeteorUser');
      leavePage(routeToSignin);
    } else {
      return Meteor.user().username;
    }
  },

  'ReviewStudyCountdown': () => Session.get('ReviewStudyCountdown'),

  'subWordClozeCurrentQuestionExists': function() {
    const experimentState = Session.get('currentExperimentState');
    console.log('subWordClozeCurrentQuestionExists: ' + (typeof(experimentState.clozeQuestionParts) != 'undefined'));
    return typeof(experimentState.clozeQuestionParts) != 'undefined' && experimentState.clozeQuestionParts !== null;
  },

  // For now we're going to assume syllable hints are contiguous. TODO: make this more generalizable
  'subWordParts': function() {
    const experimentState = Session.get('currentExperimentState');
    return experimentState.clozeQuestionParts || undefined;
  },

  'ifClozeDisplayTextExists': function (){
    const currentDisplay = Session.get('currentDisplay');
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
    const currentDisplay = Session.get('currentDisplay');
    return currentDisplay ? currentDisplay.clozeText : undefined;
  },

  'text': function() {
    const currentDisplay = Session.get('currentDisplay');
    return currentDisplay ? currentDisplay.text : undefined;
  },

  'videoUnitDisplayText': function() {
    const curUnit = Session.get('currentTdfUnit');
    return curUnit.videosession.displayText;
  },

  'dialogueText': function() {
    const text = Session.get('dialogueDisplay') ? Session.get('dialogueDisplay').text : undefined;
    return text
  },

  'curImgSrc': function() {
    const currentDisplay = Session.get('currentDisplay');
    const curImgSrc = currentDisplay ? currentDisplay.imgSrc : undefined;
    console.log('curImgSrc helper - curImgSrc:', curImgSrc);
    console.log('curImgSrc helper - imagesDict has key?', curImgSrc && imagesDict[curImgSrc] !== undefined);
    console.log('curImgSrc helper - imagesDict:', Object.keys(imagesDict));
    if (curImgSrc && imagesDict[curImgSrc]) {
      console.log('curImgSrc helper - returning:', imagesDict[curImgSrc].src);
      return imagesDict[curImgSrc].src;
    } else {
      console.log('curImgSrc helper - returning empty string');
      return '';
    }
  },

  'curImgWidth': function() {
    const currentDisplay = Session.get('currentDisplay');
    const curImgSrc = currentDisplay ? currentDisplay.imgSrc : undefined;
    if (curImgSrc && imagesDict[curImgSrc]) {
      return imagesDict[curImgSrc].naturalWidth || '';
    }
    return '';
  },

  'curImgHeight': function() {
    const currentDisplay = Session.get('currentDisplay');
    const curImgSrc = currentDisplay ? currentDisplay.imgSrc : undefined;
    if (curImgSrc && imagesDict[curImgSrc]) {
      return imagesDict[curImgSrc].naturalHeight || '';
    }
    return '';
  },

  'curVideoSrc': function() {
    const currentDisplay = Session.get('currentDisplay');
    return currentDisplay ? currentDisplay.videoSrc : undefined;
  },

  'displayAnswer': function() {
    return Answers.getDisplayAnswerText(Session.get('currentAnswer'));
  },

  'rawAnswer': ()=> Session.get('currentAnswer'),

  'currentProgress': () => Session.get('questionIndex'),

  'displayReady': function() {
    return Session.get('displayReady');
  },

  'readyPromptString': () => Session.get('currentDeliveryParams').readyPromptString,

  'displayReadyPromptString': function() {
    const deliveryParams = Session.get('currentDeliveryParams');
    return !Session.get('displayReady') && deliveryParams.readyPromptString
  },

  'isDevelopment': () => Meteor.isDevelopment,

  'displayReadyConverter': function(displayReady) {
    return displayReady ? '' : 'none';
  },

  'textCard': function() {
    const currentDisplay = Session.get('currentDisplay');
    return !!currentDisplay && !!currentDisplay.text;
  },

  'audioCard': function() {
    const currentDisplay = Session.get('currentDisplay');
    return !!currentDisplay && !!currentDisplay.audioSrc;
  },

  'speakerCardPosition': function() {
    //centers the speaker icon if there are no displays.
    const currentDisplay = Session.get('currentDisplay');
    if(currentDisplay &&
        !currentDisplay.imgSrc &&
        !currentDisplay.videoSrc &&
        !currentDisplay.clozeText &&
        !currentDisplay.text)
      return `col-md-12 text-center`;
    return `col-md-1`
  },

  'imageCard': function() {
    const currentDisplay = Session.get('currentDisplay');
    return !!currentDisplay && !!currentDisplay.imgSrc;
  },

  'videoCard': function() {
    const currentDisplay = Session.get('currentDisplay');
    return !!currentDisplay && !!currentDisplay.videoSrc;
  },

  'clozeCard': function() {
    const currentDisplay = Session.get('currentDisplay');
    return !!currentDisplay && !!currentDisplay.clozeText;
  },

  'textOrClozeCard': function() {
    const currentDisplay = Session.get('currentDisplay');
    return !!currentDisplay &&
      (!!currentDisplay.text || !!currentDisplay.clozeText);
  },

  'anythingButAudioCard': function() {
    const currentDisplay = Session.get('currentDisplay');
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
    return (Session.get('isVideoSession') && Session.get('videoSource') && Session.get('videoSource').includes('http'))
  },

  'videoId': function() {
    return Session.get('videoSource')
  },

  'videoSource': function() {
    return Session.get('isVideoSession') && Session.get('videoSource') ? Session.get('videoSource') : '';
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
    const hSize = params && params.fontsize ? params.fontsize.toString() : '2';
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

  'buttonTrial': () => Session.get('buttonTrial'),

  'inFeedback': () => cardState.get('inFeedback'),

  'notButtonTrialOrInDialogueLoop': () => !Session.get('buttonTrial') || DialogueUtils.isUserInDialogueLoop(),

  'buttonList': function() {
    return Session.get('buttonList');
  },

  'buttonListImageRows': function() {
    const items = Session.get('buttonList');
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
    return _.intval(Session.get('scrollListCount')) > 0;
  },

  'scrollList': function() {
    return scrollList.find({'temp': 1, 'justAdded': 0}, {sort: {idx: 1}});
  },

  'currentScore': () => Session.get('currentScore'),

  'haveDispTimeout': function() {
    const disp = getDisplayTimeouts();
    return (disp.minSecs > 0 || disp.maxSecs > 0);
  },

  'userInDiaglogue': () => Session.get('showDialogueText') && Session.get('dialogueDisplay'),

  'audioEnabled': () => Meteor.user().audioInputMode,

  'showDialogueHints': function() {
    if(Meteor.isDevelopment){
      return true;
    }
    return Session.get('showDialogueHints')
  },

  'dialogueCacheHint': () => Session.get('dialogueCacheHint'),

  'questionIsRemovable': () => Session.get('numVisibleCards') > 3 && Session.get('currentDeliveryParams').allowstimulusdropping,

  'debugParms': () => Session.get('debugParms'),

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
    console.log("probability parms input",probParms);
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

  // ============================================================
  // TEMPLATE OPTIMIZATION HELPERS
  // These helpers flatten deeply nested conditionals and replace
  // inline class logic to improve template readability
  // ============================================================

  /**
   * Checks if sub-word cloze should be displayed
   * Replaces 6-level deep conditional nesting
   */
  'shouldShowSubWordCloze': function() {
    // Check trial type
    const type = getTestType();
    const trial = type === 'd' || type === 's' || type === 'f' || type === 't' || type === 'm' || type === 'n' || type === 'i';

    // Check anythingButAudioCard
    const currentDisplay = Session.get('currentDisplay');
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
    const currentDisplay = Session.get('currentDisplay');
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

// TRANSITION TIMING CONFIGURATION
// IMPORTANT: Keep in sync with CSS transition durations in classic.css
// Based on UX research: 200-300ms is optimal for smooth web transitions
// 100ms is too fast to be smooth but too slow to be imperceptible
const TRANSITION_CONFIG = {
  FADE_DURATION_MS: 200,  // Must match #trialContentWrapper transition (0.2s = 200ms)
  FADE_BUFFER_MS: 20      // Safety buffer for timing variations under load
};

// TRIAL STATE MACHINE CONSTANTS (Hierarchical Model)
// Three distinct trial flows (based on trial type):
//   Study:  PRESENTING.LOADING → PRESENTING.FADING_IN → PRESENTING.DISPLAYING → STUDY.SHOWING → TRANSITION
//   Drill:  PRESENTING.LOADING → PRESENTING.FADING_IN → PRESENTING.DISPLAYING → PRESENTING.AWAITING → FEEDBACK.SHOWING → TRANSITION
//   Test:   PRESENTING.LOADING → PRESENTING.FADING_IN → PRESENTING.DISPLAYING → PRESENTING.AWAITING → TRANSITION
// All trials share the first 3 PRESENTING substates (LOADING, FADING_IN, DISPLAYING)
// Study skips AWAITING and uses STUDY phase; Drill adds FEEDBACK; Test skips both STUDY and FEEDBACK

const TRIAL_STATES = {
  // PRESENTING PHASE - User sees question/content (drill/test share this)
  // Duration: 15-30s for drill/test (waiting for input)
  PRESENTING_LOADING: 'PRESENTING.LOADING',          // Selecting card, loading assets (50-500ms)
  PRESENTING_FADING_IN: 'PRESENTING.FADING_IN',      // New content appearing (200ms fade-in)
  PRESENTING_DISPLAYING: 'PRESENTING.DISPLAYING',    // Visible, input disabled (brief ~10ms)
  PRESENTING_AWAITING: 'PRESENTING.AWAITING',        // Input enabled, waiting (drill/test only)

  // STUDY PHASE - Study trials only (completely separate from presenting/feedback)
  // Duration: purestudy timeout (e.g., 3 seconds)
  STUDY_SHOWING: 'STUDY.SHOWING',                    // Display stimulus+answer (study only)

  // FEEDBACK PHASE - Drill trials only (shows correctness after input)
  // Duration: 2-5s for drill
  FEEDBACK_SHOWING: 'FEEDBACK.SHOWING',              // Display correct/incorrect (drill only)

  // TRANSITION PHASE - Between trials (all trial types use this)
  // Duration: ~460ms total (200ms fade-out + 20ms buffer + 40ms cleanup + 200ms fade-in)
  TRANSITION_START: 'TRANSITION.START',              // Brief cleanup (10ms)
  TRANSITION_FADING_OUT: 'TRANSITION.FADING_OUT',    // Old content disappearing (200ms fade-out)
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

// Track current state
let currentTrialState = TRIAL_STATES.IDLE;

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
  const previousState = currentTrialState;
  const trialNum = (Session.get('currentExperimentState')?.numQuestionsAnswered || 0) + 1;

  // Validate transition
  const validNextStates = VALID_TRANSITIONS[previousState] || [];
  if (!validNextStates.includes(newState) && newState !== TRIAL_STATES.ERROR) {
    console.error(
      `[SM] ❌ [Trial ${trialNum}] INVALID STATE TRANSITION: ${previousState} → ${newState}`,
      `\n   Valid transitions from ${previousState}: ${validNextStates.join(', ')}`,
      reason ? `\n   Reason: ${reason}` : ''
    );
    // Don't throw - just log. In production we might want to transition to ERROR state
    // For now, allow the transition but flag it
  }

  // Log transition
  console.log(
    `[SM] ✓ [Trial ${trialNum}] STATE: ${previousState} → ${newState}`,
    reason ? `(${reason})` : ''
  );

  currentTrialState = newState;

  // Optional: Store in Session for debugging/visibility
  Session.set('_debugTrialState', newState);

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
const onEndCallbackDict = {};
let pollMediaDevicesInterval = null;
function pollMediaDevices() {
  navigator.mediaDevices.enumerateDevices().then(function(devices) {
    if (selectedInputDevice != null) {
      if (devices.filter((x) => x.deviceId == selectedInputDevice).length == 0) {
        console.log('input device lost!!!');
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
  Session.set('pausedLocks', Session.get('pausedLocks')+1);
  audioContext.close();
  clearAudioContextAndRelatedVariables();
  const errMsg = 'It appears you may have unplugged your microphone.  \
    Please plug it back then click ok to reinitialize audio input.';
  alert(errMsg);
  initializeAudio();
}

function initializeAudio() {
  try {
    // Older browsers might not implement mediaDevices at all, so we set an empty object first
    if (navigator.mediaDevices === undefined) {
      console.log('media devices undefined');
      navigator.mediaDevices = {};
    }

    // Some browsers partially implement mediaDevices. We can't just assign an object
    // with getUserMedia as it would overwrite existing properties.
    // Here, we will just add the getUserMedia property if it's missing.
    if (navigator.mediaDevices.getUserMedia === undefined) {
      navigator.mediaDevices.getUserMedia = function(constraints) {
        // First get ahold of the legacy getUserMedia, if present
        const getUserMedia = navigator.webkitGetUserMedia || navigator.mozGetUserMedia ||
          navigator.msGetUserMedia || navigator.getUserMedia;

        // Some browsers just don't implement it - return a rejected promise with an error
        // to keep a consistent interface
        if (!getUserMedia) {
          return Promise.reject(new Error('getUserMedia is not implemented in this browser'));
        }

        // Otherwise, wrap the call to the old navigator.getUserMedia with a Promise
        return new Promise(function(resolve, reject) {
          getUserMedia.call(navigator, constraints, resolve, reject);
        });
      };
    }

    navigator.mediaDevices.getUserMedia({audio: true, video: false})
        .then(startUserMedia)
        .catch(function(err) {
          console.log('Error getting user media: ' + err.name + ': ' + err.message);
        });
  } catch (e) {
    console.log('Error initializing Web Audio browser');
  }
}

function preloadVideos() {
  if (Session.get('currentTdfUnit') && 
  Session.get('currentTdfUnit').videosession &&
  Session.get('currentTdfUnit').videosession.videosource) {
    if(Session.get('currentTdfUnit').videosession.videosource.includes('http')){
      Session.set('videoSource', Session.get('currentTdfUnit').videosession.videosource);
    } else {
      Session.set('videoSource', DynamicAssets.findOne({name: Session.get('currentTdfUnit').videosession.videosource}).link());
    }
  }
}

function preloadImages() {
  const curStimImgSrcs = getCurrentStimDisplaySources('imageStimulus');
  console.log('curStimImgSrcs: ', curStimImgSrcs);
  imagesDict = {};
  const imageLoadPromises = [];
  let img;
  for (let src of curStimImgSrcs) {
    const loadPromise = new Promise((resolve, reject) => {
      if(!src.includes('http')){
        link = DynamicAssets.findOne({name: src}).link();
        img = new Image();
        img.onload = () => {
          console.log('img loaded:', src);
          resolve();
        };
        img.onerror = () => {
          console.warn('img failed to load:', src);
          resolve(); // Resolve anyway to not block the UI
        };
        img.src = link;
        console.log('img:' + img);
        imagesDict[src] = img;
      } else {
        img = new Image();
        img.onload = () => {
          console.log('img loaded:', src);
          resolve();
        };
        img.onerror = () => {
          console.warn('img failed to load:', src);
          resolve(); // Resolve anyway to not block the UI
        };
        img.src = src;
        console.log('img:' + img);
        imagesDict[src] = img;
      }
    });
    imageLoadPromises.push(loadPromise);
  }
  console.log('imagesDict: ', imagesDict);
  // Return promise that resolves when all images are loaded
  return Promise.all(imageLoadPromises);
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
  console.log('[SM] preloadStimuliFiles called in state:', currentTrialState);
  // Pre-load sounds to be played into soundsDict to avoid audio lag issues
  if (curStimHasSoundDisplayType()) {
    console.log('Sound type questions detected, pre-loading sounds');
  } else {
    console.log('Non sound type detected');
  }
  if (curStimHasImageDisplayType()) {
    console.log('image type questions detected, pre-loading images');
    await preloadImages();
    console.log('All images preloaded');
  } else {
    console.log('Non image type detected');
  }
}

function checkUserAudioConfigCompatability(){
  const audioPromptMode = Meteor.user().audioPromptMode;
  if (curStimHasImageDisplayType() && ((audioPromptMode == 'all' || audioPromptMode == 'question'))) {
    console.log('PANIC: Unable to process TTS for image response', Session.get('currentRootTdfId'));
    alert('Question reading not supported on this TDF. Please disable and try again.');
    leavePage('/profile');
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
  // Check if the map exists AND the specific stimuliSetId entry exists
  return currentStimuliSetId && stimDisplayTypeMap && stimDisplayTypeMap[currentStimuliSetId]
    ? stimDisplayTypeMap[currentStimuliSetId].hasImage
    : false;
}



// Buttons are determined by 3 options: buttonorder, buttonOptions, wrongButtonLimit:
//
// 1. buttonorder - can be "fixed" or "random" with a default of fixed.
//
// 2. buttonOptions - the list of button labels to use. If empty the
//    button labels will be taken from the current stim cluster.
//
// 3. wrongButtonLimit - The number of WRONG buttons to display (so final
//    button is wrongButtonLimit + 1 for the correct answer).
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
    console.log('buttonChoices==buttonOptions', buttonChoices);
  } else {
    const currentFalseResponses = getCurrentFalseResponses();

    for (const falseResponse of currentFalseResponses) {
      buttonChoices.push(falseResponse);

    }
    correctButtonPopulated = false;
    console.log('buttonChoices==falseresponses and correct answer', buttonChoices);
  }
  if (correctButtonPopulated === null) {
    console.log('No correct button');
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
      buttonValue: val,
    });
    curChar = nextChar(curChar);
  });
  Session.set('buttonList', curButtonList);
}

// Return the list of false responses corresponding to the current question/answer
function getCurrentFalseResponses() {
  const {curClusterIndex, curStimIndex} = getCurrentClusterAndStimIndices();
  const cluster = getStimCluster(curClusterIndex);
  console.log('getCurrentFalseResponses', curClusterIndex, curStimIndex, cluster);

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

  console.log('getCurrentClusterAndStimIndices: ' + !engine);

  if (!engine) {
    console.log('getCurrentClusterAndStimIndices, no engine: ' + Session.get('clusterIndex'));
    curClusterIndex = Session.get('clusterIndex');
  } else {
    const currentQuest = engine.findCurrentCardInfo();
    curClusterIndex = currentQuest.clusterIndex;
    curStimIndex = currentQuest.whichStim;
    console.log('getCurrentClusterAndStimIndices, engine: ', currentQuest);
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
  let currentAudioSrc = Session.get('currentDisplay').audioSrc;
  console.log('currentAudioSrc: ' + currentAudioSrc);
  if(!currentAudioSrc.includes('http')){
    try {
      currentAudioSrc = DynamicAssets.findOne({name: currentAudioSrc}).link();
    }
    catch (e) {
      console.error('Error getting audio file: ' + e);
      alert('Could not load audio file: ' + currentAudioSrc + '. ')
      Router.go('/profile')
    }
  }
  let currentSound = new Audio(currentAudioSrc);
  // Reset sound and play it
  currentSound.play();
  currentSound.addEventListener('ended', function() {
    if (onEndCallback) {
      onEndCallback();
    }
    console.log('Sound completed');
  })
}

function handleUserForceCorrectInput(e, source) {
  const key = e.keyCode || e.which;
  if (key == ENTER_KEY || source === 'voice') {
    console.log('handleUserForceCorrectInput');
    $('#userForceCorrect').prop('disabled', true);
    stopRecording();
    console.log('userForceCorrect, enter key');
    // Enter key - see if gave us the correct answer
    const entry = _.trim($('#userForceCorrect').val()).toLowerCase();
    if (getTestType() === 'n') {
      console.log('force correct n type test');
      if (entry.length < 4) {
        const oldPrompt = $('#forceCorrectGuidance').text();
        $('#userForceCorrect').prop('disabled', false);
        $('#userForceCorrect').val('');
        $('#forceCorrectGuidance').text(oldPrompt + ' (4 character minimum)');
      } else {
        const savedFunc = timeoutFunc;
        clearCardTimeout();
        savedFunc();
      }
    } else {
      console.log('force correct non n type test');
      const answer = Answers.getDisplayAnswerText(Session.get('currentExperimentState').currentAnswer).toLowerCase();
      const originalAnswer = Answers.getDisplayAnswerText(Session.get('currentExperimentState').originalAnswer).toLowerCase();
      if (entry === answer || entry === originalAnswer) {
        console.log('force correct, correct answer');
        const afterUserFeedbackForceCorrectCbHolder = afterUserFeedbackForceCorrectCb;
        afterUserFeedbackForceCorrectCb = undefined;
        afterUserFeedbackForceCorrectCbHolder();
      } else {
        console.log('force correct, wrong answer');
        $('#userForceCorrect').prop('disabled', false);
        $('#userForceCorrect').val('');
        $('#forceCorrectGuidance').text('Incorrect - please enter \'' + answer + '\'');
        speakMessageIfAudioPromptFeedbackEnabled('Incorrect - please enter \'' + answer + '\'', 'feedback');
        startRecording();
      }
    }
  } else if (getTestType() === 'n') {
    console.log('not enter key and test type n, resetting main card timeout');
    // "Normal" keypress - reset the timeout period
    resetMainCardTimeout();
  }
}

function handleUserInput(e, source, simAnswerCorrect) {
  console.log('[SM] handleUserInput called in state:', currentTrialState, 'source:', source);
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
    console.log('skipped study');
  }

  // If we haven't seen the correct keypress, then we want to reset our
  // timeout and leave
  if (key != ENTER_KEY) {
    resetMainCardTimeout();
    return;
  }

  const testType = getTestType();
  if(!(testType === 't' || testType === 'i'))
    $('#helpButton').prop("disabled",true);

  
  // Stop current timeout and stop user input
  stopUserInput();
  // We've entered input before the timeout, meaning we need to decrement the pausedLocks before we lose
  // track of the fact that we were counting down to a recalculated delay after being on the error report modal
  if (timeoutName) {
    if (Session.get('pausedLocks')>0) {
      const numRemainingLocks = Session.get('pausedLocks')-1;
      Session.set('pausedLocks', numRemainingLocks);
    }
  }
  clearCardTimeout();

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
  Session.set('trialEndTimeStamp', trialEndTimeStamp);
  Session.set('trialStartTimestamp', trialStartTimestamp);
  Session.set('source', source);
  Session.set('userAnswer', userAnswer);

  // Show user feedback and find out if they answered correctly
  // Note that userAnswerFeedback will display text and/or media - it is
  // our responsbility to decide when to hide it and move on
  userAnswerFeedback(userAnswer, isSkip , isTimeout, simAnswerCorrect);
}

// Take care of user feedback - simCorrect will usually be undefined/null BUT if
// it is true or false we know this is part of a simulation call
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
    // How was their answer? (And note we only need to update historyUserAnswer
    // if it's not a "standard" )
    // Timeout - doesn't matter what the answer says!
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
  Session.set('isTimeout', isTimeout);
  Session.set('userAnswer', userAnswer);
  Session.set('isCorrectAccumulator', isCorrectAccumulator);
  Session.set('feedbackForAnswer', feedbackForAnswer);

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

    const currCount = _.intval(Session.get('scrollListCount'));
    const currentQuestion = Session.get('currentDisplay').text || Session.get('currentDisplay').clozeText;

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
        console.log('ERROR inserting scroll list member:', displayify(err));
      }
      Session.set('scrollListCount', currCount + 1);
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
  Session.set('scrollListCount', 0);
}


function determineUserFeedback(userAnswer, isSkip, isCorrect, feedbackForAnswer, correctAndText) {
  Session.set('isRefutation', undefined);
  if (isCorrect == null && correctAndText != null) {
    isCorrect = correctAndText.isCorrect;
    if (userAnswer.includes('[timeout]') != '' && !isCorrect && correctAndText.matchText.split(' ')[0] != 'Incorrect.'){
      Session.set('isRefutation', true);
    }
  }

  // Handle video session checkpoint logic
  if (Session.get('isVideoSession') && playerController) {
    playerController.handleQuestionResponse(isCorrect);
  }

  const currentDeliveryParams = Session.get('currentDeliveryParams')
  if (currentDeliveryParams.scoringEnabled) {
    // Note that we track the score in the user progress object, but we
    // copy it to the Session object for template updates
    const {correctscore, incorrectscore} = currentDeliveryParams;

    const oldScore = Session.get('currentScore');
    const newScore = oldScore + (isCorrect ? correctscore : -incorrectscore);
    Session.set('currentScore', newScore);
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
    let trialEndTimeStamp = Session.get('trialEndTimeStamp');
    let trialStartTimeStamp = Session.get('trialStartTimestamp');
    let source = Session.get('source');
    let isTimeout = Session.get('isTimeout');
    afterAnswerFeedbackCallback(trialEndTimeStamp, trialStartTimeStamp, source, userAnswer, isTimeout, isSkip, isCorrect);
  }
}

async function showUserFeedback(isCorrect, feedbackMessage, isTimeout, isSkip) {
  console.log('showUserFeedback');
  console.log('[SM] showUserFeedback called in state:', currentTrialState);

  // STATE MACHINE: Transition to FEEDBACK.SHOWING (drill only, test skips feedback)
  if (trialShowsFeedback()) {
    transitionTrialState(TRIAL_STATES.FEEDBACK_SHOWING, `Showing feedback (${isCorrect ? 'correct' : 'incorrect'})`);
  }

  // Cache frequently accessed Session variables
  const uiSettings = Session.get('curTdfUISettings');
  const deliveryParams = Session.get('currentDeliveryParams');
  const experimentState = Session.get('currentExperimentState');

  if (uiSettings.suppressFeedbackDisplay) {
    // Do not display any feedback, but still advance the schedule
    let trialEndTimeStamp = Session.get('trialEndTimeStamp');
    let trialStartTimeStamp = Session.get('trialStartTimestamp');
    let source = Session.get('source');
    let isCorrectVal = isCorrect;
    let isSkipVal = isSkip;
    let isTimeoutVal = isTimeout;
    afterAnswerFeedbackCallback(trialEndTimeStamp, trialStartTimeStamp, source, Session.get('userAnswer'), isTimeoutVal, isSkipVal, isCorrectVal);
    return;
  }
  userFeedbackStart = Date.now();
  const isButtonTrial = getButtonTrial();
  feedbackDisplayPosition = uiSettings.feedbackDisplayPosition;
  // For button trials with images where they get the answer wrong, assume incorrect feedback is an image path
  if (!isCorrect && isButtonTrial && getResponseType() == 'image') {
    const buttonImageFeedback = 'Incorrect.  The correct response is displayed below.';
    const correctImageSrc = experimentState.originalAnswer;
    $('#UserInteraction').html('<p class="text-align alert">' + buttonImageFeedback +
      '</p><img style="background: url(' + correctImageSrc +
      '); background-size:100%; background-repeat: no-repeat;" disabled="" \
      class="btn-alt btn-block btn-image btn-responsive">').removeAttr('hidden');
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
    $('.hints').hide();
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
    //we have several options for displaying the feedback, we can display it in the top (#userInteraction), bottom (#userLowerInteraction). We write a case for this
    // PHASE 2: Set reactive state, let Tracker.autorun handle DOM updates
    cardState.set('feedbackPosition', feedbackDisplayPosition);
    cardState.set('inFeedback', true);

    switch(feedbackDisplayPosition){
      case "top":
        target = "#UserInteraction";
        break;
      case "middle":
        target = "#feedbackOverride";
        break;
      case "bottom":
        target = "#userLowerInteraction";
        //add the fontSize class to the target
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
      $('#multipleChoiceContainer').hide();
      $('.input-box').hide();
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
              // inFeedback already set via cardState above
              // Batch DOM update: get existing content, append, then single write
              const existingContent = $(target).html() || '';
              const newContent = existingContent + feedbackMessage;
              $(target)
            .html(newContent)
            .removeAttr('hidden')
            var countDownStart = new Date().getTime();
            let dialogueHistory;
            if (Session.get('dialogueHistory')) {
              dialogueHistory = JSON.parse(JSON.stringify(Session.get('dialogueHistory')));
            }
            countDownStart += getReviewTimeout(getTestType(), deliveryParams, isCorrect, dialogueHistory, isTimeout, isSkip);
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
              if(displayReviewTimeoutMode == "text" || displayReviewTimeoutMode == "both"){

                document.getElementById("CountdownTimerText").innerHTML = 'Continuing in: ' + seconds + "s";
              } else {
                document.getElementById("CountdownTimerText").innerHTML = '';
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
              


              // If the count down is finished, end interval and clear CountdownTimer
              if (distance < 0) {
                $('#userLowerInteraction').html('');
                Meteor.clearInterval(CountdownTimerInterval);
                //reset the progress bar
                document.getElementById("progressbar").style.width = 0 + "%";
                if(window.currentAudioObj) {
                  $('#CountdownTimerText').text('Continuing after feedback...');
                } else {
                  $('#CountdownTimerText').text("Continuing...");
                }
                Session.set('CurIntervalId', undefined);
                cardState.set('inFeedback', false)
              }
            }, 250); // Reduced from 100ms - 4fps is smooth enough, saves CPU
            Session.set('CurIntervalId', CountdownTimerInterval);
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

  // If incorrect answer for a drill on a sound not after a dialogue loop,
  // we need to replay the sound, after the optional audio feedback delay time
  if (!!(Session.get('currentDisplay').audioSrc) && !isCorrect) {
    setTimeout(function() {
      console.log('playing sound after timeuntilaudiofeedback', new Date());
      playCurrentSound();
    }, Session.get('currentDeliveryParams').timeuntilaudiofeedback);
  }

  // forceCorrection is now part of user interaction - we always clear the
  // textbox, but only show it if:
  // * They got the answer wrong somehow
  // * forceCorrection is true in the current delivery params
  // * the trial params are specified to enable forceCorrection
  // * we are NOT in a sim

  // Call doClearForceCorrect non-reactively to prevent infinite loop
  // Previously used Tracker.afterFlush which caused the callback to fire after EVERY flush,
  // creating a loop when Session variables were updated in afterAnswerFeedbackCallback
  Tracker.nonreactive(() => {
    // 'm' = mandatory correction (must re-type), 'n' = timed prompt/hint (auto-continues)
    // Both use force correction UI but with different behavior
    const isForceCorrectTrial = getTestType() === 'm' || getTestType() === 'n';
    const doForceCorrect = (!isCorrect && !Session.get('runSimulation') &&
      (Session.get('currentDeliveryParams').forceCorrection || isForceCorrectTrial));
    const trialEndTimeStamp = Session.get('trialEndTimeStamp');
    const trialStartTimeStamp = Session.get('trialStartTimestamp');
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
      beginMainCardTimeout(forcecorrecttimeout, afterAnswerFeedbackCallback(trialEndTimeStamp, trialStartTimeStamp, source, userAnswer, isTimeout, false, isCorrect));
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
    Session.set('skipTimeout', true)
    handleUserInput({keyCode: ENTER_KEY}, 'keypress');
  }
}

async function afterAnswerFeedbackCallback(trialEndTimeStamp, trialStartTimeStamp, source, userAnswer, isTimeout, isSkip, isCorrect) {
  Session.set('showDialogueText', false);
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
  if (Session.get('dialogueHistory')) {
    dialogueHistory = JSON.parse(JSON.stringify(Session.get('dialogueHistory')));
  }
  const reviewTimeout = wasReportedForRemoval ? 2000 : getReviewTimeout(testType, deliveryParams, isCorrect, dialogueHistory, isTimeout, isSkip);

  // Stop previous timeout, log response data, and clear up any other vars for next question
  clearCardTimeout();

  Session.set('feedbackTimeoutBegins', Date.now())
  const answerLogRecord = gatherAnswerLogRecord(trialEndTimeStamp, trialStartTimeStamp, source, userAnswer, isCorrect,
      testType, deliveryParams, dialogueHistory, wasReportedForRemoval);
  afterFeedbackCallbackBind = afterFeedbackCallback.bind(null, trialEndTimeStamp, trialStartTimeStamp, isTimeout, isSkip, isCorrect, testType, deliveryParams, answerLogRecord, 'card')
  const timeout = Meteor.setTimeout(async function() {
    afterFeedbackCallbackBind()
    engine.updatePracticeTime(Date.now() - trialEndTimeStamp)
  }, reviewTimeout)
  Session.set('CurTimeoutId', timeout)
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
  console.log('[SM] afterFeedbackCallback called in state:', currentTrialState);
  Session.set('CurTimeoutId', null)
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
  Session.set('dialogueTotalTime', undefined);
  Session.set('dialogueHistory', undefined);
  const newExperimentState = {
    lastAction: answerLogAction,
  };

  newExperimentState.overallOutcomeHistory = Session.get('overallOutcomeHistory');
  console.log('writing answerLogRecord to history:', answerLogRecord);
  if(Meteor.user() === undefined || !Meteor.user().impersonating){
    try {
      answerLogRecord.responseDuration = responseDuration;
      answerLogRecord.CFStartLatency = startLatency;
      answerLogRecord.CFEndLatency = endLatency;
      answerLogRecord.CFFeedbackLatency = feedbackLatency;
      Meteor.call('insertHistory', answerLogRecord);
      updateExperimentState(newExperimentState, 'card.afterAnswerFeedbackCallback');
    } catch (e) {
      console.log('error writing history record:', e);
      throw new Error('error inserting history/updating state:', e);
    }
  } else {
    console.log('no history saved. impersonation mode.');
  }

  if(!userLeavingTrial){
    // Special: count the number of timeouts in a row. If autostopTimeoutThreshold
    // is specified and we have seen that many (or more) timeouts in a row, then
    // we leave the page. Note that autostopTimeoutThreshold defaults to 0 so that
    // this feature MUST be turned on in the TDF.
    if (!isTimeout) {
      timeoutsSeen = 0; // Reset count
    } else {
      timeoutsSeen++;

      // Figure out threshold (with default of 0)
      // Also note: threshold < 1 means no autostop at all
      const threshold = deliveryParams.autostopTimeoutThreshold;

      if (threshold > 0 && timeoutsSeen >= threshold) {
        console.log('Hit timeout threshold', threshold, 'Quitting');
        leavePage('/profile');
        return; // We are totally done
      }
    }
    if(window.currentAudioObj) {
      window.currentAudioObj.addEventListener('ended', async () => {
        await cardEnd();
      });
    } else {
      await cardEnd();
    }
  }
}

async function cardEnd() {
  console.log('[SM] cardEnd called in state:', currentTrialState);
  // STATE MACHINE: Begin TRANSITION phase
  transitionTrialState(TRIAL_STATES.TRANSITION_START, 'Trial complete, beginning transition');

  hideUserFeedback(); // Clears all feedback locations
  cardState.set('inFeedback', false);
  $('#CountdownTimerText').text("Continuing...");
  // Don't clear #userLowerInteraction - hideUserFeedback() already does it
  $('#userAnswer').val('');
  Session.set('feedbackTimeoutEnds', Date.now())

  // STATE MACHINE: Transition will happen in prepareCard via FADING_OUT and CLEARING
  // prepareCard() handles fade-out and clearing, then moves to next trial's LOADING
  await prepareCard();
}

function getReviewTimeout(testType, deliveryParams, isCorrect, dialogueHistory, isTimeout, isSkip) {
  let reviewTimeout = 0;

  if (testType === 's') {
    // Just a study - note that the purestudy timeout is used for the QUESTION
    // timeout, not the display timeout after the ANSWER. However, we need a
    // timeout for our logic below so just use the minimum
    reviewTimeout = 1;
  } else if (testType === 't' || testType === 'i') {
    // A test or instruction unit - we don't have timeouts since they don't get feedback about
    // how they did (that's what drills are for)
    reviewTimeout = 1;
  } else if (testType === 'd' || testType === 'm' || testType === 'n') {
    // Drill - the timeout depends on how they did
    if (isCorrect) {
      reviewTimeout = _.intval(deliveryParams.correctprompt);
    } else {
      // Fast forward through feedback if we already did a dialogue feedback session
      if (deliveryParams.feedbackType == 'dialogue' && dialogueHistory && dialogueHistory.LastStudentAnswer) {
        reviewTimeout = 0.001;
      } else if(Session.get('isRefutation') && !isTimeout) {
        reviewTimeout = _.intval(deliveryParams.refutationstudy) || _.intval(deliveryParams.reviewstudy);
      } else {
        reviewTimeout = _.intval(deliveryParams.reviewstudy);
      }
    }
  } else {
    // We don't know what to do since this is an unsupported test type - fail
    throw new Error('Unknown trial type was specified - no way to proceed');
  }
  //if flagged to skip the timeout, set the timeout to 0.001
  if (isSkip) {
    reviewTimeout = 2;
  }
  if(Meteor.isDevelopment && Session.get('skipTimeout')){
    reviewTimeout = 0.001;
    Session.set('skipTimeout', false);
  }
  // We need at least a timeout of 1ms
  if (reviewTimeout < 0.001) throw new Error('No correct timeout specified');

  return reviewTimeout;
}

function getTrialTime(trialEndTimeStamp, trialStartTimeStamp, reviewEnd, testType) {
  let feedbackLatency;
  if(Session.get('dialogueTotalTime')){
    feedbackLatency = Session.get('dialogueTotalTime');
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
    console.log(`responseDuration: ${responseDuration}
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
    Meteor.call('sendUserErrorReport', curUser, errorDescription, curPage, sessionVars,
        userAgent, logs, currentExperimentState);
    leavePage('/profile');
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

// eslint-disable-next-line max-len
function gatherAnswerLogRecord(trialEndTimeStamp, trialStartTimeStamp, source, userAnswer, isCorrect, 
  testType, deliveryParams, dialogueHistory, wasReportedForRemoval) {

  // Figure out button trial entries
  let buttonEntries = '';
  const wasButtonTrial = !!Session.get('buttonTrial');
  if (wasButtonTrial) {
    const wasDrill = (testType === 'd' || testType === 'm' || testType === 'n');
    // If we had a dialogue interaction restore this from the session variable as the screen was wiped
    if (deliveryParams.feedbackType == 'dialogue' && !isCorrect && wasDrill) {
      buttonEntries = JSON.parse(JSON.stringify(Session.get('buttonEntriesTemp')));
    } else {
      buttonEntries = _.map(Session.get('buttonList'), (val) => val.buttonValue).join(',');
    }
    Session.set('buttonEntriesTemp', undefined);
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
  // let curKCBase = getStimKCBaseForCurrentStimuliSet();
  // let stimulusKC = whichStim + curKCBase;

  const curTdf = Session.get('currentTdfFile');
  const unitName = _.trim(curTdf.tdfs.tutor.unit[Session.get('currentUnitNumber')].unitname);

  const problemName = Session.get('currentExperimentState').originalDisplay;
  const stepName = problemName;
  // let stepCount = (state.stepNameSeen[stepName] || 0) + 1;
  // state.stepNameSeen[stepName] = stepCount;
  // stepName = stepCount + " " + stepName;
  const isStudy = testType === 's';
  let shufIndex = clusterIndex;
  let stimFileIndex = clusterIndex;
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
  }
  const originalAnswer = Session.get('currentExperimentState').originalAnswer;
  const currentAnswer = Session.get('currentExperimentState').currentAnswer;
  const fullAnswer = (typeof(originalAnswer) == 'undefined' || originalAnswer == '') ? currentAnswer : originalAnswer;
  const temp = _.trim((fullAnswer || '')).split('~');
  const correctAnswer = temp[0];
  const whichHintLevel = parseInt(Session.get('hintLevel')) || 0;

  const filledInDisplay = JSON.parse(JSON.stringify(Session.get('currentDisplay')));
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
    'displayedStimulus': Session.get('currentDisplay'),
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
    'CFAudioInputEnabled': Meteor.user().audioInputMode,
    'CFAudioOutputEnabled': Session.get('enableAudioPromptAndFeedback'),
    'CFDisplayOrder': Session.get('questionIndex'),
    'CFStimFileIndex': stimFileIndex,
    'CFSetShuffledIndex': shufIndex,
    'CFAlternateDisplayIndex': Session.get('alternateDisplayIndex') || null,
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

// Helper to parse a schedule condition - see note above about 0 and 1 based
// indexes for why we do some of our manipulation below
function parseSchedItemCondition(cond) {
  if (typeof cond === 'undefined' || !cond) {
    return 'UNKNOWN';
  }

  const fields = _.trim('' + cond).split('-');
  if (fields.length !== 2) {
    return cond;
  }

  const num = parseInt(fields[1]);
  if (isNaN(num)) {
    return cond;
  }

  return fields[0] + '_' + (num + 1).toString();
}

function findQTypeSimpified() {
  const currentDisplay = Session.get('currentDisplay');
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
  console.log('[SM] hideUserFeedback called in state:', currentTrialState);
  // Don't use .hide() - let displayReady fade-out handle visibility
  // Using .hide() causes instant flash while content is still visible
  // Clear ALL feedback locations (top, middle, bottom) since we don't know which was used
  $('#UserInteraction').removeClass('text-align alert alert-success alert-danger').html('');
  $('#feedbackOverride').html('');
  $('#userLowerInteraction').html('');
  $('#userForceCorrect').val(''); // text box - see inputF.html
  // Don't hide forceCorrectionEntry - let fade-out handle it
  // Don't hide removeQuestion - let fade-out handle it
}

// Comprehensive cleanup that mimics what {{#if displayReady}} teardown did automatically
// IMPORTANT: Only clear input VALUES and non-reactive HTML, NOT Blaze-managed content
function cleanupTrialContent() {
  console.log('[SM] cleanupTrialContent called in state:', currentTrialState);
  console.log('  #userAnswer before cleanup:', $('#userAnswer').length, 'display:', $('#userAnswer').css('display'));

  // Clear input VALUES (not HTML - let Blaze handle that)
  // Note: #userAnswer already cleared in cardEnd(), but safe to repeat
  $('#userAnswer').val('');
  $('#userForceCorrect').val('');

  // Reset input styling that may persist from previous trial
  // This prevents border color flash (black→red) during fade-in
  $('#userAnswer').removeClass('is-invalid is-valid'); // Bootstrap validation classes
  $('#userAnswer').css('border-color', ''); // Reset any inline border styles
  $('#userAnswer').css('border', ''); // Reset full border property

  // Clear non-reactive HTML (NOT feedback - hideUserFeedback() already did that)
  // Only clear elements that weren't handled by hideUserFeedback
  $('#correctAnswerDisplayContainer').html('');
  $('#CountdownTimerText').text('');

  // Reset CSS classes (NOT feedback classes - already done)
  $('#displayContainer').removeClass('mx-auto');
  $('#correctAnswerDisplayContainer').addClass('d-none');

  // Reset inline styles
  $('#progressbar').css('width', '0%');

  // Hide elements that need to be hidden (using attr not .hide() to work with Blaze)
  $('#userInteractionContainer').attr('hidden', '');
  $('#feedbackOverrideContainer').attr('hidden', '');
  $('#forceCorrectionEntry').attr('hidden', '');
  $('#confirmButton').prop('disabled', true);

  // CRITICAL: Show .input-box that was hidden during feedback
  // showUserFeedback() calls $('.input-box').hide() but nothing shows it again
  $('.input-box').show();
  $('#multipleChoiceContainer').show();

  console.log('  #userAnswer after cleanup:', $('#userAnswer').length, 'display:', $('#userAnswer').css('display'));

  // NOTE: Do NOT clear Session variables here - those are cleared in prepareCard/newQuestionHandler
  // NOTE: Do NOT clear HTML that's managed by Blaze templates (buttonList, text, etc.)
}


//Called to revisit a previous unit in the current session. 
async function revisitUnit(unitNumber) {
  console.log('REVIST UNIT: ', unitNumber);
  clearCardTimeout();
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
      Meteor.call('insertHistory', logRecord);
  }
  Session.set('questionIndex', 0);
  Session.set('clusterIndex', undefined);
  Session.set('currentUnitNumber', newUnitNum);
  Session.set('currentTdfUnit', curTdfUnit);
  Session.set('resetSchedule', true);
  Session.set('currentDeliveryParams', getCurrentDeliveryParams());
  Session.set('currentUnitStartTime', Date.now());
  Session.set('feedbackUnset', true);
  Session.set('feedbackTypeFromHistory', undefined);
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
  updateExperimentState(newExperimentState, 'revisitUnit');


  let leaveTarget;
  if (newUnitNum < curTdf.tdfs.tutor.unit.length || curTdf.tdfs.tutor.unit[newUnitNum] > 0) {
    // Revisiting a Unit, we need to restart with instructions
    // Check if the unit has a learning session, assess
    console.log('REVISIT UNIT: show instructions for unit', newUnitNum);
      const rootTDFBoxed = Tdfs.findOne({_id: Session.get('currentRootTdfId')});
      const rootTDF = rootTDFBoxed.content;
      const setspec = rootTDF.tdfs.tutor.setspec;
    leaveTarget = '/instructions';
    Router.go(leaveTarget);
  }

}

// Called when the current unit is done. This should be either unit-defined (see
// prepareCard) or user-initiated (see the continue button event and the var
// len display timeout function)
async function unitIsFinished(reason) {
  clearCardTimeout();

  const curTdf = Session.get('currentTdfFile');
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
        console.log('adaptive schedule', engine.adaptiveQuestionLogic.schedule);
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
  Session.set('feedbackUnset', true);
  Session.set('feedbackTypeFromHistory', undefined);
  Session.set('curUnitInstructionsSeen', false);

  const resetStudentPerformance = Session.get('currentDeliveryParams').resetStudentPerformance
  let leaveTarget;
  if (newUnitNum < curTdf.tdfs.tutor.unit.length) {
    // Just hit a new unit - we need to restart with instructions
    console.log('UNIT FINISHED: show instructions for next unit', newUnitNum);
      const rootTDFBoxed = Tdfs.findOne({_id: Session.get('currentRootTdfId')});
      const rootTDF = rootTDFBoxed.content;
      const setspec = rootTDF.tdfs.tutor.setspec;
      if((setspec.loadbalancing && setspec.countcompletion == newUnitNum) || (setspec.loadbalancing && countCompletion && !setspec.countcompletion)){
        const curConditionFileName = Session.get('currentTdfFile').fileName;
        //get the condition number from the rootTDF
        const curConditionNumber = setspec.condition.indexOf(curConditionFileName);
        //increment the completion count for the current condition
        rootTDFBoxed.conditionCounts[curConditionNumber] = rootTDFBoxed.conditionCounts[curConditionNumber] + 1;
        conditionCounts = rootTDFBoxed.conditionCounts;
        //update the rootTDF
        Meteor.call('updateTdfConditionCounts', Session.get('currentRootTdfId'), conditionCounts);
      }
    leaveTarget = '/instructions';
  } else {
    // We have run out of units - return home for now
    console.log('UNIT FINISHED: No More Units');
    //if loadbalancing is enabled and countcompletion is "end" then we need to increment the completion count of the current condition in the root tdf
    const rootTDFBoxed = Tdfs.findOne({_id: Session.get('currentRootTdfId')});
    const rootTDF = rootTDFBoxed.content;
    const setspec = rootTDF.tdfs.tutor.setspec;
    if(setspec.countcompletion == "end" && setspec.loadbalancing || (setspec.loadbalancing && countCompletion && !setspec.countcompletion)){
        const curConditionFileName = Session.get('currentTdfFile').fileName;
        //get the condition number from the rootTDF
        const curConditionNumber = setspec.condition.indexOf(curConditionFileName);
        rootTDFBoxed.conditionCounts[curConditionNumber] = rootTDFBoxed.conditionCounts[curConditionNumber] + 1;
        conditionCounts = rootTDFBoxes.completionCount;
        //update the rootTDF
        Meteor.call('updateTdfConditionCounts', Session.get('currentRootTdfId'), conditionCounts);
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
  console.log('unitIsFinished,updateExperimentState', res);
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

async function cardStart() {
  // Reset resizing for card images (see also index.js)
  $('#cardQuestionImg').load(function(evt) {
    redoCardImage();
  });
  $('#userLowerInteraction').html('');

  // Always hide the final instructions box
  $('#finalInstructionsDlg').modal('hide');
  // the card loads frequently, but we only want to set this the first time
  if (Session.get('inResume')) {
    Session.set('buttonTrial', false);
    Session.set('buttonList', []);

    console.log('cards template rendered => Performing resume');
    let curExperimentState = Session.get('currentExperimentState') || {};
    curExperimentState.showOverlearningText = false;
    Session.set('currentExperimentState', curExperimentState);

    Session.set('inResume', false); // Turn this off to keep from re-resuming
    resumeFromComponentState();
  }
}

async function prepareCard() {
  const trialNum = (Session.get('currentExperimentState')?.numQuestionsAnswered || 0) + 1;
  console.log('[SM] === prepareCard START (Trial #' + trialNum + ') ===');
  console.log('[SM]   CALL STACK:', new Error().stack);
  console.log('[SM]   displayReady before:', Session.get('displayReady'));

  // STATE MACHINE: Handle transition to fade-out based on current state
  if (currentTrialState === TRIAL_STATES.IDLE) {
    // First trial - no need to fade out, will go straight to LOADING after clearing
    console.log('[SM]   First trial (IDLE state), skipping fade-out');
  } else if (currentTrialState === TRIAL_STATES.TRANSITION_START) {
    transitionTrialState(TRIAL_STATES.TRANSITION_FADING_OUT, 'Fade-out previous trial content');
  } else if (currentTrialState === TRIAL_STATES.TRANSITION_CLEARING) {
    // Already in CLEARING (called from processUserTimesLog), skip fade-out
    console.log('[SM]   Already in CLEARING state, skipping fade-out');
  } else {
    // Called from somewhere unexpected - transition to fade-out anyway
    transitionTrialState(TRIAL_STATES.TRANSITION_FADING_OUT, 'prepareCard() starting fade-out from unexpected state');
  }

  Meteor.logoutOtherClients();
  Session.set('wasReportedForRemoval', false);

  // Start fade-out with OLD content still visible (not cleared to empty)
  // DON'T clean up yet - that happens AFTER fade completes
  console.log('[SM]   Setting displayReady=false to fade out (old content remains visible during fade)');
  Session.set('displayReady', false);

  // Wait for fade-out transition to complete
  const fadeDelay = TRANSITION_CONFIG.FADE_DURATION_MS + TRANSITION_CONFIG.FADE_BUFFER_MS;
  console.log(`[SM]   Waiting ${fadeDelay}ms for fade-out to complete...`);
  await new Promise(resolve => setTimeout(resolve, fadeDelay));
  console.log('[SM]   Fade-out complete, now cleaning up WHILE INVISIBLE');

  // Clean up feedback/input styling AFTER fade-out (while opacity=0)
  // This prevents flashing during the visible transition
  cleanupTrialContent();

  // STATE MACHINE: Transition to CLEARING
  if (currentTrialState === TRIAL_STATES.TRANSITION_FADING_OUT) {
    transitionTrialState(TRIAL_STATES.TRANSITION_CLEARING, 'Clearing previous trial content');
  }

  Session.set('submmissionLock', false);
  // DON'T clear currentDisplay - keep old stimulus so it's visible during fade
  // It will be swapped to new content in checkAndDisplayTwoPartQuestion
  // Session.set('currentDisplay', {}); // REMOVED - prevents empty flash

  // DON'T set buttonTrial to undefined - causes input to flash/paint late
  // It will be updated with correct value in newQuestionHandler()
  // Session.set('buttonTrial', undefined); // REMOVED - causes Blaze re-render delay
  Session.set('buttonList', []);
  $('#helpButton').prop("disabled",false);
  if (engine.unitFinished()) {
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
    transitionTrialState(TRIAL_STATES.PRESENTING_LOADING, 'Starting card selection');

    await engine.selectNextCard(Session.get('engineIndices'), Session.get('currentExperimentState'));
    await newQuestionHandler();
    Session.set('cardStartTimestamp', Date.now());
    Session.set('engineIndices', undefined);
  }
}

// TODO: this probably no longer needs to be separate from prepareCard
async function newQuestionHandler() {
  console.log('=== newQuestionHandler START ===');
  console.log('[SM] newQuestionHandler called in state:', currentTrialState);
  console.log('  #userAnswer at start:', $('#userAnswer').length, 'display:', $('#userAnswer').css('display'));
  console.log('  Secs since unit start:', elapsedSecs());

  // Cache frequently accessed Session variables
  const experimentState = Session.get('currentExperimentState');

  scrollList.update(
      {'justAdded': 1},
      {'$set': {'justAdded': 0}},
      {'multi': true},
      function(err, numrecs) {
        if (err) console.log('UDPATE ERROR:', displayify(err));
      },
  );

  Session.set('buttonList', []);
  speechTranscriptionTimeoutsSeen = 0;
  const isButtonTrial = getButtonTrial();
  Session.set('buttonTrial', isButtonTrial);
  console.log('newQuestionHandler, isButtonTrial', isButtonTrial, 'displayReady', Session.get('displayReady'));

  // Input visibility is now controlled by CSS classes in template (trial-input-hidden)
  // Both text and button inputs are pre-rendered, Blaze conditionals control CSS class only
  // This prevents DOM structure changes that cause input/stimulus desynchronization
  console.log('  Input visibility controlled by CSS, buttonTrial:', isButtonTrial);

  if (isButtonTrial) {
    setUpButtonTrial();
  }

  // If this is a study-trial and we are displaying a cloze, then we should
  // construct the question to display the actual information. Note that we
  // use a regex so that we can do a global(all matches) replace on 3 or
  // more underscores
  if ((getTestType() === 's' || getTestType() === 'f') && !!(experimentState.currentDisplayEngine.clozeText)) {
    const currentDisplay = experimentState.currentDisplayEngine;
    const clozeQuestionFilledIn = Answers.clozeStudy(currentDisplay.clozeText, experimentState.currentAnswer);
    currentDisplay.clozeText = clozeQuestionFilledIn;
    const newExperimentState = {currentDisplayEngine: currentDisplay};
    updateExperimentState(newExperimentState, 'card.newQuestionHandler');
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
  clearCardTimeout(); // No previous timeout now

  const deliveryParams = Session.get('currentDeliveryParams');
  if (!deliveryParams) {
    throw new Error('No delivery params');
  }
  console.log('startQuestionTimeout deliveryParams', deliveryParams);

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
  const currentDisplayEngine = Session.get('currentExperimentState').currentDisplayEngine;

  console.log('startQuestionTimeout, closeQuestionParts', Session.get('currentExperimentState').clozeQuestionParts);

  // displayReady is toggled false→true for each trial to control CSS opacity transitions
  // With CSS wrapper approach, DOM stays in place - only visibility changes via .trial-hidden class

  let readyPromptTimeout = 0;
  if(Session.get('currentDeliveryParams').readyPromptStringDisplayTime && Session.get('currentDeliveryParams').readyPromptStringDisplayTime > 0){
    readyPromptTimeout = Session.get('currentDeliveryParams').readyPromptStringDisplayTime
  }
  trialStartTimestamp = Date.now();
  Session.set('trialStartTimestamp', trialStartTimestamp);
  Meteor.setTimeout(() => {
    const beginQuestionAndInitiateUserInputBound = beginQuestionAndInitiateUserInput.bind(null, delayMs, deliveryParams);
    const pipeline = checkAndDisplayTwoPartQuestion.bind(null,
        deliveryParams, currentDisplayEngine, Session.get('currentExperimentState').clozeQuestionParts, beginQuestionAndInitiateUserInputBound);
    checkAndDisplayPrestimulus(deliveryParams, pipeline);
  }, readyPromptTimeout)
  countdownInterval = setInterval(() => {
    const timeLeft = Math.max(0, readyPromptTimeout - (Date.now() - trialStartTimestamp));
    const timeLeftSecs = Math.ceil(timeLeft / 1000);
    const progressbarElem = document.getElementById("progressbar");
    if(timeLeft <= 0){
      clearInterval(countdownInterval);
      countdownInterval = null;
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
  console.log('=== checkAndDisplayPrestimulus START ===');
  console.log('[SM] checkAndDisplayPrestimulus called in state:', currentTrialState);
  console.log('  displayReady at start:', Session.get('displayReady'));
  // we'll [0], if it exists
  const prestimulusDisplay = Session.get('currentTdfFile').tdfs.tutor.setspec.prestimulusDisplay;
  console.log('  prestimulusDisplay:', prestimulusDisplay);

  if (prestimulusDisplay) {
    const prestimulusDisplayWrapper = {'text': prestimulusDisplay};
    console.log('  prestimulusDisplay detected, displaying', prestimulusDisplayWrapper);
    Session.set('currentDisplay', prestimulusDisplayWrapper);
    const isVideoSession = Session.get('isVideoSession')
    const currentDisplayReady = Session.get('displayReady');
    console.log('  Before setting displayReady - current value:', currentDisplayReady, 'isVideoSession:', isVideoSession);
    // Set displayReady once for the trial (no toggle to prevent shimmer)
    if (!currentDisplayReady && !isVideoSession) {
      console.log('  Setting displayReady=true in checkAndDisplayPrestimulus');

      // STATE MACHINE: Transition to PRESENTING.FADING_IN
      transitionTrialState(TRIAL_STATES.PRESENTING_FADING_IN, 'displayReady=true (prestimulus), starting fade-in');

      Session.set('displayReady', true); //displayReady handled by video session if video unit

      // STATE MACHINE: After fade-in completes, transition to DISPLAYING and proceed to next stage
      setTimeout(() => {
        transitionTrialState(TRIAL_STATES.PRESENTING_DISPLAYING, 'Fade-in complete (prestimulus), content visible');

        // Proceed to next stage AFTER fade-in completes
        const prestimulusdisplaytime = deliveryParams.prestimulusdisplaytime;
        console.log('delaying for ' + prestimulusdisplaytime + ' ms then starting question', new Date());
        setTimeout(async function() {
          console.log('past prestimulusdisplaytime, start two part question logic');
          await nextStageCb();
        }, prestimulusdisplaytime);
      }, TRANSITION_CONFIG.FADE_DURATION_MS + TRANSITION_CONFIG.FADE_BUFFER_MS);
    } else {
      console.log('  NOT setting displayReady (already true or video session)');
      // displayReady already true, proceed immediately
      const prestimulusdisplaytime = deliveryParams.prestimulusdisplaytime;
      console.log('delaying for ' + prestimulusdisplaytime + ' ms then starting question', new Date());
      setTimeout(async function() {
        console.log('past prestimulusdisplaytime, start two part question logic');
        await nextStageCb();
      }, prestimulusdisplaytime);
    }
  } else {
    console.log('no prestimulusDisplay detected, continuing to next stage');
    await nextStageCb();
  }
}

async function checkAndDisplayTwoPartQuestion(deliveryParams, currentDisplayEngine, closeQuestionParts, nextStageCb) {
  console.log('=== checkAndDisplayTwoPartQuestion START ===');
  console.log('[SM] checkAndDisplayTwoPartQuestion called in state:', currentTrialState);
  console.log('  displayReady at start:', Session.get('displayReady'));
  // In either case we want to set up the current display now
  const isVideoSession = Session.get('isVideoSession')
  // Update display directly without toggling displayReady (prevents input shimmer)
  Session.set('currentDisplay', currentDisplayEngine);
  Session.get('currentExperimentState').clozeQuestionParts = closeQuestionParts;

  // Set displayReady once for the trial (no toggle to prevent shimmer)
  const currentDisplayReady = Session.get('displayReady');
  console.log('  Before setting displayReady - current value:', currentDisplayReady, 'isVideoSession:', isVideoSession);
  if (!currentDisplayReady && !isVideoSession) {
    console.log('  Setting displayReady=true in checkAndDisplayTwoPartQuestion');

    // STATE MACHINE: Transition to PRESENTING.FADING_IN
    transitionTrialState(TRIAL_STATES.PRESENTING_FADING_IN, 'displayReady=true, starting fade-in');

    Session.set('displayReady', true);

    // STATE MACHINE: After fade-in completes, transition to DISPLAYING and proceed to next stage
    setTimeout(() => {
      transitionTrialState(TRIAL_STATES.PRESENTING_DISPLAYING, 'Fade-in complete, content visible');

      // Handle two part questions AFTER fade-in completes
      const currentQuestionPart2 = Session.get('currentExperimentState').currentQuestionPart2;
      if (currentQuestionPart2) {
        const twoPartQuestionWrapper = {'text': currentQuestionPart2};
        const initialviewTimeDelay = deliveryParams.initialview;
        setTimeout(function() {
          // Update display directly without toggling displayReady (prevents input shimmer)
          Session.set('currentDisplay', twoPartQuestionWrapper);
          // displayReady already true from initial set - don't toggle
          Session.get('currentExperimentState').currentQuestionPart2 = undefined;
          redoCardImage();
          nextStageCb();
        }, initialviewTimeDelay);
      } else {
        nextStageCb();
      }
    }, TRANSITION_CONFIG.FADE_DURATION_MS + TRANSITION_CONFIG.FADE_BUFFER_MS);
  } else {
    // displayReady already true (video session or subsequent call), proceed immediately
    const currentQuestionPart2 = Session.get('currentExperimentState').currentQuestionPart2;
    if (currentQuestionPart2) {
      const twoPartQuestionWrapper = {'text': currentQuestionPart2};
      const initialviewTimeDelay = deliveryParams.initialview;
      setTimeout(function() {
        // Update display directly without toggling displayReady (prevents input shimmer)
        Session.set('currentDisplay', twoPartQuestionWrapper);
        // displayReady already true from initial set - don't toggle
        Session.get('currentExperimentState').currentQuestionPart2 = undefined;
        redoCardImage();
        nextStageCb();
      }, initialviewTimeDelay);
    } else {
      nextStageCb();
    }
  }
}

function beginQuestionAndInitiateUserInput(delayMs, deliveryParams) {
  firstKeypressTimestamp = 0;
  const currentDisplay = Session.get('currentDisplay');

  if (currentDisplay.audioSrc) {
    const timeuntilaudio = deliveryParams.timeuntilaudio;
    setTimeout(function() {
      console.log('playing audio: ', new Date());
      // We don't allow user input until the sound is finished playing
      playCurrentSound(function() {
        allowUserInput();
        beginMainCardTimeout(delayMs, function() {
          console.log('stopping input after ' + delayMs + ' ms');
          stopUserInput();
          handleUserInput({}, 'timeout');
        });
      });
    }, timeuntilaudio);
  } else { // Not a sound - can unlock now for data entry now
    const questionToSpeak = currentDisplay.clozeText || currentDisplay.text;
    // Only speak the prompt if the question type makes sense
    if (questionToSpeak) {
      console.log('text to speak playing prompt: ', new Date());
      let buttons = Session.get('buttonList');
      let buttonsToSpeak = '';
      if(buttons){
        for(button in buttons){
          buttonsToSpeak = buttonsToSpeak + ' ' + buttons[button].buttonName;
        }
      }
      speakMessageIfAudioPromptFeedbackEnabled(questionToSpeak + buttonsToSpeak, 'question');
    }
    allowUserInput();
    beginMainCardTimeout(delayMs, function() {
      console.log('stopping input after ' + delayMs + ' ms');
      stopUserInput();
      handleUserInput({}, 'timeout');
    });
  }
}

function allowUserInput() {
  console.log('allow user input');
  console.log('[SM] allowUserInput called in state:', currentTrialState);

  // STATE MACHINE: Transition to AWAITING (for drill/test) or STUDY.SHOWING (for study)
  // This is called AFTER fade-in completes (via setTimeout callback chain)
  if (trialUsesStudyPhase()) {
    // Study trials: transition to STUDY.SHOWING phase
    transitionTrialState(TRIAL_STATES.STUDY_SHOWING, 'Study trial showing stimulus+answer');
  } else {
    // Drill/Test trials: transition to AWAITING user input
    transitionTrialState(TRIAL_STATES.PRESENTING_AWAITING, 'Ready for user input');
  }

  // DO NOT need to show #userAnswer - CSS wrapper (#trialContentWrapper) handles visibility via opacity
  // Visibility is controlled by displayReady, not jQuery show/hide
  // $('#userAnswer').show(); // REMOVED - not needed with CSS wrapper approach
  $('#confirmButton').show();

  startRecording();

  // Enable input and set focus immediately - no delay needed
  // DOM is ready since we're in callback chain after fade-in completes
  // ALWAYS enable input - allowUserInput means we want input enabled
  // Set inputDisabled=false so stopUserInput's setTimeout won't re-disable
  inputDisabled = false;
  $('#userAnswer, #multipleChoiceContainer button').prop('disabled', false);

  // ACCESSIBILITY: Set focus immediately for keyboard users
  const textFocus = !getButtonTrial();
  if (textFocus) {
    try {
      $('#userAnswer').focus();
    } catch (e) {
      // Do nothing - focus may fail if element not in DOM
    }
  }
}


// This records the synchronous state of whether input should be enabled or disabled
// without this we get into the situation where either stopUserInput fails because
// the DOM hasn't fully updated yet or worse allowUserInput fails because the DOM
// loads before it and stopUserInput is erroneously executed afterwards due to timing issues
let inputDisabled = undefined;
function stopUserInput() {
  console.log('stop user input');
  console.log('[SM] stopUserInput called in state:', currentTrialState);
  // DO NOT hide #userAnswer - CSS wrapper (#trialContentWrapper) handles visibility via opacity
  // $('#userAnswer').hide(); // REMOVED - breaks input visibility on subsequent trials
  inputDisabled = true;
  stopRecording();

  // Delay disabling inputs to sync with CSS fade transition (TRANSITION_CONFIG.FADE_DURATION_MS)
  // This prevents visible button state changes during fade-out, improving perceived smoothness
  // The inputDisabled flag guards against race conditions if allowUserInput() is called during this delay
  setTimeout(function() {
    console.log('after delay, stopping user input');
    // Only disable if inputDisabled is still true (allowUserInput may have set it to false)
    if (inputDisabled === true) {
      $('#userAnswer, #multipleChoiceContainer button').prop('disabled', true);
    }
  }, TRANSITION_CONFIG.FADE_DURATION_MS);
}

// BEGIN WEB AUDIO section

// Audio prompt/feedback
function speakMessageIfAudioPromptFeedbackEnabled(msg, audioPromptSource) {
  const audioPromptMode = Meteor.user().audioPromptMode;
  const enableAudioPromptAndFeedback = audioPromptMode && audioPromptMode != 'silent';
  let synthesis = window.speechSynthesis;
  if (enableAudioPromptAndFeedback) {
    if (audioPromptSource === audioPromptMode || audioPromptMode === 'all') {
      Session.set('recordingLocked', true);
      // Replace underscores with blank so that we don't get awkward UNDERSCORE UNDERSCORE
      // UNDERSCORE...speech from literal reading of text
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
        Meteor.call('makeGoogleTTSApiCall', Session.get('currentTdfId'), msg, audioPromptSpeakingRate, audioPromptVolume, audioPromptVoice, function(err, res) {
          if(err){
            console.log(err)
          }
          else if(res == undefined){
            console.log('makeGoogleTTSApiCall returned undefined object')
          }
          else{
            const audioObj = new Audio('data:audio/ogg;base64,' + res)
            Session.set('recordingLocked', true);
            if (window.currentAudioObj) {
              window.currentAudioObj.pause();
            }
            window.currentAudioObj = audioObj;
            window.currentAudioObj.addEventListener('ended', (event) => {
              window.currentAudioObj = undefined;
              Session.set('recordingLocked', false);
              startRecording();
            });
            console.log('inside callback, playing audioObj:');
            window.currentAudioObj.play().catch((err) => {
              console.log(err)
              let utterance = new SpeechSynthesisUtterance(msg);
              utterance.addEventListener('end', (event) => { 
                Session.set('recordingLocked', false);
                startRecording();
              });
              utterance.addEventListener('error', (event) => { 
                console.log(event);
                Session.set('recordingLocked', false);
              });
              synthesis.speak(utterance);
            });
          }
        });
        console.log('providing audio feedback');
      } else {
        console.log('Text-to-Speech API key not found, using MDN Speech Synthesis');
        let utterance = new SpeechSynthesisUtterance(msg);
        synthesis.speak(utterance);
      }
    }
  } else {
    console.log('audio feedback disabled');
  }
}

// Speech recognition function to process audio data, this is called by the web worker
// started with the recorder object when enough data is received to fill up the buffer
async function processLINEAR16(data) {
  if (resetMainCardTimeout && timeoutFunc && !inputDisabled) {
    resetMainCardTimeout(); // Give ourselves a bit more time for the speech api to return results
  } else {
    console.log('not resetting during processLINEAR16');
  }
  recorder.clear();
  const userAnswer = $('#forceCorrectionEntry').is(':visible') ?
      document.getElementById('userForceCorrect') : document.getElementById('userAnswer');
  const isButtonTrial = getButtonTrial();

  if (userAnswer || isButtonTrial || DialogueUtils.isUserInDialogueLoop()) {
    speechTranscriptionTimeoutsSeen += 1;
    const sampleRate = Session.get('sampleRate');
    const setSpec = Session.get('currentTdfFile').tdfs.tutor.setspec;
    let speechRecognitionLanguage = setSpec.speechRecognitionLanguage;
    if (!speechRecognitionLanguage) {
      console.log('no speechRecognitionLanguage in set spec, defaulting to en-US');
      speechRecognitionLanguage = 'en-US';
    } else {
      speechRecognitionLanguage = speechRecognitionLanguage[0];
    }

    let phraseHints = [];
    if (isButtonTrial) {
      let curChar = 'a';
      phraseHints.push(curChar);
      for (let i=1; i<26; i++) {
        curChar = nextChar(curChar);
        phraseHints.push(curChar);
      }
    } else {
      if (DialogueUtils.isUserInDialogueLoop()) {
        DialogueUtils.setDialogueUserAnswerValue('waiting for transcription');
      } else {
        userAnswer.value = 'waiting for transcription';
        phraseHints = getAllCurrentStimAnswers(true);
      }
    }

    const request = generateRequestJSON(sampleRate, speechRecognitionLanguage, phraseHints, data);

    let answerGrammar = [];
    if (isButtonTrial) {
      answerGrammar = phraseHints;
    } else if (!DialogueUtils.isUserInDialogueLoop()) {
      // We call getAllCurrentStimAnswers again but not excluding phrase hints that
      // may confuse the speech api so that we can check if what the api returns
      // is within the realm of reasonable responses before transcribing it
      answerGrammar = getAllCurrentStimAnswers(false);
    }
    let tdfSpeechAPIKey;
    if(Session.get('useEmbeddedAPIKeys')){
      tdfSpeechAPIKey = await meteorCallAsync('getTdfSpeechAPIKey', Session.get('currentTdfId'));
    } else {
      tdfSpeechAPIKey = '';
    }
    // Make the actual call to the google speech api with the audio data for transcription
    if (tdfSpeechAPIKey && tdfSpeechAPIKey != '') {
      console.log('tdf key detected');
      Meteor.call('makeGoogleSpeechAPICall', Session.get('currentTdfId'), "", request, answerGrammar, (err, res) => speechAPICallback(err, res));
    // If we don't have a tdf provided speech api key load up the user key
    // NOTE: we shouldn't be able to get here if there is no user key
    } else {
      console.log('no tdf key, using user provided key');
      Meteor.call('makeGoogleSpeechAPICall', Session.get('currentTdfId'), Session.get('speechAPIKey'), request, answerGrammar, (err, res) => speechAPICallback(err, res));
    }
  } else {
    console.log('processLINEAR16 userAnswer not defined');
  }
}

function speechAPICallback(err, data){
  let [answerGrammar, response] = data;
  let transcript = '';
  const ignoreOutOfGrammarResponses = Session.get('ignoreOutOfGrammarResponses');
  const speechOutOfGrammarFeedback = 'Please try again or press enter or say skip';
  // Session.get("speechOutOfGrammarFeedback");//TODO: change this in tdfs and not hardcoded
  let ignoredOrSilent = false;

  // If we get back an error status make sure to inform the user so they at
  // least have a hint at what went wrong
  if (err) {
    const content = JSON.parse(response);
    console.log(err);
    transcript = 'I did not get that. Please try again.';
    ignoredOrSilent = true;
  } else if (response['results']) {
    transcript = response['results'][0]['alternatives'][0]['transcript'].toLowerCase();
    console.log('transcript: ' + transcript);
    if (ignoreOutOfGrammarResponses) {
      if (transcript == 'enter') {
        ignoredOrSilent = false;
      } else if (answerGrammar.indexOf(transcript) == -1) { // Answer not in grammar, ignore and reset/re-record
        console.log('ANSWER OUT OF GRAMMAR, IGNORING');
        transcript = speechOutOfGrammarFeedback;
        ignoredOrSilent = true;
      }
    }
  } else {
    console.log('NO TRANSCRIPT/SILENCE');
    transcript = 'Silence detected';
    ignoredOrSilent = true;
  }

  const inUserForceCorrect = $('#forceCorrectionEntry').is(':visible');
  if (getButtonTrial()) {
    userAnswer = $('[verbalChoice=\'' + transcript + '\']')[0];
    if (!userAnswer) {
      console.log('Choice couldn\'t be found');
      ignoredOrSilent = true;
    }
  } else if (DialogueUtils.isUserInDialogueLoop()) {
    if (DialogueUtils.isUserInDialogueIntroExit()) {
      speechTranscriptionTimeoutsSeen = 0;
    } else {
      DialogueUtils.setDialogueUserAnswerValue(transcript);
    }
  } else {
    userAnswer = inUserForceCorrect ? document.getElementById('userForceCorrect') :
        document.getElementById('userAnswer');
    userAnswer.value = transcript;
  }

  if (speechTranscriptionTimeoutsSeen >= Session.get('currentDeliveryParams').autostopTranscriptionAttemptLimit) {
    ignoredOrSilent = false; // Force out of a silence loop if we've tried enough
    const transcriptionMsg = ' transcription attempts which is over autostopTranscriptionAttemptLimit, \
        forcing incorrect answer to move things along.';
    console.log(speechTranscriptionTimeoutsSeen + transcriptionMsg);
    // Dummy up some data so we don't fail downstream
    if (getButtonTrial()) {
      userAnswer = {'answer': {'name': 'a'}};
    } else if (DialogueUtils.isUserInDialogueLoop()) {
      DialogueUtils.setDialogueUserAnswerValue('FORCEDINCORRECT');
    }
  }

  if (ignoredOrSilent) {
    startRecording();
    // If answer is out of grammar or we pick up silence wait 5 seconds for
    // user to read feedback then clear the answer value
    if (!getButtonTrial() && !DialogueUtils.isUserInDialogueLoop()) {
      setTimeout(() => userAnswer.value = '', 5000);
    }
  } else {
    // Only simulate enter key press if we picked up transcribable/in grammar
    // audio for better UX
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
        console.log('getDialogFeedbackForAnswer2', dialogueContext);
        Meteor.call('getDialogFeedbackForAnswer', dialogueContext, dialogueLoop);
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
  const request = {
    'config': {
      'encoding': 'LINEAR16',
      'sampleRateHertz': sampleRate,
      'languageCode': speechRecognitionLanguage,
      'maxAlternatives': 1,
      'profanityFilter': false,
      'speechContexts': [
        {
          'phrases': phraseHints,
        },
      ],
    },
    'audio': {
      'content': data,
    },
  };

  console.log('Request:' + _.pick(request, 'config'));

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
function startUserMedia(stream) {
  userMediaStream = stream;
  const tracks = stream.getTracks();
  selectedInputDevice = tracks[0].getSettings().deviceId;
  pollMediaDevicesInterval = Meteor.setInterval(pollMediaDevices, 2000);
  console.log('START USER MEDIA');
  const input = audioContext.createMediaStreamSource(stream);
  window.audioContext = audioContext;
  streamSource = input;
  // Firefox hack https://support.mozilla.org/en-US/questions/984179
  window.firefox_audio_hack = input;
  // Capture the sampling rate for later use in google speech api as input
  Session.set('sampleRate', input.context.sampleRate);
  const audioRecorderConfig = {errorCallback: function(x) {
    console.log('Error from recorder: ' + x);
  }};
  // eslint-disable-next-line no-undef
  recorder = new Recorder(input, audioRecorderConfig);

  // Set up the process callback so that when we detect speech end we have the
  // function to process the audio data
  recorder.setProcessCallback(processLINEAR16);

  // Set up options for voice activity detection code (hark.js)
  speechEvents = hark(stream); //{interval: 50, play: false};

  speechEvents.on('speaking', function() {
    if (!Session.get('recording')) {
      console.log('NOT RECORDING, VOICE START');
      return;
    } else {
      console.log('VOICE START');
      if (resetMainCardTimeout && timeoutFunc) {
        if (Session.get('recording')) {
          console.log('voice_start resetMainCardTimeout');
          resetMainCardTimeout();
        } else {
          console.log('NOT RECORDING');
        }
      } else {
        console.log('RESETMAINCARDTIMEOUT NOT DEFINED');
      }
    }
  });

  speechEvents.on('stopped_speaking', function() {
    if (!Session.get('recording') || Session.get('pausedLocks')>0) {
      if (document.location.pathname != '/card' && document.location.pathname != '/instructions') {
        leavePage(function() {
          console.log('cleaning up page after nav away from card, voice_stop');
        });
        return;
      } else {
        console.log('NOT RECORDING, VOICE STOP');
        return;
      }
    } else {
      console.log('VOICE STOP');
      recorder.stop();
      Session.set('recording', false);
      recorder.exportToProcessCallback();
    }
  });

  console.log('Audio recorder ready');
  cardStart();
}

function startRecording() {
  if (recorder && !Session.get('recordingLocked') && Meteor.user().audioInputMode) {
    Session.set('recording', true);
    recorder.record();
    console.log('RECORDING START');
  } else {
    console.log('NO RECORDER / RECORDING LOCKED DURING AUDIO PLAYING');
  }
}

function stopRecording() {
  console.log('stopRecording', recorder, Session.get('recording'));
  if (recorder && Session.get('recording')) {
    recorder.stop();
    Session.set('recording', false);

    recorder.clear();
    console.log('RECORDING END');
  }
}

// END WEB AUDIO SECTION

async function getExperimentState() {
  let curExperimentState = await meteorCallAsync('getExperimentState', Meteor.userId(), Session.get('currentRootTdfId'));
  console.log('getExperimentState:', curExperimentState);
  Session.set('currentExperimentState', curExperimentState);
  return curExperimentState || {};
}

async function updateExperimentState(newState, codeCallLocation, unitEngineOverride = {}) {
  let curExperimentState = Session.get('currentExperimentState') || await getExperimentState();
  newState.lastActionTimeStamp = Date.now();
  console.log('currentExperimentState:', curExperimentState);
  if (unitEngineOverride && Object.keys(unitEngineOverride).length > 0)
    curExperimentState = unitEngineOverride;
  if (curExperimentState.currentTdfId === undefined || newState.currentTdfId === undefined) {
    newState.currentTdfId = Session.get('currentRootTdfId')
  }
  if(Object.keys(curExperimentState).length === 0){
    curExperimentState = Object.assign(JSON.parse(JSON.stringify(curExperimentState)), newState);
    Meteor.call('createExperimentState', curExperimentState);
  } else {
    curExperimentState = Object.assign(JSON.parse(JSON.stringify(curExperimentState)), newState);
    Meteor.call('updateExperimentState', curExperimentState, curExperimentState.id);
  }
  console.log('updateExperimentState', codeCallLocation, '\nnew:', curExperimentState);
  Session.set('currentExperimentState', curExperimentState);
  return curExperimentState.currentTdfId;
}

// Re-initialize our User Progress and Card Probabilities internal storage
// from the user times log. Note that most of the logic will be in
// processUserTimesLog This function just does some initial set up, insures
// that experimental conditions are correct, and uses processUserTimesLog as
// a callback. This callback pattern is important because it allows us to be
// sure our server-side call regarding experimental conditions has completed
// before continuing to resume the session
async function resumeFromComponentState() {
  if (Session.get('inResume')) {
    console.log('RESUME DENIED - already running in resume');
    return;
  }
  Session.set('inResume', true);

  console.log('Resuming from previous componentState info (if any)');

  // Clear any previous permutation and/or timeout call
  timeoutsSeen = 0;
  firstKeypressTimestamp = 0;
  trialStartTimestamp = 0;
  Session.set('trialStartTimestamp', trialStartTimestamp);
  clearScrollList();
  clearCardTimeout();

  // Disallow continuing (it will be turned on somewhere else)
  setDispTimeoutText('');
  $('#continueButton').prop('disabled', true);

  // So here's the place where we'll use the ROOT tdf instead of just the
  // current TDF. It's how we'll find out if we need to perform experimental
  // condition selection. It will be our responsibility to update
  // currentTdfId and currentStimuliSetId based on experimental conditions
  // (if necessary)
  let rootTDFBoxed = Tdfs.findOne({_id: Session.get('currentRootTdfId')});
  let curTdf = rootTDFBoxed;
  let rootTDF = rootTDFBoxed.content;
  if (!rootTDF) {
    console.log('PANIC: Unable to load the root TDF for learning', Session.get('currentRootTdfId'));
    alert('Unfortunately, something is broken and this lesson cannot continue');
    leavePage('/profile');
    return;
  }
  const setspec = rootTDF.tdfs.tutor.setspec;
  const needExpCondition = (setspec.condition && setspec.condition.length);

  let curExperimentState = await getExperimentState();
  Session.set('currentExperimentState', curExperimentState);
  const newExperimentState = JSON.parse(JSON.stringify(curExperimentState));

  // We must always check for experiment condition
  if (needExpCondition) {
    console.log('Experimental condition is required: searching');
    const prevCondition = curExperimentState.conditionTdfId;

    let conditionTdfId = null;

    if (prevCondition) {
      // Use previous condition and log a notification that we did so
      console.log('Found previous experimental condition: using that');
      conditionTdfId = prevCondition;
    } else {
      if(!setspec.loadbalancing){
        // Select condition and save it
        console.log('No previous experimental condition: Selecting from ' + setspec.condition.length);
        const randomConditionFileName =  _.sample(setspec.condition)
        conditionTdfId = Tdfs.findOne({"content.fileName": randomConditionFileName})._id;
        newExperimentState.conditionTdfId = conditionTdfId;
        newExperimentState.conditionNote = 'Selected from ' + _.display(setspec.condition.length) + ' conditions';
        console.log('Exp Condition', conditionTdfId, newExperimentState.conditionNote);
      } else {
        conditionCounts = rootTDFBoxed.conditionCounts;
        if(setspec.loadbalancing == "max"){
          //we check the conditionCounts and select randomly from the conditions with a count less than the max
          let max = 0;
          let maxConditions = [];
          for(condition in setspec.condition){
            if(conditionCounts[condition] > max){
              max = conditionCounts[condition];
            }
          }
          for(condition in setspec.condition){
            if(conditionCounts[condition] < max){
              maxConditions.push(setspec.condition[condition]);
            }
          }
          //if the maxConditions array is empty, we select randomly from all conditions
          if(maxConditions.length == 0){
            maxConditions = setspec.condition;
          }
          const randomConditionFileName =  _.sample(maxConditions)
          conditionTdfId = Tdfs.findOne({"content.fileName": randomConditionFileName})._id;
        } else if(setspec.loadbalancing == "min"){
          //we check the conditionCounts and select randomly from the conditions with a count equal to the min
          let min = 1000000000;
          let minConditions = [];
          for(condition in setspec.condition){
            if(conditionCounts[condition] < min){
              min = conditionCounts[condition];
            }
          }
          for(condition in setspec.condition){
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
          conditionTdfId = conditionTdf._id;
          console.log('conditionTdf, conditionTdfId', conditionTdf, conditionTdf._id);
      } else {
        console.log('Invalid loadbalancing parameter');
        alert('Unfortunately, something is broken and this lesson cannot continue');
        leavePage('/profile');
        return;
      }
    }
    if (setspec.countcompletion == "beginning") {
      //reload the conditionCounts from the rootTDF
      rootTDFBoxed = Tdfs.findOne({_id: Session.get('currentRootTdfId')});
      conditionCounts = rootTDFBoxed.conditionCounts;
      conditions = rootTDF.tdfs.tutor.setspec.condition;
      //iterate the conditionCounts for the condition we selected
      conditionFileName = Tdfs.findOne({_id: conditionTdfId}).content.fileName;
      for(condition in conditions){
        if(conditions[condition] == conditionFileName){
          conditionCounts[condition] = conditionCounts[condition] + 1;
          break;
        }
      }

      Meteor.call('updateTdfConditionCounts', Session.get('currentRootTdfId'), conditionCounts);
    }

    newExperimentState.conditionTdfId = conditionTdfId;
    updateExperimentState(newExperimentState, 'setExpCondition');
  }

    if (!conditionTdfId) {
      console.log('No experimental condition could be selected!');
      alert('Unfortunately, something is broken and this lesson cannot continue');
      leavePage('/profile');
      return;
    } 

    // Now we have a different current TDF (but root stays the same)
    Session.set('currentTdfId', conditionTdfId);

    curTdf = Tdfs.findOne({_id: conditionTdfId});
    Session.set('currentTdfFile', curTdf.content);
    Session.set('currentTdfName', curTdf.content.fileName);

    // Also need to read new stimulus file (and note that we allow an exception
    // to kill us if the current tdf is broken and has no stimulus file)
    Session.set('currentStimuliSetId', curTdf.stimuliSetId);
    console.log('condition stimuliSetId', curTdf);
  } else {
    //if currentTdfFile is not set, we are resuming from a previous state and need to set it
    if(!Session.get('currentTdfFile')){
      Session.set('currentTdfFile', rootTDF);
      Session.set('currentTdfName', rootTDF.fileName);
      Session.set('currentTdfId', Session.get('currentRootTdfId'));
      Session.set('currentStimuliSetId', rootTDFBoxed.stimuliSetId);
    } 
    
    // Just notify that we're skipping
    console.log('No Experimental condition is required: continuing', rootTDFBoxed);
  }

  if(curTdf.content.tdfs.tutor.setspec.unitTemplate){
    //tdf has dynamic units. need to check component state for current unit
    if(curExperimentState.currentTdfFile){
      curTdf.content = curExperimentState.currentTdfFile;
      //found dynamic tdf units
      Session.set('currentTdfFile', curTdf.content);
      Session.set('currentTdfName', curTdf.content.fileName);

      // Also need to read new stimulus file (and note that we allow an exception
      // to kill us if the current tdf is broken and has no stimulus file)
      Session.set('currentStimuliSetId', curTdf.stimuliSetId);
      console.log('condition stimuliSetId', curTdf);
    }
  }

  const stimuliSet = curTdf.stimuli

  Session.set('currentStimuliSet', stimuliSet);
  Session.set('feedbackUnset', Session.get('fromInstructions') || Session.get('feedbackUnset'));
  Session.set('fromInstructions', false);

  await preloadStimuliFiles();
  checkUserAudioConfigCompatability();

  // In addition to experimental condition, we allow a root TDF to specify
  // that the xcond parameter used for selecting from multiple deliveryParms's
  // is to be system assigned (as opposed to URL-specified)
  if (setspec.randomizedDelivery && setspec.randomizedDelivery.length) {
    console.log('xcond for delivery params is sys assigned: searching');
    const prevExperimentXCond = curExperimentState.experimentXCond;

    let experimentXCond;

    if (prevExperimentXCond) {
      // Found it!
      console.log('Found previous xcond for delivery');
      experimentXCond = prevExperimentXCond;
    } else {
      // Not present - we need to select one
      console.log('NO previous xcond for delivery - selecting one');
      const xcondCount = _.intval(_.first(setspec.randomizedDelivery));
      experimentXCond = Math.floor(Math.random() * xcondCount);
      newExperimentState.experimentXCond = experimentXCond;
    }

    console.log('Setting XCond from sys-selection', experimentXCond);
    Session.set('experimentXCond', experimentXCond);
  }

  // Find previous cluster mapping (or create if it's missing)
  // Note that we need to wait until the exp condition is selected above so
  // that we go to the correct TDF
  const stimCount = getStimCount();
  let clusterMapping = curExperimentState.clusterMapping;
  if (!clusterMapping) {
    // No cluster mapping! Need to create it and store for resume
    // We process each pair of shuffle/swap together and keep processing
    // until we have nothing left
    const setSpec = Session.get('currentTdfFile').tdfs.tutor.setspec;

    // Note our default of a single no-op to insure we at least build a
    // default cluster mapping
    const shuffles = setSpec.shuffleclusters ? setSpec.shuffleclusters.trim().split(" ") : [''];
    const swaps = setSpec.swapclusters ? setSpec.swapclusters.trim().split(" ") : [''];
    clusterMapping = [];
    console.log('shuffles.length', shuffles.length);
    console.log('swaps.length', swaps.length);
    clusterMapping = createStimClusterMapping(stimCount, shuffles || [], swaps || [], clusterMapping)
    newExperimentState.clusterMapping = clusterMapping;
    console.log('Cluster mapping created', clusterMapping);
  } else {
    // Found the cluster mapping record - extract the embedded mapping
    console.log('Cluster mapping found', clusterMapping);
  }

  if (!clusterMapping || !clusterMapping.length || clusterMapping.length !== stimCount) {
    console.log('Invalid cluster mapping', stimCount, clusterMapping);
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
    leavePage('/profile');
  }

  const curTdfUnit = curTdf.content.tdfs.tutor.unit[Session.get('currentUnitNumber')];
  if (curTdfUnit.videosession) { 
    Session.set('isVideoSession', true)
    console.log('video type questions detected, pre-loading video');
    preloadVideos();
  } else
    Session.set('isVideoSession', false)
  Session.set('currentTdfUnit', curTdfUnit);
  console.log('resume, currentTdfUnit:', curTdfUnit);

  if (curExperimentState.questionIndex) {
    Session.set('questionIndex', curExperimentState.questionIndex);
  } else {
    Session.set('questionIndex', 0);
    newExperimentState.questionIndex = 0;
  }
  
  updateExperimentState(newExperimentState, 'card.resumeFromComponentState');

  //custom settings for user interface
  //we get the current settings from the tdf file's setspec
  //but the unit and individual question can override these settings
  const curTdfUISettings = rootTDF.tdfs.tutor.setspec.uiSettings ? rootTDF.tdfs.tutor.setspec.uiSettings : false;
  const curUnitUISettions = curTdfUnit.uiSettings ? curTdfUnit.uiSettings : false;
  
  //show which settings are being used
  if(curTdfUISettings){
    console.log('using tdf ui settings')
  } else if(curUnitUISettions){
    console.log('using unit ui settings')
  } else {
    console.log('using default ui settings')
  }
  // priority is card, then unit, then tdf. 
  var UIsettings = curUnitUISettions || curTdfUISettings || false;

  const displayPresets = {
    default:{
      "displayReviewTimeoutAsBarOrText": "both",
      "displayReadyPromptTimeoutAsBarOrText": "both",
      "displayCardTimeoutAsBarOrText": "both",
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
  //here we interprit the stimulus and input position settings to set the colum widths. There are 4 possible combinations.
  // 1. stimuliPosition = top, userInputPosition = bottom. We set both to col-12
  // 2. stimuliPosition = left, userInputPosition = right. We set stimuli to col-6 and input to col-6
  

  //if curTdfUISettings is set, then we need to check if it is a string or an object.
  //if it is a string, then we need to check if it is a preset. Otherwise, we set it to default
  //and modify the keys that are set in the object.
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


  console.log('curTdfUISettings', Session.get('curTdfUISettings'))

  if (Session.get('feedbackUnset')){
    getFeedbackParameters();
    Session.set('feedbackUnset', false);
  }
  
  // Notice that no matter what, we log something about condition data
  // ALSO NOTICE that we'll be calling processUserTimesLog after the server
  // returns and we know we've logged what happened
  if(!Session.get('displayFeedback')){
    processUserTimesLog();
  }
}


async function getFeedbackParameters(){
  if(Session.get('currentDeliveryParams').allowFeedbackTypeSelect){
    Session.set('displayFeedback',true);
  } 
}

async function removeCardByUser() {
  Meteor.clearTimeout(Session.get('CurTimeoutId'));
  Meteor.clearInterval(Session.get('CurIntervalId'));
  Session.set('CurTimeoutId', undefined);
  Session.set('CurIntervalId', undefined);
  $('#CountdownTimer').text('');
  $('#removalFeedback').removeAttr('hidden');

  let clusterIndex = Session.get('clusterIndex');
  let stims = getStimCluster(clusterIndex).stims; 
  let whichStim = engine.findCurrentCardInfo().whichStim;
  const userId = Meteor.userId();
  const tdfId = Session.get('currentTdfId');
  Meteor.call('insertHiddenItem', userId, stims[whichStim].stimulusKC, tdfId)
  let hiddenItems = Session.get('hiddenItems');
  hiddenItems.push(stims[whichStim].stimulusKC);
  
  Session.set('numVisibleCards', Session.get('numVisibleCards') - 1);
  Session.set('hiddenItems', hiddenItems);
}

async function processUserTimesLog() {
// Get TDF info
  const tdfFile = Session.get('currentTdfFile');
  const curExperimentState = Session.get('currentExperimentState');
  console.log('tdfFile', tdfFile);

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
  Session.set('originalQuestion', curExperimentState.originalQuestion);
  Session.set('currentAnswer', curExperimentState.currentAnswer);
  Session.set('subTdfIndex', curExperimentState.subTdfIndex);
  Session.set('alternateDisplayIndex', curExperimentState.alternateDisplayIndex);

  Session.set('currentDisplay', undefined);

  let resumeToQuestion = false;

  // prepareCard will handle whether or not new units see instructions, but
  // it will miss instructions for the very first unit.
  let needFirstUnitInstructions = !Session.get('curUnitInstructionsSeen'); 

  // It's possible that they clicked Continue on a final unit, so we need to
  // know to act as if we're done
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
      // Logged completion of unit - if this is the final unit we also
      // know that the TDF is completed
      if ((!!newUnitNum && !!checkUnit) && checkUnit === newUnitNum) {
        if (lastUnitCompleted >= tdfFile.tdfs.tutor.unit.length) {
          moduleCompleted = true; // TODO: what do we do for multiTdfs? Depends on structure of template parentTdf
        }
      } else {
        needFirstUnitInstructions = tdfFile.tdfs.tutor.unit && tdfFile.tdfs.tutor.unit.unitinstructions;
      }
      break;
      // case "schedule":
      //    break;
    case 'question':
      resumeToQuestion = true;
      break;
    case 'answer':
    case '[timeout]':
      // resumeToQuestion = true;//TODO: may want true here
      // writeCurrentToScrollList(entry.answer, action === "[timeout]", simCorrect, 0);//TODO restore all scroll list state
      break;
  }

  if (moduleCompleted) {
    // They are DONE!determineUserFeedback
    console.log('TDF already completed - leaving for profile page.');
    if (Meteor.user().loginParams.loginMode === 'experiment') {
      // Experiment users don't *have* a normal page
      leavePage(routeToSignin);
    } else {
      // "Normal" user - they just go back to their root page
      leavePage('/profile');
    }
  } else {
    await resetEngine(Session.get('currentUnitNumber'));
    newExperimentState.unitType = engine.unitType;
    newExperimentState.TDFId = Session.get('currentTdfId');

    // Depends on unitType being set in initialized unit engine
    Session.set('currentDeliveryParams', getCurrentDeliveryParams());
    Session.set('scoringEnabled', Session.get('currentDeliveryParams').scoringEnabled);

    updateExperimentState(newExperimentState, 'card.processUserTimesLog');
    await engine.loadComponentStates();

    // If we make it here, then we know we won't need a resume until something
    // else happens

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
      // Question outstanding: force question display and let them give an answer
      console.log('RESUME FINISHED: displaying current question');
      await newQuestionHandler();
    } else if (needFirstUnitInstructions && typeof curTdfUnit.unitinstructions !== 'undefined') {
      // They haven't seen our first instruction yet
      console.log('RESUME FINISHED: displaying initial instructions');
      leavePage('/instructions');
    } else {
      // If we get this far and the unit engine thinks the unit is finished,
      // we might need to stick with the instructions *IF AND ONLY IF* the
      // lockout period hasn't finished (which prepareCard won't handle)
      if (engine.unitFinished()) {
        let lockoutMins = Session.get('currentDeliveryParams').lockoutminutes;
        user = Meteor.user();
        isAdmin = Roles.userIsInRole(user, 'admin');
        if (lockoutMins > 0 &&  !isAdmin) {
          let unitStartTimestamp = Session.get('currentUnitStartTime');
          if(Meteor.user().lockouts && Meteor.user().lockouts[Session.get('currentTdfId')] && 
          Meteor.user().lockouts[Session.get('currentTdfId')].currentLockoutUnit == Session.get('currentUnitNumber')){
            unitStartTimestamp = Meteor.user().lockouts[Session.get('currentTdfId')].lockoutTimeStamp;
            lockoutMins = Meteor.user().lockouts[Session.get('currentTdfId')].lockoutMinutes;
          }
          lockoutFreeTime = unitStartTimestamp + (lockoutMins * (60 * 1000)); // minutes to ms
          if (Date.now() < lockoutFreeTime && (typeof curTdfUnit.unitinstructions !== 'undefined') ){
            console.log('RESUME FINISHED: showing lockout instructions');
            leavePage('/instructions');
            return;
          }
        }
      }
      console.log('RESUME FINISHED: next-question logic to commence');

      if(Session.get('unitType') == "model")
        Session.set('engineIndices', await engine.calculateIndices());
      else
        Session.set('engineIndices', undefined);
      await prepareCard();
    }
    }
  }
