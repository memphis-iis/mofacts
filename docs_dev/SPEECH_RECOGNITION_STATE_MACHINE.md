# Speech Recognition State Machine Documentation

## Overview

The Speech Recognition (SR) system in MoFACTS is a sub-state machine that runs within the main trial state machine. It handles voice input, transcription via Google Speech API, and answer validation.

**Status:** ⚠️ ISSUES IDENTIFIED - "waiting for transcription" timeout bug

---

## State Machine Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                    MAIN TRIAL STATE MACHINE                         │
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │              SPEECH RECOGNITION SUB-STATE MACHINE             │  │
│  │                                                                 │  │
│  │  [IDLE/DISABLED]                                               │  │
│  │        ↓                                                        │  │
│  │  [INITIALIZING] ← initializeAudio()                            │  │
│  │        ↓                                                        │  │
│  │  [MIC_READY] ← startUserMedia() completes                      │  │
│  │        ↓                                                        │  │
│  │  [WAITING_FOR_INPUT] ← startRecording()                        │  │
│  │        ↓ (user speaks)                                          │  │
│  │  [DETECTING_SPEECH] ← hark 'speaking' event                    │  │
│  │        ↓ (user stops speaking)                                  │  │
│  │  [PROCESSING_AUDIO] ← hark 'stopped_speaking' event           │  │
│  │        ↓                                                        │  │
│  │  [WAITING_FOR_TRANSCRIPTION] ← processLINEAR16()              │  │
│  │        ↓                                                        │  │
│  │  [TRANSCRIPTION_RECEIVED] ← speechAPICallback()               │  │
│  │        ↓                                                        │  │
│  │  [VALIDATING_ANSWER] ← check answerGrammar                     │  │
│  │        ↓                                                        │  │
│  │  ┌─────────┴────────┐                                          │  │
│  │  ↓                  ↓                                           │  │
│  │  [VALID]        [INVALID/SILENCE]                             │  │
│  │  ↓                  ↓                                           │  │
│  │  Submit Answer   Restart Recording                             │  │
│  │                                                                 │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

---

## States and Transitions

### 1. **IDLE/DISABLED**
**When:**
- SR icon OFF, or
- TDF doesn't have `audioInputEnabled="true"`, or
- No API key available

**Code:** [card.js:532-554](mofacts/client/views/experiment/card.js#L532-L554)

**Transitions:**
- → `INITIALIZING` when all three conditions met:
  1. User toggles SR icon ON
  2. TDF has `audioInputEnabled="true"`
  3. API key available (user or TDF)

---

### 2. **INITIALIZING**
**When:** `initializeAudio()` called in `initCard()`

**Code:** [card.js:1491-1529](mofacts/client/views/experiment/card.js#L1491-L1529)

**Actions:**
```javascript
navigator.mediaDevices.getUserMedia({audio: true, video: false})
  .then(startUserMedia)
  .catch(error => console.log('Error getting user media'))
```

**Transitions:**
- → `MIC_READY` when getUserMedia succeeds
- → `ERROR` when getUserMedia fails (mic denied, not available, etc.)

**User sees:** Browser microphone permission prompt (first time only)

---

### 3. **MIC_READY**
**When:** `startUserMedia()` completes successfully

**Code:** [card.js:3933-3996](mofacts/client/views/experiment/card.js#L3933-L3996)

**Actions:**
```javascript
// Create audio context and recorder
recorder = new Recorder(input, audioRecorderConfig);
recorder.setProcessCallback(processLINEAR16);

// Set up voice activity detection
speechEvents = hark(stream);
speechEvents.on('speaking', voiceStartHandler);
speechEvents.on('stopped_speaking', voiceStopHandler);
```

**Transitions:**
- → `WAITING_FOR_INPUT` when trial starts and input enabled

**Components initialized:**
- **Recorder:** Captures audio, buffers it, exports to processLINEAR16
- **Hark.js:** Voice activity detection (VAD), fires 'speaking'/'stopped_speaking' events
- **Audio Context:** WebAudio API for processing

---

### 4. **WAITING_FOR_INPUT**
**When:** `startRecording()` called, trial awaiting user response

**Code:** [card.js:4001-4009](mofacts/client/views/experiment/card.js#L4001-L4009)

**Actions:**
```javascript
Session.set('recording', true);
recorder.record();
console.log('RECORDING START');
```

**Visual Indicator:** Microphone icon active, recording in progress

**Transitions:**
- → `DETECTING_SPEECH` when hark detects voice activity
- → `TIMEOUT` if trial timeout expires before speech detected

**Conditions checked:**
- `recorder` exists
- `!Session.get('recordingLocked')` (not locked by audio playback)
- `Meteor.user().audioInputMode` (SR toggle still ON)

---

### 5. **DETECTING_SPEECH**
**When:** Hark.js fires 'speaking' event

**Code:** [card.js:3959-3976](mofacts/client/views/experiment/card.js#L3959-L3976)

**Actions:**
```javascript
console.log('VOICE START');
resetMainCardTimeout(); // Give more time for API response
```

**Visual Indicator:** Recording continues, trial timeout resets

**Transitions:**
- → `PROCESSING_AUDIO` when hark fires 'stopped_speaking' event

**Key behavior:**
- Resets trial timeout to give user more time
- Continues recording until silence detected

---

### 6. **PROCESSING_AUDIO**
**When:** Hark.js fires 'stopped_speaking' event (detected silence after speech)

**Code:** [card.js:3978-3995](mofacts/client/views/experiment/card.js#L3978-L3995)

**Actions:**
```javascript
console.log('VOICE STOP');
recorder.stop();
Session.set('recording', false);
recorder.exportToProcessCallback(); // → Calls processLINEAR16()
```

**Transitions:**
- → `WAITING_FOR_TRANSCRIPTION` immediately after exportToProcessCallback()

**Critical flow:**
1. Stop recording
2. Export audio buffer
3. Trigger `processLINEAR16()` with audio data

---

### 7. **WAITING_FOR_TRANSCRIPTION** ⚠️ **BUG LOCATION**
**When:** `processLINEAR16()` called with audio data

**Code:** [card.js:3725-3795](mofacts/client/views/experiment/card.js#L3725-L3795)

**Actions:**
```javascript
// Line 3760: Display waiting message
userAnswer.value = 'waiting for transcription';

// Line 3765: Generate Google Speech API request
const request = generateRequestJSON(sampleRate, speechRecognitionLanguage, phraseHints, data);

// Lines 3783-3790: Make API call
Meteor.call('makeGoogleSpeechAPICall', tdfId, apiKey, request, answerGrammar,
  (err, res) => speechAPICallback(err, res));
```

**Visual Indicator:** Text input shows "waiting for transcription"

**Transitions:**
- → `TRANSCRIPTION_RECEIVED` when speechAPICallback() fires
- → `TIMEOUT` if API call never returns (THIS IS THE BUG)

**Problem identified:**
- If `speechAPICallback()` never fires, stays stuck in "waiting for transcription"
- No timeout handler on the Meteor.call
- User sees "waiting for transcription" until trial times out

---

### 8. **TRANSCRIPTION_RECEIVED**
**When:** `speechAPICallback()` receives response from Google API

**Code:** [card.js:3797-3847](mofacts/client/views/experiment/card.js#L3797-3847)

**Actions:**
```javascript
// Parse response
if (err) {
  transcript = 'I did not get that. Please try again.';
  ignoredOrSilent = true;
} else if (response['results']) {
  transcript = response['results'][0]['alternatives'][0]['transcript'].toLowerCase();
} else {
  transcript = 'Silence detected';
  ignoredOrSilent = true;
}

// Update UI
userAnswer.value = transcript;
```

**Transitions:**
- → `VALIDATING_ANSWER` (always)

**Possible transcript values:**
- Actual transcription (e.g., "alpha", "beta")
- "I did not get that. Please try again." (API error)
- "Silence detected" (no speech detected)

---

### 9. **VALIDATING_ANSWER**
**When:** Transcript received, checking against answer grammar

**Code:** [card.js:3815-3822](mofacts/client/views/experiment/card.js#L3815-L3822)

**Actions:**
```javascript
if (ignoreOutOfGrammarResponses) {
  if (transcript == 'enter') {
    ignoredOrSilent = false; // Accept "enter" command
  } else if (answerGrammar.indexOf(transcript) == -1) {
    console.log('ANSWER OUT OF GRAMMAR, IGNORING');
    transcript = speechOutOfGrammarFeedback;
    ignoredOrSilent = true;
  }
}
```

**Transitions:**
- → `VALID` if transcript in answerGrammar OR ignoreOutOfGrammarResponses=false
- → `INVALID` if transcript not in answerGrammar AND ignoreOutOfGrammarResponses=true

**TDF Setting:** `speechIgnoreOutOfGrammarResponses="true"`

---

### 10. **VALID** (Terminal State)
**When:** Transcript validated successfully

**Code:** [card.js:3869-3895](mofacts/client/views/experiment/card.js#L3869-L3895)

**Actions:**
```javascript
// Submit answer
if (getButtonTrial()) {
  handleUserInput({answer: userAnswer}, 'voice');
} else {
  // Simulate Enter key press
  const enterEvent = new KeyboardEvent('keypress', {keyCode: 13, which: 13});
  userAnswer.dispatchEvent(enterEvent);
}

speechTranscriptionTimeoutsSeen = 0; // Reset counter
```

**Transitions:**
- Returns to main trial state machine
- → Next trial or feedback phase

---

### 11. **INVALID/SILENCE** (Loop Back)
**When:**
- Transcript not in answer grammar, or
- Silence detected, or
- API error

**Code:** [card.js:3862-3868](mofacts/client/views/experiment/card.js#L3862-L3868)

**Actions:**
```javascript
if (ignoredOrSilent) {
  startRecording(); // Loop back to WAITING_FOR_INPUT

  // Clear the error message after 5 seconds
  setTimeout(() => userAnswer.value = '', 5000);
}
```

**Transitions:**
- → `WAITING_FOR_INPUT` to try again

**User sees:**
- Error message displayed for 5 seconds
- Recording automatically restarts

**Safety limit:** After `autostopTranscriptionAttemptLimit` attempts (line 3849), forces incorrect answer to proceed

---

## Critical Variables

| Variable | Scope | Purpose |
|----------|-------|---------|
| `recorder` | Global | Recorder.js instance for audio capture |
| `speechEvents` | Global | Hark.js instance for voice activity detection |
| `audioContext` | Global | WebAudio API context |
| `Session.get('recording')` | Session | Boolean - is recording active? |
| `Session.get('recordingLocked')` | Session | Boolean - locked during audio playback |
| `Session.get('ignoreOutOfGrammarResponses')` | Session | Boolean - validate against answer set |
| `Session.get('speechAPIKey')` | Session | User-provided API key |
| `speechTranscriptionTimeoutsSeen` | Global | Counter for retry attempts |

---

## The "Waiting for Transcription" Bug

### Symptoms:
- User speaks
- UI shows "waiting for transcription"
- Never updates with actual transcription
- Eventually times out on trial timeout
- Recently was working better

### Root Cause Analysis:

**Location:** [card.js:3783-3790](mofacts/client/views/experiment/card.js#L3783-L3790)

```javascript
Meteor.call('makeGoogleSpeechAPICall', Session.get('currentTdfId'),
  Session.get('speechAPIKey'), request, answerGrammar,
  (err, res) => speechAPICallback(err, res));
```

**Problem:** NO TIMEOUT on this Meteor.call

If the server method:
- Never returns (network issue)
- Throws unhandled error
- Gets stuck processing
- API key invalid/quota exceeded

Then `speechAPICallback()` NEVER fires, and user is stuck at "waiting for transcription"

### Possible Causes:

1. **Server Method Failure** (most likely)
   - Google API quota exceeded
   - Invalid API key
   - Network timeout on server → Google
   - Server method crash (unhandled exception)

2. **Race Condition**
   - Multiple rapid speech attempts
   - Previous API call still pending
   - No deduplication logic

3. **Session/State Issues**
   - Session lost during API call
   - speechAPICallback can't access userAnswer element
   - Trial state changed before callback

### Evidence to Look For:

**Server logs:**
```bash
# Check for errors in makeGoogleSpeechAPICall
grep "makeGoogleSpeechAPICall" server.log
grep "Google Speech API" server.log
```

**Client console:**
```javascript
// Should see these in order:
'RECORDING START'
'VOICE START'
'VOICE STOP'
'waiting for transcription' // ← Stuck here
// MISSING: transcript logs from speechAPICallback
```

**Network tab:**
- Check DDP method call for makeGoogleSpeechAPICall
- Look for pending/failed requests
- Check if callback ever fires

---

## Recommended Fixes

### Fix 1: Add Timeout to Meteor.call ✅ **HIGH PRIORITY**

```javascript
// Add timeout parameter (30 seconds)
Meteor.call('makeGoogleSpeechAPICall',
  Session.get('currentTdfId'),
  Session.get('speechAPIKey'),
  request,
  answerGrammar,
  {timeout: 30000}, // ← ADD THIS
  (err, res) => {
    if (err && err.error === 'timeout') {
      console.error('Speech API timeout after 30s');
      speechAPICallback('timeout', {error: 'API call timed out'});
    } else {
      speechAPICallback(err, res);
    }
  }
);
```

### Fix 2: Add Client-Side Failsafe ✅ **MEDIUM PRIORITY**

```javascript
// After setting "waiting for transcription", start failsafe timer
userAnswer.value = 'waiting for transcription';

const transcriptionTimeout = setTimeout(() => {
  console.error('Transcription timeout - no response after 30s');
  speechAPICallback('client_timeout', {
    error: 'No response from server after 30 seconds'
  });
}, 30000);

// Clear timeout when callback fires
function speechAPICallback(err, data) {
  clearTimeout(transcriptionTimeout);
  // ... rest of callback
}
```

### Fix 3: Add Retry Logic ✅ **LOW PRIORITY**

```javascript
let apiCallAttempts = 0;
const MAX_API_ATTEMPTS = 2;

function makeAPICallWithRetry(request, answerGrammar) {
  apiCallAttempts++;

  Meteor.call('makeGoogleSpeechAPICall', ..., (err, res) => {
    if (err && apiCallAttempts < MAX_API_ATTEMPTS) {
      console.log(`API attempt ${apiCallAttempts} failed, retrying...`);
      setTimeout(() => makeAPICallWithRetry(request, answerGrammar), 2000);
    } else {
      apiCallAttempts = 0;
      speechAPICallback(err, res);
    }
  });
}
```

### Fix 4: Server-Side Investigation ✅ **HIGH PRIORITY**

Check `mofacts/server/methods.js` for `makeGoogleSpeechAPICall`:
- Add try/catch around Google API call
- Add timeout to HTTP request
- Log all errors properly
- Return error to client instead of silently failing

---

## TDF Settings Reference

| Setting | Type | Default | Purpose |
|---------|------|---------|---------|
| `audioInputEnabled` | `"true"/"false"` | `"false"` | Enable SR for this lesson |
| `speechAPIKey` | string | `""` | TDF-embedded API key (optional) |
| `speechIgnoreOutOfGrammarResponses` | `"true"/"false"` | `"false"` | Validate against answer set |
| `speechOutOfGrammarFeedback` | string | (hardcoded) | Error message (NOT IMPLEMENTED) |
| `speechRecognitionLanguage` | string | `"en-US"` | Language code for Google API |
| `audioInputSensitivity` | number | `20` | Hark.js sensitivity threshold |
| `autostopTranscriptionAttemptLimit` | number | (varies) | Max retry attempts before forcing answer |

---

## Next Steps for Debugging

1. **Check server logs** for `makeGoogleSpeechAPICall` errors
2. **Test with console open** - look for missing callback logs
3. **Check Network tab** - verify DDP method call completes
4. **Verify API key** - test with known-good key
5. **Add timeout** - implement Fix 1 above (highest priority)
6. **Test on different networks** - rule out network issues

---

## State Machine Integration with Main Trial

The SR state machine runs **within** the main trial state machine's `PRESENTING.AWAITING` phase:

```
MAIN TRIAL: PRESENTING.AWAITING
    ↓
    SR: WAITING_FOR_INPUT
    SR: DETECTING_SPEECH
    SR: PROCESSING_AUDIO
    SR: WAITING_FOR_TRANSCRIPTION ← BUG HERE
    SR: TRANSCRIPTION_RECEIVED
    SR: VALIDATING_ANSWER
    SR: VALID → handleUserInput()
    ↓
MAIN TRIAL: FEEDBACK.SHOWING (or TRANSITION if test trial)
```

---

**Document Created:** 2025-10-13
**Based on Code Analysis:** card.js (lines 1491-4020)
**Status:** ⚠️ Critical bug identified in WAITING_FOR_TRANSCRIPTION state
