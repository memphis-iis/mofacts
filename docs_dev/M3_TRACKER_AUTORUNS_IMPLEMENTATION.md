# M3: Tracker.autoruns Implementation Guide

**Created:** 2025-01-10
**Status:** Planning Phase
**Effort:** 20 hours
**Priority:** Phase 2 (Next)

---

## Executive Summary

**Current State:** Only 2 Tracker.autorun instances in 8,700 lines of card.js
**Target State:** 15-25 autoruns for proper reactive state synchronization
**Why:** Eliminate manual DOM updates, fix SR/SM synchronization bugs, reduce race conditions

**Key Problem:** Mixed reactive/imperative pattern causes bugs:
```javascript
// Anti-pattern (current):
cardState.set('inFeedback', true);  // Reactive
$('#feedback').show();               // Imperative - BYPASSES reactivity!

// Correct pattern (goal):
cardState.set('inFeedback', true);   // Reactive
// Autorun automatically updates DOM
```

---

## State Machines Overview

### 1. Trial Flow State Machine (Primary)

**Three distinct flows based on trial type:**

```
Study Flow:  PRESENTING → STUDY → TRANSITION
Drill Flow:  PRESENTING → FEEDBACK → TRANSITION
Test Flow:   PRESENTING → TRANSITION
```

**Four phases with substates:**

#### PRESENTING Phase (all trials)
- `PRESENTING.LOADING` - Card selection, asset loading (50-500ms)
- `PRESENTING.FADING_IN` - Content appearing (100ms CSS transition)
- `PRESENTING.DISPLAYING` - Visible, input disabled (brief ~10ms)
- `PRESENTING.AWAITING` - Input enabled, waiting for response (drill/test only, 2-30s)

#### STUDY Phase (study trials 's', 'f' only)
- `STUDY.SHOWING` - Display stimulus+answer for `purestudy` timeout (~3s)

#### FEEDBACK Phase (drill trials 'd' only)
- `FEEDBACK.SHOWING` - Display correct/incorrect feedback (2-5s)

#### TRANSITION Phase (all trials)
- `TRANSITION.START` - Brief cleanup (10ms)
- `TRANSITION.FADING_OUT` - Content disappearing (100ms CSS)
- `TRANSITION.CLEARING` - Clear DOM while invisible (50ms)

**Key Insights:**
- Study and Feedback are SEPARATE phases, not variations
- Study trials skip `showUserFeedback()` entirely
- Test trials use same template as drill but skip FEEDBACK

### 2. Speech Recognition (SR) State Machine

**Location:** `card.js:340-370`

**States:**
- `SR.IDLE` - No recording active
- `SR.RECORDING` - Microphone active, listening
- `SR.VOICE_DETECTED` - Voice activity detected (Hark.js)
- `SR.PROCESSING` - Sent to Google API, `waitingForTranscription=true`
- `SR.TRANSCRIBED` - Result received
- `SR.LOCKED` - Recording paused (during TTS playback)

**Critical Synchronization Points:**
1. **Timeout Blocking:** When `waitingForTranscription=true`, main timeout is delayed 3s
2. **TTS Locking:** `recordingLocked` prevents recording during TTS playback
3. **State Guards:** SR should only process input during `PRESENTING.AWAITING`

**Known Bugs (to be fixed by M3):**
- TTS 'ended' listener restarts recording without state check
- Late transcriptions processed in wrong state (`FEEDBACK.SHOWING`)
- Causes duplicate feedback bug

### 3. Stimulus Modality (SM) State Machine

Manages different stimulus types:
- Text-based trials
- Image-based trials
- Audio-based trials
- Video sessions (`isVideoSession`)
- Multiple choice vs text input

---

## Current Reactive Patterns

### Existing Autoruns (Only 2!)

**Location:** `card.js:676-729`

#### Autorun 1: Audio Input Mode Detection (lines 688-699)

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

**Analysis:**
- ✅ **Good:** Uses `Tracker.nonreactive` to prevent cascade invalidation
- ✅ **Good:** Caches expensive TDF lookup
- ⚠️ **Issue:** Updates module variable (not reactive output)

#### Autorun 2: Feedback Container Visibility (lines 704-723)

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

**Analysis:**
- ✅ **CRITICAL:** Removal caused 40-90% performance regression!
- ✅ **Good:** Uses `Tracker.afterFlush` to batch DOM updates
- ✅ **Good:** Centralizes feedback visibility logic
- ⚠️ **Issue:** Still uses jQuery instead of reactive templates

### Current Reactive Dependencies

**From M1 Migration (Session → ReactiveDict):**
- 258 calls migrated to `cardState` (43%)
- 342 calls remain global `Session` (57%)
- 54 card-scoped keys
- 56 global/shared keys (must stay Session - cross-file communication)

**Problem Areas:**
- **178+ jQuery DOM manipulations** bypass reactivity
- **80+ template helpers** re-run on ANY Session change
- **Manual synchronization** between state and UI
- **Race conditions** between state changes

---

## The Anti-Pattern: Mixed Reactive/Imperative Code

### Current Pattern (BAD)

```javascript
function showUserFeedback(response) {
  // Setting reactive state...
  cardState.set('inFeedback', true);
  cardState.set('feedbackMessage', response.feedbackText);

  // ...then ALSO manually updating DOM (bypasses reactivity!)
  $('#UserInteraction').html(response.feedbackText);
  $('#userInteractionContainer').removeAttr('hidden');

  // What if template re-renders? Manual changes lost!
  // What if autorun fires first? Race condition!
}
```

**Problems:**
1. Reactivity system doesn't know about manual DOM changes
2. Template re-renders can override manual changes
3. Race conditions when both happen
4. Hard to track what changed when
5. No single source of truth

### Correct Pattern (GOAL)

```javascript
function showUserFeedback(response) {
  // ONLY set reactive state
  cardState.set('inFeedback', true);
  cardState.set('feedbackMessage', response.feedbackText);
  cardState.set('feedbackPosition', response.position);

  // Let autorun handle ALL DOM updates
  // (defined elsewhere in template.onCreated)
}

// In template.onCreated:
template.autorun(() => {
  const inFeedback = cardState.get('inFeedback');
  const message = cardState.get('feedbackMessage');
  const position = cardState.get('feedbackPosition');

  Tracker.afterFlush(() => {
    if (inFeedback && message) {
      $('#UserInteraction').html(message);
      $('#userInteractionContainer').removeAttr('hidden');
      // Position-specific updates...
    } else {
      $('#userInteractionContainer').attr('hidden', '');
    }
  });
});
```

**Benefits:**
1. Single source of truth (reactive state)
2. Autorun guarantees synchronization
3. No race conditions
4. Easy to debug (check reactive state)
5. Template re-renders won't conflict

---

## M3 Implementation Plan

### Phase 1: Audit and Document (5 hours)

**Tasks:**

1. **Map State Transitions to Reactive Dependencies**
   - For each state machine transition, identify:
     - What reactive variables change
     - What DOM updates happen
     - What manual synchronization occurs
   - Create state → deps → DOM flowchart

2. **Identify Manual DOM Updates**
   - Search for all jQuery DOM manipulations
   - Categorize: Should be autorun? Should be template? Unavoidable?
   - Priority: Updates tied to state transitions

3. **List Module Variables → ReactiveVars**
   - `waitingForTranscription` (SR state)
   - `recordingLocked` (TTS lock)
   - `audioInputModeEnabled` (SR enabled)
   - Any others found during audit

4. **Create Dependency Graph**
   ```
   State Change → Reactive Vars → Autoruns → DOM Updates
   ```

**Deliverable:** `M3_AUDIT_REPORT.md` with:
- Current autoruns (2)
- Proposed autoruns (15-25)
- ReactiveVar conversions (5-10)
- Expected benefits per autorun
- Risk assessment

### Phase 2: Convert Module Variables to ReactiveVars (3 hours)

**Target Variables:**

```javascript
// BEFORE (NOT reactive):
let waitingForTranscription = false;
let recordingLocked = false;
let audioInputModeEnabled = false;

// AFTER (reactive):
const srState = new ReactiveDict('speechRecognition');
srState.set('waitingForTranscription', false);
srState.set('recordingLocked', false);
srState.set('audioInputModeEnabled', false);
```

**Migration Steps:**

1. Create `srState = new ReactiveDict('speechRecognition')` in `onCreated`
2. Replace all `waitingForTranscription = value` with `srState.set('waitingForTranscription', value)`
3. Replace all `waitingForTranscription` reads with `srState.get('waitingForTranscription')`
4. Test SR functionality still works
5. Repeat for other variables

**Benefits:**
- Variables become trackable by Tracker.autorun
- Can create reactive computations based on these
- Automatic UI updates possible

### Phase 3: Implement State Machine Autoruns (8 hours)

**Priority Order:**

#### 1. SR Recording State Guard (2 hrs) - CRITICAL BUG FIX

**Problem:** Late voice input processed during feedback, causes duplicate feedback

**Solution:**
```javascript
template.autorun(() => {
  const trialState = Session.get('currentExperimentState');
  const recording = cardState.get('recording');

  // Auto-stop recording when leaving AWAITING state
  if (recording && trialState.phase !== 'PRESENTING') {
    console.log('[SR] Auto-stopping recording - no longer in PRESENTING phase');
    stopRecording();
  } else if (recording && trialState.substate !== 'AWAITING') {
    console.log('[SR] Auto-stopping recording - no longer AWAITING input');
    stopRecording();
  }
});
```

**Fixes:** Duplicate feedback bug, recording in wrong state

#### 2. TTS Lock Management (2 hrs) - CRITICAL BUG FIX

**Problem:** TTS 'ended' listener restarts recording without checking state

**Solution:**
```javascript
template.autorun(() => {
  const locked = srState.get('recordingLocked');
  const ttsRequested = cardState.get('ttsRequested');
  const trialState = Session.get('currentExperimentState');

  // Only allow recording restart if:
  // 1. Not locked
  // 2. TTS finished
  // 3. In AWAITING state
  if (!locked && !ttsRequested &&
      trialState.phase === 'PRESENTING' &&
      trialState.substate === 'AWAITING') {

    // Safe to restart recording
    if (!cardState.get('recording')) {
      console.log('[SR] Auto-restarting recording - conditions met');
      startRecording();
    }
  }
});
```

**Fixes:** TTS restart bug, prevents recording in wrong state

#### 3. Display Ready Transitions (1.5 hrs)

**Solution:**
```javascript
template.autorun(() => {
  const displayReady = cardState.get('displayReady');
  const currentDisplay = cardState.get('currentDisplay');

  Tracker.afterFlush(() => {
    if (displayReady) {
      // Show content with fade-in
      $('#cardContainer').css('opacity', '1');
      $('#displaySubContainer').removeAttr('hidden');
      console.log('[SM] Content displayed:', currentDisplay);
    } else {
      // Hide content with fade-out
      $('#cardContainer').css('opacity', '0');
      console.log('[SM] Content hidden');
    }
  });
});
```

**Benefits:** Centralized transition logic, automatic fade effects

#### 4. SR UI State Synchronization (1.5 hrs)

**Solution:**
```javascript
template.autorun(() => {
  const recording = cardState.get('recording');
  const waiting = srState.get('waitingForTranscription');
  const locked = srState.get('recordingLocked');

  Tracker.afterFlush(() => {
    // Update microphone icon
    if (locked) {
      $('.fa-microphone').removeClass('sr-mic-recording sr-mic-waiting')
                         .addClass('sr-mic-locked');
    } else if (waiting) {
      $('.fa-microphone').removeClass('sr-mic-recording sr-mic-locked')
                         .addClass('sr-mic-waiting');  // Red
    } else if (recording) {
      $('.fa-microphone').removeClass('sr-mic-waiting sr-mic-locked')
                         .addClass('sr-mic-recording');  // Green
    } else {
      $('.fa-microphone').removeClass('sr-mic-recording sr-mic-waiting sr-mic-locked');
    }

    // Update status text
    const statusText = waiting ? 'Processing...' :
                       locked ? 'Paused (TTS)' :
                       recording ? 'Listening' : '';
    $('.sr-status-text').text(statusText);
  });
});
```

**Benefits:** Automatic UI updates, always in sync with state

#### 5. Trial Progress Updates (1 hr)

**Solution:**
```javascript
template.autorun(() => {
  const state = Session.get('currentExperimentState');
  const currentIndex = Session.get('currentCardIndex');
  const totalCards = Session.get('totalCards');

  Tracker.afterFlush(() => {
    // Update progress bar
    const percent = (currentIndex / totalCards) * 100;
    $('.progress-bar').css('width', percent + '%');

    // Update trial counter
    $('.trial-counter').text(`${currentIndex + 1} / ${totalCards}`);

    // Update phase indicator
    $('.phase-indicator').text(state.phase);
  });
});
```

**Benefits:** Automatic progress tracking

#### Additional Autoruns (As Needed)

6. **Button State** - Enable/disable based on trial state
7. **Input Visibility** - Show/hide input fields
8. **Timeout Display** - Show remaining time
9. **Dialogue History** - Update conversation display
10. **Video Controls** - Start/stop video based on state

### Phase 4: Test and Verify (4 hours)

**Test Scenarios:**

1. **Study Trial Flow**
   - No SR, no feedback
   - Just PRESENTING → STUDY → TRANSITION
   - Verify: No recording started, progress updates

2. **Drill Trial - Correct Answer**
   - PRESENTING.AWAITING → voice input → FEEDBACK.SHOWING
   - Verify: Recording stops at feedback, green checkmark

3. **Drill Trial - Timeout**
   - PRESENTING.AWAITING → timeout → FEEDBACK.SHOWING
   - Verify: Recording stops at timeout, feedback shown

4. **Drill Trial - Late Voice Input (THE BUG)**
   - PRESENTING.AWAITING → timeout → FEEDBACK.SHOWING → late voice
   - Expected: Late voice ignored, no duplicate feedback
   - Verify: Recording stopped, state guard blocks processing

5. **Test Trial**
   - PRESENTING.AWAITING → input → TRANSITION (no feedback)
   - Verify: No feedback shown, moves to next trial

6. **Multiple Rapid Trials**
   - 5 trials in quick succession
   - Verify: No state leakage, clean transitions

7. **TTS During Question**
   - PRESENTING.AWAITING → TTS starts → TTS ends
   - Expected: Recording locked during TTS, restarted after
   - Verify: Only restarts if still in AWAITING

8. **TTS During Feedback**
   - FEEDBACK.SHOWING → TTS starts → TTS ends
   - Expected: Recording NOT restarted (wrong state)
   - Verify: State guard prevents restart

**Metrics to Track:**

```javascript
// Add to onRendered:
Tracker.autorun(() => {
  console.log('[M3] Active computations:', Tracker._computations.length);
});
```

**Expected:**
- Before M3: ~50-100 computations
- After M3: ~30-50 computations (20-30% reduction)
- No duplicate feedback bugs
- No recording in wrong state
- UI always in sync

**Performance Baseline:**
- Time first trial load
- Time trial transitions
- Frame rate during animations
- CPU usage during recording

---

## Expected Outcomes

### Performance Improvements

- **20-30% reduction** in reactive computations
- **Fewer manual DOM updates** (measured by jQuery call count)
- **Better frame rates** during state transitions
- **Lower CPU usage** (fewer cascade invalidations)

### Reliability Improvements

- ✅ **Fixes duplicate feedback bug** (SR state guard)
- ✅ **Fixes TTS restart bug** (lock management autorun)
- ✅ **Prevents recording in wrong state** (trial state guard)
- ✅ **UI always in sync** (automatic updates)
- ✅ **No race conditions** (single source of truth)

### Maintainability Improvements

- **Clear state → reaction mapping**
- **Less manual coordination**
- **Easier to debug** (check reactive state)
- **Better separation of concerns**
- **Self-documenting** (autoruns show intent)

---

## Risks and Mitigations

### Risk 1: Too Many Autoruns (Performance)

**Symptom:** More than 100 active computations, sluggish UI

**Mitigation:**
- Use `Tracker.nonreactive()` for non-reactive reads
- Combine related autoruns (e.g., SR UI state)
- Use `Tracker.afterFlush()` to batch DOM updates
- Monitor `Tracker._computations.length`

### Risk 2: Autorun Cascades

**Symptom:** Changing one reactive var triggers 10+ autoruns

**Mitigation:**
- Careful dependency tracking
- Don't read `Session.get('currentExperimentState')` in every autorun
- Create computed variables instead
- Use specific reactive sources

### Risk 3: Breaking Existing Behavior

**Symptom:** Tests fail, feedback missing, recording broken

**Mitigation:**
- Incremental implementation (one autorun at a time)
- Feature flag to disable M3 autoruns
- Keep manual updates as fallback initially
- Comprehensive testing after each autorun
- Easy rollback (git revert)

### Risk 4: Timing Issues

**Symptom:** Autorun fires before/after expected

**Mitigation:**
- Use `Tracker.afterFlush()` for DOM updates
- Check autorun order with logging
- Ensure state changes happen in correct sequence
- Test rapid state transitions

---

## Prerequisites

**Must Complete Before M3:**

1. ✅ **M1: Session → ReactiveDict** (DONE)
   - Provides `cardState` reactive dictionary
   - 54 card-scoped keys available

2. ⚠️ **SR/SM Synchronization Fix** (IN PROGRESS)
   - 3-layer defense from `SR_SM_SYNCHRONIZATION_DESIGN.md`:
     1. Stop recording in `showUserFeedback()`
     2. Add state guard in TTS 'ended' listeners
     3. Add state guard in `speechAPICallback()`
   - Verify before M3 to avoid confusion

3. ⚠️ **State Machine Logging** (VERIFY)
   - Ensure `[SR]` and `[SM]` logs work
   - Collect baseline execution traces
   - Use for debugging M3 changes

---

## Success Criteria

- [ ] 15-25 new Tracker.autorun instances
- [ ] 5-10 module variables → ReactiveVars
- [ ] No duplicate feedback bug
- [ ] No recording in wrong states
- [ ] TTS doesn't restart in wrong state
- [ ] 20-30% fewer reactive computations
- [ ] All UI updates automatic (minimize jQuery)
- [ ] Clean state transition logs
- [ ] All test scenarios pass
- [ ] Performance baseline maintained or improved

---

## Related Documentation

- [CARD_REFACTORING_STATUS.md](CARD_REFACTORING_STATUS.md) - M3 overview
- [STATE_MACHINE_IMPLEMENTATION_PLAN.md](STATE_MACHINE_IMPLEMENTATION_PLAN.md) - Trial FSM
- [STATE_MACHINE_SAFETY_ASSESSMENT.md](STATE_MACHINE_SAFETY_ASSESSMENT.md) - SR/SM safety
- [STATE_MACHINE_TRACING_GUIDE.md](STATE_MACHINE_TRACING_GUIDE.md) - Debugging
- [scripts/migration_report_FINAL.md](../scripts/migration_report_FINAL.md) - M1 lessons

---

## Timeline

| Phase | Hours | Deliverable |
|-------|-------|-------------|
| 1. Audit | 5 | M3_AUDIT_REPORT.md |
| 2. ReactiveVars | 3 | Module vars → ReactiveDict |
| 3. Autoruns | 8 | 15-25 new autoruns |
| 4. Test | 4 | All tests pass |
| **Total** | **20** | **M3 Complete** |

---

## Next Steps

1. **Complete SR/SM sync prerequisites** (if not done)
2. **Verify state machine logging works**
3. **Start Phase 1 audit** (create M3_AUDIT_REPORT.md)
4. **Get approval** before Phase 2 implementation

---

**Last Updated:** 2025-01-10
**Status:** Ready to begin Phase 1 (Audit)
