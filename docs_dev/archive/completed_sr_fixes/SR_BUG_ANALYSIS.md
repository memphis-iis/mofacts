# SR Bug Analysis: Icon Gray, Recorder Missing

## Problem Statement
- **Symptom:** Icon flashes red for ~20ms on first trial, then turns gray
- **Symptom:** All subsequent trials have gray icon from start
- **Console check:** `recorder exists: false`
- **Console check:** `audioInputMode: true`, `recordingLocked: false`, `recording: true`

## State Machine vs Actual Code Mapping

### State 1: IDLE/DISABLED
**Expected:** SR system not initialized
**Code:** card.js:580-581
```javascript
if (audioInputEnabled) {
  initializeAudio(); // Only called ONCE during initCard()
}
```
**✓ CORRECT:** Initialization happens once

---

### State 2: INITIALIZING
**Expected:** getUserMedia() called, waiting for permission
**Code:** card.js:1506-1544
```javascript
function initializeAudio() {
  navigator.mediaDevices.getUserMedia({audio: true, video: false})
    .then(startUserMedia)
    .catch(function(err) {
      console.error('[SR] Error getting user media:', err.name, err.message);
      cardStart(); // Continue without audio
    });
}
```
**✓ CORRECT:** Calls startUserMedia() on success

---

### State 3: MIC_READY
**Expected:** recorder created, speechEvents initialized
**Code:** card.js:3993-4080 (startUserMedia)
```javascript
function startUserMedia(stream) {
  // Line 3999-4001: Create audio context and stream source
  const input = audioContext.createMediaStreamSource(stream);
  streamSource = input;

  // Line 4010: CREATE RECORDER  ← THIS IS CRITICAL
  recorder = new Recorder(input, audioRecorderConfig);

  // Line 4014: Set process callback
  recorder.setProcessCallback(processLINEAR16);

  // Line 4027: CREATE HARK  ← THIS IS CRITICAL
  speechEvents = hark(stream, harkOptions);

  // Line 4031-4049: Set up 'speaking' handler
  speechEvents.on('speaking', function() { ... });

  // Line 4051-4076: Set up 'stopped_speaking' handler
  speechEvents.on('stopped_speaking', function() { ... });

  // Line 4078-4079: Complete initialization
  console.log('[SR] Audio recorder ready');
  cardStart();
}
```

**🔍 OBSERVATION:**
- `recorder` is created at line 4010
- `speechEvents` is created at line 4027
- Both are MODULE-SCOPED variables (declared at line 3984, 3990)
- **This only happens ONCE** - never called again for subsequent trials

---

### State 4: WAITING_FOR_INPUT
**Expected:** startRecording() called, Session recording=true, recorder.record() starts
**Code:** card.js:4082-4090
```javascript
function startRecording() {
  if (recorder && !Session.get('recordingLocked') && Meteor.user().audioInputMode) {
    Session.set('recording', true);
    recorder.record();
    console.log('[SR] RECORDING START');
  } else {
    console.log('[SR] NO RECORDER / RECORDING LOCKED DURING AUDIO PLAYING');
  }
}
```

**❌ BUG IDENTIFIED:**
User console shows:
- `recorder exists: false`
- But `recording: true`
- And `audioInputMode: true`
- And `recordingLocked: false`

**This means:** `Session.set('recording', true)` was called even though `recorder` doesn't exist!

**IMPOSSIBLE!** Line 4083 checks `if (recorder && ...)` - if recorder is falsy, line 4084 cannot execute.

**WAIT - RECHECK THE LOGIC:**
```javascript
if (recorder && !Session.get('recordingLocked') && Meteor.user().audioInputMode) {
  Session.set('recording', true);  // Line 4084 - only runs if recorder exists!
```

If console shows `recording: true` but `recorder: false`, then:
1. `recorder` WAS true when `startRecording()` was called
2. `recorder` BECAME null/undefined AFTER that
3. Something is destroying the recorder object

---

### Where can `recorder` be destroyed?

**Search results from earlier:**
```
Line 441:  stopRecording();  // In leavePage()
Line 1870: stopRecording();  // In handleUserForceCorrectInput()
Line 3654: stopRecording();  // In stopUserInput() - COMMENTED OUT
```

**stopRecording() function (line 4092-4101):**
```javascript
function stopRecording() {
  console.log('[SR] stopRecording', recorder, Session.get('recording'));
  if (recorder && Session.get('recording')) {
    recorder.stop();
    Session.set('recording', false);
    recorder.clear();  // ← Clears buffer but doesn't null recorder
    console.log('[SR] RECORDING END');
  }
}
```

**🔍 stopRecording() does NOT set recorder = null**

**clearAudioContextAndRelatedVariables() (line 1479-1493):**
```javascript
function clearAudioContextAndRelatedVariables() {
  if (streamSource) {
    streamSource.disconnect();
  }
  const tracks = userMediaStream ? userMediaStream.getTracks() : [];
  for (let i=0; i<tracks.length; i++) {
    track.stop();
  }
  selectedInputDevice = null;
  userMediaStream = null;
  streamSource = null;
  // ← DOES NOT SET recorder = null!
}
```

**🔍 clearAudioContextAndRelatedVariables() does NOT set recorder = null**

---

## Critical Discovery

**The recorder object is NEVER explicitly set to null anywhere in the code!**

So how can `recorder exists: false`?

### Hypothesis 1: recorder.clear() destroys the object?
Need to check Recorder.js library - does `.clear()` invalidate the recorder instance?

### Hypothesis 2: Module scope issue
`recorder` is declared as `let recorder = null;` at line 3984. It's module-scoped.
If the module is reloaded/hot-reloaded, it would reset to null.

### Hypothesis 3: recorder.stop() with destroyed stream?
When `clearAudioContextAndRelatedVariables()` destroys the stream sources,
does the Recorder object become invalid even though the variable still points to it?

---

## The Timeline (Based on User Report)

**FIRST TRIAL:**
1. Page loads → initializeAudio() → startUserMedia() → recorder created ✓
2. Trial starts → allowUserInput() → startRecording() → icon RED ✓
3. ~20ms later → icon GRAY ✗

**SUBSEQUENT TRIALS:**
1. Trial starts → allowUserInput() → startRecording()
2. Icon stays GRAY from start ✗

---

## Key Question: What happens between trials?

Looking at logs:
```
card.js:2591 [SM] cardEnd called in state: FEEDBACK.SHOWING
card.js:3239 [SM] === prepareCard START (Trial #1) ===
card.js:3262 [SM] Setting displayReady=false to fade out
card.js:2933 [SM] cleanupTrialContent called
card.js:3322 === newQuestionHandler START ===
card.js:3649 stop user input
card.js:3604 allow user input
card.js:4086 [SR] RECORDING START
```

Between trials:
1. `cardEnd()` called
2. `prepareCard()` called
3. `cleanupTrialContent()` called
4. `newQuestionHandler()` called
5. `stopUserInput()` called
6. `allowUserInput()` called
7. `startRecording()` called

**Does any of these destroy the recorder?**

Let me check cleanupTrialContent():

---

## Next Steps

1. Search for ALL references to `recorder` variable
2. Check if `cleanupTrialContent()` or other between-trial functions affect recorder
3. Check if audioContext.close() is called between trials
4. Check if there's any reactive code that might be destroying/recreating components

## Immediate Action

Need to add logging to track when recorder becomes null:

```javascript
// Add after line 4010 where recorder is created:
console.log('[SR] recorder CREATED:', recorder);

// Add getter/setter to track changes:
let _recorder = null;
Object.defineProperty(window, 'recorder', {
  get() {
    return _recorder;
  },
  set(value) {
    console.log('[SR] recorder SET:', value, new Error().stack);
    _recorder = value;
  }
});
```
