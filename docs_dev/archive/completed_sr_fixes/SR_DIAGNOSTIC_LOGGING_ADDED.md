# SR Diagnostic Logging Added - 2025-10-14

## Purpose
Added comprehensive diagnostic logging to trace why speech recognition (SR) fails on trial 2+. Based on analysis, the suspected root cause is that `audioPromptMode` is enabled and locks recording before `startRecording()` can execute.

## Changes Made to card.js

### 1. Enhanced startRecording() Logging (Lines 4088-4108)

**What was added:**
- Logs all condition checks before attempting to start recording
- Shows detailed failure reasons when recording is blocked
- Tracks recorder state and all session variables

**New logs will show:**
```
[SR] ========== startRecording() CALLED ==========
[SR] Conditions check:
[SR]   recorder exists: true/false
[SR]   recordingLocked: true/false
[SR]   audioInputMode: true/false
[SR]   audioPromptMode: 'question'/'all'/'silent'/undefined
```

**If recording starts successfully:**
```
[SR] RECORDING START
[SR]   recorder.recording: true
```

**If recording is blocked:**
```
[SR] ❌ RECORDING BLOCKED:
[SR]     - NO RECORDER (if recorder is null)
[SR]     - RECORDING LOCKED (TTS audio likely playing) (if recordingLocked is true)
[SR]     - AUDIO INPUT MODE OFF (if audioInputMode is false)
```

### 2. Enhanced speakMessageIfAudioPromptFeedbackEnabled() Logging (Lines 3671-3751)

**What was added:**
- Logs when function is called and why
- Shows when `recordingLocked` is set to `true`
- Tracks when TTS audio ends and unlocks recording
- Identifies the missing callback bug in MDN Speech Synthesis path

**New logs will show:**
```
[SR] ========== speakMessageIfAudioPromptFeedbackEnabled() CALLED ==========
[SR]   audioPromptSource: 'question'/'feedback'
[SR]   audioPromptMode: 'question'/'all'/'silent'/undefined
[SR]   enableAudioPromptAndFeedback: true/false
```

**If TTS is activated:**
```
[SR]   ⚠️ LOCKING RECORDING for TTS playback
[SR]   Providing Google TTS audio feedback (async)
```

**When TTS finishes:**
```
[SR]   ✅ TTS audio ended, unlocking recording
```

**If fallback to MDN Speech Synthesis:**
```
[SR]   Text-to-Speech API key not found, using MDN Speech Synthesis (NO CALLBACK!)
```
⚠️ **This path has a bug - no event listener to unlock recording!**

### 3. Enhanced allowUserInput() Logging (Lines 3603-3626)

**What was added:**
- Clearly marks when `allowUserInput()` is called
- Shows when `startRecording()` is about to be called
- Confirms when `startRecording()` call completes

**New logs will show:**
```
[SR] ========== allowUserInput() CALLED ==========
allow user input
[SM] allowUserInput called in state: PRESENTING.AWAITING
[SR] About to call startRecording()...
[SR] startRecording() call completed
[SR] ==========================================
```

## Root Cause Hypothesis

Based on code analysis at [card.js:3592-3594](mofacts/client/views/experiment/card.js#L3592-L3594):

```javascript
// Line 3592: Call TTS (sets recordingLocked=true synchronously)
speakMessageIfAudioPromptFeedbackEnabled(questionToSpeak, 'question');

// Line 3594: Called IMMEDIATELY after (doesn't wait for TTS to finish)
allowUserInput();  // This calls startRecording() which fails the recordingLocked check
```

**The bug:** `allowUserInput()` is called immediately after `speakMessageIfAudioPromptFeedbackEnabled()`, not waiting for the TTS audio to finish playing. This causes:

1. **Trial 1:**
   - No TTS has played yet
   - `recordingLocked` is false (initialized at line 163)
   - `startRecording()` succeeds ✅

2. **Trial 2+:**
   - `speakMessageIfAudioPromptFeedbackEnabled()` is called
   - Line 3683 sets `recordingLocked = true` **immediately**
   - Line 3594 calls `allowUserInput()` **before the async TTS API call completes**
   - `startRecording()` fails because `!Session.get('recordingLocked')` is false ❌
   - Icon stays gray ❌

## Expected Log Sequence on Trial 2 (with bug)

```
[SR] ========== speakMessageIfAudioPromptFeedbackEnabled() CALLED ==========
[SR]   audioPromptSource: question
[SR]   audioPromptMode: question (or 'all')
[SR]   enableAudioPromptAndFeedback: true
[SR]   ⚠️ LOCKING RECORDING for TTS playback
[SR]   Providing Google TTS audio feedback (async)
[SR] ==========================================

[SR] ========== allowUserInput() CALLED ==========
[SR] About to call startRecording()...

[SR] ========== startRecording() CALLED ==========
[SR] Conditions check:
[SR]   recorder exists: true
[SR]   recordingLocked: true  ← BLOCKED!
[SR]   audioInputMode: true
[SR]   audioPromptMode: question
[SR] ❌ RECORDING BLOCKED:
[SR]     - RECORDING LOCKED (TTS audio likely playing)
[SR] ==========================================

[SR] startRecording() call completed
[SR] ==========================================

... later when TTS finishes ...

[SR]   ✅ TTS audio ended, unlocking recording
[SR] ========== startRecording() CALLED ==========
[SR] Conditions check:
[SR]   recorder exists: true
[SR]   recordingLocked: false
[SR]   audioInputMode: true
[SR] RECORDING START
[SR]   recorder.recording: true
[SR] ==========================================
```

## Next Steps

1. **Test with these logs** to confirm the hypothesis
2. **If confirmed**, implement the callback-based fix:
   - Make `speakMessageIfAudioPromptFeedbackEnabled()` accept a callback parameter
   - Only call `allowUserInput()` after TTS finishes OR if no TTS
   - This matches the existing pattern for audio files (lines 3568-3578)

## Additional Bug Found

At line 3738-3742, when falling back to MDN Speech Synthesis, there's no event listener to unlock `recordingLocked`. This will cause recording to be permanently locked if the Google TTS API is unavailable.

**Fix needed:**
```javascript
} else {
  console.log('[SR]   Text-to-Speech API key not found, using MDN Speech Synthesis');
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
}
```

## Files Modified

- `mofacts/client/views/experiment/card.js`
  - Lines 4088-4108: Enhanced `startRecording()` logging
  - Lines 3671-3751: Enhanced `speakMessageIfAudioPromptFeedbackEnabled()` logging
  - Lines 3603-3626: Enhanced `allowUserInput()` logging

## How to Test

1. Deploy these changes to the server
2. Run a trial with `audioPromptMode` enabled (set to 'question' or 'all')
3. Check console logs on trial 2
4. Logs should confirm:
   - `speakMessageIfAudioPromptFeedbackEnabled()` locks recording
   - `allowUserInput()` is called immediately (doesn't wait)
   - `startRecording()` fails the `recordingLocked` check
   - TTS audio finishes later and unlocks, then calls `startRecording()` successfully

## Related Documentation

- [SR_MULTIPLE_BUGS.md](SR_MULTIPLE_BUGS.md) - Original bug tracking
- [SR_BUG_ANALYSIS.md](SR_BUG_ANALYSIS.md) - Initial investigation
- [SR_ROOT_CAUSE.md](SR_ROOT_CAUSE.md) - Root cause analysis
- [SR_FIX_SUMMARY.md](SR_FIX_SUMMARY.md) - Previous fixes for Bug #1 and #2
