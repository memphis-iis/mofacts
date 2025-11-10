# M3 Phase 4: Comprehensive Testing Plan

**Date:** 2025-01-10
**Status:** Ready for testing
**Purpose:** Validate all M3 autorun implementations

---

## Test Environment Setup

### Prerequisites
1. Local development server running
2. Speech recognition enabled in browser (Chrome/Edge recommended)
3. Microphone access granted
4. TDF with:
   - Drill trials (with feedback)
   - Test trials (no feedback)
   - Study trials
   - TTS-enabled questions
5. Browser console open (monitor for errors and M3 logs)

### Metrics to Collect

Before starting tests, record baseline:

```javascript
// In browser console:
console.log('Active computations:', Tracker.active ? 'enabled' : 'disabled');
console.log('Current computations count:', Object.keys(Tracker._computations || {}).length);
```

---

## Test Scenarios

### ✅ Test 1: Study Trial Flow
**Purpose:** Verify basic state transitions without SR or feedback

**Steps:**
1. Start a study trial (no SR, no feedback)
2. Observe state transitions: IDLE → LOADING → PRESENTING → STUDY → TRANSITION

**Expected Results:**
- [ ] No recording starts (study trials don't use SR)
- [ ] Content fades in smoothly
- [ ] No feedback shown
- [ ] Progress updates automatically
- [ ] Clean transition to next trial
- [ ] Console shows clean state transition logs

**Pass/Fail:** ___________

---

### ✅ Test 2: Drill Trial - Correct Answer (Voice)
**Purpose:** Verify SR recording and feedback with correct answer

**Steps:**
1. Start a drill trial with SR enabled
2. Wait for recording to start (green mic icon)
3. Speak the correct answer clearly
4. Observe voice stop → processing → feedback

**Expected Results:**
- [ ] Recording starts automatically in PRESENTING_AWAITING
- [ ] Green mic icon shows during recording
- [ ] Voice stops → mic turns RED immediately (processing)
- [ ] "Please wait..." message shows
- [ ] Transcription received → feedback displays
- [ ] Recording stops during feedback
- [ ] Green checkmark or correct feedback shown
- [ ] No console errors

**Pass/Fail:** ___________

---

### ✅ Test 3: Drill Trial - Timeout
**Purpose:** Verify trial timeout fires correctly

**Steps:**
1. Start a drill trial with SR enabled
2. Wait for recording to start
3. Do NOT speak - let trial timeout
4. Observe timeout → feedback

**Expected Results:**
- [ ] Recording starts automatically
- [ ] Timeout fires after configured duration
- [ ] Recording stops automatically when timeout fires
- [ ] Feedback displays (timeout feedback)
- [ ] No console errors
- [ ] No `TypeError: n is not a function`

**Pass/Fail:** ___________

---

### ✅ Test 4: Drill Trial - Late Voice Input (Edge Case)
**Purpose:** Verify late transcriptions are handled correctly

**Steps:**
1. Start a drill trial with SR enabled
2. Speak an answer but immediately timeout (rapid speech + fast timeout)
3. Observe if late transcription arrives after timeout

**Expected Results:**
- [ ] Timeout fires first
- [ ] Recording stops at timeout
- [ ] Feedback shows timeout message
- [ ] Late transcription (if arrives) is ignored
- [ ] Autorun does NOT restart recording (already in FEEDBACK state)
- [ ] No state confusion
- [ ] Console may show "[SR] Late transcription ignored" message

**Pass/Fail:** ___________

---

### ✅ Test 5: Test Trial (No Feedback)
**Purpose:** Verify test trials work without feedback

**Steps:**
1. Start a test trial
2. Provide answer (text or voice)
3. Observe transition to next trial

**Expected Results:**
- [ ] No feedback shown
- [ ] Direct transition from PRESENTING → TRANSITION
- [ ] Recording stops when answer submitted
- [ ] Next trial loads smoothly
- [ ] No errors

**Pass/Fail:** ___________

---

### ✅ Test 6: Multiple Rapid Trials
**Purpose:** Verify no state leakage between trials

**Steps:**
1. Complete 5 trials in rapid succession
2. Mix of correct/incorrect/timeout
3. Observe each transition

**Expected Results:**
- [ ] Each trial starts clean (no leftover state)
- [ ] Recording starts/stops correctly for each trial
- [ ] Feedback clears between trials
- [ ] Content fades in/out smoothly
- [ ] No cumulative errors
- [ ] Performance remains stable

**Pass/Fail:** ___________

---

### ✅ Test 7: TTS During Question
**Purpose:** Verify TTS locks recording correctly

**Steps:**
1. Start a trial with TTS-enabled question
2. Observe TTS playback
3. Verify recording behavior

**Expected Results:**
- [ ] Recording does NOT start during TTS playback
- [ ] `recordingLocked = true` during TTS
- [ ] Recording starts automatically AFTER TTS completes
- [ ] Only restarts if still in PRESENTING_AWAITING state
- [ ] Smooth transition from TTS → recording
- [ ] Console shows "[SR] Auto-restarting recording - TTS complete"

**Pass/Fail:** ___________

---

### ✅ Test 8: TTS During Feedback
**Purpose:** Verify autorun doesn't restart recording in wrong state

**Steps:**
1. Complete a trial that triggers feedback
2. If feedback has TTS, let it play
3. Observe when TTS completes

**Expected Results:**
- [ ] Recording does NOT restart after feedback TTS
- [ ] Autorun checks state = FEEDBACK_SHOWING
- [ ] `!acceptsInput` condition blocks restart
- [ ] No unwanted recording in feedback state
- [ ] Console shows no "[SR] Auto-restarting" message during feedback

**Pass/Fail:** ___________

---

## Edge Case Tests

### ✅ Edge Case 1: Browser Tab Switch
**Purpose:** Verify state remains valid after tab switch

**Steps:**
1. Start a trial with recording
2. Switch to another browser tab
3. Switch back after 5 seconds
4. Observe state

**Expected Results:**
- [ ] Recording may have stopped (browser behavior)
- [ ] State remains consistent
- [ ] No stuck states
- [ ] Can complete trial normally

**Pass/Fail:** ___________

---

### ✅ Edge Case 2: Rapid Answer Submission
**Purpose:** Verify no race conditions on rapid input

**Steps:**
1. Start a trial
2. Immediately submit answer (within 100ms of display)
3. Observe

**Expected Results:**
- [ ] Answer accepted
- [ ] No double-submission
- [ ] Clean transition
- [ ] No errors

**Pass/Fail:** ___________

---

### ✅ Edge Case 3: Network Delay Simulation
**Purpose:** Verify behavior with slow speech API

**Steps:**
1. Start recording
2. Speak answer
3. Simulate slow network (Chrome DevTools throttling)
4. Observe long wait for transcription

**Expected Results:**
- [ ] Red icon shows during entire wait
- [ ] "Please wait..." persists
- [ ] `waitingForTranscription = true` throughout
- [ ] Autorun does NOT restart recording during wait
- [ ] Eventually receives transcription or times out
- [ ] No stuck states

**Pass/Fail:** ___________

---

## Performance Measurements

### Reactive Computation Count

**Before M3 (baseline):**
- Computation count: ______
- Trial transition time: ______ ms
- Frame rate during animation: ______ fps

**After M3 (with autoruns):**
- Computation count: ______
- Trial transition time: ______ ms
- Frame rate during animation: ______ fps

**Improvement:**
- Computation reduction: ______%
- Performance change: ______

### Memory Usage

**Before M3:**
- Heap size after 20 trials: ______ MB

**After M3:**
- Heap size after 20 trials: ______ MB

**Memory leak check:** Pass / Fail

---

## Console Log Analysis

### Expected Console Messages

**Clean run should show:**
```
[SR] Auto-stopping recording - state changed to: FEEDBACK_SHOWING
[SR] Auto-restarting recording - TTS complete, conditions met
[M3] Auto-disabling input - state: FEEDBACK_SHOWING
[SR] Set waitingForTranscription=true (voice stop, about to process)
[SR] Set waitingForTranscription=false (transcription received)
```

**Should NOT show:**
```
TypeError: n is not a function
Autorun is looping
Too much recursion
Recording started in wrong state
```

---

## Success Criteria

M3 Phase 4 passes if:

- [ ] All 8 core test scenarios pass
- [ ] All 3 edge case tests pass
- [ ] No console errors during any test
- [ ] Reactive computation count reduced by 10-30%
- [ ] No memory leaks detected
- [ ] No performance regression
- [ ] Red SR icon shows correctly during processing
- [ ] Timeout fires correctly (no function errors)
- [ ] Recording never happens in wrong state
- [ ] TTS coordination is automatic (no manual sync needed)

---

## Known Issues / Acceptable Failures

None expected. All autoruns have been implemented and tested individually.

---

## Remediation Plan

If any tests fail:

1. **Console errors:**
   - Check for unhandled exceptions
   - Review autorun logic
   - Check for missing Tracker.afterFlush

2. **State stuck:**
   - Check for infinite autorun loops
   - Verify state transitions
   - Check cleanup logic

3. **Performance regression:**
   - Check for excessive computations
   - Review Tracker dependencies
   - Check for cascade invalidations

4. **Memory leaks:**
   - Check for untracked autoruns
   - Verify template cleanup (onDestroyed)
   - Check for event listener leaks

---

## Sign-off

**Tester:** _______________
**Date:** _______________
**Overall Result:** Pass / Fail
**Notes:**

---

**Last Updated:** 2025-01-10
**Status:** Ready for execution
