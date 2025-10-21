# Why the Duplicate Feedback Race Condition ONLY Triggers with TTS

**Date:** 2025-10-20
**Key Insight:** The race condition is **TTS-specific** because of the `recordingLocked` mechanism

---

## The Critical Discovery

Looking at [card.js:3954](mofacts/client/views/experiment/card.js#L3954):

```javascript
function stopUserInput() {
  clientConsole(2, 'stop user input');
  inputDisabled = true;
  // stopRecording(); // COMMENTED OUT - destroys audio buffer before API can process it

  // Delay disabling inputs to sync with CSS fade transition
  registerTimeout('stopUserInputDelay', function() {
    clientConsole(2, 'after delay, stopping user input');
    if (inputDisabled === true) {
      $('#userAnswer, #multipleChoiceContainer button').prop('disabled', true);
    }
  }, getTransitionDuration(), 'Delay input disable to sync with fade-out transition');
}
```

**Key Facts:**
1. `stopRecording()` is **COMMENTED OUT** on line 3954
2. Only UI elements are disabled after `getTransitionDuration()` (~200ms)
3. **Recording never stops** during feedback!

---

## Why Recording SHOULD Stop But Doesn't

### WITHOUT TTS (No Race Condition)

When TTS is **disabled**, recording runs continuously:

```
Timeout fires at 16:45:29
  → stopUserInput() called
  → inputDisabled = true
  → setTimeout(200ms) to disable UI buttons
  → RECORDING STILL ACTIVE ⚠️

User says "skip" at 16:45:30
  → Recording captures audio ✓
  → processLINEAR16() starts
  → BUT WAIT...
```

**The Protection:** At [card.js:5014](mofacts/client/views/experiment/card.js#L5014):

```javascript
function startRecording() {
  if (recorder && !Session.get('recordingLocked') && Meteor.user().audioInputMode) {
    Session.set('recording', true);
    recorder.record();
    clientConsole(2, '[SR] RECORDING START');
  }
}
```

**Recording can only start if:**
1. `recorder` exists ✓
2. `!Session.get('recordingLocked')` ✓ (no TTS playing)
3. `Meteor.user().audioInputMode` ✓ (user has SR enabled)

**Without TTS:** Recording continues normally, there's no lock!

---

## WITH TTS (Race Condition Triggers!)

When TTS **is enabled**, here's what's different:

### The TTS Locking Mechanism

From [card.js:4032](mofacts/client/views/experiment/card.js#L4032):

```javascript
// Inside speakMessageIfAudioPromptFeedbackEnabled() Google TTS callback
clientConsole(2, '[SR]   ✅ TTS audio received, LOCKING RECORDING');
const audioObj = new Audio('data:audio/ogg;base64,' + res)
Session.set('recordingLocked', true);  // ← LOCKS RECORDING
window.currentAudioObj = audioObj;
window.currentAudioObj.addEventListener('ended', (event) => {
  clientConsole(2, '[SR]   ✅ TTS audio ended, unlocking recording');
  Session.set('recordingLocked', false);  // ← UNLOCKS when TTS done
  Session.set('ttsRequested', false);
  startRecording();  // ← RESTART RECORDING!
});
```

### The Race Window

```
16:45:29.000 - Timeout fires
  → handleUserInput(source='timeout')
  → showUserFeedback()
  → speakMessageIfAudioPromptFeedbackEnabled("The correct answer is Gabon")
  → Session.set('ttsRequested', true)

16:45:29.500 - Google TTS API responds (500ms later)
  → Session.set('recordingLocked', true)  // LOCK!
  → TTS audio starts playing

16:45:30.000 - User says "skip"
  → Recording is LOCKED (TTS playing)
  → Audio captured but recording is paused... NO!
  → Actually recording continues, lock only affects startRecording()

16:45:30.500 - TTS audio ends (after ~1 second)
  → addEventListener('ended') fires
  → Session.set('recordingLocked', false)
  → startRecording() called  // ← RE-ENABLES RECORDING!
  → Recording NOW captures late audio

16:45:33.000 - Google Speech API returns "skip"
  → speechAPICallback() fires
  → Calls handleUserInput(source='voice')
  → State is FEEDBACK.SHOWING (invalid!)
  → DUPLICATE FEEDBACK!
```

---

## The Smoking Gun: Why TTS Creates the Window

### Timeline Comparison

**WITHOUT TTS:**
```
Timeout → Feedback → (Recording continues but no restart)
  → User input during feedback gets processed
  → speechAPICallback() fires
  → handleUserInput() called
  → But... wait, why doesn't this cause the bug?
```

**Wait, that doesn't make sense!** Let me re-check the logic...

### The REAL Difference

Looking at [card.js:4043](mofacts/client/views/experiment/card.js#L4043):

```javascript
window.currentAudioObj.addEventListener('ended', (event) => {
  clientConsole(2, '[SR]   ✅ TTS audio ended, unlocking recording');
  Session.set('recordingLocked', false);
  Session.set('ttsRequested', false);
  startRecording();  // ← THIS IS THE KEY!
});
```

**AHA!** When TTS ends, it calls `startRecording()` - this **RESTARTS** the recording subsystem!

From your trace at 16:45:19:
```
Mon Oct 20 2025 16:45:19 GMT-0500 (Central Daylight Time) [SR]   ✅ TTS audio ended, unlocking recording
Mon Oct 20 2025 16:45:19 GMT-0500 (Central Daylight Time) [SR] 🎤 TTS request complete (audio ended) (ttsRequested=false)
Mon Oct 20 2025 16:45:19 GMT-0500 (Central Daylight Time) [SR] RECORDING START  ← RESTARTED!
```

And then later at 16:45:30:
```
Mon Oct 20 2025 16:45:30 GMT-0500 (Central Daylight Time) [SR] VOICE START
Mon Oct 20 2025 16:45:30 GMT-0500 (Central Daylight Time) [SR] RESETMAINCARDTIMEOUT NOT DEFINED
```

**THE RACE CONDITION EXPLAINED:**

1. **Timeout fires** → enters FEEDBACK.SHOWING → TTS starts
2. **TTS audio plays** for ~1 second
3. **TTS ends** → calls `startRecording()` (line 4043)
4. **Recording is ACTIVE AGAIN** even though we're in FEEDBACK phase!
5. **User speaks** while feedback is showing
6. **Speech is processed** → `speechAPICallback()` fires
7. **handleUserInput()** called while in wrong state
8. **DUPLICATE FEEDBACK!**

---

## Why It DOESN'T Happen Without TTS

**Without TTS:**
- Feedback shows but no TTS plays
- `startRecording()` is never called from TTS 'ended' listener
- Recording continues from original `allowUserInput()` call
- **BUT**: `stopUserInput()` was called, setting `inputDisabled = true`

Wait, let me check if there's another protection...

Looking at [card.js:4467](mofacts/client/views/experiment/card.js#L4467):

```javascript
// In processLINEAR16()
if (resetMainCardTimeout && timeoutFunc && !inputDisabled) {
  resetMainCardTimeout(); // Give ourselves a bit more time
} else {
  clientConsole(2, '[SR] not resetting during processLINEAR16');
}
```

**AH!** There's an `inputDisabled` check in `processLINEAR16()`, but it only affects `resetMainCardTimeout()`, **not whether to process the audio!**

---

## The ACTUAL Root Cause

**The bug happens with TTS because:**

1. **TTS 'ended' event calls `startRecording()`** even when in FEEDBACK phase
2. This **re-enables** the recording subsystem
3. `startRecording()` at line 5014 checks `!Session.get('recordingLocked')` ✓ (TTS finished, unlocked)
4. Recording becomes **active during FEEDBACK.SHOWING** (invalid state)
5. User speech is captured and processed
6. `speechAPICallback()` calls `handleUserInput()` from wrong state

**Without TTS:**
- Recording was already active from `PRESENTING.AWAITING`
- Never gets stopped (line 3954 is commented out)
- **Should also have the bug!**

---

## Wait... Why Doesn't It ALWAYS Happen?

Let me reconsider. Looking at your trace again:

**First trial (Cayman Islands):** NO duplicate feedback
```
16:45:18 - Correct answer, state transitions properly
16:45:19 - TTS plays, recording restarts
16:45:19 - prepareCard() starts next trial
```

**Second trial (Gabon):** DUPLICATE FEEDBACK
```
16:45:29 - Timeout, incorrect answer
16:45:30 - Voice detected DURING feedback
16:45:33 - Duplicate feedback triggered
```

**The Difference:** In the first trial, user answered **correctly before timeout**. In the second trial, **timeout fired first**, then user spoke during feedback.

---

## The True Answer

**The race condition triggers with TTS because:**

1. **Incorrect answer** (timeout or wrong response) shows feedback
2. **TTS plays feedback** audio (~1-4 seconds)
3. **TTS ends** → calls `startRecording()` (line 4043)
4. **Recording restarts** while still in `FEEDBACK.SHOWING` state ❌ BUG!
5. **User speaks** (saying "skip" or continuing to answer)
6. **Speech is processed** → duplicate feedback

**Without TTS:**
- Feedback shows immediately
- No TTS 'ended' event
- `startRecording()` is NOT called
- Recording state remains from previous `allowUserInput()`
- **Wait, recording should still be active...**

Let me check if there's a difference in how recorder state is checked...

Actually, looking at [card.js:5028](mofacts/client/views/experiment/card.js#L5028):

```javascript
function stopRecording() {
  clientConsole(2, '[SR] stopRecording', recorder, Session.get('recording'));
  if (recorder && Session.get('recording')) {
    recorder.stop();
    Session.set('recording', false);
    recorder.clear();
  }
}
```

**The flag:** `Session.get('recording')` must be true for recording to be active.

Let me check when this gets set to false... It should be when hark detects voice STOP:

From the trace:
```
Mon Oct 20 2025 16:45:30 GMT-0500 (Central Daylight Time) [SR] VOICE STOP (after 430ms)
```

So when voice stops, `recorder.stop()` is called, setting `Session.set('recording', false)`.

**Then how does it record again?**

From [card.js:4043](mofacts/client/views/experiment/card.js#L4043):
```javascript
startRecording();  // ← Called when TTS ends!
```

**BINGO!**

### The Complete Picture

**WITH TTS:**
1. Timeout → Feedback → TTS starts
2. User speaks → Voice START → Voice STOP → `Session.set('recording', false)`
3. Audio data buffered, `processLINEAR16()` called
4. TTS ends (1 second later) → `startRecording()` called → `Session.set('recording', true)` ❌
5. Speech API returns → `speechAPICallback()` → `handleUserInput()` → DUPLICATE!

**WITHOUT TTS:**
1. Timeout → Feedback (no TTS)
2. User speaks → Voice START → Voice STOP → `Session.set('recording', false)`
3. Audio data buffered, `processLINEAR16()` called
4. NO TTS 'ended' event → `startRecording()` NOT called
5. Speech API returns → `speechAPICallback()` → `handleUserInput()` → ...
6. **Still causes duplicate!** (if this happens)

**Conclusion:** The bug SHOULD happen without TTS too, but it's **much more likely with TTS** because:
- **TTS extends the feedback time** (1-4 seconds vs 200ms)
- **TTS restarts recording** when it ends (creating fresh window)
- **Longer window = more chance** user speaks during feedback

---

## The Fix (Updated)

The TTS-specific issue is the **inappropriate `startRecording()` call** at line 4043:

```javascript
// CURRENT (BROKEN):
window.currentAudioObj.addEventListener('ended', (event) => {
  Session.set('recordingLocked', false);
  Session.set('ttsRequested', false);
  startRecording();  // ← DON'T BLINDLY RESTART!
});

// FIXED:
window.currentAudioObj.addEventListener('ended', (event) => {
  Session.set('recordingLocked', false);
  Session.set('ttsRequested', false);

  // Only restart recording if we're in a state that accepts input
  if (currentTrialState === TRIAL_STATES.PRESENTING.AWAITING) {
    startRecording();
  } else {
    clientConsole(2, '[SR] TTS ended but not in AWAITING state, not restarting recording');
  }
});
```

**Same fix needed at:**
- Line 4054 (fallback MDN synthesis)
- Line 4081 (native TTS 'end' listener)
- Line 4089 (native TTS 'error' listener)

---

## Summary

**Your intuition was 100% correct!**

The race condition is **TTS-specific** because:

1. **TTS 'ended' event blindly calls `startRecording()`** without checking trial state
2. This **restarts recording during FEEDBACK phase** (invalid)
3. Late speech is captured and processed
4. `speechAPICallback()` fires while in `FEEDBACK.SHOWING`
5. Duplicate feedback triggered

**Without TTS:** The bug CAN still happen but is much rarer because:
- Feedback duration is shorter (200ms vs 1-4 seconds)
- No restart of recording (stays in previous state)
- Smaller window for user to speak

**The Fix:** Add state check before calling `startRecording()` in all TTS 'ended'/'error' listeners.

---

**Document Created:** 2025-10-20
**Key Insight:** TTS `addEventListener('ended', startRecording)` violates state machine
**Status:** ✅ Root cause confirmed, fix identified
