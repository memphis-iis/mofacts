# SR Bug Fix Summary

## Bugs Identified and Fixed

### Bug #1: stopRecording() Called from stopUserInput()
**Problem:** `stopUserInput()` was calling `stopRecording()` which cleared the audio buffer before Hark could process it.

**Fix:** Commented out `stopRecording()` call at line 3654.

**File:** card.js line 3654
```javascript
// OLD:
stopRecording();

// NEW:
// stopRecording(); // COMMENTED OUT - destroys audio buffer before API can process it
```

**Status:** ✅ FIXED (already done)

---

###Bug #2: Hark stopped_speaking Fires Without speaking Event
**Problem:** Hark's `stopped_speaking` event was firing immediately after `startRecording()`, even when no voice was detected. This happened because `recordingStartTime` was null (since 'speaking' never fired), so the guard check failed.

**Consequence:**
- `Session.set('recording', false)` executed
- Icon turned gray after ~20ms
- Recording stopped before user could speak
- No audio ever reached the Speech API

**Root Cause:** The guard at line 4065 checked:
```javascript
if (recordingStartTime && timeSinceStart < 200)
```

When `recordingStartTime` is null, this evaluates to false, allowing the stop to proceed.

**Fix:** Added explicit null check BEFORE calculating time:
```javascript
// CRITICAL: Only process voice stop if voice actually started
if (!recordingStartTime) {
  console.log('[SR] VOICE STOP IGNORED - voice never started (speaking event never fired)');
  return;
}

// Now safe to calculate time since recordingStartTime is not null
const timeSinceStart = Date.now() - recordingStartTime;
if (timeSinceStart < 200) {
  console.log(`[SR] VOICE STOP TOO QUICK (${timeSinceStart}ms) - ignoring`);
  return;
}
```

**File:** card.js lines 4063-4072

**Status:** ✅ FIXED

---

## Why Wasn't Speaking Detected?

**This is STILL UNKNOWN and needs investigation.**

Possible causes:
1. **Microphone audio not reaching Hark** - Stream exists but no data
2. **Volume below threshold** - All audio below -20 dB
3. **Audio context in invalid state** - Exists but not processing
4. **Browser security blocking audio** - Even with HTTPS and permissions

**Next step:** Add volume monitoring to see what Hark is receiving:
```javascript
// Add after line 4027 where speechEvents is created:
speechEvents.on('volume_change', function(volume, threshold) {
  console.log('[SR] Volume:', volume.toFixed(2), 'Threshold:', threshold);
});
```

---

## Changes Made

### File: mofacts/client/views/experiment/card.js

**Change 1 (Line 3654):**
```javascript
inputDisabled = true;
// stopRecording(); // COMMENTED OUT - destroys audio buffer before API can process it
```

**Change 2 (Lines 4063-4072):**
```javascript
} else {
  // CRITICAL: Only process voice stop if voice actually started
  if (!recordingStartTime) {
    console.log('[SR] VOICE STOP IGNORED - voice never started (speaking event never fired)');
    return;
  }

  // Prevent stopping too quickly if voice never started properly
  const timeSinceStart = Date.now() - recordingStartTime;
  if (timeSinceStart < 200) {
    console.log(`[SR] VOICE STOP TOO QUICK (${timeSinceStart}ms) - ignoring`);
    return;
  }
```

---

## How to Deploy

1. **Transfer files to server:**
   ```bash
   # Run from: c:/Users/ppavl/OneDrive/Active projects/mofacts_config/

   # Line 1 of "scp for code transfer.txt":
   scp mofacts/client/views/experiment/card.js ... phil@192.168.50.127:~/temp_transfer/
   ```

2. **Move files into place:**
   ```bash
   # Line 2 of "scp for code transfer.txt":
   ssh phil@192.168.50.127 "mkdir -p ~/temp_transfer && mv ~/temp_transfer/card.js ~/mofacts-2/mofacts/mofacts/client/views/experiment/ && ..."
   ```

3. **Meteor will auto-reload** - wait for "Client modified -- refreshing" message

4. **Test SR:**
   - Reload page in browser
   - Start a trial
   - Icon should stay RED (not turn gray)
   - Speak into microphone
   - Watch console for new log: `[SR] VOICE STOP IGNORED - voice never started...`

---

## Expected Behavior After Fix

### If Microphone IS Working:
- Icon stays RED
- `[SR] VOICE START` appears when you speak
- `[SR] VOICE STOP (after XXXms)` appears when you stop
- Transcription sent to API
- Answer validated

### If Microphone IS NOT Working:
- Icon stays RED (this is the fix!)
- `[SR] VOICE STOP IGNORED - voice never started` appears in console
- Recording continues (doesn't prematurely stop)
- Eventually timeout will occur
- **Then we can investigate WHY speaking isn't detected**

The key improvement: Icon won't falsely turn gray, and we'll get clear logging about what's actually happening.

---

## Next Investigation Steps

After deploying this fix, if SR still doesn't work:

1. **Check volume levels:**
   ```javascript
   speechEvents.on('volume_change', function(volume, threshold) {
     console.log('[SR] Volume:', volume.toFixed(2), 'Threshold:', threshold);
   });
   ```
   - Speak into mic
   - Check if volume ever goes above threshold
   - If always below: mic not working or threshold too high

2. **Check recorder state:**
   ```javascript
   console.log('[SR] recorder.recording:', recorder.recording);
   console.log('[SR] audioContext.state:', audioContext.state);
   ```
   - Should be `true` and `"running"`

3. **Check browser mic access:**
   - Open chrome://settings/content/microphone
   - Verify site has permission
   - Check if correct mic is selected

4. **Test mic externally:**
   - Visit https://onlinemictest.com/
   - Verify Windows mic actually works
   - User already confirmed this works

---

## Documentation Updated

- Created `SR_BUG_ANALYSIS.md` - Initial investigation
- Created `SR_MULTIPLE_BUGS.md` - Systematic bug listing
- Created `SR_ROOT_CAUSE.md` - Root cause analysis
- Created `SR_FIX_SUMMARY.md` (this file) - Fix documentation
