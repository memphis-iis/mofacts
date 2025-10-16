# TTS Recording Lock Bug Fix

**Created:** October 14, 2025
**Status:** Fixed
**Files:** `card.js:3686-3760`

## Problem

When Text-to-Speech (TTS) audio feedback was enabled, speech recognition would become permanently locked and stop working after the first TTS playback.

### Symptoms
- Recording works for first trial
- After TTS plays feedback, recording never starts again
- Console shows: `[SR] ❌ RECORDING BLOCKED: RECORDING LOCKED (TTS audio likely playing)`
- No subsequent speech recognition possible

### Root Cause

The recording lock was set **before** the async TTS API call:

```javascript
// OLD CODE (BUGGY)
console.log('[SR]   ⚠️ LOCKING RECORDING for TTS playback');
Session.set('recordingLocked', true);  // ← Lock set here

Meteor.call('makeGoogleTTSApiCall', ..., function(err, res) {
  if(err){
    console.log(err)  // ← Lock never released!
  }
  else if(res == undefined){
    console.log('undefined')  // ← Lock never released!
  }
  else{
    // Lock eventually released when audio ends
  }
});
```

**Problem:** If the TTS API call failed or returned undefined, the lock was never released, causing permanent lockout.

## Solution

Move the recording lock **inside** the TTS success callback:

```javascript
// NEW CODE (FIXED)
Meteor.call('makeGoogleTTSApiCall', ..., function(err, res) {
  if(err){
    console.log('[SR]   ❌ TTS API error, NOT locking recording:', err);
    // No lock = recording continues immediately
  }
  else if(res == undefined){
    console.log('[SR]   ❌ TTS API returned undefined, NOT locking recording');
    // No lock = recording continues immediately
  }
  else{
    console.log('[SR]   ✅ TTS audio received, LOCKING RECORDING');
    Session.set('recordingLocked', true);  // ← Lock only on success
    // ... play audio, then unlock when finished
  }
});
```

## Additional Fix: MDN Speech Synthesis Fallback

The fallback path (when no TTS API key is configured) had a similar bug with no event listeners:

### Before
```javascript
// OLD CODE
console.log('[SR]   Text-to-Speech API key not found, using MDN Speech Synthesis (NO CALLBACK!)');
let utterance = new SpeechSynthesisUtterance(msg);
synthesis.speak(utterance);
// ⚠️ BUG: No event listener to unlock recording when this finishes!
```

### After
```javascript
// NEW CODE (FIXED)
console.log('[SR]   Text-to-Speech API key not found, using MDN Speech Synthesis');
console.log('[SR]   ✅ LOCKING RECORDING for MDN TTS playback');
Session.set('recordingLocked', true);

let utterance = new SpeechSynthesisUtterance(msg);

utterance.addEventListener('end', (event) => {
  console.log('[SR]   ✅ MDN TTS ended, unlocking recording');
  Session.set('recordingLocked', false);
  startRecording();
});

utterance.addEventListener('error', (event) => {
  console.log('[SR]   ❌ MDN TTS error, unlocking recording');
  console.log(event);
  Session.set('recordingLocked', false);
  startRecording();
});

synthesis.speak(utterance);
```

## State Flow

### Correct Flow (After Fix)
```
1. User answers correctly
2. TTS API call initiated (async)
3. [If success] → Lock recording → Play audio → Unlock → Start recording
4. [If error]   → No lock → Recording continues immediately
5. [If undefined] → No lock → Recording continues immediately
6. User can answer next question ✅
```

### Old Buggy Flow
```
1. User answers correctly
2. Lock recording immediately ← BUG: Locked before knowing if TTS will succeed
3. TTS API call initiated (async)
4. [If error]   → Lock never released ← BUG: Permanent lockout
5. [If undefined] → Lock never released ← BUG: Permanent lockout
6. Recording stays locked forever ❌
7. No more speech recognition possible ❌
```

## Testing

### Test Case 1: Normal TTS Operation
```
1. Enable audio feedback
2. Answer trial correctly
3. ✅ TTS plays "Correct"
4. ✅ Recording automatically resumes
5. Answer next trial
6. ✅ Works correctly
```

### Test Case 2: TTS API Error
```
1. Enable audio feedback
2. Simulate TTS API error (network failure, invalid key)
3. ✅ Error logged, no lock set
4. ✅ Recording continues immediately
5. User can continue without interruption
```

### Test Case 3: MDN Fallback
```
1. Enable audio feedback, no API key
2. Answer trial correctly
3. ✅ MDN Speech Synthesis speaks feedback
4. ✅ Recording automatically resumes after speech ends
5. Answer next trial
6. ✅ Works correctly
```

## Code Changes

### File: `card.js`

#### Change 1: Remove premature lock (line 3687-3689)
```diff
  if (enableAudioPromptAndFeedback) {
    if (audioPromptSource === audioPromptMode || audioPromptMode === 'all') {
-     console.log('[SR]   ⚠️ LOCKING RECORDING for TTS playback');
-     Session.set('recordingLocked', true);
+     // Note: Recording lock moved INSIDE TTS success callback to avoid permanent lock on errors
```

#### Change 2: Lock only on success (line 3710-3713)
```diff
        Meteor.call('makeGoogleTTSApiCall', ..., function(err, res) {
          if(err){
-           console.log(err)
+           console.log('[SR]   ❌ TTS API error, NOT locking recording:', err);
          }
          else if(res == undefined){
-           console.log('makeGoogleTTSApiCall returned undefined object')
+           console.log('[SR]   ❌ TTS API returned undefined, NOT locking recording');
          }
          else{
+           console.log('[SR]   ✅ TTS audio received, LOCKING RECORDING');
            const audioObj = new Audio('data:audio/ogg;base64,' + res)
            Session.set('recordingLocked', true);
```

#### Change 3: Fix MDN fallback (line 3743-3760)
```diff
      } else {
-       console.log('[SR]   Text-to-Speech API key not found, using MDN Speech Synthesis (NO CALLBACK!)');
+       console.log('[SR]   Text-to-Speech API key not found, using MDN Speech Synthesis');
+       console.log('[SR]   ✅ LOCKING RECORDING for MDN TTS playback');
+       Session.set('recordingLocked', true);
        let utterance = new SpeechSynthesisUtterance(msg);
+       utterance.addEventListener('end', (event) => {
+         console.log('[SR]   ✅ MDN TTS ended, unlocking recording');
+         Session.set('recordingLocked', false);
+         startRecording();
+       });
+       utterance.addEventListener('error', (event) => {
+         console.log('[SR]   ❌ MDN TTS error, unlocking recording');
+         console.log(event);
+         Session.set('recordingLocked', false);
+         startRecording();
+       });
        synthesis.speak(utterance);
-       // ⚠️ BUG: No event listener to unlock recording when this finishes!
      }
```

## Logging

### Success Path
```
[SR]   Providing Google TTS audio feedback (async)
[SR]   ✅ TTS audio received, LOCKING RECORDING
[SR]   ✅ TTS audio ended, unlocking recording
[SR] ========== startRecording() CALLED ==========
[SR] RECORDING START
```

### Error Path
```
[SR]   Providing Google TTS audio feedback (async)
[SR]   ❌ TTS API error, NOT locking recording: [error details]
[SR] ========== startRecording() CALLED ==========
[SR] RECORDING START
```

### MDN Fallback Path
```
[SR]   Text-to-Speech API key not found, using MDN Speech Synthesis
[SR]   ✅ LOCKING RECORDING for MDN TTS playback
[SR]   ✅ MDN TTS ended, unlocking recording
[SR] ========== startRecording() CALLED ==========
[SR] RECORDING START
```

## Related Issues

### Similar Patterns to Watch
Any time we use async operations with recording locks, ensure:
1. Lock is set **after** verifying success, not before
2. All error paths unlock recording
3. All success paths have 'end' and 'error' event listeners
4. Event listeners call `startRecording()` to resume

### Prevention
- Always add comprehensive logging around lock/unlock operations
- Test error paths, not just happy path
- Document async lock patterns in code comments

## Impact

**Severity:** High - Completely broke SR after first TTS playback
**Frequency:** 100% when audio feedback enabled
**Users Affected:** All users with TTS audio feedback enabled
**Fix Difficulty:** Low - Simple logic reordering
**Testing:** Easy to verify with audio feedback enabled
