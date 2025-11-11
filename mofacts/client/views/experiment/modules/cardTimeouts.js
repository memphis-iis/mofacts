/**
 * cardTimeouts.js - Timeout and Interval Management Module
 *
 * Extracted from card.js as part of C1 refactoring (Phase 1)
 *
 * This module provides centralized timeout/interval management for the card template,
 * including:
 * - Timeout registry for debugging and cleanup
 * - Main card timeout coordination
 * - Display timeout management
 * - Review/feedback timeout calculation
 *
 * Dependencies: Minimal - Session, cardState, timeoutState, srState
 *
 * @module cardTimeouts
 */

import { Session } from 'meteor/session';
import { Meteor } from 'meteor/meteor';
import { ReactiveDict } from 'meteor/reactive-dict';
import { secsIntervalString } from '../../../../common/globalHelpers';
import { clientConsole } from '../../../index';

// ============================================================================
// Module Variables
// ============================================================================

// Centralized Timeout Registry - tracks all active timeouts/intervals for debugging
// Maps timeout name → {id, type, delay, created, description}
const activeTimeouts = new Map();

// Main card timeout state (shared across functions)
// NOTE: simTimeoutName kept in card.js (used by checkSimulation which will move to cardUtils in Phase 3)
let currentTimeoutFunc = null;
let currentTimeoutDelay = null;
let countdownInterval = null;
let cardStartTime = null;  // Declared explicitly (was implicit global in card.js)

// ============================================================================
// Timeout Registry Functions
// ============================================================================

/**
 * Register a timeout with the centralized system
 * @param {string} name - Unique name for this timeout
 * @param {function} callback - Function to call when timeout fires
 * @param {number} delay - Delay in milliseconds
 * @param {string} description - Optional description for debugging
 * @returns {number} The timeout ID
 */
export function registerTimeout(name, callback, delay, description = '') {
  const id = setTimeout(() => {
    activeTimeouts.delete(name);
    callback();
  }, delay);

  activeTimeouts.set(name, {
    id,
    type: 'timeout',
    delay,
    created: Date.now(),
    description
  });

  return id;
}

/**
 * Register an interval with the centralized system
 * @param {string} name - Unique name for this interval
 * @param {function} callback - Function to call on each interval
 * @param {number} delay - Delay in milliseconds between calls
 * @param {string} description - Optional description for debugging
 * @returns {number} The interval ID
 */
export function registerInterval(name, callback, delay, description = '') {
  // Clear any existing interval with this name first to prevent orphaned intervals
  clearRegisteredTimeout(name);

  const id = setInterval(callback, delay);

  activeTimeouts.set(name, {
    id,
    type: 'interval',
    delay,
    created: Date.now(),
    description
  });

  return id;
}

/**
 * Clear a specific registered timeout/interval
 * @param {string} name - Name of timeout/interval to clear
 */
export function clearRegisteredTimeout(name) {
  const entry = activeTimeouts.get(name);
  if (entry) {
    if (entry.type === 'timeout') {
      clearTimeout(entry.id);
    } else {
      clearInterval(entry.id);
    }
    activeTimeouts.delete(name);
    clientConsole(2, `[TIMEOUT] Cleared: ${name}`);
  }
}

/**
 * Clear all registered timeouts/intervals (useful for cleanup)
 */
export function clearAllRegisteredTimeouts() {
  for (const [name, entry] of activeTimeouts) {
    if (entry.type === 'timeout') {
      clearTimeout(entry.id);
    } else {
      clearInterval(entry.id);
    }
  }
  activeTimeouts.clear();
  clientConsole(2, '[TIMEOUT] Cleared all registered timeouts');
}

/**
 * Debug helper - list all active timeouts
 * @returns {Array} List of active timeout info objects
 */
export function listActiveTimeouts() {
  if (activeTimeouts.size === 0) {
    clientConsole(2, '[TIMEOUT] No active timeouts');
    return [];
  }

  const now = Date.now();
  const list = [];
  for (const [name, entry] of activeTimeouts) {
    const elapsed = now - entry.created;
    list.push({
      name,
      type: entry.type,
      delay: entry.delay,
      elapsed,
      remaining: entry.type === 'timeout' ? Math.max(0, entry.delay - elapsed) : 'N/A',
      description: entry.description
    });
  }

  console.table(list);
  return list;
}

// Expose debug helpers to window for console access
if (Meteor.isDevelopment) {
  window.listActiveTimeouts = listActiveTimeouts;
  window.clearAllRegisteredTimeouts = clearAllRegisteredTimeouts;
}

// ============================================================================
// Timing Helper Functions
// ============================================================================

/**
 * Return elapsed seconds since unit started
 * Note: Technically seconds since unit RESUME began (when we set currentUnitStartTime)
 * @returns {number} Elapsed seconds
 */
export function elapsedSecs() {
  return (Date.now() - Session.get('currentUnitStartTime')) / 1000.0;
}

/**
 * Get min and max display timeouts from current TDF unit
 * These determine potential messages, continue button functionality, and auto-advance
 * @returns {{minSecs: number, maxSecs: number}}
 */
export function getDisplayTimeouts() {
  const curUnit = Session.get('currentTdfUnit');
  // Safely handle undefined curUnit or learningsession
  const session = (curUnit && curUnit.learningsession) || null;
  return {
    'minSecs': parseInt((session ? session.displayminseconds : 0) || 0),
    'maxSecs': parseInt((session ? session.displaymaxseconds : 0) || 0),
  };
}

/**
 * Set display timeout message text
 * @param {string} txt - Message to display
 */
export function setDispTimeoutText(txt) {
  let msg = _.trim(txt || '');
  if (msg.length > 0) {
    msg = ' (' + msg + ')';
  }
  $('#displayTimeoutMsg').text(msg);
}

/**
 * Calculate review/feedback timeout duration based on trial type and correctness
 * @param {string} testType - Trial type ('d', 's', 't', 'f', 'm', 'n', 'i')
 * @param {Object} deliveryParams - TDF delivery parameters
 * @param {boolean} isCorrect - Whether answer was correct
 * @param {Object} dialogueHistory - Dialogue session history
 * @param {boolean} isTimeout - Whether trial timed out
 * @param {boolean} isSkip - Whether to skip timeout
 * @param {ReactiveDict} cardState - Card state ReactiveDict
 * @returns {number} Timeout duration in milliseconds
 */
export function getReviewTimeout(testType, deliveryParams, isCorrect, dialogueHistory, isTimeout, isSkip, cardState) {
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
      } else if(cardState.get('isRefutation') && !isTimeout) {
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
  if(Meteor.isDevelopment && cardState.get('skipTimeout')){
    reviewTimeout = 0.001;
    cardState.set('skipTimeout', false);
  }
  // We need at least a timeout of 1ms
  if (reviewTimeout < 0.001) throw new Error('No correct timeout specified');

  return reviewTimeout;
}

// ============================================================================
// Card Timeout Management Functions
// ============================================================================

/**
 * Clear all card-related timeouts and intervals
 * This should be called before routing to other templates to prevent
 * timeouts from firing repeatedly
 *
 * NOTE: simTimeoutName (used by checkSimulation) is NOT cleared here - it stays in card.js
 * and will be cleared there when needed. It will move to cardUtils in Phase 3.
 *
 * @param {ReactiveDict} timeoutState - Timeout state ReactiveDict
 * @param {ReactiveDict} cardState - Card state ReactiveDict
 */
export function clearCardTimeout(timeoutState, cardState) {
  const safeClear = function(clearFunc, clearParm) {
    try {
      if (clearParm) {
        clearFunc(clearParm);
      }
    } catch (e) {
      clientConsole(1, 'Error clearing meteor timeout/interval', e);
    }
  };
  safeClear(Meteor.clearTimeout, timeoutState.get('name'));
  // NOTE: simTimeoutName NOT cleared here - stays in card.js for now
  safeClear(Meteor.clearInterval, cardState.get('varLenTimeoutName'));
  safeClear(Meteor.clearInterval, countdownInterval);
  timeoutState.set('name', null);
  currentTimeoutFunc = null;
  currentTimeoutDelay = null;
  countdownInterval = null;
  cardState.set('varLenTimeoutName', null);
}

/**
 * Clear timeout and immediately fire the timeout function if one exists
 * Used when forcing immediate advancement (e.g., force correct mode)
 * @param {ReactiveDict} timeoutState - Timeout state ReactiveDict
 * @param {ReactiveDict} cardState - Card state ReactiveDict
 */
export function clearAndFireTimeout(timeoutState, cardState) {
  const savedFunc = currentTimeoutFunc;
  clearCardTimeout(timeoutState, cardState);
  if (typeof savedFunc === 'function') {
    savedFunc();
  }
}

/**
 * Start main card timeout with countdown display
 * Note: Params reversed from Meteor.setTimeout - makes calling code cleaner
 * @param {number} delay - Delay in milliseconds
 * @param {function} func - Function to call when timeout fires
 * @param {ReactiveDict} cardState - Card state ReactiveDict
 * @param {ReactiveDict} timeoutState - Timeout state ReactiveDict
 * @param {ReactiveDict} srState - Speech recognition state ReactiveDict
 * @param {function} onNavigateAway - Callback when navigating away from card (optional)
 */
export function beginMainCardTimeout(delay, func, cardState, timeoutState, srState, onNavigateAway = null) {
  clientConsole(2, 'beginMainCardTimeout');
  clearCardTimeout(timeoutState, cardState);

  // Cache UI settings at function start
  const uiSettings = Session.get('curTdfUISettings');
  const displayMode = uiSettings.displayCardTimeoutAsBarOrText;

  currentTimeoutFunc = function() {
    const numRemainingLocks = cardState.get('pausedLocks');
    if (numRemainingLocks > 0) {
      clientConsole(2, 'timeout reached but there are', numRemainingLocks, 'locks outstanding');
    } else if (srState.get('waitingForTranscription')) {
      clientConsole(2, '[SR] timeout reached but waiting for speech transcription, delaying timeout');
      // Retry timeout after a short delay to give transcription more time
      // This prevents timeout from firing while Google Speech API is processing
      clearCardTimeout(timeoutState, cardState);
      beginMainCardTimeout(3000, func, cardState, timeoutState, srState, onNavigateAway); // Give 3 more seconds for transcription
    } else {
      if (document.location.pathname != '/card') {
        if (onNavigateAway) {
          onNavigateAway(function() {
            clientConsole(2, 'cleaning up page after nav away from card');
          });
        }
      } else if (typeof func === 'function') {
        func();
      } else {
        clientConsole(1, 'function!!!:', func);
      }
    }
  };
  currentTimeoutDelay = delay;
  const mainCardTimeoutStart = new Date();
  cardState.set('mainCardTimeoutStart', mainCardTimeoutStart);
  clientConsole(2, 'mainCardTimeoutStart', mainCardTimeoutStart);
  timeoutState.set('name', Meteor.setTimeout(currentTimeoutFunc, currentTimeoutDelay));
  cardStartTime = Date.now();
 if(displayMode == "text" || displayMode == "both"){
  //set the countdown timer text
  $('#CountdownTimerText').removeAttr('hidden');
 } else {
   $('#CountdownTimerText').attr('hidden', '');
 }
  countdownInterval = Meteor.setInterval(function() {
    const remaining = Math.round((currentTimeoutDelay - (Date.now() - cardStartTime)) / 1000);
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
      percent = 100 - (remaining * 1000 / currentTimeoutDelay * 100);
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
  cardState.set('varLenTimeoutName', Meteor.setInterval(() => varLenDisplayTimeout(cardState, timeoutState, null), 400));
}

/**
 * Reset the previously set timeout counter
 * @param {ReactiveDict} cardState - Card state ReactiveDict
 * @param {ReactiveDict} timeoutState - Timeout state ReactiveDict
 */
export function resetMainCardTimeout(cardState, timeoutState) {
  clientConsole(2, 'RESETTING MAIN CARD TIMEOUT');
  const savedFunc = currentTimeoutFunc;
  const savedDelay = currentTimeoutDelay;
  clearCardTimeout(timeoutState, cardState);
  currentTimeoutFunc = savedFunc;
  currentTimeoutDelay = savedDelay;
  const mainCardTimeoutStart = new Date();
  cardState.set('mainCardTimeoutStart', mainCardTimeoutStart);
  clientConsole(2, 'reset, mainCardTimeoutStart:', mainCardTimeoutStart);
  timeoutState.set('name', Meteor.setTimeout(savedFunc, savedDelay));
  cardState.set('varLenTimeoutName', Meteor.setInterval(() => varLenDisplayTimeout(cardState, timeoutState, null), 400));
}

/**
 * Restart main card timeout if necessary after pause/modal
 * TODO: there is a minor bug here related to not being able to truly pause on
 * re-entering a tdf for the first trial
 * @param {ReactiveDict} cardState - Card state ReactiveDict
 * @param {ReactiveDict} timeoutState - Timeout state ReactiveDict
 */
export function restartMainCardTimeoutIfNecessary(cardState, timeoutState) {
  clientConsole(2, 'restartMainCardTimeoutIfNecessary');
  const mainCardTimeoutStart = cardState.get('mainCardTimeoutStart');
  if (!mainCardTimeoutStart) {
    const numRemainingLocks = cardState.get('pausedLocks')-1;
    cardState.set('pausedLocks', numRemainingLocks);
    return;
  }
  const errorReportStart = Session.get('errorReportStart');
  Session.set('errorReportStart', null);
  const usedDelayTime = errorReportStart - mainCardTimeoutStart;
  const remainingDelay = currentTimeoutDelay - usedDelayTime;
  currentTimeoutDelay = remainingDelay;
  const rightNow = new Date();
  cardState.set('mainCardTimeoutStart', rightNow);
  function wrappedTimeout() {
    const numRemainingLocks = cardState.get('pausedLocks')-1;
    cardState.set('pausedLocks', numRemainingLocks);
    if (numRemainingLocks <= 0) {
      const func = currentTimeoutFunc;
      if (func) func();
    } else {
      clientConsole(2, 'timeout reached but there are', numRemainingLocks, 'locks outstanding');
    }
  }
  timeoutState.set('name', Meteor.setTimeout(wrappedTimeout, remainingDelay));
  cardState.set('varLenTimeoutName', Meteor.setInterval(() => varLenDisplayTimeout(cardState, timeoutState, null), 400));
}

/**
 * Variable-length display timeout handler
 * Manages continue button state and display timeout messages based on min/max display times
 * @param {ReactiveDict} cardState - Card state ReactiveDict
 * @param {ReactiveDict} timeoutState - Timeout state ReactiveDict
 * @param {function} onUnitFinished - Callback when max display time exceeded (optional)
 */
export function varLenDisplayTimeout(cardState, timeoutState, onUnitFinished = null) {
  const display = getDisplayTimeouts();
  if (!(display.minSecs > 0.0 || display.maxSecs > 0.0)) {
    // No variable display parameters - we can stop the interval
    $('#continueButton').prop('disabled', false);
    setDispTimeoutText('');
    Meteor.clearInterval(cardState.get('varLenTimeoutName'));
    cardState.set('varLenTimeoutName', null);
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
    if (onUnitFinished) {
      onUnitFinished('DisplaMaxSecs exceeded');
    }
  } else {
    // Past max and no valid maximum - they get a continue button
    $('#continueButton').prop('disabled', false);
    setDispTimeoutText('You can continue whenever you want');
  }
}
