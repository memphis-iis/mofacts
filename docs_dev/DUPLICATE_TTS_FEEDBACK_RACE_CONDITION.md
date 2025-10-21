# Duplicate TTS Feedback Race Condition Analysis

**Date:** 2025-10-20
**Issue:** TTS feedback triggers twice intermittently during timeout scenarios
**Severity:** HIGH - Degrades user experience with duplicate audio/text

---

## Executive Summary

The system has a **state machine violation** where voice input (`[SR]` subsystem) can trigger `handleUserInput()` while already in `FEEDBACK.SHOWING` state. This violates the state machine's design principle that **only `PRESENTING.AWAITING` should accept user input**.

### The Race Condition Timeline

```
16:45:29 - Trial times out (10 seconds)
  → handleUserInput(source='timeout') called
  → showUserFeedback() called
  → STATE: PRESENTING.AWAITING → FEEDBACK.SHOWING ✓ VALID
  → TTS #1 starts: "The correct answer is Gabon"
  → Display text updated

16:45:30 - User says "skip" WHILE feedback showing
  → [SR] VOICE START/STOP events fire
  → processLINEAR16() called (speech recognition continues!)
  → speechAPICallback() receives transcript "skip"
  → handleUserInput(source='voice', answer='skip') called
  → STATE: FEEDBACK.SHOWING (no transition - invalid!)
  → showUserFeedback() called AGAIN
  → TTS #2 starts: "The correct answer is Gabon" (DUPLICATE!)
  → Display text updated AGAIN
```

**Root Cause:** The speech recognition system (`[SR]`) **does not check the main trial state** before processing transcriptions and calling `handleUserInput()`.

---

## State Machine Analysis

### Valid State Transitions (from VALID_TRANSITIONS)

```javascript
[TRIAL_STATES.PRESENTING_AWAITING]: [
  TRIAL_STATES.FEEDBACK_SHOWING,     // For drill (shows feedback)
  TRIAL_STATES.TRANSITION_START      // For test (skips feedback)
],

[TRIAL_STATES.FEEDBACK_SHOWING]: [
  TRIAL_STATES.TRANSITION_START  // ONLY valid transition!
],
```

**The Problem:** When in `FEEDBACK.SHOWING` state:
- **Valid next state:** `TRANSITION.START` (move to next trial)
- **Invalid:** Calling `handleUserInput()` again (tries to transition back to `FEEDBACK.SHOWING`)

### What the Trace Shows

```
[SM] handleUserInput called in state: FEEDBACK.SHOWING source: voice
[SM] stopUserInput called in state: FEEDBACK.SHOWING
[SM] showUserFeedback called in state: FEEDBACK.SHOWING
[SM] ❌ [Trial 1] INVALID STATE TRANSITION: FEEDBACK.SHOWING → FEEDBACK.SHOWING
   Valid transitions from FEEDBACK.SHOWING: TRANSITION.START
   Reason: Showing feedback (incorrect)
[SM] ✓ [Trial 1] STATE: FEEDBACK.SHOWING → FEEDBACK.SHOWING (Showing feedback (incorrect))
```

**Analysis:**
1. System correctly **logs the invalid transition** ✓
2. System **allows it anyway** ❌ (line 1619: "Don't throw - just log")
3. `showUserFeedback()` executes fully, triggering duplicate TTS and text

---

## Speech Recognition Lifecycle Issue

### The SR State Machine Within Main State Machine

From `SPEECH_RECOGNITION_STATE_MACHINE.md`:

```
MAIN TRIAL: PRESENTING.AWAITING
    ↓
    SR: WAITING_FOR_INPUT
    SR: DETECTING_SPEECH
    SR: PROCESSING_AUDIO
    SR: WAITING_FOR_TRANSCRIPTION
    SR: TRANSCRIPTION_RECEIVED
    SR: VALIDATING_ANSWER
    SR: VALID → handleUserInput()  ← THIS IS THE PROBLEM
    ↓
MAIN TRIAL: FEEDBACK.SHOWING (or TRANSITION if test trial)
```

**The Bug:** The SR subsystem assumes it's **always safe** to call `handleUserInput()` after receiving a valid transcription. It doesn't check:
- Is the main trial still in `PRESENTING.AWAITING`?
- Has feedback already started?
- Is input still allowed?

### Where Recording Should Stop But Doesn't

Looking at the trace:

```
16:45:29 - Timeout fires
  [SM] stop User input called in state: PRESENTING.AWAITING
  [SM] handleUserInput called in state: PRESENTING.AWAITING source: timeout
  [SM] showUserFeedback called in state: PRESENTING.AWAITING
  [SM] STATE: PRESENTING.AWAITING → FEEDBACK.SHOWING
  [SR] 🎤 TTS request started (ttsRequested=true)

16:45:30 - Voice detected (0.7 seconds later!)
  [SR] VOICE START
  [SR] RESETMAINCARDTIMEOUT NOT DEFINED  ← Key clue!
```

**Critical Observation:** `RESETMAINCARDTIMEOUT NOT DEFINED` means:
- The timeout already fired and was cleared
- `stopUserInput()` was called
- **But recording was NOT stopped!**

### Why Recording Continues

Let me trace through `stopUserInput()`:

```javascript
// card.js:3727-3744 - stopUserInput()
function stopUserInput() {
  clientConsole(2, 'stop user input');
  clientConsole(2, '[SM] stopUserInput called in state:', currentTrialState);

  inputDisabled = true;
  $('#userAnswer').prop('disabled', true);

  // Delay before stopping recording to allow final speech to process
  setTimeout(() => {
    clientConsole(2, 'after delay, stopping user input');
    if (recorder && Session.get('recording')) {
      stopRecording();
    }
  }, 1200); // ← 1.2 SECOND DELAY!
}
```

**THE SMOKING GUN:** There's a **1.2 second delay** before `stopRecording()` is called!

This means:
1. Timeout fires at 16:45:29
2. `stopUserInput()` called immediately
3. `stopRecording()` scheduled for 16:45:30.2 (1.2 seconds later)
4. User says "skip" at 16:45:30.0 (0.7 seconds after timeout)
5. Recording is **still active**, processes the speech ✓
6. Transcription comes back at 16:45:33, calls `handleUserInput()`
7. State is now `FEEDBACK.SHOWING` - invalid!

---

## The Design Problem

### Two Asynchronous Pipelines Racing

**Pipeline 1: Timeout → Feedback**
```
16:45:29.000 - Timeout fires
16:45:29.001 - handleUserInput(source='timeout')
16:45:29.002 - showUserFeedback()
16:45:29.003 - STATE → FEEDBACK.SHOWING
16:45:29.010 - TTS starts
```

**Pipeline 2: Voice Recognition** (running in parallel!)
```
16:45:30.000 - User speaks "skip"
16:45:30.010 - VOICE START
16:45:30.430 - VOICE STOP
16:45:30.431 - processLINEAR16() starts
16:45:30.500 - Google API call initiated
16:45:33.000 - speechAPICallback() fires (3 seconds later!)
16:45:33.001 - handleUserInput(source='voice') ← TOO LATE, wrong state!
```

**The Gap:** Between VOICE STOP (16:45:30) and speechAPICallback (16:45:33), the main state machine has already transitioned to `FEEDBACK.SHOWING`. When the SR callback finally fires, it's **operating on stale state assumptions**.

---

## Why the 1.2 Second Delay Exists

From the code comments and structure, this delay exists to handle:
1. **Final speech fragments:** User might still be finishing their answer when timeout fires
2. **API latency:** Google Speech API needs buffer time to process
3. **Grace period:** Prevents cutting off valid answers at exactly 10.000 seconds

**The Intent:** Allow in-flight speech recognition to complete even after timeout

**The Reality:** Creates a race condition where speech from AFTER the timeout can still trigger actions

---

## Solution Analysis

### Option 1: Simple Guard (Your Initial Instinct) ❌ NOT SUFFICIENT

```javascript
function handleUserInput(e, source, simAnswerCorrect) {
  // Guard: Reject input if not in AWAITING state
  if (currentTrialState !== TRIAL_STATES.PRESENTING_AWAITING) {
    clientConsole(2, '[SM] Ignoring input - not in AWAITING state:', currentTrialState);
    return;
  }
  // ... rest of function
}
```

**Why This Isn't Enough:**
- Doesn't stop recording at the right time
- Doesn't cancel in-flight API calls
- Wastes resources processing speech that will be ignored
- Still shows user "waiting for transcription" message
- Doesn't address the fundamental async timing issue

### Option 2: State-Aware Speech Recognition ✅ PROPER FIX

**Principle:** The SR subsystem must **respect the main state machine** at every checkpoint.

#### 2.1: Add State Check in `speechAPICallback()`

This is the **final gate** before calling `handleUserInput()`:

```javascript
// card.js:4617 - speechAPICallback()
function speechAPICallback(err, data){
  // Clear the waiting flag
  waitingForTranscription = false;
  clientConsole(2, '[SR] speechAPICallback received, set waitingForTranscription=false');

  // ✅ NEW: Check if we're still in a valid state for input
  if (currentTrialState !== TRIAL_STATES.PRESENTING_AWAITING) {
    clientConsole(2, '[SR] ⚠️ Transcription arrived too late - trial state is:', currentTrialState);
    clientConsole(2, '[SR] Discarding transcription to prevent state machine violation');

    // Clear the "waiting for transcription" message if still showing
    const userAnswer = document.getElementById('userAnswer');
    if (userAnswer && userAnswer.value === 'waiting for transcription') {
      userAnswer.value = '';
    }

    return; // ← EXIT EARLY
  }

  // Original code continues here...
  let answerGrammar = [];
  let response = {};
  // ...
}
```

**Why This Works:**
- Checks state at the **last possible moment** before acting
- Prevents invalid `handleUserInput()` calls
- Cleans up UI artifacts ("waiting for transcription")
- Allows the timeout pathway to proceed normally
- Gracefully handles the race condition

#### 2.2: Improve `stopRecording()` Timing

**Current Problem:** The 1.2s delay is arbitrary and creates the race window.

**Better Approach:** Tie recording stop to **state transitions**, not timeouts:

```javascript
// card.js - Modify showUserFeedback()
async function showUserFeedback(isCorrect, feedbackMessage, isTimeout, isSkip) {
  clientConsole(2, '[SM] showUserFeedback called in state:', currentTrialState);

  // STATE MACHINE: Transition to FEEDBACK.SHOWING (drill only, test skips feedback)
  if (trialShowsFeedback()) {
    transitionTrialState(TRIAL_STATES.FEEDBACK_SHOWING, `Showing feedback (${isCorrect ? 'correct' : 'incorrect'})`);
  }

  // ✅ NEW: Immediately stop recording when entering FEEDBACK phase
  // No delayed setTimeout - we're done accepting input
  if (recorder && Session.get('recording')) {
    clientConsole(2, '[SR] Stopping recording - entered FEEDBACK phase');
    stopRecording();
  }

  // ... rest of function
}
```

**Rationale:**
- **State machine principle:** `FEEDBACK.SHOWING` does not accept input
- Recording should stop **synchronously** when entering this state
- The 1.2s delay was a band-aid for poor state management
- With the `speechAPICallback()` guard, late transcriptions are safely ignored

#### 2.3: Add Defensive Check in `processLINEAR16()`

**Optional but recommended** - fail fast:

```javascript
// card.js:4458 - processLINEAR16()
async function processLINEAR16(data) {
  clientConsole(2, '[SR] ========== processLINEAR16 CALLED ==========');

  // ✅ NEW: Early exit if not in valid state
  if (currentTrialState !== TRIAL_STATES.PRESENTING_AWAITING) {
    clientConsole(2, '[SR] ⚠️ Voice detected but trial state is:', currentTrialState);
    clientConsole(2, '[SR] Ignoring audio data - not accepting input');
    recorder.clear();
    return;
  }

  // Original code continues...
  clientConsole(2, '[SR] Audio data received, processing...');
  // ...
}
```

**Why This Helps:**
- Saves API quota (doesn't send to Google if state is wrong)
- Faster feedback to user (no "waiting for transcription")
- Prevents unnecessary async operations
- **Defense in depth** - multiple layers of protection

---

## Recommended Implementation Plan

### Phase 1: Minimum Viable Fix (15 minutes)

**Add the guard to `speechAPICallback()`** - this alone fixes the duplicate TTS:

```javascript
// At line 4620 in card.js, add:
if (currentTrialState !== TRIAL_STATES.PRESENTING_AWAITING) {
  clientConsole(2, '[SR] ⚠️ Transcription arrived too late - state:', currentTrialState);
  waitingForTranscription = false;
  const userAnswer = document.getElementById('userAnswer');
  if (userAnswer && userAnswer.value === 'waiting for transcription') {
    userAnswer.value = '';
  }
  return;
}
```

**Testing:**
1. Start a trial, wait for timeout
2. Say something during feedback
3. Verify TTS/text doesn't duplicate
4. Check console for "[SR] ⚠️ Transcription arrived too late" message

### Phase 2: Proper Recording Stop (30 minutes)

**Remove the 1.2s delay**, stop recording synchronously:

```javascript
// In showUserFeedback() at line ~2395, add:
if (recorder && Session.get('recording')) {
  stopRecording();
}

// In stopUserInput() at line 3727, remove setTimeout:
// OLD:
setTimeout(() => {
  if (recorder && Session.get('recording')) {
    stopRecording();
  }
}, 1200);

// NEW:
if (recorder && Session.get('recording')) {
  stopRecording();
}
```

**Testing:**
1. Verify normal voice answers still work
2. Check that saying something during feedback doesn't process
3. Monitor for "waiting for transcription" artifacts

### Phase 3: Defense in Depth (optional, 15 minutes)

**Add early exit in `processLINEAR16()`:**

```javascript
// At line 4462 in card.js:
if (currentTrialState !== TRIAL_STATES.PRESENTING_AWAITING) {
  clientConsole(2, '[SR] Ignoring audio - state:', currentTrialState);
  recorder.clear();
  return;
}
```

---

## The `afterFeedbackCallbackBind` Error

From your trace:

```
card.js:2720 Uncaught (in promise) TypeError: afterFeedbackCallbackBind is not a function
    at card.js:2720:11
```

**Root Cause:** When duplicate `showUserFeedback()` is called, it re-binds variables:

```javascript
// card.js:2510 - showUserFeedback()
const afterAnswerFeedbackCallbackBind = afterAnswerFeedbackCallback.bind(
  this,
  trialEndTimeStamp,
  trialStartTimeStamp,
  source,
  userAnswer,
  isTimeout,
  isSkip,
  isCorrect
);
```

But somewhere it's being called as `afterFeedbackCallbackBind()` (note the different name - missing 'Answer').

**Fix:** This will be resolved automatically when we prevent the duplicate `showUserFeedback()` call. But we should also search for the typo:

```bash
grep -n "afterFeedbackCallbackBind" mofacts/client/views/experiment/card.js
```

This is likely a variable naming inconsistency that only manifests during the race condition.

---

## Summary

**The Race Condition:**
- Timeout fires → enters FEEDBACK.SHOWING
- Voice input from 0.7s ago still processing
- SR callback fires 3s later, doesn't check state
- Calls `handleUserInput()` while in FEEDBACK.SHOWING
- Triggers duplicate feedback

**The Root Causes:**
1. **No state validation** in `speechAPICallback()` before calling `handleUserInput()`
2. **1.2s delayed recording stop** creates race window
3. **Async API latency** (3 seconds) allows state to change during processing

**The Fix:**
1. ✅ **Guard in `speechAPICallback()`** - checks `currentTrialState` before acting (CRITICAL)
2. ✅ **Immediate recording stop** in `showUserFeedback()` - no 1.2s delay (IMPORTANT)
3. ✅ **Early exit in `processLINEAR16()`** - saves API quota (NICE TO HAVE)

**Testing Strategy:**
- Timeout scenarios with voice during feedback
- Fast answers (before timeout)
- Slow API responses
- Check for "waiting for transcription" artifacts
- Verify no duplicate TTS/text

---

**Document Created:** 2025-10-20
**Based on:** Trace analysis from user, SPEECH_RECOGNITION_STATE_MACHINE.md, INPUT_LIFECYCLE_AUDIT.md
**Status:** ✅ Root cause identified, solution designed, ready for implementation
