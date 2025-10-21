# TTS Bleeding Into Next Trial During reviewstudy Timeout

**Created:** 2025-01-19
**Status:** Fixed
**Files:** `card.js:2720`

## Problem

When a user answers incorrectly during a drill, TTS audio feedback was bleeding into the subsequent trial if the Google TTS API didn't respond before the `reviewstudy` timeout expired.

### Symptoms
- User answers incorrectly (drill question)
- `reviewstudy` timeout expires (e.g., 5000ms)
- Trial advances to next question
- TTS feedback from **previous trial** plays during **current trial**
- Audio overlap and confusion

### Root Cause

The `reviewstudy` timeout callback at `card.js:2719-2722` was calling `afterFeedbackCallbackBind()` **without awaiting** it:

```javascript
// OLD CODE (BUGGY)
const timeout = Meteor.setTimeout(async function() {
  afterFeedbackCallbackBind()  // ← Missing await!
  engine.updatePracticeTime(Date.now() - trialEndTimeStamp)
}, reviewTimeout)
```

Even though `afterFeedbackCallback` (line 2741) contains Promise.all logic to wait for both countdown AND TTS (lines 2868-2873), the timeout callback wasn't waiting for it to complete.

### Execution Flow (Bug)

```
1. User answers incorrectly
2. showUserFeedback() calls TTS API (async, takes time)
3. afterAnswerFeedbackCallback() sets reviewTimeout timer (5000ms)
4. ⏱️ 5000ms passes...
5. Timeout fires → calls afterFeedbackCallbackBind()
6. ❌ BUG: Doesn't await the Promise.all inside!
7. Trial advances immediately to prepareCard()
8. ⏱️ TTS API finally responds (6000ms total)
9. ❌ BUG: Audio plays during NEXT trial!
```

### Why This Didn't Affect correctprompt

For **correct answers** (using `correctprompt` timeout), the feedback message is shorter ("Correct!"), so the TTS API typically responds faster (under 5 seconds). The race condition exists but is less likely to trigger.

For **incorrect answers** (using `reviewstudy` timeout), the feedback message is longer ("The correct answer is X, you answered Y"), taking more time to generate and transmit. This makes the race condition much more frequent.

### Why Visual Countdown Doesn't Matter

The Promise.all at line 2868-2873 waits for:
1. Visual countdown interval (`CurIntervalId`)
2. TTS request completion (`ttsRequested`)

When visual countdown is **disabled** (common configuration):
- `CurIntervalId` is never set (line 2584-2593 else branch)
- waitForCountdown resolves immediately (line 2810-2813)
- Only waitForTTS actually waits

But since the timeout callback **wasn't awaiting** the Promise.all, neither wait happened!

## Solution

Add `await` to the timeout callback at line 2720:

```javascript
// NEW CODE (FIXED)
const timeout = Meteor.setTimeout(async function() {
  await afterFeedbackCallbackBind()  // ← Added await
  engine.updatePracticeTime(Date.now() - trialEndTimeStamp)
}, reviewTimeout)
```

### Execution Flow (Fixed)

```
1. User answers incorrectly
2. showUserFeedback() calls TTS API (async, takes time)
3. afterAnswerFeedbackCallback() sets reviewTimeout timer (5000ms)
4. ⏱️ 5000ms passes...
5. Timeout fires → calls afterFeedbackCallbackBind()
6. ✅ FIX: Awaits the Promise.all inside!
7. Promise.all waits for:
   - Countdown (already done, resolves immediately)
   - TTS (still pending...)
8. ⏱️ TTS API responds (6000ms total)
9. ✅ Audio plays during CURRENT trial
10. Promise.all resolves
11. Trial advances to prepareCard()
12. ✅ Next trial starts cleanly, no audio bleed
```

## Expected Behavior After Fix

The `reviewstudy` timeout now **extends** if TTS hasn't completed yet. The trial will only advance when **WHICHEVER HAPPENS LAST**:

1. **`reviewstudy` timer expires** (e.g., 5000ms)
2. **TTS audio finishes playing** (could be longer if API is slow)
3. **30-second failsafe triggers** (absolute maximum, network/API failure)

### Test Scenarios

#### Scenario 1: Fast TTS (completes before reviewstudy)
```
reviewstudy = 5000ms
TTS completes in 2000ms
Expected: Wait full 5000ms, then advance
Result: ✅ reviewstudy controls duration
```

#### Scenario 2: Slow TTS (takes longer than reviewstudy)
```
reviewstudy = 5000ms
TTS completes in 8000ms
Expected: Wait 8000ms (extended), then advance
Result: ✅ TTS extends the wait time
```

#### Scenario 3: Very Slow TTS (network issues)
```
reviewstudy = 5000ms
TTS doesn't respond for 35+ seconds
Expected: 30s failsafe triggers, stops audio, advances
Result: ✅ Failsafe prevents infinite wait
```

#### Scenario 4: Countdown Display Disabled
```
reviewstudy = 5000ms
Visual countdown = disabled
TTS completes in 3000ms
Expected: Wait full 5000ms, then advance
Result: ✅ Works regardless of countdown display setting
```

## Related Fixes

This fix works in conjunction with:

1. **30-second TTS failsafe** (line 2849-2861)
   - Stops orphaned audio: `window.currentAudioObj.pause()`
   - Unlocks recording: `Session.set('recordingLocked', false)`
   - Prevents infinite wait

2. **Audio cleanup in prepareCard()** (line 3223-3230)
   - Defensive: stops orphaned audio during trial transition
   - Safety net for edge cases

3. **Comprehensive logging** (lines 2816-2873)
   - Tracks countdown duration
   - Tracks TTS duration
   - Tracks total wait time
   - Helps diagnose timing issues

## Code Changes

### File: `card.js`

#### Line 2720 - Add await to timeout callback
```diff
  const timeout = Meteor.setTimeout(async function() {
-   afterFeedbackCallbackBind()
+   await afterFeedbackCallbackBind()
    engine.updatePracticeTime(Date.now() - trialEndTimeStamp)
  }, reviewTimeout)
```

## Logging

### Success (TTS completes before reviewstudy)
```
[SM] afterAnswerFeedbackCallback: Waiting for countdown and TTS to complete
[SM] Countdown already finished
[SM] 🎤 TTS was requested, waiting for it to complete...
[SR]   ✅ TTS audio received, LOCKING RECORDING
[SR]   ✅ TTS audio ended, unlocking recording
[SM] 🎤 TTS request complete after 2341ms
[SM] ✅ Both countdown and TTS complete (waited 2341ms), transitioning to next trial
```

### Extended Wait (TTS slower than reviewstudy)
```
[SM] afterAnswerFeedbackCallback: Waiting for countdown and TTS to complete
[SM] Countdown already finished
[SM] 🎤 TTS was requested, waiting for it to complete...
[SR]   ✅ TTS audio received, LOCKING RECORDING
[SR]   ✅ TTS audio ended, unlocking recording
[SM] 🎤 TTS request complete after 8123ms
[SM] ✅ Both countdown and TTS complete (waited 8123ms), transitioning to next trial
```
_(Note: Even though reviewstudy=5000ms, waited 8123ms for TTS)_

### Failsafe Triggered (very slow TTS)
```
[SM] afterAnswerFeedbackCallback: Waiting for countdown and TTS to complete
[SM] Countdown already finished
[SM] 🎤 TTS was requested, waiting for it to complete...
[SM] ⚠️ TTS timeout (30s), forcing continue
[SM]   Stopping orphaned TTS audio from timeout
[SM] ✅ Both countdown and TTS complete (waited 30000ms), transitioning to next trial
```

## Impact

**Severity:** High - Breaks user experience with confusing audio overlap
**Frequency:** High with slow networks or long feedback messages (incorrect answers)
**Users Affected:** All users with TTS audio feedback enabled, especially with `reviewstudy` timeouts
**Fix Difficulty:** Low - Single line change
**Testing:** Easy to reproduce with network throttling or long feedback messages

## Prevention

This bug pattern can occur anywhere we have:
- Async callbacks in timeouts/intervals
- Promise-based waiting logic inside async functions
- Missing `await` keywords

**Recommendation:** Enable ESLint rule `@typescript-eslint/no-floating-promises` to catch unawaited promises.
