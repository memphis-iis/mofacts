import {secsIntervalString} from '../../../common/globalHelpers';
import {haveMeteorUser} from '../../lib/currentTestingHelpers';
import {updateExperimentState} from './card';
import {routeToSignin} from '../../lib/router';

export {instructContinue};
// //////////////////////////////////////////////////////////////////////////
// Instruction timer and leaving this page - we don't want to leave a
// timer running!

let lockoutInterval = null;
let lockoutFreeTime = null;
let lockoutHandled = false;
let serverNotify = null;
// Will get set on first periodic check and cleared when we leave the page
let displayTimeStart = null;

function startLockoutInterval() {
  clearLockoutInterval();
  // See below for lockoutPeriodicCheck - notice that we also do an immediate
  // check and then start the interval
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
    Router.go(dest);
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
function currLockOutMinutes() {
  if(Meteor.user() && Meteor.user().profile.lockouts && Meteor.user().profile.lockouts[Session.get('currentTdfId')] &&
  Meteor.user().profile.lockouts[Session.get('currentTdfId')].currentLockoutUnit == Session.get('currentUnitNumber')){
    // user has started the lockout previously
    const userLockout = Meteor.user().profile.lockouts[Session.get('currentTdfId')];
    const lockoutTimeStamp = userLockout.lockoutTimeStamp;
    const lockoutMinutes = userLockout.lockoutMinutes;
    const lockoutTime = lockoutTimeStamp + lockoutMinutes*60*1000;
    const currTime = new Date().getTime();
    if(currTime < lockoutTime){
      // lockout is still in effect
      const newLockoutMinutes = Math.ceil((lockoutTime - currTime)/(60*1000));
      logLockout(newLockoutMinutes);
      return newLockoutMinutes;
    }
  } else {
    // user has not started the lockout previously
    const lockoutminutes = parseInt(Session.get('currentDeliveryParams').lockoutminutes || 0);
    if(lockoutminutes > 0){
      Meteor.call('setLockoutTimeStamp', new Date().getTime(), lockoutminutes, Session.get('currentUnitNumber'), Session.get('currentTdfId'));
    }
    logLockout(lockoutminutes);
    return lockoutminutes;
  }
}

function lockoutKick() {
  const display = getDisplayTimeouts();
  const doDisplay = (display.minSecs > 0 || display.maxSecs > 0);
  const doLockout = (!lockoutInterval && currLockOutMinutes() > 0);
  if (doDisplay || doLockout) {
    console.log('interval kicked');
    startLockoutInterval();
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
    const lockoutMins = currLockOutMinutes();
    if (lockoutMins) {
      lockoutFreeTime = unitStartTimestamp + lockoutMins * (60 * 1000); // Minutes to millisecs
    }
  }

  // Lockout handling
  if (Date.now() >= lockoutFreeTime) {
    // All done - clear out time remaining, hide the display, enable the
    // continue button, and stop the lockout timer
    if (!lockoutHandled) {
      $('#lockoutTimeRemaining').html('');
      $('#lockoutDisplay').hide();
      $('#continueButton').prop('disabled', false);
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
        if (Meteor.user().profile.loginMode !== 'experiment') {
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
function instructContinue() {
  const curUnit = Session.get('currentTdfUnit');

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
      lastActionTimeStamp: Date.now(),
    };

    const res = await updateExperimentState(newExperimentState, 'instructions.instructContinue');
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
    return Meteor.user().profile.loginMode === 'experiment';
  },

  isNormal: function() {
    return Meteor.user().profile.loginMode !== 'experiment';
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
    return Session.get('currentTdfUnit').unitinstructions;
  },

  instructionQuestion: function(){
    return Session.get('currentTdfUnit').unitinstructionsquestion;
  },

  displayContinueButton: function(){
    if(typeof Session.get('instructionQuestionResults') === "undefined" && typeof Session.get('currentTdfFile').tdfs.tutor.unit[0].unitinstructionsquestion !== "undefined"){
      return false;
    } else {
      return true;
    }
  },

  islockout: function() {
    return currLockOutMinutes() > 0;
  },

  lockoutminutes: function() {
    return currLockOutMinutes();
  },

  username: function() {
    if (!haveMeteorUser()) {
      leavePage(routeToSignin);
    } else {
      return Meteor.user().username;
    }
  },

  allowcontinue: function() {
    // If we're in experiment mode, they can only continue if there are
    // units left.
    if (Meteor.user().profile.loginMode === 'experiment') {
      return getUnitsRemaining() > 0;
    } else {
      return true;
    }
  },
});

Template.instructions.rendered = function() {
  // Make sure lockout interval timer is running
  lockoutKick();
  if(typeof Session.get('currentTdfFile').tdfs.tutor.unit[0].unitinstructions !== "undefined"){
    $('#continueBar').show();
  }
};

// //////////////////////////////////////////////////////////////////////////
// Template Events

Template.instructions.events({
  'click #continueButton': function(event) {
    event.preventDefault();
    instructContinue();
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
