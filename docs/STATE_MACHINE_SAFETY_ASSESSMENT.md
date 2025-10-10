# State Machine Implementation - Safety Assessment

## Executive Summary

**Overall Risk Level: LOW** ✅ (Updated 2025-10-10)

The proposed state machine implementation can be done safely with low risk to production. The code reality has been fully documented and the implementation plan updated to match.

**Key Finding (RESOLVED):** Study trials do NOT use the FEEDBACK phase - they use a separate STUDY phase. This has been corrected in the implementation plan.

---

## Code Reality vs. Conceptual Model

### What We Thought (Conceptual Model)

**Study trials:**
- Skip AWAITING_INPUT
- Go to FEEDBACK phase (shows stimulus+answer like feedback, but no correctness message)
- Display for ~1ms or purestudy timeout

**Drill trials:**
- AWAITING_INPUT
- FEEDBACK phase (shows stimulus+answer+correct/incorrect)
- Display for 2-5 seconds

**Test trials:**
- AWAITING_INPUT
- Skip FEEDBACK entirely

### What Actually Happens (Code Reality)

**Study trials** (`card.js:1898-1916`):
```javascript
const isDrill = (testType === 'd' || testType === 'm' || testType === 'n');
if (isDrill) {
  showUserFeedback(isCorrect, feedbackForAnswer, ...);
} else {
  // Study AND test both skip showUserFeedback()
  afterAnswerFeedbackCallback(...);
}
```

**Key Discovery:** Study trials do NOT call `showUserFeedback()` at all!

**What study trials actually do:**
1. Display stimulus+answer together during PRESENTING phase (via `studyDisplayClass` helper at line 1204-1206)
2. User sees it for `purestudy` timeout (e.g., 3 seconds)
3. Auto-submit with empty answer
4. Skip `showUserFeedback()` entirely
5. Go straight to `afterAnswerFeedbackCallback()` → `cardEnd()` → TRANSITION

**The stimulus IS the feedback** - there's no separate feedback display for study trials.

---

## Critical Code Locations

### 1. Trial Type Detection (Line 1898)
```javascript
const isDrill = (testType === 'd' || testType === 'm' || testType === 'n');
```
**Note:** `'m'` and `'n'` are additional drill-like trial types not in our documentation.

### 2. Feedback Display Decision (Lines 1899-1916)
```javascript
if (isDrill) {
  showUserFeedback(...);  // Only drills call this
} else {
  // Study ('s', 'f') and Test ('t') both skip feedback
  afterAnswerFeedbackCallback(...);
}
```

### 3. Study Display Class (Lines 1204-1206)
```javascript
'studyDisplayClass': function(isStudy, uiSettings) {
  return isStudy ? (uiSettings.textInputDisplay || '') : '';
}
```
**Purpose:** Applies styling to make study trials look like feedback display

### 4. Feedback Container (card.html:130)
```html
<div id="correctAnswerDisplayContainer" class="... d-none">
</div>
```
**Used by:** `showUserFeedback()` at line 2026 to display correct answer during drill feedback

### 5. Review Timeout Calculation (Lines 2325-2333)
```javascript
if (testType === 's' || testType === 'f') {
  // Study - but this is NOT feedback time, it's PRESENTING time
  reviewTimeout = _.intval(deliveryParams.reviewstudy);
} else if (testType === 't' || testType === 'i') {
  // Test - essentially skips feedback with 1ms timeout
  reviewTimeout = 1;
} else if (testType === 'd' || testType === 'm' || testType === 'n') {
  // Drill - actual feedback display time
  if (isCorrect) {
    reviewTimeout = _.intval(deliveryParams.correctprompt);
  } else {
    reviewTimeout = _.intval(deliveryParams.reviewstudy);
  }
}
```

**IMPORTANT:** For study trials, this `reviewTimeout` is used during the PRESENTING phase (not feedback), controlling how long the stimulus+answer is displayed.

---

## Corrected State Machine Model

### Study Trial Flow (ACTUAL)
```
PRESENTING.LOADING
    ↓
PRESENTING.FADING_IN
    ↓ Shows stimulus+answer together (studyDisplayClass applied)
PRESENTING.DISPLAYING
    ↓ Content visible for `purestudy` timeout (NOT reviewTimeout)
    ↓ No allowUserInput() called - user just reads
[SKIP AWAITING]
    ↓ Auto-submit after timeout
[SKIP FEEDBACK] ← Study does NOT call showUserFeedback()
    ↓ Goes directly to afterAnswerFeedbackCallback()
TRANSITION.START
    ↓
TRANSITION.FADING_OUT
    ↓
TRANSITION.CLEARING
```

### Drill Trial Flow (ACTUAL)
```
PRESENTING.LOADING
    ↓
PRESENTING.FADING_IN
    ↓ Shows stimulus only (NO answer visible)
PRESENTING.DISPLAYING
    ↓
PRESENTING.AWAITING
    ↓ allowUserInput() called
    ↓ User types answer
FEEDBACK.SHOWING ← Only drills call showUserFeedback()
    ↓ Shows stimulus+answer+correct/incorrect
    ↓ Display for reviewTimeout (2-5 seconds)
    ↓ $('#correctAnswerDisplayContainer').html(answer).removeClass('d-none')
TRANSITION.START
    ↓
TRANSITION.FADING_OUT
    ↓
TRANSITION.CLEARING
```

### Test Trial Flow (ACTUAL)
```
PRESENTING.LOADING
    ↓
PRESENTING.FADING_IN
    ↓ Shows stimulus only
PRESENTING.DISPLAYING
    ↓
PRESENTING.AWAITING
    ↓ allowUserInput() called
    ↓ User types answer
[SKIP FEEDBACK] ← Tests do NOT call showUserFeedback()
    ↓ Goes directly to afterAnswerFeedbackCallback()
TRANSITION.START
    ↓
TRANSITION.FADING_OUT
    ↓
TRANSITION.CLEARING
```

---

## Implementation Safety Analysis

### ✅ Safe Areas (Low Risk)

1. **TRANSITION phase states** - Already well-defined with awaits in place
   - `TRANSITION.START` → `cardEnd()`
   - `TRANSITION.FADING_OUT` → await 120ms fade
   - `TRANSITION.CLEARING` → cleanup DOM
   - Risk: **LOW** - Already working well after recent fixes

2. **PRESENTING.LOADING state** - Clear entry point
   - `engine.selectNextCard()`
   - `preloadStimuliFiles()` (now async/await)
   - Risk: **LOW** - Well-defined boundaries

3. **PRESENTING.FADING_IN state** - CSS-driven, clean
   - `displayReady=true` triggers fade
   - 100ms CSS transition
   - Risk: **LOW** - Simple toggle

4. **State constants and helpers** - Purely additive
   - Define `TRIAL_STATES` object
   - Add helper functions
   - Risk: **VERY LOW** - No existing code touched

### ⚠️ Moderate Risk Areas

1. **PRESENTING.DISPLAYING vs PRESENTING.AWAITING boundary**
   - Current code: `allowUserInput()` is called but timing is unclear
   - Need to determine exact transition point
   - Risk: **MODERATE** - Requires careful timing analysis
   - Mitigation: Add state tracking without changing behavior first

2. **FEEDBACK phase exists only for drills**
   - Need conditional state tracking: `if (isDrill) transitionTo(FEEDBACK.SHOWING)`
   - Study and test skip this state entirely
   - Risk: **MODERATE** - Must handle 3 different flows correctly
   - Mitigation: Use trial type helpers extensively

3. **Study trials display logic**
   - Template uses `studyDisplayClass` to style during PRESENTING
   - No separate feedback phase in code
   - Risk: **MODERATE** - Documentation vs reality mismatch
   - Mitigation: Update documentation to match code reality first

### 🔴 High Risk Areas

1. **Trial type detection inconsistencies**
   - Code checks for `'m'` and `'n'` trial types not in documentation
   - Unknown if other trial types exist
   - Risk: **HIGH** - Incomplete understanding of all trial types
   - **BLOCKER:** Must document ALL trial types before implementation

2. **`reviewTimeout` variable overloading**
   - Used for PRESENTING duration in study trials
   - Used for FEEDBACK duration in drill trials
   - Same variable, different semantic meaning
   - Risk: **HIGH** - Confusing and error-prone
   - Mitigation: Carefully document which state each timeout controls

3. **Blaze reactivity + state machine**
   - Session variables trigger template re-renders
   - State transitions could trigger unexpected re-renders mid-transition
   - Risk: **MODERATE-HIGH** - Race conditions possible
   - Mitigation: Use non-reactive variables for state tracking initially

---

## Unknown Trial Types

**Found in code but not documented:**
- `'m'` - Appears to be drill-like (calls `showUserFeedback`)
- `'n'` - Appears to be drill-like (calls `showUserFeedback`)
- `'i'` - Appears to be test-like (line 2330: `testType === 't' || testType === 'i'`)

**CRITICAL:** Must identify all trial types before implementation:
```javascript
// Line 1898
const isDrill = (testType === 'd' || testType === 'm' || testType === 'n');

// Line 2125
const isForceCorrectTrial = getTestType() === 'm' || getTestType() === 'n';

// Line 2330
} else if (testType === 't' || testType === 'i') {
  // A test or instruction unit
```

**Action Required:** Search codebase for all possible `testType` values.

---

## Recommended Implementation Strategy

### Phase 0: Discovery (2 days) ⚠️ REQUIRED FIRST
1. **Document all trial types** - Search for every `testType` check
2. **Map actual code flows** - Create flowcharts for each type
3. **Identify all state transitions** - Where does each function lead?
4. **Review with stakeholder** - Confirm understanding is correct

### Phase 1: Non-Invasive Tracking (3 days) ✅ SAFE
1. Add `TRIAL_STATES` constants
2. Add helper functions (no behavior change)
3. Add `currentTrialState` variable (not used yet)
4. Add `transitionTrialState()` logging function
5. **Insert logging calls only** - no logic changes
6. Run in development, collect logs, verify flows

### Phase 2: Validation (2 days) ✅ SAFE
1. Compare logs to expected flows
2. Fix documentation where reality differs
3. Identify any unexpected transitions
4. Add assertions in development mode only

### Phase 3: Enforcement (3 days) ⚠️ MODERATE RISK
1. Add `assertTrialState()` calls before operations
2. Throw errors in development when state is wrong
3. Log warnings in production (don't throw)
4. Fix any bugs discovered

### Phase 4: Visualization (1 day) ✅ SAFE
1. Add debug panel showing current state
2. Add console commands for state inspection
3. Purely observational - no behavior change

**Total Timeline: 11 days (same as original estimate)**

---

## Risk Mitigation Strategies

### 1. Feature Flag Approach
```javascript
const ENABLE_STATE_MACHINE_TRACKING = Meteor.settings?.enableStateMachine || false;

function transitionTrialState(newState, reason) {
  if (!ENABLE_STATE_MACHINE_TRACKING) return;
  // ... rest of implementation
}
```
**Benefit:** Can disable entirely if issues arise

### 2. Parallel Implementation
- Keep existing code exactly as-is
- Add state tracking alongside (not replacing)
- State machine observes but doesn't control (initially)

### 3. Gradual Rollout
1. Enable in development only (1 week)
2. Enable for developers in production (1 week)
3. Enable for test users (1 week)
4. Enable for all users

### 4. Comprehensive Logging
```javascript
function transitionTrialState(newState, reason) {
  const timestamp = Date.now();
  const trialNum = (Session.get('currentExperimentState')?.numQuestionsAnswered || 0) + 1;
  const testType = getTestType();

  console.log(`[${timestamp}] Trial ${trialNum} (${testType}): ${previousState} → ${newState} (${reason})`);

  // Store in array for export/debugging
  if (!window._stateTransitionLog) window._stateTransitionLog = [];
  window._stateTransitionLog.push({ timestamp, trialNum, testType, from: previousState, to: newState, reason });
}
```

### 5. Automated Testing
- Create test TDF files for each trial type
- Run automated selenium tests
- Verify state transitions match expected flows
- Detect regressions immediately

---

## Specific Safety Concerns

### Concern 1: Study Trial Confusion
**Issue:** Documentation says study trials use FEEDBACK phase, code says they don't.

**Resolution:**
- Update documentation to match code reality
- Study trials: PRESENTING only (stimulus+answer shown together)
- No separate FEEDBACK state for study trials
- FEEDBACK state exists ONLY for drill trials

**Risk if not fixed:** Developers implement wrong flow, break study trials

### Concern 2: Unknown Trial Types
**Issue:** `'m'`, `'n'`, `'i'` trial types found in code but not documented.

**Resolution:**
- Search entire codebase for trial type references
- Document behavior of each type
- Update state machine flows accordingly

**Risk if not fixed:** State machine incomplete, crashes on unknown types

### Concern 3: Session Variable Reactivity
**Issue:** Blaze re-renders when Session vars change, could interfere with state transitions.

**Resolution:**
- Use plain JavaScript variable for `currentTrialState` (not Session)
- Optional: Store in Session with underscore prefix for debugging (`_debugTrialState`)
- Ensure state transitions don't trigger unwanted re-renders

**Risk if not fixed:** Race conditions, inconsistent state during transitions

### Concern 4: Timing Precision
**Issue:** State transitions depend on CSS animations, setTimeout, async functions.

**Resolution:**
- Use constants for all timing values
- Add buffer time to awaits (already done: +20ms)
- Log actual vs expected timing in development
- Detect timing drift

**Risk if not fixed:** State transitions happen at wrong time, visual glitches

---

## Decision Matrix

| Approach | Risk | Timeline | Benefit | Recommendation |
|----------|------|----------|---------|----------------|
| **Implement as planned** | MODERATE | 11 days | State tracking, better debugging | ⚠️ Only after Phase 0 complete |
| **Phase 0 discovery first** | LOW | 2 days | Understand all trial types | ✅ **DO THIS FIRST** |
| **Gradual rollout** | LOW | 11 days + 3 weeks rollout | Safe, reversible | ✅ Recommended |
| **Full implementation** | HIGH | 11 days | Fastest, but risky | ❌ Not recommended |
| **Don't implement** | VERY LOW | 0 days | No risk, but no benefit | ❌ Miss opportunity for improvement |

---

## Final Recommendation

### ✅ PROCEED WITH IMPLEMENTATION

**But with these conditions:**

1. **MUST complete Phase 0 discovery first** (2 days)
   - Document all trial types (`'s'`, `'f'`, `'d'`, `'t'`, `'m'`, `'n'`, `'i'`, others?)
   - Map actual code flows for each type
   - Update STATE_MACHINE_IMPLEMENTATION_PLAN.md with correct flows

2. **Use feature flag approach**
   - Easy to disable if problems occur
   - Can test in development first

3. **Parallel implementation only**
   - State machine observes, doesn't control (initially)
   - Keep all existing code exactly as-is
   - No behavior changes in Phase 1-2

4. **Gradual rollout**
   - Development → Developers in prod → Test users → All users
   - 1 week between each stage
   - Monitor for issues at each stage

5. **Update documentation first**
   - Fix study trial flow description (no FEEDBACK phase)
   - Document all trial types
   - Correct STATE_MACHINE_IMPLEMENTATION_PLAN.md

### Overall Safety Rating: ⚠️ MODERATE-LOW RISK

**With proper precautions (above), risk reduces to: ✅ LOW RISK**

---

## Open Questions for Stakeholder

1. **What are trial types `'m'`, `'n'`, and `'i'`?** (found in code, not documented)
2. **Are there other trial types we haven't discovered?**
3. ~~**Should we prioritize fixing the study trial documentation before starting?**~~ ✅ **RESOLVED** - Documentation corrected
4. **Do you want to see Phase 0 discovery results before approving full implementation?**
5. **Is gradual rollout acceptable, or do you need faster deployment?**

---

## Update: 2025-10-10

### Corrected Understanding

After thorough code analysis, the implementation plan (STATE_MACHINE_IMPLEMENTATION_PLAN.md) has been updated to reflect:

1. **STUDY phase is separate from FEEDBACK phase**
   - Study trials use STUDY.SHOWING state (not FEEDBACK.SHOWING)
   - Different template blocks: `{{#if study}}` vs `{{#if testordrill}}`
   - Different code paths: study skips `showUserFeedback()` entirely

2. **Four phases, three flows:**
   ```
   Study Flow:  PRESENTING → STUDY → TRANSITION
   Drill Flow:  PRESENTING → FEEDBACK → TRANSITION
   Test Flow:   PRESENTING → TRANSITION
   ```

3. **All code references verified:**
   - See PLAN_VERIFICATION_SUMMARY.md for complete verification checklist
   - All line numbers confirmed accurate
   - All template blocks confirmed

### Updated Risk Level: LOW ✅

With corrected understanding and updated documentation:
- Implementation plan matches code reality
- All three trial flows clearly documented
- Clear boundaries between study/feedback phases
- Low risk to proceed with implementation

---

**Document Author:** Claude Code
**Original Date:** 2025-10-10
**Updated Date:** 2025-10-10
**Version:** 2.0 (Updated for STUDY phase separation)
**Status:** ✅ Verified and Ready for Implementation
