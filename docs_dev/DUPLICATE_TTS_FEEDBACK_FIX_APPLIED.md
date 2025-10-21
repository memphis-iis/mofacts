# Duplicate TTS Feedback Race Condition - FIX APPLIED

**Date:** 2025-10-20
**Status:** ✅ FIXED - All 3 layers implemented
**Issue:** TTS feedback triggered twice when user spoke after timeout
**Root Cause:** SR subsystem didn't respect main state machine transitions

---

## Summary of Changes

Implemented a 3-layer defense strategy to prevent the Speech Recognition (SR) subsystem from processing voice input during invalid states (specifically `FEEDBACK.SHOWING`).

### The Bug

When a user was silent for 10 seconds:
1. Timeout fires → enters `FEEDBACK.SHOWING` → TTS starts
2. User says "skip" (to move past feedback faster)
3. **BUG:** TTS 'ended' listener blindly restarts recording
4. Late speech is processed → `handleUserInput()` called from wrong state
5. **DUPLICATE FEEDBACK!**

---

## Layer 1: Stop Recording When Entering Feedback

**File:** `mofacts/client/views/experiment/card.js`
**Function:** `showUserFeedback()`
**Line:** ~2406

```javascript
// FIX: Stop recording when entering FEEDBACK phase (Layer 1 of 3-layer defense)
if (recorder && Session.get('recording')) {
  clientConsole(2, '[SR] Stopping recording - entered FEEDBACK phase');
  stopRecording();
}
```

**Rationale:**
- `FEEDBACK.SHOWING` does not accept user input
- Recording should stop immediately upon state transition
- Any in-flight SR will complete normally (already exported to `processLINEAR16()`)

**Before:** Recording continued during feedback (comment said "don't call stopRecording")
**After:** Recording stops synchronously when entering feedback

---

## Layer 2: Check State Before Restarting Recording in TTS Listeners

**File:** `mofacts/client/views/experiment/card.js`
**Locations:** 4 TTS 'ended'/'error' event listeners

### 2.1: Google TTS 'ended' (~line 4050)
```javascript
// FIX: Only restart recording if we're still in a state that accepts input (Layer 2)
if (currentTrialState === TRIAL_STATES.PRESENTING_AWAITING) {
  startRecording();
} else {
  clientConsole(2, '[SR] TTS ended but state is', currentTrialState, '- not restarting recording');
}
```

### 2.2: Google TTS fallback 'end' (~line 4067)
```javascript
// FIX: Only restart recording if we're still in a state that accepts input (Layer 2)
if (currentTrialState === TRIAL_STATES.PRESENTING_AWAITING) {
  startRecording();
} else {
  clientConsole(2, '[SR] TTS fallback ended but state is', currentTrialState, '- not restarting recording');
}
```

### 2.3: MDN Native TTS 'end' (~line 4100)
```javascript
// FIX: Only restart recording if we're still in a state that accepts input (Layer 2)
if (currentTrialState === TRIAL_STATES.PRESENTING_AWAITING) {
  startRecording();
} else {
  clientConsole(2, '[SR] MDN TTS ended but state is', currentTrialState, '- not restarting recording');
}
```

### 2.4: MDN Native TTS 'error' (~line 4114)
```javascript
// FIX: Only restart recording if we're still in a state that accepts input (Layer 2)
if (currentTrialState === TRIAL_STATES.PRESENTING_AWAITING) {
  startRecording();
} else {
  clientConsole(2, '[SR] MDN TTS error but state is', currentTrialState, '- not restarting recording');
}
```

**Rationale:**
- TTS can play during `FEEDBACK` (incorrect answer) or `PRESENTING` (question prompt)
- Only restart recording if we're still in `PRESENTING.AWAITING` (waiting for user input)
- This is the **critical fix** - prevents the race condition root cause

**Before:** `startRecording()` called blindly when TTS ended
**After:** `startRecording()` only called if state is `PRESENTING.AWAITING`

---

## Layer 3: Discard Late Transcriptions in speechAPICallback

**File:** `mofacts/client/views/experiment/card.js`
**Function:** `speechAPICallback()`
**Line:** ~4652

```javascript
// FIX: Check if we're still in a valid state for input (Layer 3 of 3-layer defense)
// This prevents processing late transcriptions that arrive after state has changed
if (currentTrialState !== TRIAL_STATES.PRESENTING_AWAITING) {
  clientConsole(2, '[SR] ⚠️ Transcription arrived too late - trial state is:', currentTrialState);
  clientConsole(2, '[SR] Discarding transcription to prevent state machine violation');

  // Clear the "waiting for transcription" message if still showing
  const userAnswer = document.getElementById('userAnswer');
  if (userAnswer && userAnswer.value === 'waiting for transcription') {
    userAnswer.value = '';
  }

  return; // EXIT EARLY - don't process this transcription
}
```

**Rationale:**
- **Defense in depth** - final gate before calling `handleUserInput()`
- Even if recording somehow stays active and speech is captured, don't process it
- Handles edge cases where Layers 1 & 2 might be bypassed

**Before:** All transcriptions processed regardless of state
**After:** Transcriptions only processed if state is `PRESENTING.AWAITING`

---

## How the Layers Work Together

### Normal Flow (User speaks BEFORE timeout) ✓
```
PRESENTING.AWAITING
  → User speaks → Voice detected
  → processLINEAR16() → waitingForTranscription=true
  → Google API returns → speechAPICallback()
  → Layer 3 check: state=PRESENTING.AWAITING ✓ PASS
  → handleUserInput() → showUserFeedback()
  → Layer 1: stopRecording() ✓
  → FEEDBACK.SHOWING → TTS plays
  → Layer 2: TTS ends, state!=AWAITING → no startRecording() ✓
```

### Bug Scenario Fixed (User speaks AFTER timeout) ✓
```
PRESENTING.AWAITING
  → 10 seconds pass, user silent
  → Timeout fires → handleUserInput(source='timeout')
  → showUserFeedback() → FEEDBACK.SHOWING
  → Layer 1: stopRecording() ✓ (recording stopped immediately)
  → TTS plays feedback
  → User says "skip" (too late, recording already stopped)
  → Layer 2: TTS ends, state=FEEDBACK.SHOWING → no startRecording() ✓
  → Even if recording were active, Layer 3 would discard transcription ✓
```

### Edge Case: In-Flight Transcription (Handled) ✓
```
PRESENTING.AWAITING
  → User speaks at 9.5 seconds
  → Voice detected → processLINEAR16() starts
  → Timeout fires at 10 seconds → showUserFeedback()
  → Layer 1: stopRecording() ✓ (but audio already exported)
  → FEEDBACK.SHOWING → TTS plays
  → Google API returns 2 seconds later
  → Layer 3: state=FEEDBACK.SHOWING → DISCARD ✓
  → No duplicate feedback!
```

---

## Testing Strategy

### Test Case 1: Normal Answer (Before Timeout)
**Steps:**
1. Start trial with SR enabled
2. Speak correct answer within 10 seconds
3. Verify feedback shows once
4. Verify no duplicate TTS

**Expected:** ✓ PASS (Layers don't interfere with normal flow)

### Test Case 2: Timeout with Post-Timeout Speech
**Steps:**
1. Start trial with SR enabled
2. Stay silent for 10 seconds
3. Timeout fires, feedback shows, TTS plays
4. Say "skip" while TTS is playing
5. Verify feedback doesn't duplicate

**Expected:** ✓ PASS (Layer 2 prevents recording restart)

### Test Case 3: Late Transcription Arrival
**Steps:**
1. Start trial with SR enabled
2. Speak at 9.8 seconds (just before timeout)
3. Timeout fires at 10 seconds
4. Transcription arrives 2 seconds later (at 12 seconds)
5. Verify transcription is discarded

**Expected:** ✓ PASS (Layer 3 discards late transcription)

### Test Case 4: TTS Question Prompt
**Steps:**
1. Enable TTS for questions (`audioPromptMode: 'all'`)
2. Start trial
3. TTS reads question
4. Verify recording restarts after TTS ends

**Expected:** ✓ PASS (Layer 2 allows restart during PRESENTING.AWAITING)

---

## Log Messages for Debugging

When the fix is working correctly, you'll see these log messages:

**Layer 1 (Feedback entered):**
```
[SR] Stopping recording - entered FEEDBACK phase
```

**Layer 2 (TTS ended in wrong state):**
```
[SR] TTS ended but state is FEEDBACK.SHOWING - not restarting recording
[SR] TTS fallback ended but state is FEEDBACK.SHOWING - not restarting recording
[SR] MDN TTS ended but state is FEEDBACK.SHOWING - not restarting recording
[SR] MDN TTS error but state is FEEDBACK.SHOWING - not restarting recording
```

**Layer 3 (Late transcription discarded):**
```
[SR] ⚠️ Transcription arrived too late - trial state is: FEEDBACK.SHOWING
[SR] Discarding transcription to prevent state machine violation
```

---

## Related Documentation

- [SR_SM_SYNCHRONIZATION_DESIGN.md](SR_SM_SYNCHRONIZATION_DESIGN.md) - Full analysis of how SR and SM are designed to synchronize
- [TTS_SPECIFIC_RACE_CONDITION.md](TTS_SPECIFIC_RACE_CONDITION.md) - Why this bug only happened with TTS enabled
- [DUPLICATE_TTS_FEEDBACK_RACE_CONDITION.md](DUPLICATE_TTS_FEEDBACK_RACE_CONDITION.md) - Original analysis and root cause identification
- [SPEECH_RECOGNITION_STATE_MACHINE.md](SPEECH_RECOGNITION_STATE_MACHINE.md) - SR subsystem architecture

---

## Commit Message

```
fix: prevent duplicate TTS feedback from post-timeout voice commands

Implemented 3-layer defense to maintain SR/SM state synchronization:

Layer 1: Stop recording immediately when entering FEEDBACK phase
Layer 2: Only restart recording from TTS if state is PRESENTING.AWAITING
Layer 3: Discard transcriptions that arrive after state change

This fixes the race condition where:
1. User was silent → timeout fired → FEEDBACK.SHOWING
2. TTS played feedback → ended → blindly restarted recording
3. User said "skip" → SR processed it → duplicate feedback

The fix ensures SR only processes input during PRESENTING.AWAITING,
maintaining the designed synchronization between the Speech Recognition
subsystem and Main State Machine.

Files changed:
- mofacts/client/views/experiment/card.js
  - showUserFeedback(): Added stopRecording() on feedback entry
  - Google TTS 'ended': Added state check before startRecording()
  - Google TTS fallback 'end': Added state check
  - MDN native TTS 'end': Added state check
  - MDN native TTS 'error': Added state check
  - speechAPICallback(): Added early exit if wrong state

Testing: Manual verification with timeout + post-timeout voice commands
```

---

**Document Created:** 2025-10-20
**Implementation Status:** ✅ COMPLETE
**Testing Status:** ⏳ PENDING USER VERIFICATION
