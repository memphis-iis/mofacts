# State Machine Execution Tracing Guide

## Overview

State machine logging has been added throughout `card.js` to trace actual execution flow and identify superstitious coding patterns. All logs use the `[SM]` prefix for easy filtering in the console.

**Console Filter:** `[SM]`

This will show:
- State transitions (✓ valid, ❌ invalid)
- Function entry points with current state
- Execution flow through the trial lifecycle

## Purpose

The logging enables:
1. **Execution flow analysis** - See which functions are called in which states
2. **Dead code detection** - Identify code paths that never execute
3. **Superstitious coding discovery** - Find redundant checks/guards
4. **Race condition detection** - Verify functions execute in expected states
5. **Documentation validation** - Confirm actual behavior matches documentation

## Functions Instrumented

### Core Trial Lifecycle

| Function | Expected State(s) | Purpose |
|----------|------------------|---------|
| `prepareCard()` | IDLE (first), TRANSITION.START (subsequent) | Entry point for new trial setup |
| `preloadStimuliFiles()` | PRESENTING.LOADING | Asset preloading during trial setup |
| `newQuestionHandler()` | PRESENTING.LOADING | Question setup after card selection |
| `checkAndDisplayPrestimulus()` | PRESENTING.LOADING | Optional prestimulus display |
| `checkAndDisplayTwoPartQuestion()` | PRESENTING.LOADING | Main question display setup |

### User Interaction

| Function | Expected State(s) | Purpose |
|----------|------------------|---------|
| `allowUserInput()` | PRESENTING.DISPLAYING → PRESENTING.AWAITING or STUDY.SHOWING | Enable user to type/click |
| `stopUserInput()` | Any active state → transitioning | Disable user input |
| `handleUserInput()` | PRESENTING.AWAITING | Process user's answer submission |

### Feedback & Transition

| Function | Expected State(s) | Purpose |
|----------|------------------|---------|
| `showUserFeedback()` | PRESENTING.AWAITING → FEEDBACK.SHOWING | Display drill feedback (drills only) |
| `hideUserFeedback()` | FEEDBACK.SHOWING → TRANSITION.START | Hide feedback before transition |
| `afterFeedbackCallback()` | FEEDBACK.SHOWING or STUDY.SHOWING | After feedback display completes |
| `cardEnd()` | FEEDBACK.SHOWING, STUDY.SHOWING, or PRESENTING.AWAITING (tests) → TRANSITION.START | Begin trial end transition |

### Cleanup

| Function | Expected State(s) | Purpose |
|----------|------------------|---------|
| `cleanupTrialContent()` | TRANSITION.FADING_OUT | Clear previous trial's DOM content |

## Expected Execution Flows

### Drill Trial (Normal Flow)

```
[SM] prepareCard called in TRANSITION.START
[SM] preloadStimuliFiles called in PRESENTING.LOADING
[SM] newQuestionHandler called in PRESENTING.LOADING
[SM] checkAndDisplayTwoPartQuestion called in PRESENTING.LOADING
[SM] ✓ STATE: PRESENTING.FADING_IN (displayReady=true)
[SM] ✓ STATE: PRESENTING.DISPLAYING (fade-in complete)
[SM] allowUserInput called in PRESENTING.DISPLAYING
[SM] ✓ STATE: PRESENTING.AWAITING (ready for input)
[SM] handleUserInput called in PRESENTING.AWAITING (source: keypress)
[SM] ✓ STATE: FEEDBACK.SHOWING (showing feedback)
[SM] showUserFeedback called in PRESENTING.AWAITING
[SM] afterFeedbackCallback called in FEEDBACK.SHOWING
[SM] cardEnd called in FEEDBACK.SHOWING
[SM] ✓ STATE: TRANSITION.START (trial complete)
[SM] hideUserFeedback called in TRANSITION.START
[SM] prepareCard called in TRANSITION.START
```

### Study Trial (Normal Flow)

```
[SM] prepareCard called in TRANSITION.START
[SM] preloadStimuliFiles called in PRESENTING.LOADING
[SM] newQuestionHandler called in PRESENTING.LOADING
[SM] checkAndDisplayTwoPartQuestion called in PRESENTING.LOADING
[SM] ✓ STATE: PRESENTING.FADING_IN (displayReady=true)
[SM] ✓ STATE: PRESENTING.DISPLAYING (fade-in complete)
[SM] allowUserInput called in PRESENTING.DISPLAYING
[SM] ✓ STATE: STUDY.SHOWING (study trial, no input needed)
[SM] handleUserInput called in STUDY.SHOWING (source: timeout)
[SM] afterFeedbackCallback called in STUDY.SHOWING
[SM] cardEnd called in STUDY.SHOWING
[SM] ✓ STATE: TRANSITION.START (trial complete)
[SM] prepareCard called in TRANSITION.START
```

### Test Trial (Normal Flow)

```
[SM] prepareCard called in TRANSITION.START
[SM] preloadStimuliFiles called in PRESENTING.LOADING
[SM] newQuestionHandler called in PRESENTING.LOADING
[SM] checkAndDisplayTwoPartQuestion called in PRESENTING.LOADING
[SM] ✓ STATE: PRESENTING.FADING_IN (displayReady=true)
[SM] ✓ STATE: PRESENTING.DISPLAYING (fade-in complete)
[SM] allowUserInput called in PRESENTING.DISPLAYING
[SM] ✓ STATE: PRESENTING.AWAITING (ready for input)
[SM] handleUserInput called in PRESENTING.AWAITING (source: keypress)
[SM] afterFeedbackCallback called in PRESENTING.AWAITING (test skips feedback)
[SM] cardEnd called in PRESENTING.AWAITING
[SM] ✓ STATE: TRANSITION.START (trial complete)
[SM] prepareCard called in TRANSITION.START
```

## Anomaly Detection

### Invalid State Transitions

If you see `[SM] ❌ INVALID STATE TRANSITION`, investigate:
- Why the function was called from an unexpected state
- Whether the transition is a race condition
- If the code path is actually needed

Example of what to look for:
```
[SM] ❌ INVALID STATE TRANSITION: PRESENTING.FADING_IN → PRESENTING.AWAITING
   Valid transitions from PRESENTING.FADING_IN: PRESENTING.DISPLAYING
```

This indicates `allowUserInput()` was called before fade-in completed (race condition).

### Functions Called in Unexpected States

Example:
```
[SM] showUserFeedback called in state: STUDY.SHOWING
```

This should NEVER happen - study trials don't show feedback. If you see this, there's a bug in the trial type detection logic.

### Multiple Calls to Same Function

Example:
```
[SM] prepareCard called in TRANSITION.START
[SM] prepareCard called in TRANSITION.FADING_OUT
[SM] prepareCard called in PRESENTING.LOADING
```

This indicates a reactive loop - `prepareCard()` should only be called once per trial.

## Superstitious Code Analysis Workflow

### Step 1: Collect Execution Traces

1. Open browser console
2. Filter by `[SM]`
3. Run through several trials of each type (study, drill, test)
4. Copy console output to a text file

### Step 2: Analyze Function Call States

For each function, check:
- Is it called in the expected state(s)?
- Are there code paths that never execute?
- Are there guards/checks for states that never occur?

Example analysis:

```javascript
function showUserFeedback(...) {
  console.log('[SM] showUserFeedback called in state:', currentTrialState);

  // QUESTION: Is this check necessary?
  if (getTestType() === 's' || getTestType() === 'f') {
    // This should NEVER execute - study trials skip showUserFeedback entirely
    // If logs show this never executes, this is SUPERSTITIOUS CODE
    return;
  }

  // Real feedback display logic...
}
```

Check the logs - if `showUserFeedback` is NEVER called in STUDY.SHOWING state, then the study trial check is dead code.

### Step 3: Identify Redundant Guards

Look for defensive checks that can't fail given the state machine:

```javascript
function cardEnd() {
  // If cardEnd is ONLY ever called from FEEDBACK.SHOWING or STUDY.SHOWING,
  // then checking the trial type here is redundant - we already know what
  // type it is based on the state!

  if (getTestType() === 's' || getTestType() === 'f') {
    // Study cleanup
  } else {
    // Drill cleanup
  }
}
```

Check logs: What states is `cardEnd()` called from? If always FEEDBACK.SHOWING or STUDY.SHOWING, can we simplify?

### Step 4: Document Findings

Create a report:

```markdown
## Dead Code Found

### showUserFeedback() - Study Trial Guard

**Location:** card.js:2140
**Code:**
```javascript
if (getTestType() === 's' || getTestType() === 'f') {
  return; // Skip feedback for study trials
}
```

**Evidence:** Logs show showUserFeedback() is NEVER called during study trials (they use STUDY.SHOWING state instead). Study trials call afterFeedbackCallback() directly without going through showUserFeedback().

**Recommendation:** Remove this check - it's unreachable code. If somehow a study trial did call showUserFeedback(), we'd want to know about it (bug) rather than silently skip it.
```

### Step 5: Verify with State Machine

Cross-reference findings with state machine documentation:

1. Read `STATE_MACHINE_IMPLEMENTATION_PLAN.md`
2. Check expected state transitions
3. Verify code matches documented flow
4. Update documentation if reality differs

## Common Superstitious Patterns to Look For

### 1. Defensive Checks That Can't Fail

```javascript
function allowUserInput() {
  // STATE: We're in PRESENTING.DISPLAYING
  // About to transition to PRESENTING.AWAITING

  // SUPERSTITIOUS? This check might be redundant if allowUserInput()
  // is ONLY called for drill/test trials
  if (getTestType() !== 's' && getTestType() !== 'f') {
    $('#userAnswer').prop('disabled', false);
  }
}
```

**Analysis:** Check logs - is `allowUserInput()` ever called for study trials? If not, the check is superstitious.

### 2. Redundant State Checks

```javascript
function hideUserFeedback() {
  // STATE: We're in TRANSITION.START

  // SUPERSTITIOUS? If hideUserFeedback() is ONLY called from cardEnd(),
  // and cardEnd() is ONLY called when feedback is showing, then this
  // check is redundant
  if ($('#UserInteraction').is(':visible')) {
    $('#UserInteraction').hide();
  }
}
```

**Analysis:** Check logs - what states is `hideUserFeedback()` called from? Is feedback always visible?

### 3. "Just in Case" Cleanup

```javascript
function cleanupTrialContent() {
  // Clear everything "just in case"
  $('#userAnswer').val('');
  $('#dialogueUserAnswer').val('');
  $('#userForceCorrect').val('');
  // ... 20 more lines of cleanup
}
```

**Analysis:** Which of these fields are actually populated during trials? Can we skip clearing fields that are never used?

### 4. Overlapping Responsibility

```javascript
function cardEnd() {
  hideUserFeedback();
  $('#UserInteraction').hide(); // SUPERSTITIOUS? hideUserFeedback() already does this
  $('#userAnswer').val(''); // SUPERSTITIOUS? cleanupTrialContent() already does this
  // ...
}
```

**Analysis:** Who's responsible for what? Can we consolidate cleanup?

## Logging Format

All state machine logs follow this format:

### State Transitions

```
[SM] ✓ [Trial N] STATE: OLD_STATE → NEW_STATE (reason)
[SM] ❌ [Trial N] INVALID STATE TRANSITION: OLD_STATE → NEW_STATE
   Valid transitions from OLD_STATE: STATE1, STATE2, STATE3
   Reason: reason
```

### Function Entry

```
[SM] functionName called in state: CURRENT_STATE
```

### Additional Context

```
[SM]   displayReady before: true
[SM]   Setting displayReady=false to start fade-out
[SM]   Waiting 120ms for fade-out transition to complete...
```

## Next Steps

1. **Run trials** - Execute study, drill, and test trials
2. **Collect logs** - Copy `[SM]` filtered console output
3. **Analyze patterns** - Look for anomalies and unexpected states
4. **Document findings** - Create report of dead/superstitious code
5. **Refactor** - Remove unnecessary checks and consolidate cleanup
6. **Verify** - Re-run trials to confirm behavior unchanged

## Files Modified

- `mofacts/client/views/experiment/card.js` - Added `[SM]` logging to key functions

## Related Documentation

- [STATE_MACHINE_IMPLEMENTATION_PLAN.md](STATE_MACHINE_IMPLEMENTATION_PLAN.md) - Expected state transitions
- [STATE_MACHINE_SAFETY_ASSESSMENT.md](STATE_MACHINE_SAFETY_ASSESSMENT.md) - Code reality vs conceptual model
- [FOUC_AUDIT_REPORT.md](FOUC_AUDIT_REPORT.md) - Visual flash issues and fixes

---

**Created:** 2025-10-10
**Purpose:** Enable superstitious code analysis via state machine execution tracing
**Status:** ✅ Ready for Trial Testing
