# M3 Phase 1: Audit Report

**Created:** 2025-01-10
**Purpose:** Map state transitions → reactive dependencies → DOM updates
**Scope:** card.js (8,700 lines)

---

## Executive Summary

**Current State:**
- 2 Tracker.autorun instances (should have 15-25)
- 178+ jQuery DOM manipulations bypass reactivity
- 15+ module variables (NOT reactive)
- Mixed reactive/imperative pattern throughout

**Key Findings:**
1. **Module Variables Need Reactivity:** 15 variables updated imperatively, no autoruns track them
2. **Manual DOM Updates:** 178+ jQuery calls should be autoruns
3. **State Machine Transitions:** No autoruns tied to state changes
4. **TTS/SR Coordination:** Manual synchronization, should be reactive

---

## Part 1: Module Variables → ReactiveVars

**Location:** [card.js:241-4846](mofacts/client/views/experiment/card.js#L241-L4846)

### High Priority (Convert First)

#### 1. `waitingForTranscription` (line 254)
```javascript
let waitingForTranscription = false;
```
**Usage:** SR state tracking (Google API pending)
**Updated:** `processLINEAR16()`, `speechAPICallback()`
**Read:** Timeout logic (line 349), UI updates
**Impact:** HIGH - blocks timeouts, affects UI state
**Should Be:** `srState.set('waitingForTranscription', false)`

**Benefits if reactive:**
- Autorun can update red mic icon automatically
- Autorun can show "Processing..." text
- Timeout logic can react to changes

---

#### 2. `audioInputModeEnabled` (line 258)
```javascript
let audioInputModeEnabled = false;
```
**Usage:** Cache of SR enabled/disabled
**Updated:** Autorun #1 (line 688) - ALREADY has autorun!
**Read:** Multiple places check if SR should run
**Impact:** MEDIUM - already partially reactive
**Should Be:** Keep as-is (already has autorun writing to it)

**Current Pattern:**
```javascript
template.autorun(function() {
  // ... reactive reads ...
  Tracker.nonreactive(function() {
    audioInputModeEnabled = (userAudioToggled || false) && tdfAudioEnabled;
  });
});
```

**Could Improve:** Make it a ReactiveVar, update autorun to use `.set()`

---

#### 3. `currentTrialState` (line 1665)
```javascript
let currentTrialState = TRIAL_STATES.IDLE;
```
**Usage:** Trial FSM state (PRESENTING, STUDY, FEEDBACK, TRANSITION)
**Updated:** `setTrialState()` at lines 1685, 1712, etc.
**Read:** Everywhere - state guards, logging, UI updates
**Impact:** CRITICAL - core state machine
**Should Be:** `trialState.set('current', TRIAL_STATES.IDLE)`

**Benefits if reactive:**
- Autorun to stop recording when leaving PRESENTING
- Autorun to update phase indicator
- Autorun to enable/disable inputs
- Autorun to show/hide UI elements

**Current Manual Sync:**
```javascript
function setTrialState(newState) {
  currentTrialState = newState;
  console.log('[SM] State:', newState.phase, '→', newState.substate);
  // NO automatic UI updates!
}
```

**With Autorun:**
```javascript
template.autorun(() => {
  const state = trialState.get('current');
  // Automatically update UI based on state
  // Automatically stop/start recording
  // Automatically enable/disable inputs
});
```

---

#### 4. `trialStartTimestamp`, `trialEndTimeStamp` (lines 266-267)
```javascript
let trialStartTimestamp = 0;
let trialEndTimeStamp = 0;
```
**Usage:** Performance metrics
**Updated:** Trial start/end
**Read:** Performance calculations
**Impact:** LOW - metrics only
**Should Be:** Could stay as-is (not used for UI)

---

#### 5. `timeoutName`, `timeoutFunc`, `timeoutDelay` (lines 276-278)
```javascript
let timeoutName = null;
let timeoutFunc = null;
let timeoutDelay = null;
```
**Usage:** Current active timeout tracking
**Updated:** `beginMainCardTimeout()`
**Read:** `clearCardTimeout()`, timeout logic
**Impact:** MEDIUM - timeout management
**Should Be:** `timeoutState.set({name, func, delay})`

**Benefits if reactive:**
- Autorun to show countdown timer
- Autorun to update "Time remaining" UI
- Autorun to show/hide timeout indicators

---

#### 6. `userAnswer` (line 281)
```javascript
let userAnswer = null;
```
**Usage:** Current trial answer
**Updated:** `handleUserInput()`, SR callback
**Read:** Answer validation, submission
**Impact:** HIGH - core functionality
**Should Be:** `cardState.set('userAnswer', answer)` (or keep local?)

**Note:** This might be intentionally non-reactive (performance). Need to check if making reactive causes excessive re-runs.

---

### Medium Priority

#### 7. `player` (line 273)
```javascript
let player = null;
```
**Usage:** Plyr audio player instance
**Impact:** LOW - just a reference
**Should Be:** Can stay as-is

---

#### 8. `recorder`, `audioContext`, `userMediaStream` (lines 4840-4845)
```javascript
let recorder = null;
let audioContext = null;
let selectedInputDevice = null;
let userMediaStream = null;
let streamSource = null;
let speechEvents = null;
```
**Usage:** SR audio recording state
**Impact:** MEDIUM - SR subsystem
**Should Be:** `srState.set('recorder', recorder)` etc.

**Benefits if reactive:**
- Autorun to show/hide mic icon based on `recorder !== null`
- Autorun to update device selection UI
- Autorun to show "initializing..." state

---

### Low Priority (Can Stay Module-Level)

#### 9. `engine` (line 243)
```javascript
let engine = null;
```
**Usage:** Unit engine reference
**Impact:** LOW - just a reference
**Should Be:** Can stay as-is

#### 10. `cachedSyllables`, `cachedAnswerGrammar`, etc. (lines 255-263)
```javascript
let cachedSyllables = null;
let cachedSuccessColor = null;
let cachedAlertColor = null;
let cachedAnswerGrammar = null;
let cachedPhoneticIndex = null;
let lastCachedUnitNumber = null;
```
**Usage:** Performance caches
**Impact:** LOW - optimization only
**Should Be:** Can stay as-is (caches shouldn't trigger reactivity)

---

## Part 2: Current Tracker.autorun Instances

### Autorun #1: Audio Input Mode (lines 688-699)

```javascript
template.autorun(function() {
  const userAudioToggled = Meteor.user()?.audioSettings?.audioInputMode;
  const tdfFile = Session.get('currentTdfFile');

  Tracker.nonreactive(function() {
    const tdfAudioEnabled = tdfFile?.tdfs?.tutor?.setspec?.audioInputEnabled === 'true';
    audioInputModeEnabled = (userAudioToggled || false) && tdfAudioEnabled;
  });
});
```

**Tracks:**
- `Meteor.user().audioSettings.audioInputMode` (user SR toggle)
- `Session.get('currentTdfFile')` (TDF config)

**Updates:**
- `audioInputModeEnabled` module variable (imperative!)

**Good:**
- Uses `Tracker.nonreactive` to prevent cascade

**Could Improve:**
- Make `audioInputModeEnabled` a ReactiveVar
- Have dependent autoruns react to it

---

### Autorun #2: Feedback Container Visibility (lines 704-723)

```javascript
template.autorun(function() {
  const inFeedback = cardState.get('inFeedback');
  const feedbackPosition = cardState.get('feedbackPosition');

  if (inFeedback && feedbackPosition) {
    Tracker.afterFlush(function() {
      if (feedbackPosition === 'top') {
        $('#userInteractionContainer').removeAttr('hidden');
        $('#feedbackOverrideContainer').attr('hidden', '');
      } else if (feedbackPosition === 'middle') {
        // ... other positions
      }
    });
  }
});
```

**Tracks:**
- `cardState.get('inFeedback')`
- `cardState.get('feedbackPosition')`

**Updates:**
- DOM (jQuery) - shows/hides feedback container

**Good:**
- Uses `Tracker.afterFlush` to batch DOM updates
- This is the CORRECT pattern!
- Removal caused 40-90% performance regression

**Critical:** This is the model for all new autoruns!

---

## Part 3: State Transitions → Reactive Dependencies

### Trial State Machine Transitions

**Source:** `setTrialState()` at line 1685

#### Transition 1: IDLE → PRESENTING.LOADING
```javascript
setTrialState({
  phase: TRIAL_STATES.PRESENTING,
  substate: TRIAL_STATES.PRESENTING_LOADING
});
```

**Should Trigger:**
- Show loading indicator (if needed)
- Clear previous trial data
- Reset form inputs
- Hide feedback

**Currently:** Manual updates scattered across code

**Should Be Autorun:**
```javascript
template.autorun(() => {
  const state = trialState.get('current');

  Tracker.afterFlush(() => {
    if (state.phase === 'PRESENTING' && state.substate === 'LOADING') {
      // Clear UI
      $('#userAnswer').val('');
      $('#feedbackContainer').attr('hidden', '');
      // Show loading state
    }
  });
});
```

---

#### Transition 2: PRESENTING.LOADING → PRESENTING.FADING_IN
```javascript
setTrialState({
  phase: TRIAL_STATES.PRESENTING,
  substate: TRIAL_STATES.PRESENTING_FADING_IN
});
```

**Should Trigger:**
- Start CSS opacity transition
- Update `displayReady` state

**Currently:** Manual CSS manipulation

**Should Be Autorun:**
```javascript
template.autorun(() => {
  const state = trialState.get('current');
  const displayReady = cardState.get('displayReady');

  Tracker.afterFlush(() => {
    if (state.substate === 'FADING_IN' && displayReady) {
      $('#cardContainer').css('opacity', '1');
    }
  });
});
```

---

#### Transition 3: PRESENTING.AWAITING → FEEDBACK.SHOWING
```javascript
setTrialState({
  phase: TRIAL_STATES.FEEDBACK,
  substate: TRIAL_STATES.FEEDBACK_SHOWING
});
```

**Should Trigger:**
- **Stop recording!** (CRITICAL)
- Show feedback UI
- Disable input
- Start feedback timeout

**Currently:** Some manual updates in `showUserFeedback()`

**Should Be Autorun:**
```javascript
template.autorun(() => {
  const state = trialState.get('current');
  const recording = cardState.get('recording');

  // Auto-stop recording when entering feedback
  if (state.phase === 'FEEDBACK' && recording) {
    console.log('[SR] Auto-stopping recording - entered FEEDBACK');
    stopRecording();
  }
});
```

This is **defensive programming** - ensures recording ALWAYS stops, even if manual call is missed.

---

#### Transition 4: FEEDBACK.SHOWING → TRANSITION.START
```javascript
setTrialState({
  phase: TRIAL_STATES.TRANSITION,
  substate: TRIAL_STATES.TRANSITION_START
});
```

**Should Trigger:**
- Clear feedback
- Update progress
- Prepare next trial

**Currently:** Manual cleanup

---

## Part 4: Manual DOM Updates → Autoruns

### Category 1: Recording UI State (HIGH PRIORITY)

**Current Pattern:**
```javascript
// Scattered throughout card.js:
$('.fa-microphone').removeClass('sr-mic-recording').addClass('sr-mic-waiting');
$('.sr-status-text').text('Processing...');
```

**Locations:**
- Line ~4500: Start recording
- Line ~4600: Stop recording
- Line ~4700: Waiting for transcription
- Line ~4800: Error states

**Should Be Autorun:**
```javascript
template.autorun(() => {
  const recording = cardState.get('recording');
  const waiting = srState.get('waitingForTranscription');
  const locked = cardState.get('recordingLocked');

  Tracker.afterFlush(() => {
    if (locked) {
      $('.fa-microphone').removeClass('sr-mic-recording sr-mic-waiting')
                         .addClass('sr-mic-locked');
      $('.sr-status-text').text('Paused (TTS)');
    } else if (waiting) {
      $('.fa-microphone').removeClass('sr-mic-recording sr-mic-locked')
                         .addClass('sr-mic-waiting');
      $('.sr-status-text').text('Processing...');
    } else if (recording) {
      $('.fa-microphone').removeClass('sr-mic-waiting sr-mic-locked')
                         .addClass('sr-mic-recording');
      $('.sr-status-text').text('Listening');
    } else {
      $('.fa-microphone').removeClass('sr-mic-recording sr-mic-waiting sr-mic-locked');
      $('.sr-status-text').text('');
    }
  });
});
```

**Benefit:** Single source of truth, always in sync

---

### Category 2: Display Ready / Visibility (MEDIUM PRIORITY)

**Current Pattern:**
```javascript
// Lines ~2100-2200:
if (displayReady) {
  $('#cardContainer').css('opacity', '1');
  $('#displaySubContainer').removeAttr('hidden');
} else {
  $('#cardContainer').css('opacity', '0');
}
```

**Should Be Autorun:**
```javascript
template.autorun(() => {
  const displayReady = cardState.get('displayReady');

  Tracker.afterFlush(() => {
    if (displayReady) {
      $('#cardContainer').css('opacity', '1');
      $('#displaySubContainer').removeAttr('hidden');
    } else {
      $('#cardContainer').css('opacity', '0');
      $('#displaySubContainer').attr('hidden', '');
    }
  });
});
```

---

### Category 3: Input Enable/Disable (MEDIUM PRIORITY)

**Current Pattern:**
```javascript
// Scattered:
$('#userAnswer').prop('disabled', false);
$('#submitAnswer').prop('disabled', false);
```

**Should Be Autorun:**
```javascript
template.autorun(() => {
  const state = trialState.get('current');

  Tracker.afterFlush(() => {
    const enabled = (state.phase === 'PRESENTING' && state.substate === 'AWAITING');
    $('#userAnswer').prop('disabled', !enabled);
    $('#submitAnswer').prop('disabled', !enabled);
  });
});
```

---

### Category 4: Progress Indicators (LOW PRIORITY)

**Current Pattern:**
```javascript
// Manual updates:
$('.trial-counter').text(`${index + 1} / ${total}`);
$('.progress-bar').css('width', percent + '%');
```

**Should Be Autorun:**
```javascript
template.autorun(() => {
  const index = Session.get('currentCardIndex');
  const total = Session.get('totalCards');

  Tracker.afterFlush(() => {
    const percent = (index / total) * 100;
    $('.progress-bar').css('width', percent + '%');
    $('.trial-counter').text(`${index + 1} / ${total}`);
  });
});
```

---

## Part 5: Proposed ReactiveDict Structure

### Option A: Multiple Specialized Dicts

```javascript
// Existing:
const cardState = new ReactiveDict('cardState'); // Trial state

// Add:
const srState = new ReactiveDict('speechRecognition'); // SR state
const trialState = new ReactiveDict('trialStateMachine'); // FSM state
const timeoutState = new ReactiveDict('timeouts'); // Timeout management
```

**Pros:**
- Clear separation of concerns
- Easy to understand what each dict tracks
- Can have different lifecycle/cleanup

**Cons:**
- More dicts to manage
- Need to remember which dict has which key

---

### Option B: Expand Existing cardState

```javascript
const cardState = new ReactiveDict('cardState');

// Add keys:
cardState.set('sr.waitingForTranscription', false);
cardState.set('sr.audioInputModeEnabled', false);
cardState.set('trial.currentState', TRIAL_STATES.IDLE);
cardState.set('timeout.name', null);
```

**Pros:**
- Single dict, simpler
- All state in one place

**Cons:**
- Namespaced keys are verbose
- Less clear separation

---

**Recommendation:** **Option A** (Multiple Dicts)
- Clearer intent
- Better for complex state like SR
- Matches existing pattern (cardState already exists)

---

## Part 6: jQuery DOM Manipulation Audit

### Search Results

**Command:**
```bash
grep -n "\$(" card.js | wc -l
```

**Result:** 178+ jQuery calls

**Categories:**

1. **Show/Hide Elements:** ~40 calls
   - `.attr('hidden', '')` / `.removeAttr('hidden')`
   - `.show()` / `.hide()`

2. **Update Text Content:** ~30 calls
   - `.text()`
   - `.html()`

3. **CSS Changes:** ~25 calls
   - `.css('opacity', '1')`
   - `.addClass()` / `.removeClass()`

4. **Form Manipulation:** ~20 calls
   - `.val()`
   - `.prop('disabled', true)`

5. **Event Handlers:** ~15 calls
   - `.on('click', ...)`
   - `.off('click')`

6. **Others:** ~48 calls
   - Selectors for reading state
   - Complex manipulations

**Candidates for Autoruns:** Categories 1-4 (~115 calls)

---

## Part 7: Recommended Implementation Order

### Phase 2A: ReactiveVar Conversions (Day 1, 3 hours)

**Priority Order:**
1. `currentTrialState` → `trialState.set('current', ...)`
2. `waitingForTranscription` → `srState.set('waitingForTranscription', ...)`
3. `audioInputModeEnabled` → `srState.set('audioInputModeEnabled', ...)` (update existing autorun)
4. Timeout vars → `timeoutState.set({name, func, delay})`

**Deliverable:** 4 ReactiveVars working, no regressions

---

### Phase 3A: High-Priority Autoruns (Day 2-3, 8 hours)

**Priority Order:**

1. **SR Recording State Autorun** (2 hrs)
   - Stop recording when leaving AWAITING
   - Prevent recording in wrong state
   - **Critical for defensive programming**

2. **SR UI State Autorun** (1.5 hrs)
   - Update mic icon colors
   - Update status text
   - **High user visibility**

3. **Display Ready Autorun** (1.5 hrs)
   - Opacity transitions
   - Show/hide containers
   - **Core trial flow**

4. **TTS Lock Coordination Autorun** (2 hrs)
   - Automatic restart logic
   - State guards
   - **Complex but important**

5. **Input Enable/Disable Autorun** (1 hr)
   - Based on trial state
   - Simple but useful

**Deliverable:** 5 autoruns, SR/TTS coordination automatic

---

### Phase 4A: Testing (Day 4, 4 hours)

**Test Matrix:**
- Study trials (no SR, no feedback)
- Drill trials (SR + feedback)
- Test trials (input only)
- Edge cases (late voice input, TTS during feedback)

**Metrics:**
- Reactive computation count (before/after)
- jQuery call count (before/after)
- Performance timing (trial transitions)

---

## Part 8: Risks and Mitigations

### Risk 1: Too Many Autoruns

**Symptom:** Performance degrades, >100 active computations

**Mitigation:**
- Start with 5 autoruns, measure
- Add more only if performant
- Use `Tracker.nonreactive` for reads
- Combine related autoruns

---

### Risk 2: Autorun Cascades

**Symptom:** Changing one var triggers 10+ autoruns

**Mitigation:**
- Careful dependency tracking
- Use specific reactive sources
- Don't read `Session.get('currentExperimentState')` in every autorun
- Create computed intermediate values

---

### Risk 3: Race Conditions

**Symptom:** UI flickers, inconsistent state

**Mitigation:**
- Always use `Tracker.afterFlush` for DOM updates
- Test autorun order
- Use state machine discipline

---

## Part 9: Success Metrics

**Before M3:**
- 2 Tracker.autorun instances
- 178+ jQuery calls
- 15 non-reactive module variables
- Manual state synchronization

**After M3 Phase 1:**
- 7 Tracker.autorun instances (+5)
- ~150 jQuery calls (-28, 16% reduction)
- 11 non-reactive module variables (-4 converted)
- Automatic SR UI sync, display ready, recording state guard

**Target for Full M3:**
- 15-25 Tracker.autorun instances
- ~100 jQuery calls (-78, 44% reduction)
- 5-7 non-reactive module variables
- 20-30% fewer reactive computations overall

---

## Next Steps

1. ✅ **Review this audit** with team
2. ⏭️ **Begin Phase 2A:** Convert 4 module vars to ReactiveVars (3 hrs)
3. ⏭️ **Begin Phase 3A:** Implement 5 high-priority autoruns (8 hrs)
4. ⏭️ **Begin Phase 4A:** Test and measure (4 hrs)

**Total Phase 1 Time:** 5 hours (audit complete)
**Remaining M3 Time:** 15 hours (phases 2-4)

---

**Last Updated:** 2025-01-10
**Status:** Audit complete, ready for Phase 2
