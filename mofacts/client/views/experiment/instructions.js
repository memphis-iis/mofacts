import {secsIntervalString} from '../../../common/globalHelpers';
import {haveMeteorUser} from '../../lib/currentTestingHelpers';
import {updateExperimentState, initCard} from './card';
import {routeToSignin} from '../../lib/router';
import { meteorCallAsync } from '../../index';
import { _ } from 'core-js';
import { revisitUnit, getExperimentState } from './card';

export {instructContinue, unitHasLockout, checkForFileImage};
// //////////////////////////////////////////////////////////////////////////
// Instruction timer and leaving this page - we don't want to leave a
// timer running!

let lockoutInterval = null;
let lockoutFreeTime = null;
let lockoutHandled = false;
let serverNotify = null;
// Will get set on first periodic check and cleared when we leave the page
let displayTimeStart = null;
let timeRendered = 0

function startLockoutInterval() {
  clearLockoutInterval();
  lockoutPeriodicCheck();
  lockoutInterval = Meteor.setInterval(lockoutPeriodicCheck, 250);
}

function clearLockoutInterval() {
  if (lockoutInterval) {
    Meteor.clearInterval(lockoutInterval);
  }
  lockoutInterval = null;
  lockoutFreeTime = null;
  lockoutHandled = false;
  serverNotify = null;
}

function leavePage(dest) {
  clearLockoutInterval();
  displayTimeStart = null;
  if (typeof dest === 'function') {
    dest();
  } else {
    if(dest == '/card' && document.location.pathname == '/card'){
      // we are already on the card page, so we need to force a reload
      initCard();
    } else {
      Router.go(dest);
    }
  }
}

// //////////////////////////////////////////////////////////////////////////
// Utility functions used below

// Added because the LOCKOUT call overwhelms the console - so we throttle to one
// call every 1000ms (1 second)
const logLockout = _.throttle(
    function(lockoutminutes) {
      console.log('LOCKOUT:', lockoutminutes, 'min');
    },
    250,
);

// Return current TDF unit's lockout minutes (or 0 if none-specified)
function currLockOut() {
  if(Meteor.user() && Meteor.user().lockouts && Meteor.user().lockouts[Session.get('currentTdfId')] &&
  Meteor.user().lockouts[Session.get('currentTdfId')].currentLockoutUnit == Session.get('currentUnitNumber')){
    // user has started the lockout previously
    const userLockout = Meteor.user().lockouts[Session.get('currentTdfId')];
    const lockoutTimeStamp = userLockout.lockoutTimeStamp;
    const lockoutMinutes = userLockout.lockoutMinutes;
    const lockoutTime = lockoutTimeStamp + lockoutMinutes*60*1000;
    const currTime = Date.now();
    const newLockout = lockoutTime - currTime;
    return newLockout;
  } else {
    return 0;
  }
}

function checkForFileImage(string) {
  let div = document.createElement('div');
  div.innerHTML = string;
  let images = div.getElementsByTagName('img')
  for(let image of images){
    let imgSrc = image ? image.getAttribute("src") : "";
    image = DynamicAssets.findOne({name: imgSrc});
    if(image)
    string = string.replace(imgSrc, image.link())
  }
  return string
}

function unitHasLockout() {
  if(Meteor.user() && Meteor.user().lockouts && Meteor.user().lockouts[Session.get('currentTdfId')] &&
  Meteor.user().lockouts[Session.get('currentTdfId')].currentLockoutUnit == Session.get('currentUnitNumber')){
    const userLockout = Meteor.user().lockouts[Session.get('currentTdfId')];
    const lockoutTimeStamp = userLockout.lockoutTimeStamp;
    const lockoutMinutes = userLockout.lockoutMinutes;
    const lockoutTime = lockoutTimeStamp + lockoutMinutes*60*1000;
    const currTime = new Date().getTime();
    if(currTime < lockoutTime){
      const newLockoutMinutes = Math.ceil((lockoutTime - currTime)/(60*1000));
      return newLockoutMinutes;
    }
  } else {
    const lockoutminutes = parseInt(Session.get('currentDeliveryParams').lockoutminutes || 0);
    return lockoutminutes;
  }
}

async function lockoutKick() {
  const display = getDisplayTimeouts();
  //if an existing lockout is not in place, we will set one if the current unit has a lockout
  const lockoutminutes = parseInt(Session.get('currentDeliveryParams').lockoutminutes || 0);
  if(lockoutminutes > 0 && !checkForExistingLockout()){
    await meteorCallAsync('setLockoutTimeStamp', new Date().getTime(), lockoutminutes, Session.get('currentUnitNumber'), Session.get('currentTdfId'));
    startLockoutInterval();
    return
  }
  logLockout(lockoutminutes);
  const doDisplay = (display.minSecs > 0 || display.maxSecs > 0);
  const doLockout = (!lockoutInterval && currLockOut() > 0);
  if (doDisplay || doLockout) {
    console.log('interval kicked');
    startLockoutInterval();
  }
}


function checkForExistingLockout() {
  if(Meteor.user() && Meteor.user().lockouts && Meteor.user().lockouts[Session.get('currentTdfId')] &&
  Meteor.user().lockouts[Session.get('currentTdfId')].currentLockoutUnit == Session.get('currentUnitNumber')){
    return true;
  } else {
    return false;
  }
}
  
// Min and Max display seconds: if these are enabled, they determine
// potential messages, the continue button functionality, and may even move
// the screen forward. HOWEVER, the lockout functionality currently overrides
// this functionality (i.e. we don't check this stuff while we are locked out)
function getDisplayTimeouts() {
  const unit = Session.get('currentTdfUnit');
  return {
    'minSecs': parseInt((unit ? unit.instructionminseconds : 0) || 0),
    'maxSecs': parseInt((unit ? unit.instructionmaxseconds : 0) || 0),
  };
}

function setDispTimeoutText(txt) {
  let msg = _.trim(txt || '');
  if (msg.length > 0) {
    msg = ' (' + msg + ')';
  }
  $('#displayTimeoutMsg').text(msg);
}

// Called intermittently to see if we are still locked out
function lockoutPeriodicCheck() {
  if (!lockoutFreeTime) {
    const unitStartTimestamp = Session.get('currentUnitStartTime');
    const lockoutMins = currLockOut();
    if (lockoutMins) {
      lockoutFreeTime = unitStartTimestamp + lockoutMins;
    }
  }

  // Lockout handling
  //if the user is an admin, we will allow them to continue
  user = Meteor.user();
  isAnAdmin = Roles.userIsInRole(user, 'admin');
  if (Date.now() >= lockoutFreeTime || isAnAdmin) {
    // All done - clear out time remaining, hide the display, enable the
    // continue button, and stop the lockout timer
    if (!lockoutHandled) {
      $('#lockoutTimeRemaining').html('');
      $('#lockoutDisplay').hide();
      $('#continueButton').prop('disabled', false);
      $('#continueBar').show();
      // Since the interval will continue to fire, we need to know we've
      // done this
      lockoutHandled = true;
    }
  } else {
    // Still locked - handle and then bail

    // Figure out how to display time remaining
    const timeLeft = Math.floor((lockoutFreeTime - Date.now()) / 1000.0);
    const timeLeftDisplay = 'Time Remaining: ' + secsIntervalString(timeLeft);

    // Insure they can see the lockout message, update the time remaining
    // message, and disable the continue button
    $('#lockoutDisplay').show();
    $('#lockoutTimeRemaining').text(timeLeftDisplay);
    $('#continueButton').prop('disabled', true);

    // Make sure that the server knows a lockout has been detected - but
    // we only need to call it once
    if (serverNotify === null) {
      serverNotify = function() {
        if (Meteor.user().loginParams.loginMode !== 'experiment') {
          return; // Nothing to do
        }

        // We're in experiment mode and locked out - if they should get a Turk email,
        // now is the time to let the server know we've shown a lockout msg
        const currUnit = Session.get('currentTdfUnit');
        const turkemail = _.trim(currUnit.turkemail);
        const subject = _.trim(currUnit.turkemailsubject);

        if (!turkemail) {
          return; // No message to show
        }

        const experimentId = Session.get('currentRootTdfId');

        Meteor.call('turkScheduleLockoutMessage', experimentId, lockoutFreeTime + 1, subject, turkemail,
            function(error) {
              if (typeof error !== 'undefined') {
                console.log('Server schedule failed. Error:', error);
              } else {
                console.log('Server accepted lockout msg schedule', lockoutFreeTime + 1, turkemail);
              }
            });
      };
      serverNotify();
    }
    // IMPORTANT: we're leaving
    return;
  }

  // Lockout logic has been handled - if we're here then we're unlocked
  // Get the display min/max handling
  const display = getDisplayTimeouts();
  if (display.minSecs > 0 || display.maxSecs > 0) {
    if (!displayTimeStart) {
      displayTimeStart = Date.now(); // Start tracking time
    }

    const elapsedSecs = Math.floor((1.0 + Date.now() - displayTimeStart) / 1000.0);

    if (elapsedSecs <= display.minSecs) {
      // Haven't reached min yet
      $('#continueButton').prop('disabled', true);
      const dispLeft = display.minSecs - elapsedSecs;
      if (dispLeft >= 1.0) {
        setDispTimeoutText('You can continue in: ' + secsIntervalString(dispLeft));
      } else {
        setDispTimeoutText(''); // Don't display 0 secs
      }
    } else if (elapsedSecs <= display.maxSecs) {
      // Between min and max
      $('#continueButton').prop('disabled', false);
      const dispLeft = display.maxSecs - elapsedSecs;
      if (dispLeft >= 1.0) {
        setDispTimeoutText('Time remaining: ' + secsIntervalString(dispLeft));
      } else {
        setDispTimeoutText('');
      }
    } else if (display.maxSecs > 0.0) {
      // Past max and a max was specified - it's time to go
      $('#continueButton').prop('disabled', true);
      setDispTimeoutText('');
      instructContinue();
    } else {
      // Past max and no valid maximum - they get a continue button
      $('#continueButton').prop('disabled', false);
      setDispTimeoutText('You can continue whenever you want');
    }
  } else {
    // No display handling - if lockout is fine then we can stop polling
    $('#continueButton').prop('disabled', false);
    setDispTimeoutText('');
    if (lockoutHandled) {
      clearLockoutInterval();
    }
  }
}

// Get units left to display/execute - note that the current unit isn't
// counted. Ex: if you have three units (0, 1, 2) and unit 1 is the current
// unit, then you have 1 unit remaining. If there are no units or there is
// we return 0
function getUnitsRemaining() {
  let unitsLeft = 0;

  const thisTdf = Session.get('currentTdfFile');
  if (thisTdf) {
    let unitCount = 0;
    if (typeof thisTdf.tdfs.tutor.unit !== 'undefined' && thisTdf.tdfs.tutor.unit.length) {
      unitCount = thisTdf.tdfs.tutor.unit.length;
    }
    if (unitCount > 0) {
      const unitIdx = Session.get('currentUnitNumber') || 0;
      unitsLeft = (unitCount - unitIdx);
      if (unitsLeft < 0) {
        unitsLeft = 0;
      }
    }
  }

  return unitsLeft;
}

// Called when users continues to next screen.
// SUPER-IMPORTANT: note that this can be called outside this template, so it
// must only reference visible from anywhere on the client AND we take great
// pains to not modify anything reactive until this function has returned
async function instructContinue() {
  let curUnit = Session.get('currentTdfUnit');
  if(!curUnit){
    let experimentState = await getExperimentState()
    curUnit = experimentState.currentTdfFile.tdfs.tutor.unit[Session.get('currentUnitNumber')];
  }

  let feedbackText = curUnit.unitinstructions && curUnit.unitinstructions.length > 0 ?
    curUnit.unitinstructions.trim() : '';
  if (feedbackText.length < 1) feedbackText = curUnit.picture ? curUnit.picture.trim() : '';


  // Record the fact that we just showed instruction. Also - we use a call
  // back to redirect to the card display screen to make sure that everything
  // has been properly logged on the server. We do all this in an async
  // timeout because we don't know if we've been called from a reactive func
  // and we don't want to trigger any re-calculations
  Meteor.setTimeout(async function() {
    // Get the start time for instructions (set in router.js). IMPORTANT: we
    // wait until here to do this in case instructContinue was called from a
    // reactive function
    const instructionClientStart = _.intval(Session.get('instructionClientStart'));
    Session.set('instructionClientStart', 0);

    const newExperimentState = {
      instructionClientStart: instructionClientStart,
      feedbackText: feedbackText,
      lastAction: 'instructions',
    };

    const res = await updateExperimentState(newExperimentState, 'instructions.instructContinue');
    Session.set('curUnitInstructionsSeen', true);
    console.log('instructions,new experiment state:', newExperimentState);
    console.log('instructContinue', res);
    Session.set('inResume', true);
    leavePage('/card');
    Session.set('fromInstructions', true);
    Session.set('enterKeyLock', false);
    console.log('releasing enterKeyLock in instructContinue');
  }, 1);
}


Template.instructions.helpers({
  isExperiment: function() {
    return Meteor.user().loginParams.loginMode === 'experiment';
  },

  isNormal: function() {
    return Meteor.user().loginParams.loginMode !== 'experiment';
  },

  backgroundImage: function() {
    const currUnit = Session.get('currentTdfUnit');
    let img = '';

    if (currUnit && currUnit.picture) {
      img = currUnit.picture;
    }

    return img;
  },

  instructionText: function() {
    return checkForFileImage(Session.get('currentTdfUnit').unitinstructions);
  },

  instructionQuestion: function(){
    return checkForFileImage(Session.get('currentTdfUnit').unitinstructionsquestion);
  },

  islockout: function() {
    return currLockOut() > 0;
  },

  lockoutminutes: function() {
    return currLockOut();
  },

  username: function() {
    if (!haveMeteorUser()) {
      leavePage(routeToSignin);
    } else {
      return Meteor.user().username;
    }
  },

  UISettings: function() {
    return Session.get('currentUISettings');
  },

  allowcontinue: function() {
    // If we're in experiment mode, they can only continue if there are
    // units left.
    if (Meteor.user().loginParams.loginMode === 'experiment') {
      return getUnitsRemaining() > 0;
    } else {
      return true;
    }
  },
    'curTdfName': function(){
    lessonname = Session.get('currentTdfFile').tdfs.tutor.setspec.lessonname;
    console.log("lessonname",lessonname);
    return lessonname;
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
});

Template.instructions.rendered = function() {
  // Make sure lockout interval timer is running
  lockoutKick();
  timeRendered = Date.now();
  const unitInstructionsExist = typeof Session.get('currentTdfFile').tdfs.tutor.unit[Session.get('currentUnitNumber')].unitinstructions !== "undefined";
  const instructionQuestionExists = typeof Session.get('instructionQuestionResults') === "undefined";
  const unitInstructionsQuestionExists = typeof Session.get('currentTdfFile').tdfs.tutor.unit[Session.get('currentUnitNumber')].unitinstructionsquestion !== "undefined";
  const displayContinueBotton = unitInstructionsExist || instructionQuestionExists || unitInstructionsQuestionExists;
};


// instructionlog 

function gatherInstructionLogRecord(trialEndTimeStamp, trialStartTimeStamp,  
  deliveryParams) {

  // Figure out button trial entries
  const curTdf = Session.get('currentTdfFile');
  const unitName = Session.get('currentTdfUnit').unitname;

  const instructionLog = {
    'userId': Meteor.userId(),
    'TDFId': Session.get('currentTdfId'),
    'sectionId': Session.get('curSectionId'),
    'teacherId': Session.get('curTeacher')?._id,
    'anonStudentId': Meteor.user().username,
    'sessionID': Meteor.default_connection._lastSessionId,
    'conditionNameA': 'tdf file',
    // Note: we use this to enrich the history record server side, change both places if at all
    'conditionTypeA': Session.get('currentTdfName'),
    'conditionNameB': 'xcondition',
    'conditionTypeB': Session.get('experimentXCond') || null,
    'conditionNameE': 'section',
    'conditionTypeE': Meteor.user().loginParams.entryPoint && 
        Meteor.user().loginParams.entryPoint !== 'direct' ? Meteor.user().loginParams.entryPoint : null,
    'responseDuration': null,
    'levelUnit': Session.get('currentUnitNumber'),
    'levelUnitType': "Instruction",
    'time': trialStartTimeStamp,
    'CFAudioInputEnabled': Meteor.user().audioInputMode,
    'CFAudioOutputEnabled': Session.get('enableAudioPromptAndFeedback'),
    'CFResponseTime': trialEndTimeStamp,
    'entryPoint': Meteor.user().loginParams.entryPoint
  };
  return instructionLog;
}

// //////////////////////////////////////////////////////////////////////////
// Template Events

Template.instructions.events({
  'click #continueButton': function(event) {
    event.preventDefault();
    //record the unit instructions if the unit setspec has the recordInstructions tag set to true
    // OR if the tdf setspec has the recordInstructions tag set to true
    // OR if the tdf setspec has the recordInstructions has an array of unit numbers that includes the current unit number
    const curUnit = Session.get('currentUnitNumber');
    const curTdf = Session.get('currentTdfFile');
    if(typeof curUnit.recordInstructions === "undefined"){
      curUnit.recordInstructions = true;
    } 
    if(typeof curTdf.tdfs.tutor.setspec.recordInstructions === "undefined"){
      curTdf.tdfs.tutor.setspec.recordInstructions = true;
    }
    typeof curTdf.tdfs.tutor.setspec.recordInstructions === "array" ? recordInstructionsIncludesUnit = curTdf.tdfs.tutor.setspec.recordInstructions.includes(curUnit) : recordInstructionsIncludesUnit = false;
    const recordInstructions = curUnit.recordInstructions || recordInstructionsIncludesUnit|| curTdf.tdfs.tutor.setspec.recordInstructions === true || curTdf.tdfs.tutor.setspec.recordInstructions === "true";
    if(recordInstructions){
      const instructionLog = gatherInstructionLogRecord(Date.now(), timeRendered, Session.get('currentDeliveryParams'));
      console.log('instructionLog', instructionLog);
      Meteor.call('insertHistory', instructionLog)
    }
    instructContinue();
  },
  'click #stepBackButton': function(event) {
    event.preventDefault();
    //get the current unit number and decrement it by 1
    let curUnit = Session.get('currentUnitNumber');
    let newUnitNumber = curUnit - 1;
    revisitUnit(newUnitNumber);
  },
  'click #instructionQuestionAffrimative': function() {
    Session.set('instructionQuestionResults',true);
    $('#instructionQuestion').hide();
  },
  'click #instructionQuestionNegative': function() {
    Session.set('instructionQuestionResults',false);
    $('#instructionQuestion').hide();
  }
});
