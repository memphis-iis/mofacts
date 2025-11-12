# Trial 1 State Machine Initialization Fix

**Date:** 2025-01-12
**Issue:** Invalid state transition error on Trial 1 causing speech recognition to fail
**Status:** Fixed

## Problem Description

### Symptoms
- Speech recognition appeared to work (microphone active, listening UI displayed)
- User speech was not being processed or recognized
- Console error: `[SM] ❌ [Trial 1] INVALID STATE TRANSITION: PRESENTING.AWAITING → TRANSITION.FADING_OUT`
- Invalid transition error occurred specifically on the first trial after starting a session

### Root Cause Analysis

The issue occurred during unit-to-unit transitions, specifically when transitioning from an **instruction-only unit** to the first real trial:

1. **Instruction-only units** (defined in `unitEngine.js:369-381`) are created for units without learning content
   - These units go through normal trial state machine: `IDLE → LOADING → FADING_IN → DISPLAYING → AWAITING`
   - Their `unitFinished()` method immediately returns `true`

2. When the instruction unit completes:
   - State machine is in `PRESENTING.AWAITING` (waiting for user input)
   - System calls `prepareCard()` to start the next unit (first real trial)
   - Old code didn't handle this state, causing invalid transition error

3. **Impact on speech recognition:**
   - State machine violation prevented proper trial initialization
   - Speech recognition state became desynchronized
   - Input processing was blocked due to invalid state

### Sequence of Events

```
1. User navigates from dashboard → /card route
2. Template.card.onRendered() → processUserTimesLog()
3. Creates "instruction-only" unit engine
4. Unit displays and transitions to PRESENTING.AWAITING
5. Unit immediately reports finished (unitFinished() = true)
6. System calls prepareCard() to start first real trial
7. ❌ ERROR: prepareCard() called from PRESENTING.AWAITING (invalid)
8. State machine desynchronized → SR fails
```

## Solution

### Code Changes

**File:** `mofacts/client/views/experiment/card.js`
**Location:** Lines 3412-3417 (in `prepareCard()` function)

Added proper handling for unit-to-unit transitions:

```javascript
} else if (trialState.get('current') === TRIAL_STATES.PRESENTING_AWAITING ||
           trialState.get('current') === TRIAL_STATES.STUDY_SHOWING) {
  // FIX: Unit transition (e.g., instruction-only → first real trial) - properly exit current state
  clientConsole(2, '[SM]   Transitioning from', trialState.get('current'), 'to TRANSITION.START before prepareCard');
  transitionTrialState(TRIAL_STATES.TRANSITION_START, 'Unit transition - exiting current trial state');
  transitionTrialState(TRIAL_STATES.TRANSITION_FADING_OUT, 'Fade-out previous unit content');
}
```

### How It Works

1. **Detects unit transition:** When `prepareCard()` is called from `PRESENTING_AWAITING` or `STUDY_SHOWING` states
2. **Proper state exit:** Transitions through `TRANSITION_START` first (valid transition per state machine)
3. **Continue normally:** Then proceeds to `TRANSITION_FADING_OUT` and continues with normal prepareCard flow

### Why This Fix Is Correct

- **Valid transitions:** Both `PRESENTING_AWAITING` and `STUDY_SHOWING` can legally transition to `TRANSITION_START` (lines 1404, 1408)
- **State machine integrity:** Maintains proper state flow instead of forcing invalid transitions
- **Minimal impact:** Only affects edge case of unit-to-unit transitions, no impact on normal trial flow
- **Comprehensive:** Handles both drill/test trials (`PRESENTING_AWAITING`) and study trials (`STUDY_SHOWING`)

## Testing

### Test Scenario 1: First Trial with Speech Recognition
**Steps:**
1. Start new session from dashboard
2. Navigate to first unit with speech recognition enabled
3. Speak answer on Trial 1

**Expected Result:**
- No state machine errors in console
- Speech recognition properly processes user input
- Trial proceeds normally through state transitions

### Test Scenario 2: Instruction-Only Unit Transition
**Steps:**
1. Start unit that begins with instruction-only content
2. Complete instruction unit
3. Proceed to first real trial

**Expected Result:**
- Clean transition from instruction unit to first trial
- No invalid state transition errors
- State machine in correct state for input

### Test Scenario 3: Study Trial Transition
**Steps:**
1. Complete a study trial
2. System transitions to next unit

**Expected Result:**
- `STUDY_SHOWING` state properly handled
- Transition completes without errors

## Related Files

- `mofacts/client/views/experiment/card.js` - Main fix location (lines 3412-3417)
- `mofacts/client/views/experiment/unitEngine.js` - Instruction-only unit definition (lines 369-381)
- `mofacts/client/views/experiment/card.js` - State machine definitions (lines 1346-1420)

## Related Issues

- Original state machine implementation: `docs_dev/SPEECH_RECOGNITION_STATE_MACHINE.md`
- State transition validation: Lines 1427-1455 in `card.js`
- Speech recognition state management: Lines 4170-4187 in `card.js` (Layer 3 defense)

## Prevention

This issue highlights the importance of:

1. **Comprehensive state handling:** All possible states must be handled in state transition code
2. **Unit transition awareness:** Special consideration needed for unit-to-unit transitions
3. **State machine testing:** Test edge cases like first trial, unit transitions, instruction-only units
4. **Defensive coding:** Add state validation logging to catch unexpected transitions early

## Verification

To verify the fix is working:

```javascript
// In browser console after navigating to first trial:
// Should see these logs without errors:
"[SM]   Transitioning from PRESENTING.AWAITING to TRANSITION.START before prepareCard"
"[SM] ✓ [Trial 1] STATE: PRESENTING.AWAITING → TRANSITION.START (Unit transition - exiting current trial state)"
"[SM] ✓ [Trial 1] STATE: TRANSITION.START → TRANSITION.FADING_OUT (Fade-out previous unit content)"
```

## Status

- ✅ Root cause identified
- ✅ Fix implemented
- ⏳ Testing required
- ⏳ Deployment pending

---

**Implementation Details:**
- Commit: [To be added after commit]
- Branch: meteor-3.3.2-upgrade
- Files Modified: 1
- Lines Changed: +6
