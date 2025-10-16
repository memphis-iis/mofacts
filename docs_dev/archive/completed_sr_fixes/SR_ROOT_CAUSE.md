# SR Root Cause Analysis - FINAL

## The Smoking Gun

**User Log:**
```
card.js:4086 [SR] RECORDING START
card.js:4093 [SR] stopRecording Recorder {...} false
                                            ^^^^
                                            This is Session.get('recording')
```

**Code:**
```javascript
// Line 4082-4090
function startRecording() {
  if (recorder && !Session.get('recordingLocked') && Meteor.user().audioInputMode) {
    Session.set('recording', true);  // ← Sets to TRUE
    recorder.record();
    console.log('[SR] RECORDING START');
  }
}

// Line 4092-4101
function stopRecording() {
  console.log('[SR] stopRecording', recorder, Session.get('recording'));  // ← Logs FALSE
  if (recorder && Session.get('recording')) {  // ← This check FAILS
    recorder.stop();
    Session.set('recording', false);
    recorder.clear();
    console.log('[SR] RECORDING END');  // ← Never logs
  }
}
```

## Timeline of Events

1. `allowUserInput()` called
2. → `startRecording()` called
3. → `Session.set('recording', true)` ✓
4. → `recorder.record()` called ✓
5. → `[SR] RECORDING START` logs ✓
6. → Icon turns RED (mic_on.png) ✓
7. **→ Something sets `Session.set('recording', false)`** ❌
8. → Icon turns GRAY (mic_off.png) ❌
9. → `stopRecording()` called
10. → But `Session.get('recording')` is FALSE
11. → So the if-block doesn't execute
12. → `recorder.stop()` is NEVER called
13. → Recorder keeps running but UI shows gray
14. → Hark never fires 'speaking' because...?

## Who Sets recording=false Between Steps 5 and 9?

**Only 2 places in code:**
```javascript
// Line 4072 - Hark stopped_speaking handler
Session.set('recording', false);

// Line 4096 - stopRecording() function
Session.set('recording', false);
```

**But:** stopRecording() can't set it to false because the if-condition would need recording to be true first!

**So:** The Hark `stopped_speaking` handler (line 4051-4076) must be firing!

## Hark stopped_speaking Handler Analysis

```javascript
// Line 4051-4076
speechEvents.on('stopped_speaking', function() {
  if (!Session.get('recording') || Session.get('pausedLocks')>0) {
    // ... navigation checks ...
    console.log('[SR] NOT RECORDING, VOICE STOP');
    return;
  } else {
    // Prevent stopping too quickly if voice never started properly
    const timeSinceStart = recordingStartTime ? Date.now() - recordingStartTime : 0;
    if (recordingStartTime && timeSinceStart < 200) {
      console.log(`[SR] VOICE STOP TOO QUICK (${timeSinceStart}ms) - ignoring`);
      return;
    }

    console.log(`[SR] VOICE STOP (after ${timeSinceStart}ms)`);
    recorder.stop();
    Session.set('recording', false);  // ← THIS LINE
    recorder.exportToProcessCallback();
    recordingStartTime = null;
  }
});
```

**The Problem:** Hark is firing `stopped_speaking` immediately after recording starts!

**Why would Hark fire stopped_speaking so quickly?**

1. **Silence detected immediately** - No initial voice detected, just silence
2. **Audio stream not working** - No audio reaching Hark
3. **Threshold too high** - Brief noise triggers 'speaking', immediate silence triggers 'stopped_speaking'
4. **Environmental pop/click** - Initial audio glitch triggers speaking→stopped sequence

**Evidence:** User said ~20ms delay. The 200ms guard at line 4065-4068 should prevent this!

```javascript
if (recordingStartTime && timeSinceStart < 200) {
  console.log(`[SR] VOICE STOP TOO QUICK (${timeSinceStart}ms) - ignoring`);
  return;
}
```

**BUT:** This guard requires `recordingStartTime` to be set! Let me check...

## The ACTUAL Root Cause

**Line 4032: `recordingStartTime = Date.now();` is set in the 'speaking' handler!**

If `stopped_speaking` fires WITHOUT `speaking` firing first:
- `recordingStartTime` is still `null`
- The guard check `if (recordingStartTime && ...)` is FALSE
- Guard doesn't trigger
- Recording gets stopped!

**This explains everything:**
1. Recording starts
2. Hark immediately detects silence (no 'speaking' event)
3. Hark fires 'stopped_speaking'
4. `recordingStartTime` is null (speaking never fired)
5. Guard check fails
6. `Session.set('recording', false)` executes
7. Icon turns gray
8. `stopRecording()` is called (from somewhere)
9. But recording is already false, so it does nothing

## Why Doesn't 'speaking' Fire?

**Hark Configuration:**
```javascript
const harkOptions = {
  threshold: -20,  // Must be above -20 dB
  interval: 50,    // Check every 50ms
  history: 5,      // Need 5 consecutive samples above threshold
  smoothing: 0.1
};
```

**Possible reasons:**
1. **Microphone not actually sending audio** - Stream exists but no data
2. **Volume too low** - All audio below -20 dB threshold
3. **Audio context in invalid state** - Context exists but not processing
4. **Recorder.record() not actually starting** - Fails silently

## The Fix

**Problem:** stopped_speaking fires when speaking never fired
**Solution:** Only allow stopped_speaking to stop recording if speaking actually fired

```javascript
speechEvents.on('stopped_speaking', function() {
  if (!Session.get('recording') || Session.get('pausedLocks')>0) {
    console.log('[SR] NOT RECORDING, VOICE STOP');
    return;
  } else {
    // CRITICAL: Only stop if voice actually started
    if (!recordingStartTime) {
      console.log('[SR] VOICE STOP IGNORED - voice never started');
      return;  // ← ADD THIS CHECK
    }

    const timeSinceStart = Date.now() - recordingStartTime;
    if (timeSinceStart < 200) {
      console.log(`[SR] VOICE STOP TOO QUICK (${timeSinceStart}ms) - ignoring`);
      return;
    }

    console.log(`[SR] VOICE STOP (after ${timeSinceStart}ms)`);
    recorder.stop();
    Session.set('recording', false);
    recorder.exportToProcessCallback();
    recordingStartTime = null;
  }
});
```

## But Why Doesn't Speaking Fire on First Trial?

Need to investigate:
1. Is audio stream actually carrying data?
2. Is Hark actually initialized and listening?
3. Is the microphone actually being used?
4. What's the volume level Hark is seeing?

**Add volume monitoring:**
```javascript
speechEvents.on('volume_change', function(volume, threshold) {
  console.log('[SR] Volume:', volume.toFixed(2), 'Threshold:', threshold);
});
```
