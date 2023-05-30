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
import {meteorCallAsync, redoCardImage} from '../../index';
import {DialogueUtils, dialogueContinue, dialogueLoop, initiateDialogue} from './dialogueUtils';
import {SCHEDULE_UNIT, ENTER_KEY} from '../../../common/Definitions';
import {secsIntervalString, displayify, stringifyIfExists} from '../../../common/globalHelpers';
import {routeToSignin} from '../../lib/router';
import {createScheduleUnit, createModelUnit, createEmptyUnit} from './unitEngine';
import {Answers} from './answerAssess';
import {sessionCleanUp} from '../../lib/sessionUtils';
import {checkUserSession} from '../../index'

export {
  speakMessageIfAudioPromptFeedbackEnabled,
  startRecording,
  stopRecording,
  getExperimentState,
  updateExperimentState,
  restartMainCardTimeoutIfNecessary,
  getCurrentClusterAndStimIndices,
  afterFeedbackCallback,
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
let firstKeypressTimestamp = 0;
let currentSound = null; // See later in this file for sound functions
let userFeedbackStart = null;
// We need to track the name/ID for clear and reset. We need the function and
// delay used for reset
let timeoutName = null;
let timeoutFunc = null;
let timeoutDelay = null;
let simTimeoutName = null;
let curExperimentState = null;

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
  timeoutName = null;
  timeoutFunc = null;
  timeoutDelay = null;
  simTimeoutName = null;
  Session.set('varLenTimeoutName', null);
}

// Start a timeout count
// Note we reverse the params for Meteor.setTimeout - makes calling code much cleaner
function beginMainCardTimeout(delay, func) {
  console.log('beginMainCardTimeout', func);
  clearCardTimeout();

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
function leavePage(dest) {
  console.log('leaving page for dest: ' + dest);
  if (dest != '/card' && dest != '/instructions' && document.location.pathname != '/instructions') {
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
  }
  clearCardTimeout();
  clearPlayingSound();
  if (typeof dest === 'function') {
    dest();
  } else {
    Router.go(dest);
  }
}

Template.card.rendered = async function() {
  await checkUserSession();
  console.log('RENDERED----------------------------------------------');
  // Catch page navigation events (like pressing back button) so we can call our cleanup method
  window.onpopstate = function() {
    if (document.location.pathname == '/card') {
      leavePage('/card');
    }
  };
  const globalExperimentState = GlobalExperimentStates.findOne();
  curExperimentState = globalExperimentState.experimentState
  Session.set('experimentId', globalExperimentState._id);
  Session.set('scoringEnabled', undefined);

  if (!Session.get('stimDisplayTypeMap')) {
    const stimDisplayTypeMap = await meteorCallAsync('getStimDisplayTypeMap');
    Session.set('stimDisplayTypeMap', stimDisplayTypeMap);
  }

  const audioInputEnabled = Session.get('audioEnabled');
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
    handleUserInput(e, 'keypress');
  },

  'click #removeQuestion': function(e) {
    // check if the question was already reported.
    // This button only needs to fire if the user hasnt answered the question already.
    if(!Session.get('wasReportedForRemoval'))
      removeCardByUser();
      Session.set('wasReportedForRemoval', true)
      afterAnswerFeedbackCallback(Date.now(), trialStartTimestamp, 'removal', "", false, false);
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
    handleUserInput(event, 'buttonClick');
  },

  'click #continueStudy': function(event) {
    event.preventDefault();
    handleUserInput(event, 'buttonClick');
  },

  'click .instructModalDismiss': function(event) {
    event.preventDefault();
    $('#finalInstructionsDlg').modal('hide');
    if (Meteor.user().profile.loginMode === 'experiment') {
      // Experiment user - no where to go?
      leavePage(routeToSignin);
    } else {
      // "regular" logged-in user - go back to home page
      leavePage('/profile');
    }
  },

  'click #continueButton': function(event) {
    event.preventDefault();
    unitIsFinished('Continue Button Pressed');
  },
});

Template.card.helpers({
  'isExperiment': () => Meteor.user().profile.loginMode === 'experiment',

  'isNormal': () => Meteor.user().profile.loginMode !== 'experiment',

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
    return Meteor.user() && Meteor.user().profile ? Meteor.user().profile.impersonating : false;
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

  'interTrialMessage': () => Session.get('currentDeliveryParams').intertrialmessage,

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
    console.log('subWordClozeCurrentQuestionExists: ' + (typeof(curExperimentState.clozeQuestionParts) != 'undefined'));
    return typeof(curExperimentState.clozeQuestionParts) != 'undefined' && curExperimentState.clozeQuestionParts !== null;
  },

  // For now we're going to assume syllable hints are contiguous. TODO: make this more generalizable
  'subWordParts': () => curExperimentState.clozeQuestionParts || undefined,

  'ifClozeDisplayTextExists': function (){
    const clozeText = Session.get('currentDisplay') ? Session.get('currentDisplay').clozeText : undefined;
    const text = Session.get('currentDisplay') ? Session.get('currentDisplay').text : undefined;
    const subWordCloze = curExperimentState.clozeQuestionParts ? curExperimentState.clozeQuestionParts : undefined;
    let display = false;
    if((typeof clozeText != "undefined" && clozeText != "") || (typeof subWordCloze != "undefined" && subWordCloze != "") || (typeof text != "undefined" && text != "")){
      display = true;
    }
    return display;
  },

  'clozeText': function() {
    const clozeText = Session.get('currentDisplay') ? Session.get('currentDisplay').clozeText : undefined;
    return clozeText;
  },

  'text': function() {
    const text = Session.get('currentDisplay') ? Session.get('currentDisplay').text : undefined;
    return text;
  },

  'dialogueText': function() {
    const text = Session.get('dialogueDisplay') ? Session.get('dialogueDisplay').text : undefined;
    return text
  },

  'curImgSrc': function() {
    const curImgSrc = Session.get('currentDisplay') ? Session.get('currentDisplay').imgSrc : undefined;
    if (curImgSrc) {
      return imagesDict[curImgSrc].src;
    } else {
      return '';
    }
  },

  'curVideoSrc': function() {
    const curVideoSrc = Session.get('currentDisplay') ? Session.get('currentDisplay').videoSrc : undefined;
    return curVideoSrc;
  },

  'displayAnswer': function() {
    return Answers.getDisplayAnswerText(GlobalExperimentStates.findOne().experimentState.currentAnswer);
  },

  'rawAnswer': ()=> GlobalExperimentStates.findOne().experimentState.currentAnswer,

  'currentProgress': () => Session.get('questionIndex'),

  'displayReady': () => Session.get('displayReady'),

  'isDevelopment': () => Meteor.isDevelopment,

  'displayReadyConverter': function(displayReady) {
    return displayReady ? '' : 'none';
  },

  'textCard': function() {
    return !!(Session.get('currentDisplay')) && !!(Session.get('currentDisplay').text);
  },

  'audioCard': function() {
    return !!(Session.get('currentDisplay')) && !!(Session.get('currentDisplay').audioSrc);
  },

  'speakerCardPosition': function() {
    //centers the speaker icon if there are no displays. 
    if(Session.get('currentDisplay') && 
        !Session.get('currentDisplay').imgSrc && 
        !Session.get('currentDisplay').videoSrc && 
        !Session.get('currentDisplay').clozeText && 
        !Session.get('currentDisplay').text)
      return `col-md-12 text-center`;
    return `col-md-1`
  },

  'imageCard': function() {
    return !!(Session.get('currentDisplay')) && !!(Session.get('currentDisplay').imgSrc);
  },

  'videoCard': function() {
    return !!(Session.get('currentDisplay')) && !!(Session.get('currentDisplay').videoSrc);
  },

  'clozeCard': function() {
    return !!(Session.get('currentDisplay')) && !!(Session.get('currentDisplay').clozeText);
  },

  'textOrClozeCard': function() {
    return !!(Session.get('currentDisplay')) &&
      (!!(Session.get('currentDisplay').text) || !!(Session.get('currentDisplay').clozeText));
  },

  'anythingButAudioCard': function() {
    return !!(Session.get('currentDisplay')) &&
            (!!(Session.get('currentDisplay').text) ||
            !!(Session.get('currentDisplay').clozeText) ||
            !!(Session.get('currentDisplay').imgSrc) ||
            !!(Session.get('currentDisplay').videoSrc));
  },

  'imageResponse': function() {
    const rt = getResponseType();
    return rt === 'image';
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
    const hSize = Session.get('currentDeliveryParams') ? Session.get('currentDeliveryParams').fontsize.toString() : 2;
    return 'h' + hSize;
  },

  'skipstudy': () => Session.get('currentDeliveryParams').skipstudy,

  'buttonTrial': () => Session.get('buttonTrial'),

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

  'audioEnabled': () => Session.get('audioEnabled'),

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
  }
});

function getResponseType() {
  // If we get called too soon, we just use the first cluster
  const clusterIndex = Session.get('clusterIndex') || 0;
  const cluster = getStimCluster(clusterIndex);
  const type = cluster.stims[0].itemResponseType || 'text';

  return ('' + type).toLowerCase();
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

function preloadAudioFiles() {
  const allSrcs = getCurrentStimDisplaySources('audioStimulus');
  console.log('allSrcs,audio', allSrcs);
  soundsDict = {};
  for (const src of allSrcs) {
    let source = src;
    if(!src.includes('http')){
      try {
        source = DynamicAssets.findOne({name: src}).link();
      }
      catch (e) {
        console.error('Error getting audio file: ' + e);
        alert('Could not load audio file: ' + src + '. ')
        Router.go('/profile')
      }
    }
    let sound = new Audio(source);
    sound.onplay = function (source) {
      let src = source.target.fileName
      if (soundsDict[src]) {
        soundsDict[src].isCurrentlyPlaying = true;
      }
      console.log('Sound played');
    }
    sound.onended = function (source) {
      let src = source.target.fileName
      if (soundsDict[src]) {
        soundsDict[src].isCurrentlyPlaying = false;
      }
      if (onEndCallbackDict[src]) {
        onEndCallbackDict[src]();
      }
      console.log('Sound completed');
    }
    sound.fileName = src;
    soundsDict[src] = sound;
  }
}

function preloadImages() {
  const curStimImgSrcs = getCurrentStimDisplaySources('imageStimulus');
  console.log('curStimImgSrcs: ', curStimImgSrcs);
  imagesDict = {};
  let img;
  for (let src of curStimImgSrcs) {
    if(!src.includes('http')){
      link = DynamicAssets.findOne({name: src}).link();
      img = new Image();
      img.src = link;
      console.log('img:' + img);
      imagesDict[src] = img;
    } else {
      img = new Image();
      img.src = src;
      console.log('img:' + img);
      imagesDict[src] = img;
    }
  }
  console.log('imagesDict: ', imagesDict);
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

function preloadStimuliFiles() {
  // Pre-load sounds to be played into soundsDict to avoid audio lag issues
  if (curStimHasSoundDisplayType()) {
    console.log('Sound type questions detected, pre-loading sounds');
    preloadAudioFiles();
  } else {
    console.log('Non sound type detected');
  }
  if (curStimHasImageDisplayType()) {
    console.log('image type questions detected, pre-loading images');
    preloadImages();
  } else {
    console.log('Non image type detected');
  }
}

function checkUserAudioConfigCompatability(){
  const audioPromptMode = Session.get('audioPromptMode');
  if (curStimHasImageDisplayType() && ((audioPromptMode == 'all' || audioPromptMode == 'question'))) {
    console.log('PANIC: Unable to process TTS for image response', Session.get('currentRootTdfId'));
    alert('Question reading not supported on this TDF. Please disable and try again.');
    leavePage('/profile');
  }
}

function curStimHasSoundDisplayType() {
  const currentStimuliSetId = Session.get('currentStimuliSetId');
  const stimDisplayTypeMap = Session.get('stimDisplayTypeMap');
  return currentStimuliSetId && stimDisplayTypeMap ? stimDisplayTypeMap[currentStimuliSetId].hasAudio : false;
}

function curStimHasImageDisplayType() {
  const currentStimuliSetId = Session.get('currentStimuliSetId');
  const stimDisplayTypeMap = Session.get('stimDisplayTypeMap');
  return currentStimuliSetId && stimDisplayTypeMap ? stimDisplayTypeMap[currentStimuliSetId].hasImage : false;
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
      correctButtonPopulated = false;
    }
    console.log('buttonChoices==falseresponses and correct answer', buttonChoices);
  }
  if (correctButtonPopulated == null) {
    console.log('No correct button');
    throw new Error('Bad TDF/Stim file - no buttonOptions and no false responses');
  }

  const currentAnswer = curExperimentState.originalAnswer;
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

  if (typeof(cluster) == 'undefined' || !cluster.stims || cluster.stims.length == 0 ||
    typeof(cluster.stims[curStimIndex].incorrectResponses) == 'undefined') {
    return []; // No false responses
  } else {
    return cluster.stims[curStimIndex].incorrectResponses;
  }
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
  if (currentSound) {
    try {
      currentSound.stop();
    } catch (e) {
      // Do nothing
    }
    currentSound = null;
  }
}

// Play a sound matching the current question
function playCurrentSound(onEndCallback) {
  // We currently only play one sound at a time
  clearPlayingSound();
  const currentAudioSrc = Session.get('currentDisplay').audioSrc;
  console.log('currentAudioSrc: ' + currentAudioSrc);
  // Reset sound and play it
  currentSound = soundsDict[currentAudioSrc];
  onEndCallbackDict[currentAudioSrc] = onEndCallback;
  currentSound.isCurrentlyPlaying = true;
  currentSound.play();
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
      const answer = Answers.getDisplayAnswerText(curExperimentState.currentAnswer).toLowerCase();
      const originalAnswer = Answers.getDisplayAnswerText(curExperimentState.originalAnswer).toLowerCase();
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
  let isTimeout = false;
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
  } else if (source === 'buttonClick' || source === 'simulation' || source === 'voice') {
    // to save space we will just go ahead and act like it was a key press.
    key = ENTER_KEY;
    Session.set('userAnswerSubmitTimestamp', Date.now());
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

  if(Meteor.isDevelopment)
    Meteor.call('captureProfile', 10000, 'answerTrial');
  
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

  let userAnswer;
  if (isTimeout) {
    userAnswer = '[timeout]';
  } else if (source === 'keypress') {
    userAnswer = _.trim($('#userAnswer').val()).toLowerCase();
  } else if (source === 'buttonClick') {
    userAnswer = e.currentTarget.name;
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
  const afterAnswerFeedbackCallbackWithEndTime = afterAnswerFeedbackCallback.bind(null,
    trialEndTimeStamp, trialStartTimestamp, source, userAnswer);

  // Show user feedback and find out if they answered correctly
  // Note that userAnswerFeedback will display text and/or media - it is
  // our responsbility to decide when to hide it and move on
  userAnswerFeedback(userAnswer, isTimeout, simAnswerCorrect, afterAnswerFeedbackCallbackWithEndTime);
}

// Take care of user feedback - simCorrect will usually be undefined/null BUT if
// it is true or false we know this is part of a simulation call
async function userAnswerFeedback(userAnswer, isTimeout, simCorrect, afterAnswerFeedbackCb) {
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

  const afterAnswerFeedbackCbWithTimeout = afterAnswerFeedbackCb.bind(null, isTimeout);
  const afterAnswerAssessmentCbWithArgs = afterAnswerAssessmentCb.bind(null,
      userAnswer, isCorrectAccumulator, feedbackForAnswer, afterAnswerFeedbackCbWithTimeout);

  // Answer assessment ->
  if (userAnswerWithTimeout != null) {
    displayAnswer = "";
    if(Session.get('hintLevel') && curExperimentState.currentAnswerSyllables){
      displayedHintLevel = Session.get('hintLevel') || 0;
      answerSyllables = curExperimentState.currentAnswerSyllables.syllableArray || "";
      displayAnswer = answerSyllables.slice(0, displayedHintLevel).join("");
    }
    Answers.answerIsCorrect(userAnswerWithTimeout, curExperimentState.currentAnswer, curExperimentState.originalAnswer,
    displayAnswer,setspec, afterAnswerAssessmentCbWithArgs);
  } else {
    afterAnswerAssessmentCbWithArgs(null);
  }
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

  const trueAnswer = Answers.getDisplayAnswerText(curExperimentState.currentAnswer);

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
    historyCorrectMsg = Answers.getDisplayAnswerText(curExperimentState.currentAnswer);
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
    Answers.answerIsCorrect(userAnswerWithTimeout, curExperimentState.currentAnswer, curExperimentState.originalAnswer,
    "",setspec, afterAnswerAssessment);
  } else {
    afterAnswerAssessment(null);
  }
}

function clearScrollList() {
  scrollList.remove({'temp': 1});
  Session.set('scrollListCount', 0);
}


function afterAnswerAssessmentCb(userAnswer, isCorrect, feedbackForAnswer, afterAnswerFeedbackCb, correctAndText) {
  Session.set('isRefutation', undefined);
  if (isCorrect == null && correctAndText != null) {
    isCorrect = correctAndText.isCorrect;
    if (userAnswer != '[timeout]' && userAnswer != '' && !isCorrect && correctAndText.matchText.split(' ')[0] != 'Incorrect.'){
      Session.set('isRefutation', true);
    }
  }

  const afterAnswerFeedbackCbBound = afterAnswerFeedbackCb.bind(null, isCorrect);

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
  const isDrill = (testType === 'd' || testType === 'm' || testType === 'n');
  if (isDrill) {
    const showUserFeedbackBound = function() {
      if (feedbackForAnswer == null && correctAndText != null) {
        feedbackForAnswer = correctAndText.matchText;
      }
      showUserFeedback(isCorrect, feedbackForAnswer, afterAnswerFeedbackCbBound, userAnswer == '[timeout]');
    };
    if (currentDeliveryParams.feedbackType == 'dialogue' && !isCorrect) {
      speechTranscriptionTimeoutsSeen = 0;
      initiateDialogue(userAnswer, afterAnswerFeedbackCbBound, curExperimentState, showUserFeedbackBound);
    } else {
      showUserFeedbackBound();
    }
  } else {
    userFeedbackStart = null;
    afterAnswerFeedbackCbBound();
  }
}

async function showUserFeedback(isCorrect, feedbackMessage, afterAnswerFeedbackCbBound, isTimeout) {
  console.log('showUserFeedback');
  userFeedbackStart = Date.now();
  const isButtonTrial = getButtonTrial();
  // For button trials with images where they get the answer wrong, assume incorrect feedback is an image path
  if (!isCorrect && isButtonTrial && getResponseType() == 'image') {
    $('#UserInteraction').removeClass('text-align alert alert-success alert-danger').html('');
    const buttonImageFeedback = 'Incorrect.  The correct response is displayed below.';
    const correctImageSrc = curExperimentState.originalAnswer;
    $('#UserInteraction').html('<p class="text-align alert alert-danger">' + buttonImageFeedback +
      '</p><img style="background: url(' + correctImageSrc +
      '); background-size:100%; background-repeat: no-repeat;" disabled="" \
      class="btn-alt btn-block btn-image btn-responsive">').show().attr("hidden",false);
  } else {
    $('#UserInteraction')
        .removeClass('alert-success alert-danger')
        .addClass('text-align alert')
        .addClass(isCorrect ? 'alert-success' : 'alert-danger')
        .text(feedbackMessage)
        .attr("hidden",false)
        .show()
        if(!isCorrect){
          $('#CountdownTimer')
            .addClass('text-align')
            .attr("hidden",false)
            .show();

          var countDownStart = new Date().getTime();
          let dialogueHistory;
          if (Session.get('dialogueHistory')) {
            dialogueHistory = JSON.parse(JSON.stringify(Session.get('dialogueHistory')));
          }
          countDownStart += getReviewTimeout(getTestType(), Session.get('currentDeliveryParams'), isCorrect, dialogueHistory, isTimeout);

          var CountdownTimerInterval = Meteor.setInterval(function() {
            var now = new Date().getTime()
            var distance = countDownStart - now;
            var seconds = Math.ceil((distance % (1000 * 60)) / 1000);

            document.getElementById("CountdownTimer").innerHTML = 'Continuing in: ' + seconds + "s";
    
            // If the count down is finished, end interval and clear CountdownTimer
            if (distance < 0) {
              Meteor.clearInterval(CountdownTimerInterval);
              if(window.currentAudioObj) {
                $('#CountdownTimer').text('Continuing after feedback...');
              } else {
                $('#CountdownTimer').text('');
              }
              Session.set('CurIntervalId', undefined);
            }
          }, 100);
          Session.set('CurIntervalId', CountdownTimerInterval);
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

  const isForceCorrectTrial = getTestType() === 'm' || getTestType() === 'n';
  const doForceCorrect = (!isCorrect && !Session.get('runSimulation') &&
    (Session.get('currentDeliveryParams').forceCorrection || isForceCorrectTrial));
  const doClearForceCorrectBound = doClearForceCorrect.bind(null, doForceCorrect, afterAnswerFeedbackCbBound);
  Tracker.afterFlush(doClearForceCorrectBound);
}

// Note the execution thread will finish in the keypress event above for userForceCorrect
let afterUserFeedbackForceCorrectCb = undefined;
function doClearForceCorrect(doForceCorrect, afterAnswerFeedbackCbBound) {
  if (doForceCorrect) {
    $('#forceCorrectionEntry').show().attr("hidden",false);

    if (getTestType() === 'n') {
      const prompt = Session.get('currentDeliveryParams').forcecorrectprompt;
      $('#forceCorrectGuidance').text(prompt);
      speakMessageIfAudioPromptFeedbackEnabled(prompt, 'feedback');

      const forcecorrecttimeout = Session.get('currentDeliveryParams').forcecorrecttimeout;
      beginMainCardTimeout(forcecorrecttimeout, afterAnswerFeedbackCbBound);
    } else {
      const prompt = 'Please enter the correct answer to continue';
      $('#forceCorrectGuidance').text(prompt);
      speakMessageIfAudioPromptFeedbackEnabled(prompt, 'feedback');

      afterUserFeedbackForceCorrectCb = afterAnswerFeedbackCbBound;
    }

    $('#userForceCorrect').prop('disabled', false);
    $('#userForceCorrect').val('').focus();
    startRecording();
  } else {
    $('#forceCorrectGuidance').text('');
    $('#userForceCorrect').prop('disabled', true);
    $('#userForceCorrect').val('');
    afterAnswerFeedbackCbBound();
  }
}

async function giveAnswer(){
  if(Meteor.isDevelopment){
    curAnswer = curExperimentState.currentAnswer.split('~')[0];
    handleUserInput({keyCode: ENTER_KEY, currentTarget: { name: curAnswer } }, 'buttonClick');
  }
}

async function giveWrongAnswer(){
  if(Meteor.isDevelopment){
    curAnswer = curExperimentState.currentAnswer + '123456789321654986321';
    $('#userAnswer').val(curAnswer);
    Session.set('skipTimeout', true)
    handleUserInput({keyCode: ENTER_KEY}, 'keypress');
  }
}

async function afterAnswerFeedbackCallback(trialEndTimeStamp, trialStartTimeStamp, source, userAnswer, isTimeout, isCorrect) {
  Session.set('showDialogueText', false);
  //if the user presses the removal button after answering we need to shortcut the timeout
  const wasReportedForRemoval = source == 'removal';

  const testType = getTestType();
  const deliveryParams = Session.get('currentDeliveryParams')

  let dialogueHistory;
  if (Session.get('dialogueHistory')) {
    dialogueHistory = JSON.parse(JSON.stringify(Session.get('dialogueHistory')));
  }
  const reviewTimeout = wasReportedForRemoval ? 2000 : getReviewTimeout(testType, deliveryParams, isCorrect, dialogueHistory, isTimeout);

  // Stop previous timeout, log response data, and clear up any other vars for next question
  clearCardTimeout();

  Session.set('feedbackTimeoutBegins', Date.now())
  const answerLogRecord = gatherAnswerLogRecord(trialEndTimeStamp, trialStartTimeStamp, source, userAnswer, isCorrect,
      testType, deliveryParams, dialogueHistory, wasReportedForRemoval);

  Session.set('answerLogRecord', answerLogRecord);
  Session.set('engine', engine);
  Session.set('trialEndTimeStamp', trialEndTimeStamp);
  Session.set('testType', testType);
  Session.set('isCorrect', isCorrect);
  Session.set('isTimeout', isTimeout);
  Session.set('trialStartTimeStamp', trialStartTimeStamp);
  const afterFeedbackCallbackBind = afterFeedbackCallback.bind(null, trialEndTimeStamp, trialStartTimeStamp, isTimeout, isCorrect, testType, deliveryParams, answerLogRecord, 'card')
  const timeout = Meteor.setTimeout(async function() {
    afterFeedbackCallbackBind()
  }, reviewTimeout)
  Session.set('CurTimeoutId', timeout)

  if(Session.get('unitType') == "model")
    engine.calculateIndices().then(function(res, err) {
      Session.set('engineIndices', res );
    })
  else
    Session.set('engineIndices', undefined);
}

async function afterFeedbackCallback(trialEndTimeStamp, trialStartTimeStamp, isTimeout, isCorrect, testType, deliveryParams, answerLogRecord, callLocation) {
  Session.set('CurTimeoutId', null)
  const userLeavingTrial = callLocation != 'card';
  let reviewEnd = Date.now();
  Session.set('isTimeout', null);
  Session.set('isCorrect', null);
  Session.set('trialEndTimeStamp', null);
  Session.set('answerLogRecord', null);
  Session.set('engine', null);
  Session.set('CurTimeoutId', undefined);
  Session.set('trialStartTimeStamp', undefined);
      
  let {responseDuration, startLatency, endLatency, feedbackLatency} = getTrialTime(trialEndTimeStamp, trialStartTimeStamp, reviewEnd, testType);

  const answerLogAction = isTimeout ? '[timeout]' : 'answer';
  //if dialogueStart is set that means the user went through interactive dialogue
  Session.set('dialogueTotalTime', undefined);
  Session.set('dialogueHistory', undefined);
  const newExperimentState = {
    lastAction: answerLogAction,
    lastActionTimeStamp: Date.now(),
  };
  
  if (testType !== 'i') {
    const overallOutcomeHistory = Session.get('overallOutcomeHistory');
    overallOutcomeHistory.push(isCorrect ? 1 : 0);
    newExperimentState.overallOutcomeHistory = overallOutcomeHistory;
    Session.set('overallOutcomeHistory', overallOutcomeHistory);
  }

  // Give unit engine a chance to update any necessary stats
  const practiceTime = endLatency + feedbackLatency;
  if(userLeavingTrial){
    engine.cardAnswered(isCorrect, practiceTime);
  } else {
    await engine.cardAnswered(isCorrect, practiceTime);
  }
  console.log('writing answerLogRecord to history:', answerLogRecord);
  if(Meteor.user().profile === undefined || !Meteor.user().profile.impersonating){
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
        cardEnd();
      });
    } else {
      cardEnd();
    }
  }
}

async function cardEnd() {
  hideUserFeedback();
  $('#userAnswer').val('');
  Session.set('feedbackTimeoutEnds', Date.now())
  prepareCard();
}

function getReviewTimeout(testType, deliveryParams, isCorrect, dialogueHistory, isTimeout) {
  let reviewTimeout = 0;

  if (testType === 's' || testType === 'f') {
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
  const sessCurrentAnswerSyllables = curExperimentState.currentAnswerSyllables;
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

  const problemName = curExperimentState.originalDisplay;
  const stepName = problemName;
  // let stepCount = (state.stepNameSeen[stepName] || 0) + 1;
  // state.stepNameSeen[stepName] = stepCount;
  // stepName = stepCount + " " + stepName;
  const isStudy = testType === 's';
  let shufIndex;
  let schedCondition = 'N/A';
  if (engine.unitType == SCHEDULE_UNIT) {
    const sched = Session.get('schedule');
    if (sched && sched.q && sched.q.length) {
      const schedItemIndex = Session.get('questionIndex') - 1;
      clusterIndex = schedItemIndex;
      if (schedItemIndex >= 0 && schedItemIndex < sched.q.length) {
        schedCondition = parseSchedItemCondition(sched.q[schedItemIndex].condition);
        shufIndex = sched.q[schedItemIndex].clusterIndex;
      }
    }
  } else {
    shufIndex = cluster.shufIndex;
  }
  const originalAnswer = curExperimentState.originalAnswer;
  const currentAnswer = curExperimentState.currentAnswer;
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
  if (!isStudy)
    outcome = 'incorrect';
  if (isCorrect) 
    outcome = 'correct';
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
    'conditionTypeE': Meteor.user().profile.entryPoint && 
        Meteor.user().profile.entryPoint !== 'direct' ? Meteor.user().profile.entryPoint : null,

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
    'CFAudioInputEnabled': Session.get('audioEnabled'),
    'CFAudioOutputEnabled': Session.get('enableAudioPromptAndFeedback'),
    'CFDisplayOrder': Session.get('questionIndex'),
    'CFStimFileIndex': clusterIndex,
    'CFSetShuffledIndex': shufIndex || clusterIndex,
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
    'entryPoint': Meteor.user().profile.entryPoint
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
  $('#UserInteraction').removeClass('text-align alert alert-success alert-danger').html('').hide();
  $('#userForceCorrect').val(''); // text box - see inputF.html
  $('#forceCorrectionEntry').hide(); // Container
  $('#removeQuestion').hide();
}

// Called when the current unit is done. This should be either unit-defined (see
// prepareCard) or user-initiated (see the continue button event and the var
// len display timeout function)
async function unitIsFinished(reason) {
  clearCardTimeout();

  const curTdf = Session.get('currentTdfFile');
  const curUnitNum = Session.get('currentUnitNumber');
  const newUnitNum = curUnitNum + 1;
  const curTdfUnit = curTdf.tdfs.tutor.unit[newUnitNum];

  Session.set('questionIndex', 0);
  Session.set('clusterIndex', undefined);
  Session.set('currentUnitNumber', newUnitNum);
  Session.set('currentTdfUnit', curTdfUnit);
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
    leaveTarget = '/instructions';
  } else {
    // We have run out of units - return home for now
    console.log('UNIT FINISHED: No More Units');
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
    lastActionTimeStamp: Date.now(),
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
  let isButtonTrial = 'true' === (curUnit.buttontrial ? curUnit.buttontrial.toLowerCase() : "");

  const curCardInfo = engine.findCurrentCardInfo();
  if (curCardInfo.forceButtonTrial) {
    // Did this question specifically override button trial?
    isButtonTrial = true;
  } else {
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

  // Always hide the final instructions box
  $('#finalInstructionsDlg').modal('hide');
  // the card loads frequently, but we only want to set this the first time
  if (Session.get('inResume')) {
    Session.set('buttonTrial', false);
    Session.set('buttonList', []);

    console.log('cards template rendered => Performing resume');
    curExperimentState.showOverlearningText = false;

    Session.set('inResume', false); // Turn this off to keep from re-resuming
    resumeFromComponentState();
  }
}

async function prepareCard() {
  Meteor.logoutOtherClients();
  Session.set('wasReportedForRemoval', false);
  Session.set('displayReady', false);
  Session.set('currentDisplay', {});
  console.log('displayReadyFalse, prepareCard');
  $('#helpButton').prop("disabled",false);
  if (engine.unitFinished()) {
    unitIsFinished('Unit Engine');
  } else {
    await engine.selectNextCard(Session.get('engineIndices'), curExperimentState);
    await newQuestionHandler();
    Session.set('cardStartTimestamp', Date.now());
    Session.set('engineIndices', undefined);
  }
}

// TODO: this probably no longer needs to be separate from prepareCard
async function newQuestionHandler() {
  console.log('newQuestionHandler - Secs since unit start:', elapsedSecs());

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
  console.log('newQuestionHandler, isButtonTrial', isButtonTrial);

  if (isButtonTrial) {
    $('#textEntryRow').hide();
    setUpButtonTrial();
  } else {
    $('#textEntryRow').show().attr("hidden",false);
  }

  // If this is a study-trial and we are displaying a cloze, then we should
  // construct the question to display the actual information. Note that we
  // use a regex so that we can do a global(all matches) replace on 3 or
  // more underscores
  if ((getTestType() === 's' || getTestType() === 'f') && !!(curExperimentState.currentDisplayEngine.clozeText)) {
    const currentDisplay = curExperimentState.currentDisplayEngine;
    const clozeQuestionFilledIn = Answers.clozeStudy(currentDisplay.clozeText, curExperimentState.currentAnswer);
    currentDisplay.clozeText = clozeQuestionFilledIn;
    const newExperimentState = {currentDisplayEngine: currentDisplay};
    updateExperimentState(newExperimentState, 'card.newQuestionHandler');
    curExperimentState.currentDisplayEngine = currentDisplay;
  }

  startQuestionTimeout();
  checkSimulation();

  if (curExperimentState.showOverlearningText) {
    $('#overlearningRow').show().attr("hidden",false);
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
  const currentDisplayEngine = curExperimentState.currentDisplayEngine;

  // make sure we get the right audio source
  if(currentDisplayEngine) {
    if(currentDisplayEngine.audioSrc && !soundsDict[currentDisplayEngine.audioSrc]) {
      let source = DynamicAssets.findOne({name: currentDisplayEngine.audioSrc}).link()
      currentDisplayEngine.audioSrc = source;
    }
  }

  console.log('startQuestionTimeout, closeQuestionParts', curExperimentState.clozeQuestionParts);

  Session.set('displayReady', false);
  console.log('++++ CURRENT DISPLAY ++++');
  console.log(currentDisplayEngine);
  console.log('-------------------------');

  const beginQuestionAndInitiateUserInputBound = beginQuestionAndInitiateUserInput.bind(null, delayMs, deliveryParams);
  const pipeline = checkAndDisplayTwoPartQuestion.bind(null,
      deliveryParams, currentDisplayEngine, curExperimentState.clozeQuestionParts, beginQuestionAndInitiateUserInputBound);
  checkAndDisplayPrestimulus(deliveryParams, pipeline);
}

function checkAndDisplayPrestimulus(deliveryParams, nextStageCb) {
  console.log('checking for prestimulus display');
  // we'll [0], if it exists
  const prestimulusDisplay = Session.get('currentTdfFile').tdfs.tutor.setspec.prestimulusDisplay;
  console.log('prestimulusDisplay:', prestimulusDisplay);

  if (prestimulusDisplay) {
    const prestimulusDisplayWrapper = {'text': prestimulusDisplay};
    console.log('prestimulusDisplay detected, displaying', prestimulusDisplayWrapper);
    Session.set('currentDisplay', prestimulusDisplayWrapper);
    Session.set('displayReady', true);
    const prestimulusdisplaytime = deliveryParams.prestimulusdisplaytime;
    console.log('delaying for ' + prestimulusdisplaytime + ' ms then starting question', new Date());
    setTimeout(function() {
      console.log('past prestimulusdisplaytime, start two part question logic');
      nextStageCb();
    }, prestimulusdisplaytime);
  } else {
    console.log('no prestimulusDisplay detected, continuing to next stage');
    nextStageCb();
  }
}

function checkAndDisplayTwoPartQuestion(deliveryParams, currentDisplayEngine, closeQuestionParts, nextStageCb) {
  // In either case we want to set up the current display now
  Session.set('displayReady', false);
  Session.set('currentDisplay', currentDisplayEngine);
  curExperimentState.clozeQuestionParts = closeQuestionParts;
  Session.set('displayReady', true);

  console.log('checking for two part questions');
  // Handle two part questions
  const currentQuestionPart2 = curExperimentState.currentQuestionPart2;
  if (currentQuestionPart2) {
    console.log('two part question detected, displaying first part');
    const twoPartQuestionWrapper = {'text': currentQuestionPart2};
    const initialviewTimeDelay = deliveryParams.initialview;
    console.log('two part question detected, delaying for ' + initialviewTimeDelay + ' ms then continuing');
    setTimeout(function() {
      console.log('after timeout, displaying question part two', new Date());
      Session.set('displayReady', false);
      Session.set('currentDisplay', twoPartQuestionWrapper);
      Session.set('displayReady', true);
      console.log('displayReadyTrue, checkAndDisplayTwoPartQuestion');
      curExperimentState.currentQuestionPart2 = undefined;
      redoCardImage();
      nextStageCb();
    }, initialviewTimeDelay);
  } else {
    console.log('one part question detected, continuing with question');
    nextStageCb();
  }
}

function beginQuestionAndInitiateUserInput(delayMs, deliveryParams) {
  console.log('beginQuestionAndInitiateUserInput');
  firstKeypressTimestamp = 0;
  trialStartTimestamp = Date.now();
  console.log(trialStartTimestamp)
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
  inputDisabled = false;
  startRecording();

  // Need timeout here so that the disable input timeout doesn't fire after this
  setTimeout(async function() {
    if (typeof inputDisabled != 'undefined') {
      // Use inputDisabled variable so that successive calls of stop and allow
      // are resolved synchronously i.e. whoever last set the inputDisabled variable
      // should win
      $('#continueStudy, #userAnswer, #multipleChoiceContainer button').prop('disabled', inputDisabled);
      inputDisabled = undefined;
    } else {
      $('#continueStudy, #userAnswer, #multipleChoiceContainer button').prop('disabled', false);
    }
    // Force scrolling to bottom of screen for the input
    scrollElementIntoView(null, false);

    const textFocus = !getButtonTrial();
    if (textFocus) {
      try {
        $('#userAnswer').focus();
      } catch (e) {
        // Do nothing
      }
    }
  }, 200);
}

function scrollElementIntoView(selector, scrollType) {
  Meteor.setTimeout(function() {
    Tracker.afterFlush(function() {
      if (selector === null) {
        window.scrollTo(0, scrollType ? 0 : document.body.scrollHeight);
      } else {
        $(selector).get(0).scrollIntoView(scrollType ? true : false);
      }
      console.log('Scrolled for', selector, scrollType);
    });
  }, 1);
}

// This records the synchronous state of whether input should be enabled or disabled
// without this we get into the situation where either stopUserInput fails because
// the DOM hasn't fully updated yet or worse allowUserInput fails because the DOM
// loads before it and stopUserInput is erroneously executed afterwards due to timing issues
let inputDisabled = undefined;
function stopUserInput() {
  console.log('stop user input');
  inputDisabled = true;
  stopRecording();

  // Need a delay here so we can wait for the DOM to load before manipulating it
  setTimeout(function() {
    console.log('after delay, stopping user input');
    $('#continueStudy, #userAnswer, #multipleChoiceContainer button').prop('disabled', true);
  }, 200);
}

// BEGIN WEB AUDIO section

// Audio prompt/feedback
function speakMessageIfAudioPromptFeedbackEnabled(msg, audioPromptSource) {
  const enableAudioPromptAndFeedback = Session.get('enableAudioPromptAndFeedback');
  const audioPromptMode = Session.get('audioPromptMode');
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

    const tdfSpeechAPIKey = Session.get('currentTdfFile').tdfs.tutor.setspec.speechAPIKey;
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
      if (transcript == 'skip') {
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
  let userAnswer;
  if (getButtonTrial()) {
    console.log('button trial, setting user answer to verbalChoice');
    userAnswer = $('[verbalChoice=\'' + transcript + '\']')[0];
    if (!userAnswer) {
      console.log('Choice couldn\'t be found');
      ignoredOrSilent = true;
    }
  } else if (DialogueUtils.isUserInDialogueLoop()) {
    if (DialogueUtils.isUserInDialogueIntroExit()) {
      speechTranscriptionTimeoutsSeen = 0;
    } else {
      console.log('dialogue loop -> transcribe to dialogue user answer');
      DialogueUtils.setDialogueUserAnswerValue(transcript);
    }
  } else {
    userAnswer = inUserForceCorrect ? document.getElementById('userForceCorrect') :
        document.getElementById('userAnswer');
    console.log('regular trial, transcribing user response to user answer box');
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
        handleUserInput({}, 'voice');
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
  if (recorder && !Session.get('recordingLocked') && Session.get('audioEnabledView')) {
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
  const curExperimentState = GlobalExperimentStates.findOne().experimentState;
  const sessExpState = Session.get('currentExperimentState');
  console.log('getExperimentState:', curExperimentState, sessExpState);
  Meteor.call('updatePerformanceData', 'utlQuery', 'card.getExperimentState', Meteor.userId());
  Session.set('currentExperimentState', curExperimentState);
  return curExperimentState || {};
}

function updateExperimentState(newState, codeCallLocation, unitEngineOverride = {}) {
  console.log('currentExperimentState:', curExperimentState);
  if (unitEngineOverride && Object.keys(unitEngineOverride).length > 0)
    curExperimentState = unitEngineOverride;
  else if (!curExperimentState)
    curExperimentState = {};

  let experimentId = curExperimentState._id;
  if(!experimentId){
    let globalExperimentState = GlobalExperimentStates.findOne({TDFId: newState.currentTdfId});
    if(globalExperimentState){
      experimentId = globalExperimentState._id;
    } else {
      curExperimentState = Object.assign(JSON.parse(JSON.stringify(curExperimentState)), newState);
      GlobalExperimentStates.insert({
        userId: Meteor.userId(),
        TDFId: curExperimentState.currentTdfId,
        experimentState: curExperimentState
      });
      console.log('updateExperimentState', codeCallLocation, '\nnew:', curExperimentState);
      return Session.get('currentRootTdfId');
    }
  }
  delete curExperimentState._id;
  curExperimentState = Object.assign(JSON.parse(JSON.stringify(curExperimentState)), newState);
  GlobalExperimentStates.update({_id: experimentId}, {$set: {experimentState: curExperimentState}});
  curExperimentState._id = experimentId;
  console.log('updateExperimentState', codeCallLocation, '\nnew:', curExperimentState);
  return Session.get('currentRootTdfId');
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
  const rootTDFBoxed = Tdfs.findOne({_id: Session.get('currentRootTdfId')});
  const rootTDF = rootTDFBoxed.content;
  if (!rootTDF) {
    console.log('PANIC: Unable to load the root TDF for learning', Session.get('currentRootTdfId'));
    alert('Unfortunately, something is broken and this lesson cannot continue');
    leavePage('/profile');
    return;
  }
  const setspec = rootTDF.tdfs.tutor.setspec;
  const needExpCondition = (setspec.condition && setspec.condition.length);

  const experimentState = await getExperimentState();
  const newExperimentState = JSON.parse(JSON.stringify(experimentState));

  // We must always check for experiment condition
  if (needExpCondition) {
    console.log('Experimental condition is required: searching');
    const prevCondition = experimentState.conditionTdfId;

    let conditionTdfId = null;

    if (prevCondition) {
      // Use previous condition and log a notification that we did so
      console.log('Found previous experimental condition: using that');
      conditionTdfId = prevCondition;
    } else {
      // Select condition and save it
      console.log('No previous experimental condition: Selecting from ' + setspec.condition.length);
      const shortFileName =  _.sample(setspec.condition).replace('.json', '').replace('.xml', '')
      conditionTdfId = Tdfs.findOne({"content.fileName": shortFileName, stimuliSetId: stimuliSetId})._id;
      newExperimentState.conditionTdfId = conditionTdfId;
      newExperimentState.conditionNote = 'Selected from ' + _.display(setspec.condition.length) + ' conditions';
      console.log('Exp Condition', conditionTdfId, newExperimentState.conditionNote);
    }

    if (!conditionTdfId) {
      console.log('No experimental condition could be selected!');
      alert('Unfortunately, something is broken and this lesson cannot continue');
      leavePage('/profile');
      return;
    }

    // Now we have a different current TDF (but root stays the same)
    Session.set('currentTdfId', conditionTdfId);

    const curTdf = Tdfs.findOne({_id: conditionTdfId});
    Session.set('currentTdfFile', curTdf.content);
    Session.set('currentTdfName', curTdf.content.fileName);

    // Also need to read new stimulus file (and note that we allow an exception
    // to kill us if the current tdf is broken and has no stimulus file)
    Session.set('currentStimuliSetId', curTdf.stimuliSetId);
    console.log('condition stimuliSetId', curTdf);
  } else {
    Session.set('currentTdfFile', rootTDF);
    Session.set('currentTdfName', rootTDF.fileName);
    Session.set('currentTdfId', Session.get('currentRootTdfId'));
    Session.set('currentStimuliSetId', rootTDFBoxed.stimuliSetId);

    // Just notify that we're skipping
    console.log('No Experimental condition is required: continuing', rootTDFBoxed);
  }

  const stimuliSetId = Session.get('currentStimuliSetId');
  const stimuliSet = Tdfs.findOne({ stimuliSetId: stimuliSetId }).stimuli

  Session.set('currentStimuliSet', stimuliSet);
  Session.set('feedbackUnset', Session.get('fromInstructions') || Session.get('feedbackUnset'));
  Session.set('fromInstructions', false);

  preloadStimuliFiles();
  checkUserAudioConfigCompatability();

  // In addition to experimental condition, we allow a root TDF to specify
  // that the xcond parameter used for selecting from multiple deliveryParms's
  // is to be system assigned (as opposed to URL-specified)
  if (setspec.randomizedDelivery && setspec.randomizedDelivery.length) {
    console.log('xcond for delivery params is sys assigned: searching');
    const prevExperimentXCond = experimentState.experimentXCond;

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
  let clusterMapping = experimentState.clusterMapping;
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

    while (shuffles.length > 0 || swaps.length > 0) {
      clusterMapping = createStimClusterMapping(
          stimCount,
          shuffles.shift() || '',
          swaps.shift() || '',
          clusterMapping,
      );
      console.log('while', clusterMapping);
    }
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

  if (experimentState.currentUnitNumber) {
    Session.set('currentUnitNumber', experimentState.currentUnitNumber);
  } else {
    Session.set('currentUnitNumber', 0);
    newExperimentState.currentUnitNumber = 0;
    newExperimentState.lastUnitStarted = 0;
  }

  const curTdfUnit = Session.get('currentTdfFile').tdfs.tutor.unit[Session.get('currentUnitNumber')];
  Session.set('currentTdfUnit', curTdfUnit);
  console.log('resume, currentTdfUnit:', curTdfUnit);

  if (experimentState.questionIndex) {
    Session.set('questionIndex', experimentState.questionIndex);
  } else {
    Session.set('questionIndex', 0);
    newExperimentState.questionIndex = 0;
  }

  updateExperimentState(newExperimentState, 'card.resumeFromComponentState');

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

// cached syllables depreciated by mongo migration
// async function checkSyllableCacheForCurrentStimFile(cb) {
//   const currentStimuliSetId = Session.get('currentStimuliSetId');
//   cachedSyllables = StimSyllables.findOne({filename: currentStimuliSetId});
//   console.log('cachedSyllables start: ', cachedSyllables);
//   if (!cachedSyllables) {
//     console.log('no cached syllables for this stim, calling server method to create them');
//     Meteor.call('updateStimSyllables', currentStimuliSetId, function() {
//       // cachedSyllables = StimSyllables.findOne({filename: currentStimuliSetId});
//       // console.log('new cachedSyllables: ', cachedSyllables);
//       cb();
//     });
//   } else {
//     cb();
//   }
// }

async function removeCardByUser() {
  Meteor.clearTimeout(Session.get('CurTimeoutId'));
  Meteor.clearInterval(Session.get('CurIntervalId'));
  Session.set('CurTimeoutId', undefined);
  Session.set('CurIntervalId', undefined);
  document.getElementById("CountdownTimer").innerHTML = "";
  $('#removalFeedback').show().attr("hidden",false);

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
    } else if (tdfFile.tdfs.tutor.unit[curUnitNum].learningsession) {
      engine = await createModelUnit(curExperimentData);
    } else {
      engine = await createEmptyUnit(curExperimentData); // used for instructional units
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
    // They are DONE!
    console.log('TDF already completed - leaving for profile page.');
    if (Meteor.user().profile.loginMode === 'experiment') {
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

    if (needFirstUnitInstructions && typeof curTdfUnit.unitinstructions !== 'undefined') {
      // They haven't seen our first instruction yet
      console.log('RESUME FINISHED: displaying initial instructions');
      leavePage('/instructions');
    } else if (resumeToQuestion) {
      // Question outstanding: force question display and let them give an answer
      console.log('RESUME FINISHED: displaying current question');
      await newQuestionHandler();
    } else {
      // If we get this far and the unit engine thinks the unit is finished,
      // we might need to stick with the instructions *IF AND ONLY IF* the
      // lockout period hasn't finished (which prepareCard won't handle)
      if (engine.unitFinished()) {
        let lockoutMins = Session.get('currentDeliveryParams').lockoutminutes;
        if (lockoutMins > 0) {
          let unitStartTimestamp = Session.get('currentUnitStartTime');
          if(Meteor.user().profile?.lockouts && Meteor.user().profile.lockouts[Session.get('currentTdfId')] && 
          Meteor.user().profile.lockouts[Session.get('currentTdfId')].currentLockoutUnit == Session.get('currentUnitNumber')){
            unitStartTimestamp = Meteor.user().profile.lockouts[Session.get('currentTdfId')].lockoutTimeStamp;
            lockoutMins = Meteor.user().profile.lockouts[Session.get('currentTdfId')].lockoutMinutes;
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
