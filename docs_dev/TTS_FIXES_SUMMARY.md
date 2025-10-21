# TTS Fixes Summary - 2025-01-19

## Issues Fixed

### 1. TTS Bleeding Into Next Trial (CRITICAL)
**File:** `card.js:2720`

**Problem:** When `reviewstudy` timeout expired during a drill, TTS audio from the previous trial would play during the next trial if the Google TTS API was slow to respond.

**Root Cause:** Missing `await` keyword - the timeout callback called `afterFeedbackCallbackBind()` without waiting for the Promise.all inside it to complete.

**Fix:**
```javascript
// OLD (BUGGY)
const timeout = Meteor.setTimeout(async function() {
  afterFeedbackCallbackBind()  // ← Missing await
  engine.updatePracticeTime(Date.now() - trialEndTimeStamp)
}, reviewTimeout)

// NEW (FIXED)
const timeout = Meteor.setTimeout(async function() {
  await afterFeedbackCallbackBind()  // ← Added await
  engine.updatePracticeTime(Date.now() - trialEndTimeStamp)
}, reviewTimeout)
```

**Impact:** The `reviewstudy` timeout now **extends** if TTS hasn't completed yet. Trial only advances when whichever happens LAST:
- `reviewstudy` timer expires (e.g., 5000ms)
- TTS audio finishes playing
- 30-second failsafe triggers (for network issues)

---

### 2. 30-Second Failsafe Doesn't Stop Audio
**File:** `card.js:2850-2858`

**Problem:** When the 30-second TTS failsafe triggered, it set `ttsRequested=false` to continue the trial, but didn't stop the audio playback. If the TTS API eventually responded, audio would play on the wrong trial.

**Fix:** Added audio cleanup when failsafe triggers:
```javascript
if (Session.get('ttsRequested')) {
  Meteor.clearInterval(checkTTS);
  clientConsole(1, '[SM] ⚠️ TTS timeout (30s), forcing continue');

  // FIX: Stop any playing/pending audio
  if (window.currentAudioObj) {
    clientConsole(1, '[SM]   Stopping orphaned TTS audio from timeout');
    window.currentAudioObj.pause();
    window.currentAudioObj = undefined;
  }

  Session.set('ttsRequested', false);
  Session.set('recordingLocked', false); // Unlock recording
  resolve();
}
```

---

### 3. No Audio Cleanup During Trial Transitions
**File:** `card.js:3223-3230`

**Problem:** No defensive cleanup of orphaned TTS audio during trial transitions. Edge cases could leave audio playing.

**Fix:** Added audio cleanup to `cleanupTrialContent()`:
```javascript
function cleanupTrialContent() {
  clientConsole(2, '[SM] cleanupTrialContent called in state:', currentTrialState);

  // FIX: Stop any orphaned TTS audio from previous trial
  if (window.currentAudioObj) {
    clientConsole(2, '[SM]   Stopping orphaned TTS audio during cleanup');
    window.currentAudioObj.pause();
    window.currentAudioObj = undefined;
  }

  // ... rest of cleanup
}
```

---

### 4. Slow First Trial TTS After Hot Code Reload
**File:** `profileAudioToggles.js:149-162`

**Problem:** TTS warmup only happened when user clicked the audio toggle icon. After hot code reload, if audio was already enabled, the warmup never ran again, causing 8-9 second delay on first trial.

**Fix:** Added automatic warmup on profile page load if audio already enabled:
```javascript
Template.profileAudioToggles.rendered = function() {
  // ... existing code ...

  // FIX: Warm up TTS on page load if audio prompts are already enabled
  // This handles hot code reload - user has audio enabled, code reloads,
  // warmup needs to happen again BEFORE they start practicing
  const audioPromptMode = Meteor.user()?.audioPromptMode;
  if (audioPromptMode && audioPromptMode !== 'silent') {
    console.log('[TTS] Audio prompts enabled, warming up on profile page load');
    setTimeout(() => {
      if (!Session.get('ttsWarmedUp')) {
        warmupGoogleTTS();
      }
    }, 500); // Wait for TDF to load
  }
};
```

**Also updated warmupGoogleTTS():**
- Set `Session.set('ttsWarmedUp', true)` to prevent duplicates
- Changed volume to `0.0` for silent warmup
- Reset flag on failure to allow retry

---

### 5. Enhanced Timing Logs
**Files:** `card.js:2816-2873`

**Problem:** Difficult to diagnose timing issues without visibility into countdown vs TTS completion.

**Fix:** Added comprehensive logging:
```javascript
// Countdown duration
const countdownDuration = Date.now() - countdownStartTime;
clientConsole(2, `[SM] ⏱️ Countdown finished after ${countdownDuration}ms`);

// TTS duration
const ttsDuration = Date.now() - ttsStartTime;
clientConsole(2, `[SM] 🎤 TTS request complete after ${ttsDuration}ms`);

// Total wait time
const waitDuration = Date.now() - startWait;
clientConsole(2, `[SM] ✅ Both countdown and TTS complete (waited ${waitDuration}ms), transitioning to next trial`);
```

---

## Expected Behavior After All Fixes

### Normal Flow (TTS completes before reviewstudy)
```
1. User answers incorrectly
2. TTS API called for feedback
3. TTS returns in 2000ms, plays audio
4. reviewstudy=5000ms expires
5. Promise.all waits for both (countdown already done, TTS already done)
6. Trial advances after 5000ms total
Result: ✅ Feedback plays for full duration
```

### Extended Flow (TTS slower than reviewstudy)
```
1. User answers incorrectly
2. TTS API called for feedback
3. reviewstudy=5000ms expires
4. Promise.all waits for TTS (still pending)
5. TTS returns at 8000ms, plays audio
6. Audio finishes at 8500ms
7. Promise.all resolves
8. Trial advances after 8500ms total
Result: ✅ reviewstudy EXTENDED to wait for TTS
```

### Failsafe Flow (TTS very slow or network issues)
```
1. User answers incorrectly
2. TTS API called for feedback
3. reviewstudy=5000ms expires
4. Promise.all waits for TTS
5. 30 seconds pass, failsafe triggers
6. Audio stopped, recording unlocked
7. Trial advances after 30000ms
Result: ✅ Doesn't wait forever, safe recovery
```

### Hot Code Reload Flow
```
1. User has audio enabled, is on profile page
2. Hot code reload happens
3. Profile page re-renders
4. Template.rendered checks audioPromptMode
5. Finds audio enabled → calls warmupGoogleTTS()
6. Warmup completes in ~200-500ms
7. User starts practice
8. First trial TTS is fast (already warmed up)
Result: ✅ No 8-9 second delay on first trial
```

---

## Testing Checklist

- [x] Fix 1: TTS plays in correct trial when API is slow
- [x] Fix 2: 30s failsafe stops orphaned audio
- [x] Fix 3: Trial transitions don't leave audio playing
- [x] Fix 4: Hot code reload re-warms TTS
- [x] Fix 5: Logs show timing details

### Manual Test Scenarios

1. **Slow TTS during drill**
   - Network throttle to slow 3G
   - Answer incorrectly
   - Verify audio plays in CURRENT trial, not next

2. **Very slow TTS (30s+ timeout)**
   - Disconnect network mid-trial
   - Answer incorrectly
   - Verify 30s failsafe stops audio and continues

3. **Hot code reload**
   - Enable audio on profile page
   - Hot reload code (touch a file)
   - Verify console shows warmup on page reload
   - Start practice, verify first trial TTS is fast

4. **Countdown disabled**
   - Set displayReviewTimeoutAsBarOrText = 'none'
   - Verify fix still works without visual countdown

---

## Related Documentation

- [TTS_REVIEWSTUDY_TIMEOUT_FIX.md](TTS_REVIEWSTUDY_TIMEOUT_FIX.md) - Detailed explanation of Fix #1
- [TTS_RECORDING_LOCK_FIX.md](TTS_RECORDING_LOCK_FIX.md) - Previous TTS fix (recording lock)
- [SPEECH_RECOGNITION_STATE_MACHINE.md](SPEECH_RECOGNITION_STATE_MACHINE.md) - Original bug analysis

---

## Files Modified

1. `mofacts/client/views/experiment/card.js`
   - Line 2720: Added `await` to afterFeedbackCallbackBind()
   - Lines 2816-2873: Enhanced timing logs
   - Lines 2850-2858: Audio cleanup in 30s failsafe
   - Lines 3223-3230: Audio cleanup in cleanupTrialContent()

2. `mofacts/client/views/home/profileAudioToggles.js`
   - Lines 149-162: Auto-warmup on page load if audio enabled
   - Lines 343-375: Updated warmupGoogleTTS() with Session flag
