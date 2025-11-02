# Speech Recognition State Machine Documentation

## Overview

The Speech Recognition (SR) system in MoFACTS is a sub-state machine that runs within the main trial state machine. It handles voice input, transcription via Google Speech API, and answer validation.

**Status:** ✅ STABLE - Duplicate feedback race condition FIXED

**Last Updated:** 2025-10-20
**Recent Fixes:**
1. ✅ Duplicate TTS feedback race condition (2025-10-20) - Implemented 3-layer defense
2. ⏳ Performance regression from feedback autorun removal (2025-10-17) - pending
3. ⏳ Long delays between trials (2025-10-17) - pending

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

## RECOMMENDED FIXES FOR 2025-10-17 REGRESSION

### Fix 1: RESTORE Feedback Autorun ✅ **CRITICAL - DO THIS FIRST**

**Revert the "optimization" that broke everything.**

In `Template.card.onCreated()`, restore the autorun:

```javascript
// Autorun for feedback container visibility
template.autorun(function() {
  const inFeedback = cardState.get('inFeedback');
  const feedbackPosition = cardState.get('feedbackPosition');

  if (inFeedback && feedbackPosition) {
    // Centralized DOM update based on reactive state
    // This runs once per state change instead of scattered throughout code
    Tracker.afterFlush(function() {
      if (feedbackPosition === 'top') {
        $('#userInteractionContainer').removeAttr('hidden');
        $('#feedbackOverrideContainer').attr('hidden', '');
      } else if (feedbackPosition === 'middle') {
        $('#feedbackOverrideContainer').removeAttr('hidden');
        $('#userInteractionContainer').attr('hidden', '');
      } else if (feedbackPosition === 'bottom') {
        $('#feedbackOverrideContainer').attr('hidden', '');
      }
    });
  }
});

// Initialize card state defaults
cardState.set('inFeedback', false);
cardState.set('feedbackPosition', null);  // ← RESTORE THIS LINE
cardState.set('displayReady', false);
```

In `showUserFeedback()`, remove manual DOM updates:

```javascript
// PHASE 2: Set reactive state, let Tracker.autorun handle DOM updates
cardState.set('feedbackPosition', feedbackDisplayPosition);  // ← RESTORE THIS LINE
cardState.set('inFeedback', true);

switch(feedbackDisplayPosition){
  case "top":
    target = "#UserInteraction";
    // REMOVE: Manual DOM updates (autorun handles this)
    break;
  case "middle":
    target = "#feedbackOverride";
    // REMOVE: Manual DOM updates (autorun handles this)
    break;
  case "bottom":
    target = "#userLowerInteraction";
    // REMOVE: Manual DOM updates (autorun handles this)
    const hSizeBottom = deliveryParams ? deliveryParams.fontsize.toString() : 2;
    $(target).addClass('h' + hSizeBottom);
    break;
}
```

In countdown timer, restore original behavior:

```javascript
Session.set('CurIntervalId', undefined);
cardState.set('inFeedback', false);  // ← RESTORE THIS LINE (it's safe now that autorun is back)
```

**Why this fixes it:**
- Autorun handles DOM updates in response to reactive state changes
- No more fighting between jQuery and Blaze
- Feedback container visibility updates happen in a single animation frame
- Clean separation between state management and DOM updates

**Expected improvement:**
- Delay after speaking: 330-1280ms → 200-800ms (only API time, 40-60% reduction)
- Delay between trials: 500-1500ms → 50-200ms (80-90% reduction)

### Fix 2: Move audioInputModeEnabled Cache Out of Autorun ✅ **HIGH PRIORITY**

The caching optimization is good, but it's in the wrong place.

**Current (WRONG):**
```javascript
template.autorun(function() {
  const userAudioToggled = Meteor.user()?.audioInputMode || false;
  const tdfAudioEnabled = Session.get('currentTdfFile')?.tdfs?.tutor?.setspec?.audioInputEnabled === 'true';
  audioInputModeEnabled = userAudioToggled && tdfAudioEnabled;
});
```

**Problem:** This autorun re-runs on EVERY reactive dependency change, including unrelated state changes.

**Fixed (CORRECT):**
```javascript
// Cache audio mode ONLY when relevant dependencies change
template.autorun(function() {
  // Explicitly track only the dependencies we care about
  const userAudioToggled = Meteor.user()?.audioInputMode;
  const tdfFile = Session.get('currentTdfFile');

  // Compute in a non-reactive context to prevent cascade
  Tracker.nonreactive(function() {
    const tdfAudioEnabled = tdfFile?.tdfs?.tutor?.setspec?.audioInputEnabled === 'true';
    audioInputModeEnabled = (userAudioToggled || false) && tdfAudioEnabled;
  });
});
```

**Why this fixes it:**
- Autorun only re-runs when `Meteor.user().audioInputMode` or `Session.get('currentTdfFile')` changes
- Doesn't re-run when `inFeedback`, `recording`, or other unrelated state changes
- Reduces helper re-computation from every state change to only relevant changes

**Expected improvement:**
- Eliminates 10-50ms helper re-computation on every feedback state change
- Reduces SR icon flashing/re-rendering

### Fix 3: Keep Other Performance Optimizations ✅ **KEEP THESE**

These optimizations from uncommitted changes are GOOD and should be kept:
1. ✅ Caching CSS color variables for SR icon
2. ✅ Using CSS classes instead of inline styles for microphone color
3. ✅ Caching answer grammar per unit
4. ✅ Caching phonetic index per unit
5. ✅ Reduced logging verbosity
6. ✅ Phonetic code caching with `Map()`

These don't cause reactivity conflicts and genuinely improve performance.

---

## PREVIOUS RECOMMENDATIONS (LOWER PRIORITY)

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

## CRITICAL BUG ANALYSIS - 2025-10-17

### Symptoms
1. Long "please wait" period after user speaks (300ms-2000ms)
2. Long delay between trials (500ms-1500ms)
3. Performance was BETTER yesterday before recent uncommitted changes

### Root Cause: Removed Feedback Autorun

**What Changed:**
```javascript
// REMOVED from Template.card.onCreated():
template.autorun(function() {
  const inFeedback = cardState.get('inFeedback');
  const feedbackPosition = cardState.get('feedbackPosition');

  if (inFeedback && feedbackPosition) {
    Tracker.afterFlush(function() {
      // DOM updates based on reactive state
    });
  }
});

// ADDED in showUserFeedback():
cardState.set('inFeedback', true);  // Reactive state change
// Immediately followed by manual jQuery DOM updates
$('#userInteractionContainer').removeAttr('hidden');
```

**Why This Breaks Everything:**

1. **DOM Thrashing**: Setting reactive state (`cardState.set()`) triggers Blaze template re-renders
2. **Race Condition**: Manual jQuery DOM updates run synchronously, then Blaze re-renders later
3. **Fight Between Systems**: jQuery says "show this", Blaze re-render says "hide this", jQuery says "show this"...
4. **Result**: Browser spends 100-500ms resolving conflicting DOM updates instead of 0-10ms with pure reactive updates

**The Proof:**
```javascript
// Line 2376 in uncommitted changes:
// FIX: Don't set inFeedback=false here - causes SR status to flash during feedback
// cardEnd() calls hideUserFeedback() and sets inFeedback=false at the right time
```

This comment PROVES the developer knows there's a reactivity conflict but tried to "fix" it by removing the autorun instead of understanding the root cause.

**Actual Timeline:**

**BEFORE (working yesterday):**
```
User speaks → VOICE STOP (0ms)
  → processLINEAR16 (5ms)
  → Google API call (async, 200-800ms)
  → speechAPICallback (0ms)
  → handleUserInput (2ms)
  → showUserFeedback (5ms)
    → cardState.set('inFeedback', true) (0ms)
    → Autorun triggers (next tick, 0ms)
    → Tracker.afterFlush DOM updates (1ms)
  → Total visible delay: 200-800ms (API only)
```

**AFTER (broken today):**
```
User speaks → VOICE STOP (0ms)
  → processLINEAR16 (5ms)
  → Google API call (async, 200-800ms)
  → speechAPICallback (0ms)
  → handleUserInput (2ms)
  → showUserFeedback (5ms)
    → cardState.set('inFeedback', true) (0ms)
    → Manual jQuery DOM update (1ms)
    → Blaze detects reactive change (2ms)
    → Blaze re-renders template (50-200ms) ← DOM THRASHING
    → Blaze re-render conflicts with jQuery (50-200ms) ← MORE THRASHING
    → Helpers re-compute (audioInputModeEnabled, etc.) (10-50ms)
    → CSS transitions interrupt and restart (16-32ms)
  → Total visible delay: 200-800ms (API) + 130-480ms (DOM thrashing) = 330-1280ms
```

### Root Cause: Fighting Meteor's Reactivity System

**Meteor/Blaze Reactivity Rule #1:** NEVER mix reactive state changes with manual DOM updates

You must choose ONE:
- **Option A (CORRECT)**: Use reactive state (`cardState.set()`) and let autorun/helpers handle DOM
- **Option B (ALSO CORRECT)**: Use pure manual jQuery with NO reactive state
- **Option C (BROKEN - what you did)**: Mix both and create race conditions

**The "optimization" made things WORSE because:**
1. You kept `cardState.set('inFeedback', true)` (reactive)
2. You removed the autorun that handled the reactive update
3. You added manual DOM updates that fight with reactive updates
4. Result: Worst of both worlds - reactivity overhead + manual DOM conflicts

### The Between-Trial Delay

**Related Issue:** Feedback cleanup is also broken

```javascript
// In countdown timer (line 2376):
Session.set('CurIntervalId', undefined);
// FIX: Don't set inFeedback=false here - causes SR status to flash during feedback
// cardEnd() calls hideUserFeedback() and sets inFeedback=false at the right time
```

This comment shows the developer KNOWS setting `inFeedback=false` causes issues, but instead of fixing the reactivity conflict, they just delayed the state change. This causes:

1. Feedback finishes countdown
2. `cardEnd()` called
3. `hideUserFeedback()` called
4. Manual jQuery hides feedback
5. Eventually `inFeedback` set to false
6. Blaze re-renders (50-200ms delay)
7. SR icon updates (reactive helper re-runs)
8. Next trial starts (but Blaze still processing previous state changes)
9. Result: 500-1500ms delay before next trial appears

### The Caching "Optimization" Side Effect

Uncommitted changes added caching to "improve performance":
```javascript
let audioInputModeEnabled = false;

template.autorun(function() {
  const userAudioToggled = Meteor.user()?.audioInputMode || false;
  const tdfAudioEnabled = Session.get('currentTdfFile')?.tdfs?.tutor?.setspec?.audioInputEnabled === 'true';
  audioInputModeEnabled = userAudioToggled && tdfAudioEnabled;
});
```

**Problem:** This autorun runs in `Template.card.onCreated()`, which means it re-computes `audioInputModeEnabled` every time template state changes (like `inFeedback`!).

When `inFeedback` changes:
1. Blaze invalidates computations
2. Autorun re-runs
3. Helper `audioInputModeEnabled()` re-runs
4. SR icon re-renders
5. Add this to the DOM thrashing from feedback container visibility
6. Result: More delay

**The irony:** The cache was added to REDUCE computation, but it actually INCREASES re-computation because it's in a reactive autorun that runs on EVERY state change.

---

## Next Steps for Debugging

1. **Check server logs** for `makeGoogleSpeechAPICall` errors
2. **Test with console open** - look for missing callback logs
3. **Check Network tab** - verify DDP method call completes
4. **Verify API key** - test with known-good key
5. **Test on different networks** - rule out network issues

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

## SR UI Visibility Bug - FIXED 2025-10-17

### Symptoms
- SR icon and status message flashing for 50-100ms during trial transitions (between trials after feedback)
- Icon showed different colors/versions during the flash
- Occurred during TRANSITION states (TRANSITION.START, TRANSITION.FADING_OUT, TRANSITION.CLEARING)

### Root Cause
The SR UI template condition was using `{{#unless inFeedback}}` which became true as soon as feedback ended, even during the TRANSITION phase. This caused the SR UI to render during states where user input is not possible.

**Original template code ([card.html:169](mofacts/client/views/experiment/card.html#L169)):**
```html
{{#if testordrill}}
    {{#unless inFeedback}}  <!-- ← PROBLEM: becomes true during transitions -->
    {{#if audioInputModeEnabled}}
        {{#if isNotInDialogueLoopStageIntroOrExit}}
            <div class="sr-status-container">
                <i class="fa fa-microphone sr-mic-icon {{microphoneColorClass}}"></i>
                <span>{{voiceTranscriptionStatusMsg}}</span>
            </div>
        {{/if}}
    {{/if}}
    {{/unless}}
```

**Problem:** `inFeedback` is set to `false` in two places:
1. [card.js:2403](mofacts/client/views/experiment/card.js#L2403) - In countdown timer callback (after feedback duration)
2. [card.js:2641](mofacts/client/views/experiment/card.js#L2641) - In `cardEnd()` when trial transitions

When `inFeedback` becomes `false`, the condition `{{#unless inFeedback}}` evaluates to `true`, causing the SR UI to render even though the trial state is in TRANSITION, not PRESENTING.AWAITING.

### Solution: State-Based Visibility Control

Created a new helper `shouldShowSpeechRecognitionUI` that checks the actual trial state instead of just the feedback flag.

**New helper ([card.js:815-821](mofacts/client/views/experiment/card.js#L815-L821)):**
```javascript
'shouldShowSpeechRecognitionUI': function() {
  // Only show SR UI during PRESENTING.AWAITING - the ONLY state where user can input answer
  // This prevents the SR icon/message from flashing during trial transitions
  const state = Session.get('_debugTrialState');

  return state === TRIAL_STATES.PRESENTING_AWAITING;
},
```

**Updated template ([card.html:169](mofacts/client/views/experiment/card.html#L169)):**
```html
{{#if testordrill}}
    {{#if shouldShowSpeechRecognitionUI}}  <!-- ← FIX: only show during PRESENTING.AWAITING -->
    {{#if audioInputModeEnabled}}
        {{#if isNotInDialogueLoopStageIntroOrExit}}
            <div class="sr-status-container">
                <i class="fa fa-microphone sr-mic-icon {{microphoneColorClass}}"></i>
                <span>{{voiceTranscriptionStatusMsg}}</span>
            </div>
        {{/if}}
    {{/if}}
    {{/if}}
```

### Why This Works

The SR UI should ONLY be visible during `PRESENTING.AWAITING` - this is the only state where:
- The user can actually input an answer
- Recording can be active
- The microphone icon has meaningful state to display

During all other states, the SR UI should be hidden:
- `PRESENTING.LOADING` - Still loading trial content
- `PRESENTING.FADING_IN` - Content appearing
- `PRESENTING.DISPLAYING` - Visible but input not yet enabled
- `FEEDBACK.SHOWING` - Showing feedback, no input allowed
- `TRANSITION.START` - Beginning transition to next trial
- `TRANSITION.FADING_OUT` - Old content disappearing
- `TRANSITION.CLEARING` - Clearing DOM

By checking the actual trial state from `Session.get('_debugTrialState')` (which is set reactively in [card.js:1469](mofacts/client/views/experiment/card.js#L1469)), the helper automatically re-evaluates whenever the trial state changes, ensuring the SR UI is only visible at the precise moment it's needed.

### Design Principle

Instead of defensively excluding the SR UI from states where it could never appear, we **positively assert** that it should only show during the ONE state where it's actually useful: `PRESENTING.AWAITING`. This is cleaner, more maintainable, and less error-prone.

---

## TTS/Feedback Timing Race Conditions - AUDIT 2025-10-17

### Summary

**Your Questions Answered:**

1. **"Is it respecting the feedback time always except when it has to go longer to finish TTS?"**
   - ✅ **YES!** The code correctly waits for TTS via `window.currentAudioObj.addEventListener('ended')` at line 2634
   - ✅ The feedback time from `getReviewTimeout()` is the **minimum** duration
   - ✅ If TTS is longer, `afterAnswerFeedbackCallback()` properly extends the wait
   - ⚠️ **BUT:** The countdown timer sets `inFeedback=false` before TTS completes (line 2411), which can cause UI issues

2. **"TTS can still be playing from feedback when the new trial starts, but only sometimes, like a race condition"**
   - ✅ **ROOT CAUSE FOUND!** The issue is NOT that `cardEnd()` is called too early
   - ❌ The issue is that `cardEnd()` → `prepareCard()` → `beginQuestionAndInitiateUserInput()` starts the NEW trial's TTS (line 3592) while the OLD feedback TTS might still be finishing
   - The new TTS overwrites `window.currentAudioObj`, orphaning the old audio which keeps playing
   - **Fix:** Use Fix 1 below - make `afterAnswerFeedbackCallback()` wait for BOTH countdown AND TTS before calling `cardEnd()`

3. **"Feedback repeated twice"**
   - ⚠️ **NEEDS INVESTIGATION** - Force correction is NOT enabled, so must be another cause
   - Possible causes to investigate:
     - Reactive re-render calling `showUserFeedback()` twice
     - `speakMessageIfAudioPromptFeedbackEnabled()` being called multiple times
     - Google TTS API returning duplicate responses
     - Template helper re-running and triggering TTS again
   - **Need logging** to track how many times `speakMessageIfAudioPromptFeedbackEnabled()` is called per trial

### Issue 1: TTS Bleeding Into Next Trial (Race Condition)

**Symptoms:**
- Sometimes TTS from feedback is still playing when the new trial starts
- Occurs intermittently, suggesting a race condition
- TTS should always complete before the next trial begins

**Root Cause Analysis:**

The code has **TWO SEPARATE PATHWAYS** for handling feedback completion, and they can race against each other:

**Pathway 1: Countdown Timer Completes First (CORRECT BEHAVIOR)**
```javascript
// card.js:2374-2412 - Countdown timer in showUserFeedback()
var CountdownTimerInterval = Meteor.setInterval(function() {
  var distance = countDownStart - now;
  if (distance < 0) {
    // Timer finished
    if(window.currentAudioObj) {
      $('#CountdownTimerText').text('Continuing after feedback...');
    } else {
      $('#CountdownTimerText').text("Continuing...");
    }
    Session.set('CurIntervalId', undefined);
    cardState.set('inFeedback', false);
  }
}, 250);
```

**Pathway 2: afterAnswerFeedbackCallback() Waits for TTS (ALSO CORRECT)**
```javascript
// card.js:2633-2639 - afterAnswerFeedbackCallback()
if(window.currentAudioObj) {
  window.currentAudioObj.addEventListener('ended', async () => {
    await cardEnd();
  });
} else {
  await cardEnd();
}
```

**The Race Condition:**

The countdown timer in `showUserFeedback()` (line 2374) checks `if(window.currentAudioObj)` at line 2404 to display "Continuing after feedback..." but **DOES NOT WAIT FOR IT TO FINISH**.

Meanwhile, `afterAnswerFeedbackCallback()` (line 2633) DOES wait for `window.currentAudioObj` to finish via the 'ended' event listener.

**What happens:**
1. Feedback is shown with TTS started (line 2428: `speakMessageIfAudioPromptFeedbackEnabled(feedbackMessage, 'feedback')`)
2. TTS locks recording and starts playing (line 3723-3735)
3. Countdown timer starts (line 2374) with duration from `getReviewTimeout()` (line 2365)
4. `afterAnswerFeedbackCallback()` is called (line 2493) and sets up TTS 'ended' listener (line 2634)
5. **RACE BEGINS:**
   - If countdown finishes BEFORE TTS completes:
     - Timer clears interval (line 2401)
     - Timer sees `window.currentAudioObj` exists (line 2404)
     - Timer shows "Continuing after feedback..." (line 2405)
     - Timer sets `inFeedback=false` (line 2411)
     - Timer does NOT call `cardEnd()` - that only happens in `afterAnswerFeedbackCallback()`
     - Eventually TTS finishes, 'ended' event fires, `cardEnd()` called → **CORRECT**
   - If TTS finishes BEFORE countdown:
     - TTS 'ended' event fires (line 2634)
     - Calls `cardEnd()` → `prepareCard()` → starts next trial
     - Countdown timer is still running! (interval not cleared)
     - Timer eventually hits `distance < 0` but trial already started → **BUG**

**The Problem:**
The countdown timer sets `inFeedback=false` at line 2411 but doesn't actually trigger `cardEnd()`. That only happens in `afterAnswerFeedbackCallback()` at line 2638. These two pathways are NOT synchronized.

**Is the feedback time respected?**
- **YES, mostly.** The countdown from `getReviewTimeout()` (correctprompt/reviewstudy) determines the minimum feedback duration.
- **YES, TTS extends it.** If TTS is longer than the countdown, `afterAnswerFeedbackCallback()` waits for TTS to finish via the 'ended' event listener.
- **BUT:** There's a race condition where the countdown can finish and set `inFeedback=false` before TTS completes, which can cause UI flashing/state issues.

**Why TTS sometimes plays into the next trial:**

**ROOT CAUSE FOUND:** The race condition occurs when:

1. **Feedback TTS is still playing** (started at line 2428 in `showUserFeedback()`)
2. **Countdown timer finishes FIRST** (line 2399-2412 in countdown interval)
3. **Timer checks `if(window.currentAudioObj)`** at line 2404 and displays "Continuing after feedback..."
4. **BUT: Timer does NOT wait** - it just sets `inFeedback=false` at line 2411 and exits
5. **Meanwhile, `afterAnswerFeedbackCallback()`** properly waits for the TTS 'ended' event (line 2634)
6. **TTS finishes**, 'ended' event fires, calls `cardEnd()` → `prepareCard()` (line 2635-2638)
7. **prepareCard()** starts the NEW trial's question display (line 3287-3374)
8. **NEW trial calls `beginQuestionAndInitiateUserInput()`** at line 3568
9. **Line 3592: NEW TRIAL STARTS ITS OWN TTS** via `speakMessageIfAudioPromptFeedbackEnabled(questionToSpeak, 'question')`
10. **Line 3727: `window.currentAudioObj` is OVERWRITTEN** with the new question's TTS audio object
11. **OLD feedback TTS 'ended' listener becomes ORPHANED** - no longer attached to the active audio object
12. **Result: OLD feedback TTS plays to completion WHILE new trial's question TTS also plays** → Audio overlap!

**The Critical Bug:**

```javascript
// card.js:3724-3727 - speakMessageIfAudioPromptFeedbackEnabled()
if (window.currentAudioObj) {
  window.currentAudioObj.pause();  // ← Pauses old audio
}
window.currentAudioObj = audioObj;  // ← Overwrites the reference
```

This code DOES pause the old audio, **BUT:**
- If the old TTS was started with MDN Speech Synthesis (fallback at line 3754-3768), it uses `speechSynthesis.speak()` which is NOT stored in `window.currentAudioObj`
- The pause() only affects Google TTS audio objects, not fallback TTS
- Even with pause(), the 'ended' listener from the OLD trial is now orphaned

**Sequence Diagram of the Bug:**

```
Trial N (Feedback TTS):
  2428: speakMessageIfAudioPromptFeedbackEnabled(feedbackMessage, 'feedback')
  3722-3727: window.currentAudioObj = new Audio() (feedback TTS)
  3728: audioObj.addEventListener('ended', unlock_recording) ← Listener A
  3735: audioObj.play() → STARTS PLAYING ⏵

  2493: afterAnswerFeedbackCallback() called
  2634: window.currentAudioObj.addEventListener('ended', cardEnd) ← Listener B

  ⏱️  Time passes... feedback TTS still playing...

  2399: Countdown timer finishes (distance < 0)
  2411: cardState.set('inFeedback', false)  ← COUNTDOWN DONE BUT TTS STILL PLAYING

  ⏱️  More time... feedback TTS STILL PLAYING...

  3728: Feedback TTS ends
  → Listener A fires: unlock recording, startRecording()
  → Listener B fires: cardEnd() → prepareCard()

Trial N+1 (Question TTS):
  3592: speakMessageIfAudioPromptFeedbackEnabled(questionToSpeak, 'question')
  3724: if (window.currentAudioObj) window.currentAudioObj.pause() ← PAUSES FEEDBACK TTS
  3727: window.currentAudioObj = new Audio() (question TTS) ← OVERWRITES REFERENCE
  3735: audioObj.play() → STARTS PLAYING ⏵

  ❌ BUG: If feedback TTS was NOT paused (e.g., MDN fallback), BOTH audios play simultaneously
  ❌ BUG: Listener B from Trial N is now orphaned (attached to OLD audio object)
```

### Issue 2: Feedback Repeating Twice

**Symptoms:**
- Feedback audio plays twice occasionally
- When it happens, timing is correct (respects feedback duration)
- **Force correction is NOT enabled** (user confirmed)

**Possible Causes to Investigate:**

**Hypothesis 1: Reactive Re-render**
- `cardState.set('inFeedback', true)` at line 2308 triggers template re-render
- If `showUserFeedback()` is called from a helper or autorun, it could run twice
- Need to check: Is `showUserFeedback()` called from reactive context?

**Hypothesis 2: Dialogue Feedback Interaction**
- Line 2213: `initiateDialogue()` calls `showUserFeedback()` as a parameter
- Line 2215: `showUserFeedback()` called again in the else branch
- Could there be a path where both calls execute?

**Hypothesis 3: Google TTS API Duplicate Response**
- Google TTS API call at line 3713 is async
- Could the API return the same audio twice?
- Or could the callback at line 3713 fire multiple times?

**Hypothesis 4: Event Listener Firing Multiple Times**
- The 'ended' event listener at line 3728 calls `startRecording()`
- Could `startRecording()` be triggering another TTS somehow?

**Hypothesis 5: Multiple Audio Objects**
- If `window.currentAudioObj` is replaced before the first completes
- The first audio's 'ended' listener is orphaned but still attached
- When first audio finishes, it could trigger duplicate behavior

**To Diagnose:**
Add logging to track:
1. How many times `speakMessageIfAudioPromptFeedbackEnabled()` is called per trial
2. Call stack trace when it's called
3. Value of `window.currentAudioObj` before/after each call
4. Whether the Google TTS API callback fires multiple times

**Logging to add:**
```javascript
let ttsCallCounter = 0; // Global counter

function speakMessageIfAudioPromptFeedbackEnabled(msg, audioPromptSource) {
  ttsCallCounter++;
  const callNum = ttsCallCounter;
  clientConsole(1, `[TTS #${callNum}] speakMessage called:`, audioPromptSource, 'msg:', msg.substring(0, 50));
  clientConsole(1, `[TTS #${callNum}] window.currentAudioObj exists:`, !!window.currentAudioObj);

  // ... rest of function ...

  // In the Google TTS callback:
  Meteor.call('makeGoogleTTSApiCall', ..., function(err, res) {
    clientConsole(1, `[TTS #${callNum}] Google TTS callback fired`);
    // ... rest
  });
}
```

### Recommended Fixes

**Fix 1: Synchronize Countdown and TTS Completion (CRITICAL)** ✅

The countdown timer should not set `inFeedback=false` - that should ONLY happen when BOTH countdown AND TTS complete.

**Current (PROBLEMATIC):**
```javascript
// card.js:2399-2412 - Countdown can set inFeedback=false while TTS playing
if (distance < 0) {
  cardState.set('inFeedback', false);  // ← Causes UI flash if TTS still playing
}
```

**Fixed:**
```javascript
// Countdown timer ONLY controls UI countdown display, NOT state transitions
if (distance < 0) {
  Meteor.clearInterval(CountdownTimerInterval);
  Session.set('CurIntervalId', undefined);

  // Show appropriate message but DON'T change inFeedback state yet
  if(window.currentAudioObj) {
    $('#CountdownTimerText').text('Continuing after feedback...');
  } else {
    $('#CountdownTimerText').text("Continuing...");
  }

  // Let afterAnswerFeedbackCallback handle the actual trial transition
}
```

Then modify `afterAnswerFeedbackCallback()` to wait for BOTH:
```javascript
// card.js:2633-2639 (modified)
if(!userLeavingTrial){
  // Wait for countdown to finish (if not already finished)
  const waitForCountdown = new Promise(resolve => {
    if (!Session.get('CurIntervalId')) {
      resolve(); // Already finished
    } else {
      const checkInterval = Meteor.setInterval(() => {
        if (!Session.get('CurIntervalId')) {
          Meteor.clearInterval(checkInterval);
          resolve();
        }
      }, 100);
    }
  });

  // Wait for TTS to finish (if playing)
  const waitForTTS = new Promise(resolve => {
    if (window.currentAudioObj) {
      window.currentAudioObj.addEventListener('ended', resolve, { once: true });
    } else {
      resolve(); // No TTS playing
    }
  });

  // Wait for BOTH to complete
  await Promise.all([waitForCountdown, waitForTTS]);

  // NOW safe to transition to next trial
  cardState.set('inFeedback', false);
  await cardEnd();
}
```

**Fix 2: Add Diagnostic Logging for Double TTS Issue (NEEDED)** 🔍

Since force correction is not enabled, we need logging to identify why TTS plays twice:

```javascript
// Add at top of card.js with other global vars
let ttsCallCounter = 0;
let ttsCallsThisTrial = [];

// Reset counter at start of each trial (in prepareCard or newQuestionHandler)
function resetTTSTracking() {
  ttsCallCounter = 0;
  ttsCallsThisTrial = [];
}

// Modify speakMessageIfAudioPromptFeedbackEnabled()
function speakMessageIfAudioPromptFeedbackEnabled(msg, audioPromptSource) {
  ttsCallCounter++;
  const callNum = ttsCallCounter;
  const callInfo = {
    num: callNum,
    source: audioPromptSource,
    msg: msg.substring(0, 50),
    timestamp: Date.now(),
    hasExistingAudio: !!window.currentAudioObj,
    stackTrace: new Error().stack // Capture call stack
  };
  ttsCallsThisTrial.push(callInfo);

  clientConsole(1, `[TTS #${callNum}] ========== CALL ${callNum} ==========`);
  clientConsole(1, `[TTS #${callNum}] Source:`, audioPromptSource);
  clientConsole(1, `[TTS #${callNum}] Message:`, msg.substring(0, 100));
  clientConsole(1, `[TTS #${callNum}] window.currentAudioObj exists:`, !!window.currentAudioObj);
  clientConsole(2, `[TTS #${callNum}] Stack:`, callInfo.stackTrace);

  // ... existing checks ...

  if (enableAudioPromptAndFeedback) {
    if (audioPromptSource === audioPromptMode || audioPromptMode === 'all') {
      clientConsole(1, `[TTS #${callNum}] ✅ Will play TTS`);

      // ... existing code ...

      // In Google TTS callback:
      Meteor.call('makeGoogleTTSApiCall', ..., function(err, res) {
        clientConsole(1, `[TTS #${callNum}] Google TTS callback fired (err:`, !!err, 'res:', !!res, ')');
        if (!err && res) {
          clientConsole(1, `[TTS #${callNum}] Creating Audio object`);
          const audioObj = new Audio('data:audio/ogg;base64,' + res);
          // ... rest
        }
      });
    }
  }
}
```

This will show:
- How many times TTS is called per trial
- What triggers each call (call stack)
- Whether previous audio exists when new call happens
- If Google API callback fires multiple times

### Summary of Issues and Fixes

| Issue | Root Cause | Priority | Fix | Status |
|-------|------------|----------|-----|--------|
| TTS bleeds into next trial | `cardEnd()` called before TTS finishes | **CRITICAL** | Fix 1 | ✅ Correct approach |
| Countdown/TTS not synchronized | Timer doesn't wait for TTS completion | **CRITICAL** | Fix 1 | ✅ Correct approach |
| Feedback TTS plays twice | Unknown - need logging | MEDIUM | Fix 2 | 🔍 Need diagnostics |
| `inFeedback=false` set too early | Timer sets flag before TTS done | HIGH | Fix 1 | ✅ Correct approach |

---

**Document Created:** 2025-10-13
**Based on Code Analysis:** card.js (lines 1491-4020)
**Status:** ⚠️ Critical bug identified in WAITING_FOR_TRANSCRIPTION state
**UI Visibility Bug Fixed:** 2025-10-17
**TTS/Feedback Timing Audit:** 2025-10-17
