# Multiple SR Bugs - Systematic Analysis

## LATEST TEST RESULTS (2025-10-14 11:21)

### Trial 1: ✅ SUCCESS!
```
card.js:4092 [SR] RECORDING START
card.js:4037 [SR] VOICE START
card.js:4076 [SR] VOICE STOP (after 369ms)
card.js:3828 [SR] Speech API response: "Poland"
card.js:3873 [SR] Transcribed text: "poland"
```
**First trial worked perfectly!** Voice detected, transcribed, answer accepted.

### Trial 2: ❌ FAILED
- Icon fully gray from start
- No `[SR] RECORDING START` in logs
- User reports no response accepted
- **Critical finding:** `startRecording()` is NOT being called at all for trial 2

---

## Bug Status

### Bug #1: Hark stopped_speaking Firing Without speaking ✅ FIXED
**Status:** FIXED in trial 1 - voice was detected and processed correctly

**The Fix:**
```javascript
// Line 4063-4067
if (!recordingStartTime) {
  console.log('[SR] VOICE STOP IGNORED - voice never started (speaking event never fired)');
  return;
}
```

**Evidence of fix working:** Trial 1 showed proper `[SR] VOICE START` → `[SR] VOICE STOP (after 369ms)` sequence

---

### Bug #2: stopRecording() Called from stopUserInput() ✅ PROBABLY FIXED
**Status:** Likely fixed (commented out at line 3654)

**Evidence:** Trial 1 worked, suggesting this fix is in place

---

### Bug #3: startRecording() Not Called on Trial 2 ❌ NEW BUG - CRITICAL
**Status:** ACTIVE - This is the blocking bug for trial 2+

**Evidence:**
- Trial 1: `[SR] RECORDING START` appears
- Trial 2: No `[SR] RECORDING START` in logs
- Icon gray on trial 2 (consistent with recording never starting)

**Hypothesis:** `allowUserInput()` is not calling `startRecording()` on subsequent trials

**Need to investigate:**
1. Is `allowUserInput()` being called on trial 2?
2. Does it call `startRecording()` on trial 2?
3. If yes, why does `startRecording()` fail its conditions check?

**Search in logs for trial 2:**
Looking for:
- `allow user input` (line 3604)
- `[SR] RECORDING START` (should appear after allowUserInput)
- `[SR] NO RECORDER / RECORDING LOCKED DURING AUDIO PLAYING` (if conditions fail)

**From the provided logs:**
- Last log entry is trial setup, no allowUserInput or startRecording for trial 2
- **User needs to provide logs from trial 2 start**

---

### Bug #4: recorder Object Lost Between Trials ⚠️ POSSIBLE
**Status:** Needs investigation

**Evidence:**
- User previously reported `recorder exists: false`
- Trial 1 worked (recorder existed)
- Trial 2 failed (possibly recorder destroyed?)

**Need to check:**
```javascript
// Add logging to startRecording():
console.log('[SR] startRecording called');
console.log('[SR]   recorder exists:', !!recorder);
console.log('[SR]   recordingLocked:', Session.get('recordingLocked'));
console.log('[SR]   audioInputMode:', Meteor.user().audioInputMode);
```

---

## Code Analysis Needed

### Where is startRecording() called?

From previous grep:
```
Line 1901: startRecording(); // After force correct feedback
Line 2435: startRecording(); // In force correct flow
Line 3622: startRecording(); // In allowUserInput() ← KEY
Line 3709: startRecording(); // After audio feedback ends
Line 3717: startRecording(); // After audio feedback ends
Line 3923: startRecording(); // After out-of-grammar feedback
Line 3940: startRecording(); // In dialogue continue
```

**Line 3622 in allowUserInput() is the primary call for normal trials**

### allowUserInput() code:
```javascript
// Line 3604-3626
function allowUserInput() {
  console.log('allow user input');
  console.log('[SM] allowUserInput called in state:', currentTrialState);
  inputDisabled = false;

  // ... show UI elements ...

  startRecording(); // ← Line 3622

  // ... timeout setup ...
}
```

**Question:** Is `allowUserInput()` being called on trial 2?

---

## Next Debugging Steps

### 1. Get complete trial 2 logs
User needs to provide console logs starting from:
- When trial 2 question appears
- Through when they try to speak
- Should include:
  - State transitions
  - `allow user input` message
  - Any `[SR]` messages
  - Icon state changes

### 2. Add comprehensive logging to startRecording()

Add before line 4083:
```javascript
function startRecording() {
  console.log('[SR] ========== startRecording() CALLED ==========');
  console.log('[SR] Conditions check:');
  console.log('[SR]   recorder exists:', !!recorder, recorder);
  console.log('[SR]   recordingLocked:', Session.get('recordingLocked'));
  console.log('[SR]   audioInputMode:', Meteor.user().audioInputMode);
  console.log('[SR]   Meteor.user():', Meteor.user());

  if (recorder && !Session.get('recordingLocked') && Meteor.user().audioInputMode) {
    Session.set('recording', true);
    recorder.record();
    console.log('[SR] RECORDING START');
    console.log('[SR]   recorder.recording:', recorder.recording);
  } else {
    console.log('[SR] ❌ RECORDING NOT STARTED - condition failed:');
    if (!recorder) console.log('[SR]     - NO RECORDER');
    if (Session.get('recordingLocked')) console.log('[SR]     - RECORDING LOCKED');
    if (!Meteor.user().audioInputMode) console.log('[SR]     - AUDIO INPUT MODE OFF');
  }
  console.log('[SR] ========================================');
}
```

### 3. Add logging to allowUserInput()

Add after line 3604:
```javascript
function allowUserInput() {
  console.log('[SR] ========== allowUserInput() CALLED ==========');
  console.log('allow user input');
  console.log('[SM] allowUserInput called in state:', currentTrialState);
  console.log('[SR] About to call startRecording()...');
  inputDisabled = false;

  // ... existing code ...

  startRecording();
  console.log('[SR] startRecording() call completed');
  console.log('[SR] ==========================================');

  // ... rest of function ...
}
```

### 4. Check if recorder is being destroyed

Add after line 4010 where recorder is created:
```javascript
recorder = new Recorder(input, audioRecorderConfig);
console.log('[SR] RECORDER CREATED:', recorder);
window.debugRecorder = recorder; // Make globally accessible for debugging

// Add property setter to track if it gets set to null
let _recorder = recorder;
Object.defineProperty(window, 'recorderTracker', {
  get() { return _recorder; },
  set(val) {
    console.log('[SR] ⚠️ RECORDER MODIFIED:', val, new Error().stack);
    _recorder = val;
  }
});
```

---

## Likely Root Cause for Trial 2 Failure

Based on symptoms:
1. Trial 1 works perfectly
2. Trial 2: icon gray, no recording
3. No `[SR] RECORDING START` log

**Most likely causes (in order):**
1. **allowUserInput() not being called on trial 2** - check state machine flow
2. **startRecording() conditions failing** - recorder destroyed or audioInputMode toggled off
3. **Meteor.user() returns different object** - reactive data source issue
4. **Session.get('recordingLocked') stuck true** - from trial 1 audio feedback

**Need user to provide trial 2 logs to determine which!**
