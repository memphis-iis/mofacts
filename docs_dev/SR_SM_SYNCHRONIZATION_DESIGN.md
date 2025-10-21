# Speech Recognition & State Machine Synchronization Analysis

**Date:** 2025-10-20
**Critical Insight:** SR and SM are DESIGNED to synchronize, but TTS breaks the contract

---

## The Designed Synchronization

### SR Blocks Timeout (By Design!)

From [card.js:349-354](mofacts/client/views/experiment/card.js#L349-L354):

```javascript
} else if (waitingForTranscription) {
  clientConsole(2, '[SR] timeout reached but waiting for speech transcription, delaying timeout');
  // Retry timeout after a short delay to give transcription more time
  clearCardTimeout();
  beginMainCardTimeout(3000, func); // Give 3 more seconds for transcription
}
```

**The Contract:**
1. User speaks → Voice START → resets timeout (gives more time)
2. User stops → Voice STOP → `processLINEAR16()` → `waitingForTranscription = true`
3. Timeout tries to fire → checks `waitingForTranscription` → **DELAYS 3 more seconds**
4. Google API returns → `speechAPICallback()` → `waitingForTranscription = false`
5. Answer processed → `handleUserInput()` → Feedback shows
6. **ONLY THEN** can state transition to `FEEDBACK.SHOWING`

**This is beautiful design!** The SR subsystem and Main State Machine are properly synchronized.

---

## What Actually Happened in Your Trace

### Trial 1 (Cayman Islands) - WORKED CORRECTLY ✓

```
16:45:12 - allowUserInput() → PRESENTING.AWAITING → startRecording()
16:45:15 - VOICE START (3 sec) → resetMainCardTimeout()
16:45:16 - VOICE STOP (4 sec) → processLINEAR16() → waitingForTranscription=true
16:45:16 - Timeout tries to fire but waitingForTranscription=true → DELAYS
16:45:18 - speechAPICallback (2s later) → waitingForTranscription=false
16:45:18 - handleUserInput(source='voice', answer='cayman islands')
16:45:18 - Correct! → showUserFeedback() → FEEDBACK.SHOWING
16:45:18 - TTS: "Correct"
```

**Perfect synchronization!** Timeout was blocked while waiting for transcription.

### Trial 2 (Gabon) - THE BUG ❌

```
16:45:19 - Next trial → PRESENTING.AWAITING → startRecording()
16:45:29 - 10 seconds pass, user SILENT
16:45:29 - Timeout fires (user never spoke, waitingForTranscription=false) ✓ CORRECT
16:45:29 - handleUserInput(source='timeout') → showUserFeedback()
16:45:29 - STATE: PRESENTING.AWAITING → FEEDBACK.SHOWING ✓
16:45:29 - TTS: "The correct answer is Gabon" starts
16:45:29 - Session.set('ttsRequested', true)

16:45:30 - TTS audio received (0.5s later)
16:45:30 - Session.set('recordingLocked', true)
16:45:30 - TTS plays... (~1 second)

PROBLEM STARTS HERE:
16:45:30 - [SR] VOICE START ← User says "skip" (1 sec after timeout!)
16:45:30 - [SR] RESETMAINCARDTIMEOUT NOT DEFINED ← Because timeout already fired!
16:45:30 - [SR] VOICE STOP
16:45:30 - processLINEAR16() called
16:45:30 - waitingForTranscription=true ← Too late, already in FEEDBACK!

16:45:31 - TTS audio ends
16:45:31 - addEventListener('ended') fires
16:45:31 - startRecording() called ← RESTARTS RECORDING IN FEEDBACK STATE! ❌

16:45:33 - speechAPICallback (3s after VOICE STOP)
16:45:33 - waitingForTranscription=false
16:45:33 - handleUserInput(source='voice', answer='skip')
16:45:33 - STATE: FEEDBACK.SHOWING (invalid!)
16:45:33 - showUserFeedback() called AGAIN
16:45:33 - DUPLICATE FEEDBACK! ❌
```

---

## The Root Cause (Now Crystal Clear)

**The synchronization breaks because:**

1. ✅ **Timeout fires correctly** when user is silent for 10 seconds
2. ✅ **State transitions to FEEDBACK.SHOWING** correctly
3. ✅ **TTS starts** correctly
4. ❌ **User speaks AFTER timeout** (saying "skip" to move on)
5. ❌ **Recording is still active OR restarted by TTS**
6. ❌ **Speech is processed** even though state is FEEDBACK.SHOWING
7. ❌ **`handleUserInput()` called from wrong state**
8. ❌ **Duplicate feedback**

**The key realization:** The user saying "skip" at 16:45:30 is **1 second AFTER the timeout**. This is a **post-timeout voice command** that should be ignored, but instead it's processed because:

1. TTS 'ended' listener **restarts recording** without checking state
2. `speechAPICallback()` doesn't check state before calling `handleUserInput()`
3. `handleUserInput()` doesn't reject calls from wrong state

---

## The Two Async Pipelines

### Pipeline A: Main State Machine (Primary)
```
PRESENTING.AWAITING
  → (10s timeout with no user input)
  → handleUserInput(source='timeout')
  → showUserFeedback()
  → FEEDBACK.SHOWING
  → TTS starts
  → TTS ends
  → afterAnswerFeedbackCallback()
  → TRANSITION.START
```

### Pipeline B: Speech Recognition (Subsystem)
```
VOICE START (at 16:45:30, AFTER timeout)
  → VOICE STOP
  → processLINEAR16()
  → waitingForTranscription=true
  → Google Speech API call
  → (3 second wait)
  → speechAPICallback()
  → waitingForTranscription=false
  → handleUserInput(source='voice') ← VIOLATES STATE!
```

**The Problem:** Pipeline B **doesn't check** if Pipeline A has already moved on!

---

## Why The Synchronization Failed

### The Intended Design

**When timeout is about to fire:**
```javascript
if (waitingForTranscription) {
  // User spoke, we're waiting for Google API
  // BLOCK the timeout until transcription arrives
  beginMainCardTimeout(3000, func);
} else {
  // User is silent, fire the timeout
  func(); // handleUserInput(source='timeout')
}
```

**This works perfectly when:**
- User speaks **BEFORE timeout** → timeout is delayed → SR completes → feedback shows

**This FAILS when:**
- User is silent → timeout fires → enters FEEDBACK → **THEN user speaks** → SR processes it anyway!

### The Missing Guard

**The synchronization assumes SR only runs during `PRESENTING.AWAITING`**, but:

1. Recording is never explicitly stopped when entering FEEDBACK
2. TTS 'ended' listener **restarts recording** during FEEDBACK
3. Late voice commands are processed out-of-state

---

## The Complete Fix (3-Layer Defense)

### Layer 1: Prevent Recording During Feedback

**In `showUserFeedback()` at line ~2395:**

```javascript
async function showUserFeedback(isCorrect, feedbackMessage, isTimeout, isSkip) {
  clientConsole(2, '[SM] showUserFeedback called in state:', currentTrialState);

  // STATE MACHINE: Transition to FEEDBACK.SHOWING (drill only, test skips feedback)
  if (trialShowsFeedback()) {
    transitionTrialState(TRIAL_STATES.FEEDBACK_SHOWING, `Showing feedback (${isCorrect ? 'correct' : 'incorrect'})`);
  }

  // ✅ NEW: Stop recording when entering FEEDBACK phase
  // We're done accepting input - any in-flight SR should complete but no new recording
  if (recorder && Session.get('recording')) {
    clientConsole(2, '[SR] Stopping recording - entered FEEDBACK phase');
    stopRecording();
  }

  // ... rest of function
}
```

**Rationale:** `FEEDBACK.SHOWING` does not accept input. Recording should stop immediately.

### Layer 2: Don't Restart Recording in Wrong State

**In TTS 'ended' listeners (4 places: lines 4043, 4054, 4081, 4089):**

```javascript
// CURRENT (BROKEN):
window.currentAudioObj.addEventListener('ended', (event) => {
  Session.set('recordingLocked', false);
  Session.set('ttsRequested', false);
  startRecording();  // ← BLINDLY RESTARTS!
});

// FIXED:
window.currentAudioObj.addEventListener('ended', (event) => {
  Session.set('recordingLocked', false);
  Session.set('ttsRequested', false);

  // Only restart recording if we're in a state that accepts input
  if (currentTrialState === TRIAL_STATES.PRESENTING_AWAITING) {
    startRecording();
    clientConsole(2, '[SR] TTS ended, restarting recording (state: AWAITING)');
  } else {
    clientConsole(2, '[SR] TTS ended but state is', currentTrialState, '- not restarting recording');
  }
});
```

**Rationale:** TTS can play during FEEDBACK (incorrect answer) or PRESENTING (question prompt). Only restart recording if we're still waiting for input.

### Layer 3: Guard in speechAPICallback

**In `speechAPICallback()` at line ~4620:**

```javascript
function speechAPICallback(err, data){
  // Clear the waiting flag now that transcription has returned (success or error)
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

    return; // ← EXIT EARLY, don't call handleUserInput()
  }

  // Original code continues...
  let answerGrammar = [];
  let response = {};
  // ...
}
```

**Rationale:** Defense in depth. Even if recording somehow stays active, don't process transcriptions from wrong state.

---

## The Red Mic Icon & "Please Wait" - As Designed

From your observation:

> "the please wait and red mic icon are supposed to show until google returns the answer"

**This is correct!** Looking at the flow:

1. User speaks → VOICE STOP → `processLINEAR16()`
2. Sets `waitingForTranscription = true`
3. **UI should show:** "waiting for transcription" + red mic (locked)
4. Google API processes (1-3 seconds)
5. `speechAPICallback()` fires
6. Sets `waitingForTranscription = false`
7. Answer is checked
8. **ONLY THEN:** State transitions to FEEDBACK.SHOWING

**The bug:** When user speaks **AFTER timeout has already fired**, the transcription arrives while **already in FEEDBACK state**, violating the flow.

---

## Summary: SR/SM Synchronization Design

### As Designed (Correct) ✓

```
User speaks at 3s:
  VOICE START → reset timeout
  VOICE STOP → processLINEAR16() → waitingForTranscription=true
  Timeout tries at 10s → BLOCKED (waitingForTranscription=true)
  Google API returns → speechAPICallback() → waitingForTranscription=false
  handleUserInput(source='voice') → State: AWAITING ✓
  showUserFeedback() → FEEDBACK.SHOWING ✓
```

**Perfect synchronization!** SR blocks state transition until complete.

### The Bug (User speaks AFTER timeout) ❌

```
User silent for 10s:
  Timeout fires → handleUserInput(source='timeout')
  showUserFeedback() → FEEDBACK.SHOWING ✓
  TTS starts → locks recording

User speaks at 11s (AFTER timeout):
  VOICE START/STOP → processLINEAR16() → waitingForTranscription=true
  TTS ends → startRecording() ← WRONG STATE! ❌
  Google API returns → speechAPICallback()
  handleUserInput(source='voice') → State: FEEDBACK.SHOWING ❌
  showUserFeedback() AGAIN → DUPLICATE! ❌
```

**Broken synchronization!** SR processes late input from wrong state.

### The Fix: Respect State Machine in SR

1. **Stop recording** when entering FEEDBACK (Layer 1)
2. **Don't restart** recording from TTS if not in AWAITING (Layer 2)
3. **Discard transcriptions** that arrive in wrong state (Layer 3)

---

## Implementation Priority

**CRITICAL (Must Have):**
- Layer 2: Fix TTS 'ended' listeners (prevents the restart)
- Layer 3: Guard in speechAPICallback (prevents duplicate feedback)

**IMPORTANT (Should Have):**
- Layer 1: Stop recording in showUserFeedback (clean state transition)

**All three layers work together** to maintain SR/SM synchronization even when user speaks after timeout.

---

**Document Created:** 2025-10-20
**Key Insight:** SR and SM are designed to synchronize, but TTS breaks it by restarting recording in wrong state
**Status:** ✅ Full understanding achieved, ready to implement
